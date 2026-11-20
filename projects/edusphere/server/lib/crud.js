import { all, get, run, transaction, nextSequence, tableColumns } from './db.js';
import { nowIso, toNumber, safeJsonParse, isEmail } from './util.js';
import { getEntity, getEntityByTable } from '../entities/index.js';
import { hashPassword } from './util.js';

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function existingCols(entity) {
  return new Set((entity?.fields || []).map((f) => f.name));
}

export function labelExpr(alias, display, entity = null) {
  let fields = (display || []).filter(Boolean);
  if (entity) {
    const cols = existingCols(entity);
    fields = fields.filter((f) => cols.has(f));
    if (!fields.length) {
      for (const c of ['title_en', 'name_en', 'title_ar', 'name_ar', 'full_name_en', 'first_name_en', 'label_en', 'code', 'entry_no', 'invoice_no', 'receipt_no', 'name', 'id']) {
        if (cols.has(c)) { fields = [c]; break; }
      }
    }
  }
  if (!fields.length) return `${alias}.id`;
  return fields.map((f) => `COALESCE(CAST(${alias}."${f}" AS TEXT),'')`).join(` || ' ' || `);
}

function displayCols(target, lang = 'en') {
  const primary = lang === 'ar' ? (target.displayAr || []) : (target.displayEn || []);
  const fallback = lang === 'ar' ? (target.displayEn || []) : (target.displayAr || []);
  const cols = existingCols(target);
  let fields = primary.filter((f) => cols.has(f));
  if (!fields.length) fields = fallback.filter((f) => cols.has(f));
  if (!fields.length) {
    for (const c of ['title_en', 'name_en', 'full_name_en', 'first_name_en', 'label_en', 'code', 'entry_no', 'invoice_no', 'receipt_no', 'name', 'id']) {
      if (cols.has(c)) { fields = [c]; break; }
    }
  }
  return fields.length ? fields : ['id'];
}

export function fieldByName(entity, name) {
  return entity.fields.find((f) => f.name === name) || null;
}

const WRITE_EXCLUDED = new Set(['created_at', 'updated_at', 'deleted_at', 'deleted_by']);

const SOFT_DELETE_COLUMNS = new Map();

function hasSoftDelete(entity) {
  if (!entity?.softDelete) return false;
  const table = entity.table || entity.name;
  if (!SOFT_DELETE_COLUMNS.has(table)) {
    try {
      SOFT_DELETE_COLUMNS.set(table, tableColumns(table).includes('deleted_at'));
    } catch {
      SOFT_DELETE_COLUMNS.set(table, false);
    }
  }
  return SOFT_DELETE_COLUMNS.get(table);
}

/* ------------------------------------------------------------------ *
 * Coercion & validation
 * ------------------------------------------------------------------ */

export function coerce(field, value) {
  const t = field.type;
  if (value === undefined) return undefined;
  if (value === null || value === '') {
    if (t === 'boolean') return 0;
    if (['number', 'money', 'percent', 'integer'].includes(t)) return 0;
    return null;
  }
  switch (t) {
    case 'boolean':
      return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
    case 'integer':
      return Math.round(toNumber(value, 0));
    case 'number':
    case 'money':
    case 'percent':
      return toNumber(value, 0);
    case 'date':
      return String(value).slice(0, 10);
    case 'datetime':
      return String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
    case 'time':
      return String(value).slice(0, 5);
    case 'multiselect':
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value ?? []);
    case 'ref':
      return value === '' || value === null ? null : Math.round(toNumber(value, 0)) || null;
    case 'password':
      return String(value);
    default:
      return typeof value === 'string' ? value.trim() : value;
  }
}

