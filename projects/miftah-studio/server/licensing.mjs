import { getDb, getSettings, audit, json } from './db.mjs';
import { signDocument, hashKey } from './crypto.mjs';
import { nowIso, addDays, effectiveStatus } from './util.mjs';

export function buildOfflineLicense(licenseRow, { machineId = null, machineName = null } = {}) {
  const settings = getSettings();
  const payload = {
    doc: 'miftah-license',
    version: 1,
    licenseUid: licenseRow.uid,
    keyHint: licenseRow.key_hint,
    product: { code: licenseRow.product_code, name: licenseRow.product_name },
    customer: { name: licenseRow.customer_name || '—', email: licenseRow.customer_email || null },
    plan: licenseRow.plan,
    issuedAt: nowIso(),
    startsAt: licenseRow.starts_at,
    expiresAt: licenseRow.expires_at,
    offlineUntil: licenseRow.expires_at || addDays(3650),
    maxSeats: licenseRow.max_seats,
    machineId: machineId || null,
    machineName: machineName || null,
    features: json(licenseRow.features, []),
    graceDays: Number(settings['license.graceDays'] || 7),
    vendor: settings['studio.name'] || 'Miftah Studio',
    supportEmail: settings['studio.supportEmail'],
  };
  return signDocument(payload);
}

export function findLicenseByKey(key) {
  const db = getDb();
  return db.prepare(
    `SELECT l.*, p.name AS product_name, p.code AS product_code, p.color AS product_color,
      c.name AS customer_name, c.email AS customer_email
     FROM licenses l JOIN products p ON p.id = l.product_id LEFT JOIN customers c ON c.id = l.customer_id
     WHERE l.key_hash = ?`
  ).get(hashKey(key));
}

export function licenseSummary(row) {
  return {
    uid: row.uid,
    product: { code: row.product_code, name: row.product_name },
    customer: row.customer_name,
    plan: row.plan,
    status: effectiveStatus(row),
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    maxSeats: row.max_seats,
    features: json(row.features, []),
  };
}

export function activationExists(licenseId, machineId) {
  return getDb().prepare('SELECT * FROM activations WHERE license_id=? AND machine_id=?').get(licenseId, machineId);
}

export function activeSeatCount(licenseId) {
  return getDb().prepare("SELECT COUNT(*) AS c FROM activations WHERE license_id=? AND status='active'").get(licenseId).c;
}

export function touchActivation(licenseId, machineId, patch = {}) {
  const db = getDb();
  const at = nowIso();
  const existing = activationExists(licenseId, machineId);
  if (existing) {
    db.prepare(
      `UPDATE activations SET status='active', last_seen_at=?, machine_name=COALESCE(?, machine_name),
       os=COALESCE(?, os), app_version=COALESCE(?, app_version) WHERE id=?`
    ).run(at, patch.machineName || null, patch.os || null, patch.appVersion || null, existing.id);
    db.prepare('UPDATE licenses SET last_seen_at=? WHERE id=?').run(at, licenseId);
    return { activation: db.prepare('SELECT * FROM activations WHERE id=?').get(existing.id), created: false };
  }
  const info = db.prepare(
    `INSERT INTO activations(license_id, machine_id, machine_name, os, app_version, ip, mode, status, activated_at, last_seen_at)
     VALUES (?,?,?,?,?,?,?, 'active', ?, ?)`
  ).run(licenseId, machineId, patch.machineName || null, patch.os || null, patch.appVersion || null, patch.ip || null, patch.mode || 'online', at, at);
  db.prepare('UPDATE licenses SET last_seen_at=? WHERE id=?').run(at, licenseId);
  return { activation: db.prepare('SELECT * FROM activations WHERE id=?').get(info.lastInsertRowid), created: true };
}

export function logPublic(action, detail, ip, actor = 'activation-api') {
  audit({ actor, action, entity: 'license', ip, detail });
}

export function findLicenseByUid(licenseUid) {
  return getDb().prepare(
    `SELECT l.*, p.name AS product_name, p.code AS product_code, p.color AS product_color,
      c.name AS customer_name, c.email AS customer_email
     FROM licenses l JOIN products p ON p.id = l.product_id LEFT JOIN customers c ON c.id = l.customer_id
     WHERE l.uid = ?`
  ).get(licenseUid);
}

export function buildActivationToken(licenseRow, activation) {
  const settings = getSettings();
  const payload = {
    doc: 'miftah-activation',
    version: 1,
    licenseUid: licenseRow.uid,
    keyHint: licenseRow.key_hint,
    product: { code: licenseRow.product_code, name: licenseRow.product_name },
    customer: { name: licenseRow.customer_name || '—', email: licenseRow.customer_email || null },
    plan: licenseRow.plan,
    issuedAt: nowIso(),
    startsAt: licenseRow.starts_at,
    expiresAt: licenseRow.expires_at,
    validUntil: licenseRow.expires_at
      ? new Date(Math.min(new Date(licenseRow.expires_at).getTime(), Date.now() + 7 * 86400000)).toISOString()
      : addDays(7),
    maxSeats: licenseRow.max_seats,
    machineId: activation.machine_id,
    machineName: activation.machine_name,
    features: json(licenseRow.features, []),
    vendor: settings['studio.name'] || 'Miftah Studio',
    supportEmail: settings['studio.supportEmail'],
  };
  return signDocument(payload);
}

export function activationSummary(activation) {
  return {
    id: activation.id,
    machineId: activation.machine_id,
    machineName: activation.machine_name,
    os: activation.os,
    mode: activation.mode,
    status: activation.status,
    activatedAt: activation.activated_at,
    lastSeenAt: activation.last_seen_at,
  };
}

