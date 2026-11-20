import { all, get } from './db.js';
import { round2, todayIso } from './util.js';

const DEFAULT_FROM = '2000-01-01';
const DEFAULT_TO = '2999-12-31';

function range(from, to) {
  return [from || DEFAULT_FROM, to || DEFAULT_TO];
}

function branchClause(branchId, alias = 'je') {
  return branchId ? ` AND ${alias}.branch_id = ${Number(branchId)}` : '';
}

/* ------------------------------------------------------------------ *
 * Currency conversion helpers
 * ------------------------------------------------------------------ */
let _baseCurrency = null;
let _rateCache = null; // key: `${base}|${quote}` -> [{date, rate}] asc

function getBaseCurrency() {
  if (_baseCurrency) return _baseCurrency;
  const row = get(`SELECT code FROM currencies WHERE is_base = 1 LIMIT 1`)
    || get(`SELECT value FROM settings WHERE scope='finance' AND key='base_currency' LIMIT 1`);
  _baseCurrency = row?.code || row?.value || 'USD';
  return _baseCurrency;
}

function loadRates() {
  if (_rateCache) return _rateCache;
  _rateCache = new Map();
  const rows = all(`SELECT base_code, quote_code, rate, effective_date FROM exchange_rates ORDER BY effective_date ASC, id ASC`);
  for (const r of rows) {
    const key = `${r.base_code}|${r.quote_code}`;
    if (!_rateCache.has(key)) _rateCache.set(key, []);
    _rateCache.get(key).push({ date: String(r.effective_date).slice(0, 10), rate: Number(r.rate) || 1 });
  }
  return _rateCache;
}

function directRate(from, to, date) {
  if (!from || !to || from === to) return 1;
  const cache = loadRates();
  const d = String(date || todayIso()).slice(0, 10);
  const key = `${from}|${to}`;
  const arr = cache.get(key);
  if (arr && arr.length) {
    let chosen = arr[0].rate;
    for (const item of arr) {
      if (item.date <= d) chosen = item.rate;
      else break;
    }
    return chosen || 1;
  }
  const inv = cache.get(`${to}|${from}`);
  if (inv && inv.length) {
    let chosen = inv[0].rate;
    for (const item of inv) {
      if (item.date <= d) chosen = item.rate;
      else break;
    }
    return chosen ? 1 / chosen : 1;
  }
  return null;
}

function fxRate(from, to, date) {
  if (!from || !to || from === to) return 1;
  let r = directRate(from, to, date);
  if (r != null) return r;
  const base = getBaseCurrency();
  if (from !== base && to !== base) {
    const r1 = directRate(from, base, date);
    const r2 = directRate(base, to, date);
    if (r1 != null && r2 != null) return r1 * r2;
  }
  return 1; // fallback: no known rate
}

function convertAmount(amount, date, targetCurrency, baseCurrency = null) {
  const base = baseCurrency || getBaseCurrency();
  const target = targetCurrency || base;
  if (!amount || base === target) return round2(amount || 0);
  return round2((Number(amount) || 0) * fxRate(base, target, date));
}

function postedLines({ from, to, branchId, extraWhere = '', extraParams = [] } = {}) {
  return all(
    `SELECT jl.account_id, jl.debit, jl.credit, jl.currency_code, jl.exchange_rate,
            je.entry_date, a.type, a.subtype, a.code, a.name_en, a.name_ar, a.is_group, a.parent_id
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.journal_entry_id
     JOIN accounts a ON a.id = jl.account_id
     WHERE je.status = 'posted' ${from ? 'AND je.entry_date >= ?' : ''} ${to ? 'AND je.entry_date <= ?' : ''} ${branchClause(branchId)} ${extraWhere}`,
    [...(from ? [from] : []), ...(to ? [to] : []), ...extraParams],
  );
}

/* ------------------------------------------------------------------ *
 * Trial balance
 * ------------------------------------------------------------------ */
