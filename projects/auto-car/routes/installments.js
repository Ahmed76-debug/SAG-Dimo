'use strict';
/* ============================================================
   Auto Car — التقسيط: الخطط، جدول الأقساط، الدفعات، المتأخرات
   ============================================================ */
const db = require('../lib/db');
const acc = require('../lib/accounting');

module.exports = function installmentRoutes(app) {
  const { add, fail, str, int, num, get, all, run, round2, ctxAudit } = app;

  function refreshOverdue() {
    const today = db.todayStr();
    run(`UPDATE installments SET status='overdue' WHERE status IN ('pending','partial') AND due_date < ?`, today);
    run(`UPDATE installments SET status='paid' WHERE paid_amount >= amount - 0.01 AND status <> 'paid'`);
  }

  function recomputeCustomer(id) {
    if (!id) return;
    const account = acc.accountByCode(acc.CODES.AR);
    const r = get(`SELECT COALESCE(SUM(l.debit),0) AS d, COALESCE(SUM(l.credit),0) AS c FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id WHERE l.account_id=? AND l.party_id=? AND e.status='posted' AND e.deleted_at IS NULL`, account.id, id);
    db.update('customers', id, { balance: round2(Number(r.d) - Number(r.c)) });
  }

  add('GET', '/api/installments/plans', null, (ctx) => {
    refreshOverdue();
    const where = ['p.deleted_at IS NULL'];
    const params = [];
    if (ctx.url.searchParams.get('status')) { where.push('p.status = ?'); params.push(str(ctx.url.searchParams.get('status'), 20)); }
    if (ctx.url.searchParams.get('customer_id')) { where.push('p.customer_id = ?'); params.push(int(ctx.url.searchParams.get('customer_id'))); }
    const q = str(ctx.url.searchParams.get('q'), 60);
    if (q) { where.push('(c.name LIKE ? OR s.invoice_no LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const whereSql = 'WHERE ' + where.join(' AND ');
    const base = `FROM installment_plans p LEFT JOIN customers c ON c.id=p.customer_id LEFT JOIN sales s ON s.id=p.sale_id`;
    const items = all(
      `SELECT p.*, c.name AS customer_name, s.invoice_no,
              (SELECT COUNT(*) FROM installments i WHERE i.plan_id=p.id) AS count_total,
              (SELECT COUNT(*) FROM installments i WHERE i.plan_id=p.id AND i.status='paid') AS count_paid,
              (SELECT COALESCE(SUM(i.amount - i.paid_amount),0) FROM installments i WHERE i.plan_id=p.id) AS remaining
       ${base} ${whereSql} ORDER BY p.id DESC LIMIT 300`, ...params);
    return { items };
  });

  add('GET', '/api/installments/plans/:id', null, (ctx) => {
    refreshOverdue();
    const p = get(`SELECT p.*, c.name AS customer_name, c.phone AS customer_phone, s.invoice_no FROM installment_plans p
                   LEFT JOIN customers c ON c.id=p.customer_id LEFT JOIN sales s ON s.id=p.sale_id WHERE p.id = ?`, int(ctx.params.id));
    if (!p) fail('خطة التقسيط غير موجودة', 404);
    p.installments = all('SELECT * FROM installments WHERE plan_id = ? ORDER BY seq', p.id);
    p.payments = all('SELECT ip.*, t.name AS treasury_name, u.name AS user_name FROM installment_payments ip LEFT JOIN treasuries t ON t.id=ip.treasury_id LEFT JOIN users u ON u.id=ip.user_id WHERE ip.plan_id = ? ORDER BY ip.id DESC', p.id);
    return { item: p };
  });

  add('GET', '/api/installments', null, (ctx) => {
    refreshOverdue();
    const where = [];
    const params = [];
    const status = str(ctx.url.searchParams.get('status'), 20);
    if (status) { where.push('i.status = ?'); params.push(status); }
    if (ctx.url.searchParams.get('customer_id')) { where.push('i.customer_id = ?'); params.push(int(ctx.url.searchParams.get('customer_id'))); }
    const from = ctx.url.searchParams.get('from'), to = ctx.url.searchParams.get('to');
    if (from) { where.push('i.due_date >= ?'); params.push(from); }
    if (to) { where.push('i.due_date <= ?'); params.push(to); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const items = all(`SELECT i.*, c.name AS customer_name, c.phone AS customer_phone, s.invoice_no
                       FROM installments i LEFT JOIN customers c ON c.id=i.customer_id LEFT JOIN sales s ON s.id=i.sale_id
                       ${whereSql} ORDER BY i.due_date LIMIT 500`, ...params);
    const totals = get(`SELECT COALESCE(SUM(i.amount),0) AS amount, COALESCE(SUM(i.paid_amount),0) AS paid,
                        COALESCE(SUM(CASE WHEN i.status IN ('pending','partial','overdue') THEN i.amount-i.paid_amount ELSE 0 END),0) AS remaining
                        FROM installments i ${whereSql}`, ...params);
    return { items, totals };
  });

  add('POST', '/api/installments/:id/pay', 'installments.manage', (ctx) => {
    refreshOverdue();
    const id = int(ctx.params.id);
    const inst = get('SELECT * FROM installments WHERE id = ?', id);
    if (!inst) fail('القسط غير موجود', 404);
    const due = round2(Number(inst.amount) - Number(inst.paid_amount));
    let amount = round2(num(ctx.body.amount, due));
    if (amount <= 0) fail('المبلغ غير صحيح');
    if (amount > due + 0.01) amount = due;
    const date = str(ctx.body.date, 10) || db.todayStr();
    const method = str(ctx.body.method, 20) || 'cash';
    const treasuryId = int(ctx.body.treasury_id) || null;

    db.transaction(() => {
      db.insert('installment_payments', {
        installment_id: id, plan_id: inst.plan_id, sale_id: inst.sale_id, customer_id: inst.customer_id,
        amount, date, method, treasury_id: treasuryId, note: str(ctx.body.note, 200), user_id: ctx.user.id, created_at: db.now(),
      });
      const newPaid = round2(Number(inst.paid_amount) + amount);
      const status = newPaid >= Number(inst.amount) - 0.01 ? 'paid' : 'partial';
      db.update('installments', id, { paid_amount: newPaid, status, paid_date: status === 'paid' ? date : inst.paid_date });

      const lines = [];
      const treasury = treasuryId ? get('SELECT * FROM treasuries WHERE id = ?', treasuryId) : null;
      lines.push({ code: treasury && treasury.kind === 'bank' ? acc.CODES.BANK : acc.CODES.CASH, debit: amount });
      lines.push({ code: acc.CODES.AR, credit: amount, party_type: 'customer', party_id: inst.customer_id });
      acc.postEntry({ date, description: `سداد قسط رقم ${inst.seq}`, source: 'installment', source_id: id, user_id: ctx.user.id, lines });
      if (treasuryId) acc.treasuryApply(treasuryId, amount);

      const planRemaining = get('SELECT COALESCE(SUM(amount - paid_amount),0) AS s FROM installments WHERE plan_id = ?', inst.plan_id).s;
      if (Number(planRemaining) <= 0.01) db.run("UPDATE installment_plans SET status='closed' WHERE id = ?", inst.plan_id);
      db.run('UPDATE sales SET remaining = MAX(0, ROUND(remaining - ?,2)), paid = ROUND(paid + ?,2) WHERE id = ?', amount, amount, inst.sale_id);
    });
    recomputeCustomer(inst.customer_id);
    db.audit({ ...ctxAudit(ctx), action: 'create', entity: 'installment_payments', entity_id: id, details: { amount } });
    return { message: 'تم تسجيل سداد القسط' };
  });

  add('GET', '/api/installments/overdue', null, (ctx) => {
    refreshOverdue();
    const today = db.todayStr();
    const items = all(`SELECT i.*, c.name AS customer_name, c.phone AS customer_phone, s.invoice_no,
                       CAST(julianday(?) - julianday(i.due_date) AS INTEGER) AS days_late
                       FROM installments i LEFT JOIN customers c ON c.id=i.customer_id LEFT JOIN sales s ON s.id=i.sale_id
                       WHERE i.status IN ('pending','partial','overdue') AND i.due_date < ? ORDER BY i.due_date`, today, today);
    const totals = get(`SELECT COALESCE(SUM(amount-paid_amount),0) AS s FROM installments WHERE status IN ('pending','partial','overdue') AND due_date < ?`, today);
    return { items, total_overdue: round2(num(totals.s)) };
  });

  add('POST', '/api/installments/refresh', null, () => { refreshOverdue(); return { message: 'تم تحديث حالات الأقساط' }; });
};
