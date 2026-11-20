/* ============================================================
   طلباتك — واجهة المتجر (store.js)
   1) أدوات مساعدة  2) الثيم  3) API  4) الحالة (السلة/الجلسة)
   5) الموجّه  6) الشاشات  7) الفاتورة  8) إتمام الطلب
   9) الطلبات والتتبع  10) الحساب  11) التشغيل
   ============================================================ */
'use strict';

/* ================= 1) أدوات مساعدة ================= */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// حماية النصوص من كسر HTML
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// تنسيق المبلغ بالجنيه المصري
function money(v){
  const parts = (Math.round((Number(v) || 0) * 100) / 100).toFixed(2).split('.');
  return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + parts[1] + ' ج.م';
}
const fmtDate = s => { try { return new Date(s).toLocaleString('ar-EG', {dateStyle:'medium', timeStyle:'short'}); } catch(e){ return s || ''; } };

// إشعار سريع
function toast(msg, type = ''){
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  $('#toast-root').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 320); }, 2800);
}

// صورة مع بديل إيموجي عند الفشل
window.tbImgFail = function(img){
  const d = document.createElement('div');
  d.className = img.className + ' img-ph';
  d.textContent = img.dataset.ph || '🛒';
  img.replaceWith(d);
};
function imgHtml(src, ph, cls = ''){
  return src
    ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" data-ph="${ph}" onerror="tbImgFail(this)">`
    : `<div class="${cls} img-ph">${ph}</div>`;
}
function companyLogoHtml(c, cls = 'co-logo'){
  return (c && c.logo) ? imgHtml(c.logo, '🛵', cls) : `<div class="${cls} img-ph">🛵</div>`;
}

const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const rowsOf = d => Array.isArray(d) ? d : (d && (d.rows || d.orders || d.items)) || [];

/* ================= 2) الثيم ================= */
const THEME = {
  get(){ return document.documentElement.getAttribute('data-theme') || 'light'; },
  toggle(){
    const next = this.get() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('tb_theme', next); } catch(e){}
    paintThemeBtn();
    return next;
  }
};
function paintThemeBtn(){ const b = $('#theme-btn'); if (b) b.textContent = THEME.get() === 'dark' ? '☀️' : '🌙'; }

/* ================= 3) API ================= */
const TOKEN_KEY = 'tb_customer_token';
const getToken  = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch(e){ return ''; } };
const setToken  = t => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch(e){} };

async function api(path, { method = 'GET', body, quiet = false } = {}){
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const tk = getToken();
  if (tk) headers['Authorization'] = 'Bearer ' + tk;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch(e){
    if (!quiet) toast('تعذّر الاتصال بالخادم', 'error');
    const err = new Error('تعذّر الاتصال بالخادم'); err.network = true; throw err;
  }
  let data = null;
  try { data = await res.json(); } catch(e){}
  if (!res.ok){
    const msg = (data && data.error) || 'حدث خطأ غير متوقع';
    if (!quiet) toast(msg, 'error');
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return data || {};
}

/* ================= 4) الحالة ================= */
const CART_KEY = 'tb_cart';
const state = {
  home: null, company: null,
  products: {},                 // id → product (كاش للكروت والسلة)
  cart: [],                     // [{product_id, qty}]
  promo: '',                    // كود الخصم المُطبّق
  quote: null,                  // آخر استجابة من /api/store/quote
  zones: [],                    // مناطق التوصيل ورسومها (تُجلب مرة واحدة)
  zone: '',                     // معرّف منطقة التوصيل المختارة
  pays: [],                     // طرق الدفع المتاحة مع بيانات الاستلام
  proofImg: null,               // صورة إثبات الدفع المرفوعة (dataURL مضغوط)
  notifs: [],                   // إشعارات العميل
  notifUnread: 0,               // عدد الإشعارات غير المقروءة
  me: null                      // بيانات العميل المسجّل
};

/** جلب مناطق التوصيل مرة واحدة وتخزينها في الحالة */
async function loadZones(){
  if (state.zones.length) return state.zones;
  try { state.zones = rowsOf(await api('/api/store/zones', { quiet:true })); }
  catch(e){ state.zones = []; }
  return state.zones;
}
const zoneById = id => state.zones.find(z => String(z.id) === String(id)) || null;

function loadCart(){
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    state.cart = Array.isArray(raw) ? raw.filter(l => l && l.product_id != null && l.qty > 0) : [];
  } catch(e){ state.cart = []; }
}
function saveCart(){
  try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch(e){}
  paintCartBadge();
}
const cartCount  = () => state.cart.reduce((s, l) => s + l.qty, 0);
const cartQtyOf  = id => { const l = state.cart.find(x => String(x.product_id) === String(id)); return l ? l.qty : 0; };
const normId     = v => (v != null && !isNaN(Number(v))) ? Number(v) : v;

function setQty(id, qty){
  id = normId(id);
  qty = Math.max(0, Math.min(99, qty));
  const i = state.cart.findIndex(l => String(l.product_id) === String(id));
  if (qty <= 0){ if (i >= 0) state.cart.splice(i, 1); }
  else if (i >= 0) state.cart[i].qty = qty;
  else state.cart.push({ product_id: id, qty });
  saveCart();
  scheduleQuote();
  repaintSteppers();
  renderCartLines();
}

function paintCartBadge(){
  const n = cartCount();
  const t = state.quote ? state.quote.total
          : state.cart.reduce((s, l) => s + ((state.products[l.product_id]?.price || 0) * l.qty), 0);
  const fc = $('#fab-count'), ft = $('#fab-total'), tc = $('#top-cart-count');
  if (fc) fc.textContent = n;
  if (ft) ft.textContent = money(t);
  if (tc){ tc.textContent = n; tc.classList.toggle('hidden', n === 0); }
  updateFab();
}

