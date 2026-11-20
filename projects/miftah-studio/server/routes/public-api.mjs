import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb, getSettings, json, audit } from '../db.mjs';
import { requireApiKey } from '../auth.mjs';
import {
  findLicenseByKey, findLicenseByUid, licenseSummary, buildActivationToken, buildOfflineLicense,
  touchActivation, activeSeatCount, activationExists, activationSummary, logPublic,
} from '../licensing.mjs';
import { publicKeyPem, uid, normalizeMachine } from '../crypto.mjs';
import {
  bad, notFound, conflict, requireFields, str, nowIso, effectiveStatus, clientIp,
} from '../util.mjs';
import { config, pkg } from '../config.mjs';

export const publicRouter = Router();

/* lightweight per-IP rate limit for public endpoints */
const buckets = new Map();
publicRouter.use((req, res, next) => {
  const ip = clientIp(req);
  const now = Date.now();
  const bucket = buckets.get(ip) || { count: 0, reset: now + 60000 };
  if (now > bucket.reset) { bucket.count = 0; bucket.reset = now + 60000; }
  bucket.count += 1;
  buckets.set(ip, bucket);
  if (bucket.count > 180) return next(bad('تجاوزت الحد المسموح من الطلبات. حاول بعد دقيقة.', 'rate_limited'));
  next();
});

publicRouter.get('/health', (req, res) => {
  res.json({ ok: true, data: { status: 'ok', service: 'miftah-activation-api', version: pkg.version, time: nowIso() } });
});

publicRouter.get('/branding', (req, res) => {
  const s = getSettings();
  res.json({
    ok: true,
    data: {
      name: s['studio.name'],
      tagline: s['studio.tagline'],
      supportEmail: s['studio.supportEmail'],
      currency: s['studio.currency'],
      theme: s['appearance.defaultTheme'],
      density: s['appearance.defaultDensity'],
    },
  });
});

publicRouter.get('/public-key', (req, res) => {
  const pem = publicKeyPem();
  const fingerprint = crypto.createHash('sha256').update(pem).digest('hex').match(/.{1,4}/g).slice(0, 8).join(':').toUpperCase();
  res.json({ ok: true, data: { algorithm: 'Ed25519', publicKey: pem, fingerprint } });
});

function requireScope(scope) {
  return (req, res, next) => {
    if (!req.apiKey?.scopes?.includes(scope) && !req.apiKey?.scopes?.includes('*')) {
      return next(bad('مفتاح API لا يملك نطاق ' + scope, 'insufficient_scope'));
    }
    next();
  };
}

publicRouter.post('/activate', requireApiKey, requireScope('activate'), (req, res, next) => {
  const body = req.body || {};
  requireFields(body, ['licenseKey', 'machineId']);
  const licenseKey = String(body.licenseKey).trim();
  const machineId = normalizeMachine(body.machineId);
  if (!machineId) return next(bad('معرّف الجهاز غير صالح', 'invalid_machine'));

  const lic = findLicenseByKey(licenseKey);
  if (!lic) {
    logPublic('activation.failed', { reason: 'unknown_key', machineId }, clientIp(req));
    return next(notFound('مفتاح الترخيص غير صحيح', 'invalid_license_key'));
  }
  if (body.productCode && String(body.productCode).toUpperCase() !== lic.product_code) {
    return next(bad('هذا المفتاح لا يخص هذا المنتج', 'product_mismatch'));
  }
  const status = effectiveStatus(lic);
  if (status !== 'active') {
    logPublic('activation.failed', { reason: status, license: lic.uid, machineId }, clientIp(req));
    return next(bad(`الترخيص غير نشط (${status})`, 'license_' + status));
  }

  const existing = activationExists(lic.id, machineId);
  if (!existing && activeSeatCount(lic.id) >= lic.max_seats) {
    logPublic('activation.failed', { reason: 'seats_exhausted', license: lic.uid, machineId }, clientIp(req));
    return next(conflict('تم استهلاك جميع المقاعد المتاحة لهذا الترخيص', 'seats_exhausted'));
  }

  const { activation, created } = touchActivation(lic.id, machineId, {
    machineName: str(body.machineName, 120), os: str(body.os, 100), appVersion: str(body.appVersion, 40),
    ip: clientIp(req), mode: 'online',
  });
  const token = buildActivationToken(lic, activation);
  audit({
    actor: 'activation-api', action: created ? 'activation.create' : 'activation.heartbeat', entity: 'license',
    entityId: lic.id, ip: clientIp(req), detail: { machineId, license: lic.uid, source: 'api' },
  });

  res.json({
    ok: true,
    data: {
      token,
      license: licenseSummary(lic),
      activation: activationSummary(activation),
      seats: { used: activeSeatCount(lic.id), max: lic.max_seats },
      serverTime: nowIso(),
    },
  });
});

