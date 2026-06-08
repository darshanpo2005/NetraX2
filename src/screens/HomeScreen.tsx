import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, Dimensions, Alert, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    { icon: '👤', label: 'Register\nWorker',  sub: 'Enroll new field staff',      color: '#3b82f6', grad: ['#1e3a8a','#1e40af'] as const, screen: 'Enroll'     },
    { icon: '🎯', label: 'Mark\nAttendance',  sub: 'Face scan authentication',    color: '#10b981', grad: ['#064e3b','#059669'] as const, screen: 'Attendance' },
    { icon: '👥', label: 'View\nWorkforce',   sub: 'Manage registered staff',     color: '#a78bfa', grad: ['#3b0764','#6d28d9'] as const, screen: 'WorkerList' },
    { icon: '⚡', label: 'Admin\nConsole',    sub: 'Benchmarks & system logs',    color: '#fbbf24', grad: ['#78350f','#b45309'] as const, screen: 'Admin'      },
    { icon: '📊', label: 'View\nReports',     sub: 'Attendance history & export', color: '#38bdf8', grad: ['#0c4a6e','#0369a1'] as const, screen: 'Reports'    },
    { icon: '📈', label: 'Dashboard',         sub: 'Charts & live statistics',    color: '#f472b6', grad: ['#831843','#be185d'] as const, screen: 'Dashboard'  },
  ];

  const now     = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const statItems = [
    { label: 'Workers', value: stats.workers, icon: '👥', colors: ['#1e3a8a', '#2563eb'] as const },
    { label: 'Present',  value: stats.today,   icon: '✅', colors: ['#064e3b', '#059669'] as const },
    { label: 'Pending',  value: stats.pending, icon: '⏳', colors: (stats.pending > 0 ? ['#78350f', '#d97706'] as const : ['#1e293b', '#334155'] as const) },
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
        <LinearGradient
          colors={['#0f2460', '#1a1040', '#0f172a']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.headerCard}
        >
          {/* Top row: brand + logo */}
          <View style={styles.headerTop}>
            <View style={styles.brandRow}>
              <LinearGradient colors={['#3b82f6', '#6366f1']} style={styles.shieldBadge}>
                <Text style={styles.shieldIcon}>🛡️</Text>
              </LinearGradient>
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
          {/* Time */}
          <Text style={styles.timeText}>{timeStr}</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
        </LinearGradient>
      </Animated.View>

      {/* Stats Row */}
      <Animated.View style={[styles.statsRow, slide(statsAnim)]}>
        {statItems.map(stat => (
          <LinearGradient key={stat.label} colors={stat.colors} style={styles.statCard}>
            <Text style={styles.statIcon}>{stat.icon}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </LinearGradient>
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
              <LinearGradient
                colors={action.grad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.actionCard}
              >
                <View style={styles.actionIconWrap}>
                  <Text style={styles.actionIcon}>{action.icon}</Text>
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
                <Text style={styles.actionSub}>{action.sub}</Text>
                <View style={styles.actionArrow}>
                  <Text style={styles.arrowText}>→</Text>
                </View>
              </LinearGradient>
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
          <LinearGradient colors={['#0c4a6e', '#0369a1']} style={styles.syncGrad}>
            <Text style={styles.syncIcon}>{syncing ? '🔄' : '☁️'}</Text>
            <View>
              <Text style={styles.syncTitle}>{syncing ? 'Syncing to AWS...' : 'Sync to AWS'}</Text>
              <Text style={styles.syncSub}>{stats.pending} records pending upload</Text>
            </View>
          </LinearGradient>
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

  headerCard      : { borderRadius: 24, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', gap: 6 },
  headerTop       : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  brandRow        : { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shieldBadge     : { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  shieldIcon      : { fontSize: 22 },
  brandName       : { fontSize: 20, fontWeight: '900', color: '#f8fafc', letterSpacing: 0.5 },
  brandVer        : { fontSize: 10, color: '#93c5fd', letterSpacing: 1.5, fontWeight: '600' },
  netPill         : { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  netDot          : { width: 7, height: 7, borderRadius: 3.5 },
  netText         : { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  timeText        : { fontSize: 44, fontWeight: '900', color: '#f8fafc', letterSpacing: -2 },
  dateText        : { fontSize: 13, color: '#93c5fd', letterSpacing: 0.3 },

  statsRow        : { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard        : { flex: 1, borderRadius: 20, padding: 16, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  statIcon        : { fontSize: 22 },
  statValue       : { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  statLabel       : { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  sectionHeader   : { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  sectionLine     : { flex: 1, height: 1, backgroundColor: '#1e293b' },
  sectionTitle    : { fontSize: 11, color: '#475569', fontWeight: '700', letterSpacing: 2 },

  grid            : { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  actionCard      : { borderRadius: 20, padding: 18, gap: 8, position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', minHeight: 140 },
  actionIconWrap  : { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  actionIcon      : { fontSize: 22 },
  actionLabel     : { fontSize: 15, fontWeight: '800', color: '#fff', lineHeight: 20 },
  actionSub       : { fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 16 },
  actionArrow     : { position: 'absolute', bottom: 14, right: 14, width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  arrowText       : { color: '#fff', fontSize: 14, fontWeight: '700' },

  syncBtn         : { marginBottom: 12, borderRadius: 18, overflow: 'hidden' },
  syncGrad        : { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 18 },
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
