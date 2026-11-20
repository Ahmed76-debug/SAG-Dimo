import { Router } from 'express';
import { getDb, audit } from '../db.mjs';
import { requireAuth, requirePermission } from '../auth.mjs';
import { hashPassword } from '../crypto.mjs';
import { bad, notFound, conflict, requireFields, str, nowIso, boolInt } from '../util.mjs';
import { serializeUser } from '../auth.mjs';

export const usersRouter = Router();
usersRouter.use(requireAuth);

function activeOwnerCount(excludeId = null) {
  const db = getDb();
  const row = db.prepare(
    `SELECT COUNT(*) AS c FROM users u JOIN roles r ON r.id = u.role_id
     WHERE r.slug = 'owner' AND u.is_active = 1 ${excludeId ? 'AND u.id != ?' : ''}`
  ).get(...(excludeId ? [excludeId] : []));
  return row.c;
}

function userRows() {
  return getDb().prepare(
    `SELECT u.*, r.slug AS role_slug, r.name AS role_name, r.permissions AS role_permissions
     FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.created_at ASC`
  ).all();
}

usersRouter.get('/', requirePermission('users.view'), (req, res) => {
  res.json({ ok: true, data: { items: userRows().map(serializeUser) } });
});

usersRouter.post('/', requirePermission('users.manage'), (req, res, next) => {
  const body = req.body || {};
  requireFields(body, ['username', 'name', 'password', 'roleId']);
  if (String(body.password).length < 8) return next(bad('كلمة المرور يجب أن تكون ٨ أحرف على الأقل', 'weak_password'));
  const db = getDb();
  const username = String(body.username).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (username.length < 3) return next(bad('اسم المستخدم يجب أن يكون ٣ أحرف على الأقل (حروف إنجليزية وأرقام)', 'invalid_username'));
  if (db.prepare('SELECT 1 FROM users WHERE LOWER(username)=?').get(username)) return next(conflict('اسم المستخدم مستخدم بالفعل', 'username_taken'));
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(body.roleId);
  if (!role) return next(bad('الدور غير موجود'));
  const info = db.prepare(
    `INSERT INTO users(username, name, email, password_hash, role_id, is_active, avatar_color, created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    username, str(body.name, 120), str(body.email, 160), hashPassword(body.password), role.id,
    boolInt(body.isActive, 1), str(body.avatarColor, 20) || '#6366f1', nowIso()
  );
  audit({ actor: req.user.name, userId: req.user.id, action: 'user.create', entity: 'user', entityId: info.lastInsertRowid, ip: req.ipAddress, detail: { username, role: role.slug } });
  const row = getDb().prepare(
    `SELECT u.*, r.slug AS role_slug, r.name AS role_name, r.permissions AS role_permissions FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`
  ).get(info.lastInsertRowid);
  res.status(201).json({ ok: true, data: { user: serializeUser(row) } });
});

usersRouter.put('/:id', requirePermission('users.manage'), (req, res, next) => {
  const db = getDb();
  const target = db.prepare(
    `SELECT u.*, r.slug AS role_slug FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`
  ).get(req.params.id);
  if (!target) return next(notFound('المستخدم غير موجود'));
  const body = req.body || {};
  const roleId = body.roleId ? Number(body.roleId) : target.role_id;
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId);
  if (!role) return next(bad('الدور غير موجود'));
  const isActive = body.isActive === undefined ? target.is_active : boolInt(body.isActive);
  if (target.id === req.user.id && (!isActive || role.slug !== 'owner')) {
    return next(bad('لا يمكنك إزالة صلاحياتك أو إيقاف حسابك', 'self_protection'));
  }
  if (target.role_slug === 'owner' && (role.slug !== 'owner' || !isActive) && activeOwnerCount(target.id) === 0) {
    return next(bad('يجب أن يبقى مالك واحد نشط على الأقل', 'last_owner'));
  }
  const name = str(body.name, 120) || target.name;
  db.prepare('UPDATE users SET name=?, email=?, role_id=?, is_active=?, avatar_color=?, updated_at=? WHERE id=?')
    .run(name, str(body.email, 160), role.id, isActive, str(body.avatarColor, 20) || target.avatar_color, nowIso(), target.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'user.update', entity: 'user', entityId: target.id, ip: req.ipAddress, detail: { name, role: role.slug, isActive } });
  const row = getDb().prepare(
    `SELECT u.*, r.slug AS role_slug, r.name AS role_name, r.permissions AS role_permissions FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`
  ).get(target.id);
  res.json({ ok: true, data: { user: serializeUser(row) } });
});

usersRouter.post('/:id/password', requirePermission('users.manage'), (req, res, next) => {
  const db = getDb();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return next(notFound('المستخدم غير موجود'));
  if (!req.body?.password || String(req.body.password).length < 8) return next(bad('كلمة المرور يجب أن تكون ٨ أحرف على الأقل', 'weak_password'));
  db.prepare('UPDATE users SET password_hash=?, updated_at=? WHERE id=?').run(hashPassword(req.body.password), nowIso(), target.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'user.password_reset', entity: 'user', entityId: target.id, ip: req.ipAddress });
  res.json({ ok: true });
});

usersRouter.delete('/:id', requirePermission('users.manage'), (req, res, next) => {
  const db = getDb();
  const target = db.prepare(
    `SELECT u.*, r.slug AS role_slug FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`
  ).get(req.params.id);
  if (!target) return next(notFound('المستخدم غير موجود'));
  if (target.id === req.user.id) return next(bad('لا يمكنك حذف حسابك الحالي', 'self_protection'));
  if (target.role_slug === 'owner' && activeOwnerCount(target.id) === 0) return next(bad('يجب أن يبقى مالك واحد نشط على الأقل', 'last_owner'));
  db.prepare('DELETE FROM users WHERE id=?').run(target.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'user.delete', entity: 'user', entityId: target.id, ip: req.ipAddress, detail: { username: target.username } });
  res.json({ ok: true });
});
