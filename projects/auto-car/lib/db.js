'use strict';
/* ============================================================
   Auto Car — طبقة قاعدة البيانات (SQLite عبر node:sqlite)
   بدون أي مكتبات خارجية. تدعم النسخ/الاستعادة، الحذف المنطقي،
   سجل النشاط، الترقيم التلقائي، والعملات.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'autocar.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups');

for (const dir of [DATA_DIR, BACKUP_DIR]) fs.mkdirSync(dir, { recursive: true });

let db = null;
let dbPath = DB_FILE;

/* ---------- أدوات مساعدة ---------- */
const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const pad = (n, w = 2) => String(n).padStart(w, '0');
const now = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const todayStr = (d = new Date()) => now(d).slice(0, 10);
const addDays = (dateStr, days) => {
  const d = new Date(String(dateStr).slice(0, 10) + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return todayStr(d);
};
const addMonths = (dateStr, months) => {
  const d = new Date(String(dateStr).slice(0, 10) + 'T12:00:00');
  d.setMonth(d.getMonth() + months);
  return todayStr(d);
};
const norm = (v) => {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' && !Number.isFinite(v)) return 0;
  if (typeof v === 'object' && v !== null && !Buffer.isBuffer(v)) return JSON.stringify(v);
  return v;
};

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), s, 64).toString('hex');
  return `${s}:${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt] = stored.split(':');
  const candidate = hashPassword(password, salt);
  const a = Buffer.from(candidate);
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const uuid = () => crypto.randomUUID();

/* ---------- الاتصال ---------- */
function open() {
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return db;
}
function close() {
  if (!db) return;
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch {}
  try { db.close(); } catch {}
  db = null;
}
function reopen(file = dbPath) {
  close();
  dbPath = file;
  open();
  migrate();
}
function current() { return db; }
function currentPath() { return dbPath; }

/* ---------- استعلامات ---------- */
function all(sql, ...params) {
  return db.prepare(sql).all(...params.map(norm));
}
function get(sql, ...params) {
  return db.prepare(sql).get(...params.map(norm));
}
function run(sql, ...params) {
  return db.prepare(sql).run(...params.map(norm));
}
function insert(table, data) {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  const cols = keys.join(', ');
  const marks = keys.map(() => '?').join(', ');
  const vals = keys.map((k) => norm(data[k]));
  const info = db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${marks})`).run(...vals);
  return Number(info.lastInsertRowid);
}
function update(table, id, data) {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined && k !== 'id');
  if (!keys.length) return 0;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const vals = keys.map((k) => norm(data[k]));
  const info = db.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(...vals, id);
  return info.changes;
}
function remove(table, id) {
  return db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes;
}
function transaction(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    throw e;
  }
}

/* ---------- الترقيم التلقائي ---------- */
function nextNumber(key, prefix = '') {
  const row = get('SELECT value FROM counters WHERE key = ?', key);
  const next = (row ? Number(row.value) : 0) + 1;
  if (row) run('UPDATE counters SET value = ? WHERE key = ?', next, key);
  else run('INSERT INTO counters (key, value) VALUES (?, ?)', key, next);
  return `${prefix}${pad(next, 5)}`;
}
function peekNumber(key) {
  const row = get('SELECT value FROM counters WHERE key = ?', key);
  return Number(row ? row.value : 0) + 1;
}

/* ---------- الإعدادات ---------- */
function settingsAll() {
  const out = {};
  for (const r of all('SELECT key, value FROM settings')) out[r.key] = r.value;
  return out;
}
function settingGet(key, def = null) {
  const r = get('SELECT value FROM settings WHERE key = ?', key);
  return r ? r.value : def;
}
function settingSet(key, value) {
  const v = norm(value);
  if (get('SELECT 1 FROM settings WHERE key = ?', key)) run('UPDATE settings SET value = ? WHERE key = ?', v, key);
  else run('INSERT INTO settings (key, value) VALUES (?, ?)', key, v);
  return true;
}
function settingsSet(obj) {
  for (const [k, v] of Object.entries(obj)) settingSet(k, v);
  return true;
}

/* ---------- سجل النشاط ---------- */
function audit({ user_id = null, user_name = null, action, entity = null, entity_id = null, details = null, ip = null }) {
  run(
    'INSERT INTO activity (user_id, user_name, action, entity, entity_id, details, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    user_id, user_name, action, entity, entity_id,
    typeof details === 'string' ? details : details ? JSON.stringify(details) : null, ip, now()
  );
}

