'use strict';
/**
 * PharmaPro – Database layer
 * Uses Node's built-in SQLite (node:sqlite) – zero external dependencies.
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.PHARMACY_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = process.env.PHARMACY_DB_FILE || path.join(DATA_DIR, 'pharmacy.db');

let db = null;

function connect() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  return db;
}

function getDB() {
  if (!db) connect();
  return db;
}

function all(sql, ...params) {
  return getDB().prepare(sql).all(...params);
}
function get(sql, ...params) {
  return getDB().prepare(sql).get(...params);
}
function run(sql, ...params) {
  return getDB().prepare(sql).run(...params);
}
function exec(sql) {
  return getDB().exec(sql);
}
function tx(fn) {
  getDB().exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    getDB().exec('COMMIT');
    return result;
  } catch (err) {
    try { getDB().exec('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL DEFAULT '[]',
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id INTEGER REFERENCES roles(id),
  phone TEXT,
  email TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  color TEXT,
  permissions TEXT,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#0ea5e9',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_no TEXT,
  opening_balance REAL NOT NULL DEFAULT 0,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  insurance TEXT,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  opening_balance REAL NOT NULL DEFAULT 0,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE,
  barcode TEXT,
  name TEXT NOT NULL,
  name_en TEXT,
  category_id INTEGER REFERENCES categories(id),
  manufacturer TEXT,
  form TEXT,
  strength TEXT,
  unit TEXT,
  cost REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 10,
  reorder_qty REAL NOT NULL DEFAULT 30,
  shelf TEXT,
  requires_rx INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  batch_no TEXT,
  expiry_date TEXT,
  qty REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  supplier_id INTEGER REFERENCES suppliers(id),
  purchase_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  batch_id INTEGER REFERENCES batches(id),
  type TEXT NOT NULL,
  qty REAL NOT NULL,
  unit_cost REAL NOT NULL DEFAULT 0,
  ref_type TEXT,
  ref_id INTEGER,
  user_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_mov_product ON stock_movements(product_id);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT UNIQUE NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id),
  date TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'received',
  user_id INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  batch_id INTEGER,
  batch_no TEXT,
  expiry_date TEXT,
  qty REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  shift_id INTEGER,
  user_id INTEGER,
  date TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  change_due REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'completed',
  prescription_id INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales(shift_id);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  batch_id INTEGER,
  batch_no TEXT,
  name TEXT,
  qty REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_no TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  ref_id INTEGER,
  customer_id INTEGER,
  supplier_id INTEGER,
  shift_id INTEGER,
  date TEXT NOT NULL,
  total REAL NOT NULL DEFAULT 0,
  refund_method TEXT NOT NULL DEFAULT 'cash',
  reason TEXT,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  batch_id INTEGER,
  qty REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  opening_cash REAL NOT NULL DEFAULT 0,
  closing_cash REAL,
  expected_cash REAL,
  difference REAL,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL REFERENCES shifts(id),
  type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  reason TEXT,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rx_no TEXT UNIQUE NOT NULL,
  customer_id INTEGER,
  patient_name TEXT NOT NULL,
  doctor_name TEXT,
  doctor_phone TEXT,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  product_id INTEGER,
  name TEXT NOT NULL,
  dosage TEXT,
  qty REAL NOT NULL DEFAULT 1,
  dispensed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id INTEGER,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_no TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  ref_type TEXT,
  ref_id INTEGER,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  description TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  account_id INTEGER REFERENCES accounts(id),
  amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  description TEXT,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  details TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT,
  path TEXT,
  size INTEGER DEFAULT 0,
  type TEXT DEFAULT 'manual',
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
`;

const DEFAULT_SETTINGS = {
  pharmacy_name: 'صيدلية النور',
  pharmacy_name_en: 'Al Nour Pharmacy',
  address: '١٢ شارع التحرير – الدقي – الجيزة',
  phone: '0100 123 4567',
  email: 'info@alnour-pharmacy.com',
  tax_no: '٣١٢-٤٥٦-٧٨٩',
  license_no: 'PH-2026-8842',
  currency: 'ج.م',
  vat_rate: '14',
  receipt_footer: 'شكراً لثقتكم بنا – نتمنى لكم الشفاء العاجل',
  receipt_show_logo: '1',
  low_stock_alert: '1',
  expiry_alert_days: '90',
  default_printer: 'receipt',
  loyalty_per_point: '10',
  theme: 'auto',
  fiscal_year_start: '01-01'
};

function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function today() {
  return nowStamp().slice(0, 10);
}

function init() {
  const database = getDB();
  database.exec(SCHEMA);
  // Backward-compatible migration for user-level permissions
  try { database.exec('ALTER TABLE users ADD COLUMN permissions TEXT'); } catch (_) { /* column exists */ }
  // Ensure default settings exist
  const insertSetting = database.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(key, value);
  const userCount = database.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    require('./seed').seed();
    database.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run('installed_at', nowStamp());
  }
  return database;
}

function reconnect() {
  try { if (db) db.close(); } catch (_) { /* ignore */ }
  db = null;
  return connect();
}

module.exports = {
  DB_FILE,
  DATA_DIR,
  getDB,
  all,
  get,
  run,
  exec,
  tx,
  init,
  reconnect,
  nowStamp,
  today,
  DEFAULT_SETTINGS
};
