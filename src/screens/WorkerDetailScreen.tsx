import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Image,
} from 'react-native';
import {
  Worker, AttendanceLog, deleteWorker,
  getWorkerAttendanceHistory, getWorkerStats, WorkerStats,
} from '../services/DatabaseService';

const COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899'];

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

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderColor: `${color}30` }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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

  const color = COLORS[worker.name.charCodeAt(0) % COLORS.length];
  const groups = groupByMonth(history);

  const lastSeenStr = stats?.lastSeen
    ? new Date(stats.lastSeen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      + '  ·  '
      + new Date(stats.lastSeen).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.orb1, { backgroundColor: color }]} />
      <View style={styles.orb2} />

      {/* Profile header */}
      <View style={styles.profileSection}>
        {worker.photoUri ? (
          <Image source={{ uri: worker.photoUri }} style={[styles.photo, { borderColor: color }]} />
        ) : (
          <View style={[styles.avatarLarge, { backgroundColor: `${color}18`, borderColor: `${color}60` }]}>
            <Text style={[styles.avatarInitial, { color }]}>{worker.name[0].toUpperCase()}</Text>
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
        <StatCard label="Total"      value={stats?.total     ?? '—'}                        icon="📊" color="#3b82f6" />
        <StatCard label="This Week"  value={stats?.thisWeek  ?? '—'}                        icon="📅" color="#10b981" />
        <StatCard label="This Month" value={stats?.thisMonth ?? '—'}                        icon="🗓" color="#8b5cf6" />
        <StatCard label="Streak"     value={stats ? `${stats.streak}d` : '—'}               icon="🔥" color="#f59e0b" />
      </View>

      {/* Last seen */}
      <View style={styles.lastSeenCard}>
        <Text style={styles.lastSeenLabel}>Last Attendance</Text>
        <Text style={styles.lastSeenValue}>{lastSeenStr}</Text>
      </View>

      {/* Attendance history */}
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Attendance History</Text>

        {history.length === 0 ? (
          <View style={styles.noHistory}>
            <Text style={styles.noHistoryIcon}>📋</Text>
            <Text style={styles.noHistoryText}>No attendance records yet</Text>
          </View>
        ) : (
          groups.map(group => (
            <View key={group.title} style={styles.monthGroup}>
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
            </View>
          ))
        )}
      </View>

      {/* Delete */}
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteBtnText}>🗑  Remove Worker</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container        : { flex: 1, backgroundColor: '#020817' },
  content          : { paddingBottom: 48 },
  orb1             : { position: 'absolute', top: -80, left: -80, width: 280, height: 280, borderRadius: 140, opacity: 0.07 },
  orb2             : { position: 'absolute', top: 240, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: '#6d28d9', opacity: 0.06 },

  profileSection   : { alignItems: 'center', paddingTop: 36, paddingBottom: 28, paddingHorizontal: 24, gap: 10 },
  photo            : { width: 120, height: 120, borderRadius: 60, borderWidth: 3 },
  avatarLarge      : { width: 120, height: 120, borderRadius: 60, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  avatarInitial    : { fontSize: 52, fontWeight: '800' },
  workerName       : { fontSize: 26, fontWeight: '800', color: '#f8fafc', letterSpacing: 0.5 },
  idBadge          : { backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: '#334155' },
  idText           : { color: '#64748b', fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  enrollText       : { color: '#475569', fontSize: 12 },

  statsGrid        : { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  statCard         : { flex: 1, minWidth: '44%', backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, padding: 16, alignItems: 'center', gap: 4 },
  statIcon         : { fontSize: 24, marginBottom: 2 },
  statValue        : { fontSize: 28, fontWeight: '800' },
  statLabel        : { fontSize: 10, color: '#475569', letterSpacing: 0.5, textTransform: 'uppercase' },

  lastSeenCard     : { marginHorizontal: 16, marginBottom: 20, backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastSeenLabel    : { fontSize: 11, color: '#475569', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  lastSeenValue    : { fontSize: 13, color: '#94a3b8', fontWeight: '600' },

  historySection   : { marginHorizontal: 16, marginBottom: 8 },
  sectionTitle     : { fontSize: 14, fontWeight: '700', color: '#64748b', marginBottom: 14, letterSpacing: 1, textTransform: 'uppercase' },
  noHistory        : { backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', padding: 40, alignItems: 'center', gap: 10 },
  noHistoryIcon    : { fontSize: 32 },
  noHistoryText    : { color: '#475569', fontSize: 14 },

  monthGroup       : { marginBottom: 16, backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden' },
  monthHeader      : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#0d1929', borderBottomWidth: 1, borderColor: '#1e293b' },
  monthTitle       : { fontSize: 13, fontWeight: '700', color: '#60a5fa', letterSpacing: 0.5 },
  monthCount       : { fontSize: 11, color: '#334155', fontWeight: '600' },

  entryRow         : { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#1e293b' },
  entryRowLast     : { borderBottomWidth: 0 },
  entryDot         : { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6', marginRight: 12 },
  entryInfo        : { flex: 1 },
  entryDate        : { fontSize: 14, fontWeight: '600', color: '#e2e8f0' },
  entryTime        : { fontSize: 12, color: '#64748b', marginTop: 2 },
  entryRight       : { alignItems: 'flex-end' },
  confidenceVal    : { fontSize: 13, fontWeight: '700', color: '#10b981' },
  confidenceLbl    : { fontSize: 10, color: '#334155', marginTop: 1 },

  deleteBtn        : { marginHorizontal: 16, marginTop: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', padding: 16, alignItems: 'center' },
  deleteBtnText    : { color: '#ef4444', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
});
