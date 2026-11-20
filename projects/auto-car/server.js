'use strict';
/* ============================================================
   Auto Car | أوتو كار — الخادم
   Node.js خالص بدون أي تبعيات خارجية
   ============================================================ */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const store = require('./lib/db');
const acc = require('./lib/accounting');
const { now, todayStr, addDays, round2, all, get, run, insert, update } = store;

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

const PORT = Number(process.env.PORT) || 4500;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const SESSION_DAYS = 7;
const APP_VERSION = '1.0.0';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

store.open();
store.migrate();

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
function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
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
function isHttps(req) {
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' || req.socket.encrypted;
}

/* ============================================================
   المصادقة والجلسات
   ============================================================ */
const COOKIE = 'autocar_sid';
const loginAttempts = new Map();

function createSession(user, req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const csrf = crypto.randomBytes(24).toString('hex');
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_DAYS * 86400000);
  run(`INSERT INTO sessions (token, user_id, csrf, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    token, user.id, csrf, store.now(created), store.now(expires), clientIp(req), String(req.headers['user-agent'] || '').slice(0, 180));
  run('UPDATE users SET last_login = ? WHERE id = ?', store.now(created), user.id);
  setCookie(res, COOKIE, token, { maxAge: SESSION_DAYS * 86400, secure: isHttps(req) });
  return { token, csrf };
}
function normalizeUser(row) {
  let perms = [];
  try { perms = JSON.parse(row.permissions || '[]'); } catch {}
  return {
    id: row.id, name: row.name, username: row.username, role: row.role,
    permissions: perms, phone: row.phone, email: row.email, avatar: row.avatar,
    active: !!row.active, last_login: row.last_login, created_at: row.created_at,
  };
}
function authFromRequest(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const row = get(`SELECT s.token, s.csrf, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND u.active = 1 AND u.deleted_at IS NULL`, token);
  if (!row) return null;
  if (String(row.expires_at) < store.now()) { run('DELETE FROM sessions WHERE token = ?', token); return null; }
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
   المسارات
   ============================================================ */
const routes = [];
function add(method, pattern, perm, handler, raw = false) {
  const keys = [];
  const rgx = new RegExp('^' + pattern.replace(/:[A-Za-z_]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
  routes.push({ method, rgx, keys, perm, handler, raw });
}

/* ---------- أدوات عامة للمسارات ---------- */
const int = (v, def = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : def; };
const num = (v, def = 0) => { const n = Number(v); return Number.isFinite(n) ? n : def; };
const str = (v, max = 500) => String(v == null ? '' : v).trim().slice(0, max);
const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true' || v === 'on') ? 1 : 0;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function rangeFromQuery(url) {
  const to = DATE_RE.test(url.searchParams.get('to') || '') ? url.searchParams.get('to') : todayStr();
  const from = DATE_RE.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : `${to.slice(0, 7)}-01`;
  return { from, to };
}
function pageParams(url, defLimit = 50) {
  const page = Math.max(1, int(url.searchParams.get('page'), 1));
  const limit = Math.min(500, Math.max(1, int(url.searchParams.get('limit'), defLimit)));
  return { page, limit, offset: (page - 1) * limit };
}
function ctxAudit(ctx) {
  return { user_id: ctx.user?.id || null, user_name: ctx.user?.name || null, ip: ctx.ip };
}

const app = {
  add, fail, int, num, str, bool, rangeFromQuery, pageParams, ctxAudit,
  requirePerm, can, store, acc, sendJson, ok, readBody, readJson,
  now, todayStr, addDays, round2, all, get, run, insert, update,
  UPLOAD_DIR, PUBLIC_DIR, APP_VERSION,
  COOKIE, clientIp, isHttps, setCookie,
  createSession, normalizeUser, HttpError,
};

/* ---------- تحميل وحدات المسارات ---------- */
for (const mod of [
  './routes/auth', './routes/system', './routes/dashboard', './routes/catalog',
  './routes/partners', './routes/vehicles', './routes/purchases', './routes/sales',
  './routes/installments', './routes/consignment', './routes/accounting',
  './routes/reports', './routes/notifications', './routes/systemtools',
  './routes/importexport',
]) {
  require(mod)(app);
}

/* ---------- نسخ احتياطي تلقائي ---------- */
function autoBackup() {
  try {
    const s = store.settingsAll();
    if (s.auto_backup_enabled !== '1') return;
    const hours = Math.max(1, int(s.auto_backup_interval_hours, 24));
    const dir = s.backup_dir || store.BACKUP_DIR;
    const list = store.listBackups(dir).filter((b) => /-auto\.db$/i.test(b.filename));
    const latest = list[0];
    if (latest && Date.now() - new Date(latest.created_at.replace(' ', 'T')).getTime() < hours * 3600 * 1000) {
      store.pruneBackups(dir, int(s.backup_retention_days, 30));
      return;
    }
    const info = store.backupTo(dir, { kind: 'auto', note: 'نسخة تلقائية' });
    store.pruneBackups(dir, int(s.backup_retention_days, 30));
    console.log(`[backup] نسخة تلقائية: ${info.filename}`);
  } catch (e) { console.warn('[backup] فشل النسخ التلقائي:', e.message); }
}
setTimeout(autoBackup, 5000);
setInterval(autoBackup, 30 * 60 * 1000).unref();

/* ---------- الملفات الثابتة ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf', '.csv': 'text/csv; charset=utf-8',
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
    'Cache-Control': ['.html', '.js', '.css', '.json'].includes(ext) ? 'no-cache' : 'public, max-age=600',
    ETag: etag, 'X-Content-Type-Options': 'nosniff',
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
    catch { return sendJson(res, 500, { ok: false, error: 'خطأ في الخادم' }); }
  }

  const ctx = { req, res, url, params: {}, body: {}, user: null, session: null, ip: clientIp(req) };
  try {
    const match = routes.find((r) => r.method === req.method && r.rgx.test(pathname));
    if (!match) fail('المسار غير موجود', 404, 'NOT_FOUND');
    const m = pathname.match(match.rgx);
    match.keys.forEach((k, i) => { ctx.params[k] = decodeURIComponent(m[i + 1]); });

    const isPublic = pathname === '/api/auth/login' || pathname === '/api/health' || pathname === '/api/branding';
    if (!isPublic) {
      const auth = authFromRequest(req);
      if (!auth) fail('انتهت الجلسة — يرجى تسجيل الدخول', 401, 'UNAUTHORIZED');
      ctx.user = auth.user; ctx.session = auth.session;
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
    if (result !== null && result !== undefined && !res.writableEnded) ok(res, result);
    else if (!res.writableEnded) res.end();
    if (process.env.LOG_REQUESTS === '1') console.log(`${req.method} ${pathname} → ${res.statusCode} (${Date.now() - started}ms)`);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(`[${req.method} ${pathname}]`, err);
    if (!res.writableEnded) sendJson(res, status, { ok: false, error: err.message || 'حدث خطأ غير متوقع', code: err.code || '' });
  }
});

server.listen(PORT, HOST, () => {
  const line = '─'.repeat(60);
  console.log(`\n\x1b[36m${line}\x1b[0m`);
  console.log(`  🚗  \x1b[1mAuto Car | أوتو كار للسيارات\x1b[0m  v${APP_VERSION}`);
  console.log(`  🌐  http://localhost:${PORT}`);
  console.log(`  💾  ${store.currentPath()}`);
  console.log(`  👤  admin / admin123`);
  console.log(`\x1b[36m${line}\x1b[0m\n`);
});

process.on('SIGINT', () => { console.log('\nإيقاف الخادم...'); store.close(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1500); });
process.on('uncaughtException', (e) => console.error('uncaughtException:', e));
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));

module.exports = { server, app, routes };