/* ---------- الحذف المنطقي والاسترجاع ---------- */
const SOFT_TABLES = new Set([
  'users', 'brands', 'car_types', 'car_models', 'colors', 'customers', 'suppliers',
  'vehicles', 'vehicle_expenses', 'purchases', 'sales', 'installment_plans',
  'consignment_settlements', 'accounts', 'journal_entries', 'treasuries', 'vouchers', 'notifications',
]);
function softDelete(table, id, ctx = {}) {
  if (!SOFT_TABLES.has(table)) throw new Error('جدول لا يدعم الحذف المنطقي');
  const before = get(`SELECT * FROM ${table} WHERE id = ?`, id);
  if (!before) return 0;
  const ch = update(table, id, { deleted_at: now() });
  audit({ ...ctx, action: 'delete', entity: table, entity_id: id, details: summarize(before) });
  return ch;
}
function restore(table, id, ctx = {}) {
  if (!SOFT_TABLES.has(table)) throw new Error('جدول لا يدعم الاسترجاع');
  const ch = update(table, id, { deleted_at: null });
  audit({ ...ctx, action: 'restore', entity: table, entity_id: id });
  return ch;
}
function purge(table, id, ctx = {}) {
  const before = get(`SELECT * FROM ${table} WHERE id = ?`, id);
  const ch = remove(table, id);
  audit({ ...ctx, action: 'purge', entity: table, entity_id: id, details: before ? summarize(before) : null });
  return ch;
}
function listDeleted(table, { limit = 200 } = {}) {
  if (!SOFT_TABLES.has(table)) return [];
  return all(`SELECT * FROM ${table} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT ?`, limit);
}
function deletedCounts() {
  const out = [];
  for (const t of SOFT_TABLES) {
    const c = get(`SELECT COUNT(*) AS c FROM ${t} WHERE deleted_at IS NOT NULL`).c;
    if (c) out.push({ table: t, count: c });
  }
  return out;
}
function summarize(row) {
  const o = {};
  for (const k of ['id', 'name', 'name_en', 'code', 'invoice_no', 'entry_no', 'voucher_no', 'username', 'title', 'amount', 'total']) {
    if (row[k] !== undefined && row[k] !== null) o[k] = row[k];
  }
  return o;
}

/* ---------- تفريغ الجداول ---------- */
function truncate(tables, ctx = {}) {
  const allow = new Set([
    'vehicles', 'vehicle_expenses', 'vehicle_images', 'purchases', 'purchase_items',
    'sales', 'sale_items', 'installment_plans', 'installments', 'installment_payments',
    'consignment_settlements', 'journal_entries', 'journal_lines', 'vouchers', 'notifications',
    'import_logs', 'customers', 'suppliers', 'brands', 'car_models', 'car_types', 'colors',
  ]);
  const done = [];
  transaction(() => {
    for (const t of tables) {
      if (!allow.has(t)) continue;
      run(`DELETE FROM ${t}`);
      done.push(t);
    }
  });
  audit({ ...ctx, action: 'truncate', details: { tables: done } });
  return done;
}

/* ---------- النسخ الاحتياطي ---------- */
function safeCheckpoint() {
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch {}
}
function backupTo(dir, { kind = 'manual', note = null, userId = null } = {}) {
  safeCheckpoint();
  const target = dir || BACKUP_DIR;
  fs.mkdirSync(target, { recursive: true });
  const stamp = now().replace(/[: ]/g, '-');
  const filename = `autocar-${stamp}-${kind}.db`;
  const dest = path.join(target, filename);
  fs.copyFileSync(dbPath, dest);
  const size = fs.statSync(dest).size;
  insert('backups', { filename, path: dest, size, kind, note, user_id: userId, created_at: now() });
  return { filename, path: dest, size };
}
function listBackups(dir) {
  const target = dir || BACKUP_DIR;
  if (!fs.existsSync(target)) return [];
  return fs.readdirSync(target)
    .filter((f) => f.toLowerCase().endsWith('.db'))
    .map((f) => {
      const full = path.join(target, f);
      const st = fs.statSync(full);
      return { filename: f, path: full, size: st.size, created_at: now(st.mtime) };
    })
    .sort((a, b) => (a.filename < b.filename ? 1 : -1));
}
function pruneBackups(dir, days = 30) {
  const target = dir || BACKUP_DIR;
  if (!fs.existsSync(target)) return 0;
  const cutoff = Date.now() - days * 86400000;
  let removed = 0;
  for (const f of fs.readdirSync(target)) {
    if (!f.toLowerCase().endsWith('.db')) continue;
    const full = path.join(target, f);
    try {
      if (fs.statSync(full).mtimeMs < cutoff) { fs.unlinkSync(full); removed++; }
    } catch {}
  }
  return removed;
}
function restoreFrom(file, ctx = {}) {
  if (!fs.existsSync(file)) throw new Error('ملف النسخة الاحتياطية غير موجود');
  // نسخة أمان قبل الاستعادة
  try { backupTo(BACKUP_DIR, { kind: 'pre_restore', note: 'قبل الاستعادة', userId: ctx.user_id }); } catch {}
  close();
  fs.copyFileSync(file, dbPath);
  for (const ext of ['-wal', '-shm']) { try { fs.unlinkSync(dbPath + ext); } catch {} }
  open();
  migrate();
  audit({ ...ctx, action: 'restore_db', details: { file } });
  return true;
}
function dbStats() {
  const size = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
  const counts = {};
  for (const t of ['vehicles', 'customers', 'suppliers', 'sales', 'purchases', 'journal_entries', 'users', 'installment_plans']) {
    try { counts[t] = get(`SELECT COUNT(*) AS c FROM ${t}`).c; } catch { counts[t] = 0; }
  }
  return { path: dbPath, size, counts, backup_dir: BACKUP_DIR };
}

