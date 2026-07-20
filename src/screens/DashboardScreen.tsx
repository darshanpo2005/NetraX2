import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  Dimensions, ActivityIndicator, Image, StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import BarChart from '../components/BarChart';
import {
  getWorkerCount,
  getTodayAttendance,
  getWeeklyAttendance,
  getWorkerStreaks,
  type DayCount,
  type WorkerStreak,
} from '../services/DatabaseService';
import { COLORS, FONT_SIZE, FONT_WEIGHT, TRACKING, RADIUS, SPACING } from '../theme';
import Card from '../components/Card';
import SectionLabel from '../components/SectionLabel';

const { width } = Dimensions.get('window');
const SUMMARY_CARD_WIDTH = (width - SPACING.screen * 2 - SPACING.card) / 2;
const TOP_INSET = StatusBar.currentHeight || 44;

export default function DashboardScreen() {
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalWorkers, setTotal]    = useState(0);
  const [presentCount, setPresent]  = useState(0);
  const [weekData, setWeekData]     = useState<DayCount[]>([]);
  const [streaks, setStreaks]       = useState<WorkerStreak[]>([]);

  const load = async () => {
    try {
      const [total, todayRows, week, streakRows] = await Promise.all([
        getWorkerCount(),
        getTodayAttendance(),
        getWeeklyAttendance(),
        getWorkerStreaks(),
      ]);
      setTotal(total);
      setPresent(todayRows.length);
      setWeekData(week);
      setStreaks(streakRows);
    } catch {
      // DB errors surface as empty state rather than crash
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const absent = Math.max(0, totalWorkers - presentCount);
  const rate   = totalWorkers > 0 ? Math.round((presentCount / totalWorkers) * 100) : 0;

  const summaryCards = [
    { label: 'Enrolled', value: totalWorkers, color: COLORS.primary },
    { label: 'Present',  value: presentCount,  color: COLORS.success },
    { label: 'Absent',   value: absent,        color: COLORS.error   },
    { label: 'Rate',     value: `${rate}%`,    color: COLORS.warning },
  ];

  const barData = weekData.map(d => ({ x: d.label, y: Math.max(d.count, 0) }));

  const formatTime = (ts: number | null) => {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Date header */}
      <View style={styles.dateRow}>
        <Text style={styles.dateLabel}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Summary cards */}
      <SectionLabel title="TODAY'S OVERVIEW" />
      <View style={styles.summaryGrid}>
        {summaryCards.map(card => (
          <Card key={card.label} accentColor={card.color} style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: card.color }]}>{card.value}</Text>
            <Text style={styles.summaryLabel}>{card.label}</Text>
          </Card>
        ))}
      </View>

      {/* Weekly bar chart */}
      <SectionLabel title="7-DAY ATTENDANCE" />
      <Card noPadding style={styles.chartCard}>
        <BarChart data={barData} />
      </Card>

      {/* Worker attendance list */}
      <SectionLabel title={`WORKFORCE · ${streaks.length} workers`} />
      <Card noPadding style={styles.listCard}>
        {streaks.length === 0 ? (
          <Text style={styles.emptyText}>No workers enrolled yet.</Text>
        ) : (
          streaks.map((w, i) => (
            <View
              key={w.workerId}
              style={[styles.workerRow, i < streaks.length - 1 && styles.workerRowBorder]}
            >
              {w.photoUri ? (
                <Image source={{ uri: w.photoUri }} style={styles.workerPhoto} />
              ) : (
                <View style={styles.workerInitials}>
                  <Text style={styles.workerInitialsText}>{w.workerName[0]?.toUpperCase()}</Text>
                </View>
              )}

              <View style={[styles.statusDot, { backgroundColor: w.presentToday ? COLORS.success : COLORS.error }]} />

              <View style={styles.workerInfo}>
                <Text style={styles.workerName}>{w.workerName}</Text>
                <Text style={styles.workerSub}>
                  {w.presentToday
                    ? `In today at ${formatTime(w.lastSeen)}`
                    : w.lastSeen
                      ? `Last seen ${new Date(w.lastSeen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                      : 'No attendance yet'}
                </Text>
              </View>

              <View style={[styles.streakBadge, w.streak > 0 ? styles.streakActive : styles.streakZero]}>
                <Text style={[styles.streakText, { color: w.streak > 0 ? COLORS.warning : COLORS.textTertiary }]}>
                  {w.streak}d
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>PULL DOWN TO REFRESH · DATA FROM ON-DEVICE SQLITE</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container        : { flex: 1, backgroundColor: COLORS.background, paddingTop: TOP_INSET },
  content          : { padding: SPACING.screen, paddingBottom: 48 },
  loadingContainer : { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: TOP_INSET },
  loadingText      : { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },

  dateRow   : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.section },
  dateLabel : { fontSize: FONT_SIZE.base, color: COLORS.textSecondary, fontWeight: FONT_WEIGHT.semibold },
  liveBadge : { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.successGlow, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.successBorder },
  liveDot   : { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  liveText  : { color: COLORS.success, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, letterSpacing: TRACKING.label },

  summaryGrid  : { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.card, marginBottom: SPACING.card },
  summaryCard  : { width: SUMMARY_CARD_WIDTH },
  summaryValue : { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold },
  summaryLabel : { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: FONT_WEIGHT.semibold, textTransform: 'uppercase', letterSpacing: TRACKING.label, marginTop: 4 },

  chartCard : { paddingVertical: 8, marginBottom: SPACING.card },

  listCard        : { marginBottom: SPACING.card },
  emptyText       : { color: COLORS.textSecondary, textAlign: 'center', padding: SPACING.section, fontSize: FONT_SIZE.sm },
  workerRow       : { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.inner, paddingVertical: 14, gap: 8 },
  workerRowBorder : { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  workerPhoto     : { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: COLORS.primary },
  workerInitials  : { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryDim, borderWidth: 1, borderColor: COLORS.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  workerInitialsText: { color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  statusDot       : { width: 8, height: 8, borderRadius: 4 },
  workerInfo      : { flex: 1, gap: 2 },
  workerName      : { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  workerSub       : { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  streakBadge     : { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm, borderWidth: 1 },
  streakActive    : { backgroundColor: COLORS.warningGlow, borderColor: COLORS.warningBorder },
  streakZero      : { backgroundColor: 'rgba(100,116,139,0.08)', borderColor: COLORS.border },
  streakText      : { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },

  footer     : { alignItems: 'center', marginTop: 12 },
  footerText : { color: COLORS.textTertiary, fontSize: FONT_SIZE.xs - 1, letterSpacing: TRACKING.label },
});