/* ================= 5) الموجّه ================= */
function parseHash(){
  const h = (location.hash || '#/').replace(/^#\/?/, '');
  const [name, param] = h.split('/');
  return { name: name || 'home', param };
}
const page = inner => `<div class="page">${inner}</div>`;
const skeleton = () => page(`<div class="sk" style="height:110px"></div><div class="sk" style="height:240px;margin-top:14px"></div>`);

async function route(){
  const { name, param } = parseHash();
  closeCart();
  setNavActive(name);
  window.scrollTo({ top: 0 });
  const v = $('#view');
  v.innerHTML = skeleton();
  try {
    if (name === 'cat')           await viewCategory(param);
    else if (name === 'cats')     await viewCategories();
    else if (name === 'orders')   await viewOrders();
    else if (name === 'order')    await viewOrder(param);
    else if (name === 'account')  await viewAccount();
    else if (name === 'checkout') await viewCheckout();
    else                          await viewHome();
  } catch(e){
    v.innerHTML = page(`<div class="empty"><span class="emoji">⚠️</span>${esc(e.message || 'حدث خطأ أثناء تحميل الصفحة')}
      <div style="margin-top:14px"><button class="btn btn-primary" data-act="retry">إعادة المحاولة</button></div></div>`);
  }
  updateFab();
}
function setNavActive(name){
  const key = (name === 'cat' || name === 'home') ? (name === 'cat' ? 'cats' : 'home') : name;
  $$('[data-b]').forEach(a => a.classList.toggle('active', a.dataset.b === key));
}
function updateFab(){
  const { name } = parseHash();
  const show = ['home', 'cats', 'cat'].includes(name) && cartCount() > 0;
  $('#cart-fab')?.classList.toggle('hidden', !show);
}

/* ================= 6) الشاشات ================= */
let homeP = null;
function ensureHome(force){
  if (force || !homeP){
    homeP = api('/api/store/home', { quiet: true })
      .then(h => { state.home = h; state.company = h.company || null; paintBrand(); return h; })
      .catch(e => { homeP = null; throw e; });
  }
  return homeP;
}
function paintBrand(){
  const c = state.company;
  if (!c) return;
  const n = $('#brand-name');
  if (n && c.name){ n.textContent = c.name; }
  const s = $('#splash-name');
  if (s && c.name){ s.textContent = c.name; }
  if (c.logo){
    [['#brand-logo', '.brand-emoji'], ['#splash-logo', '.splash-emoji']].forEach(([imgS, emS]) => {
      const img = $(imgS); if (!img) return;
      img.onerror = () => { img.classList.add('hidden'); $(emS)?.classList.remove('hidden'); };
      img.src = c.logo; img.classList.remove('hidden'); $(emS)?.classList.add('hidden');
    });
  }
}

/* ---------- أقسام / كروت ---------- */
// كرت قسم بتصميم «اختيار طاولة المقهى» — يُستخدم في الرئيسية وكل الأقسام
function catCard(c){
  const count = c.products_count ?? c.count ?? 0;
  return `<a class="cat-card card pad-0" href="#/cat/${c.id}">
    <div class="cat-img">${imgHtml(c.image, '🛒')}</div>
    <div class="cat-body">
      <h3>${esc(c.name)}</h3>
      <span class="badge badge-muted">${count} منتج</span>
    </div></a>`;
}
const catGrid = list => `<div class="cat-grid">${list.map(catCard).join('')}</div>`;

async function viewHome(){
  const v = $('#view');
  const h = await ensureHome();
  const c = h.company || {};
  const cats = Array.isArray(h.categories) ? h.categories : [];
  const ads = Array.isArray(h.ads) ? h.ads : [];
  const stripAds = ads.filter(a => a.position === 'strip').length ? ads.filter(a => a.position === 'strip') : ads;
  let banners = Array.isArray(h.banners) ? h.banners : [];
  // إن لم توجد بنرات، نعرض العروض النشطة كبانرات تفاعلية
  let promos = [];
  if (!banners.length){
    try { promos = rowsOf(await api('/api/store/promotions')); } catch(e){}
  }
  v.innerHTML = page(`
    <!-- بطاقة الشركة -->
    <section class="card hero-card">
      ${companyLogoHtml(c, 'hero-logo')}
      <div class="grow">
        <h1>${esc(c.name || 'طلباتك')}</h1>
        <p class="muted small">${esc(c.about || 'خدمة توصيل سريعة وموثوقة لباب بيتك')}</p>
        <div class="chips">
          <span class="chip">🛵 التوصيل: <b>${Number(c.delivery_fee) > 0 ? money(c.delivery_fee) : 'مجاني'}</b></span>
          ${c.working_hours ? `<span class="chip">🕐 ${esc(c.working_hours)}</span>` : ''}
          ${c.phone ? `<span class="chip">📞 <span class="mono">${esc(c.phone)}</span></span>` : ''}
        </div>
      </div>
    </section>

    ${stripAds.length ? `<h2 class="sec-title">📢 عروض وخصومات</h2>
    <div class="strip scroll-x">${stripAds.map(adCard).join('')}</div>` : ''}

    ${banners.length ? `<h2 class="sec-title">🎉 مميز اليوم</h2>
    <div class="banners">${banners.map(adCard).join('')}</div>` : ''}

    ${promos.length ? `<h2 class="sec-title">🏷️ العروض النشطة</h2>
    <div class="promo-banners">${promos.map(promoBanner).join('')}</div>` : ''}

    <h2 class="sec-title">🏪 الأقسام <a class="btn btn-sm btn-ghost" href="#/cats">عرض الكل ←</a></h2>
    ${cats.length ? catGrid(cats) : `<div class="empty"><span class="emoji">🗂</span>لا توجد أقسام متاحة حاليًا</div>`}
  `);
}

// كرت إعلان (شريط عارض أو بنر)
function adCard(a){
  const link = (a.link || '').trim();
  const inner = `${imgHtml(a.image, '🏷', 'ad-img')}
    <div class="ad-body">${a.title ? `<b>${esc(a.title)}</b>` : ''}</div>`;
  const cls = 'ad-card card pad-0';
  if (!link) return `<div class="${cls}">${inner}</div>`;
  const ext = /^https?:/i.test(link);
  return `<a class="${cls}" href="${esc(link)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>`;
}
// بانر عرض (كود خصم قابل للتطبيق مباشرة)
function promoBanner(p){
  const val = p.kind === 'percent' ? `خصم ${Number(p.value)}%` : `خصم ${money(p.value)}`;
  return `<div class="promo-banner card">
    <div class="flex between">
      <b>${esc(p.name || 'عرض خاص')}</b>
      <span class="badge badge-primary mono">${esc(p.code || '')}</span>
    </div>
    <p class="muted small">${val}${p.min_order ? ` · للطلبات فوق ${money(p.min_order)}` : ''}${p.end_at ? ` · ينتهي ${fmtDate(p.end_at)}` : ''}</p>
    <button class="btn btn-soft btn-sm" data-act="use-promo" data-code="${esc(p.code || '')}">استخدم الكود</button>
  </div>`;
}

async function viewCategories(){
  let list = [];
  try { list = rowsOf(await api('/api/store/categories')); } catch(e){ if (state.home) list = state.home.categories || []; }
  if (!list.length && state.home) list = state.home.categories || [];
  $('#view').innerHTML = page(`
    <h2 class="sec-title">🗂 كل الأقسام</h2>
    ${list.length ? catGrid(list) : `<div class="empty"><span class="emoji">🗂</span>لا توجد أقسام متاحة حاليًا</div>`}
  `);
}

async function viewCategory(id){
  const v = $('#view');
  let prods = [], cat = null;
  try { prods = rowsOf(await api('/api/store/products?category_id=' + encodeURIComponent(id))); } catch(e){}
  try { const cs = rowsOf(await api('/api/store/categories')); cat = cs.find(x => String(x.id) === String(id)); } catch(e){}
  if (!cat && state.home) cat = (state.home.categories || []).find(x => String(x.id) === String(id));
  prods.forEach(p => { state.products[p.id] = p; });
  v.innerHTML = page(`
    ${cat ? `<section class="card cat-hero pad-0">
      <div class="cat-hero-img">${imgHtml(cat.image, '🛒')}</div>
      <div class="cat-hero-body">
        <h1>${esc(cat.name)}</h1>
        ${cat.description ? `<p class="muted small">${esc(cat.description)}</p>` : ''}
        <span class="badge badge-primary">${prods.length} منتج</span>
      </div>
    </section>` : ''}
    <h2 class="sec-title">🛍 المنتجات</h2>
    ${prods.length
      ? `<div class="prod-grid">${prods.map(productCard).join('')}</div>`
      : `<div class="empty"><span class="emoji">🍽</span>لا توجد منتجات في هذا القسم بعد
         <div style="margin-top:14px"><a class="btn btn-primary" href="#/cats">تصفح بقية الأقسام</a></div></div>`}
  `);
}

function productCard(p){
  return `<div class="prod-card card pad-0">
    <div class="prod-img">${imgHtml(p.image, '🍽')}</div>
    <div class="prod-body">
      <h3 class="clamp2">${esc(p.name)}</h3>
      ${p.unit ? `<span class="unit muted small">${esc(p.unit)}</span>` : ''}
      <div class="flex between">
        <b class="price">${money(p.price)}</b>
        ${stepperHtml(p.id)}
      </div>
    </div></div>`;
}
// عدّاد الكمية (زر إضافة أو +/-)
function stepperHtml(id){
  const q = cartQtyOf(id);
  const inner = !q
    ? `<button class="btn btn-primary btn-sm add-btn" data-act="qty" data-id="${id}" data-d="1">＋ إضافة</button>`
    : `<div class="stepper"><button class="st-btn" data-act="qty" data-id="${id}" data-d="-1" aria-label="إنقاص">−</button>
       <span class="st-q">${q}</span>
       <button class="st-btn" data-act="qty" data-id="${id}" data-d="1" aria-label="زيادة">＋</button></div>`;
  return `<span class="step-wrap" data-step="${id}">${inner}</span>`;
}
function repaintSteppers(){ $$('[data-step]').forEach(w => { w.outerHTML = stepperHtml(w.dataset.step); }); }

/* ================= 7) الفاتورة (السلة) ================= */
function openCart(){
  $('#cart-drawer').classList.add('open');
  $('#cart-backdrop').classList.add('open');
  document.body.classList.add('no-scroll');
  renderCartLines();
  if (!state.quote && state.cart.length) scheduleQuote();
  paintTotals();
}
function closeCart(){
  $('#cart-drawer')?.classList.remove('open');
  $('#cart-backdrop')?.classList.remove('open');
  document.body.classList.remove('no-scroll');
}

/* ================= 4.ب) الإشعارات ================= */
/** يجلب الإشعارات ويرسم الزر + الدرج — يُستدعى عند كل تحميل وعند فتح صفحة طلباتي */
async function loadNotifications(force){
  if (!getToken()){ state.notifs = []; state.notifUnread = 0; paintNotifBadge(); return; }
  try {
    const d = await api('/api/store/notifications', { quiet:true });
    state.notifs = d.rows || [];
    state.notifUnread = Number(d.unread) || 0;
    paintNotifBadge();
    if ($('#notif-drawer')?.classList.contains('open')) renderNotifs();
  } catch(e){ /* تجاهل — الإشعارات ليست حرجة */ }
}
/** يحدّث زر الجرس والعداد */
function paintNotifBadge(){
  const btn = $('#notif-btn'), cnt = $('#notif-count');
  if (!btn) return;
  btn.classList.toggle('hidden', !getToken());
  if (cnt){
    const n = state.notifUnread || 0;
    cnt.textContent = n > 99 ? '99+' : n;
    cnt.classList.toggle('hidden', n === 0);
  }
}
const NOTIF_WHEN = s => { if (!s) return ''; try { return fmtDate(s); } catch(e){ return ''; } };
function notifLine(n){
  return `<div class="notif-line ${n.read ? '' : 'unread'}" data-act="notif-open-item" data-id="${n.id}" data-oid="${n.order_id || ''}">
    <div class="notif-ic">${esc(n.icon || '🔔')}</div>
    <div class="grow">
      <div class="notif-title">${esc(n.title || '')}</div>
      <div class="notif-body clamp2">${esc(n.body || '')}</div>
      <div class="muted small">${NOTIF_WHEN(n.created_at)}${n._order_code ? ' · طلب ' + esc(n._order_code) : ''}</div>
    </div>
    ${n.read ? '' : '<span class="notif-dot" aria-label="غير مقروء"></span>'}
  </div>`;
}
function renderNotifs(){
  const box = $('#notif-lines');
  if (!box) return;
  const rows = state.notifs || [];
  if (!rows.length){
    box.innerHTML = `<div class="empty-cart">
      <div class="ec-illu">🔔</div>
      <b>لا إشعارات بعد</b>
      <p class="muted small">سنخبرك هنا تلقائيًا عند تأكيد طلبك، أو اعتماد دفعتك، أو خروج الطلب للتوصيل.</p>
    </div>`;
    return;
  }
  box.innerHTML = rows.map(notifLine).join('');
}
function openNotifs(){
  $('#notif-drawer').classList.add('open');
  $('#notif-backdrop').classList.remove('hidden');
  document.body.classList.add('no-scroll');
  renderNotifs();
  loadNotifications();
}
function closeNotifs(){
  $('#notif-drawer')?.classList.remove('open');
  $('#notif-backdrop')?.classList.add('hidden');
  document.body.classList.remove('no-scroll');
}
/** تعليم إشعار واحد كمقروء ثم فتح الطلب المرتبط به إن وُجد */
async function openNotifItem(id, oid){
  const n = (state.notifs || []).find(x => String(x.id) === String(id));
  if (n && !n.read){
    try { const d = await api('/api/store/notifications/' + encodeURIComponent(id) + '/read', { method:'POST' });
      n.read = 1; state.notifUnread = Number(d.unread) || 0; paintNotifBadge(); renderNotifs(); } catch(e){}
  }
  if (oid){ closeNotifs(); location.hash = '#/order/' + oid; }
}
async function markAllNotifsRead(){
  if (!state.notifUnread){ toast('لا توجد إشعارات غير مقروءة', ''); return; }
  try {
    await api('/api/store/notifications/read-all', { method:'POST' });
    (state.notifs || []).forEach(n => n.read = 1);
    state.notifUnread = 0; paintNotifBadge(); renderNotifs();
    toast('✅ تم تعليم كل الإشعارات كمقروءة', 'success');
  } catch(e){ toast(e.message || 'تعذّر التحديث', 'error'); }
}

function renderCartLines(){
  const box = $('#cart-lines');
  if (!box) return;
  if (!state.cart.length){
    box.innerHTML = `<div class="empty-cart">
      <div class="ec-illu">🛒</div>
      <b>سلتك فارغة</b>
      <p class="muted small">ابدأ بتصفح الأقسام وأضف منتجاتك، وسنحسب لك الفاتورة فورًا.</p>
      <a class="btn btn-primary" href="#/cats" data-act="cart-close">تصفّح الأقسام</a>
    </div>`;
    return;
  }
  box.innerHTML = state.cart.map(l => {
    const p = state.products[l.product_id] || { name: 'منتج', price: 0 };
    return `<div class="cart-line">
      ${imgHtml(p.image, '🍽', 'line-img')}
      <div class="grow">
        <div class="lname clamp2">${esc(p.name)}</div>
        <div class="muted small">${money(p.price)}${p.unit ? ' / ' + esc(p.unit) : ''}</div>
        <div class="flex between" style="margin-top:6px">
          ${stepperHtml(l.product_id)}
          <b class="price">${money((Number(p.price) || 0) * l.qty)}</b>
        </div>
      </div>
      <button class="btn btn-ghost btn-icon" data-act="del" data-id="${l.product_id}" title="حذف" aria-label="حذف">🗑</button>
    </div>`;
  }).join('');
}

const itemsPayload = () => state.cart.map(l => ({ product_id: l.product_id, qty: l.qty }));

// حساب الإجماليات من السيرفر (مع تمهيد لمنع الإزعاج)
const scheduleQuote = debounce(() => runQuote(), 350);
async function runQuote(){
  if (!state.cart.length){ state.quote = null; paintTotals(); renderCartLines(); paintCartBadge(); return true; }
  try {
    const q = await api('/api/store/quote', {
      method: 'POST',
      body: { items: itemsPayload(), promo_code: state.promo || undefined, zone_id: state.zone ? Number(state.zone) : undefined },
      quiet: true
    });
    state.quote = q;
    // تهيئة كاش المنتجات من سطور الفاتورة (عند إعادة تحميل الصفحة)
    (q.lines || []).forEach(l => {
      const id = l.product_id ?? l.id;
      if (id && !state.products[id]) state.products[id] = { id, name: l.name || 'منتج', price: l.price, image: l.image, unit: l.unit };
    });
    paintTotals(); renderCartLines(); paintCartBadge();
    return true;
  } catch(e){
    if (state.promo){                       // كود خصم غير صالح → نزيله ونعيد الحساب
      state.promo = '';
      toast(e.message || 'كود الخصم غير صالح', 'error');
      return runQuote();
    }
    toast(e.message || 'تعذّر حساب الإجماليات', 'error');
    return false;
  }
}

// الإجماليات محليًا كاحتياط قبل وصول رد السيرفر
function getTotals(){
  const q = state.quote;
  if (q) return { subtotal:q.subtotal||0, delivery_fee:q.delivery_fee||0, discount:q.discount||0, tax:q.tax||0, total:q.total||0, promo:q.promo };
  let sub = 0;
  state.cart.forEach(l => { const p = state.products[l.product_id]; if (p) sub += (Number(p.price)||0) * l.qty; });
  const c = state.company || {};
  const fee = Number(c.delivery_fee) || 0;
  const tax = c.tax_enabled ? (Number(c.tax_percent) || 0) * sub / 100 : 0;
  return { subtotal:sub, delivery_fee:fee, discount:0, tax, total:Math.max(0, sub + fee + tax), promo:null };
}

function totalsHtml(t){
  const zn = state.quote && state.quote.zone;
  return `
  <div class="trow"><span>الإجمالي الفرعي</span><b>${money(t.subtotal)}</b></div>
  <div class="trow"><span>رسوم التوصيل${zn ? ` <span class="muted small">· ${esc(zn.name)}${zn.eta ? ' (⏱ ' + esc(zn.eta) + ')' : ''}</span>` : ''}</span><b>${Number(t.delivery_fee) > 0 ? money(t.delivery_fee) : '<span class="text-success">مجاني</span>'}</b></div>
  ${Number(t.discount) > 0 ? `<div class="trow"><span>الخصم${t.promo && t.promo.code ? ' (' + esc(t.promo.code) + ')' : ''}</span><b class="text-success">− ${money(t.discount)}</b></div>` : ''}
  ${Number(t.tax) > 0 ? `<div class="trow"><span>الضريبة</span><b>${money(t.tax)}</b></div>` : ''}
  <div class="trow grand"><span>الإجمالي</span><b class="price">${money(t.total)}</b></div>`;
}

// رسم الإجماليات في الدرج + ملخص صفحة إتمام الطلب
function paintTotals(){
  const t = getTotals();
  const box = $('#cart-totals'); if (box) box.innerHTML = totalsHtml(t);
  const sum = $('#checkout-summary'); if (sum) sum.innerHTML = totalsHtml(t);
  const ps = $('#cart-promo-status');
  if (ps) ps.innerHTML = (state.quote && state.quote.promo)
    ? `<span class="badge badge-success">✅ تم تطبيق كود ${esc(state.quote.promo.code || state.promo)} — خصم ${money(state.quote.discount || 0)}</span>`
    : (state.promo ? `<span class="badge badge-muted">كود ${esc(state.promo)} بانتظار التحقق…</span>` : '');
  const pi = $('#promo-input');
  if (pi && document.activeElement !== pi) pi.value = state.promo;
}

async function applyPromo(){
  const code = ($('#promo-input')?.value || '').trim().toUpperCase();
  if (!code){ toast('اكتب كود الخصم أولًا', 'error'); return; }
  state.promo = code;
  const ok = await runQuote();
  if (ok && state.quote && Number(state.quote.discount) > 0) toast('تم تطبيق كود الخصم بنجاح 🎉', 'success');
  // عند رفض الكود يُعرض خطأ السيرفر تلقائيًا داخل runQuote (لا مزدوجة توست)
}

/* ================= 8) إتمام الطلب ================= */
const validPhone = p => /^01[0125]\d{8}$/.test(String(p || '').replace(/[\s-]/g, ''));

async function viewCheckout(){
  const v = $('#view');
  if (!state.cart.length){
    v.innerHTML = page(`<div class="empty"><span class="emoji">🛒</span>سلتك فارغة — أضف منتجات أولًا.
      <div style="margin-top:14px"><a class="btn btn-primary" href="#/cats">تصفّح الأقسام</a></div></div>`);
    return;
  }
  // بيانات العميل (اختياري — إن فشل الجلب نكمل بالنموذج)
  let me = null;
  if (getToken()){
    try { const d = await api('/api/store/me', { quiet:true }); me = d.customer || d; state.me = me; }
    catch(e){ if (e.status === 401){ setToken(''); state.me = null; } }
  }
  let pays = [];
  try { pays = rowsOf(await api('/api/store/payment-methods')); } catch(e){}
  state.pays = pays;
  /* مناطق التوصيل: نعرض الرسوم لكل منطقة ليختار العميل */
  const zones = await loadZones();
  if (!state.zone && me && me.zone_id) state.zone = String(me.zone_id);
  const zoneOpts = zones.map(z => `<option value="${z.id}"${String(state.zone) === String(z.id) ? ' selected' : ''}>${esc(z.name)} — ${money(z.fee)}${z.eta ? ' (⏱ ' + esc(z.eta) + ')' : ''}</option>`).join('');

  v.innerHTML = page(`
    <div class="flex between" style="margin-bottom:14px">
      <h2 class="sec-title" style="margin:0">🧾 إتمام الطلب</h2>
      <a class="btn btn-sm btn-ghost" href="#/">→ رجوع للرئيسية</a>
    </div>
    <div class="checkout-grid">
      <div class="col">
        <section class="card">
          <h3 class="card-title">📍 بيانات التوصيل</h3>
          ${me ? `<div class="me-info">
              <div class="flex"><span class="avatar">${esc((me.name || '؟').trim().charAt(0))}</span>
              <div><b>${esc(me.name || '')}</b><div class="muted small mono" dir="ltr">${esc(me.phone || '')}</div></div></div>
              <p class="small muted">بياناتك محفوظة لدى «طلباتك» — يمكنك تعديل الهاتف أو العنوان لهذا الطلب فقط.</p>
            </div>`
            : `<p class="small muted">👋 مسجل أول طلب؟ سنطلب منك البيانات مرة واحدة فقط، ونحفظها لطلباتك القادمة.</p>`}
          <div class="stack" style="margin-top:10px">
            <div class="field"><label>الاسم بالكامل</label>
              <input class="input" id="co-name" value="${esc(me?.name || '')}" ${me ? 'disabled' : ''} placeholder="مثال: أحمد محمود"></div>
            <div class="field"><label>رقم الهاتف <span class="req">*</span></label>
              <input class="input" id="co-phone" dir="ltr" inputmode="tel" value="${esc(me?.phone || '')}" placeholder="01xxxxxxxxx"></div>
            <div class="field"><label>عنوان التوصيل <span class="req">*</span></label>
              <textarea class="input" id="co-address" placeholder="المحافظة، المنطقة، الشارع، علامة مميزة">${esc(me?.address || '')}</textarea></div>
            ${zones.length ? `<div class="field"><label>منطقة التوصيل <span class="req">*</span></label>
              <select class="input" id="co-zone" data-act="zone">
                <option value="">— اختر المنطقة لحساب رسوم التوصيل —</option>
                ${zoneOpts}
              </select>
              <div class="small muted" style="margin-top:6px">🗺️ تختلف رسوم التوصيل حسب بُعد المنطقة عن المطبخ.</div></div>`
              : `<div class="small muted">رسوم التوصيل تُحسب من إعدادات المتجر.</div>`}
          </div>
        </section>

        <section class="card" style="margin-top:14px">
          <h3 class="card-title">💳 طريقة الدفع</h3>
          <p class="small muted">اختر الطريقة الأنسب لك — لو الطريقة تحتاج تحويلًا سنعرض لك بيانات الاستلام خطوة بخطوة.</p>
          <div class="pay-grid">
            ${pays.length ? pays.map((p, i) => payCard(p, i)).join('')
              : `<div class="empty" style="padding:18px"><span class="emoji">💳</span>لا توجد طرق دفع متاحة الآن</div>`}
          </div>
          <div id="pay-details" class="pay-details"></div>
          <div class="field" style="margin-top:12px"><label>ملاحظة للمندوب (اختياري)</label>
            <textarea class="input" id="co-note" placeholder="مثال: اتصل قبل الوصول، الدور الثالث…"></textarea></div>
        </section>
      </div>

      <div class="col">
        <section class="card">
          <h3 class="card-title">🧮 ملخص الفاتورة</h3>
          <div class="mini-lines">
            ${state.cart.map(l => {
              const p = state.products[l.product_id] || { name:'منتج', price:0 };
              return `<div class="trow"><span class="clamp2">${esc(p.name)} <span class="muted">× ${l.qty}</span></span><b>${money((Number(p.price)||0)*l.qty)}</b></div>`;
            }).join('')}
          </div>
          <div class="sep"></div>
          <div id="checkout-summary" class="totals">${totalsHtml(getTotals())}</div>
          <button class="btn btn-primary btn-block" id="co-submit" data-act="place-order" style="margin-top:12px">✓ تأكيد الطلب</button>
          <p class="small muted" style="text-align:center;margin-top:8px">بالضغط على تأكيد، أنت توافق على شروط الاستخدام.</p>
        </section>
      </div>
    </div>
  `);
  paintPayDetails();
}
const PAYK = { cash:{ l:'الدفع كاش للمندوب', e:'💵' }, card:{ l:'بطاقة بنكية / بوابة دفع', e:'💳' }, online:{ l:'تحويل بنكي', e:'🏦' }, wallet:{ l:'محفظة إلكترونية', e:'👛' } };
function payCard(p, i){
  const k = PAYK[p.kind] || { l: p.name || '', e:'🧾' };
  const needs = Number(p.requires_proof) === 1 && p.kind !== 'cash';
  return `<label class="pay-card" data-pay="${p.id}">
    <input type="radio" name="pay" value="${p.id}"${i === 0 ? ' checked' : ''}
      data-act="pay-pick" data-id="${p.id}">
    <span class="pay-ic">${k.e}</span>
    <div class="grow"><b>${esc(p.name || k.l)}</b>
      <div class="muted small">${k.l}${needs ? ' · يحتاج إثبات تحويل' : ' · بدون تحويل'}</div></div>
    <span class="check">✓</span></label>`;
}
/** الطريقة المختارة حاليًا من قائمة الراديو */
function selectedPay(){
  const el = $('input[name="pay"]:checked');
  if (!el) return null;
  return (state.pays || []).find(p => String(p.id) === String(el.value)) || null;
}
/** هل هذه الطريقة تتطلب إثبات تحويل؟ */
const needsProof = p => !!p && p.kind !== 'cash' && Number(p.requires_proof) === 1;

/** رسم بطاقة التعليمات + نموذج رفع إثبات الدفع للطريقة المختارة */
function paintPayDetails(){
  const box = $('#pay-details');
  if (!box) return;
  const p = selectedPay();
  /* تمييز البطاقة المختارة */
  document.querySelectorAll('.pay-card').forEach(c => c.classList.toggle('sel', String(c.dataset.pay) === String(p && p.id)));
  if (!p){ box.innerHTML = ''; return; }
  if (!needsProof(p)){
    box.innerHTML = `<div class="pay-note ok"><span class="pay-note-ic">💵</span>
      <div><b>${esc(p.name)}</b><p class="small">${esc(p.pay_instructions || 'لا تحتاج تحويل — ادفع عند استلام الطلب. لا حاجة لرفع أي إثبات.')}</p></div></div>`;
    return;
  }
  const total = getTotals().total;
  const rows = [];
  if (p.pay_number) rows.push(['رقم ' + (p.kind === 'card' ? 'البطاقة' : 'التحويل'), p.pay_number, true]);
  if (p.pay_holder) rows.push(['اسم صاحب الحساب', p.pay_holder, false]);
  if (p.pay_bank)   rows.push(['البنك / المزوّد', p.pay_bank, false]);
  box.innerHTML = `
    <div class="pay-note">
      <span class="pay-note-ic">📤</span>
      <div class="grow">
        <b>خطوات إتمام الدفع عبر «${esc(p.name)}»</b>
        <ol class="pay-steps">
          <li>حوّل مبلغ <b class="price">${money(total)}</b> إلى البيانات التالية${p.pay_link ? ' أو من خلال رابط الدفع' : ''}.</li>
          <li>احتفظ بصورة إشعار التحويل (Screenshot) ورقم العملية.</li>
          <li>ارفع الإثبات بالأسفل وأكمل الطلب — سنراجعه ونعتمده سريعًا.</li>
        </ol>
      </div>
    </div>
    ${rows.length ? `<div class="pay-info">${rows.map(([l, v, mono]) =>
      `<div class="pay-info-row"><span class="muted">${esc(l)}</span>
        <b class="${mono ? 'mono ltr' : ''}">${esc(v)}</b>
        <button type="button" class="btn btn-sm btn-ghost" data-act="copy" data-copy="${esc(v)}">📋 نسخ</button></div>`).join('')}</div>` : ''}
    ${p.pay_link ? `<a class="btn btn-soft btn-block" href="${esc(p.pay_link)}" target="_blank" rel="noopener">🔗 فتح رابط الدفع</a>` : ''}
    ${p.pay_instructions ? `<p class="small muted" style="margin-top:8px">💡 ${esc(p.pay_instructions)}</p>` : ''}
    <div class="proof-box" id="proof-box">
      <h4 class="proof-title">🧾 إثبات التحويل <span class="req">*</span></h4>
      <p class="small muted">مطلوب لتأكيد أنك حوّلت فعلاً — بدون إثبات لا يمكن إتمام الطلب.</p>
      <div class="field"><label>صورة إشعار التحويل <span class="req">*</span></label>
        <div class="proof-up" id="proof-up">
          <input type="file" id="proof-file" accept="image/*" data-act="proof-file">
          <div class="proof-up-ph" id="proof-ph"><span class="proof-up-ic">🖼️</span><span>اضغط لاختيار صورة الإشعار</span><span class="small muted">JPG · PNG · WEBP</span></div>
          <img id="proof-preview" class="proof-preview" alt="معاينة الإشعار" hidden>
        </div>
      </div>
      <div class="proof-grid">
        <div class="field"><label>المبلغ المحوَّل <span class="req">*</span></label>
          <input class="input" id="proof-amount" inputmode="decimal" value="${total}" placeholder="0.00"></div>
        <div class="field"><label>رقم العملية / المرجع <span class="req">*</span></label>
          <input class="input" id="proof-ref" dir="ltr" placeholder="مثال: 78341255"></div>
        <div class="field"><label>تاريخ التحويل</label>
          <input class="input" id="proof-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      </div>
      <div class="field"><label>ملاحظات (اختياري)</label>
        <input class="input" id="proof-note" placeholder="أي تفاصيل تساعدنا في المراجعة"></div>
    </div>`;
}

/** ضغط صورة الإشعار وتحويلها لـ dataURL — يقلل الحجم قبل الرفع */
function readProofImage(file){
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('لم تختر صورة'));
    if (!/^image\//.test(file.type)) return reject(new Error('الملف المختار ليس صورة'));
    if (file.size > 8 * 1024 * 1024) return reject(new Error('حجم الصورة أكبر من ٨ ميجابايت — اختر صورة أصغر'));
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1280;
        const sc = Math.min(1, MAX / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve({ data: cv.toDataURL('image/jpeg', 0.8), name: file.name, mime: 'image/jpeg' });
      };
      img.onerror = () => resolve({ data: rd.result, name: file.name, mime: file.type });
      img.src = rd.result;
    };
    rd.onerror = () => reject(new Error('تعذّر قراءة الصورة'));
    rd.readAsDataURL(file);
  });
}