export function trialBalance({ from, to, branchId, currency } = {}) {
  const [f, t] = range(from, to);
  const base = getBaseCurrency();
  const reportCurrency = currency || base;
  const accounts = all(`SELECT * FROM accounts WHERE is_active = 1 ORDER BY code`);
  const lines = all(
    `SELECT jl.account_id, jl.debit, jl.credit, je.entry_date
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE je.status = 'posted' ${branchClause(branchId)}`,
  );
  const map = new Map();
  for (const a of accounts) map.set(a.id, { open_debit: 0, open_credit: 0, debit: 0, credit: 0 });
  for (const l of lines) {
    const m = map.get(l.account_id);
    if (!m) continue;
    const d = String(l.entry_date).slice(0, 10);
    const dr = convertAmount(l.debit || 0, d, reportCurrency, base);
    const cr = convertAmount(l.credit || 0, d, reportCurrency, base);
    if (d < f) { m.open_debit += dr; m.open_credit += cr; }
    else if (d <= t) { m.debit += dr; m.credit += cr; }
  }
  const rows = accounts
    .map((a) => {
      const m = map.get(a.id) || { open_debit: 0, open_credit: 0, debit: 0, credit: 0 };
      const opening = round2(m.open_debit - m.open_credit);
      const debit = round2(m.debit);
      const credit = round2(m.credit);
      const closing = round2(opening + debit - credit);
      return {
        id: a.id, code: a.code, name_en: a.name_en, name_ar: a.name_ar, type: a.type,
        is_group: a.is_group, parent_id: a.parent_id,
        opening, debit, credit, closing,
        openingDebit: opening > 0 ? opening : 0,
        openingCredit: opening < 0 ? -opening : 0,
        closingDebit: closing > 0 ? closing : 0,
        closingCredit: closing < 0 ? -closing : 0,
      };
    })
    .filter((r) => r.is_group || r.opening || r.debit || r.credit || r.closing);

  const totals = rows.reduce(
    (acc, r) => ({
      openingDebit: round2(acc.openingDebit + r.openingDebit),
      openingCredit: round2(acc.openingCredit + r.openingCredit),
      debit: round2(acc.debit + r.debit),
      credit: round2(acc.credit + r.credit),
      closingDebit: round2(acc.closingDebit + r.closingDebit),
      closingCredit: round2(acc.closingCredit + r.closingCredit),
    }),
    { openingDebit: 0, openingCredit: 0, debit: 0, credit: 0, closingDebit: 0, closingCredit: 0 },
  );
  return { rows, totals, from: f, to: t, balanced: Math.abs(totals.closingDebit - totals.closingCredit) < 0.01, currency: reportCurrency, baseCurrency: base };
}

/* ------------------------------------------------------------------ *
 * Income statement
 * ------------------------------------------------------------------ */
export function incomeStatement({ from, to, branchId, comparative = false, currency } = {}) {
  const [f, t] = range(from, to);
  const base = getBaseCurrency();
  const reportCurrency = currency || base;
  const lines = all(
    `SELECT jl.account_id, jl.debit, jl.credit, je.entry_date,
            a.id, a.code, a.name_en, a.name_ar, a.type, a.subtype, a.is_group
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.journal_entry_id
     JOIN accounts a ON a.id = jl.account_id
     WHERE je.status = 'posted' AND je.entry_date BETWEEN ? AND ? ${branchClause(branchId)}
       AND a.type IN ('revenue','expense')`,
    [f, t],
  );
  const byAcc = new Map();
  for (const l of lines) {
    const d = String(l.entry_date).slice(0, 10);
    const dr = convertAmount(l.debit || 0, d, reportCurrency, base);
    const cr = convertAmount(l.credit || 0, d, reportCurrency, base);
    if (!byAcc.has(l.account_id)) byAcc.set(l.account_id, { ...l, debit: 0, credit: 0 });
    const acc = byAcc.get(l.account_id);
    acc.debit += dr; acc.credit += cr;
  }
  const revenue = [];
  const expenses = [];
  let totalRevenue = 0;
  let totalExpenses = 0;
  for (const r of byAcc.values()) {
    if (r.type === 'revenue') {
      const value = round2((r.credit || 0) - (r.debit || 0));
      if (!value) continue;
      revenue.push({ ...r, debit: round2(r.debit), credit: round2(r.credit), amount: value });
      totalRevenue += value;
    } else {
      const value = round2((r.debit || 0) - (r.credit || 0));
      if (!value) continue;
      expenses.push({ ...r, debit: round2(r.debit), credit: round2(r.credit), amount: value });
      totalExpenses += value;
    }
  }
  revenue.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  expenses.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  let comparativeData = null;
  if (comparative) {
    const yearMs = new Date(t).getTime() - new Date(f).getTime();
    const prevTo = new Date(new Date(f).getTime() - 86400000).toISOString().slice(0, 10);
    const prevFrom = new Date(new Date(f).getTime() - yearMs - 86400000).toISOString().slice(0, 10);
    comparativeData = incomeStatement({ from: prevFrom, to: prevTo, branchId, currency: reportCurrency });
  }
  const totalRevenueR = round2(totalRevenue);
  const totalExpensesR = round2(totalExpenses);
  return {
    revenue,
    expenses,
    totalRevenue: totalRevenueR,
    totalExpenses: totalExpensesR,
    grossProfit: totalRevenueR,
    netProfit: round2(totalRevenueR - totalExpensesR),
    margin: totalRevenueR ? round2(((totalRevenueR - totalExpensesR) / totalRevenueR) * 100) : 0,
    comparative: comparativeData,
    from: f,
    to: t,
    currency: reportCurrency,
    baseCurrency: base,
  };
}

