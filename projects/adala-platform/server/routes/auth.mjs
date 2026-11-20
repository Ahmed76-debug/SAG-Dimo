import { Router } from 'express';
import { getDb } from '../db.mjs';
import { hashPassword, verifyPassword, serializeUser, requireAuth, randomSalt } from '../auth.mjs';
import { nowIso, signToken, bad, unauthorized } from '../util.mjs';
import { TOKEN_SECRET, TOKEN_TTL_MS } from '../config.mjs';

export const authRouter = Router();

authRouter.post('/login', (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const raw = String(username || '').trim();
    if (!raw || !password) return next(bad('اسم المستخدم وكلمة المرور مطلوبان'));
    const aliases = [raw];
    const lower = raw.toLowerCase();
    // الحساب الموحّد: admin فقط

    let user = null;
    const db = getDb();
    for (const candidate of aliases) {
      user = db.prepare('SELECT * FROM users WHERE username = ?').get(candidate);
      if (!user) user = db.prepare('SELECT * FROM users WHERE lower(username) = lower(?)').get(candidate);
      if (user) break;
    }
    if (!user || !user.isActive) return next(unauthorized('بيانات الدخول غير صحيحة'));
    if (!verifyPassword(password, user)) return next(unauthorized('بيانات الدخول غير صحيحة'));

    const ts = nowIso();
    db.prepare('UPDATE users SET lastLoginAt = ? WHERE id = ?').run(ts, user.id);
    user.lastLoginAt = ts;
    const token = signToken({ sub: user.id, exp: Date.now() + TOKEN_TTL_MS }, TOKEN_SECRET);
    res.json({ ok: true, data: { token, user: serializeUser(user) } });
  } catch (e) { next(e); }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, data: { user: req.userSafe } });
});

authRouter.post('/logout', (_req, res) => {
  res.json({ ok: true });
});

authRouter.post('/change-password', requireAuth, (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 4) return next(bad('كلمة المرور الجديدة قصيرة'));
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return next(unauthorized());
    if (!verifyPassword(currentPassword, user)) return next(bad('كلمة المرور الحالية غير صحيحة'));
    const salt = randomSalt();
    const hash = hashPassword(newPassword, salt);
    db.prepare('UPDATE users SET salt=?, passwordHash=? WHERE id=?').run(salt, hash, user.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});