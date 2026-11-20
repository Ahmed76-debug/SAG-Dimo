'use strict';
/* ============================================================
   سوق البركة — طبقة قاعدة البيانات (SQLite عبر node:sqlite)
   بدون أي مكتبات خارجية. تدعم النسخ والاستعادة وإعادة الفتح.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'baraka.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups');

for (const dir of [DATA_DIR, BACKUP_DIR]) fs.mkdirSync(dir, { recursive: true });

let db = null;
let dbPath = DB_FILE;

/* ---------- أدوات مساعدة ---------- */
const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const now = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const todayStr = (d = new Date()) => now(d).slice(0, 10);
const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return todayStr(d);
};
const norm = (v) => {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' && !Number.isFinite(v)) return 0;
  if (typeof v === 'object' && v !== null && !Buffer.isBuffer(v)) return JSON.stringify(v);
  return v;
};

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

function ensureColumn(table, column, ddl) {
  const cols = all(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

function migrate() {
  const schemaFile = path.join(ROOT, 'schema', '001_init.sql');
  const sql = fs.readFileSync(schemaFile, 'utf8');
  db.exec(sql);
  // ترقية قواعد البيانات القديمة: إضافة أعمدة الفروع دون فقدان البيانات
  for (const [table, column, ddl] of [
    ['users', 'branch_id', 'INTEGER REFERENCES branches(id)'],
    ['shifts', 'branch_id', 'INTEGER REFERENCES branches(id)'],
    ['sales', 'branch_id', 'INTEGER REFERENCES branches(id)'],
    ['holds', 'branch_id', 'INTEGER REFERENCES branches(id)'],
    ['purchases', 'branch_id', 'INTEGER REFERENCES branches(id)'],
    ['returns', 'branch_id', 'INTEGER REFERENCES branches(id)'],
    ['stock_moves', 'branch_id', 'INTEGER REFERENCES branches(id)'],
    ['expenses', 'branch_id', 'INTEGER REFERENCES branches(id)'],
    ['payments', 'branch_id', 'INTEGER REFERENCES branches(id)'],
  ]) ensureColumn(table, column, ddl);
  seedSettings();
}

const DEFAULT_BRANCHES = [
  { name: 'الفرع الرئيسي', code: 'MAIN', phone: '0100 123 4567', address: 'شارع السوق التجاري — القاهرة', is_default: 1 },
  { name: 'فرع المعادي', code: 'MAADI', phone: '0100 234 5678', address: 'شارع 9 — المعادي', is_default: 0 },
  { name: 'فرع مدينة نصر', code: 'NASR', phone: '0100 345 6789', address: 'عباس العقاد — مدينة نصر', is_default: 0 },
];

/* إنشاء الفروع مرة واحدة، وتوزيع أرصدة المنتجات الحالية على الفروع */
function seedBranches() {
  if (get('SELECT COUNT(*) AS c FROM branches').c) return false;
  const t = now();
  for (const b of DEFAULT_BRANCHES) {
    run('INSERT INTO branches (name, code, phone, address, active, is_default, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
      b.name, b.code, b.phone, b.address, b.is_default, t);
  }
  const ids = all('SELECT id FROM branches ORDER BY id').map((b) => b.id);
  if (!ids.length) return true;
  const products = all('SELECT id, stock FROM products WHERE active = 1');
  for (const p of products) {
    const shares = [round2(p.stock * 0.6), round2(p.stock * 0.25)];
    shares.push(round2(p.stock - shares[0] - shares[1]));
    ids.forEach((bid, i) => run('INSERT OR IGNORE INTO product_stock (product_id, branch_id, stock) VALUES (?, ?, ?)', p.id, bid, shares[i] ?? 0));
  }
  for (const table of ['sales', 'purchases', 'expenses', 'shifts', 'stock_moves', 'payments', 'holds', 'returns']) {
    try { run(`UPDATE ${table} SET branch_id = ? WHERE branch_id IS NULL`, ids[0]); } catch {}
  }
  return true;
}

function branchDefaultId() {
  const row = get('SELECT id FROM branches WHERE active = 1 ORDER BY is_default DESC, id LIMIT 1');
  return row ? row.id : 1;
}

function branchStock(productId, branchId) {
  const row = get('SELECT stock FROM product_stock WHERE product_id = ? AND branch_id = ?', productId, branchId);
  return row ? Number(row.stock) : 0;
}

function setBranchStock(productId, branchId, stock) {
  const value = round2(stock);
  const exists = get('SELECT 1 AS x FROM product_stock WHERE product_id = ? AND branch_id = ?', productId, branchId);
  if (exists) run('UPDATE product_stock SET stock = ? WHERE product_id = ? AND branch_id = ?', value, productId, branchId);
  else run('INSERT INTO product_stock (product_id, branch_id, stock) VALUES (?, ?, ?)', productId, branchId, value);
  return value;
}

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
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    throw e;
  }
}

