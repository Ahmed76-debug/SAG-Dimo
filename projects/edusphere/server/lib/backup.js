import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { db, checkpoint, dbFileInfo, all, run, getSetting, setSetting } from './db.js';
import { DB_FILE, BACKUP_DIR, UPLOAD_DIR, APP } from '../config.js';
import { nowIso } from './util.js';

const MAGIC = 'EDUSPHERE-BACKUP';
const FORMAT_VERSION = 1;
const EXT = '.edusphere';

/* ------------------------------------------------------------------ *
 * Folder helpers
 * ------------------------------------------------------------------ */
export function listDrives() {
  if (process.platform !== 'win32') return ['/'];
  const drives = [];
  for (let i = 65; i <= 90; i += 1) {
    const letter = `${String.fromCharCode(i)}:\\`;
    try {
      if (fs.existsSync(letter)) drives.push(letter);
    } catch {
      /* ignore */
    }
  }
  return drives;
}

export function resolveFolder(folder) {
  if (!folder) return BACKUP_DIR;
  let p = String(folder).trim().replace(/^"|"$/g, '');
  if (!p) return BACKUP_DIR;
  p = p.replace(/\//g, path.sep);
  if (p === '~') p = process.env.USERPROFILE || process.env.HOME || BACKUP_DIR;
  if (p.startsWith('~')) p = (process.env.USERPROFILE || process.env.HOME || '') + p.slice(1);
  return path.resolve(p);
}

export function browseFolder(folder) {
  const target = resolveFolder(folder || '');
  let entries = [];
  try {
    entries = fs.readdirSync(target, { withFileTypes: true });
  } catch (err) {
    return { path: target, parent: path.dirname(target), entries: [], drives: listDrives(), error: err.code || 'unreadable' };
  }
  const dirs = entries
    .filter((e) => {
      try {
        return e.isDirectory();
      } catch {
        return false;
      }
    })
    .map((e) => ({ name: e.name, path: path.join(target, e.name) }))
    .filter((d) => !d.name.startsWith('$'))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { path: target, parent: path.dirname(target) === target ? null : path.dirname(target), entries: dirs, drives: listDrives() };
}

export function ensureFolder(folder) {
  const target = resolveFolder(folder);
  fs.mkdirSync(target, { recursive: true });
  return target;
}

/* ------------------------------------------------------------------ *
 * Create backup
 * ------------------------------------------------------------------ */
function walkFiles(dir, base = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, base));
    else if (entry.isFile()) out.push({ full, rel: path.relative(base, full) });
  }
  return out;
}

export function createBackup({ folder, includeFiles = true, note = '', createdBy = null } = {}) {
  const targetDir = ensureFolder(folder);
  checkpoint();

  const dbBytes = fs.readFileSync(DB_FILE);
  const payload = {
    magic: MAGIC,
    formatVersion: FORMAT_VERSION,
    app: { name: APP.name, version: APP.version },
    createdAt: nowIso(),
    note,
    createdBy,
    database: dbBytes.toString('base64'),
    files: [],
  };

  if (includeFiles) {
    for (const file of walkFiles(UPLOAD_DIR)) {
      try {
        payload.files.push({ path: file.rel, data: fs.readFileSync(file.full).toString('base64') });
      } catch {
        /* skip unreadable */
      }
    }
  }

  const json = JSON.stringify(payload);
  const gz = zlib.gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `edusphere-backup-${stamp}${EXT}`;
  const filePath = path.join(targetDir, filename);
  fs.writeFileSync(filePath, gz);

  const meta = {
    file: filename,
    path: filePath,
    size: gz.length,
    createdAt: payload.createdAt,
    includeFiles: Boolean(includeFiles),
    note,
    records: dbFileInfo().size,
  };

  const history = getSetting('app', 'backup_history', []);
  const next = [meta, ...(Array.isArray(history) ? history : [])].slice(0, 50);
  setSetting('app', 'backup_history', next);
  setSetting('app', 'backup', { ...(getSetting('app', 'backup', {}) || {}), folder: targetDir, last_backup_at: payload.createdAt });

  return meta;
}

/* ------------------------------------------------------------------ *
 * List / verify
 * ------------------------------------------------------------------ */
