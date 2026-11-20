import crypto from 'node:crypto';

export const nowIso = () => new Date().toISOString();
export const uid = (prefix = '') => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function parseJson(val, fallback) {
  if (val == null || val === '') return fallback;
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}
export function toJson(val) {
  if (val == null) return null;
  return typeof val === 'string' ? val : JSON.stringify(val);
}

export function bad(message, code = 'bad_request', status = 400, details) {
  const e = new Error(message); e.status = status; e.code = code; e.details = details; return e;
}
export function unauthorized(message = 'غير مصرح') { return bad(message, 'unauthorized', 401); }

export function safeJsonParse(s) { try { return JSON.parse(s); } catch { return null; } }

export function signToken(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}
export function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const payload = safeJsonParse(Buffer.from(data, 'base64url').toString('utf8'));
  if (!payload) return null;
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

export function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}
