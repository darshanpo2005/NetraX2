import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getAttendanceRecords, AttendanceRecord } from '../services/DatabaseService';

type Filter = 'today' | 'week' | 'month' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'today', label: 'Today'      },
  { key: 'week',  label: 'This Week'  },
  { key: 'month', label: 'This Month' },
  { key: 'all',   label: 'All Time'   },
];

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function groupByDate(records: AttendanceRecord[]): { date: string; items: AttendanceRecord[] }[] {
  const map: Record<string, AttendanceRecord[]> = {};
  for (const r of records) {
    const d = formatDate(r.timestamp);
    if (!map[d]) map[d] = [];
    map[d].push(r);
  }
  return Object.entries(map).map(([date, items]) => ({ date, items }));
}

function workerTotals(records: AttendanceRecord[]): { name: string; employeeId: string; count: number }[] {
  const map: Record<string, { name: string; employeeId: string; count: number }> = {};
  for (const r of records) {
    if (!map[r.workerId]) map[r.workerId] = { name: r.workerName, employeeId: r.employeeId, count: 0 };
    map[r.workerId].count++;
  }
  return Object.values(map).sort((a, b) => b.count - a.count);
}

function buildCSV(records: AttendanceRecord[]): string {
  const header = 'Name,Employee ID,Date,Time,Location,Match %';
  const rows = records.map(r =>
    [
      `"${r.workerName}"`,
      `"${r.employeeId}"`,
      `"${formatDate(r.timestamp)}"`,
      `"${formatTime(r.timestamp)}"`,
      `"${r.location}"`,
      `"${(r.similarity * 100).toFixed(1)}%"`,
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

export default function AttendanceReportScreen() {
  const [filter, setFilter]     = useState<Filter>('today');
  const [records, setRecords]   = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      setRecords(await getAttendanceRecords(f));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(filter); }, [filter]));

  const handleFilterChange = (f: Filter) => {
    setFilter(f);
    load(f);
  };

  const handleExport = async () => {
    if (!records.length) { Alert.alert('No Data', 'No records to export.'); return; }
    setExporting(true);
    try {
      const csv     = buildCSV(records);
      const label   = FILTERS.find(f => f.key === filter)?.label.replace(' ', '_') ?? filter;
      const name    = `attendance_${label}_${Date.now()}.csv`;
      const fileUri = (FileSystem.documentDirectory ?? '') + name;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Attendance Report' });
    } catch (e: any) {
      Alert.alert('Export Failed', e.message);
    } finally {
      setExporting(false);
    }
  };

  const groups  = groupByDate(records);
  const totals  = workerTotals(records);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.orb1} /><View style={styles.orb2} />

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => handleFilterChange(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryCount}>{records.length}</Text>
        <Text style={styles.summaryLabel}>total records</Text>
        <TouchableOpacity
          style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
          onPress={handleExport}
          disabled={exporting}
          activeOpacity={0.8}
        >
          {exporting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.exportBtnText}>Export CSV</Text>
          }
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 60 }} />
      ) : records.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No attendance records</Text>
          <Text style={styles.emptySubText}>Records will appear here after face scans</Text>
        </View>
      ) : (
        <>
          {/* Per-worker totals */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionTitle}>BY WORKER</Text>
            <View style={styles.sectionLine} />
          </View>
          <View style={styles.totalsCard}>
            {totals.map((t, i) => (
              <View key={t.employeeId + i} style={[styles.totalRow, i < totals.length - 1 && styles.totalRowBorder]}>
                <View style={styles.totalLeft}>
                  <Text style={styles.totalName}>{t.name}</Text>
                  <Text style={styles.totalEmpId}>{t.employeeId || '—'}</Text>
                </View>
                <View style={styles.totalBadge}>
                  <Text style={styles.totalBadgeText}>{t.count}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Records grouped by date */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionTitle}>RECORDS</Text>
            <View style={styles.sectionLine} />
          </View>
          {groups.map(group => (
            <View key={group.date} style={styles.dateGroup}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateHeaderText}>{group.date}</Text>
                <Text style={styles.dateHeaderCount}>{group.items.length} scans</Text>
              </View>
              {group.items.map((r, i) => (
                <View key={r.id} style={[styles.recordRow, i < group.items.length - 1 && styles.recordRowBorder]}>
                  <View style={styles.recordLeft}>
                    <Text style={styles.recordName}>{r.workerName}</Text>
                    <Text style={styles.recordEmpId}>{r.employeeId || '—'}</Text>
                  </View>
                  <View style={styles.recordRight}>
                    <Text style={styles.recordTime}>{formatTime(r.timestamp)}</Text>
                    <Text style={styles.recordSim}>{(r.similarity * 100).toFixed(0)}%</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container       : { flex: 1, backgroundColor: '#020817' },
  content         : { padding: 16, paddingBottom: 48 },
  orb1            : { position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: '#1e40af', opacity: 0.07 },
  orb2            : { position: 'absolute', top: 400, left: -60, width: 180, height: 180, borderRadius: 90,  backgroundColor: '#6d28d9', opacity: 0.05 },

  filterRow       : { flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 14, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: '#1e293b' },
  filterTab       : { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  filterTabActive : { backgroundColor: '#1e40af' },
  filterTabText   : { fontSize: 12, fontWeight: '600', color: '#475569' },
  filterTabTextActive: { color: '#93c5fd' },

  summaryBar      : { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#1e293b', gap: 8 },
  summaryCount    : { fontSize: 28, fontWeight: '800', color: '#3b82f6' },
  summaryLabel    : { flex: 1, fontSize: 13, color: '#64748b', fontWeight: '500' },
  exportBtn       : { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, minWidth: 100, alignItems: 'center' },
  exportBtnText   : { color: '#fff', fontSize: 13, fontWeight: '700' },

  empty           : { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyIcon       : { fontSize: 52 },
  emptyText       : { color: '#94a3b8', fontSize: 18, fontWeight: '700' },
  emptySubText    : { color: '#475569', fontSize: 13 },

  sectionHeader   : { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 4 },
  sectionLine     : { flex: 1, height: 1, backgroundColor: '#1e293b' },
  sectionTitle    : { fontSize: 10, color: '#475569', fontWeight: '700', letterSpacing: 2 },

  totalsCard      : { backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', marginBottom: 24, overflow: 'hidden' },
  totalRow        : { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  totalRowBorder  : { borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  totalLeft       : { flex: 1 },
  totalName       : { color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
  totalEmpId      : { color: '#475569', fontSize: 12, marginTop: 1 },
  totalBadge      : { backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  totalBadgeText  : { color: '#60a5fa', fontSize: 15, fontWeight: '800' },

  dateGroup       : { marginBottom: 16 },
  dateHeader      : { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 2 },
  dateHeaderText  : { color: '#64748b', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  dateHeaderCount : { color: '#334155', fontSize: 11 },

  recordRow       : { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', padding: 12, gap: 12 },
  recordRowBorder : { borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  recordLeft      : { flex: 1 },
  recordName      : { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  recordEmpId     : { color: '#475569', fontSize: 12, marginTop: 1 },
  recordRight     : { alignItems: 'flex-end', gap: 2 },
  recordTime      : { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  recordSim       : { color: '#10b981', fontSize: 11, fontWeight: '700' },
});