/* ------------------------------------------------------------------ *
 * Balance sheet
 * ------------------------------------------------------------------ */
function balancesByType(asOf, branchId, reportCurrency, base) {
  const lines = all(
    `SELECT jl.account_id, jl.debit, jl.credit, je.entry_date,
            a.id, a.code, a.name_en, a.name_ar, a.type, a.subtype, a.is_group
     FROM accounts a
     LEFT JOIN journal_lines jl ON jl.account_id = a.id
     LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted' AND je.entry_date <= ?
     WHERE a.type IN ('asset','liability','equity') ${branchId ? `AND (a.branch_id IS NULL OR a.branch_id = ${Number(branchId)})` : ''}`,
    [asOf || DEFAULT_TO],
  );
  const byAcc = new Map();
  for (const l of lines) {
    if (!byAcc.has(l.account_id || l.id)) byAcc.set(l.account_id || l.id, { id: l.id, code: l.code, name_en: l.name_en, name_ar: l.name_ar, type: l.type, subtype: l.subtype, is_group: l.is_group, debit: 0, credit: 0 });
    const acc = byAcc.get(l.account_id || l.id);
    if (l.debit == null && l.credit == null) continue;
    const d = String(l.entry_date || asOf || todayIso()).slice(0, 10);
    acc.debit += convertAmount(l.debit || 0, d, reportCurrency, base);
    acc.credit += convertAmount(l.credit || 0, d, reportCurrency, base);
  }
  return [...byAcc.values()].sort((a, b) => String(a.code).localeCompare(String(b.code)));
}

export function balanceSheet({ asOf, branchId, currency } = {}) {
  const date = asOf || todayIso();
  const base = getBaseCurrency();
  const reportCurrency = currency || base;
  const rows = balancesByType(date, branchId, reportCurrency, base);
  const income = incomeStatement({ from: DEFAULT_FROM, to: date, branchId, currency: reportCurrency });
  const assets = [];
  const liabilities = [];
  const equity = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  for (const r of rows) {
    const net = round2((r.debit || 0) - (r.credit || 0));
    if (r.type === 'asset') {
      const amount = net;
      if (!amount && !r.is_group) continue;
      assets.push({ ...r, amount });
      totalAssets += amount;
    } else if (r.type === 'liability') {
      const amount = round2(-net);
      if (!amount && !r.is_group) continue;
      liabilities.push({ ...r, amount });
      totalLiabilities += amount;
    } else if (r.type === 'equity') {
      const amount = round2(-net);
      if (!amount && !r.is_group) continue;
      equity.push({ ...r, amount });
      totalEquity += amount;
    }
  }

  const netProfit = income.netProfit;
  totalEquity = round2(totalEquity + netProfit);

  const sum = (arr, key = 'amount') => round2(arr.reduce((s, r) => s + (r[key] || 0), 0));
  return {
    asOf: date,
    assets: { items: assets, total: round2(sum(assets)) },
    liabilities: { items: liabilities, total: round2(sum(liabilities)) },
    equity: { items: equity, total: totalEquity },
    netProfit,
    totalLiabilitiesAndEquity: round2(sum(liabilities) + totalEquity),
    difference: round2(sum(assets) - (sum(liabilities) + totalEquity)),
    balanced: Math.abs(sum(assets) - (sum(liabilities) + totalEquity)) < 0.5,
    currency: reportCurrency,
    baseCurrency: base,
  };
}

