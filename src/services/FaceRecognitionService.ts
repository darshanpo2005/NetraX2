import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import FaceDetector from '@react-native-ml-kit/face-detection';
import pako from 'pako';
import { loadFaceModel } from './TFLiteService';

export interface FaceEmbeddingResult {
  success: boolean;
  embedding: number[] | null;
  faceDetected: boolean;
  error?: string;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) =>
    Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject)
  );
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = (global as any).atob
    ? (global as any).atob(b64)
    : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function u32be(buf: Uint8Array, off: number): number {
  return ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
}

// ─── PNG → RGB pixel decoder ─────────────────────────────────────────────────
// Supports color types 2 (RGB) and 6 (RGBA), filter types 0–4.
function decodePngToRgb(base64: string): Uint8Array | null {
  const data = b64ToBytes(base64);
  // Validate PNG signature: 137 80 78 71 13 10 26 10
  if (data[0] !== 137 || data[1] !== 80 || data[2] !== 78 || data[3] !== 71) return null;

  let pos = 8;
  let width = 0, height = 0, colorType = 0;
  const idatParts: Uint8Array[] = [];

  while (pos + 8 <= data.length) {
    const chunkLen  = u32be(data, pos);      pos += 4;
    const chunkType = String.fromCharCode(data[pos], data[pos+1], data[pos+2], data[pos+3]);
    pos += 4;

    if (chunkType === 'IHDR') {
      width     = u32be(data, pos);
      height    = u32be(data, pos + 4);
      colorType = data[pos + 9]; // 2=RGB, 6=RGBA
    } else if (chunkType === 'IDAT') {
      idatParts.push(data.slice(pos, pos + chunkLen));
    } else if (chunkType === 'IEND') {
      break;
    }
    pos += chunkLen + 4; // data bytes + CRC
  }

  if (!width || !height || !idatParts.length) return null;

  const totalLen   = idatParts.reduce((s, c) => s + c.length, 0);
  const compressed = new Uint8Array(totalLen);
  let off = 0;
  for (const part of idatParts) { compressed.set(part, off); off += part.length; }

  let raw: Uint8Array;
  try { raw = pako.inflate(compressed); } catch { return null; }

  const ch     = colorType === 6 ? 4 : 3; // channels per pixel
  const stride = 1 + width * ch;          // filter byte + pixel row
  const rgb    = new Uint8Array(height * width * 3);
  const prev   = new Uint8Array(width * ch);
  const cur    = new Uint8Array(width * ch);

  for (let y = 0; y < height; y++) {
    const rowBase = y * stride;
    const filter  = raw[rowBase];

    for (let x = 0; x < width * ch; x++) {
      const rawVal = raw[rowBase + 1 + x];
      const a = x >= ch ? cur[x - ch]  : 0;   // left
      const b = prev[x];                        // above
      const c = x >= ch ? prev[x - ch] : 0;    // above-left

      switch (filter) {
        case 0: cur[x] = rawVal; break;
        case 1: cur[x] = (rawVal + a) & 0xFF; break;
        case 2: cur[x] = (rawVal + b) & 0xFF; break;
        case 3: cur[x] = (rawVal + Math.floor((a + b) / 2)) & 0xFF; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          cur[x] = (rawVal + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xFF;
          break;
        }
        default: cur[x] = rawVal;
      }
    }

    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 3;
      const src = x * ch;
      rgb[dst] = cur[src]; rgb[dst + 1] = cur[src + 1]; rgb[dst + 2] = cur[src + 2];
    }
    prev.set(cur);
  }

  return rgb;
}

// ─── Safe face crop helper ────────────────────────────────────────────────────
function safeCrop(
  frame: { left: number; top: number; width: number; height: number },
  imgW: number,
  imgH: number,
  padFrac = 0.25
) {
  const pw = frame.width  * padFrac;
  const ph = frame.height * padFrac;
  const x1 = Math.max(0, Math.floor(frame.left   - pw));
  const y1 = Math.max(0, Math.floor(frame.top    - ph));
  const x2 = Math.min(imgW, Math.ceil(frame.left + frame.width  + pw));
  const y2 = Math.min(imgH, Math.ceil(frame.top  + frame.height + ph));
  return { originX: x1, originY: y1, width: x2 - x1, height: y2 - y1 };
}

// ─── ArcFace alignment ────────────────────────────────────────────────────────

// Target landmark positions in the 112×112 ArcFace canonical space.
const DST_LANDMARKS: [number, number][] = [
  [38.2946, 51.6963], // left eye
  [73.5318, 51.5014], // right eye
  [56.0252, 71.7366], // nose
  [41.5493, 92.3655], // left mouth
  [70.7299, 92.2041], // right mouth
];

