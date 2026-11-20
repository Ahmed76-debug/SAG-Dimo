'use strict';
/* ============================================================
   سوق البركة | Baraka Market ERP — الخادم
   Node.js خالص بدون أي تبعيات خارجية
   ============================================================ */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const store = require('./lib/db');
const { now, todayStr, addDays, round2, all, get, run, tx } = store;

/* ---------- متغيرات البيئة ---------- */
(function loadEnv() {
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
})();

const PORT = Number(process.env.PORT) || 4300;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_DAYS = 7;
const APP_VERSION = '1.0.0';

const initInfo = store.init();

/* ============================================================
   أدوات HTTP
   ============================================================ */
class HttpError extends Error {
  constructor(message, status = 400, code = '') { super(message); this.status = status; this.code = code; }
}
const fail = (msg, status = 400, code = '') => { throw new HttpError(msg, status, code); };

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setCookie(res, name, value, opts = {}) {
  const bits = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (opts.httpOnly !== false) bits.push('HttpOnly');
  if (opts.maxAge) bits.push(`Max-Age=${opts.maxAge}`);
  if (opts.secure) bits.push('Secure');
  res.setHeader('Set-Cookie', bits.join('; '));
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}
function ok(res, data = {}) { sendJson(res, 200, { ok: true, ...data }); }

function readBody(req, limit = 3 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError('حجم البيانات كبير جدًا', 413)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const buf = await readBody(req);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); }
  catch { fail('صيغة البيانات غير صحيحة', 400); }
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

/* ============================================================
   المصادقة والجلسات
   ============================================================ */
const COOKIE = 'baraka_sid';
const loginAttempts = new Map();

function createSession(user, req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const csrf = crypto.randomBytes(24).toString('hex');
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_DAYS * 86400000);
  run(`INSERT INTO sessions (token, user_id, csrf, created_at, expires_at, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    token, user.id, csrf, store.now(created), store.now(expires), clientIp(req),
    String(req.headers['user-agent'] || '').slice(0, 180));
  run('UPDATE users SET last_login = ? WHERE id = ?', store.now(created), user.id);
  setCookie(res, COOKIE, token, { maxAge: SESSION_DAYS * 86400, secure: isHttps(req) });
  return { token, csrf };
}
function isHttps(req) {
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' || req.socket.encrypted;
}
function normalizeUser(row) {
  let perms = [];
  try { perms = JSON.parse(row.permissions || '[]'); } catch {}
  return {
    id: row.id, name: row.name, username: row.username, role: row.role,
    permissions: perms, phone: row.phone, branch_id: row.branch_id || null,
    active: !!row.active, last_login: row.last_login, created_at: row.created_at,
  };
}
function authFromRequest(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const row = get(`SELECT s.token, s.csrf, s.expires_at, u.* FROM sessions s
                   JOIN users u ON u.id = s.user_id
                   WHERE s.token = ? AND u.active = 1`, token);
  if (!row) return null;
  if (String(row.expires_at) < store.now()) {
    run('DELETE FROM sessions WHERE token = ?', token);
    return null;
  }
  return { session: { token: row.token, csrf: row.csrf }, user: normalizeUser(row) };
}

function can(user, perm) {
  if (!perm) return true;
  if (!user) return false;
  if (user.role === 'admin') return true;
  const perms = user.permissions || [];
  return perms.includes('*') || perms.includes(perm);
}
function requirePerm(user, perm) {
  if (!can(user, perm)) fail('لا تملك الصلاحية لتنفيذ هذه العملية', 403, 'FORBIDDEN');
}

/* ============================================================
   السجلات
   ============================================================ */
function logActivity(userId, action, details, ip = '') {
  try {
    run('INSERT INTO activity (user_id, action, details, ip, created_at) VALUES (?, ?, ?, ?, ?)',
      userId, action, details, ip, now());
  } catch {}
}

/* سجل تدقيق موحّد: من أنشأ/عدّل/حذف/استعاد */
function logAudit(ctx, action, entity, entityId, details) {
  try {
    const uid = ctx?.user?.id ?? null;
    const uname = ctx?.user?.name || '';
    const text = typeof details === 'string' ? details : JSON.stringify(details ?? null);
    run(`INSERT INTO audit_log (user_id, user_name, action, entity, entity_id, details, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      uid, uname, action, entity || null, entityId ?? null, text, ctx?.ip || '', now());
  } catch {}
}

/* قائمة جداول قاعدة البيانات وأعداد صفوفها */
const PROTECTED_TABLES = new Set(['users', 'sessions', 'settings', 'counters', 'audit_log', 'activity']);
const TABLE_LABELS = {
  products: 'المنتجات', categories: 'التصنيفات', product_stock: 'أرصدة الفروع',
  customers: 'العملاء', suppliers: 'الموردون', sales: 'فواتير البيع', sale_items: 'بنود البيع',
  purchases: 'فواتير الشراء', purchase_items: 'بنود الشراء', returns: 'المرتجعات',
  stock_moves: 'حركات المخزون', expenses: 'المصروفات', payments: 'المدفوعات',
  shifts: 'الورديات', holds: 'الفواتير المعلّقة', branches: 'الفروع',
  activity: 'سجل النشاط', audit_log: 'سجل التدقيق',
};
function dataTables() {
  const rows = all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`);
  return rows.map((r) => {
    let count = 0;
    try { count = get(`SELECT COUNT(*) AS c FROM "${r.name}"`).c; } catch {}
    return {
      name: r.name,
      label: TABLE_LABELS[r.name] || r.name,
      rows: count,
      protected: PROTECTED_TABLES.has(r.name),
    };
  });
}
function fkChildren() {
  const tables = all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).map((r) => r.name);
  const children = new Map();
  for (const t of tables) {
    let fks = [];
    try { fks = all(`PRAGMA foreign_key_list("${t}")`); } catch {}
    for (const fk of fks) {
      if (!children.has(fk.table)) children.set(fk.table, new Set());
      children.get(fk.table).add(t);
    }
  }
  return children;
}

/* ============================================================
   أدوات مشتركة
   ============================================================ */
function openShift(branchId = 0) {
  const sql = `SELECT sh.*, u.name AS user_name, b.name AS branch_name FROM shifts sh
               JOIN users u ON u.id = sh.user_id LEFT JOIN branches b ON b.id = sh.branch_id
               WHERE sh.status = 'open' ${branchId ? 'AND sh.branch_id = ?' : ''}
               ORDER BY sh.id DESC LIMIT 1`;
  return branchId ? get(sql, branchId) : get(sql);
}
function currentUserShift(userId, branchId = 0) {
  const sql = `SELECT * FROM shifts WHERE status = 'open' AND user_id = ? ${branchId ? 'AND branch_id = ?' : ''}
               ORDER BY id DESC LIMIT 1`;
  return (branchId ? get(sql, userId, branchId) : get(sql, userId)) || openShift(branchId);
}

/* ---------- الفروع ---------- */
function branchFromQuery(url) {
  const b = int(url.searchParams.get('branch'), 0);
  return b > 0 ? b : 0;
}
function branchFromBody(body, user) {
  return int(body?.branch_id) || user?.branch_id || store.branchDefaultId();
}
function requireBranch(id) {
  const row = get('SELECT * FROM branches WHERE id = ? AND active = 1', id);
  if (!row) fail('الفرع غير موجود أو غير مفعّل', 404, 'BRANCH_NOT_FOUND');
  return row;
}
function branchSql(branchId, alias = '') {
  return branchId ? `AND ${alias}branch_id = ?` : '';
}
function branchParams(branchId) {
  return branchId ? [branchId] : [];
}
function branchProductStock(productId, branchId) {
  if (!branchId) return get('SELECT stock FROM products WHERE id = ?', productId)?.stock || 0;
  return store.branchStock(productId, branchId);
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function rangeFromQuery(url) {
  const to = DATE_RE.test(url.searchParams.get('to') || '') ? url.searchParams.get('to') : todayStr();
  const from = DATE_RE.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : addDays(to, -29);
  return { from, to, fromTs: `${from} 00:00:00`, toTs: `${to} 23:59:59` };
}
const int = (v, def = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : def; };
const num = (v, def = 0) => { const n = Number(v); return Number.isFinite(n) ? n : def; };
const str = (v, max = 500) => String(v == null ? '' : v).trim().slice(0, max);

function productRow(id) {
  return get(`SELECT p.*, c.name AS category_name, c.color AS category_color
              FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`, id);
}

/* ============================================================
   المسارات
   ============================================================ */
const routes = [];
function add(method, pattern, perm, handler, raw = false) {
  const keys = [];
  const rgx = new RegExp('^' + pattern.replace(/:[A-Za-z_]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
  routes.push({ method, rgx, keys, perm, handler, raw });
}

/* ---------- الصحة ---------- */
add('GET', '/api/health', null, () => ({
  status: 'ok', app: 'Baraka Market ERP', version: APP_VERSION,
  database: 'connected', time: now(),
}));

/* ---------- المصادقة ---------- */
add('POST', '/api/auth/login', null, async (ctx) => {
  const key = clientIp(ctx.req);
  const attempts = loginAttempts.get(key) || { count: 0, at: 0 };
  if (attempts.count >= 10 && Date.now() - attempts.at < 10 * 60 * 1000) {
    fail('محاولات دخول كثيرة. حاول بعد قليل.', 429, 'RATE_LIMIT');
  }
  const username = str(ctx.body.username, 60).toLowerCase();
  const password = String(ctx.body.password || '');
  if (!username || !password) fail('أدخل اسم المستخدم وكلمة المرور');
  const row = get('SELECT * FROM users WHERE lower(username) = ?', username);
  if (!row || !row.active || !store.verifyPassword(password, row.password_hash)) {
    loginAttempts.set(key, { count: attempts.count + 1, at: Date.now() });
    fail('اسم المستخدم أو كلمة المرور غير صحيحة', 401, 'INVALID_CREDENTIALS');
  }
  loginAttempts.delete(key);
  const { csrf } = createSession(row, ctx.req, ctx.res);
  run('DELETE FROM sessions WHERE expires_at < ?', now());
  logActivity(row.id, 'login', 'تسجيل دخول', clientIp(ctx.req));
  return { user: normalizeUser(row), csrf, settings: store.settingsObject() };
});

add('POST', '/api/auth/logout', null, (ctx) => {
  if (ctx.session) run('DELETE FROM sessions WHERE token = ?', ctx.session.token);
  setCookie(ctx.res, COOKIE, '', { maxAge: 0 });
  return { ok: true };
});

add('GET', '/api/auth/me', null, (ctx) => ({
  user: ctx.user, csrf: ctx.session.csrf, settings: store.settingsObject(),
}));

add('POST', '/api/auth/password', null, (ctx) => {
  const current = String(ctx.body.current || '');
  const next = String(ctx.body.next || '');
  if (next.length < 6) fail('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
  const row = get('SELECT password_hash FROM users WHERE id = ?', ctx.user.id);
  if (!store.verifyPassword(current, row.password_hash)) fail('كلمة المرور الحالية غير صحيحة', 401);
  run('UPDATE users SET password_hash = ? WHERE id = ?', store.hashPassword(next), ctx.user.id);
  run('DELETE FROM sessions WHERE user_id = ? AND token <> ?', ctx.user.id, ctx.session.token);
  logActivity(ctx.user.id, 'password', 'تغيير كلمة المرور', ctx.ip);
  return { message: 'تم تحديث كلمة المرور' };
});

/* ---------- التهيئة العامة ---------- */
add('GET', '/api/bootstrap', null, (ctx) => {
  const settings = store.settingsObject();
  const branches = all('SELECT id, name, code, phone, address, active, is_default FROM branches ORDER BY is_default DESC, id');
  const defaultBranch = store.branchDefaultId();
  const activeBranch = int(ctx.url.searchParams.get('branch')) || ctx.user.branch_id || defaultBranch;
  const shift = openShift(activeBranch);
  return {
    user: ctx.user,
    csrf: ctx.session.csrf,
    settings,
    branches,
    default_branch_id: defaultBranch,
    active_branch_id: activeBranch,
    categories: all(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS products_count
                      FROM categories c ORDER BY c.sort, c.name`),
    shift: shift ? {
      id: shift.id, branch_id: shift.branch_id, branch_name: shift.branch_name, user_name: shift.user_name,
      opened_at: shift.opened_at, opening_cash: shift.opening_cash, mine: shift.user_id === ctx.user.id,
    } : null,
    alerts: branchAlerts(activeBranch),
    version: APP_VERSION,
  };
});

function branchAlerts(branchId = 0) {
  if (branchId) {
    const rows = all(`SELECT COALESCE(ps.stock,0) AS bs, p.min_stock, p.active FROM products p
                      LEFT JOIN product_stock ps ON ps.product_id = p.id AND ps.branch_id = ?
                      WHERE p.active = 1`, branchId).map((r) => ({ stock: Number(r.bs), min: Number(r.min_stock) }));
    return {
      low_stock: rows.filter((r) => r.stock > 0 && r.stock <= r.min).length,
      out_stock: rows.filter((r) => r.stock <= 0).length,
      debts: round2(num(get('SELECT SUM(balance) AS s FROM customers WHERE active = 1 AND balance > 0').s)),
    };
  }
  return {
    low_stock: get('SELECT COUNT(*) AS c FROM products WHERE active = 1 AND stock <= min_stock AND stock > 0').c,
    out_stock: get('SELECT COUNT(*) AS c FROM products WHERE active = 1 AND stock <= 0').c,
    debts: round2(num(get('SELECT SUM(balance) AS s FROM customers WHERE active = 1 AND balance > 0').s)),
  };
}

