/* ============================================================
   الكاشير — نقطة البيع
   ============================================================ */
import { state, api, can, icon, esc, fmt } from '../core.js';
import { toast, modal, confirmDialog, openForm, printReceipt, emptyState } from '../ui.js';

let cart = new Map();       // product_id -> { product, qty }
let products = [];
let categories = [];
let customers = [];
let customerId = '';
let discount = 0;
let categoryId = '';
let search = '';
let currentHoldId = null;

function branchLabel() {
  const b = (state.branches || []).find((x) => Number(x.id) === Number(state.branchId || state.defaultBranchId));
  return b?.name || 'الفرع الرئيسي';
}

export async function render(root) {
  cart = new Map();
  customerId = '';
  discount = 0;
  categoryId = '';
  search = '';
  currentHoldId = null;

  const [prodRes, custRes] = await Promise.all([
    api('/products?limit=500'),
    api('/customers?limit=300').catch(() => ({ rows: [] })),
  ]);
  products = prodRes.rows || [];
  customers = custRes.rows || [];
  categories = state.categories || [];

  root.innerHTML = `
    <div class="pos-layout">
      <div class="pos-main">
        ${state.shift ? '' : `<div class="alert alert-warn" style="padding:9px 13px">
          ${icon('clock')}
          <div style="flex:1">لا توجد وردية مفتوحة — يمكنك البيع، لكن يُفضّل <a href="#/treasury?tab=shifts" style="text-decoration:underline;font-weight:700">فتح وردية</a> لتسوية الخزينة بدقة.</div>
        </div>`}
        <div class="pos-bar">
          <div class="pos-search input-icon">
            ${icon('search')}
            <input class="input" id="pos-search" placeholder="ابحث بالاسم أو امسح الباركود…" autocomplete="off" value="${esc(search)}" />
            <span class="kbd-hint">F4</span>
          </div>
          <span class="badge badge-muted hide-mobile" title="الفرع النشط">${icon('building', 'icon-sm')} ${esc(branchLabel())}</span>
          <button class="btn btn-secondary" data-holds title="الفواتير المعلقة">${icon('pause')} <span class="hide-mobile">المعلقة</span></button>
        </div>
        <div class="chips-scroll pos-cats" id="pos-cats"></div>
        <div class="pos-grid-wrap" id="pos-grid-wrap">
          <div class="pos-grid" id="pos-grid"></div>
        </div>
      </div>

      <aside class="pos-cart" id="pos-cart">
        <div class="cart-head">
          <h3>الفاتورة الحالية</h3>
          <span class="cart-count" id="cart-count">0</span>
          <div class="spacer"></div>
          <div class="cart-tools">
            <button class="icon-btn" data-clear title="تفريغ السلة">${icon('trash')}</button>
            <button class="icon-btn" data-hold title="تعليق الفاتورة">${icon('pause')}</button>
          </div>
          <button class="icon-btn cart-close" data-cart-close aria-label="إغلاق">${icon('x')}</button>
        </div>
        <div class="cart-customer">
          ${icon('users', 'icon-sm')}
          <select class="select" id="pos-customer" aria-label="العميل">
            <option value="">عميل نقدي</option>
            ${customers.map((c) => `<option value="${c.id}" ${String(customerId) === String(c.id) ? 'selected' : ''}>${esc(c.name)}${Number(c.balance) > 0 ? ` — عليه ${fmt.num(c.balance)}` : ''}</option>`).join('')}
          </select>
          ${can('contacts.manage') ? `<button class="icon-btn" data-add-customer title="عميل جديد" style="width:30px;height:30px">${icon('plus')}</button>` : ''}
        </div>
        <div class="cart-items" id="cart-items"></div>
        <div class="cart-foot">
          <div class="cart-discount">
            ${icon('percent', 'icon-sm')} <span>خصم</span>
            <input class="input" id="cart-discount" type="number" min="0" step="0.5" value="${discount || ''}" placeholder="0" />
            <div class="spacer"></div>
            <span class="tiny muted" id="cart-items-count">0 صنف</span>
          </div>
          <div class="sum-row"><span>الإجمالي الفرعي</span><b id="sum-sub">0</b></div>
          <div class="sum-row" id="sum-tax-row" style="display:none"><span>الضريبة</span><b id="sum-tax">0</b></div>
          <div class="sum-total"><span>الإجمالي</span><b id="sum-total">0 <small>${esc(state.settings.currency || 'ج.م')}</small></b></div>
          <button class="btn btn-primary pay-btn w-full" data-pay>${icon('cash')} الدفع <kbd>F2</kbd></button>
        </div>
      </aside>

      <div class="pos-mobile-bar" data-cart-open>
        <div class="pmb-body"><b id="pmb-total">0 ${esc(state.settings.currency || 'ج.م')}</b><span id="pmb-count">السلة فارغة</span></div>
        <button class="btn btn-primary" style="height:42px">${icon('cart')} عرض السلة</button>
      </div>
    </div>`;

  renderCategories(root);
  renderProducts(root);
  renderCart(root);

  /* ---------- الأحداث ---------- */
  const searchInput = root.querySelector('#pos-search');
  searchInput.addEventListener('input', () => { search = searchInput.value; renderProducts(root); });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const term = searchInput.value.trim();
      if (!term) return;
      const exact = products.find((p) => String(p.barcode) === term || String(p.sku).toLowerCase() === term.toLowerCase());
      const prod = exact || filteredProducts()[0];
      if (!prod) { toast('لا يوجد منتج مطابق', 'warn'); return; }
      addToCart(prod, root, 1);
      searchInput.value = ''; search = ''; renderProducts(root);
    }
    if (e.key === 'Escape') { searchInput.value = ''; search = ''; renderProducts(root); }
  });

  root.querySelector('#pos-cats').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cat]');
    if (!chip) return;
    categoryId = chip.dataset.cat;
    renderCategories(root);
    renderProducts(root);
  });

  root.querySelector('#pos-grid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-product]');
    if (!card) return;
    const prod = products.find((p) => String(p.id) === card.dataset.product);
    if (prod) addToCart(prod, root, 1);
  });

  const cartEl = root.querySelector('#pos-cart');
  cartEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'inc') changeQty(root, id, 1);
    if (action === 'dec') changeQty(root, id, -1);
    if (action === 'remove') { cart.delete(String(id)); renderCart(root); }
    if (action === 'clear') clearCart(root);
    if (action === 'hold') holdCart(root);
    if (action === 'pay') openPayment(root);
    if (action === 'close') closeCartDrawer(root);
    if (action === 'addcustomer') addCustomer(root);
  });
  cartEl.addEventListener('change', (e) => {
    if (e.target.matches('[data-qty-input]')) {
      const id = e.target.dataset.id;
      setQty(root, id, Number(e.target.value));
    }
  });

  cartEl.querySelector('#pos-customer').addEventListener('change', (e) => { customerId = e.target.value; });
  const discountInput = cartEl.querySelector('#cart-discount');
  discountInput.addEventListener('input', () => {
    discount = Math.max(0, Number(discountInput.value) || 0);
    updateTotals(root);
  });

  root.querySelector('[data-holds]').addEventListener('click', () => openHolds(root));
  root.querySelector('[data-hold]')?.addEventListener('click', () => holdCart(root));
  root.querySelector('[data-clear]')?.addEventListener('click', () => clearCart(root));
  root.querySelector('[data-add-customer]')?.addEventListener('click', () => addCustomer(root));
  root.querySelector('[data-pay]')?.addEventListener('click', () => openPayment(root));
  root.querySelector('[data-cart-open]')?.addEventListener('click', () => cartEl.classList.add('open'));
  root.querySelector('[data-cart-close]')?.addEventListener('click', () => closeCartDrawer(root));

  cartEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-cart-close]')) closeCartDrawer(root);
  });

  const keyHandler = (e) => {
    if (!document.body.contains(root)) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.key === 'F2') { e.preventDefault(); openPayment(root); }
    if (e.key === 'F4') { e.preventDefault(); searchInput.focus(); searchInput.select(); }
    if (e.key === 'F9') { e.preventDefault(); holdCart(root); }
    if (e.key === 'F8') { e.preventDefault(); openHolds(root); }
    if (e.key === 'Escape' && tag !== 'input' && tag !== 'textarea' && tag !== 'select') closeCartDrawer(root);
  };
  document.addEventListener('keydown', keyHandler);

  setTimeout(() => searchInput.focus(), 100);

  return () => { document.removeEventListener('keydown', keyHandler); };
}

