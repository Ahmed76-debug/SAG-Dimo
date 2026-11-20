'use strict';
const base = process.env.API_BASE || 'http://localhost:3200';

async function j(path, opts) {
  const r = await fetch(base + path, opts);
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

(async () => {
  const login = await j('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password: 'admin123' }),
  });
  console.log('login', login.status, login.body.user && login.body.user.name);
  if (!login.body.token) throw new Error('login failed: ' + JSON.stringify(login.body));
  const H = { authorization: 'Bearer ' + login.body.token };

  const me = await j('/api/auth/me', { headers: H });
  console.log('me', me.status, me.body.user && me.body.user.role);

  const dash = await j('/api/reports/dashboard', { headers: H });
  console.log('dashboard', dash.status, dash.body.kpis && {
    orders_today: dash.body.kpis.orders_today,
    customers: dash.body.kpis.customers,
    products: dash.body.kpis.products,
    days: (dash.body.days || []).length,
  });

  const products = await j('/api/products?limit=5', { headers: H });
  console.log('products', products.status, products.body.total, (products.body.rows || []).length);

  const orders = await j('/api/orders?limit=5', { headers: H });
  console.log('orders', orders.status, orders.body.total, (orders.body.rows || []).length);

  const customers = await j('/api/customers?limit=5', { headers: H });
  console.log('customers', customers.status, customers.body.total, (customers.body.rows || []).length);

  const company = await j('/api/company', { headers: H });
  console.log('company', company.status, company.body.name);

  const proofs = await j('/api/payment_proofs/stats', { headers: H });
  console.log('proofs stats', proofs.status, proofs.body);

  const report = await j('/api/reports/sales?from=2020-01-01&to=2030-01-01', { headers: H });
  console.log('sales report', report.status, report.body.totals || report.body.error);

  const audit = await j('/api/audit?limit=3', { headers: H });
  console.log('audit', audit.status, (audit.body.rows || []).length);

  const create = await j('/api/system/backup/create', {
    method: 'POST',
    headers: { ...H, 'content-type': 'application/json' },
    body: JSON.stringify({ note: 'smoke' }),
  });
  console.log('backup create', create.status, create.body.name, create.body.size);

  const list = await j('/api/system/backup/list', { headers: H });
  console.log('backup list', list.status, (list.body.backups || []).length, 'db_size', list.body.db_size);

  const store = await j('/api/store/home');
  console.log('store home', store.status, (store.body.products || []).length, (store.body.categories || []).length);

  console.log('OK');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
