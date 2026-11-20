import { Router } from 'express';
import { getDb, json } from '../db.mjs';
import { requireAuth, requirePermission } from '../auth.mjs';
import { pagination, str, nowIso } from '../util.mjs';

export const auditRouter = Router();
auditRouter.use(requireAuth);

auditRouter.get('/', requirePermission('audit.view'), (req, res) => {
  const db = getDb();
  const { page, limit, offset } = pagination(req, 25);
  const where = [];
  const params = [];
  const q = str(req.query.q, 120);
  if (q) {
    where.push('(actor LIKE ? OR action LIKE ? OR entity LIKE ? OR entity_id LIKE ? OR detail LIKE ?)');
    for (let i = 0; i < 5; i++) params.push(`%${q}%`);
  }
  if (req.query.action) {
    where.push('action = ?');
    params.push(String(req.query.action));
  }
  if (req.query.entity) {
    where.push('entity = ?');
    params.push(String(req.query.entity));
  }
  if (req.query.from) {
    where.push('at >= ?');
    params.push(String(req.query.from));
  }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_logs ${clause}`).get(...params).c;
  const rows = db.prepare(`SELECT * FROM audit_logs ${clause} ORDER BY at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  const actions = db.prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action').all().map((r) => r.action);
  res.json({
    ok: true,
    data: {
      items: rows.map((r) => ({
        id: r.id, at: r.at, actor: r.actor, userId: r.user_id, action: r.action, entity: r.entity,
        entityId: r.entity_id, ip: r.ip, detail: json(r.detail, null),
      })),
      total, page, pages: Math.max(1, Math.ceil(total / limit)), actions,
    },
  });
});
