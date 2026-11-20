import { getDb, json } from './db.mjs';
import { verifyToken, hashApiKey } from './crypto.mjs';
import { unauthorized, forbidden, clientIp } from './util.mjs';

const attemptBuckets = new Map();

export function noteLoginAttempt(ip, success) {
  if (success) {
    attemptBuckets.delete(ip);
    return;
  }
  const now = Date.now();
  const bucket = attemptBuckets.get(ip) || { count: 0, first: now };
  if (now - bucket.first > 10 * 60 * 1000) {
    bucket.count = 0;
    bucket.first = now;
  }
  bucket.count += 1;
  attemptBuckets.set(ip, bucket);
}

export function loginBlocked(ip) {
  const bucket = attemptBuckets.get(ip);
  if (!bucket) return false;
  if (Date.now() - bucket.first > 10 * 60 * 1000) {
    attemptBuckets.delete(ip);
    return false;
  }
  return bucket.count >= 8;
}

export function serializeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    role: {
      id: row.role_id,
      slug: row.role_slug,
      name: row.role_name,
      permissions: json(row.role_permissions, []),
    },
    permissions: json(row.role_permissions, []),
    avatarColor: row.avatar_color,
    isActive: !!row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

export function loadUserById(id) {
  return getDb()
    .prepare(
      `SELECT u.*, r.slug AS role_slug, r.name AS role_name, r.permissions AS role_permissions
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`
    )
    .get(id);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload?.sub) return next(unauthorized());
  const row = loadUserById(payload.sub);
  if (!row || !row.is_active) return next(unauthorized('الحساب غير مفعّل'));
  req.user = serializeUser(row);
  req.userId = row.id;
  req.ipAddress = clientIp(req);
  next();
}

export function requirePermission(...keys) {
  return (req, res, next) => {
    const perms = req.user?.permissions || [];
    if (keys.some((k) => perms.includes(k))) return next();
    next(forbidden());
  };
}

export function can(user, key) {
  return !!user?.permissions?.includes(key);
}

export function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (!key) return next(unauthorized('مفتاح API مطلوب'));
  const row = getDb()
    .prepare('SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL')
    .get(hashApiKey(String(key)));
  if (!row) return next(unauthorized('مفتاح API غير صالح'));
  getDb().prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  req.apiKey = { id: row.id, name: row.name, scopes: json(row.scopes, []) };
  next();
}