/* ------------------------------------------------------------------ *
 * Statement of changes in equity
 * ------------------------------------------------------------------ */
export function equityChanges({ from, to, branchId, currency } = {}) {
  const [f, t] = range(from, to);
  const base = getBaseCurrency();
  const reportCurrency = currency || base;
  const lines = all(
    `SELECT jl.account_id, jl.debit, jl.credit, je.entry_date,
            a.id, a.code, a.name_en, a.name_ar
     FROM accounts a
     JOIN journal_lines jl ON jl.account_id = a.id
     JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE a.type = 'equity' AND je.status = 'posted' ${branchClause(branchId)}`,
  );
  const openMap = new Map();
  const moveMap = new Map();
  for (const l of lines) {
    const d = String(l.entry_date).slice(0, 10);
    const net = convertAmount((l.debit || 0) - (l.credit || 0), d, reportCurrency, base);
    if (d < f) openMap.set(l.account_id, (openMap.get(l.account_id) || 0) + net);
    else if (d <= t) moveMap.set(l.account_id, (moveMap.get(l.account_id) || 0) + net);
  }
  const accounts = all(`SELECT id, code, name_en, name_ar FROM accounts WHERE type='equity' ORDER BY code`);
  const opening = [];
  const movements = [];
  let openingTotal = 0;
  let movementTotal = 0;
  for (const a of accounts) {
    const o = round2(-(openMap.get(a.id) || 0));
    const m = round2(-(moveMap.get(a.id) || 0));
    if (o) { opening.push({ ...a, amount: o }); openingTotal += o; }
    if (m) { movements.push({ ...a, amount: m }); movementTotal += m; }
  }
  const income = incomeStatement({ from: f, to: t, branchId, currency: reportCurrency });
  return {
    from: f,
    to: t,
    opening,
    openingTotal: round2(openingTotal),
    movements,
    movementTotal: round2(movementTotal),
    netProfit: income.netProfit,
    closingTotal: round2(openingTotal + movementTotal + income.netProfit),
    currency: reportCurrency,
    baseCurrency: base,
  };
}

/* ------------------------------------------------------------------ *
 * Cash flow (simplified indirect method)
 * ------------------------------------------------------------------ */
export function cashFlow({ from, to, branchId, currency } = {}) {
  const [f, t] = range(from, to);
  const base = getBaseCurrency();
  const reportCurrency = currency || base;
  const cashAccounts = all(`SELECT id FROM accounts WHERE (subtype IN ('cash','bank') OR is_bank = 1) AND type = 'asset'`);
  const cashIds = new Set(cashAccounts.map((a) => a.id));
  if (!cashIds.size) return { from: f, to: t, operating: { items: [], total: 0 }, investing: { items: [], total: 0 }, financing: { items: [], total: 0 }, netChange: 0, opening: 0, closing: 0, currency: reportCurrency, baseCurrency: base };

  const lines = all(
    `SELECT jl.journal_entry_id, jl.account_id, jl.debit, jl.credit, je.entry_date,
            a.type AS counter_type, a.subtype AS counter_subtype, a.name_en, a.name_ar, a.code
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.journal_entry_id
     JOIN accounts a ON a.id = jl.account_id
     WHERE je.status = 'posted' ${branchClause(branchId)}`,
  );
  const byEntry = new Map();
  for (const l of lines) {
    if (!byEntry.has(l.journal_entry_id)) byEntry.set(l.journal_entry_id, []);
    byEntry.get(l.journal_entry_id).push(l);
  }

  const buckets = { operating: new Map(), investing: new Map(), financing: new Map() };
  let opening = 0;
  let netChange = 0;

  for (const [eid, els] of byEntry) {
    const date = String(els[0].entry_date).slice(0, 10);
    let cashDelta = 0;
    for (const l of els) if (cashIds.has(l.account_id)) {
      cashDelta += convertAmount((l.debit || 0) - (l.credit || 0), date, reportCurrency, base);
    }
    if (!cashDelta) continue;
    if (date < f) { opening += cashDelta; continue; }
    if (date > t) continue;
    netChange += cashDelta;
    // attribute counter impact
    for (const l of els) {
      if (cashIds.has(l.account_id)) continue;
      const amount = -convertAmount((l.debit || 0) - (l.credit || 0), date, reportCurrency, base);
      if (!amount) continue;
      let bucket = 'operating';
      if (l.counter_type === 'asset' && l.counter_subtype === 'fixed-asset') bucket = 'investing';
      else if (l.counter_type === 'liability' || l.counter_type === 'equity') bucket = 'financing';
      else if (l.counter_type === 'revenue' || l.counter_type === 'expense') bucket = 'operating';
      const key = `${bucket}:${l.account_id}`;
      const map = buckets[bucket];
      if (!map.has(key)) map.set(key, { code: l.code, name_en: l.name_en, name_ar: l.name_ar, counter_type: l.counter_type, counter_subtype: l.counter_subtype, amount: 0 });
      map.get(key).amount += amount;
    }
  }

  const finalize = (map) => {
    const items = [...map.values()].map((x) => ({ ...x, amount: round2(x.amount) })).filter((x) => x.amount);
    return { items, total: round2(items.reduce((s, r) => s + r.amount, 0)) };
  };
  return {
    from: f,
    to: t,
    operating: finalize(buckets.operating),
    investing: finalize(buckets.investing),
    financing: finalize(buckets.financing),
    opening: round2(opening),
    netChange: round2(netChange),
    closing: round2(opening + netChange),
    currency: reportCurrency,
    baseCurrency: base,
  };
}

