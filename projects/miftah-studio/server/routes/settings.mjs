import { Router } from 'express';
import fs from 'node:fs';
import { getDb, getSettings, setSettings, audit } from '../db.mjs';
import { requireAuth, requirePermission } from '../auth.mjs';
import { bad, requireFields, str, nowIso } from '../util.mjs';
import { generateApiKey, hashApiKey, publicKeyPem } from '../crypto.mjs';
import { config, pkg, dbFile } from '../config.mjs';
import { PERMISSIONS } from '../permissions.mjs';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

const EDITABLE = new Set([
  'studio.name', 'studio.tagline', 'studio.supportEmail', 'studio.currency',
  'license.defaultDays', 'license.defaultSeats', 'license.offlineTokenDays', 'license.graceDays',
  'backup.dir', 'backup.autoHours', 'backup.keep',
  'security.sessionHours', 'security.maxLoginAttempts',
  'appearance.defaultTheme', 'appearance.defaultDensity',
]);

settingsRouter.get('/', requirePermission('settings.view'), (req, res) => {
  const db = getDb();
  const count = (t) => db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
  let dbSize = 0;
  try { dbSize = fs.statSync(dbFile).size; } catch { /* ignore */ }
  const settings = getSettings();
  res.json({
    ok: true,
    data: {
      settings,
      system: {
        appName: 'Miftah Studio',
        version: pkg.version,
        node: process.version,
        platform: `${process.platform} ${process.arch}`,
        port: config.port,
        host: config.host,
        dataDir: config.dataDir,
        keysDir: config.keysDir,
        backupsDir: settings['backup.dir'] || config.backupsDir,
        dbFile,
        dbSize,
        uptime: Math.round(process.uptime()),
        counts: {
          licenses: count('licenses'), activations: count('activations'), products: count('products'),
          customers: count('customers'), users: count('users'), requests: count('activation_requests'),
        },
        publicKey: publicKeyPem(),
      },
    },
  });
});

settingsRouter.put('/', requirePermission('settings.manage'), (req, res, next) => {
  const body = req.body || {};
  const values = {};
  for (const [key, value] of Object.entries(body)) {
    if (!EDITABLE.has(key)) continue;
    if (key === 'backup.dir') {
      const dir = String(value || '').trim();
      if (!dir) return next(bad('مسار النسخ الاحتياطي مطلوب'));
      try { fs.mkdirSync(dir, { recursive: true }); } catch { return next(bad('تعذر إنشاء مجلد النسخ الاحتياطي')); }
      values[key] = dir;
    } else if (['license.defaultDays', 'license.defaultSeats', 'license.offlineTokenDays', 'license.graceDays', 'backup.autoHours', 'backup.keep', 'security.sessionHours', 'security.maxLoginAttempts'].includes(key)) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return next(bad(`قيمة غير صالحة للحقل ${key}`));
      values[key] = String(Math.round(n));
    } else {
      values[key] = str(value, 300) ?? '';
    }
  }
  setSettings(values);
  audit({ actor: req.user.name, userId: req.user.id, action: 'settings.update', entity: 'settings', ip: req.ipAddress, detail: { keys: Object.keys(values) } });
  res.json({ ok: true, data: { settings: getSettings() } });
});

settingsRouter.get('/public-key', requirePermission('settings.view'), (req, res) => {
  res.json({ ok: true, data: { publicKey: publicKeyPem() } });
});

settingsRouter.get('/permissions', requirePermission('settings.view', 'users.view', 'roles.view'), (req, res) => {
  res.json({ ok: true, data: { permissions: PERMISSIONS } });
});

settingsRouter.get('/api-keys', requirePermission('api.manage'), (req, res) => {
  const rows = getDb().prepare('SELECT id, name, prefix, scopes, last_used_at, revoked_at, created_at FROM api_keys ORDER BY created_at DESC').all();
  res.json({ ok: true, data: { items: rows.map((r) => ({ ...r, scopes: JSON.parse(r.scopes) })) } });
});

settingsRouter.post('/api-keys', requirePermission('api.manage'), (req, res, next) => {
  requireFields(req.body || {}, ['name']);
  const raw = generateApiKey();
  const prefix = raw.slice(0, 18) + '…';
  const scopes = Array.isArray(req.body.scopes) ? req.body.scopes.filter((s) => ['activate', 'validate'].includes(s)) : ['activate', 'validate'];
  const info = getDb().prepare(
    'INSERT INTO api_keys(name, prefix, key_hash, scopes, created_at) VALUES (?,?,?,?,?)'
  ).run(str(req.body.name, 100), prefix, hashApiKey(raw), JSON.stringify(scopes), nowIso());
  audit({ actor: req.user.name, userId: req.user.id, action: 'apikey.create', entity: 'api_key', entityId: info.lastInsertRowid, ip: req.ipAddress, detail: { name: req.body.name } });
  res.status(201).json({ ok: true, data: { key: raw, id: Number(info.lastInsertRowid) } });
});

settingsRouter.delete('/api-keys/:id', requirePermission('api.manage'), (req, res, next) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM api_keys WHERE id=?').get(req.params.id);
  if (!row) return next(bad('المفتاح غير موجود'));
  db.prepare('UPDATE api_keys SET revoked_at=? WHERE id=?').run(nowIso(), row.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'apikey.revoke', entity: 'api_key', entityId: row.id, ip: req.ipAddress, detail: { name: row.name } });
  res.json({ ok: true });
});