/** يجمع بيانات إثبات الدفع من النموذج — يرمي خطأً واضحًا لو ناقص */
function collectProof(){
  const img = state.proofImg;
  if (!img || !img.data) throw new Error('ارفع صورة إشعار التحويل أولاً');
  const ref = ($('#proof-ref')?.value || '').trim();
  if (!ref) throw new Error('اكتب رقم العملية / المرجع الظاهر في إشعار التحويل');
  const amount = Number(($('#proof-amount')?.value || '').replace(/[^\d.]/g, ''));
  if (!(amount > 0)) throw new Error('اكتب المبلغ الذي حوّلته');
  return { image: img.data, image_name: img.name, image_mime: img.mime,
    txn_ref: ref, amount, paid_at: $('#proof-date')?.value || '', note: ($('#proof-note')?.value || '').trim() };
}

async function placeOrder(){
  if (!state.cart.length){ toast('سلتك فارغة', 'error'); return; }
  const name  = ($('#co-name')?.value || '').trim();
  const phone = ($('#co-phone')?.value || '').trim();
  const addr  = ($('#co-address')?.value || '').trim();
  const note  = ($('#co-note')?.value || '').trim();
  const payEl = $('input[name="pay"]:checked');
  const zSel = $('#co-zone');
  if (zSel) state.zone = zSel.value || '';
  if (!getToken() && !name){ toast('من فضلك أدخل اسمك', 'error'); return; }
  if (!validPhone(phone)){ toast('رقم الهاتف غير صحيح (مثال: 01012345678)', 'error'); return; }
  if (!addr){ toast('من فضلك أدخل عنوان التوصيل', 'error'); return; }
  if (zSel && state.zones.length && !state.zone){ toast('من فضلك اختر منطقة التوصيل لحساب الرسوم', 'error'); return; }
  if (!payEl){ toast('اختر طريقة الدفع', 'error'); return; }
  /* الطرق الإلكترونية تشترط إثبات تحويل قبل إتمام الطلب */
  const pm = selectedPay();
  let proof;
  if (needsProof(pm)){
    try { proof = collectProof(); }
    catch(e){
      toast(e.message, 'error');
      if (!state.proofImg) $('#proof-up')?.scrollIntoView({ behavior:'smooth', block:'center' });
      return;
    }
  }
  // لا يوجد توكن → فتح نافذة «تسجيل أول طلب» ثم المتابعة تلقائيًا
  if (!getToken()){ openRegisterModal(placeOrder); return; }

  const btn = $('#co-submit');
  btn?.setAttribute('disabled', '');
  btn && (btn.textContent = 'جارٍ تأكيد الطلب…');
  try {
    const o = await api('/api/store/orders', {
      method: 'POST',
      body: {
        items: itemsPayload(),
        promo_code: state.promo || undefined,
        zone_id: state.zone ? Number(state.zone) : undefined,
        payment_method_id: payEl.value,
        note, address: addr, phone,
        proof
      }
    });
    // تفريغ السلة بعد نجاح الطلب
    state.cart = []; state.promo = ''; state.quote = null; state.proofImg = null;
    saveCart();
    paintCartBadge();
    loadNotifications();
    viewOrderSuccess(o);
  } catch(e){
    btn?.removeAttribute('disabled');
    btn && (btn.textContent = '✓ تأكيد الطلب');
  }
}