/* ---------- الترحيل والبذور ---------- */
function ensureColumn(table, column, ddl) {
  const cols = all(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}
function migrate() {
  const schemaFile = path.join(ROOT, 'schema', '001_init.sql');
  db.exec(fs.readFileSync(schemaFile, 'utf8'));
  seedSettings();
  seedCurrencies();
  seedUsers();
  ensureDefaultAdmin();
  seedAccounts();
  seedTreasuries();
  seedFiscalYear();
  seedCarReference();
  seedNotifications();
  seedDemoData();
}

const DEFAULT_SETTINGS = {
  company_name: 'أوتو كار للسيارات',
  company_name_en: 'Auto Car Motors',
  currency: 'EGP',
  currency_symbol: 'ج.م',
  tax_rate: '0',
  logo: '',
  login_car: '',
  phone: '0100 000 0000',
  phone2: '',
  email: 'info@autocar.local',
  address: 'الطريق الدائري — معرض السيارات',
  website: '',
  invoice_footer: 'شكراً لتعاملكم معنا — أوتو كار للسيارات',
  language: 'ar',
  theme: 'light',
  fiscal_year_start: '01-01',
  auto_backup_enabled: '1',
  auto_backup_interval_hours: '24',
  backup_retention_days: '30',
  backup_dir: BACKUP_DIR,
  installment_reminder_days: '7',
  doc_expiry_reminder_days: '30',
  default_commission_percent: '2.5',
};
function seedSettings() {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    if (!get('SELECT 1 FROM settings WHERE key = ?', k)) settingSet(k, v);
  }
}

function seedCurrencies() {
  if (get('SELECT COUNT(*) AS c FROM currencies').c) return;
  const t = now();
  const rows = [
    ['EGP', 'جنيه مصري', 'Egyptian Pound', 'ج.م', 1, 1],
    ['USD', 'دولار أمريكي', 'US Dollar', '$', 48.5, 0],
    ['SAR', 'ريال سعودي', 'Saudi Riyal', 'ر.س', 12.93, 0],
    ['AED', 'درهم إماراتي', 'UAE Dirham', 'د.إ', 13.21, 0],
    ['EUR', 'يورو', 'Euro', '€', 52.4, 0],
  ];
  for (const [code, name, name_en, symbol, rate, is_base] of rows) {
    insert('currencies', { code, name, name_en, symbol, rate, is_base, decimals: 2, active: 1, created_at: t });
  }
}

function seedUsers() {
  if (get('SELECT COUNT(*) AS c FROM users').c) return;
  insert('users', {
    name: 'مدير النظام', username: 'admin', password_hash: hashPassword('admin123'),
    role: 'admin', permissions: '["*"]', active: 1, created_at: now(),
  });
  insert('users', {
    name: 'محاسب', username: 'accountant', password_hash: hashPassword('account123'),
    role: 'accountant', permissions: '["accounting","reports","customers","suppliers","vehicles.view"]', active: 1, created_at: now(),
  });
  insert('users', {
    name: 'مبيعات', username: 'sales', password_hash: hashPassword('sales123'),
    role: 'sales', permissions: '["sales","vehicles","customers","installments"]', active: 1, created_at: now(),
  });
}

