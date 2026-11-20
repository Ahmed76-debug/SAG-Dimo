'use strict';
/* ============================================================
   Auto Car — المشتريات (شراء سيارات) + الترحيل المحاسبي
   ============================================================ */
const db = require('../lib/db');
const acc = require('../lib/accounting');

module.exports = function purchaseRoutes(app) {
  const { add, fail, str, int, num, get, all, run, round2, ctxAudit } = app;

  add('GET', '/api/purchases', null, (ctx) => {
    const q = str(ctx.url.searchParams.get('q'), 60);
    const where = [ctx.url.searchParams.get('deleted') === '1' ? 'p.deleted_at IS NOT NULL' : 'p.deleted_at IS NULL'];
    const params = [];
    const from = ctx.url.searchParams.get('from'), to = ctx.url.searchParams.get('to');
    if (from) { where.push('p.date >= ?'); params.push(from); }
    if (to) { where.push('p.date <= ?'); params.push(to); }
    if (ctx.url.searchParams.get('supplier_id')) { where.push('p.supplier_id = ?'); params.push(int(ctx.url.searchParams.get('supplier_id'))); }
    if (q) { where.push('(p.invoice_no LIKE ? OR s.name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const whereSql = 'WHERE ' + where.join(' AND ');
    const base = `FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN users u ON u.id=p.user_id`;
    const total = get(`SELECT COUNT(*) AS c ${base} ${whereSql}`, ...params).c;
    const { page, limit, offset } = app.pageParams(ctx.url);
    const items = all(
      `SELECT p.*, s.name AS supplier_name, u.name AS user_name,
              (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id=p.id) AS items_count
       ${base} ${whereSql} ORDER BY p.id DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
    const totals = get(`SELECT COALESCE(SUM(p.total),0) AS total, COALESCE(SUM(p.paid),0) AS paid ${base} ${whereSql}`, ...params);
    return { items, total, page, limit, totals };
  });

  add('GET', '/api/purchases/:id', null, (ctx) => {
    const p = get(`SELECT p.*, s.name AS supplier_name, u.name AS user_name FROM purchases p
                   LEFT JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN users u ON u.id=p.user_id WHERE p.id = ?`, int(ctx.params.id));
    if (!p) fail('فاتورة الشراء غير موجودة', 404);
    p.items = all(`SELECT pi.*, v.code AS vehicle_code, v.vin FROM purchase_items pi LEFT JOIN vehicles v ON v.id=pi.vehicle_id WHERE pi.purchase_id = ?`, p.id);
    return { item: p };
  });

  add('POST', '/api/purchases', 'purchases.manage', (ctx) => {
    const items = Array.isArray(ctx.body.items) ? ctx.body.items : [];
    if (!items.length) fail('أضف سيارة واحدة على الأقل');
    const date = str(ctx.body.date, 10) || db.todayStr();
    const supplierId = int(ctx.body.supplier_id) || null;
    const treasuryId = int(ctx.body.treasury_id) || null;
    const method = str(ctx.body.payment_method, 20) || 'cash';
    const discount = round2(num(ctx.body.discount, 0));

    let subtotal = 0;
    const prepared = [];
    for (const it of items) {
      const price = round2(num(it.price, 0));
      if (price <= 0) continue;
      subtotal += price;
      prepared.push({ ...it, price });
    }
    if (!prepared.length) fail('قيم السيارات غير صحيحة');
    const total = round2(subtotal - discount);
    let paid = round2(num(ctx.body.paid, 0));
    if (method === 'credit') paid = 0;
    if (paid > total) paid = total;
    const remaining = round2(total - paid);
    const invoiceNo = db.nextNumber('purchase', 'PUR-');

    let purchaseId;
    db.transaction(() => {
      purchaseId = db.insert('purchases', {
        invoice_no: invoiceNo, supplier_id: supplierId, date, subtotal, discount, tax: 0, total,
        paid, remaining, payment_method: method, treasury_id: treasuryId,
        currency_id: int(ctx.body.currency_id) || null, exchange_rate: num(ctx.body.exchange_rate, 1) || 1,
        note: str(ctx.body.note, 400), status: 'completed', user_id: ctx.user.id, created_at: db.now(),
      });

      for (const it of prepared) {
        let vehicleId = int(it.vehicle_id) || 0;
        if (!vehicleId) {
          // إنشاء سيارة جديدة تلقائيًا
          const nv = it.vehicle || {};
          const code = str(nv.code, 40) || db.nextNumber('vehicle', 'CAR-');
          vehicleId = db.insert('vehicles', {
            code, vin: str(nv.vin, 60), chassis_no: str(nv.chassis_no, 60), engine_no: str(nv.engine_no, 60),
            plate_no: str(nv.plate_no, 40), brand_id: int(nv.brand_id) || null, model_id: int(nv.model_id) || null,
            type_id: int(nv.type_id) || null, color_id: int(nv.color_id) || null, year: int(nv.year) || null,
            condition: nv.condition === 'new' ? 'new' : 'used', mileage: int(nv.mileage) || 0,
            transmission: str(nv.transmission, 20), fuel: str(nv.fuel, 20), doors: int(nv.doors) || null,
            seats: int(nv.seats) || null, cylinders: int(nv.cylinders) || null, horsepower: int(nv.horsepower) || null,
            origin: str(nv.origin, 60), ownership: 'own', cost_price: it.price, extra_cost: 0,
            target_price: round2(num(nv.target_price, 0)) || round2(it.price * 1.12),
            currency_id: int(ctx.body.currency_id) || null, status: 'available',
            supplier_id: supplierId, purchase_id: purchaseId, purchase_date: date, entry_date: date,
            images: '[]', created_by: ctx.user.id, created_at: db.now(),
          });
        } else {
          db.update('vehicles', vehicleId, {
            cost_price: it.price, supplier_id: supplierId, purchase_id: purchaseId, purchase_date: date,
            status: get('SELECT status FROM vehicles WHERE id = ?', vehicleId)?.status === 'sold' ? 'sold' : 'available',
            updated_at: db.now(),
          });
        }
        db.insert('purchase_items', { purchase_id: purchaseId, vehicle_id: vehicleId, description: str(it.description, 200), price: it.price, total: it.price });
      }

      // القيد المحاسبي
      const lines = [{ code: acc.CODES.INVENTORY, debit: total }];
      if (paid > 0) {
        const treasury = treasuryId ? get('SELECT * FROM treasuries WHERE id = ?', treasuryId) : null;
        lines.push({ code: treasury && treasury.kind === 'bank' ? acc.CODES.BANK : acc.CODES.CASH, credit: paid });
      }
      if (remaining > 0) lines.push({ code: acc.CODES.AP, credit: remaining, party_type: 'supplier', party_id: supplierId });
      const entryId = acc.postEntry({ date, description: `فاتورة شراء ${invoiceNo}`, source: 'purchase', source_id: purchaseId, reference: invoiceNo, user_id: ctx.user.id, lines });
      if (treasuryId && paid > 0) acc.treasuryApply(treasuryId, -paid);
      db.run('UPDATE purchases SET note = COALESCE(note,\'\') WHERE id = ?', purchaseId);
      if (entryId) db.run('UPDATE purchases SET updated_at = ? WHERE id = ?', db.now(), purchaseId);
    });

    if (supplierId) recomputeSupplier(supplierId);
    db.audit({ ...ctxAudit(ctx), action: 'create', entity: 'purchases', entity_id: purchaseId, details: { invoice_no: invoiceNo, total } });
    return { id: purchaseId, message: 'تم إنشاء فاتورة الشراء بنجاح', invoice_no: invoiceNo };
  });

  add('DELETE', '/api/purchases/:id', 'purchases.manage', (ctx) => {
    const id = int(ctx.params.id);
    const p = get('SELECT * FROM purchases WHERE id = ?', id);
    if (!p) fail('الفاتورة غير موجودة', 404);
    db.transaction(() => {
      const entries = all('SELECT id FROM journal_entries WHERE source = ? AND source_id = ? AND deleted_at IS NULL', 'purchase', id);
      for (const e of entries) acc.voidEntry(e.id, ctxAudit(ctx));
      for (const pi of all('SELECT * FROM purchase_items WHERE purchase_id = ?', id)) {
        if (pi.vehicle_id) db.run('UPDATE vehicles SET purchase_id = NULL, purchase_date = NULL WHERE id = ?', pi.vehicle_id);
      }
      db.softDelete('purchases', id, ctxAudit(ctx));
    });
    if (p.supplier_id) recomputeSupplier(p.supplier_id);
    return { message: 'تم حذف الفاتورة وعكس قيودها' };
  });
  add('POST', '/api/purchases/:id/restore', 'purchases.manage', (ctx) => {
    db.restore('purchases', int(ctx.params.id), ctxAudit(ctx));
    return { message: 'تم الاسترجاع' };
  });

  function recomputeSupplier(id) {
    const account = acc.accountByCode(acc.CODES.AP);
    const r = get(`SELECT COALESCE(SUM(l.debit),0) AS d, COALESCE(SUM(l.credit),0) AS c FROM journal_lines l JOIN journal_entries e ON e.id=l.entry_id WHERE l.account_id=? AND l.party_id=? AND e.status='posted' AND e.deleted_at IS NULL`, account.id, id);
    db.update('suppliers', id, { balance: round2(Number(r.c) - Number(r.d)) });
  }
};
