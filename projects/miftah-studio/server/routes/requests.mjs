import { Router } from 'express';
import { getDb, audit } from '../db.mjs';
import { requireAuth, requirePermission } from '../auth.mjs';
import { bad, notFound, conflict, nowIso, pagination, str, effectiveStatus } from '../util.mjs';
import { buildOfflineLicense, activeSeatCount, activationExists, touchActivation } from '../licensing.mjs';

export const requestsRouter = Router();
requestsRouter.use(requireAuth);

function mapRequest(row) {
  return {
    id: row.id,
    uid: row.uid,
    licenseId: row.license_id,
    licenseUid: row.license_uid,
    keyHint: row.key_hint,
    product: { name: row.product_name, code: row.product_code, color: row.product_color },
    customer: row.customer_name ? { name: row.customer_name, company: row.customer_company } : null,
    machineId: row.machine_id,
    machineName: row.machine_name,
    os: row.os,
    appVersion: row.app_version,
    message: row.message,
    status: row.status,
    approvedAt: row.approved_at,
    rejectedReason: row.rejected_reason,
    createdAt: row.created_at,
  };
}

requestsRouter.get('/', requirePermission('requests.view'), (req, res) => {
  const db = getDb();
  const { page, limit, offset } = pagination(req, 12);
  const where = [];
  const params = [];
  if (['pending', 'approved', 'rejected'].includes(req.query.status)) {
    where.push('r.status = ?');
    params.push(req.query.status);
  }
  const q = str(req.query.q, 120);
  if (q) {
    where.push('(r.uid LIKE ? OR r.machine_id LIKE ? OR r.machine_name LIKE ? OR p.name LIKE ? OR c.name LIKE ?)');
    for (let i = 0; i < 5; i++) params.push(`%${q}%`);
  }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(
    `SELECT COUNT(*) AS c FROM activation_requests r JOIN products p ON p.id = r.product_id
     LEFT JOIN licenses l ON l.id = r.license_id LEFT JOIN customers c ON c.id = l.customer_id ${clause}`
  ).get(...params).c;
  const rows = db.prepare(
    `SELECT r.*, l.uid AS license_uid, l.key_hint, p.name AS product_name, p.code AS product_code, p.color AS product_color,
      c.name AS customer_name, c.company AS customer_company
     FROM activation_requests r JOIN products p ON p.id = r.product_id
     LEFT JOIN licenses l ON l.id = r.license_id LEFT JOIN customers c ON c.id = l.customer_id
     ${clause} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);
  const pending = db.prepare("SELECT COUNT(*) AS c FROM activation_requests WHERE status='pending'").get().c;
  res.json({ ok: true, data: { items: rows.map(mapRequest), total, page, pages: Math.max(1, Math.ceil(total / limit)), pending } });
});

requestsRouter.post('/:id/approve', requirePermission('requests.manage'), (req, res, next) => {
  const db = getDb();
  const row = db.prepare(
    `SELECT r.*, l.uid AS license_uid, l.plan, l.status AS license_status, l.expires_at, l.max_seats, l.features,
      l.starts_at, l.key_hint, p.name AS product_name, p.code AS product_code, c.name AS customer_name, c.email AS customer_email
     FROM activation_requests r JOIN products p ON p.id = r.product_id
     LEFT JOIN licenses l ON l.id = r.license_id LEFT JOIN customers c ON c.id = l.customer_id
     WHERE r.id = ?`
  ).get(req.params.id);
  if (!row) return next(notFound('الطلب غير موجود'));
  if (row.status !== 'pending') return next(conflict('تم معالجة هذا الطلب مسبقاً', 'already_processed'));
  if (!row.license_id) return next(bad('لا يوجد ترخيص مرتبط بهذا الطلب', 'license_missing'));
  if (effectiveStatus({ status: row.license_status, expires_at: row.expires_at }) !== 'active') {
    return next(bad('الترخيص المرتبط غير نشط', 'license_not_active'));
  }
  const existing = activationExists(row.license_id, row.machine_id);
  if (!existing && activeSeatCount(row.license_id) >= row.max_seats) {
    return next(conflict('لا توجد مقاعد متاحة لهذا الترخيص', 'seats_exhausted'));
  }
  touchActivation(row.license_id, row.machine_id, {
    machineName: row.machine_name, os: row.os, appVersion: row.app_version, mode: 'offline', ip: req.ipAddress,
  });
  const doc = buildOfflineLicense(row, { machineId: row.machine_id, machineName: row.machine_name });
  db.prepare(
    "UPDATE activation_requests SET status='approved', approved_by=?, approved_at=?, issued_token=? WHERE id=?"
  ).run(req.user.id, nowIso(), JSON.stringify(doc), row.id);
  audit({
    actor: req.user.name, userId: req.user.id, action: 'request.approve', entity: 'request', entityId: row.id,
    ip: req.ipAddress, detail: { machineId: row.machine_id, license: row.license_uid },
  });
  const filename = `${row.product_code}-${row.uid}.lic`;
  res.json({ ok: true, data: { document: doc, filename } });
});

requestsRouter.post('/:id/reject', requirePermission('requests.manage'), (req, res, next) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM activation_requests WHERE id = ?').get(req.params.id);
  if (!row) return next(notFound('الطلب غير موجود'));
  if (row.status !== 'pending') return next(conflict('تم معالجة هذا الطلب مسبقاً', 'already_processed'));
  const reason = str(req.body?.reason, 500) || 'رفض من فريق الدعم';
  db.prepare("UPDATE activation_requests SET status='rejected', approved_by=?, approved_at=?, rejected_reason=? WHERE id=?")
    .run(req.user.id, nowIso(), reason, row.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'request.reject', entity: 'request', entityId: row.id, ip: req.ipAddress, detail: { reason } });
  res.json({ ok: true });
});

requestsRouter.get('/:id/download', requirePermission('requests.manage'), (req, res, next) => {
  const db = getDb();
  const row = db.prepare(
    `SELECT r.*, p.code AS product_code FROM activation_requests r JOIN products p ON p.id = r.product_id WHERE r.id = ?`
  ).get(req.params.id);
  if (!row) return next(notFound('الطلب غير موجود'));
  if (row.status !== 'approved' || !row.issued_token) return next(bad('الملف غير متاح بعد', 'not_ready'));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${row.product_code}-${row.uid}.lic"`);
  res.send(row.issued_token);
});
