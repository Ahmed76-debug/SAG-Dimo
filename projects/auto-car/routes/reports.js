'use strict';
/* ============================================================
   Auto Car — التقارير المالية والإدارية
   ============================================================ */
const db = require('../lib/db');
const acc = require('../lib/accounting');

module.exports = function reportRoutes(app) {
  const { add, int, num, str, get, all, round2, rangeFromQuery, todayStr, addDays } = app;

  add('GET', '/api/reports/trial-balance', null, (ctx) => {
    const { from, to } = rangeFromQuery(ctx.url);
    return { from, to, ...acc.trialBalance(from, to) };
  });

  add('GET', '/api/reports/income-statement', null, (ctx) => {
    const { from, to } = rangeFromQuery(ctx.url);
    return { from, to, ...acc.incomeStatement(from, to) };
  });

  add('GET', '/api/reports/balance-sheet', null, (ctx) => {
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(ctx.url.searchParams.get('as_of') || '') ? ctx.url.searchParams.get('as_of') : todayStr();
    return { as_of: asOf, ...acc.balanceSheet(asOf) };
  });

  add('GET', '/api/reports/equity', null, (ctx) => {
    const { from, to } = rangeFromQuery(ctx.url);
    return { from, to, ...acc.equityStatement(from, to) };
  });

  add('GET', '/api/reports/general-ledger', null, (ctx) => {
    const accountId = int(ctx.url.searchParams.get('account_id'));
    if (!accountId) app.fail('حدّد الحساب');
    const { from, to } = rangeFromQuery(ctx.url);
    return { from, to, ...acc.generalLedger(accountId, from, to) };
  });

  add('GET', '/api/reports/account-statement', null, (ctx) => {
    const accountId = int(ctx.url.searchParams.get('account_id'));
    if (!accountId) app.fail('حدّد الحساب');
    const { from, to } = rangeFromQuery(ctx.url);
    const account = acc.accountById(accountId);
    const opening = acc.accountNet(accountId, null, addDays(from, -1));
    const lines = all(`SELECT l.*, e.entry_no, e.date, e.description AS entry_desc, e.source
                       FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id
                       WHERE l.account_id=? AND e.status='posted' AND e.deleted_at IS NULL AND e.date>=? AND e.date<=?
                       ORDER BY e.date, e.id`, accountId, from, to);
    let running = account.nature === 'credit' ? opening.credit - opening.debit : opening.net;
    const rows = lines.map((l) => { running += account.nature === 'credit' ? (l.credit - l.debit) : (l.debit - l.credit); return { ...l, running: round2(running) }; });
    return { from, to, account, opening: round2(account.nature === 'credit' ? opening.credit - opening.debit : opening.net), rows, closing: round2(running) };
  });

  /* ---------- تقارير المبيعات ---------- */
  add('GET', '/api/reports/sales', null, (ctx) => {
    const { from, to } = rangeFromQuery(ctx.url);
    const summary = get(`SELECT COUNT(*) AS invoices, COALESCE(SUM(total),0) AS total, COALESCE(SUM(paid),0) AS paid,
                         COALESCE(SUM(remaining),0) AS remaining, COALESCE(SUM(profit),0) AS profit, COALESCE(SUM(commission_amount),0) AS commission
                         FROM sales WHERE deleted_at IS NULL AND status='completed' AND date BETWEEN ? AND ?`, from, to);
    const byType = all(`SELECT sale_type AS type, COUNT(*) AS count, COALESCE(SUM(total),0) AS total, COALESCE(SUM(profit),0) AS profit
                        FROM sales WHERE deleted_at IS NULL AND status='completed' AND date BETWEEN ? AND ? GROUP BY sale_type`, from, to);
    const byDay = all(`SELECT date, COUNT(*) AS count, COALESCE(SUM(total),0) AS total, COALESCE(SUM(profit),0) AS profit
                       FROM sales WHERE deleted_at IS NULL AND status='completed' AND date BETWEEN ? AND ? GROUP BY date ORDER BY date`, from, to);
    const byUser = all(`SELECT COALESCE(u.name,'—') AS name, COUNT(*) AS count, COALESCE(SUM(s.total),0) AS total
                        FROM sales s LEFT JOIN users u ON u.id=s.user_id WHERE s.deleted_at IS NULL AND s.status='completed' AND s.date BETWEEN ? AND ? GROUP BY s.user_id ORDER BY total DESC`, from, to);
    const byBrand = all(`SELECT COALESCE(b.name,'غير محدد') AS name, COUNT(*) AS count, COALESCE(SUM(si.total),0) AS total
                         FROM sale_items si JOIN sales s ON s.id=si.sale_id LEFT JOIN vehicles v ON v.id=si.vehicle_id LEFT JOIN brands b ON b.id=v.brand_id
                         WHERE s.deleted_at IS NULL AND s.status='completed' AND s.date BETWEEN ? AND ? GROUP BY b.id ORDER BY total DESC`, from, to);
    return { from, to, summary, byType, byDay, byUser, byBrand };
  });

  add('GET', '/api/reports/purchases', null, (ctx) => {
    const { from, to } = rangeFromQuery(ctx.url);
    const summary = get(`SELECT COUNT(*) AS invoices, COALESCE(SUM(total),0) AS total, COALESCE(SUM(paid),0) AS paid, COALESCE(SUM(remaining),0) AS remaining
                         FROM purchases WHERE deleted_at IS NULL AND date BETWEEN ? AND ?`, from, to);
    const bySupplier = all(`SELECT COALESCE(s.name,'—') AS name, COUNT(*) AS count, COALESCE(SUM(p.total),0) AS total
                            FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE p.deleted_at IS NULL AND p.date BETWEEN ? AND ? GROUP BY p.supplier_id ORDER BY total DESC`, from, to);
    return { from, to, summary, bySupplier };
  });

  add('GET', '/api/reports/inventory', null, (ctx) => {
    const items = all(`SELECT v.*, b.name AS brand_name, m.name AS model_name,
                       CAST(julianday('now','localtime') - julianday(v.entry_date) AS INTEGER) AS days_in_stock
                       FROM vehicles v LEFT JOIN brands b ON b.id=v.brand_id LEFT JOIN car_models m ON m.id=v.model_id
                       WHERE v.deleted_at IS NULL AND v.status IN ('available','reserved') ORDER BY days_in_stock DESC`);
    const totalCost = round2(items.reduce((s, v) => s + (v.ownership === 'own' ? num(v.cost_price) + num(v.extra_cost) : 0), 0));
    const totalTarget = round2(items.reduce((s, v) => s + num(v.target_price), 0));
    return { items, total_cost: totalCost, total_target: totalTarget, expected_profit: round2(totalTarget - totalCost), count: items.length };
  });

  add('GET', '/api/reports/receivables', null, () => {
    const items = all(`SELECT c.id, c.name, c.phone, c.balance FROM customers c WHERE c.deleted_at IS NULL AND c.balance > 0 ORDER BY c.balance DESC`);
    const total = round2(items.reduce((s, c) => s + num(c.balance), 0));
    return { items, total };
  });

  add('GET', '/api/reports/payables', null, () => {
    const items = all(`SELECT s.id, s.name, s.phone, s.balance FROM suppliers s WHERE s.deleted_at IS NULL AND s.balance > 0 ORDER BY s.balance DESC`);
    const total = round2(items.reduce((s, c) => s + num(c.balance), 0));
    return { items, total };
  });

  add('GET', '/api/reports/installments', null, (ctx) => {
    const { from, to } = rangeFromQuery(ctx.url);
    const summary = get(`SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS amount, COALESCE(SUM(paid_amount),0) AS paid
                         FROM installments WHERE due_date BETWEEN ? AND ?`, from, to);
    const byStatus = all(`SELECT status, COUNT(*) AS count, COALESCE(SUM(amount-paid_amount),0) AS remaining FROM installments GROUP BY status`);
    const overdue = all(`SELECT i.*, c.name AS customer_name, c.phone FROM installments i LEFT JOIN customers c ON c.id=i.customer_id
                         WHERE i.status IN ('pending','partial','overdue') AND i.due_date < ? ORDER BY i.due_date`, todayStr());
    return { from, to, summary, byStatus, overdue };
  });

  add('GET', '/api/reports/profit', null, (ctx) => {
    const { from, to } = rangeFromQuery(ctx.url);
    const pl = acc.incomeStatement(from, to);
    const vehicleProfit = get(`SELECT COALESCE(SUM(profit),0) AS s FROM sales WHERE deleted_at IS NULL AND status='completed' AND date BETWEEN ? AND ?`, from, to).s;
    const commission = get(`SELECT COALESCE(SUM(commission_amount),0) AS s FROM sales WHERE deleted_at IS NULL AND status='completed' AND date BETWEEN ? AND ?`, from, to).s;
    return { from, to, ...pl, vehicle_profit: round2(num(vehicleProfit)), commission: round2(num(commission)) };
  });
};