export function validate(entity, payload, { partial = false, existingId = null } = {}) {
  const errors = [];
  const out = {};
  for (const field of entity.fields) {
    if (WRITE_EXCLUDED.has(field.name)) continue;
    const present = Object.prototype.hasOwnProperty.call(payload, field.name);
    if (field.type === 'password') {
      const raw = payload[field.name];
      if (raw === undefined || raw === null || raw === '') {
        if (!partial && !existingId) errors.push({ field: field.name, code: 'required' });
        continue;
      }
      if (String(raw).length < 6) {
        errors.push({ field: field.name, code: 'minLength', min: 6 });
        continue;
      }
      out[field.name] = hashPassword(raw);
      continue;
    }
    if (!present) {
      if (!partial && field.required) errors.push({ field: field.name, code: 'required' });
      continue;
    }
    const value = coerce(field, payload[field.name]);
    if (field.required && (value === null || value === '' || value === undefined)) {
      errors.push({ field: field.name, code: 'required' });
      continue;
    }
    if (value !== null && value !== undefined && value !== '') {
      if (field.type === 'email' && !isEmail(value)) errors.push({ field: field.name, code: 'email' });
      if (field.min !== undefined && typeof value === 'string' && value.length < field.min)
        errors.push({ field: field.name, code: 'minLength', min: field.min });
      if (field.max !== undefined && typeof value === 'number' && value > field.max)
        errors.push({ field: field.name, code: 'max', max: field.max });
      if (field.options && field.options.length && field.type === 'select') {
        const ok = field.options.some((o) => String(o.value) === String(value));
        if (!ok) errors.push({ field: field.name, code: 'option' });
      }
    }
    out[field.name] = value;
  }

  // unique checks
  for (const field of entity.fields) {
    if (!field.unique || !(field.name in out)) continue;
    const value = out[field.name];
    if (value === null || value === undefined || value === '') continue;
    const sql = existingId
      ? `SELECT id FROM "${entity.table}" WHERE "${field.name}" = ? AND id <> ? LIMIT 1`
      : `SELECT id FROM "${entity.table}" WHERE "${field.name}" = ? LIMIT 1`;
    const params = existingId ? [value, existingId] : [value];
    if (get(sql, params)) errors.push({ field: field.name, code: 'unique' });
  }

  return { errors, data: out };
}

/* ------------------------------------------------------------------ *
 * Read
 * ------------------------------------------------------------------ */

function buildSelect(entity) {
  const parts = [`t.*`];
  for (const f of entity.fields) {
    if (f.type !== 'ref') continue;
    const target = getEntity(f.ref);
    if (!target) continue;
    parts.push(
      `(SELECT ${labelExpr('r', displayCols(target, 'en'), target)} FROM "${target.table}" r WHERE r.id = t."${f.name}") AS "${f.name}__label"`,
    );
    parts.push(
      `(SELECT ${labelExpr('r', displayCols(target, 'ar'), target)} FROM "${target.table}" r WHERE r.id = t."${f.name}") AS "${f.name}__label_ar"`,
    );
  }
  return parts.join(', ');
}

