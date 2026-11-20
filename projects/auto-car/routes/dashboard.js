'use strict';
/* ============================================================
   Auto Car — لوحة التحكم (مؤشرات + رسوم بيانية)
   ============================================================ */
const db = require('../lib/db');

module.exports = function dashboardRoutes(app) {
  const { add, get, all, round2, num, todayStr, addDays } = app;

  add('GET', '/api/dashboard', null, (ctx) => {
    const today = todayStr();
    const monthStart = today.slice(0, 8) + '01';
    const yearStart = today.slice(0, 4) + '-01-01';

    const sum = (sql, ...p) => round2(num(get(sql, ...p).s));

    const kpi = {
      vehicles_available: get("SELECT COUNT(*) AS c FROM vehicles WHERE status='available' AND deleted_at IS NULL").c,
      vehicles_reserved: get("SELECT COUNT(*) AS c FROM vehicles WHERE status='reserved' AND deleted_at IS NULL").c,
      vehicles_sold_month: get("SELECT COUNT(*) AS c FROM vehicles WHERE status='sold' AND deleted_at IS NULL AND sale_price>0 AND substr(updated_at,1,10) >= ?", monthStart).c,
      inventory_value: sum("SELECT COALESCE(SUM(cost_price + extra_cost),0) AS s FROM vehicles WHERE status IN ('available','reserved') AND deleted_at IS NULL"),
      sales_month: sum("SELECT COALESCE(SUM(total),0) AS s FROM sales WHERE status='completed' AND deleted_at IS NULL AND date >= ?", monthStart),
      sales_today: sum("SELECT COALESCE(SUM(total),0) AS s FROM sales WHERE status='completed' AND deleted_at IS NULL AND date = ?", today),
      profit_month: sum("SELECT COALESCE(SUM(profit),0) AS s FROM sales WHERE status='completed' AND deleted_at IS NULL AND date >= ?", monthStart),
      profit_year: sum("SELECT COALESCE(SUM(profit),0) AS s FROM sales WHERE status='completed' AND deleted_at IS NULL AND date >= ?", yearStart),
      commission_month: sum("SELECT COALESCE(SUM(commission_amount),0) AS s FROM sales WHERE status='completed' AND deleted_at IS NULL AND date >= ?", monthStart),
      receivables: sum('SELECT COALESCE(SUM(balance),0) AS s FROM customers WHERE deleted_at IS NULL AND balance > 0'),
      payables: sum('SELECT COALESCE(SUM(balance),0) AS s FROM suppliers WHERE deleted_at IS NULL AND balance > 0'),
      cash_balance: sum("SELECT COALESCE(SUM(balance),0) AS s FROM treasuries WHERE deleted_at IS NULL AND kind='cash'"),
      bank_balance: sum("SELECT COALESCE(SUM(balance),0) AS s FROM treasuries WHERE deleted_at IS NULL AND kind='bank'"),
      installments_due: sum("SELECT COALESCE(SUM(amount - paid_amount),0) AS s FROM installments WHERE status IN ('pending','partial','overdue')"),
      installments_overdue: sum("SELECT COALESCE(SUM(amount - paid_amount),0) AS s FROM installments WHERE status IN ('pending','partial','overdue') AND due_date < ?", today),
    };

    // مبيعات آخر 12 شهر
    const series = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today + 'T12:00:00');
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const row = get(`SELECT COALESCE(SUM(total),0) AS total, COALESCE(SUM(profit),0) AS profit, COUNT(*) AS count
                       FROM sales WHERE status='completed' AND deleted_at IS NULL AND substr(date,1,7) = ?`, key);
      series.push({ month: key, total: round2(num(row.total)), profit: round2(num(row.profit)), count: row.count });
    }

    const byType = all(`SELECT sale_type AS type, COUNT(*) AS count, COALESCE(SUM(total),0) AS total
                        FROM sales WHERE status='completed' AND deleted_at IS NULL GROUP BY sale_type`);

    const byBrand = all(`SELECT COALESCE(b.name,'غير محدد') AS name, COUNT(*) AS count, COALESCE(SUM(v.sale_price),0) AS total
                         FROM vehicles v LEFT JOIN brands b ON b.id = v.brand_id
                         WHERE v.status='sold' AND v.deleted_at IS NULL GROUP BY v.brand_id ORDER BY count DESC LIMIT 6`);

    const recentSales = all(`SELECT s.id, s.invoice_no, s.total, s.sale_type, s.payment_method, s.date,
                                    COALESCE(c.name,'عميل نقدي') AS customer_name, u.name AS user_name
                             FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
                             LEFT JOIN users u ON u.id = s.user_id
                             WHERE s.deleted_at IS NULL ORDER BY s.id DESC LIMIT 6`);

    const lowStock = all(`SELECT id, code, target_price, cost_price, brand_id, model_id, year, condition
                          FROM vehicles WHERE status='available' AND deleted_at IS NULL ORDER BY entry_date ASC LIMIT 6`);

    const upcoming = all(`SELECT i.*, c.name AS customer_name FROM installments i
                          LEFT JOIN customers c ON c.id = i.customer_id
                          WHERE i.status IN ('pending','partial','overdue') AND i.due_date <= ?
                          ORDER BY i.due_date ASC LIMIT 6`, addDays(today, 14));

    return { kpi, series, byType, byBrand, recentSales, lowStock, upcoming, today };
  });
};