/* ---------- الترقيم التسلسلي ---------- */
function nextNumber(key, prefix = '', pad = 5) {
  // آمن للاستخدام داخل معاملة مفتوحة (كل الاستدعاءات متزامنة في Node)
  const row = get('SELECT value FROM counters WHERE key = ?', key);
  const value = (row ? row.value : 0) + 1;
  if (row) run('UPDATE counters SET value = ? WHERE key = ?', value, key);
  else run('INSERT INTO counters (key, value) VALUES (?, ?)', key, value);
  return `${prefix}${String(value).padStart(pad, '0')}`;
}

/* ---------- الإعدادات ---------- */
const DEFAULT_SETTINGS = {
  store_name: 'سوق البركة',
  store_tagline: 'سوبر ماركت • خضروات • لحوم',
  store_phone: '0100 123 4567',
  store_address: 'شارع السوق التجاري — القاهرة',
  tax_number: '',
  currency: 'ج.م',
  tax_rate: '0',
  tax_inclusive: '0',
  receipt_footer: 'شكرًا لتعاملكم معنا.. نسعد بخدمتكم دائمًا',
  receipt_width: '80',
  auto_print: '0',
  low_stock_alert: '1',
  invoice_prefix: 'INV-',
  purchase_prefix: 'PUR-',
  allow_negative_stock: '0',
  backup_folder: '',
  auto_backup: '1',
  backup_keep: '30',
  pos_quick_cash: '50,100,200,500',
  low_stock_days: '14',
};

function seedSettings() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const row = get('SELECT key FROM settings WHERE key = ?', key);
    if (!row) run('INSERT INTO settings (key, value) VALUES (?, ?)', key, String(value));
  }
}

function settingsObject() {
  const out = {};
  for (const row of all('SELECT key, value FROM settings')) out[row.key] = row.value;
  return out;
}
function setSetting(key, value) {
  const exists = get('SELECT key FROM settings WHERE key = ?', key);
  if (exists) run('UPDATE settings SET value = ? WHERE key = ?', String(value), key);
  else run('INSERT INTO settings (key, value) VALUES (?, ?)', key, String(value));
}

/* ---------- كلمات المرور ---------- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(password, stored) {
  try {
    const [alg, salt, hash] = String(stored || '').split('$');
    if (alg !== 'scrypt' || !salt || !hash) return false;
    const calc = crypto.scryptSync(String(password), salt, 64);
    const target = Buffer.from(hash, 'hex');
    return calc.length === target.length && crypto.timingSafeEqual(calc, target);
  } catch { return false; }
}

/* ============================================================
   البيانات الأولية (Seed) — تُنشأ مرة واحدة فقط
   ============================================================ */
function isSeeded() {
  const row = get('SELECT COUNT(*) AS c FROM users');
  return row && row.c > 0;
}

