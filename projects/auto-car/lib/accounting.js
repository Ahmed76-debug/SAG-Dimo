'use strict';
/* ============================================================
   Auto Car — محرك المحاسبة (ERP)
   ترحيل القيود تلقائيًا من الأحداث + التقارير المالية
   ============================================================ */
const db = require('./db');

/* أكواد الحسابات الأساسية */
const CODES = {
  CASH: '1101',
  BANK: '1102',
  AR: '1103',            // العملاء
  INVENTORY: '1104',     // مخزون السيارات
  AP: '2101',            // الموردون
  VAT: '2103',
  CAPITAL: '3101',
  RETAINED: '3102',
  DRAWINGS: '3103',
  SALES_REV: '4101',
  COMMISSION_REV: '4102',
  OTHER_REV: '4103',
  SALES_RET: '4104',
  COGS: '5101',
  PREP_EXP: '5205',
  DISC_EXP: '5207',
};

function accountByCode(code) {
  return db.get('SELECT * FROM accounts WHERE code = ?', code);
}
function accountById(id) {
  return db.get('SELECT * FROM accounts WHERE id = ?', id);
}
function resolveAccount(ref) {
  if (!ref) return null;
  if (typeof ref === 'number') return accountById(ref);
  if (/^\d+$/.test(String(ref))) return accountByCode(String(ref));
  return accountById(Number(ref));
}

function nextEntryNo() {
  return db.nextNumber('journal_entry', 'JV-');
}

/**
 * ترحيل قيد يومية متوازن.
 * lines: [{ account | account_id | code, debit, credit, description, party_type, party_id }]
 */
function postEntry({ date, description = '', reference = null, source = 'manual', source_id = null, currency_id = null, exchange_rate = 1, user_id = null, lines = [] }) {
  const resolved = [];
  for (const l of lines) {
    const acc = resolveAccount(l.account_id ?? l.account ?? l.code);
    if (!acc) throw new Error('حساب غير معروف في القيد: ' + (l.account_id ?? l.account ?? l.code));
    const debit = db.round2(l.debit || 0);
    const credit = db.round2(l.credit || 0);
    if (!debit && !credit) continue;
    resolved.push({ account_id: acc.id, debit, credit, description: l.description || description, party_type: l.party_type || null, party_id: l.party_id || null });
  }
  if (!resolved.length) return null;
  const total_debit = db.round2(resolved.reduce((s, l) => s + l.debit, 0));
  const total_credit = db.round2(resolved.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(total_debit - total_credit) > 0.01) {
    throw new Error(`القيد غير متوازن: مدين ${total_debit} ≠ دائن ${total_credit}`);
  }
  const entryNo = nextEntryNo();
  const fy = db.get('SELECT id FROM fiscal_years WHERE ? BETWEEN start_date AND end_date ORDER BY id LIMIT 1', String(date).slice(0, 10));
  const entryId = db.insert('journal_entries', {
    entry_no: entryNo, date: String(date).slice(0, 10), description, reference,
    source, source_id, fiscal_year_id: fy ? fy.id : null, currency_id, exchange_rate,
    total_debit, total_credit, status: 'posted', user_id, created_at: db.now(),
  });
  for (const l of resolved) {
    db.insert('journal_lines', {
      entry_id: entryId, account_id: l.account_id, description: l.description,
      debit: l.debit, credit: l.credit, currency_id, exchange_rate,
      party_type: l.party_type, party_id: l.party_id, created_at: db.now(),
    });
  }
  return entryId;
}

function voidEntry(entryId, ctx = {}) {
  const e = db.get('SELECT * FROM journal_entries WHERE id = ?', entryId);
  if (!e) return 0;
  db.update('journal_entries', entryId, { status: 'void', updated_at: db.now() });
  db.audit({ ...ctx, action: 'update', entity: 'journal_entries', entity_id: entryId, details: { void: true } });
  return 1;
}