/* ---------- لوحة التحكم ---------- */
add('GET', '/api/dashboard', 'dashboard.view', (ctx) => {
  const today = todayStr();
  const yesterday = addDays(today, -1);
  const branch = branchFromQuery(ctx.url);
  const bSql = branchSql(branch);
  const bp = branchParams(branch);
  const shift = openShift(branch);
  const salesAgg = (date) => get(`SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS invoices,
      COALESCE(SUM(profit),0) AS profit, COALESCE(SUM(discount),0) AS discount
      FROM sales WHERE status = 'completed' AND substr(created_at,1,10) = ? ${bSql}`, date, ...bp);
  const t = salesAgg(today), y = salesAgg(yesterday);
  const monthStart = today.slice(0, 8) + '01';

  const series = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(today, -i);
    const row = get(`SELECT COALESCE(SUM(total),0) AS total, COALESCE(SUM(profit),0) AS profit, COUNT(*) AS invoices
                     FROM sales WHERE status = 'completed' AND substr(created_at,1,10) = ? ${bSql}`, d, ...bp);
    series.push({ date: d, ...row });
  }
  const paymentMix = all(`SELECT payment_method AS method, COUNT(*) AS count, COALESCE(SUM(total),0) AS total
                          FROM sales WHERE status = 'completed' AND substr(created_at,1,10) = ? ${bSql}
                          GROUP BY payment_method ORDER BY total DESC`, today, ...bp);
  const topToday = all(`SELECT si.name, SUM(si.qty) AS qty, SUM(si.total) AS total, si.unit
                        FROM sale_items si JOIN sales s ON s.id = si.sale_id
                        WHERE s.status = 'completed' AND substr(s.created_at,1,10) = ? ${branch ? 'AND s.branch_id = ?' : ''}
                        GROUP BY si.product_id ORDER BY total DESC LIMIT 6`, today, ...bp);
  const recent = all(`SELECT s.id, s.invoice_no, s.total, s.payment_method, s.status, s.created_at,
                             COALESCE(c.name, 'عميل نقدي') AS customer_name, u.name AS user_name, b.name AS branch_name
                      FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
                      JOIN users u ON u.id = s.user_id LEFT JOIN branches b ON b.id = s.branch_id
                      ${branch ? 'WHERE s.branch_id = ?' : ''}
                      ORDER BY s.id DESC LIMIT 7`, ...bp);
  const lowStockSql = branch
    ? `SELECT p.id, p.name, p.unit, COALESCE(ps.stock,0) AS stock, p.min_stock FROM products p
       LEFT JOIN product_stock ps ON ps.product_id = p.id AND ps.branch_id = ?
       WHERE p.active = 1 AND COALESCE(ps.stock,0) <= p.min_stock
       ORDER BY (COALESCE(ps.stock,0) <= 0) DESC, ps.stock ASC LIMIT 6`
    : `SELECT id, name, unit, stock, min_stock FROM products
       WHERE active = 1 AND stock <= min_stock ORDER BY (stock <= 0) DESC, stock ASC LIMIT 6`;
  const lowStock = all(lowStockSql, ...bp);
  const expiring = all(`SELECT p.id, p.name, p.unit, ${branch ? 'COALESCE(ps.stock,0)' : 'p.stock'} AS stock, p.expiry_date,
                        CAST(julianday(p.expiry_date) - julianday(date('now','localtime')) AS INTEGER) AS days_left
                        FROM products p ${branch ? 'LEFT JOIN product_stock ps ON ps.product_id = p.id AND ps.branch_id = ?' : ''}
                        WHERE p.active = 1 AND p.expiry_date IS NOT NULL AND ${branch ? 'COALESCE(ps.stock,0)' : 'p.stock'} > 0
                        AND julianday(p.expiry_date) - julianday(date('now','localtime')) <= 30
                        ORDER BY p.expiry_date ASC LIMIT 6`, ...bp);
  const month = get(`SELECT COALESCE(SUM(total),0) AS total, COALESCE(SUM(profit),0) AS profit, COUNT(*) AS invoices
                     FROM sales WHERE status = 'completed' AND substr(created_at,1,10) >= ? ${bSql}`, monthStart, ...bp);
  const stockJoin = branch
    ? `FROM products p LEFT JOIN product_stock ps ON ps.product_id = p.id AND ps.branch_id = ? WHERE p.active = 1`
    : `FROM products p WHERE p.active = 1`;
  const counts = {
    products: get(`SELECT COUNT(*) AS c ${stockJoin}`, ...bp).c,
    customers: get('SELECT COUNT(*) AS c FROM customers WHERE active = 1').c,
    suppliers: get('SELECT COUNT(*) AS c FROM suppliers WHERE active = 1').c,
    users: get('SELECT COUNT(*) AS c FROM users WHERE active = 1').c,
    out_stock: get(`SELECT COUNT(*) AS c FROM products p ${branch ? 'LEFT JOIN product_stock ps ON ps.product_id=p.id AND ps.branch_id=?' : ''} WHERE p.active=1 AND ${branch ? 'COALESCE(ps.stock,0)' : 'p.stock'} <= 0`, ...bp).c,
    low_stock: get(`SELECT COUNT(*) AS c FROM products p ${branch ? 'LEFT JOIN product_stock ps ON ps.product_id=p.id AND ps.branch_id=?' : ''} WHERE p.active=1 AND ${branch ? 'COALESCE(ps.stock,0)' : 'p.stock'} > 0 AND ${branch ? 'COALESCE(ps.stock,0)' : 'p.stock'} <= p.min_stock`, ...bp).c,
    inventory_value: round2(num(get(`SELECT SUM(${branch ? 'COALESCE(ps.stock,0)' : 'p.stock'} * p.cost) AS s ${stockJoin}`, ...bp).s)),
    customers_debt: round2(num(get('SELECT SUM(balance) AS s FROM customers WHERE active = 1').s)),
    suppliers_debt: round2(num(get('SELECT SUM(balance) AS s FROM suppliers WHERE active = 1').s)),
  };
  const expensesToday = round2(num(get(`SELECT SUM(amount) AS s FROM expenses WHERE substr(created_at,1,10) = ? ${bSql}`, today, ...bp).s));
  return {
    branch,
    today: { ...t, total: round2(t.total), profit: round2(t.profit), expenses: expensesToday },
    yesterday: { ...y, total: round2(y.total), profit: round2(y.profit) },
    month: { ...month, total: round2(month.total), profit: round2(month.profit) },
    series, paymentMix, topToday, recent, lowStock, expiring, counts,
    shift: shift ? { id: shift.id, user_name: shift.user_name, opened_at: shift.opened_at, opening_cash: shift.opening_cash, branch_id: shift.branch_id } : null,
  };
});

