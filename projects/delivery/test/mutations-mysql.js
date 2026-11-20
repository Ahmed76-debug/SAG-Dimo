'use strict';
/* اختبار عمليات الكتابة على MySQL: عميل جديد، طلب، تغيير حالة، إشعارات، نسخ/استرجاع */
const base = process.env.API_BASE || 'http://localhost:3201';
const BACKUP_EXT = process.env.BACKUP_EXT || 'json';

async function j(path, opts) {
  const r = await fetch(base + path, opts);
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}
const post = (path, body, H) => j(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(H || {}) },
  body: JSON.stringify(body || {}),
});
const put = (path, body, H) => j(path, {
  method: 'PUT',
  headers: { 'content-type': 'application/json', ...(H || {}) },
  body: JSON.stringify(body || {}),
});
function check(cond, label, extra) {
  if (cond) console.log('  ok  ', label);
  else { console.error('  FAIL', label, JSON.stringify(extra || '').slice(0, 500)); process.exitCode = 1; }
}

(async () => {
  const phone = '0119' + String(Date.now()).slice(-7);
  const reg = await post('/api/store/register', { name: 'عميل اختبار MySQL', phone, address: 'القاهرة' });
  check(reg.status === 200 && reg.body.token, 'store register', reg.body);
  const CH = { authorization: 'Bearer ' + reg.body.token };
  const custId = reg.body.customer.id;

  const products = await j('/api/store/products');
  const p = (products.body || []).find(x => Number(x.stock) > 5);
  check(!!p, 'find product with stock');
  const beforeStock = Number(p.stock);

  const order = await post('/api/store/orders', { items: [{ product_id: p.id, qty: 2 }], payment_method_id: 1 }, CH);
  check(order.status === 200 && order.body.id, 'create store order', order.body);
  const oid = order.body.id;
  check(/^T\d+$/.test(String(order.body.code)), 'order code from nextCode: ' + order.body.code);

  const staffLogin = await post('/api/auth/login', { email: 'admin', password: 'admin123' });
  check(staffLogin.status === 200 && staffLogin.body.token, 'staff login', staffLogin.body);
  const H = { authorization: 'Bearer ' + staffLogin.body.token };

  const c1 = await post('/api/orders/' + oid + '/status', { status: 'confirmed' }, H);
  check(c1.status === 200 && c1.body.status === 'confirmed', 'status confirmed', c1.body);
  const c2 = await post('/api/orders/' + oid + '/status', { status: 'delivered', paid: 'paid' }, H);
  check(c2.status === 200 && c2.body.status === 'delivered', 'status delivered', c2.body);

  const detail = await j('/api/store/orders/' + oid, { headers: CH });
  check(detail.status === 200 && (detail.body.items || []).length === 1, 'order detail with items', detail.body);

  const notifs = await j('/api/store/notifications', { headers: CH });
  check(notifs.status === 200 && (notifs.body.rows || []).length >= 2, 'notifications list: ' + ((notifs.body.rows || []).length), notifs.body);
  check((notifs.body.rows || []).every(n => n.read === 0), 'notifications unread alias', notifs.body.rows);
  const readAll = await post('/api/store/notifications/read-all', {}, CH);
  check(readAll.status === 200 && readAll.body.unread === 0, 'notifications read-all', readAll.body);
  const notifs2 = await j('/api/store/notifications', { headers: CH });
  check(notifs2.status === 200 && notifs2.body.unread === 0, 'notifications unread count 0', notifs2.body);

  const me = await j('/api/store/me', { headers: CH });
  check(me.status === 200 && me.body.id === custId, 'store me');

  const dash = await j('/api/reports/dashboard', { headers: H });
  check(dash.status === 200 && dash.body.kpis, 'dashboard after writes');

  /* --- نسخة احتياطية (تشمل العميل والطلب الأول) --- */
  const b1 = await post('/api/system/backup/create', { note: 'mut-test' }, H);
  check(b1.status === 200 && new RegExp('\\.' + BACKUP_EXT + '$').test(b1.body.name || ''), 'create ' + BACKUP_EXT + ' backup', b1.body);
  const list1 = await j('/api/system/backup/list', { headers: H });
  const bk = (list1.body.backups || []).find(x => x.name === b1.body.name);
  check(!!bk, 'backup appears in list');

  /* --- طلب ثانٍ يُسلَّم مباشرة (يخصم المخزون) --- */
  const order2 = await post('/api/store/orders', { items: [{ product_id: p.id, qty: 2 }], payment_method_id: 1 }, CH);
  check(order2.status === 200 && order2.body.id, 'create second order', order2.body);
  const oid2 = order2.body.id;
  const d2 = await post('/api/orders/' + oid2 + '/status', { status: 'delivered', paid: 'paid' }, H);
  check(d2.status === 200 && d2.body.status === 'delivered', 'second order delivered directly', d2.body);

  const prodMid = await j('/api/products?limit=500', { headers: H });
  const pMid = (prodMid.body.rows || []).find(x => x.id === p.id);
  check(pMid && Number(pMid.stock) === beforeStock - 2, 'stock deducted by 2', { before: beforeStock, after: pMid && pMid.stock });

  /* --- تغييرات بعد النسخة: عميل جديد + اسم الشركة --- */
  const postPhone = '0117' + String(Date.now()).slice(-7);
  const reg2 = await post('/api/store/register', { name: 'عميل بعد النسخة', phone: postPhone });
  check(reg2.status === 200 && reg2.body.customer.id, 'register post-backup customer', reg2.body);
  const postCustId = reg2.body.customer.id;

  const company = await j('/api/company', { headers: H });
  const oldName = company.body.name;
  const upd = await put('/api/company/1', { name: 'اسم مؤقت للاختبار' }, H);
  check(upd.status === 200, 'update company name', upd.body);
  const cNow = await j('/api/company', { headers: H });
  check(cNow.body.name === 'اسم مؤقت للاختبار', 'company name changed');

  const rest = await post('/api/system/backup/restore', { d: bk.dir_id, name: bk.name }, H);
  check(rest.status === 200, 'restore JSON backup', rest.body);

  const cRestored = await j('/api/company', { headers: H });
  check(cRestored.body.name === oldName, 'company name restored', { now: cRestored.body.name, old: oldName });

  const ordersAfter = await j('/api/orders?limit=500', { headers: H });
  check(!(ordersAfter.body.rows || []).some(x => x.id === oid2), 'second order removed by restore');
  check((ordersAfter.body.rows || []).some(x => x.id === oid), 'first order still exists after restore');

  const custAfter = await j('/api/customers?limit=500', { headers: H });
  check(!(custAfter.body.rows || []).some(x => x.id === postCustId), 'post-backup customer removed by restore');
  check((custAfter.body.rows || []).some(x => x.id === custId), 'first customer still exists after restore');

  const prodAfter = await j('/api/products?limit=500', { headers: H });
  const pAfter = (prodAfter.body.rows || []).find(x => x.id === p.id);
  check(pAfter && Number(pAfter.stock) === beforeStock, 'stock restored', { before: beforeStock, after: pAfter && pAfter.stock });

  console.log(process.exitCode ? 'SOME CHECKS FAILED' : 'ALL MUTATION CHECKS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