/* ------------------------------------------------------------------ *
 * General ledger & account statement
 * ------------------------------------------------------------------ */
export function generalLedger({ accountId, from, to, branchId, currency } = {}) {
  const [f, t] = range(from, to);
  const base = getBaseCurrency();
  const reportCurrency = currency || base;
  const account = get(`SELECT * FROM accounts WHERE id = ?`, [accountId]);
  if (!account) return null;
  const pre = all(
    `SELECT jl.debit, jl.credit, je.entry_date FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE jl.account_id = ? AND je.status = 'posted' AND je.entry_date < ? ${branchClause(branchId)}`,
    [accountId, f],
  );
  let opening = 0;
  for (const l of pre) {
    const d = String(l.entry_date).slice(0, 10);
    opening += convertAmount((l.debit || 0) - (l.credit || 0), d, reportCurrency, base);
  }
  opening = round2(opening);
  const lines = all(
    `SELECT jl.id, je.entry_date, je.entry_no, je.description_en, je.description_ar, jl.description,
            jl.debit, jl.credit, je.source, je.reference
     FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE jl.account_id = ? AND je.status = 'posted' AND je.entry_date BETWEEN ? AND ? ${branchClause(branchId)}
     ORDER BY je.entry_date, je.id, jl.sort_order`,
    [accountId, f, t],
  );
  let running = opening;
  const rows = lines.map((l) => {
    const d = String(l.entry_date).slice(0, 10);
    const debit = convertAmount(l.debit || 0, d, reportCurrency, base);
    const credit = convertAmount(l.credit || 0, d, reportCurrency, base);
    running = round2(running + debit - credit);
    return { ...l, debit, credit, balance: running };
  });
  return {
    account,
    from: f,
    to: t,
    opening,
    rows,
    totalDebit: round2(rows.reduce((s, l) => s + (l.debit || 0), 0)),
    totalCredit: round2(rows.reduce((s, l) => s + (l.credit || 0), 0)),
    closing: running,
    currency: reportCurrency,
    baseCurrency: base,
  };
}

/* ------------------------------------------------------------------ *
 * Receivables aging
 * ------------------------------------------------------------------ */
export function aging({ asOf } = {}) {
  const date = asOf || todayIso();
  const rows = all(
    `SELECT i.id, i.invoice_no, i.due_date, i.total, i.paid_total, i.balance, i.currency_code,
            s.id AS student_id, s.code AS student_code, s.first_name_en, s.last_name_en, s.first_name_ar, s.last_name_ar
     FROM invoices i JOIN students s ON s.id = i.student_id
     WHERE i.balance > 0 AND i.status <> 'cancelled' AND i.due_date <= ?
     ORDER BY i.due_date`,
    [date],
  );
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
  const detail = rows.map((r) => {
    const days = Math.floor((new Date(date) - new Date(r.due_date)) / 86400000);
    let bucket = 'current';
    if (days > 90) bucket = 'over90';
    else if (days > 60) bucket = 'd90';
    else if (days > 30) bucket = 'd60';
    else if (days > 0) bucket = 'd30';
    buckets[bucket] = round2(buckets[bucket] + r.balance);
    return { ...r, days_overdue: days, bucket };
  });
  return { asOf: date, buckets, detail, total: round2(Object.values(buckets).reduce((a, b) => a + b, 0)) };
}