export function listRows(entity, query = {}, ctx = {}) {
  const page = Math.max(1, toNumber(query.page, 1));
  const pageSize = Math.min(500, Math.max(1, toNumber(query.pageSize, 25)));
  const where = [];
  const params = [];

  if (hasSoftDelete(entity)) {
    const deleted = query.deleted || 'exclude';
    if (deleted === 'only') where.push('t.deleted_at IS NOT NULL');
    else if (deleted !== 'with') where.push('t.deleted_at IS NULL');
  } else if ((query.deleted || '') === 'only') {
    return { rows: [], total: 0, page, pageSize, pages: 0 };
  }

  if (entity.branchScoped && Array.isArray(ctx.branchIds) && ctx.branchIds.length) {
    where.push(`(t.branch_id IS NULL OR t.branch_id IN (${ctx.branchIds.map(() => '?').join(',')}))`);
    params.push(...ctx.branchIds);
  }

  const q = (query.q || '').toString().trim();
  if (q && entity.searchable.length) {
    where.push(`(${entity.searchable.map((c) => `t."${c}" LIKE ?`).join(' OR ')})`);
    for (let i = 0; i < entity.searchable.length; i += 1) params.push(`%${q}%`);
  }

  const filters = query.filter && typeof query.filter === 'object' ? query.filter : {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === '' || value === null || value === undefined) continue;
    const [base, op] = key.split('__');
    const field = fieldByName(entity, base) || (base === 'id' ? { name: 'id', type: 'integer' } : null);
    if (!field) continue;
    if (op === 'from') {
      where.push(`t."${field.name}" >= ?`);
      params.push(value);
    } else if (op === 'to') {
      where.push(`t."${field.name}" <= ?`);
      params.push(value);
    } else if (op === 'in') {
      const values = String(value).split(',').map((v) => v.trim()).filter(Boolean);
      if (!values.length) continue;
      where.push(`t."${field.name}" IN (${values.map(() => '?').join(',')})`);
      params.push(...values);
    } else if (op === 'notnull') {
      where.push(`t."${field.name}" IS NOT NULL`);
    } else if (op === 'null') {
      where.push(`t."${field.name}" IS NULL`);
    } else if (op === 'like') {
      where.push(`t."${field.name}" LIKE ?`);
      params.push(`%${value}%`);
    } else {
      const coerced = coerce(field, value);
      if (coerced === null) where.push(`t."${field.name}" IS NULL`);
      else {
        where.push(`t."${field.name}" = ?`);
        params.push(coerced);
      }
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sortParam = (query.sort || entity.defaultSort || 'id desc').toString();
  const sortableSystem = new Set(['id', 'created_at', 'updated_at', 'deleted_at', 'deleted_by']);
  const sortParts = sortParam
    .split(',')
    .map((chunk) => {
      const [rawField, rawDir] = chunk.trim().split(/\s+/);
      let field = fieldByName(entity, rawField);
      if (!field && sortableSystem.has(rawField) && tableColumns(entity.table).includes(rawField)) {
        field = { name: rawField };
      }
      if (!field) return null;
      const dir = String(rawDir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      return `t."${field.name}" ${dir}`;
    })
    .filter(Boolean);
  const orderSql = sortParts.length ? `ORDER BY ${sortParts.join(', ')}` : 'ORDER BY t.id DESC';

  const total = get(`SELECT COUNT(*) AS c FROM "${entity.table}" t ${whereSql}`, params)?.c || 0;
  const offset = (page - 1) * pageSize;
  const rows = all(
    `SELECT ${buildSelect(entity)} FROM "${entity.table}" t ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return { rows: rows.map((r) => decorate(entity, r)), total, page, pageSize, pages: Math.ceil(total / pageSize) || 1 };
}

function decorate(entity, row) {
  const out = { ...row };
  for (const f of entity.fields) {
    if (f.type === 'multiselect' || f.type === 'json') {
      out[f.name] = safeJsonParse(row[f.name], f.type === 'multiselect' ? [] : null);
    }
    if (f.type === 'boolean') out[f.name] = row[f.name] ? 1 : 0;
  }
  return out;
}

export function getRow(entity, id, ctx = {}) {
  const row = get(`SELECT ${buildSelect(entity)} FROM "${entity.table}" t WHERE t.id = ?`, [id]);
  if (!row) return null;
  return decorate(entity, row);
}

/* ------------------------------------------------------------------ *
 * Write
 * ------------------------------------------------------------------ */

function audit(ctx, action, entity, entityId, summary, changes) {
  try {
    run(
      `INSERT INTO audit_log (user_id, username, action, entity, entity_id, branch_id, summary, changes, ip, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        ctx?.user?.id ?? null,
        ctx?.user?.username ?? 'system',
        action,
        entity.name,
        entityId ?? null,
        ctx?.user?.branch_id ?? null,
        summary || null,
        changes ? JSON.stringify(changes) : null,
        ctx?.ip ?? null,
        nowIso(),
      ],
    );
  } catch {
    /* auditing must never break the request */
  }
}

export function createRow(entity, payload, ctx = {}) {
  const { errors, data } = validate(entity, payload, { partial: false });
  if (errors.length) return { errors };

  if (ctx.user?.id) {
    data.created_by = ctx.user.id;
    data.updated_by = ctx.user.id;
  }
  if (entity.branchScoped && !data.branch_id && ctx.user?.branch_id) data.branch_id = ctx.user.branch_id;
  data.created_at = nowIso();

  const id = transaction(() => {
    const cols = Object.keys(data);
    const sql = `INSERT INTO "${entity.table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols
      .map(() => '?')
      .join(',')})`;
    const res = run(sql, cols.map((c) => data[c]));
    return res.lastInsertRowid;
  });

  audit(ctx, 'create', entity, id, `Created ${entity.labelEn}`, data);
  return { id, row: getRow(entity, id, ctx) };
}

export function updateRow(entity, id, payload, ctx = {}) {
  const existing = get(`SELECT * FROM "${entity.table}" WHERE id = ?`, [id]);
  if (!existing) return { errors: [{ code: 'notFound' }] };

  const { errors, data } = validate(entity, payload, { partial: true, existingId: id });
  if (errors.length) return { errors };

  const patch = { ...data };
  if (ctx.user?.id) patch.updated_by = ctx.user.id;
  patch.updated_at = nowIso();
  delete patch.created_at;

  const cols = Object.keys(patch);
  if (cols.length) {
    transaction(() => {
      run(
        `UPDATE "${entity.table}" SET ${cols.map((c) => `"${c}" = ?`).join(', ')} WHERE id = ?`,
        [...cols.map((c) => patch[c]), id],
      );
    });
  }

  const changes = {};
  for (const c of cols) if (String(existing[c]) !== String(patch[c])) changes[c] = { from: existing[c], to: patch[c] };
  audit(ctx, 'update', entity, id, `Updated ${entity.labelEn}`, changes);
  return { id, row: getRow(entity, id, ctx) };
}

export function deleteRow(entity, id, ctx = {}, { hard = false } = {}) {
  const existing = get(`SELECT * FROM "${entity.table}" WHERE id = ?`, [id]);
  if (!existing) return { errors: [{ code: 'notFound' }] };

  if (hard || !hasSoftDelete(entity)) {
    transaction(() => run(`DELETE FROM "${entity.table}" WHERE id = ?`, [id]));
    audit(ctx, 'delete', entity, id, `Deleted ${entity.labelEn}`, null);
  } else {
    transaction(() => run(`UPDATE "${entity.table}" SET deleted_at = ?, deleted_by = ? WHERE id = ?`, [nowIso(), ctx.user?.id ?? null, id]));
    audit(ctx, 'archive', entity, id, `Archived ${entity.labelEn}`, null);
    try {
      if (getEntity('archive_records')) {
        run(
          `INSERT INTO archive_records (entity, entity_id, label, snapshot, reason, archived_by, archived_at)
           VALUES (?,?,?,?,?,?,?)`,
          [entity.name, id, labelOf(entity, existing), JSON.stringify(existing), 'deleted', ctx.user?.id ?? null, nowIso()],
        );
      }
    } catch {
      /* ignore */
    }
  }
  return { ok: true };
}

export function restoreRow(entity, id, ctx = {}) {
  if (hasSoftDelete(entity)) {
    transaction(() => run(`UPDATE "${entity.table}" SET deleted_at = NULL, deleted_by = NULL WHERE id = ?`, [id]));
  }
  try {
    run(`UPDATE archive_records SET restored_at = ?, restored_by = ? WHERE entity = ? AND entity_id = ?`, [
      nowIso(),
      ctx.user?.id ?? null,
      entity.name,
      id,
    ]);
  } catch {
    /* ignore */
  }
  audit(ctx, 'restore', entity, id, `Restored ${entity.labelEn}`, null);
  return { id, row: getRow(entity, id, ctx) };
}

export function labelOf(entity, row) {
  if (!row) return '';
  const fields = entity.displayEn?.length ? entity.displayEn : ['name_en', 'code', 'id'];
  return fields.map((f) => row[f]).filter(Boolean).join(' ') || String(row.id);
}

/* ------------------------------------------------------------------ *
 * Options (for reference selects)
 * ------------------------------------------------------------------ */

export function optionsFor(entity, query = {}) {
  const limit = Math.min(500, Math.max(1, toNumber(query.limit, 50)));
  const where = [];
  const params = [];
  if (hasSoftDelete(entity)) where.push('t.deleted_at IS NULL');
  if (entity.fields.some((f) => f.name === 'is_active')) where.push('(t.is_active IS NULL OR t.is_active = 1)');
  const q = (query.q || '').toString().trim();
  if (q && entity.searchable.length) {
    where.push(`(${entity.searchable.map((c) => `t."${c}" LIKE ?`).join(' OR ')})`);
    for (let i = 0; i < entity.searchable.length; i += 1) params.push(`%${q}%`);
  }
  if (query.ids) {
    const ids = String(query.ids).split(',').map((v) => Math.round(Number(v))).filter(Boolean);
    if (ids.length) {
      where.push(`t.id IN (${ids.map(() => '?').join(',')})`);
      params.push(...ids);
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = all(
    `SELECT t.id AS value, ${labelExpr('t', displayCols(entity, 'en'), entity)} AS label, ${labelExpr('t', displayCols(entity, 'ar'), entity)} AS label_ar FROM "${entity.table}" t ${whereSql} ORDER BY label LIMIT ?`,
    [...params, limit],
  );
  return rows;
}

export function bulkAction(entity, action, ids, ctx = {}) {
  const results = { ok: 0, failed: 0 };
  for (const id of ids) {
    try {
      if (action === 'delete') deleteRow(entity, id, ctx);
      else if (action === 'restore') restoreRow(entity, id, ctx);
      else if (action === 'purge') deleteRow(entity, id, ctx, { hard: true });
      results.ok += 1;
    } catch {
      results.failed += 1;
    }
  }
  return results;
}

export { nextSequence, getEntity, getEntityByTable };
