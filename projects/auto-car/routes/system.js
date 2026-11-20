'use strict';
/* ============================================================
   Auto Car — مسارات النظام: الصحة، التهيئة، الإعدادات،
   العملات وسعر الصرف، المستخدمون والصلاحيات، والقوائم المرجعية.
   ============================================================ */
const db = require('../lib/db');
const fs = require('node:fs');
const path = require('node:path');

module.exports = function systemRoutes(app) {
  const { add, fail, str, int, bool, get, all, run, store, ctxAudit } = app;

  add('GET', '/api/health', null, () => ({ status: 'ok', app: 'Auto Car', version: app.APP_VERSION, time: db.now() }));

  /* ---------- الهوية العامة (متاح قبل تسجيل الدخول) ---------- */
  add('GET', '/api/branding', null, () => {
    const s = store.settingsAll();
    return {
      company_name: s.company_name || '',
      company_name_en: s.company_name_en || '',
      logo: s.logo || '',
      login_car: s.login_car || '',
    };
  });

  add('GET', '/api/bootstrap', null, (ctx) => {
    const settings = store.settingsAll();
    return {
      user: ctx.user, csrf: ctx.session.csrf, settings,
      currencies: all('SELECT * FROM currencies WHERE active = 1 ORDER BY is_base DESC, code'),
      counts: {
        vehicles_available: get("SELECT COUNT(*) AS c FROM vehicles WHERE status='available' AND deleted_at IS NULL").c,
        customers: get('SELECT COUNT(*) AS c FROM customers WHERE deleted_at IS NULL').c,
        suppliers: get('SELECT COUNT(*) AS c FROM suppliers WHERE deleted_at IS NULL').c,
        users: get('SELECT COUNT(*) AS c FROM users WHERE deleted_at IS NULL').c,
      },
      alerts: computeAlerts(),
      version: app.APP_VERSION,
    };
  });

  add('GET', '/api/settings', null, () => ({ settings: store.settingsAll() }));

  const SETTING_KEYS = new Set([
    'company_name', 'company_name_en', 'currency', 'currency_symbol', 'tax_rate', 'logo', 'login_car',
    'phone', 'phone2', 'email', 'address', 'website', 'invoice_footer', 'language', 'theme',
    'fiscal_year_start', 'auto_backup_enabled', 'auto_backup_interval_hours', 'backup_retention_days',
    'backup_dir', 'installment_reminder_days', 'doc_expiry_reminder_days', 'default_commission_percent',
  ]);

  add('PUT', '/api/settings', 'settings.manage', (ctx) => {
    const body = ctx.body || {};
    for (const [k, v] of Object.entries(body)) {
      if (!SETTING_KEYS.has(k)) continue;
      store.settingSet(k, v);
    }
    db.audit({ ...ctxAudit(ctx), action: 'update', entity: 'settings', details: body });
    return { message: 'تم حفظ الإعدادات', settings: store.settingsAll() };
  });

  /* ---------- صور الهوية (شعار المعرض + صورة السيارة) ---------- */
  const IMAGE_KINDS = { logo: 'logo', car: 'login_car', login_car: 'login_car', login_logo: 'logo' };
  const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];

  add('POST', '/api/settings/image', 'settings.manage', async (ctx) => {
    const key = IMAGE_KINDS[str(ctx.req.headers['x-kind'], 30)];
    if (!key) fail('نوع الصورة غير معروف');
    const ext = (path.extname(String(ctx.req.headers['x-filename'] || '') ) || '.png').toLowerCase();
    if (!IMAGE_EXT.includes(ext)) fail('صيغة الصورة غير مدعومة (JPG / PNG / WEBP / GIF / SVG)');
    const buf = await app.readBody(ctx.req, 12 * 1024 * 1024);
    if (!buf.length) fail('الملف فارغ');
    const name = `${key}-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(app.UPLOAD_DIR, name), buf);
    const prev = store.settingsAll()[key] || '';
    store.settingSet(key, `/uploads/${name}`);
    if (prev && prev.startsWith('/uploads/')) { try { fs.unlinkSync(path.join(app.UPLOAD_DIR, path.basename(prev))); } catch {} }
    db.audit({ ...ctxAudit(ctx), action: 'update', entity: 'settings', entity_id: 0, details: { [key]: name } });
    return { key, url: `/uploads/${name}`, settings: store.settingsAll(), message: 'تم رفع الصورة' };
  }, true);

  add('DELETE', '/api/settings/image', 'settings.manage', (ctx) => {
    const key = IMAGE_KINDS[str(ctx.url.searchParams.get('kind'), 30)];
    if (!key) fail('نوع الصورة غير معروف');
    const prev = store.settingsAll()[key] || '';
    store.settingSet(key, '');
    if (prev && prev.startsWith('/uploads/')) { try { fs.unlinkSync(path.join(app.UPLOAD_DIR, path.basename(prev))); } catch {} }
    db.audit({ ...ctxAudit(ctx), action: 'update', entity: 'settings', entity_id: 0, details: { [key]: '' } });
    return { settings: store.settingsAll(), message: 'تم حذف الصورة' };
  });

  /* ---------- العملات ---------- */
  add('GET', '/api/currencies', null, () => ({ items: all('SELECT * FROM currencies ORDER BY is_base DESC, code') }));
  add('POST', '/api/currencies', 'settings.manage', (ctx) => {
    const code = str(ctx.body.code, 8).toUpperCase();
    if (!code) fail('رمز العملة مطلوب');
    if (get('SELECT 1 FROM currencies WHERE code = ?', code)) fail('رمز العملة مستخدم بالفعل');
    const id = db.insert('currencies', {
      code, name: str(ctx.body.name, 60) || code, name_en: str(ctx.body.name_en, 60),
      symbol: str(ctx.body.symbol, 10), rate: app.num(ctx.body.rate, 1) || 1,
      is_base: 0, decimals: int(ctx.body.decimals, 2), active: 1, created_at: db.now(),
    });
    db.audit({ ...ctxAudit(ctx), action: 'create', entity: 'currencies', entity_id: id });
    return { id, message: 'تمت إضافة العملة' };
  });
  add('PUT', '/api/currencies/:id', 'settings.manage', (ctx) => {
    const id = int(ctx.params.id);
    const cur = get('SELECT * FROM currencies WHERE id = ?', id);
    if (!cur) fail('العملة غير موجودة', 404);
    const data = {
      name: str(ctx.body.name, 60) || cur.name, name_en: str(ctx.body.name_en, 60),
      symbol: str(ctx.body.symbol, 10), decimals: int(ctx.body.decimals, cur.decimals),
      active: ctx.body.active === undefined ? cur.active : bool(ctx.body.active),
    };
    if (!cur.is_base && ctx.body.rate !== undefined) {
      data.rate = app.num(ctx.body.rate, cur.rate) || cur.rate;
      db.insert('exchange_rates', { currency_id: id, rate: data.rate, date: db.todayStr(), note: 'تحديث سعر الصرف', user_id: ctx.user.id, created_at: db.now() });
    }
    db.update('currencies', id, data);
    db.audit({ ...ctxAudit(ctx), action: 'update', entity: 'currencies', entity_id: id });
    return { message: 'تم تحديث العملة' };
  });
  add('DELETE', '/api/currencies/:id', 'settings.manage', (ctx) => {
    const cur = get('SELECT * FROM currencies WHERE id = ?', int(ctx.params.id));
    if (!cur) fail('العملة غير موجودة', 404);
    if (cur.is_base) fail('لا يمكن حذف العملة الأساسية');
    run('DELETE FROM currencies WHERE id = ?', cur.id);
    db.audit({ ...ctxAudit(ctx), action: 'delete', entity: 'currencies', entity_id: cur.id });
    return { message: 'تم حذف العملة' };
  });
  add('GET', '/api/currencies/rates', null, () => ({ items: all('SELECT r.*, c.code FROM exchange_rates r JOIN currencies c ON c.id = r.currency_id ORDER BY r.date DESC, r.id DESC LIMIT 200') }));

  /* ---------- المستخدمون ---------- */
  const ROLES = ['admin', 'manager', 'accountant', 'sales', 'viewer'];
  function normalizeUser(row) {
    let permissions = [];
    try { permissions = JSON.parse(row.permissions || '[]'); } catch {}
    return { ...row, permissions, password_hash: undefined };
  }
  add('GET', '/api/users', 'users.manage', (ctx) => {
    const q = str(ctx.url.searchParams.get('q'), 60);
    const deleted = ctx.url.searchParams.get('deleted') === '1';
    let sql = `SELECT * FROM users WHERE ${deleted ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL'}`;
    const params = [];
    if (q) { sql += ' AND (name LIKE ? OR username LIKE ? OR phone LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    sql += ' ORDER BY id DESC';
    return { items: all(sql, ...params).map(normalizeUser) };
  });
  add('POST', '/api/users', 'users.manage', (ctx) => {
    const username = str(ctx.body.username, 40).toLowerCase();
    const name = str(ctx.body.name, 80);
    const password = String(ctx.body.password || '');
    if (!name || !username) fail('الاسم واسم المستخدم مطلوبان');
    if (password.length < 6) fail('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    if (get('SELECT 1 FROM users WHERE lower(username) = ?', username)) fail('اسم المستخدم مستخدم بالفعل');
    const role = ROLES.includes(ctx.body.role) ? ctx.body.role : 'sales';
    const id = db.insert('users', {
      name, username, password_hash: store.hashPassword(password), role,
      permissions: JSON.stringify(Array.isArray(ctx.body.permissions) ? ctx.body.permissions : []),
      phone: str(ctx.body.phone, 30), email: str(ctx.body.email, 80),
      active: ctx.body.active === undefined ? 1 : bool(ctx.body.active), created_at: db.now(),
    });
    db.audit({ ...ctxAudit(ctx), action: 'create', entity: 'users', entity_id: id, details: { name, username, role } });
    return { id, message: 'تم إنشاء المستخدم' };
  });
  add('PUT', '/api/users/:id', 'users.manage', (ctx) => {
    const id = int(ctx.params.id);
    const u = get('SELECT * FROM users WHERE id = ?', id);
    if (!u) fail('المستخدم غير موجود', 404);
    const data = {
      name: str(ctx.body.name, 80) || u.name,
      role: ROLES.includes(ctx.body.role) ? ctx.body.role : u.role,
      phone: str(ctx.body.phone, 30), email: str(ctx.body.email, 80),
      active: ctx.body.active === undefined ? u.active : bool(ctx.body.active),
      updated_at: db.now(),
    };
    if (ctx.body.permissions !== undefined) data.permissions = JSON.stringify(Array.isArray(ctx.body.permissions) ? ctx.body.permissions : []);
    if (String(u.username || '').toLowerCase() === 'admin') {
      if (data.active === 0) fail('لا يمكن إيقاف حساب مدير النظام الرئيسي');
      if (data.role !== 'admin') fail('لا يمكن تغيير دور مدير النظام الرئيسي');
    }
    if (ctx.body.password) { if (String(ctx.body.password).length < 6) fail('كلمة المرور قصيرة'); data.password_hash = store.hashPassword(ctx.body.password); }
    db.update('users', id, data);
    db.audit({ ...ctxAudit(ctx), action: 'update', entity: 'users', entity_id: id });
    return { message: 'تم تحديث المستخدم' };
  });
  add('DELETE', '/api/users/:id', 'users.manage', (ctx) => {
    const id = int(ctx.params.id);
    if (id === ctx.user.id) fail('لا يمكنك حذف حسابك الحالي');
    const target = get('SELECT * FROM users WHERE id = ?', id);
    if (!target) fail('المستخدم غير موجود', 404);
    if (String(target.username || '').toLowerCase() === 'admin') fail('لا يمكن حذف حساب مدير النظام الرئيسي');
    db.softDelete('users', id, ctxAudit(ctx));
    run('DELETE FROM sessions WHERE user_id = ?', id);
    return { message: 'تم حذف المستخدم' };
  });
  add('POST', '/api/users/:id/restore', 'users.manage', (ctx) => {
    db.restore('users', int(ctx.params.id), ctxAudit(ctx));
    return { message: 'تم استرجاع المستخدم' };
  });

  /* ---------- القوائم المرجعية الموحّدة (للقوائم المنسدلة) ---------- */
  add('GET', '/api/meta', null, () => ({
    brands: all('SELECT id, name, name_en FROM brands WHERE deleted_at IS NULL AND active = 1 ORDER BY name'),
    car_types: all('SELECT id, name, name_en FROM car_types WHERE deleted_at IS NULL AND active = 1 ORDER BY name'),
    colors: all('SELECT id, name, name_en, hex FROM colors WHERE deleted_at IS NULL AND active = 1 ORDER BY name'),
    models: all('SELECT id, brand_id, name, name_en FROM car_models WHERE deleted_at IS NULL AND active = 1 ORDER BY name'),
    treasuries: all('SELECT id, name, name_en, kind, balance, currency_id FROM treasuries WHERE deleted_at IS NULL AND active = 1 ORDER BY kind, name'),
    accounts: all("SELECT id, code, name, name_en, type, is_group FROM accounts WHERE deleted_at IS NULL AND active = 1 AND is_group = 0 ORDER BY code"),
    customers: all('SELECT id, name, phone, balance FROM customers WHERE deleted_at IS NULL AND active = 1 ORDER BY name'),
    suppliers: all('SELECT id, name, phone, balance FROM suppliers WHERE deleted_at IS NULL AND active = 1 ORDER BY name'),
    fiscal_years: all('SELECT * FROM fiscal_years ORDER BY id DESC'),
    users: all('SELECT id, name FROM users WHERE deleted_at IS NULL AND active = 1 ORDER BY name'),
  }));
};

function computeAlerts() {
  const today = db.todayStr();
  const soon = db.addDays(today, 7);
  const overdue = db.get(`SELECT COUNT(*) AS c FROM installments WHERE status IN ('pending','partial','overdue') AND due_date < ?`, today).c;
  const dueSoon = db.get(`SELECT COUNT(*) AS c FROM installments WHERE status IN ('pending','partial') AND due_date >= ? AND due_date <= ?`, today, soon).c;
  const docDays = 30;
  const docLimit = db.addDays(today, docDays);
  const docs = db.get(`SELECT COUNT(*) AS c FROM vehicles WHERE deleted_at IS NULL AND status <> 'sold' AND (
      (license_expiry IS NOT NULL AND license_expiry <= ?) OR (insurance_expiry IS NOT NULL AND insurance_expiry <= ?))`, docLimit, docLimit).c;
  return { installments_overdue: overdue, installments_due_soon: dueSoon, documents_expiring: docs };
}
