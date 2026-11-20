'use strict';
/* ============================================================
   Auto Car — مولّد مسارات CRUD عام
   يوفّر: قائمة (بحث/ترقيم)، عرض، إنشاء، تعديل، حذف منطقي، استرجاع
   مع تسجيل كل عملية في سجل النشاط تلقائيًا.
   ============================================================ */
const db = require('./db');

function pickFields(body, fields) {
  const data = {};
  for (const f of fields) if (body[f] !== undefined) data[f] = body[f];
  return data;
}

/**
 * @param app  كائن الخادم المشترك
 * @param opts { base, table, perm, label, searchCols, fields, order, soft, extraWhere, transform }
 */
function registerMaster(app, opts) {
  const { add, fail, str, int, all, get } = app;
  const { base, table, perm, label = table, searchCols = ['name'], fields, order = 'id DESC', soft = true } = opts;
  const listPerm = opts.listPerm ?? null;
  const fullSelect = opts.select || `SELECT t.* FROM ${table} t`;

  add('GET', `/api/${base}`, listPerm, (ctx) => {
    const q = str(ctx.url.searchParams.get('q'), 80);
    const deleted = ctx.url.searchParams.get('deleted') === '1';
    const noPage = ctx.url.searchParams.get('all') === '1';
    const where = [];
    const params = [];
    if (soft) where.push(deleted ? 't.deleted_at IS NOT NULL' : 't.deleted_at IS NULL');
    if (q && searchCols.length) {
      where.push('(' + searchCols.map((c) => `${c} LIKE ?`).join(' OR ') + ')');
      searchCols.forEach(() => params.push(`%${q}%`));
    }
    if (ctx.url.searchParams.get('active') === '1' && fields.includes('active')) where.push('t.active = 1');
    if (opts.extraWhere) { where.push(opts.extraWhere.sql); params.push(...(opts.extraWhere.params || [])); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = get(`SELECT COUNT(*) AS c FROM ${table} t ${whereSql}`, ...params).c;
    let sql = `${fullSelect} ${whereSql} ORDER BY ${order}`;
    if (!noPage) {
      const { page, limit, offset } = app.pageParams(ctx.url);
      const items = all(sql + ' LIMIT ? OFFSET ?', ...params, limit, offset);
      return { items, total, page, limit };
    }
    return { items: all(sql, ...params), total };
  });

  add('GET', `/api/${base}/:id`, listPerm, (ctx) => {
    const row = get(`${fullSelect} WHERE t.id = ?`, int(ctx.params.id));
    if (!row) fail(`${label} غير موجود`, 404);
    return { item: row };
  });

  add('POST', `/api/${base}`, perm, (ctx) => {
    let data = pickFields(ctx.body, fields);
    if (opts.transform) data = opts.transform(data, ctx) || data;
    if (db.all(`PRAGMA table_info(${table})`).some((c) => c.name === 'created_at')) data.created_at = db.now();
    const id = db.insert(table, data);
    db.audit({ ...app.ctxAudit(ctx), action: 'create', entity: table, entity_id: id, details: db.get(`SELECT * FROM ${table} WHERE id = ?`, id) });
    const row = get(`SELECT * FROM ${table} WHERE id = ?`, id);
    if (opts.afterSave) opts.afterSave(id, row, ctx);
    return { id, item: row, message: 'تمت الإضافة بنجاح' };
  });

  add('PUT', `/api/${base}/:id`, perm, (ctx) => {
    const id = int(ctx.params.id);
    const existing = get(`SELECT * FROM ${table} WHERE id = ?`, id);
    if (!existing) fail(`${label} غير موجود`, 404);
    let data = pickFields(ctx.body, fields);
    if (opts.transform) data = opts.transform(data, ctx) || data;
    if (db.all(`PRAGMA table_info(${table})`).some((c) => c.name === 'updated_at')) data.updated_at = db.now();
    db.update(table, id, data);
    db.audit({ ...app.ctxAudit(ctx), action: 'update', entity: table, entity_id: id, details: data });
    const row = get(`SELECT * FROM ${table} WHERE id = ?`, id);
    if (opts.afterSave) opts.afterSave(id, row, ctx);
    return { item: row, message: 'تم التحديث بنجاح' };
  });

  add('DELETE', `/api/${base}/:id`, perm, (ctx) => {
    const id = int(ctx.params.id);
    if (soft) db.softDelete(table, id, app.ctxAudit(ctx));
    else db.purge(table, id, app.ctxAudit(ctx));
    return { message: 'تم الحذف بنجاح' };
  });

  if (soft) {
    add('POST', `/api/${base}/:id/restore`, perm, (ctx) => {
      db.restore(table, int(ctx.params.id), app.ctxAudit(ctx));
      return { message: 'تم الاسترجاع بنجاح' };
    });
  }
}

module.exports = { registerMaster, pickFields };
