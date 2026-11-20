'use strict';
/**
 * PharmaPro – Backup & restore (SQLite native VACUUM INTO + file management)
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const db = require('./db');

const DEFAULT_DIR = path.join(db.DATA_DIR, 'backups');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stampName(prefix = 'pharmacy-backup') {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${prefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.db`;
}

function fileInfo(fullPath) {
  const stat = fs.statSync(fullPath);
  return { name: path.basename(fullPath), path: fullPath, size: stat.size, mtime: stat.mtime.toISOString() };
}

function createBackup(dir, { type = 'manual', userId = null } = {}) {
  const targetDir = dir ? path.resolve(String(dir)) : DEFAULT_DIR;
  ensureDir(targetDir);
  const filename = stampName();
  const target = path.join(targetDir, filename);
  const escaped = target.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${escaped}'`);
  const info = fileInfo(target);
  db.run('INSERT INTO backups(filename,path,size,type,user_id) VALUES(?,?,?,?,?)',
    info.name, info.path, info.size, type, userId);
  return info;
}

function listBackups(dir) {
  const targetDir = dir ? path.resolve(String(dir)) : DEFAULT_DIR;
  if (!fs.existsSync(targetDir)) return { dir: targetDir, items: [] };
  const items = fs.readdirSync(targetDir)
    .filter((f) => f.toLowerCase().endsWith('.db') || f.toLowerCase().endsWith('.sqlite'))
    .map((f) => {
      try { return fileInfo(path.join(targetDir, f)); } catch (_) { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
  return { dir: targetDir, items };
}

function validateBackupFile(file) {
  const full = path.resolve(String(file));
  if (!fs.existsSync(full)) throw new Error('ملف النسخة الاحتياطية غير موجود');
  if (!/\.(db|sqlite|sqlite3|bak)$/i.test(full)) throw new Error('امتداد الملف غير مدعوم (.db)');
  let test;
  try {
    test = new DatabaseSync(full, { readOnly: true });
    const tables = test.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
    if (!tables.includes('users') || !tables.includes('products') || !tables.includes('sales')) {
      throw new Error('الملف لا يبدو نسخة احتياطية صالحة من PharmaPro');
    }
    test.prepare('SELECT COUNT(*) AS c FROM users').get();
  } catch (err) {
    throw new Error(`تعذر التحقق من النسخة: ${err.message}`);
  } finally {
    try { if (test) test.close(); } catch (_) { /* ignore */ }
  }
  return full;
}

function restoreBackup(file, userId = null) {
  const full = validateBackupFile(file);
  // Always keep a safety snapshot of the current database first
  const safety = createBackup(DEFAULT_DIR, { type: 'pre-restore', userId });
  const secret = db.get("SELECT value FROM settings WHERE key='auth_secret'");
  try {
    db.getDB().exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (_) { /* ignore */ }
  try { db.getDB().close(); } catch (_) { /* ignore */ }
  for (const suffix of ['-wal', '-shm']) {
    try { fs.rmSync(db.DB_FILE + suffix, { force: true }); } catch (_) { /* ignore */ }
  }
  fs.copyFileSync(full, db.DB_FILE);
  db.reconnect();
  db.exec('PRAGMA journal_mode=WAL;');
  // keep the current session secret valid after restoring an older snapshot
  if (secret && secret.value) {
    db.run("INSERT INTO settings(key,value) VALUES('auth_secret',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", secret.value);
  }
  // sanity check after restore
  const count = db.get('SELECT COUNT(*) AS c FROM users').c;
  if (!count) throw new Error('النسخة المستعادة لا تحتوي على مستخدمين');
  db.run('INSERT INTO audit_log(user_id,action,entity,details) VALUES(?,?,?,?)',
    userId, 'restore', 'backup', `استعادة نسخة من ${full}`);
  return { ok: true, safety: safety.path, restored_from: full, users: count };
}

function deleteBackup(file) {
  const full = path.resolve(String(file));
  if (!fs.existsSync(full)) throw new Error('الملف غير موجود');
  fs.rmSync(full, { force: true });
  db.run('DELETE FROM backups WHERE path = ?', full);
  return { ok: true };
}

/** Native Windows folder picker – lets the user choose any folder on this machine. */
function pickFolder() {
  if (process.platform !== 'win32') return { canceled: true, path: null, error: 'اختيار المجلد المدعوم تلقائياً على ويندوز فقط' };
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms;',
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;',
    '$dlg = New-Object System.Windows.Forms.FolderBrowserDialog;',
    "$dlg.Description = 'اختر مجلد النسخ الاحتياطي';",
    '$dlg.ShowNewFolderButton = $true;',
    "if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dlg.SelectedPath) }"
  ].join(' ');
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-STA', '-Command', script], {
      encoding: 'utf8', timeout: 180000, windowsHide: false
    }).trim();
    if (!out) return { canceled: true, path: null };
    return { canceled: false, path: out };
  } catch (err) {
    return { canceled: true, path: null, error: 'تعذر فتح نافذة اختيار المجلد' };
  }
}

function drives() {
  if (process.platform === 'win32') {
    const list = [];
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i) + ':\\';
      try { if (fs.existsSync(letter)) list.push(letter); } catch (_) { /* ignore */ }
    }
    return list;
  }
  return ['/'];
}

function browse(dir) {
  let target = dir ? path.resolve(String(dir)) : os.homedir();
  if (!fs.existsSync(target)) target = os.homedir();
  const entries = fs.readdirSync(target, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('$') && e.name !== 'System Volume Information')
    .map((e) => ({ name: e.name, path: path.join(target, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const parent = path.dirname(target);
  return {
    dir: target,
    parent: parent !== target ? parent : null,
    entries,
    drives: drives(),
    backups: listBackups(target).items.filter((f) => /\.(db|sqlite|sqlite3|bak)$/i.test(f.name)).slice(0, 100)
  };
}

function autoBackup() {
  try {
    const row = db.get("SELECT value FROM settings WHERE key='last_auto_backup'");
    const today = db.today();
    if (row && row.value === today) return null;
    ensureDir(DEFAULT_DIR);
    const info = createBackup(DEFAULT_DIR, { type: 'auto' });
    db.run("INSERT INTO settings(key,value) VALUES('last_auto_backup',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", today);
    // keep only the last 14 automatic backups
    const autos = listBackups(DEFAULT_DIR).items.filter((f) => f.name.startsWith('pharmacy-backup-'));
    autos.slice(14).forEach((f) => { try { fs.rmSync(f.path, { force: true }); } catch (_) {} });
    return info;
  } catch (err) {
    return null;
  }
}

module.exports = {
  DEFAULT_DIR, createBackup, listBackups, restoreBackup, deleteBackup,
  pickFolder, browse, validateBackupFile, autoBackup, ensureDir
};