function ensureDefaultAdmin() {
  const t = now();
  const admin = get("SELECT id FROM users WHERE lower(username) = 'admin' AND deleted_at IS NULL");
  if (!admin) {
    insert('users', {
      name: 'مدير النظام', username: 'admin', password_hash: hashPassword('admin123'),
      role: 'admin', permissions: '["*"]', active: 1, created_at: t,
    });
  } else {
    run('UPDATE users SET role=?, permissions=?, active=1, updated_at=? WHERE id=?', 'admin', '["*"]', t, admin.id);
  }

}

function seedAccounts() {
  if (get('SELECT COUNT(*) AS c FROM accounts').c) return;
  const t = now();
  const add = (code, name, name_en, type, parent_id, opts = {}) =>
    insert('accounts', {
      code, name, name_en, type, parent_id: parent_id || null,
      is_group: opts.group ? 1 : 0, nature: opts.nature || (type === 'asset' || type === 'expense' ? 'debit' : 'credit'),
      is_cash: opts.cash ? 1 : 0, is_bank: opts.bank ? 1 : 0, active: 1, created_at: t,
    });
  const a1 = add('1', 'الأصول', 'Assets', 'asset', null, { group: true });
  const a11 = add('11', 'الأصول المتداولة', 'Current Assets', 'asset', a1, { group: true });
  add('1101', 'النقدية بالصندوق', 'Cash on Hand', 'asset', a11, { cash: true });
  add('1102', 'النقدية بالبنوك', 'Cash at Banks', 'asset', a11, { bank: true });
  add('1103', 'العملاء (المدينون)', 'Accounts Receivable', 'asset', a11);
  add('1104', 'مخزون السيارات', 'Vehicles Inventory', 'asset', a11);
  add('1105', 'مصروفات مدفوعة مقدماً', 'Prepaid Expenses', 'asset', a11);
  const a12 = add('12', 'الأصول غير المتداولة', 'Non-current Assets', 'asset', a1, { group: true });
  add('1201', 'الأصول الثابتة', 'Fixed Assets', 'asset', a12);
  add('1202', 'مجمع إهلاك الأصول الثابتة', 'Accumulated Depreciation', 'asset', a12, { nature: 'credit' });

  const a2 = add('2', 'الخصوم (الالتزامات)', 'Liabilities', 'liability', null, { group: true });
  const a21 = add('21', 'الخصوم المتداولة', 'Current Liabilities', 'liability', a2, { group: true });
  add('2101', 'الموردون (الدائنون)', 'Accounts Payable', 'liability', a21);
  add('2102', 'أقساط مستحقة (تمويل)', 'Installments Payable', 'liability', a21);
  add('2103', 'ضريبة القيمة المضافة المستحقة', 'VAT Payable', 'liability', a21);
  add('2104', 'مصروفات مستحقة', 'Accrued Expenses', 'liability', a21);
  const a22 = add('22', 'خصوم طويلة الأجل', 'Long-term Liabilities', 'liability', a2, { group: true });
  add('2201', 'قروض طويلة الأجل', 'Long-term Loans', 'liability', a22);

  const a3 = add('3', 'حقوق الملكية', 'Equity', 'equity', null, { group: true });
  add('3101', 'رأس المال', 'Capital', 'equity', a3);
  add('3102', 'الأرباح المحتجزة', 'Retained Earnings', 'equity', a3);
  add('3103', 'المسحوبات الشخصية', 'Owner Drawings', 'equity', a3, { nature: 'debit' });

  const a4 = add('4', 'الإيرادات', 'Revenue', 'revenue', null, { group: true });
  add('4101', 'إيرادات بيع السيارات', 'Vehicle Sales Revenue', 'revenue', a4);
  add('4102', 'إيرادات العمولات (وسيط)', 'Commission Revenue', 'revenue', a4);
  add('4103', 'إيرادات أخرى', 'Other Revenue', 'revenue', a4);
  add('4104', 'مردودات ومسموحات المبيعات', 'Sales Returns & Allowances', 'revenue', a4, { nature: 'debit' });

  const a5 = add('5', 'المصروفات', 'Expenses', 'expense', null, { group: true });
  const a51 = add('51', 'تكلفة النشاط', 'Cost of Sales', 'expense', a5, { group: true });
  add('5101', 'تكلفة السيارات المباعة', 'Cost of Vehicles Sold', 'expense', a51);
  const a52 = add('52', 'المصروفات التشغيلية', 'Operating Expenses', 'expense', a5, { group: true });
  add('5201', 'رواتب وأجور', 'Salaries & Wages', 'expense', a52);
  add('5202', 'إيجار', 'Rent', 'expense', a52);
  add('5203', 'كهرباء ومياه', 'Utilities', 'expense', a52);
  add('5204', 'مصاريف تسويق وإعلان', 'Marketing & Advertising', 'expense', a52);
  add('5205', 'مصاريف تجهيز سيارات', 'Vehicle Preparation', 'expense', a52);
  add('5206', 'عمولات بيع مدفوعة', 'Sales Commissions Paid', 'expense', a52);
  add('5207', 'مصاريف إدارية وعمومية', 'General & Admin', 'expense', a52);
  add('5208', 'مصاريف بنكية', 'Bank Charges', 'expense', a52);
  add('5209', 'إهلاك الأصول الثابتة', 'Depreciation', 'expense', a52);
}

