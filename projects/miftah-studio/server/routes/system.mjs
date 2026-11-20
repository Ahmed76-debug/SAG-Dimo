import { Router } from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { requireAuth, requirePermission } from '../auth.mjs';
import { bad, clientIp } from '../util.mjs';
import { config } from '../config.mjs';

export const systemRouter = Router();
systemRouter.use(requireAuth);

function isLocal(req) {
  const ip = clientIp(req);
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === '';
}

function listDrives() {
  const drives = [];
  for (let i = 65; i <= 90; i++) {
    const root = `${String.fromCharCode(i)}:\\`;
    try { if (fs.existsSync(root)) drives.push(root); } catch { /* ignore */ }
  }
  return drives;
}

systemRouter.get('/browse', requirePermission('backups.view', 'settings.view'), (req, res, next) => {
  const raw = String(req.query.path || '').trim();
  if (!raw) {
    return res.json({
      ok: true,
      data: {
        path: '', parent: null, drives: listDrives(), home: os.homedir(), dataDir: config.dataDir,
        backupsDir: config.backupsDir, dirs: [], files: [],
      },
    });
  }
  const abs = path.resolve(raw);
  if (!fs.existsSync(abs)) return next(bad('المسار غير موجود', 'not_found'));
  let stat;
  try { stat = fs.statSync(abs); } catch { return next(bad('تعذر قراءة المسار')); }
  if (!stat.isDirectory()) return next(bad('المسار ليس مجلداً'));
  let entries = [];
  try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return next(bad('لا تملك صلاحية قراءة هذا المجلد')); }
  const dirs = [];
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('$') || entry.name === 'System Volume Information') continue;
    const full = path.join(abs, entry.name);
    try {
      if (entry.isDirectory()) dirs.push({ name: entry.name, path: full });
      else if (entry.name.endsWith('.mftbak')) {
        files.push({ name: entry.name, path: full, size: fs.statSync(full).size, modifiedAt: fs.statSync(full).mtime.toISOString() });
      }
    } catch { /* skip locked */ }
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const parent = path.dirname(abs) === abs ? null : path.dirname(abs);
  res.json({ ok: true, data: { path: abs, parent, drives: listDrives(), dirs, files } });
});

systemRouter.post('/mkdir', requirePermission('backups.manage'), (req, res, next) => {
  const raw = String(req.body?.path || '').trim();
  if (!raw) return next(bad('المسار مطلوب'));
  const abs = path.resolve(raw);
  try { fs.mkdirSync(abs, { recursive: true }); }
  catch { return next(bad('تعذر إنشاء المجلد')); }
  res.json({ ok: true, data: { path: abs } });
});

systemRouter.post('/pick-folder', requirePermission('backups.manage'), (req, res, next) => {
  if (process.platform !== 'win32') return next(bad('منتقي المجلدات الأصلي متاح على Windows فقط'));
  if (!isLocal(req)) return next(bad('منتقي المجلدات متاح على الجهاز المحلي فقط. استخدم متصفح المجلدات.'));
  const initial = req.body?.initial ? String(req.body.initial).replace(/'/g, "''") : '';
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms;',
    '$d = New-Object System.Windows.Forms.FolderBrowserDialog;',
    '$d.Description = "اختر مجلداً للنسخ الاحتياطي";',
    '$d.ShowNewFolderButton = $true;',
    initial ? `$d.SelectedPath = '${initial}';` : '',
    'if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.SelectedPath }',
  ].join(' ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { encoding: 'utf8', timeout: 180000 });
  const selected = (result.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || null;
  res.json({ ok: true, data: { path: selected } });
});

systemRouter.post('/reveal', requirePermission('backups.manage'), (req, res, next) => {
  if (process.platform !== 'win32') return next(bad('هذه الميزة متاحة على Windows فقط'));
  if (!isLocal(req)) return next(bad('فتح المجلد متاح على الجهاز المحلي فقط'));
  const target = path.resolve(String(req.body?.path || ''));
  if (!fs.existsSync(target)) return next(bad('المسار غير موجود'));
  spawnSync('explorer.exe', [target], { timeout: 5000 });
  res.json({ ok: true });
});