function viewOrderSuccess(o){
  const code = o.code || ('#' + o.id);
  const pend = o.proof_status === 'pending';
  $('#view').innerHTML = page(`
    <div class="success-wrap card">
      <div class="big-emoji">🎉</div>
      <h1>تم استلام طلبك بنجاح!</h1>
      <p class="muted">سيتواصل معك المندوب خلال دقائق لتأكيد الطلب.</p>
      <div class="code-chip">رقم الطلب: <b class="mono">${esc(code)}</b></div>
      ${pend ? `<div class="pay-note warn" style="max-width:520px;margin:14px auto">
        <span class="pay-note-ic">⏳</span>
        <div><b>إثبات الدفع قيد المراجعة</b>
          <p class="small">استلمنا إثبات تحويلك وسيراجعه فريق المالية لتأكيد الدفع، وتابع حالة الطلب من صفحة التتبع.</p></div>
      </div>` : ''}
      <div class="totals" style="max-width:340px;margin:16px auto">${totalsHtml({
        subtotal:o.subtotal||0, delivery_fee:o.delivery_fee||0, discount:o.discount||0, tax:o.tax||0, total:o.total||0 })}</div>
      <div class="flex center">
        <a class="btn btn-primary" href="#/order/${o.id}">📍 تتبع الطلب</a>
        <a class="btn" href="#/">العودة للرئيسية</a>
      </div>
    </div>
  `);
}