/* ---------- المنتجات ---------- */
add('GET', '/api/products', 'products.view', (ctx) => {
  const u = ctx.url.searchParams;
  const page = Math.max(1, int(u.get('page'), 1));
  const limit = Math.min(500, Math.max(1, int(u.get('limit'), 24)));
  const branch = branchFromQuery(ctx.url);
  const where = ['p.active = 1'];
  const params = [];
  const search = str(u.get('search'), 80);
  if (search) {
    where.push('(p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (u.get('category')) { where.push('p.category_id = ?'); params.push(int(u.get('category'))); }
  const stockExpr = branch ? 'COALESCE(ps.stock, 0)' : 'p.stock';
  const stockFilter = u.get('stock');
  if (stockFilter === 'low') where.push(`${stockExpr} > 0 AND ${stockExpr} <= p.min_stock`);
  if (stockFilter === 'out') where.push(`${stockExpr} <= 0`);
  if (stockFilter === 'expiring') where.push("p.expiry_date IS NOT NULL AND julianday(p.expiry_date) - julianday(date('now','localtime')) <= 30");
  if (u.get('all') === '1') { /* include zero-stock */ }
  const sqlWhere = where.join(' AND ');
  const joinStock = branch ? 'LEFT JOIN product_stock ps ON ps.product_id = p.id AND ps.branch_id = ?' : '';
  const joinParams = branch ? [branch] : [];
  const total = get(`SELECT COUNT(*) AS c FROM products p ${joinStock} WHERE ${sqlWhere}`, ...joinParams, ...params).c;
  const rows = all(`SELECT p.*, c.name AS category_name, c.color AS category_color,
                    ${branch ? 'COALESCE(ps.stock,0)' : 'p.stock'} AS branch_stock, p.stock AS total_stock,
                    ${branch ? 'COALESCE(ps.stock,0)' : 'p.stock'} AS display_stock
                    FROM products p ${joinStock} LEFT JOIN categories c ON c.id = p.category_id
                    WHERE ${sqlWhere} ORDER BY p.name COLLATE NOCASE LIMIT ? OFFSET ?`,
    ...joinParams, ...params, limit, (page - 1) * limit);
  for (const r of rows) { if (branch) r.stock = r.branch_stock; }
  return { rows, total, page, limit, pages: Math.ceil(total / limit) || 1, branch };
});

add('GET', '/api/products/all', 'products.view', (ctx) => {
  const u = ctx.url.searchParams;
  const search = str(u.get('search'), 80);
  const branch = branchFromQuery(ctx.url);
  const rows = all(`SELECT p.id, p.name, p.barcode, p.sku, p.unit, p.price, p.wholesale_price, p.cost,
                    ${branch ? 'COALESCE(ps.stock,0)' : 'p.stock'} AS stock, p.stock AS total_stock,
                    p.min_stock, p.category_id, p.expiry_date
                    FROM products p ${branch ? 'LEFT JOIN product_stock ps ON ps.product_id = p.id AND ps.branch_id = ?' : ''}
                    WHERE p.active = 1 ${search ? 'AND (p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?)' : ''}
                    ORDER BY p.name COLLATE NOCASE LIMIT 800`,
    ...(branch ? [branch] : []), ...(search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []));
  return { rows, branch };
});

add('GET', '/api/products/lookup', 'products.view', (ctx) => {
  const code = str(ctx.url.searchParams.get('code'), 80);
  const branch = branchFromQuery(ctx.url);
  if (!code) fail('أدخل الباركود');
  const row = get(`SELECT p.*, c.name AS category_name, c.color AS category_color,
                   ${branch ? 'COALESCE(ps.stock,0)' : 'p.stock'} AS branch_stock
                   FROM products p ${branch ? 'LEFT JOIN product_stock ps ON ps.product_id = p.id AND ps.branch_id = ?' : ''}
                   LEFT JOIN categories c ON c.id = p.category_id
                   WHERE p.active = 1 AND (p.barcode = ? OR p.sku = ? OR p.name = ?) LIMIT 1`,
    ...(branch ? [branch] : []), code, code, code);
  if (!row) fail('المنتج غير موجود', 404, 'NOT_FOUND');
  if (branch) row.stock = row.branch_stock;
  return { product: row };
});

add('GET', '/api/products/:id/moves', 'inventory.view', (ctx) => {
  const branch = branchFromQuery(ctx.url);
  const rows = all(`SELECT m.*, u.name AS user_name, b.name AS branch_name FROM stock_moves m
                    LEFT JOIN users u ON u.id = m.user_id LEFT JOIN branches b ON b.id = m.branch_id
                    WHERE m.product_id = ? ${branch ? 'AND m.branch_id = ?' : ''}
                    ORDER BY m.id DESC LIMIT 100`, int(ctx.params.id), ...branchParams(branch));
  return { rows, product: productRow(int(ctx.params.id)), branch };
});

add('POST', '/api/products', 'products.manage', (ctx) => {
  const b = ctx.body;
  const name = str(b.name, 120);
  if (!name) fail('اسم المنتج مطلوب');
  const barcode = str(b.barcode, 60) || null;
  if (barcode && get('SELECT id FROM products WHERE barcode = ? AND active = 1', barcode)) fail('الباركود مستخدم بالفعل');
  const result = run(`INSERT INTO products
    (name, sku, barcode, category_id, unit, cost, price, wholesale_price, stock, min_stock, expiry_date, active, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    name, str(b.sku, 40) || null, barcode, b.category_id ? int(b.category_id) : null, str(b.unit, 20) || 'قطعة',
    round2(num(b.cost)), round2(num(b.price)), round2(num(b.wholesale_price)), num(b.stock), num(b.min_stock),
    str(b.expiry_date, 10) || null, str(b.notes, 400), now(), now());
  const id = Number(result.lastInsertRowid);
  const branchId = branchFromBody(b, ctx.user);  store.setBranchStock(id, branchId, num(b.stock));
  if (num(b.stock) !== 0) {
    run(`INSERT INTO stock_moves (product_id, branch_id, type, qty, balance, note, user_id, created_at)
         VALUES (?, ?, 'open', ?, ?, 'رصيد افتتاحي', ?, ?)`, id, branchId, num(b.stock), num(b.stock), ctx.user.id, now());
  }
  logActivity(ctx.user.id, 'product.create', `إضافة منتج: ${name}`, ctx.ip);
  logAudit(ctx, 'create', 'products', id, { name, price: num(b.price) });
  return { product: productRow(id), message: 'تمت إضافة المنتج' };
});

add('PUT', '/api/products/:id', 'products.manage', (ctx) => {
  const id = int(ctx.params.id);
  const old = productRow(id);
  if (!old) fail('المنتج غير موجود', 404);
  const b = ctx.body;
  const barcode = str(b.barcode, 60) || null;
  if (barcode) {
    const dup = get('SELECT id FROM products WHERE barcode = ? AND id <> ?', barcode, id);
    if (dup) fail('الباركود مستخدم لمنتج آخر');
  }
  run(`UPDATE products SET name=?, sku=?, barcode=?, category_id=?, unit=?, cost=?, price=?, wholesale_price=?,
       min_stock=?, expiry_date=?, notes=?, updated_at=? WHERE id=?`,
    str(b.name, 120) || old.name, str(b.sku, 40) || null, barcode, b.category_id ? int(b.category_id) : null,
    str(b.unit, 20) || old.unit, round2(num(b.cost)), round2(num(b.price)), round2(num(b.wholesale_price)),
    num(b.min_stock), str(b.expiry_date, 10) || null, str(b.notes, 400), now(), id);
  logActivity(ctx.user.id, 'product.update', `تعديل منتج: ${old.name}`, ctx.ip);
  logAudit(ctx, 'update', 'products', id, { name: old.name, changes: b });
  return { product: productRow(id), message: 'تم حفظ التعديلات' };
});

add('DELETE', '/api/products/:id', 'products.manage', (ctx) => {
  const id = int(ctx.params.id);
  const p = productRow(id);
  if (!p) fail('المنتج غير موجود', 404);
  run('UPDATE products SET active = 0, updated_at = ? WHERE id = ?', now(), id);
  logActivity(ctx.user.id, 'product.delete', `حذف منتج: ${p.name}`, ctx.ip);
  logAudit(ctx, 'delete', 'products', id, { name: p.name });
  return { message: 'تم حذف المنتج' };
});

add('POST', '/api/products/:id/adjust', 'inventory.manage', (ctx) => {
  const id = int(ctx.params.id);
  const p = productRow(id);
  if (!p) fail('المنتج غير موجود', 404);
  const branchId = branchFromBody(ctx.body, ctx.user);
  const current = branchProductStock(id, branchId);
  const mode = String(ctx.body.mode || 'set');
  const qty = num(ctx.body.qty);
  let newStock = current;
  if (mode === 'add') newStock = current + qty;
  else if (mode === 'remove') newStock = current - qty;
  else newStock = qty;
  if (newStock < 0 && store.settingsObject().allow_negative_stock !== '1') fail('لا يمكن أن يكون الرصيد سالبًا');
  newStock = round2(newStock);
  const delta = round2(newStock - current);
  tx(() => {
    run('UPDATE products SET stock = ROUND(stock + ?, 2), updated_at = ? WHERE id = ?', delta, now(), id);
    store.setBranchStock(id, branchId, newStock);
    run(`INSERT INTO stock_moves (product_id, branch_id, type, qty, balance, note, user_id, created_at)
         VALUES (?, ?, 'adjust', ?, ?, ?, ?, ?)`, id, branchId, delta, newStock, str(ctx.body.note, 200) || 'تسوية مخزون', ctx.user.id, now());
  });
  logActivity(ctx.user.id, 'stock.adjust', `تسوية مخزون: ${p.name} → ${newStock}`, ctx.ip);
  return { product: productRow(id), message: 'تم تحديث المخزون' };
});

/* ---------- التصنيفات ---------- */
add('GET', '/api/categories', null, () => ({
  rows: all(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS products_count
             FROM categories c WHERE c.active = 1 ORDER BY c.sort, c.name`),
}));
add('POST', '/api/categories', 'products.manage', (ctx) => {
  const name = str(ctx.body.name, 60);
  if (!name) fail('اسم التصنيف مطلوب');
  const r = run('INSERT INTO categories (name, kind, color, icon, sort, active) VALUES (?, ?, ?, ?, ?, 1)',
    name, str(ctx.body.kind, 30) || 'grocery', str(ctx.body.color, 20) || '#10b981', str(ctx.body.icon, 30) || 'bag',
    int(ctx.body.sort, 99));
  logAudit(ctx, 'create', 'categories', Number(r.lastInsertRowid), { name });
  return { id: Number(r.lastInsertRowid), message: 'تمت إضافة التصنيف' };
});
add('PUT', '/api/categories/:id', 'products.manage', (ctx) => {
  const id = int(ctx.params.id);
  const old = get('SELECT * FROM categories WHERE id = ?', id);
  if (!old) fail('التصنيف غير موجود', 404);
  run('UPDATE categories SET name=?, kind=?, color=?, icon=?, sort=? WHERE id=?',
    str(ctx.body.name, 60) || old.name, str(ctx.body.kind, 30) || old.kind, str(ctx.body.color, 20) || old.color,
    str(ctx.body.icon, 30) || old.icon, int(ctx.body.sort, old.sort), id);
  logAudit(ctx, 'update', 'categories', id, { name: str(ctx.body.name, 60) || old.name });
  return { message: 'تم تحديث التصنيف' };
});
add('DELETE', '/api/categories/:id', 'products.manage', (ctx) => {
  const id = int(ctx.params.id);
  const used = get('SELECT COUNT(*) AS c FROM products WHERE category_id = ? AND active = 1', id).c;
  if (used) fail('لا يمكن حذف تصنيف يحتوي على منتجات');
  const old = get('SELECT * FROM categories WHERE id = ?', id);
  if (!old) fail('التصنيف غير موجود', 404);
  run('UPDATE categories SET active = 0 WHERE id = ?', id);
  logAudit(ctx, 'delete', 'categories', id, { name: old.name });
  return { message: 'تم حذف التصنيف' };
});

/* ---------- المبيعات ---------- */
function saleDetail(id) {
  const sale = get(`SELECT s.*, COALESCE(c.name, 'عميل نقدي') AS customer_name, c.phone AS customer_phone,
                           u.name AS user_name, b.name AS branch_name, b.code AS branch_code
                    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
                    JOIN users u ON u.id = s.user_id LEFT JOIN branches b ON b.id = s.branch_id
                    WHERE s.id = ?`, id);
  if (!sale) return null;
  sale.items = all('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id', id);
  sale.returns = all('SELECT r.*, u.name AS user_name FROM returns r JOIN users u ON u.id = r.user_id WHERE r.sale_id = ?', id);
  return sale;
}

add('GET', '/api/sales', 'sales.view', (ctx) => {
  const u = ctx.url.searchParams;
  const { from, to, fromTs, toTs } = rangeFromQuery(ctx.url);
  const page = Math.max(1, int(u.get('page'), 1));
  const limit = Math.min(100, Math.max(1, int(u.get('limit'), 20)));
  const branch = branchFromQuery(ctx.url);
  const where = ['s.created_at BETWEEN ? AND ?', ...(branch ? ['s.branch_id = ?'] : [])];
  const params = [fromTs, toTs, ...branchParams(branch)];
  const search = str(u.get('q'), 60);
  if (search) {
    where.push('(s.invoice_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (u.get('method')) { where.push('s.payment_method = ?'); params.push(str(u.get('method'), 20)); }
  if (u.get('status')) { where.push('s.status = ?'); params.push(str(u.get('status'), 20)); }
  const sqlWhere = where.join(' AND ');
  const summary = get(`SELECT COUNT(*) AS count, COALESCE(SUM(s.total),0) AS total, COALESCE(SUM(s.profit),0) AS profit,
                              COALESCE(SUM(s.paid),0) AS paid
                       FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE ${sqlWhere}`, ...params);
  const rows = all(`SELECT s.id, s.invoice_no, s.total, s.paid, s.change_due, s.discount, s.tax, s.profit,
                           s.payment_method, s.status, s.created_at, s.customer_id, s.branch_id, b.name AS branch_name,
                           COALESCE(c.name, 'عميل نقدي') AS customer_name, u.name AS user_name,
                           (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS items_count
                    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
                    JOIN users u ON u.id = s.user_id LEFT JOIN branches b ON b.id = s.branch_id
                    WHERE ${sqlWhere} ORDER BY s.id DESC LIMIT ? OFFSET ?`,
    ...params, limit, (page - 1) * limit);
  return { rows, summary, total: summary.count, page, limit, pages: Math.ceil(summary.count / limit) || 1, from, to, branch };
});

add('GET', '/api/sales/:id', 'sales.view', (ctx) => {
  const sale = saleDetail(int(ctx.params.id));
  if (!sale) fail('الفاتورة غير موجودة', 404);
  sale.settings = store.settingsObject();
  return { sale };
});

add('POST', '/api/sales', 'pos.use', (ctx) => {
  const b = ctx.body;
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) fail('الفاتورة لا تحتوي على منتجات');
  const settings = store.settingsObject();
  const branchId = branchFromBody(b, ctx.user);
  const branch = requireBranch(branchId);
  const shift = currentUserShift(ctx.user.id, branchId);
  const customerId = b.customer_id ? int(b.customer_id) : null;
  const method = ['cash', 'card', 'wallet', 'credit'].includes(b.payment_method) ? b.payment_method : 'cash';
  if (method === 'credit' && !customerId) fail('اختر عميلًا للبيع الآجل');

  const result = tx(() => {
    let subtotal = 0, costTotal = 0;
    const lines = [];
    for (const raw of items) {
      const p = productRow(int(raw.product_id));
      if (!p || !p.active) fail('أحد المنتجات غير متوفر', 400);
      const qty = round2(num(raw.qty));
      if (qty <= 0) fail(`كمية غير صحيحة للمنتج ${p.name}`);
      const avail = branchProductStock(p.id, branchId);
      if (settings.allow_negative_stock !== '1') {
        if (avail < qty) fail(`الرصيد غير كافٍ للمنتج «${p.name}» في ${branch.name} — المتاح ${avail} ${p.unit}`, 400, 'NO_STOCK');
      }
      const lineTotal = round2(qty * p.price);
      subtotal = round2(subtotal + lineTotal);
      costTotal = round2(costTotal + qty * p.cost);
      lines.push({ p, qty, lineTotal });
    }
    let discount = Math.max(0, round2(num(b.discount)));
    if (discount > subtotal) discount = subtotal;
    const rate = Math.max(0, num(settings.tax_rate));
    const taxable = round2(subtotal - discount);
    let tax = 0, total = taxable;
    if (rate > 0) {
      if (settings.tax_inclusive === '1') { tax = round2(taxable * rate / (100 + rate)); total = taxable; }
      else { tax = round2(taxable * rate / 100); total = round2(taxable + tax); }
    }
    let paid = round2(num(b.paid, method === 'credit' ? 0 : total));
    let change = 0;
    if (method === 'credit') {
      if (paid > total) paid = total;
    } else {
      paid = paid > 0 ? paid : total;
      if (paid < total) fail('المبلغ المدفوع أقل من الإجمالي');
      change = round2(paid - total);
    }
    const invoiceNo = store.nextNumber('sales', settings.invoice_prefix || 'INV-');
    const profit = round2(taxable - costTotal);
    const sale = run(`INSERT INTO sales
      (invoice_no, customer_id, user_id, branch_id, shift_id, subtotal, discount, tax, total, paid, change_due, cost_total, profit,
       payment_method, status, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
      invoiceNo, customerId, ctx.user.id, branchId, shift ? shift.id : null, subtotal, discount, tax, total, paid, change, costTotal,
      profit, method, str(b.note, 300), now());
    const saleId = Number(sale.lastInsertRowid);
    for (const l of lines) {
      run(`INSERT INTO sale_items (sale_id, product_id, name, unit, qty, unit_price, unit_cost, discount, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        saleId, l.p.id, l.p.name, l.p.unit, l.qty, l.p.price, l.p.cost, l.lineTotal);
      run('UPDATE products SET stock = ROUND(stock - ?, 2), updated_at = ? WHERE id = ?', l.qty, now(), l.p.id);
      const balance = store.setBranchStock(l.p.id, branchId, store.branchStock(l.p.id, branchId) - l.qty);
      run(`INSERT INTO stock_moves (product_id, branch_id, type, qty, balance, ref_type, ref_id, user_id, created_at)
           VALUES (?, ?, 'sale', ?, ?, 'sale', ?, ?, ?)`, l.p.id, branchId, -l.qty, balance, saleId, ctx.user.id, now());
    }
    if (method === 'credit') {
      run('UPDATE customers SET balance = balance + ? WHERE id = ?', round2(total - paid), customerId);
    }
    if (paid > 0) {
      run(`INSERT INTO payments (branch_id, type, direction, amount, method, ref_type, ref_id, party_type, party_id, user_id, shift_id, created_at)
           VALUES (?, 'sale', 'in', ?, ?, 'sale', ?, 'customer', ?, ?, ?, ?)`,
        branchId, paid, method === 'credit' ? 'credit' : method, saleId, customerId, ctx.user.id, shift ? shift.id : null, now());
    }
    if (b.hold_id) run('DELETE FROM holds WHERE id = ?', int(b.hold_id));
    logActivity(ctx.user.id, 'sale.create', `فاتورة بيع ${invoiceNo} بقيمة ${total} — ${branch.name}`, ctx.ip);
    return { saleId, invoiceNo, total, branch_id: branchId, branch_name: branch.name };
  });

  return { ...result, sale: saleDetail(result.saleId), message: 'تم إتمام عملية البيع بنجاح' };
});

add('POST', '/api/sales/:id/return', 'sales.return', (ctx) => {
  const id = int(ctx.params.id);
  const sale = saleDetail(id);
  if (!sale) fail('الفاتورة غير موجودة', 404);
  if (sale.status !== 'completed') fail('لا يمكن إرجاع هذه الفاتورة');
  const restock = ctx.body.restock !== false;
  const amount = round2(sale.total - sale.returned_total);
  if (amount <= 0) fail('تم إرجاع هذه الفاتورة بالكامل');
  tx(() => {
    run('UPDATE sales SET status = ?, returned_total = ? WHERE id = ?', 'returned', round2(sale.total), id);
    run('INSERT INTO returns (sale_id, user_id, branch_id, amount, restock, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, ctx.user.id, sale.branch_id, amount, restock ? 1 : 0, str(ctx.body.reason, 300), now());
    if (restock) {
      for (const it of sale.items) {
        if (!it.product_id) continue;
        run('UPDATE products SET stock = ROUND(stock + ?, 2) WHERE id = ?', it.qty, it.product_id);
        const balance = store.setBranchStock(it.product_id, sale.branch_id, store.branchStock(it.product_id, sale.branch_id) + it.qty);
        run(`INSERT INTO stock_moves (product_id, branch_id, type, qty, balance, ref_type, ref_id, user_id, created_at)
             VALUES (?, ?, 'return', ?, ?, 'sale', ?, ?, ?)`, it.product_id, sale.branch_id, it.qty, balance, id, ctx.user.id, now());
      }
    }
    const refund = Math.min(sale.paid, amount);
    if (refund > 0) {
      run(`INSERT INTO payments (branch_id, type, direction, amount, method, ref_type, ref_id, user_id, created_at)
           VALUES (?, 'return', 'out', ?, ?, 'sale', ?, ?, ?)`, sale.branch_id, refund, sale.payment_method === 'credit' ? 'cash' : sale.payment_method,
        id, ctx.user.id, now());
    }
    if (sale.payment_method === 'credit' && sale.customer_id) {
      run('UPDATE customers SET balance = MAX(0, balance - ?) WHERE id = ?', amount - refund, sale.customer_id);
    }
    logActivity(ctx.user.id, 'sale.return', `إرجاع الفاتورة ${sale.invoice_no} بقيمة ${amount}`, ctx.ip);
  });
  return { message: 'تم إرجاع الفاتورة وإضافة الكميات للمخزون', sale: saleDetail(id) };
});

/* ---------- الفواتير المعلقة ---------- */
add('GET', '/api/holds', 'pos.use', (ctx) => {
  const branch = branchFromQuery(ctx.url);
  return {
    rows: all(`SELECT h.*, u.name AS user_name, b.name AS branch_name FROM holds h
               JOIN users u ON u.id = h.user_id LEFT JOIN branches b ON b.id = h.branch_id
               ${branch ? 'WHERE h.branch_id = ?' : ''} ORDER BY h.id DESC LIMIT 50`, ...branchParams(branch)),
  };
});
add('POST', '/api/holds', 'pos.use', (ctx) => {
  const payload = JSON.stringify(ctx.body.payload || {});
  const branchId = branchFromBody(ctx.body, ctx.user);
  const r = run('INSERT INTO holds (user_id, branch_id, label, payload, total, items_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ctx.user.id, branchId, str(ctx.body.label, 60) || 'فاتورة معلقة', payload, round2(num(ctx.body.total)),
    int(ctx.body.items_count), now());
  return { id: Number(r.lastInsertRowid), message: 'تم تعليق الفاتورة' };
});
add('DELETE', '/api/holds/:id', 'pos.use', (ctx) => {
  run('DELETE FROM holds WHERE id = ?', int(ctx.params.id));
  return { message: 'تم حذف الفاتورة المعلقة' };
});

/* ---------- تحصيل آجل ---------- */
add('POST', '/api/sales/:id/collect', 'treasury.manage', (ctx) => {
  const id = int(ctx.params.id);
  const sale = saleDetail(id);
  if (!sale) fail('الفاتورة غير موجودة', 404);
  if (sale.payment_method !== 'credit') fail('هذه الفاتورة مدفوعة بالفعل');
  const amount = round2(num(ctx.body.amount));
  if (amount <= 0) fail('أدخل مبلغًا صحيحًا');
  const remaining = round2(sale.total - sale.paid);
  if (amount > remaining + 0.01) fail('المبلغ أكبر من المتبقي على الفاتورة');
  const shift = currentUserShift(ctx.user.id, sale.branch_id);
  tx(() => {
    run('UPDATE sales SET paid = paid + ? WHERE id = ?', amount, id);
    run('UPDATE customers SET balance = MAX(0, balance - ?) WHERE id = ?', amount, sale.customer_id);
    run(`INSERT INTO payments (branch_id, type, direction, amount, method, ref_type, ref_id, party_type, party_id, user_id, shift_id, created_at)
         VALUES (?, 'customer_payment', 'in', ?, ?, 'sale', ?, 'customer', ?, ?, ?, ?)`,
      sale.branch_id, amount, str(ctx.body.method, 20) || 'cash', id, sale.customer_id, ctx.user.id, shift ? shift.id : null, now());
    logActivity(ctx.user.id, 'sale.collect', `تحصيل ${amount} من فاتورة ${sale.invoice_no}`, ctx.ip);
  });
  return { message: 'تم تسجيل التحصيل', sale: saleDetail(id) };
});

/* ---------- المشتريات ---------- */
function purchaseDetail(id) {
  const purchase = get(`SELECT pu.*, COALESCE(su.name, 'مورد نقدي') AS supplier_name, su.phone AS supplier_phone,
                               u.name AS user_name, b.name AS branch_name, b.code AS branch_code
                        FROM purchases pu LEFT JOIN suppliers su ON su.id = pu.supplier_id
                        JOIN users u ON u.id = pu.user_id LEFT JOIN branches b ON b.id = pu.branch_id
                        WHERE pu.id = ?`, id);
  if (!purchase) return null;
  purchase.items = all('SELECT * FROM purchase_items WHERE purchase_id = ?', id);
  return purchase;
}

add('GET', '/api/purchases', 'purchases.view', (ctx) => {
  const u = ctx.url.searchParams;
  const { from, to, fromTs, toTs } = rangeFromQuery(ctx.url);
  const page = Math.max(1, int(u.get('page'), 1));
  const limit = Math.min(100, Math.max(1, int(u.get('limit'), 20)));
  const branch = branchFromQuery(ctx.url);
  const where = ['pu.created_at BETWEEN ? AND ?', ...(branch ? ['pu.branch_id = ?'] : [])];
  const params = [fromTs, toTs, ...branchParams(branch)];
  const search = str(u.get('q'), 60);
  if (search) {
    where.push('(pu.invoice_no LIKE ? OR su.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const sqlWhere = where.join(' AND ');
  const summary = get(`SELECT COUNT(*) AS count, COALESCE(SUM(pu.total),0) AS total, COALESCE(SUM(pu.paid),0) AS paid
                       FROM purchases pu LEFT JOIN suppliers su ON su.id = pu.supplier_id WHERE ${sqlWhere}`, ...params);
  const rows = all(`SELECT pu.*, COALESCE(su.name, 'مورد نقدي') AS supplier_name, u.name AS user_name,
                           b.name AS branch_name,
                           (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = pu.id) AS items_count
                    FROM purchases pu LEFT JOIN suppliers su ON su.id = pu.supplier_id
                    JOIN users u ON u.id = pu.user_id LEFT JOIN branches b ON b.id = pu.branch_id
                    WHERE ${sqlWhere} ORDER BY pu.id DESC LIMIT ? OFFSET ?`,
    ...params, limit, (page - 1) * limit);
  return { rows, summary, total: summary.count, page, limit, pages: Math.ceil(summary.count / limit) || 1, from, to, branch };
});

add('GET', '/api/purchases/:id', 'purchases.view', (ctx) => {
  const purchase = purchaseDetail(int(ctx.params.id));
  if (!purchase) fail('فاتورة الشراء غير موجودة', 404);
  return { purchase };
});

add('POST', '/api/purchases', 'purchases.manage', (ctx) => {
  const b = ctx.body;
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) fail('أضف منتجات للفاتورة');
  const supplierId = b.supplier_id ? int(b.supplier_id) : null;
  if (!supplierId) fail('اختر المورد');
  const branchId = branchFromBody(b, ctx.user);
  const branch = requireBranch(branchId);
  const settings = store.settingsObject();
  const result = tx(() => {
    let subtotal = 0;
    const lines = [];
    for (const raw of items) {
      const p = productRow(int(raw.product_id));
      if (!p) fail('أحد المنتجات غير موجود');
      const qty = round2(num(raw.qty));
      if (qty <= 0) fail(`كمية غير صحيحة للمنتج ${p.name}`);
      const cost = round2(num(raw.cost, p.cost));
      const total = round2(qty * cost);
      subtotal = round2(subtotal + total);
      lines.push({ p, qty, cost, total });
    }
    const discount = Math.min(subtotal, Math.max(0, round2(num(b.discount))));
    const total = round2(subtotal - discount);
    let paid = Math.max(0, round2(num(b.paid, total)));
    if (paid > total) paid = total;
    const method = ['cash', 'card', 'wallet', 'credit'].includes(b.payment_method) ? b.payment_method : 'cash';
    const invoiceNo = store.nextNumber('purchases', settings.purchase_prefix || 'PUR-');
    const purchase = run(`INSERT INTO purchases (invoice_no, supplier_id, user_id, branch_id, subtotal, discount, tax, total, paid,
                           payment_method, status, note, created_at)
                          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'completed', ?, ?)`,
      invoiceNo, supplierId, ctx.user.id, branchId, subtotal, discount, total, method === 'credit' ? 0 : paid,
      method, str(b.note, 300), now());
    const purchaseId = Number(purchase.lastInsertRowid);
    for (const l of lines) {
      run('INSERT INTO purchase_items (purchase_id, product_id, name, qty, unit_cost, total) VALUES (?, ?, ?, ?, ?, ?)',
        purchaseId, l.p.id, l.p.name, l.qty, l.cost, l.total);
      run('UPDATE products SET stock = ROUND(stock + ?, 2), cost = ?, updated_at = ? WHERE id = ?', l.qty, l.cost, now(), l.p.id);
      const balance = store.setBranchStock(l.p.id, branchId, store.branchStock(l.p.id, branchId) + l.qty);
      run(`INSERT INTO stock_moves (product_id, branch_id, type, qty, balance, ref_type, ref_id, user_id, created_at)
           VALUES (?, ?, 'purchase', ?, ?, 'purchase', ?, ?, ?)`, l.p.id, branchId, l.qty, balance, purchaseId, ctx.user.id, now());
    }
    const due = round2(total - (method === 'credit' ? 0 : paid));
    if (due > 0) run('UPDATE suppliers SET balance = balance + ? WHERE id = ?', due, supplierId);
    if (method !== 'credit' && paid > 0) {
      run(`INSERT INTO payments (branch_id, type, direction, amount, method, ref_type, ref_id, party_type, party_id, user_id, created_at)
           VALUES (?, 'purchase', 'out', ?, ?, 'purchase', ?, 'supplier', ?, ?, ?)`,
        branchId, paid, method, purchaseId, supplierId, ctx.user.id, now());
    }
    logActivity(ctx.user.id, 'purchase.create', `فاتورة شراء ${invoiceNo} بقيمة ${total} — ${branch.name}`, ctx.ip);
    return { purchaseId, invoiceNo, total, branch_id: branchId, branch_name: branch.name };
  });
  return { ...result, purchase: purchaseDetail(result.purchaseId), message: 'تم تسجيل فاتورة الشراء وتحديث المخزون' };
});

/* ---------- العملاء والموردون ---------- */
add('GET', '/api/customers', 'contacts.view', (ctx) => {
  const u = ctx.url.searchParams;
  const search = str(u.get('q'), 60);
  const page = Math.max(1, int(u.get('page'), 1));
  const limit = Math.min(200, Math.max(1, int(u.get('limit'), 50)));
  const where = 'active = 1' + (search ? ' AND (name LIKE ? OR phone LIKE ?)' : '');
  const params = search ? [`%${search}%`, `%${search}%`] : [];
  const total = get(`SELECT COUNT(*) AS c FROM customers WHERE ${where}`, ...params).c;
  const summary = get('SELECT COALESCE(SUM(balance),0) AS debt FROM customers WHERE active = 1');
  const rows = all(`SELECT *, (SELECT COUNT(*) FROM sales s WHERE s.customer_id = customers.id) AS invoices_count,
                    (SELECT COALESCE(SUM(total),0) FROM sales s WHERE s.customer_id = customers.id AND s.status='completed') AS total_sales
                    FROM customers WHERE ${where} ORDER BY balance DESC, name LIMIT ? OFFSET ?`,
    ...params, limit, (page - 1) * limit);
  return { rows, total, page, limit, pages: Math.ceil(total / limit) || 1, summary };
});
add('POST', '/api/customers', 'contacts.manage', (ctx) => {
  const name = str(ctx.body.name, 100);
  if (!name) fail('اسم العميل مطلوب');
  const r = run('INSERT INTO customers (name, phone, address, balance, notes, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
    name, str(ctx.body.phone, 30), str(ctx.body.address, 200), round2(num(ctx.body.balance)), str(ctx.body.notes, 300), now());
  logAudit(ctx, 'create', 'customers', Number(r.lastInsertRowid), { name });
  return { id: Number(r.lastInsertRowid), message: 'تمت إضافة العميل' };
});
add('PUT', '/api/customers/:id', 'contacts.manage', (ctx) => {
  const id = int(ctx.params.id);
  const old = get('SELECT * FROM customers WHERE id = ?', id);
  if (!old) fail('العميل غير موجود', 404);
  run('UPDATE customers SET name=?, phone=?, address=?, notes=? WHERE id=?',
    str(ctx.body.name, 100) || old.name, str(ctx.body.phone, 30), str(ctx.body.address, 200), str(ctx.body.notes, 300), id);
  logAudit(ctx, 'update', 'customers', id, { name: str(ctx.body.name, 100) || old.name });
  return { message: 'تم تحديث بيانات العميل' };
});
add('DELETE', '/api/customers/:id', 'contacts.manage', (ctx) => {
  const id = int(ctx.params.id);
  const bal = get('SELECT balance FROM customers WHERE id = ?', id);
  if (bal && bal.balance > 0) fail('لا يمكن حذف عميل عليه مديونية');
  run('UPDATE customers SET active = 0 WHERE id = ?', id);
  logAudit(ctx, 'delete', 'customers', id, { name: get('SELECT name FROM customers WHERE id = ?', id)?.name });
  return { message: 'تم حذف العميل' };
});
add('GET', '/api/customers/:id/statement', 'contacts.view', (ctx) => {
  const id = int(ctx.params.id);
  const customer = get('SELECT * FROM customers WHERE id = ?', id);
  if (!customer) fail('العميل غير موجود', 404);
  return {
    customer,
    sales: all(`SELECT id, invoice_no, total, paid, payment_method, status, created_at FROM sales WHERE customer_id = ? ORDER BY id DESC LIMIT 100`, id),
    payments: all(`SELECT * FROM payments WHERE party_type = 'customer' AND party_id = ? ORDER BY id DESC LIMIT 100`, id),
  };
});
add('POST', '/api/customers/:id/pay', 'treasury.manage', (ctx) => {
  const id = int(ctx.params.id);
  const customer = get('SELECT * FROM customers WHERE id = ? AND active = 1', id);
  if (!customer) fail('العميل غير موجود', 404);
  const amount = round2(num(ctx.body.amount));
  if (amount <= 0) fail('أدخل مبلغًا صحيحًا');
  if (amount > customer.balance + 0.01) fail('المبلغ أكبر من مديونية العميل');
  const method = ['cash', 'card', 'wallet'].includes(ctx.body.method) ? ctx.body.method : 'cash';
  const branchId = branchFromBody(ctx.body, ctx.user);
  const shift = currentUserShift(ctx.user.id, branchId);
  tx(() => {
    run('UPDATE customers SET balance = MAX(0, balance - ?) WHERE id = ?', amount, id);
    run(`INSERT INTO payments (branch_id, type, direction, amount, method, party_type, party_id, note, user_id, shift_id, created_at)
         VALUES (?, 'customer_payment', 'in', ?, ?, 'customer', ?, ?, ?, ?, ?)`,
      branchId, amount, method, id, str(ctx.body.note, 200) || 'سداد مديونية عميل', ctx.user.id, shift ? shift.id : null, now());
    logActivity(ctx.user.id, 'customer.pay', `تحصيل ${amount} من ${customer.name}`, ctx.ip);
  });
  return { message: 'تم تسجيل الدفعة', balance: round2(customer.balance - amount) };
});

add('GET', '/api/suppliers', 'contacts.view', (ctx) => {
  const u = ctx.url.searchParams;
  const search = str(u.get('q'), 60);
  const where = 'active = 1' + (search ? ' AND (name LIKE ? OR phone LIKE ?)' : '');
  const params = search ? [`%${search}%`, `%${search}%`] : [];
  const summary = get('SELECT COALESCE(SUM(balance),0) AS debt FROM suppliers WHERE active = 1');
  const rows = all(`SELECT *, (SELECT COUNT(*) FROM purchases pu WHERE pu.supplier_id = suppliers.id) AS invoices_count
                    FROM suppliers WHERE ${where} ORDER BY balance DESC, name LIMIT 300`, ...params);
  return { rows, summary };
});
add('POST', '/api/suppliers', 'contacts.manage', (ctx) => {
  const name = str(ctx.body.name, 100);
  if (!name) fail('اسم المورد مطلوب');
  const r = run('INSERT INTO suppliers (name, phone, address, balance, notes, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
    name, str(ctx.body.phone, 30), str(ctx.body.address, 200), round2(num(ctx.body.balance)), str(ctx.body.notes, 300), now());
  logAudit(ctx, 'create', 'suppliers', Number(r.lastInsertRowid), { name });
  return { id: Number(r.lastInsertRowid), message: 'تمت إضافة المورد' };
});
add('PUT', '/api/suppliers/:id', 'contacts.manage', (ctx) => {
  const id = int(ctx.params.id);
  const old = get('SELECT * FROM suppliers WHERE id = ?', id);
  if (!old) fail('المورد غير موجود', 404);
  run('UPDATE suppliers SET name=?, phone=?, address=?, notes=? WHERE id=?',
    str(ctx.body.name, 100) || old.name, str(ctx.body.phone, 30), str(ctx.body.address, 200), str(ctx.body.notes, 300), id);
  logAudit(ctx, 'update', 'suppliers', id, { name: str(ctx.body.name, 100) || old.name });
  return { message: 'تم تحديث بيانات المورد' };
});
add('DELETE', '/api/suppliers/:id', 'contacts.manage', (ctx) => {
  const id = int(ctx.params.id);
  const bal = get('SELECT balance FROM suppliers WHERE id = ?', id);
  if (bal && bal.balance > 0) fail('لا يمكن حذف مورد عليه مستحقات');
  run('UPDATE suppliers SET active = 0 WHERE id = ?', id);
  logAudit(ctx, 'delete', 'suppliers', id, { name: get('SELECT name FROM suppliers WHERE id = ?', id)?.name });
  return { message: 'تم حذف المورد' };
});
add('POST', '/api/suppliers/:id/pay', 'treasury.manage', (ctx) => {
  const id = int(ctx.params.id);
  const supplier = get('SELECT * FROM suppliers WHERE id = ? AND active = 1', id);
  if (!supplier) fail('المورد غير موجود', 404);
  const amount = round2(num(ctx.body.amount));
  if (amount <= 0) fail('أدخل مبلغًا صحيحًا');
  if (amount > supplier.balance + 0.01) fail('المبلغ أكبر من مستحقات المورد');
  const method = ['cash', 'card', 'wallet'].includes(ctx.body.method) ? ctx.body.method : 'cash';
  const branchId = branchFromBody(ctx.body, ctx.user);
  const shift = currentUserShift(ctx.user.id, branchId);
  tx(() => {
    run('UPDATE suppliers SET balance = MAX(0, balance - ?) WHERE id = ?', amount, id);
    run(`INSERT INTO payments (branch_id, type, direction, amount, method, party_type, party_id, note, user_id, shift_id, created_at)
         VALUES (?, 'supplier_payment', 'out', ?, ?, 'supplier', ?, ?, ?, ?, ?)`,
      branchId, amount, method, id, str(ctx.body.note, 200) || 'سداد مستحقات مورد', ctx.user.id, shift ? shift.id : null, now());
    logActivity(ctx.user.id, 'supplier.pay', `سداد ${amount} إلى ${supplier.name}`, ctx.ip);
  });
  return { message: 'تم تسجيل الدفعة', balance: round2(supplier.balance - amount) };
});

/* ---------- الخزينة ---------- */
add('GET', '/api/treasury', 'treasury.view', (ctx) => {
  const { from, to, fromTs, toTs } = rangeFromQuery(ctx.url);
  const branch = branchFromQuery(ctx.url);
  const bSql = branchSql(branch);
  const bp = branchParams(branch);
  const summary = get(`SELECT
      COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE 0 END),0) AS total_in,
      COALESCE(SUM(CASE WHEN direction='out' THEN amount ELSE 0 END),0) AS total_out,
      COALESCE(SUM(CASE WHEN direction='in' AND method='cash' THEN amount ELSE 0 END),0) AS cash_in,
      COALESCE(SUM(CASE WHEN direction='out' AND method='cash' THEN amount ELSE 0 END),0) AS cash_out,
      COALESCE(SUM(CASE WHEN direction='in' AND method='card' THEN amount ELSE 0 END),0) AS card_in,
      COALESCE(SUM(CASE WHEN direction='out' AND method='card' THEN amount ELSE 0 END),0) AS card_out
      FROM payments WHERE created_at BETWEEN ? AND ? ${bSql}`, fromTs, toTs, ...bp);
  const byType = all(`SELECT type, direction, method, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
                      FROM payments WHERE created_at BETWEEN ? AND ? ${bSql}
                      GROUP BY type, direction, method ORDER BY total DESC`, fromTs, toTs, ...bp);
  const byDay = all(`SELECT substr(created_at,1,10) AS date,
      COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE 0 END),0) AS total_in,
      COALESCE(SUM(CASE WHEN direction='out' THEN amount ELSE 0 END),0) AS total_out
      FROM payments WHERE created_at BETWEEN ? AND ? ${bSql} GROUP BY date ORDER BY date`, fromTs, toTs, ...bp);
  const rows = all(`SELECT p.*, u.name AS user_name, b.name AS branch_name FROM payments p
                    LEFT JOIN users u ON u.id = p.user_id LEFT JOIN branches b ON b.id = p.branch_id
                    WHERE p.created_at BETWEEN ? AND ? ${branch ? 'AND p.branch_id = ?' : ''}
                    ORDER BY p.id DESC LIMIT 200`, fromTs, toTs, ...bp);
  const expenses = all(`SELECT e.*, u.name AS user_name, b.name AS branch_name FROM expenses e
                        LEFT JOIN users u ON u.id = e.user_id LEFT JOIN branches b ON b.id = e.branch_id
                        WHERE e.created_at BETWEEN ? AND ? ${branch ? 'AND e.branch_id = ?' : ''}
                        ORDER BY e.id DESC LIMIT 100`, fromTs, toTs, ...bp);
  return { from, to, summary, byType, byDay, rows, expenses, shift: openShift(branch), branch };
});
add('POST', '/api/expenses', 'treasury.manage', (ctx) => {
  const amount = round2(num(ctx.body.amount));
  if (amount <= 0) fail('أدخل مبلغ المصروف');
  const category = str(ctx.body.category, 60) || 'مصروفات عامة';
  const method = ['cash', 'card', 'wallet'].includes(ctx.body.method) ? ctx.body.method : 'cash';
  const branchId = branchFromBody(ctx.body, ctx.user);
  const shift = currentUserShift(ctx.user.id, branchId);
  const result = tx(() => {
    const r = run('INSERT INTO expenses (branch_id, category, description, amount, method, user_id, shift_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      branchId, category, str(ctx.body.description, 300), amount, method, ctx.user.id, shift ? shift.id : null, now());
    const id = Number(r.lastInsertRowid);
    run(`INSERT INTO payments (branch_id, type, direction, amount, method, ref_type, ref_id, note, user_id, shift_id, created_at)
         VALUES (?, 'expense', 'out', ?, ?, 'expense', ?, ?, ?, ?, ?)`,
      branchId, amount, method, id, str(ctx.body.description, 200) || category, ctx.user.id, shift ? shift.id : null, now());
    logActivity(ctx.user.id, 'expense.create', `مصروف ${category}: ${amount}`, ctx.ip);
    return id;
  });
  return { id: result, message: 'تم تسجيل المصروف' };
});
add('DELETE', '/api/expenses/:id', 'treasury.manage', (ctx) => {
  const id = int(ctx.params.id);
  const expense = get('SELECT * FROM expenses WHERE id = ?', id);
  if (!expense) fail('المصروف غير موجود', 404);
  tx(() => {
    run("DELETE FROM payments WHERE ref_type = 'expense' AND ref_id = ?", id);
    run('DELETE FROM expenses WHERE id = ?', id);
    logActivity(ctx.user.id, 'expense.delete', `حذف مصروف ${expense.category}: ${expense.amount}`, ctx.ip);
  });
  return { message: 'تم حذف المصروف' };
});

/* ---------- الورديات ---------- */
add('GET', '/api/shifts', 'treasury.view', (ctx) => {
  const branch = branchFromQuery(ctx.url);
  return {
    rows: all(`SELECT sh.*, u.name AS user_name, b.name AS branch_name FROM shifts sh
               JOIN users u ON u.id = sh.user_id LEFT JOIN branches b ON b.id = sh.branch_id
               ${branch ? 'WHERE sh.branch_id = ?' : ''} ORDER BY sh.id DESC LIMIT 60`, ...branchParams(branch)),
    current: openShift(branch),
  };
});
add('GET', '/api/shifts/current', null, (ctx) => {
  const branch = branchFromQuery(ctx.url) || ctx.user.branch_id || store.branchDefaultId();
  const shift = currentUserShift(ctx.user.id, branch);
  if (!shift) return { shift: null };
  const totals = get(`SELECT
      COALESCE(SUM(CASE WHEN direction='in' AND method='cash' THEN amount ELSE 0 END),0) AS cash_in,
      COALESCE(SUM(CASE WHEN direction='out' AND method='cash' THEN amount ELSE 0 END),0) AS cash_out,
      COALESCE(SUM(CASE WHEN direction='in' AND method='card' THEN amount ELSE 0 END),0) AS card_in,
      COALESCE(SUM(CASE WHEN direction='in' AND method='wallet' THEN amount ELSE 0 END),0) AS wallet_in
      FROM payments WHERE shift_id = ?`, shift.id);
  return { shift, totals, expected_cash: round2(totals.cash_in - totals.cash_out), mine: shift.user_id === ctx.user.id };
});
add('POST', '/api/shifts/open', null, (ctx) => {
  const branchId = branchFromBody(ctx.body, ctx.user);
  const branch = requireBranch(branchId);
  const existing = openShift(branchId);
  if (existing) fail(`توجد وردية مفتوحة بالفعل في ${branch.name}. أغلقها أولًا.`);
  const opening = Math.max(0, round2(num(ctx.body.opening_cash)));
  const id = tx(() => {
    const r = run('INSERT INTO shifts (user_id, branch_id, opened_at, opening_cash, status) VALUES (?, ?, ?, ?, \'open\')',
      ctx.user.id, branchId, now(), opening);
    const shiftId = Number(r.lastInsertRowid);
    if (opening > 0) {
      run(`INSERT INTO payments (branch_id, type, direction, amount, method, note, user_id, shift_id, created_at)
           VALUES (?, 'shift_open', 'in', ?, 'cash', 'نقدية بداية الوردية', ?, ?, ?)`,
        branchId, opening, ctx.user.id, shiftId, now());
    }
    logActivity(ctx.user.id, 'shift.open', `فتح وردية في ${branch.name} برصيد ${opening}`, ctx.ip);
    return shiftId;
  });
  return { id, shift: openShift(branchId), message: 'تم فتح الوردية' };
});
add('POST', '/api/shifts/:id/close', null, (ctx) => {
  const id = int(ctx.params.id);
  const shift = get('SELECT * FROM shifts WHERE id = ?', id);
  if (!shift) fail('الوردية غير موجودة', 404);
  if (shift.user_id !== ctx.user.id && !can(ctx.user, 'treasury.manage')) fail('لا تملك صلاحية إغلاق وردية مستخدم آخر', 403);
  if (shift.status === 'closed') fail('الوردية مغلقة بالفعل');
  const totals = get(`SELECT
      COALESCE(SUM(CASE WHEN direction='in' AND method='cash' THEN amount ELSE 0 END),0) AS cash_in,
      COALESCE(SUM(CASE WHEN direction='out' AND method='cash' THEN amount ELSE 0 END),0) AS cash_out
      FROM payments WHERE shift_id = ?`, id);
  const sales = get(`SELECT
      COALESCE(SUM(total),0) AS total,
      COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0) AS cash,
      COALESCE(SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END),0) AS card,
      COALESCE(SUM(CASE WHEN payment_method='wallet' THEN total ELSE 0 END),0) AS wallet
      FROM sales WHERE shift_id = ? AND status = 'completed'`, id);
  const expenses = get('SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE shift_id = ?', id);
  const expected = round2(totals.cash_in - totals.cash_out);
  const closing = Math.max(0, round2(num(ctx.body.closing_cash, expected)));
  tx(() => {
    run(`UPDATE shifts SET status='closed', closed_at=?, closing_cash=?, expected_cash=?, cash_sales=?, card_sales=?,
         wallet_sales=?, sales_total=?, expenses=?, notes=? WHERE id=?`,
      now(), closing, expected, round2(sales.cash), round2(sales.card), round2(sales.wallet), round2(sales.total),
      round2(expenses.total), str(ctx.body.notes, 300), id);
    logActivity(ctx.user.id, 'shift.close', `إغلاق وردية #${id} — فرق ${round2(closing - expected)}`, ctx.ip);
  });
  return {
    message: 'تم إغلاق الوردية',
    summary: { expected_cash: expected, closing_cash: closing, difference: round2(closing - expected), sales: sales.total, expenses: expenses.total },
  };
});

/* ---------- التقارير ---------- */
add('GET', '/api/reports', 'reports.view', (ctx) => {
  const { from, to, fromTs, toTs } = rangeFromQuery(ctx.url);
  const branch = branchFromQuery(ctx.url);
  const bSql = branchSql(branch);
  const sbSql = branchSql(branch, 's.');
  const bp = branchParams(branch);
  const sales = get(`SELECT COUNT(*) AS invoices, COALESCE(SUM(total),0) AS total, COALESCE(SUM(subtotal),0) AS subtotal,
      COALESCE(SUM(discount),0) AS discount, COALESCE(SUM(tax),0) AS tax, COALESCE(SUM(profit),0) AS profit,
      COALESCE(SUM(returned_total),0) AS returned, COALESCE(SUM(paid),0) AS paid
      FROM sales WHERE status IN ('completed','returned') AND created_at BETWEEN ? AND ? ${bSql}`, fromTs, toTs, ...bp);
  const items = get(`SELECT COALESCE(SUM(si.qty),0) AS qty FROM sale_items si JOIN sales s ON s.id = si.sale_id
                     WHERE s.status IN ('completed','returned') AND s.created_at BETWEEN ? AND ? ${sbSql}`, fromTs, toTs, ...bp);
  const purchases = get(`SELECT COUNT(*) AS invoices, COALESCE(SUM(total),0) AS total FROM purchases
                         WHERE created_at BETWEEN ? AND ? ${bSql}`, fromTs, toTs, ...bp);
  const expenses = get(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses
                        WHERE created_at BETWEEN ? AND ? ${bSql}`, fromTs, toTs, ...bp);
  const payments = get(`SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE 0 END),0) AS total_in,
      COALESCE(SUM(CASE WHEN direction='out' THEN amount ELSE 0 END),0) AS total_out FROM payments
      WHERE created_at BETWEEN ? AND ? ${bSql}`, fromTs, toTs, ...bp);
  const seriesParams = [from, to, ...(branch ? [branch, branch, branch, branch] : [])];
  const series = all(`WITH RECURSIVE dates(d) AS (
        SELECT date(?) UNION ALL SELECT date(d, '+1 day') FROM dates WHERE d < date(?)
      ) SELECT d AS date,
        COALESCE((SELECT SUM(total) FROM sales WHERE status='completed' AND substr(created_at,1,10)=d ${bSql}),0) AS sales,
        COALESCE((SELECT SUM(profit) FROM sales WHERE status='completed' AND substr(created_at,1,10)=d ${bSql}),0) AS profit,
        COALESCE((SELECT COUNT(*) FROM sales WHERE status='completed' AND substr(created_at,1,10)=d ${bSql}),0) AS invoices,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE substr(created_at,1,10)=d ${bSql}),0) AS expenses
      FROM dates`, ...seriesParams);
  const topProducts = all(`SELECT si.product_id, si.name, si.unit, SUM(si.qty) AS qty, SUM(si.total) AS revenue,
      SUM(si.qty * si.unit_cost) AS cost, SUM(si.total - si.qty * si.unit_cost) AS profit
      FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.status IN ('completed','returned') AND s.created_at BETWEEN ? AND ? ${sbSql}
      GROUP BY si.product_id ORDER BY revenue DESC LIMIT 12`, fromTs, toTs, ...bp);
  const byCategory = all(`SELECT COALESCE(c.name,'غير مصنف') AS name, COALESCE(c.color,'#64748b') AS color,
      SUM(si.total) AS revenue, SUM(si.qty) AS qty
      FROM sale_items si JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.status IN ('completed','returned') AND s.created_at BETWEEN ? AND ? ${sbSql}
      GROUP BY c.id ORDER BY revenue DESC`, fromTs, toTs, ...bp);
  const paymentMix = all(`SELECT payment_method AS method, COUNT(*) AS count, COALESCE(SUM(total),0) AS total
      FROM sales WHERE status='completed' AND created_at BETWEEN ? AND ? ${bSql} GROUP BY payment_method`, fromTs, toTs, ...bp);
  const topCustomers = all(`SELECT c.id, c.name, COUNT(s.id) AS invoices, COALESCE(SUM(s.total),0) AS total
      FROM sales s JOIN customers c ON c.id = s.customer_id
      WHERE s.status='completed' AND s.created_at BETWEEN ? AND ? ${sbSql} GROUP BY c.id ORDER BY total DESC LIMIT 8`, fromTs, toTs, ...bp);
  const stockExpr = branch ? 'COALESCE(ps.stock,0)' : 'p.stock';
  const stockJoin = branch ? 'LEFT JOIN product_stock ps ON ps.product_id = p.id AND ps.branch_id = ?' : '';
  const inv = get(`SELECT COALESCE(SUM(${stockExpr}*p.cost),0) AS value_cost, COALESCE(SUM(${stockExpr}*p.price),0) AS value_sale,
      COALESCE(SUM(${stockExpr}),0) AS units, COUNT(*) AS products,
      COALESCE(SUM(CASE WHEN ${stockExpr} > 0 AND ${stockExpr} <= p.min_stock THEN 1 ELSE 0 END),0) AS low_stock,
      COALESCE(SUM(CASE WHEN ${stockExpr} <= 0 THEN 1 ELSE 0 END),0) AS out_stock
      FROM products p ${stockJoin} WHERE p.active=1`, ...bp);
  const inventory = {
    value_cost: round2(num(inv.value_cost)), value_sale: round2(num(inv.value_sale)),
    units: round2(num(inv.units)), products: inv.products,
    low_stock: inv.low_stock, out_stock: inv.out_stock,
  };
  const debts = {
    customers: round2(num(get('SELECT SUM(balance) AS s FROM customers WHERE active=1').s)),
    suppliers: round2(num(get('SELECT SUM(balance) AS s FROM suppliers WHERE active=1').s)),
  };
  const lowStock = all(`SELECT p.id, p.name, p.unit, ${stockExpr} AS stock, p.min_stock FROM products p ${stockJoin}
                        WHERE p.active=1 AND ${stockExpr} <= p.min_stock ORDER BY ${stockExpr} ASC LIMIT 50`, ...bp);
  return { from, to, branch, sales, items, purchases, expenses, payments, series, topProducts, byCategory, paymentMix, topCustomers, inventory, debts, lowStock };
});

/* ---------- الفروع ---------- */
function branchRows(withStats = true) {
  const rows = all('SELECT * FROM branches ORDER BY is_default DESC, id');
  if (!withStats) return rows;
  const today = todayStr();
  const monthStart = today.slice(0, 8) + '01';
  for (const b of rows) {
    b.stats = {
      sales_today: round2(num(get(`SELECT COALESCE(SUM(total),0) AS s FROM sales
        WHERE branch_id = ? AND status IN ('completed','returned') AND substr(created_at,1,10) = ?`, b.id, today).s)),
      sales_month: round2(num(get(`SELECT COALESCE(SUM(total),0) AS s FROM sales
        WHERE branch_id = ? AND status IN ('completed','returned') AND substr(created_at,1,10) >= ?`, b.id, monthStart).s)),
      stock_value: round2(num(get(`SELECT COALESCE(SUM(ps.stock * p.cost),0) AS s FROM product_stock ps
        JOIN products p ON p.id = ps.product_id WHERE ps.branch_id = ? AND p.active = 1`, b.id).s)),
      products: get(`SELECT COUNT(*) AS c FROM product_stock ps JOIN products p ON p.id = ps.product_id
                     WHERE ps.branch_id = ? AND p.active = 1 AND ps.stock > 0`, b.id).c,
      users: get('SELECT COUNT(*) AS c FROM users WHERE branch_id = ? AND active = 1', b.id).c,
      open_shift: get("SELECT COUNT(*) AS c FROM shifts WHERE branch_id = ? AND status = 'open'", b.id).c,
    };
  }
  return rows;
}

add('GET', '/api/branches', null, (ctx) => ({
  rows: branchRows(ctx.user.role === 'admin' || can(ctx.user, 'branches.manage')),
}));

add('POST', '/api/branches', 'branches.manage', (ctx) => {
  const name = str(ctx.body.name, 80);
  if (!name) fail('اسم الفرع مطلوب');
  const code = (str(ctx.body.code, 20) || name).toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'BR' + Date.now();
  if (get('SELECT id FROM branches WHERE code = ?', code)) fail('كود الفرع مستخدم بالفعل');
  const r = run(`INSERT INTO branches (name, code, phone, address, active, is_default, created_at)
                 VALUES (?, ?, ?, ?, 1, 0, ?)`,
    name, code, str(ctx.body.phone, 30), str(ctx.body.address, 200), now());
  logActivity(ctx.user.id, 'branch.create', `إضافة فرع ${name}`, ctx.ip);
  return { id: Number(r.lastInsertRowid), rows: branchRows(), message: 'تمت إضافة الفرع' };
});

add('PUT', '/api/branches/:id', 'branches.manage', (ctx) => {
  const id = int(ctx.params.id);
  const old = get('SELECT * FROM branches WHERE id = ?', id);
  if (!old) fail('الفرع غير موجود', 404);
  const name = str(ctx.body.name, 80) || old.name;
  let code = str(ctx.body.code, 20).toUpperCase().replace(/[^A-Z0-9_-]/g, '') || old.code;
  if (get('SELECT id FROM branches WHERE code = ? AND id <> ?', code, id)) fail('كود الفرع مستخدم بالفعل');
  const active = ctx.body.active === undefined ? old.active : (ctx.body.active ? 1 : 0);
  if (!active && old.is_default) fail('لا يمكن تعطيل الفرع الرئيسي');
  run(`UPDATE branches SET name=?, code=?, phone=?, address=?, active=? WHERE id=?`,
    name, code, str(ctx.body.phone, 30), str(ctx.body.address, 200), active, id);
  logActivity(ctx.user.id, 'branch.update', `تعديل فرع ${name}`, ctx.ip);
  return { rows: branchRows(), message: 'تم تحديث الفرع' };
});

add('POST', '/api/branches/:id/default', 'branches.manage', (ctx) => {
  const id = int(ctx.params.id);
  const b = get('SELECT * FROM branches WHERE id = ?', id);
  if (!b) fail('الفرع غير موجود', 404);
  if (!b.active) fail('لا يمكن تعيين فرع معطّل كرئيسي');
  tx(() => {
    run('UPDATE branches SET is_default = 0');
    run('UPDATE branches SET is_default = 1 WHERE id = ?', id);
  });
  logActivity(ctx.user.id, 'branch.default', `تعيين ${b.name} كفرع رئيسي`, ctx.ip);
  return { rows: branchRows(), message: 'تم تعيين الفرع الرئيسي' };
});

add('DELETE', '/api/branches/:id', 'branches.manage', (ctx) => {
  const id = int(ctx.params.id);
  const b = get('SELECT * FROM branches WHERE id = ?', id);
  if (!b) fail('الفرع غير موجود', 404);
  if (b.is_default) fail('لا يمكن حذف الفرع الرئيسي');
  const sales = get('SELECT COUNT(*) AS c FROM sales WHERE branch_id = ?', id).c;
  const purchases = get('SELECT COUNT(*) AS c FROM purchases WHERE branch_id = ?', id).c;
  if (sales || purchases) {
    run('UPDATE branches SET active = 0 WHERE id = ?', id);
    logActivity(ctx.user.id, 'branch.disable', `تعطيل فرع ${b.name} (له حركات)`, ctx.ip);
    return { rows: branchRows(), message: 'تم تعطيل الفرع (له حركات مسجلة)' };
  }
  run('DELETE FROM product_stock WHERE branch_id = ?', id);
  run('DELETE FROM branches WHERE id = ?', id);
  logActivity(ctx.user.id, 'branch.delete', `حذف فرع ${b.name}`, ctx.ip);
  return { rows: branchRows(), message: 'تم حذف الفرع' };
});

/* ---------- المستخدمون والصلاحيات ---------- */
const PERMISSIONS = [
  { key: 'dashboard.view', label: 'عرض لوحة التحكم', group: 'عام' },
  { key: 'pos.use', label: 'استخدام الكاشير وإتمام البيع', group: 'المبيعات' },
  { key: 'sales.view', label: 'عرض الفواتير والمبيعات', group: 'المبيعات' },
  { key: 'sales.return', label: 'إرجاع الفواتير', group: 'المبيعات' },
  { key: 'products.view', label: 'عرض المنتجات', group: 'المنتجات' },
  { key: 'products.manage', label: 'إدارة المنتجات والتصنيفات', group: 'المنتجات' },
  { key: 'inventory.view', label: 'عرض المخزون وحركاته', group: 'المخزون' },
  { key: 'inventory.manage', label: 'تسويات المخزون', group: 'المخزون' },
  { key: 'purchases.view', label: 'عرض المشتريات', group: 'المشتريات' },
  { key: 'purchases.manage', label: 'إضافة فواتير شراء', group: 'المشتريات' },
  { key: 'contacts.view', label: 'عرض العملاء والموردين', group: 'العملاء والموردون' },
  { key: 'contacts.manage', label: 'إدارة العملاء والموردين', group: 'العملاء والموردون' },
  { key: 'treasury.view', label: 'عرض الخزينة والورديات', group: 'الخزينة' },
  { key: 'treasury.manage', label: 'المصروفات والتحصيل والورديات', group: 'الخزينة' },
  { key: 'reports.view', label: 'عرض التقارير', group: 'التقارير' },
  { key: 'branches.manage', label: 'إدارة الفروع', group: 'النظام' },
  { key: 'users.manage', label: 'إدارة المستخدمين', group: 'النظام' },
  { key: 'settings.manage', label: 'إدارة الإعدادات', group: 'النظام' },
  { key: 'backup.manage', label: 'النسخ الاحتياطي والاستعادة', group: 'النظام' },
  { key: 'shifts.manage', label: 'إغلاق ورديات الآخرين', group: 'الخزينة' },
];

add('GET', '/api/permissions', 'users.manage', () => ({
  permissions: PERMISSIONS,
  roles: [
    { key: 'admin', label: 'مدير النظام', perms: ['*'] },
    { key: 'manager', label: 'مدير فرع', perms: store.seedRolePermissions().manager },
    { key: 'cashier', label: 'كاشير', perms: store.seedRolePermissions().cashier },
    { key: 'accountant', label: 'محاسب', perms: store.seedRolePermissions().accountant },
    { key: 'stock', label: 'مسؤول مخازن', perms: store.seedRolePermissions().stock },
  ],
}));

add('GET', '/api/users', 'users.manage', () => ({
  rows: all(`SELECT u.id, u.name, u.username, u.role, u.permissions, u.phone, u.branch_id, u.active,
                    u.created_at, u.last_login, b.name AS branch_name
             FROM users u LEFT JOIN branches b ON b.id = u.branch_id ORDER BY u.id`),
}));
add('POST', '/api/users', 'users.manage', (ctx) => {
  const name = str(ctx.body.name, 80);
  const username = str(ctx.body.username, 40).toLowerCase();
  const password = String(ctx.body.password || '');
  if (!name || !username) fail('الاسم واسم المستخدم مطلوبان');
  if (!/^[a-zA-Z0-9_.@-]{3,40}$/.test(username)) fail('اسم المستخدم يجب أن يكون 3 أحرف على الأقل (إنجليزي/أرقام)');
  if (password.length < 6) fail('كلمة المرور 6 أحرف على الأقل');
  if (get('SELECT id FROM users WHERE lower(username) = ?', username)) fail('اسم المستخدم مستخدم بالفعل');
  const role = ['admin', 'manager', 'cashier', 'accountant', 'stock'].includes(ctx.body.role) ? ctx.body.role : 'cashier';
  const perms = Array.isArray(ctx.body.permissions) ? ctx.body.permissions : (store.seedRolePermissions()[role] || []);
  const branchId = int(ctx.body.branch_id) ? int(ctx.body.branch_id) : null;
  if (branchId && !get('SELECT id FROM branches WHERE id = ? AND active = 1', branchId)) fail('الفرع المحدد غير موجود');
  const r = run('INSERT INTO users (name, username, password_hash, role, permissions, phone, branch_id, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)',
    name, username, store.hashPassword(password), role, JSON.stringify(perms), str(ctx.body.phone, 30), branchId, now());
  logActivity(ctx.user.id, 'user.create', `إضافة مستخدم ${name}`, ctx.ip);
  logAudit(ctx, 'create', 'users', Number(r.lastInsertRowid), { name, username, role });
  return { id: Number(r.lastInsertRowid), message: 'تم إنشاء المستخدم' };
});
add('PUT', '/api/users/:id', 'users.manage', (ctx) => {
  const id = int(ctx.params.id);
  const old = get('SELECT * FROM users WHERE id = ?', id);
  if (!old) fail('المستخدم غير موجود', 404);
  const role = ['admin', 'manager', 'cashier', 'accountant', 'stock'].includes(ctx.body.role) ? ctx.body.role : old.role;
  const active = ctx.body.active === undefined ? old.active : (ctx.body.active ? 1 : 0);
  if (id === ctx.user.id && !active) fail('لا يمكنك تعطيل حسابك الحالي');
  if (old.role === 'admin' && role !== 'admin') {
    const admins = get("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1").c;
    if (admins <= 1) fail('يجب أن يبقى مدير نظام واحد على الأقل');
  }
  const perms = Array.isArray(ctx.body.permissions) ? ctx.body.permissions : undefined;
  const branchId = ctx.body.branch_id === undefined ? old.branch_id : (int(ctx.body.branch_id) || null);
  if (branchId && !get('SELECT id FROM branches WHERE id = ? AND active = 1', branchId)) fail('الفرع المحدد غير موجود');
  run('UPDATE users SET name=?, role=?, phone=?, branch_id=?, active=? WHERE id=?',
    str(ctx.body.name, 80) || old.name, role, str(ctx.body.phone, 30), branchId, active, id);
  if (perms) run('UPDATE users SET permissions=? WHERE id=?', JSON.stringify(perms), id);
  if (!active) run('DELETE FROM sessions WHERE user_id = ?', id);
  logActivity(ctx.user.id, 'user.update', `تعديل مستخدم ${old.name}`, ctx.ip);
  logAudit(ctx, 'update', 'users', id, { name: old.name, role, active });
  return { message: 'تم تحديث المستخدم' };
});
add('POST', '/api/users/:id/password', 'users.manage', (ctx) => {
  const id = int(ctx.params.id);
  const password = String(ctx.body.password || '');
  if (password.length < 6) fail('كلمة المرور 6 أحرف على الأقل');
  if (!get('SELECT id FROM users WHERE id = ?', id)) fail('المستخدم غير موجود', 404);
  run('UPDATE users SET password_hash = ? WHERE id = ?', store.hashPassword(password), id);
  run('DELETE FROM sessions WHERE user_id = ?', id);
  logActivity(ctx.user.id, 'user.password', `تغيير كلمة مرور المستخدم #${id}`, ctx.ip);
  return { message: 'تم تغيير كلمة المرور' };
});
add('DELETE', '/api/users/:id', 'users.manage', (ctx) => {
  const id = int(ctx.params.id);
  if (id === ctx.user.id) fail('لا يمكنك حذف حسابك الحالي');
  const old = get('SELECT * FROM users WHERE id = ?', id);
  if (!old) fail('المستخدم غير موجود', 404);
  const admins = get("SELECT COUNT(*) AS c FROM users WHERE role='admin' AND active=1").c;
  if (old.role === 'admin' && admins <= 1) fail('لا يمكن حذف آخر مدير نظام');
  if (get('SELECT COUNT(*) AS c FROM sales WHERE user_id = ?', id).c > 0) {
    run('UPDATE users SET active = 0 WHERE id = ?', id);
    run('DELETE FROM sessions WHERE user_id = ?', id);
    logAudit(ctx, 'delete', 'users', id, { name: old.name, soft: true });
    return { message: 'تم تعطيل المستخدم (له سجلات مرتبطة)' };
  }
  run('DELETE FROM users WHERE id = ?', id);
  logAudit(ctx, 'delete', 'users', id, { name: old.name, soft: false });
  return { message: 'تم حذف المستخدم' };
});

/* ---------- الإعدادات ---------- */
add('GET', '/api/settings', 'settings.manage', () => ({
  settings: store.settingsObject(), version: APP_VERSION,
  system: { node: process.version, platform: process.platform, db_path: store.dbPath, uptime: Math.round(process.uptime()) },
}));
add('PUT', '/api/settings', 'settings.manage', (ctx) => {
  const allowed = Object.keys(store.DEFAULT_SETTINGS);
  const body = ctx.body || {};
  for (const [k, v] of Object.entries(body)) {
    if (!allowed.includes(k)) continue;
    store.setSetting(k, String(v ?? ''));
  }
  logActivity(ctx.user.id, 'settings.update', 'تحديث إعدادات النظام', ctx.ip);
  return { settings: store.settingsObject(), message: 'تم حفظ الإعدادات' };
});
add('GET', '/api/activity', 'settings.manage', (ctx) => ({
  rows: all(`SELECT a.*, u.name AS user_name FROM activity a LEFT JOIN users u ON u.id = a.user_id
             ORDER BY a.id DESC LIMIT 120`),
}));

/* ---------- أدوات البيانات: تفريغ الجداول + سجل التدقيق + سلة المهملات ---------- */
add('GET', '/api/data-tools', 'settings.manage', () => ({ tables: dataTables() }));

add('POST', '/api/data-tools/truncate', 'settings.manage', (ctx) => {
  const requested = Array.isArray(ctx.body.tables) ? ctx.body.tables.map(String) : [];
  const known = new Set(dataTables().map((t) => t.name));
  const selected = requested.filter((t) => known.has(t) && !PROTECTED_TABLES.has(t));
  if (!selected.length) fail('اختر جدولًا واحدًا على الأقل (الجداول المحمية لا يمكن تفريغها)');
  // تضمين الجداول التابعة تلقائيًا للحفاظ على سلامة العلاقات
  const children = fkChildren();
  const allSelected = new Set(selected);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of [...allSelected]) {
      for (const c of children.get(t) || []) {
        if (!allSelected.has(c) && !PROTECTED_TABLES.has(c)) { allSelected.add(c); grew = true; }
      }
    }
  }
  const list = [...allSelected];
  // ترتيب الحذف: الأبناء قبل الآباء
  const ordered = [];
  const seen = new Set();
  const visit = (t) => {
    if (seen.has(t)) return;
    seen.add(t);
    for (const c of children.get(t) || []) if (allSelected.has(c)) visit(c);
    ordered.push(t);
  };
  list.forEach(visit);
  const cleared = [];
  tx(() => {
    for (const t of ordered) {
      try { run(`DELETE FROM "${t}"`); cleared.push(t); } catch {}
    }
  });
  logAudit(ctx, 'truncate', null, null, { requested, cleared });
  logActivity(ctx.user.id, 'data.truncate', `تفريغ جداول: ${cleared.join(', ')}`, ctx.ip);
  return { message: 'تم تفريغ الجداول المحددة', cleared, tables: dataTables() };
});

