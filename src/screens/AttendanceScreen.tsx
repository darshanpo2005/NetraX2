import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text,
  StyleSheet, ActivityIndicator, Animated, Image,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import FaceDetector from '@react-native-ml-kit/face-detection';
import * as Haptics from 'expo-haptics';
import { getAllWorkers, logAttendance } from '../services/DatabaseService';
import { findBestMatch, l2Normalize, COSINE_THRESHOLD } from '../services/FaceService';
import { extractFaceEmbedding } from '../services/FaceRecognitionService';
import { COLORS, FONT_SIZE, FONT_WEIGHT, TRACKING, RADIUS, SPACING } from '../theme';
import Button from '../components/Button';

const CHALLENGE     = { text: 'Blink your eyes', instruction: 'Blink slowly once' };
const LIVENESS_SECS = 12;

type ScanStep = 'liveness' | 'scanning' | 'result';
type ResultType = {
  type: 'success' | 'no_face' | 'no_match' | 'error' | 'liveness_fail';
  name?: string;
  sim?: number;
  message: string;
  detail?: string;
  photoUri?: string | null;
};

export default function AttendanceScreen({ navigation }: any) {
  const [step, setStep]                     = useState<ScanStep>('liveness');
  const [timeLeft, setTimeLeft]             = useState(LIVENESS_SECS);
  const [result, setResult]                 = useState<ResultType | null>(null);
  const [statusMsg, setStatusMsg]           = useState('');
  const [liveFeedback, setLiveFeedback]     = useState('Center your face in the oval');
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [faceDetected, setFaceDetected]     = useState(false);
  const [debugInfo, setDebugInfo]           = useState('');

  const cameraRef            = useRef<Camera>(null);
  const timerRef             = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const captureRef           = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const recognitionTimeoutRef= useRef<ReturnType<typeof setTimeout>  | undefined>(undefined);
  const eyesWereOpenRef      = useRef(false);
  const minEyeSeenRef        = useRef(1.0);
  const livenessPassedRef    = useRef(false);
  const captureInProgressRef = useRef(false);

  useEffect(() => {
    const parentTabs = navigation.getParent?.();
    parentTabs?.setOptions({ tabBarStyle: step === 'result' ? undefined : { display: 'none' } });
    return () => parentTabs?.setOptions({ tabBarStyle: undefined });
  }, [step, navigation]);

  // ─── RN Animated — result card ───────────────────────────────────────────
  const resultScaleAnim = useRef(new Animated.Value(0.8)).current;
  const resultFadeAnim  = useRef(new Animated.Value(0)).current;
  const resultShakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!result) {
      resultScaleAnim.setValue(0.8);
      resultFadeAnim.setValue(0);
      resultShakeAnim.setValue(0);
      return;
    }
    Animated.timing(resultFadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    if (result.type === 'success') {
      Animated.spring(resultScaleAnim, { toValue: 1, useNativeDriver: true }).start();
    } else {
      resultScaleAnim.setValue(1);
      const t = setTimeout(() => {
        Animated.sequence([
          Animated.timing(resultShakeAnim, { toValue: -12, duration: 55, useNativeDriver: true }),
          Animated.timing(resultShakeAnim, { toValue:  12, duration: 55, useNativeDriver: true }),
          Animated.timing(resultShakeAnim, { toValue:  -8, duration: 55, useNativeDriver: true }),
          Animated.timing(resultShakeAnim, { toValue:   8, duration: 55, useNativeDriver: true }),
          Animated.timing(resultShakeAnim, { toValue:   0, duration: 55, useNativeDriver: true }),
        ]).start();
      }, 370);
      return () => clearTimeout(t);
    }
  }, [result]);

  // ─── RN Animated — liveness camera UI ───────────────────────────────────
  const ovalColorAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim     = useRef(new Animated.Value(0)).current;
  const pulseLoopRef  = useRef<Animated.CompositeAnimation | null>(null);

  // Eye-blink hint animation — loops to show the user what "blink" looks like.
  const eyeBlinkAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(eyeBlinkAnim, { toValue: 0.1, duration: 90, useNativeDriver: false }),
        Animated.timing(eyeBlinkAnim, { toValue: 1,   duration: 140, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  useEffect(() => {
    Animated.timing(ovalColorAnim, {
      toValue       : faceDetected || livenessPassed ? 1 : 0,
      duration      : 300,
      useNativeDriver: false,
    }).start();
  }, [faceDetected, livenessPassed]);

  const ovalBorderColor = ovalColorAnim.interpolate({
    inputRange : [0, 1],
    outputRange: [COLORS.primary, COLORS.success],
  });
  const ringScale = pulseAnim.interpolate({
    inputRange : [0, 1],
    outputRange: [1.0, 1.35],
  });
  const ringOpacity = pulseAnim.interpolate({
    inputRange : [0, 0.5, 1],
    outputRange: [0.45, 0.15, 0],
  });

  // ─── Interval / timeout management ───────────────────────────────────────
  const stopAll = useCallback(() => {
    if (timerRef.current)             { clearInterval(timerRef.current);             timerRef.current              = undefined; }
    if (captureRef.current)           { clearInterval(captureRef.current);           captureRef.current            = undefined; }
    if (recognitionTimeoutRef.current){ clearTimeout(recognitionTimeoutRef.current); recognitionTimeoutRef.current = undefined; }
  }, []);

  const stopAllRef = useRef(stopAll);
  stopAllRef.current = stopAll;

  // ─── Recognition ─────────────────────────────────────────────────────────
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
        const now = Date.now();
        await logAttendance({
          id        : `att_${now}`,
          workerId  : match.workerId,
          workerName: match.workerName!,
          timestamp : now,
          similarity: match.similarity,
          synced    : 0,
          location  : 'Field Site',
        });
        const matchedWorker = workers.find(w => w.id === match.workerId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResult({
          type: 'success', name: match.workerName!, sim: match.similarity,
          message: 'Identity Verified', detail: 'Attendance logged successfully.',
          photoUri: matchedWorker?.photoUri ?? null,
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
  }, []);

  const handleRecognitionRef = useRef(handleRecognition);
  handleRecognitionRef.current = handleRecognition;

  // ─── Liveness frame check ─────────────────────────────────────────────────
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
      const face     = faces[0];
      const leftEye  = face.leftEyeOpenProbability  ?? 1;
      const rightEye = face.rightEyeOpenProbability ?? 1;

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
          stopAllRef.current();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          recognitionTimeoutRef.current = setTimeout(() => handleRecognitionRef.current(), 600);
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

  const checkLivenessFrameRef = useRef(checkLivenessFrame);
  checkLivenessFrameRef.current = checkLivenessFrame;

  // ─── Start liveness session ───────────────────────────────────────────────
  const startLiveness = useCallback(() => {
    eyesWereOpenRef.current      = false;
    minEyeSeenRef.current        = 1.0;
    livenessPassedRef.current    = false;
    captureInProgressRef.current = false;

    pulseLoopRef.current?.stop();
    pulseAnim.setValue(0);
    pulseLoopRef.current = Animated.loop(
      Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
    );
    pulseLoopRef.current.start();

    let t = LIVENESS_SECS;
    timerRef.current = setInterval(() => {
      t--;
      setTimeLeft(t);
      if (t <= 0) {
        stopAllRef.current();
        if (!livenessPassedRef.current) {
          setResult({ type: 'liveness_fail', message: 'Liveness Check Failed', detail: 'Please try again and complete the challenge within 12 seconds.' });
          setStep('result');
        }
      }
    }, 1000);

    captureRef.current = setInterval(() => checkLivenessFrameRef.current(), 80);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Try Again ────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    stopAllRef.current();

    setResult(null);
    setStep('liveness');
    setTimeLeft(LIVENESS_SECS);
    setLiveFeedback('Center your face in the oval');
    setLivenessPassed(false);
    setFaceDetected(false);
    setDebugInfo('');
    setStatusMsg('');

    ovalColorAnim.setValue(0);

    startLiveness();
  }, [startLiveness]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Mount / unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasPermission) requestPermission();
    startLiveness();
    return () => stopAllRef.current();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Permission guard ─────────────────────────────────────────────────────
  if (!hasPermission) return (
    <View style={styles.center}>
      <Text style={styles.permIcon}>📷</Text>
      <Text style={styles.permTitle}>Camera Access Required</Text>
      <Text style={styles.permSub}>Face recognition requires camera permission</Text>
      <Button label="Grant Permission" onPress={requestPermission} style={styles.permBtn} />
    </View>
  );

  if (!device) return (
    <View style={styles.center}>
      <Text style={styles.permTitle}>No front camera found</Text>
    </View>
  );

  // ─── Liveness step ────────────────────────────────────────────────────────
  if (step === 'liveness') {
    const timerPct   = `${(timeLeft / LIVENESS_SECS) * 100}%` as any;
    const timerColor = timeLeft <= 3 ? COLORS.error : timeLeft <= 6 ? COLORS.warning : COLORS.primary;

    return (
      <View style={styles.cameraContainer}>
        <Camera ref={cameraRef} style={StyleSheet.absoluteFill}
          device={device} isActive={true} photo={true}
          videoStabilizationMode="auto" />
        <View style={styles.dimOverlay} />

        {/* Face oval + pulse ring */}
        <View style={styles.faceOvalContainer}>
          <View style={styles.faceOvalCenter}>
            {!livenessPassed && (
              <Animated.View style={[
                styles.pulseRing,
                { transform: [{ scale: ringScale }], opacity: ringOpacity,
                  borderColor: faceDetected ? COLORS.success : COLORS.primary },
              ]} />
            )}
            <Animated.View style={[
              styles.faceOval,
              { borderColor: ovalBorderColor },
              livenessPassed && styles.faceOvalSolid,
            ]} />
            {livenessPassed && (
              <View style={styles.passedBadge}>
                <Text style={styles.passedBadgeText}>✓</Text>
              </View>
            )}
          </View>
          <View style={[
            styles.faceStatusPill,
            { backgroundColor: (livenessPassed || faceDetected) ? COLORS.successGlow : COLORS.errorGlow,
              borderColor: (livenessPassed || faceDetected) ? COLORS.successBorder : COLORS.errorBorder },
          ]}>
            <Text style={[styles.faceStatusText, { color: (livenessPassed || faceDetected) ? COLORS.success : COLORS.error }]}>
              {livenessPassed ? '✓ Liveness verified' : faceDetected ? 'Face detected ✓' : 'No face found'}
            </Text>
          </View>
        </View>

        {/* Bottom sheet — liveness instruction */}
        <View style={styles.bottomSheet}>
          <View style={styles.timerRow}>
            <View style={[styles.timerBar, { width: timerPct, backgroundColor: livenessPassed ? COLORS.success : timerColor }]} />
          </View>

          <View style={styles.challengeContent}>
            {/* Eye animation indicator */}
            <View style={styles.eyeIndicator}>
              <Animated.View style={[styles.eye, { transform: [{ scaleY: eyeBlinkAnim }] }]} />
              <Animated.View style={[styles.eye, { transform: [{ scaleY: eyeBlinkAnim }] }]} />
            </View>

            <View style={styles.challengeText}>
              <Text style={styles.challengeTitle}>{livenessPassed ? 'Verified' : CHALLENGE.text}</Text>
              <Text style={[styles.liveFeedbackText, livenessPassed && styles.liveFeedbackSuccess]}>
                {liveFeedback}
              </Text>
              {debugInfo ? <Text style={styles.debugInfoText}>{debugInfo}</Text> : null}
            </View>

            <View style={[
              styles.challengeTimer,
              { borderColor: livenessPassed ? COLORS.successBorder : `${timerColor}55`,
                backgroundColor: livenessPassed ? COLORS.successGlow : `${timerColor}18` },
            ]}>
              <Text style={[styles.timerNum, { color: livenessPassed ? COLORS.success : timerColor }]}>
                {livenessPassed ? '✓' : timeLeft}
              </Text>
              {!livenessPassed && <Text style={[styles.timerSec, { color: timerColor }]}>s</Text>}
            </View>
          </View>

          <Text style={styles.livenessLabel}>ANTI-SPOOFING CHECK · AUTOMATIC</Text>
        </View>
      </View>
    );
  }

  // ─── Scanning step ────────────────────────────────────────────────────────
  if (step === 'scanning') return (
    <View style={styles.cameraContainer}>
      <Camera ref={cameraRef} style={StyleSheet.absoluteFill}
        device={device} isActive={true} photo={true}
        videoStabilizationMode="auto" />
      <View style={styles.dimOverlay} />
      <View style={styles.scanningOverlay}>
        <View style={[styles.faceOval, styles.faceOvalScanning]} />
        <ActivityIndicator size="large" color={COLORS.warning} style={styles.scanSpinner} />
        <View style={styles.scanStatusCard}>
          <Text style={styles.scanStatusText}>{statusMsg}</Text>
        </View>
      </View>
    </View>
  );

  // ─── Result step ──────────────────────────────────────────────────────────
  if (step === 'result' && result) {
    const isSuccess = result.type === 'success';
    const isWarn    = result.type === 'no_match';
    const accentColor = isSuccess ? COLORS.success : isWarn ? COLORS.warning : COLORS.error;
    const cardGlow     = isSuccess ? COLORS.successGlow : isWarn ? COLORS.warningGlow : COLORS.errorGlow;
    const cardBorder   = isSuccess ? COLORS.successBorder : isWarn ? COLORS.warningBorder : COLORS.errorBorder;

    return (
      <View style={styles.resultContainer}>
        <Animated.View style={[styles.resultAnimWrap, {
          opacity: resultFadeAnim,
          transform: [{ scale: resultScaleAnim }, { translateX: resultShakeAnim }],
        }]}>
          <View style={[styles.resultCard, { backgroundColor: cardGlow, borderColor: cardBorder }]}>
            {isSuccess ? (
              <>
                {result.photoUri ? (
                  <Image source={{ uri: result.photoUri }} style={styles.successPhoto} />
                ) : (
                  <View style={styles.successAvatarPlaceholder}>
                    <Text style={styles.successAvatarText}>👤</Text>
                  </View>
                )}
                <Text style={styles.workerName}>{result.name}</Text>
                <Text style={[styles.resultTitle, { color: accentColor }]}>{result.message}</Text>
                <View style={styles.simContainer}>
                  <Text style={styles.simLabel}>MATCH CONFIDENCE</Text>
                  <View style={styles.simBar}>
                    <View style={[styles.simFill, { width: `${Math.min((result.sim || 0) * 100, 100)}%` as any }]} />
                  </View>
                  <Text style={[styles.simValue, { color: accentColor }]}>{((result.sim || 0) * 100).toFixed(1)}%</Text>
                </View>
                <View style={styles.successPill}>
                  <Text style={styles.successPillText}>✓ Attendance Recorded · {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.resultIcon}>
                  {result.type === 'no_face' ? '🚫' : result.type === 'no_match' ? '❓' : '🔒'}
                </Text>
                <Text style={[styles.resultTitle, { color: accentColor }]}>{result.message}</Text>
                {result.detail ? <Text style={styles.errorDetailText}>{result.detail}</Text> : null}
                <View style={styles.tipsBox}>
                  <Text style={styles.tipsTitle}>
                    {result.type === 'no_face' ? 'Tips for better detection:' :
                     result.type === 'liveness_fail' ? 'Tips for liveness check:' : 'Possible reasons:'}
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
                    </>
                  ) : (
                    <>
                      <Text style={styles.tipItem}>• Worker not yet registered</Text>
                      <Text style={styles.tipItem}>• Poor lighting conditions</Text>
                      <Text style={styles.tipItem}>• Face angle too extreme</Text>
                    </>
                  )}
                </View>
                <Button label="Try Again" onPress={handleRetry} style={styles.retryBtnInline} />
              </>
            )}
          </View>
        </Animated.View>

        {isSuccess && (
          <Button label="Scan Another" onPress={handleRetry} style={styles.actionSpacing} />
        )}
        <Button label="Back to Home" onPress={() => navigation.navigate('Home')} variant="secondary" style={styles.actionSpacing} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  cameraContainer  : { flex: 1, backgroundColor: '#000' },
  dimOverlay       : { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },

  faceOvalContainer: { position: 'absolute', top: '8%', alignSelf: 'center', alignItems: 'center', gap: 12 },
  faceOvalCenter   : { alignItems: 'center', justifyContent: 'center' },
  pulseRing        : { position: 'absolute', width: 220, height: 290, borderRadius: 110, borderWidth: 2 },
  faceOval         : { width: 220, height: 290, borderRadius: 110, borderWidth: 2.5, borderStyle: 'dashed', borderColor: COLORS.primary },
  faceOvalSolid    : { borderStyle: 'solid' },
  faceOvalScanning : { borderColor: COLORS.warning, borderStyle: 'dashed' },
  passedBadge      : { position: 'absolute', width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  passedBadgeText  : { fontSize: 36, color: COLORS.white },
  faceStatusPill   : { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1 },
  faceStatusText   : { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, letterSpacing: TRACKING.label },

  bottomSheet      : {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.overlay,
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.inner,
    paddingBottom: 40,
    gap: 14,
  },
  timerRow         : { height: 3, backgroundColor: COLORS.surfaceElevated, borderRadius: 2, overflow: 'hidden' },
  timerBar         : { height: '100%', borderRadius: 2 },
  challengeContent : { flexDirection: 'row', alignItems: 'center', gap: 14 },

  eyeIndicator     : { flexDirection: 'row', gap: 6, width: 36 },
  eye              : { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.primary },

  challengeText    : { flex: 1, gap: 4 },
  challengeTitle   : { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textPrimary },
  liveFeedbackText : { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  liveFeedbackSuccess: { color: COLORS.success },
  debugInfoText    : { fontSize: 10, color: COLORS.textTertiary },
  challengeTimer   : { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  timerNum         : { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, lineHeight: 20 },
  timerSec         : { fontSize: 9, fontWeight: FONT_WEIGHT.semibold, lineHeight: 10 },
  livenessLabel    : { fontSize: FONT_SIZE.xs - 1, color: COLORS.textTertiary, textAlign: 'center', letterSpacing: TRACKING.caps },

  scanningOverlay  : { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanSpinner      : { marginTop: 24 },
  scanStatusCard   : { backgroundColor: COLORS.overlay, borderRadius: RADIUS.buttonSm, paddingHorizontal: 20, paddingVertical: 10, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  scanStatusText   : { color: COLORS.warning, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semibold },

  center           : { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permIcon         : { fontSize: 52 },
  permTitle        : { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  permSub          : { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center' },
  permBtn          : { marginTop: 8 },

  resultContainer  : { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: SPACING.screen, gap: 12 },
  resultAnimWrap   : { width: '100%' },
  resultCard            : { width: '100%', borderRadius: RADIUS.card, padding: SPACING.section, borderWidth: 1, alignItems: 'center', gap: 12 },
  resultIcon            : { fontSize: 60, marginBottom: 4 },
  resultTitle           : { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  successPhoto          : { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: COLORS.success },
  successAvatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  successAvatarText     : { fontSize: 48 },
  workerName            : { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary, textAlign: 'center' },
  simContainer          : { width: '100%', gap: 6 },
  simLabel              : { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, textAlign: 'center', letterSpacing: TRACKING.label },
  simBar                : { height: 8, backgroundColor: COLORS.surfaceElevated, borderRadius: 4, overflow: 'hidden' },
  simFill               : { height: '100%', borderRadius: 4, backgroundColor: COLORS.success },
  simValue              : { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
  successPill           : { backgroundColor: COLORS.successGlow, borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.successBorder },
  successPillText       : { color: COLORS.success, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, letterSpacing: TRACKING.label },
  errorDetailText       : { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  tipsBox               : { width: '100%', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: RADIUS.buttonSm, padding: 14, gap: 6, borderWidth: 1, borderColor: COLORS.border },
  tipsTitle             : { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, marginBottom: 4, letterSpacing: TRACKING.label },
  tipItem               : { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, lineHeight: 18 },
  retryBtnInline        : { marginTop: 4 },
  actionSpacing         : {},
});
