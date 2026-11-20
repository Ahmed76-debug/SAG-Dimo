import { Router } from 'express';
import { getDb, audit, json } from '../db.mjs';
import { requireAuth, requirePermission } from '../auth.mjs';
import { notFound, nowIso, pagination, str } from '../util.mjs';

export const activationsRouter = Router();
activationsRouter.use(requireAuth);

activationsRouter.get('/', requirePermission('activations.view'), (req, res) => {
  const db = getDb();
  const { page, limit, offset } = pagination(req, 12);
  const where = [];
  const params = [];
  const q = str(req.query.q, 120);
  if (q) {
    where.push('(a.machine_id LIKE ? OR a.machine_name LIKE ? OR l.uid LIKE ? OR p.name LIKE ? OR c.name LIKE ?)');
    for (let i = 0; i < 5; i++) params.push(`%${q}%`);
  }
  if (['active', 'deactivated'].includes(req.query.status)) {
    where.push('a.status = ?');
    params.push(req.query.status);
  }
  if (['online', 'offline'].includes(req.query.mode)) {
    where.push('a.mode = ?');
    params.push(req.query.mode);
  }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(
    `SELECT COUNT(*) AS c FROM activations a JOIN licenses l ON l.id = a.license_id
     JOIN products p ON p.id = l.product_id LEFT JOIN customers c ON c.id = l.customer_id ${clause}`
  ).get(...params).c;
  const rows = db.prepare(
    `SELECT a.*, l.uid AS license_uid, l.plan, l.expires_at, l.key_hint,
      p.name AS product_name, p.code AS product_code, p.color AS product_color,
      c.name AS customer_name, c.company AS customer_company
     FROM activations a JOIN licenses l ON l.id = a.license_id
     JOIN products p ON p.id = l.product_id LEFT JOIN customers c ON c.id = l.customer_id
     ${clause} ORDER BY a.last_seen_at DESC, a.activated_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  res.json({
    ok: true,
    data: {
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      items: rows.map((a) => ({
        id: a.id,
        licenseId: a.license_id,
        licenseUid: a.license_uid,
        product: { name: a.product_name, code: a.product_code, color: a.product_color },
        customer: a.customer_name ? { name: a.customer_name, company: a.customer_company } : null,
        machineId: a.machine_id,
        machineName: a.machine_name,
        os: a.os,
        appVersion: a.app_version,
        ip: a.ip,
        mode: a.mode,
        status: a.status,
        activatedAt: a.activated_at,
        lastSeenAt: a.last_seen_at,
      })),
    },
  });
});

activationsRouter.post('/:id/deactivate', requirePermission('activations.manage'), (req, res, next) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM activations WHERE id = ?').get(req.params.id);
  if (!row) return next(notFound('التفعيل غير موجود'));
  db.prepare("UPDATE activations SET status='deactivated', deactivated_at=? WHERE id=?").run(nowIso(), row.id);
  audit({
    actor: req.user.name, userId: req.user.id, action: 'activation.deactivate', entity: 'activation',
    entityId: row.id, ip: req.ipAddress, detail: { machineId: row.machine_id },
  });
  res.json({ ok: true });
});

activationsRouter.delete('/:id', requirePermission('activations.manage'), (req, res, next) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM activations WHERE id = ?').get(req.params.id);
  if (!row) return next(notFound('التفعيل غير موجود'));
  db.prepare('DELETE FROM activations WHERE id = ?').run(row.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'activation.delete', entity: 'activation', entityId: row.id, ip: req.ipAddress });
  res.json({ ok: true });
});
