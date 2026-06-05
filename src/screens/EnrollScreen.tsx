import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { addWorker, workerExists } from '../services/DatabaseService';
import { l2Normalize } from '../services/FaceService';
import { extractFaceEmbedding } from '../services/FaceRecognitionService';

const REQUIRED_CAPTURES = 5;

export default function EnrollScreen({ navigation }: any) {
  const [name, setName]             = useState('');
  const [empId, setEmpId]           = useState('');
  const [step, setStep]             = useState<'form' | 'camera' | 'processing' | 'done'>('form');
  const [captures, setCaptures]     = useState(0);
  const [embeddings, setEmbeddings] = useState<number[][]>([]);
  const [status, setStatus]         = useState('');
  const cameraRef = useRef<Camera>(null);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  const handleStartCapture = async () => {
    if (!name.trim())  { Alert.alert('Error', 'Enter worker name'); return; }
    if (!empId.trim()) { Alert.alert('Error', 'Enter employee ID'); return; }
    const exists = await workerExists(empId.trim());
    if (exists) { Alert.alert('Error', 'Employee ID already registered'); return; }
    if (!hasPermission) { await requestPermission(); }
    setStep('camera');
    setStatus('Look straight at camera');
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    setStatus('Processing...');
    try {
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      const uri   = 'file://' + photo.path;

      setStatus('Detecting face...');
      const result = await extractFaceEmbedding(uri);

      if (!result.success || !result.embedding) {
        Alert.alert('No face detected', result.error || 'Ensure your face is clearly visible');
        setStatus('No face found. Try again.');
        return;
      }

      const newEmbeddings = [...embeddings, result.embedding];
      setEmbeddings(newEmbeddings);
      setCaptures(newEmbeddings.length);

      if (newEmbeddings.length >= REQUIRED_CAPTURES) {
        setStep('processing');
        setStatus('Saving...');

        // Average embeddings from all angles for robustness
        const avgEmbedding = newEmbeddings[0].map((_, i) =>
          newEmbeddings.reduce((sum, emb) => sum + emb[i], 0) / newEmbeddings.length
        );

        await addWorker({
          id        : `worker_${Date.now()}`,
          name      : name.trim(),
          employeeId: empId.trim(),
          embedding : l2Normalize(avgEmbedding),
          createdAt : Date.now(),
        });
        setStep('done');
      } else {
        const hints = ['Look straight', 'Turn head left', 'Turn head right', 'Tilt up', 'Tilt down'];
        setStatus(`✅ ${newEmbeddings.length}/${REQUIRED_CAPTURES} — ${hints[newEmbeddings.length] || 'Good!'}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setStatus('Error. Try again.');
    }
  };

  // ── Form ─────────────────────────────────────────────────────────────────
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

  // ── Camera ───────────────────────────────────────────────────────────────
  if (step === 'camera') {
    if (!device) return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>No front camera found</Text>
      </View>
    );
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          photo={true}
        />
        <View style={styles.overlay}>
          <View style={styles.faceGuide} />

          <View style={styles.progressRow}>
            {Array.from({ length: REQUIRED_CAPTURES }).map((_, i) => (
              <View key={i} style={[styles.progressDot,
                { backgroundColor: i < captures ? '#10b981' : '#334155' }]} />
            ))}
          </View>

          <Text style={styles.captureCount}>{captures}/{REQUIRED_CAPTURES}</Text>
          <Text style={styles.captureHint}>{status}</Text>

          <TouchableOpacity style={styles.captureBtn} onPress={handleCapture}>
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>

          <Text style={styles.workerLabel}>{name} — {empId}</Text>
        </View>
      </View>
    );
  }

  // ── Processing ───────────────────────────────────────────────────────────
  if (step === 'processing') return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#7dd3fc" />
      <Text style={styles.processingText}>Processing face data...</Text>
      <Text style={styles.processingSubtext}>Averaging {REQUIRED_CAPTURES} TFLite embeddings</Text>
    </View>
  );

  // ── Done ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 72, marginBottom: 16 }}>✅</Text>
      <Text style={styles.successText}>Worker Registered!</Text>
      <Text style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 'bold' }}>{name}</Text>
      <Text style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>ID: {empId}</Text>
      <Text style={{ color: '#10b981', fontSize: 13, marginTop: 12 }}>
        ✅ Real MobileFaceNet embeddings stored
      </Text>
      <TouchableOpacity
        style={[styles.btn, { marginTop: 32, width: '80%' }]}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.btnText}>Back to Home</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, { marginTop: 12, width: '80%', backgroundColor: '#1e293b' }]}
        onPress={() => {
          setName(''); setEmpId(''); setStep('form');
          setCaptures(0); setEmbeddings([]); setStatus('');
        }}
      >
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
  overlay          : { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 48 },
  faceGuide        : { position: 'absolute', top: '10%', width: 240, height: 300, borderRadius: 120, borderWidth: 2, borderColor: '#7dd3fc', borderStyle: 'dashed' },
  progressRow      : { flexDirection: 'row', gap: 8, marginBottom: 12 },
  progressDot      : { width: 16, height: 16, borderRadius: 8 },
  captureCount     : { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 4, borderRadius: 20 },
  captureHint      : { color: '#7dd3fc', fontSize: 14, marginBottom: 24, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12, textAlign: 'center' },
  captureBtn       : { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  captureBtnInner  : { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  workerLabel      : { color: '#64748b', fontSize: 12 },
  permTitle        : { fontSize: 20, fontWeight: '700', color: '#f1f5f9' },
  processingText   : { color: '#f1f5f9', fontSize: 20, fontWeight: 'bold', marginTop: 24 },
  processingSubtext: { color: '#64748b', fontSize: 14, marginTop: 8 },
  successText      : { fontSize: 28, fontWeight: 'bold', color: '#10b981', marginBottom: 8 },
});