/* ================= 9) الطلبات والتتبع ================= */
const STATUS = {
  new:       { l:'جديد',       c:'badge-info',    e:'🆕' },
  confirmed: { l:'تم التأكيد',  c:'badge-info',    e:'✅' },
  preparing: { l:'قيد التحضير', c:'badge-warning', e:'👨‍🍳' },
  delivering:{ l:'في الطريق',  c:'badge-primary', e:'🛵' },
  delivered: { l:'تم التسليم',  c:'badge-success', e:'📦' },
  cancelled: { l:'ملغي',        c:'badge-danger',  e:'❌' }
};
const FLOW = ['new','confirmed','preparing','delivering','delivered'];
const statusBadge = s => { const st = STATUS[s] || { l:s || '—', c:'badge-muted', e:'•' }; return `<span class="badge ${st.c}">${st.e} ${st.l}</span>`; };

async function viewOrders(){
  const v = $('#view');
  if (!getToken()){
    v.innerHTML = page(`<div class="empty"><span class="emoji">📦</span>سجّل دخولك لعرض طلباتك وتتبعها.
      <div class="flex center" style="margin-top:14px">
        <button class="btn btn-primary" data-act="login">تسجيل الدخول</button>
        <button class="btn" data-act="register">تسجيل أول طلب</button>
      </div></div>`);
    return;
  }
  let orders = [];
  try { orders = rowsOf(await api('/api/store/orders')); }
  catch(e){ if (e.status === 401){ setToken(''); state.me = null; return viewOrders(); } throw e; }
  v.innerHTML = page(`
    <h2 class="sec-title">📦 طلباتي</h2>
    ${orders.length ? orders.map(orderCard).join('')
      : `<div class="empty"><span class="emoji">🧾</span>لا توجد طلبات بعد — اطلب الآن وأول طلب لك يبدأ من هنا!
         <div style="margin-top:14px"><a class="btn btn-primary" href="#/cats">ابدأ الطلب</a></div></div>`}
  `);
}

function orderCard(o){
  const items = o.items || [];
  const preview = items.slice(0, 3).map(i => esc(i.name)).join(' · ');
  const more = items.length > 3 ? ` +${items.length - 3}` : '';
  const canRate = o.status === 'delivered' && !o.rating;
  return `<section class="card order-card">
    <div class="flex between">
      <div class="flex"><b class="mono">${esc(o.code || '#' + o.id)}</b>${statusBadge(o.status)}</div>
      <span class="muted small">${fmtDate(o.created_at)}</span>
    </div>
    ${preview ? `<p class="small muted clamp2" style="margin-top:8px">${preview}${more}</p>` : ''}
    <div class="sep"></div>
    <div class="flex between">
      <b class="price">${money(o.total)}</b>
      <div class="flex">
        ${canRate ? `<button class="btn btn-sm btn-soft" data-act="rate" data-id="${o.id}">⭐ قيّم طلبك</button>` : ''}
        ${o.status === 'delivered' && o.rating ? `<span class="badge badge-warning">⭐ ${o.rating}/5</span>` : ''}
        <button class="btn btn-sm" data-act="reorder" data-id="${o.id}">🛒 إعادة الطلب</button>
        <a class="btn btn-sm btn-primary" href="#/order/${o.id}">التفاصيل ←</a>
      </div>
    </div>
  </section>`;
}

// الخط الزمني للحالة: new → confirmed → preparing → delivering → delivered
function timelineHtml(o){
  if (o.status === 'cancelled'){
    return `<div class="alert">❌ تم إلغاء هذا الطلب${o.cancel_reason ? ' — ' + esc(o.cancel_reason) : ''}</div>`;
  }
  const cur = FLOW.indexOf(o.status);
  const hist = o.history || o.events || o.status_history || [];
  const at = s => {
    const h = hist.find(x => String(x.status || x.new_status) === s);
    return h ? (h.at || h.created_at || h.timestamp || '') : '';
  };
  return `<ul class="timeline">${FLOW.map((s, i) => {
    const st = STATUS[s];
    let t = at(s);
    if (i === cur) t = o.updated_at || t || o.created_at;
    if (s === 'delivered') t = t || o.delivered_at;
    return `<li class="tl ${i <= cur ? 'done' : ''} ${i === cur ? 'current' : ''}">
      <span class="dot"></span>
      <div><b>${st.e} ${st.l}</b>${t ? `<div class="muted small">${fmtDate(t)}</div>` : ''}</div></li>`;
  }).join('')}</ul>`;
}

async function viewOrder(id){
  const v = $('#view');
  let o = null;
  try {
    const d = await api('/api/store/orders/' + encodeURIComponent(id));
    o = d.order || d;
  } catch(e){
    v.innerHTML = page(`<div class="empty"><span class="emoji">⚠️</span>${esc(e.message || 'تعذّر جلب الطلب')}
      <div style="margin-top:14px"><a class="btn btn-primary" href="#/orders">عرض طلباتي</a></div></div>`);
    return;
  }
  const items = o.items || [];
  v.innerHTML = page(`
    <div class="flex between" style="margin-bottom:14px">
      <h2 class="sec-title" style="margin:0">📍 تتبع الطلب <b class="mono">${esc(o.code || '#' + o.id)}</b></h2>
      <a class="btn btn-sm btn-ghost" href="#/orders">→ طلباتي</a>
    </div>
    <div class="checkout-grid">
      <div class="col">
        <section class="card">
          <div class="flex between"><h3 class="card-title">حالة الطلب</h3>${statusBadge(o.status)}</div>
          ${timelineHtml(o)}
        </section>
        <section class="card" style="margin-top:14px">
          <h3 class="card-title">🧾 الأصناف</h3>
          ${items.length ? items.map(i => `<div class="trow"><span class="clamp2">${esc(i.name)} <span class="muted">× ${i.qty}</span></span><b>${money(i.total ?? (i.price * i.qty))}</b></div>`).join('')
            : `<div class="empty" style="padding:16px"><span class="emoji">🍽</span>لا توجد أصناف</div>`}
          <div class="sep"></div>
          ${totalsHtml(o)}
        </section>
      </div>
      <div class="col">
        ${proofPanel(o)}
        <section class="card">
          <h3 class="card-title">🛵 بيانات التوصيل</h3>
          <div class="stack">
            <div class="flex between"><span class="muted">العنوان</span><b class="grow" style="text-align:left">${esc(o.address || '—')}</b></div>
            <div class="flex between"><span class="muted">الهاتف</span><b class="mono" dir="ltr">${esc(o.phone || '—')}</b></div>
            ${o.note ? `<div class="flex between"><span class="muted">ملاحظة</span><b class="grow" style="text-align:left">${esc(o.note)}</b></div>` : ''}
            ${o.created_at ? `<div class="flex between"><span class="muted">تاريخ الطلب</span><b>${fmtDate(o.created_at)}</b></div>` : ''}
          </div>
          <div class="sep"></div>
          ${o.status === 'delivered'
            ? (o.rating
                ? `<div class="rate-box"><b>تقييمك للطلب:</b> <span class="badge badge-warning">⭐ ${o.rating}/5</span>${o.rating_comment ? `<p class="small muted">«${esc(o.rating_comment)}»</p>` : ''}</div>`
                : `<button class="btn btn-primary btn-block" data-act="rate" data-id="${o.id}">⭐ قيّم هذا الطلب</button>`)
            : ''}
          <button class="btn btn-block" data-act="reorder" data-id="${o.id}" style="margin-top:8px">🛒 إعادة الطلب</button>
        </section>
      </div>
    </div>
  `);
}

