import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  formatDateKey,
  getAttendanceSummaryForDate,
  markWorkerAbsent,
  type AttendanceSummary,
  type AbsentWorker,
  type PresentWorker,
  type AbsenceRecord,
} from '../services/DatabaseService';
import { COLORS, FONT_SIZE, FONT_WEIGHT, TRACKING, RADIUS, SPACING } from '../theme';
import Card from '../components/Card';
import SectionLabel from '../components/SectionLabel';

const REASONS = ['No Show', 'On Leave', 'Medical', 'Other'];

function initials(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? '?';
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function Avatar({ photoUri, name, color }: { photoUri: string | null; name: string; color: string }) {
  return photoUri ? (
    <Image source={{ uri: photoUri }} style={[styles.avatar, { borderColor: color }]} />
  ) : (
    <View style={[styles.avatar, styles.avatarFallback, { borderColor: color, backgroundColor: `${color}18` }]}>
      <Text style={[styles.avatarText, { color }]}>{initials(name)}</Text>
    </View>
  );
}

export default function AbsenteeScreen({ navigation }: any) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [summary, setSummary] = useState<AttendanceSummary>({ present: [], absent: [], manuallyMarked: [] });
  const [loading, setLoading] = useState(true);
  const [sheetWorker, setSheetWorker] = useState<AbsentWorker | null>(null);
  const [marking, setMarking] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (d: Date) => {
    setLoading(true);
    try {
      const s = await getAttendanceSummaryForDate(formatDateKey(d));
      setSummary(s);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  useFocusEffect(useCallback(() => { load(selectedDateRef.current); }, [load]));

  const changeDay = (delta: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + delta);
    setSelectedDate(next);
    load(next);
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    load(today);
  };

  const isToday = formatDateKey(selectedDate) === formatDateKey(new Date());
  const dateLabel = isToday
    ? 'Today'
    : selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

  const total = summary.present.length + summary.absent.length + summary.manuallyMarked.length;

  const handleMarkAbsent = async (reason: string) => {
    if (!sheetWorker) return;
    setMarking(true);
    try {
      await markWorkerAbsent(sheetWorker.id, formatDateKey(selectedDate), reason, 'admin');
      setSheetWorker(null);
      await load(selectedDate);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setMarking(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const header = 'Name,Employee ID,Status,Time/Reason';
      const presentLines = summary.present.map(w =>
        [`"${w.name}"`, `"${w.employeeId}"`, '"Present"', `"${fmtTime(w.checkInTime)}"`].join(',')
      );
      const markedLines = summary.manuallyMarked.map(m =>
        [`"${m.workerName}"`, `"${m.employeeId}"`, '"Absent"', `"${m.reason}"`].join(',')
      );
      const absentLines = summary.absent.map(w =>
        [`"${w.name}"`, `"${w.employeeId}"`, '"Absent"', '"Not marked"'].join(',')
      );
      const csv = [header, ...presentLines, ...markedLines, ...absentLines].join('\n');

      const uri = (FileSystem.documentDirectory ?? '') + `netrax_attendance_${formatDateKey(selectedDate)}.csv`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export Daily Report' });
      } else {
        Alert.alert('Saved', 'Report saved to documents.');
      }
    } catch (e: any) {
      Alert.alert('Export Failed', e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialIcons name="chevron-left" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance Overview</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Date navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.dateArrowBtn} onPress={() => changeDay(-1)} activeOpacity={0.7}>
          <MaterialIcons name="chevron-left" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={goToToday} activeOpacity={0.7} style={styles.dateLabelWrap}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          {!isToday && <Text style={styles.todayLink}>Jump to Today</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.dateArrowBtn} onPress={() => changeDay(1)} activeOpacity={0.7}>
          <MaterialIcons name="chevron-right" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loadingSpinner} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Summary bar */}
          <Card style={styles.summaryBar}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: COLORS.success }]}>{summary.present.length}</Text>
              <Text style={styles.summaryLbl}>Present</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: COLORS.error }]}>{summary.absent.length + summary.manuallyMarked.length}</Text>
              <Text style={styles.summaryLbl}>Absent</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{total}</Text>
              <Text style={styles.summaryLbl}>Total</Text>
            </View>
          </Card>

          {/* Present */}
          <SectionLabel title="Present ✅" />
          {summary.present.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>No check-ins yet</Text>
            </Card>
          ) : (
            <View style={styles.list}>
              {summary.present.map((w: PresentWorker) => (
                <Card key={w.id} accentColor={COLORS.success} style={styles.workerCard}>
                  <Avatar photoUri={w.photoUri} name={w.name} color={COLORS.success} />
                  <View style={styles.workerInfo}>
                    <Text style={styles.workerName}>{w.name}</Text>
                    <Text style={styles.workerSub}>{w.employeeId}</Text>
                  </View>
                  <View style={styles.checkInBadge}>
                    <MaterialIcons name="check-circle" size={14} color={COLORS.success} />
                    <Text style={styles.checkInText}>{fmtTime(w.checkInTime)}</Text>
                  </View>
                </Card>
              ))}
            </View>
          )}

          {/* Absent */}
          <SectionLabel title="Absent ❌" />
          {summary.absent.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>Everyone is accounted for</Text>
            </Card>
          ) : (
            <View style={styles.list}>
              {summary.absent.map((w: AbsentWorker) => (
                <Card key={w.id} accentColor={COLORS.error} style={styles.workerCard}>
                  <Avatar photoUri={w.photoUri} name={w.name} color={COLORS.error} />
                  <View style={styles.workerInfo}>
                    <Text style={styles.workerName}>{w.name}</Text>
                    <Text style={styles.workerSub}>{w.employeeId}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.markBtn}
                    onPress={() => setSheetWorker(w)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.markBtnText}>Mark Absent</Text>
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          )}

          {/* Manually marked */}
          {summary.manuallyMarked.length > 0 && (
            <>
              <SectionLabel title="Manually Marked" />
              <View style={styles.list}>
                {summary.manuallyMarked.map((m: AbsenceRecord) => (
                  <Card key={m.id} accentColor={COLORS.warning} style={styles.workerCard}>
                    <Avatar photoUri={null} name={m.workerName} color={COLORS.warning} />
                    <View style={styles.workerInfo}>
                      <Text style={styles.workerName}>{m.workerName}</Text>
                      <Text style={styles.workerSub}>{m.employeeId}</Text>
                    </View>
                    <View style={styles.reasonBadge}>
                      <Text style={styles.reasonText}>{m.reason}</Text>
                    </View>
                  </Card>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity style={styles.exportBtn} onPress={handleExport} disabled={exporting} activeOpacity={0.85}>
            {exporting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <MaterialIcons name="file-download" size={18} color={COLORS.white} />
                <Text style={styles.exportBtnText}>Export Daily Report</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.scrollEnd} />
        </ScrollView>
      )}

      {/* Mark Absent bottom sheet */}
      <Modal
        visible={!!sheetWorker}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetWorker(null)}
      >
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setSheetWorker(null)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Mark {sheetWorker?.name} Absent</Text>
            <Text style={styles.sheetSub}>Select a reason</Text>

            {REASONS.map(reason => (
              <TouchableOpacity
                key={reason}
                style={styles.reasonRow}
                onPress={() => handleMarkAbsent(reason)}
                disabled={marking}
                activeOpacity={0.75}
              >
                <Text style={styles.reasonRowText}>{reason}</Text>
                <MaterialIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.sheetCancel} onPress={() => setSheetWorker(null)} activeOpacity={0.75}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.screen, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },

  dateNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.screen, paddingVertical: 12,
  },
  dateArrowBtn: {
    width: 36, height: 36, borderRadius: RADIUS.buttonSm, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  dateLabelWrap: { alignItems: 'center', gap: 2 },
  dateLabel: { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  todayLink: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: FONT_WEIGHT.semibold },

  loadingSpinner: { flex: 1 },
  content: { paddingHorizontal: SPACING.screen, paddingBottom: 40 },

  summaryBar: { flexDirection: 'row', marginBottom: SPACING.section },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  summaryLbl: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2, fontWeight: FONT_WEIGHT.semibold, textTransform: 'uppercase', letterSpacing: TRACKING.label },
  summaryDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  emptyCard: { alignItems: 'center', paddingVertical: 22, marginBottom: SPACING.section },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },

  list: { gap: SPACING.card, marginBottom: SPACING.section },
  workerCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold },
  workerInfo: { flex: 1, gap: 2 },
  workerName: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textPrimary },
  workerSub: { fontSize: FONT_SIZE.xs, color: COLORS.textTertiary },

  checkInBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.successGlow, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.successBorder },
  checkInText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: COLORS.success },

  markBtn: { backgroundColor: COLORS.errorGlow, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.errorBorder },
  markBtnText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: COLORS.error },

  reasonBadge: { backgroundColor: COLORS.warningGlow, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.warningBorder },
  reasonText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: COLORS.warning },

  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.button, height: 52,
  },
  exportBtnText: { color: COLORS.white, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold },
  scrollEnd: { height: 20 },

  // Bottom sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.card, borderTopRightRadius: RADIUS.card,
    paddingHorizontal: SPACING.screen, paddingTop: 12, paddingBottom: 32,
    borderTopWidth: 1, borderColor: COLORS.border, gap: 4,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  sheetSub: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginBottom: 8 },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  reasonRowText: { fontSize: FONT_SIZE.base, color: COLORS.textPrimary, fontWeight: FONT_WEIGHT.medium },
  sheetCancel: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
  sheetCancelText: { fontSize: FONT_SIZE.base, color: COLORS.textSecondary, fontWeight: FONT_WEIGHT.semibold },
});
