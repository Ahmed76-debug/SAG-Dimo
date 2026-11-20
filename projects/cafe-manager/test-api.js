/* اختبار شامل لكل API — تشغيل: node test-api.js
   لازم السيرفر شغال: node server.js
   اختبار الاسترجاع (مدمّر) بيتم لو عملت: RESTORE_TEST=1 node test-api.js */
const BASE = process.env.BASE || 'http://localhost:3000';
const ALLOW_RESTORE = process.env.RESTORE_TEST === '1';
let pass = 0, fail = 0;
const results = [];
let adminToken = null;

async function call(method, path, body, tok = adminToken) {
  const opt = { method, headers: {} };
  if (tok) opt.headers.Authorization = 'Bearer ' + tok;
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const r = await fetch(BASE + '/api' + path, opt);
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}
function check(name, ok, extra = '') {
  if (ok) { pass++; results.push('✅ ' + name); }
  else { fail++; results.push('❌ ' + name + (extra ? ' → ' + extra : '')); }
}
const today = () => new Date().toISOString().slice(0, 10);

(async () => {
  /* 1) LOGIN */
  let r = await call('POST', '/login', { username: 'admin', pass: 'admin123' }, null);
  check('تسجيل الدخول', r.status === 200 && r.data.username === 'admin' && !!r.data.token, JSON.stringify(r.data).slice(0,120));
  adminToken = r.data.token;
  r = await call('POST', '/login', { username: 'admin', pass: 'wrong' }, null);
  check('رفض كلمة سر خاطئة', r.status === 401);

  /* 1b) الحماية بدون توكن */
  r = await call('GET', '/sales', undefined, null);
  check('رفض الطلب بدون توكن (401)', r.status === 401);
  r = await call('GET', '/sales', undefined, 'invalid-token-xyz');
  check('رفض توكن مزوّر (401)', r.status === 401);
  r = await call('GET', '/me');
  check('استرجاع بيانات الجلسة /me', r.status === 200 && r.data.username === 'admin');

  /* 2) LISTAS */
  for (const p of ['/items','/branches','/tables','/users','/accounts','/journal','/shifts','/sales','/purchases','/finance','/suppliers','/recipes'])
    r = await call('GET', p);
  check('جلب كل القوائم', r.status === 200 && Array.isArray(r.data));

  for (const p of ['/dashboard','/reports','/report/pl','/report/inventory','/report/payments'])
    r = await call('GET', p);
  check('كل التقارير (dashboard/reports/pl/inventory/payments)', r.status === 200, JSON.stringify(r.data).slice(0,120));

  /* 3) BRANCHES */
  r = await call('POST', '/branches', { name: 'فرع الاختبار', address: 'الإسكندرية' });
  check('إضافة فرع', r.status === 200);
  r = await call('POST', '/branches', { name: 'فرع الاختبار' });
  check('إضافة فرع مكرر بدون خطأ', r.status === 200);
  const branches = (await call('GET', '/branches')).data;
  const br2 = branches.find(b => b.name === 'فرع الاختبار');
  check('الفرع محفوظ', !!br2);
  r = await call('GET', '/sales?branch=' + (br2 ? br2.id : 2));
  check('فلترة المبيعات بالفرع', r.status === 200 && Array.isArray(r.data));

  /* 4) SUPPLIER + PURCHASE */
  r = await call('POST', '/suppliers', { name: 'مورد الاختبار', phone: '0123456789', address: 'القاهرة' });
  check('إضافة مورد', r.status === 200);
  r = await call('POST', '/purchases', { supplier: 'مورد الاختبار', item: 'بن', qty: 10, unitPrice: 45, total: 450, date: today(), branch_id: 1 });
  check('تسجيل عملية شراء', r.status === 200);
  const journalAfterPurchase = (await call('GET', '/journal')).data.length;

  /* 5) SHIFT */
  r = await call('POST', '/shifts/open', { opening_cash: 500, branch_id: 1 });
  check('فتح شيفت', r.status === 200);
  const shiftId = r.data.id;
  r = await call('GET', '/shifts/open/1');
  check('جلب الشيفت المفتوح', r.status === 200 && r.data && r.data.id === shiftId);

  /* 6) SALE */
  r = await call('POST', '/sales', { customer: 'عميل اختبار', item: 'قهوة', qty: 2, price: 25, total: 50, payment: 'نقدي', user_id: 1, shift_id: shiftId, date: today(), branch_id: 1 });
  check('تسجيل عملية بيع', r.status === 200);
  const saleId = r.data.id;

  r = await call('GET', '/sales');
  check('البيع موجود في السجل', r.data.some(s => s.id === saleId));

  /* 7) TABLES + ORDER FLOW */
  r = await call('GET', '/tables');
  check('جلب الطاولات', r.status === 200 && r.data.length > 0);
  const freeTable = r.data.find(t => t.status === 'free');
  r = await call('POST', '/orders', { table_id: freeTable.id });
  check('فتح طلب على طاولة', r.status === 200);
  const orderId = r.data.id;
  r = await call('POST', `/orders/${orderId}/items`, { item: 'لاتيه', qty: 2 });
  check('إضافة صنف للطلب', r.status === 200);
  r = await call('GET', `/orders/${orderId}`);
  check('قراءة تفاصيل الطلب', r.status === 200 && r.data.items.length === 1 && +r.data.total > 0);
  r = await call('POST', `/orders/${orderId}/close`, { payment: 'نقدي', shift_id: shiftId });
  check('إغلاق الطلب وتحويله لفاتورة', r.status === 200);
  r = await call('GET', '/tables');
  check('الطاولة رجعت free بعد الفاتورة', r.data.find(t => t.id === freeTable.id).status === 'free');

  /* 8) JOURNAL */
  r = await call('POST', '/journal/entry', { desc: 'قيد غير متوازن', date: today(), lines: [{ account: 'الصندوق', debit: 100 }, { account: 'البنك', credit: 50 }] });
  check('رفض القيد غير المتوازن', r.status === 400);
  r = await call('POST', '/journal/entry', { desc: 'قيد متوازن', date: today(), lines: [{ account: 'الصندوق', debit: 100 }, { account: 'البنك', credit: 100 }] });
  check('قبول القيد المتوازن', r.status === 200);
  const jn = (await call('GET', '/journal')).data;
  check('القيود المسجلة في الدفتر', jn.length > journalAfterPurchase);

  /* 9) FINANCE */
  r = await call('POST', '/finance', { type: 'expense', desc: 'مصروف اختبار', amount: 100, date: today(), branch_id: 1 });
  check('تسجيل مصروف', r.status === 200);
  r = await call('POST', '/finance', { type: 'revenue', desc: 'إيراد اختبار', amount: 200, date: today(), branch_id: 1 });
  check('تسجيل إيراد', r.status === 200);

  /* 10) SHIFT REPORT + CLOSE */
  r = await call('GET', '/report/shift/' + shiftId);
  check('تقرير الشيفت', r.status === 200 && r.data.shift && r.data.total > 0);
  r = await call('POST', '/shifts/close', { id: shiftId, closing_cash: 550 });
  check('إغلاق الشيفت', r.status === 200);
  r = await call('GET', '/shifts/open/1');
  check('مفيش شيفت مفتوح بعد الإغلاق', r.data === null);

  /* 11) USERS + صلاحيات */
  const perms = JSON.stringify({ sales: { v: 1, a: 1 }, dashboard: { v: 1 } });
  r = await call('POST', '/users', { name: 'كاشير الاختبار', username: 'cashier_test', pass: '1234', role: 'كاشير', perms, branch_id: 1 });
  check('إضافة مستخدم', r.status === 200);
  const newUserId = r.data.id;
  r = await call('POST', '/login', { username: 'cashier_test', pass: '1234' }, null);
  check('دخول الكاشير', r.status === 200 && r.data.role === 'كاشير');
  const cashToken = r.data.token;

  r = await call('PUT', '/users/' + newUserId, { name: 'كاشير معدّل', username: 'cashier_test', pass: '1234', role: 'كاشير', perms, branch_id: 1 });
  check('تعديل مستخدم', r.status === 200);
  r = await call('DELETE', '/users/' + newUserId);
  check('حذف مستخدم', r.status === 200);

  /* 12) صلاحيات الكاشير على السيرفر */
  r = await call('DELETE', '/users/' + newUserId, undefined, cashToken);
  check('الكاشير ممنوع من حذف المستخدمين (403)', r.status === 403);
  r = await call('POST', '/users', { name: 'x', username: 'x2', pass: '1', role: 'مدير' }, cashToken);
  check('الكاشير ممنوع من إضافة مستخدم (403)', r.status === 403);
  r = await call('GET', '/sales', undefined, cashToken);
  check('الكاشير يقدر يشوف المبيعات', r.status === 200);
  r = await call('GET', '/reports', undefined, cashToken);
  check('الكاشير ممنوع من التقارير بدون صلاحية (403)', r.status === 403);
  r = await call('GET', '/backup', undefined, cashToken);
  check('الكاشير ممنوع من النسخ الاحتياطي (403)', r.status === 403);

  /* 13) عزل الفروع: الكاشير يشوف فرعه بس */
  const allSales = (await call('GET', '/sales')).data;
  const cashSales = (await call('GET', '/sales', undefined, cashToken)).data;
  check('الكاشير يشوف مبيعات فرعه فقط', cashSales.every(s => String(s.branch_id) === '1'));

  /* 14) ITEMS + RECIPES + ACCOUNTS */
  r = await call('POST', '/items', { name: 'صنف اختبار', type: 'menu', cost_price: 5, sell_price: 20, barcode: '1234567890' });
  check('إضافة صنف', r.status === 200);
  const itemId = r.data.id;
  r = await call('PUT', '/items/' + itemId, { name: 'صنف معدّل', type: 'menu', cost_price: 6, sell_price: 22, barcode: '1234567890' });
  check('تعديل صنف', r.status === 200);
  r = await call('DELETE', '/items/' + itemId);
  check('حذف صنف', r.status === 200);
  r = await call('POST', '/accounts', { name: 'حساب اختبار', type: 'أصول' });
  check('إضافة حساب', r.status === 200);
  r = await call('DELETE', '/accounts/' + r.data.id);
  check('حذف حساب', r.status === 200);

  /* 15) النسخ الاحتياطي */
  r = await call('GET', '/backup');
  check('إنشاء نسخة احتياطية', r.status === 200 && r.data.data && r.data.data.sales);
  const backup = r.data;

  if (ALLOW_RESTORE) {
    const before = (await call('GET', '/sales')).data.length;
    r = await call('POST', '/restore', backup);
    const after = (await call('GET', '/sales')).data.length;
    check('استرجاع النسخة الاحتياطية', r.status === 200 && after === before, `before=${before} after=${after}`);
  }

  /* 16) CLEANUP */
  if (br2) { r = await call('DELETE', '/branches/' + br2.id); check('حذف فرع الاختبار', r.status === 200); }

  /* 17) ERROR HANDLING (السيرفر ما يقعش) */
  r = await call('GET', '/shifts/open/999999');
  check('معالج خطأ بدون سقوط السيرفر', r.status === 200);
  r = await call('GET', '/report/shift/999999');
  check('تقرير شيفت غير موجود', r.status === 404);
  r = await call('GET', '/health');
  check('فحص حالة السيرفر /health', r.status === 200 && r.data.ok);

  console.log(results.join('\n'));
  console.log('\n' + '─'.repeat(40));
  console.log(`النتيجة: ✅ ${pass} ناجح  |  ❌ ${fail} فاشل`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH:', e); process.exit(1); });