publicRouter.post('/validate', requireApiKey, requireScope('validate'), (req, res, next) => {
  const body = req.body || {};
  const machineId = normalizeMachine(body.machineId);
  if (!machineId) return next(bad('معرّف الجهاز مطلوب', 'invalid_machine'));
  const lic = body.licenseUid ? findLicenseByUid(String(body.licenseUid)) : findLicenseByKey(String(body.licenseKey || ''));
  if (!lic) return next(notFound('الترخيص غير موجود', 'invalid_license'));
  const status = effectiveStatus(lic);
  const activation = activationExists(lic.id, machineId);
  if (status !== 'active') {
    return res.json({ ok: true, data: { valid: false, reason: status, license: licenseSummary(lic), serverTime: nowIso() } });
  }
  if (!activation || activation.status !== 'active') {
    return res.json({ ok: true, data: { valid: false, reason: 'not_activated', license: licenseSummary(lic), serverTime: nowIso() } });
  }
  const touched = touchActivation(lic.id, machineId, { ip: clientIp(req), mode: activation.mode });
  const token = buildActivationToken(lic, touched.activation);
  res.json({
    ok: true,
    data: {
      valid: true,
      token,
      license: licenseSummary(lic),
      activation: activationSummary(touched.activation),
      seats: { used: activeSeatCount(lic.id), max: lic.max_seats },
      serverTime: nowIso(),
    },
  });
});

publicRouter.post('/deactivate', requireApiKey, requireScope('activate'), (req, res, next) => {
  const body = req.body || {};
  const licenseKey = String(body.licenseKey || '');
  const machineId = normalizeMachine(body.machineId);
  if (!licenseKey || !machineId) return next(bad('مفتاح الترخيص ومعرّف الجهاز مطلوبان'));
  const lic = findLicenseByKey(licenseKey);
  if (!lic) return next(notFound('مفتاح الترخيص غير صحيح', 'invalid_license_key'));
  const activation = activationExists(lic.id, machineId);
  if (!activation) return next(notFound('لا يوجد تفعيل لهذا الجهاز', 'not_activated'));
  getDb().prepare("UPDATE activations SET status='deactivated', deactivated_at=? WHERE id=?").run(nowIso(), activation.id);
  audit({ actor: 'activation-api', action: 'activation.deactivate', entity: 'license', entityId: lic.id, ip: clientIp(req), detail: { machineId, source: 'api' } });
  res.json({ ok: true, data: { deactivated: true } });
});

publicRouter.post('/offline-request', requireApiKey, requireScope('activate'), (req, res, next) => {
  const body = req.body || {};
  requireFields(body, ['licenseKey', 'machineId']);
  const lic = findLicenseByKey(String(body.licenseKey));
  if (!lic) return next(notFound('مفتاح الترخيص غير صحيح', 'invalid_license_key'));
  const status = effectiveStatus(lic);
  if (status !== 'active') return next(bad('الترخيص غير نشط', 'license_' + status));
  const machineId = normalizeMachine(body.machineId);
  const db = getDb();
  const existing = db.prepare(
    "SELECT * FROM activation_requests WHERE license_id=? AND machine_id=? AND status='pending'"
  ).get(lic.id, machineId);
  if (existing) {
    return res.json({ ok: true, data: { requestCode: existing.uid, status: 'pending', createdAt: existing.created_at } });
  }
  const requestUid = uid('REQ');
  db.prepare(
    `INSERT INTO activation_requests(uid, license_id, product_id, license_key_hash, machine_id, machine_name, os, app_version, message, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?, 'pending', ?)`
  ).run(
    requestUid, lic.id, lic.product_id, lic.key_hash, machineId,
    str(body.machineName, 120), str(body.os, 100), str(body.appVersion, 40), str(body.message, 500), nowIso()
  );
  audit({ actor: 'activation-api', action: 'request.create', entity: 'request', entityId: requestUid, ip: clientIp(req), detail: { license: lic.uid, machineId, source: 'api' } });
  res.status(201).json({ ok: true, data: { requestCode: requestUid, status: 'pending', createdAt: nowIso() } });
});

publicRouter.get('/offline-request/:code', requireApiKey, requireScope('activate'), (req, res, next) => {
  const row = getDb().prepare(
    `SELECT r.*, l.uid AS license_uid, l.key_hint, l.plan, l.status AS license_status, l.expires_at, l.max_seats, l.features,
      l.starts_at, p.name AS product_name, p.code AS product_code, c.name AS customer_name, c.email AS customer_email
     FROM activation_requests r JOIN products p ON p.id = r.product_id
     LEFT JOIN licenses l ON l.id = r.license_id LEFT JOIN customers c ON c.id = l.customer_id
     WHERE r.uid = ?`
  ).get(req.params.code);
  if (!row) return next(notFound('طلب التفعيل غير موجود', 'request_not_found'));

  let document = null;
  if (row.status === 'approved') {
    if (row.issued_token) document = json(row.issued_token, null);
    else if (row.license_status) {
      document = buildOfflineLicense(row, { machineId: row.machine_id, machineName: row.machine_name });
    }
  }
  res.json({
    ok: true,
    data: {
      requestCode: row.uid,
      status: row.status,
      machineId: row.machine_id,
      createdAt: row.created_at,
      approvedAt: row.approved_at,
      rejectedReason: row.rejected_reason,
      document,
      serverTime: nowIso(),
    },
  });
});
