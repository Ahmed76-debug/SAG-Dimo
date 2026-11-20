'use strict';
/* ============================================================
   Auto Car — مسارات المصادقة
   ============================================================ */
const db = require('../lib/db');

module.exports = function authRoutes(app) {
  const { add, fail, str, run, get, clientIp, store } = app;

  add('POST', '/api/auth/login', null, async (ctx) => {
    const key = clientIp(ctx.req);
    const attempts = global.__loginAttempts || (global.__loginAttempts = new Map());
    const rec = attempts.get(key) || { count: 0, at: 0 };
    if (rec.count >= 10 && Date.now() - rec.at < 10 * 60 * 1000) fail('محاولات دخول كثيرة. حاول بعد قليل.', 429, 'RATE_LIMIT');
    const username = str(ctx.body.username, 60).toLowerCase();
    const password = String(ctx.body.password || '');
    if (!username || !password) fail('أدخل اسم المستخدم وكلمة المرور');
    let row = get('SELECT * FROM users WHERE lower(username) = ? AND deleted_at IS NULL', username);
    if (!row || !row.active || !store.verifyPassword(password, row.password_hash)) {
      attempts.set(key, { count: rec.count + 1, at: Date.now() });
      fail('اسم المستخدم أو كلمة المرور غير صحيحة', 401, 'INVALID_CREDENTIALS');
    }
    attempts.delete(key);
    const { csrf } = app.createSession ? app.createSession(row, ctx.req, ctx.res) : {};
    run('DELETE FROM sessions WHERE expires_at < ?', store.now());
    db.audit({ user_id: row.id, user_name: row.name, action: 'login', ip: clientIp(ctx.req) });
    return { user: normalize(row), csrf, settings: store.settingsAll() };
  });

  add('POST', '/api/auth/logout', null, (ctx) => {
    if (ctx.session) run('DELETE FROM sessions WHERE token = ?', ctx.session.token);
    app.setCookie(ctx.res, app.COOKIE, '', { maxAge: 0 });
    return { ok: true };
  });

  add('GET', '/api/auth/me', null, (ctx) => ({
    user: ctx.user, csrf: ctx.session.csrf, settings: store.settingsAll(),
  }));

  add('POST', '/api/auth/password', null, (ctx) => {
    const current = String(ctx.body.current || '');
    const next = String(ctx.body.next || '');
    if (next.length < 6) fail('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
    const row = get('SELECT password_hash FROM users WHERE id = ?', ctx.user.id);
    if (!store.verifyPassword(current, row.password_hash)) fail('كلمة المرور الحالية غير صحيحة', 401);
    run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', store.hashPassword(next), store.now(), ctx.user.id);
    run('DELETE FROM sessions WHERE user_id = ? AND token <> ?', ctx.user.id, ctx.session.token);
    db.audit({ ...app.ctxAudit(ctx), action: 'password' });
    return { message: 'تم تحديث كلمة المرور' };
  });
};

function normalize(row) {
  let perms = [];
  try { perms = JSON.parse(row.permissions || '[]'); } catch {}
  return { id: row.id, name: row.name, username: row.username, role: row.role, permissions: perms, phone: row.phone, email: row.email, avatar: row.avatar, active: !!row.active };
}
