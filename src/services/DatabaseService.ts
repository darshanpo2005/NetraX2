import * as SQLite from 'expo-sqlite';

export interface Worker {
  id: string;
  name: string;
  employeeId: string;
  embedding: number[];
  createdAt: number;
  photoUri?: string | null;
  removedAt?: number | null;
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
      created_at INTEGER NOT NULL,
      photo_uri TEXT
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
    CREATE TABLE IF NOT EXISTS absence_records (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      reason TEXT DEFAULT 'No show',
      marked_by TEXT DEFAULT 'admin',
      timestamp INTEGER NOT NULL
    );
  `);
  // Migration: add photo_uri for existing databases that don't have it yet
  try {
    await database.execAsync('ALTER TABLE workers ADD COLUMN photo_uri TEXT');
  } catch {
    // Column already exists — safe to ignore
  }
  // Migration: add removed_at for soft-delete support on existing databases
  try {
    await database.execAsync('ALTER TABLE workers ADD COLUMN removed_at INTEGER DEFAULT NULL');
  } catch {
    // Column already exists — safe to ignore
  }
};

export const addWorker = async (worker: Worker) => {
  const database = getDb();
  await database.runAsync(
    'INSERT INTO workers (id, name, employee_id, embedding, created_at, photo_uri) VALUES (?, ?, ?, ?, ?, ?)',
    [worker.id, worker.name, worker.employeeId, JSON.stringify(worker.embedding), worker.createdAt, worker.photoUri ?? null]
  );
};

export const getAllWorkers = async (): Promise<Worker[]> => {
  const database = getDb();
  const rows = await database.getAllAsync(
    'SELECT * FROM workers WHERE removed_at IS NULL ORDER BY created_at DESC'
  ) as any[];
  return rows.map(r => ({
    id: r.id, name: r.name, employeeId: r.employee_id,
    embedding: JSON.parse(r.embedding), createdAt: r.created_at,
    photoUri: r.photo_uri ?? null,
    removedAt: r.removed_at ?? null,
  }));
};

/** Soft-deleted workers, most recently removed first. */
export const getSoftDeletedWorkers = async (): Promise<Worker[]> => {
  const database = getDb();
  const rows = await database.getAllAsync(
    'SELECT * FROM workers WHERE removed_at IS NOT NULL ORDER BY removed_at DESC'
  ) as any[];
  return rows.map(r => ({
    id: r.id, name: r.name, employeeId: r.employee_id,
    embedding: JSON.parse(r.embedding), createdAt: r.created_at,
    photoUri: r.photo_uri ?? null,
    removedAt: r.removed_at ?? null,
  }));
};

export const getWorkerCount = async (): Promise<number> => {
  const database = getDb();
  const result = await database.getFirstAsync(
    'SELECT COUNT(*) as count FROM workers WHERE removed_at IS NULL'
  ) as any;
  return result?.count || 0;
};

/** Soft delete — marks the worker removed instead of erasing their row/history. */
export const deleteWorker = async (id: string) => {
  const database = getDb();
  await database.runAsync('UPDATE workers SET removed_at = ? WHERE id = ?', [Date.now(), id]);
};

export const workerExists = async (employeeId: string): Promise<boolean> => {
  const database = getDb();
  const result = await database.getFirstAsync(
    'SELECT COUNT(*) as count FROM workers WHERE employee_id = ? AND removed_at IS NULL', [employeeId]
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

/** Deletes already-synced logs older than `olderThanDays`. Returns rows deleted. */
export const purgeSyncedLogs = async (olderThanDays = 30): Promise<number> => {
  const database = getDb();
  const cutoff = Date.now() - olderThanDays * 86_400_000;
  const result = await database.runAsync(
    'DELETE FROM attendance_log WHERE synced = 1 AND timestamp < ?', [cutoff]
  );
  return result.changes ?? 0;
};

/** Unsynced logs joined with the worker's employee_id, for cloud upload. */
export const getUnsyncedAttendanceRecords = async (): Promise<AttendanceRecord[]> => {
  const database = getDb();
  const rows = await database.getAllAsync(
    `SELECT a.*, COALESCE(w.employee_id, '') AS emp_id
       FROM attendance_log a LEFT JOIN workers w ON a.worker_id = w.id
      WHERE a.synced = 0
      ORDER BY a.timestamp ASC`
  ) as any[];
  return rows.map(r => ({
    id: r.id, workerId: r.worker_id, workerName: r.worker_name,
    timestamp: r.timestamp, similarity: r.similarity,
    synced: r.synced, location: r.location,
    employeeId: r.emp_id ?? '',
  }));
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

export interface AttendanceRecord extends AttendanceLog {
  employeeId: string;
}

export interface AttendanceRow {
  workerName: string;
  employeeId: string;
  timestamp: number;
  date: string;
  time: string;
  day: string;
  similarity: number;
  location: string;
}

// ─── Dashboard queries ────────────────────────────────────────────────────────

export interface TodayWorker {
  workerId: string;
  workerName: string;
  lastSeen: number; // timestamp of most-recent attendance today
}

/** Workers who have at least one attendance log today. */
export const getTodayAttendance = async (): Promise<TodayWorker[]> => {
  const database = getDb();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await database.getAllAsync(
    `SELECT worker_id, worker_name, MAX(timestamp) AS last_seen
       FROM attendance_log
      WHERE timestamp >= ?
      GROUP BY worker_id, worker_name
      ORDER BY last_seen DESC`,
    [startOfDay.getTime()]
  ) as any[];
  return rows.map(r => ({
    workerId: r.worker_id,
    workerName: r.worker_name,
    lastSeen: r.last_seen,
  }));
};

export interface DayCount { label: string; count: number; date: string }

/** Attendance count for each of the last 7 days (oldest → newest). */
export const getWeeklyAttendance = async (): Promise<DayCount[]> => {
  const database = getDb();
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result: DayCount[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const start = d.getTime();
    const end   = start + 86_400_000;
    const row = await database.getFirstAsync(
      `SELECT COUNT(DISTINCT worker_id) AS cnt
         FROM attendance_log WHERE timestamp >= ? AND timestamp < ?`,
      [start, end]
    ) as any;
    result.push({
      label: DAY_LABELS[d.getDay()],
      count: row?.cnt ?? 0,
      date : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    });
  }
  return result;
};

export interface WorkerStreak {
  workerId: string;
  workerName: string;
  streak: number;
  lastSeen: number | null;
  presentToday: boolean;
  photoUri?: string | null;
}

/** Consecutive-day attendance streak for every enrolled worker. */
export const getWorkerStreaks = async (): Promise<WorkerStreak[]> => {
  const database = getDb();
  const workers  = await getAllWorkers();
  const today    = new Date(); today.setHours(0, 0, 0, 0);

  const streaks: WorkerStreak[] = [];

  for (const w of workers) {
    // Distinct calendar days this worker attended, newest first
    const rows = await database.getAllAsync(
      `SELECT DISTINCT CAST(timestamp / 86400000 AS INTEGER) AS day_idx,
              MAX(timestamp) AS last_seen
         FROM attendance_log
        WHERE worker_id = ?
        GROUP BY day_idx
        ORDER BY day_idx DESC`,
      [w.id]
    ) as any[];

    const presentToday = rows.length > 0 &&
      rows[0].day_idx === Math.floor(today.getTime() / 86_400_000);

    let streak = 0;
    let expected = Math.floor(today.getTime() / 86_400_000);
    // If absent today, streak only counts if they were present yesterday
    if (!presentToday) expected -= 1;

    for (const row of rows) {
      if (row.day_idx === expected) { streak++; expected--; }
      else break;
    }

    streaks.push({
      workerId: w.id,
      workerName: w.name,
      streak,
      lastSeen: rows[0]?.last_seen ?? null,
      presentToday,
      photoUri: w.photoUri ?? null,
    });
  }

  // Present today first, then by streak desc
  return streaks.sort((a, b) =>
    Number(b.presentToday) - Number(a.presentToday) || b.streak - a.streak
  );
};

/** Attendance rows between two timestamps (inclusive). */
export const getAttendanceByDateRange = async (
  fromTs: number,
  toTs: number
): Promise<AttendanceRow[]> => {
  const database = getDb();
  const rows = await database.getAllAsync(
    `SELECT a.*, COALESCE(w.employee_id, '') AS emp_id
       FROM attendance_log a LEFT JOIN workers w ON a.worker_id = w.id
      WHERE a.timestamp >= ? AND a.timestamp <= ?
      ORDER BY a.timestamp DESC`,
    [fromTs, toTs]
  ) as any[];
  return rows.map(r => {
    const d = new Date(r.timestamp);
    return {
      workerName: r.worker_name,
      employeeId: r.emp_id ?? '',
      timestamp : r.timestamp,
      similarity: r.similarity,
      location  : r.location ?? '',
      date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      day : d.toLocaleDateString('en-IN', { weekday: 'long' }),
    };
  });
};

/** Unique-attendee count per day for the last 7 days, oldest→newest. */
export const getWeeklyStats = async (): Promise<{ day: string; count: number }[]> => {
  const data = await getWeeklyAttendance();
  return data.map(d => ({ day: d.label, count: d.count }));
};

/** Total enrolled workers vs. how many attended today. */
export const getTodayStats = async (): Promise<{ total: number; present: number; absent: number }> => {
  const [total, present] = await Promise.all([getWorkerCount(), getTodayAttendanceCount()]);
  return { total, present, absent: Math.max(0, total - present) };
};

export const getTodayPresentWorkerIds = async (): Promise<Set<string>> => {
  const database = getDb();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const rows = await database.getAllAsync(
    'SELECT DISTINCT worker_id FROM attendance_log WHERE timestamp >= ?',
    [startOfDay.getTime()]
  ) as any[];
  return new Set(rows.map((r: any) => r.worker_id));
};

export const getWorkerAttendanceHistory = async (workerId: string): Promise<AttendanceLog[]> => {
  const database = getDb();
  const rows = await database.getAllAsync(
    'SELECT * FROM attendance_log WHERE worker_id = ? ORDER BY timestamp DESC',
    [workerId]
  ) as any[];
  return rows.map((r: any) => ({
    id: r.id, workerId: r.worker_id, workerName: r.worker_name,
    timestamp: r.timestamp, similarity: r.similarity,
    synced: r.synced, location: r.location,
  }));
};

export interface WorkerStats {
  total: number;
  thisWeek: number;
  thisMonth: number;
  streak: number;
  lastSeen: number | null;
}

export const getWorkerStats = async (workerId: string): Promise<WorkerStats> => {
  const database = getDb();
  const now = Date.now();
  const weekAgo  = now - 7  * 86_400_000;
  const monthAgo = now - 30 * 86_400_000;

  const [totalRow, weekRow, monthRow, lastRow] = await Promise.all([
    database.getFirstAsync('SELECT COUNT(*) as count FROM attendance_log WHERE worker_id = ?', [workerId]),
    database.getFirstAsync('SELECT COUNT(*) as count FROM attendance_log WHERE worker_id = ? AND timestamp >= ?', [workerId, weekAgo]),
    database.getFirstAsync('SELECT COUNT(*) as count FROM attendance_log WHERE worker_id = ? AND timestamp >= ?', [workerId, monthAgo]),
    database.getFirstAsync('SELECT MAX(timestamp) as last FROM attendance_log WHERE worker_id = ?', [workerId]),
  ]) as any[];

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayRows = await database.getAllAsync(
    `SELECT DISTINCT CAST(timestamp / 86400000 AS INTEGER) AS day_idx
       FROM attendance_log WHERE worker_id = ? ORDER BY day_idx DESC`,
    [workerId]
  ) as any[];

  let streak = 0;
  let expected = Math.floor(today.getTime() / 86_400_000);
  if (dayRows.length === 0 || dayRows[0].day_idx !== expected) expected -= 1;
  for (const row of dayRows) {
    if (row.day_idx === expected) { streak++; expected--; }
    else break;
  }

  return {
    total     : totalRow?.count  ?? 0,
    thisWeek  : weekRow?.count   ?? 0,
    thisMonth : monthRow?.count  ?? 0,
    streak,
    lastSeen  : lastRow?.last    ?? null,
  };
};

export const getAllWorkerEmbeddings = async (): Promise<Array<{
  id: string;
  name: string;
  embedding: number[];
}>> => {
  try {
    const database = getDb();
    const result = await database.getAllAsync('SELECT id, name, embedding FROM workers WHERE removed_at IS NULL') as any[];
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

// ─── Absence tracking ──────────────────────────────────────────────────────────
// Absence is computed dynamically (no attendance record for the day) rather than
// pre-populated at day start. "Marking" a worker absent just records a reason —
// it never creates an attendance_log row.

/** "YYYY-MM-DD" in local time, matching the day-boundary logic used elsewhere in this file. */
export const formatDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const dayBoundsFromKey = (date: string): { start: number; end: number } => {
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  return { start, end: start + 86_400_000 };
};

export interface AbsentWorker {
  id: string;
  name: string;
  employeeId: string;
  photoUri: string | null;
}

/** Active workers with no attendance_log row on the given date. */
export const getAbsentWorkersForDate = async (date: string): Promise<AbsentWorker[]> => {
  const database = getDb();
  const { start, end } = dayBoundsFromKey(date);
  const rows = await database.getAllAsync(
    `SELECT id, name, employee_id, photo_uri FROM workers
      WHERE removed_at IS NULL
        AND id NOT IN (
          SELECT DISTINCT worker_id FROM attendance_log WHERE timestamp >= ? AND timestamp < ?
        )
      ORDER BY name ASC`,
    [start, end]
  ) as any[];
  return rows.map(r => ({
    id: r.id, name: r.name, employeeId: r.employee_id, photoUri: r.photo_uri ?? null,
  }));
};

export interface PresentWorker {
  id: string;
  name: string;
  employeeId: string;
  photoUri: string | null;
  checkInTime: number;
}

/** Active workers with at least one attendance_log row on the given date, with first check-in time. */
export const getPresentWorkersForDate = async (date: string): Promise<PresentWorker[]> => {
  const database = getDb();
  const { start, end } = dayBoundsFromKey(date);
  const rows = await database.getAllAsync(
    `SELECT w.id, w.name, w.employee_id, w.photo_uri, MIN(a.timestamp) AS check_in
       FROM attendance_log a
       JOIN workers w ON w.id = a.worker_id
      WHERE a.timestamp >= ? AND a.timestamp < ? AND w.removed_at IS NULL
      GROUP BY w.id, w.name, w.employee_id, w.photo_uri
      ORDER BY check_in ASC`,
    [start, end]
  ) as any[];
  return rows.map(r => ({
    id: r.id, name: r.name, employeeId: r.employee_id, photoUri: r.photo_uri ?? null,
    checkInTime: r.check_in,
  }));
};

export interface AbsenceRecord {
  id: string;
  workerId: string;
  workerName: string;
  employeeId: string;
  date: string;
  reason: string;
  markedBy: string;
  timestamp: number;
}

/** Records (or updates) why a worker was absent on a given date. */
export const markWorkerAbsent = async (
  workerId: string, date: string, reason = 'No show', markedBy = 'admin'
): Promise<AbsenceRecord> => {
  const database = getDb();
  const worker = await database.getFirstAsync(
    'SELECT name, employee_id FROM workers WHERE id = ?', [workerId]
  ) as any;

  const record: AbsenceRecord = {
    id: `${workerId}_${date}`,
    workerId,
    workerName: worker?.name ?? '',
    employeeId: worker?.employee_id ?? '',
    date,
    reason,
    markedBy,
    timestamp: Date.now(),
  };

  await database.runAsync(
    `INSERT OR REPLACE INTO absence_records
       (id, worker_id, worker_name, employee_id, date, reason, marked_by, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.workerId, record.workerName, record.employeeId, record.date, record.reason, record.markedBy, record.timestamp]
  );

  return record;
};