function ensureDefaultAdmin() {
  const t = now();
  const rolePerms = typeof seedRolePermissions === 'function' ? seedRolePermissions() : { admin: ['*'] };
  const u = get('SELECT id FROM users WHERE lower(username) = ?', 'admin');
  if (!u) {
    run(`INSERT INTO users (name, username, password_hash, role, permissions, phone, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      'مدير النظام', 'admin', hashPassword('admin123'), 'admin', JSON.stringify(rolePerms.admin || ['*']), '01000000000', t);
  } else {
    run('UPDATE users SET role=?, permissions=?, active=1, password_hash=? WHERE id=?',
      'admin', JSON.stringify(rolePerms.admin || ['*']), hashPassword('admin123'), u.id);
  }
}

function seed() {
  if (isSeeded()) { ensureDefaultAdmin(); return false; }
  const t = now();
  const rnd = mulberry32(20261026);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const rint = (a, b) => Math.floor(rnd() * (b - a + 1)) + a;
  const today = new Date();

  tx(() => {
    /* ---------- المستخدمون ---------- */
    const users = [
            { name: 'مدير النظام', username: 'admin', password: 'admin123', role: 'admin', phone: '01000000001' },
      { name: 'محمود المدير', username: 'manager', password: 'Manager@2026', role: 'manager', phone: '01000000002' },
      { name: 'سارة الكاشير', username: 'cashier', password: 'Cashier@2026', role: 'cashier', phone: '01000000003' },
      { name: 'كريم المخازن', username: 'stock', password: 'Stock@2026', role: 'stock', phone: '01000000004' },
    ];
    const rolePerms = seedRolePermissions();
    for (const u of users) {
      run(`INSERT INTO users (name, username, password_hash, role, permissions, phone, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        u.name, u.username, hashPassword(u.password), u.role, JSON.stringify(rolePerms[u.role] || []), u.phone, t);
    }

    /* ---------- التصنيفات ---------- */
    const categories = [
      { name: 'خضروات', kind: 'veg', color: '#22c55e', icon: 'carrot' },
      { name: 'فواكه', kind: 'fruits', color: '#f97316', icon: 'apple' },
      { name: 'لحوم ودواجن', kind: 'meat', color: '#ef4444', icon: 'beef' },
      { name: 'ألبان وأجبان', kind: 'dairy', color: '#3b82f6', icon: 'milk' },
      { name: 'بقالة', kind: 'grocery', color: '#eab308', icon: 'bag' },
      { name: 'مشروبات', kind: 'drinks', color: '#06b6d4', icon: 'bottle' },
      { name: 'مخبوزات', kind: 'bakery', color: '#d97706', icon: 'bread' },
      { name: 'منظفات', kind: 'cleaning', color: '#8b5cf6', icon: 'spray' },
      { name: 'مجمدات', kind: 'frozen', color: '#0ea5e9', icon: 'snow' },
    ];
    const catId = {};
    categories.forEach((c, i) => {
      const r = run('INSERT INTO categories (name, kind, color, icon, sort, active) VALUES (?, ?, ?, ?, ?, 1)',
        c.name, c.kind, c.color, c.icon, i + 1);
      catId[c.name] = Number(r.lastInsertRowid);
    });

    /* ---------- المنتجات ---------- */
    const P = (name, cat, unit, cost, price, stock, min, barcode, expiryDays) => ({
      name, cat, unit, cost, price, stock, min, barcode, expiryDays,
    });
    const products = [
      // خضروات
      P('طماطم بلدي', 'خضروات', 'كجم', 13, 18, 85, 20, '200001', 0),
      P('بطاطس', 'خضروات', 'كجم', 10, 15, 140, 25, '200002', 0),
      P('بصل أحمر', 'خضروات', 'كجم', 8, 12, 120, 20, '200003', 0),
      P('خيار', 'خضروات', 'كجم', 14, 20, 45, 15, '200004', 0),
      P('فلفل ألوان', 'خضروات', 'كجم', 25, 35, 30, 10, '200005', 0),
      P('باذنجان عروس', 'خضروات', 'كجم', 10, 15, 55, 15, '200006', 0),
      P('كوسة', 'خضروات', 'كجم', 14, 20, 40, 12, '200007', 0),
      P('جزر', 'خضروات', 'كجم', 8, 12, 60, 15, '200008', 0),
      P('بقدونس', 'خضروات', 'حزمة', 3, 5, 70, 20, '200009', 0),
      P('ليمون بلدي', 'خضروات', 'كجم', 22, 30, 25, 8, '200010', 0),
      P('بصل أخضر', 'خضروات', 'حزمة', 4, 7, 8, 15, '200011', 0),
      // فواكه
      P('تفاح أحمر', 'فواكه', 'كجم', 42, 60, 48, 12, '200101', 0),
      P('موز بلدي', 'فواكه', 'كجم', 22, 30, 36, 12, '200102', 0),
      P('برتقال أبو سرة', 'فواكه', 'كجم', 12, 18, 90, 20, '200103', 0),
      P('فراولة', 'فواكه', 'كجم', 45, 65, 18, 8, '200104', 0),
      P('عنب بناتي', 'فواكه', 'كجم', 40, 55, 22, 8, '200105', 0),
      P('مانجو عويس', 'فواكه', 'كجم', 70, 90, 15, 6, '200106', 0),
      P('جوافة', 'فواكه', 'كجم', 16, 24, 28, 10, '200107', 0),
      P('كيوي', 'فواكه', 'كجم', 55, 75, 10, 5, '200108', 0),
      // لحوم
      P('لحم بقري بلدي', 'لحوم ودواجن', 'كجم', 380, 420, 24, 8, '200201', 3),
      P('كفتة لحم', 'لحوم ودواجن', 'كجم', 400, 450, 14, 5, '200202', 2),
      P('لحم ضاني', 'لحوم ودواجن', 'كجم', 470, 520, 9, 4, '200203', 3),
      P('فراخ بلدي طازة', 'لحوم ودواجن', 'كجم', 125, 150, 32, 10, '200204', 2),
      P('صدور فراخ فيليه', 'لحوم ودواجن', 'كجم', 185, 220, 18, 6, '200205', 2),
      P('دجاج مجمد 1 كجم', 'لحوم ودواجن', 'قطعة', 95, 115, 26, 8, '200206', 180),
      P('سمك بلطي طازج', 'لحوم ودواجن', 'كجم', 75, 95, 11, 5, '200207', 1),
      P('جمبري مجمد', 'لحوم ودواجن', 'كجم', 320, 380, 6, 3, '200208', 90),
      // ألبان
      P('لبن جهينة 1 لتر', 'ألبان وأجبان', 'علبة', 34, 42, 52, 15, '200301', 12),
      P('جبنة بيضاء 250 جم', 'ألبان وأجبان', 'قطعة', 30, 38, 34, 10, '200302', 20),
      P('جبنة رومي 250 جم', 'ألبان وأجبان', 'قطعة', 80, 95, 16, 6, '200303', 45),
      P('زبادي 170 جم', 'ألبان وأجبان', 'علبة', 5, 7, 90, 30, '200304', 10),
      P('بيض كرتونة 30', 'ألبان وأجبان', 'كرتونة', 145, 165, 22, 8, '200305', 20),
      P('قشطة 100 جم', 'ألبان وأجبان', 'علبة', 12, 17, 28, 10, '200306', 14),
      P('لبن بودرة 400 جم', 'ألبان وأجبان', 'علبة', 115, 135, 12, 5, '200307', 120),
      // بقالة
      P('أرز مصري 1 كجم', 'بقالة', 'كيس', 31, 38, 95, 25, '200401', 180),
      P('مكرونة إيطاليانو 400 جم', 'بقالة', 'كيس', 11, 15, 110, 30, '200402', 240),
      P('زيت عباد الشمس 1 لتر', 'بقالة', 'زجاجة', 72, 85, 48, 15, '200403', 240),
      P('سكر 1 كجم', 'بقالة', 'كيس', 36, 42, 80, 20, '200404', 365),
      P('دقيق فاخر 1 كجم', 'بقالة', 'كيس', 21, 26, 65, 20, '200405', 180),
      P('شاي العروسة 250 جم', 'بقالة', 'علبة', 65, 78, 40, 12, '200406', 300),
      P('نسكافيه جولد 100 جم', 'بقالة', 'برطمان', 125, 145, 14, 6, '200407', 300),
      P('صلصة طماطم 320 جم', 'بقالة', 'علبة', 13, 18, 60, 20, '200408', 200),
      P('تونة قطع 140 جم', 'بقالة', 'علبة', 45, 55, 42, 15, '200409', 365),
      P('فول مدمس 400 جم', 'بقالة', 'علبة', 14, 18, 75, 20, '200410', 300),
      P('عدس أصفر 500 جم', 'بقالة', 'كيس', 27, 34, 38, 12, '200411', 200),
      P('عسل نحل 500 جم', 'بقالة', 'برطمان', 145, 175, 8, 4, '200412', 365),
      P('شيكولاتة كيت كات', 'بقالة', 'قطعة', 17, 22, 65, 20, '200413', 120),
      // مشروبات
      P('كوكاكولا 1 لتر', 'مشروبات', 'زجاجة', 24, 30, 72, 24, '200501', 120),
      P('عصير جوافة 1 لتر', 'مشروبات', 'كرتونة', 25, 32, 30, 10, '200502', 60),
      P('مياه معدنية 1.5 لتر', 'مشروبات', 'زجاجة', 6, 9, 120, 40, '200503', 180),
      P('شاي ليبتون 100 فتلة', 'مشروبات', 'علبة', 80, 95, 18, 8, '200504', 240),
      P('قهوة تركي 200 جم', 'مشروبات', 'علبة', 70, 85, 16, 6, '200505', 240),
      P('بيبسي 2.25 لتر', 'مشروبات', 'زجاجة', 32, 40, 26, 12, '200506', 120),
      // مخبوزات
      P('عيش بلدي', 'مخبوزات', 'رغيف', 4, 5, 150, 40, '200601', 1),
      P('عيش فينو', 'مخبوزات', 'قطعة', 8, 10, 60, 20, '200602', 2),
      P('كرواسون بالشيكولاتة', 'مخبوزات', 'قطعة', 13, 18, 24, 10, '200603', 4),
      P('كيك إسفنجي', 'مخبوزات', 'قطعة', 26, 35, 12, 6, '200604', 5),
      P('توست أبيض', 'مخبوزات', 'قطعة', 36, 45, 20, 8, '200605', 7),
      // منظفات
      P('مسحوق غسيل 3 كجم', 'منظفات', 'علبة', 180, 210, 15, 6, '200701', 365),
      P('صابون سائل 1 لتر', 'منظفات', 'زجاجة', 52, 65, 22, 8, '200702', 365),
      P('كلور 1 لتر', 'منظفات', 'زجاجة', 16, 22, 34, 12, '200703', 365),
      P('معطر أرضيات 2 لتر', 'منظفات', 'زجاجة', 38, 48, 18, 8, '200704', 365),
      P('مناديل مطبخ 4 لفات', 'منظفات', 'باكت', 44, 55, 26, 10, '200705', 300),
      // مجمدات
      P('بامية مجمدة 500 جم', 'مجمدات', 'كيس', 52, 65, 20, 8, '200801', 180),
      P('بازلاء مجمدة 500 جم', 'مجمدات', 'كيس', 44, 55, 24, 8, '200802', 180),
      P('بطاطس شيبسي مجمدة 1 كجم', 'مجمدات', 'كيس', 60, 75, 16, 6, '200803', 180),
      P('آيس كريم فانيليا 1 لتر', 'مجمدات', 'علبة', 98, 120, 10, 5, '200804', 240),
      P('فراخ بانيه مجمد 1 كجم', 'مجمدات', 'كيس', 150, 185, 12, 5, '200805', 180),
    ];

    const branchIds = all('SELECT id, name FROM branches WHERE active = 1 ORDER BY id').map((b) => b.id);
    if (!branchIds.length) throw new Error('لا توجد فروع لتهيئة المخزون');
    const prodIds = [];
    for (const p of products) {
      const expiry = p.expiryDays ? todayStr(new Date(today.getTime() + p.expiryDays * 86400000)) : null;
      const r = run(`INSERT INTO products
        (name, sku, barcode, category_id, unit, cost, price, wholesale_price, stock, min_stock, expiry_date, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        p.name, 'SKU-' + p.barcode.slice(-4), p.barcode, catId[p.cat], p.unit,
        p.cost, p.price, round2(p.price * 0.92), p.stock, p.min, expiry, t, t);
      const id = Number(r.lastInsertRowid);
      prodIds.push({ id, ...p });
      // توزيع الرصيد الافتتاحي: 60% رئيسي، 25% المعادي، 15% مدينة نصر
      const shares = [round2(p.stock * 0.6), round2(p.stock * 0.25)];
      shares.push(round2(p.stock - shares[0] - shares[1]));
      branchIds.forEach((bid, i) => {
        const qty = shares[i] ?? 0;
        setBranchStock(id, bid, qty);
        if (qty !== 0) {
          run(`INSERT INTO stock_moves (product_id, branch_id, type, qty, balance, note, created_at)
               VALUES (?, ?, 'open', ?, ?, 'رصيد افتتاحي', ?)`, id, bid, qty, qty, t);
        }
      });
    }

    /* ---------- العملاء ---------- */
    const customers = [
      ['أستاذ محمد عبد الله', '01012345678', 'مدينة نصر'],
      ['مطعم بيت الكشري', '01098765432', 'وسط البلد'],
      ['أم خالد', '01123456789', 'شبرا الخيمة'],
      ['كافيتريا النخيل', '01234567890', 'المعادي'],
      ['أستاذة هالة سعيد', '01055512345', 'الزمالك'],
      ['سوبر ماركت الأمانة', '01111122233', 'فيصل'],
      ['مطبخ نور الحياة', '01222233344', 'الهرم'],
      ['كوفي شوب لاونج', '01033344455', 'التجمع الخامس'],
      ['أستاذ سامي فؤاد', '01144455566', 'عين شمس'],
      ['بيتزا ريم', '01255566677', 'المهندسين'],
      ['أستاذة منى إبراهيم', '01066677788', 'السيدة زينب'],
      ['مطعم الشرقاوي', '01177788899', 'شبين القناطر'],
      ['بقالة البركة', '01288899900', 'إمبابة'],
      ['أستاذ ياسر الشريف', '01099900011', 'حلوان'],
      ['مخبز التوفيق', '01100011122', 'المطرية'],
      ['أستاذة دعاء حسن', '01211122233', '6 أكتوبر'],
      ['مطعم فيش أند تشيبس', '01022233344', 'الإسكندرية'],
      ['أستاذ عمرو جمال', '01133344455', 'المنصورة'],
    ];
    customers.forEach(([name, phone, address], i) => {
      run('INSERT INTO customers (name, phone, address, balance, active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
        name, phone, address, i === 1 ? 1250 : i === 3 ? 640 : i === 9 ? 380 : 0, t);
    });

    /* ---------- الموردون ---------- */
    const suppliers = [
      ['مزارع الدلتا للخضروات', '01011112222', 'طريق مصر إسكندرية الزراعي'],
      ['مجزر الرحمة للحوم', '01022223333', 'البساتين'],
      ['شركة الوادي للألبان', '01033334444', 'المنوفية'],
      ['توزيع الوفاء للبقالة', '01044445555', 'العاشر من رمضان'],
      ['مخبز السنابل الذهبية', '01055556666', 'المعادي'],
      ['شركة النيل للمشروبات', '01066667777', 'طنطا'],
      ['مصنع النقاء للمنظفات', '01077778888', 'برج العرب'],
      ['شركة الثلاجة الذهبية للمجمدات', '01088889999', 'الإسكندرية'],
    ];
    suppliers.forEach(([name, phone, address], i) => {
      run('INSERT INTO suppliers (name, phone, address, balance, active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
        name, phone, address, i === 0 ? 4800 : i === 3 ? 2150 : 0, t);
    });

    /* ---------- وردية مفتوحة ---------- */
    const mainBranch = branchDefaultId();
    const shift = run('INSERT INTO shifts (user_id, branch_id, opened_at, opening_cash, status) VALUES (3, ?, ?, 500, \'open\')', mainBranch, t);
    const shiftId = Number(shift.lastInsertRowid);
    run(`INSERT INTO payments (branch_id, type, direction, amount, method, note, user_id, shift_id, created_at)
         VALUES (?, 'shift_open', 'in', 500, 'cash', 'نقدية بداية الوردية', 3, ?, ?)`, mainBranch, shiftId, t);

    /* ---------- فواتير مبيعات تاريخية ---------- */
    let counter = 0;
    const methods = ['cash', 'cash', 'cash', 'card', 'wallet'];
    for (let d = 29; d >= 0; d--) {
      const day = new Date(today.getTime() - d * 86400000);
      const count = d === 0 ? 5 : rint(3, 8);
      for (let s = 0; s < count; s++) {
        const hour = rint(9, 21);
        const minute = rint(0, 59);
        const createdAt = `${todayStr(day)} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
        const itemsCount = rint(1, 5);
        const chosen = [];
        const used = new Set();
        for (let i = 0; i < itemsCount; i++) {
          const p = pick(prodIds);
          if (used.has(p.id)) continue;
          used.add(p.id);
          chosen.push(p);
        }
        if (!chosen.length) continue;
        let lines = chosen.map((p) => ({
          p,
          qty: ['كجم'].includes(p.unit) ? round2(0.25 + rnd() * 1.75) : rint(1, 3),
        }));
        // اختر فرعًا يستطيع تلبية الفاتورة، وقلّل الكميات إن لزم حتى لا يظهر رصيد سالب
        const preferred = [branchIds[s % 5 === 0 ? 1 : 0], branchIds[0], branchIds[1] || branchIds[0], branchIds[2] || branchIds[0]]
          .filter((v, i, a) => a.indexOf(v) === i);
        let branchId = preferred.find((bid) => lines.every((l) => branchStock(l.p.id, bid) >= l.qty));
        if (!branchId) {
          branchId = preferred.slice().sort((a, b) => {
            const score = (bid) => lines.reduce((n, l) => n + Math.min(branchStock(l.p.id, bid), l.qty), 0);
            return score(b) - score(a);
          })[0];
        }
        lines = lines.map((l) => ({ ...l, qty: round2(Math.min(l.qty, branchStock(l.p.id, branchId))) }))
          .filter((l) => l.qty > 0);
        if (!lines.length) continue;
        let subtotal = 0, costTotal = 0;
        for (const l of lines) {
          l.total = round2(l.qty * l.p.price);
          subtotal = round2(subtotal + l.total);
          costTotal = round2(costTotal + l.qty * l.p.cost);
        }
        const discount = rnd() < 0.25 ? Math.round(subtotal * 0.05) : 0;
        const total = round2(subtotal - discount);
        let method = pick(methods);
        let customerId = null;
        if (rnd() < 0.12) { method = 'credit'; customerId = rint(1, 18); }
        const paid = method === 'credit' ? 0 : total;
        counter++;
        const invoiceNo = `INV-${String(counter).padStart(5, '0')}`;
        const sale = run(`INSERT INTO sales
          (invoice_no, customer_id, user_id, branch_id, shift_id, subtotal, discount, tax, total, paid, change_due, cost_total, profit, payment_method, status, created_at)
          VALUES (?, ?, 3, ?, ?, ?, ?, 0, ?, ?, 0, ?, ?, ?, 'completed', ?)`,
          invoiceNo, customerId, branchId, d === 0 ? shiftId : null, subtotal, discount, total, paid, costTotal, round2(total - costTotal), method, createdAt);
        const saleId = Number(sale.lastInsertRowid);
        for (const l of lines) {
          run(`INSERT INTO sale_items (sale_id, product_id, name, unit, qty, unit_price, unit_cost, discount, total)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            saleId, l.p.id, l.p.name, l.p.unit, l.qty, l.p.price, l.p.cost, l.total);
          run('UPDATE products SET stock = ROUND(stock - ?, 2) WHERE id = ?', l.qty, l.p.id);
          const bStock = setBranchStock(l.p.id, branchId, branchStock(l.p.id, branchId) - l.qty);
          run(`INSERT INTO stock_moves (product_id, branch_id, type, qty, balance, ref_type, ref_id, created_at)
               VALUES (?, ?, 'sale', ?, ?, 'sale', ?, ?)`,
            l.p.id, branchId, -l.qty, bStock, saleId, createdAt);
        }
        if (method === 'credit') {
          run('UPDATE customers SET balance = balance + ? WHERE id = ?', total, customerId);
        } else {
          run(`INSERT INTO payments (branch_id, type, direction, amount, method, ref_type, ref_id, user_id, shift_id, created_at)
               VALUES (?, 'sale', 'in', ?, ?, 'sale', ?, 3, ?, ?)`,
            branchId, total, method, saleId, d === 0 ? shiftId : null, createdAt);
        }
      }
    }
    run('INSERT INTO counters (key, value) VALUES (?, ?)', 'sales', counter);

    /* ---------- مشتريات ---------- */
    const purchases = [
      ['سباكة خضروات', 0, 6800, 29], ['توريد لحوم', 1, 12500, 27], ['ألبان وأجبان', 2, 4300, 25],
      ['بقالة متنوعة', 3, 8900, 22], ['مخبوزات', 4, 650, 20], ['مشروبات', 5, 3200, 18],
      ['منظفات', 6, 2750, 15], ['مجمدات', 7, 4100, 13], ['خضروات', 0, 5200, 10],
      ['لحوم ودواجن', 1, 9800, 7], ['ألبان', 2, 3600, 4], ['بقالة', 3, 7400, 2],
    ];
    purchases.forEach(([label, supIdx, total, daysAgo], i) => {
      const createdAt = `${todayStr(new Date(today.getTime() - daysAgo * 86400000))} 08:${String(10 + i).padStart(2, '0')}:00`;
      const invoiceNo = `PUR-${String(i + 1).padStart(5, '0')}`;
      const paid = i % 3 === 2 ? Math.round(total * 0.5) : total;
      const branchId = branchIds[i % branchIds.length];
      const r = run(`INSERT INTO purchases (invoice_no, supplier_id, user_id, branch_id, subtotal, discount, tax, total, paid, payment_method, status, note, created_at)
        VALUES (?, ?, 2, ?, ?, 0, 0, ?, ?, 'cash', 'completed', ?, ?)`,
        invoiceNo, supIdx + 1, branchId, total, total, paid, label, createdAt);
      const pid = Number(r.lastInsertRowid);
      const catName = ['خضروات', 'لحوم ودواجن', 'ألبان وأجبان', 'بقالة', 'مخبوزات', 'مشروبات', 'منظفات', 'مجمدات'][supIdx];
      const catProducts = prodIds.filter((p) => p.cat === catName).slice(0, 5);
      let remaining = total;
      catProducts.forEach((p, idx) => {
        const amount = idx === catProducts.length - 1 ? remaining : round2(total / catProducts.length);
        remaining = round2(remaining - amount);
        const qty = Math.max(1, Math.round(amount / (p.cost || 1)));
        run('INSERT INTO purchase_items (purchase_id, product_id, name, qty, unit_cost, total) VALUES (?, ?, ?, ?, ?, ?)',
          pid, p.id, p.name, qty, p.cost, amount);
        run('UPDATE products SET stock = ROUND(stock + ?, 2) WHERE id = ?', qty, p.id);
        const bStock = setBranchStock(p.id, branchId, branchStock(p.id, branchId) + qty);
        run(`INSERT INTO stock_moves (product_id, branch_id, type, qty, balance, ref_type, ref_id, created_at)
             VALUES (?, ?, 'purchase', ?, ?, 'purchase', ?, ?)`,
          p.id, branchId, qty, bStock, pid, createdAt);
      });
      if (paid > 0) {
        run(`INSERT INTO payments (branch_id, type, direction, amount, method, ref_type, ref_id, user_id, created_at)
             VALUES (?, 'purchase', 'out', ?, 'cash', 'purchase', ?, 2, ?)`, branchId, paid, pid, createdAt);
      }
      if (total - paid > 0) run('UPDATE suppliers SET balance = balance + ? WHERE id = ?', total - paid, supIdx + 1);
    });
    run('INSERT INTO counters (key, value) VALUES (?, ?)', 'purchases', purchases.length);

    /* ---------- المصروفات ---------- */
    const expenses = [
      ['إيجار', 'إيجار المحل — الشهر الحالي', 12000, 25],
      ['كهرباء', 'فاتورة الكهرباء', 1850, 20],
      ['رواتب', 'رواتب العاملين', 16500, 18],
      ['نقل', 'نقل بضائع من سوق العبور', 750, 14],
      ['صيانة', 'صيانة ثلاجة العرض', 600, 9],
      ['مستلزمات', 'أكياس وتغليف', 430, 5],
      ['نظافة', 'مستلزمات نظافة المحل', 280, 2],
    ];
    expenses.forEach(([cat, desc, amount, daysAgo], i) => {
      const createdAt = `${todayStr(new Date(today.getTime() - daysAgo * 86400000))} 11:00:00`;
      const branchId = branchIds[i % branchIds.length];
      const r = run('INSERT INTO expenses (branch_id, category, description, amount, method, user_id, created_at) VALUES (?, ?, ?, ?, \'cash\', 2, ?)',
        branchId, cat, desc, amount, createdAt);
      run(`INSERT INTO payments (branch_id, type, direction, amount, method, ref_type, ref_id, user_id, created_at)
           VALUES (?, 'expense', 'out', ?, 'cash', 'expense', ?, 2, ?)`, branchId, amount, Number(r.lastInsertRowid), createdAt);
    });

    /* ---------- موازنة أرصدة الفروع التجريبية (بدون أرصدة سالبة) ---------- */
    for (const p of all('SELECT id FROM products')) {
      const rows = all('SELECT branch_id, stock FROM product_stock WHERE product_id = ? ORDER BY stock DESC', p.id);
      let positives = rows.filter((r) => r.stock > 0 && rows.some((x) => x.stock < 0));
      for (const neg of rows.filter((r) => r.stock < 0)) {
        let need = -neg.stock;
        for (const pos of positives) {
          if (need <= 0) break;
          const take = Math.min(need, pos.stock);
          if (take <= 0) continue;
          setBranchStock(p.id, pos.branch_id, pos.stock - take);
          pos.stock -= take;
          need = round2(need - take);
          setBranchStock(p.id, neg.branch_id, round2(neg.stock + take));
          neg.stock = round2(neg.stock + take);
        }
      }
    }

    /* ---------- سجل النشاط ---------- */
    run('INSERT INTO activity (user_id, action, details, created_at) VALUES (1, \'seed\', \'تهيئة النظام بالبيانات التجريبية\', ?)', t);
  });
  return true;
}

function seedRolePermissions() {
  return {
    admin: ['*'],
    manager: ['dashboard.view', 'pos.use', 'products.view', 'products.manage', 'inventory.view', 'inventory.manage',
      'sales.view', 'sales.return', 'purchases.view', 'purchases.manage', 'contacts.view', 'contacts.manage',
      'treasury.view', 'treasury.manage', 'reports.view', 'settings.manage', 'backup.manage', 'shifts.manage',
      'branches.manage', 'users.manage'],
    cashier: ['dashboard.view', 'pos.use', 'sales.view', 'products.view', 'inventory.view', 'contacts.view', 'treasury.view'],
    accountant: ['dashboard.view', 'sales.view', 'purchases.view', 'contacts.view', 'contacts.manage',
      'treasury.view', 'treasury.manage', 'reports.view', 'products.view', 'inventory.view'],
    stock: ['dashboard.view', 'products.view', 'products.manage', 'inventory.view', 'inventory.manage',
      'purchases.view', 'purchases.manage', 'contacts.view'],
  };
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================
   النسخ الاحتياطي والاستعادة
   ============================================================ */
function safeName(name) {
  return path.basename(String(name || '')).replace(/[^\w.\-]+/g, '_');
}

function backupTo(dir, label = 'manual') {
  fs.mkdirSync(dir, { recursive: true });
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch {}
  const stamp = now().replace(/[: ]/g, '-');
  const name = `baraka-${stamp}-${label}.db`;
  const target = path.join(dir, name);
  fs.copyFileSync(dbPath, target);
  return { name, path: target, size: fs.statSync(target).size, created_at: now() };
}

function listBackups(dir = BACKUP_DIR) {
  const out = [];
  for (const base of [BACKUP_DIR, dir].filter(Boolean)) {
    if (!fs.existsSync(base)) continue;
    for (const f of fs.readdirSync(base)) {
      if (!/\.(db|sqlite|sqlite3|backup)$/i.test(f)) continue;
      const full = path.join(base, f);
      const st = fs.statSync(full);
      if (!st.isFile()) continue;
      out.push({ name: f, size: st.size, created_at: now(st.mtime), dir: base, is_default: path.resolve(base) === path.resolve(BACKUP_DIR) });
    }
  }
  const seen = new Set();
  return out.filter((b) => (seen.has(b.dir + b.name) ? false : seen.add(b.dir + b.name)))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function validateDbFile(file) {
  const probe = new DatabaseSync(file, { readOnly: true });
  try {
    const tables = probe.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
    const required = ['users', 'products', 'sales', 'sale_items', 'settings'];
    const missing = required.filter((t) => !tables.includes(t));
    if (missing.length) throw new Error('ملف النسخة غير صالح (جداول ناقصة): ' + missing.join(', '));
    const count = probe.prepare('SELECT COUNT(*) AS c FROM users').get();
    return { users: count.c, tables: tables.length };
  } finally {
    probe.close();
  }
}

function restoreFrom(file) {
  const info = validateDbFile(file);
  // نسخة أمان قبل الاستعادة
  const safety = backupTo(BACKUP_DIR, 'pre-restore');
  close();
  try {
    for (const suffix of ['-wal', '-shm']) {
      const p = dbPath + suffix;
      if (fs.existsSync(p)) fs.rmSync(p);
    }
    fs.copyFileSync(file, dbPath);
    open();
    migrate();
    run('DELETE FROM sessions');
    run('INSERT INTO activity (action, details, created_at) VALUES (?, ?, ?)', 'restore',
      `تمت استعادة النسخة ${path.basename(file)} — نسخة أمان: ${safety.name}`, now());
    return { ok: true, restored: path.basename(file), safety: safety.name, info };
  } catch (e) {
    try { reopen(); } catch {}
    throw e;
  }
}

/* ---------- التهيئة ---------- */
function init() {
  open();
  migrate();
  seedBranches();
  const seeded = seed();
  ensureDefaultAdmin(); // post-seed
  return { seeded, dbPath };
}

module.exports = {
  ROOT, DATA_DIR, DB_FILE, BACKUP_DIR,
  init, migrate, all, get, run, tx, close, reopen,
  now, todayStr, addDays, round2, nextNumber,
  settingsObject, setSetting, hashPassword, verifyPassword,
  seedRolePermissions, DEFAULT_SETTINGS, seedBranches,
  branchDefaultId, branchStock, setBranchStock,
  backupTo, listBackups, restoreFrom, validateDbFile, safeName,
  get dbPath() { return dbPath; },
  get handle() { return db; },
};
