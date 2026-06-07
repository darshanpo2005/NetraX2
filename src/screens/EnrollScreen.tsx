import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, ActivityIndicator, Animated,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import * as Haptics from 'expo-haptics';
import { addWorker, workerExists, getAllWorkerEmbeddings } from '../services/DatabaseService';
import { l2Normalize, cosineSimilarity } from '../services/FaceService';
import { extractFaceEmbedding } from '../services/FaceRecognitionService';

const REQUIRED_CAPTURES = 5;

const CAPTURE_HINTS = [
  { label: 'Look straight',       detail: 'Face the camera directly',   icon: '🔵' },
  { label: 'Turn slightly left',  detail: 'Rotate your head ~15° left', icon: '↙️' },
  { label: 'Turn slightly right', detail: 'Rotate your head ~15° right',icon: '↘️' },
  { label: 'Tilt up slightly',    detail: 'Look slightly upward',        icon: '⬆️' },
  { label: 'Look straight again', detail: 'Final capture — face forward',icon: '✅' },
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
  const [embeddings, setEmbeddings] = useState<number[][]>([]);
  const [status, setStatus]         = useState('');
  const cameraRef        = useRef<Camera>(null);
  const embeddingsRef    = useRef<number[][]>([]);
  const isCapturingRef   = useRef(false);

  // One Animated.Value per dot — bounce on capture
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
      const newEmbeddings = embeddingsRef.current;
      setEmbeddings(newEmbeddings);
      const newCount = newEmbeddings.length;
      setCaptures(newCount);

      // Bounce animation on the dot just filled
      const dotIdx = newCount - 1;
      Animated.sequence([
        Animated.timing(dotAnims[dotIdx], { toValue: 1.6, duration: 120, useNativeDriver: true }),
        Animated.spring(dotAnims[dotIdx], { toValue: 1.0, friction: 3, useNativeDriver: true }),
      ]).start();

      if (newCount >= REQUIRED_CAPTURES) {
        setStep('processing');
        setStatus('Saving...');

        const normalizedAvg = removeOutlierAndAverage(newEmbeddings);

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
            setEmbeddings([]);
            setCaptures(0);
            // Reset dot anims
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
        });
        embeddingsRef.current = [];
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

  // ── Form ──────────────────────────────────────────────────────────────────
  if (step === 'form') return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.icon}>👤</Text>
      <Text style={styles.title}>Register New Worker</Text>
      <Text style={styles.subtitle}>Capture face from 5 angles for accurate recognition</Text>

      <Text style={styles.label}>Full Name</Text>
      <TextInput style={styles.input} placeholder="e.g. Rahul Kumar"
        placeholderTextColor="#475569" value={name} onChangeText={setName} />

      <Text style={styles.label}>Employee ID</Text>
      <TextInput style={styles.input} placeholder="e.g. EMP001"
        placeholderTextColor="#475569" value={empId} onChangeText={setEmpId}
        autoCapitalize="characters" />

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>📸 5 face captures from different angles</Text>
        <Text style={styles.infoText}>🧠 Real TFLite embeddings — MobileFaceNet INT8</Text>
        <Text style={styles.infoText}>🔒 All data stored encrypted on-device</Text>
        <Text style={styles.infoText}>📡 ML Kit face detection — server-free</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleStartCapture}>
        <Text style={styles.btnText}>Start Face Capture →</Text>
      </TouchableOpacity>
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

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Camera ref={cameraRef} style={StyleSheet.absoluteFill}
          device={device} isActive={true} photo={true} />
        <View style={styles.overlay}>
          {/* Face guide oval */}
          <View style={styles.faceGuide} />

          {/* Angle instruction card */}
          <View style={styles.hintCard}>
            <Text style={styles.hintIcon}>{hint.icon}</Text>
            <View style={styles.hintTextBlock}>
              <Text style={styles.hintLabel}>{hint.label}</Text>
              <Text style={styles.hintDetail}>{hint.detail}</Text>
            </View>
            <View style={styles.hintCounter}>
              <Text style={styles.hintCounterNum}>{captures}</Text>
              <Text style={styles.hintCounterOf}>/{REQUIRED_CAPTURES}</Text>
            </View>
          </View>

          {/* Animated progress dots */}
          <View style={styles.progressRow}>
            {Array.from({ length: REQUIRED_CAPTURES }).map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.progressDot,
                  { backgroundColor: i < captures ? '#10b981' : i === captures ? '#3b82f6' : '#334155' },
                  { transform: [{ scale: dotAnims[i] }] },
                ]}
              />
            ))}
          </View>

          {/* Status text (only shown during processing) */}
          {(isProcessing || status === 'No face found. Try again.' || status === 'Error. Try again.') ? (
            <Text style={[
              styles.captureHint,
              { color: status.includes('No face') || status.includes('Error') ? '#ef4444' : '#7dd3fc' },
            ]}>
              {status}
            </Text>
          ) : null}

          {/* Capture button */}
          <TouchableOpacity
            style={[styles.captureBtn, isProcessing && { opacity: 0.5 }]}
            onPress={handleCapture}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing
              ? <ActivityIndicator size="large" color="#fff" />
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
      <ActivityIndicator size="large" color="#7dd3fc" />
      <Text style={styles.processingText}>Processing face data...</Text>
      <Text style={styles.processingSubtext}>Averaging {REQUIRED_CAPTURES} TFLite embeddings</Text>
    </View>
  );

  // ── Done ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 72, marginBottom: 16 }}>✅</Text>
      <Text style={styles.successText}>Worker Registered!</Text>
      <Text style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 'bold' }}>{name}</Text>
      <Text style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>ID: {empId}</Text>
      <Text style={{ color: '#10b981', fontSize: 13, marginTop: 12 }}>
        ✅ Real MobileFaceNet embeddings stored
      </Text>
      <TouchableOpacity style={[styles.btn, { marginTop: 32, width: '80%' }]}
        onPress={() => navigation.navigate('Home')}>
        <Text style={styles.btnText}>Back to Home</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, { marginTop: 12, width: '80%', backgroundColor: '#1e293b' }]}
        onPress={() => {
          setName(''); setEmpId(''); setStep('form');
          setCaptures(0); setEmbeddings([]); setStatus('');
          embeddingsRef.current = [];
          dotAnims.forEach(a => a.setValue(1));
        }}>
        <Text style={styles.btnText}>Register Another</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container        : { flex: 1, backgroundColor: '#0f1117' },
  content          : { padding: 24, alignItems: 'center' },
  center           : { flex: 1, backgroundColor: '#0f1117', alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon             : { fontSize: 56, marginBottom: 12 },
  title            : { fontSize: 24, fontWeight: 'bold', color: '#f1f5f9', marginBottom: 8 },
  subtitle         : { fontSize: 13, color: '#64748b', marginBottom: 32, textAlign: 'center' },
  label            : { alignSelf: 'flex-start', color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input            : { width: '100%', backgroundColor: '#1e293b', borderRadius: 10, padding: 14, color: '#f1f5f9', fontSize: 15, borderWidth: 1, borderColor: '#334155', marginBottom: 8 },
  infoBox          : { width: '100%', backgroundColor: '#1e293b', borderRadius: 10, padding: 16, marginVertical: 16, gap: 8 },
  infoText         : { color: '#94a3b8', fontSize: 13 },
  btn              : { width: '100%', backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText          : { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  overlay          : { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 40 },
  faceGuide        : { position: 'absolute', top: '8%', width: 220, height: 290, borderRadius: 110, borderWidth: 2.5, borderColor: '#7dd3fc', borderStyle: 'dashed' },

  hintCard         : { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(2,8,23,0.88)', borderRadius: 18, padding: 14, marginBottom: 18, marginHorizontal: 16, borderWidth: 1, borderColor: '#1e293b', gap: 12, width: '90%' },
  hintIcon         : { fontSize: 28 },
  hintTextBlock    : { flex: 1 },
  hintLabel        : { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  hintDetail       : { color: '#64748b', fontSize: 12, marginTop: 2 },
  hintCounter      : { flexDirection: 'row', alignItems: 'baseline' },
  hintCounterNum   : { color: '#3b82f6', fontSize: 22, fontWeight: '800' },
  hintCounterOf    : { color: '#475569', fontSize: 14, fontWeight: '600' },

  progressRow      : { flexDirection: 'row', gap: 10, marginBottom: 16 },
  progressDot      : { width: 18, height: 18, borderRadius: 9 },

  captureHint      : { fontSize: 13, marginBottom: 16, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12, textAlign: 'center' },
  captureBtn       : { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  captureBtnInner  : { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  workerLabel      : { color: '#475569', fontSize: 12 },

  permTitle        : { fontSize: 20, fontWeight: '700', color: '#f1f5f9' },
  processingText   : { color: '#f1f5f9', fontSize: 20, fontWeight: 'bold', marginTop: 24 },
  processingSubtext: { color: '#64748b', fontSize: 14, marginTop: 8 },
  successText      : { fontSize: 28, fontWeight: 'bold', color: '#10b981', marginBottom: 8 },
});