/* حركة الخزينة/البنك */
function treasuryApply(treasuryId, delta) {
  if (!treasuryId) return;
  db.run('UPDATE treasuries SET balance = ROUND(balance + ?, 2), updated_at = ? WHERE id = ?', db.round2(delta), db.now(), treasuryId);
}
function treasuryBalance(treasuryId) {
  const r = db.get('SELECT balance FROM treasuries WHERE id = ?', treasuryId);
  return r ? Number(r.balance) : 0;
}

/* ---------- أرصدة الحسابات ---------- */
function accountNet(accountId, from, to) {
  const row = db.get(
    `SELECT COALESCE(SUM(debit),0) AS d, COALESCE(SUM(credit),0) AS c
       FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
      WHERE l.account_id = ? AND e.status = 'posted' AND e.deleted_at IS NULL
        AND (? IS NULL OR e.date >= ?) AND (? IS NULL OR e.date <= ?)`,
    accountId, from || null, from || null, to || null, to || null
  );
  return { debit: Number(row.d), credit: Number(row.c), net: Number(row.d) - Number(row.c) };
}

function accountsWithBalance({ from = null, to = null, types = null } = {}) {
  const where = types ? `AND a.type IN (${types.map(() => '?').join(',')})` : '';
  const accounts = db.all(
    `SELECT * FROM accounts a WHERE a.active = 1 AND a.deleted_at IS NULL ${where} ORDER BY a.code`,
    ...(types || [])
  );
  return accounts.map((a) => {
    const b = accountNet(a.id, from, to);
    const signed = a.nature === 'credit' ? b.credit - b.debit : b.net;
    return { ...a, debit: b.debit, credit: b.credit, net: b.net, signed_balance: db.round2(signed) };
  });
}

/* ميزان المراجعة */
function trialBalance(from, to) {
  const rows = accountsWithBalance({ from, to }).filter((a) => a.debit || a.credit);
  const totals = rows.reduce((s, r) => ({ debit: s.debit + r.debit, credit: s.credit + r.credit }), { debit: 0, credit: 0 });
  return { rows, totals: { debit: db.round2(totals.debit), credit: db.round2(totals.credit) } };
}

/* قائمة الدخل */
function incomeStatement(from, to) {
  const revenue = accountsWithBalance({ from, to, types: ['revenue'] });
  const expenses = accountsWithBalance({ from, to, types: ['expense'] });
  const revTotal = revenue.reduce((s, a) => s + (a.credit - a.debit), 0);
  const expTotal = expenses.reduce((s, a) => s + (a.debit - a.credit), 0);
  const net = revTotal - expTotal;
  return {
    revenue: revenue.map((a) => ({ code: a.code, name: a.name, name_en: a.name_en, amount: db.round2(a.credit - a.debit) })),
    expenses: expenses.map((a) => ({ code: a.code, name: a.name, name_en: a.name_en, amount: db.round2(a.debit - a.credit) })),
    revenue_total: db.round2(revTotal),
    expenses_total: db.round2(expTotal),
    net_income: db.round2(net),
  };
}

/* الميزانية العمومية */
function balanceSheet(asOf) {
  const assets = accountsWithBalance({ to: asOf, types: ['asset'] });
  const liabilities = accountsWithBalance({ to: asOf, types: ['liability'] });
  const equity = accountsWithBalance({ to: asOf, types: ['equity'] });
  const sum = (arr, sign) => arr.reduce((s, a) => s + (a.nature === 'credit' ? (a.credit - a.debit) * sign : (a.debit - a.credit) * sign), 0);
  const assetsTotal = db.round2(sum(assets, 1));
  const liabTotal = db.round2(sum(liabilities, 1));
  const eqTotal = db.round2(sum(equity, 1));
  // نتيجة النشاط من بداية العام حتى التاريخ
  const yearStart = (asOf || db.todayStr()).slice(0, 4) + '-01-01';
  const pl = incomeStatement(yearStart, asOf);
  const totalEquity = db.round2(eqTotal + pl.net_income);
  return {
    assets: assets.map((a) => ({ ...a, balance: db.round2(a.nature === 'credit' ? a.credit - a.debit : a.debit - a.credit) })),
    liabilities: liabilities.map((a) => ({ ...a, balance: db.round2(a.credit - a.debit) })),
    equity: equity.map((a) => ({ ...a, balance: db.round2(a.credit - a.debit) })),
    assets_total: assetsTotal,
    liabilities_total: liabTotal,
    equity_total: eqTotal,
    net_income: pl.net_income,
    total_liabilities_equity: db.round2(liabTotal + totalEquity),
    balanced: Math.abs(assetsTotal - (liabTotal + totalEquity)) < 0.05,
  };
}