function seedTreasuries() {
  if (get('SELECT COUNT(*) AS c FROM treasuries').c) return;
  const t = now();
  const cashAcc = get("SELECT id FROM accounts WHERE code = '1101'");
  const bankAcc = get("SELECT id FROM accounts WHERE code = '1102'");
  const egp = get("SELECT id FROM currencies WHERE code = 'EGP'");
  insert('treasuries', { name: 'الصندوق الرئيسي', name_en: 'Main Cash', kind: 'cash', account_id: cashAcc?.id, currency_id: egp?.id, opening_balance: 0, balance: 0, active: 1, created_at: t });
  insert('treasuries', { name: 'البنك الرئيسي', name_en: 'Main Bank', kind: 'bank', account_id: bankAcc?.id, currency_id: egp?.id, opening_balance: 0, balance: 0, bank_name: 'البنك الرئيسي', active: 1, created_at: t });
}

function seedFiscalYear() {
  if (get('SELECT COUNT(*) AS c FROM fiscal_years').c) return;
  const y = new Date().getFullYear();
  insert('fiscal_years', { name: `السنة المالية ${y}`, start_date: `${y}-01-01`, end_date: `${y}-12-31`, status: 'open', created_at: now() });
}

function seedCarReference() {
  if (!get('SELECT COUNT(*) AS c FROM car_types').c) {
    const t = now();
    for (const [n, en] of [['سيدان', 'Sedan'], ['هاتشباك', 'Hatchback'], ['SUV', 'SUV'], ['كروس أوفر', 'Crossover'], ['بيك أب', 'Pickup'], ['كوبيه', 'Coupe'], ['فان', 'Van'], ['ميني باص', 'Minibus']])
      insert('car_types', { name: n, name_en: en, active: 1, created_at: t });
  }
  if (!get('SELECT COUNT(*) AS c FROM colors').c) {
    const t = now();
    for (const [n, en, hex] of [['أبيض', 'White', '#f8fafc'], ['أسود', 'Black', '#111827'], ['فضي', 'Silver', '#cbd5e1'], ['رمادي', 'Grey', '#6b7280'], ['أحمر', 'Red', '#dc2626'], ['أزرق', 'Blue', '#2563eb'], ['بيج', 'Beige', '#d6c7a1'], ['بني', 'Brown', '#78350f'], ['أخضر', 'Green', '#059669'], ['ذهبي', 'Gold', '#b45309'], ['برتقالي', 'Orange', '#ea580c'], ['أصفر', 'Yellow', '#eab308']])
      insert('colors', { name: n, name_en: en, hex, active: 1, created_at: t });
  }
  if (!get('SELECT COUNT(*) AS c FROM brands').c) {
    const t = now();
    const brands = [['تويوتا', 'Toyota', 'اليابان'], ['هيونداي', 'Hyundai', 'كوريا الجنوبية'], ['كيا', 'Kia', 'كوريا الجنوبية'], ['نيسان', 'Nissan', 'اليابان'], ['مرسيدس-بنز', 'Mercedes-Benz', 'ألمانيا'], ['بي إم دبليو', 'BMW', 'ألمانيا'], ['شيفروليه', 'Chevrolet', 'أمريكا'], ['إم جي', 'MG', 'الصين'], ['شيري', 'Chery', 'الصين'], ['رينو', 'Renault', 'فرنسا'], ['بيجو', 'Peugeot', 'فرنسا'], ['سكودا', 'Skoda', 'التشيك'], ['فولكس فاجن', 'Volkswagen', 'ألمانيا'], ['أودي', 'Audi', 'ألمانيا'], ['ميتسوبيشي', 'Mitsubishi', 'اليابان'], ['سوزوكي', 'Suzuki', 'اليابان'], ['فيات', 'Fiat', 'إيطاليا'], ['أوبل', 'Opel', 'ألمانيا'], ['فورد', 'Ford', 'أمريكا'], ['جيب', 'Jeep', 'أمريكا'], ['هافال', 'Haval', 'الصين'], ['جيلي', 'Geely', 'الصين'], ['بي واي دي', 'BYD', 'الصين'], ['تسلا', 'Tesla', 'أمريكا']];
    const typeId = (en) => get('SELECT id FROM car_types WHERE name_en = ?', en)?.id || null;
    for (const [n, en, country] of brands) insert('brands', { name: n, name_en: en, country, active: 1, created_at: t });
    // طرازات شائعة
    const models = [
      ['Toyota', 'كورولا', 'Corolla', 'Sedan'], ['Toyota', 'كامري', 'Camry', 'Sedan'], ['Toyota', 'ياريس', 'Yaris', 'Hatchback'], ['Toyota', 'راف فور', 'RAV4', 'SUV'],
      ['Hyundai', 'إلنترا', 'Elantra', 'Sedan'], ['Hyundai', 'توسان', 'Tucson', 'SUV'], ['Hyundai', 'أكسنت', 'Accent', 'Sedan'], ['Hyundai', 'كريتا', 'Creta', 'Crossover'],
      ['Kia', 'سيراتو', 'Cerato', 'Sedan'], ['Kia', 'سبورتاج', 'Sportage', 'SUV'], ['Kia', 'ريو', 'Rio', 'Sedan'],
      ['Nissan', 'صني', 'Sunny', 'Sedan'], ['Nissan', 'قشقاي', 'Qashqai', 'Crossover'], ['Nissan', 'باترول', 'Patrol', 'SUV'],
      ['MG', 'MG5', 'MG5', 'Sedan'], ['MG', 'MG ZS', 'MG ZS', 'SUV'], ['MG', 'MG6', 'MG6', 'Sedan'],
      ['Chery', 'تيجو 7', 'Tiggo 7', 'SUV'], ['Chery', 'تيجو 4', 'Tiggo 4', 'Crossover'], ['Chery', 'أريزو 5', 'Arrizo 5', 'Sedan'],
      ['Mercedes-Benz', 'C-Class', 'C-Class', 'Sedan'], ['Mercedes-Benz', 'E-Class', 'E-Class', 'Sedan'], ['BMW', 'الفئة الثالثة', '3 Series', 'Sedan'], ['BMW', 'X5', 'X5', 'SUV'],
      ['Chevrolet', 'أوبترا', 'Optra', 'Sedan'], ['Chevrolet', 'لانوس', 'Lanos', 'Sedan'],
    ];
    for (const [brandEn, n, en, typeEn] of models) {
      const b = get('SELECT id FROM brands WHERE name_en = ?', brandEn);
      if (b) insert('car_models', { brand_id: b.id, name: n, name_en: en, type_id: typeId(typeEn), active: 1, created_at: t });
    }
  }
}

