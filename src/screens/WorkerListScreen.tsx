import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, Image, TextInput, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getAllWorkers, getTodayPresentWorkerIds, deleteWorker, Worker } from '../services/DatabaseService';
import { COLORS, FONT_SIZE, FONT_WEIGHT, TRACKING, RADIUS, SPACING } from '../theme';
import Card from '../components/Card';
import Button from '../components/Button';

const ACCENTS = [COLORS.primary, COLORS.success, COLORS.warning, '#8B5CF6', '#06B6D4', '#EC4899'];
type FilterType = 'all' | 'present' | 'absent';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'present', label: 'Present Today' },
  { key: 'absent',  label: 'Absent Today' },
];

function FadeInRow({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-16)).current;
  useEffect(() => {
    const delay = Math.min(index, 8) * 45;
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 300, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      {children}
    </Animated.View>
  );
}

export default function WorkerListScreen({ navigation }: any) {
  const [workers, setWorkers]                 = useState<Worker[]>([]);
  const [todayPresentIds, setTodayPresentIds] = useState<Set<string>>(new Set());
  const [searchText, setSearchText]           = useState('');
  const [activeFilter, setActiveFilter]       = useState<FilterType>('all');

  useFocusEffect(useCallback(() => {
    Promise.all([getAllWorkers(), getTodayPresentWorkerIds()])
      .then(([ws, ids]) => { setWorkers(ws); setTodayPresentIds(ids); })
      .catch(() => { setWorkers([]); setTodayPresentIds(new Set()); });
  }, []));

  const filteredWorkers = useMemo(() => {
    let result = workers;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(w =>
        w.name.toLowerCase().includes(q) || w.employeeId.toLowerCase().includes(q)
      );
    }
    if (activeFilter === 'present') result = result.filter(w => todayPresentIds.has(w.id));
    else if (activeFilter === 'absent') result = result.filter(w => !todayPresentIds.has(w.id));
    return result;
  }, [workers, todayPresentIds, searchText, activeFilter]);

  const handleDelete = (worker: Worker) => {
    Alert.alert('Remove Worker', `Remove ${worker.name} from the system?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await deleteWorker(worker.id);
        setWorkers(w => w.filter(x => x.id !== worker.id));
      }},
    ]);
  };

  const getAccent = (name: string) => ACCENTS[name.charCodeAt(0) % ACCENTS.length];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* Header stats */}
      <Card style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{workers.length}</Text>
          <Text style={styles.statLbl}>Registered</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{todayPresentIds.size}</Text>
          <Text style={styles.statLbl}>Present Today</Text>
        </View>
        <View style={styles.statDivider} />
        <Button label="+ Add" onPress={() => navigation.navigate('Enroll')} variant="secondary" style={styles.addBtn} />
      </Card>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search workers by name or ID..."
          placeholderTextColor={COLORS.textSecondary}
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filtersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.countText}>{filteredWorkers.length}/{workers.length}</Text>
      </View>

      {workers.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconBg}>
            <Text style={styles.emptyIcon}>👥</Text>
          </View>
          <Text style={styles.emptyTitle}>No Workers Registered</Text>
          <Text style={styles.emptySub}>Register your first field worker to get started</Text>
          <Button label="Register First Worker" onPress={() => navigation.navigate('Enroll')} style={styles.emptyBtn} />
        </View>
      ) : filteredWorkers.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconBg}>
            <Text style={styles.emptyIcon}>🔍</Text>
          </View>
          <Text style={styles.emptyTitle}>No Workers Found</Text>
          <Text style={styles.emptySub}>Try a different search term or filter</Text>
        </View>
      ) : (
        <FlatList
          data={filteredWorkers}
          keyExtractor={w => w.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const accent = getAccent(item.name);
            const isPresent = todayPresentIds.has(item.id);
            return (
              <FadeInRow index={index}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('WorkerDetail', { worker: item })}
                  onLongPress={() => handleDelete(item)}
                  activeOpacity={0.75}
                >
                  <Card accentColor={accent} style={styles.card}>
                    {item.photoUri ? (
                      <Image source={{ uri: item.photoUri }} style={styles.photoAvatar} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
                        <Text style={[styles.avatarText, { color: accent }]}>{item.name[0].toUpperCase()}</Text>
                      </View>
                    )}

                    <View style={styles.cardInfo}>
                      <Text style={styles.workerName}>{item.name}</Text>
                      <View style={styles.idBadge}>
                        <Text style={styles.idText}>{item.employeeId}</Text>
                      </View>
                      <Text style={styles.enrollDate}>
                        Enrolled {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>

                    <View style={[styles.statusBadge, isPresent ? styles.statusBadgePresent : styles.statusBadgeAbsent]}>
                      <Text style={[styles.statusText, { color: isPresent ? COLORS.success : COLORS.textSecondary }]}>
                        {isPresent ? '● Present' : '○ Absent'}
                      </Text>
                    </View>
                  </Card>
                </TouchableOpacity>
              </FadeInRow>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: COLORS.background },

  statsBar    : { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.screen, marginTop: SPACING.screen, marginBottom: SPACING.card },
  statItem    : { flex: 1, alignItems: 'center' },
  statNum     : { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  statLbl     : { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  statDivider : { width: 1, height: 36, backgroundColor: COLORS.border, marginHorizontal: 8 },
  addBtn      : { flex: 1, width: undefined },

  searchContainer : {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.screen,
    marginBottom: SPACING.card,
    borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, height: 48,
  },
  searchIcon  : { fontSize: 14, marginRight: 10, color: COLORS.textSecondary },
  searchInput : { flex: 1, color: COLORS.textPrimary, fontSize: FONT_SIZE.sm },
  clearBtn    : { padding: 6 },
  clearBtnText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },

  filtersRow    : { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.screen, marginBottom: SPACING.card },
  filtersScroll : { gap: 8, flexGrow: 1 },
  filterChip    : { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive : { backgroundColor: COLORS.primaryGlow, borderColor: COLORS.primaryBorder },
  filterChipText   : { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: FONT_WEIGHT.semibold },
  filterChipTextActive: { color: COLORS.primary },
  countText  : { marginLeft: 10, fontSize: FONT_SIZE.xs, color: COLORS.textTertiary, fontWeight: FONT_WEIGHT.medium },

  empty       : { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyIconBg : { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  emptyIcon   : { fontSize: 40 },
  emptyTitle  : { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  emptySub    : { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center' },
  emptyBtn    : { width: '80%' },

  listContent : { paddingHorizontal: SPACING.screen, paddingBottom: 24, gap: SPACING.card },

  card       : { flexDirection: 'row', alignItems: 'center' },
  avatar     : { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  photoAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: COLORS.primary, marginRight: 14 },
  avatarText : { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  cardInfo   : { flex: 1, gap: 4 },
  workerName : { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textPrimary },
  idBadge    : { alignSelf: 'flex-start', backgroundColor: COLORS.surfaceElevated, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  idText     : { fontSize: FONT_SIZE.xs - 1, color: COLORS.textSecondary, fontWeight: FONT_WEIGHT.semibold, letterSpacing: TRACKING.label },
  enrollDate : { fontSize: FONT_SIZE.xs - 1, color: COLORS.textTertiary },

  statusBadge        : { position: 'absolute', top: 14, right: 14, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  statusBadgePresent : { backgroundColor: COLORS.successGlow, borderColor: COLORS.successBorder },
  statusBadgeAbsent  : { backgroundColor: 'rgba(100,116,139,0.1)', borderColor: COLORS.border },
  statusText         : { fontSize: 10, fontWeight: FONT_WEIGHT.bold },
});
