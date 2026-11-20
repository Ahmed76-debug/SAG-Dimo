'use strict';
/**
 * PharmaPro – REST API
 */
const db = require('./db');
const lib = require('./lib');
const backup = require('./backup');
const sec = require('./security');
const { AppError, round2 } = lib;

const JSON_LIMIT = 5 * 1024 * 1024;

function send(res, data, status = 200) {
  const payload = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(payload);
}
function ok(res, data = { ok: true }) { send(res, data); }

function audit(userId, action, entity, entityId, details, ip) {
  try {
    db.run('INSERT INTO audit_log(user_id,action,entity,entity_id,details,ip) VALUES(?,?,?,?,?,?)',
      userId || null, action, entity || null, entityId || null,
      details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null, ip || null);
  } catch (_) { /* non fatal */ }
}

function userPayload(user) {
  const role = user.role_id ? db.get('SELECT * FROM roles WHERE id = ?', user.role_id) : null;
  const permissions = sec.permissionsForUser(user);
  return {
    id: user.id, username: user.username, full_name: user.full_name, phone: user.phone,
    email: user.email, active: user.active, color: user.color, last_login: user.last_login,
    role_id: user.role_id, role_name: role ? role.name : null, permissions,
    custom_permissions: sec.normalizeCustomPermissions(user.permissions)
  };
}

function need(user, perm) {
  if (!user) throw new AppError('يجب تسجيل الدخول للمتابعة', 401);
  if (!user.permissions.includes(perm)) throw new AppError('لا تملك صلاحية للقيام بهذا الإجراء', 403);
}

function paging(query) {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const perPage = Math.min(500, Math.max(5, parseInt(query.perPage || '25', 10) || 25));
  return { page, perPage, offset: (page - 1) * perPage };
}
function paged(items, total, page, perPage) {
  return { items, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

function dateRange(query, fromDefaultDays = 30) {
  const to = query.to || db.today();
  let from = query.from;
  if (!from) {
    const d = new Date();
    d.setDate(d.getDate() - fromDefaultDays);
    from = d.toISOString().slice(0, 10);
  }
  return { from, to, fromTs: `${from} 00:00:00`, toTs: `${to} 23:59:59` };
}

function ean13(prefix12) {
  const digits = String(prefix12).split('').map(Number);
  const sum = digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0);
  return prefix12 + String((10 - (sum % 10)) % 10);
}

function settingsMap() {
  const rows = db.all('SELECT key, value FROM settings');
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

/* ------------------------------------------------------------------ */
/*                               AUTH                                  */
/* ------------------------------------------------------------------ */
function login(body, ip) {
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) throw new AppError('أدخل اسم المستخدم وكلمة المرور');
  const user = db.get('SELECT * FROM users WHERE username = ?', username);
  if (!user || !sec.verifyPassword(password, user.password_hash)) {
    audit(null, 'login_failed', 'user', null, `محاولة دخول فاشلة: ${username}`, ip);
    throw new AppError('اسم المستخدم أو كلمة المرور غير صحيحة', 401);
  }
  if (!user.active) throw new AppError('هذا الحساب موقوف. تواصل مع مدير النظام', 403);
  db.run("UPDATE users SET last_login = datetime('now','localtime') WHERE id = ?", user.id);
  audit(user.id, 'login', 'user', user.id, 'تسجيل دخول', ip);
  const token = sec.signToken(user);
  return { token, user: userPayload(user) };
}

/* ------------------------------------------------------------------ */
/*                             DASHBOARD                               */
/* ------------------------------------------------------------------ */
function dashboard(user, query) {
  const days = Math.min(365, Math.max(7, parseInt(query.days || '14', 10) || 14));
  const today = db.today();
  const monthStart = today.slice(0, 8) + '01';

  const todayStats = db.get(
    `SELECT COUNT(*) AS invoices, COALESCE(SUM(total),0) AS total, COALESCE(SUM(tax),0) AS tax,
            COALESCE(SUM(discount),0) AS discount
     FROM sales WHERE date(date) = date('now','localtime') AND status NOT IN ('void')`
  );
  const todayCost = db.get(
    `SELECT COALESCE(SUM(si.cost*si.qty),0) AS cost FROM sale_items si
     JOIN sales s ON s.id = si.sale_id WHERE date(s.date)=date('now','localtime') AND s.status NOT IN ('void')`
  );
  const monthStats = db.get(
    `SELECT COUNT(*) AS invoices, COALESCE(SUM(total),0) AS total, COALESCE(SUM(tax),0) AS tax FROM sales
     WHERE date(date) >= ? AND status NOT IN ('void')`, monthStart
  );
  const monthCost = db.get(
    `SELECT COALESCE(SUM(si.cost*si.qty),0) AS cost FROM sale_items si
     JOIN sales s ON s.id=si.sale_id WHERE date(s.date) >= ? AND s.status NOT IN ('void')`, monthStart
  );
  const inventory = db.get(
    `SELECT COALESCE(SUM(b.qty * b.cost),0) AS cost_value,
            COALESCE(SUM(b.qty * p.price),0) AS retail_value,
            COALESCE(SUM(b.qty),0) AS units
     FROM batches b JOIN products p ON p.id = b.product_id`
  );
  const productsCount = db.get('SELECT COUNT(*) AS c FROM products WHERE active = 1').c;
  const lowStockCount = db.get(
    `SELECT COUNT(*) AS c FROM products p WHERE p.active = 1
     AND (SELECT COALESCE(SUM(b.qty),0) FROM batches b WHERE b.product_id = p.id) <= p.min_stock`
  ).c;
  const expiryDays = Number(settingsMap().expiry_alert_days || 90);
  const expiringCount = db.get(
    `SELECT COUNT(*) AS c FROM batches WHERE qty > 0 AND expiry_date IS NOT NULL
     AND expiry_date >= date('now','localtime') AND expiry_date <= date('now','localtime', ?)`,
    `+${expiryDays} days`
  ).c;
  const expiredCount = db.get(
    `SELECT COUNT(*) AS c FROM batches WHERE qty > 0 AND expiry_date IS NOT NULL AND expiry_date < date('now','localtime')`
  ).c;
  const customersCount = db.get('SELECT COUNT(*) AS c FROM customers WHERE active = 1').c;
  const creditTotal = db.get(
    `SELECT COALESCE(SUM(total - paid),0) AS t FROM sales WHERE status NOT IN ('void') AND total > paid`
  ).t;
  const dueSuppliers = db.get('SELECT COALESCE(SUM(total - paid),0) AS t FROM purchases').t;

  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  const startStr = start.toISOString().slice(0, 10);
  const seriesRows = db.all(
    `SELECT substr(date,1,10) AS day, COUNT(*) AS invoices, COALESCE(SUM(total),0) AS total,
            COALESCE(SUM(tax),0) AS tax
     FROM sales WHERE date(date) >= ? AND status NOT IN ('void') GROUP BY day ORDER BY day`, startStr
  );
  const map = new Map(seriesRows.map((r) => [r.day, r]));
  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = map.get(key);
    series.push({ date: key, total: row ? row.total : 0, invoices: row ? row.invoices : 0, tax: row ? row.tax : 0 });
  }

  const topProducts = db.all(
    `SELECT si.product_id, si.name, SUM(si.qty) AS qty, SUM(si.total - si.tax) AS revenue,
            SUM(si.cost * si.qty) AS cost
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.date >= ? AND s.status NOT IN ('void') AND si.qty > 0
     GROUP BY si.product_id ORDER BY revenue DESC LIMIT 8`, `${startStr} 00:00:00`
  );
  const categorySales = db.all(
    `SELECT COALESCE(c.name,'غير مصنف') AS name, COALESCE(SUM(si.total - si.tax),0) AS total
     FROM sale_items si JOIN products p ON p.id = si.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     JOIN sales s ON s.id = si.sale_id
     WHERE s.date >= ? AND s.status NOT IN ('void')
     GROUP BY c.id ORDER BY total DESC`, `${startStr} 00:00:00`
  );
  const paymentMix = db.all(
    `SELECT payment_method AS name, COUNT(*) AS count, COALESCE(SUM(total),0) AS total
     FROM sales WHERE date(date) >= ? AND status NOT IN ('void') GROUP BY payment_method`, startStr
  );
  const recentSales = db.all(
    `SELECT s.id, s.invoice_no, s.date, s.total, s.payment_method, s.status, c.name AS customer_name, u.full_name AS cashier
     FROM sales s LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN users u ON u.id=s.user_id
     ORDER BY s.id DESC LIMIT 8`
  );
  const lowStock = db.all(
    `SELECT p.id, p.name, p.unit, p.min_stock, p.price,
            (SELECT COALESCE(SUM(b.qty),0) FROM batches b WHERE b.product_id=p.id) AS stock
     FROM products p WHERE p.active=1
     AND (SELECT COALESCE(SUM(b.qty),0) FROM batches b WHERE b.product_id=p.id) <= p.min_stock
     ORDER BY stock ASC LIMIT 6`
  );
  const expiring = db.all(
    `SELECT b.id, b.batch_no, b.expiry_date, b.qty, p.name, p.id AS product_id,
            CAST(julianday(b.expiry_date) - julianday(date('now','localtime')) AS INTEGER) AS days_left
     FROM batches b JOIN products p ON p.id=b.product_id
     WHERE b.qty > 0 AND b.expiry_date IS NOT NULL AND b.expiry_date <= date('now','localtime', ?)
     ORDER BY b.expiry_date ASC LIMIT 6`, `+${expiryDays} days`
  );
  const shift = lib.currentShift(user.id);
  const pendingRx = db.get("SELECT COUNT(*) AS c FROM prescriptions WHERE status='pending'").c;

  const profitToday = round2(Number(todayStats.total) - Number(todayStats.tax) - Number(todayCost.cost));
  const profitMonth = round2(Number(monthStats.total) - Number(monthStats.tax) - Number(monthCost.cost));

  return {
    today: {
      invoices: todayStats.invoices, total: round2(todayStats.total), tax: round2(todayStats.tax),
      discount: round2(todayStats.discount), profit: profitToday,
      avg_invoice: todayStats.invoices ? round2(todayStats.total / todayStats.invoices) : 0
    },
    month: { invoices: monthStats.invoices, total: round2(monthStats.total), profit: profitMonth },
    inventory: {
      cost_value: round2(inventory.cost_value), retail_value: round2(inventory.retail_value),
      units: round2(inventory.units), products: productsCount, low_stock: lowStockCount,
      expiring: expiringCount, expired: expiredCount
    },
    customers: customersCount,
    credit_total: round2(creditTotal),
    due_suppliers: round2(dueSuppliers),
    pending_rx: pendingRx,
    shift: shift ? { id: shift.id, opened_at: shift.opened_at, opening_cash: shift.opening_cash } : null,
    series, top_products: topProducts, category_sales: categorySales, payment_mix: paymentMix,
    recent_sales: recentSales, low_stock: lowStock, expiring
  };
}

/* ------------------------------------------------------------------ */
/*                              PRODUCTS                               */
/* ------------------------------------------------------------------ */
const PRODUCT_STOCK_SQL = `(SELECT COALESCE(SUM(b.qty),0) FROM batches b WHERE b.product_id = p.id)`;