/* ---------- بطاقة حالة الدفع وإثبات التحويل داخل صفحة تتبع الطلب ---------- */
const PROOF_BADGE = {
  none:     { l:'الدفع عند الاستلام', c:'badge-info', e:'💵' },
  pending:  { l:'إثبات قيد المراجعة', c:'badge-warning', e:'⏳' },
  approved: { l:'تم اعتماد الدفع',   c:'badge-success', e:'✅' },
  rejected: { l:'إثبات مرفوض — أعد الإرسال', c:'badge-danger', e:'❌' },
};
function proofPanel(o){
  const pm = o.payment_method;
  const ps = o.proof_status || 'none';
  const proofs = o.proofs || [];
  const latest = proofs[0] || null;
  const needs = ps === 'pending' || ps === 'rejected';
  const canResend = (ps === 'none' || ps === 'rejected') && o.status !== 'cancelled' && o.status !== 'delivered' && pm && pm.kind !== 'cash';
  const badge = PROOF_BADGE[ps] || PROOF_BADGE.none;
  return `<section class="card" style="margin-bottom:14px">
    <div class="flex between"><h3 class="card-title">💳 الدفع</h3><span class="badge ${badge.c}">${badge.e} ${badge.l}</span></div>
    <div class="stack">
      <div class="flex between"><span class="muted">وسيلة الدفع</span><b>${esc(pm ? pm.name : (o.payment || '—'))}</b></div>
      <div class="flex between"><span class="muted">حالة السداد</span><b class="${o.paid === 'paid' ? 'text-success' : 'text-danger'}">${o.paid === 'paid' ? 'مدفوع ✓' : 'غير مدفوع'}</b></div>
      ${pm && pm.kind !== 'cash' && pm.pay_number ? `<div class="pay-info-row"><span class="muted">رقم التحويل</span>
        <b class="mono ltr">${esc(pm.pay_number)}</b>
        <button type="button" class="btn btn-sm btn-ghost" data-act="copy" data-copy="${esc(pm.pay_number)}">📋 نسخ</button></div>` : ''}
      ${latest ? `<div class="flex between"><span class="muted">رقم العملية المُرسل</span><b class="mono ltr">${esc(latest.txn_ref || '—')}</b></div>
        <div class="flex between"><span class="muted">المبلغ المحوَّل</span><b>${money(latest.amount)}</b></div>
        <div class="flex between"><span class="muted">تاريخ التحويل</span><b>${esc(latest.paid_at || '—')}</b></div>` : ''}
    </div>
    ${ps === 'rejected' && latest && latest.reject_reason ? `<div class="alert">❌ سبب الرفض: ${esc(latest.reject_reason)}</div>` : ''}
    ${ps === 'pending' ? `<p class="small muted" style="margin-top:8px">⏳ إثباتك وصلنا وهو قيد مراجعة فريق المالية — سيتم اعتماد الدفع وتأكيده سريعًا.</p>` : ''}
    ${ps === 'approved' ? `<p class="small muted" style="margin-top:8px">✅ تم التحقق من التحويل واعتماده. شكرًا لك!</p>` : ''}
    ${latest && latest.image ? `<div style="margin-top:10px"><div class="small muted" style="margin-bottom:6px">إشعار التحويل المُرسل:</div>
      <img class="proof-thumb" src="${esc(latest.image)}" alt="إشعار التحويل" data-act="proof-view" data-src="${esc(latest.image)}"></div>` : ''}
    ${ps === 'rejected' && canResend ? `<button class="btn btn-primary btn-block" data-act="proof-resend" data-id="${o.id}" style="margin-top:10px">📤 إعادة إرسال إثبات التحويل</button>` : ''}
    ${ps === 'none' && canResend ? `<button class="btn btn-soft btn-block" data-act="proof-resend" data-id="${o.id}" style="margin-top:10px">📤 إرسال إثبات تحويل</button>` : ''}
    ${needs && pm ? `<div class="pay-info" style="margin-top:10px">${pm.pay_number ? `<div class="pay-info-row"><span class="muted">حوّل إلى</span><b class="mono ltr">${esc(pm.pay_number)}</b>
      <button type="button" class="btn btn-sm btn-ghost" data-act="copy" data-copy="${esc(pm.pay_number)}">📋 نسخ</button></div>` : ''}
      ${pm.pay_holder ? `<div class="pay-info-row"><span class="muted">اسم صاحب الحساب</span><b>${esc(pm.pay_holder)}</b></div>` : ''}</div>` : ''}
  </section>`;
}

/** نافذة إعادة إرسال إثبات الدفع لطلب مرفوض */
async function openProofResend(id){
  let o = null;
  try { const d = await api('/api/store/orders/' + encodeURIComponent(id)); o = d.order || d; }
  catch(e){ toast(e.message || 'تعذّر جلب الطلب', 'error'); return; }
  const pm = o.payment_method || {};
  const total = Number(o.total) || 0;
  let img = null;
  const bd = openModal({
    title: '📤 إرسال إثبات تحويل — ' + (o.code || '#' + o.id),
    body: `<div class="pay-info" style="margin-bottom:10px">
        ${pm.pay_number ? `<div class="pay-info-row"><span class="muted">حوّل مبلغ ${money(total)} إلى</span><b class="mono ltr">${esc(pm.pay_number)}</b></div>` : `<div class="pay-info-row"><span class="muted">المبلغ المطلوب</span><b class="price">${money(total)}</b></div>`}
        ${pm.pay_holder ? `<div class="pay-info-row"><span class="muted">صاحب الحساب</span><b>${esc(pm.pay_holder)}</b></div>` : ''}
        ${pm.pay_bank ? `<div class="pay-info-row"><span class="muted">البنك / المزوّد</span><b>${esc(pm.pay_bank)}</b></div>` : ''}
      </div>
      ${pm.pay_instructions ? `<p class="small muted">💡 ${esc(pm.pay_instructions)}</p>` : ''}
      <div class="field" style="margin-top:10px"><label>صورة إشعار التحويل <span class="req">*</span></label>
        <div class="proof-up" id="rs-up">
          <input type="file" id="rs-file" accept="image/*">
          <div class="proof-up-ph" id="rs-ph"><span class="proof-up-ic">🖼️</span><span>اضغط لاختيار صورة الإشعار</span></div>
          <img id="rs-preview" class="proof-preview" alt="معاينة" hidden>
        </div>
      </div>
      <div class="proof-grid">
        <div class="field"><label>المبلغ المحوَّل <span class="req">*</span></label>
          <input class="input" id="rs-amount" inputmode="decimal" value="${total}"></div>
        <div class="field"><label>رقم العملية / المرجع <span class="req">*</span></label>
          <input class="input" id="rs-ref" dir="ltr" placeholder="مثال: 78341255"></div>
        <div class="field"><label>تاريخ التحويل</label>
          <input class="input" id="rs-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      </div>
      <div class="field"><label>ملاحظات (اختياري)</label>
        <input class="input" id="rs-note" placeholder="أي تفاصيل للمراجعة"></div>`,
    foot: `<button class="btn btn-primary" id="rs-ok">✅ إرسال الإثبات</button>
           <button class="btn" data-modal-close>إلغاء</button>`,
  });
  bd.addEventListener('change', e => {
    if (e.target.id !== 'rs-file') return;
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    readProofImage(file).then(r => {
      img = r;
      const pv = $('#rs-preview', bd);
      if (pv){ pv.src = r.data; pv.hidden = false; }
      $('#rs-ph', bd)?.setAttribute('hidden', '');
      $('#rs-up', bd)?.classList.add('has');
      toast('✅ تم إرفاق الصورة', 'success');
    }).catch(err => { img = null; toast(err.message, 'error'); });
  });
  const ok = $('#rs-ok', bd);
  ok.onclick = async () => {
    if (!img){ toast('ارفع صورة إشعار التحويل أولاً', 'error'); return; }
    const ref = ($('#rs-ref', bd)?.value || '').trim();
    if (!ref){ toast('اكتب رقم العملية / المرجع', 'error'); return; }
    const amount = Number((($('#rs-amount', bd)?.value) || '').replace(/[^\d.]/g, ''));
    if (!(amount > 0)){ toast('اكتب المبلغ الذي حوّلته', 'error'); return; }
    ok.setAttribute('disabled', '');
    try {
      await api('/api/store/orders/' + encodeURIComponent(id) + '/proof', { method:'POST', body: {
        image: img.data, image_name: img.name, image_mime: img.mime,
        txn_ref: ref, amount, paid_at: $('#rs-date', bd)?.value || '', note: ($('#rs-note', bd)?.value || '').trim()
      }});
      toast('✅ تم إرسال الإثبات وسيُراجعه فريق المالية', 'success');
      closeModal();
      loadNotifications();
      viewOrder(id);
    } catch(e){ ok.removeAttribute('disabled'); toast(e.message || 'تعذّر إرسال الإثبات', 'error'); }
  };
}

