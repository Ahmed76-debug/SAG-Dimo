import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, getSettings, audit } from '../db.mjs';
import { requireAuth, requirePermission } from '../auth.mjs';
import { bad, notFound, requireFields, str } from '../util.mjs';
import { createBackup, restoreBackup, backupFilesIn } from '../backup.mjs';
import { config } from '../config.mjs';

export const backupsRouter = Router();
backupsRouter.use(requireAuth);

backupsRouter.get('/', requirePermission('backups.view'), (req, res) => {
  const settings = getSettings();
  const dir = str(req.query.dir, 400) || settings['backup.dir'] || config.backupsDir;
  const db = getDb();
  const rows = db.prepare('SELECT * FROM backups ORDER BY created_at DESC LIMIT 100').all();
  res.json({
    ok: true,
    data: {
      dir,
      defaultDir: settings['backup.dir'] || config.backupsDir,
      autoHours: Number(settings['backup.autoHours'] || 0),
      keep: Number(settings['backup.keep'] || 20),
      history: rows.map((r) => ({
        id: r.id, filename: r.filename, path: r.path, size: r.size, note: r.note, kind: r.kind,
        createdBy: r.created_by, createdAt: r.created_at, exists: fs.existsSync(r.path),
      })),
      files: backupFilesIn(dir),
    },
  });
});

backupsRouter.get('/files', requirePermission('backups.view'), (req, res) => {
  const settings = getSettings();
  const dir = str(req.query.dir, 400) || settings['backup.dir'];
  res.json({ ok: true, data: { dir, files: backupFilesIn(dir) } });
});

backupsRouter.post('/', requirePermission('backups.manage'), (req, res, next) => {
  try {
    const targetDir = str(req.body?.targetDir, 400) || undefined;
    const note = str(req.body?.note, 300) || '';
    if (targetDir && !fs.existsSync(targetDir)) {
      try { fs.mkdirSync(targetDir, { recursive: true }); }
      catch { return next(bad('تعذر إنشاء المجلد المحدد', 'invalid_dir')); }
    }
    const record = createBackup({ targetDir, note, kind: 'manual', actor: req.user.name });
    audit({ actor: req.user.name, userId: req.user.id, action: 'backup.create', entity: 'backup', entityId: record.id, ip: req.ipAddress, detail: { filename: record.filename, size: record.size } });
    res.status(201).json({ ok: true, data: { backup: record, files: backupFilesIn(targetDir || getSettings()['backup.dir']) } });
  } catch (error) {
    next(bad(error.message || 'تعذر إنشاء النسخة الاحتياطية', 'backup_failed'));
  }
});

backupsRouter.post('/restore', requirePermission('backups.manage'), (req, res, next) => {
  requireFields(req.body || {}, ['path']);
  const file = String(req.body.path);
  if (!fs.existsSync(file)) return next(notFound('ملف النسخة غير موجود'));
  try {
    const result = restoreBackup(file, req.user.name);
    res.json({ ok: true, data: result });
  } catch (error) {
    next(bad(error.message || 'تعذر استعادة النسخة الاحتياطية', 'restore_failed'));
  }
});

backupsRouter.post('/restore-upload', requirePermission('backups.manage'), (req, res, next) => {
  const { filename, dataBase64 } = req.body || {};
  if (!dataBase64) return next(bad('الملف مطلوب'));
  const safe = String(filename || 'uploaded.mftbak').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!safe.endsWith('.mftbak')) return next(bad('امتداد الملف يجب أن يكون .mftbak'));
  const dir = getSettings()['backup.dir'] || config.backupsDir;
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `uploaded-${Date.now()}-${safe}`);
  try {
    fs.writeFileSync(target, Buffer.from(String(dataBase64), 'base64'));
    const result = restoreBackup(target, req.user.name);
    res.json({ ok: true, data: { ...result, uploadedFile: target } });
  } catch (error) {
    next(bad(error.message || 'تعذر استعادة الملف', 'restore_failed'));
  }
});

backupsRouter.get('/download', requirePermission('backups.view'), (req, res, next) => {
  const file = str(req.query.path, 500);
  if (!file || !fs.existsSync(file)) return next(notFound('الملف غير موجود'));
  audit({ actor: req.user.name, userId: req.user.id, action: 'backup.download', entity: 'backup', entityId: path.basename(file), ip: req.ipAddress });
  res.download(file);
});

backupsRouter.delete('/:id', requirePermission('backups.manage'), (req, res, next) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM backups WHERE id=?').get(req.params.id);
  if (!row) return next(notFound('السجل غير موجود'));
  try { if (fs.existsSync(row.path)) fs.unlinkSync(row.path); } catch { /* ignore */ }
  db.prepare('DELETE FROM backups WHERE id=?').run(row.id);
  audit({ actor: req.user.name, userId: req.user.id, action: 'backup.delete', entity: 'backup', entityId: row.id, ip: req.ipAddress, detail: { filename: row.filename } });
  res.json({ ok: true });
});
