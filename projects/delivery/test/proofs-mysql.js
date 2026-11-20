'use strict';
/* اختبار إثباتات الدفع: إنشاء طلب بتحويل + اعتماد/رفض + إشعارات + صورة LONGTEXT */
const base = process.env.API_BASE || 'http://localhost:3201';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lK3Q6wAAAABJRU5ErkJggg==';

async function j(path, opts) {
  const r = await fetch(base + path, opts);
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}
const post = (path, body, H) => j(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(H || {}) }, body: JSON.stringify(body || {}) });
function check(cond, label, extra) {
  if (cond) console.log('  ok  ', label);
  else { console.error('  FAIL', label, JSON.stringify(extra || '').slice(0, 600)); process.exitCode = 1; }
}

(async () => {
  const phone = '0116' + String(Date.now()).slice(-7);
  const reg = await post('/api/store/register', { name: 'عميل إثبات دفع', phone });
  check(reg.status === 200 && reg.body.token, 'store register', reg.body);
  const CH = { authorization: 'Bearer ' + reg.body.token };

  const methods = await j('/api/store/payment-methods');
  const pm = (methods.body || []).find(x => Number(x.requires_proof) === 1);
  check(!!pm, 'find proof payment method', methods.body);
  if (!pm) return;

  const prods = await j('/api/store/products');
  const p = (prods.body || []).find(x => Number(x.stock) > 5);
  check(!!p, 'find product');

  const o1 = await post('/api/store/orders', {
    items: [{ product_id: p.id, qty: 1 }], payment_method_id: pm.id,
    proof: { amount: 100, txn_ref: 'TX-' + Date.now(), image: PNG, image_name: 'proof.png', image_mime: 'image/png', note: 'اختبار' },
  }, CH);
  check(o1.status === 200 && o1.body.proof_status === 'pending' && o1.body.proof_id, 'order with proof pending', o1.body);
  const pid1 = o1.body.proof_id;

  const staff = await post('/api/auth/login', { email: 'admin', password: 'admin123' });
  check(staff.status === 200, 'staff login');
  const H = { authorization: 'Bearer ' + staff.body.token };

  const list = await j('/api/payment_proofs?limit=100', { headers: H });
  const row = (list.body.rows || []).find(x => x.id === pid1);
  check(!!row, 'proof appears in list');
  check(row && String(row.image || '').startsWith('data:image/png;base64,'), 'proof image round-trip');

  const stats1 = await j('/api/payment_proofs/stats', { headers: H });
  check(stats1.status === 200 && stats1.body.pending >= 1, 'proof stats pending', stats1.body);

  const ap = await post('/api/payment_proofs/' + pid1 + '/approve', {}, H);
  check(ap.status === 200 && ap.body.status === 'approved', 'approve proof', ap.body);

  const od1 = await j('/api/orders/' + o1.body.id, { headers: H });
  check(od1.status === 200 && od1.body.paid === 'paid' && od1.body.proof_status === 'approved', 'order marked paid', od1.body);
  check((od1.body.proofs || []).length && String(od1.body.proofs[0].image || '').startsWith('data:image/png'), 'order detail returns proof image');

  const n1 = await j('/api/store/notifications', { headers: CH });
  check((n1.body.rows || []).some(n => n.kind === 'proof_approved'), 'customer notified proof approved', n1.body);

  /* رفض إثبات آخر */
  const o2 = await post('/api/store/orders', {
    items: [{ product_id: p.id, qty: 1 }], payment_method_id: pm.id,
    proof: { amount: 50, txn_ref: 'TX-R-' + Date.now(), image: PNG, image_name: 'proof2.png', image_mime: 'image/png' },
  }, CH);
  check(o2.status === 200 && o2.body.proof_status === 'pending', 'second order with proof pending', o2.body);
  const pid2 = o2.body.proof_id;
  const rj = await post('/api/payment_proofs/' + pid2 + '/reject', { reason: 'المبلغ غير مطابق' }, H);
  check(rj.status === 200 && rj.body.status === 'rejected', 'reject proof', rj.body);
  const od2 = await j('/api/orders/' + o2.body.id, { headers: H });
  check(od2.status === 200 && od2.body.proof_status === 'rejected' && od2.body.paid !== 'paid', 'order proof rejected', od2.body);
  const n2 = await j('/api/store/notifications', { headers: CH });
  check((n2.body.rows || []).some(n => n.kind === 'proof_rejected'), 'customer notified proof rejected', n2.body);

  const stats2 = await j('/api/payment_proofs/stats', { headers: H });
  check(stats2.status === 200 && stats2.body.approved >= 1 && stats2.body.rejected >= 1, 'proof stats approved/rejected', stats2.body);

  console.log(process.exitCode ? 'SOME PROOF CHECKS FAILED' : 'ALL PROOF CHECKS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
