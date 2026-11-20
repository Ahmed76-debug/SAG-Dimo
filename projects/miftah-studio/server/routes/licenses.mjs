import { Router } from 'express';
import { getDb, audit, getSettings, json } from '../db.mjs';
import { requireAuth, requirePermission } from '../auth.mjs';
import {
  generateLicenseKey, hashKey, keyHint, encryptSecret, decryptSecret, uid, signDocument, publicKeyPem,
} from '../crypto.mjs';
import {
  bad, notFound, conflict, requireFields, str, int, num, pagination, nowIso, addDays, effectiveStatus,
} from '../util.mjs';

export const licensesRouter = Router();
licensesRouter.use(requireAuth);

const PLAN_LABEL = { subscription: 'اشتراك', perpetual: 'دائم', trial: 'تجريبي' };

const EFFECTIVE_SQL = `CASE
  WHEN l.status = 'revoked' THEN 'revoked'
  WHEN l.status = 'suspended' THEN 'suspended'
  WHEN l.expires_at IS NOT NULL AND l.expires_at < ? THEN 'expired'
  ELSE 'active' END`;

function mapLicense(row) {
  if (!row) return null;
  return {
    id: row.id,
    uid: row.uid,
    keyHint: row.key_hint,
    product: {
      id: row.product_id,
      code: row.product_code,
      name: row.product_name,
      color: row.product_color,
      icon: row.product_icon,
    },
    customer: row.customer_id
      ? { id: row.customer_id, name: row.customer_name, company: row.customer_company, email: row.customer_email }
      : null,
    plan: row.plan,
    planLabel: PLAN_LABEL[row.plan] || row.plan,
    status: effectiveStatus({ status: row.status, expires_at: row.expires_at }),
    rawStatus: row.status,
    activationMode: row.activation_mode,
    issuedAt: row.issued_at,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    maxSeats: row.max_seats,
    activeActivations: row.active_activations ?? 0,
    features: json(row.features, []),
    price: row.price,
    currency: row.currency,
    notes: row.notes,
    lastSeenAt: row.last_seen_at,
    revokeReason: row.revoke_reason,
    createdAt: row.created_at,
  };
}

