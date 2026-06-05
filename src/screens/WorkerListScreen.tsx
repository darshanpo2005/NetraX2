import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllWorkers, deleteWorker, Worker } from '../services/DatabaseService';

const COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899'];

export default function WorkerListScreen({ navigation }: any) {
  const [workers, setWorkers] = useState<Worker[]>([]);

  useFocusEffect(useCallback(() => {
    getAllWorkers().then(setWorkers);
  }, []));

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
          <Text style={styles.statNum}>{workers.filter(w => Date.now() - w.createdAt < 86400000).length}</Text>
          <Text style={styles.statLbl}>Added Today</Text>
        </View>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('Enroll')}>
          <Text style={styles.addBtnText}>+ Add Worker</Text>
        </TouchableOpacity>
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
      ) : (
        <FlatList
          data={workers}
          keyExtractor={w => w.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const color = getColor(item.name);
            return (
              <View style={styles.card}>
                {/* Left accent */}
                <View style={[styles.cardAccent, { backgroundColor: color }]} />

                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: `${color}20`, borderColor: `${color}40` }]}>
                  <Text style={[styles.avatarText, { color }]}>{item.name[0].toUpperCase()}</Text>
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                  <Text style={styles.workerName}>{item.name}</Text>
                  <View style={styles.idRow}>
                    <View style={styles.idBadge}>
                      <Text style={styles.idText}>{item.employeeId}</Text>
                    </View>
                  </View>
                  <Text style={styles.enrollDate}>
                    Enrolled {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                  <View style={styles.indexBadge}>
                    <Text style={styles.indexText}>#{index + 1}</Text>
                  </View>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container    : { flex: 1, backgroundColor: '#020817' },
  orb          : { position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: '#6d28d9', opacity: 0.08 },
  statsBar     : { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', margin: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e293b' },
  statItem     : { flex: 1, alignItems: 'center' },
  statNum      : { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  statLbl      : { fontSize: 11, color: '#475569', marginTop: 2 },
  statDivider  : { width: 1, height: 40, backgroundColor: '#1e293b' },
  addBtn       : { flex: 1, alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  addBtnText   : { color: '#60a5fa', fontSize: 13, fontWeight: '700' },
  empty        : { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyIconBg  : { width: 96, height: 96, borderRadius: 48, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  emptyIcon    : { fontSize: 40 },
  emptyTitle   : { fontSize: 20, fontWeight: '700', color: '#94a3b8' },
  emptySub     : { fontSize: 13, color: '#475569', textAlign: 'center' },
  emptyBtn     : { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText : { color: '#fff', fontWeight: '700', fontSize: 14 },
  card         : { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden' },
  cardAccent   : { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2 },
  avatar       : { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 14, marginLeft: 8 },
  avatarText   : { fontSize: 20, fontWeight: '800' },
  cardInfo     : { flex: 1, gap: 4 },
  workerName   : { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  idRow        : { flexDirection: 'row' },
  idBadge      : { backgroundColor: '#1e293b', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  idText       : { fontSize: 11, color: '#64748b', fontWeight: '600', letterSpacing: 0.5 },
  enrollDate   : { fontSize: 11, color: '#334155' },
  cardActions  : { alignItems: 'flex-end', gap: 10 },
  indexBadge   : { backgroundColor: '#1e293b', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  indexText    : { color: '#475569', fontSize: 10, fontWeight: '600' },
  deleteBtn    : { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 14 },
});
