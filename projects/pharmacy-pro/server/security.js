'use strict';
const crypto = require('node:crypto');
const db = require('./db');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const computed = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return computed.length === expected.length && crypto.timingSafeEqual(computed, expected);
  } catch (_) {
    return false;
  }
}

let cachedSecret = null;
function secret() {
  if (cachedSecret) return cachedSecret;
  let row = db.get("SELECT value FROM settings WHERE key='auth_secret'");
  if (!row) {
    const value = crypto.randomBytes(32).toString('hex');
    db.run('INSERT INTO settings(key,value) VALUES(?,?)', 'auth_secret', value);
    cachedSecret = value;
  } else {
    cachedSecret = row.value;
  }
  return cachedSecret;
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');

function signToken(user) {
  const payload = { uid: user.id, role: user.role_id, iat: Date.now(), exp: Date.now() + 1000 * 60 * 60 * 24 * 14 };
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const [body, sig] = String(token).split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

const ALL_PERMISSIONS = [
  'dashboard.view', 'pos.use',
  'products.view', 'products.manage', 'inventory.manage',
  'purchases.view', 'purchases.manage', 'suppliers.manage',
  'customers.manage', 'prescriptions.manage',
  'sales.view', 'sales.manage', 'returns.manage',
  'reports.view', 'accounting.view', 'accounting.manage',
  'shifts.use', 'shifts.manage', 'users.manage', 'settings.manage',
  'backup.manage', 'audit.view'
];

function permissionsFor(roleId) {
  if (!roleId) return [];
  const role = db.get('SELECT permissions FROM roles WHERE id = ?', roleId);
  if (!role) return [];
  try {
    const perms = JSON.parse(role.permissions || '[]');
    if (perms.includes('*')) return [...ALL_PERMISSIONS];
    return perms.filter((p) => ALL_PERMISSIONS.includes(p));
  } catch (_) {
    return [];
  }
}

function normalizeCustomPermissions(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  let perms;
  if (Array.isArray(raw)) perms = raw;
  else {
    try { perms = JSON.parse(raw); } catch (_) { return null; }
  }
  if (!Array.isArray(perms)) return null;
  if (perms.includes('*')) return [...ALL_PERMISSIONS];
  return perms.filter((p) => ALL_PERMISSIONS.includes(p));
}

function permissionsForUser(user) {
  if (!user) return [];
  const custom = normalizeCustomPermissions(user.permissions);
  if (custom !== null) return custom;
  return permissionsFor(user.role_id);
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, ALL_PERMISSIONS, permissionsFor, permissionsForUser, normalizeCustomPermissions };