export const getAbsenceRecordsForDate = async (date: string): Promise<AbsenceRecord[]> => {
  const database = getDb();
  const rows = await database.getAllAsync(
    'SELECT * FROM absence_records WHERE date = ? ORDER BY timestamp DESC', [date]
  ) as any[];
  return rows.map(r => ({
    id: r.id, workerId: r.worker_id, workerName: r.worker_name, employeeId: r.employee_id,
    date: r.date, reason: r.reason, markedBy: r.marked_by, timestamp: r.timestamp,
  }));
};

/** All absence records ever recorded — used for cloud sync (small table, upserts are idempotent). */
export const getAllAbsenceRecords = async (): Promise<AbsenceRecord[]> => {
  const database = getDb();
  const rows = await database.getAllAsync('SELECT * FROM absence_records ORDER BY timestamp DESC') as any[];
  return rows.map(r => ({
    id: r.id, workerId: r.worker_id, workerName: r.worker_name, employeeId: r.employee_id,
    date: r.date, reason: r.reason, markedBy: r.marked_by, timestamp: r.timestamp,
  }));
};

export interface AttendanceSummary {
  present: PresentWorker[];
  absent: AbsentWorker[];
  manuallyMarked: AbsenceRecord[];
}

/** Present / not-yet-marked-absent / manually-marked-absent, split for the Absentee screen. */
export const getAttendanceSummaryForDate = async (date: string): Promise<AttendanceSummary> => {
  const [present, absentRaw, manuallyMarked] = await Promise.all([
    getPresentWorkersForDate(date),
    getAbsentWorkersForDate(date),
    getAbsenceRecordsForDate(date),
  ]);
  const markedIds = new Set(manuallyMarked.map(m => m.workerId));
  const absent = absentRaw.filter(a => !markedIds.has(a.id));
  return { present, absent, manuallyMarked };
};

