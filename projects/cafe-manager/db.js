'use strict';
/* ============================================================
   كافيه برو — طبقة قاعدة البيانات
   - محليًا: SQLite (node:sqlite) — بدون أي حزمة أصلية
   - على الاستضافة: MySQL/MariaDB عبر DATABASE_URL
   - نفس الاستعلامات تستخدم $1,$2... ويتم تحويلها تلقائيًا
   ============================================================ */
const fs = require('fs');
const path = require('path');

/* قارئ .env بسيط — دون تبعيات */
function loadEnv() {
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  const text = fs.readFileSync(f, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined && process.env[m[1]] !== '') continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadEnv();

const DB_URL = String(process.env.DATABASE_URL || '').trim();
if (/^postgres(ql)?:/i.test(DB_URL)) {
  throw new Error('PostgreSQL غير مدعوم في هذا الإصدار — استخدم MySQL/MariaDB (mysql://...) أو SQLite بدون DATABASE_URL.');
}
const useMySQL = /^(mysql|mariadb):/i.test(DB_URL);
const dbKind = useMySQL ? 'mysql' : 'sqlite';

let pool = null;
let sqlite = null;
let sqlitePath = '';
let mysql = null;

if (useMySQL) {
  mysql = require('mysql2/promise');
  const u = new URL(DB_URL);
  const cfg = {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database: decodeURIComponent((u.pathname || '').replace(/^\//, '')),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    decimalNumbers: true,
  };
  const sslMode = u.searchParams.get('ssl') || u.searchParams.get('sslmode');
  if (sslMode && !/^(disable|false|0)$/i.test(sslMode)) cfg.ssl = { rejectUnauthorized: false };
  pool = mysql.createPool(cfg);
} else {
  const { DatabaseSync } = require('node:sqlite');
  sqlitePath = process.env.CAFE_DB || process.env.SQLITE_DB || path.join(__dirname, 'cafe.db');
  fs.mkdirSync(path.dirname(path.resolve(sqlitePath)), { recursive: true });
  sqlite = new DatabaseSync(sqlitePath);
  sqlite.exec('PRAGMA journal_mode = WAL');
}

/* ============================================================ helpers */
/* SQLite uses ? placeholders. We convert $1,$2... to ? and expand params,
   so the same placeholder can safely appear more than once in one query. */
function toQuestion(sql, params = []) {
  if (!/\$\d+/.test(sql)) return { sql, params };
  const vals = [];
  const converted = sql.replace(/\$(\d+)/g, (m, n) => {
    const v = params[Number(n) - 1];
    vals.push(v === undefined ? null : v);
    return '?';
  });
  return { sql: converted, params: vals };
}

async function getRow(sql, params = []) {
  if (useMySQL) {
    const q = toQuestion(sql, params);
    const [rows] = await pool.execute(q.sql, q.params);
    return rows[0] || null;
  }
  const q = toQuestion(sql, params);
  return sqlite.prepare(q.sql).get(...q.params) || null;
}

async function getRows(sql, params = []) {
  if (useMySQL) {
    const q = toQuestion(sql, params);
    const [rows] = await pool.execute(q.sql, q.params);
    return rows;
  }
  const q = toQuestion(sql, params);
  return sqlite.prepare(q.sql).all(...q.params);
}

async function run(sql, params = []) {
  if (useMySQL) {
    const q = toQuestion(sql, params);
    const [r] = await pool.execute(q.sql, q.params);
    return { lastInsertRowid: Number(r.insertId) || 0, changes: Number(r.affectedRows) || 0 };
  }
  const q = toQuestion(sql, params);
  const info = sqlite.prepare(q.sql).run(...q.params);
  return { lastInsertRowid: Number(info.lastInsertRowid) || 0, changes: Number(info.changes) || 0 };
}

async function exec(sql) {
  if (useMySQL) {
    const [r] = await pool.query(sql);
    return r;
  }
  return sqlite.exec(sql);
}

/* تقسيم ملف SQL إلى عبارات — يتجاهل التعليقات والفواصل داخل النصوص */
function splitSql(text) {
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      cur += ch;
      if (ch === quote && text[i - 1] !== '\\') quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch; cur += ch;
    } else if (ch === '-' && text[i + 1] === '-') {
      while (i < text.length && text[i] !== '\n') i++;
      cur += '\n';
    } else if (ch === ';') {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS branches(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, address TEXT);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT UNIQUE NOT NULL, pass TEXT NOT NULL, role TEXT NOT NULL, perms TEXT NOT NULL DEFAULT '{}', branch_id INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, address TEXT, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS accounts(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, type TEXT, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS sales(id INTEGER PRIMARY KEY AUTOINCREMENT, customer TEXT, item TEXT, qty INTEGER, price REAL, total REAL, payment TEXT, user_id INTEGER, shift_id INTEGER, date TEXT, branch_id INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS purchases(id INTEGER PRIMARY KEY AUTOINCREMENT, supplier TEXT, item TEXT, qty INTEGER, \`unitPrice\` REAL, total REAL, date TEXT, branch_id INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS finance(id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, \`desc\` TEXT, amount REAL, date TEXT, branch_id INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS journal(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, ref TEXT, \`desc\` TEXT, account TEXT, debit REAL DEFAULT 0, credit REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS shifts(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, username TEXT, opened_at TEXT, closed_at TEXT, opening_cash REAL, closing_cash REAL, status TEXT DEFAULT 'open', branch_id INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT DEFAULT 'menu', cost_price REAL DEFAULT 0, sell_price REAL DEFAULT 0, barcode TEXT, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS recipes(id INTEGER PRIMARY KEY AUTOINCREMENT, menu_item TEXT, ingredient TEXT, qty REAL);
CREATE TABLE IF NOT EXISTS tables(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, status TEXT DEFAULT 'free', active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT, table_id INTEGER, table_name TEXT, status TEXT DEFAULT 'open', total REAL DEFAULT 0, created_at TEXT, billed_at TEXT);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, item TEXT, qty INTEGER, price REAL, total REAL);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, username TEXT, action TEXT, entity TEXT, entity_id TEXT, details TEXT, created_at TEXT);
`;

/* ============================================================ setup */
async function setup() {
  if (useMySQL) {
    const schemaFile = path.join(__dirname, 'schema', '001_init.sql');
    const ddl = fs.readFileSync(schemaFile, 'utf8');
    for (const stmt of splitSql(ddl)) await exec(stmt);
  } else {
    sqlite.exec(SQLITE_DDL);
  }

  /* ترقية قواعد قديمة: أعمدة الحذف الناعم + سجل التدقيق */
  for (const t of ['suppliers', 'accounts', 'items', 'tables']) {
    try { await exec(`ALTER TABLE ${t} ADD COLUMN active INTEGER DEFAULT 1`); } catch (e) { /* موجود */ }
  }
  if (useMySQL) {
    try {
      await exec("CREATE TABLE IF NOT EXISTS audit_log (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, username VARCHAR(255), action VARCHAR(50), entity VARCHAR(100), entity_id VARCHAR(100), details TEXT, created_at VARCHAR(40)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    } catch (e) { /* موجود */ }
  }

  /* حسابات محاسبية افتراضية */
  const accs = [
    ['الصندوق','أصول'],['البنك','أصول'],['المخزون','أصول'],['ذمم مدينة','أصول'],
    ['ذمم دائنة','خصوم'],['قروض','خصوم'],
    ['رأس المال','حقوق ملكية'],['الأرباح المحتجزة','حقوق ملكية'],
    ['إيرادات المبيعات','إيرادات'],['إيرادات أخرى','إيرادات'],
    ['تكلفة البضاعة المباعة','مصروفات'],['مصروفات تشغيلية','مصروفات'],['المشتريات','مصروفات'],
  ];
  const insAcc = useMySQL
    ? 'INSERT IGNORE INTO accounts(name,type) VALUES(?,?)'
    : 'INSERT OR IGNORE INTO accounts(name,type) VALUES(?,?)';
  for (const [n, t] of accs) await run(insAcc, [n, t]);

  const u = await getRow('SELECT COUNT(*) c FROM users');
  if (!Number(u && u.c)) {
    const allPages = ['dashboard','sales','purchases','suppliers','finance','users','reports','accounts','journal','shifts','pos','items','tables'];
    const full = {}; allPages.forEach(p => full[p] = { v:1, a:1, e:1, d:1 });
    await run('INSERT INTO users(name,username,pass,role,perms) VALUES(?,?,?,?,?)',
      ['مدير النظام', 'admin', 'admin123', 'مدير', JSON.stringify(full)]);
  }
  const sup = await getRow('SELECT COUNT(*) c FROM suppliers');
  if (!Number(sup && sup.c)) await run('INSERT INTO suppliers(name,phone,address) VALUES(?,?,?)', ['شركة البن الطيب','010000000','القاهرة']);
  const br = await getRow('SELECT COUNT(*) c FROM branches');
  if (!Number(br && br.c)) await run('INSERT INTO branches(name,address) VALUES(?,?)', ['الفرع الرئيسي','القاهرة']);
  const it = await getRow('SELECT COUNT(*) c FROM items');
  if (!Number(it && it.c)) {
    const ins = async (n,t,c,s) => run('INSERT INTO items(name,type,cost_price,sell_price) VALUES(?,?,?,?)', [n,t,c,s]);
    await ins('بن','ingredient',40,0);
    await ins('حليب','ingredient',8,0);
    await ins('قهوة','menu',0,25);
    await ins('لاتيه','menu',0,30);
    await ins('كابتشينو','menu',0,30);
    const rIns = async (m,i,q) => run('INSERT INTO recipes(menu_item,ingredient,qty) VALUES(?,?,?)', [m,i,q]);
    await rIns('قهوة','بن',0.02);
    await rIns('لاتيه','بن',0.02);
    await rIns('لاتيه','حليب',0.2);
    await rIns('كابتشينو','بن',0.02);
    await rIns('كابتشينو','حليب',0.2);
  }
  const tb = await getRow('SELECT COUNT(*) c FROM tables');
  if (!Number(tb && tb.c)) for (let i = 1; i <= 8; i++) await run('INSERT INTO tables(name) VALUES(?)', ['طاولة ' + i]);
}

async function ensureDefaultAdmin() {
  const allPages = ['dashboard','sales','purchases','suppliers','finance','users','reports','accounts','journal','shifts','pos','items','tables'];
  const full = {}; allPages.forEach(p => full[p] = { v:1, a:1, e:1, d:1 });
  const perms = JSON.stringify(full);

  // الحساب الموحّد: admin / admin123
  const admin = await getRow("SELECT id FROM users WHERE username='admin'");
  if (!admin) {
    await run('INSERT INTO users(name,username,pass,role,perms) VALUES(?,?,?,?,?)', ['مدير النظام','admin','admin123','مدير',perms]);
  } else {
    await run('UPDATE users SET pass=?, role=?, perms=? WHERE id=?', ['admin123','مدير',perms, admin.id]);
  }

}

/* بيانات تجريبية لعرض شكل الصفحات (تُضاف مرة واحدة عند خلو بيانات التشغيل) */
async function seedDemoData() {
  try {
    const salesCount = await getRow('SELECT COUNT(*) c FROM sales');
    const ordersCount = await getRow('SELECT COUNT(*) c FROM orders');
    if (Number(salesCount && salesCount.c) > 0 || Number(ordersCount && ordersCount.c) > 0) return;

    const admin = await getRow("SELECT id, username FROM users WHERE username='admin' ORDER BY id LIMIT 1");
    const uid = admin ? admin.id : 1;
    const uname = admin ? (admin.username || 'admin') : 'admin';
    const branch = await getRow('SELECT id FROM branches ORDER BY id LIMIT 1');
    const branchId = branch ? branch.id : 1;
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    const iso = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
    const daysAgo = (n, h = 10) => { const d = new Date(today); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d; };

    // ورديات تجريبية
    const shift1 = await run('INSERT INTO shifts(user_id,username,opened_at,closed_at,opening_cash,closing_cash,status,branch_id) VALUES(?,?,?,?,?,?,?,?)',
      [uid, uname, iso(daysAgo(2, 8)), iso(daysAgo(2, 16)), 200, 1450, 'closed', branchId]);
    const shift2 = await run('INSERT INTO shifts(user_id,username,opened_at,closed_at,opening_cash,closing_cash,status,branch_id) VALUES(?,?,?,?,?,?,?,?)',
      [uid, uname, iso(daysAgo(1, 8)), iso(daysAgo(1, 16)), 300, 1820, 'closed', branchId]);
    const shift3 = await run('INSERT INTO shifts(user_id,username,opened_at,closed_at,opening_cash,closing_cash,status,branch_id) VALUES(?,?,?,?,?,?,?,?)',
      [uid, uname, iso(daysAgo(0, 8)), null, 250, null, 'open', branchId]);

    // طلبات (POS) وعناصرها
    const tables = await getRows('SELECT id, name FROM tables ORDER BY id LIMIT 3');
    const orderDefs = [
      { table: tables[0] || { id: 1, name: 'طاولة 1' }, status: 'billed', created: daysAgo(2, 11), billed: daysAgo(2, 12), items: [{ item: 'قهوة', qty: 2, price: 25 }, { item: 'لاتيه', qty: 1, price: 30 }] },
      { table: tables[1] || { id: 2, name: 'طاولة 2' }, status: 'billed', created: daysAgo(1, 13), billed: daysAgo(1, 14), items: [{ item: 'كابتشينو', qty: 2, price: 30 }, { item: 'قهوة', qty: 1, price: 25 }] },
      { table: tables[2] || { id: 3, name: 'طاولة 3' }, status: 'open', created: daysAgo(0, 10), billed: null, items: [{ item: 'لاتيه', qty: 2, price: 30 }] },
    ];
    for (const od of orderDefs) {
      const total = od.items.reduce((s, it) => s + it.qty * it.price, 0);
      const o = await run('INSERT INTO orders(table_id,table_name,status,total,created_at,billed_at) VALUES(?,?,?,?,?,?)',
        [od.table.id, od.table.name, od.status, total, iso(od.created), od.billed ? iso(od.billed) : null]);
      for (const it of od.items) {
        await run('INSERT INTO order_items(order_id,item,qty,price,total) VALUES(?,?,?,?,?)', [o.lastInsertRowid, it.item, it.qty, it.price, it.qty * it.price]);
      }
    }

    // مبيعات
    const saleRows = [
      { customer: 'عميل نقدي', item: 'قهوة', qty: 3, price: 25, total: 75, payment: 'cash', shift: shift1.lastInsertRowid, date: fmt(daysAgo(2)) },
      { customer: 'عميل نقدي', item: 'لاتيه', qty: 2, price: 30, total: 60, payment: 'cash', shift: shift1.lastInsertRowid, date: fmt(daysAgo(2)) },
      { customer: 'شركة النور', item: 'كابتشينو', qty: 4, price: 30, total: 120, payment: 'card', shift: shift2.lastInsertRowid, date: fmt(daysAgo(1)) },
      { customer: 'عميل نقدي', item: 'قهوة', qty: 5, price: 25, total: 125, payment: 'cash', shift: shift2.lastInsertRowid, date: fmt(daysAgo(1)) },
      { customer: 'عميل نقدي', item: 'لاتيه', qty: 2, price: 30, total: 60, payment: 'cash', shift: shift3.lastInsertRowid, date: fmt(daysAgo(0)) },
    ];
    for (const s of saleRows) {
      await run('INSERT INTO sales(customer,item,qty,price,total,payment,user_id,shift_id,date,branch_id) VALUES(?,?,?,?,?,?,?,?,?,?)',
        [s.customer, s.item, s.qty, s.price, s.total, s.payment, uid, s.shift, s.date, branchId]);
    }

    // مشتريات
    const supplier = await getRow('SELECT name FROM suppliers ORDER BY id LIMIT 1');
    const supName = supplier ? supplier.name : 'شركة البن الطيب';
    const purchaseRows = [
      { supplier: supName, item: 'بن', qty: 10, unitPrice: 40, total: 400, date: fmt(daysAgo(5)) },
      { supplier: supName, item: 'حليب', qty: 20, unitPrice: 8, total: 160, date: fmt(daysAgo(3)) },
      { supplier: supName, item: 'أكواب ورقية', qty: 200, unitPrice: 0.5, total: 100, date: fmt(daysAgo(1)) },
    ];
    for (const p of purchaseRows) {
      await run('INSERT INTO purchases(supplier,item,qty,`unitPrice`,total,date,branch_id) VALUES(?,?,?,?,?,?,?)',
        [p.supplier, p.item, p.qty, p.unitPrice, p.total, p.date, branchId]);
    }

    // مصروفات/إيرادات مالية
    const financeRows = [
      { type: 'expense', desc: 'إيجار المحل', amount: 3000, date: fmt(daysAgo(7)), branch_id: branchId },
      { type: 'expense', desc: 'كهرباء ومياه', amount: 450, date: fmt(daysAgo(4)), branch_id: branchId },
      { type: 'income', desc: 'إيراد خدمات إضافية', amount: 200, date: fmt(daysAgo(2)), branch_id: branchId },
    ];
    for (const f of financeRows) {
      await run('INSERT INTO finance(type,`desc`,amount,date,branch_id) VALUES(?,?,?,?,?)', [f.type, f.desc, f.amount, f.date, f.branch_id]);
    }

    // قيود يومية مبسطة
    const journalRows = [
      { date: fmt(daysAgo(2)), ref: 'JV-001', desc: 'مبيعات نقدية', account: 'الصندوق', debit: 135, credit: 0 },
      { date: fmt(daysAgo(2)), ref: 'JV-001', desc: 'مبيعات نقدية', account: 'إيرادات المبيعات', debit: 0, credit: 135 },
      { date: fmt(daysAgo(1)), ref: 'JV-002', desc: 'مشتريات بن', account: 'المشتريات', debit: 100, credit: 0 },
      { date: fmt(daysAgo(1)), ref: 'JV-002', desc: 'مشتريات بن', account: 'الصندوق', debit: 0, credit: 100 },
    ];
    for (const j of journalRows) {
      await run('INSERT INTO journal(date,ref,`desc`,account,debit,credit) VALUES(?,?,?,?,?,?)', [j.date, j.ref, j.desc, j.account, j.debit, j.credit]);
    }

    await audit({ id: uid, username: uname }, 'seed', 'demo', 'all', 'Demo transactional data seeded');
  } catch (e) {
    console.error('demo seed (cafe-manager) failed:', e && e.message ? e.message : e);
  }
}

async function ensureSetup() { await setup(); await ensureDefaultAdmin(); await seedDemoData(); }

/* ============================================================ audit */
async function audit(user, action, entity, entityId, details) {
  try {
    await run(
      'INSERT INTO audit_log(user_id,username,action,entity,entity_id,details,created_at) VALUES(?,?,?,?,?,?,?)',
      [user ? user.id || null : null, user ? user.username || '' : 'system', action,
       String(entity || ''), entityId == null ? '' : String(entityId), details || '',
       new Date().toISOString()]
    );
  } catch (e) { /* لا نُفشل العملية بسبب السجل */ }
}

module.exports = {
  dbKind, useMySQL, pool, sqlitePath,
  getRow, getRows, run, exec, setup, ensureSetup, splitSql, audit,
};
