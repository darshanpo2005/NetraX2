import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, Dimensions, Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getWorkerCount, getTodayAttendanceCount, getUnsyncedLogs } from '../services/DatabaseService';
import { syncAndPurge, isOnline } from '../services/SyncService';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }: any) {
  const [stats, setStats]         = useState({ workers: 0, today: 0, pending: 0 });
  const [online, setOnline]       = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    const [workers, today, unsynced, net] = await Promise.all([
      getWorkerCount(),
      getTodayAttendanceCount(),
      getUnsyncedLogs(),
      isOnline(),
    ]);
    setStats({ workers, today, pending: unsynced.length });
    setOnline(net);
  };

  useFocusEffect(useCallback(() => { loadStats(); }, []));

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    const result = await syncAndPurge();
    setSyncing(false);
    await loadStats();
    alert(result.success ? `✅ Synced ${result.synced} records` : `❌ ${result.error}`);
  };


  const actions = [
    { icon: '👤', label: 'Register\nWorker',   sub: 'Enroll new field staff', color: '#2563eb', bg: 'rgba(37,99,235,0.1)',  border: 'rgba(37,99,235,0.3)',  screen: 'Enroll'     },
    { icon: '🎯', label: 'Mark\nAttendance',   sub: 'Face scan authentication', color: '#059669', bg: 'rgba(5,150,105,0.1)', border: 'rgba(5,150,105,0.3)',  screen: 'Attendance' },
    { icon: '👥', label: 'View\nWorkforce',    sub: 'Manage registered staff', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.3)', screen: 'WorkerList' },
    { icon: '⚡', label: 'Admin\nConsole',     sub: 'Benchmarks & system logs', color: '#d97706', bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.3)', screen: 'Admin'      },
  ];

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3b82f6" />}
      showsVerticalScrollIndicator={false}
    >
      {/* Background orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerLeft}>
          <Text style={styles.timeText}>{timeStr}</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
          <View style={[styles.statusPill, { backgroundColor: online ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderColor: online ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }]}>
            <View style={[styles.statusDot, { backgroundColor: online ? '#10b981' : '#ef4444' }]} />
            <Text style={[styles.statusText, { color: online ? '#10b981' : '#ef4444' }]}>
              {online ? 'Online' : 'Offline Mode'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>🔐</Text>
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {[
          { label: 'Workers',   value: stats.workers, icon: '👥', color: '#3b82f6' },
          { label: 'Today',     value: stats.today,   icon: '✅', color: '#10b981' },
          { label: 'Pending',   value: stats.pending, icon: '⏳', color: stats.pending > 0 ? '#f59e0b' : '#475569' },
        ].map(stat => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statIcon}>{stat.icon}</Text>
            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Section title */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionLine} />
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.sectionLine} />
      </View>

      {/* Action Grid */}
      <View style={styles.grid}>
        {actions.map(action => (
          <TouchableOpacity
            key={action.screen}
            style={[styles.actionCard, { backgroundColor: action.bg, borderColor: action.border }]}
            onPress={() => navigation.navigate(action.screen)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBg, { backgroundColor: action.bg, borderColor: action.border }]}>
              <Text style={styles.actionIcon}>{action.icon}</Text>
            </View>
            <Text style={[styles.actionLabel, { color: '#f1f5f9' }]}>{action.label}</Text>
            <Text style={styles.actionSub}>{action.sub}</Text>
            <View style={[styles.actionArrow, { backgroundColor: action.color }]}>
              <Text style={styles.arrowText}>→</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sync Button */}
      {online ? (
        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.syncBtnLoading]}
          onPress={handleSync}
          disabled={syncing}
          activeOpacity={0.8}
        >
          <Text style={styles.syncIcon}>{syncing ? '🔄' : '☁️'}</Text>
          <View>
            <Text style={styles.syncTitle}>{syncing ? 'Syncing to AWS...' : 'Sync to AWS'}</Text>
            <Text style={styles.syncSub}>{stats.pending} records pending upload</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.offlineCard}>
          <Text style={styles.offlineIcon}>📡</Text>
          <View>
            <Text style={styles.offlineTitle}>Working Offline</Text>
            <Text style={styles.offlineSub}>{stats.pending} records queued for sync</Text>
          </View>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>All data encrypted on-device  ·  Zero network dependency</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container    : { flex: 1, backgroundColor: '#020817' },
  content      : { padding: 20, paddingBottom: 40 },
  orb1         : { position: 'absolute', top: 0, right: -60, width: 250, height: 250, borderRadius: 125, backgroundColor: '#1e40af', opacity: 0.08 },
  orb2         : { position: 'absolute', top: 300, left: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: '#6d28d9', opacity: 0.06 },
  headerCard   : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1e293b', marginBottom: 16 },
  headerLeft   : { gap: 6 },
  timeText     : { fontSize: 32, fontWeight: '800', color: '#f8fafc', letterSpacing: -1 },
  dateText     : { fontSize: 13, color: '#64748b' },
  statusPill   : { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start', marginTop: 4 },
  statusDot    : { width: 7, height: 7, borderRadius: 3.5 },
  statusText   : { fontSize: 12, fontWeight: '600' },
  headerRight  : {},
  logoCircle   : { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1.5, borderColor: 'rgba(59,130,246,0.2)', alignItems: 'center', justifyContent: 'center' },
  logoIcon     : { fontSize: 24 },
  statsRow     : { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard     : { flex: 1, backgroundColor: '#0f172a', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b', gap: 4 },
  statIcon     : { fontSize: 20 },
  statValue    : { fontSize: 26, fontWeight: '800' },
  statLabel    : { fontSize: 11, color: '#475569', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sectionLine  : { flex: 1, height: 1, backgroundColor: '#1e293b' },
  sectionTitle : { fontSize: 11, color: '#475569', fontWeight: '700', letterSpacing: 2 },
  grid         : { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  actionCard   : { width: (width - 52) / 2, borderRadius: 20, padding: 18, borderWidth: 1, gap: 8, position: 'relative', overflow: 'hidden' },
  actionIconBg : { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionIcon   : { fontSize: 20 },
  actionLabel  : { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  actionSub    : { fontSize: 11, color: '#475569', lineHeight: 16 },
  actionArrow  : { position: 'absolute', bottom: 14, right: 14, width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  arrowText    : { color: '#fff', fontSize: 14, fontWeight: '700' },
  syncBtn      : { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(14,165,233,0.1)', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(14,165,233,0.3)', marginBottom: 12 },
  syncBtnLoading: { opacity: 0.7 },
  syncIcon     : { fontSize: 28 },
  syncTitle    : { color: '#38bdf8', fontSize: 15, fontWeight: '700' },
  syncSub      : { color: '#475569', fontSize: 12, marginTop: 2 },
  offlineCard  : { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(71,85,105,0.15)', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#1e293b', marginBottom: 12 },
  offlineIcon  : { fontSize: 28 },
  offlineTitle : { color: '#94a3b8', fontSize: 15, fontWeight: '700' },
  offlineSub   : { color: '#475569', fontSize: 12, marginTop: 2 },
  footer       : { alignItems: 'center', marginTop: 8 },
  footerText   : { color: '#1e293b', fontSize: 11, letterSpacing: 0.5 },
});
