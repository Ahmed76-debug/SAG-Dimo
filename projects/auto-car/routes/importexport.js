'use strict';
/* ============================================================
   Auto Car — استيراد وتصدير Excel/CSV
   ============================================================ */
const db = require('../lib/db');
const xlsx = require('../lib/xlsx');

module.exports = function importExportRoutes(app) {
  const { add, fail, str, int, num, get, all, run, ctxAudit } = app;

  const ENTITIES = {
    brands: {
      table: 'brands', label: 'الماركات',
      columns: [['name', 'الاسم', 'Name'], ['name_en', 'الاسم بالإنجليزية', 'Name EN'], ['country', 'بلد المنشأ', 'Country']],
    },
    car_types: {
      table: 'car_types', label: 'فئات السيارات',
      columns: [['name', 'الاسم', 'Name'], ['name_en', 'الاسم بالإنجليزية', 'Name EN']],
    },
    car_models: {
      table: 'car_models', label: 'طرازات السيارات',
      columns: [['brand', 'الماركة', 'Brand'], ['name', 'الطراز', 'Model'], ['name_en', 'الطراز بالإنجليزية', 'Model EN']],
    },
    colors: {
      table: 'colors', label: 'الألوان',
      columns: [['name', 'اللون', 'Color'], ['name_en', 'اللون بالإنجليزية', 'Color EN'], ['hex', 'الكود اللوني', 'Hex']],
    },
    customers: {
      table: 'customers', label: 'العملاء',
      columns: [['name', 'الاسم', 'Name'], ['phone', 'الهاتف', 'Phone'], ['email', 'البريد', 'Email'], ['address', 'العنوان', 'Address'], ['national_id', 'الرقم القومي', 'National ID'], ['opening_balance', 'الرصيد الافتتاحي', 'Opening Balance']],
    },
    suppliers: {
      table: 'suppliers', label: 'الموردون',
      columns: [['name', 'الاسم', 'Name'], ['phone', 'الهاتف', 'Phone'], ['email', 'البريد', 'Email'], ['address', 'العنوان', 'Address'], ['opening_balance', 'الرصيد الافتتاحي', 'Opening Balance']],
    },
    vehicles: {
      table: 'vehicles', label: 'السيارات',
      columns: [['code', 'الكود', 'Code'], ['vin', 'رقم الهيكل', 'VIN'], ['brand', 'الماركة', 'Brand'], ['model', 'الطراز', 'Model'], ['year', 'سنة الصنع', 'Year'], ['condition', 'الحالة (new/used)', 'Condition'], ['mileage', 'العداد', 'Mileage'], ['color', 'اللون', 'Color'], ['cost_price', 'سعر التكلفة', 'Cost'], ['target_price', 'سعر البيع', 'Target Price'], ['ownership', 'الملكية (own/consignment)', 'Ownership']],
    },
    accounts: {
      table: 'accounts', label: 'دليل الحسابات',
      columns: [['code', 'الكود', 'Code'], ['name', 'الاسم', 'Name'], ['name_en', 'الاسم بالإنجليزية', 'Name EN'], ['type', 'النوع (asset/liability/equity/revenue/expense)', 'Type']],
    },
  };

  function normalizeHeader(h) { return str(h, 80).replace(/\s+/g, ' ').toLowerCase(); }

  function buildHeaderMap(entity) {
    const def = ENTITIES[entity];
    const map = {};
    for (const [field, ar, en] of def.columns) {
      map[normalizeHeader(field)] = field;
      map[normalizeHeader(ar)] = field;
      map[normalizeHeader(en)] = field;
    }
    return map;
  }

  function resolveRefs(entity, row) {
    if (entity === 'car_models' && row.brand) {
      let b = get('SELECT id FROM brands WHERE name = ? OR name_en = ?', str(row.brand, 80), str(row.brand, 80));
      if (!b) { const id = db.insert('brands', { name: str(row.brand, 80), active: 1, created_at: db.now() }); b = { id }; }
      row.brand_id = b.id; delete row.brand;
    }
    if (entity === 'vehicles') {
      if (row.brand) { let b = get('SELECT id FROM brands WHERE name=? OR name_en=?', str(row.brand, 80), str(row.brand, 80)); if (!b) { const id = db.insert('brands', { name: str(row.brand, 80), active: 1, created_at: db.now() }); b = { id }; } row.brand_id = b.id; delete row.brand; }
      if (row.model) { let m = get('SELECT id FROM car_models WHERE name=? OR name_en=?', str(row.model, 80), str(row.model, 80)); if (!m && row.brand_id) { const id = db.insert('car_models', { brand_id: row.brand_id, name: str(row.model, 80), active: 1, created_at: db.now() }); m = { id }; } if (m) row.model_id = m.id; delete row.model; }
      if (row.color) { let c = get('SELECT id FROM colors WHERE name=? OR name_en=?', str(row.color, 40), str(row.color, 40)); if (c) row.color_id = c.id; delete row.color; }
    }
    return row;
  }

  function doImport(entity, rows, ctx) {
    const def = ENTITIES[entity];
    if (!def) fail('نوع البيانات غير مدعوم');
    if (!rows.length) fail('الملف فارغ');
    const headerMap = buildHeaderMap(entity);
    const headers = rows[0].map((h) => headerMap[normalizeHeader(h)] || null);
    let success = 0, failed = 0;
    const errors = [];
    for (let i = 1; i < rows.length; i++) {
      const raw = rows[i];
      const obj = {};
      let empty = true;
      headers.forEach((field, idx) => {
        if (!field) return;
        const val = raw[idx];
        if (val !== undefined && val !== '') { obj[field] = val; empty = false; }
      });
      if (empty) continue;
      try {
        if (entity === 'vehicles') {
          obj.code = str(obj.code, 40) || db.nextNumber('vehicle', 'CAR-');
          obj.condition = String(obj.condition).toLowerCase().includes('new') ? 'new' : 'used';
          obj.ownership = String(obj.ownership || '').toLowerCase().includes('consign') ? 'consignment' : 'own';
          obj.cost_price = num(obj.cost_price, 0); obj.target_price = num(obj.target_price, 0);
          obj.year = int(obj.year) || null; obj.mileage = int(obj.mileage) || 0;
          obj.status = 'available'; obj.entry_date = db.todayStr(); obj.images = '[]';
        }
        if (entity === 'customers' || entity === 'suppliers') {
          obj.opening_balance = num(obj.opening_balance, 0); obj.balance = obj.opening_balance;
        }
        resolveRefs(entity, obj);
        obj.created_at = db.now();
        db.insert(def.table, obj);
        success++;
      } catch (e) {
        failed++;
        if (errors.length < 30) errors.push({ row: i + 1, error: e.message });
      }
    }
    db.insert('import_logs', { entity, filename: ctx.__filename || null, total: rows.length - 1, success, failed, errors: JSON.stringify(errors), user_id: ctx.user.id, created_at: db.now() });
    db.audit({ ...ctxAudit(ctx), action: 'import', entity, details: { success, failed } });
    return { total: rows.length - 1, success, failed, errors };
  }

  /* ---------- قوالب الاستيراد ---------- */
  add('GET', '/api/import/template/:entity', 'import.manage', (ctx) => {
    const def = ENTITIES[ctx.params.entity];
    if (!def) fail('نوع غير مدعوم', 404);
    const header = def.columns.map(([, ar, en]) => `${ar} (${en})`);
    const sample = def.columns.map(([f]) => (f === 'name' ? 'مثال' : f.includes('price') || f.includes('balance') ? 0 : ''));
    const buf = xlsx.writeXlsx([{ name: def.label, rows: [header, sample] }]);
    ctx.res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="template-${ctx.params.entity}.xlsx"`,
      'Content-Length': buf.length,
    });
    ctx.res.end(buf);
    return null;
  });

  add('GET', '/api/import/entities', 'import.manage', () => ({
    items: Object.entries(ENTITIES).map(([key, d]) => ({ key, label: d.label, columns: d.columns.map(([f, ar, en]) => ({ field: f, ar, en })) })),
  }));

  /* ---------- الاستيراد ---------- */
  add('POST', '/api/import/:entity', 'import.manage', async (ctx) => {
    const entity = ctx.params.entity;
    if (!ENTITIES[entity]) fail('نوع غير مدعوم');
    const filename = String(ctx.req.headers['x-filename'] || '');
    ctx.__filename = filename;
    const buf = await app.readBody(ctx.req, 30 * 1024 * 1024);
    if (!buf.length) fail('الملف فارغ');
    let rows;
    if (/\.xlsx?$/i.test(filename)) rows = (xlsx.readXlsx(buf).sheets[0] || {}).rows || [];
    else rows = xlsx.parseCsv(buf.toString('utf8'));
    const result = doImport(entity, rows, ctx);
    return { ...result, message: `تم استيراد ${result.success} سجل${result.failed ? ` وفشل ${result.failed}` : ''}` };
  }, true);

  /* ---------- التصدير ---------- */
  const EXPORT_SOURCES = {
    vehicles: { table: 'vehicles', label: 'السيارات', sql: `SELECT v.code, v.vin, b.name AS brand, m.name AS model, v.year, v.condition, v.mileage, c.name AS color, v.ownership, v.cost_price, v.extra_cost, v.target_price, v.sale_price, v.status, v.entry_date FROM vehicles v LEFT JOIN brands b ON b.id=v.brand_id LEFT JOIN car_models m ON m.id=v.model_id LEFT JOIN colors c ON c.id=v.color_id WHERE v.deleted_at IS NULL ORDER BY v.id DESC`, columns: [['code', 'الكود'], ['vin', 'رقم الهيكل'], ['brand', 'الماركة'], ['model', 'الطراز'], ['year', 'السنة'], ['condition', 'الحالة'], ['mileage', 'العداد'], ['color', 'اللون'], ['ownership', 'الملكية'], ['cost_price', 'التكلفة'], ['extra_cost', 'مصاريف'], ['target_price', 'سعر البيع'], ['sale_price', 'سعر البيع الفعلي'], ['status', 'الحالة'], ['entry_date', 'تاريخ الإدخال']] },
    customers: { table: 'customers', label: 'العملاء', sql: 'SELECT name, phone, email, address, balance FROM customers WHERE deleted_at IS NULL ORDER BY name', columns: [['name', 'الاسم'], ['phone', 'الهاتف'], ['email', 'البريد'], ['address', 'العنوان'], ['balance', 'الرصيد']] },
    suppliers: { table: 'suppliers', label: 'الموردون', sql: 'SELECT name, phone, email, address, balance FROM suppliers WHERE deleted_at IS NULL ORDER BY name', columns: [['name', 'الاسم'], ['phone', 'الهاتف'], ['email', 'البريد'], ['address', 'العنوان'], ['balance', 'الرصيد']] },
    sales: { table: 'sales', label: 'المبيعات', sql: `SELECT s.invoice_no, s.date, c.name AS customer, s.sale_type, s.total, s.paid, s.remaining, s.profit, s.commission_amount, s.status FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.deleted_at IS NULL ORDER BY s.id DESC`, columns: [['invoice_no', 'رقم الفاتورة'], ['date', 'التاريخ'], ['customer', 'العميل'], ['sale_type', 'نوع البيع'], ['total', 'الإجمالي'], ['paid', 'المدفوع'], ['remaining', 'المتبقي'], ['profit', 'الربح'], ['commission_amount', 'العمولة'], ['status', 'الحالة']] },
    purchases: { table: 'purchases', label: 'المشتريات', sql: `SELECT p.invoice_no, p.date, s.name AS supplier, p.total, p.paid, p.remaining, p.payment_method FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE p.deleted_at IS NULL ORDER BY p.id DESC`, columns: [['invoice_no', 'رقم الفاتورة'], ['date', 'التاريخ'], ['supplier', 'المورد'], ['total', 'الإجمالي'], ['paid', 'المدفوع'], ['remaining', 'المتبقي'], ['payment_method', 'طريقة الدفع']] },
    accounts: { table: 'accounts', label: 'دليل الحسابات', sql: 'SELECT code, name, name_en, type, nature FROM accounts WHERE deleted_at IS NULL ORDER BY code', columns: [['code', 'الكود'], ['name', 'الاسم'], ['name_en', 'الاسم EN'], ['type', 'النوع'], ['nature', 'الطبيعة']] },
  };

  add('GET', '/api/export/:entity', null, (ctx) => {
    const src = EXPORT_SOURCES[ctx.params.entity];
    if (!src) fail('نوع غير مدعوم', 404);
    const rows = all(src.sql);
    const header = src.columns.map(([, label]) => label);
    const body = rows.map((r) => src.columns.map(([key]) => r[key]));
    const format = str(ctx.url.searchParams.get('format'), 6) || 'xlsx';
    if (format === 'csv') {
      const buf = Buffer.from(xlsx.toCsv([header, ...body]), 'utf8');
      ctx.res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${ctx.params.entity}.csv"`, 'Content-Length': buf.length });
      ctx.res.end(buf);
      return null;
    }
    const buf = xlsx.writeXlsx([{ name: src.label, rows: [header, ...body] }]);
    ctx.res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${ctx.params.entity}.xlsx"`, 'Content-Length': buf.length });
    ctx.res.end(buf);
    return null;
  });

  /* تصدير تقرير مخصص: POST /api/export/custom  { title, columns:[{key,label}], rows:[...] } */
  add('POST', '/api/export/custom', null, (ctx) => {
    const title = str(ctx.body.title, 60) || 'تقرير';
    const columns = Array.isArray(ctx.body.columns) ? ctx.body.columns : [];
    const rows = Array.isArray(ctx.body.rows) ? ctx.body.rows : [];
    if (!columns.length) fail('لا توجد أعمدة للتصدير');
    const header = columns.map((c) => str(c.label ?? c.key, 80));
    const body = rows.map((r) => columns.map((c) => r[c.key]));
    const buf = xlsx.writeXlsx([{ name: title, rows: [header, ...body] }]);
    ctx.res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="report.xlsx"`, 'Content-Length': buf.length });
    ctx.res.end(buf);
    return null;
  });

  add('GET', '/api/import/logs', 'import.manage', () => ({ items: all('SELECT * FROM import_logs ORDER BY id DESC LIMIT 100') }));
};
