import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  Dimensions, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';
import {
  getWorkerCount,
  getTodayAttendance,
  getWeeklyAttendance,
  getWorkerStreaks,
  type DayCount,
  type WorkerStreak,
} from '../services/DatabaseService';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 40;

export default function DashboardScreen() {
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalWorkers, setTotal]    = useState(0);
  const [presentCount, setPresent]  = useState(0);
  const [weekData, setWeekData]     = useState<DayCount[]>([]);
  const [streaks, setStreaks]       = useState<WorkerStreak[]>([]);

  const load = async () => {
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
    setLoading(false);
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
    { label: 'Enrolled',    value: totalWorkers,  icon: '👥', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.25)' },
    { label: 'Present',     value: presentCount,  icon: '✅', color: '#10b981', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.25)' },
    { label: 'Absent',      value: absent,        icon: '❌', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)'  },
    { label: 'Rate',        value: `${rate}%`,    icon: '📈', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)' },
  ];

  const chartData = {
    labels: weekData.map(d => d.label),
    datasets: [{ data: weekData.map(d => Math.max(d.count, 0)) }],
  };

  const formatTime = (ts: number | null) => {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

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

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <SectionLabel title="TODAY'S OVERVIEW" />
      <View style={styles.summaryGrid}>
        {summaryCards.map(card => (
          <View
            key={card.label}
            style={[styles.summaryCard, { backgroundColor: card.bg, borderColor: card.border }]}
          >
            <Text style={styles.summaryIcon}>{card.icon}</Text>
            <Text style={[styles.summaryValue, { color: card.color }]}>{card.value}</Text>
            <Text style={styles.summaryLabel}>{card.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Weekly bar chart ───────────────────────────────────────────────── */}
      <SectionLabel title="7-DAY ATTENDANCE" />
      <View style={styles.chartCard}>
        <BarChart
          data={chartData}
          width={CHART_WIDTH - 32}
          height={180}
          yAxisLabel=""
          yAxisSuffix=""
          fromZero
          showValuesOnTopOfBars
          withInnerLines={false}
          chartConfig={{
            backgroundColor: '#0f172a',
            backgroundGradientFrom: '#0f172a',
            backgroundGradientTo: '#0f172a',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(59,130,246,${opacity})`,
            labelColor: () => '#64748b',
            propsForLabels: { fontSize: 11 },
            barPercentage: 0.6,
          }}
          style={styles.chart}
        />
        <View style={styles.chartFooter}>
          {weekData.map(d => (
            <Text key={d.date} style={styles.chartDate}>{d.date}</Text>
          ))}
        </View>
      </View>

      {/* ── Worker attendance list ─────────────────────────────────────────── */}
      <SectionLabel title={`WORKFORCE  ·  ${streaks.length} workers`} />
      <View style={styles.listCard}>
        {streaks.length === 0 ? (
          <Text style={styles.emptyText}>No workers enrolled yet.</Text>
        ) : (
          streaks.map((w, i) => (
            <View
              key={w.workerId}
              style={[styles.workerRow, i < streaks.length - 1 && styles.workerRowBorder]}
            >
              {/* Status dot */}
              <View style={[styles.statusDot, { backgroundColor: w.presentToday ? '#10b981' : '#ef4444' }]} />

              {/* Name + last seen */}
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

              {/* Streak badge */}
              <View style={[styles.streakBadge, w.streak > 0 ? styles.streakActive : styles.streakZero]}>
                <Text style={styles.streakIcon}>🔥</Text>
                <Text style={[styles.streakText, w.streak > 0 ? { color: '#f59e0b' } : { color: '#475569' }]}>
                  {w.streak}d
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Pull down to refresh  ·  Data from on-device SQLite</Text>
      </View>
    </ScrollView>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  container        : { flex: 1, backgroundColor: '#020817' },
  content          : { padding: 20, paddingBottom: 48 },
  loadingContainer : { flex: 1, backgroundColor: '#020817', alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText      : { color: '#475569', fontSize: 14 },
  orb1             : { position: 'absolute', top: 0, right: -60, width: 250, height: 250, borderRadius: 125, backgroundColor: '#1e40af', opacity: 0.07 },
  orb2             : { position: 'absolute', top: 380, left: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: '#6d28d9', opacity: 0.05 },

  dateRow          : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  dateLabel        : { fontSize: 15, color: '#94a3b8', fontWeight: '600' },
  liveBadge        : { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)' },
  liveDot          : { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  liveText         : { color: '#10b981', fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  sectionHeader    : { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 8 },
  sectionLine      : { flex: 1, height: 1, backgroundColor: '#1e293b' },
  sectionTitle     : { fontSize: 10, color: '#475569', fontWeight: '700', letterSpacing: 2 },

  summaryGrid      : { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  summaryCard      : { width: (width - 50) / 2, borderRadius: 16, padding: 16, borderWidth: 1, alignItems: 'center', gap: 4 },
  summaryIcon      : { fontSize: 22 },
  summaryValue     : { fontSize: 28, fontWeight: '800' },
  summaryLabel     : { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  chartCard        : { backgroundColor: '#0f172a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e293b', marginBottom: 8, overflow: 'hidden' },
  chart            : { borderRadius: 8, marginLeft: -8 },
  chartFooter      : { flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
  chartDate        : { fontSize: 9, color: '#334155', textAlign: 'center' },

  listCard         : { backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', marginBottom: 8, overflow: 'hidden' },
  emptyText        : { color: '#475569', textAlign: 'center', padding: 24, fontSize: 13 },
  workerRow        : { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  workerRowBorder  : { borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  statusDot        : { width: 10, height: 10, borderRadius: 5 },
  workerInfo       : { flex: 1, gap: 2 },
  workerName       : { fontSize: 14, fontWeight: '700', color: '#f1f5f9' },
  workerSub        : { fontSize: 12, color: '#475569' },
  streakBadge      : { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  streakActive     : { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.25)' },
  streakZero       : { backgroundColor: 'rgba(71,85,105,0.1)', borderColor: '#1e293b' },
  streakIcon       : { fontSize: 12 },
  streakText       : { fontSize: 12, fontWeight: '700' },

  footer           : { alignItems: 'center', marginTop: 12 },
  footerText       : { color: '#1e293b', fontSize: 11, letterSpacing: 0.5 },
});
