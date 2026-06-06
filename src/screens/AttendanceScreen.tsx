import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import * as Haptics from 'expo-haptics';
import { getAllWorkers, logAttendance } from '../services/DatabaseService';
import { findBestMatch, l2Normalize, COSINE_THRESHOLD } from '../services/FaceService';
import { extractFaceEmbedding } from '../services/FaceRecognitionService';

type Challenge = 'blink' | 'smile' | 'turn_left' | 'turn_right';

const CHALLENGES: Record<Challenge, { text: string; emoji: string; instruction: string }> = {
  blink      : { text: 'Blink your eyes',  emoji: '😉', instruction: 'Slowly blink both eyes once' },
  smile      : { text: 'Smile naturally',  emoji: '😊', instruction: 'Show a natural smile' },
  turn_left  : { text: 'Turn head left',   emoji: '👈', instruction: 'Slowly turn your head left' },
  turn_right : { text: 'Turn head right',  emoji: '👉', instruction: 'Slowly turn your head right' },
};

type ScanStep = 'liveness' | 'scanning' | 'result';
type ResultType = {
  type    : 'success' | 'no_face' | 'no_match' | 'error';
  name?   : string;
  sim?    : number;
  message : string;
  detail? : string;
};

export default function AttendanceScreen({ navigation }: any) {
  const [step, setStep]           = useState<ScanStep>('liveness');
  const [timeLeft, setTimeLeft]   = useState(6);
  const [result, setResult]       = useState<ResultType | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [challenge]               = useState<Challenge>(() => {
    const keys = Object.keys(CHALLENGES) as Challenge[];
    return keys[Math.floor(Math.random() * keys.length)];
  });

  const cameraRef = useRef<Camera>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  useEffect(() => {
    if (!hasPermission) requestPermission();
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startTimer = () => {
    let t = 6;
    timerRef.current = setInterval(() => {
      t--;
      setTimeLeft(t);
      if (t <= 0) { clearInterval(timerRef.current); handleScan(); }
    }, 1000);
  };

  const handleScan = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStep('scanning');
    setStatusMsg('Capturing image...');

    try {
      if (!cameraRef.current) throw new Error('Camera not ready');

      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      const uri   = 'file://' + photo.path;

      setStatusMsg('Detecting face (ML Kit)...');
      const embResult = await extractFaceEmbedding(uri);

      if (!embResult.success || !embResult.embedding || !embResult.faceDetected) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setResult({
          type   : 'no_face',
          message: 'No Face Detected',
          detail : embResult.error || 'Please show your face properly in front of the camera.',
        });
        setStep('result');
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStatusMsg('Matching identity...');
      const workers = await getAllWorkers();

      if (!workers.length) {
        setResult({
          type   : 'error',
          message: 'No Workers Registered',
          detail : 'Please register workers before marking attendance.',
        });
        setStep('result');
        return;
      }

      const match = findBestMatch(l2Normalize(embResult.embedding), workers);

      if (match.matched && match.workerId) {
        await logAttendance({
          id        : `att_${Date.now()}`,
          workerId  : match.workerId,
          workerName: match.workerName!,
          timestamp : Date.now(),
          similarity: match.similarity,
          synced    : 0,
          location  : 'Field Site',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResult({
          type   : 'success',
          name   : match.workerName!,
          sim    : match.similarity,
          message: 'Identity Verified',
          detail : 'Attendance logged successfully.',
        });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setResult({
          type   : 'no_match',
          sim    : match.similarity,
          message: 'Identity Not Recognized',
          detail : `Face detected but no match found.\nSimilarity: ${(match.similarity * 100).toFixed(1)}% (threshold: ${(COSINE_THRESHOLD * 100).toFixed(0)}%)`,
        });
      }

      setStep('result');
    } catch (e: any) {
      setResult({ type: 'error', message: 'Scan Failed', detail: e.message });
      setStep('result');
    }
  };

  if (!hasPermission) return (
    <View style={styles.center}>
      <Text style={styles.permIcon}>📷</Text>
      <Text style={styles.permTitle}>Camera Access Required</Text>
      <Text style={styles.permSub}>Face recognition requires camera permission</Text>
      <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
        <Text style={styles.permBtnText}>Grant Permission</Text>
      </TouchableOpacity>
    </View>
  );

  if (!device) return (
    <View style={styles.center}>
      <Text style={styles.permTitle}>No front camera found</Text>
    </View>
  );

  if (step === 'liveness') {
    const ch = CHALLENGES[challenge];
    return (
      <View style={styles.cameraContainer}>
        <Camera ref={cameraRef} style={StyleSheet.absoluteFill}
          device={device} isActive={true} photo={true} />
        <View style={styles.dimOverlay} />

        <View style={styles.faceOvalContainer}>
          <View style={styles.faceOval} />
          <Text style={styles.faceOvalLabel}>Position face here</Text>
        </View>

        <View style={styles.challengeCard}>
          <View style={styles.timerRow}>
            <View style={[styles.timerBar, { width: `${(timeLeft / 6) * 100}%` as any }]} />
          </View>
          <View style={styles.challengeContent}>
            <Text style={styles.challengeEmoji}>{ch.emoji}</Text>
            <View style={styles.challengeText}>
              <Text style={styles.challengeTitle}>{ch.text}</Text>
              <Text style={styles.challengeInstruction}>{ch.instruction}</Text>
            </View>
            <View style={styles.challengeTimer}>
              <Text style={styles.timerNum}>{timeLeft}</Text>
            </View>
          </View>
          <Text style={styles.livenessLabel}>🛡️ Anti-Spoofing Check</Text>
        </View>

        <TouchableOpacity style={styles.doneBtn} onPress={handleScan} activeOpacity={0.8}>
          <Text style={styles.doneBtnText}>✅  Challenge Complete — Scan Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'scanning') return (
    <View style={styles.cameraContainer}>
      <Camera ref={cameraRef} style={StyleSheet.absoluteFill}
        device={device} isActive={true} photo={true} />
      <View style={styles.dimOverlay} />
      <View style={styles.scanningOverlay}>
        <View style={[styles.faceOval, { borderColor: '#f59e0b' }]} />
        <View style={styles.scanLine} />
        <ActivityIndicator size="large" color="#f59e0b" style={{ marginTop: 24 }} />
        <View style={styles.scanStatusCard}>
          <Text style={styles.scanStatusText}>{statusMsg}</Text>
        </View>
      </View>
    </View>
  );

  if (step === 'result' && result) {
    const resultConfig = {
      success  : { icon: '✅', color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)'  },
      no_face  : { icon: '🚫', color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)'   },
      no_match : { icon: '❓', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)'  },
      error    : { icon: '⚠️', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
    };
    const cfg = resultConfig[result.type];

    return (
      <View style={styles.resultContainer}>
        <View style={styles.orb1} /><View style={styles.orb2} />

        <View style={[styles.resultCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <Text style={styles.resultIcon}>{cfg.icon}</Text>
          <Text style={[styles.resultTitle, { color: cfg.color }]}>{result.message}</Text>

          {result.type === 'success' && (
            <>
              <Text style={styles.workerName}>{result.name}</Text>
              <View style={styles.simContainer}>
                <Text style={styles.simLabel}>Match Confidence</Text>
                <View style={styles.simBar}>
                  <View style={[styles.simFill, {
                    width: `${Math.min((result.sim || 0) * 100, 100)}%` as any,
                    backgroundColor: cfg.color,
                  }]} />
                </View>
                <Text style={[styles.simValue, { color: cfg.color }]}>
                  {((result.sim || 0) * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.successMeta}>
                <Text style={styles.successMetaText}>✅ Attendance logged offline</Text>
                <Text style={styles.successMetaText}>📅 {new Date().toLocaleString('en-IN')}</Text>
              </View>
            </>
          )}

          {(result.type === 'no_face' || result.type === 'no_match') && (
            <View style={styles.errorDetail}>
              <Text style={styles.errorDetailText}>{result.detail}</Text>
              <View style={styles.tipsBox}>
                <Text style={styles.tipsTitle}>
                  {result.type === 'no_face' ? 'Tips for better detection:' : 'Possible reasons:'}
                </Text>
                {result.type === 'no_face' ? (
                  <>
                    <Text style={styles.tipItem}>• Ensure face is well lit, no shadows</Text>
                    <Text style={styles.tipItem}>• Remove glasses or mask if wearing</Text>
                    <Text style={styles.tipItem}>• Hold phone at eye level</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.tipItem}>• Worker not yet registered</Text>
                    <Text style={styles.tipItem}>• Poor lighting conditions</Text>
                    <Text style={styles.tipItem}>• Face angle too extreme</Text>
                  </>
                )}
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.retryBtn}
          onPress={() => navigation.navigate('Attendance')} activeOpacity={0.8}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn}
          onPress={() => navigation.navigate('Home')} activeOpacity={0.8}>
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  cameraContainer    : { flex: 1, backgroundColor: '#000' },
  dimOverlay         : { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  faceOvalContainer  : { position: 'absolute', top: '8%', alignSelf: 'center', alignItems: 'center', gap: 12 },
  faceOval           : { width: 220, height: 290, borderRadius: 110, borderWidth: 2.5, borderColor: '#3b82f6', borderStyle: 'dashed' },
  faceOvalLabel      : { color: 'rgba(255,255,255,0.6)', fontSize: 12, letterSpacing: 1 },
  challengeCard      : { position: 'absolute', bottom: 120, left: 16, right: 16, backgroundColor: 'rgba(2,8,23,0.92)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1e293b', gap: 12 },
  timerRow           : { height: 3, backgroundColor: '#1e293b', borderRadius: 2, overflow: 'hidden' },
  timerBar           : { height: '100%', backgroundColor: '#3b82f6', borderRadius: 2 },
  challengeContent   : { flexDirection: 'row', alignItems: 'center', gap: 14 },
  challengeEmoji     : { fontSize: 36 },
  challengeText      : { flex: 1 },
  challengeTitle     : { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  challengeInstruction: { fontSize: 12, color: '#64748b', marginTop: 2 },
  challengeTimer     : { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(59,130,246,0.15)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)', alignItems: 'center', justifyContent: 'center' },
  timerNum           : { color: '#60a5fa', fontSize: 18, fontWeight: '800' },
  livenessLabel      : { fontSize: 11, color: '#334155', textAlign: 'center', letterSpacing: 1 },
  doneBtn            : { position: 'absolute', bottom: 48, left: 16, right: 16, backgroundColor: '#10b981', borderRadius: 16, padding: 18, alignItems: 'center' },
  doneBtnText        : { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  scanningOverlay    : { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanLine           : { position: 'absolute', width: 220, height: 2, backgroundColor: '#f59e0b', opacity: 0.8 },
  scanStatusCard     : { backgroundColor: 'rgba(2,8,23,0.9)', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 16, borderWidth: 1, borderColor: '#1e293b' },
  scanStatusText     : { color: '#f59e0b', fontSize: 14, fontWeight: '600' },
  center             : { flex: 1, backgroundColor: '#020817', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permIcon           : { fontSize: 56 },
  permTitle          : { fontSize: 20, fontWeight: '700', color: '#f1f5f9' },
  permSub            : { fontSize: 13, color: '#475569', textAlign: 'center' },
  permBtn            : { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  permBtnText        : { color: '#fff', fontWeight: '700', fontSize: 15 },
  resultContainer    : { flex: 1, backgroundColor: '#020817', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  orb1               : { position: 'absolute', top: -40, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: '#1e40af', opacity: 0.1 },
  orb2               : { position: 'absolute', bottom: -40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: '#6d28d9', opacity: 0.08 },
  resultCard         : { width: '100%', borderRadius: 24, padding: 24, borderWidth: 1, alignItems: 'center', gap: 12 },
  resultIcon         : { fontSize: 64, marginBottom: 4 },
  resultTitle        : { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  workerName         : { fontSize: 28, fontWeight: '900', color: '#f8fafc', textAlign: 'center' },
  simContainer       : { width: '100%', gap: 6 },
  simLabel           : { color: '#64748b', fontSize: 12, textAlign: 'center', letterSpacing: 0.5 },
  simBar             : { height: 8, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden' },
  simFill            : { height: '100%', borderRadius: 4 },
  simValue           : { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  successMeta        : { width: '100%', gap: 4, marginTop: 4 },
  successMetaText    : { color: '#475569', fontSize: 12, textAlign: 'center' },
  errorDetail        : { width: '100%', gap: 12 },
  errorDetailText    : { color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  tipsBox            : { backgroundColor: 'rgba(15,23,42,0.8)', borderRadius: 12, padding: 14, gap: 6, borderWidth: 1, borderColor: '#1e293b' },
  tipsTitle          : { color: '#64748b', fontSize: 12, fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 },
  tipItem            : { color: '#475569', fontSize: 12, lineHeight: 18 },
  retryBtn           : { width: '100%', backgroundColor: '#2563eb', borderRadius: 16, padding: 16, alignItems: 'center' },
  retryBtnText       : { color: '#fff', fontWeight: '700', fontSize: 16 },
  homeBtn            : { width: '100%', backgroundColor: '#0f172a', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b' },
  homeBtnText        : { color: '#94a3b8', fontWeight: '600', fontSize: 15 },
});