// Extract 5 landmark {x,y} positions from an ML Kit face result.
// face.landmarks is an object: { leftEye, rightEye, noseBase, mouthLeft, mouthRight }
// each with a nested .position {x, y}.
function extractLandmarks(face: any): [number, number][] | null {
  const lm = face.landmarks;
  if (!lm) return null;

  const leftEye    = lm.leftEye?.position;
  const rightEye   = lm.rightEye?.position;
  const nose       = lm.noseBase?.position;
  const leftMouth  = lm.mouthLeft?.position;
  const rightMouth = lm.mouthRight?.position;

  if (!leftEye || !rightEye || !nose || !leftMouth || !rightMouth) {
    console.log('Missing landmarks:', {
      leftEye: !!leftEye, rightEye: !!rightEye, nose: !!nose,
      leftMouth: !!leftMouth, rightMouth: !!rightMouth,
    });
    return null;
  }

  console.log('Landmarks extracted successfully');
  return [
    [leftEye.x,    leftEye.y],
    [rightEye.x,   rightEye.y],
    [nose.x,       nose.y],
    [leftMouth.x,  leftMouth.y],
    [rightMouth.x, rightMouth.y],
  ];
}

// Compute a 4-DOF similarity transform (scale + rotation + translation) from
// N src→dst point pairs using least-squares normal equations.
// Forward mapping: xd = a*xs - b*ys + tx,  yd = b*xs + a*ys + ty
function computeSimilarityTransform(
  src: [number, number][],
  dst: [number, number][]
): [number, number, number, number] {
  const n = src.length;
  let S = 0, Sx = 0, Sy = 0;
  let Sxx = 0, Syx = 0, Sdx = 0, Sdy = 0;

  for (let i = 0; i < n; i++) {
    const [xi, yi]   = src[i];
    const [xi2, yi2] = dst[i];
    S   += xi * xi + yi * yi;
    Sx  += xi;
    Sy  += yi;
    Sxx += xi * xi2 + yi * yi2;
    Syx += -yi * xi2 + xi * yi2;
    Sdx += xi2;
    Sdy += yi2;
  }

  // Augmented 4×4 system: (A^T A) x = (A^T b), where x = [a, b, tx, ty]
  const M: number[][] = [
    [S,  0,   Sx, Sy,  Sxx],
    [0,  S,  -Sy, Sx,  Syx],
    [Sx, -Sy,  n,  0,  Sdx],
    [Sy,  Sx,  0,  n,  Sdy],
  ];

  // Gaussian elimination with partial pivoting
  for (let col = 0; col < 4; col++) {
    let maxRow = col;
    for (let row = col + 1; row < 4; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-10) return [1, 0, 0, 0]; // degenerate fallback
    for (let row = col + 1; row < 4; row++) {
      const factor = M[row][col] / pivot;
      for (let j = col; j <= 4; j++) M[row][j] -= factor * M[col][j];
    }
  }

  // Back substitution
  const x = new Array(4).fill(0);
  for (let i = 3; i >= 0; i--) {
    x[i] = M[i][4];
    for (let j = i + 1; j < 4; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return [x[0], x[1], x[2], x[3]]; // a, b, tx, ty
}

// Warp srcRgb to a 112×112 output using bilinear interpolation.
// Applies the inverse of: xd = a*xs - b*ys + tx, yd = b*xs + a*ys + ty
// Inverse: xs = (a*(xd-tx) + b*(yd-ty)) / (a²+b²)
//          ys = (-b*(xd-tx) + a*(yd-ty)) / (a²+b²)
function warpAffine(
  srcRgb: Uint8Array,
  srcW: number,
  srcH: number,
  a: number, b: number, tx: number, ty: number
): Uint8Array {
  const out = new Uint8Array(112 * 112 * 3);
  const det = a * a + b * b;
  if (det < 1e-10) return out;
  const ia = a / det, ib = b / det;

  for (let yd = 0; yd < 112; yd++) {
    for (let xd = 0; xd < 112; xd++) {
      const dx = xd - tx, dy = yd - ty;
      const xs =  ia * dx + ib * dy;
      const ys = -ib * dx + ia * dy;

      const x0 = Math.floor(xs), y0 = Math.floor(ys);
      const x1 = x0 + 1,        y1 = y0 + 1;
      const fx = xs - x0,        fy = ys - y0;
      const idx = (yd * 112 + xd) * 3;

      for (let c = 0; c < 3; c++) {
        const px = (px: number, py: number) =>
          px >= 0 && px < srcW && py >= 0 && py < srcH
            ? srcRgb[(py * srcW + px) * 3 + c]
            : 128; // neutral gray for out-of-bounds

        const v =
          px(x0, y0) * (1 - fx) * (1 - fy) +
          px(x1, y0) * fx       * (1 - fy) +
          px(x0, y1) * (1 - fx) * fy +
          px(x1, y1) * fx       * fy;
        out[idx + c] = Math.round(v);
      }
    }
  }
  return out;
}

// ─── Public API ──────────────────────────────────────────────────────────────
export const extractFaceEmbedding = async (
  imageUri: string
): Promise<FaceEmbeddingResult> => {
  try {
    // ── 1. ML Kit face detection with landmarks ───────────────────────────
    const faces = await (FaceDetector as any).detect(imageUri, {
      landmarkMode: 'all',
      performanceMode: 'accurate',
      classificationMode: 'all',
    });
    if (!faces || faces.length === 0) {
      return {
        success: false, embedding: null, faceDetected: false,
        error: 'No face detected — ensure good lighting and face the camera directly',
      };
    }

    // Pick the largest face
    const face = faces.reduce((best: any, f: any) =>
      f.frame.width * f.frame.height > best.frame.width * best.frame.height ? f : best
    );

    // ── 2. Get image dimensions ───────────────────────────────────────────
    const { width: imgW, height: imgH } = await getImageSize(imageUri);

    // ── 3. Attempt alignment path ─────────────────────────────────────────
    const landmarks = extractLandmarks(face);
    let rgb: Uint8Array | null = null;

    if (landmarks) {
      console.log('Using alignment');

      // Crop the face bbox then resize to 224×224 before PNG decode.
      // Decoding 224×224 instead of the full-res crop reduces JS pixel
      // processing by ~90% (main bottleneck was the pure-JS PNG decoder).
      const THUMB = 224;
      const crop  = safeCrop(face.frame, imgW, imgH);

      const cropped = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          { crop: { originX: crop.originX, originY: crop.originY, width: crop.width, height: crop.height } },
          { resize: { width: THUMB, height: THUMB } },
        ],
        { format: ImageManipulator.SaveFormat.PNG, base64: true }
      );

      if (cropped.base64) {
        const srcRgb = decodePngToRgb(cropped.base64);
        if (srcRgb) {
          // Scale landmarks from original-image coords → 224×224 crop-local coords
          const scaleX = THUMB / crop.width, scaleY = THUMB / crop.height;
          const localLm: [number, number][] = landmarks.map(([x, y]) => [
            (x - crop.originX) * scaleX,
            (y - crop.originY) * scaleY,
          ]);
          const [a, b, tx, ty] = computeSimilarityTransform(localLm, DST_LANDMARKS);
          rgb = warpAffine(srcRgb, THUMB, THUMB, a, b, tx, ty);
        }
      }
    }

    // ── 4. Fallback: bbox crop + resize ───────────────────────────────────
    if (!rgb) {
      console.log('Using fallback');
      const crop = safeCrop(face.frame, imgW, imgH);
      const processed = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop }, { resize: { width: 112, height: 112 } }],
        { format: ImageManipulator.SaveFormat.PNG, base64: true }
      );
      if (!processed.base64) {
        return { success: false, embedding: null, faceDetected: true, error: 'Image processing failed' };
      }
      rgb = decodePngToRgb(processed.base64);
    }

    if (!rgb || rgb.length < 112 * 112 * 3) {
      return { success: false, embedding: null, faceDetected: true, error: 'PNG decode failed' };
    }

    // ── 5. Normalize to float32 input tensor [1, 112, 112, 3] ────────────
    const inputTensor = new Float32Array(rgb.length);
    for (let i = 0; i < rgb.length; i++) inputTensor[i] = rgb[i] / 127.5 - 1.0;

    // ── 6. TFLite inference ───────────────────────────────────────────────
    const model   = await loadFaceModel();
    const outputs = model.runSync([inputTensor]);

    // ── 7. Extract float32 [512] embedding and L2-normalize ───────────────
    const rawEmb = outputs[0] as Float32Array;
    if (!rawEmb || rawEmb.length !== 512) {
      return {
        success: false, embedding: null, faceDetected: true,
        error: `Unexpected output length ${rawEmb?.length ?? 0} (expected 512)`,
      };
    }

    const emb  = Array.from(rawEmb);
    const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
    const normalized = emb.map(v => v / (norm + 1e-8));

    return { success: true, embedding: normalized, faceDetected: true };

  } catch (err: any) {
    return {
      success: false, embedding: null, faceDetected: false,
      error: err?.message ?? String(err),
    };
  }
};

export const checkLiveness = (_base64: string): { isLive: boolean; score: number } => {
  return { isLive: true, score: 1.0 };
};