/* ------------------------------------------------------------------ *
 * Student statement
 * ------------------------------------------------------------------ */
export function studentStatement(studentId, { from, to } = {}) {
  const [f, t] = range(from, to);
  const student = get(`SELECT * FROM students WHERE id = ?`, [studentId]);
  if (!student) return null;
  const invoices = all(`SELECT * FROM invoices WHERE student_id = ? AND issue_date BETWEEN ? AND ? ORDER BY issue_date`, [studentId, f, t]);
  const payments = all(`SELECT * FROM payments WHERE student_id = ? AND payment_date BETWEEN ? AND ? ORDER BY payment_date`, [studentId, f, t]);
  const events = [
    ...invoices.map((i) => ({ date: i.issue_date, type: 'invoice', ref: i.invoice_no, debit: i.total, credit: 0, description_en: 'Invoice', description_ar: 'فاتورة', id: i.id })),
    ...payments.map((p) => ({ date: p.payment_date, type: 'payment', ref: p.receipt_no, debit: 0, credit: p.amount, description_en: 'Payment received', description_ar: 'دفعة مستلمة', id: p.id })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let running = 0;
  const ledger = events.map((e) => {
    running = round2(running + e.debit - e.credit);
    return { ...e, balance: running };
  });
  const totalInvoiced = round2(invoices.reduce((s, i) => s + i.total, 0));
  const totalPaid = round2(payments.reduce((s, p) => s + p.amount, 0));
  return {
    student,
    from: f,
    to: t,
    ledger,
    totalInvoiced,
    totalPaid,
    balance: round2(totalInvoiced - totalPaid),
  };
}

/* ------------------------------------------------------------------ *
 * Operational reports
 * ------------------------------------------------------------------ */
export function feeCollection({ from, to, branchId } = {}) {
  const [f, t] = range(from, to);
  const rows = all(
    `SELECT pm.name_en AS method_en, pm.name_ar AS method_ar, pm.code,
            COUNT(*) AS count, SUM(p.amount) AS amount, SUM(p.base_amount) AS base_amount
     FROM payments p LEFT JOIN payment_methods pm ON pm.id = p.method_id
     WHERE p.payment_date BETWEEN ? AND ? AND p.status = 'completed' ${branchId ? `AND p.branch_id = ${Number(branchId)}` : ''}
     GROUP BY p.method_id ORDER BY amount DESC`,
    [f, t],
  );
  const total = round2(rows.reduce((s, r) => s + (r.amount || 0), 0));
  const invoiced = round2(
    get(
      `SELECT SUM(total) AS s FROM invoices WHERE issue_date BETWEEN ? AND ? AND status <> 'cancelled' ${branchId ? `AND branch_id = ${Number(branchId)}` : ''}`,
      [f, t],
    )?.s || 0,
  );
  const byMonth = all(
    `SELECT substr(payment_date,1,7) AS month, SUM(amount) AS amount FROM payments
     WHERE payment_date BETWEEN ? AND ? AND status='completed' GROUP BY month ORDER BY month`,
    [f, t],
  );
  return { rows, total, invoiced, collectionRate: invoiced ? round2((total / invoiced) * 100) : 0, byMonth, from: f, to: t };
}

export function attendanceSummary({ from, to, sectionId } = {}) {
  const [f, t] = range(from, to);
  const rows = all(
    `SELECT status, COUNT(*) AS count FROM attendance_records
     WHERE date BETWEEN ? AND ? ${sectionId ? `AND section_id = ${Number(sectionId)}` : ''}
     GROUP BY status`,
    [f, t],
  );
  const total = rows.reduce((s, r) => s + r.count, 0);
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.count]));
  const bySection = all(
    `SELECT s.id, s.name_en, s.name_ar,
            SUM(CASE WHEN ar.status='present' THEN 1 ELSE 0 END) AS present,
            SUM(CASE WHEN ar.status='absent' THEN 1 ELSE 0 END) AS absent,
            COUNT(*) AS total
     FROM attendance_records ar JOIN sections s ON s.id = ar.section_id
     WHERE ar.date BETWEEN ? AND ? GROUP BY s.id ORDER BY s.name_en`,
    [f, t],
  );
  return {
    total,
    present: byStatus.present || 0,
    absent: byStatus.absent || 0,
    late: byStatus.late || 0,
    excused: byStatus.excused || 0,
    sick: byStatus.sick || 0,
    rate: total ? round2(((byStatus.present || 0) / total) * 100) : 0,
    bySection: bySection.map((r) => ({ ...r, rate: r.total ? round2((r.present / r.total) * 100) : 0 })),
    from: f,
    to: t,
  };
}

