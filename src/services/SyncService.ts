import NetInfo from '@react-native-community/netinfo';
import { getUnsyncedLogs, markAsSynced, purgeSyncedLogs } from './DatabaseService';

const AWS_ENDPOINT = 'https://your-api-gateway-url.amazonaws.com/prod';

export const isOnline = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable);
};

export const syncAndPurge = async (): Promise<{
  success: boolean; synced: number; purged: number; error: string | null;
}> => {
  try {
    const logs = await getUnsyncedLogs();
    if (!logs.length) return { success: true, synced: 0, purged: 0, error: null };

    const online = await isOnline();
    if (!online) return { success: false, synced: 0, purged: 0, error: 'No internet connection' };

    const response = await fetch(`${AWS_ENDPOINT}/attendance`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ records: logs, device_time: Date.now() }),
    });

    if (response.ok) {
      await markAsSynced(logs.map(l => l.id));
      await purgeSyncedLogs();
      return { success: true, synced: logs.length, purged: logs.length, error: null };
    }
    return { success: false, synced: 0, purged: 0, error: `HTTP ${response.status}` };
  } catch (e: any) {
    return { success: false, synced: 0, purged: 0, error: e.message };
  }
};
