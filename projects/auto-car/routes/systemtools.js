'use strict';
/* ============================================================
   Auto Car — أدوات النظام: النسخ الاحتياطي والاستعادة، سلة المحذوفات،
   سجل النشاط، تفريغ الجداول، وإحصاءات قاعدة البيانات.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const db = require('../lib/db');

module.exports = function systemToolsRoutes(app) {
  const { add, fail, str, int, bool, get, all, run, ctxAudit, store, sendJson } = app;

  const TABLE_LABELS = {
    vehicles: 'السيارات', vehicle_expenses: 'مصروفات السيارات', purchases: 'المشتريات', purchase_items: 'بنود المشتريات',
    sales: 'المبيعات', sale_items: 'بنود المبيعات', installment_plans: 'خطط التقسيط', installments: 'الأقساط',
    installment_payments: 'دفعات الأقساط', consignment_settlements: 'تسويات العمولة', journal_entries: 'قيود اليومية',
    journal_lines: 'سطور القيود', vouchers: 'السندات', notifications: 'التنبيهات', activity: 'سجل النشاط',
    import_logs: 'سجل الاستيراد', customers: 'العملاء', suppliers: 'الموردون', brands: 'الماركات',
    car_models: 'الطرازات', car_types: 'الفئات', colors: 'الألوان',
  };

  function backupDir() {
    const s = store.settingsAll();
    const dir = s.backup_dir && fs.existsSync(s.backup_dir) ? s.backup_dir : store.BACKUP_DIR;
    return dir;
  }

  /* ---------- النسخ الاحتياطي ---------- */
  add('GET', '/api/backup', null, () => ({
    dir: backupDir(),
    default_dir: store.BACKUP_DIR,
    settings: {
      auto_backup_enabled: store.settingGet('auto_backup_enabled', '1'),
      auto_backup_interval_hours: store.settingGet('auto_backup_interval_hours', '24'),
      backup_retention_days: store.settingGet('backup_retention_days', '30'),
      backup_dir: backupDir(),
    },
    items: store.listBackups(backupDir()).slice(0, 100),
  }));

  add('POST', '/api/backup', 'backup.manage', (ctx) => {
    const dir = str(ctx.body.dir, 400) || backupDir();
    try { fs.mkdirSync(dir, { recursive: true }); } catch { fail('تعذر الوصول إلى المجلد المحدد'); }
    const info = store.backupTo(dir, { kind: 'manual', note: str(ctx.body.note, 200), userId: ctx.user.id });
    db.audit({ ...ctxAudit(ctx), action: 'backup', details: info });
    return { ...info, message: 'تم إنشاء النسخة الاحتياطية', items: store.listBackups(dir).slice(0, 100) };
  });

  add('POST', '/api/backup/restore', 'backup.manage', (ctx) => {
    const name = str(ctx.body.filename || ctx.body.name, 260);
    const dir = str(ctx.body.dir, 400) || backupDir();
    if (!name) fail('حدّد النسخة الاحتياطية');
    const file = path.join(dir, path.basename(name));
    if (!fs.existsSync(file)) fail('ملف النسخة غير موجود');
    store.restoreFrom(file, ctxAudit(ctx));
    return { message: 'تمت الاستعادة بنجاح — يرجى إعادة تسجيل الدخول', reauth: true };
  });

  add('POST', '/api/backup/upload', 'backup.manage', async (ctx) => {
    const name = path.basename(String(ctx.req.headers['x-filename'] || `upload-${Date.now()}.db`));
    if (!/\.(db|sqlite|sqlite3|backup)$/i.test(name)) fail('صيغة الملف غير مدعومة');
    const buf = await app.readBody(ctx.req, 200 * 1024 * 1024);
    if (!buf.length) fail('الملف فارغ');
    const target = path.join(backupDir(), name);
    fs.writeFileSync(target, buf);
    const doRestore = ctx.url.searchParams.get('restore') === '1';
    if (doRestore) { store.restoreFrom(target, ctxAudit(ctx)); return { message: 'تم الرفع والاستعادة', reauth: true }; }
    db.audit({ ...ctxAudit(ctx), action: 'backup', details: { uploaded: name } });
    return { message: 'تم رفع النسخة الاحتياطية', items: store.listBackups(backupDir()).slice(0, 100) };
  }, true);

  add('GET', '/api/backup/download/:name', 'backup.manage', (ctx) => {
    const dir = str(ctx.url.searchParams.get('dir'), 400) || backupDir();
    const file = path.join(dir, path.basename(ctx.params.name));
    if (!fs.existsSync(file)) fail('الملف غير موجود', 404);
    const stat = fs.statSync(file);
    ctx.res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${path.basename(file)}"`,
      'Content-Length': stat.size,
    });
    fs.createReadStream(file).pipe(ctx.res);
    return null;
  });

  add('DELETE', '/api/backup/:name', 'backup.manage', (ctx) => {
    const dir = str(ctx.url.searchParams.get('dir'), 400) || backupDir();
    const file = path.join(dir, path.basename(ctx.params.name));
    try { fs.rmSync(file, { force: true }); } catch {}
    db.audit({ ...ctxAudit(ctx), action: 'delete', entity: 'backups', details: { name: ctx.params.name } });
    return { message: 'تم حذف النسخة', items: store.listBackups(dir).slice(0, 100) };
  });

  add('POST', '/api/backup/prune', 'backup.manage', (ctx) => {
    const dir = str(ctx.body.dir, 400) || backupDir();
    const days = int(ctx.body.days, int(store.settingGet('backup_retention_days', 30), 30));
    const removed = store.pruneBackups(dir, days);
    db.audit({ ...ctxAudit(ctx), action: 'delete', entity: 'backups', details: { pruned: removed, days } });
    return { removed, message: `تم حذف ${removed} نسخة أقدم من ${days} يوم` };
  });

  add('PUT', '/api/backup/settings', 'backup.manage', (ctx) => {
    if (ctx.body.auto_backup_enabled !== undefined) store.settingSet('auto_backup_enabled', bool(ctx.body.auto_backup_enabled) ? '1' : '0');
    if (ctx.body.auto_backup_interval_hours !== undefined) store.settingSet('auto_backup_interval_hours', String(Math.max(1, int(ctx.body.auto_backup_interval_hours, 24))));
    if (ctx.body.backup_retention_days !== undefined) store.settingSet('backup_retention_days', String(Math.max(1, int(ctx.body.backup_retention_days, 30))));
    if (ctx.body.backup_dir !== undefined) store.settingSet('backup_dir', str(ctx.body.backup_dir, 400));
    return { message: 'تم حفظ إعدادات النسخ الاحتياطي' };
  });

  /* ---------- استعراض المجلدات لاختيار مكان النسخ/الاستعادة ---------- */
  add('GET', '/api/backup/browse', 'backup.manage', (ctx) => {
    let target = str(ctx.url.searchParams.get('path'), 400);
    if (!target) {
      if (os.platform() === 'win32') {
        const drives = [];
        for (let i = 67; i <= 90; i++) { const d = String.fromCharCode(i) + ':\\'; try { if (fs.existsSync(d)) drives.push({ name: d, path: d }); } catch {} }
        return { path: '', parent: null, dirs: drives, files: [], is_root: true };
      }
      target = os.homedir();
    }
    let stat;
    try { stat = fs.statSync(target); } catch { fail('المسار غير موجود'); }
    if (!stat.isDirectory()) target = path.dirname(target);
    const dirs = [], files = [];
    let entries = [];
    try { entries = fs.readdirSync(target, { withFileTypes: true }); } catch { fail('تعذر قراءة المجلد'); }
    for (const e of entries) {
      if (e.name.startsWith('$') || e.name === 'System Volume Information') continue;
      try {
        if (e.isDirectory()) dirs.push({ name: e.name, path: path.join(target, e.name) });
        else if (/\.(db|sqlite|sqlite3|backup)$/i.test(e.name)) {
          const st = fs.statSync(path.join(target, e.name));
          files.push({ name: e.name, path: path.join(target, e.name), size: st.size, created_at: db.now(st.mtime) });
        }
      } catch {}
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    const parent = path.dirname(target);
    return { path: target, parent: parent === target ? null : parent, dirs, files, is_root: false };
  });

  /* ---------- سلة المحذوفات ---------- */
  add('GET', '/api/trash', null, () => {
    const tables = db.deletedCounts();
    const groups = [];
    for (const t of tables) {
      const rows = db.listDeleted(t.table, { limit: 100 });
      groups.push({ table: t.table, label: TABLE_LABELS[t.table] || t.table, count: t.count, rows });
    }
    return { groups };
  });

  add('POST', '/api/trash/:table/:id/restore', 'trash.manage', (ctx) => {
    if (!db.SOFT_TABLES.has(ctx.params.table)) fail('جدول غير مدعوم');
    db.restore(ctx.params.table, int(ctx.params.id), ctxAudit(ctx));
    return { message: 'تم الاسترجاع' };
  });

  add('DELETE', '/api/trash/:table/:id', 'trash.manage', (ctx) => {
    if (!db.SOFT_TABLES.has(ctx.params.table)) fail('جدول غير مدعوم');
    db.purge(ctx.params.table, int(ctx.params.id), ctxAudit(ctx));
    return { message: 'تم الحذف نهائيًا' };
  });

  /* ---------- سجل النشاط ---------- */
  add('GET', '/api/activity', 'activity.view', (ctx) => {
    const where = [];
    const params = [];
    const q = str(ctx.url.searchParams.get('q'), 60);
    if (q) { where.push('(user_name LIKE ? OR action LIKE ? OR entity LIKE ? OR details LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
    const action = str(ctx.url.searchParams.get('action'), 20);
    if (action) { where.push('action = ?'); params.push(action); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = get(`SELECT COUNT(*) AS c FROM activity ${whereSql}`, ...params).c;
    const { page, limit, offset } = app.pageParams(ctx.url);
    const items = all(`SELECT * FROM activity ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
    return { items, total, page, limit };
  });

  /* ---------- تفريغ الجداول ---------- */
  add('GET', '/api/truncate/tables', 'truncate.manage', () => {
    const tables = ['vehicles', 'vehicle_expenses', 'purchases', 'purchase_items', 'sales', 'sale_items',
      'installment_plans', 'installments', 'installment_payments', 'consignment_settlements',
      'journal_entries', 'journal_lines', 'vouchers', 'notifications', 'import_logs',
      'customers', 'suppliers', 'brands', 'car_models', 'car_types', 'colors'];
    return { items: tables.map((t) => ({ table: t, label: TABLE_LABELS[t] || t, count: get(`SELECT COUNT(*) AS c FROM ${t}`).c })) };
  });

  add('POST', '/api/truncate', 'truncate.manage', (ctx) => {
    const tables = Array.isArray(ctx.body.tables) ? ctx.body.tables : [];
    if (!tables.length) fail('حدّد جدولًا واحدًا على الأقل');
    const done = db.truncate(tables, ctxAudit(ctx));
    return { message: `تم تفريغ ${done.length} جدول`, tables: done };
  });

  /* ---------- إحصاءات قاعدة البيانات ---------- */
  add('GET', '/api/db/stats', 'backup.manage', () => store.dbStats());
};
