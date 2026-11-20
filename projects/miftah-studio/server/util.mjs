export class HttpError extends Error {
  constructor(status, message, code = 'error', details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const bad = (message, code = 'bad_request', details = null) => new HttpError(400, message, code, details);
export const unauthorized = (message = 'يجب تسجيل الدخول للمتابعة') => new HttpError(401, message, 'unauthorized');
export const forbidden = (message = 'لا تملك صلاحية لهذا الإجراء') => new HttpError(403, message, 'forbidden');
export const notFound = (message = 'العنصر غير موجود') => new HttpError(404, message, 'not_found');
export const conflict = (message, code = 'conflict') => new HttpError(409, message, code);

export function nowIso() {
  return new Date().toISOString();
}

export function addDays(days, base = Date.now()) {
  return new Date(new Date(base).getTime() + Number(days) * 86400000).toISOString();
}

export function addMonths(months, base = Date.now()) {
  const d = new Date(base);
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString();
}

export function startOfDayIso(daysAgo = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

export function requireFields(body, fields) {
  const missing = fields.filter((f) => {
    const v = body?.[f];
    return v === undefined || v === null || (typeof v === 'string' && !v.trim());
  });
  if (missing.length) throw bad(`الحقول التالية مطلوبة: ${missing.join(', ')}`, 'validation_error', { missing });
}

export function str(value, max = 500) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, max) || null;
}

export function int(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function boolInt(value, fallback = 0) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}

export function clientIp(req) {
  const raw = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  return String(raw).split(',')[0].trim().replace('::ffff:', '');
}

export function pagination(req, defaultLimit = 20) {
  const page = Math.max(1, int(req.query.page, 1));
  const limit = Math.min(200, Math.max(1, int(req.query.limit, defaultLimit)));
  return { page, limit, offset: (page - 1) * limit };
}

export function pickEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function effectiveStatus(row, now = nowIso()) {
  if (row.status === 'revoked') return 'revoked';
  if (row.status === 'suspended') return 'suspended';
  if (row.expires_at && row.expires_at < now) return 'expired';
  return 'active';
}
