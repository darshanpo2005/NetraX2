import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, Alert, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getWorkerCount, getTodayAttendanceCount, getUnsyncedLogs } from '../services/DatabaseService';
import { syncAndPurge, isOnline, isSyncConfigured } from '../services/SyncService';
import { getModelInfo } from '../services/TFLiteService';
import { COLORS, FONT_SIZE, FONT_WEIGHT, TRACKING, RADIUS, SPACING } from '../theme';
import Card from '../components/Card';
import SectionLabel from '../components/SectionLabel';

const { width } = Dimensions.get('window');
const STAT_CARD_WIDTH = (width - SPACING.screen * 2 - SPACING.card) / 2;

const ACTIONS = [
  { icon: '👤', label: 'Register Worker', color: COLORS.primary, screen: 'Enroll'     },
  { icon: '🎯', label: 'Mark Attendance', color: COLORS.success, screen: 'Attendance' },
  { icon: '👥', label: 'Workforce',       color: COLORS.primary, screen: 'WorkerList' },
  { icon: '⚡', label: 'Admin Console',   color: COLORS.warning, screen: 'Admin'      },
  { icon: '📊', label: 'Reports',         color: COLORS.primary, screen: 'Reports'    },
  { icon: '📈', label: 'Dashboard',       color: COLORS.success, screen: 'Dashboard'  },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({ navigation }: any) {
  const [stats, setStats]           = useState({ workers: 0, today: 0, pending: 0 });
  const [online, setOnline]         = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync]     = useState<number | null>(null);

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
    if (r.success) setLastSync(Date.now());
    Alert.alert(r.success ? 'Sync Complete' : 'Sync Failed', r.success ? `Synced ${r.synced} records` : (r.error ?? 'Unknown error'));
  };

  const statItems = [
    { label: 'Workers',    value: String(stats.workers), color: COLORS.primary },
    { label: 'Present',    value: String(stats.today),   color: COLORS.success },
    { label: 'Pending',    value: String(stats.pending), color: stats.pending > 0 ? COLORS.warning : COLORS.textTertiary },
    { label: 'Status',     value: online ? 'Online' : 'Offline', color: online ? COLORS.success : COLORS.error },
  ];

  const lastSyncLabel = lastSync
    ? new Date(lastSync).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandName}>NetraX</Text>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Admin')} activeOpacity={0.7}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.greeting}>{greeting()}, Admin 👋</Text>

      {/* Stats grid 2x2 */}
      <View style={styles.statsGrid}>
        {statItems.map(stat => (
          <Card key={stat.label} accentColor={stat.color} style={styles.statCard}>
            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </Card>
        ))}
      </View>

      {/* Quick actions */}
      <SectionLabel title="QUICK ACTIONS" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        {ACTIONS.map(action => (
          <TouchableOpacity
            key={action.screen}
            style={styles.pillChip}
            onPress={() => navigation.navigate(action.screen)}
            activeOpacity={0.75}
          >
            <Text style={styles.pillIcon}>{action.icon}</Text>
            <Text style={styles.pillLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sync / offline / unconfigured */}
      <View style={styles.section}>
        {!isSyncConfigured ? (
          <Card accentColor={COLORS.error} style={styles.infoCardRow}>
            <Text style={styles.infoIcon}>🔌</Text>
            <View style={styles.infoTextBlock}>
              <Text style={[styles.infoTitle, { color: COLORS.error }]}>Sync Not Configured</Text>
              <Text style={styles.infoSub}>Set AWS endpoint in SyncService.ts to enable</Text>
            </View>
          </Card>
        ) : online ? (
          <TouchableOpacity onPress={handleSync} disabled={syncing} activeOpacity={0.8}>
            <Card accentColor={COLORS.primary} style={styles.infoCardRow}>
              <Text style={styles.infoIcon}>{syncing ? '🔄' : '☁️'}</Text>
              <View style={styles.infoTextBlock}>
                <Text style={[styles.infoTitle, { color: COLORS.primary }]}>
                  {syncing ? 'Syncing to AWS…' : 'Sync to AWS'}
                </Text>
                <Text style={styles.infoSub}>{stats.pending} records pending upload</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ) : (
          <Card accentColor={COLORS.textTertiary} style={styles.infoCardRow}>
            <Text style={styles.infoIcon}>📡</Text>
            <View style={styles.infoTextBlock}>
              <Text style={styles.infoTitle}>Working Offline</Text>
              <Text style={styles.infoSub}>{stats.pending} records queued for sync</Text>
            </View>
          </Card>
        )}

        <TouchableOpacity onPress={handleTestModel} activeOpacity={0.8} style={styles.testModelWrap}>
          <Card accentColor={COLORS.warning} style={styles.infoCardRow}>
            <Text style={styles.infoIcon}>🧠</Text>
            <View style={styles.infoTextBlock}>
              <Text style={[styles.infoTitle, { color: COLORS.warning }]}>Test TFLite Model</Text>
              <Text style={styles.infoSub}>Verify MobileFaceNet is loaded</Text>
            </View>
          </Card>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>LAST SYNC · {lastSyncLabel}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.screen,
    paddingTop: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    letterSpacing: TRACKING.label,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.buttonSm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 18,
  },

  greeting: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.light,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.section,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.card,
    marginBottom: SPACING.section,
  },
  statCard: {
    width: STAT_CARD_WIDTH,
  },
  statValue: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
    letterSpacing: TRACKING.label,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  pillRow: {
    gap: SPACING.card,
    paddingBottom: SPACING.section,
    paddingRight: SPACING.screen,
  },
  pillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pillIcon: {
    fontSize: 16,
  },
  pillLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },

  section: {
    gap: SPACING.card,
    marginBottom: SPACING.section,
  },
  testModelWrap: {},
  infoCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  infoIcon: {
    fontSize: 26,
  },
  infoTextBlock: {
    flex: 1,
  },
  infoTitle: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  infoSub: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  footer: {
    alignItems: 'center',
    marginTop: 4,
  },
  footerText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZE.xs,
    letterSpacing: TRACKING.label,
  },
});