/* قائمة حقوق الملكية */
function equityStatement(from, to) {
  const equity = accountsWithBalance({ from, to, types: ['equity'] });
  const pl = incomeStatement(from, to);
  const capital = equity.filter((a) => a.code === CODES.CAPITAL).reduce((s, a) => s + (a.credit - a.debit), 0);
  const retained = equity.filter((a) => a.code === CODES.RETAINED).reduce((s, a) => s + (a.credit - a.debit), 0);
  const drawings = equity.filter((a) => a.nature === 'debit').reduce((s, a) => s + (a.debit - a.credit), 0);
  const opening = db.round2(capital + retained);
  return {
    rows: equity.map((a) => ({ code: a.code, name: a.name, name_en: a.name_en, amount: db.round2(a.credit - a.debit) })),
    capital: db.round2(capital),
    retained: db.round2(retained),
    drawings: db.round2(drawings),
    net_income: pl.net_income,
    opening_balance: opening,
    closing_balance: db.round2(opening + pl.net_income - drawings),
  };
}

/* دفتر الأستاذ لحساب */
function generalLedger(accountId, from, to) {
  const acc = accountById(accountId);
  const opening = accountNet(accountId, null, from ? db.addDays(from, -1) : null);
  const lines = db.all(
    `SELECT l.*, e.entry_no, e.date, e.description AS entry_desc, e.source
       FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
      WHERE l.account_id = ? AND e.status = 'posted' AND e.deleted_at IS NULL
        AND (? IS NULL OR e.date >= ?) AND (? IS NULL OR e.date <= ?)
      ORDER BY e.date, e.id`,
    accountId, from || null, from || null, to || null, to || null
  );
  let running = acc && acc.nature === 'credit' ? opening.credit - opening.debit : opening.net;
  const rows = lines.map((l) => {
    running += acc && acc.nature === 'credit' ? (l.credit - l.debit) : (l.debit - l.credit);
    return { ...l, running: db.round2(running) };
  });
  return { account: acc, opening: db.round2(running - rows.reduce((s, r) => s + 0, 0) === 0 ? 0 : (acc && acc.nature === 'credit' ? opening.credit - opening.debit : opening.net)), rows };
}

/* أرصدة الأطراف (عملاء/موردون) من القيود */
function partyBalance(accountCode, partyId) {
  const acc = accountByCode(accountCode);
  if (!acc) return 0;
  const row = db.get(
    `SELECT COALESCE(SUM(l.debit),0) AS d, COALESCE(SUM(l.credit),0) AS c
       FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
      WHERE l.account_id = ? AND l.party_id = ? AND e.status='posted' AND e.deleted_at IS NULL`,
    acc.id, partyId
  );
  return db.round2(Number(row.d) - Number(row.c));
}

module.exports = {
  CODES, accountByCode, accountById, resolveAccount,
  postEntry, voidEntry, nextEntryNo,
  treasuryApply, treasuryBalance,
  accountNet, accountsWithBalance, trialBalance, incomeStatement,
  balanceSheet, equityStatement, generalLedger, partyBalance,
};
