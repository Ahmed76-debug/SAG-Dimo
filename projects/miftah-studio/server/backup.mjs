import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { config, dbFile, pkg } from './config.mjs';
import { getDb, getSettings, closeDatabase, reopenDatabase, audit } from './db.mjs';

const FORMAT = 'miftah-backup';

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

export function createBackup({ targetDir, note = '', kind = 'manual', actor = 'system' } = {}) {
  const db = getDb();
  const settings = getSettings();
  const dir = path.resolve(targetDir || settings['backup.dir'] || config.backupsDir);
  fs.mkdirSync(dir, { recursive: true });

  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const bytes = fs.readFileSync(dbFile);
  const checksum = sha256(bytes);
  const envelope = {
    format: FORMAT,
    version: 1,
    appVersion: pkg.version,
    createdAt: new Date().toISOString(),
    checksum,
    database: bytes.toString('base64'),
  };
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(envelope)), { level: 9 });
  const filename = `miftah-${kind}-${stamp()}.mftbak`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, gz, { mode: 0o600 });

  const info = db.prepare(
    'INSERT INTO backups(filename, path, size, checksum, note, kind, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).run(filename, filePath, gz.length, checksum, note || null, kind, actor, new Date().toISOString());

  pruneAutoBackups(dir, Number(settings['backup.keep'] || 20));
  return {
    id: Number(info.lastInsertRowid),
    filename, path: filePath, size: gz.length, checksum, note, kind,
    createdBy: actor, createdAt: new Date().toISOString(),
  };
}

function pruneAutoBackups(dir, keep) {
  if (!Number.isFinite(keep) || keep <= 0) return;
  let files = [];
  try {
    files = fs.readdirSync(dir)
      .filter((f) => f.startsWith('miftah-auto-') && f.endsWith('.mftbak'))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
  } catch { return; }
  for (const old of files.slice(keep)) {
    try { fs.unlinkSync(path.join(dir, old.f)); } catch { /* ignore */ }
  }
}

export function readBackup(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error('ملف النسخة الاحتياطية غير موجود');
  const raw = fs.readFileSync(abs);
  let envelope;
  try { envelope = JSON.parse(zlib.gunzipSync(raw).toString('utf8')); }
  catch { throw new Error('تعذر قراءة الملف: صيغة غير صالحة'); }
  if (envelope?.format !== FORMAT || !envelope.database) throw new Error('الملف ليس نسخة احتياطية صالحة لـ مفتاح');
  const bytes = Buffer.from(envelope.database, 'base64');
  const checksum = sha256(bytes);
  if (envelope.checksum && checksum !== envelope.checksum) throw new Error('فشل التحقق من سلامة النسخة الاحتياطية');
  return { envelope, bytes, checksum, path: abs, size: raw.length };
}

export function restoreBackup(filePath, actor = 'system') {
  const { envelope, bytes } = readBackup(filePath);
  const pre = createBackup({ kind: 'pre-restore', note: 'نسخة تلقائية قبل الاستعادة', actor });

  closeDatabase();
  try {
    for (const suffix of ['-wal', '-shm']) {
      const f = dbFile + suffix;
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    fs.writeFileSync(dbFile, bytes, { mode: 0o600 });
  } finally {
    reopenDatabase();
  }
  audit({
    actor, action: 'backup.restore', entity: 'backup', entityId: path.basename(filePath),
    detail: { from: path.basename(filePath), backupCreatedAt: envelope.createdAt, preRestore: pre.filename },
  });
  return { restoredFrom: path.basename(filePath), backupCreatedAt: envelope.createdAt, preRestoreBackup: pre.filename };
}

export function backupFilesIn(dir) {
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter((f) => f.endsWith('.mftbak'))
    .map((f) => {
      const st = fs.statSync(path.join(abs, f));
      return { filename: f, path: path.join(abs, f), size: st.size, modifiedAt: st.mtime.toISOString() };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}