export function enrollmentStats({ academicYearId } = {}) {
  const byGrade = all(
    `SELECT g.id, g.name_en, g.name_ar, g.sort_order, COUNT(s.id) AS count
     FROM grade_levels g LEFT JOIN students s ON s.grade_level_id = g.id AND s.status = 'active'
     ${academicYearId ? `AND s.academic_year_id = ${Number(academicYearId)}` : ''}
     GROUP BY g.id ORDER BY g.sort_order`,
  );
  const byGender = all(`SELECT gender, COUNT(*) AS count FROM students WHERE status='active' GROUP BY gender`);
  const byStatus = all(`SELECT status, COUNT(*) AS count FROM students GROUP BY status`);
  const byNationality = all(`SELECT nationality, COUNT(*) AS count FROM students WHERE nationality IS NOT NULL GROUP BY nationality ORDER BY count DESC LIMIT 10`);
  const byBranch = all(
    `SELECT b.id, b.name_en, b.name_ar, COUNT(s.id) AS count FROM branches b
     LEFT JOIN students s ON s.branch_id = b.id AND s.status='active' GROUP BY b.id`,
  );
  return { byGrade, byGender, byStatus, byNationality, byBranch, total: byGrade.reduce((s, r) => s + r.count, 0) };
}

export function payrollSummary({ runId } = {}) {
  const run = runId ? get(`SELECT * FROM payroll_runs WHERE id = ?`, [runId]) : get(`SELECT * FROM payroll_runs ORDER BY id DESC LIMIT 1`);
  const rows = run
    ? all(
        `SELECT ps.*, st.first_name_en, st.last_name_en, st.first_name_ar, st.last_name_ar, st.code
         FROM payslips ps JOIN staff st ON st.id = ps.staff_id WHERE ps.payroll_run_id = ?`,
        [run.id],
      )
    : [];
  return { run, rows, total: round2(rows.reduce((s, r) => s + (r.net || 0), 0)) };
}

