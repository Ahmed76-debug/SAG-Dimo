import { Router } from 'express';
import { getDb, audit, json } from '../db.mjs';
import { requireAuth, requirePermission } from '../auth.mjs';
import { bad, notFound, conflict, requireFields, str } from '../util.mjs';
import { ALL_PERMISSIONS } from '../permissions.mjs';

export const rolesRouter = Router();
rolesRouter.use(requireAuth);

function mapRole(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en,
    description: row.description,
    permissions: json(row.permissions, []),
    isSystem: !!row.is_system,
    users: row.users ?? 0,
    createdAt: row.created_at,
  };
}

rolesRouter.get('/', requirePermission('roles.view', 'users.view'), (req, res) => {
  const rows = getDb().prepare(
    `SELECT r.*, COUNT(u.id) AS users FROM roles r LEFT JOIN users u ON u.role_id = r.id GROUP BY r.id ORDER BY r.is_system DESC, r.id ASC`
  ).all();
  res.json({ ok: true, data: { items: rows.map(mapRole) } });
});

function cleanPermissions(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((p) => ALL_PERMISSIONS.includes(p)))];
}

rolesRouter.post('/', requirePermission('roles.manage'), (req, res, next) => {
  const body = req.body || {};
  requireFields(body, ['name']);
  const db = getDb();
  const slug = String(body.slug || body.nameEn || body.name)
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  if (!slug) return next(bad('اسم الدور غير صالح'));
  if (db.prepare('SELECT 1 FROM roles WHERE slug=?').get(slug)) return next(conflict('يوجد دور بهذا الاسم', 'slug_taken'));
  const info = db.prepare(
    'INSERT INTO roles(slug, name, name_en, description, permissions, is_system, created_at) VALUES (?,?,?,?,?,0,?)'
  ).run(slug, str(body.name, 80), str(body.nameEn, 80), str(body.description, 300), JSON.stringify(cleanPermissions(body.permissions)), new Date().toISOString());
  audit({ actor: req.user.name, userId: req.user.id, action: 'role.create', entity: 'role', entityId: info.lastInsertRowid, ip: req.ipAddress, detail: { name: body.name } });
  res.status(201).json({ ok: true, data: { role: mapRole(db.prepare('SELECT * FROM roles WHERE id=?').get(info.lastInsertRowid)) } });
});

rolesRouter.put('/:id', requirePermission('roles.manage'), (req, res, next) => {
  const db = getDb();
  const role = db.prepare('SELECT * FROM roles WHERE id=?').get(req.params.id);
  if (!role) return next(notFound('الدور غير موجود'));
  if (role.slug === 'owner') return next(bad('دور المالك ثابت ولا يمكن تعديل صلاحياته', 'owner_locked'));
  const body = req.body || {};
  const permissions = body.permissions !== undefined ? cleanPermissions(body.permissions) : json(role.permissions, []);
  db.prepare('UPDATE roles SET name=?, name_en=?, description=?, permissions=? WHERE id=?')
    .run(str(body.name, 80) || role.name, str(body.nameEn, 80), str(body.description, 300), JSON.stringify(permissions), role.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'role.update', entity: 'role', entityId: role.id, ip: req.ipAddress, detail: { name: body.name, permissions: permissions.length } });
  res.json({ ok: true, data: { role: mapRole(db.prepare('SELECT * FROM roles WHERE id=?').get(role.id)) } });
});

rolesRouter.delete('/:id', requirePermission('roles.manage'), (req, res, next) => {
  const db = getDb();
  const role = db.prepare('SELECT * FROM roles WHERE id=?').get(req.params.id);
  if (!role) return next(notFound('الدور غير موجود'));
  if (role.is_system) return next(bad('لا يمكن حذف دور نظامي', 'system_role'));
  const users = db.prepare('SELECT COUNT(*) AS c FROM users WHERE role_id=?').get(role.id).c;
  if (users > 0) return next(conflict('لا يمكن حذف دور مرتبط بمستخدمين', 'role_in_use'));
  db.prepare('DELETE FROM roles WHERE id=?').run(role.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'role.delete', entity: 'role', entityId: role.id, ip: req.ipAddress, detail: { name: role.name } });
  res.json({ ok: true });
});
