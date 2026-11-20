import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config, dbFile } from './config.mjs';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  permissions TEXT NOT NULL DEFAULT '[]',
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  avatar_color TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  category TEXT,
  platform TEXT,
  version TEXT,
  vendor TEXT,
  website TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT NOT NULL DEFAULT 'app-window',
  activation_mode TEXT NOT NULL DEFAULT 'hybrid',
  default_plan TEXT NOT NULL DEFAULT 'subscription',
  default_days INTEGER NOT NULL DEFAULT 365,
  default_seats INTEGER NOT NULL DEFAULT 1,
  features TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  tax_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL UNIQUE,
  key_cipher TEXT NOT NULL,
  key_hint TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  customer_id INTEGER,
  plan TEXT NOT NULL DEFAULT 'subscription',
  status TEXT NOT NULL DEFAULT 'active',
  activation_mode TEXT NOT NULL DEFAULT 'hybrid',
  issued_at TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  expires_at TEXT,
  max_seats INTEGER NOT NULL DEFAULT 1,
  features TEXT NOT NULL DEFAULT '[]',
  price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_by INTEGER,
  revoked_at TEXT,
  revoke_reason TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_licenses_product ON licenses(product_id);
CREATE INDEX IF NOT EXISTS idx_licenses_customer ON licenses(customer_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_expires ON licenses(expires_at);

CREATE TABLE IF NOT EXISTS activations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id INTEGER NOT NULL,
  machine_id TEXT NOT NULL,
  machine_name TEXT,
  os TEXT,
  app_version TEXT,
  ip TEXT,
  mode TEXT NOT NULL DEFAULT 'online',
  status TEXT NOT NULL DEFAULT 'active',
  activated_at TEXT NOT NULL,
  last_seen_at TEXT,
  deactivated_at TEXT,
  notes TEXT,
  UNIQUE (license_id, machine_id),
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_activations_license ON activations(license_id, status);

CREATE TABLE IF NOT EXISTS activation_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  license_id INTEGER,
  product_id INTEGER NOT NULL,
  license_key_hash TEXT,
  machine_id TEXT NOT NULL,
  machine_name TEXT,
  os TEXT,
  app_version TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by INTEGER,
  approved_at TEXT,
  rejected_reason TEXT,
  issued_token TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON activation_requests(status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  user_id INTEGER,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  ip TEXT,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_logs(at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL DEFAULT '["activate"]',
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  note TEXT,
  kind TEXT NOT NULL DEFAULT 'manual',
  created_by TEXT,
  created_at TEXT NOT NULL
);
`;

export const DEFAULT_SETTINGS = {
  'studio.name': 'مفتاح',
  'studio.tagline': 'استوديو التراخيص الاحترافي',
  'studio.supportEmail': 'support@miftah.app',
  'studio.currency': 'USD',
  'license.defaultDays': '365',
  'license.defaultSeats': '1',
  'license.offlineTokenDays': '30',
  'license.graceDays': '7',
  'license.keyLookupWindow': '30',
  'backup.dir': config.backupsDir,
  'backup.autoHours': '24',
  'backup.keep': '20',
  'security.sessionHours': '12',
  'security.maxLoginAttempts': '8',
  'appearance.defaultTheme': 'nocturne',
  'appearance.defaultDensity': 'comfortable',
  'onboarding.completed': '0',
};

let state = { db: null, file: dbFile };

export function getDb() {
  if (!state.db) openDatabase();
  return state.db;
}

export function openDatabase() {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const db = new DatabaseSync(dbFile);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(SCHEMA);
  state.db = db;
  state.file = dbFile;
  seedSettings(db);
  return db;
}

export function closeDatabase() {
  try { state.db?.close(); } catch { /* ignore */ }
  state.db = null;
}

export function reopenDatabase() {
  closeDatabase();
  return openDatabase();
}

function seedSettings(db) {
  const insert = db.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) insert.run(key, String(value));
}

export function getSetting(key, fallback = null) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function getSettings() {
  const out = { ...DEFAULT_SETTINGS };
  for (const row of getDb().prepare('SELECT key, value FROM settings').all()) out[row.key] = row.value;
  return out;
}

export function setSetting(key, value) {
  getDb()
    .prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}

export function setSettings(values) {
  const db = getDb();
  const run = db.prepare(
    'INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const [key, value] of Object.entries(values)) run.run(key, String(value));
}

export function audit({ actor = 'system', userId = null, action, entity = null, entityId = null, ip = null, detail = null }) {
  getDb()
    .prepare('INSERT INTO audit_logs(at, user_id, actor, action, entity, entity_id, ip, detail) VALUES (?,?,?,?,?,?,?,?)')
    .run(
      new Date().toISOString(),
      userId,
      actor,
      action,
      entity,
      entityId == null ? null : String(entityId),
      ip,
      detail == null ? null : JSON.stringify(detail)
    );
}

export function json(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

export function dbPath() {
  return state.file;
}
