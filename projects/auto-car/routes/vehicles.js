'use strict';
/* ============================================================
   Auto Car — السيارات (المخزون المتكامل): CRUD + صور + مصروفات
   ============================================================ */
const fs = require('fs');
const path = require('path');
const db = require('../lib/db');
const acc = require('../lib/accounting');

module.exports = function vehicleRoutes(app) {
  const { add, fail, str, int, num, bool, get, all, run, round2, ctxAudit, UPLOAD_DIR } = app;

  const VEHICLE_FIELDS = [
    'vin', 'chassis_no', 'engine_no', 'plate_no', 'brand_id', 'model_id', 'type_id', 'color_id',
    'year', 'condition', 'mileage', 'transmission', 'fuel', 'doors', 'seats', 'cylinders', 'horsepower',
    'origin', 'ownership', 'owner_name', 'owner_phone', 'owner_id', 'commission_type', 'commission_value',
    'min_price', 'cost_price', 'target_price', 'currency_id', 'supplier_id', 'purchase_date', 'entry_date',
    'license_expiry', 'insurance_expiry', 'location', 'notes', 'active',
  ];

  function vehicleFull(id) {
    return get(
      `SELECT v.*, b.name AS brand_name, b.name_en AS brand_name_en,
              m.name AS model_name, m.name_en AS model_name_en,
              ct.name AS type_name, ct.name_en AS type_name_en,
              cl.name AS color_name, cl.name_en AS color_name_en, cl.hex AS color_hex,
              s.name AS supplier_name, cur.code AS currency_code, cur.symbol AS currency_symbol
         FROM vehicles v
         LEFT JOIN brands b ON b.id = v.brand_id
         LEFT JOIN car_models m ON m.id = v.model_id
         LEFT JOIN car_types ct ON ct.id = v.type_id
         LEFT JOIN colors cl ON cl.id = v.color_id
         LEFT JOIN suppliers s ON s.id = v.supplier_id
         LEFT JOIN currencies cur ON cur.id = v.currency_id
        WHERE v.id = ?`, id);
  }

  add('GET', '/api/vehicles', null, (ctx) => {
    const q = str(ctx.url.searchParams.get('q'), 80);
    const where = [ctx.url.searchParams.get('deleted') === '1' ? 'v.deleted_at IS NOT NULL' : 'v.deleted_at IS NULL'];
    const params = [];
    const addFilter = (col, val) => { if (val !== null && val !== undefined && val !== '') { where.push(`${col} = ?`); params.push(val); } };
    addFilter('v.status', ctx.url.searchParams.get('status'));
    addFilter('v.condition', ctx.url.searchParams.get('condition'));
    addFilter('v.ownership', ctx.url.searchParams.get('ownership'));
    addFilter('v.brand_id', ctx.url.searchParams.get('brand_id'));
    addFilter('v.model_id', ctx.url.searchParams.get('model_id'));
    addFilter('v.type_id', ctx.url.searchParams.get('type_id'));
    addFilter('v.year', ctx.url.searchParams.get('year'));
    if (q) { where.push('(v.code LIKE ? OR v.vin LIKE ? OR v.chassis_no LIKE ? OR v.plate_no LIKE ? OR b.name LIKE ? OR m.name LIKE ?)'); for (let i = 0; i < 6; i++) params.push(`%${q}%`); }
    const minP = num(ctx.url.searchParams.get('min_price'), 0);
    const maxP = num(ctx.url.searchParams.get('max_price'), 0);
    if (minP) { where.push('v.target_price >= ?'); params.push(minP); }
    if (maxP) { where.push('v.target_price <= ?'); params.push(maxP); }
    const whereSql = 'WHERE ' + where.join(' AND ');
    const base = `FROM vehicles v LEFT JOIN brands b ON b.id=v.brand_id LEFT JOIN car_models m ON m.id=v.model_id LEFT JOIN colors cl ON cl.id=v.color_id`;
    const total = get(`SELECT COUNT(*) AS c ${base} ${whereSql}`, ...params).c;
    const { page, limit, offset } = app.pageParams(ctx.url, 50);
    const items = all(
      `SELECT v.*, b.name AS brand_name, m.name AS model_name, cl.name AS color_name, cl.hex AS color_hex
       ${base} ${whereSql} ORDER BY v.id DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
    return { items, total, page, limit };
  });

  add('GET', '/api/vehicles/stats', null, () => ({
    by_status: all("SELECT status, COUNT(*) AS c FROM vehicles WHERE deleted_at IS NULL GROUP BY status"),
    by_condition: all("SELECT condition, COUNT(*) AS c FROM vehicles WHERE deleted_at IS NULL AND status='available' GROUP BY condition"),
    by_ownership: all("SELECT ownership, COUNT(*) AS c FROM vehicles WHERE deleted_at IS NULL AND status IN ('available','reserved') GROUP BY ownership"),
    inventory_value: round2(num(get("SELECT COALESCE(SUM(cost_price + extra_cost),0) AS s FROM vehicles WHERE deleted_at IS NULL AND status IN ('available','reserved') AND ownership='own'").s)),
    expected_revenue: round2(num(get("SELECT COALESCE(SUM(target_price),0) AS s FROM vehicles WHERE deleted_at IS NULL AND status IN ('available','reserved')").s)),
  }));

  add('GET', '/api/vehicles/:id', null, (ctx) => {
    const id = int(ctx.params.id);
    const item = vehicleFull(id);
    if (!item) fail('السيارة غير موجودة', 404);
    item.expenses = all('SELECT * FROM vehicle_expenses WHERE vehicle_id = ? AND deleted_at IS NULL ORDER BY id DESC', id);
    item.images = parseImages(item.images);
    return { item };
  });

  add('POST', '/api/vehicles', 'vehicles.manage', (ctx) => {
    const data = {};
    for (const f of VEHICLE_FIELDS) if (ctx.body[f] !== undefined) data[f] = ctx.body[f];
    data.code = str(ctx.body.code, 40) || db.nextNumber('vehicle', 'CAR-');
    if (get('SELECT 1 FROM vehicles WHERE code = ?', data.code)) fail('كود السيارة مستخدم بالفعل');
    data.condition = data.condition === 'new' ? 'new' : 'used';
    data.ownership = data.ownership === 'consignment' ? 'consignment' : 'own';
    data.status = 'available';
    data.entry_date = data.entry_date || db.todayStr();
    data.images = '[]';
    data.extra_cost = 0;
    data.created_by = ctx.user.id;
    data.created_at = db.now();
    const id = db.insert('vehicles', data);
    // قيد افتتاحي اختياري للمخزون عند الإدخال اليدوي لسيارة مملوكة
    if (bool(ctx.body.post_opening) && data.ownership === 'own' && num(data.cost_price, 0) > 0) {
      try {
        acc.postEntry({
          date: data.entry_date, description: `إدخال سيارة للمخزون — ${data.code}`, source: 'opening', source_id: id, reference: data.code,
          user_id: ctx.user.id,
          lines: [{ code: acc.CODES.INVENTORY, debit: round2(data.cost_price) },
                  { code: acc.CODES.CAPITAL, credit: round2(data.cost_price) }],
        });
      } catch (e) { console.warn('vehicle opening entry', e.message); }
    }
    db.audit({ ...ctxAudit(ctx), action: 'create', entity: 'vehicles', entity_id: id, details: { code: data.code } });
    return { id, item: vehicleFull(id), message: 'تمت إضافة السيارة بنجاح' };
  });

  add('PUT', '/api/vehicles/:id', 'vehicles.manage', (ctx) => {
    const id = int(ctx.params.id);
    const existing = get('SELECT * FROM vehicles WHERE id = ?', id);
    if (!existing) fail('السيارة غير موجودة', 404);
    const data = {};
    for (const f of VEHICLE_FIELDS) if (ctx.body[f] !== undefined) data[f] = ctx.body[f];
    data.updated_at = db.now();
    db.update('vehicles', id, data);
    db.audit({ ...ctxAudit(ctx), action: 'update', entity: 'vehicles', entity_id: id });
    return { item: vehicleFull(id), message: 'تم تحديث السيارة' };
  });

  add('DELETE', '/api/vehicles/:id', 'vehicles.manage', (ctx) => {
    db.softDelete('vehicles', int(ctx.params.id), ctxAudit(ctx));
    return { message: 'تم حذف السيارة' };
  });
  add('POST', '/api/vehicles/:id/restore', 'vehicles.manage', (ctx) => {
    db.restore('vehicles', int(ctx.params.id), ctxAudit(ctx));
    return { message: 'تم استرجاع السيارة' };
  });
  add('POST', '/api/vehicles/:id/status', 'vehicles.manage', (ctx) => {
    const id = int(ctx.params.id);
    const status = str(ctx.body.status, 20);
    if (!['available', 'reserved', 'sold', 'returned'].includes(status)) fail('حالة غير صحيحة');
    db.update('vehicles', id, { status, updated_at: db.now() });
    db.audit({ ...ctxAudit(ctx), action: 'update', entity: 'vehicles', entity_id: id, details: { status } });
    return { message: 'تم تحديث الحالة' };
  });

  /* ---------- الصور ---------- */
  function parseImages(v) { try { return JSON.parse(v || '[]'); } catch { return []; } }

  add('POST', '/api/vehicles/:id/images', 'vehicles.manage', async (ctx) => {
    const id = int(ctx.params.id);
    const v = get('SELECT * FROM vehicles WHERE id = ?', id);
    if (!v) fail('السيارة غير موجودة', 404);
    const raw = String(ctx.req.headers['x-filename'] || '');
    const ext = (path.extname(raw) || '.jpg').toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) fail('صيغة الصورة غير مدعومة');
    const buf = await app.readBody(ctx.req, 12 * 1024 * 1024);
    if (!buf.length) fail('الملف فارغ');
    const name = `v${id}-${Date.now()}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    const images = parseImages(v.images);
    images.push(`/uploads/${name}`);
    db.update('vehicles', id, { images: JSON.stringify(images), updated_at: db.now() });
    db.audit({ ...ctxAudit(ctx), action: 'update', entity: 'vehicles', entity_id: id, details: { image: name } });
    return { images, message: 'تم رفع الصورة' };
  }, true);

  add('DELETE', '/api/vehicles/:id/images', 'vehicles.manage', (ctx) => {
    const id = int(ctx.params.id);
    const v = get('SELECT * FROM vehicles WHERE id = ?', id);
    if (!v) fail('السيارة غير موجودة', 404);
    const target = str(ctx.url.searchParams.get('path'), 200);
    const images = parseImages(v.images).filter((p) => p !== target);
    db.update('vehicles', id, { images: JSON.stringify(images), updated_at: db.now() });
    if (target && target.startsWith('/uploads/')) { try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(target))); } catch {} }
    return { images, message: 'تم حذف الصورة' };
  });

  /* ---------- مصروفات السيارة ---------- */
  add('GET', '/api/vehicles/:id/expenses', null, (ctx) => ({
    items: all('SELECT * FROM vehicle_expenses WHERE vehicle_id = ? AND deleted_at IS NULL ORDER BY id DESC', int(ctx.params.id)),
  }));

  add('POST', '/api/vehicles/:id/expenses', 'vehicles.manage', (ctx) => {
    const id = int(ctx.params.id);
    const v = get('SELECT * FROM vehicles WHERE id = ?', id);
    if (!v) fail('السيارة غير موجودة', 404);
    const amount = round2(num(ctx.body.amount, 0));
    if (amount <= 0) fail('المبلغ مطلوب');
    const treasuryId = int(ctx.body.treasury_id) || null;
    const expId = db.insert('vehicle_expenses', {
      vehicle_id: id, kind: str(ctx.body.kind, 60) || 'تجهيز', description: str(ctx.body.description, 200),
      amount, date: str(ctx.body.date, 10) || db.todayStr(), treasury_id: treasuryId, user_id: ctx.user.id, created_at: db.now(),
    });
    // ترحيل محاسبي: تُرسمل التكلفة على المخزون للسيارات المملوكة، وتُحمّل كمصروف للمعلومة/العمولة
    try {
      const treasury = treasuryId ? get('SELECT * FROM treasuries WHERE id = ?', treasuryId) : null;
      const creditCode = treasury ? (treasury.kind === 'bank' ? acc.CODES.BANK : acc.CODES.CASH) : acc.CODES.CASH;
      const debitCode = v.ownership === 'own' ? acc.CODES.INVENTORY : acc.CODES.PREP_EXP;
      acc.postEntry({
        date: str(ctx.body.date, 10) || db.todayStr(), description: `مصروف سيارة ${v.code} — ${str(ctx.body.kind, 60)}`,
        source: 'expense', source_id: expId, reference: v.code, user_id: ctx.user.id,
        lines: [{ code: debitCode, debit: amount, party_type: 'vehicle', party_id: id }, { code: creditCode, credit: amount }],
      });
      if (treasury) acc.treasuryApply(treasury.id, -amount);
      if (v.ownership === 'own') db.run('UPDATE vehicles SET extra_cost = ROUND(extra_cost + ?, 2), updated_at = ? WHERE id = ?', amount, db.now(), id);
    } catch (e) { console.warn('vehicle expense entry', e.message); }
    db.audit({ ...ctxAudit(ctx), action: 'create', entity: 'vehicle_expenses', entity_id: expId, details: { vehicle_id: id, amount } });
    return { id: expId, item: vehicleFull(id), message: 'تمت إضافة المصروف' };
  });

  add('DELETE', '/api/vehicles/:id/expenses/:expId', 'vehicles.manage', (ctx) => {
    const expId = int(ctx.params.expId);
    const e = get('SELECT * FROM vehicle_expenses WHERE id = ?', expId);
    if (e) {
      db.softDelete('vehicle_expenses', expId, ctxAudit(ctx));
      const v = get('SELECT * FROM vehicles WHERE id = ?', e.vehicle_id);
      if (v && v.ownership === 'own') db.run('UPDATE vehicles SET extra_cost = MAX(0, ROUND(extra_cost - ?, 2)) WHERE id = ?', e.amount, v.id);
    }
    return { message: 'تم حذف المصروف' };
  });
};
