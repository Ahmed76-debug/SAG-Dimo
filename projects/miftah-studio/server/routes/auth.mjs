import { Router } from 'express';
import { getDb, getSetting, audit, json } from '../db.mjs';
import { verifyPassword, hashPassword, signToken } from '../crypto.mjs';
import { requireAuth, serializeUser, loadUserById, noteLoginAttempt, loginBlocked } from '../auth.mjs';
import { bad, unauthorized, clientIp, requireFields } from '../util.mjs';

export const authRouter = Router();

authRouter.post('/login', (req, res, next) => {
  const ip = clientIp(req);
  if (loginBlocked(ip)) return next(bad('محاولات دخول كثيرة. حاول بعد ١٠ دقائق.', 'rate_limited'));
  const { username, password } = req.body || {};
  if (!username || !password) return next(bad('اسم المستخدم وكلمة المرور مطلوبان', 'validation_error'));

  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.*, r.slug AS role_slug, r.name AS role_name, r.permissions AS role_permissions
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE (LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?))`
    )
    .get(String(username).trim(), String(username).trim());

  if (!row || !verifyPassword(password, row.password_hash)) {
    noteLoginAttempt(ip, false);
    audit({ actor: String(username).slice(0, 60), action: 'auth.login_failed', entity: 'user', ip, detail: { reason: 'bad_credentials' } });
    return next(unauthorized('بيانات الدخول غير صحيحة'));
  }
  if (!row.is_active) return next(unauthorized('هذا الحساب موقوف. تواصل مع المالك.'));

  noteLoginAttempt(ip, true);
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  audit({ actor: row.name, userId: row.id, action: 'auth.login', entity: 'user', entityId: row.id, ip });

  const hours = Number(getSetting('security.sessionHours', '12')) || 12;
  const user = serializeUser(row);
  const token = signToken({ sub: row.id, role: row.role_slug, name: row.name }, hours * 3600);
  res.json({ ok: true, data: { token, user } });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, data: { user: req.user } });
});

authRouter.post('/logout', requireAuth, (req, res) => {
  audit({ actor: req.user.name, userId: req.user.id, action: 'auth.logout', entity: 'user', entityId: req.user.id, ip: req.ipAddress });
  res.json({ ok: true });
});

authRouter.post('/password', requireAuth, (req, res, next) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return next(bad('كلمة المرور الحالية والجديدة مطلوبتان'));
  if (String(newPassword).length < 8) return next(bad('كلمة المرور الجديدة يجب أن تكون ٨ أحرف على الأقل', 'weak_password'));
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(currentPassword, row.password_hash)) return next(bad('كلمة المرور الحالية غير صحيحة', 'bad_password'));
  getDb().prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    hashPassword(newPassword), new Date().toISOString(), req.user.id
  );
  audit({ actor: req.user.name, userId: req.user.id, action: 'auth.password_change', entity: 'user', entityId: req.user.id, ip: req.ipAddress });
  res.json({ ok: true });
});

authRouter.patch('/profile', requireAuth, (req, res, next) => {
  const name = req.body?.name?.trim();
  const email = req.body?.email?.trim() || null;
  const avatarColor = req.body?.avatarColor || null;
  if (!name) return next(bad('الاسم مطلوب'));
  getDb().prepare('UPDATE users SET name = ?, email = ?, avatar_color = ?, updated_at = ? WHERE id = ?').run(
    name, email, avatarColor, new Date().toISOString(), req.user.id
  );
  res.json({ ok: true, data: { user: serializeUser(loadUserById(req.user.id)) } });
});
