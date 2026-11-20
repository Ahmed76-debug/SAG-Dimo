import { Router } from 'express';
import { getDb } from '../db.mjs';
import { nowIso, signToken, bad, unauthorized, sha256Hex } from '../util.mjs';
import { TOKEN_SECRET, TOKEN_TTL_MS } from '../config.mjs';

export const authRouter = Router();

function toSessionUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    fullNameAr: row.fullNameAr,
    fullNameEn: row.fullNameEn,
    role: row.role,
    companyId: row.companyId ?? undefined,
    email: row.email ?? undefined,
  };
}

authRouter.post('/login', (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const raw = String(username || '').trim();
    if (!raw || !password) return next(bad('اسم المستخدم وكلمة المرور مطلوبان'));
    const aliases = [raw];
    const lower = raw.toLowerCase();
    // الحساب الموحّد: admin فقط

    const db = getDb();
    let user = null;
    for (const candidate of aliases) {
      user = db.prepare('SELECT * FROM users WHERE username = ?').get(candidate);
      if (!user) user = db.prepare('SELECT * FROM users WHERE lower(username) = lower(?)').get(candidate);
      if (user) break;
    }
    if (!user || !user.isActive) return next(unauthorized('بيانات الدخول غير صحيحة'));

    const hash = sha256Hex(`muraqib::${password}`);
    if (user.passwordHash !== hash) return next(unauthorized('بيانات الدخول غير صحيحة'));

    const ts = nowIso();
    db.prepare('UPDATE users SET lastLogin = ? WHERE id = ?').run(ts, user.id);
    user.lastLogin = ts;
    try {
      db.prepare('INSERT INTO auditLogs (action,entity,entityId,detailsAr,detailsEn,userName,createdAt) VALUES (?,?,?,?,?,?,?)')
        .run('login', 'user', user.id, `تسجيل دخول: ${user.fullNameAr || user.username}`, `Login: ${user.fullNameEn || user.username}`, user.fullNameAr || user.username, ts);
    } catch {}

    const token = signToken({ sub: user.id, exp: Date.now() + TOKEN_TTL_MS }, TOKEN_SECRET);
    res.json({ ok: true, data: { token, user: toSessionUser(user) } });
  } catch (e) { next(e); }
});

authRouter.get('/me', (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const { verifyToken } = requireAuthPayload();
    const payload = token ? verifyToken(token, TOKEN_SECRET) : null;
    if (!payload?.sub) return next(unauthorized());
    const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!row || !row.isActive) return next(unauthorized('الجلسة غير صالحة'));
    res.json({ ok: true, data: { user: toSessionUser(row) } });
  } catch (e) { next(e); }
});

function requireAuthPayload() { return { verifyToken }; }

authRouter.post('/logout', (_req, res) => res.json({ ok: true }));
