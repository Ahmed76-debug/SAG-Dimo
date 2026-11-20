import crypto from 'node:crypto';
import { getDb } from './db.mjs';
import { unauthorized, forbidden, verifyToken, clientIp, parseJson } from './util.mjs';
import { TOKEN_SECRET } from './config.mjs';

const ITERATIONS = 120000;

export function randomSalt() { return crypto.randomBytes(16).toString('hex'); }

export function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), String(salt), ITERATIONS, 32, 'sha256').toString('hex');
}

export function verifyPassword(password, user) {
  if (!user?.salt || !user?.passwordHash) return false;
  const h = hashPassword(password, user.salt);
  const a = Buffer.from(h, 'hex'), b = Buffer.from(String(user.passwordHash), 'hex');
  try { return a.length === b.length && crypto.timingSafeEqual(a, b); } catch { return false; }
}

const ALL_PERMISSIONS = [
  "dashboard.view","clients.view","clients.create","clients.edit","clients.delete","clients.archive",
  "matters.view","matters.create","matters.edit","matters.delete","matters.archive",
  "tasks.view","tasks.create","tasks.edit","tasks.delete",
  "events.view","events.create","events.edit","events.delete",
  "documents.view","documents.create","documents.edit","documents.delete","documents.export","documents.print",
  "agreements.view","agreements.create","agreements.edit","agreements.delete",
  "payments.view","payments.create","payments.edit","payments.delete",
  "library.view","library.create","library.edit","library.delete",
  "reports.view","reports.export",
  "archive.view","archive.restore","archive.purge",
  "users.view","users.create","users.edit","users.delete",
  "portfolio.edit","settings.edit","activity.view",
];

const ROLE_PERMISSIONS = {
  admin: ALL_PERMISSIONS,
  partner: ["dashboard.view","clients.view","clients.create","clients.edit","clients.archive","matters.view","matters.create","matters.edit","matters.archive","tasks.view","tasks.create","tasks.edit","tasks.delete","events.view","events.create","events.edit","events.delete","documents.view","documents.create","documents.edit","documents.export","documents.print","agreements.view","agreements.create","agreements.edit","payments.view","payments.create","payments.edit","library.view","library.create","library.edit","library.delete","reports.view","reports.export","archive.view","archive.restore","users.view","portfolio.edit","activity.view"],
  senior: ["dashboard.view","clients.view","clients.create","clients.edit","matters.view","matters.create","matters.edit","matters.archive","tasks.view","tasks.create","tasks.edit","tasks.delete","events.view","events.create","events.edit","events.delete","documents.view","documents.create","documents.edit","documents.export","documents.print","agreements.view","agreements.create","agreements.edit","payments.view","payments.create","payments.edit","library.view","library.create","library.edit","reports.view","reports.export","archive.view"],
  associate: ["dashboard.view","clients.view","clients.create","clients.edit","matters.view","matters.create","matters.edit","tasks.view","tasks.create","tasks.edit","events.view","events.create","events.edit","documents.view","documents.create","documents.edit","documents.export","documents.print","agreements.view","payments.view","library.view","library.create","library.edit","reports.view"],
  paralegal: ["dashboard.view","clients.view","clients.create","clients.edit","matters.view","tasks.view","tasks.create","tasks.edit","events.view","events.create","events.edit","documents.view","documents.create","documents.edit","documents.export","documents.print","agreements.view","payments.view","library.view","library.edit"],
  consultant: ["dashboard.view","clients.view","matters.view","tasks.view","events.view","documents.view","agreements.view","library.view","library.create","library.edit","reports.view"],
  client: ["dashboard.view","matters.view","documents.view","events.view","agreements.view"],
};

export function rolePermissions(role) { return ROLE_PERMISSIONS[role] || []; }
export function can(user, perm) {
  if (!user) return false;
  const overrides = parseJson(user.permOverrides, user.permOverrides || {});
  if (overrides && typeof overrides[perm] === 'boolean') return overrides[perm];
  return rolePermissions(user.role).includes(perm);
}

export function serializeUser(row) {
  if (!row) return null;
  const u = { ...row };
  delete u.passwordHash; delete u.salt; delete u.password;
  u.permOverrides = parseJson(u.permOverrides, u.permOverrides || undefined);
  u.isActive = !!u.isActive;
  u.notificationsEnabled = u.notificationsEnabled == null ? true : !!u.notificationsEnabled;
  return u;
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token, TOKEN_SECRET) : null;
  if (!payload?.sub) return next(unauthorized());
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
  if (!row || !row.isActive) return next(unauthorized('الجلسة غير صالحة'));
  req.user = row;
  req.userSafe = serializeUser(row);
  req.ipAddress = clientIp(req);
  next();
}

export function requirePermission(perm) {
  return (req, res, next) => {
    if (!can(req.user, perm)) return next(forbidden());
    next();
  };
}