export interface AbsenceRow {
  workerName: string;
  employeeId: string;
  date: string;
  reason: string;
}

/** Day-by-day absentee rows (display-formatted date) for a timestamp range — used by report exports. */
const MAX_ABSENCE_RANGE_DAYS = 366;

export const getAbsenceRowsForDateRange = async (fromTs: number, toTs: number): Promise<AbsenceRow[]> => {
  const rows: AbsenceRow[] = [];
  const startDay = new Date(fromTs); startDay.setHours(0, 0, 0, 0);
  const endDay   = new Date(toTs);   endDay.setHours(0, 0, 0, 0);
  const cappedEnd = Math.min(endDay.getTime(), startDay.getTime() + (MAX_ABSENCE_RANGE_DAYS - 1) * 86_400_000);

  for (let t = startDay.getTime(); t <= cappedEnd; t += 86_400_000) {
    const d = new Date(t);
    const key = formatDateKey(d);
    const [absentees, marked] = await Promise.all([
      getAbsentWorkersForDate(key),
      getAbsenceRecordsForDate(key),
    ]);
    const reasonByWorkerId = new Map(marked.map(m => [m.workerId, m.reason]));
    const dateLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    for (const a of absentees) {
      rows.push({
        workerName: a.name,
        employeeId: a.employeeId,
        date: dateLabel,
        reason: reasonByWorkerId.get(a.id) ?? 'Not marked',
      });
    }
  }
  return rows;
};
