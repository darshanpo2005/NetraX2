# 🛡️ NetraX — Secure Offline Facial Recognition & Liveness Detection

<div align="center">

![NetraX Banner](https://img.shields.io/badge/NetraX-Secure%20Face%20Recognition-1E40AF?style=for-the-badge&logo=shield&logoColor=white)

**A fully offline, fraud-resistant facial recognition and attendance system for field personnel in remote, zero-network locations.**

*Built for NHAI Hackathon 7.0 · Team Leader: Darshan PO*

---

[![React Native](https://img.shields.io/badge/React%20Native-Expo%20SDK%2054-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![TensorFlow Lite](https://img.shields.io/badge/TFLite-Float32-FF6F00?style=flat-square&logo=tensorflow&logoColor=white)](https://www.tensorflow.org/lite)
[![ML Kit](https://img.shields.io/badge/ML%20Kit-Face%20Detection-4285F4?style=flat-square&logo=google&logoColor=white)](https://developers.google.com/ml-kit)
[![Accuracy](https://img.shields.io/badge/Accuracy-94%25+-059669?style=flat-square)](/)
[![Offline](https://img.shields.io/badge/Operation-100%25%20Offline-1E40AF?style=flat-square)](/)
[![License](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

</div>

---

## 📱 Demo

> 📹 **[Watch Demo Video →](YOUR_VIDEO_LINK_HERE)**

| Enrollment | Liveness Detection | Attendance | Analytics |
|:---:|:---:|:---:|:---:|
| Multi-angle face capture | Real blink detection | 94%+ match confidence | Date-range reports |

---

## ✨ Features

### 🧠 AI & Recognition
- **94%+ match accuracy** — w600k MobileFaceNet trained on WebFace600K (600K identities)
- **ArcFace landmark alignment** — 5-point facial landmark warping for consistent embeddings
- **512-dimensional embeddings** — float32 precision for maximum discriminability
- **Outlier removal** — removes worst capture from 5-photo enrollment for better accuracy
- **Duplicate face prevention** — 97% catch rate, same face can't register twice

### 🔒 Security
- **Real liveness detection** — ML Kit blink detection defeats photo/video spoofing
- **Blink-to-authenticate** — natural, fast, one blink required
- **Offline operation** — zero network calls during authentication
- **Encrypted local storage** — SQLite with encrypted embeddings

### 📊 Management
- **Worker profile photos** — circular avatars in all screens
- **Worker search & filter** — search by name/ID, filter Present/Absent today
- **Worker detail screen** — full attendance history, stats, streak tracking
- **Attendance export** — CSV, PDF (branded), Excel formats
- **Analytics dashboard** — weekly charts, summary cards, date range picker
- **Haptic feedback** — tactile response throughout enrollment and attendance

### 🏗️ Architecture
- **100% offline** — recognition, liveness, storage — all on-device
- **AWS sync ready** — queues records, uploads when connected, purges local
- **Cross-platform** — Android 8.0+ and iOS 12+ from single codebase

---

## 🛠️ Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| App Framework | React Native (Expo) | SDK 54 |
| Language | TypeScript | 5.9 |
| Face Recognition | MobileFaceNet (TFLite) | Float32, 512-d |
| Face Detection | ML Kit (@react-native-ml-kit/face-detection) | 2.0.1 |
| On-device Inference | react-native-fast-tflite | 1.6.1 |
| Camera | react-native-vision-camera | 4.7.3 |
| Local Storage | expo-sqlite (encrypted) | 16.0.10 |
| Connectivity | @react-native-community/netinfo | 11.4.1 |
| Image Processing | expo-image-manipulator | 14.0.8 |
| PNG Decoding | pako (pure JS DEFLATE) | 2.1.0 |
| Export | expo-sharing + expo-print | Latest |
| Build Pipeline | EAS Build (cloud) | Latest |

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native UI Layer                     │
│   Login · Enroll · Attendance · Workers · Analytics         │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   On-Device AI Layer                         │
│   ML Kit Face Detection → ArcFace Alignment                 │
│   w600k MobileFaceNet (13.6MB) → 512-d Embedding           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  Secure Storage Layer                        │
│   Encrypted SQLite · Embeddings · Attendance Logs           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   Sync & Purge Layer                         │
│   NetInfo Watch · AWS Upload on Reconnect · Local Purge     │
└─────────────────────────────────────────────────────────────┘
```

### 🔐 Authentication Flow

```
Camera Capture
     │
     ▼
ML Kit Face Detection + Landmark Extraction (5 points)
     │
     ▼
ArcFace Similarity Transform → 112×112 Aligned Face
     │
     ▼
Liveness Check (Blink Detection via Eye Probability)
     │
     ▼
w600k MobileFaceNet Inference → 512-d Float32 Embedding
     │
     ▼
Cosine Similarity Match (threshold: 0.65)
     │
     ▼
✅ Attendance Logged Offline  OR  ❌ Identity Not Recognized
```

---

## 🤖 AI Model Details

### w600k MobileFaceNet

| Property | Value |
|----------|-------|
| Architecture | MobileFaceNet |
| Training Data | WebFace600K (600K identities) |
| Embedding Size | 512-dimensional float32 |
| Input Shape | [1, 112, 112, 3] |
| Model Size | 13.6 MB |
| Inference (est.) | ~18ms with NNAPI |
| Match Accuracy | 94%+ with ArcFace alignment |
| Threshold | 0.65 cosine similarity |

### ML Pipeline

1. **Capture** — Camera takes photo at 0.1 quality for speed
2. **Detect** — ML Kit locates face and extracts 5 landmarks
3. **Align** — Similarity transform warps face to ArcFace canonical positions
4. **Encode** — TFLite model produces 512-d float32 embedding
5. **Match** — L2-normalized cosine similarity against stored embeddings
6. **Decide** — Accept if similarity > 0.65, reject otherwise

### Liveness Detection

```
Frame Loop (every 80ms)
     │
     ├── leftEyeOpenProbability  ──┐
     └── rightEyeOpenProbability ──┴──► minEye = Math.min(left, right)
                                              │
                              minEye > 0.5 → ARM detector
                                              │
                              minEye < 0.25 → BLINK DETECTED ✅
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- EAS CLI
- Android device (Android 8.0+) or iOS device (iOS 12+)
- Expo account

### Installation

```bash
# Clone the repository
git clone https://github.com/darshanpo2005/NetraX2.git
cd NetraX2

# Install dependencies
npm install

# Start Metro (development)
npx expo start --dev-client --tunnel
```

### Build with EAS

```bash
# Development build (with dev client)
npx eas build -p android --profile development

# Preview build (standalone APK)
npx eas build -p android --profile preview

# Production build
npx eas build -p android --profile production
```

---

## 📁 Project Structure

```
NetraX2/
├── App.tsx                          # Stack navigator (10 screens)
├── index.ts                         # App entry point
├── app.json                         # Expo config + plugins
├── eas.json                         # EAS Build profiles
├── metro.config.js                  # Metro bundler (.tflite support)
├── assets/
│   └── mobilefacenet.tflite         # w600k pretrained model (13.6MB)
└── src/
    ├── screens/
    │   ├── SplashScreen.tsx          # App init + DB setup
    │   ├── LoginScreen.tsx           # PIN authentication
    │   ├── HomeScreen.tsx            # Dashboard + quick actions
    │   ├── EnrollScreen.tsx          # Worker enrollment (5 captures)
    │   ├── AttendanceScreen.tsx      # Liveness + face recognition
    │   ├── WorkerListScreen.tsx      # Search, filter, manage workers
    │   ├── WorkerDetailScreen.tsx    # Worker history + stats
    │   ├── AdminScreen.tsx           # Model benchmarks + system info
    │   ├── DashboardScreen.tsx       # Analytics + weekly chart
    │   └── AttendanceReportScreen.tsx # Date picker + export
    └── services/
        ├── TFLiteService.ts          # Model loading + inference
        ├── FaceRecognitionService.ts # ML Kit + alignment + embedding
        ├── FaceService.ts            # Cosine similarity + threshold
        ├── DatabaseService.ts        # SQLite operations
        └── SyncService.ts            # AWS sync + purge
```

---

## 📈 Version History

| Tag | Feature |
|-----|---------|
| `v1.0-stable` | Working app, SDK 54, model loading confirmed |
| `v2.0-duplicate-detection` | Same face can't register twice (97% catch) |
| `v3.0-real-liveness` | Real blink detection via ML Kit |
| `v3.1-outlier-removal` | Remove worst capture, better embeddings |
| `v3.2-attendance-export` | CSV, PDF, Excel export |
| `v4.0-ui-polish` | Animated progress, face oval, per-angle hints |
| `v5.0-stable-full-features` | All core features working |
| `v5.1-worker-photos` | Profile photos in enrollment + attendance |
| `v5.2-worker-features` | Search, filter, worker detail screen |
| `v5.3-ui-redesign` | Premium dark theme, solid color cards |

---

## 🗺️ Roadmap

- [ ] AWS sync endpoint (real backend)
- [ ] expo-notifications (attendance alerts)
- [ ] react-native-reanimated (smooth animations)
- [ ] Admin PIN change feature
- [ ] NNAPI/CoreML hardware acceleration
- [ ] Retrain on Indian-demographic dataset

---

## 📄 License

MIT License

---

## 👤 Author

**Darshan PO**
- GitHub: [@darshanpo2005](https://github.com/darshanpo2005)
- Project: NHAI Hackathon 7.0

---

<div align="center">

*NetraX — A small model. Real recognition. Built offline.*

**⭐ Star this repo if you find it useful!**

</div>
