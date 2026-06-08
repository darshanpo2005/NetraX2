import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, Dimensions, Alert, Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getWorkerCount, getTodayAttendanceCount, getUnsyncedLogs } from '../services/DatabaseService';
import { syncAndPurge, isOnline, isSyncConfigured } from '../services/SyncService';
import { getModelInfo } from '../services/TFLiteService';

const { width } = Dimensions.get('window');
const NUM_CARDS = 6;

export default function HomeScreen({ navigation }: any) {
  const [stats, setStats]           = useState({ workers: 0, today: 0, pending: 0 });
  const [online, setOnline]         = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const headerAnim  = useRef(new Animated.Value(0)).current;
  const statsAnim   = useRef(new Animated.Value(0)).current;
  const sectionAnim = useRef(new Animated.Value(0)).current;
  const cardAnims   = useRef(Array.from({ length: NUM_CARDS }, () => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerAnim,  { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(statsAnim,   { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(sectionAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.stagger(80, cardAnims.map(a =>
        Animated.timing(a, { toValue: 1, duration: 350, useNativeDriver: true })
      )),
    ]).start();
  }, []);

  const slide = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });

  const loadStats = async () => {
    const [workers, today, unsynced, net] = await Promise.all([
      getWorkerCount(), getTodayAttendanceCount(), getUnsyncedLogs(), isOnline(),
    ]);
    setStats({ workers, today, pending: unsynced.length });
    setOnline(net);
  };

  useFocusEffect(useCallback(() => { loadStats(); }, []));

  const handleRefresh = async () => { setRefreshing(true); await loadStats(); setRefreshing(false); };
  const handleTestModel = async () => { const info = await getModelInfo(); Alert.alert('Model Test', info); };
  const handleSync = async () => {
    setSyncing(true);
    const r = await syncAndPurge();
    setSyncing(false);
    await loadStats();
    alert(r.success ? `✅ Synced ${r.synced} records` : `❌ ${r.error}`);
  };

  const actions = [
    { icon: '👤', label: 'Register\nWorker',  sub: 'Enroll new field staff',      color: '#3b82f6', bg: '#0f2447', screen: 'Enroll'     },
    { icon: '🎯', label: 'Mark\nAttendance',  sub: 'Face scan authentication',    color: '#10b981', bg: '#0a2e1e', screen: 'Attendance' },
    { icon: '👥', label: 'View\nWorkforce',   sub: 'Manage registered staff',     color: '#a78bfa', bg: '#1e0f3a', screen: 'WorkerList' },
    { icon: '⚡', label: 'Admin\nConsole',    sub: 'Benchmarks & system logs',    color: '#fbbf24', bg: '#2a1a00', screen: 'Admin'      },
    { icon: '📊', label: 'View\nReports',     sub: 'Attendance history & export', color: '#38bdf8', bg: '#0a2030', screen: 'Reports'    },
    { icon: '📈', label: 'Dashboard',         sub: 'Charts & live statistics',    color: '#f472b6', bg: '#2a0a1e', screen: 'Dashboard'  },
  ];

  const now     = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const statItems = [
    { label: 'Workers', value: stats.workers, icon: '👥', bg: '#1e3a5f', border: '#3B82F6' },
    { label: 'Present',  value: stats.today,   icon: '✅', bg: '#1a3a2a', border: '#10B981' },
    { label: 'Pending',  value: stats.pending, icon: '⏳', bg: stats.pending > 0 ? '#3a1a1a' : '#1a1f2a', border: stats.pending > 0 ? '#EF4444' : '#334155' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3b82f6" />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Banner */}
      <Animated.View style={slide(headerAnim)}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.brandRow}>
              <View style={styles.shieldBadge}>
                <Text style={styles.shieldIcon}>🛡️</Text>
              </View>
              <View>
                <Text style={styles.brandName}>NetraX</Text>
                <Text style={styles.brandVer}>v2.0 · SECURE</Text>
              </View>
            </View>
            <View style={[styles.netPill, { backgroundColor: online ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', borderColor: online ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)' }]}>
              <View style={[styles.netDot, { backgroundColor: online ? '#10b981' : '#ef4444' }]} />
              <Text style={[styles.netText, { color: online ? '#10b981' : '#ef4444' }]}>{online ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
          <Text style={styles.timeText}>{timeStr}</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>
      </Animated.View>

      {/* Stats Row */}
      <Animated.View style={[styles.statsRow, slide(statsAnim)]}>
        {statItems.map(stat => (
          <View key={stat.label} style={[styles.statCard, { backgroundColor: stat.bg, borderColor: stat.border }]}>
            <Text style={styles.statIcon}>{stat.icon}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </Animated.View>

      {/* Section title */}
      <Animated.View style={[styles.sectionHeader, slide(sectionAnim)]}>
        <View style={styles.sectionLine} />
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.sectionLine} />
      </Animated.View>

      {/* Action Grid */}
      <View style={styles.grid}>
        {actions.map((action, index) => (
          <Animated.View
            key={action.screen}
            style={[{ width: (width - 52) / 2 }, slide(cardAnims[index])]}
          >
            <TouchableOpacity
              onPress={() => navigation.navigate(action.screen)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionCard, { backgroundColor: action.bg, borderColor: `${action.color}40` }]}>
                <View style={[styles.actionIconWrap, { backgroundColor: `${action.color}20` }]}>
                  <Text style={styles.actionIcon}>{action.icon}</Text>
                </View>
                <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
                <Text style={styles.actionSub}>{action.sub}</Text>
                <View style={[styles.actionArrow, { backgroundColor: `${action.color}25` }]}>
                  <Text style={[styles.arrowText, { color: action.color }]}>→</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      {/* Sync / Offline / Unconfigured */}
      {!isSyncConfigured ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>🔌</Text>
          <View>
            <Text style={styles.infoTitle}>Sync Not Configured</Text>
            <Text style={styles.infoSub}>Set AWS endpoint in SyncService.ts to enable</Text>
          </View>
        </View>
      ) : online ? (
        <TouchableOpacity style={[styles.syncBtn, syncing && { opacity: 0.7 }]} onPress={handleSync} disabled={syncing} activeOpacity={0.8}>
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

      {/* Test Model */}
      <TouchableOpacity style={styles.testModelBtn} onPress={handleTestModel} activeOpacity={0.8}>
        <Text style={styles.testModelIcon}>🧠</Text>
        <View>
          <Text style={styles.testModelTitle}>Test TFLite Model</Text>
          <Text style={styles.testModelSub}>Verify MobileFaceNet is loaded</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>All data encrypted on-device  ·  Zero network dependency</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container       : { flex: 1, backgroundColor: '#020817' },
  content         : { padding: 16, paddingBottom: 40 },

  headerCard      : { borderRadius: 24, padding: 20, marginBottom: 14, backgroundColor: '#1E40AF', borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)', gap: 6 },
  headerTop       : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  brandRow        : { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shieldBadge     : { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  shieldIcon      : { fontSize: 22 },
  brandName       : { fontSize: 20, fontWeight: '900', color: '#f8fafc', letterSpacing: 0.5 },
  brandVer        : { fontSize: 10, color: '#bfdbfe', letterSpacing: 1.5, fontWeight: '600' },
  netPill         : { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  netDot          : { width: 7, height: 7, borderRadius: 3.5 },
  netText         : { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  timeText        : { fontSize: 44, fontWeight: '900', color: '#f8fafc', letterSpacing: -2 },
  dateText        : { fontSize: 13, color: '#bfdbfe', letterSpacing: 0.3 },

  statsRow        : { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard        : { flex: 1, borderRadius: 20, padding: 16, alignItems: 'center', gap: 4, borderWidth: 1.5 },
  statIcon        : { fontSize: 22 },
  statValue       : { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  statLabel       : { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  sectionHeader   : { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  sectionLine     : { flex: 1, height: 1, backgroundColor: '#1e293b' },
  sectionTitle    : { fontSize: 11, color: '#475569', fontWeight: '700', letterSpacing: 2 },

  grid            : { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  actionCard      : { borderRadius: 20, padding: 18, gap: 8, position: 'relative', overflow: 'hidden', borderWidth: 1, minHeight: 140 },
  actionIconWrap  : { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionIcon      : { fontSize: 22 },
  actionLabel     : { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  actionSub       : { fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 16 },
  actionArrow     : { position: 'absolute', bottom: 14, right: 14, width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  arrowText       : { fontSize: 14, fontWeight: '700' },

  syncBtn         : { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#0c3a5e', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#0369a1', marginBottom: 12 },
  syncIcon        : { fontSize: 28 },
  syncTitle       : { color: '#bae6fd', fontSize: 15, fontWeight: '700' },
  syncSub         : { color: 'rgba(186,230,253,0.6)', fontSize: 12, marginTop: 2 },
  offlineCard     : { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(71,85,105,0.15)', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#1e293b', marginBottom: 12 },
  offlineIcon     : { fontSize: 28 },
  offlineTitle    : { color: '#94a3b8', fontSize: 15, fontWeight: '700' },
  offlineSub      : { color: '#475569', fontSize: 12, marginTop: 2 },
  infoCard        : { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(239,68,68,0.07)', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', marginBottom: 12 },
  infoIcon        : { fontSize: 28 },
  infoTitle       : { color: '#f87171', fontSize: 15, fontWeight: '700' },
  infoSub         : { color: '#475569', fontSize: 12, marginTop: 2 },
  testModelBtn    : { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', marginBottom: 12 },
  testModelIcon   : { fontSize: 28 },
  testModelTitle  : { color: '#a78bfa', fontSize: 15, fontWeight: '700' },
  testModelSub    : { color: '#475569', fontSize: 12, marginTop: 2 },
  footer          : { alignItems: 'center', marginTop: 8 },
  footerText      : { color: '#1e293b', fontSize: 11, letterSpacing: 0.5 },
});
