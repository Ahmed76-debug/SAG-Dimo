import { Router } from 'express';
import { getDb, audit } from '../db.mjs';
import { requireAuth, requirePermission } from '../auth.mjs';
import { bad, notFound, conflict, requireFields, str, nowIso } from '../util.mjs';

export const customersRouter = Router();
customersRouter.use(requireAuth);

function mapCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    country: row.country,
    taxId: row.tax_id,
    notes: row.notes,
    licenses: row.licenses ?? undefined,
    activeLicenses: row.active_licenses ?? undefined,
    revenue: row.revenue ?? undefined,
    createdAt: row.created_at,
  };
}

customersRouter.get('/', requirePermission('customers.view'), (req, res) => {
  const db = getDb();
  const now = nowIso();
  const q = str(req.query.q, 120);
  const where = [];
  const params = [now];
  if (q) {
    where.push('(c.name LIKE ? OR c.company LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows = db.prepare(
    `SELECT c.*,
      COUNT(l.id) AS licenses,
      SUM(CASE WHEN l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at >= ?) THEN 1 ELSE 0 END) AS active_licenses,
      COALESCE(SUM(l.price), 0) AS revenue
     FROM customers c LEFT JOIN licenses l ON l.customer_id = c.id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     GROUP BY c.id ORDER BY c.created_at DESC`
  ).all(...params);
  res.json({ ok: true, data: { items: rows.map(mapCustomer) } });
});

customersRouter.get('/:id', requirePermission('customers.view'), (req, res, next) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!row) return next(notFound('العميل غير موجود'));
  const now = nowIso();
  const licenses = db.prepare(
    `SELECT l.id, l.uid, l.key_hint, l.plan, l.status, l.expires_at, l.issued_at, l.price,
      p.name AS product_name, p.color AS product_color, p.code AS product_code,
      CASE WHEN l.status='revoked' THEN 'revoked' WHEN l.status='suspended' THEN 'suspended'
        WHEN l.expires_at IS NOT NULL AND l.expires_at < ? THEN 'expired' ELSE 'active' END AS effective_status
     FROM licenses l JOIN products p ON p.id = l.product_id
     WHERE l.customer_id = ? ORDER BY l.issued_at DESC`
  ).all(now, row.id);
  res.json({ ok: true, data: { customer: mapCustomer(row), licenses } });
});

function payload(body) {
  requireFields(body, ['name']);
  return {
    name: str(body.name, 120),
    company: str(body.company, 160),
    email: str(body.email, 160),
    phone: str(body.phone, 40),
    country: str(body.country, 80),
    tax_id: str(body.taxId, 40),
    notes: str(body.notes, 1000),
  };
}

customersRouter.post('/', requirePermission('customers.manage'), (req, res, next) => {
  const db = getDb();
  const c = payload(req.body || {});
  if (c.email && db.prepare('SELECT 1 FROM customers WHERE LOWER(email) = LOWER(?)').get(c.email)) {
    return next(conflict('يوجد عميل مسجل بهذا البريد', 'email_taken'));
  }
  const info = db.prepare(
    'INSERT INTO customers(name, company, email, phone, country, tax_id, notes, created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).run(c.name, c.company, c.email, c.phone, c.country, c.tax_id, c.notes, nowIso());
  audit({ actor: req.user.name, userId: req.user.id, action: 'customer.create', entity: 'customer', entityId: info.lastInsertRowid, ip: req.ipAddress, detail: { name: c.name } });
  res.status(201).json({ ok: true, data: { customer: mapCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid)) } });
});

customersRouter.put('/:id', requirePermission('customers.manage'), (req, res, next) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!existing) return next(notFound('العميل غير موجود'));
  const c = payload(req.body || {});
  if (c.email) {
    const clash = db.prepare('SELECT id FROM customers WHERE LOWER(email)=LOWER(?) AND id != ?').get(c.email, existing.id);
    if (clash) return next(conflict('يوجد عميل مسجل بهذا البريد', 'email_taken'));
  }
  db.prepare('UPDATE customers SET name=?, company=?, email=?, phone=?, country=?, tax_id=?, notes=?, updated_at=? WHERE id=?')
    .run(c.name, c.company, c.email, c.phone, c.country, c.tax_id, c.notes, nowIso(), existing.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'customer.update', entity: 'customer', entityId: existing.id, ip: req.ipAddress, detail: { name: c.name } });
  res.json({ ok: true, data: { customer: mapCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(existing.id)) } });
});

customersRouter.delete('/:id', requirePermission('customers.manage'), (req, res, next) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!existing) return next(notFound('العميل غير موجود'));
  const count = db.prepare('SELECT COUNT(*) AS c FROM licenses WHERE customer_id = ?').get(existing.id).c;
  if (count > 0) return next(conflict(`لا يمكن حذف العميل لوجود ${count} ترخيص مرتبط به.`, 'in_use'));
  db.prepare('DELETE FROM customers WHERE id = ?').run(existing.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'customer.delete', entity: 'customer', entityId: existing.id, ip: req.ipAddress, detail: { name: existing.name } });
  res.json({ ok: true });
});
