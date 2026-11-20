'use strict';
/* ============================================================
   Auto Car — التنبيهات والتذكيرات (أقساط مستحقة، انتهاء مستندات)
   ============================================================ */
const db = require('../lib/db');

module.exports = function notificationRoutes(app) {
  const { add, fail, int, str, get, all, run, ctxAudit, store } = app;

  function generate() {
    const today = db.todayStr();
    const instDays = int(store.settingGet('installment_reminder_days', 7), 7);
    const docDays = int(store.settingGet('doc_expiry_reminder_days', 30), 30);
    let created = 0;

    const upsert = (kind, title, body, ref_type, ref_id, due_date, priority) => {
      const exists = get(`SELECT 1 FROM notifications WHERE ref_type=? AND ref_id=? AND status IN ('unread','read') AND deleted_at IS NULL`, ref_type, ref_id);
      if (exists) return;
      db.insert('notifications', { kind, title, body, ref_type, ref_id, due_date, priority, status: 'unread', created_at: db.now() });
      created++;
    };

    // أقساط متأخرة
    for (const i of all(`SELECT i.*, c.name AS customer_name FROM installments i LEFT JOIN customers c ON c.id=i.customer_id
                         WHERE i.status IN ('pending','partial','overdue') AND i.due_date < ?`, today)) {
      upsert('alert', `قسط متأخر — ${i.customer_name || 'عميل'}`, `القسط رقم ${i.seq} بمبلغ ${i.amount - i.paid_amount} متأخر عن تاريخ ${i.due_date}`, 'installment', i.id, i.due_date, 'high');
    }
    // أقساط مستحقة قريبًا
    for (const i of all(`SELECT i.*, c.name AS customer_name FROM installments i LEFT JOIN customers c ON c.id=i.customer_id
                         WHERE i.status IN ('pending','partial') AND i.due_date >= ? AND i.due_date <= ?`, today, db.addDays(today, instDays))) {
      upsert('reminder', `قسط مستحق قريبًا — ${i.customer_name || 'عميل'}`, `القسط رقم ${i.seq} بمبلغ ${i.amount - i.paid_amount} يستحق في ${i.due_date}`, 'installment', i.id, i.due_date, 'normal');
    }
    // انتهاء مستندات السيارات
    for (const v of all(`SELECT * FROM vehicles WHERE deleted_at IS NULL AND status <> 'sold' AND (
                          (license_expiry IS NOT NULL AND license_expiry <= ?) OR (insurance_expiry IS NOT NULL AND insurance_expiry <= ?))`,
                        db.addDays(today, docDays), db.addDays(today, docDays))) {
      const parts = [];
      if (v.license_expiry && v.license_expiry <= db.addDays(today, docDays)) parts.push(`الترخيص ينتهي ${v.license_expiry}`);
      if (v.insurance_expiry && v.insurance_expiry <= db.addDays(today, docDays)) parts.push(`التأمين ينتهي ${v.insurance_expiry}`);
      upsert('reminder', `مستندات سيارة ${v.code}`, parts.join(' — '), 'vehicle', v.id, v.license_expiry || v.insurance_expiry, 'normal');
    }
    return created;
  }

  add('GET', '/api/notifications', null, (ctx) => {
    const status = str(ctx.url.searchParams.get('status'), 20);
    const where = ['deleted_at IS NULL'];
    const params = [];
    if (status) { where.push('status = ?'); params.push(status); }
    const items = all(`SELECT * FROM notifications WHERE ${where.join(' AND ')} ORDER BY (status='unread') DESC, priority DESC, id DESC LIMIT 200`, ...params);
    const counts = {
      unread: get("SELECT COUNT(*) AS c FROM notifications WHERE status='unread' AND deleted_at IS NULL").c,
      total: get('SELECT COUNT(*) AS c FROM notifications WHERE deleted_at IS NULL').c,
    };
    return { items, counts };
  });

  add('GET', '/api/notifications/count', null, () => ({
    unread: get("SELECT COUNT(*) AS c FROM notifications WHERE status='unread' AND deleted_at IS NULL").c,
  }));

  add('POST', '/api/notifications/generate', null, () => {
    const created = generate();
    return { created, message: created ? `تم توليد ${created} تنبيه` : 'لا توجد تنبيهات جديدة' };
  });

  add('POST', '/api/notifications/:id/read', null, (ctx) => {
    db.update('notifications', int(ctx.params.id), { status: 'read' });
    return { message: 'تم' };
  });
  add('POST', '/api/notifications/:id/done', null, (ctx) => {
    db.update('notifications', int(ctx.params.id), { status: 'done' });
    return { message: 'تم' };
  });
  add('POST', '/api/notifications/read-all', null, (ctx) => {
    run("UPDATE notifications SET status='read' WHERE status='unread'");
    return { message: 'تم تعليم الكل كمقروء' };
  });
  add('DELETE', '/api/notifications/:id', null, (ctx) => {
    db.softDelete('notifications', int(ctx.params.id), ctxAudit(ctx));
    return { message: 'تم الحذف' };
  });
};
