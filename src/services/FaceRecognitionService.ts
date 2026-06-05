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

// ─── INT8 normalization ───────────────────────────────────────────────────────
// MobileFaceNet INT8 quantization: zero_point=128, scale=1/128
// Maps [0,255] → [-128,127]  via  int8 = uint8 − 128
function rgbToInt8(rgb: Uint8Array): Int8Array {
  const out = new Int8Array(rgb.length);
  for (let i = 0; i < rgb.length; i++) out[i] = (rgb[i] - 128) as number;
  return out;
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

// ─── Public API ──────────────────────────────────────────────────────────────
export const extractFaceEmbedding = async (
  imageUri: string
): Promise<FaceEmbeddingResult> => {
  try {
    // ── 1. ML Kit face detection ──────────────────────────────────────────
    const faces = await FaceDetector.detect(imageUri);
    if (!faces || faces.length === 0) {
      return {
        success: false, embedding: null, faceDetected: false,
        error: 'No face detected — ensure good lighting and face the camera directly',
      };
    }

    // Pick the largest face
    const face = faces.reduce((best, f) =>
      f.frame.width * f.frame.height > best.frame.width * best.frame.height ? f : best
    );

    // ── 2. Get image dimensions for safe clamping ─────────────────────────
    const { width: imgW, height: imgH } = await getImageSize(imageUri);
    const crop = safeCrop(face.frame, imgW, imgH);

    // ── 3. Crop to face region then resize to 112×112 ─────────────────────
    const processed = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        { crop },
        { resize: { width: 112, height: 112 } },
      ],
      { format: ImageManipulator.SaveFormat.PNG, base64: true }
    );

    if (!processed.base64) {
      return { success: false, embedding: null, faceDetected: true, error: 'Image processing failed' };
    }

    // ── 4. Decode PNG → raw RGB (112×112×3) ──────────────────────────────
    const rgb = decodePngToRgb(processed.base64);
    if (!rgb || rgb.length < 112 * 112 * 3) {
      return { success: false, embedding: null, faceDetected: true, error: 'PNG decode failed' };
    }

    // ── 5. Normalize to INT8 input tensor [1, 112, 112, 3] ───────────────
    const inputTensor = rgbToInt8(rgb);

    // ── 6. TFLite inference ───────────────────────────────────────────────
    const model   = await loadFaceModel();
    const outputs = model.runSync([inputTensor]);

    // ── 7. Extract float32 [128] embedding and L2-normalize ───────────────
    const rawEmb = outputs[0] as Float32Array;
    if (!rawEmb || rawEmb.length !== 128) {
      return {
        success: false, embedding: null, faceDetected: true,
        error: `Unexpected output length ${rawEmb?.length ?? 0} (expected 128)`,
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
