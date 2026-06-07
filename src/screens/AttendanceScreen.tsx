import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import FaceDetector from '@react-native-ml-kit/face-detection';
import * as Haptics from 'expo-haptics';
import { getAllWorkers, logAttendance } from '../services/DatabaseService';
import { findBestMatch, l2Normalize, COSINE_THRESHOLD } from '../services/FaceService';
import { extractFaceEmbedding } from '../services/FaceRecognitionService';

const CHALLENGE    = { text: 'Blink your eyes', emoji: '😉', instruction: 'Blink slowly once' };
const LIVENESS_SECS = 12;

type ScanStep = 'liveness' | 'scanning' | 'result';
type ResultType = {
  type: 'success' | 'no_face' | 'no_match' | 'error' | 'liveness_fail';
  name?: string;
  sim?: number;
  message: string;
  detail?: string;
};

export default function AttendanceScreen({ navigation }: any) {
  const [step, setStep]               = useState<ScanStep>('liveness');
  const [timeLeft, setTimeLeft]       = useState(LIVENESS_SECS);
  const [result, setResult]           = useState<ResultType | null>(null);
  const [statusMsg, setStatusMsg]     = useState('');
  const [liveFeedback, setLiveFeedback] = useState('Center your face in the oval');
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [faceDetected, setFaceDetected]     = useState(false);
  const [debugInfo, setDebugInfo]           = useState('');

  const cameraRef            = useRef<Camera>(null);
  const timerRef             = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const captureRef           = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const eyesWereOpenRef      = useRef(false);
  const minEyeSeenRef        = useRef(1.0);
  const livenessPassedRef    = useRef(false);
  const captureInProgressRef = useRef(false);

  // ─── Animations ──────────────────────────────────────────────────────────
  // Oval border colour: 0=blue, 1=green (JS driver required for colour interp)
  const ovalColorAnim = useRef(new Animated.Value(0)).current;
  // Pulsing ring: 0→1 loop (native driver OK for scale/opacity)
  const pulseAnim     = useRef(new Animated.Value(0)).current;
  const pulseLoopRef  = useRef<Animated.CompositeAnimation | null>(null);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  // Start/stop pulse loop
  useEffect(() => {
    pulseLoopRef.current = Animated.loop(
      Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
    );
    pulseLoopRef.current.start();
    return () => { pulseLoopRef.current?.stop(); };
  }, []);

  // Animate oval colour whenever face detection or pass state changes
  useEffect(() => {
    Animated.timing(ovalColorAnim, {
      toValue       : faceDetected || livenessPassed ? 1 : 0,
      duration      : 300,
      useNativeDriver: false,
    }).start();
  }, [faceDetected, livenessPassed]);

  const ovalBorderColor = ovalColorAnim.interpolate({
    inputRange : [0, 1],
    outputRange: ['#3b82f6', '#10b981'],
  });
  const ringScale = pulseAnim.interpolate({
    inputRange : [0, 1],
    outputRange: [1.0, 1.35],
  });
  const ringOpacity = pulseAnim.interpolate({
    inputRange : [0, 0.5, 1],
    outputRange: [0.45, 0.15, 0],
  });

  const stopAllIntervals = useCallback(() => {
    if (timerRef.current)   { clearInterval(timerRef.current);   timerRef.current   = undefined; }
    if (captureRef.current) { clearInterval(captureRef.current); captureRef.current = undefined; }
  }, []);

  const stopAllIntervalsRef = useRef(stopAllIntervals);
  stopAllIntervalsRef.current = stopAllIntervals;

  const handleRecognition = useCallback(async () => {
    pulseLoopRef.current?.stop();
    setStep('scanning');
    setStatusMsg('Capturing image...');
    try {
      if (!cameraRef.current) throw new Error('Camera not ready');

      const photo = await cameraRef.current.takePhoto({ flash: 'off', enableShutterSound: false });
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
        setResult({ type: 'error', message: 'No Workers Registered', detail: 'Please register workers before marking attendance.' });
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
        setResult({ type: 'success', name: match.workerName!, sim: match.similarity, message: 'Identity Verified', detail: 'Attendance logged successfully.' });
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
  }, []);

  const handleRecognitionRef = useRef(handleRecognition);
  handleRecognitionRef.current = handleRecognition;

  const checkLivenessFrame = useCallback(async () => {
    if (livenessPassedRef.current || captureInProgressRef.current) return;
    if (!cameraRef.current) return;

    captureInProgressRef.current = true;
    try {
      const photo = await cameraRef.current.takePhoto({ flash: 'off', enableShutterSound: false });
      const uri   = 'file://' + photo.path;

      const faces = await FaceDetector.detect(uri, {
        classificationMode: 'all',
        performanceMode   : 'fast',
        landmarkMode      : 'none',
      });

      if (!faces || faces.length === 0) {
        setFaceDetected(false);
        setLiveFeedback('No face found — center your face');
        setDebugInfo('');
        return;
      }

      setFaceDetected(true);
      const face    = faces[0];
      const leftEye = face.leftEyeOpenProbability  ?? 1;
      const rightEye= face.rightEyeOpenProbability ?? 1;

      setDebugInfo(`Eyes: L${leftEye.toFixed(2)} R${rightEye.toFixed(2)}`);

      const minEye = Math.min(leftEye, rightEye);
      if (minEye > 0.5) {
        eyesWereOpenRef.current = true;
        minEyeSeenRef.current   = 1.0;
      }

      if (eyesWereOpenRef.current) {
        minEyeSeenRef.current = Math.min(minEyeSeenRef.current, minEye);
        if (minEyeSeenRef.current < 0.25) {
          livenessPassedRef.current = true;
          setLivenessPassed(true);
          setLiveFeedback('✓ Blink detected!');
          stopAllIntervalsRef.current();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => handleRecognitionRef.current(), 600);
        } else {
          setLiveFeedback('Blink slowly once');
        }
      } else {
        setLiveFeedback('Blink slowly once');
      }
    } catch {
      // silently skip failed captures
    } finally {
      captureInProgressRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!hasPermission) requestPermission();

    let t = LIVENESS_SECS;
    timerRef.current = setInterval(() => {
      t--;
      setTimeLeft(t);
      if (t <= 0) {
        stopAllIntervalsRef.current();
        if (!livenessPassedRef.current) {
          setResult({ type: 'liveness_fail', message: 'Liveness Check Failed', detail: 'Please try again and complete the challenge within 12 seconds.' });
          setStep('result');
        }
      }
    }, 1000);

    captureRef.current = setInterval(checkLivenessFrame, 80);
    return () => stopAllIntervalsRef.current();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Permission guard ─────────────────────────────────────────────────────
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

  // ─── Liveness step ────────────────────────────────────────────────────────
  if (step === 'liveness') {
    const timerPct = `${(timeLeft / LIVENESS_SECS) * 100}%` as any;
    // Timer urgency colour
    const timerColor = timeLeft <= 3 ? '#ef4444' : timeLeft <= 6 ? '#f59e0b' : '#3b82f6';

    return (
      <View style={styles.cameraContainer}>
        <Camera ref={cameraRef} style={StyleSheet.absoluteFill}
          device={device} isActive={true} photo={true} />
        <View style={styles.dimOverlay} />

        {/* Face oval + pulse ring */}
        <View style={styles.faceOvalContainer}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            {/* Pulsing ring behind oval */}
            {!livenessPassed && (
              <Animated.View style={[
                styles.pulseRing,
                { transform: [{ scale: ringScale }], opacity: ringOpacity,
                  borderColor: faceDetected ? '#10b981' : '#3b82f6' },
              ]} />
            )}
            {/* Animated oval */}
            <Animated.View style={[
              styles.faceOval,
              { borderColor: ovalBorderColor },
              livenessPassed && { borderStyle: 'solid' },
            ]} />
            {livenessPassed && (
              <View style={styles.passedBadge}>
                <Text style={styles.passedBadgeText}>✓</Text>
              </View>
            )}
          </View>
          {/* Face detection status */}
          <View style={[styles.faceStatusPill, {
            backgroundColor: livenessPassed ? 'rgba(16,185,129,0.15)' :
                              faceDetected   ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            borderColor: livenessPassed ? 'rgba(16,185,129,0.4)' :
                         faceDetected   ? 'rgba(16,185,129,0.4)'  : 'rgba(239,68,68,0.4)',
          }]}>
            <Text style={[styles.faceStatusText, {
              color: livenessPassed ? '#10b981' : faceDetected ? '#10b981' : '#ef4444',
            }]}>
              {livenessPassed ? '✓ Liveness verified' : faceDetected ? 'Face detected ✓' : 'No face found'}
            </Text>
          </View>
        </View>

        {/* Challenge card */}
        <View style={styles.challengeCard}>
          {/* Timer progress bar */}
          <View style={styles.timerRow}>
            <View style={[styles.timerBar, { width: timerPct, backgroundColor: livenessPassed ? '#10b981' : timerColor }]} />
          </View>

          <View style={styles.challengeContent}>
            <Text style={styles.challengeEmoji}>{livenessPassed ? '✅' : CHALLENGE.emoji}</Text>
            <View style={styles.challengeText}>
              <Text style={styles.challengeTitle}>{CHALLENGE.text}</Text>
              <Text style={[styles.liveFeedbackText, livenessPassed && { color: '#10b981' }]}>
                {liveFeedback}
              </Text>
              {debugInfo ? <Text style={styles.debugInfoText}>{debugInfo}</Text> : null}
            </View>
            {/* Countdown circle */}
            <View style={[styles.challengeTimer, {
              borderColor : livenessPassed ? 'rgba(16,185,129,0.3)' : `${timerColor}44`,
              backgroundColor: livenessPassed ? 'rgba(16,185,129,0.15)' : `${timerColor}18`,
            }]}>
              <Text style={[styles.timerNum, { color: livenessPassed ? '#10b981' : timerColor }]}>
                {livenessPassed ? '✓' : timeLeft}
              </Text>
              {!livenessPassed && <Text style={[styles.timerSec, { color: timerColor }]}>s</Text>}
            </View>
          </View>

          <Text style={styles.livenessLabel}>🛡️ Anti-Spoofing Check — Automatic</Text>
        </View>
      </View>
    );
  }

  // ─── Scanning step ────────────────────────────────────────────────────────
  if (step === 'scanning') return (
    <View style={styles.cameraContainer}>
      <Camera ref={cameraRef} style={StyleSheet.absoluteFill}
        device={device} isActive={true} photo={true} />
      <View style={styles.dimOverlay} />
      <View style={styles.scanningOverlay}>
        <View style={[styles.faceOval, { borderColor: '#f59e0b', borderStyle: 'dashed' }]} />
        <View style={styles.scanLine} />
        <ActivityIndicator size="large" color="#f59e0b" style={{ marginTop: 24 }} />
        <View style={styles.scanStatusCard}>
          <Text style={styles.scanStatusText}>{statusMsg}</Text>
        </View>
      </View>
    </View>
  );

  // ─── Result step ──────────────────────────────────────────────────────────
  if (step === 'result' && result) {
    const resultConfig = {
      success      : { icon: '✅', color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)'  },
      no_face      : { icon: '🚫', color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)'   },
      no_match     : { icon: '❓', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)'  },
      error        : { icon: '⚠️', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
      liveness_fail: { icon: '🔒', color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)'   },
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
                  <View style={[styles.simFill, { width: `${Math.min((result.sim || 0) * 100, 100)}%` as any, backgroundColor: cfg.color }]} />
                </View>
                <Text style={[styles.simValue, { color: cfg.color }]}>{((result.sim || 0) * 100).toFixed(1)}%</Text>
              </View>
              <View style={styles.successMeta}>
                <Text style={styles.successMetaText}>✅ Attendance logged offline</Text>
                <Text style={styles.successMetaText}>📅 {new Date().toLocaleString('en-IN')}</Text>
              </View>
            </>
          )}

          {(result.type === 'no_face' || result.type === 'no_match' || result.type === 'liveness_fail') && (
            <View style={styles.errorDetail}>
              <Text style={styles.errorDetailText}>{result.detail}</Text>
              <View style={styles.tipsBox}>
                <Text style={styles.tipsTitle}>
                  {result.type === 'no_face'       ? 'Tips for better detection:' :
                   result.type === 'liveness_fail' ? 'Tips for liveness check:'   :
                                                     'Possible reasons:'}
                </Text>
                {result.type === 'no_face' ? (
                  <>
                    <Text style={styles.tipItem}>• Ensure face is well lit, no shadows</Text>
                    <Text style={styles.tipItem}>• Remove glasses or mask if wearing</Text>
                    <Text style={styles.tipItem}>• Hold phone at eye level</Text>
                  </>
                ) : result.type === 'liveness_fail' ? (
                  <>
                    <Text style={styles.tipItem}>• Make sure your face is well-lit</Text>
                    <Text style={styles.tipItem}>• Position your face fully in the oval</Text>
                    <Text style={styles.tipItem}>• Blink slowly — close eyes fully, then open</Text>
                    <Text style={styles.tipItem}>• Wait for "Face detected ✓" before blinking</Text>
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

        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.navigate('Attendance')} activeOpacity={0.8}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.navigate('Home')} activeOpacity={0.8}>
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  cameraContainer  : { flex: 1, backgroundColor: '#000' },
  dimOverlay       : { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },

  faceOvalContainer: { position: 'absolute', top: '8%', alignSelf: 'center', alignItems: 'center', gap: 12 },
  pulseRing        : { position: 'absolute', width: 220, height: 290, borderRadius: 110, borderWidth: 2, borderColor: '#3b82f6' },
  faceOval         : { width: 220, height: 290, borderRadius: 110, borderWidth: 2.5, borderStyle: 'dashed', borderColor: '#3b82f6' },
  passedBadge      : { position: 'absolute', width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(16,185,129,0.9)', alignItems: 'center', justifyContent: 'center' },
  passedBadgeText  : { fontSize: 36, color: '#fff' },
  faceStatusPill   : { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  faceStatusText   : { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

  challengeCard    : { position: 'absolute', bottom: 48, left: 16, right: 16, backgroundColor: 'rgba(2,8,23,0.92)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#1e293b', gap: 12 },
  timerRow         : { height: 3, backgroundColor: '#1e293b', borderRadius: 2, overflow: 'hidden' },
  timerBar         : { height: '100%', borderRadius: 2 },
  challengeContent : { flexDirection: 'row', alignItems: 'center', gap: 14 },
  challengeEmoji   : { fontSize: 36 },
  challengeText    : { flex: 1, gap: 4 },
  challengeTitle   : { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  liveFeedbackText : { fontSize: 12, color: '#94a3b8' },
  debugInfoText    : { fontSize: 10, color: '#475569' },
  challengeTimer   : { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  timerNum         : { fontSize: 17, fontWeight: '800', lineHeight: 20 },
  timerSec         : { fontSize: 9, fontWeight: '600', lineHeight: 10 },
  livenessLabel    : { fontSize: 11, color: '#334155', textAlign: 'center', letterSpacing: 1 },

  scanningOverlay  : { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanLine         : { position: 'absolute', width: 220, height: 2, backgroundColor: '#f59e0b', opacity: 0.8 },
  scanStatusCard   : { backgroundColor: 'rgba(2,8,23,0.9)', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 16, borderWidth: 1, borderColor: '#1e293b' },
  scanStatusText   : { color: '#f59e0b', fontSize: 14, fontWeight: '600' },

  center           : { flex: 1, backgroundColor: '#020817', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permIcon         : { fontSize: 56 },
  permTitle        : { fontSize: 20, fontWeight: '700', color: '#f1f5f9' },
  permSub          : { fontSize: 13, color: '#475569', textAlign: 'center' },
  permBtn          : { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  permBtnText      : { color: '#fff', fontWeight: '700', fontSize: 15 },

  resultContainer  : { flex: 1, backgroundColor: '#020817', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  orb1             : { position: 'absolute', top: -40, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: '#1e40af', opacity: 0.1 },
  orb2             : { position: 'absolute', bottom: -40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: '#6d28d9', opacity: 0.08 },
  resultCard       : { width: '100%', borderRadius: 24, padding: 24, borderWidth: 1, alignItems: 'center', gap: 12 },
  resultIcon       : { fontSize: 64, marginBottom: 4 },
  resultTitle      : { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  workerName       : { fontSize: 28, fontWeight: '900', color: '#f8fafc', textAlign: 'center' },
  simContainer     : { width: '100%', gap: 6 },
  simLabel         : { color: '#64748b', fontSize: 12, textAlign: 'center', letterSpacing: 0.5 },
  simBar           : { height: 8, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden' },
  simFill          : { height: '100%', borderRadius: 4 },
  simValue         : { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  successMeta      : { width: '100%', gap: 4, marginTop: 4 },
  successMetaText  : { color: '#475569', fontSize: 12, textAlign: 'center' },
  errorDetail      : { width: '100%', gap: 12 },
  errorDetailText  : { color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  tipsBox          : { backgroundColor: 'rgba(15,23,42,0.8)', borderRadius: 12, padding: 14, gap: 6, borderWidth: 1, borderColor: '#1e293b' },
  tipsTitle        : { color: '#64748b', fontSize: 12, fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 },
  tipItem          : { color: '#475569', fontSize: 12, lineHeight: 18 },
  retryBtn         : { width: '100%', backgroundColor: '#2563eb', borderRadius: 16, padding: 16, alignItems: 'center' },
  retryBtnText     : { color: '#fff', fontWeight: '700', fontSize: 16 },
  homeBtn          : { width: '100%', backgroundColor: '#0f172a', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b' },
  homeBtnText      : { color: '#94a3b8', fontWeight: '600', fontSize: 15 },
});