function productList(query) {
  const where = ['p.active = 1'];
  const params = [];
  if (query.search) {
    const s = `%${query.search}%`;
    where.push('(p.name LIKE ? OR p.name_en LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ? OR p.manufacturer LIKE ?)');
    params.push(s, s, s, s, s);
  }
  if (query.category) { where.push('p.category_id = ?'); params.push(Number(query.category)); }
  if (query.low === '1') where.push(`${PRODUCT_STOCK_SQL} <= p.min_stock`);
  if (query.expired === '1') where.push(`EXISTS (SELECT 1 FROM batches b WHERE b.product_id=p.id AND b.qty>0 AND b.expiry_date < date('now','localtime'))`);
  if (query.expiring) {
    const days = Math.max(1, parseInt(query.expiring, 10) || 90);
    where.push(`EXISTS (SELECT 1 FROM batches b WHERE b.product_id=p.id AND b.qty>0 AND b.expiry_date BETWEEN date('now','localtime') AND date('now','localtime', ?))`);
    params.push(`+${days} days`);
  }
  if (query.rx === '1') where.push('p.requires_rx = 1');
  if (query.active === '0') { where[0] = 'p.active = 0'; }
  const sorts = {
    name: 'p.name ASC', price_desc: 'p.price DESC', price_asc: 'p.price ASC',
    stock_asc: 'stock ASC', stock_desc: 'stock DESC', newest: 'p.id DESC', expiry: 'nearest_expiry ASC'
  };
  const order = sorts[query.sort] || 'p.name ASC';
  const { page, perPage, offset } = paging(query);
  const sqlWhere = where.join(' AND ');
  const total = db.get(`SELECT COUNT(*) AS c FROM products p WHERE ${sqlWhere}`, ...params).c;
  const items = db.all(
    `SELECT p.*, c.name AS category_name, ${PRODUCT_STOCK_SQL} AS stock,
      (SELECT MIN(b.expiry_date) FROM batches b WHERE b.product_id=p.id AND b.qty>0) AS nearest_expiry,
      (SELECT COUNT(*) FROM batches b WHERE b.product_id=p.id AND b.qty>0) AS batch_count,
      (SELECT COALESCE(SUM(si.qty),0) FROM sale_items si JOIN sales s ON s.id=si.sale_id
        WHERE si.product_id=p.id AND s.status NOT IN ('void') AND s.date >= date('now','localtime','-30 days')) AS sold_30d
     FROM products p LEFT JOIN categories c ON c.id=p.category_id
     WHERE ${sqlWhere} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...params, perPage, offset
  );
  return paged(items, total, page, perPage);
}

function getProduct(id) {
  const p = db.get(
    `SELECT p.*, c.name AS category_name, ${PRODUCT_STOCK_SQL} AS stock
     FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id = ?`, id
  );
  if (!p) throw new AppError('الصنف غير موجود', 404);
  p.batches = db.all(
    `SELECT b.*, s.name AS supplier_name FROM batches b LEFT JOIN suppliers s ON s.id=b.supplier_id
     WHERE b.product_id = ? AND b.qty > 0 ORDER BY (b.expiry_date IS NULL), b.expiry_date ASC`, id
  );
  p.movements = db.all(
    `SELECT m.*, u.full_name AS user_name, b.batch_no FROM stock_movements m
     LEFT JOIN users u ON u.id=m.user_id LEFT JOIN batches b ON b.id=m.batch_id
     WHERE m.product_id = ? ORDER BY m.id DESC LIMIT 30`, id
  );
  return p;
}

function lookupProducts(q) {
  const term = String(q.code || q.q || '').trim();
  if (!term) return [];
  let rows = db.all(
    `SELECT p.*, ${PRODUCT_STOCK_SQL} AS stock FROM products p
     WHERE p.active=1 AND (p.barcode = ? OR p.sku = ?) LIMIT 1`, term, term
  );
  if (!rows.length) {
    const s = `%${term}%`;
    rows = db.all(
      `SELECT p.*, ${PRODUCT_STOCK_SQL} AS stock FROM products p
       WHERE p.active=1 AND (p.name LIKE ? OR p.name_en LIKE ? OR p.manufacturer LIKE ?)
       ORDER BY p.name LIMIT 20`, s, s, s
    );
  }
  return rows.map((p) => {
    const batches = db.all(
      `SELECT id,batch_no,expiry_date,qty,cost FROM batches
       WHERE product_id=? AND qty>0 AND (expiry_date IS NULL OR expiry_date >= date('now','localtime'))
       ORDER BY expiry_date ASC`, p.id
    );
    return { ...p, batches, available: batches.reduce((sum, b) => sum + Number(b.qty), 0) };
  });
}

function saveProduct(body, id, user) {
  const name = String(body.name || '').trim();
  if (!name) throw new AppError('اسم الصنف مطلوب');
  const price = round2(body.price);
  if (price < 0) throw new AppError('السعر غير صالح');
  if (id) {
    const existing = db.get('SELECT * FROM products WHERE id = ?', id);
    if (!existing) throw new AppError('الصنف غير موجود', 404);
    db.run(
      `UPDATE products SET name=?,name_en=?,barcode=?,category_id=?,manufacturer=?,form=?,strength=?,unit=?,
       cost=?,price=?,tax_rate=?,min_stock=?,reorder_qty=?,shelf=?,requires_rx=?,active=?,notes=?,updated_at=datetime('now','localtime')
       WHERE id=?`,
      name, body.name_en || '', body.barcode || existing.barcode || '', body.category_id || null,
      body.manufacturer || '', body.form || '', body.strength || '', body.unit || 'علبة',
      round2(body.cost), price, Number(body.tax_rate) || 0, Number(body.min_stock) || 0,
      Number(body.reorder_qty) || 0, body.shelf || '', body.requires_rx ? 1 : 0,
      body.active === 0 ? 0 : 1, body.notes || '', id
    );
    audit(user.id, 'update', 'product', id, name);
    return getProduct(id);
  }
  let sku = String(body.sku || '').trim();
  if (!sku) {
    const n = (db.get('SELECT MAX(id) AS m FROM products').m || 0) + 1;
    sku = `SKU-${String(n).padStart(4, '0')}`;
  }
  let barcode = String(body.barcode || '').trim();
  if (!barcode) {
    const maxId = (db.get('SELECT MAX(id) AS m FROM products').m || 0) + 1;
    barcode = ean13(`62210${String(maxId).padStart(7, '0')}`);
  }
  const dupe = db.get('SELECT id FROM products WHERE barcode = ? OR sku = ?', barcode, sku);
  if (dupe) throw new AppError('يوجد صنف آخر بنفس الباركود أو الكود');
  const r = db.run(
    `INSERT INTO products(sku,barcode,name,name_en,category_id,manufacturer,form,strength,unit,cost,price,tax_rate,min_stock,reorder_qty,shelf,requires_rx,active,notes)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    sku, barcode, name, body.name_en || '', body.category_id || null, body.manufacturer || '',
    body.form || '', body.strength || '', body.unit || 'علبة', round2(body.cost), price,
    Number(body.tax_rate) || 0, Number(body.min_stock) || 0, Number(body.reorder_qty) || 0,
    body.shelf || '', body.requires_rx ? 1 : 0, 1, body.notes || ''
  );
  const newId = Number(r.lastInsertRowid);
  const openingQty = Number(body.opening_qty || 0);
  if (openingQty > 0) {
    lib.addStock({
      productId: newId, qty: openingQty, cost: round2(body.cost), batchNo: body.batch_no || 'OPENING',
      expiryDate: body.expiry_date || null, refType: 'opening', userId: user.id, note: 'رصيد افتتاحي للصنف'
    });
  }
  audit(user.id, 'create', 'product', newId, name);
  return getProduct(newId);
}

function adjustStock(id, body, user) {
  const p = db.get('SELECT * FROM products WHERE id = ?', id);
  if (!p) throw new AppError('الصنف غير موجود', 404);
  const type = body.type || 'in';
  const qty = Number(body.qty);
  if (!qty || qty <= 0) throw new AppError('أدخل كمية صحيحة');
  const cost = round2(body.cost || p.cost);
  return db.tx(() => {
    if (type === 'in') {
      lib.addStock({
        productId: p.id, qty, cost, batchNo: body.batch_no || 'ADJ', expiryDate: body.expiry_date || null,
        refType: 'adjustment', userId: user.id, note: body.reason || 'تسوية مخزون (إضافة)'
      });
      lib.postJournal({
        date: lib.now(), description: `تسوية مخزون – ${p.name}`, refType: 'stock_adjustment', refId: p.id, userId: user.id,
        lines: [
          { account: '1040', debit: round2(qty * cost) },
          { account: '5070', credit: round2(qty * cost) }
        ]
      });
    } else {
      const allocations = lib.allocateStock(p.id, qty, { allowExpired: true });
      for (const alloc of allocations) lib.deductAllocation(alloc, 'adjustment', p.id, user.id);
      lib.postJournal({
        date: lib.now(), description: `تسوية مخزون – ${p.name}`, refType: 'stock_adjustment', refId: p.id, userId: user.id,
        lines: [
          { account: '5070', debit: round2(qty * cost) },
          { account: '1040', credit: round2(qty * cost) }
        ]
      });
    }
    audit(user.id, 'adjust', 'product', p.id, { type, qty, reason: body.reason });
    return getProduct(p.id);
  });
}

/* ------------------------------------------------------------------ */
/*                              PARTNERS                               */
/* ------------------------------------------------------------------ */
function supplierList(query) {
  const where = ['1=1'];
  const params = [];
  if (query.search) {
    where.push('(s.name LIKE ? OR s.phone LIKE ? OR s.contact_name LIKE ?)');
    const s = `%${query.search}%`;
    params.push(s, s, s);
  }
  if (query.active !== 'all') where.push('s.active = 1');
  const items = db.all(
    `SELECT s.*,
      (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id=s.id) AS purchases_count,
      (SELECT COALESCE(SUM(p.total),0) FROM purchases p WHERE p.supplier_id=s.id) AS purchases_total,
      (SELECT COALESCE(SUM(p.total-p.paid),0) FROM purchases p WHERE p.supplier_id=s.id)
        - (SELECT COALESCE(SUM(r.total),0) FROM returns r WHERE r.supplier_id=s.id AND r.refund_method<>'cash') AS balance
     FROM suppliers s WHERE ${where.join(' AND ')} ORDER BY s.name`, ...params
  );
  return { items };
}

function customerList(query) {
  const where = ['1=1'];
  const params = [];
  if (query.search) {
    where.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
    const s = `%${query.search}%`;
    params.push(s, s, s);
  }
  if (query.active !== 'all') where.push('c.active = 1');
  const items = db.all(
    `SELECT c.*,
      (SELECT COUNT(*) FROM sales s WHERE s.customer_id=c.id AND s.status NOT IN ('void')) AS invoices,
      (SELECT COALESCE(SUM(s.total),0) FROM sales s WHERE s.customer_id=c.id AND s.status NOT IN ('void')) AS total_spent,
      (SELECT COALESCE(SUM(s.total-s.paid),0) FROM sales s WHERE s.customer_id=c.id AND s.status NOT IN ('void'))
        - (SELECT COALESCE(SUM(r.total),0) FROM returns r WHERE r.customer_id=c.id AND r.refund_method='credit') AS balance,
      (SELECT MAX(s.date) FROM sales s WHERE s.customer_id=c.id) AS last_visit
     FROM customers c WHERE ${where.join(' AND ')} ORDER BY c.name`, ...params
  );
  return { items };
}

