import NetInfo from '@react-native-community/netinfo';
import { createClient } from '@supabase/supabase-js';
import {
  getUnsyncedAttendanceRecords, markAsSynced, purgeSyncedLogs, getAllWorkers,
} from './DatabaseService';

const supabase = createClient(
  'https://vkejrmyxldzaqtrtjjvm.supabase.co',
  'sb_publishable_k8mE7dlqtjNeHtIuicZnBg_NC-lQceH'
);

const DEVICE_ID = 'android-netrax-001';

export const isSyncConfigured = true;

export const isOnline = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable);
};

/** Best-effort backup of enrolled workers (no face embeddings — privacy). */
const syncWorkersBackup = async () => {
  try {
    const workers = await getAllWorkers();
    if (!workers.length) return;

    const rows = workers.map(w => ({
      id: w.id,
      name: w.name,
      employee_id: w.employeeId,
      enrolled_at: typeof w.createdAt === 'string'
        ? new Date(w.createdAt).getTime()
        : Number(w.createdAt),
      device_id: DEVICE_ID,
    }));

    await supabase.from('workers_backup').upsert(rows, { onConflict: 'id' });
  } catch {
    // Non-critical — attendance sync already succeeded, don't fail the whole operation
  }
};

export const syncAndPurge = async (): Promise<{
  success: boolean; synced: number; purged: number; error: string | null; message: string;
}> => {
  try {
    const online = await isOnline();
    if (!online) {
      return { success: false, synced: 0, purged: 0, error: 'No internet connection', message: 'No internet connection' };
    }

    const logs = await getUnsyncedAttendanceRecords();

    if (logs.length) {
      const rows = logs.map(l => {
        const d = new Date(l.timestamp);
        return {
          id: l.id,
          worker_id: l.workerId,
          worker_name: l.workerName,
          employee_id: l.employeeId,
          timestamp: typeof l.timestamp === 'string'
            ? new Date(l.timestamp).getTime()
            : Number(l.timestamp),
          date: d.toISOString().slice(0, 10),
          time: d.toISOString().slice(11, 19),
          similarity: l.similarity,
          device_id: DEVICE_ID,
        };
      });

      const { error } = await supabase.from('attendance_logs').upsert(rows, { onConflict: 'id' });
      if (error) {
        return { success: false, synced: 0, purged: 0, error: error.message, message: error.message };
      }

      await markAsSynced(logs.map(l => l.id));
    }

    await syncWorkersBackup();
    const purged = await purgeSyncedLogs(30);

    return {
      success: true,
      synced: logs.length,
      purged,
      error: null,
      message: `Synced ${logs.length} attendance records to Supabase cloud`,
    };
  } catch (e: any) {
    return { success: false, synced: 0, purged: 0, error: e.message, message: e.message };
  }
};