function baseQuery(now, filters) {
  const where = [];
  const params = [];
  const q = str(filters.q, 160);
  if (q) {
    where.push('(l.uid LIKE ? OR l.key_hint LIKE ? OR c.name LIKE ? OR c.company LIKE ? OR p.name LIKE ? OR p.code LIKE ?)');
    for (let i = 0; i < 6; i++) params.push(`%${q}%`);
  }
  const status = str(filters.status, 20);
  if (status === 'active') {
    where.push("l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at >= ?)");
    params.push(now);
  } else if (status === 'expired') {
    where.push("l.status = 'active' AND l.expires_at IS NOT NULL AND l.expires_at < ?");
    params.push(now);
  } else if (status === 'suspended') {
    where.push("l.status = 'suspended'");
  } else if (status === 'revoked') {
    where.push("l.status = 'revoked'");
  }
  if (filters.plan && PLAN_LABEL[filters.plan]) {
    where.push('l.plan = ?');
    params.push(filters.plan);
  }
  if (filters.productId) {
    where.push('l.product_id = ?');
    params.push(int(filters.productId));
  }
  if (filters.customerId) {
    where.push('l.customer_id = ?');
    params.push(int(filters.customerId));
  }
  if (filters.expiringDays) {
    where.push('l.status = ? AND l.expires_at IS NOT NULL AND l.expires_at >= ? AND l.expires_at <= ?');
    params.push('active', now, addDays(int(filters.expiringDays)));
  }
  if (filters.activationMode) {
    where.push('l.activation_mode = ?');
    params.push(filters.activationMode);
  }
  return { clause: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

licensesRouter.get('/', requirePermission('licenses.view'), (req, res) => {
  const db = getDb();
  const now = nowIso();
  const { page, limit, offset } = pagination(req, 12);
  const { clause, params } = baseQuery(now, req.query);

  const total = db.prepare(
    `SELECT COUNT(*) AS c FROM licenses l
     JOIN products p ON p.id = l.product_id LEFT JOIN customers c ON c.id = l.customer_id ${clause}`
  ).get(...params).c;

  const sortMap = {
    newest: 'l.issued_at DESC',
    oldest: 'l.issued_at ASC',
    expiring: 'l.expires_at IS NULL, l.expires_at ASC',
    price: 'l.price DESC',
    customer: 'c.name ASC',
  };
  const order = sortMap[req.query.sort] || sortMap.newest;

  const rows = db.prepare(
    `SELECT l.*, p.name AS product_name, p.code AS product_code, p.color AS product_color, p.icon AS product_icon,
        c.name AS customer_name, c.company AS customer_company, c.email AS customer_email,
        ${EFFECTIVE_SQL} AS effective_status,
        (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id AND a.status = 'active') AS active_activations
     FROM licenses l JOIN products p ON p.id = l.product_id LEFT JOIN customers c ON c.id = l.customer_id
     ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`
  ).all(now, ...params, limit, offset);

  const summary = db.prepare(
    `SELECT
      SUM(CASE WHEN l.status='active' AND (l.expires_at IS NULL OR l.expires_at >= ?) THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN l.status='active' AND l.expires_at IS NOT NULL AND l.expires_at < ? THEN 1 ELSE 0 END) AS expired,
      SUM(CASE WHEN l.status='suspended' THEN 1 ELSE 0 END) AS suspended,
      SUM(CASE WHEN l.status='revoked' THEN 1 ELSE 0 END) AS revoked,
      COALESCE(SUM(l.price),0) AS revenue
     FROM licenses l JOIN products p ON p.id = l.product_id LEFT JOIN customers c ON c.id = l.customer_id ${clause}`
  ).get(now, now, ...params);

  res.json({
    ok: true,
    data: {
      items: rows.map(mapLicense),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      summary,
    },
  });
});

licensesRouter.get('/export', requirePermission('licenses.export'), (req, res) => {
  const db = getDb();
  const now = nowIso();
  const { clause, params } = baseQuery(now, req.query);
  const rows = db.prepare(
    `SELECT l.uid, p.name AS product, p.code, c.name AS customer, c.company, l.plan,
      CASE WHEN l.status='revoked' THEN 'revoked' WHEN l.status='suspended' THEN 'suspended'
        WHEN l.expires_at IS NOT NULL AND l.expires_at < ? THEN 'expired' ELSE 'active' END AS status,
      l.issued_at, l.expires_at, l.max_seats, l.price, l.currency, l.key_hint
     FROM licenses l JOIN products p ON p.id = l.product_id LEFT JOIN customers c ON c.id = l.customer_id
     ${clause} ORDER BY l.issued_at DESC`
  ).all(now, ...params);

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['UID', 'Product', 'Code', 'Customer', 'Company', 'Plan', 'Status', 'Issued', 'Expires', 'Seats', 'Price', 'Currency', 'Key'];
  const csv = '\uFEFF' + [header.join(','), ...rows.map((r) => [
    r.uid, r.product, r.code, r.customer, r.company, r.plan, r.status, r.issued_at, r.expires_at,
    r.max_seats, r.price, r.currency, r.key_hint,
  ].map(esc).join(','))].join('\r\n');

  audit({ actor: req.user.name, userId: req.user.id, action: 'licenses.export', entity: 'license', ip: req.ipAddress, detail: { count: rows.length } });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="miftah-licenses-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

licensesRouter.get('/:id', requirePermission('licenses.view'), (req, res, next) => {
  const db = getDb();
  const now = nowIso();
  const row = db.prepare(
    `SELECT l.*, p.name AS product_name, p.code AS product_code, p.color AS product_color, p.icon AS product_icon,
      c.name AS customer_name, c.company AS customer_company, c.email AS customer_email,
      (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id AND a.status='active') AS active_activations
     FROM licenses l JOIN products p ON p.id = l.product_id LEFT JOIN customers c ON c.id = l.customer_id
     WHERE l.id = ?`
  ).get(req.params.id);
  if (!row) return next(notFound('الترخيص غير موجود'));
  const activations = db.prepare(
    'SELECT * FROM activations WHERE license_id = ? ORDER BY activated_at DESC'
  ).all(row.id).map((a) => ({
    id: a.id, machineId: a.machine_id, machineName: a.machine_name, os: a.os, appVersion: a.app_version,
    ip: a.ip, mode: a.mode, status: a.status, activatedAt: a.activated_at, lastSeenAt: a.last_seen_at,
  }));
  const requests = db.prepare(
    'SELECT id, uid, machine_id, machine_name, os, status, created_at, approved_at FROM activation_requests WHERE license_id = ? ORDER BY created_at DESC'
  ).all(row.id);
  const history = db.prepare(
    "SELECT * FROM audit_logs WHERE entity = 'license' AND entity_id = ? ORDER BY at DESC LIMIT 20"
  ).all(String(row.id)).map((r) => ({ ...r, detail: json(r.detail, null) }));
  res.json({ ok: true, data: { license: mapLicense(row), activations, requests, history } });
});

licensesRouter.post('/', requirePermission('licenses.create'), (req, res, next) => {
  const db = getDb();
  const body = req.body || {};
  const productId = int(body.productId);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return next(bad('المنتج غير موجود'));
  if (product.status !== 'active') return next(bad('لا يمكن إصدار تراخيص لمنتج معطّل', 'product_inactive'));

  let customerId = null;
  if (body.customerId) {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(int(body.customerId));
    if (!customer) return next(bad('العميل غير موجود'));
    customerId = customer.id;
  } else if (body.customer?.name) {
    const info = db.prepare(
      'INSERT INTO customers(name, company, email, phone, country, created_at) VALUES (?,?,?,?,?,?)'
    ).run(
      str(body.customer.name, 120), str(body.customer.company, 160), str(body.customer.email, 160),
      str(body.customer.phone, 40), str(body.customer.country, 80), nowIso()
    );
    customerId = Number(info.lastInsertRowid);
    audit({ actor: req.user.name, userId: req.user.id, action: 'customer.create', entity: 'customer', entityId: customerId, ip: req.ipAddress, detail: { name: body.customer.name, via: 'license_wizard' } });
  } else {
    return next(bad('يجب اختيار عميل أو إدخال بيانات عميل جديد', 'customer_required'));
  }

  const plan = ['perpetual', 'subscription', 'trial'].includes(body.plan) ? body.plan : 'subscription';
  const settings = getSettings();
  const defaults = product ? product : null;
  let days = int(body.days, 0);
  if (!days) days = plan === 'trial' ? 14 : (defaults?.default_days || int(settings['license.defaultDays'], 365));
  const maxSeats = Math.max(1, int(body.maxSeats, defaults?.default_seats || 1));
  const price = Math.max(0, num(body.price, 0));
  const currency = str(body.currency, 8) || settings['studio.currency'] || 'USD';
  const features = Array.isArray(body.features) ? body.features.filter(Boolean).slice(0, 40) : json(product.features, []);
  const activationMode = ['online', 'offline', 'hybrid'].includes(body.activationMode)
    ? body.activationMode
    : product.activation_mode;

  const key = generateLicenseKey(product.code);
  const at = nowIso();
  const expiresAt = plan === 'perpetual' ? null : addDays(Math.max(1, days));

  const info = db.prepare(
    `INSERT INTO licenses(uid, key_hash, key_cipher, key_hint, product_id, customer_id, plan, status, activation_mode,
      issued_at, starts_at, expires_at, max_seats, features, price, currency, notes, created_by, created_at)
     VALUES (?,?,?,?,?,?,?, 'active', ?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    uid('LIC'), hashKey(key), encryptSecret(key), keyHint(key), productId, customerId, plan, activationMode,
    at, at, expiresAt, maxSeats, JSON.stringify(features), price, currency, str(body.notes, 1000), req.user.id, at
  );

  audit({
    actor: req.user.name, userId: req.user.id, action: 'license.create', entity: 'license',
    entityId: info.lastInsertRowid, ip: req.ipAddress,
    detail: { plan, product: product.name, seats: maxSeats, price, currency, days: plan === 'perpetual' ? null : days },
  });

  const row = db.prepare(
    `SELECT l.*, p.name AS product_name, p.code AS product_code, p.color AS product_color, p.icon AS product_icon,
      c.name AS customer_name, c.company AS customer_company, c.email AS customer_email
     FROM licenses l JOIN products p ON p.id = l.product_id LEFT JOIN customers c ON c.id = l.customer_id
     WHERE l.id = ?`
  ).get(info.lastInsertRowid);

  res.status(201).json({ ok: true, data: { license: mapLicense(row), key } });
});

licensesRouter.patch('/:id', requirePermission('licenses.manage'), (req, res, next) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM licenses WHERE id = ?').get(req.params.id);
  if (!row) return next(notFound('الترخيص غير موجود'));
  const body = req.body || {};
  const notes = body.notes !== undefined ? str(body.notes, 1000) : row.notes;
  const maxSeats = body.maxSeats !== undefined ? Math.max(1, int(body.maxSeats, row.max_seats)) : row.max_seats;
  const features = Array.isArray(body.features) ? JSON.stringify(body.features.filter(Boolean).slice(0, 40)) : row.features;
  const price = body.price !== undefined ? Math.max(0, num(body.price, row.price)) : row.price;
  db.prepare('UPDATE licenses SET notes=?, max_seats=?, features=?, price=?, updated_at=? WHERE id=?')
    .run(notes, maxSeats, features, price, nowIso(), row.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'license.update', entity: 'license', entityId: row.id, ip: req.ipAddress, detail: { notes: true, maxSeats, price } });
  res.json({ ok: true });
});

licensesRouter.post('/:id/renew', requirePermission('licenses.manage'), (req, res, next) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM licenses WHERE id = ?').get(req.params.id);
  if (!row) return next(notFound('الترخيص غير موجود'));
  if (row.plan === 'perpetual') return next(bad('الترخيص الدائم لا يحتاج إلى تجديد', 'perpetual_license'));
  if (row.status === 'revoked') return next(bad('لا يمكن تجديد ترخيص ملغى. أعد تفعيله أولاً.', 'license_revoked'));
  const days = Math.max(1, int(req.body?.days, 365));
  const base = row.expires_at && new Date(row.expires_at).getTime() > Date.now() ? row.expires_at : nowIso();
  const expiresAt = addDays(days, new Date(base).getTime());
  db.prepare("UPDATE licenses SET expires_at=?, status='active', updated_at=? WHERE id=?").run(expiresAt, nowIso(), row.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'license.renew', entity: 'license', entityId: row.id, ip: req.ipAddress, detail: { days, expiresAt } });
  res.json({ ok: true, data: { expiresAt } });
});

licensesRouter.post('/:id/status', requirePermission('licenses.manage'), (req, res, next) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM licenses WHERE id = ?').get(req.params.id);
  if (!row) return next(notFound('الترخيص غير موجود'));
  const status = req.body?.status;
  if (!['active', 'suspended', 'revoked'].includes(status)) return next(bad('حالة غير صالحة'));
  if (status === 'revoked' && !String(req.body?.reason || '').trim()) return next(bad('يرجى إدخال سبب الإلغاء'));
  if (status === 'revoked') {
    db.prepare("UPDATE licenses SET status='revoked', revoked_at=?, revoke_reason=?, updated_at=? WHERE id=?")
      .run(nowIso(), str(req.body.reason, 500), nowIso(), row.id);
  } else {
    db.prepare('UPDATE licenses SET status=?, revoked_at=NULL, revoke_reason=NULL, updated_at=? WHERE id=?')
      .run(status, nowIso(), row.id);
  }
  audit({
    actor: req.user.name, userId: req.user.id, action: status === 'revoked' ? 'license.revoke' : `license.${status}`,
    entity: 'license', entityId: row.id, ip: req.ipAddress, detail: { reason: req.body?.reason || null },
  });
  res.json({ ok: true });
});

licensesRouter.post('/:id/reveal', requirePermission('licenses.reveal'), (req, res, next) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM licenses WHERE id = ?').get(req.params.id);
  if (!row) return next(notFound('الترخيص غير موجود'));
  const key = decryptSecret(row.key_cipher);
  if (!key) return next(bad('تعذر فك تشفير المفتاح', 'decrypt_failed'));
  audit({ actor: req.user.name, userId: req.user.id, action: 'license.reveal', entity: 'license', entityId: row.id, ip: req.ipAddress });
  res.json({ ok: true, data: { key } });
});

licensesRouter.get('/:id/offline-license', requirePermission('licenses.export'), (req, res, next) => {
  const db = getDb();
  const row = db.prepare(
    `SELECT l.*, p.name AS product_name, p.code AS product_code, c.name AS customer_name, c.email AS customer_email
     FROM licenses l JOIN products p ON p.id = l.product_id LEFT JOIN customers c ON c.id = l.customer_id
     WHERE l.id = ?`
  ).get(req.params.id);
  if (!row) return next(notFound('الترخيص غير موجود'));
  const status = effectiveStatus(row);
  if (status !== 'active') return next(bad(`لا يمكن إصدار ملف ترخيص لحالة: ${status}`, 'license_not_active'));

  const machineId = str(req.query.machineId, 120);
  const machineName = str(req.query.machineName, 120);
  const settings = getSettings();

  if (machineId) {
    const active = db.prepare("SELECT COUNT(*) AS c FROM activations WHERE license_id=? AND status='active'").get(row.id).c;
    const existing = db.prepare('SELECT * FROM activations WHERE license_id=? AND machine_id=?').get(row.id, machineId);
    if (!existing && active >= row.max_seats) {
      return next(conflict('تم استهلاك كل المقاعد المتاحة لهذا الترخيص', 'seats_exhausted'));
    }
    if (!existing) {
      db.prepare(
        `INSERT INTO activations(license_id, machine_id, machine_name, os, mode, status, activated_at, last_seen_at)
         VALUES (?,?,?,?, 'offline', 'active', ?, ?)`
      ).run(row.id, machineId, machineName, str(req.query.os, 80), nowIso(), nowIso());
      audit({ actor: req.user.name, userId: req.user.id, action: 'activation.create', entity: 'activation', entityId: row.id, ip: req.ipAddress, detail: { machineId, mode: 'offline' } });
    }
  }

  const payload = {
    doc: 'miftah-license',
    version: 1,
    licenseUid: row.uid,
    keyHint: row.key_hint,
    product: { code: row.product_code, name: row.product_name },
    customer: { name: row.customer_name || '—', email: row.customer_email || null },
    plan: row.plan,
    issuedAt: nowIso(),
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    offlineUntil: row.expires_at || addDays(3650),
    maxSeats: row.max_seats,
    machineId: machineId || null,
    machineName: machineName || null,
    features: json(row.features, []),
    graceDays: int(settings['license.graceDays'], 7),
    vendor: settings['studio.name'] || 'Miftah Studio',
    supportEmail: settings['studio.supportEmail'],
  };
  const doc = signDocument(payload);
  const safeName = `${row.product_code}-${row.uid}.lic`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('X-Public-Key', Buffer.from(publicKeyPem()).toString('base64'));
  res.send(JSON.stringify(doc, null, 2));
});

licensesRouter.delete('/:id', requirePermission('licenses.manage'), (req, res, next) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM licenses WHERE id = ?').get(req.params.id);
  if (!row) return next(notFound('الترخيص غير موجود'));
  db.prepare('DELETE FROM licenses WHERE id = ?').run(row.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'license.delete', entity: 'license', entityId: row.id, ip: req.ipAddress, detail: { uid: row.uid } });
  res.json({ ok: true });
});
