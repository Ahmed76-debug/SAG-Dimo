import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DB_FILE, DATA_DIR } from '../config.js';
import { nowIso, safeJsonParse } from './util.js';

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_FILE);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA synchronous = NORMAL');
db.exec('PRAGMA busy_timeout = 8000');

/** Normalize JS values into types node:sqlite accepts (no booleans, no objects). */
function normalizeParam(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

export function run(sql, params = []) {
  const stmt = db.prepare(sql);
  const result = stmt.run(...params.map(normalizeParam));
  return { changes: Number(result.changes || 0), lastInsertRowid: Number(result.lastInsertRowid || 0) };
}

export function all(sql, params = []) {
  return db.prepare(sql).all(...params.map(normalizeParam));
}

export function get(sql, params = []) {
  return db.prepare(sql).get(...params.map(normalizeParam)) ?? null;
}

export function scalar(sql, params = [], column) {
  const row = get(sql, params);
  if (!row) return null;
  return column ? row[column] : Object.values(row)[0];
}

export function exec(sql) {
  db.exec(sql);
}

/** Run a function inside a transaction (nested-safe via savepoints). */
let txDepth = 0;
export function transaction(fn) {
  const depth = txDepth;
  const savepoint = `sp_${depth}`;
  if (depth === 0) db.exec('BEGIN');
  else db.exec(`SAVEPOINT ${savepoint}`);
  txDepth += 1;
  try {
    const result = fn();
    txDepth -= 1;
    if (depth === 0) db.exec('COMMIT');
    else db.exec(`RELEASE ${savepoint}`);
    return result;
  } catch (err) {
    txDepth -= 1;
    try {
      if (depth === 0) db.exec('ROLLBACK');
      else db.exec(`ROLLBACK TO ${savepoint}`);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

export function tableExists(name) {
  return Boolean(get(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`, [name]));
}

const TABLE_COLUMNS_CACHE = new Map();

export function tableColumns(name) {
  if (!TABLE_COLUMNS_CACHE.has(name)) {
    TABLE_COLUMNS_CACHE.set(name, all(`PRAGMA table_info(${name})`).map((r) => r.name));
  }
  return TABLE_COLUMNS_CACHE.get(name);
}

export function insertRow(table, data) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (!entries.length) throw new Error(`No data provided for ${table}`);
  const cols = entries.map(([k]) => `"${k}"`).join(', ');
  const placeholders = entries.map(() => '?').join(', ');
  const res = run(`INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`, entries.map(([, v]) => v));
  return res.lastInsertRowid;
}

export function updateRow(table, id, data) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (!entries.length) return 0;
  const sets = entries.map(([k]) => `"${k}" = ?`).join(', ');
  const res = run(`UPDATE "${table}" SET ${sets} WHERE id = ?`, [...entries.map(([, v]) => v), id]);
  return res.changes;
}

export function deleteRow(table, id) {
  return run(`DELETE FROM "${table}" WHERE id = ?`, [id]).changes;
}

export function softDeleteRow(table, id, userId) {
  return run(`UPDATE "${table}" SET deleted_at = ?, deleted_by = ? WHERE id = ?`, [nowIso(), userId ?? null, id]).changes;
}

export function getSetting(scope, key, fallback = null) {
  const row = get(`SELECT value FROM settings WHERE scope = ? AND key = ?`, [scope, key]);
  return row ? safeJsonParse(row.value, row.value) : fallback;
}

export function setSetting(scope, key, value) {
  const json = typeof value === 'string' ? value : JSON.stringify(value);
  run(
    `INSERT INTO settings (scope, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [scope, key, json, nowIso()],
  );
}

/** Simple KV sequence counter used for document numbering. */
export function nextSequence(key, start = 1) {
  return transaction(() => {
    const row = get(`SELECT value FROM sequences WHERE key = ?`, [key]);
    const next = row ? Number(row.value) + 1 : start;
    run(
      `INSERT INTO sequences (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, next, nowIso()],
    );
    return next;
  });
}

export function dbFileInfo() {
  try {
    const st = fs.statSync(DB_FILE);
    return { path: DB_FILE, size: st.size, modified: st.mtime.toISOString() };
  } catch {
    return { path: DB_FILE, size: 0, modified: null };
  }
}

export function checkpoint() {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } catch {
    /* ignore */
  }
}

export const DB_PATH = DB_FILE;
export { path };
