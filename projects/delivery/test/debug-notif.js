'use strict';
const base = 'http://localhost:3201';
async function j(path, opts) {
  const r = await fetch(base + path, opts);
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  console.log(path, r.status, JSON.stringify(body).slice(0, 900));
  return { status: r.status, body };
}
const post = (p, b, H) => j(p, { method: 'POST', headers: { 'content-type': 'application/json', ...(H || {}) }, body: JSON.stringify(b || {}) });

(async () => {
  const phone = '0118' + String(Date.now()).slice(-7);
  const reg = await post('/api/store/register', { name: 'عميل إشعارات', phone });
  const CH = { authorization: 'Bearer ' + reg.body.token };
  const prods = await j('/api/store/products');
  const p = (prods.body || []).find(x => Number(x.stock) > 3);
  const o = await post('/api/store/orders', { items: [{ product_id: p.id, qty: 1 }], payment_method_id: 1 }, CH);
  const staff = await post('/api/auth/login', { email: 'admin', password: 'admin123' });
  const H = { authorization: 'Bearer ' + staff.body.token };
  await post('/api/orders/' + o.body.id + '/status', { status: 'confirmed' }, H);
  await j('/api/store/notifications', { headers: CH });
  await post('/api/store/notifications/read-all', {}, CH);
  await j('/api/store/notifications', { headers: CH });
  await j('/api/store/me', { headers: CH });
  console.log('customer id', reg.body.customer.id, 'order', o.body.id);
})().catch(e => { console.error(e); process.exit(1); });
