import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl, Alert, Dimensions, Animated, Easing,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { getWorkerCount, getTodayAttendanceCount, getUnsyncedLogs } from '../services/DatabaseService';
import { syncAndPurge, isOnline, isSyncConfigured } from '../services/SyncService';
import { getModelInfo } from '../services/TFLiteService';
import { COLORS, FONT_SIZE, FONT_WEIGHT, TRACKING, RADIUS, SPACING } from '../theme';
import Card from '../components/Card';
import SectionLabel from '../components/SectionLabel';

const { width } = Dimensions.get('window');
const STAT_CARD_WIDTH = (width - SPACING.screen * 2 - SPACING.card) / 2;
const ACTION_CARD_WIDTH = (width - SPACING.screen * 2 - SPACING.card) / 2;

const ACTIONS = [
  { icon: 'person-add',            label: 'Register Worker', color: COLORS.primary, bg: COLORS.primaryDim,  screen: 'Enroll'     },
  { icon: 'fact-check',            label: 'Mark Attendance', color: COLORS.success, bg: COLORS.successGlow, screen: 'Attendance' },
  { icon: 'badge',                 label: 'Workforce',       color: COLORS.primary, bg: COLORS.primaryDim,  screen: 'WorkerList' },
  { icon: 'admin-panel-settings',  label: 'Admin Console',   color: COLORS.warning, bg: COLORS.warningGlow, screen: 'Admin'      },
  { icon: 'assessment',            label: 'Reports',         color: COLORS.primary, bg: COLORS.primaryDim,  screen: 'Reports'    },
  { icon: 'dashboard',             label: 'Dashboard',       color: COLORS.success, bg: COLORS.successGlow, screen: 'Dashboard'  },
] as const;

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

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const pulseScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0.3] });

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

  const absent = Math.max(0, stats.workers - stats.today);
  const rate   = stats.workers > 0 ? Math.round((stats.today / stats.workers) * 100) : 0;

  const lastSyncLabel = lastSync
    ? new Date(lastSync).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  const subtitle = stats.pending > 0
    ? `${stats.pending} record${stats.pending === 1 ? '' : 's'} pending sync.`
    : 'All attendance records synced.';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <MaterialIcons name="security" size={22} color={COLORS.primary} />
          <Text style={styles.brandName}>NetraX</Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Admin')} activeOpacity={0.7}>
          <MaterialIcons name="settings" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <View style={[styles.statusPill, { borderColor: online ? COLORS.successBorder : COLORS.errorBorder, backgroundColor: online ? COLORS.successGlow : COLORS.errorGlow }]}>
            <View style={[styles.statusDot, { backgroundColor: online ? COLORS.success : COLORS.error }]} />
            <Text style={[styles.statusPillText, { color: online ? COLORS.success : COLORS.error }]}>
              {online ? 'Secure Connection' : 'Offline Mode'}
            </Text>
          </View>
          <Text style={styles.greeting}>{greeting()}, Admin 👋</Text>
          <Text style={styles.greetingSub}>{subtitle}</Text>
        </View>

        {/* Scanner panel */}
        <TouchableOpacity
          style={styles.scannerCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Attendance')}
        >
          <View style={styles.scannerRingWrap}>
            <Animated.View style={[styles.scannerPulseRing, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
            <View style={styles.scannerCircle}>
              <MaterialIcons name="fingerprint" size={30} color={COLORS.primary} />
            </View>
          </View>
          <Text style={styles.scannerLabel}>Scanner Ready</Text>
        </TouchableOpacity>

        {/* Stats grid 2x2 */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <View style={styles.statTopRow}>
              <MaterialIcons name="groups" size={18} color={COLORS.textSecondary} />
              <Text style={styles.statTag}>Total</Text>
            </View>
            <View>
              <Text style={styles.statBigValue}>{stats.workers}</Text>
              <Text style={styles.statCaption}>Registered workers</Text>
            </View>
          </Card>

          <Card accentColor={COLORS.success} style={styles.statCard}>
            <View style={styles.statTopRow}>
              <MaterialIcons name="how-to-reg" size={18} color={COLORS.success} />
              <Text style={styles.statTag}>Present</Text>
            </View>
            <View>
              <Text style={[styles.statBigValue, { color: COLORS.success }]}>{stats.today}</Text>
              <Text style={styles.statCaption}>{rate}% today</Text>
            </View>
          </Card>

          <Card accentColor={COLORS.error} style={styles.statCard}>
            <View style={styles.statTopRow}>
              <MaterialIcons name="person-off" size={18} color={COLORS.error} />
              <Text style={styles.statTag}>Absent</Text>
            </View>
            <View>
              <Text style={[styles.statBigValue, { color: COLORS.error }]}>{absent}</Text>
              <Text style={styles.statCaption}>{stats.workers > 0 ? 100 - rate : 0}% today</Text>
            </View>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: COLORS.primaryDim }]}>
            <View style={styles.statTopRow}>
              <MaterialIcons name="analytics" size={18} color={COLORS.primary} />
              <Text style={styles.statTag}>Rate</Text>
            </View>
            <View>
              <Text style={[styles.statBigValue, { color: COLORS.primary }]}>{rate}%</Text>
              <Text style={[styles.statCaption, { color: COLORS.primary }]}>Attendance rate</Text>
            </View>
          </Card>
        </View>

        {/* Quick actions */}
        <SectionLabel title="Quick Actions" />
        <View style={styles.actionsGrid}>
          {ACTIONS.map(action => (
            <TouchableOpacity
              key={action.screen}
              style={styles.actionCard}
              onPress={() => navigation.navigate(action.screen)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: action.bg }]}>
                <MaterialIcons name={action.icon as any} size={22} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sync / offline / unconfigured */}
        <SectionLabel title="Security & Sync" />
        <View style={styles.section}>
          {!isSyncConfigured ? (
            <Card accentColor={COLORS.error} style={styles.infoCardRow}>
              <MaterialIcons name="cloud-off" size={24} color={COLORS.error} />
              <View style={styles.infoTextBlock}>
                <Text style={[styles.infoTitle, { color: COLORS.error }]}>Sync Not Configured</Text>
                <Text style={styles.infoSub}>Set AWS endpoint in SyncService.ts to enable</Text>
              </View>
            </Card>
          ) : online ? (
            <TouchableOpacity onPress={handleSync} disabled={syncing} activeOpacity={0.8}>
              <Card accentColor={COLORS.primary} style={styles.infoCardRow}>
                <MaterialIcons name={syncing ? 'sync' : 'cloud-sync'} size={24} color={COLORS.primary} />
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
              <MaterialIcons name="wifi-off" size={24} color={COLORS.textSecondary} />
              <View style={styles.infoTextBlock}>
                <Text style={styles.infoTitle}>Working Offline</Text>
                <Text style={styles.infoSub}>{stats.pending} records queued for sync</Text>
              </View>
            </Card>
          )}

          <TouchableOpacity onPress={handleTestModel} activeOpacity={0.8}>
            <Card accentColor={COLORS.warning} style={styles.infoCardRow}>
              <MaterialIcons name="memory" size={24} color={COLORS.warning} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.screen,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.screen,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
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

  greetingSection: {
    marginBottom: SPACING.card,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: TRACKING.caps,
    textTransform: 'uppercase',
  },
  greeting: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  greetingSub: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  scannerCard: {
    height: 160,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: SPACING.section,
  },
  scannerRingWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerPulseRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  scannerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  scannerLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
    letterSpacing: TRACKING.caps,
    textTransform: 'uppercase',
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.card,
    marginBottom: SPACING.section,
  },
  statCard: {
    width: STAT_CARD_WIDTH,
    height: 100,
    justifyContent: 'space-between',
  },
  statTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statTag: {
    fontSize: FONT_SIZE.xs - 1,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: TRACKING.caps,
    textTransform: 'uppercase',
  },
  statBigValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  statCaption: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.card,
    marginBottom: SPACING.section,
  },
  actionCard: {
    width: ACTION_CARD_WIDTH,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.buttonSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  section: {
    gap: SPACING.card,
    marginBottom: SPACING.section,
  },
  infoCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
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