/** عرض صورة الإثبات بحجم كامل */
function openImageView(src){
  openModal({ title: '🧾 إشعار التحويل', body: `<img src="${esc(src)}" alt="إشعار التحويل" style="width:100%;border-radius:10px">` });
}

// إعادة إضافة أصناف طلب سابق إلى السلة
async function reorder(id){  try {
    const d = await api('/api/store/orders/' + encodeURIComponent(id));
    const o = d.order || d;
    const items = o.items || [];
    if (!items.length){ toast('لا توجد أصناف في هذا الطلب', 'error'); return; }
    items.forEach(it => {
      const pid = normId(it.product_id);
      if (!pid) return;
      state.products[pid] = state.products[pid] || { id:pid, name:it.name, price:it.price };
      setQty(pid, cartQtyOf(pid) + (Number(it.qty) || 1));
    });
    toast('تمت إضافة أصناف الطلب إلى السلة 🛒', 'success');
    openCart();
  } catch(e){ /* يظهر الخطأ عبر toast داخل api() */ }
}

/* ---------- نافذة التقييم ---------- */
const rateLabel = n => ({ 1:'ضعيفة', 2:'مقبولة', 3:'جيدة', 4:'جيدة جدًا', 5:'ممتازة' })[n] || '';
function starsHtml(rating = 0){
  return `<div class="stars" id="rate-stars" data-rating="${rating}">${[1,2,3,4,5]
    .map(i => `<button type="button" class="star ${i <= rating ? 'on' : ''}" data-star="${i}" aria-label="${i} نجوم">★</button>`).join('')}</div>
    <div id="rate-label" class="small muted">${rating ? rateLabel(rating) : 'اضغط على النجوم لاختيار تقييمك'}</div>`;
}
function openRateModal(id){
  openModal({
    title: '⭐ تقييم الطلب',
    body: `<form data-form="rate" data-id="${id}">
      ${starsHtml(0)}
      <div class="field" style="margin-top:12px"><label>تعليقك (اختياري)</label>
        <textarea class="input" name="comment" placeholder="اكتب رأيك في الطلب والمندوب…"></textarea></div>
    </form>`,
    foot: `<button class="btn btn-primary" data-act="rate-submit" data-id="${id}">إرسال التقييم</button>
           <button class="btn btn-ghost" data-modal-close>لاحقًا</button>`
  });
}
async function submitRate(id){
  const r = Number($('#rate-stars')?.dataset.rating || 0);
  if (!r){ toast('اختر عدد النجوم أولًا', 'error'); return; }
  const comment = ($('[data-form="rate"] [name="comment"]')?.value || '').trim();
  try {
    await api('/api/store/orders/' + encodeURIComponent(id) + '/rate', { method:'POST', body:{ rating:r, comment } });
    closeModal();
    toast('شكرًا لتقييمك ⭐', 'success');
    route();
  } catch(e){ /* يظهر الخطأ عبر toast داخل api() */ }
}

/* ================= 10) الحساب ================= */
async function viewAccount(){
  const v = $('#view');
  if (!getToken() || !state.me){
    if (getToken()){
      try { const d = await api('/api/store/me', { quiet:true }); state.me = d.customer || d; }
      catch(e){ if (e.status === 401){ setToken(''); } }
    }
    if (!getToken() || !state.me){
      v.innerHTML = page(`
        <h2 class="sec-title">👤 حسابي</h2>
        <section class="card guest-card">
          <div class="big-emoji">👤</div>
          <h3>أنت تتصفّح كزائر</h3>
          <p class="muted">سجّل دخولك برقم هاتفك لعرض طلباتك ونقاطك ومكافآتك.</p>
          <div class="flex center" style="margin-top:12px">
            <button class="btn btn-primary" data-act="login">تسجيل الدخول</button>
            <button class="btn" data-act="register">تسجيل أول طلب</button>
          </div>
        </section>
        ${companyFooter()}
      `);
      return;
    }
  }
  const me = state.me;
  let rewards = [], promos = [];
  try { rewards = rowsOf(await api('/api/store/rewards')); } catch(e){}
  try { promos = rowsOf(await api('/api/store/promotions')); } catch(e){}
  v.innerHTML = page(`
    <h2 class="sec-title">👤 حسابي</h2>
    <div class="acct-grid">
      <section class="card">
        <div class="flex">
          <span class="avatar big">${esc((me.name || '؟').trim().charAt(0))}</span>
          <div class="grow"><h3 style="margin:0">${esc(me.name || '')}</h3>
            <div class="muted small mono" dir="ltr">${esc(me.phone || '')}</div>
            ${me.address ? `<div class="muted small clamp2">📍 ${esc(me.address)}</div>` : ''}</div>
        </div>
        <div class="kpi-row">
          <div class="card kpi-soft"><span class="kpi-ic">🏆</span><div><b>${Number(me.points) || 0}</b><div class="muted small">نقطة ولاء</div></div></div>
          <div class="card kpi-soft"><span class="kpi-ic">💰</span><div><b>${money(me.total_spent)}</b><div class="muted small">إجمالي المشتريات</div></div></div>
          <div class="card kpi-soft"><span class="kpi-ic">🧾</span><div><b>${Number(me.orders_count) || 0}</b><div class="muted small">عدد الطلبات</div></div></div>
        </div>
        <div class="flex" style="margin-top:12px">
          <button class="btn btn-soft btn-sm" data-act="theme">🌓 تبديل الوضع الليلي</button>
          <button class="btn btn-danger btn-sm" data-act="logout">تسجيل الخروج</button>
        </div>
      </section>

      <section class="card">
        <h3 class="card-title">🎁 مكافآتي</h3>
        ${rewards.length ? `<div class="list">${rewards.map(rw => `
          <div class="list-item">
            <span class="kpi-ic">${rw.kind === 'gift' ? '🎁' : '🏷'}</span>
            <div class="grow"><b>${rw.kind === 'gift' ? 'هدية' : 'خصم'} — ${rw.kind === 'discount' ? money(rw.value) : esc(rw.note || 'هدية من طلباتك')}</b>
              ${rw.note && rw.kind === 'gift' ? `<div class="muted small">${esc(rw.note)}</div>` : ''}</div>
            <span class="badge ${rw.active ? 'badge-success' : 'badge-muted'}">${rw.active ? 'سارية' : 'مستخدمة'}</span>
          </div>`).join('')}</div>`
          : `<div class="empty" style="padding:20px"><span class="emoji">🎁</span>لا توجد مكافآت بعد — اطلب المزيد واكسب النقاط!</div>`}
      </section>

      <section class="card">
        <h3 class="card-title">🏷️ العروض النشطة</h3>
        ${promos.length ? `<div class="list">${promos.map(p => `
          <div class="list-item">
            <div class="grow"><b>${esc(p.name || 'عرض')}</b>
              <div class="muted small">${p.kind === 'percent' ? `خصم ${Number(p.value)}%` : `خصم ${money(p.value)}`}${p.min_order ? ` · للطلبات فوق ${money(p.min_order)}` : ''}${p.end_at ? ` · حتى ${fmtDate(p.end_at)}` : ''}</div></div>
            ${p.code ? `<button class="btn btn-sm btn-soft mono" data-act="use-promo" data-code="${esc(p.code)}">${esc(p.code)}</button>` : ''}
          </div>`).join('')}</div>`
          : `<div class="empty" style="padding:20px"><span class="emoji">🏷</span>لا توجد عروض نشطة حاليًا</div>`}
      </section>
    </div>
    ${companyFooter()}
  `);
}

function companyFooter(){
  const c = state.company || {};
  return `<footer class="co-footer card">
    <div class="flex">${companyLogoHtml(c, 'co-logo')}<div><b>${esc(c.name || 'طلباتك')}</b>
      <div class="muted small">${esc(c.address || '')}</div></div></div>
    <div class="chips" style="margin-top:10px">
      ${c.phone ? `<span class="chip">📞 <span class="mono" dir="ltr">${esc(c.phone)}</span></span>` : ''}
      ${c.email ? `<span class="chip">✉️ <span class="mono" dir="ltr">${esc(c.email)}</span></span>` : ''}
      ${c.working_hours ? `<span class="chip">🕐 ${esc(c.working_hours)}</span>` : ''}
      <span class="chip">🛵 التوصيل: ${Number(c.delivery_fee) > 0 ? money(c.delivery_fee) : 'مجاني'}</span>
    </div>
    ${c.about ? `<p class="small muted" style="margin-top:8px">${esc(c.about)}</p>` : ''}
  </footer>`;
}

/* ---------- تسجيل الدخول / أول طلب ---------- */
function openLoginModal(after){
  openModal({
    title: '🔑 تسجيل الدخول',
    body: `<form data-form="login" class="stack">
      <p class="small muted">أدخل رقم هاتفك المسجّل لدينا، وسنرسل لك الدخول مباشرة (بدون كلمة مرور).</p>
      <div class="field"><label>رقم الهاتف <span class="req">*</span></label>
        <input class="input" name="phone" dir="ltr" inputmode="tel" required placeholder="01xxxxxxxxx"></div>
    </form>`,
    foot: `<button class="btn btn-primary" data-act="login-submit">دخول</button>
           <button class="btn btn-ghost" data-modal-close>إلغاء</button>`,
    onOpen: bd => { bd._after = after; }
  });
}
async function submitLogin(){
  const phone = ($('[data-form="login"] [name="phone"]')?.value || '').trim();
  if (!validPhone(phone)){ toast('رقم الهاتف غير صحيح (مثال: 01012345678)', 'error'); return; }
  try {
    const d = await api('/api/store/login', { method:'POST', body:{ phone } });
    if (d.token) setToken(d.token);
    state.me = d.customer || d.me || null;
    const after = $('#modal-root .modal-backdrop')?._after;
    closeModal();
    toast('مرحبًا بعودتك 👋', 'success');
    after ? after() : route();
  } catch(e){ /* toast من api() */ }
}

