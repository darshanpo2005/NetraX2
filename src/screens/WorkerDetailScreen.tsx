import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, Alert,
} from 'react-native';
import {
  Worker, AttendanceLog, deleteWorker,
  getWorkerAttendanceHistory, getWorkerStats, WorkerStats,
} from '../services/DatabaseService';
import { COLORS, FONT_SIZE, FONT_WEIGHT, TRACKING, SPACING } from '../theme';
import Card from '../components/Card';
import Button from '../components/Button';
import SectionLabel from '../components/SectionLabel';

const ACCENTS = [COLORS.primary, COLORS.success, COLORS.warning, '#8B5CF6', '#06B6D4', '#EC4899'];

type MonthGroup = { title: string; entries: AttendanceLog[] };

function groupByMonth(logs: AttendanceLog[]): MonthGroup[] {
  const map = new Map<string, AttendanceLog[]>();
  for (const log of logs) {
    const key = new Date(log.timestamp).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const arr = map.get(key) ?? [];
    arr.push(log);
    map.set(key, arr);
  }
  return Array.from(map.entries()).map(([title, entries]) => ({ title, entries }));
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <Card accentColor={color} style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

export default function WorkerDetailScreen({ route, navigation }: any) {
  const worker: Worker = route.params.worker;
  const [stats, setStats]     = useState<WorkerStats | null>(null);
  const [history, setHistory] = useState<AttendanceLog[]>([]);

  useEffect(() => {
    Promise.all([getWorkerStats(worker.id), getWorkerAttendanceHistory(worker.id)])
      .then(([s, h]) => { setStats(s); setHistory(h); })
      .catch(console.error);
  }, [worker.id]);

  const handleDelete = () => {
    Alert.alert(
      'Remove Worker',
      `Permanently remove ${worker.name} from the system? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          await deleteWorker(worker.id);
          navigation.goBack();
        }},
      ]
    );
  };

  const accent = ACCENTS[worker.name.charCodeAt(0) % ACCENTS.length];
  const groups = groupByMonth(history);

  const lastSeenStr = stats?.lastSeen
    ? new Date(stats.lastSeen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      + '  ·  '
      + new Date(stats.lastSeen).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Profile header */}
      <View style={styles.profileSection}>
        {worker.photoUri ? (
          <Image source={{ uri: worker.photoUri }} style={[styles.photo, { borderColor: accent }]} />
        ) : (
          <View style={[styles.avatarLarge, { backgroundColor: `${accent}18`, borderColor: `${accent}60` }]}>
            <Text style={[styles.avatarInitial, { color: accent }]}>{worker.name[0].toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.workerName}>{worker.name}</Text>
        <View style={styles.idBadge}>
          <Text style={styles.idText}>{worker.employeeId}</Text>
        </View>
        <Text style={styles.enrollText}>
          Enrolled {new Date(worker.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatBox label="Total"      value={stats?.total     ?? '—'}          color={COLORS.primary} />
        <StatBox label="This Week"  value={stats?.thisWeek  ?? '—'}          color={COLORS.success} />
        <StatBox label="This Month" value={stats?.thisMonth ?? '—'}          color="#8B5CF6" />
        <StatBox label="Streak"     value={stats ? `${stats.streak}d` : '—'} color={COLORS.warning} />
      </View>

      {/* Last seen */}
      <Card style={styles.lastSeenCard}>
        <Text style={styles.lastSeenLabel}>LAST ATTENDANCE</Text>
        <Text style={styles.lastSeenValue}>{lastSeenStr}</Text>
      </Card>

      {/* Attendance history */}
      <View style={styles.historySection}>
        <SectionLabel title="ATTENDANCE HISTORY" />

        {history.length === 0 ? (
          <Card style={styles.noHistory}>
            <Text style={styles.noHistoryIcon}>📋</Text>
            <Text style={styles.noHistoryText}>No attendance records yet</Text>
          </Card>
        ) : (
          groups.map(group => (
            <Card key={group.title} noPadding style={styles.monthGroup}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthTitle}>{group.title}</Text>
                <Text style={styles.monthCount}>{group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}</Text>
              </View>
              {group.entries.map((entry, i) => {
                const d    = new Date(entry.timestamp);
                const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                const day  = d.toLocaleDateString('en-IN', { weekday: 'short' });
                const isLast = i === group.entries.length - 1;
                return (
                  <View key={entry.id} style={[styles.entryRow, isLast && styles.entryRowLast]}>
                    <View style={styles.entryDot} />
                    <View style={styles.entryInfo}>
                      <Text style={styles.entryDate}>{day}, {date}</Text>
                      <Text style={styles.entryTime}>{time}</Text>
                    </View>
                    <View style={styles.entryRight}>
                      <Text style={styles.confidenceVal}>{Math.round(entry.similarity * 100)}%</Text>
                      <Text style={styles.confidenceLbl}>match</Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          ))
        )}
      </View>

      <Button label="Remove Worker" onPress={handleDelete} variant="destructive" style={styles.deleteBtn} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: COLORS.background },
  content   : { paddingHorizontal: SPACING.screen, paddingBottom: 48 },

  profileSection : { alignItems: 'center', paddingTop: 36, paddingBottom: SPACING.section, gap: 10 },
  photo          : { width: 112, height: 112, borderRadius: 56, borderWidth: 3 },
  avatarLarge    : { width: 112, height: 112, borderRadius: 56, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  avatarInitial  : { fontSize: 48, fontWeight: FONT_WEIGHT.bold },
  workerName     : { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary, letterSpacing: TRACKING.label },
  idBadge        : { backgroundColor: COLORS.surfaceElevated, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.border },
  idText         : { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, letterSpacing: TRACKING.label },
  enrollText     : { color: COLORS.textTertiary, fontSize: FONT_SIZE.xs },

  statsGrid  : { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.card, marginBottom: SPACING.card },
  statCard   : { width: '47%', alignItems: 'flex-start' },
  statValue  : { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold },
  statLabel  : { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, letterSpacing: TRACKING.label, textTransform: 'uppercase', marginTop: 4 },

  lastSeenCard  : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.section },
  lastSeenLabel : { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: FONT_WEIGHT.semibold, letterSpacing: TRACKING.label },
  lastSeenValue : { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, fontWeight: FONT_WEIGHT.semibold },

  historySection : { marginBottom: 8 },
  noHistory      : { alignItems: 'center', gap: 10, paddingVertical: 30 },
  noHistoryIcon  : { fontSize: 30 },
  noHistoryText  : { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },

  monthGroup  : { marginBottom: SPACING.card },
  monthHeader : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.inner, paddingVertical: 10, backgroundColor: COLORS.surfaceElevated, borderBottomWidth: 1, borderColor: COLORS.border },
  monthTitle  : { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary, letterSpacing: TRACKING.label },
  monthCount  : { fontSize: FONT_SIZE.xs - 1, color: COLORS.textTertiary, fontWeight: FONT_WEIGHT.semibold },

  entryRow     : { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: SPACING.inner, borderBottomWidth: 1, borderColor: COLORS.border },
  entryRowLast : { borderBottomWidth: 0 },
  entryDot     : { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginRight: 12 },
  entryInfo    : { flex: 1 },
  entryDate    : { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textPrimary },
  entryTime    : { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  entryRight   : { alignItems: 'flex-end' },
  confidenceVal: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: COLORS.success },
  confidenceLbl: { fontSize: FONT_SIZE.xs - 1, color: COLORS.textTertiary, marginTop: 1 },

  deleteBtn : { marginTop: SPACING.card },
});
