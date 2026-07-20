import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, ActivityIndicator, Animated,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { addWorker, workerExists, getAllWorkerEmbeddings } from '../services/DatabaseService';
import { l2Normalize, cosineSimilarity } from '../services/FaceService';
import { extractFaceEmbedding } from '../services/FaceRecognitionService';
import { COLORS, FONT_SIZE, FONT_WEIGHT, TRACKING, RADIUS, SPACING } from '../theme';
import Button from '../components/Button';
import Card from '../components/Card';

const REQUIRED_CAPTURES = 5;

const CAPTURE_HINTS = [
  { label: 'Look straight',       detail: 'Face the camera directly' },
  { label: 'Turn slightly left',  detail: 'Rotate your head ~15° left' },
  { label: 'Turn slightly right', detail: 'Rotate your head ~15° right' },
  { label: 'Tilt up slightly',    detail: 'Look slightly upward' },
  { label: 'Look straight again', detail: 'Final capture — face forward' },
];

const removeOutlierAndAverage = (embeddings: number[][]): number[] => {
  if (embeddings.length <= 2) {
    const avg = embeddings[0].map((_, i) =>
      embeddings.reduce((sum, e) => sum + e[i], 0) / embeddings.length
    );
    return l2Normalize(avg);
  }

  const scores = embeddings.map((emb, i) => {
    const sims = embeddings
      .filter((_, j) => j !== i)
      .map(other => cosineSimilarity(emb, other));
    return sims.reduce((a, b) => a + b, 0) / sims.length;
  });

  const worstIdx = scores.indexOf(Math.min(...scores));
  const good = embeddings.filter((_, i) => i !== worstIdx);
  const avg  = good[0].map((_, i) =>
    good.reduce((sum, e) => sum + e[i], 0) / good.length
  );
  return l2Normalize(avg);
};

