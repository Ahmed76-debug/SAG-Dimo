'use strict';
/* ============================================================
   Auto Car — المحاسبة: دليل الحسابات، القيود، الخزائن/البنوك، السندات
   ============================================================ */
const db = require('../lib/db');
const acc = require('../lib/accounting');

module.exports = function accountingRoutes(app) {
  const { add, fail, str, int, num, bool, get, all, run, round2, ctxAudit } = app;

  /* ---------- دليل الحسابات ---------- */
  add('GET', '/api/accounts', null, (ctx) => {
    const { from, to } = app.rangeFromQuery(ctx.url);
    const withBal = ctx.url.searchParams.get('balances') === '1';
    const rows = withBal ? acc.accountsWithBalance({ from: ctx.url.searchParams.get('from') || null, to: ctx.url.searchParams.get('to') || null })
      : all('SELECT * FROM accounts WHERE deleted_at IS NULL ORDER BY code');
    return { items: rows, from, to };
  });

  add('GET', '/api/accounts/tree', null, (ctx) => {
    const from = ctx.url.searchParams.get('from') || null;
    const to = ctx.url.searchParams.get('to') || null;
    const rows = acc.accountsWithBalance({ from, to });
    const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
    const tree = [];
    for (const r of byId.values()) {
      if (r.parent_id && byId.has(r.parent_id)) byId.get(r.parent_id).children.push(r);
      else tree.push(r);
    }
    return { items: tree };
  });

  add('POST', '/api/accounts', 'accounting.manage', (ctx) => {
    const code = str(ctx.body.code, 20);
    const name = str(ctx.body.name, 100);
    const type = str(ctx.body.type, 20);
    if (!code || !name) fail('الكود والاسم مطلوبان');
    if (!['asset', 'liability', 'equity', 'revenue', 'expense'].includes(type)) fail('نوع الحساب غير صحيح');
    if (get('SELECT 1 FROM accounts WHERE code = ?', code)) fail('كود الحساب مستخدم');
    const id = db.insert('accounts', {
      code, name, name_en: str(ctx.body.name_en, 100), type,
      parent_id: int(ctx.body.parent_id) || null,
      is_group: bool(ctx.body.is_group), nature: str(ctx.body.nature, 6) || (type === 'asset' || type === 'expense' ? 'debit' : 'credit'),
      currency_id: int(ctx.body.currency_id) || null, is_cash: bool(ctx.body.is_cash), is_bank: bool(ctx.body.is_bank),
      notes: str(ctx.body.notes, 300), active: ctx.body.active === undefined ? 1 : bool(ctx.body.active), created_at: db.now(),
    });
    db.audit({ ...ctxAudit(ctx), action: 'create', entity: 'accounts', entity_id: id, details: { code, name } });
    return { id, message: 'تمت إضافة الحساب' };
  });

  add('PUT', '/api/accounts/:id', 'accounting.manage', (ctx) => {
    const id = int(ctx.params.id);
    const a = get('SELECT * FROM accounts WHERE id = ?', id);
    if (!a) fail('الحساب غير موجود', 404);
    db.update('accounts', id, {
      name: str(ctx.body.name, 100) || a.name, name_en: str(ctx.body.name_en, 100),
      parent_id: ctx.body.parent_id === undefined ? a.parent_id : (int(ctx.body.parent_id) || null),
      is_group: ctx.body.is_group === undefined ? a.is_group : bool(ctx.body.is_group),
      nature: str(ctx.body.nature, 6) || a.nature,
      is_cash: ctx.body.is_cash === undefined ? a.is_cash : bool(ctx.body.is_cash),
      is_bank: ctx.body.is_bank === undefined ? a.is_bank : bool(ctx.body.is_bank),
      notes: str(ctx.body.notes, 300), active: ctx.body.active === undefined ? a.active : bool(ctx.body.active),
    });
    db.audit({ ...ctxAudit(ctx), action: 'update', entity: 'accounts', entity_id: id });
    return { message: 'تم تحديث الحساب' };
  });

  add('DELETE', '/api/accounts/:id', 'accounting.manage', (ctx) => {
    const id = int(ctx.params.id);
    const used = get('SELECT COUNT(*) AS c FROM journal_lines WHERE account_id = ?', id).c;
    if (used) fail('لا يمكن حذف حساب عليه حركات — يمكن تعطيله بدلًا من ذلك');
    db.softDelete('accounts', id, ctxAudit(ctx));
    return { message: 'تم حذف الحساب' };
  });

  /* ---------- السنوات المالية ---------- */
  add('GET', '/api/fiscal-years', null, () => ({ items: all('SELECT * FROM fiscal_years ORDER BY id DESC') }));
  add('POST', '/api/fiscal-years', 'accounting.manage', (ctx) => {
    const name = str(ctx.body.name, 60), start = str(ctx.body.start_date, 10), end = str(ctx.body.end_date, 10);
    if (!name || !start || !end) fail('البيانات مطلوبة');
    const id = db.insert('fiscal_years', { name, start_date: start, end_date: end, status: 'open', created_at: db.now() });
    return { id, message: 'تمت إضافة السنة المالية' };
  });

  /* ---------- القيود اليومية ---------- */
  add('GET', '/api/journal', null, (ctx) => {
    const where = [ctx.url.searchParams.get('deleted') === '1' ? 'e.deleted_at IS NOT NULL' : 'e.deleted_at IS NULL'];
    const params = [];
    const from = ctx.url.searchParams.get('from'), to = ctx.url.searchParams.get('to');
    if (from) { where.push('e.date >= ?'); params.push(from); }
    if (to) { where.push('e.date <= ?'); params.push(to); }
    if (ctx.url.searchParams.get('source')) { where.push('e.source = ?'); params.push(str(ctx.url.searchParams.get('source'), 20)); }
    const q = str(ctx.url.searchParams.get('q'), 60);
    if (q) { where.push('(e.entry_no LIKE ? OR e.description LIKE ? OR e.reference LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const whereSql = 'WHERE ' + where.join(' AND ');
    const total = get(`SELECT COUNT(*) AS c FROM journal_entries e ${whereSql}`, ...params).c;
    const { page, limit, offset } = app.pageParams(ctx.url);
    const items = all(`SELECT e.*, u.name AS user_name, fy.name AS fiscal_year FROM journal_entries e
                       LEFT JOIN users u ON u.id=e.user_id LEFT JOIN fiscal_years fy ON fy.id=e.fiscal_year_id
                       ${whereSql} ORDER BY e.date DESC, e.id DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
    return { items, total, page, limit };
  });

  add('GET', '/api/journal/:id', null, (ctx) => {
    const e = get(`SELECT e.*, u.name AS user_name FROM journal_entries e LEFT JOIN users u ON u.id=e.user_id WHERE e.id = ?`, int(ctx.params.id));
    if (!e) fail('القيد غير موجود', 404);
    e.lines = all(`SELECT l.*, a.code AS account_code, a.name AS account_name FROM journal_lines l JOIN accounts a ON a.id=l.account_id WHERE l.entry_id = ? ORDER BY l.id`, e.id);
    return { item: e };
  });

  add('POST', '/api/journal', 'accounting.manage', (ctx) => {
    const lines = Array.isArray(ctx.body.lines) ? ctx.body.lines : [];
    if (lines.length < 2) fail('القيد يجب أن يحتوي على طرفين على الأقل');
    const date = str(ctx.body.date, 10) || db.todayStr();
    const source = ['manual', 'opening', 'adjustment', 'closing'].includes(ctx.body.source) ? ctx.body.source : 'manual';
    const id = acc.postEntry({
      date, description: str(ctx.body.description, 300), reference: str(ctx.body.reference, 100),
      source, user_id: ctx.user.id,
      lines: lines.map((l) => ({ account_id: int(l.account_id), debit: num(l.debit, 0), credit: num(l.credit, 0), description: str(l.description, 200), party_type: l.party_type || null, party_id: int(l.party_id) || null })),
    });
    db.audit({ ...ctxAudit(ctx), action: 'create', entity: 'journal_entries', entity_id: id, details: { source } });
    return { id, message: 'تم ترحيل القيد بنجاح' };
  });

  add('POST', '/api/journal/:id/void', 'accounting.manage', (ctx) => {
    acc.voidEntry(int(ctx.params.id), ctxAudit(ctx));
    return { message: 'تم إلغاء القيد' };
  });
  add('DELETE', '/api/journal/:id', 'accounting.manage', (ctx) => {
    const id = int(ctx.params.id);
    const e = get('SELECT * FROM journal_entries WHERE id = ?', id);
    if (e && !['manual', 'opening', 'adjustment', 'closing'].includes(e.source)) fail('لا يمكن حذف قيد مرتبط بعملية — استخدم الإلغاء');
    db.softDelete('journal_entries', id, ctxAudit(ctx));
    return { message: 'تم حذف القيد' };
  });
  add('POST', '/api/journal/:id/restore', 'accounting.manage', (ctx) => {
    db.restore('journal_entries', int(ctx.params.id), ctxAudit(ctx));
    return { message: 'تم استرجاع القيد' };
  });

  /* ---------- الخزائن والبنوك ---------- */
  add('GET', '/api/treasuries', null, () => ({
    items: all(`SELECT t.*, a.code AS account_code, a.name AS account_name, c.code AS currency_code, c.symbol AS currency_symbol
                FROM treasuries t LEFT JOIN accounts a ON a.id=t.account_id LEFT JOIN currencies c ON c.id=t.currency_id
                WHERE t.deleted_at IS NULL ORDER BY t.kind, t.name`),
  }));
  add('POST', '/api/treasuries', 'accounting.manage', (ctx) => {
    const name = str(ctx.body.name, 80);
    if (!name) fail('اسم الخزينة مطلوب');
    const kind = ['cash', 'bank', 'wallet'].includes(ctx.body.kind) ? ctx.body.kind : 'cash';
    let accountId = int(ctx.body.account_id) || null;
    if (!accountId) {
      const accRow = acc.accountByCode(kind === 'bank' ? acc.CODES.BANK : acc.CODES.CASH);
      accountId = accRow ? accRow.id : null;
    }
    const id = db.insert('treasuries', {
      name, name_en: str(ctx.body.name_en, 80), kind, account_id: accountId, currency_id: int(ctx.body.currency_id) || null,
      opening_balance: round2(num(ctx.body.opening_balance, 0)), balance: round2(num(ctx.body.opening_balance, 0)),
      bank_name: str(ctx.body.bank_name, 80), account_number: str(ctx.body.account_number, 60), iban: str(ctx.body.iban, 60),
      active: 1, created_at: db.now(),
    });
    db.audit({ ...ctxAudit(ctx), action: 'create', entity: 'treasuries', entity_id: id, details: { name } });
    return { id, message: 'تمت إضافة الخزينة' };
  });
  add('PUT', '/api/treasuries/:id', 'accounting.manage', (ctx) => {
    const id = int(ctx.params.id);
    const t = get('SELECT * FROM treasuries WHERE id = ?', id);
    if (!t) fail('الخزينة غير موجودة', 404);
    db.update('treasuries', id, {
      name: str(ctx.body.name, 80) || t.name, name_en: str(ctx.body.name_en, 80),
      bank_name: str(ctx.body.bank_name, 80), account_number: str(ctx.body.account_number, 60), iban: str(ctx.body.iban, 60),
      account_id: ctx.body.account_id === undefined ? t.account_id : (int(ctx.body.account_id) || null),
      active: ctx.body.active === undefined ? t.active : bool(ctx.body.active), updated_at: db.now(),
    });
    return { message: 'تم تحديث الخزينة' };
  });
  add('POST', '/api/treasuries/transfer', 'accounting.manage', (ctx) => {
    const fromId = int(ctx.body.from_id), toId = int(ctx.body.to_id);
    const amount = round2(num(ctx.body.amount, 0));
    if (!fromId || !toId || fromId === toId) fail('اختر خزينتين مختلفتين');
    if (amount <= 0) fail('المبلغ غير صحيح');
    const from = get('SELECT * FROM treasuries WHERE id = ?', fromId), to = get('SELECT * FROM treasuries WHERE id = ?', toId);
    if (!from || !to) fail('خزينة غير موجودة', 404);
    const date = str(ctx.body.date, 10) || db.todayStr();
    acc.postEntry({
      date, description: `تحويل بين الخزائن: ${from.name} ← ${to.name}`, source: 'manual', user_id: ctx.user.id,
      lines: [
        { code: from.kind === 'bank' ? acc.CODES.BANK : acc.CODES.CASH, debit: amount },
        { code: to.kind === 'bank' ? acc.CODES.BANK : acc.CODES.CASH, credit: amount },
      ],
    });
    acc.treasuryApply(fromId, -amount); acc.treasuryApply(toId, amount);
    db.audit({ ...ctxAudit(ctx), action: 'create', entity: 'treasuries', details: { transfer: amount } });
    return { message: 'تم التحويل بنجاح' };
  });

  /* ---------- سندات القبض والصرف ---------- */
  add('GET', '/api/vouchers', null, (ctx) => {
    const where = [ctx.url.searchParams.get('deleted') === '1' ? 'v.deleted_at IS NOT NULL' : 'v.deleted_at IS NULL'];
    const params = [];
    if (ctx.url.searchParams.get('kind')) { where.push('v.kind = ?'); params.push(str(ctx.url.searchParams.get('kind'), 10)); }
    const from = ctx.url.searchParams.get('from'), to = ctx.url.searchParams.get('to');
    if (from) { where.push('v.date >= ?'); params.push(from); }
    if (to) { where.push('v.date <= ?'); params.push(to); }
    const q = str(ctx.url.searchParams.get('q'), 60);
    if (q) { where.push('(v.voucher_no LIKE ? OR v.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const whereSql = 'WHERE ' + where.join(' AND ');
    const total = get(`SELECT COUNT(*) AS c FROM vouchers v ${whereSql}`, ...params).c;
    const { page, limit, offset } = app.pageParams(ctx.url);
    const items = all(`SELECT v.*, t.name AS treasury_name, a.name AS account_name, u.name AS user_name
                       FROM vouchers v LEFT JOIN treasuries t ON t.id=v.treasury_id LEFT JOIN accounts a ON a.id=v.account_id
                       LEFT JOIN users u ON u.id=v.user_id ${whereSql} ORDER BY v.id DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
    return { items, total, page, limit };
  });

  add('POST', '/api/vouchers', 'accounting.manage', (ctx) => {
    const kind = ctx.body.kind === 'payment' ? 'payment' : 'receipt';
    const amount = round2(num(ctx.body.amount, 0));
    if (amount <= 0) fail('المبلغ مطلوب');
    const treasuryId = int(ctx.body.treasury_id) || null;
    let accountId = int(ctx.body.account_id) || null;
    const partyType = ['customer', 'supplier', 'other'].includes(ctx.body.party_type) ? ctx.body.party_type : null;
    const partyId = int(ctx.body.party_id) || null;
    if (!accountId) accountId = acc.accountByCode(partyType === 'supplier' ? acc.CODES.AP : acc.CODES.AR)?.id;
    if (!accountId) fail('حدّد الحساب المقابل');
    const date = str(ctx.body.date, 10) || db.todayStr();
    const treasury = treasuryId ? get('SELECT * FROM treasuries WHERE id = ?', treasuryId) : null;
    if (!treasury) fail('حدّد الخزينة');
    const cashCode = treasury.kind === 'bank' ? acc.CODES.BANK : acc.CODES.CASH;
    const lines = kind === 'receipt'
      ? [{ code: cashCode, debit: amount }, { account_id: accountId, credit: amount, party_type: partyType, party_id: partyId }]
      : [{ account_id: accountId, debit: amount, party_type: partyType, party_id: partyId }, { code: cashCode, credit: amount }];
    const entryId = acc.postEntry({ date, description: str(ctx.body.description, 300) || (kind === 'receipt' ? 'سند قبض' : 'سند صرف'), source: kind, user_id: ctx.user.id, lines });
    acc.treasuryApply(treasuryId, kind === 'receipt' ? amount : -amount);
    const voucherNo = db.nextNumber(kind, kind === 'receipt' ? 'RCV-' : 'PAY-');
    const id = db.insert('vouchers', {
      voucher_no: voucherNo, kind, date, treasury_id: treasuryId, account_id: accountId, party_type: partyType, party_id: partyId,
      amount, currency_id: int(ctx.body.currency_id) || null, exchange_rate: num(ctx.body.exchange_rate, 1) || 1,
      method: str(ctx.body.method, 20) || 'cash', description: str(ctx.body.description, 300), journal_entry_id: entryId,
      user_id: ctx.user.id, created_at: db.now(),
    });
    if (partyType === 'customer' && partyId) recomputeParty('customers', acc.CODES.AR, partyId, 'debit');
    if (partyType === 'supplier' && partyId) recomputeParty('suppliers', acc.CODES.AP, partyId, 'credit');
    db.audit({ ...ctxAudit(ctx), action: 'create', entity: 'vouchers', entity_id: id, details: { kind, amount } });
    return { id, voucher_no: voucherNo, message: 'تم حفظ السند بنجاح' };
  });

  add('DELETE', '/api/vouchers/:id', 'accounting.manage', (ctx) => {
    const id = int(ctx.params.id);
    const v = get('SELECT * FROM vouchers WHERE id = ?', id);
    if (!v) fail('السند غير موجود', 404);
    if (v.journal_entry_id) acc.voidEntry(v.journal_entry_id, ctxAudit(ctx));
    acc.treasuryApply(v.treasury_id, v.kind === 'receipt' ? -v.amount : v.amount);
    db.softDelete('vouchers', id, ctxAudit(ctx));
    if (v.party_type === 'customer' && v.party_id) recomputeParty('customers', acc.CODES.AR, v.party_id, 'debit');
    if (v.party_type === 'supplier' && v.party_id) recomputeParty('suppliers', acc.CODES.AP, v.party_id, 'credit');
    return { message: 'تم حذف السند وعكس قيده' };
  });

  function recomputeParty(table, code, id, sign) {
    const account = acc.accountByCode(code);
    const r = get(`SELECT COALESCE(SUM(l.debit),0) AS d, COALESCE(SUM(l.credit),0) AS c FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id WHERE l.account_id=? AND l.party_id=? AND e.status='posted' AND e.deleted_at IS NULL`, account.id, id);
    const bal = sign === 'debit' ? Number(r.d) - Number(r.c) : Number(r.c) - Number(r.d);
    db.update(table, id, { balance: round2(bal) });
  }
};
