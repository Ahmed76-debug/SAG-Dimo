'use strict';
/* ============================================================
   Auto Car — البيع بالعمولة: تسويات مستحقات أصحاب السيارات
   ============================================================ */
const db = require('../lib/db');
const acc = require('../lib/accounting');

module.exports = function consignmentRoutes(app) {
  const { add, fail, str, int, num, get, all, round2, ctxAudit } = app;

  add('GET', '/api/consignments', null, (ctx) => {
    const where = ['cs.deleted_at IS NULL'];
    const params = [];
    const status = str(ctx.url.searchParams.get('status'), 20);
    if (status) { where.push('cs.status = ?'); params.push(status); }
    const whereSql = 'WHERE ' + where.join(' AND ');
    const items = all(
      `SELECT cs.*, v.code AS vehicle_code, v.vin, b.name AS brand_name, m.name AS model_name, v.year, s.invoice_no
       FROM consignment_settlements cs
       LEFT JOIN vehicles v ON v.id = cs.vehicle_id
       LEFT JOIN brands b ON b.id = v.brand_id
       LEFT JOIN car_models m ON m.id = v.model_id
       LEFT JOIN sales s ON s.id = cs.sale_id
       ${whereSql} ORDER BY cs.id DESC LIMIT 300`, ...params);
    const totals = get(`SELECT COALESCE(SUM(cs.commission_amount),0) AS commission,
                        COALESCE(SUM(CASE WHEN cs.status='pending' THEN cs.owner_amount ELSE 0 END),0) AS payable
                        FROM consignment_settlements cs ${whereSql}`, ...params);
    return { items, totals };
  });

  add('GET', '/api/consignments/vehicles', null, () => ({
    items: all(`SELECT v.*, b.name AS brand_name, m.name AS model_name FROM vehicles v
                LEFT JOIN brands b ON b.id=v.brand_id LEFT JOIN car_models m ON m.id=v.model_id
                WHERE v.ownership='consignment' AND v.deleted_at IS NULL AND v.status IN ('available','reserved')
                ORDER BY v.id DESC`),
  }));

  add('POST', '/api/consignments/:id/settle', 'consignment.manage', (ctx) => {
    const id = int(ctx.params.id);
    const cs = get('SELECT * FROM consignment_settlements WHERE id = ?', id);
    if (!cs) fail('التسوية غير موجودة', 404);
    if (cs.status === 'settled') fail('تم تسوية هذا المبلغ مسبقًا');
    const treasuryId = int(ctx.body.treasury_id) || null;
    const amount = round2(num(ctx.body.amount, cs.owner_amount));
    const date = str(ctx.body.date, 10) || db.todayStr();
    const treasury = treasuryId ? get('SELECT * FROM treasuries WHERE id = ?', treasuryId) : null;
    const lines = [{ code: acc.CODES.AP, debit: amount, party_type: 'supplier', party_id: null }];
    lines.push({ code: treasury && treasury.kind === 'bank' ? acc.CODES.BANK : acc.CODES.CASH, credit: amount });
    acc.postEntry({ date, description: `تسوية عمولة — ${cs.owner_name || ''}`, source: 'commission', source_id: cs.id, user_id: ctx.user.id, lines });
    if (treasuryId) acc.treasuryApply(treasuryId, -amount);
    db.update('consignment_settlements', id, { status: 'settled', settled_date: date, treasury_id: treasuryId, user_id: ctx.user.id });
    db.audit({ ...ctxAudit(ctx), action: 'update', entity: 'consignment_settlements', entity_id: id, details: { settled: amount } });
    return { message: 'تمت تسوية مستحقات صاحب السيارة' };
  });
};