function openRegisterModal(after){
  // ملء مسبق من حقول صفحة إتمام الطلب إن وُجدت
  const p = $('#co-phone') ? $('#co-phone').value.trim() : '';
  const a = $('#co-address') ? $('#co-address').value.trim() : '';
  const n = $('#co-name') ? $('#co-name').value.trim() : '';
  openModal({
    title: '📝 تسجيل أول طلب',
    body: `<p class="small muted">نحفظ بياناتك مرة واحدة فقط، ولا نسألك عنها مجددًا في طلباتك القادمة.</p>
    <form data-form="register" class="stack" id="reg-form">
      <div class="field"><label>الاسم بالكامل <span class="req">*</span></label>
        <input class="input" name="name" required value="${esc(n)}" placeholder="مثال: أحمد محمود"></div>
      <div class="field"><label>رقم الهاتف <span class="req">*</span></label>
        <input class="input" name="phone" dir="ltr" inputmode="tel" required value="${esc(p)}" placeholder="01xxxxxxxxx"></div>
      <div class="field"><label>عنوان التوصيل <span class="req">*</span></label>
        <textarea class="input" name="address" required placeholder="المحافظة، المنطقة، الشارع، علامة مميزة">${esc(a)}</textarea></div>
      <p class="small muted">لديك حساب بالفعل؟ <button type="button" class="linklike" data-act="login">تسجيل الدخول برقم الهاتف</button></p>
    </form>`,
    foot: `<button class="btn btn-primary" data-act="reg-submit" data-hasafter="${after ? '1' : ''}">حفظ ومتابعة</button>
           <button class="btn btn-ghost" data-modal-close>إلغاء</button>`,
    onOpen: bd => { bd._after = after; }
  });
}
async function submitRegister(){
  const f = $('[data-form="register"]');
  const name = (f?.querySelector('[name="name"]')?.value || '').trim();
  const phone = (f?.querySelector('[name="phone"]')?.value || '').trim();
  const address = (f?.querySelector('[name="address"]')?.value || '').trim();
  if (!name){ toast('من فضلك أدخل اسمك', 'error'); return; }
  if (!validPhone(phone)){ toast('رقم الهاتف غير صحيح (مثال: 01012345678)', 'error'); return; }
  if (!address){ toast('من فضلك أدخل عنوان التوصيل', 'error'); return; }
  try {
    const d = await api('/api/store/register', { method:'POST', body:{ name, phone, address } });
    if (d.token) setToken(d.token);
    state.me = d.customer || null;
    // مزامنة مدخلات صفحة إتمام الطلب حتى تقرأها placeOrder بنفسها
    if ($('#co-name')) $('#co-name').value = name;
    if ($('#co-phone')) $('#co-phone').value = phone;
    if ($('#co-address')) $('#co-address').value = address;
    const after = $('#modal-root .modal-backdrop')?._after;
    closeModal();
    toast('تم حفظ بياناتك بنجاح ✅', 'success');
    if (after) after(); else route();
  } catch(e){ /* toast من api() */ }
}

/* ================= النوافذ المنبثقة ================= */
function openModal({ title = '', body = '', foot = '', onOpen }){
  closeModal(); // نافذة واحدة في كل مرة — تجنّب تراكم النوافذ عند النقر المتكرر
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <div class="modal-head"><h3 class="card-title">${title}</h3>
      <button class="btn btn-ghost btn-icon" data-modal-close aria-label="إغلاق">✕</button></div>
    <div class="modal-body">${body}</div>
    ${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
  bd.addEventListener('click', e => {
    if (e.target === bd || e.target.closest('[data-modal-close]')) closeModal();
  });
  $('#modal-root').appendChild(bd);
  onOpen && onOpen(bd);
  return bd;
}
const closeModal = () => { $('#modal-root').innerHTML = ''; };
/** نسخ نص للحافظة مع بديل للمتصفحات القديمة أو غير الآمنة */
function fallbackCopy(txt, done){
  try {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove(); done();
  } catch(e){ toast('انسخ الرقم يدويًا: ' + txt, ''); }
}

/* ================= 11) ربط الأحداث والتشغيل ================= */
function bindEvents(){
  // نقرات عامة عبر data-act
  document.addEventListener('click', e => {
    // اختيار النجوم
    const star = e.target.closest('.star');
    if (star){
      const box = star.closest('.stars'); if (!box) return;
      const n = Number(star.dataset.star);
      box.dataset.rating = n;
      $$('.star', box).forEach(s => s.classList.toggle('on', Number(s.dataset.star) <= n));
      const lbl = $('#rate-label'); if (lbl) lbl.textContent = rateLabel(n);
      return;
    }
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const id = normId(t.dataset.id);
    switch (t.dataset.act){
      case 'theme': THEME.toggle(); break;
      case 'cart-open': openCart(); break;
      case 'cart-close': closeCart(); break;
      case 'notif-open': openNotifs(); break;
      case 'notif-close': closeNotifs(); break;
      case 'notif-read-all': markAllNotifsRead(); break;
      case 'notif-open-item': openNotifItem(t.dataset.id, t.dataset.oid); break;
      case 'qty': {
        const before = cartCount();
        const next = cartQtyOf(id) + Number(t.dataset.d);
        setQty(id, next);
        if (before === 0 && next > 0) openCart();   // فتح الفاتورة عند أول إضافة
        break;
      }
      case 'del': setQty(id, 0); break;
      case 'promo-apply': applyPromo(); break;
      case 'use-promo': {
        state.promo = (t.dataset.code || '').trim().toUpperCase();
        const pi = $('#promo-input'); if (pi) pi.value = state.promo;
        openCart();
        if (state.cart.length) runQuote();
        break;
      }
      case 'go-checkout': location.hash = '#/checkout'; break;
      case 'place-order': placeOrder(); break;
      case 'pay-pick': {
        /* النقر على البطاقة يحدد الراديو ثم يرسم التفاصيل */
        const radio = t.querySelector('input[name="pay"]');
        if (radio){ radio.checked = true; state.proofImg = null; paintPayDetails(); }
        break;
      }
      case 'copy': {
        const txt = t.dataset.copy || '';
        const done = () => toast('📋 تم نسخ: ' + txt, 'success');
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(done).catch(() => fallbackCopy(txt, done));
        else fallbackCopy(txt, done);
        break;
      }
      case 'proof-resend': openProofResend(id); break;
      case 'proof-view': openImageView(t.dataset.src || ''); break;
      case 'rate': openRateModal(id); break;
      case 'rate-submit': submitRate(id); break;
      case 'reorder': reorder(id); break;
      case 'login': {
        // إن كانت نافذة التسجيل مفتوحة، نستبدلها مع الإبقاء على ما بعدها (متابعة الطلب)
        const after = $('#modal-root .modal-backdrop')?._after || null;
        closeModal();
        openLoginModal(after);
        break;
      }
      case 'login-submit': submitLogin(); break;
      case 'register': openRegisterModal(null); break;
      case 'reg-submit': submitRegister(); break;
      case 'logout': setToken(''); state.me = null; toast('تم تسجيل الخروج', 'success'); route(); break;
      case 'retry': route(); break;
    }
  });
  // اختيار طريقة الدفع
  document.addEventListener('change', e => {
    if (e.target.name === 'pay'){
      state.proofImg = null;
      paintPayDetails();
    }
    // رفع صورة إشعار التحويل
    if (e.target.id === 'proof-file'){
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      readProofImage(file).then(img => {
        state.proofImg = img;
        const pv = $('#proof-preview');
        if (pv){ pv.src = img.data; pv.hidden = false; }
        $('#proof-ph')?.setAttribute('hidden', '');
        $('#proof-up')?.classList.add('has');
        toast('✅ تم إرفاق صورة الإثبات', 'success');
      }).catch(err => { state.proofImg = null; toast(err.message, 'error'); });
    }
    // تغيير منطقة التوصيل → إعادة حساب الرسوم من السيرفر
    if (e.target.id === 'co-zone'){
      state.zone = e.target.value || '';
      if (state.cart.length) runQuote(); else paintTotals();
    }
  });
  // إرسال النماذج (Enter)
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    if (f.dataset.form === 'login') submitLogin();
    else if (f.dataset.form === 'register') submitRegister();
    else if (f.dataset.form === 'rate') submitRate(f.dataset.id);
  });
  // Escape يغلق النافذة/الدرج
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape'){ closeModal(); closeCart(); closeNotifs(); }
  });
  // Enter في حقل الكود يطبّقه
  $('#promo-input')?.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); applyPromo(); } });
}

async function init(){
  loadCart();
  paintThemeBtn();
  bindEvents();
  renderCartLines();
  paintTotals();
  paintCartBadge();
  paintNotifBadge();
  // جلب بيانات الشركة (اسم + شعار) مبكرًا لرسم الشعار ديناميكياً
  ensureHome().catch(() => {});
  loadNotifications();
  // تحديث الإشعارات كل ٦٠ ثانية عند تسجيل الدخول
  setInterval(() => { if (getToken()) loadNotifications(); }, 60000);
  window.addEventListener('hashchange', route);
  const t0 = Date.now();
  try { await route(); } catch(e){}
  ensureHome().then(() => { paintCartBadge(); paintTotals(); loadNotifications(); }).catch(() => {});   // بيانات الشركة في الخلفية لأي شاشة
  // إخفاء شاشة البداية بعد أقل مهلة لطيفة
  setTimeout(() => {
    const s = $('#splash');
    if (!s) return;
    s.classList.add('off');
    setTimeout(() => s.remove(), 500);
  }, Math.max(350, 750 - (Date.now() - t0)));
}
init();
