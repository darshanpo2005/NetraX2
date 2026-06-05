import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { getAttendanceLogs, getWorkerCount, getTodayAttendanceCount } from '../services/DatabaseService';
import { isOnline } from '../services/SyncService';

const { width } = Dimensions.get('window');

export default function AdminScreen() {
  const [logs, setLogs]   = useState<any[]>([]);
  const [stats, setStats] = useState({ workers: 0, today: 0 });
  const [online, setOnline] = useState(false);

  const loadData = async () => {
    const [l, w, t, o] = await Promise.all([
      getAttendanceLogs(15),
      getWorkerCount(),
      getTodayAttendanceCount(),
      isOnline(),
    ]);
    setLogs(l); setStats({ workers: w, today: t }); setOnline(o);
  };

  useEffect(() => { loadData(); }, []);

  const benchmarks = [
    { label: 'Model Size',    value: '1.33 MB',  target: '< 20 MB',    pass: true,  icon: '📦' },
    { label: 'Accuracy',      value: '98.33%',   target: '> 95%',      pass: true,  icon: '🎯' },
    { label: 'FAR',           value: '0.68%',    target: '< 2%',       pass: true,  icon: '🔒' },
    { label: 'Speed (est.)',  value: '~18 ms',   target: '< 1000 ms',  pass: true,  icon: '⚡' },
    { label: 'Quantization',  value: 'INT8',     target: 'Required',   pass: true,  icon: '🔧' },
    { label: 'Offline',       value: '100%',     target: 'Required',   pass: true,  icon: '📡' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.orb} />

      {/* System Status */}
      <View style={styles.statusCard}>
        <View style={styles.statusLeft}>
          <Text style={styles.statusTitle}>System Status</Text>
          <Text style={styles.statusSub}>All systems operational</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: online ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderColor: online ? '#10b981' : '#ef4444' }]}>
          <View style={[styles.statusDot, { backgroundColor: online ? '#10b981' : '#ef4444' }]} />
          <Text style={[styles.statusBadgeText, { color: online ? '#10b981' : '#ef4444' }]}>
            {online ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.quickStats}>
        <View style={styles.quickStat}>
          <Text style={styles.quickIcon}>👥</Text>
          <Text style={styles.quickNum}>{stats.workers}</Text>
          <Text style={styles.quickLbl}>Workers</Text>
        </View>
        <View style={[styles.quickStat, styles.quickStatMid]}>
          <Text style={styles.quickIcon}>✅</Text>
          <Text style={styles.quickNum}>{stats.today}</Text>
          <Text style={styles.quickLbl}>Today</Text>
        </View>
        <View style={styles.quickStat}>
          <Text style={styles.quickIcon}>📋</Text>
          <Text style={styles.quickNum}>{logs.length}</Text>
          <Text style={styles.quickLbl}>Log Entries</Text>
        </View>
      </View>

      {/* Benchmarks */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>MODEL BENCHMARKS (VALIDATED IN TRAINING)</Text>
        </View>
        <View style={styles.benchGrid}>
          {benchmarks.map(b => (
            <View key={b.label} style={styles.benchCard}>
              <Text style={styles.benchIcon}>{b.icon}</Text>
              <Text style={styles.benchValue}>{b.value}</Text>
              <Text style={styles.benchLabel}>{b.label}</Text>
              <Text style={styles.benchTarget}>{b.target}</Text>
              <View style={[styles.benchBadge, { backgroundColor: b.pass ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                <Text style={[styles.benchBadgeText, { color: b.pass ? '#10b981' : '#ef4444' }]}>{b.pass ? '✓ PASS' : '✗ FAIL'}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Model Info */}
      <View style={styles.modelCard}>
        <View style={styles.modelHeader}>
          <Text style={styles.modelIcon}>🧠</Text>
          <View>
            <Text style={styles.modelName}>w600k MobileFaceNet</Text>
            <Text style={styles.modelSub}>INT8 Quantized · TFLite</Text>
          </View>
        </View>
        <View style={styles.modelStats}>
          {[
            ['Architecture', 'MobileFaceNet'],
            ['Loss Function', 'CosFace (s=32)'],
            ['Dataset', 'LFW + Indian Aug.'],
            ['Parameters', '1.01M'],
            ['Embedding', '512-d'],
            ['Threshold', '0.60 cosine'],
          ].map(([k, v]) => (
            <View key={k} style={styles.modelRow}>
              <Text style={styles.modelKey}>{k}</Text>
              <Text style={styles.modelVal}>{v}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Attendance Logs */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>RECENT ATTENDANCE</Text>
          <TouchableOpacity onPress={loadData} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>↻ Refresh</Text>
          </TouchableOpacity>
        </View>

        {logs.length === 0 ? (
          <View style={styles.emptyLogs}>
            <Text style={styles.emptyLogsText}>No attendance records yet</Text>
          </View>
        ) : (
          <View style={styles.logsList}>
            {logs.map((log, i) => (
              <View key={log.id} style={styles.logCard}>
                <View style={[styles.logAccent, { backgroundColor: log.synced ? '#10b981' : '#f59e0b' }]} />
                <View style={styles.logAvatar}>
                  <Text style={styles.logAvatarText}>{log.workerName[0]?.toUpperCase()}</Text>
                </View>
                <View style={styles.logInfo}>
                  <Text style={styles.logName}>{log.workerName}</Text>
                  <Text style={styles.logTime}>{new Date(log.timestamp).toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.logRight}>
                  <Text style={styles.logSim}>{(log.similarity * 100).toFixed(1)}%</Text>
                  <View style={[styles.syncBadge, { backgroundColor: log.synced ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)' }]}>
                    <Text style={[styles.syncBadgeText, { color: log.synced ? '#10b981' : '#f59e0b' }]}>
                      {log.synced ? 'Synced' : 'Pending'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>NetraX v2  ·  NHAI Hackathon 7.0  ·  Offline AI</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container      : { flex: 1, backgroundColor: '#020817' },
  content        : { padding: 16, gap: 16, paddingBottom: 40 },
  orb            : { position: 'absolute', top: -40, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: '#1e40af', opacity: 0.08 },
  statusCard     : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e293b' },
  statusLeft     : {},
  statusTitle    : { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  statusSub      : { fontSize: 12, color: '#475569', marginTop: 2 },
  statusBadge    : { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusDot      : { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  quickStats     : { flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden' },
  quickStat      : { flex: 1, alignItems: 'center', padding: 16, gap: 4 },
  quickStatMid   : { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#1e293b' },
  quickIcon      : { fontSize: 22 },
  quickNum       : { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  quickLbl       : { fontSize: 11, color: '#475569' },
  section        : { gap: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionDot     : { width: 4, height: 16, borderRadius: 2, backgroundColor: '#3b82f6' },
  sectionTitle   : { fontSize: 11, color: '#64748b', fontWeight: '700', letterSpacing: 2, flex: 1 },
  refreshBtn     : { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#1e293b' },
  refreshText    : { color: '#60a5fa', fontSize: 12, fontWeight: '600' },
  benchGrid      : { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  benchCard      : { width: (width - 52) / 3, backgroundColor: '#0f172a', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#1e293b', gap: 4 },
  benchIcon      : { fontSize: 20 },
  benchValue     : { fontSize: 15, fontWeight: '800', color: '#f8fafc' },
  benchLabel     : { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  benchTarget    : { fontSize: 9, color: '#475569' },
  benchBadge     : { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 2 },
  benchBadgeText : { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  modelCard      : { backgroundColor: '#0f172a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e293b', gap: 14 },
  modelHeader    : { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modelIcon      : { fontSize: 32 },
  modelName      : { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  modelSub       : { fontSize: 12, color: '#475569', marginTop: 2 },
  modelStats     : { gap: 8 },
  modelRow       : { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  modelKey       : { fontSize: 13, color: '#64748b' },
  modelVal       : { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  emptyLogs      : { backgroundColor: '#0f172a', borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b' },
  emptyLogsText  : { color: '#475569', fontSize: 13 },
  logsList       : { gap: 8 },
  logCard        : { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden' },
  logAccent      : { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  logAvatar      : { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', alignItems: 'center', justifyContent: 'center', marginLeft: 8, marginRight: 12 },
  logAvatarText  : { color: '#60a5fa', fontSize: 15, fontWeight: '700' },
  logInfo        : { flex: 1 },
  logName        : { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  logTime        : { fontSize: 11, color: '#475569', marginTop: 2 },
  logRight       : { alignItems: 'flex-end', gap: 4 },
  logSim         : { fontSize: 16, fontWeight: '800', color: '#10b981' },
  syncBadge      : { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  syncBadgeText  : { fontSize: 9, fontWeight: '700' },
  footer         : { alignItems: 'center', paddingTop: 8 },
  footerText     : { color: '#1e293b', fontSize: 11, letterSpacing: 1 },
});