export default function EnrollScreen({ navigation }: any) {
  const [name, setName]             = useState('');
  const [empId, setEmpId]           = useState('');
  const [step, setStep]             = useState<'form' | 'camera' | 'processing' | 'done'>('form');
  const [captures, setCaptures]     = useState(0);
  const [status, setStatus]         = useState('');
  const cameraRef        = useRef<Camera>(null);
  const embeddingsRef    = useRef<number[][]>([]);
  const isCapturingRef   = useRef(false);
  const firstPhotoUriRef = useRef<string | null>(null);

  const dotAnims = useRef(
    Array.from({ length: REQUIRED_CAPTURES }, () => new Animated.Value(1))
  ).current;

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  const handleStartCapture = async () => {
    if (!name.trim())  { Alert.alert('Error', 'Enter worker name'); return; }
    if (!empId.trim()) { Alert.alert('Error', 'Enter employee ID'); return; }
    const exists = await workerExists(empId.trim());
    if (exists) { Alert.alert('Error', 'Employee ID already registered'); return; }
    if (!hasPermission) { await requestPermission(); }
    setStep('camera');
    setStatus('');
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    if (isCapturingRef.current) return;
    isCapturingRef.current = true;
    setStatus('Processing...');
    try {
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      const uri   = 'file://' + photo.path;

      setStatus('Detecting face...');
      const result = await extractFaceEmbedding(uri);

      if (!result.success || !result.embedding) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('No face detected', result.error || 'Ensure your face is clearly visible');
        setStatus('No face found. Try again.');
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      embeddingsRef.current = [...embeddingsRef.current, result.embedding];
      const newCount = embeddingsRef.current.length;

      if (newCount === 1) {
        try {
          const dest = `${FileSystem.documentDirectory}profile_${Date.now()}.jpg`;
          await FileSystem.copyAsync({ from: uri, to: dest });
          firstPhotoUriRef.current = dest;
        } catch {
          firstPhotoUriRef.current = null;
        }
      }
      setCaptures(newCount);

      const dotIdx = newCount - 1;
      Animated.sequence([
        Animated.timing(dotAnims[dotIdx], { toValue: 1.6, duration: 120, useNativeDriver: true }),
        Animated.spring(dotAnims[dotIdx], { toValue: 1.0, friction: 3, useNativeDriver: true }),
      ]).start();

      if (newCount >= REQUIRED_CAPTURES) {
        setStep('processing');
        setStatus('Saving...');

        const normalizedAvg = removeOutlierAndAverage(embeddingsRef.current);

        const DUPLICATE_THRESHOLD = 0.70;
        const allWorkers = await getAllWorkerEmbeddings();
        for (const worker of allWorkers) {
          const workerEmbedding: number[] = typeof worker.embedding === 'string'
            ? JSON.parse(worker.embedding)
            : worker.embedding;
          const sim = cosineSimilarity(normalizedAvg, workerEmbedding);
          if (sim > DUPLICATE_THRESHOLD) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            embeddingsRef.current = [];
            setCaptures(0);
            dotAnims.forEach(a => a.setValue(1));
            setStep('camera');
            setStatus('');
            Alert.alert(
              'Face Already Registered',
              `This face is already registered as "${worker.name}".\nEach person can only be registered once.`,
              [{ text: 'OK' }]
            );
            return;
          }
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await addWorker({
          id        : `EMP_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          name      : name.trim(),
          employeeId: empId.trim(),
          embedding : normalizedAvg,
          createdAt : Date.now(),
          photoUri  : firstPhotoUriRef.current,
        });
        embeddingsRef.current = [];
        firstPhotoUriRef.current = null;
        setStep('done');
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setStatus('');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setStatus('Error. Try again.');
    } finally {
      isCapturingRef.current = false;
    }
  };

  const resetForm = () => {
    setName(''); setEmpId(''); setStep('form');
    setCaptures(0); setStatus('');
    embeddingsRef.current = [];
    firstPhotoUriRef.current = null;
    dotAnims.forEach(a => a.setValue(1));
  };

  // ── Form ──────────────────────────────────────────────────────────────────
  if (step === 'form') return (
    <ScrollView style={styles.container} contentContainerStyle={styles.formContent}>
      <Text style={styles.formIcon}>👤</Text>
      <Text style={styles.formTitle}>Register New Worker</Text>
      <Text style={styles.formSubtitle}>Capture face from 5 angles for accurate recognition</Text>

      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Rahul Kumar"
        placeholderTextColor={COLORS.textSecondary}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Employee ID</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. EMP001"
        placeholderTextColor={COLORS.textSecondary}
        value={empId}
        onChangeText={setEmpId}
        autoCapitalize="characters"
      />

      <Card style={styles.infoBox}>
        <Text style={styles.infoText}>📸  5 face captures from different angles</Text>
        <Text style={styles.infoText}>🧠  Real TFLite embeddings — MobileFaceNet INT8</Text>
        <Text style={styles.infoText}>🔒  All data stored encrypted on-device</Text>
        <Text style={styles.infoText}>📡  ML Kit face detection — server-free</Text>
      </Card>

      <Button label="Start Face Capture" onPress={handleStartCapture} style={styles.startBtn} />
    </ScrollView>
  );

  // ── Camera ────────────────────────────────────────────────────────────────
  if (step === 'camera') {
    if (!device) return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>No front camera found</Text>
      </View>
    );

    const hint = CAPTURE_HINTS[captures] ?? CAPTURE_HINTS[REQUIRED_CAPTURES - 1];
    const isProcessing = status === 'Processing...' || status === 'Detecting face...';
    const isRetry = status === 'No face found. Try again.' || status === 'Error. Try again.';

    return (
      <View style={styles.cameraRoot}>
        <Camera ref={cameraRef} style={StyleSheet.absoluteFill}
          device={device} isActive={true} photo={true}
          videoStabilizationMode="auto" />

        {/* Top step indicator bar */}
        <View style={styles.topBar}>
          <View style={styles.stepPill}>
            <Text style={styles.stepPillText}>Capture {Math.min(captures + 1, REQUIRED_CAPTURES)} of {REQUIRED_CAPTURES}</Text>
          </View>
        </View>

        {/* Dashed oval face guide */}
        <View style={styles.faceGuideWrap}>
          <View style={styles.faceGuide} />
        </View>

        {/* Progress dots */}
        <View style={styles.progressRow}>
          {Array.from({ length: REQUIRED_CAPTURES }).map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.progressDot,
                { backgroundColor: i < captures ? COLORS.success : i === captures ? COLORS.primary : COLORS.surfaceElevated },
                { transform: [{ scale: dotAnims[i] }] },
              ]}
            />
          ))}
        </View>

        {/* Bottom sheet */}
        <View style={styles.bottomSheet}>
          <Text style={styles.hintLabel}>{hint.label}</Text>
          <Text style={styles.hintDetail}>{hint.detail}</Text>

          {(isProcessing || isRetry) ? (
            <Text style={[styles.statusText, isRetry && styles.statusTextError]}>{status}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.captureBtn, isProcessing && styles.captureBtnDisabled]}
            onPress={handleCapture}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing
              ? <ActivityIndicator size="large" color={COLORS.white} />
              : <View style={styles.captureBtnInner} />
            }
          </TouchableOpacity>

          <Text style={styles.workerLabel}>{name} · {empId}</Text>
        </View>
      </View>
    );
  }

  // ── Processing ────────────────────────────────────────────────────────────
  if (step === 'processing') return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.processingText}>Processing face data...</Text>
      <Text style={styles.processingSubtext}>Averaging {REQUIRED_CAPTURES} TFLite embeddings</Text>
    </View>
  );

  // ── Done ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.center}>
      <Text style={styles.doneIcon}>✅</Text>
      <Text style={styles.successText}>Worker Registered!</Text>
      <Text style={styles.doneName}>{name}</Text>
      <Text style={styles.doneId}>ID: {empId}</Text>
      <Text style={styles.doneNote}>Real MobileFaceNet embeddings stored</Text>

      <Button label="Back to Home" onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })} style={styles.doneBtn} />
      <Button label="Register Another" onPress={resetForm} variant="secondary" style={styles.doneBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: COLORS.background },
  formContent : { padding: SPACING.screen, alignItems: 'center' },
  center      : { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: SPACING.screen },

  formIcon     : { fontSize: 52, marginBottom: 12 },
  formTitle    : { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary, marginBottom: 8 },
  formSubtitle : { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.section, textAlign: 'center' },

  label : { alignSelf: 'flex-start', color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, marginBottom: 6, marginTop: 8 },
  input : {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.buttonSm,
    padding: 14,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.base,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },

  infoBox  : { width: '100%', marginVertical: SPACING.section, gap: 10 },
  infoText : { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },

  startBtn : { marginTop: 8 },

  // Camera
  cameraRoot   : { flex: 1, backgroundColor: '#000' },
  topBar       : { position: 'absolute', top: 56, alignSelf: 'center' },
  stepPill     : { backgroundColor: COLORS.overlay, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 8 },
  stepPillText : { color: COLORS.textPrimary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, letterSpacing: TRACKING.label },

  faceGuideWrap : { position: 'absolute', top: '14%', alignSelf: 'center' },
  faceGuide     : { width: 220, height: 290, borderRadius: 110, borderWidth: 2.5, borderColor: COLORS.primary, borderStyle: 'dashed' },

  progressRow : { position: 'absolute', bottom: 240, alignSelf: 'center', flexDirection: 'row', gap: 10 },
  progressDot : { width: 8, height: 8, borderRadius: 4 },

  bottomSheet : {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.overlay,
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    paddingTop: SPACING.inner,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 6,
  },
  hintLabel  : { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold },
  hintDetail : { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  statusText      : { color: COLORS.primary, fontSize: FONT_SIZE.sm, marginTop: 4 },
  statusTextError : { color: COLORS.error },

  captureBtn      : { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 10 },
  captureBtnDisabled : { opacity: 0.5 },
  captureBtnInner : { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.white },
  workerLabel     : { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs },

  permTitle : { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },

  processingText    : { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.section },
  processingSubtext : { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginTop: 8 },

  doneIcon    : { fontSize: 64, marginBottom: 16 },
  successText : { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.success, marginBottom: 8 },
  doneName    : { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  doneId      : { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginTop: 4 },
  doneNote    : { color: COLORS.success, fontSize: FONT_SIZE.sm, marginTop: 12, marginBottom: 20 },
  doneBtn     : { width: '80%', marginTop: 12 },
});