function seedNotifications() {
  // لا نبذر تنبيهات ثابتة؛ تُولَّد ديناميكيًا حسب الأقساط والتواريخ.
}

/* بيانات تجريبية لعرض شكل الصفحات (تُضاف مرة واحدة عند خلو بيانات التشغيل) */
function seedDemoData() {
  try {
    if (get('SELECT COUNT(*) AS c FROM customers').c || get('SELECT COUNT(*) AS c FROM vehicles').c) return;

    const t = now();
    const d0 = todayStr();
    const admin = get("SELECT id, name FROM users WHERE deleted_at IS NULL ORDER BY id LIMIT 1");
    const uid = admin ? admin.id : null;
    const uname = admin ? admin.name : 'النظام';
    const egp = get("SELECT id FROM currencies WHERE is_base = 1 OR code = 'EGP' ORDER BY id LIMIT 1");
    const curId = egp ? egp.id : null;
    const cashTr = get("SELECT id FROM treasuries WHERE kind = 'cash' AND deleted_at IS NULL ORDER BY id LIMIT 1");
    const bankTr = get("SELECT id FROM treasuries WHERE kind = 'bank' AND deleted_at IS NULL ORDER BY id LIMIT 1");
    const treasuryId = cashTr ? cashTr.id : (bankTr ? bankTr.id : null);

    // عملاء
    const customers = [
      { name: 'شركة الأفق للتجارة', name_en: 'Al Ofoq Trading', phone: '01010001001', email: 'ofuq@example.com', address: 'القاهرة - مدينة نصر', national_id: '29801011234567', kind: 'company', balance: 0, credit_limit: 500000, notes: 'عميل شركات', active: 1, created_at: t },
      { name: 'محمد أحمد علي', phone: '01022223333', address: 'الجيزة - الدقي', national_id: '29005051234567', kind: 'individual', balance: 0, credit_limit: 200000, notes: 'عميل أفراد', active: 1, created_at: t },
      { name: 'سارة محمود', phone: '01133334444', address: 'الإسكندرية', national_id: '29507071234567', kind: 'individual', balance: 45000, credit_limit: 150000, notes: 'قسط قائم', active: 1, created_at: t },
      { name: 'مؤسسة روافد', name_en: 'Rawafed Est.', phone: '01255556666', kind: 'company', balance: 0, credit_limit: 300000, active: 1, created_at: t },
    ];
    const customerIds = customers.map(c => insert('customers', c));

    // موردون
    const suppliers = [
      { name: 'معرض النجم للسيارات', phone: '01044445555', address: 'القاهرة - المقطم', kind: 'dealer', balance: 0, notes: 'مورد رئيسي', active: 1, created_at: t },
      { name: 'شركة المدار للاستيراد', phone: '01066667777', kind: 'company', balance: 120000, active: 1, created_at: t },
      { name: 'خالد إبراهيم', phone: '01088889999', kind: 'individual', balance: 0, notes: 'مالك وسيط', active: 1, created_at: t },
    ];
    const supplierIds = suppliers.map(s => insert('suppliers', s));

    const brand = (en) => get('SELECT id FROM brands WHERE name_en = ? AND deleted_at IS NULL', en) || get('SELECT id FROM brands WHERE deleted_at IS NULL ORDER BY id LIMIT 1');
    const modelBy = (en) => get('SELECT id, brand_id FROM car_models WHERE name_en = ? AND deleted_at IS NULL', en) || get('SELECT id, brand_id FROM car_models WHERE deleted_at IS NULL ORDER BY id LIMIT 1');
    const color = (en) => get('SELECT id FROM colors WHERE name_en = ? AND deleted_at IS NULL', en) || get('SELECT id FROM colors WHERE deleted_at IS NULL ORDER BY id LIMIT 1');
    const typeBy = (en) => get('SELECT id FROM car_types WHERE name_en = ? AND deleted_at IS NULL', en) || get('SELECT id FROM car_types WHERE deleted_at IS NULL ORDER BY id LIMIT 1');

    const vehicleDefs = [
      { model: 'Corolla', brand: 'Toyota', color: 'White', type: 'Sedan', year: 2023, condition: 'used', mileage: 32000, trans: 'automatic', fuel: 'petrol', cost: 520000, target: 575000, status: 'available', plate: 'ق أ ب 1234' },
      { model: 'Tucson', brand: 'Hyundai', color: 'Silver', type: 'SUV', year: 2024, condition: 'new', mileage: 0, trans: 'automatic', fuel: 'petrol', cost: 980000, target: 1095000, status: 'available', plate: '' },
      { model: 'Cerato', brand: 'Kia', color: 'Black', type: 'Sedan', year: 2022, condition: 'used', mileage: 54000, trans: 'automatic', fuel: 'petrol', cost: 430000, target: 485000, status: 'reserved', plate: 'س ص ع 7788' },
      { model: 'Sunny', brand: 'Nissan', color: 'Grey', type: 'Sedan', year: 2021, condition: 'used', mileage: 68000, trans: 'automatic', fuel: 'petrol', cost: 310000, target: 355000, status: 'sold', plate: 'م ن ه 4567', sale: 350000 },
      { model: 'MG ZS', brand: 'MG', color: 'Red', type: 'SUV', year: 2023, condition: 'used', mileage: 21000, trans: 'automatic', fuel: 'petrol', cost: 560000, target: 620000, status: 'available', plate: 'د ر ج 9911' },
    ];

    const vehicleIds = [];
    for (let i = 0; i < vehicleDefs.length; i++) {
      const v = vehicleDefs[i];
      const m = modelBy(v.model) || {};
      const b = brand(v.brand) || { id: m.brand_id };
      const c = color(v.color) || {};
      const ty = typeBy(v.type) || {};
      const code = nextNumber('vehicle', 'CAR-');
      const vid = insert('vehicles', {
        code, vin: '', chassis_no: '', engine_no: '', plate_no: v.plate || '',
        brand_id: b.id || m.brand_id || null, model_id: m.id || null, type_id: ty.id || null, color_id: c.id || null,
        year: v.year, condition: v.condition, mileage: v.mileage, transmission: v.trans, fuel: v.fuel,
        ownership: 'own', cost_price: v.cost, extra_cost: 0, target_price: v.target, sale_price: v.sale || 0,
        currency_id: curId, status: v.status, supplier_id: supplierIds[i % supplierIds.length], purchase_date: addDays(d0, -30 + i * 3),
        entry_date: addDays(d0, -28 + i * 3), images: '[]', notes: 'سيارة تجريبية للعرض', active: 1, created_by: uid, created_at: t,
      });
      vehicleIds.push(vid);
    }

    // شراء تجريبي بسيط
    try {
      const pinv = nextNumber('purchase', 'PUR-');
      const pSubtotal = 520000 + 980000;
      const pid = insert('purchases', {
        invoice_no: pinv, supplier_id: supplierIds[0], date: addDays(d0, -25), subtotal: pSubtotal, discount: 0, tax: 0,
        total: pSubtotal, paid: pSubtotal, remaining: 0, payment_method: 'transfer', treasury_id: bankTr ? bankTr.id : treasuryId,
        currency_id: curId, exchange_rate: 1, note: 'شراء تجريبي', status: 'completed', user_id: uid, created_at: t,
      });
      insert('purchase_items', { purchase_id: pid, vehicle_id: vehicleIds[0], description: 'تويوتا كورولا 2023', price: 520000, total: 520000 });
      insert('purchase_items', { purchase_id: pid, vehicle_id: vehicleIds[1], description: 'هيونداي توسان 2024', price: 980000, total: 980000 });
    } catch {}

    // بيع تجريبي بسيط (السيارة المباعة)
    try {
      const sinv = nextNumber('sale', 'SAL-');
      const soldVehicle = vehicleDefs[3];
      const sid = insert('sales', {
        invoice_no: sinv, customer_id: customerIds[1], date: addDays(d0, -7), sale_type: 'cash', subtotal: soldVehicle.sale,
        discount: 0, tax: 0, total: soldVehicle.sale, paid: soldVehicle.sale, remaining: 0, payment_method: 'cash',
        treasury_id: treasuryId, currency_id: curId, exchange_rate: 1, cost_total: soldVehicle.cost,
        profit: soldVehicle.sale - soldVehicle.cost, note: 'بيع نقدي تجريبي', status: 'completed', user_id: uid, created_at: t,
      });
      insert('sale_items', { sale_id: sid, vehicle_id: vehicleIds[3], description: 'نيسان صني 2021', price: soldVehicle.sale, cost: soldVehicle.cost, total: soldVehicle.sale });
      update('vehicles', vehicleIds[3], { sale_price: soldVehicle.sale, status: 'sold' });
    } catch {}

    // مصروفات مركبة وتجربة خزنة
    try {
      insert('vehicle_expenses', { vehicle_id: vehicleIds[0], kind: 'تجهيز', description: 'غسيل وتلميع وتجهيز', amount: 2500, date: addDays(d0, -20), treasury_id: treasuryId, user_id: uid, created_at: t });
      insert('vehicle_expenses', { vehicle_id: vehicleIds[4], kind: 'صيانة', description: 'فحص وصيانة دورية', amount: 1800, date: addDays(d0, -10), treasury_id: treasuryId, user_id: uid, created_at: t });
    } catch {}

    // سندات تجريبية
    try {
      insert('vouchers', { voucher_no: nextNumber('voucher', 'VCH-'), kind: 'receipt', date: addDays(d0, -6), treasury_id: treasuryId, party_type: 'customer', party_id: customerIds[1], amount: 350000, currency_id: curId, exchange_rate: 1, method: 'cash', description: 'تحصيل ثمن سيارة نيسان صني', user_id: uid, created_at: t });
      insert('vouchers', { voucher_no: nextNumber('voucher', 'VCH-'), kind: 'payment', date: addDays(d0, -24), treasury_id: bankTr ? bankTr.id : treasuryId, party_type: 'supplier', party_id: supplierIds[0], amount: 1500000, currency_id: curId, exchange_rate: 1, method: 'transfer', description: 'سداد دفعة لمورد', user_id: uid, created_at: t });
    } catch {}

    try { audit({ user_id: uid, user_name: uname, action: 'seed_demo', entity: 'system', details: 'Demo data seeded' }); } catch {}
  } catch (e) {
    console.error('demo seed (auto-car) failed:', e && e.message ? e.message : e);
  }
}

module.exports = {
  ROOT, DATA_DIR, DB_FILE, BACKUP_DIR,
  open, close, reopen, current, currentPath, migrate,
  all, get, run, insert, update, remove, transaction,
  nextNumber, peekNumber,
  settingsAll, settingGet, settingSet, settingsSet,
  audit,
  softDelete, restore, purge, listDeleted, deletedCounts,
  truncate,
  backupTo, listBackups, pruneBackups, restoreFrom, dbStats, safeCheckpoint,
  hashPassword, verifyPassword, uuid,
  round2, now, todayStr, addDays, addMonths,
  SOFT_TABLES,
};