function customerStatement(id) {
  const customer = db.get('SELECT * FROM customers WHERE id = ?', id);
  if (!customer) throw new AppError('العميل غير موجود', 404);
  const sales = db.all(
    `SELECT id, invoice_no, date, total, paid, payment_method, status FROM sales
     WHERE customer_id = ? ORDER BY date DESC LIMIT 100`, id
  );
  const returns = db.all(
    `SELECT r.*, s.invoice_no FROM returns r LEFT JOIN sales s ON s.id=r.ref_id
     WHERE r.customer_id = ? ORDER BY r.date DESC`, id
  );
  return { customer, sales, returns };
}

/* ------------------------------------------------------------------ */
/*                              ROUTER                                 */
/* ------------------------------------------------------------------ */
async function handle(req, res, url, rawBody) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const query = Object.fromEntries(url.searchParams.entries());
  const method = req.method.toUpperCase();
  const ip = req.socket.remoteAddress;
  let body = {};
  if (rawBody && rawBody.length) {
    const ct = String(req.headers['content-type'] || '');
    if (ct.includes('application/json') || (!ct && rawBody[0] === 0x7b)) {
      if (rawBody.length > JSON_LIMIT) throw new AppError('حجم البيانات كبير جداً', 413);
      try { body = JSON.parse(rawBody.toString('utf8')); } catch (_) { throw new AppError('صيغة البيانات غير صحيحة'); }
    } else {
      body = { __raw: rawBody, __filename: decodeURIComponent(String(req.headers['x-filename'] || '')) };
    }
  }

  /* ---------- public ---------- */
  if (path === '/api/health') return send(res, { ok: true, time: db.nowStamp(), version: '1.0.0' });
  if (path === '/api/public') {
    const s = settingsMap();
    return send(res, {
      pharmacy_name: s.pharmacy_name, pharmacy_name_en: s.pharmacy_name_en,
      currency: s.currency, phone: s.phone, address: s.address,
      has_users: db.get('SELECT COUNT(*) AS c FROM users').c > 0
    });
  }
  if (path === '/api/auth/login' && method === 'POST') {
    const ip = req.socket.remoteAddress;
    return send(res, login(body, ip));
  }

  /* ---------- authenticate ---------- */
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : query.token;
  const payload = sec.verifyToken(token);
  if (!payload) throw new AppError('انتهت الجلسة أو غير صالحة، يرجى تسجيل الدخول', 401);
  const user = db.get('SELECT * FROM users WHERE id = ?', payload.uid);
  if (!user || !user.active) throw new AppError('الحساب غير متاح', 401);
  user.permissions = sec.permissionsForUser(user);

  const seg = path.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const [r0, r1, r2] = seg;
  const id = r1 ? Number(r1) : null;

  /* ---------- session ---------- */
  if (r0 === 'auth' && r1 === 'me' && method === 'GET') return send(res, userPayload(user));
  if (r0 === 'auth' && r1 === 'password' && method === 'POST') {
    const current = String(body.current || '');
    const next = String(body.next || '');
    if (next.length < 6) throw new AppError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
    if (!sec.verifyPassword(current, user.password_hash)) throw new AppError('كلمة المرور الحالية غير صحيحة');
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', sec.hashPassword(next), user.id);
    audit(user.id, 'change_password', 'user', user.id);
    return send(res, { ok: true });
  }

  /* ---------- dashboard / notifications ---------- */
  if (r0 === 'dashboard') { need(user, 'dashboard.view'); return send(res, dashboard(user, query)); }
  if (r0 === 'notifications') {
    const s = settingsMap();
    const expiryDays = Number(s.expiry_alert_days || 90);
    const lowStock = db.all(
      `SELECT p.id, p.name, p.unit, p.min_stock, ${PRODUCT_STOCK_SQL} AS stock FROM products p
       WHERE p.active=1 AND ${PRODUCT_STOCK_SQL} <= p.min_stock ORDER BY stock ASC LIMIT 20`
    );
    const expiring = db.all(
      `SELECT b.id,b.batch_no,b.expiry_date,b.qty,p.name,p.id AS product_id,
        CAST(julianday(b.expiry_date)-julianday(date('now','localtime')) AS INTEGER) AS days_left
       FROM batches b JOIN products p ON p.id=b.product_id
       WHERE b.qty>0 AND b.expiry_date IS NOT NULL AND b.expiry_date <= date('now','localtime',?)
       ORDER BY b.expiry_date LIMIT 20`, `+${expiryDays} days`
    );
    const shift = lib.currentShift(user.id);
    const pendingRx = db.get("SELECT COUNT(*) AS c FROM prescriptions WHERE status='pending'").c;
    const due = db.get('SELECT COALESCE(SUM(total-paid),0) AS v, COUNT(*) AS c FROM purchases WHERE total > paid');
    return send(res, { low_stock: lowStock, expiring, shift, pending_rx: pendingRx, supplier_due: due.v, supplier_due_count: due.c });
  }

  /* ---------- inventory ---------- */
  if (r0 === 'inventory' && r1 === 'movements' && method === 'GET') {
    need(user, 'products.view');
    const where = ['1=1'];
    const params = [];
    if (query.product) { where.push('m.product_id = ?'); params.push(Number(query.product)); }
    if (query.type) { where.push('m.type = ?'); params.push(query.type); }
    if (query.from) { where.push('m.created_at >= ?'); params.push(`${query.from} 00:00:00`); }
    if (query.to) { where.push('m.created_at <= ?'); params.push(`${query.to} 23:59:59`); }
    if (query.search) {
      where.push('(p.name LIKE ? OR b.batch_no LIKE ? OR m.note LIKE ? OR m.ref_type LIKE ?)');
      const s = `%${query.search}%`; params.push(s, s, s, s);
    }
    const limit = Math.min(500, Math.max(10, Number(query.limit) || 150));
    return send(res, { items: db.all(
      `SELECT m.*, p.name AS product_name, p.unit, b.batch_no, u.full_name AS user_name
       FROM stock_movements m LEFT JOIN products p ON p.id=m.product_id
       LEFT JOIN batches b ON b.id=m.batch_id LEFT JOIN users u ON u.id=m.user_id
       WHERE ${where.join(' AND ')} ORDER BY m.id DESC LIMIT ?`, ...params, limit
    ) });
  }

  /* ---------- products ---------- */
  if (r0 === 'products') {
    if (!r1 && method === 'GET') { need(user, 'products.view'); return send(res, productList(query)); }
    if (r1 === 'lookup' && method === 'GET') { need(user, 'products.view'); return send(res, lookupProducts(query)); }
    if (!r1 && method === 'POST') { need(user, 'products.manage'); return send(res, saveProduct(body, null, user), 201); }
    if (r1 && r2 === 'adjust' && method === 'POST') { need(user, 'inventory.manage'); return send(res, adjustStock(id, body, user)); }
    if (r1 && r2 === 'movements' && method === 'GET') {
      need(user, 'products.view');
      return send(res, db.all(
        `SELECT m.*, b.batch_no, u.full_name AS user_name FROM stock_movements m
         LEFT JOIN batches b ON b.id=m.batch_id LEFT JOIN users u ON u.id=m.user_id
         WHERE m.product_id=? ORDER BY m.id DESC LIMIT ?`, id, Math.min(500, Number(query.limit) || 100)
      ));
    }
    if (id && method === 'GET') { need(user, 'products.view'); return send(res, getProduct(id)); }
    if (id && method === 'PUT') { need(user, 'products.manage'); return send(res, saveProduct(body, id, user)); }
    if (id && method === 'DELETE') {
      need(user, 'products.manage');
      const p = db.get('SELECT * FROM products WHERE id = ?', id);
      if (!p) throw new AppError('الصنف غير موجود', 404);
      db.run('UPDATE products SET active = 0, updated_at=datetime(\'now\',\'localtime\') WHERE id = ?', id);
      audit(user.id, 'delete', 'product', id, p.name);
      return send(res, { ok: true });
    }
  }

  /* ---------- categories ---------- */
  if (r0 === 'categories') {
    if (method === 'GET') {
      need(user, 'products.view');
      return send(res, { items: db.all(
        `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.active=1) AS products_count
         FROM categories c ORDER BY c.name` ) });
    }
    if (method === 'POST') {
      need(user, 'products.manage');
      const name = String(body.name || '').trim();
      if (!name) throw new AppError('اسم التصنيف مطلوب');
      const r = db.run('INSERT INTO categories(name,description,color) VALUES(?,?,?)', name, body.description || '', body.color || '#0ea5e9');
      return send(res, db.get('SELECT * FROM categories WHERE id = ?', Number(r.lastInsertRowid)), 201);
    }
    if (method === 'PUT' && id) {
      need(user, 'products.manage');
      db.run('UPDATE categories SET name=?,description=?,color=? WHERE id=?', String(body.name || '').trim(), body.description || '', body.color || '#0ea5e9', id);
      return send(res, db.get('SELECT * FROM categories WHERE id = ?', id));
    }
    if (method === 'DELETE' && id) {
      need(user, 'products.manage');
      const used = db.get('SELECT COUNT(*) AS c FROM products WHERE category_id = ?', id).c;
      if (used) throw new AppError('لا يمكن حذف تصنيف مرتبط بأصناف');
      db.run('DELETE FROM categories WHERE id = ?', id);
      return send(res, { ok: true });
    }
  }

  /* ---------- suppliers ---------- */
  if (r0 === 'suppliers') {
    if (method === 'GET' && !r1) { need(user, 'products.view'); return send(res, supplierList(query)); }
    if (method === 'GET' && r1 === 'options') {
      need(user, 'products.view');
      return send(res, { items: db.all('SELECT id,name FROM suppliers WHERE active=1 ORDER BY name') });
    }
    if (method === 'GET' && id) {
      need(user, 'products.view');
      const supplier = db.get('SELECT * FROM suppliers WHERE id = ?', id);
      if (!supplier) throw new AppError('المورد غير موجود', 404);
      return send(res, {
        supplier,
        purchases: db.all('SELECT * FROM purchases WHERE supplier_id=? ORDER BY date DESC LIMIT 100', id),
        returns: db.all('SELECT * FROM returns WHERE supplier_id=? ORDER BY date DESC', id),
        balance: db.get(
          `SELECT COALESCE(SUM(total-paid),0) AS due FROM purchases WHERE supplier_id=?`, id
        ).due - db.get(
          `SELECT COALESCE(SUM(total),0) AS c FROM returns WHERE supplier_id=? AND refund_method<>'cash'`, id
        ).c
      });
    }
    if (method === 'POST') {
      need(user, 'suppliers.manage');
      if (!String(body.name || '').trim()) throw new AppError('اسم المورد مطلوب');
      const r = db.run(
        `INSERT INTO suppliers(name,contact_name,phone,email,address,tax_no,opening_balance,notes,active)
         VALUES(?,?,?,?,?,?,?,?,?)`,
        body.name, body.contact_name || '', body.phone || '', body.email || '', body.address || '',
        body.tax_no || '', Number(body.opening_balance) || 0, body.notes || '', body.active === 0 ? 0 : 1
      );
      const newId = Number(r.lastInsertRowid);
      audit(user.id, 'create', 'supplier', newId, body.name);
      return send(res, db.get('SELECT * FROM suppliers WHERE id=?', newId), 201);
    }
    if (method === 'PUT' && id) {
      need(user, 'suppliers.manage');
      db.run(
        `UPDATE suppliers SET name=?,contact_name=?,phone=?,email=?,address=?,tax_no=?,opening_balance=?,notes=?,active=? WHERE id=?`,
        body.name, body.contact_name || '', body.phone || '', body.email || '', body.address || '',
        body.tax_no || '', Number(body.opening_balance) || 0, body.notes || '', body.active === 0 ? 0 : 1, id
      );
      audit(user.id, 'update', 'supplier', id, body.name);
      return send(res, db.get('SELECT * FROM suppliers WHERE id=?', id));
    }
    if (method === 'DELETE' && id) {
      need(user, 'suppliers.manage');
      const used = db.get('SELECT COUNT(*) AS c FROM purchases WHERE supplier_id=?', id).c;
      if (used) db.run('UPDATE suppliers SET active=0 WHERE id=?', id);
      else db.run('DELETE FROM suppliers WHERE id=?', id);
      return send(res, { ok: true });
    }
  }

  /* ---------- customers ---------- */
  if (r0 === 'customers') {
    if (method === 'GET' && !r1) { need(user, 'customers.manage'); return send(res, customerList(query)); }
    if (method === 'GET' && r1 === 'options') {
      need(user, 'pos.use');
      return send(res, { items: db.all('SELECT id,name,phone,loyalty_points FROM customers WHERE active=1 ORDER BY name') });
    }
    if (method === 'GET' && r1 && r2 === 'statement') {
      need(user, 'customers.manage');
      return send(res, customerStatement(id));
    }
    if (method === 'GET' && id) { need(user, 'customers.manage'); return send(res, customerStatement(id)); }
    if (method === 'POST') {
      need(user, 'customers.manage');
      if (!String(body.name || '').trim()) throw new AppError('اسم العميل مطلوب');
      const r = db.run(
        `INSERT INTO customers(name,phone,email,address,insurance,opening_balance,notes,loyalty_points,active)
         VALUES(?,?,?,?,?,?,?,?,?)`,
        body.name, body.phone || '', body.email || '', body.address || '', body.insurance || '',
        Number(body.opening_balance) || 0, body.notes || '', Number(body.loyalty_points) || 0, body.active === 0 ? 0 : 1
      );
      return send(res, db.get('SELECT * FROM customers WHERE id=?', Number(r.lastInsertRowid)), 201);
    }
    if (method === 'PUT' && id) {
      need(user, 'customers.manage');
      db.run(
        `UPDATE customers SET name=?,phone=?,email=?,address=?,insurance=?,opening_balance=?,notes=?,loyalty_points=?,active=? WHERE id=?`,
        body.name, body.phone || '', body.email || '', body.address || '', body.insurance || '',
        Number(body.opening_balance) || 0, body.notes || '', Number(body.loyalty_points) || 0,
        body.active === 0 ? 0 : 1, id
      );
      return send(res, db.get('SELECT * FROM customers WHERE id=?', id));
    }
    if (method === 'DELETE' && id) {
      need(user, 'customers.manage');
      const used = db.get('SELECT COUNT(*) AS c FROM sales WHERE customer_id=?', id).c;
      if (used) db.run('UPDATE customers SET active=0 WHERE id=?', id);
      else db.run('DELETE FROM customers WHERE id=?', id);
      return send(res, { ok: true });
    }
  }

  /* ---------- sales ---------- */
  if (r0 === 'sales') {
    if (method === 'GET' && !r1) {
      need(user, 'sales.view');
      const where = ['1=1'];
      const params = [];
      if (query.from) { where.push('s.date >= ?'); params.push(`${query.from} 00:00:00`); }
      if (query.to) { where.push('s.date <= ?'); params.push(`${query.to} 23:59:59`); }
      if (query.status) { where.push('s.status = ?'); params.push(query.status); }
      if (query.method) { where.push('s.payment_method = ?'); params.push(query.method); }
      if (query.shift) { where.push('s.shift_id = ?'); params.push(Number(query.shift)); }
      if (query.search) {
        where.push('(s.invoice_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
        const s = `%${query.search}%`; params.push(s, s, s);
      }
      if (query.customer) { where.push('s.customer_id = ?'); params.push(Number(query.customer)); }
      const { page, perPage, offset } = paging(query);
      const w = where.join(' AND ');
      const total = db.get(
        `SELECT COUNT(*) AS c FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE ${w}`, ...params
      ).c;
      const items = db.all(
        `SELECT s.*, c.name AS customer_name, u.full_name AS cashier_name, sh.id AS shift_ref,
          (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id=s.id) AS items_count
         FROM sales s LEFT JOIN customers c ON c.id=s.customer_id
         LEFT JOIN users u ON u.id=s.user_id LEFT JOIN shifts sh ON sh.id=s.shift_id
         WHERE ${w} ORDER BY s.id DESC LIMIT ? OFFSET ?`, ...params, perPage, offset
      );
      return send(res, paged(items, total, page, perPage));
    }
    if (method === 'GET' && id) { need(user, 'sales.view'); return send(res, lib.getSale(id)); }
    if (method === 'POST' && !r1) {
      need(user, 'pos.use');
      const sale = lib.createSale({ ...body, user_id: user.id });
      audit(user.id, 'create', 'sale', sale.id, sale.invoice_no);
      return send(res, sale, 201);
    }
    if (method === 'POST' && r1 && r2 === 'return') {
      need(user, 'returns.manage');
      const ret = lib.createSaleReturn({ ...body, sale_id: id, user_id: user.id });
      audit(user.id, 'return', 'sale', id, ret.return_no);
      return send(res, ret, 201);
    }
    if (method === 'POST' && r1 && r2 === 'void') {
      need(user, 'sales.manage');
      const result = lib.voidSale(id, user.id);
      audit(user.id, 'void', 'sale', id);
      return send(res, result);
    }
  }

  /* ---------- purchases ---------- */
  if (r0 === 'purchases') {
    if (method === 'GET' && !r1) {
      need(user, 'purchases.view');
      const where = ['1=1'];
      const params = [];
      if (query.from) { where.push('p.date >= ?'); params.push(`${query.from} 00:00:00`); }
      if (query.to) { where.push('p.date <= ?'); params.push(`${query.to} 23:59:59`); }
      if (query.supplier) { where.push('p.supplier_id = ?'); params.push(Number(query.supplier)); }
      if (query.status === 'unpaid') where.push('p.total > p.paid');
      if (query.search) {
        where.push('(p.invoice_no LIKE ? OR s.name LIKE ?)');
        const s = `%${query.search}%`; params.push(s, s);
      }
      const { page, perPage, offset } = paging(query);
      const w = where.join(' AND ');
      const total = db.get(
        `SELECT COUNT(*) AS c FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE ${w}`, ...params
      ).c;
      const items = db.all(
        `SELECT p.*, s.name AS supplier_name,
          (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id=p.id) AS items_count
         FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id
         WHERE ${w} ORDER BY p.id DESC LIMIT ? OFFSET ?`, ...params, perPage, offset
      );
      return send(res, paged(items, total, page, perPage));
    }
    if (method === 'GET' && id) { need(user, 'purchases.view'); return send(res, lib.getPurchase(id)); }
    if (method === 'POST' && !r1) {
      need(user, 'purchases.manage');
      const purchase = lib.createPurchase({ ...body, user_id: user.id });
      audit(user.id, 'create', 'purchase', purchase.id, purchase.invoice_no);
      return send(res, purchase, 201);
    }
    if (method === 'POST' && r1 && r2 === 'pay') {
      need(user, 'purchases.manage');
      const purchase = lib.payPurchase(id, body.amount, user.id);
      audit(user.id, 'pay', 'purchase', id, body.amount);
      return send(res, purchase);
    }
    if (method === 'POST' && r1 && r2 === 'return') {
      need(user, 'purchases.manage');
      const ret = lib.createPurchaseReturn({ ...body, purchase_id: id, user_id: user.id });
      audit(user.id, 'return', 'purchase', id, ret.return_no);
      return send(res, ret, 201);
    }
  }

  /* ---------- returns ---------- */
  if (r0 === 'returns' && method === 'GET' && r1) {
    need(user, 'sales.view');
    const ret = db.get(
      `SELECT r.*, c.name AS customer_name, c.phone AS customer_phone, s.name AS supplier_name,
              u.full_name AS user_name, sh.id AS shift_ref,
              (SELECT invoice_no FROM sales WHERE id = r.ref_id AND r.type='sale') AS sale_invoice,
              (SELECT invoice_no FROM purchases WHERE id = r.ref_id AND r.type='purchase') AS purchase_invoice
       FROM returns r LEFT JOIN customers c ON c.id=r.customer_id
       LEFT JOIN suppliers s ON s.id=r.supplier_id LEFT JOIN users u ON u.id=r.user_id
       LEFT JOIN shifts sh ON sh.id=r.shift_id WHERE r.id = ?`, id
    );
    if (!ret) throw new AppError('المرتجع غير موجود', 404);
    ret.items = db.all(
      `SELECT ri.*, p.name, p.unit FROM return_items ri
       LEFT JOIN products p ON p.id=ri.product_id WHERE ri.return_id=? ORDER BY ri.id`, id
    );
    return send(res, ret);
  }
  if (r0 === 'returns' && method === 'GET') {
    need(user, 'sales.view');
    const where = ['1=1'];
    const params = [];
    if (query.type) { where.push('r.type = ?'); params.push(query.type); }
    if (query.from) { where.push('r.date >= ?'); params.push(`${query.from} 00:00:00`); }
    if (query.to) { where.push('r.date <= ?'); params.push(`${query.to} 23:59:59`); }
    const { page, perPage, offset } = paging(query);
    const w = where.join(' AND ');
    const total = db.get(`SELECT COUNT(*) AS c FROM returns r WHERE ${w}`, ...params).c;
    const items = db.all(
      `SELECT r.*, c.name AS customer_name, s.name AS supplier_name,
        COALESCE(si.invoice_no, pi.invoice_no) AS ref_invoice,
        (SELECT COUNT(*) FROM return_items ri WHERE ri.return_id=r.id) AS items_count
       FROM returns r
       LEFT JOIN customers c ON c.id=r.customer_id
       LEFT JOIN suppliers s ON s.id=r.supplier_id
       LEFT JOIN sales si ON r.type='sale' AND si.id=r.ref_id
       LEFT JOIN purchases pi ON r.type='purchase' AND pi.id=r.ref_id
       WHERE ${w} ORDER BY r.id DESC LIMIT ? OFFSET ?`, ...params, perPage, offset
    );
    return send(res, paged(items, total, page, perPage));
  }

  /* ---------- prescriptions ---------- */
  if (r0 === 'prescriptions') {
    if (method === 'GET' && !r1) {
      need(user, 'prescriptions.manage');
      const where = ['1=1'];
      const params = [];
      if (query.search) { where.push('(p.patient_name LIKE ? OR p.doctor_name LIKE ? OR p.rx_no LIKE ?)'); const s = `%${query.search}%`; params.push(s, s, s); }
      if (query.status) { where.push('p.status = ?'); params.push(query.status); }
      const { page, perPage, offset } = paging(query);
      const total = db.get(`SELECT COUNT(*) AS c FROM prescriptions p WHERE ${where.join(' AND ')}`, ...params).c;
      const items = db.all(
        `SELECT p.*, c.name AS customer_name,
          (SELECT COUNT(*) FROM prescription_items pi WHERE pi.prescription_id=p.id) AS items_count
         FROM prescriptions p LEFT JOIN customers c ON c.id=p.customer_id
         WHERE ${where.join(' AND ')} ORDER BY p.id DESC LIMIT ? OFFSET ?`, ...params, perPage, offset
      );
      return send(res, paged(items, total, page, perPage));
    }
    if (method === 'GET' && id) {
      need(user, 'prescriptions.manage');
      const rx = db.get(
        `SELECT p.*, c.name AS customer_name FROM prescriptions p
         LEFT JOIN customers c ON c.id=p.customer_id WHERE p.id=?`, id
      );
      if (!rx) throw new AppError('الروشتة غير موجودة', 404);
      rx.items = db.all('SELECT * FROM prescription_items WHERE prescription_id=?', id);
      return send(res, rx);
    }
    if (method === 'POST' && !r1) {
      need(user, 'prescriptions.manage');
      if (!String(body.patient_name || '').trim()) throw new AppError('اسم المريض مطلوب');
      return db.tx(() => {
        const rxNo = lib.nextNo('RX', 'prescriptions', 'rx_no', db.today());
        const r = db.run(
          `INSERT INTO prescriptions(rx_no,customer_id,patient_name,doctor_name,doctor_phone,date,status,notes,user_id)
           VALUES(?,?,?,?,?,?,?,?,?)`,
          rxNo, body.customer_id || null, body.patient_name, body.doctor_name || '', body.doctor_phone || '',
          body.date || lib.now(), body.status || 'pending', body.notes || '', user.id
        );
        const rxId = Number(r.lastInsertRowid);
        for (const it of body.items || []) {
          if (!it.name) continue;
          db.run('INSERT INTO prescription_items(prescription_id,product_id,name,dosage,qty,dispensed) VALUES(?,?,?,?,?,?)',
            rxId, it.product_id || null, it.name, it.dosage || '', Number(it.qty) || 1, it.dispensed ? 1 : 0);
        }
        return send(res, { id: rxId, rx_no: rxNo }, 201);
      });
    }
    if (method === 'PUT' && id) {
      need(user, 'prescriptions.manage');
      return db.tx(() => {
        db.run('UPDATE prescriptions SET customer_id=?,patient_name=?,doctor_name=?,doctor_phone=?,date=?,status=?,notes=? WHERE id=?',
          body.customer_id || null, body.patient_name, body.doctor_name || '', body.doctor_phone || '',
          body.date || lib.now(), body.status || 'pending', body.notes || '', id);
        db.run('DELETE FROM prescription_items WHERE prescription_id=?', id);
        for (const it of body.items || []) {
          if (!it.name) continue;
          db.run('INSERT INTO prescription_items(prescription_id,product_id,name,dosage,qty,dispensed) VALUES(?,?,?,?,?,?)',
            id, it.product_id || null, it.name, it.dosage || '', Number(it.qty) || 1, it.dispensed ? 1 : 0);
        }
        return send(res, { ok: true });
      });
    }
    if (method === 'DELETE' && id) {
      need(user, 'prescriptions.manage');
      db.run('DELETE FROM prescriptions WHERE id=?', id);
      return send(res, { ok: true });
    }
  }

  /* ---------- shifts ---------- */
  if (r0 === 'shifts') {
    if (method === 'GET' && r1 === 'current') {
      need(user, 'shifts.use');
      const shift = lib.currentShift(user.id);
      return send(res, { shift, report: shift ? lib.shiftReport(shift.id) : null });
    }
    if (method === 'GET' && !r1) {
      need(user, 'shifts.use');
      const where = ['1=1'];
      const params = [];
      if (query.from) { where.push('s.opened_at >= ?'); params.push(`${query.from} 00:00:00`); }
      if (query.to) { where.push('s.opened_at <= ?'); params.push(`${query.to} 23:59:59`); }
      if (query.user) { where.push('s.user_id = ?'); params.push(Number(query.user)); }
      if (query.status) { where.push('s.status = ?'); params.push(query.status); }
      const { page, perPage, offset } = paging(query);
      const total = db.get(`SELECT COUNT(*) AS c FROM shifts s WHERE ${where.join(' AND ')}`, ...params).c;
      const items = db.all(
        `SELECT s.*, u.full_name AS user_name,
          (SELECT COUNT(*) FROM sales sa WHERE sa.shift_id=s.id AND sa.status NOT IN ('void')) AS invoices,
          (SELECT COALESCE(SUM(sa.total),0) FROM sales sa WHERE sa.shift_id=s.id AND sa.status NOT IN ('void')) AS sales_total
         FROM shifts s JOIN users u ON u.id=s.user_id WHERE ${where.join(' AND ')}
         ORDER BY s.id DESC LIMIT ? OFFSET ?`, ...params, perPage, offset
      );
      return send(res, paged(items, total, page, perPage));
    }
    if (method === 'POST' && r1 === 'open') {
      need(user, 'shifts.use');
      const shift = lib.openShift(user.id, body.opening_cash);
      audit(user.id, 'open_shift', 'shift', shift.id, body.opening_cash);
      return send(res, shift, 201);
    }
    if (method === 'POST' && r1 && r2 === 'close') {
      need(user, 'shifts.use');
      const shift = db.get('SELECT * FROM shifts WHERE id=?', id);
      if (!shift) throw new AppError('الوردية غير موجودة', 404);
      if (shift.user_id !== user.id && !user.permissions.includes('shifts.manage')) {
        throw new AppError('لا يمكنك إغلاق وردية مستخدم آخر', 403);
      }
      const report = lib.closeShift(id, body.closing_cash, body.notes, user.id);
      audit(user.id, 'close_shift', 'shift', id, report.shift.difference);
      return send(res, report);
    }
    if (method === 'POST' && r1 && r2 === 'cash') {
      need(user, 'shifts.use');
      const type = body.type === 'out' ? 'out' : 'in';
      const amount = round2(body.amount);
      if (amount <= 0) throw new AppError('المبلغ غير صالح');
      const r = db.run('INSERT INTO cash_movements(shift_id,type,amount,reason,user_id) VALUES(?,?,?,?,?)',
        id, type, amount, body.reason || '', user.id);
      audit(user.id, 'cash_movement', 'shift', id, { type, amount });
      return send(res, { id: Number(r.lastInsertRowid) }, 201);
    }
    if (method === 'GET' && id) { need(user, 'shifts.use'); return send(res, lib.shiftReport(id)); }
  }

  /* ---------- accounting ---------- */
  if (r0 === 'accounts') {
    if (method === 'GET') {
      need(user, 'accounting.view');
      const rows = db.all(
        `SELECT a.*, COALESCE((SELECT SUM(jl.debit-jl.credit) FROM journal_lines jl WHERE jl.account_id=a.id),0) AS balance
         FROM accounts a ORDER BY a.code`
      );
      return send(res, { items: rows });
    }
    if (method === 'POST') {
      need(user, 'accounting.manage');
      const code = String(body.code || '').trim();
      if (!code || !body.name) throw new AppError('كود واسم الحساب مطلوبان');
      if (db.get('SELECT id FROM accounts WHERE code=?', code)) throw new AppError('كود الحساب مستخدم');
      const r = db.run('INSERT INTO accounts(code,name,type,parent_id,is_system) VALUES(?,?,?,?,0)',
        code, body.name, body.type || 'asset', body.parent_id || null);
      return send(res, db.get('SELECT * FROM accounts WHERE id=?', Number(r.lastInsertRowid)), 201);
    }
    if (method === 'PUT' && id) {
      need(user, 'accounting.manage');
      db.run('UPDATE accounts SET name=?,type=?,parent_id=? WHERE id=?', body.name, body.type, body.parent_id || null, id);
      return send(res, { ok: true });
    }
    if (method === 'DELETE' && id) {
      need(user, 'accounting.manage');
      const acc = db.get('SELECT * FROM accounts WHERE id=?', id);
      if (!acc) throw new AppError('الحساب غير موجود', 404);
      if (acc.is_system) throw new AppError('لا يمكن حذف حساب نظامي');
      if (db.get('SELECT COUNT(*) AS c FROM journal_lines WHERE account_id=?', id).c) throw new AppError('الحساب يحتوي على حركات ولا يمكن حذفه');
      if (db.get('SELECT COUNT(*) AS c FROM accounts WHERE parent_id=?', id).c) throw new AppError('احذف الحسابات الفرعية أولاً');
      db.run('DELETE FROM accounts WHERE id=?', id);
      return send(res, { ok: true });
    }
  }

  if (r0 === 'journal') {
    if (method === 'GET' && !r1) {
      need(user, 'accounting.view');
      const where = ['1=1'];
      const params = [];
      if (query.from) { where.push('j.date >= ?'); params.push(`${query.from} 00:00:00`); }
      if (query.to) { where.push('j.date <= ?'); params.push(`${query.to} 23:59:59`); }
      if (query.search) { where.push('(j.description LIKE ? OR j.entry_no LIKE ?)'); const s = `%${query.search}%`; params.push(s, s); }
      if (query.ref_type) { where.push('j.ref_type = ?'); params.push(query.ref_type); }
      const { page, perPage, offset } = paging(query);
      const w = where.join(' AND ');
      const total = db.get(`SELECT COUNT(*) AS c FROM journal_entries j WHERE ${w}`, ...params).c;
      const items = db.all(
        `SELECT j.*, u.full_name AS user_name,
          (SELECT COALESCE(SUM(debit),0) FROM journal_lines l WHERE l.entry_id=j.id) AS debit,
          (SELECT COALESCE(SUM(credit),0) FROM journal_lines l WHERE l.entry_id=j.id) AS credit,
          (SELECT COUNT(*) FROM journal_lines l WHERE l.entry_id=j.id) AS lines_count
         FROM journal_entries j LEFT JOIN users u ON u.id=j.user_id
         WHERE ${w} ORDER BY j.id DESC LIMIT ? OFFSET ?`, ...params, perPage, offset
      );
      return send(res, paged(items, total, page, perPage));
    }
    if (method === 'GET' && id) {
      need(user, 'accounting.view');
      const entry = db.get('SELECT * FROM journal_entries WHERE id=?', id);
      if (!entry) throw new AppError('القيد غير موجود', 404);
      entry.lines = db.all(
        `SELECT l.*, a.code, a.name AS account_name FROM journal_lines l
         JOIN accounts a ON a.id=l.account_id WHERE l.entry_id=?`, id
      );
      return send(res, entry);
    }
    if (method === 'POST') {
      need(user, 'accounting.manage');
      const lines = (body.lines || []).filter((l) => Number(l.debit) || Number(l.credit));
      if (lines.length < 2) throw new AppError('القيد يحتاج سطرين على الأقل');
      const debit = round2(lines.reduce((s, l) => s + Number(l.debit || 0), 0));
      const credit = round2(lines.reduce((s, l) => s + Number(l.credit || 0), 0));
      if (Math.abs(debit - credit) > 0.009) throw new AppError(`القيد غير متوازن (مدين ${debit} / دائن ${credit})`);
      const entryId = lib.postJournal({
        date: body.date || lib.now(), description: body.description || 'قيد يومية يدوي',
        refType: 'manual', userId: user.id,
        lines: lines.map((l) => ({ account: Number(l.account_id), debit: l.debit, credit: l.credit, description: l.description || '' }))
      });
      audit(user.id, 'create', 'journal', entryId, body.description);
      return send(res, { id: entryId }, 201);
    }
    if (method === 'DELETE' && id) {
      need(user, 'accounting.manage');
      const entry = db.get('SELECT * FROM journal_entries WHERE id=?', id);
      if (!entry) throw new AppError('القيد غير موجود', 404);
      if (entry.ref_type && entry.ref_type !== 'manual') throw new AppError('لا يمكن حذف قيد ناتج عن عملية نظامية');
      db.run('DELETE FROM journal_entries WHERE id=?', id);
      audit(user.id, 'delete', 'journal', id);
      return send(res, { ok: true });
    }
  }

  if (r0 === 'accounting') {
    if (!r1) return send(res, { error: 'Not found' }, 404);
    if (r1 === 'trial-balance') {
      need(user, 'accounting.view');
      const { fromTs, toTs, from, to } = dateRange(query, 3650);
      const rows = db.all(
        `SELECT a.id,a.code,a.name,a.type,
          COALESCE(SUM(CASE WHEN j.id IS NOT NULL THEN l.debit ELSE 0 END),0) AS debit,
          COALESCE(SUM(CASE WHEN j.id IS NOT NULL THEN l.credit ELSE 0 END),0) AS credit
         FROM accounts a
         LEFT JOIN journal_lines l ON l.account_id=a.id
         LEFT JOIN journal_entries j ON j.id=l.entry_id AND j.date BETWEEN ? AND ?
         GROUP BY a.id ORDER BY a.code`, fromTs, toTs
      );
      const totals = {
        debit: round2(rows.reduce((s, r) => s + Number(r.debit), 0)),
        credit: round2(rows.reduce((s, r) => s + Number(r.credit), 0))
      };
      return send(res, { from, to, rows, totals });
    }
    if (r1 === 'pnl') {
      need(user, 'accounting.view');
      const { fromTs, toTs, from, to } = dateRange(query, 30);
      const rows = db.all(
        `SELECT a.id,a.code,a.name,a.type,
          COALESCE(SUM(l.debit),0) AS debit, COALESCE(SUM(l.credit),0) AS credit
         FROM accounts a JOIN journal_lines l ON l.account_id=a.id
         JOIN journal_entries j ON j.id=l.entry_id
         WHERE j.date BETWEEN ? AND ? AND a.type IN ('revenue','expense')
         GROUP BY a.id ORDER BY a.code`, fromTs, toTs
      );
      const revenue = rows.filter((r) => r.type === 'revenue')
        .map((r) => ({ ...r, net: round2(r.credit - r.debit) }));
      const expenses = rows.filter((r) => r.type === 'expense')
        .map((r) => ({ ...r, net: round2(r.debit - r.credit) }));
      const revenueTotal = round2(revenue.reduce((s, r) => s + r.net, 0));
      const expenseTotal = round2(expenses.reduce((s, r) => s + r.net, 0));
      return send(res, {
        from, to, revenue, expenses, revenue_total: revenueTotal, expense_total: expenseTotal,
        net_profit: round2(revenueTotal - expenseTotal),
        margin: revenueTotal ? round2(((revenueTotal - expenseTotal) / revenueTotal) * 100) : 0
      });
    }
    if (r1 === 'balance-sheet') {
      need(user, 'accounting.view');
      const asOf = query.asOf || db.today();
      const toTs = `${asOf} 23:59:59`;
      const rows = db.all(
        `SELECT a.type, a.code, a.name, COALESCE(SUM(l.debit-l.credit),0) AS net
         FROM accounts a LEFT JOIN journal_lines l ON l.account_id=a.id
         LEFT JOIN journal_entries j ON j.id=l.entry_id AND j.date <= ?
         GROUP BY a.id ORDER BY a.code`, toTs
      );
      const assets = rows.filter((r) => r.type === 'asset' && r.net !== 0)
        .map((r) => ({ ...r, balance: round2(r.net) }));
      const liabilities = rows.filter((r) => r.type === 'liability')
        .map((r) => ({ ...r, balance: round2(-r.net) }));
      const equity = rows.filter((r) => r.type === 'equity')
        .map((r) => ({ ...r, balance: round2(-r.net) }));
      const pnlRows = rows.filter((r) => r.type === 'revenue' || r.type === 'expense');
      const revenue = round2(pnlRows.filter((r) => r.type === 'revenue').reduce((s, r) => s - Number(r.net), 0));
      const expense = round2(pnlRows.filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.net), 0));
      const netProfit = round2(revenue - expense);
      const assetsTotal = round2(assets.reduce((s, r) => s + r.balance, 0));
      const liabilitiesTotal = round2(liabilities.reduce((s, r) => s + r.balance, 0));
      const equityTotal = round2(equity.reduce((s, r) => s + r.balance, 0) + netProfit);
      return send(res, {
        as_of: asOf, assets, liabilities, equity,
        net_profit: netProfit, revenue, expense,
        assets_total: assetsTotal, liabilities_total: liabilitiesTotal, equity_total: equityTotal,
        balanced: Math.abs(assetsTotal - (liabilitiesTotal + equityTotal)) < 0.05
      });
    }
    if (r1 === 'ledger') {
      need(user, 'accounting.view');
      const accountIdNum = Number(query.account_id);
      const account = db.get('SELECT * FROM accounts WHERE id=?', accountIdNum);
      if (!account) throw new AppError('الحساب غير موجود', 404);
      const { fromTs, toTs, from, to } = dateRange(query, 30);
      const opening = db.get(
        `SELECT COALESCE(SUM(l.debit-l.credit),0) AS net FROM journal_lines l
         JOIN journal_entries j ON j.id=l.entry_id WHERE l.account_id=? AND j.date < ?`,
        accountIdNum, fromTs
      ).net;
      const lines = db.all(
        `SELECT l.*, j.entry_no, j.date, j.description AS entry_description
         FROM journal_lines l JOIN journal_entries j ON j.id=l.entry_id
         WHERE l.account_id=? AND j.date BETWEEN ? AND ? ORDER BY j.date, j.id, l.id`,
        accountIdNum, fromTs, toTs
      );
      return send(res, { account, from, to, opening: round2(opening), lines });
    }
    if (r1 === 'cashflow') {
      need(user, 'accounting.view');
      const { fromTs, toTs, from, to } = dateRange(query, 30);
      const rows = db.all(
        `SELECT substr(j.date,1,10) AS day,
           COALESCE(SUM(CASE WHEN a.code IN ('1010','1020') THEN l.debit-l.credit ELSE 0 END),0) AS cash
         FROM journal_lines l JOIN journal_entries j ON j.id=l.entry_id
         JOIN accounts a ON a.id=l.account_id
         WHERE j.date BETWEEN ? AND ? GROUP BY day ORDER BY day`, fromTs, toTs
      );
      return send(res, { from, to, rows });
    }
  }

  /* ---------- expenses ---------- */
  if (r0 === 'expenses') {
    if (method === 'GET') {
      need(user, 'accounting.view');
      const where = ['1=1'];
      const params = [];
      if (query.from) { where.push('e.date >= ?'); params.push(query.from); }
      if (query.to) { where.push('e.date <= ?'); params.push(query.to); }
      const { page, perPage, offset } = paging(query);
      const w = where.join(' AND ');
      const total = db.get(`SELECT COUNT(*) AS c FROM expenses e WHERE ${w}`, ...params).c;
      const items = db.all(
        `SELECT e.*, a.name AS account_name, a.code, u.full_name AS user_name
         FROM expenses e LEFT JOIN accounts a ON a.id=e.account_id LEFT JOIN users u ON u.id=e.user_id
         WHERE ${w} ORDER BY e.date DESC LIMIT ? OFFSET ?`, ...params, perPage, offset
      );
      const sum = db.get(`SELECT COALESCE(SUM(e.amount),0) AS total FROM expenses e WHERE ${w}`, ...params).total;
      return send(res, { ...paged(items, total, page, perPage), total_amount: sum });
    }
    if (method === 'POST') {
      need(user, 'accounting.manage');
      const exp = lib.createExpense({ ...body, user_id: user.id });
      audit(user.id, 'create', 'expense', exp.id, exp.amount);
      return send(res, exp, 201);
    }
    if (method === 'DELETE' && id) {
      need(user, 'accounting.manage');
      const exp = db.get('SELECT * FROM expenses WHERE id=?', id);
      if (!exp) throw new AppError('المصروف غير موجود', 404);
      db.tx(() => {
        lib.deleteJournalFor('expense', id);
        db.run('DELETE FROM expenses WHERE id=?', id);
      });
      audit(user.id, 'delete', 'expense', id);
      return send(res, { ok: true });
    }
  }

  /* ---------- reports ---------- */
  if (r0 === 'reports') {
    need(user, 'reports.view');
    if (r1 === 'sales') {
      const { from, to, fromTs, toTs } = dateRange(query, 30);
      const summary = db.get(
        `SELECT COUNT(*) AS invoices, COALESCE(SUM(subtotal),0) AS subtotal, COALESCE(SUM(discount),0) AS discount,
                COALESCE(SUM(tax),0) AS tax, COALESCE(SUM(total),0) AS total, COALESCE(SUM(paid),0) AS paid
         FROM sales WHERE date BETWEEN ? AND ? AND status NOT IN ('void')`, fromTs, toTs
      );
      const cost = db.get(
        `SELECT COALESCE(SUM(si.cost*si.qty),0) AS cost FROM sale_items si
         JOIN sales s ON s.id=si.sale_id WHERE s.date BETWEEN ? AND ? AND s.status NOT IN ('void')`, fromTs, toTs
      ).cost;
      const returnsRow = db.get(
        `SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS total FROM returns
         WHERE type='sale' AND date BETWEEN ? AND ?`, fromTs, toTs
      );
      const group = query.group === 'month' ? "substr(date,1,7)" : 'substr(date,1,10)';
      const series = db.all(
        `SELECT ${group} AS period, COUNT(*) AS invoices, COALESCE(SUM(total),0) AS total,
                COALESCE(SUM(tax),0) AS tax, COALESCE(SUM(discount),0) AS discount
         FROM sales WHERE date BETWEEN ? AND ? AND status NOT IN ('void')
         GROUP BY period ORDER BY period`, fromTs, toTs
      );
      const byPayment = db.all(
        `SELECT payment_method AS name, COUNT(*) AS count, COALESCE(SUM(total),0) AS total
         FROM sales WHERE date BETWEEN ? AND ? AND status NOT IN ('void') GROUP BY payment_method`, fromTs, toTs
      );
      const byUser = db.all(
        `SELECT u.full_name AS name, COUNT(*) AS count, COALESCE(SUM(s.total),0) AS total
         FROM sales s LEFT JOIN users u ON u.id=s.user_id
         WHERE s.date BETWEEN ? AND ? AND s.status NOT IN ('void') GROUP BY s.user_id ORDER BY total DESC`, fromTs, toTs
      );
      const topProducts = db.all(
        `SELECT si.name, SUM(si.qty) AS qty, COALESCE(SUM(si.total-si.tax),0) AS revenue,
                COALESCE(SUM(si.cost*si.qty),0) AS cost
         FROM sale_items si JOIN sales s ON s.id=si.sale_id
         WHERE s.date BETWEEN ? AND ? AND s.status NOT IN ('void')
         GROUP BY si.product_id ORDER BY revenue DESC LIMIT 10`, fromTs, toTs
      );
      return send(res, {
        from, to, summary: {
          ...summary,
          cost: round2(cost),
          returns_total: round2(returnsRow.total),
          returns_count: returnsRow.count,
          net: round2(Number(summary.total) - Number(returnsRow.total)),
          profit: round2(Number(summary.total) - Number(summary.tax) - Number(cost) - Number(returnsRow.total))
        },
        series, by_payment: byPayment, by_user: byUser, top_products: topProducts
      });
    }
    if (r1 === 'products') {
      const { from, to, fromTs, toTs } = dateRange(query, 30);
      const limit = Math.min(200, Number(query.limit) || 30);
      const sortMap = { qty: 'qty DESC', revenue: 'revenue DESC', profit: 'profit DESC', name: 'name ASC' };
      const items = db.all(
        `SELECT si.product_id, si.name, SUM(si.qty) AS qty, COALESCE(SUM(si.total-si.tax),0) AS revenue,
                COALESCE(SUM(si.cost*si.qty),0) AS cost,
                COALESCE(SUM(si.total-si.tax) - SUM(si.cost*si.qty),0) AS profit
         FROM sale_items si JOIN sales s ON s.id=si.sale_id
         WHERE s.date BETWEEN ? AND ? AND s.status NOT IN ('void')
         GROUP BY si.product_id ORDER BY ${sortMap[query.sort] || 'revenue DESC'} LIMIT ?`, fromTs, toTs, limit
      );
      return send(res, { from, to, items });
    }
    if (r1 === 'profit') {
      const { from, to, fromTs, toTs } = dateRange(query, 30);
      const rows = db.all(
        `SELECT substr(s.date,1,10) AS day,
           COALESCE(SUM(s.total - s.tax),0) AS revenue,
           COALESCE(SUM((SELECT COALESCE(SUM(si.cost*si.qty),0) FROM sale_items si WHERE si.sale_id=s.id)),0) AS cost
         FROM sales s WHERE s.date BETWEEN ? AND ? AND s.status NOT IN ('void')
         GROUP BY day ORDER BY day`, fromTs, toTs
      );
      return send(res, {
        from, to,
        rows: rows.map((r) => ({ ...r, profit: round2(r.revenue - r.cost) })),
        totals: {
          revenue: round2(rows.reduce((s, r) => s + r.revenue, 0)),
          cost: round2(rows.reduce((s, r) => s + r.cost, 0)),
          profit: round2(rows.reduce((s, r) => s + (r.revenue - r.cost), 0))
        }
      });
    }
    if (r1 === 'inventory') {
      const byCategory = db.all(
        `SELECT COALESCE(c.name,'غير مصنف') AS name, COUNT(DISTINCT p.id) AS products,
                COALESCE(SUM(b.qty),0) AS units, COALESCE(SUM(b.qty*b.cost),0) AS cost_value,
                COALESCE(SUM(b.qty*p.price),0) AS retail_value
         FROM batches b JOIN products p ON p.id=b.product_id
         LEFT JOIN categories c ON c.id=p.category_id
         WHERE b.qty > 0 GROUP BY c.id ORDER BY cost_value DESC`
      );
      const items = db.all(
        `SELECT p.id,p.name,p.unit,p.min_stock,p.price,p.cost, ${PRODUCT_STOCK_SQL} AS stock,
          (SELECT MIN(b.expiry_date) FROM batches b WHERE b.product_id=p.id AND b.qty>0) AS nearest_expiry
         FROM products p WHERE p.active=1 ORDER BY (${PRODUCT_STOCK_SQL}) ASC`
      );
      const totals = db.get(
        `SELECT COALESCE(SUM(b.qty*b.cost),0) AS cost, COALESCE(SUM(b.qty*p.price),0) AS retail, COALESCE(SUM(b.qty),0) AS units
         FROM batches b JOIN products p ON p.id=b.product_id WHERE b.qty>0`
      );
      return send(res, { by_category: byCategory, items, totals });
    }
    if (r1 === 'expiry') {
      const days = Math.max(1, Number(query.days) || 90);
      const rows = db.all(
        `SELECT b.id,b.batch_no,b.qty,b.expiry_date,b.cost,p.name,p.id AS product_id,p.unit,
          CAST(julianday(b.expiry_date)-julianday(date('now','localtime')) AS INTEGER) AS days_left,
          ROUND(b.qty*b.cost,2) AS stock_value
         FROM batches b JOIN products p ON p.id=b.product_id
         WHERE b.qty > 0 AND b.expiry_date IS NOT NULL AND b.expiry_date <= date('now','localtime',?)
         ORDER BY b.expiry_date ASC`, `+${days} days`
      );
      return send(res, {
        days, items: rows,
        totals: {
          count: rows.length,
          qty: round2(rows.reduce((s, r) => s + Number(r.qty), 0)),
          value: round2(rows.reduce((s, r) => s + Number(r.stock_value), 0)),
          expired: rows.filter((r) => r.days_left < 0).length
        }
      });
    }
    if (r1 === 'tax') {
      const { from, to, fromTs, toTs } = dateRange(query, 30);
      const output = db.get(
        `SELECT COALESCE(SUM(tax),0) AS tax, COALESCE(SUM(total-tax),0) AS net FROM sales
         WHERE date BETWEEN ? AND ? AND status NOT IN ('void')`, fromTs, toTs
      );
      const input = db.get(
        `SELECT COALESCE(SUM(tax),0) AS tax FROM purchases WHERE date BETWEEN ? AND ?`, fromTs, toTs
      );
      const rows = db.all(
        `SELECT substr(date,1,7) AS period, COALESCE(SUM(tax),0) AS tax, COALESCE(SUM(total-tax),0) AS net
         FROM sales WHERE date BETWEEN ? AND ? AND status NOT IN ('void') GROUP BY period ORDER BY period`, fromTs, toTs
      );
      return send(res, {
        from, to, output_tax: round2(output.tax), taxable_sales: round2(output.net),
        input_tax: round2(input.tax), net_payable: round2(output.tax - input.tax), rows
      });
    }
    if (r1 === 'shifts') {
      const { from, to } = dateRange(query, 30);
      const rows = db.all(
        `SELECT s.*, u.full_name AS user_name,
          (SELECT COUNT(*) FROM sales sa WHERE sa.shift_id=s.id AND sa.status NOT IN ('void')) AS invoices,
          (SELECT COALESCE(SUM(sa.total),0) FROM sales sa WHERE sa.shift_id=s.id AND sa.status NOT IN ('void')) AS sales_total
         FROM shifts s JOIN users u ON u.id=s.user_id
         WHERE s.opened_at BETWEEN ? AND ? ORDER BY s.id DESC`,
        `${from} 00:00:00`, `${to} 23:59:59`
      );
      return send(res, { from, to, rows });
    }
    if (r1 === 'suppliers') {
      return send(res, supplierList(query));
    }
    if (r1 === 'customers') {
      return send(res, customerList(query));
    }
  }

  /* ---------- users & roles ---------- */
  if (r0 === 'users') {
    if (method === 'GET' && !r1) {
      need(user, 'users.manage');
      return send(res, { items: db.all(
        `SELECT u.id,u.username,u.full_name,u.phone,u.email,u.active,u.color,u.last_login,u.created_at,
          u.role_id,r.name AS role_name,u.permissions
         FROM users u LEFT JOIN roles r ON r.id=u.role_id ORDER BY u.id` ) });
    }
    if (method === 'POST') {
      need(user, 'users.manage');
      const username = String(body.username || '').trim();
      if (!username || !body.full_name || !body.password) throw new AppError('اسم المستخدم والاسم وكلمة المرور مطلوبة');
      if (db.get('SELECT id FROM users WHERE username=?', username)) throw new AppError('اسم المستخدم مستخدم بالفعل');
      if (String(body.password).length < 6) throw new AppError('كلمة المرور 6 أحرف على الأقل');
      const customPerms = Array.isArray(body.permissions) ? sec.normalizeCustomPermissions(body.permissions) : null;
      const r = db.run(
        `INSERT INTO users(username,password_hash,full_name,role_id,phone,email,active,color,permissions) VALUES(?,?,?,?,?,?,?,?,?)`,
        username, sec.hashPassword(body.password), body.full_name, body.role_id || null,
        body.phone || '', body.email || '', body.active === 0 ? 0 : 1, body.color || '#0ea5e9',
        customPerms === null ? null : JSON.stringify(customPerms)
      );
      audit(user.id, 'create', 'user', Number(r.lastInsertRowid), username);
      return send(res, { id: Number(r.lastInsertRowid) }, 201);
    }
    if (method === 'PUT' && id) {
      need(user, 'users.manage');
      const target = db.get('SELECT * FROM users WHERE id=?', id);
      if (!target) throw new AppError('المستخدم غير موجود', 404);
      if (id === user.id && body.active === 0) throw new AppError('لا يمكنك إيقاف حسابك الحالي');
      if ((target.username === 'admin') && body.active === 0) throw new AppError('لا يمكن إيقاف حساب مدير النظام الرئيسي');
      let permsSql = target.permissions;
      if (body.permissions === null) permsSql = null;
      else if (Array.isArray(body.permissions)) {
        const cp = sec.normalizeCustomPermissions(body.permissions);
        permsSql = cp === null ? null : JSON.stringify(cp);
      }
      db.run(
        `UPDATE users SET full_name=?,role_id=?,phone=?,email=?,active=?,color=?,permissions=? WHERE id=?`,
        body.full_name || target.full_name, body.role_id || target.role_id, body.phone || '',
        body.email || '', body.active === 0 ? 0 : 1, body.color || target.color, permsSql, id
      );
      if (body.password) {
        if (String(body.password).length < 6) throw new AppError('كلمة المرور 6 أحرف على الأقل');
        db.run('UPDATE users SET password_hash=? WHERE id=?', sec.hashPassword(body.password), id);
      }
      audit(user.id, 'update', 'user', id, target.username);
      return send(res, { ok: true });
    }
    if (method === 'DELETE' && id) {
      need(user, 'users.manage');
      if (id === user.id) throw new AppError('لا يمكنك حذف حسابك الحالي');
      const target = db.get('SELECT * FROM users WHERE id=?', id);
      if (!target) throw new AppError('المستخدم غير موجود', 404);
      if (target.username === 'admin') throw new AppError('لا يمكن حذف حساب مدير النظام الرئيسي');
      db.run('UPDATE users SET active=0 WHERE id=?', id);
      audit(user.id, 'delete', 'user', id, target.username);
      return send(res, { ok: true });
    }
  }

  if (r0 === 'roles') {
    if (method === 'GET') {
      need(user, 'users.manage');
      return send(res, { items: db.all(
        `SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id=r.id) AS users_count FROM roles r ORDER BY r.id` ) });
    }
    if (method === 'POST') {
      need(user, 'users.manage');
      const perms = Array.isArray(body.permissions) ? body.permissions.filter((p) => sec.ALL_PERMISSIONS.includes(p)) : [];
      if (db.get('SELECT id FROM roles WHERE name=?', body.name)) throw new AppError('اسم الدور مستخدم');
      const r = db.run('INSERT INTO roles(name,description,permissions) VALUES(?,?,?)',
        body.name, body.description || '', JSON.stringify(perms));
      return send(res, { id: Number(r.lastInsertRowid) }, 201);
    }
    if (method === 'PUT' && id) {
      need(user, 'users.manage');
      const role = db.get('SELECT * FROM roles WHERE id=?', id);
      if (!role) throw new AppError('الدور غير موجود', 404);
      let perms = role.permissions;
      if (Array.isArray(body.permissions)) {
        perms = JSON.stringify(body.permissions.filter((p) => sec.ALL_PERMISSIONS.includes(p)));
      }
      db.run('UPDATE roles SET name=?,description=?,permissions=? WHERE id=?',
        body.name || role.name, body.description || role.description, perms, id);
      return send(res, { ok: true });
    }
    if (method === 'DELETE' && id) {
      need(user, 'users.manage');
      const role = db.get('SELECT * FROM roles WHERE id=?', id);
      if (!role) throw new AppError('الدور غير موجود', 404);
      if (role.is_system) throw new AppError('لا يمكن حذف دور نظامي');
      if (db.get('SELECT COUNT(*) AS c FROM users WHERE role_id=?', id).c) throw new AppError('الدور مرتبط بمستخدمين');
      db.run('DELETE FROM roles WHERE id=?', id);
      return send(res, { ok: true });
    }
  }

  if (r0 === 'permissions' && method === 'GET') {
    return send(res, { items: sec.ALL_PERMISSIONS });
  }

  /* ---------- settings ---------- */
  if (r0 === 'settings') {
    if (method === 'GET') return send(res, settingsMap());
    if (method === 'PUT') {
      need(user, 'settings.manage');
      const allowed = Object.keys(db.DEFAULT_SETTINGS);
      db.tx(() => {
        for (const [key, value] of Object.entries(body)) {
          if (!allowed.includes(key)) continue;
          db.run(`INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, key, String(value));
        }
      });
      audit(user.id, 'update', 'settings', null, Object.keys(body).join(','));
      return send(res, settingsMap());
    }
  }

  /* ---------- data tools: truncate + trash/restore ---------- */
  if (r0 === 'data-tools') {
    need(user, 'settings.manage');
    if (method === 'GET' && !r1) {
      const PROTECTED = new Set(['users', 'roles', 'settings', 'audit_log']);
      const LABELS = {
        products: 'الأصناف والأدوية', categories: 'التصنيفات', batches: 'دفعات المخزون',
        stock_movements: 'حركات المخزون', suppliers: 'الموردون', customers: 'العملاء',
        purchases: 'فواتير الشراء', purchase_items: 'بنود الشراء', sales: 'فواتير البيع',
        sale_items: 'بنود البيع', returns: 'المرتجعات', return_items: 'بنود المرتجعات',
        shifts: 'الورديات', cash_movements: 'حركات الخزينة', prescriptions: 'الروشتات',
        prescription_items: 'بنود الروشتات', accounts: 'الحسابات', journal_entries: 'القيود',
        journal_lines: 'بنود القيود', expenses: 'المصروفات', audit_log: 'سجل النشاط', backups: 'النسخ',
      };
      const tables = db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .map((t) => {
          let rows = 0;
          try { rows = db.get(`SELECT COUNT(*) AS c FROM "${t.name}"`).c; } catch (_) {}
          return { name: t.name, label: LABELS[t.name] || t.name, rows, protected: PROTECTED.has(t.name) };
        });
      return send(res, { tables });
    }
    if (method === 'POST' && r1 === 'truncate') {
      const known = new Set(db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").map((t) => t.name));
      const PROTECTED = new Set(['users', 'roles', 'settings', 'audit_log']);
      const selected = (Array.isArray(body.tables) ? body.tables.map(String) : []).filter((t) => known.has(t) && !PROTECTED.has(t));
      if (!selected.length) throw new AppError('اختر جدولًا واحدًا على الأقل (الجداول المحمية لا يمكن تفريغها)');
      const children = new Map();
      for (const t of known) {
        let fks = [];
        try { fks = db.all(`PRAGMA foreign_key_list("${t}")`); } catch (_) {}
        for (const fk of fks) {
          if (!children.has(fk.table)) children.set(fk.table, new Set());
          children.get(fk.table).add(t);
        }
      }
      const allSel = new Set(selected);
      let grew = true;
      while (grew) {
        grew = false;
        for (const t of [...allSel]) {
          for (const c of children.get(t) || []) {
            if (!allSel.has(c) && !PROTECTED.has(c)) { allSel.add(c); grew = true; }
          }
        }
      }
      const ordered = [];
      const seen = new Set();
      const visit = (t) => {
        if (seen.has(t)) return;
        seen.add(t);
        for (const c of children.get(t) || []) if (allSel.has(c)) visit(c);
        ordered.push(t);
      };
      [...allSel].forEach(visit);
      const cleared = [];
      db.tx(() => {
        for (const t of ordered) {
          try { db.run(`DELETE FROM "${t}"`); cleared.push(t); } catch (_) {}
        }
      });
      audit(user.id, 'truncate', null, null, { requested: selected, cleared }, ip);
      return send(res, { message: 'تم تفريغ الجداول المحددة', cleared });
    }
  }

  if (r0 === 'trash') {
    need(user, 'settings.manage');
    const ENTITIES = {
      products: { table: 'products', label: 'صنف', col: 'name' },
      suppliers: { table: 'suppliers', label: 'مورد', col: 'name' },
      customers: { table: 'customers', label: 'عميل', col: 'name' },
      users: { table: 'users', label: 'مستخدم', col: 'username' },
    };
    if (method === 'GET' && !r1) {
      const groups = [];
      for (const [key, cfg] of Object.entries(ENTITIES)) {
        let rows = [];
        try { rows = db.all(`SELECT id, ${cfg.col} AS name, created_at FROM "${cfg.table}" WHERE active = 0 ORDER BY id DESC LIMIT 300`); } catch (_) {}
        groups.push({ entity: key, label: cfg.label, rows });
      }
      return send(res, { groups, total: groups.reduce((n, g) => n + g.rows.length, 0) });
    }
    const cfg = ENTITIES[r1];
    if (!cfg) throw new AppError('نوع غير معروف', 404);
    const itemId = Number(r2);
    if (!itemId) throw new AppError('معرّف غير صالح');
    const row = db.get(`SELECT * FROM "${cfg.table}" WHERE id = ?`, itemId);
    if (!row) throw new AppError('العنصر غير موجود', 404);
    if (method === 'POST' && seg[3] === 'restore') {
      db.run(`UPDATE "${cfg.table}" SET active = 1 WHERE id = ?`, itemId);
      audit(user.id, 'restore', cfg.table, itemId, row[cfg.col], ip);
      return send(res, { message: 'تمت الاستعادة' });
    }
    if (method === 'DELETE') {
      try { db.run(`DELETE FROM "${cfg.table}" WHERE id = ?`, itemId); }
      catch (_) { throw new AppError('لا يمكن الحذف النهائي لوجود بيانات مرتبطة', 409); }
      audit(user.id, 'purge', cfg.table, itemId, row[cfg.col], ip);
      return send(res, { message: 'تم الحذف النهائي' });
    }
  }

  /* ---------- backup ---------- */
  if (r0 === 'backups') {
    need(user, 'backup.manage');
    if (method === 'GET' && !r1) {
      const list = backup.listBackups(query.dir);
      return send(res, { ...list, history: db.all('SELECT b.*, u.full_name AS user_name FROM backups b LEFT JOIN users u ON u.id=b.user_id ORDER BY b.id DESC LIMIT 30') });
    }
    if (method === 'GET' && r1 === 'browse') return send(res, backup.browse(query.dir));
    if (method === 'GET' && r1 === 'download') {
      const file = String(query.file || '');
      if (!file) throw new AppError('حدد الملف');
      const full = backup.validateBackupFile(file);
      const fs = require('node:fs');
      const stat = fs.statSync(full);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(full.split(/[\\/]/).pop())}"`,
        'Content-Length': stat.size
      });
      return fs.createReadStream(full).pipe(res);
    }
    if (method === 'POST' && r1 === 'create') {
      const info = backup.createBackup(body.dir, { type: 'manual', userId: user.id });
      audit(user.id, 'backup', 'backup', null, info.path);
      return send(res, info, 201);
    }
    if (method === 'POST' && r1 === 'restore') {
      const result = backup.restoreBackup(body.file, user.id);
      audit(user.id, 'restore', 'backup', null, body.file);
      return send(res, result);
    }
    if (method === 'POST' && r1 === 'upload') {
      if (!body.__raw) throw new AppError('لم يتم إرسال ملف');
      const filename = (body.__filename || `upload-${Date.now()}.db`).replace(/[^\w.\-أ-ي]/g, '_');
      const dir = backup.ensureDir(body.dir ? require('node:path').resolve(body.dir) : backup.DEFAULT_DIR);
      const target = require('node:path').join(dir, filename);
      require('node:fs').writeFileSync(target, body.__raw);
      backup.validateBackupFile(target);
      if (body.restore === '1') {
        const result = backup.restoreBackup(target, user.id);
        return send(res, { ...result, uploaded: target });
      }
      return send(res, { ok: true, file: target }, 201);
    }
    if (method === 'POST' && r1 === 'delete') {
      backup.deleteBackup(body.file);
      return send(res, { ok: true });
    }
    if (method === 'POST' && r1 === 'pick-folder') return send(res, backup.pickFolder());
    if (method === 'POST' && r1 === 'run-auto') {
      const info = backup.createBackup(body.dir || backup.DEFAULT_DIR, { type: 'auto', userId: user.id });
      return send(res, info, 201);
    }
  }

  /* ---------- audit ---------- */
  if (r0 === 'audit' && method === 'GET') {
    need(user, 'audit.view');
    const where = ['1=1'];
    const params = [];
    if (query.search) { where.push('(a.action LIKE ? OR a.entity LIKE ? OR a.details LIKE ? OR u.full_name LIKE ?)'); const s = `%${query.search}%`; params.push(s, s, s, s); }
    if (query.entity) { where.push('a.entity = ?'); params.push(query.entity); }
    const { page, perPage, offset } = paging(query);
    const w = where.join(' AND ');
    const total = db.get(`SELECT COUNT(*) AS c FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE ${w}`, ...params).c;
    const items = db.all(
      `SELECT a.*, u.full_name AS user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id
       WHERE ${w} ORDER BY a.id DESC LIMIT ? OFFSET ?`, ...params, perPage, offset
    );
    return send(res, paged(items, total, page, perPage));
  }

  /* ---------- global search ---------- */
  if (r0 === 'search' && method === 'GET') {
    const term = String(query.q || '').trim();
    if (!term) return send(res, { products: [], customers: [], suppliers: [], invoices: [] });
    const s = `%${term}%`;
    return send(res, {
      products: db.all(`SELECT p.id,p.name,p.barcode,p.price,${PRODUCT_STOCK_SQL} AS stock FROM products p
        WHERE p.active=1 AND (p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?) LIMIT 6`, s, s, s),
      customers: db.all('SELECT id,name,phone FROM customers WHERE active=1 AND (name LIKE ? OR phone LIKE ?) LIMIT 5', s, s),
      suppliers: db.all('SELECT id,name,phone FROM suppliers WHERE active=1 AND name LIKE ? LIMIT 4', s),
      invoices: db.all(`SELECT s.id,s.invoice_no,s.date,s.total,c.name AS customer_name FROM sales s
        LEFT JOIN customers c ON c.id=s.customer_id WHERE s.invoice_no LIKE ? OR c.name LIKE ? ORDER BY s.id DESC LIMIT 5`, s, s)
    });
  }

  throw new AppError('المسار غير موجود', 404);
}

module.exports = { handle, send, AppError };
