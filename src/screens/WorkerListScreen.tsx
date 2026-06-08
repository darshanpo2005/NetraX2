import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, Image, TextInput, Animated,
} from 'react-native';

function SlideCard({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-24)).current;
  useEffect(() => {
    const delay = Math.min(index, 7) * 60;
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 350, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      {children}
    </Animated.View>
  );
}
import { useFocusEffect } from '@react-navigation/native';
import { getAllWorkers, getTodayPresentWorkerIds, deleteWorker, Worker } from '../services/DatabaseService';

const COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899'];
type FilterType = 'all' | 'present' | 'absent';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'present', label: 'Present Today' },
  { key: 'absent',  label: 'Absent Today' },
];

export default function WorkerListScreen({ navigation }: any) {
  const [workers, setWorkers]               = useState<Worker[]>([]);
  const [todayPresentIds, setTodayPresentIds] = useState<Set<string>>(new Set());
  const [searchText, setSearchText]         = useState('');
  const [activeFilter, setActiveFilter]     = useState<FilterType>('all');

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

  const getColor = (name: string) => COLORS[name.charCodeAt(0) % COLORS.length];

  return (
    <View style={styles.container}>
      <View style={styles.orb} />

      {/* Header stats */}
      <View style={styles.statsBar}>
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
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('Enroll')}>
          <Text style={styles.addBtnText}>+ Add Worker</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search workers by name or ID..."
          placeholderTextColor="#475569"
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

      {/* Filter chips + count */}
      <View style={styles.filtersRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.countText}>
          {filteredWorkers.length}/{workers.length}
        </Text>
      </View>

      {workers.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconBg}>
            <Text style={styles.emptyIcon}>👥</Text>
          </View>
          <Text style={styles.emptyTitle}>No Workers Registered</Text>
          <Text style={styles.emptySub}>Register your first field worker to get started</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Enroll')}>
            <Text style={styles.emptyBtnText}>Register First Worker</Text>
          </TouchableOpacity>
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
          contentContainerStyle={{ padding: 16, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const color = getColor(item.name);
            const isPresent = todayPresentIds.has(item.id);
            return (
              <SlideCard index={index}>
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('WorkerDetail', { worker: item })}
                activeOpacity={0.75}
              >
                <View style={[styles.cardAccent, { backgroundColor: color }]} />

                {item.photoUri ? (
                  <Image source={{ uri: item.photoUri }} style={styles.photoAvatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: `${color}20`, borderColor: `${color}40` }]}>
                    <Text style={[styles.avatarText, { color }]}>{item.name[0].toUpperCase()}</Text>
                  </View>
                )}

                <View style={styles.cardInfo}>
                  <Text style={styles.workerName}>{item.name}</Text>
                  <View style={styles.idRow}>
                    <View style={styles.idBadge}>
                      <Text style={styles.idText}>{item.employeeId}</Text>
                    </View>
                    {isPresent ? (
                      <View style={styles.presentBadge}>
                        <Text style={styles.presentText}>● Present</Text>
                      </View>
                    ) : (
                      <View style={styles.absentBadge}>
                        <Text style={styles.absentText}>○ Absent</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.enrollDate}>
                    Enrolled {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>

                <View style={styles.cardActions}>
                  <View style={styles.indexBadge}>
                    <Text style={styles.indexText}>#{index + 1}</Text>
                  </View>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
              </SlideCard>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container         : { flex: 1, backgroundColor: '#020817' },
  orb               : { position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: '#6d28d9', opacity: 0.08 },
  statsBar          : { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', margin: 16, marginBottom: 10, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e293b' },
  statItem          : { flex: 1, alignItems: 'center' },
  statNum           : { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  statLbl           : { fontSize: 11, color: '#475569', marginTop: 2 },
  statDivider       : { width: 1, height: 40, backgroundColor: '#1e293b' },
  addBtn            : { flex: 1, alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  addBtnText        : { color: '#60a5fa', fontSize: 13, fontWeight: '700' },
  searchContainer   : { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', marginHorizontal: 16, marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: '#1e293b', paddingHorizontal: 14, height: 46 },
  searchIcon        : { fontSize: 14, marginRight: 8 },
  searchInput       : { flex: 1, color: '#f1f5f9', fontSize: 14 },
  clearBtn          : { padding: 6 },
  clearBtnText      : { color: '#475569', fontSize: 13, fontWeight: '700' },
  filtersRow        : { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 4, gap: 8 },
  filterChip        : { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b' },
  filterChipActive  : { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3b82f6' },
  filterChipText    : { fontSize: 12, color: '#475569', fontWeight: '600' },
  filterChipTextActive: { color: '#60a5fa' },
  countText         : { marginLeft: 'auto', fontSize: 11, color: '#334155', fontWeight: '600' },
  empty             : { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyIconBg       : { width: 96, height: 96, borderRadius: 48, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  emptyIcon         : { fontSize: 40 },
  emptyTitle        : { fontSize: 20, fontWeight: '700', color: '#94a3b8' },
  emptySub          : { fontSize: 13, color: '#475569', textAlign: 'center' },
  emptyBtn          : { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText      : { color: '#fff', fontWeight: '700', fontSize: 14 },
  card              : { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden' },
  cardAccent        : { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  avatar            : { width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 14, marginLeft: 8 },
  photoAvatar       : { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#3b82f6', marginRight: 14, marginLeft: 8 },
  avatarText        : { fontSize: 20, fontWeight: '800' },
  cardInfo          : { flex: 1, gap: 4 },
  workerName        : { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  idRow             : { flexDirection: 'row', gap: 6, alignItems: 'center' },
  idBadge           : { backgroundColor: '#1e293b', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  idText            : { fontSize: 11, color: '#64748b', fontWeight: '600', letterSpacing: 0.5 },
  presentBadge      : { backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  presentText       : { fontSize: 10, color: '#10b981', fontWeight: '700' },
  absentBadge       : { backgroundColor: 'rgba(100,116,139,0.1)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(100,116,139,0.25)' },
  absentText        : { fontSize: 10, color: '#64748b', fontWeight: '600' },
  enrollDate        : { fontSize: 11, color: '#334155' },
  cardActions       : { alignItems: 'flex-end', gap: 10 },
  indexBadge        : { backgroundColor: '#1e293b', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  indexText         : { color: '#475569', fontSize: 10, fontWeight: '600' },
  deleteBtn         : { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText     : { fontSize: 14 },
});