export function budgetVariance({ fiscalYearId } = {}) {
  const rows = all(
    `SELECT b.id, b.amount AS budget, a.code, a.name_en, a.name_ar, a.type,
            COALESCE((SELECT SUM(jl.debit - jl.credit) FROM journal_lines jl
                      JOIN journal_entries je ON je.id = jl.journal_entry_id
                      WHERE jl.account_id = b.account_id AND je.status='posted'),0) AS actual
     FROM budgets b JOIN accounts a ON a.id = b.account_id
     ${fiscalYearId ? `WHERE b.fiscal_year_id = ${Number(fiscalYearId)}` : ''}
     ORDER BY a.code`,
  );
  return {
    rows: rows.map((r) => ({ ...r, actual: round2(Math.abs(r.actual)), variance: round2(r.budget - Math.abs(r.actual)) })),
  };
}

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */
export function dashboard({ branchId } = {}) {
  const bf = branchId ? `AND branch_id = ${Number(branchId)}` : '';
  const today = todayIso();
  const monthStart = today.slice(0, 7) + '-01';
  const yearStart = new Date().getFullYear() + '-01-01';

  const students = get(`SELECT COUNT(*) AS c FROM students WHERE status='active' ${bf}`)?.c || 0;
  const teachers = get(`SELECT COUNT(*) AS c FROM staff WHERE is_teacher=1 AND status='active' ${bf}`)?.c || 0;
  const staff = get(`SELECT COUNT(*) AS c FROM staff WHERE status='active' ${bf}`)?.c || 0;
  const sections = get(`SELECT COUNT(*) AS c FROM sections WHERE is_active=1 ${bf}`)?.c || 0;
  const branches = get(`SELECT COUNT(*) AS c FROM branches WHERE is_active=1`)?.c || 0;

  const att = all(
    `SELECT status, COUNT(*) AS count FROM attendance_records WHERE date = ? ${bf} GROUP BY status`,
    [today],
  );
  const attMap = Object.fromEntries(att.map((r) => [r.status, r.count]));
  const attTotal = att.reduce((s, r) => s + r.count, 0);

  const collected = round2(get(`SELECT SUM(amount) AS s FROM payments WHERE status='completed' AND payment_date >= ? ${bf}`, [monthStart])?.s || 0);
  const outstanding = round2(get(`SELECT SUM(balance) AS s FROM invoices WHERE balance > 0 AND status <> 'cancelled' ${bf}`)?.s || 0);
  const expensesMonth = round2(get(`SELECT SUM(amount) AS s FROM expenses WHERE expense_date >= ? ${bf}`, [monthStart])?.s || 0);
  const income = incomeStatement({ from: yearStart, to: today, branchId });

  const revenueByMonth = all(
    `SELECT substr(je.entry_date,1,7) AS month,
            SUM(CASE WHEN a.type='revenue' THEN jl.credit - jl.debit ELSE 0 END) AS revenue,
            SUM(CASE WHEN a.type='expense' THEN jl.debit - jl.credit ELSE 0 END) AS expense
     FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
     JOIN accounts a ON a.id = jl.account_id
     WHERE je.status='posted' AND je.entry_date >= ? GROUP BY month ORDER BY month`,
    [new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)],
  );

  const enrollmentByGrade = all(
    `SELECT g.name_en, g.name_ar, g.sort_order, COUNT(s.id) AS count
     FROM grade_levels g LEFT JOIN students s ON s.grade_level_id = g.id AND s.status='active'
     GROUP BY g.id ORDER BY g.sort_order`,
  );

  const upcomingEvents = all(
    `SELECT id, title_en, title_ar, start_at, type, location FROM events
     WHERE start_at >= ? ORDER BY start_at LIMIT 5`,
    [today],
  );
  const recentActivity = all(
    `SELECT id, username, action, entity, summary, created_at FROM audit_log ORDER BY id DESC LIMIT 8`,
  );
  const pendingTasks = all(
    `SELECT id, title_en, title_ar, due_date, priority, status FROM todos WHERE status IN ('open','in-progress') ORDER BY due_date LIMIT 6`,
  );
  const topDebtors = all(
    `SELECT s.id, s.code, s.first_name_en, s.last_name_en, s.first_name_ar, s.last_name_ar, SUM(i.balance) AS balance
     FROM invoices i JOIN students s ON s.id = i.student_id
     WHERE i.balance > 0 GROUP BY s.id ORDER BY balance DESC LIMIT 5`,
  );
  const branchPerformance = all(
    `SELECT b.id, b.name_en, b.name_ar,
            (SELECT COUNT(*) FROM students s WHERE s.branch_id = b.id AND s.status='active') AS students,
            (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.branch_id = b.id AND p.payment_date >= ?) AS collected
     FROM branches b WHERE b.is_active = 1`,
    [monthStart],
  );

  const invoicesByStatus = all(`SELECT status, COUNT(*) AS count, SUM(total) AS total FROM invoices GROUP BY status`);
  const genderSplit = all(`SELECT gender, COUNT(*) AS count FROM students WHERE status='active' GROUP BY gender`);

  return {
    kpis: {
      students, teachers, staff, sections, branches,
      attendanceRate: attTotal ? round2(((attMap.present || 0) / attTotal) * 100) : 0,
      attendanceToday: { present: attMap.present || 0, absent: attMap.absent || 0, late: attMap.late || 0, total: attTotal },
      collected, outstanding, expensesMonth,
      netIncome: income.netProfit, revenue: income.totalRevenue, expenses: income.totalExpenses,
    },
    revenueByMonth,
    enrollmentByGrade,
    upcomingEvents,
    recentActivity,
    pendingTasks,
    topDebtors,
    branchPerformance,
    invoicesByStatus,
    genderSplit,
    generatedAt: new Date().toISOString(),
  };
}