export function listBackups(folder) {
  const targetDir = resolveFolder(folder);
  if (!fs.existsSync(targetDir)) return { folder: targetDir, files: [] };
  const files = fs
    .readdirSync(targetDir, { withFileTypes: true })
    .filter((e) => e.isFile() && (e.name.endsWith(EXT) || e.name.endsWith('.edusphere.gz')))
    .map((e) => {
      const full = path.join(targetDir, e.name);
      const st = fs.statSync(full);
      return { file: e.name, path: full, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { folder: targetDir, files };
}

export function readBackup(filePath) {
  const buf = fs.readFileSync(filePath);
  const json = zlib.gunzipSync(buf).toString('utf8');
  const payload = JSON.parse(json);
  if (payload.magic !== MAGIC) throw new Error('invalid_backup');
  if (!payload.database) throw new Error('missing_database');
  return payload;
}

export function verifyBackup(filePath) {
  try {
    const payload = readBackup(filePath);
    const bytes = Buffer.from(payload.database, 'base64');
    const tmp = path.join(process.env.TEMP || '/tmp', `edusphere-verify-${Date.now()}.db`);
    fs.writeFileSync(tmp, bytes);
    const test = new DatabaseSync(tmp, { readOnly: true });
    const tables = test.prepare(`SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table'`).get();
    const students = test.prepare(`SELECT COUNT(*) AS c FROM students`).get();
    test.close();
    fs.unlinkSync(tmp);
    return {
      ok: true,
      createdAt: payload.createdAt,
      app: payload.app,
      size: bytes.length,
      files: (payload.files || []).length,
      tables: tables?.c || 0,
      students: students?.c || 0,
      note: payload.note || '',
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ------------------------------------------------------------------ *
 * Restore
 * ------------------------------------------------------------------ */
export function restoreBackup(filePath, { restoreFiles = true } = {}) {
  const payload = readBackup(filePath);
  const bytes = Buffer.from(payload.database, 'base64');
  const tmp = path.join(process.env.TEMP || '/tmp', `edusphere-restore-${Date.now()}.db`);
  fs.writeFileSync(tmp, bytes);

  // Integrity check first
  const probe = new DatabaseSync(tmp, { readOnly: true });
  const integrity = probe.prepare('PRAGMA integrity_check').get();
  probe.close();
  const integrityValue = integrity ? Object.values(integrity)[0] : 'unknown';
  if (String(integrityValue).toLowerCase() !== 'ok') {
    fs.unlinkSync(tmp);
    throw new Error('backup_corrupt');
  }

  const escaped = tmp.replace(/\\/g, '\\\\').replace(/'/g, "''");
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec(`ATTACH DATABASE '${escaped}' AS bk`);
  const tables = all(`SELECT name FROM bk.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
  let copied = 0;
  try {
    db.exec('BEGIN');
    for (const { name } of tables) {
      const mainExists = all(`SELECT name FROM main.sqlite_master WHERE type='table' AND name = ?`, [name]);
      if (!mainExists.length) continue;
      db.exec(`DELETE FROM main."${name}"`);
      db.exec(`INSERT INTO main."${name}" SELECT * FROM bk."${name}"`);
      copied += 1;
    }
    db.exec('COMMIT');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    db.exec('DETACH DATABASE bk');
    db.exec('PRAGMA foreign_keys = ON');
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
  db.exec('DETACH DATABASE bk');
  db.exec('PRAGMA foreign_keys = ON');
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* ignore */
  }

  if (restoreFiles && Array.isArray(payload.files) && payload.files.length) {
    for (const file of payload.files) {
      const dest = path.join(UPLOAD_DIR, file.path);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(file.data, 'base64'));
    }
  }

  run(
    `INSERT INTO audit_log (user_id, username, action, entity, summary, created_at)
     VALUES (?,?,?,?,?,?)`,
    [null, 'system', 'restore', 'system', `Database restored from ${path.basename(filePath)} (${copied} tables)`, nowIso()],
  );

  return { ok: true, tables: copied, files: (payload.files || []).length, createdAt: payload.createdAt };
}

/* ------------------------------------------------------------------ *
 * Automatic backup scheduler
 * ------------------------------------------------------------------ */
let schedulerHandle = null;

export function startBackupScheduler() {
  if (schedulerHandle) return;
  const tick = () => {
    try {
      const cfg = getSetting('app', 'backup', {}) || {};
      if (!cfg.auto) return;
      const history = getSetting('app', 'backup_history', []) || [];
      const last = history[0]?.createdAt ? new Date(history[0].createdAt).getTime() : 0;
      const intervalMs = cfg.frequency === 'weekly' ? 7 * 86400000 : cfg.frequency === 'monthly' ? 30 * 86400000 : 86400000;
      if (Date.now() - last >= intervalMs) {
        createBackup({ folder: cfg.folder, includeFiles: cfg.include_files !== false, note: 'Automatic backup' });
      }
    } catch {
      /* never crash the scheduler */
    }
  };
  schedulerHandle = setInterval(tick, 6 * 3600 * 1000);
  if (schedulerHandle.unref) schedulerHandle.unref();
  setTimeout(tick, 20_000).unref?.();
}

export function saveBackupSettings(settings) {
  const current = getSetting('app', 'backup', {}) || {};
  const next = { ...current, ...settings };
  setSetting('app', 'backup', next);
  return next;
}