add('GET', '/api/audit', 'settings.manage', (ctx) => {
  const limit = Math.min(Math.max(int(ctx.url.searchParams.get('limit'), 200), 1), 1000);
  const action = str(ctx.url.searchParams.get('action'), 30);
  const entity = str(ctx.url.searchParams.get('entity'), 40);
  const q = str(ctx.url.searchParams.get('q'), 80);
  const where = [];
  const params = [];
  if (action) { where.push('action = ?'); params.push(action); }
  if (entity) { where.push('entity = ?'); params.push(entity); }
  if (q) { where.push('(user_name LIKE ? OR details LIKE ? OR entity LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = all(`SELECT * FROM audit_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`, ...params, limit);
  return { rows };
});

const TRASH_ENTITIES = {
  products: { table: 'products', label: 'منتج', nameCol: 'name' },
  categories: { table: 'categories', label: 'تصنيف', nameCol: 'name' },
  customers: { table: 'customers', label: 'عميل', nameCol: 'name' },
  suppliers: { table: 'suppliers', label: 'مورد', nameCol: 'name' },
  users: { table: 'users', label: 'مستخدم', nameCol: 'name' },
};

add('GET', '/api/trash', 'settings.manage', () => {
  const groups = [];
  for (const [key, cfg] of Object.entries(TRASH_ENTITIES)) {
    let rows = [];
    try {
      rows = all(`SELECT id, ${cfg.nameCol} AS name, active, created_at FROM "${cfg.table}" WHERE active = 0 ORDER BY id DESC LIMIT 300`);
    } catch {}
    groups.push({ entity: key, label: cfg.label, rows });
  }
  return { groups, total: groups.reduce((n, g) => n + g.rows.length, 0) };
});

add('POST', '/api/trash/:entity/:id/restore', 'settings.manage', (ctx) => {
  const cfg = TRASH_ENTITIES[ctx.params.entity];
  if (!cfg) fail('نوع غير معروف', 404);
  const id = int(ctx.params.id);
  const row = get(`SELECT * FROM "${cfg.table}" WHERE id = ?`, id);
  if (!row) fail('العنصر غير موجود', 404);
  run(`UPDATE "${cfg.table}" SET active = 1 WHERE id = ?`, id);
  logAudit(ctx, 'restore', cfg.table, id, { name: row[cfg.nameCol] });
  logActivity(ctx.user.id, 'data.restore', `استعادة ${cfg.label}: ${row[cfg.nameCol]}`, ctx.ip);
  return { message: `تمت استعادة ${cfg.label}` };
});

add('DELETE', '/api/trash/:entity/:id', 'settings.manage', (ctx) => {
  const cfg = TRASH_ENTITIES[ctx.params.entity];
  if (!cfg) fail('نوع غير معروف', 404);
  const id = int(ctx.params.id);
  const row = get(`SELECT * FROM "${cfg.table}" WHERE id = ?`, id);
  if (!row) fail('العنصر غير موجود', 404);
  try { run(`DELETE FROM "${cfg.table}" WHERE id = ?`, id); }
  catch { fail('لا يمكن الحذف النهائي لوجود بيانات مرتبطة', 409); }
  logAudit(ctx, 'purge', cfg.table, id, { name: row[cfg.nameCol] });
  logActivity(ctx.user.id, 'data.purge', `حذف نهائي ${cfg.label}: ${row[cfg.nameCol]}`, ctx.ip);
  return { message: 'تم الحذف النهائي' };
});

/* ---------- النسخ الاحتياطي ---------- */
function backupRoots() {
  const s = store.settingsObject();
  const roots = [store.BACKUP_DIR];
  if (s.backup_folder) roots.push(path.resolve(s.backup_folder));
  return [...new Set(roots)];
}
function resolveBackupFile(name, folder) {
  const base = folder ? path.resolve(folder) : store.BACKUP_DIR;
  const allowed = backupRoots().map((p) => path.resolve(p));
  if (!allowed.includes(base)) fail('هذا المجلد غير مسموح به', 403);
  const full = path.resolve(base, store.safeName(name));
  if (!full.startsWith(base + path.sep)) fail('مسار غير صالح', 400);
  if (!fs.existsSync(full)) fail('ملف النسخة غير موجود', 404);
  return full;
}

add('GET', '/api/backup', 'backup.manage', () => {
  const settings = store.settingsObject();
  const folder = settings.backup_folder || '';
  return {
    backups: store.listBackups(folder),
    default_dir: store.BACKUP_DIR,
    folder,
    exists: folder ? fs.existsSync(folder) : false,
    auto_backup: settings.auto_backup === '1',
    keep: int(settings.backup_keep, 30),
    db_size: fs.existsSync(store.dbPath) ? fs.statSync(store.dbPath).size : 0,
  };
});
add('POST', '/api/backup', 'backup.manage', (ctx) => {
  const settings = store.settingsObject();
  const folder = str(ctx.body.folder, 400) || settings.backup_folder || store.BACKUP_DIR;
  const dir = path.resolve(folder);
  try { fs.mkdirSync(dir, { recursive: true }); }
  catch { fail('تعذر إنشاء المجلد — تأكد من المسار وصلاحيات الكتابة', 400); }
  let probe;
  try {
    probe = path.join(dir, '.baraka-write-test');
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe);
  } catch { fail('المجلد غير قابل للكتابة — اختر مجلدًا آخر أو تحقق من الصلاحيات', 400); }
  const backup = store.backupTo(dir, 'manual');
  pruneBackups(dir, int(settings.backup_keep, 30));
  store.setSetting('backup_folder', dir);
  logActivity(ctx.user.id, 'backup.create', `نسخة احتياطية: ${backup.name} في ${dir}`, ctx.ip);
  return { backup, backups: store.listBackups(dir), folder: dir, message: 'تم إنشاء النسخة الاحتياطية' };
});
add('POST', '/api/backup/folder', 'backup.manage', (ctx) => {
  const folder = str(ctx.body.folder, 400);
  if (!folder) fail('أدخل مسار المجلد');
  const dir = path.resolve(folder);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.baraka-write-test');
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe);
  } catch { fail('تعذر استخدام المجلد — تحقق من المسار وصلاحيات الكتابة', 400); }
  store.setSetting('backup_folder', dir);
  logActivity(ctx.user.id, 'backup.folder', `تحديد مجلد النسخ: ${dir}`, ctx.ip);
  return { folder: dir, backups: store.listBackups(dir), message: 'تم حفظ مجلد النسخ الاحتياطي' };
});
add('GET', '/api/backup/download/:name', 'backup.manage', (ctx) => {
  const file = resolveBackupFile(ctx.params.name, ctx.url.searchParams.get('folder'));
  const stat = fs.statSync(file);
  ctx.res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename="${path.basename(file)}"`,
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(file).pipe(ctx.res);
  return null;
});
add('POST', '/api/backup/upload', 'backup.manage', async (ctx) => {
  const name = store.safeName(ctx.req.headers['x-filename'] || `upload-${Date.now()}.db`);
  if (!/\.(db|sqlite|sqlite3|backup)$/i.test(name)) fail('صيغة الملف غير مدعومة (db / sqlite / backup)');
  const buf = await readBody(ctx.req, 200 * 1024 * 1024);
  if (!buf.length) fail('الملف فارغ');
  const target = path.join(store.BACKUP_DIR, name);
  fs.writeFileSync(target, buf);
  try { store.validateDbFile(target); }
  catch (e) { fs.rmSync(target, { force: true }); fail('الملف ليس نسخة قاعدة بيانات صالحة'); }
  const restore = ctx.url.searchParams.get('restore') === '1';
  let restored = null;
  if (restore) restored = store.restoreFrom(target);
  logActivity(ctx.user.id, 'backup.upload', `رفع نسخة احتياطية: ${name}${restore ? ' واستعادتها' : ''}`, ctx.ip);
  return {
    name, message: restore ? 'تم رفع النسخة واستعادتها بنجاح' : 'تم رفع النسخة الاحتياطية',
    restored, backups: store.listBackups(store.settingsObject().backup_folder || ''),
    reauth: restore ? true : false,
  };
}, true);
add('POST', '/api/backup/restore', 'backup.manage', (ctx) => {
  const name = str(ctx.body.name, 200);
  if (!name) fail('اختر نسخة احتياطية');
  const folder = ctx.body.folder ? path.resolve(str(ctx.body.folder, 400)) : null;
  const file = folder ? resolveBackupFile(name, folder) : resolveBackupFile(name);
  const info = store.restoreFrom(file);
  logActivity(ctx.user.id, 'backup.restore', `استعادة نسخة: ${name}`, ctx.ip);
  return { ...info, message: 'تمت استعادة النسخة الاحتياطية بنجاح. يرجى تسجيل الدخول مجددًا.', reauth: true };
});
add('DELETE', '/api/backup/:name', 'backup.manage', (ctx) => {
  const folder = ctx.url.searchParams.get('folder');
  const file = resolveBackupFile(ctx.params.name, folder);
  fs.rmSync(file, { force: true });
  logActivity(ctx.user.id, 'backup.delete', `حذف نسخة: ${ctx.params.name}`, ctx.ip);
  return { message: 'تم حذف النسخة الاحتياطية', backups: store.listBackups(store.settingsObject().backup_folder || '') };
});
add('PUT', '/api/backup/settings', 'backup.manage', (ctx) => {
  if (ctx.body.auto_backup !== undefined) store.setSetting('auto_backup', ctx.body.auto_backup ? '1' : '0');
  if (ctx.body.keep !== undefined) store.setSetting('backup_keep', String(Math.max(3, int(ctx.body.keep, 30))));
  return { message: 'تم حفظ إعدادات النسخ', settings: store.settingsObject() };
});

function pruneBackups(dir, keep) {
  try {
    const files = fs.readdirSync(dir).filter((f) => /^baraka-.*\.db$/i.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const old of files.slice(keep)) fs.rmSync(path.join(dir, old.f), { force: true });
  } catch {}
}

/* ---------- نسخ تلقائي يومي ---------- */
function autoBackup() {
  try {
    const settings = store.settingsObject();
    if (settings.auto_backup !== '1') return;
    const backups = store.listBackups(settings.backup_folder || '').filter((b) => b.is_default);
    const latest = backups[0];
    if (latest && Date.now() - new Date(latest.created_at.replace(' ', 'T')).getTime() < 20 * 3600 * 1000) return;
    const info = store.backupTo(store.BACKUP_DIR, 'auto');
    pruneBackups(store.BACKUP_DIR, int(settings.backup_keep, 30));
    console.log(`[backup] نسخة تلقائية: ${info.name}`);
  } catch (e) { console.warn('[backup] فشل النسخ التلقائي:', e.message); }
}
setTimeout(autoBackup, 4000);
setInterval(autoBackup, 6 * 3600 * 1000).unref();

/* ============================================================
   الملفات الثابتة
   ============================================================ */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, pathname) {
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return sendJson(res, 400, { ok: false, error: 'مسار غير صالح' }); }
  const file = path.normalize(path.join(PUBLIC_DIR, decoded));
  if (!file.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { ok: false, error: 'ممنوع' });
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return sendJson(res, 404, { ok: false, error: 'غير موجود' });
  const ext = path.extname(file).toLowerCase();
  const stat = fs.statSync(file);
  const etag = `W/"${stat.size}-${Math.round(stat.mtimeMs)}"`;
  if (req.headers['if-none-match'] === etag) { res.writeHead(304); return res.end(); }
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

/* ============================================================
   الخادم
   ============================================================ */
const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (!pathname.startsWith('/api/')) {
    try { return serveStatic(req, res, pathname); }
    catch (e) { return sendJson(res, 500, { ok: false, error: 'خطأ في الخادم' }); }
  }

  // API
  const ctx = {
    req, res, url, params: {}, body: {}, user: null, session: null,
    ip: clientIp(req),
  };
  try {
    const match = routes.find((r) => r.method === req.method && r.rgx.test(pathname));
    if (!match) fail('المسار غير موجود', 404, 'NOT_FOUND');
    const m = pathname.match(match.rgx);
    match.keys.forEach((k, i) => { ctx.params[k] = decodeURIComponent(m[i + 1]); });

    const isLogin = pathname === '/api/auth/login' || pathname === '/api/health';
    if (!isLogin) {
      const auth = authFromRequest(req);
      if (!auth) fail('انتهت الجلسة — يرجى تسجيل الدخول', 401, 'UNAUTHORIZED');
      ctx.user = auth.user;
      ctx.session = auth.session;
      if (!['GET', 'HEAD'].includes(req.method)) {
        const csrf = req.headers['x-csrf'];
        if (!csrf || csrf !== auth.session.csrf) fail('رمز الحماية غير صالح — أعد تحميل الصفحة', 403, 'CSRF');
      }
      requirePerm(ctx.user, match.perm);
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !match.raw) {
      ctx.body = await readJson(req);
    }

    const result = await match.handler(ctx);
    if (result !== null && result !== undefined && !res.writableEnded) {
      ok(res, result);
    } else if (!res.writableEnded) {
      res.end();
    }
    if (process.env.LOG_REQUESTS === '1') {
      console.log(`${req.method} ${pathname} → ${res.statusCode} (${Date.now() - started}ms)`);
    }
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(`[${req.method} ${pathname}]`, err);
    if (!res.writableEnded) {
      sendJson(res, status, { ok: false, error: err.message || 'حدث خطأ غير متوقع', code: err.code || '' });
    }
  }
});

server.listen(PORT, HOST, () => {
  const line = '─'.repeat(56);
  console.log(`\n\x1b[32m${line}\x1b[0m`);
  console.log(`  🛒  \x1b[1mسوق البركة | Baraka Market ERP\x1b[0m  v${APP_VERSION}`);
  console.log(`  🌐  http://localhost:${PORT}`);
  console.log(`  💾  ${store.dbPath}`);
  console.log(`  👤  admin / admin123`);
  console.log(`\x1b[32m${line}\x1b[0m\n`);
});

process.on('SIGINT', () => {
  console.log('\nإيقاف الخادم...');
  store.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
});
process.on('uncaughtException', (e) => console.error('uncaughtException:', e));
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));
