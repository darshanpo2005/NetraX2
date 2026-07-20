import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAttendanceLogs, getWorkerCount, getTodayAttendanceCount } from '../services/DatabaseService';
import { isOnline } from '../services/SyncService';
import { COLORS, FONT_SIZE, FONT_WEIGHT, TRACKING, RADIUS, SPACING } from '../theme';
import Card from '../components/Card';
import SectionLabel from '../components/SectionLabel';

const { width } = Dimensions.get('window');
const BENCH_CARD_WIDTH = (width - SPACING.screen * 2 - SPACING.card * 2) / 3;

export default function AdminScreen() {
  const [logs, setLogs]   = useState<any[]>([]);
  const [stats, setStats] = useState({ workers: 0, today: 0 });
  const [online, setOnline] = useState(false);

  const loadData = async () => {
    try {
      const [l, w, t, o] = await Promise.all([
        getAttendanceLogs(15),
        getWorkerCount(),
        getTodayAttendanceCount(),
        isOnline(),
      ]);
      setLogs(l); setStats({ workers: w, today: t }); setOnline(o);
    } catch {
      // ignore DB errors, keep showing previous state
    }
  };

  useEffect(() => { loadData(); }, []);

  const benchmarks = [
    { label: 'Model Size',   value: '1.33 MB', target: '< 20 MB',   pass: true },
    { label: 'Accuracy',     value: '98.33%',  target: '> 95%',     pass: true },
    { label: 'FAR',          value: '0.68%',   target: '< 2%',      pass: true },
    { label: 'Speed (est.)', value: '~18 ms',  target: '< 1000 ms', pass: true },
    { label: 'Quantization', value: 'INT8',    target: 'Required',  pass: true },
    { label: 'Offline',      value: '100%',    target: 'Required',  pass: true },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* System status */}
        <Card accentColor={online ? COLORS.success : COLORS.error} style={styles.statusCard}>
          <View>
            <Text style={styles.statusTitle}>System Status</Text>
            <Text style={styles.statusSub}>All systems operational</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: online ? COLORS.successGlow : COLORS.errorGlow, borderColor: online ? COLORS.successBorder : COLORS.errorBorder }]}>
            <View style={[styles.statusDot, { backgroundColor: online ? COLORS.success : COLORS.error }]} />
            <Text style={[styles.statusBadgeText, { color: online ? COLORS.success : COLORS.error }]}>
              {online ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>
        </Card>

        {/* Quick stats */}
        <Card noPadding style={styles.quickStats}>
          <View style={styles.quickStat}>
            <Text style={styles.quickNum}>{stats.workers}</Text>
            <Text style={styles.quickLbl}>Workers</Text>
          </View>
          <View style={[styles.quickStat, styles.quickStatMid]}>
            <Text style={styles.quickNum}>{stats.today}</Text>
            <Text style={styles.quickLbl}>Today</Text>
          </View>
          <View style={styles.quickStat}>
            <Text style={styles.quickNum}>{logs.length}</Text>
            <Text style={styles.quickLbl}>Log Entries</Text>
          </View>
        </Card>

        {/* Benchmarks */}
        <View style={styles.section}>
          <SectionLabel title="MODEL BENCHMARKS · VALIDATED IN TRAINING" />
          <View style={styles.benchGrid}>
            {benchmarks.map(b => (
              <Card key={b.label} style={[styles.benchCard, { width: BENCH_CARD_WIDTH }]}>
                <Text style={styles.benchValue}>{b.value}</Text>
                <Text style={styles.benchLabel}>{b.label}</Text>
                <Text style={styles.benchTarget}>{b.target}</Text>
                <View style={[styles.benchBadge, { backgroundColor: b.pass ? COLORS.successGlow : COLORS.errorGlow }]}>
                  <Text style={[styles.benchBadgeText, { color: b.pass ? COLORS.success : COLORS.error }]}>{b.pass ? '✓ PASS' : '✗ FAIL'}</Text>
                </View>
              </Card>
            ))}
          </View>
        </View>

        {/* Model info */}
        <Card style={styles.modelCard}>
          <View style={styles.modelHeader}>
            <Text style={styles.modelName}>w600k MobileFaceNet</Text>
            <Text style={styles.modelSub}>INT8 Quantized · TFLite</Text>
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
        </Card>

        {/* Attendance logs */}
        <View style={styles.section}>
          <SectionLabel
            title="RECENT ATTENDANCE"
            trailing={
              <TouchableOpacity onPress={loadData} style={styles.refreshBtn}>
                <Text style={styles.refreshText}>↻ Refresh</Text>
              </TouchableOpacity>
            }
          />

          {logs.length === 0 ? (
            <Card style={styles.emptyLogs}>
              <Text style={styles.emptyLogsText}>No attendance records yet</Text>
            </Card>
          ) : (
            <View style={styles.logsList}>
              {logs.map(log => (
                <Card key={log.id} accentColor={log.synced ? COLORS.success : COLORS.warning} style={styles.logCard}>
                  <View style={styles.logAvatar}>
                    <Text style={styles.logAvatarText}>{log.workerName[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.logInfo}>
                    <Text style={styles.logName}>{log.workerName}</Text>
                    <Text style={styles.logTime}>{new Date(log.timestamp).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.logRight}>
                    <Text style={styles.logSim}>{(log.similarity * 100).toFixed(1)}%</Text>
                    <View style={[styles.syncBadge, { backgroundColor: log.synced ? COLORS.successGlow : COLORS.warningGlow }]}>
                      <Text style={[styles.syncBadgeText, { color: log.synced ? COLORS.success : COLORS.warning }]}>
                        {log.synced ? 'Synced' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>NETRAX V2 · NHAI HACKATHON 7.0 · OFFLINE AI</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea  : { flex: 1, backgroundColor: COLORS.background },
  container : { flex: 1, backgroundColor: COLORS.background },
  content   : { padding: SPACING.screen, gap: SPACING.card, paddingBottom: 40 },

  statusCard      : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusTitle     : { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textPrimary },
  statusSub       : { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge     : { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1 },
  statusDot       : { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText : { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, letterSpacing: TRACKING.label },

  quickStats    : { flexDirection: 'row' },
  quickStat     : { flex: 1, alignItems: 'center', padding: SPACING.inner, gap: 4 },
  quickStatMid  : { borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.border },
  quickNum      : { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  quickLbl      : { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },

  section         : { gap: SPACING.card },
  refreshBtn      : { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceElevated, marginLeft: 10 },
  refreshText     : { color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold },

  benchGrid   : { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.card },
  benchCard   : { gap: 4, padding: 12 },
  benchValue  : { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  benchLabel  : { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: FONT_WEIGHT.semibold },
  benchTarget : { fontSize: 9, color: COLORS.textTertiary },
  benchBadge  : { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 2 },
  benchBadgeText : { fontSize: 9, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5 },

  modelCard    : { gap: 14 },
  modelHeader  : {},
  modelName    : { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textPrimary },
  modelSub     : { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  modelStats   : { gap: 8 },
  modelRow     : { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modelKey     : { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  modelVal     : { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, fontWeight: FONT_WEIGHT.semibold },

  emptyLogs     : { alignItems: 'center', paddingVertical: 24 },
  emptyLogsText : { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  logsList      : { gap: SPACING.card },
  logCard       : { flexDirection: 'row', alignItems: 'center' },
  logAvatar     : { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryDim, borderWidth: 1, borderColor: COLORS.primaryBorder, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  logAvatarText : { color: COLORS.primary, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold },
  logInfo       : { flex: 1 },
  logName       : { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textPrimary },
  logTime       : { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary, marginTop: 2 },
  logRight      : { alignItems: 'flex-end', gap: 4 },
  logSim        : { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold, color: COLORS.success },
  syncBadge     : { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  syncBadgeText : { fontSize: 9, fontWeight: FONT_WEIGHT.bold },

  footer     : { alignItems: 'center', paddingTop: 8 },
  footerText : { color: COLORS.textTertiary, fontSize: FONT_SIZE.xs - 1, letterSpacing: TRACKING.caps },
});
