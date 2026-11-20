import { Router } from 'express';
import { getDb, audit, json } from '../db.mjs';
import { requireAuth, requirePermission } from '../auth.mjs';
import { bad, notFound, conflict, requireFields, str, int, nowIso } from '../util.mjs';

export const productsRouter = Router();
productsRouter.use(requireAuth);

const PLANS = ['subscription', 'perpetual', 'trial'];
const MODES = ['online', 'offline', 'hybrid'];

function mapProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameEn: row.name_en,
    description: row.description,
    category: row.category,
    platform: row.platform,
    version: row.version,
    vendor: row.vendor,
    website: row.website,
    color: row.color,
    icon: row.icon,
    activationMode: row.activation_mode,
    defaultPlan: row.default_plan,
    defaultDays: row.default_days,
    defaultSeats: row.default_seats,
    features: json(row.features, []),
    status: row.status,
    licenses: row.licenses ?? undefined,
    activeLicenses: row.active_licenses ?? undefined,
    revenue: row.revenue ?? undefined,
    createdAt: row.created_at,
  };
}

productsRouter.get('/', requirePermission('products.view'), (req, res) => {
  const db = getDb();
  const now = nowIso();
  const q = str(req.query.q, 120);
  const status = str(req.query.status, 20);
  const where = [];
  const params = [now];
  if (q) {
    where.push('(p.name LIKE ? OR p.name_en LIKE ? OR p.code LIKE ? OR p.category LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status && status !== 'all') {
    where.push('p.status = ?');
    params.push(status);
  }
  const sql = `
    SELECT p.*,
      COUNT(l.id) AS licenses,
      SUM(CASE WHEN l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at >= ?) THEN 1 ELSE 0 END) AS active_licenses,
      COALESCE(SUM(l.price), 0) AS revenue
    FROM products p LEFT JOIN licenses l ON l.product_id = p.id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY p.id ORDER BY p.created_at DESC`;
  // the "now" param must be first because the CASE appears in SELECT
  const rows = db.prepare(sql).all(...params);
  res.json({ ok: true, data: { items: rows.map(mapProduct) } });
});

productsRouter.get('/:id', requirePermission('products.view'), (req, res, next) => {
  const db = getDb();
  const now = nowIso();
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return next(notFound('المنتج غير موجود'));
  const stats = db.prepare(
    `SELECT COUNT(*) AS total,
      SUM(CASE WHEN status = 'active' AND (expires_at IS NULL OR expires_at >= ?) THEN 1 ELSE 0 END) AS active,
      COALESCE(SUM(price), 0) AS revenue
     FROM licenses WHERE product_id = ?`
  ).get(now, row.id);
  const recent = db.prepare(
    `SELECT l.id, l.uid, l.key_hint, l.plan, l.status, l.expires_at, l.issued_at, c.name AS customer_name, c.company
     FROM licenses l LEFT JOIN customers c ON c.id = l.customer_id
     WHERE l.product_id = ? ORDER BY l.issued_at DESC LIMIT 6`
  ).all(row.id);
  res.json({ ok: true, data: { product: mapProduct(row), stats, recent } });
});

function productPayload(body) {
  requireFields(body, ['name', 'code']);
  const code = String(body.code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (code.length < 2) throw bad('رمز المنتج يجب أن يتكون من حرفين على الأقل (A-Z, 0-9)', 'validation_error');
  return {
    code,
    name: str(body.name, 120),
    name_en: str(body.nameEn, 120),
    description: str(body.description, 800),
    category: str(body.category, 60),
    platform: str(body.platform, 60),
    version: str(body.version, 30),
    vendor: str(body.vendor, 100),
    website: str(body.website, 200),
    color: /^#[0-9a-fA-F]{6}$/.test(body.color || '') ? body.color : '#6366f1',
    icon: str(body.icon, 40) || 'app-window',
    activation_mode: MODES.includes(body.activationMode) ? body.activationMode : 'hybrid',
    default_plan: PLANS.includes(body.defaultPlan) ? body.defaultPlan : 'subscription',
    default_days: Math.max(0, int(body.defaultDays, 365)),
    default_seats: Math.max(1, int(body.defaultSeats, 1)),
    features: JSON.stringify(Array.isArray(body.features) ? body.features.filter(Boolean).slice(0, 30) : []),
    status: body.status === 'inactive' ? 'inactive' : 'active',
  };
}

productsRouter.post('/', requirePermission('products.manage'), (req, res, next) => {
  const db = getDb();
  const p = productPayload(req.body || {});
  if (db.prepare('SELECT 1 FROM products WHERE code = ?').get(p.code)) {
    return next(conflict('رمز المنتج مستخدم بالفعل', 'code_taken'));
  }
  const at = nowIso();
  const info = db.prepare(
    `INSERT INTO products(code, name, name_en, description, category, platform, version, vendor, website, color, icon,
      activation_mode, default_plan, default_days, default_seats, features, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    p.code, p.name, p.name_en, p.description, p.category, p.platform, p.version, p.vendor, p.website,
    p.color, p.icon, p.activation_mode, p.default_plan, p.default_days, p.default_seats, p.features, p.status, at
  );
  audit({ actor: req.user.name, userId: req.user.id, action: 'product.create', entity: 'product', entityId: info.lastInsertRowid, ip: req.ipAddress, detail: { name: p.name } });
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ok: true, data: { product: mapProduct(row) } });
});

productsRouter.put('/:id', requirePermission('products.manage'), (req, res, next) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return next(notFound('المنتج غير موجود'));
  const p = productPayload(req.body || {});
  const clash = db.prepare('SELECT id FROM products WHERE code = ? AND id != ?').get(p.code, existing.id);
  if (clash) return next(conflict('رمز المنتج مستخدم بالفعل', 'code_taken'));
  db.prepare(
    `UPDATE products SET code=?, name=?, name_en=?, description=?, category=?, platform=?, version=?, vendor=?, website=?,
      color=?, icon=?, activation_mode=?, default_plan=?, default_days=?, default_seats=?, features=?, status=?, updated_at=?
     WHERE id=?`
  ).run(
    p.code, p.name, p.name_en, p.description, p.category, p.platform, p.version, p.vendor, p.website,
    p.color, p.icon, p.activation_mode, p.default_plan, p.default_days, p.default_seats, p.features, p.status, nowIso(), existing.id
  );
  audit({ actor: req.user.name, userId: req.user.id, action: 'product.update', entity: 'product', entityId: existing.id, ip: req.ipAddress, detail: { name: p.name } });
  res.json({ ok: true, data: { product: mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id)) } });
});

productsRouter.delete('/:id', requirePermission('products.manage'), (req, res, next) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return next(notFound('المنتج غير موجود'));
  const count = db.prepare('SELECT COUNT(*) AS c FROM licenses WHERE product_id = ?').get(existing.id).c;
  if (count > 0) return next(conflict(`لا يمكن حذف المنتج لوجود ${count} ترخيص مرتبط به. يمكنك تعطيله بدلاً من ذلك.`, 'in_use'));
  db.prepare('DELETE FROM products WHERE id = ?').run(existing.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'product.delete', entity: 'product', entityId: existing.id, ip: req.ipAddress, detail: { name: existing.name } });
  res.json({ ok: true });
});
