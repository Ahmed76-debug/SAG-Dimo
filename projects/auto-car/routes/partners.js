'use strict';
/* ============================================================
   Auto Car — العملاء والموردون + كشوف الحساب
   ============================================================ */
const db = require('../lib/db');
const acc = require('../lib/accounting');

module.exports = function partnerRoutes(app) {
  const { add, fail, str, int, num, bool, get, all, round2, ctxAudit, store } = app;

  /* ---------- دوال مساعدة ---------- */
  function partyLedger(code, partyId, from, to) {
    const account = acc.accountByCode(code);
    if (!account) return { rows: [], opening: 0, closing: 0 };
    const openingRow = get(
      `SELECT COALESCE(SUM(l.debit),0) AS d, COALESCE(SUM(l.credit),0) AS c
         FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
        WHERE l.account_id = ? AND l.party_id = ? AND e.status='posted' AND e.deleted_at IS NULL
          AND (? IS NULL OR e.date < ?)`, account.id, partyId, from || null, from || null);
    let running = Number(openingRow.d) - Number(openingRow.c);
    const opening = running;
    const rows = all(
      `SELECT l.id, l.debit, l.credit, l.description, e.entry_no, e.date, e.source, e.reference
         FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
        WHERE l.account_id = ? AND l.party_id = ? AND e.status='posted' AND e.deleted_at IS NULL
          AND (? IS NULL OR e.date >= ?) AND (? IS NULL OR e.date <= ?)
        ORDER BY e.date, e.id`, account.id, partyId, from || null, from || null, to || null, to || null)
      .map((r) => { running += Number(r.debit) - Number(r.credit); return { ...r, running: round2(running) }; });
    return { rows, opening: round2(opening), closing: round2(running) };
  }

  function recomputeBalance(kind, id) {
    const code = kind === 'customer' ? acc.CODES.AR : acc.CODES.AP;
    const account = acc.accountByCode(code);
    if (!account) return 0;
    const r = get(
      `SELECT COALESCE(SUM(l.debit),0) AS d, COALESCE(SUM(l.credit),0) AS c
         FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
        WHERE l.account_id = ? AND l.party_id = ? AND e.status='posted' AND e.deleted_at IS NULL`, account.id, id);
    const net = kind === 'customer' ? Number(r.d) - Number(r.c) : Number(r.c) - Number(r.d);
    db.update(kind === 'customer' ? 'customers' : 'suppliers', id, { balance: round2(net) });
    return round2(net);
  }

  function openingEntry(kind, row, ctx) {
    const amount = round2(row.opening_balance);
    if (!amount) return;
    acc.postEntry({
      date: db.todayStr(), description: `رصيد افتتاحي — ${kind === 'customer' ? 'عميل' : 'مورد'} ${row.name}`,
      source: 'opening', reference: kind === 'customer' ? `CUS-${row.id}` : `SUP-${row.id}`,
      lines: kind === 'customer'
        ? [{ code: acc.CODES.AR, debit: amount, party_type: 'customer', party_id: row.id },
           { code: acc.CODES.CAPITAL, credit: amount }]
        : [{ code: acc.CODES.AP, credit: amount, party_type: 'supplier', party_id: row.id },
           { code: acc.CODES.CAPITAL, debit: amount }],
    });
  }

  /* ---------- مولّد CRUD للأطراف ---------- */
  function registerParty(kind) {
    const table = kind === 'customer' ? 'customers' : 'suppliers';
    const base = kind === 'customer' ? 'customers' : 'suppliers';
    const label = kind === 'customer' ? 'العميل' : 'المورد';
    const fields = kind === 'customer'
      ? ['name', 'name_en', 'phone', 'phone2', 'email', 'address', 'national_id', 'job', 'kind', 'opening_balance', 'credit_limit', 'notes', 'active']
      : ['name', 'name_en', 'phone', 'email', 'address', 'national_id', 'kind', 'opening_balance', 'notes', 'active'];

    add('GET', `/api/${base}`, null, (ctx) => {
      const q = str(ctx.url.searchParams.get('q'), 80);
      const deleted = ctx.url.searchParams.get('deleted') === '1';
      const withBalance = ctx.url.searchParams.get('with_balance') === '1';
      const where = [deleted ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL'];
      const params = [];
      if (q) { where.push('(name LIKE ? OR name_en LIKE ? OR phone LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
      if (withBalance) where.push(kind === 'customer' ? 'balance > 0' : 'balance > 0');
      const { page, limit, offset } = app.pageParams(ctx.url, 100);
      const total = get(`SELECT COUNT(*) AS c FROM ${table} WHERE ${where.join(' AND ')}`, ...params).c;
      const items = all(`SELECT * FROM ${table} WHERE ${where.join(' AND ')} ORDER BY name LIMIT ? OFFSET ?`, ...params, limit, offset);
      return { items, total, page, limit };
    });

    add('GET', `/api/${base}/:id`, null, (ctx) => {
      const row = get(`SELECT * FROM ${table} WHERE id = ?`, int(ctx.params.id));
      if (!row) fail(`${label} غير موجود`, 404);
      return { item: row };
    });

    add('GET', `/api/${base}/:id/statement`, null, (ctx) => {
      const id = int(ctx.params.id);
      const row = get(`SELECT * FROM ${table} WHERE id = ?`, id);
      if (!row) fail(`${label} غير موجود`, 404);
      const { from, to } = app.rangeFromQuery(ctx.url);
      const code = kind === 'customer' ? acc.CODES.AR : acc.CODES.AP;
      const ledger = partyLedger(code, id, ctx.url.searchParams.get('from') || null, to);
      const balance = recomputeBalance(kind, id);
      return { party: row, ...ledger, balance };
    });

    add('POST', `/api/${base}`, 'partners.manage', (ctx) => {
      const name = str(ctx.body.name, 120);
      if (!name) fail('الاسم مطلوب');
      const data = {};
      for (const f of fields) if (ctx.body[f] !== undefined) data[f] = ctx.body[f];
      data.name = name;
      data.opening_balance = round2(num(data.opening_balance, 0));
      data.balance = data.opening_balance;
      data.created_at = db.now();
      const id = db.insert(table, data);
      const row = get(`SELECT * FROM ${table} WHERE id = ?`, id);
      try { openingEntry(kind, row, ctx); } catch (e) { console.warn('opening entry', e.message); }
      recomputeBalance(kind, id);
      db.audit({ ...ctxAudit(ctx), action: 'create', entity: table, entity_id: id, details: { name } });
      return { id, item: get(`SELECT * FROM ${table} WHERE id = ?`, id), message: 'تمت الإضافة بنجاح' };
    });

    add('PUT', `/api/${base}/:id`, 'partners.manage', (ctx) => {
      const id = int(ctx.params.id);
      const existing = get(`SELECT * FROM ${table} WHERE id = ?`, id);
      if (!existing) fail(`${label} غير موجود`, 404);
      const data = {};
      for (const f of fields) if (ctx.body[f] !== undefined && f !== 'opening_balance') data[f] = ctx.body[f];
      data.updated_at = db.now();
      db.update(table, id, data);
      db.audit({ ...ctxAudit(ctx), action: 'update', entity: table, entity_id: id });
      return { item: get(`SELECT * FROM ${table} WHERE id = ?`, id), message: 'تم التحديث بنجاح' };
    });

    add('DELETE', `/api/${base}/:id`, 'partners.manage', (ctx) => {
      db.softDelete(table, int(ctx.params.id), ctxAudit(ctx));
      return { message: 'تم الحذف بنجاح' };
    });
    add('POST', `/api/${base}/:id/restore`, 'partners.manage', (ctx) => {
      db.restore(table, int(ctx.params.id), ctxAudit(ctx));
      return { message: 'تم الاسترجاع بنجاح' };
    });
    add('POST', `/api/${base}/:id/recompute`, 'partners.manage', (ctx) => {
      const balance = recomputeBalance(kind, int(ctx.params.id));
      return { balance, message: 'تم إعادة حساب الرصيد' };
    });
  }

  registerParty('customer');
  registerParty('supplier');
};