/* ============================ عرض المنتجات ============================ */
function filteredProducts() {
  const q = search.trim().toLowerCase();
  return products.filter((p) => {
    if (categoryId && String(p.category_id) !== String(categoryId)) return false;
    if (!q) return true;
    return String(p.name).toLowerCase().includes(q) || String(p.barcode || '').includes(q) || String(p.sku || '').toLowerCase().includes(q);
  });
}

function renderCategories(root) {
  const wrap = root.querySelector('#pos-cats');
  const counts = {};
  for (const p of products) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
  wrap.innerHTML = `<button class="chip ${!categoryId ? 'active' : ''}" data-cat="">الكل <span class="count">${fmt.int(products.length)}</span></button>
    ${categories.filter((c) => counts[c.id]).map((c) => `<button class="chip ${String(categoryId) === String(c.id) ? 'active' : ''}" data-cat="${c.id}">
      <span class="dot" style="--c:${esc(c.color)}"></span>${esc(c.name)} <span class="count">${counts[c.id] || 0}</span>
    </button>`).join('')}`;
}

function renderProducts(root) {
  const grid = root.querySelector('#pos-grid');
  if (!grid) return;
  const list = filteredProducts();
  const colors = {};
  for (const c of categories) colors[c.id] = c.color;
  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1">${emptyState({
      title: 'لا توجد منتجات مطابقة',
      text: search ? `لم نجد نتائج لـ «${esc(search)}» — جرّب كلمة أخرى أو امسح الباركود.` : 'أضف منتجات من صفحة المنتجات للبدء.',
      iconName: 'search',
      action: can('products.manage') ? '<a class="btn btn-primary btn-sm" href="#/products?new=1">إضافة منتج</a>' : '',
    })}</div>`;
    return;
  }
  grid.innerHTML = list.map((p) => {
    const stock = Number(p.stock) || 0;
    const min = Number(p.min_stock) || 0;
    const isOut = stock <= 0;
    const isLow = stock > 0 && stock <= min;
    const color = colors[p.category_id] || 'var(--brand)';
    return `<button class="product-card ${isOut ? 'out' : ''}" data-product="${p.id}" style="--c:${esc(color)}" ${isOut && state.settings.allow_negative_stock !== '1' ? 'disabled' : ''}>
      <div class="pc-top">
        <span class="pc-unit">${esc(p.unit || 'قطعة')}</span>
        <span class="pc-stock ${isOut ? 'out' : isLow ? 'low' : ''}">${isOut ? 'نفد' : `${fmt.qty(stock)} متاح`}</span>
      </div>
      <div class="pc-name">${esc(p.name)}</div>
      <div class="pc-bottom">
        <div class="pc-price">${fmt.num(p.price)} <small>${esc(state.settings.currency || 'ج.م')}</small></div>
        <span class="pc-add">${icon('plus')}</span>
      </div>
    </button>`;
  }).join('');
}

/* ============================ السلة ============================ */
function calc() {
  let subtotal = 0, count = 0;
  for (const { product, qty } of cart.values()) {
    subtotal += Number(product.price) * qty;
    count += qty;
  }
  subtotal = Math.round(subtotal * 100) / 100;
  const disc = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const taxable = Math.round((subtotal - disc) * 100) / 100;
  const rate = Math.max(0, Number(state.settings.tax_rate) || 0);
  const inclusive = state.settings.tax_inclusive === '1';
  let tax = 0, total = taxable;
  if (rate > 0) {
    if (inclusive) { tax = Math.round((taxable * rate / (100 + rate)) * 100) / 100; total = taxable; }
    else { tax = Math.round((taxable * rate / 100) * 100) / 100; total = Math.round((taxable + tax) * 100) / 100; }
  }
  return { subtotal, discount: disc, tax, total, count: Math.round(count * 100) / 100 };
}

function renderCart(root) {
  const box = root.querySelector('#cart-items');
  if (!box) return;
  if (!cart.size) {
    box.innerHTML = `<div class="cart-empty">${icon('cart')}<b>السلة فارغة</b><span>اضغط على منتج لإضافته<br>أو امسح الباركود مباشرة</span></div>`;
  } else {
    box.innerHTML = [...cart.values()].map(({ product: p, qty }) => {
      const color = (categories.find((c) => String(c.id) === String(p.category_id)) || {}).color || 'var(--brand)';
      return `<div class="cart-row" style="--c:${esc(color)}">
        <div class="thumb" style="--c:${esc(color)}">${esc(p.name.slice(0, 2))}</div>
        <div class="cr-name">${esc(p.name)}</div>
        <div class="cr-total">${fmt.money(qty * p.price, false)}</div>
        <div class="cr-controls">
          <div class="qty-stepper">
            <button data-action="dec" data-id="${p.id}" aria-label="تقليل">${icon('minus')}</button>
            <input type="number" inputmode="decimal" min="0" step="0.25" value="${qty}" data-qty-input data-id="${p.id}" aria-label="الكمية" />
            <button data-action="inc" data-id="${p.id}" aria-label="زيادة">${icon('plus')}</button>
          </div>
          <span class="tiny muted">${fmt.num(p.price)} × ${esc(p.unit || '')}</span>
          <button class="cr-remove" data-action="remove" data-id="${p.id}" aria-label="حذف">${icon('x')}</button>
        </div>
      </div>`;
    }).join('');
  }
  root.querySelector('#cart-count').textContent = cart.size;
  const count = [...cart.values()].reduce((a, i) => a + i.qty, 0);
  root.querySelector('#cart-items-count').textContent = `${fmt.qty(count)} وحدة`;
  updateTotals(root);
  const drawer = root.querySelector('#pos-cart');
  const bar = root.querySelector('.pos-mobile-bar');
  if (drawer) drawer.classList.toggle('open', false);
  if (bar) bar.classList.remove('hide');
}

function updateTotals(root) {
  const { subtotal, discount: d, tax, total } = calc();
  const cur = state.settings.currency || 'ج.م';
  const set = (id, html) => { const el = root.querySelector('#' + id); if (el) el.innerHTML = html; };
  set('sum-sub', `${fmt.money(subtotal, false)} <small style="color:var(--muted)">${esc(cur)}</small>`);
  set('sum-total', `${fmt.money(total, false)} <small>${esc(cur)}</small>`);
  set('sum-tax', `${fmt.money(tax, false)} <small style="color:var(--muted)">${esc(cur)}</small>`);
  const taxRow = root.querySelector('#sum-tax-row');
  if (taxRow) taxRow.style.display = tax > 0 ? '' : 'none';
  set('pmb-total', `${fmt.money(total, false)} ${esc(cur)}`);
  const pmbCount = root.querySelector('#pmb-count');
  if (pmbCount) pmbCount.textContent = cart.size ? `${cart.size} صنف · ${fmt.qty([...cart.values()].reduce((a, i) => a + i.qty, 0))} وحدة` : 'السلة فارغة';
  const disc = root.querySelector('#cart-discount');
  if (disc && document.activeElement !== disc) disc.value = discount || '';
  const empty = cart.size === 0;
  root.querySelectorAll('[data-pay]').forEach((b) => { b.disabled = empty; });
}

function addToCart(prod, root, addQty = 1) {
  const key = String(prod.id);
  const existing = cart.get(key);
  const currentQty = existing ? existing.qty : 0;
  const stock = Number(prod.stock) || 0;
  const allowNegative = state.settings.allow_negative_stock === '1';
  const nextQty = Math.round((currentQty + addQty) * 100) / 100;
  if (!allowNegative && nextQty > stock) {
    toast(`المتاح من «${prod.name}» هو ${fmt.qty(stock)} ${prod.unit} فقط`, 'warn');
    return;
  }
  cart.set(key, { product: prod, qty: nextQty });
  renderCart(root);
  const card = root.querySelector(`[data-product="${prod.id}"]`);
  if (card) { card.style.transform = 'scale(.96)'; setTimeout(() => { card.style.transform = ''; }, 110); }
}

function changeQty(root, id, delta) {
  const item = cart.get(String(id));
  if (!item) return;
  const stock = Number(item.product.stock) || 0;
  const allowNegative = state.settings.allow_negative_stock === '1';
  let qty = Math.round((item.qty + delta) * 100) / 100;
  if (qty <= 0) { cart.delete(String(id)); renderCart(root); return; }
  if (!allowNegative && qty > stock) { toast(`لا يمكن تجاوز المخزون المتاح (${fmt.qty(stock)})`, 'warn'); return; }
  item.qty = qty;
  renderCart(root);
}

function setQty(root, id, qty) {
  const item = cart.get(String(id));
  if (!item) return;
  const stock = Number(item.product.stock) || 0;
  const allowNegative = state.settings.allow_negative_stock === '1';
  qty = Math.round((Number(qty) || 0) * 100) / 100;
  if (qty <= 0) { cart.delete(String(id)); renderCart(root); return; }
  if (!allowNegative && qty > stock) { toast(`المتاح ${fmt.qty(stock)} ${item.product.unit} فقط`, 'warn'); qty = stock; }
  item.qty = qty;
  renderCart(root);
}

function clearCart(root) {
  if (!cart.size) return;
  const m = modal({
    title: 'تفريغ السلة؟', size: 'sm',
    body: '<p class="small text-2">سيتم حذف كل الأصناف من الفاتورة الحالية.</p>',
    footer: `<button class="btn btn-secondary" data-close>إلغاء</button><button class="btn btn-danger" data-ok>${icon('trash')} تفريغ</button>`,
    onMount: (mm) => {
      mm.root.querySelector('[data-close]').addEventListener('click', () => mm.close());
      mm.root.querySelector('[data-ok]').addEventListener('click', () => {
        cart.clear(); discount = 0; currentHoldId = null;
        mm.close(); renderCart(root);
      });
    },
  });
}

function closeCartDrawer(root) {
  root.querySelector('#pos-cart')?.classList.remove('open');
  root.querySelector('.pos-mobile-bar')?.classList.remove('hide');
}

/* ============================ الدفع ============================ */
function openPayment(root) {
  if (!cart.size) { toast('أضف منتجات للفاتورة أولًا', 'warn'); return; }
  const t = calc();
  const cur = state.settings.currency || 'ج.م';
  const quick = String(state.settings.pos_quick_cash || '50,100,200,500').split(',').map((x) => Number(x)).filter(Boolean);
  let method = 'cash';

  const m = modal({
    title: 'إتمام الدفع',
    subtitle: `الفاتورة تحتوي ${cart.size} صنف`,
    size: 'sm',
    body: `
      <div class="pay-total-box mb-2"><span>المطلوب دفعه</span><b>${fmt.money(t.total, false)} <small style="font-size:11px;color:var(--muted)">${esc(cur)}</small></b></div>
      <div class="pay-methods mb-2">
        <button class="pay-method active" data-method="cash">${icon('cash')} نقدي</button>
        <button class="pay-method" data-method="card">${icon('card')} بطاقة</button>
        <button class="pay-method" data-method="wallet">${icon('phone')} محفظة</button>
        <button class="pay-method" data-method="credit">${icon('clock')} آجل</button>
      </div>
      <div id="pay-fields">
        <div class="field">
          <label>المبلغ المدفوع</label>
          <input class="input" id="pay-paid" type="number" step="0.01" min="0" value="${t.total}" style="height:48px;font-size:18px;font-weight:800;text-align:center" />
          <div class="quick-cash mt-1">
            ${quick.map((q) => `<button type="button" data-quick="${q}">${fmt.int(q)}</button>`).join('')}
            <button type="button" data-quick="exact">المبلغ بالضبط</button>
          </div>
        </div>
        <div class="change-box mt-2" id="change-box"><span>الباقي للعميل</span><b id="change-val">0 ${esc(cur)}</b></div>
        <div class="field mt-2"><label>ملاحظة على الفاتورة (اختياري)</label>
          <input class="input" id="pay-note" placeholder="مثال: طلب توصيل" maxlength="200" />
        </div>
      </div>
      <div id="credit-note" class="alert alert-warn hide mt-2">${icon('alert')}<span>البيع الآجل يتطلب اختيار عميل من أعلى السلة. سيُضاف المبلغ إلى مديونيته.</span></div>`,
    footer: `<button class="btn btn-secondary" data-close>إلغاء</button>
      <button class="btn btn-primary btn-lg" data-confirm style="flex:1">${icon('check')} تأكيد البيع</button>`,
    onMount: (mm) => {
      const paidInput = mm.root.querySelector('#pay-paid');
      const changeVal = mm.root.querySelector('#change-val');
      const changeBox = mm.root.querySelector('#change-box');
      const updateChange = () => {
        const paid = Number(paidInput.value) || 0;
        const change = method === 'credit' ? 0 : Math.max(0, paid - t.total);
        changeVal.textContent = `${fmt.money(change, false)} ${cur}`;
        changeBox.style.background = paid >= t.total || method !== 'cash' ? '' : 'var(--danger-soft)';
        changeBox.style.color = paid >= t.total || method !== 'cash' ? '' : 'var(--danger)';
        changeBox.querySelector('span').textContent = method === 'credit' ? 'المتبقي آجل' : paid >= t.total ? 'الباقي للعميل' : 'المبلغ غير كافٍ';
      };
      mm.root.querySelectorAll('[data-method]').forEach((btn) => btn.addEventListener('click', () => {
        method = btn.dataset.method;
        mm.root.querySelectorAll('[data-method]').forEach((b) => b.classList.toggle('active', b === btn));
        const isCredit = method === 'credit';
        mm.root.querySelector('#credit-note').classList.toggle('hide', !isCredit);
        mm.root.querySelector('#pay-fields').querySelector('.field').classList.toggle('hide', isCredit);
        paidInput.value = isCredit ? 0 : t.total;
        paidInput.disabled = isCredit;
        if (isCredit) {
          mm.root.querySelector('#pay-fields').querySelector('.quick-cash').classList.add('hide');
        } else {
          mm.root.querySelector('#pay-fields').querySelector('.quick-cash').classList.remove('hide');
        }
        updateChange();
        if (isCredit && !customerId) {
          const sel = root.querySelector('#pos-customer');
          if (sel) { sel.focus(); toast('اختر العميل للبيع الآجل', 'info'); }
        }
      }));
      mm.root.querySelectorAll('[data-quick]').forEach((btn) => btn.addEventListener('click', () => {
        if (btn.dataset.quick === 'exact') paidInput.value = t.total;
        else paidInput.value = btn.dataset.quick;
        updateChange();
      }));
      paidInput.addEventListener('input', updateChange);
      updateChange();

      mm.root.querySelector('[data-confirm]').addEventListener('click', async () => {
        if (method === 'credit' && !customerId) { toast('اختر عميلًا لإتمام البيع الآجل', 'warn'); return; }
        const paid = method === 'credit' ? Math.min(t.total, Math.max(0, Number(paidInput.value) || 0)) : Number(paidInput.value) || 0;
        if (method !== 'credit' && paid < t.total - 0.009) { toast('المبلغ المدفوع أقل من الإجمالي', 'warn'); return; }
        const btn = mm.root.querySelector('[data-confirm]');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> جارٍ الحفظ…';
        try {
          const res = await api('/sales', {
            method: 'POST',
            body: {
              items: [...cart.values()].map((i) => ({ product_id: i.product.id, qty: i.qty })),
              discount: t.discount,
              payment_method: method,
              paid,
              customer_id: customerId || null,
              note: mm.root.querySelector('#pay-note').value.trim(),
              hold_id: currentHoldId,
              branch_id: state.branchId || state.defaultBranchId,
            },
          });
          mm.close();
          cart = new Map(); discount = 0; customerId = ''; currentHoldId = null;
          await refreshProducts(root);
          showSuccess(root, res.sale, t, method);
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false;
          btn.innerHTML = `${icon('check')} تأكيد البيع`;
        }
      });
    },
  });
}

async function refreshProducts(root) {
  try {
    const res = await api('/products?limit=500');
    products = res.rows || [];
    renderProducts(root);
    renderCategories(root);
    const sel = root.querySelector('#pos-customer');
    if (sel) sel.value = '';
    renderCart(root);
    root.querySelector('.pos-cart')?.classList.remove('open');
  } catch {}
}

function showSuccess(root, sale, totals, method) {
  const cur = state.settings.currency || 'ج.م';
  const change = method === 'cash' ? Math.max(0, Number(sale.paid) - Number(sale.total)) : 0;
  const m = modal({
    size: 'sm',
    showClose: false,
    body: `<div class="sale-success">
      <div class="success-ring">${icon('check')}</div>
      <div class="success-title">تمت عملية البيع بنجاح</div>
      <div class="success-sub">تم خصم الكميات من المخزون وتحديث الخزينة</div>
      <div class="success-invoice">${icon('receipt')} <span style="direction:ltr">${esc(sale.invoice_no)}</span></div>
      <div class="success-total">${fmt.money(sale.total, false)} <small style="font-size:12px;color:var(--muted)">${esc(cur)}</small></div>
      ${change > 0 ? `<div class="change-box mt-2" style="justify-content:center;gap:8px"><span>الباقي للعميل</span><b>${fmt.money(change)}</b></div>` : ''}
      ${method === 'credit' ? `<div class="alert alert-warn mt-2" style="justify-content:center">${icon('clock')} <span>تم تسجيلها آجل على العميل</span></div>` : ''}
    </div>`,
    footer: `<button class="btn btn-secondary" data-print>${icon('printer')} طباعة الإيصال</button>
      <button class="btn btn-primary" data-new>${icon('plus')} فاتورة جديدة</button>`,
    onMount: (mm) => {
      mm.root.querySelector('[data-new]').addEventListener('click', () => {
        mm.close();
        root.querySelector('#pos-search')?.focus();
      });
      mm.root.querySelector('[data-print]').addEventListener('click', () => printReceipt(sale, state.settings));
      if (state.settings.auto_print === '1') {
        setTimeout(() => {
          if (document.body.contains(mm.root)) printReceipt(sale, state.settings);
        }, 600);
      }
    },
  });
  // إعادة تعيين السلة بعد إغلاق النجاح
  renderCart(root);
}

/* ============================ التعليق ============================ */
function holdCart(root) {
  if (!cart.size) { toast('السلة فارغة', 'warn'); return; }
  const t = calc();
  openForm({
    title: 'تعليق الفاتورة',
    subtitle: 'استرجعها لاحقًا من قائمة الفواتير المعلقة',
    size: 'sm',
    submitText: 'تعليق الفاتورة',
    fields: [{ name: 'label', label: 'اسم أو ملاحظة للفاتورة', value: customerId ? (customers.find((c) => String(c.id) === String(customerId)) || {}).name : '', placeholder: 'مثال: عميل ينتظر', span: 2 }],
    onSubmit: async (v, mm) => {
      await api('/holds', {
        method: 'POST',
        body: {
          label: v.label,
          total: t.total,
          items_count: cart.size,
          branch_id: state.branchId || state.defaultBranchId,
          payload: {
            items: [...cart.values()].map((i) => ({ product_id: i.product.id, qty: i.qty })),
            customer_id: customerId || null,
            discount: t.discount,
          },
        },
      });
      cart = new Map(); discount = 0; customerId = ''; currentHoldId = null;
      mm.close(); renderCart(root); toast('تم تعليق الفاتورة');
    },
  });
}

async function openHolds(root) {
  const res = await api('/holds');
  const rows = res.rows || [];
  const m = modal({
    title: 'الفواتير المعلقة',
    subtitle: 'اضغط على الفاتورة لاسترجاعها إلى الكاشير',
    size: 'wide',
    body: rows.length ? `<div class="table-wrap" style="border:1px solid var(--border);border-radius:12px"><table class="table" style="min-width:520px">
      <thead><tr><th>الفاتورة</th><th>الأصناف</th><th>الإجمالي</th><th>الكاشير</th><th>التاريخ</th><th></th></tr></thead>
      <tbody>${rows.map((h) => `<tr>
        <td class="cell-strong">${esc(h.label || 'فاتورة معلقة')}</td>
        <td>${fmt.int(h.items_count)}</td>
        <td class="num bolder">${fmt.money(h.total)}</td>
        <td class="muted small">${esc(h.user_name)}</td>
        <td class="small muted">${esc(fmt.datetime(h.created_at))}</td>
        <td><div class="actions">
          <button class="btn btn-sm btn-soft" data-resume="${h.id}">${icon('refresh')} استرجاع</button>
          <button class="icon-btn danger" data-delete-hold="${h.id}" title="حذف">${icon('trash')}</button>
        </div></td>
      </tr>`).join('')}</tbody></table></div>` : emptyState({ title: 'لا توجد فواتير معلقة', text: 'يمكنك تعليق أي فاتورة من زر التعليق أثناء البيع', iconName: 'pause' }),
    footer: '<button class="btn btn-secondary" data-close>إغلاق</button>',
    onMount: (mm) => {
      mm.root.querySelector('[data-close]').addEventListener('click', () => mm.close());
      mm.root.querySelectorAll('[data-resume]').forEach((btn) => btn.addEventListener('click', async () => {
        try {
          const hold = rows.find((r) => String(r.id) === btn.dataset.resume);
          const payload = JSON.parse(hold.payload || '{}');
          cart = new Map();
          for (const it of payload.items || []) {
            const prod = products.find((p) => String(p.id) === String(it.product_id));
            if (prod) cart.set(String(prod.id), { product: prod, qty: it.qty });
          }
          discount = Number(payload.discount) || 0;
          customerId = payload.customer_id ? String(payload.customer_id) : '';
          currentHoldId = hold.id;
          const sel = root.querySelector('#pos-customer');
          if (sel) sel.value = customerId;
          mm.close();
          renderCart(root);
          root.querySelector('#pos-cart')?.classList.add('open');
          toast('تم استرجاع الفاتورة — أكمل الدفع عند الجاهزية');
        } catch { toast('تعذر استرجاع الفاتورة', 'error'); }
      }));
      mm.root.querySelectorAll('[data-delete-hold]').forEach((btn) => btn.addEventListener('click', async () => {
        const yes = await confirmDialog({ title: 'حذف الفاتورة المعلقة', message: 'سيتم حذفها نهائيًا.', confirmText: 'حذف', danger: true, iconName: 'trash' });
        if (!yes) return;
        try { await api(`/holds/${btn.dataset.deleteHold}`, { method: 'DELETE' }); mm.close(); openHolds(root); toast('تم الحذف'); }
        catch (e) { toast(e.message, 'error'); }
      }));
    },
  });
}

/* ============================ عميل جديد ============================ */
function addCustomer(root) {
  openForm({
    title: 'إضافة عميل سريع',
    size: 'sm',
    fields: [
      { name: 'name', label: 'اسم العميل', required: true, span: 2, autofocus: true },
      { name: 'phone', label: 'رقم الهاتف', span: 2, ltr: true },
    ],
    onSubmit: async (v, mm) => {
      const res = await api('/customers', { method: 'POST', body: v });
      const list = await api('/customers?limit=300');
      customers = list.rows || [];
      const sel = root.querySelector('#pos-customer');
      sel.innerHTML = `<option value="">عميل نقدي</option>` + customers.map((c) => `<option value="${c.id}">${esc(c.name)}${Number(c.balance) > 0 ? ` — عليه ${fmt.num(c.balance)}` : ''}</option>`).join('');
      sel.value = res.id;
      customerId = String(res.id);
      mm.close();
      toast('تمت إضافة العميل واختياره');
    },
  });
}
