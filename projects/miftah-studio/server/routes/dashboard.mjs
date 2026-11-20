import { Router } from 'express';
import { getDb, json } from '../db.mjs';
import { requireAuth, requirePermission } from '../auth.mjs';
import { nowIso } from '../util.mjs';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/', requirePermission('dashboard.view'), (req, res) => {
  const db = getDb();
  const now = nowIso();
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const twoMonthsAgo = new Date(Date.now() - 60 * 86400000).toISOString();

  const one = (sql, ...params) => db.prepare(sql).get(...params) || {};

  const licenses = one('SELECT COUNT(*) AS c FROM licenses');
  const active = one(
    `SELECT COUNT(*) AS c FROM licenses WHERE status = 'active' AND (expires_at IS NULL OR expires_at >= ?)`, now
  );
  const activePrev = one(
    `SELECT COUNT(*) AS c FROM licenses WHERE status = 'active' AND issued_at <= ? AND (expires_at IS NULL OR expires_at >= ?)`,
    monthAgo, monthAgo
  );
  const expiring = one(
    `SELECT COUNT(*) AS c FROM licenses WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at >= ?
     AND expires_at <= ?`, now, new Date(Date.now() + 45 * 86400000).toISOString()
  );
  const revenue = one(
    `SELECT COALESCE(SUM(price),0) AS s, COUNT(*) AS c FROM licenses WHERE status != 'revoked' AND issued_at >= ?`, monthAgo
  );
  const revenuePrev = one(
    `SELECT COALESCE(SUM(price),0) AS s FROM licenses WHERE status != 'revoked' AND issued_at >= ? AND issued_at < ?`,
    twoMonthsAgo, monthAgo
  );
  const totalRevenue = one(`SELECT COALESCE(SUM(price),0) AS s FROM licenses WHERE status != 'revoked'`);
  const activationCount = one(`SELECT COUNT(*) AS c FROM activations WHERE status = 'active'`);
  const onlineCount = one(
    `SELECT COUNT(*) AS c FROM activations WHERE status = 'active' AND mode = 'online' AND last_seen_at IS NOT NULL
     AND last_seen_at >= ?`, new Date(Date.now() - 7 * 86400000).toISOString()
  );
  const pendingRequests = one(`SELECT COUNT(*) AS c FROM activation_requests WHERE status = 'pending'`);
  const customers = one('SELECT COUNT(*) AS c FROM customers');
  const products = one('SELECT COUNT(*) AS c FROM products WHERE status = ?', 'active');

  // 12-month series
  const rawSeries = db.prepare(
    `SELECT substr(issued_at,1,7) AS month, COUNT(*) AS count, COALESCE(SUM(price),0) AS revenue
     FROM licenses WHERE issued_at >= ? GROUP BY month ORDER BY month`
  ).all(new Date(Date.now() - 365 * 86400000).toISOString());
  const seriesMap = new Map(rawSeries.map((r) => [r.month, r]));
  const series = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    const row = seriesMap.get(key);
    series.push({ month: key, count: row?.count || 0, revenue: row?.revenue || 0 });
  }

  const planSplit = db.prepare(
    `SELECT plan, COUNT(*) AS count FROM licenses GROUP BY plan ORDER BY count DESC`
  ).all();

  const statusSplit = db.prepare(
    `SELECT CASE
        WHEN status = 'revoked' THEN 'revoked'
        WHEN status = 'suspended' THEN 'suspended'
        WHEN expires_at IS NOT NULL AND expires_at < ? THEN 'expired'
        ELSE 'active' END AS status,
      COUNT(*) AS count
     FROM licenses GROUP BY status`
  ).all(now);

  const topProducts = db.prepare(
    `SELECT p.id, p.name, p.code, p.color, p.icon,
       COUNT(l.id) AS licenses,
       SUM(CASE WHEN l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at >= ?) THEN 1 ELSE 0 END) AS active,
       COALESCE(SUM(l.price), 0) AS revenue
     FROM products p LEFT JOIN licenses l ON l.product_id = p.id
     GROUP BY p.id ORDER BY licenses DESC LIMIT 5`
  ).all(now);

  const expiringSoon = db.prepare(
    `SELECT l.id, l.uid, l.key_hint, l.plan, l.expires_at, l.max_seats,
       p.name AS product_name, p.color AS product_color, p.code AS product_code,
       c.name AS customer_name, c.company AS customer_company
     FROM licenses l JOIN products p ON p.id = l.product_id LEFT JOIN customers c ON c.id = l.customer_id
     WHERE l.status = 'active' AND l.expires_at IS NOT NULL AND l.expires_at >= ? AND l.expires_at <= ?
     ORDER BY l.expires_at ASC LIMIT 6`
  ).all(now, new Date(Date.now() + 45 * 86400000).toISOString());

  const recent = db.prepare(
    'SELECT * FROM audit_logs ORDER BY at DESC LIMIT 8'
  ).all().map((r) => ({ ...r, detail: json(r.detail, null) }));

  const activationsDaily = [];
  for (let i = 13; i >= 0; i--) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const row = db.prepare(
      `SELECT COUNT(*) AS c FROM activations WHERE activated_at >= ? AND activated_at < ?`
    ).get(start.toISOString(), end.toISOString());
    activationsDaily.push({ date: start.toISOString().slice(0, 10), count: row.c });
  }

  const pct = (curr, prev) => {
    if (!prev) return curr ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  };

  res.json({
    ok: true,
    data: {
      cards: {
        licenses: licenses.c,
        activeLicenses: active.c,
        activeGrowth: pct(active.c, activePrev.c),
        expiring: expiring.c,
        revenue: Math.round(revenue.s * 100) / 100,
        revenueGrowth: pct(revenue.s, revenuePrev.s),
        totalRevenue: Math.round(totalRevenue.s * 100) / 100,
        activations: activationCount.c,
        onlineActivations: onlineCount.c,
        pendingRequests: pendingRequests.c,
        customers: customers.c,
        products: products.c,
      },
      series,
      planSplit,
      statusSplit,
      topProducts,
      expiringSoon,
      recent,
      activationsDaily,
    },
  });
});
