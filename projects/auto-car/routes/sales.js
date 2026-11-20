'use strict';
/* ============================================================
   Auto Car — المبيعات: كاش / تقسيط / بيع بالعمولة + الترحيل المحاسبي
   ============================================================ */
const db = require('../lib/db');
const acc = require('../lib/accounting');

module.exports = function salesRoutes(app) {
  const { add, fail, str, int, num, get, all, run, round2, ctxAudit } = app;

  function recomputeCustomer(id) {
    if (!id) return;
    const account = acc.accountByCode(acc.CODES.AR);
    const r = get(`SELECT COALESCE(SUM(l.debit),0) AS d, COALESCE(SUM(l.credit),0) AS c FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id WHERE l.account_id=? AND l.party_id=? AND e.status='posted' AND e.deleted_at IS NULL`, account.id, id);
    db.update('customers', id, { balance: round2(Number(r.d) - Number(r.c)) });
  }

  add('GET', '/api/sales', null, (ctx) => {
    const q = str(ctx.url.searchParams.get('q'), 60);
    const where = [ctx.url.searchParams.get('deleted') === '1' ? 's.deleted_at IS NOT NULL' : 's.deleted_at IS NULL'];
    const params = [];
    const from = ctx.url.searchParams.get('from'), to = ctx.url.searchParams.get('to');
    if (from) { where.push('s.date >= ?'); params.push(from); }
    if (to) { where.push('s.date <= ?'); params.push(to); }
    if (ctx.url.searchParams.get('sale_type')) { where.push('s.sale_type = ?'); params.push(str(ctx.url.searchParams.get('sale_type'), 20)); }
    if (ctx.url.searchParams.get('customer_id')) { where.push('s.customer_id = ?'); params.push(int(ctx.url.searchParams.get('customer_id'))); }
    if (q) { where.push('(s.invoice_no LIKE ? OR c.name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const whereSql = 'WHERE ' + where.join(' AND ');
    const base = `FROM sales s LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN users u ON u.id=s.user_id`;
    const total = get(`SELECT COUNT(*) AS c ${base} ${whereSql}`, ...params).c;
    const { page, limit, offset } = app.pageParams(ctx.url);
    const items = all(
      `SELECT s.*, COALESCE(c.name,'عميل نقدي') AS customer_name, u.name AS user_name,
              (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id=s.id) AS items_count
       ${base} ${whereSql} ORDER BY s.id DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
    const totals = get(`SELECT COALESCE(SUM(s.total),0) AS total, COALESCE(SUM(s.paid),0) AS paid, COALESCE(SUM(s.profit),0) AS profit, COALESCE(SUM(s.commission_amount),0) AS commission ${base} ${whereSql}`, ...params);
    return { items, total, page, limit, totals };
  });

  add('GET', '/api/sales/:id', null, (ctx) => {
    const s = get(`SELECT s.*, COALESCE(c.name,'عميل نقدي') AS customer_name, c.phone AS customer_phone, u.name AS user_name,
                          t.name AS treasury_name FROM sales s LEFT JOIN customers c ON c.id=s.customer_id
                   LEFT JOIN users u ON u.id=s.user_id LEFT JOIN treasuries t ON t.id=s.treasury_id WHERE s.id = ?`, int(ctx.params.id));
    if (!s) fail('الفاتورة غير موجودة', 404);
    s.items = all(`SELECT si.*, v.code AS vehicle_code, v.vin, b.name AS brand_name, m.name AS model_name, v.year
                   FROM sale_items si LEFT JOIN vehicles v ON v.id=si.vehicle_id
                   LEFT JOIN brands b ON b.id=v.brand_id LEFT JOIN car_models m ON m.id=v.model_id WHERE si.sale_id = ?`, s.id);
    s.plan = get('SELECT * FROM installment_plans WHERE sale_id = ? AND deleted_at IS NULL', s.id) || null;
    if (s.plan) s.installments = all('SELECT * FROM installments WHERE plan_id = ? ORDER BY seq', s.plan.id);
    return { item: s };
  });

  add('POST', '/api/sales', 'sales.manage', (ctx) => {
    const items = Array.isArray(ctx.body.items) ? ctx.body.items : [];
    if (!items.length) fail('أضف سيارة واحدة على الأقل');
    const date = str(ctx.body.date, 10) || db.todayStr();
    const customerId = int(ctx.body.customer_id) || null;
    const treasuryId = int(ctx.body.treasury_id) || null;
    let saleType = ['cash', 'installment', 'commission'].includes(ctx.body.sale_type) ? ctx.body.sale_type : 'cash';
    const discount = round2(num(ctx.body.discount, 0));
    const taxRate = num(ctx.body.tax_rate, num(app.store.settingGet('tax_rate', 0), 0));

    let ownPrices = 0, consignPrices = 0, commissionTotal = 0, ownerTotal = 0, costTotal = 0;
    const prepared = [];
    for (const it of items) {
      const vehicleId = int(it.vehicle_id);
      if (!vehicleId) continue;
      const v = get('SELECT * FROM vehicles WHERE id = ? AND deleted_at IS NULL', vehicleId);
      if (!v) fail('سيارة غير موجودة في الفاتورة');
      if (v.status === 'sold') fail(`السيارة ${v.code} مبيعة بالفعل`);
      const price = round2(num(it.price, v.target_price));
      if (price <= 0) fail('سعر البيع غير صحيح');
      let commission = 0, owner = 0;
      if (v.ownership === 'consignment') {
        commission = v.commission_type === 'fixed' ? round2(v.commission_value) : round2(price * num(v.commission_value, 0) / 100);
        if (commission > price) commission = price;
        owner = round2(price - commission);
        consignPrices += price; commissionTotal += commission; ownerTotal += owner;
        saleType = 'commission';
      } else {
        ownPrices += price;
        costTotal += round2(num(v.cost_price, 0) + num(v.extra_cost, 0));
      }
      prepared.push({ v, price, commission, owner });
    }
    if (!prepared.length) fail('لا توجد سيارات صحيحة');

    const revenueOwn = round2(Math.max(0, ownPrices - discount));
    const subtotal = round2(ownPrices + consignPrices);
    const tax = round2((revenueOwn + commissionTotal) * taxRate / 100);
    const total = round2(revenueOwn + commissionTotal + ownerTotal + tax);
    let paid = round2(num(ctx.body.paid, 0));
    if (saleType === 'installment') paid = round2(num(ctx.body.down_payment, 0));
    else if (ctx.body.paid === undefined) paid = total;
    if (paid > total) paid = total;
    const remaining = round2(total - paid);
    const profit = round2(revenueOwn + commissionTotal - costTotal);
    const invoiceNo = db.nextNumber('sale', 'INV-');

    let saleId, planId = null;
    db.transaction(() => {
      saleId = db.insert('sales', {
        invoice_no: invoiceNo, customer_id: customerId, date, sale_type: saleType,
        subtotal, discount, tax, total, paid, remaining,
        payment_method: str(ctx.body.payment_method, 20) || (saleType === 'installment' ? 'installment' : 'cash'),
        treasury_id: treasuryId, currency_id: int(ctx.body.currency_id) || null, exchange_rate: num(ctx.body.exchange_rate, 1) || 1,
        cost_total: costTotal, profit, commission_amount: commissionTotal,
        note: str(ctx.body.note, 400), status: 'completed', user_id: ctx.user.id, created_at: db.now(),
      });

      for (const p of prepared) {
        db.insert('sale_items', { sale_id: saleId, vehicle_id: p.v.id, description: `${p.v.code}`, price: p.price, cost: round2(num(p.v.cost_price) + num(p.v.extra_cost)), total: p.price });
        db.update('vehicles', p.v.id, { status: 'sold', sale_price: p.price, updated_at: db.now() });
        if (p.v.ownership === 'consignment') {
          db.insert('consignment_settlements', {
            vehicle_id: p.v.id, sale_id: saleId, owner_name: p.v.owner_name || null,
            sale_amount: p.price, commission_amount: p.commission, owner_amount: p.owner,
            status: 'pending', created_at: db.now(),
          });
        }
      }

      // التقسيط
      if (saleType === 'installment' && remaining > 0) {
        const count = Math.max(1, int(ctx.body.installments_count, 12));
        const freq = ['monthly', 'weekly', 'quarterly'].includes(ctx.body.frequency) ? ctx.body.frequency : 'monthly';
        const interestRate = num(ctx.body.interest_rate, 0);
        const financed = round2(remaining * (1 + interestRate / 100));
        const perAmount = round2(financed / count);
        const startDate = str(ctx.body.first_due_date, 10) || nextDue(date, freq);
        planId = db.insert('installment_plans', {
          sale_id: saleId, customer_id: customerId, total_amount: total, down_payment: paid,
          financed_amount: financed, installments_count: count, installment_amount: perAmount,
          start_date: startDate, frequency: freq, interest_rate: interestRate, status: 'active', created_at: db.now(),
        });
        let allocated = 0;
        for (let i = 1; i <= count; i++) {
          const amount = i === count ? round2(financed - allocated) : perAmount;
          allocated = round2(allocated + amount);
          const due = addFrequency(startDate, freq, i - 1);
          db.insert('installments', {
            plan_id: planId, sale_id: saleId, customer_id: customerId, seq: i, due_date: due,
            amount, paid_amount: 0, status: 'pending', created_at: db.now(),
          });
        }
        db.run('UPDATE sales SET remaining = ? WHERE id = ?', financed, saleId);
      }

      // القيد المحاسبي
      const lines = [];
      if (paid > 0) {
        const treasury = treasuryId ? get('SELECT * FROM treasuries WHERE id = ?', treasuryId) : null;
        lines.push({ code: treasury && treasury.kind === 'bank' ? acc.CODES.BANK : acc.CODES.CASH, debit: paid });
      }
      const receivable = round2(remaining + tax);
      if (receivable > 0) lines.push({ code: acc.CODES.AR, debit: receivable, party_type: 'customer', party_id: customerId });
      if (revenueOwn > 0) lines.push({ code: acc.CODES.SALES_REV, credit: revenueOwn });
      if (commissionTotal > 0) lines.push({ code: acc.CODES.COMMISSION_REV, credit: commissionTotal });
      if (ownerTotal > 0) lines.push({ code: acc.CODES.AP, credit: ownerTotal, party_type: 'supplier', party_id: prepared.find((p) => p.owner)?.v.owner_id || null });
      if (tax > 0) lines.push({ code: acc.CODES.VAT, credit: tax });
      acc.postEntry({ date, description: `فاتورة بيع ${invoiceNo}`, source: 'sale', source_id: saleId, reference: invoiceNo, user_id: ctx.user.id, lines });
      // تكلفة المبيعات
      if (costTotal > 0) {
        acc.postEntry({
          date, description: `تكلفة المبيعات ${invoiceNo}`, source: 'sale', source_id: saleId, reference: invoiceNo, user_id: ctx.user.id,
          lines: [{ code: acc.CODES.COGS, debit: costTotal }, { code: acc.CODES.INVENTORY, credit: costTotal }],
        });
      }
      if (treasuryId && paid > 0) acc.treasuryApply(treasuryId, paid);
    });

    recomputeCustomer(customerId);
    db.audit({ ...ctxAudit(ctx), action: 'create', entity: 'sales', entity_id: saleId, details: { invoice_no: invoiceNo, total } });
    return { id: saleId, plan_id: planId, message: 'تم إنشاء فاتورة البيع بنجاح', invoice_no: invoiceNo };
  });

  add('DELETE', '/api/sales/:id', 'sales.manage', (ctx) => {
    const id = int(ctx.params.id);
    const s = get('SELECT * FROM sales WHERE id = ?', id);
    if (!s) fail('الفاتورة غير موجودة', 404);
    db.transaction(() => {
      for (const e of all('SELECT id FROM journal_entries WHERE source=? AND source_id=? AND deleted_at IS NULL', 'sale', id)) acc.voidEntry(e.id, ctxAudit(ctx));
      for (const si of all('SELECT * FROM sale_items WHERE sale_id = ?', id)) {
        if (si.vehicle_id) db.run("UPDATE vehicles SET status='available', sale_price=0, updated_at=? WHERE id=?", db.now(), si.vehicle_id);
      }
      const plan = get('SELECT * FROM installment_plans WHERE sale_id = ?', id);
      if (plan) db.run('UPDATE installment_plans SET deleted_at = ? WHERE id = ?', db.now(), plan.id);
      db.softDelete('sales', id, ctxAudit(ctx));
    });
    recomputeCustomer(s.customer_id);
    return { message: 'تم حذف الفاتورة وعكس قيودها وإعادة السيارات للمخزون' };
  });
  add('POST', '/api/sales/:id/restore', 'sales.manage', (ctx) => {
    db.restore('sales', int(ctx.params.id), ctxAudit(ctx));
    return { message: 'تم الاسترجاع' };
  });

  function nextDue(date, freq) { return addFrequency(date, freq, 1); }
  function addFrequency(date, freq, n) {
    const d = new Date(String(date).slice(0, 10) + 'T12:00:00');
    if (freq === 'weekly') d.setDate(d.getDate() + 7 * n);
    else if (freq === 'quarterly') d.setMonth(d.getMonth() + 3 * n);
    else d.setMonth(d.getMonth() + n);
    return db.todayStr(d);
  }
};
