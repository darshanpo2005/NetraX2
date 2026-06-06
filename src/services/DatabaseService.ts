import * as SQLite from 'expo-sqlite';

export interface Worker {
  id: string;
  name: string;
  employeeId: string;
  embedding: number[];
  createdAt: number;
}

export interface AttendanceLog {
  id: string;
  workerId: string;
  workerName: string;
  timestamp: number;
  similarity: number;
  synced: number;
  location: string;
}

let db: SQLite.SQLiteDatabase;

const getDb = () => {
  if (!db) db = SQLite.openDatabaseSync('netrax2.db');
  return db;
};

export const initDatabase = async () => {
  const database = getDb();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      employee_id TEXT NOT NULL UNIQUE,
      embedding TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attendance_log (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      similarity REAL NOT NULL,
      synced INTEGER DEFAULT 0,
      location TEXT DEFAULT ''
    );
  `);
};

export const addWorker = async (worker: Worker) => {
  const database = getDb();
  await database.runAsync(
    'INSERT INTO workers (id, name, employee_id, embedding, created_at) VALUES (?, ?, ?, ?, ?)',
    [worker.id, worker.name, worker.employeeId, JSON.stringify(worker.embedding), worker.createdAt]
  );
};

export const getAllWorkers = async (): Promise<Worker[]> => {
  const database = getDb();
  const rows = await database.getAllAsync('SELECT * FROM workers ORDER BY created_at DESC') as any[];
  return rows.map(r => ({
    id: r.id, name: r.name, employeeId: r.employee_id,
    embedding: JSON.parse(r.embedding), createdAt: r.created_at,
  }));
};

export const getWorkerCount = async (): Promise<number> => {
  const database = getDb();
  const result = await database.getFirstAsync('SELECT COUNT(*) as count FROM workers') as any;
  return result?.count || 0;
};

export const deleteWorker = async (id: string) => {
  const database = getDb();
  await database.runAsync('DELETE FROM workers WHERE id = ?', [id]);
};

export const workerExists = async (employeeId: string): Promise<boolean> => {
  const database = getDb();
  const result = await database.getFirstAsync(
    'SELECT COUNT(*) as count FROM workers WHERE employee_id = ?', [employeeId]
  ) as any;
  return (result?.count || 0) > 0;
};

export const logAttendance = async (log: AttendanceLog) => {
  const database = getDb();
  await database.runAsync(
    'INSERT INTO attendance_log (id, worker_id, worker_name, timestamp, similarity, synced, location) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [log.id, log.workerId, log.workerName, log.timestamp, log.similarity, log.synced, log.location]
  );
};

export const getAttendanceLogs = async (limit = 50): Promise<AttendanceLog[]> => {
  const database = getDb();
  const rows = await database.getAllAsync(
    'SELECT * FROM attendance_log ORDER BY timestamp DESC LIMIT ?', [limit]
  ) as any[];
  return rows.map(r => ({
    id: r.id, workerId: r.worker_id, workerName: r.worker_name,
    timestamp: r.timestamp, similarity: r.similarity,
    synced: r.synced, location: r.location,
  }));
};

export const getUnsyncedLogs = async (): Promise<AttendanceLog[]> => {
  const database = getDb();
  const rows = await database.getAllAsync(
    'SELECT * FROM attendance_log WHERE synced = 0 ORDER BY timestamp ASC'
  ) as any[];
  return rows.map(r => ({
    id: r.id, workerId: r.worker_id, workerName: r.worker_name,
    timestamp: r.timestamp, similarity: r.similarity,
    synced: r.synced, location: r.location,
  }));
};

export const markAsSynced = async (ids: string[]) => {
  if (!ids.length) return;
  const database = getDb();
  const placeholders = ids.map(() => '?').join(',');
  await database.runAsync(`UPDATE attendance_log SET synced = 1 WHERE id IN (${placeholders})`, ids);
};

export const purgeSyncedLogs = async () => {
  const database = getDb();
  await database.runAsync('DELETE FROM attendance_log WHERE synced = 1');
};

export const getTodayAttendanceCount = async (): Promise<number> => {
  const database = getDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const result = await database.getFirstAsync(
    'SELECT COUNT(*) as count FROM attendance_log WHERE timestamp >= ?', [startOfDay.getTime()]
  ) as any;
  return result?.count || 0;
};

export const getAllWorkerEmbeddings = async (): Promise<Array<{
  id: string;
  name: string;
  embedding: number[];
}>> => {
  try {
    const db = getDb();
    const result = await db.getAllAsync('SELECT id, name, embedding FROM workers') as any[];
    console.log('getAllWorkerEmbeddings: found', result.length, 'workers');
    return result.map((r: any) => ({
      id: r.id,
      name: r.name,
      embedding: typeof r.embedding === 'string'
        ? JSON.parse(r.embedding)
        : r.embedding,
    }));
  } catch (e: any) {
    console.error('getAllWorkerEmbeddings error:', e.message);
    return [];
  }
};
