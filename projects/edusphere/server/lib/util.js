import crypto from 'node:crypto';

export const nowIso = () => new Date().toISOString();

export const uuid = () => crypto.randomUUID();

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/** scrypt password hashing — format: scrypt$N$r$p$salt$hash (all base64url) */
export function hashPassword(password) {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(password), salt, 64, { N, r, p, maxmem: 128 * 1024 * 1024 });
  return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, salt, hash] = String(stored || '').split('$');
    if (scheme !== 'scrypt') return false;
    const saltBuf = Buffer.from(salt, 'base64url');
    const key = crypto.scryptSync(String(password), saltBuf, 64, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: 128 * 1024 * 1024,
    });
    const expected = Buffer.from(hash, 'base64url');
    return key.length === expected.length && crypto.timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

export const slug = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(String(value).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function csvEscape(value) {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\r\n;]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows, columns) {
  const cols = columns && columns.length ? columns : Object.keys(rows[0] || {});
  const head = cols.join(',');
  const body = rows.map((row) => cols.map((c) => csvEscape(row[c])).join(',')).join('\r\n');
  return `\uFEFF${head}\r\n${body}\r\n`;
}

export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  return out;
}

export function deepMerge(base, extra) {
  if (Array.isArray(base) || Array.isArray(extra)) return extra === undefined ? base : extra;
  if (typeof base !== 'object' || base === null) return extra === undefined ? base : extra;
  if (typeof extra !== 'object' || extra === null) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) out[k] = deepMerge(base[k], v);
  return out;
}

export function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
}

/** Deterministic-ish sequence generator, e.g. nextCode('INV', 1024) -> INV-001025 */
export function formatSequence(prefix, n, pad = 6) {
  return `${prefix}-${String(n).padStart(pad, '0')}`;
}

export function percent(part, whole) {
  if (!whole) return 0;
  return round2((part / whole) * 100);
}

export function safeJsonParse(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Validate a filesystem path for backup operations and confirm it exists. */
export function normalizeDirPath(p) {
  if (!p || typeof p !== 'string') return null;
  let s = p.trim().replace(/^"|"$/g, '');
  if (!s) return null;
  return s;
}

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
