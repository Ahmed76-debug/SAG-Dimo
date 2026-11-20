/* PharmaPro – Point of sale */
(function () {
  'use strict';
  const ui = App.ui;
  const fmt = App.fmt;

  /* Cart is kept in memory so it survives navigation inside the app */
  let cart = [];
  let customer = null;
  let invoiceDiscount = 0;
  let payment = 'cash';
  let paidTouched = false;
  let heldKey = null;

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  function cartTotals() {
    const subtotal = round2(cart.reduce((s, l) => s + l.price * l.qty, 0));
    const discount = Math.min(round2(invoiceDiscount), subtotal);
    const ratio = subtotal > 0 ? (subtotal - discount) / subtotal : 0;
    const tax = round2(cart.reduce((s, l) => s + l.price * l.qty * ratio * (Number(l.tax_rate) || 0) / 100, 0));
    const total = round2(subtotal - discount + tax);
    return { subtotal, discount, tax, total, items: cart.reduce((s, l) => s + l.qty, 0) };
  }

  function holds() {
    try { return JSON.parse(localStorage.getItem('pp_pos_holds') || '[]'); } catch (_) { return []; }
  }
  function saveHolds(list) {
    localStorage.setItem('pp_pos_holds', JSON.stringify(list));
  }

  App.openShiftDialog = function (cb) {
    const m = ui.modal({
      title: 'فتح وردية جديدة',
      subtitle: 'أدخل النقدية الافتتاحية الموجودة في الدرج',
      size: 'sm',
      body: `<div class="field"><label class="label">النقدية الافتتاحية (${App.currency()})</label>
        <input class="input num" type="number" min="0" step="0.01" value="0" data-cash autofocus>
        <span class="hint">يمكنك تعديلها لاحقاً من شاشة الورديات.</span></div>`,
      footer: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-open>${App.icon('clock')} فتح الوردية</button>`,
      onMount: (h) => {
        h.el.querySelector('[data-open]').onclick = async () => {
          const btn = h.el.querySelector('[data-open]');
          btn.disabled = true;
          try {
            await App.api('/shifts/open', { method: 'POST', body: { opening_cash: Number(h.el.querySelector('[data-cash]').value) || 0 } });
            ui.toast('تم فتح الوردية بنجاح');
            m.close();
            await App.reloadNotifications();
            if (cb) cb();
          } catch (err) {
            btn.disabled = false;
            ui.toast(err.message, 'error');
          }
        };
      }
    });
    return m;
  };

  async function render(container, params) {
    let cats = [];
    let shiftData = null;
    let customers = [];
    let items = [];
    let total = 0;
    let page = 1;
    let query = params.search || '';
    let category = '';
    let loadingProducts = false;

    payment = payment || 'cash';

    container.innerHTML = `
      <div class="pos-topline">
        <span class="badge info" id="pos-shift-badge">${App.icon('clock', 12)} جارٍ فحص الوردية...</span>
        <span class="small muted" id="pos-cashier">الكاشير: ${App.esc(App.state.user.full_name)}</span>
        <span class="flex-1"></span>
        <button class="btn sm" data-holds>${App.icon('clockFast')} المعلّقة <span class="badge" id="holds-count">0</span></button>
        <button class="btn sm" data-clear-cart>${App.icon('trash')} تفريغ</button>
      </div>
      <div id="pos-alert"></div>
      <div class="pos-layout">
        <section class="pos-products">
          <div class="pos-search-bar">
            <div class="search-box" style="flex:1">
              ${App.icon('search')}
              <input class="input" id="pos-search" placeholder="امسح الباركود أو اكتب اسم الصنف / الكود..." autocomplete="off" value="${App.esc(query)}">
            </div>
            <button class="btn icon" data-scan-add title="إضافة بالباركود">${App.icon('barcode')}</button>
            <div class="pos-scan-hint">${App.icon('info', 13)} Enter لإضافة الباركود</div>
          </div>
          <div class="pos-cats" id="pos-cats"><span class="chip active">الكل</span></div>
          <div class="pos-grid" id="pos-grid"></div>
          <div class="pos-more"><button class="btn" id="pos-more" style="display:none">${App.icon('plus')} تحميل المزيد</button></div>
        </section>

        <aside class="cart">
          <div class="cart-head">
            <h3>سلة البيع</h3>
            <span class="badge primary" id="cart-count">0 صنف</span>
            <button class="btn icon sm" data-hold title="تعليق الفاتورة">${App.icon('save')}</button>
          </div>
          <div class="cart-customer">
            <div class="flex gap-2 items-center">
              <div class="flex-1">
                <select class="select sm" id="cart-customer" style="height:36px">
                  <option value="">عميل نقدي</option>
                </select>
              </div>
              ${App.can('customers.manage') ? `<button class="btn icon sm" data-new-customer title="عميل جديد">${App.icon('userPlus')}</button>` : ''}
            </div>
          </div>
          <div class="cart-items" id="cart-items"></div>
          <div class="cart-summary" id="cart-summary"></div>
          <div class="cart-pay">
            <div class="pay-methods" id="pay-methods">
              <button class="pay-method ${payment === 'cash' ? 'active' : ''}" data-pay="cash">${App.icon('banknote')}نقدي</button>
              <button class="pay-method ${payment === 'card' ? 'active' : ''}" data-pay="card">${App.icon('creditCard')}بطاقة</button>
              <button class="pay-method ${payment === 'wallet' ? 'active' : ''}" data-pay="wallet">${App.icon('smartphone')}محفظة</button>
              <button class="pay-method ${payment === 'credit' ? 'active' : ''}" data-pay="credit">${App.icon('wallet')}آجل</button>
            </div>
            <div class="paid-row">
              <input class="input num" id="invoice-discount" type="number" min="0" step="0.01" placeholder="خصم الفاتورة" value="${invoiceDiscount || ''}">
              <input class="input num" id="paid-amount" type="number" min="0" step="0.01" placeholder="المبلغ المدفوع">
            </div>
            <div class="change-box"><span>الباقي للعميل</span><b id="change-due">0.00</b></div>
            <button class="btn primary w-full" id="pos-checkout" disabled>${App.icon('circleCheck')} إتمام البيع</button>
            <div class="xsmall muted text-center mt-2">F2 بحث · Enter باركود · F4 دفع · F9 تعليق</div>
          </div>
        </aside>
      </div>`;

    const gridEl = container.querySelector('#pos-grid');
    const cartItemsEl = container.querySelector('#cart-items');
    const cartSummaryEl = container.querySelector('#cart-summary');
    const searchEl = container.querySelector('#pos-search');
    const customerEl = container.querySelector('#cart-customer');
    const paidEl = container.querySelector('#paid-amount');
    const discountEl = container.querySelector('#invoice-discount');
    const checkoutBtn = container.querySelector('#pos-checkout');
    const moreBtn = container.querySelector('#pos-more');
    const holdsCount = container.querySelector('#holds-count');

    /* ---------------- shift ---------------- */
    function paintShift() {
      const badge = container.querySelector('#pos-shift-badge');
      const alert = container.querySelector('#pos-alert');
      if (shiftData) {
        badge.className = 'badge success';
        badge.innerHTML = `${App.icon('circleCheck', 12)} وردية مفتوحة · ${fmt.time(shiftData.opened_at)} · افتتاحي ${fmt.money(shiftData.opening_cash)}`;
        alert.innerHTML = '';
      } else {
        badge.className = 'badge warning';
        badge.innerHTML = `${App.icon('alert', 12)} لا توجد وردية مفتوحة`;
        alert.innerHTML = `<div class="shift-banner">${App.icon('clock', 16)} يجب فتح وردية قبل تسجيل أي عملية بيع.
          <button class="btn sm primary" data-open-shift>${App.icon('plus', 13)} فتح وردية الآن</button></div>`;
        const b = alert.querySelector('[data-open-shift]');
        if (b) b.onclick = () => App.openShiftDialog(refreshShift);
      }
    }
    async function refreshShift() {
      try {
        const r = await App.api('/shifts/current');
        shiftData = r.shift;
      } catch (_) { shiftData = null; }
      paintShift();
    }

    /* ---------------- products ---------------- */
    function stockClass(p) {
      if (Number(p.stock) <= 0) return 'none';
      if (Number(p.stock) <= Number(p.min_stock)) return 'low';
      return '';
    }

    function paintProducts() {
      if (!items.length) {
        gridEl.innerHTML = `<div style="grid-column:1/-1">${ui.empty({ icon: 'search', title: 'لا توجد أصناف مطابقة', text: query ? `لا توجد نتائج لـ «${App.esc(query)}»` : 'أضف أصنافاً إلى المخزون أولاً.' })}</div>`;
        moreBtn.style.display = 'none';
        return;
      }
      gridEl.innerHTML = items.map((p) => {
        const out = Number(p.stock) <= 0;
        return `<button class="prod-card ${out ? 'out' : ''}" data-prod="${p.id}" ${out ? 'disabled' : ''}>
          ${p.requires_rx ? '<span class="pc-rx">RX</span>' : ''}
          <div class="pc-name">${App.esc(p.name)}</div>
          <div class="pc-sub">${App.esc([p.manufacturer, p.strength, p.form].filter(Boolean).join(' · ') || p.category_name || '')}</div>
          <div class="pc-foot">
            <span class="pc-price">${fmt.money(p.price)}</span>
            <span class="pc-stock ${stockClass(p)}">${out ? 'نفد' : fmt.qty(p.stock)}</span>
          </div>
        </button>`;
      }).join('');
      moreBtn.style.display = items.length < total ? '' : 'none';
      gridEl.querySelectorAll('[data-prod]').forEach((el) => {
        el.onclick = () => addProduct(Number(el.dataset.prod));
      });
    }

    async function loadProducts(reset) {
      if (loadingProducts) return;
      loadingProducts = true;
      if (reset) { page = 1; items = []; }
      try {
        const qs = new URLSearchParams({ page, perPage: 48, sort: 'name' });
        if (query) qs.set('search', query);
        if (category) qs.set('category', category);
        const r = await App.api('/products?' + qs.toString());
        total = r.total;
        items = reset ? r.items : items.concat(r.items);
        paintProducts();
      } catch (err) {
        gridEl.innerHTML = `<div style="grid-column:1/-1">${ui.empty({ icon: 'alert', title: 'تعذر تحميل الأصناف', text: App.esc(err.message) })}</div>`;
      } finally {
        loadingProducts = false;
      }
    }

    async function loadCats() {
      try {
        const r = await App.api('/categories');
        cats = r.items || [];
      } catch (_) { cats = []; }
      renderCats();
    }
    function renderCats() {
      const el = container.querySelector('#pos-cats');
      el.innerHTML = `<button class="chip ${!category ? 'active' : ''}" data-cat="">الكل</button>` +
        cats.map((c) => `<button class="chip ${String(category) === String(c.id) ? 'active' : ''}" data-cat="${c.id}">${App.esc(c.name)} <span class="count">${c.products_count || 0}</span></button>`).join('');
      el.querySelectorAll('[data-cat]').forEach((b) => {
        b.onclick = () => { category = b.dataset.cat; renderCats(); loadProducts(true); };
      });
    }

    async function loadCustomers() {
      try {
        const r = await App.api('/customers/options');
        customers = r.items || [];
      } catch (_) { customers = []; }
      customerEl.innerHTML = `<option value="">عميل نقدي</option>` +
        customers.map((c) => `<option value="${c.id}" ${customer && Number(customer.id) === Number(c.id) ? 'selected' : ''}>${App.esc(c.name)}${c.phone ? ' · ' + App.esc(c.phone) : ''}</option>`).join('');
      customerEl.onchange = () => {
        customer = customers.find((c) => String(c.id) === customerEl.value) || null;
      };
    }

    async function addByBarcode(term) {
      const q = String(term || '').trim();
      if (!q) return;
      try {
        const rows = await App.api('/products/lookup?q=' + encodeURIComponent(q));
        if (!rows.length) return ui.toast('لا يوجد صنف بهذا الباركود أو الاسم', 'warning');
        const exact = rows.find((p) => p.barcode === q || p.sku === q) || (rows.length === 1 ? rows[0] : null);
        if (exact) {
          addProduct(exact.id, exact);
          searchEl.value = '';
          query = '';
          searchEl.focus();
        } else {
          query = q;
          searchEl.value = q;
          loadProducts(true);
        }
      } catch (err) { ui.toast(err.message, 'error'); }
    }

    /* ---------------- cart ---------------- */
    function findLine(productId) {
      return cart.find((l) => l.product_id === productId);
    }

    async function addProduct(productId, cached) {
      let p = cached || items.find((x) => x.id === productId) || null;
      if (!p) {
        try { p = await App.api('/products/' + productId); } catch (err) { return ui.toast(err.message, 'error'); }
      }
      if (Number(p.stock) <= 0) return ui.toast('هذا الصنف غير متوفر في المخزون', 'warning');
      const line = findLine(p.id);
      if (line) {
        if (line.qty + 1 > Number(p.stock)) return ui.toast('الكمية المطلوبة تتجاوز المخزون المتاح', 'warning');
        line.qty += 1;
      } else {
        cart.push({
          product_id: p.id, name: p.name, price: Number(p.price), qty: 1,
          tax_rate: Number(p.tax_rate) || 0, stock: Number(p.stock), unit: p.unit || '', barcode: p.barcode || '',
          requires_rx: p.requires_rx
        });
      }
      renderCart();
    }

    function changeQty(productId, delta) {
      const line = findLine(productId);
      if (!line) return;
      const next = line.qty + delta;
      if (next <= 0) cart = cart.filter((l) => l.product_id !== productId);
      else if (next > line.stock) { ui.toast('الكمية المطلوبة تتجاوز المخزون المتاح', 'warning'); return; }
      else line.qty = next;
      renderCart();
    }

    function setQty(productId, value) {
      const line = findLine(productId);
      if (!line) return;
      let q = Number(value);
      if (!q || q <= 0) { cart = cart.filter((l) => l.product_id !== productId); return renderCart(); }
      if (q > line.stock) { q = line.stock; ui.toast('تم ضبط الكمية على أقصى مخزون متاح', 'warning'); }
      line.qty = q;
      renderCart();
    }

    function renderCart() {
      const t = cartTotals();
      container.querySelector('#cart-count').textContent = `${fmt.qty(t.items)} وحدة / ${cart.length} صنف`;

      if (!cart.length) {
        cartItemsEl.innerHTML = `<div class="cart-empty">${App.icon('cart', 38)}<p>السلة فارغة<br><span class="xsmall">امسح الباركود أو اضغط على صنف لإضافته</span></p></div>`;
      } else {
        cartItemsEl.innerHTML = cart.map((l) => `
          <div class="cart-item" data-line="${l.product_id}">
            <div class="ci-main">
              <div class="ci-name">${App.esc(l.name)} ${l.requires_rx ? '<span class="badge purple" style="font-size:9px;padding:0 4px">RX</span>' : ''}</div>
              <div class="ci-sub">${fmt.money(l.price)} × ${fmt.qty(l.qty)} ${App.esc(l.unit)} · متاح ${fmt.qty(l.stock)}</div>
              <div class="qty-stepper">
                <button data-dec="${l.product_id}" aria-label="تقليل">${App.icon('minus', 12)}</button>
                <input data-qty="${l.product_id}" value="${fmt.qty(l.qty)}" inputmode="decimal">
                <button data-inc="${l.product_id}" aria-label="زيادة">${App.icon('plus', 12)}</button>
              </div>
            </div>
            <div style="text-align:end">
              <div class="ci-total">${fmt.money(l.price * l.qty)}</div>
              <button class="ci-remove mt-1" data-remove="${l.product_id}" aria-label="حذف">${App.icon('trash', 14)}</button>
            </div>
          </div>`).join('');
        cartItemsEl.querySelectorAll('[data-inc]').forEach((b) => b.onclick = () => changeQty(Number(b.dataset.inc), 1));
        cartItemsEl.querySelectorAll('[data-dec]').forEach((b) => b.onclick = () => changeQty(Number(b.dataset.dec), -1));
        cartItemsEl.querySelectorAll('[data-remove]').forEach((b) => b.onclick = () => { cart = cart.filter((l) => l.product_id !== Number(b.dataset.remove)); renderCart(); });
        cartItemsEl.querySelectorAll('[data-qty]').forEach((inp) => {
          inp.onchange = () => setQty(Number(inp.dataset.qty), inp.value);
          inp.onkeydown = (e) => { if (e.key === 'Enter') inp.blur(); };
        });
      }

      cartSummaryEl.innerHTML = `
        <div class="sum-row"><span>الإجمالي الفرعي</span><span class="v">${fmt.money(t.subtotal)}</span></div>
        ${t.discount ? `<div class="sum-row discount"><span>الخصم</span><span class="v">- ${fmt.money(t.discount)}</span></div>` : ''}
        <div class="sum-row"><span>ض.ق.م</span><span class="v">${fmt.money(t.tax)}</span></div>
        <div class="sum-row total"><span>الإجمالي</span><span class="v">${fmt.money(t.total)}</span></div>`;

      checkoutBtn.disabled = !cart.length;
      checkoutBtn.innerHTML = cart.length ? `${App.icon('circleCheck')} إتمام البيع · ${fmt.money(t.total)}` : `${App.icon('cart')} السلة فارغة`;

      if (!paidTouched) {
        paidEl.value = payment === 'credit' ? '' : (cart.length ? t.total.toFixed(2) : '');
      }
      updateChange(t.total);
      holdsCount.textContent = holds().length;
    }

    function updateChange(total) {
      const paid = Number(paidEl.value) || 0;
      const change = Math.max(0, round2(paid - total));
      container.querySelector('#change-due').textContent = fmt.number(change);
    }

    /* ---------------- holds ---------------- */
    function holdCurrent() {
      if (!cart.length) return ui.toast('السلة فارغة', 'warning');
      const list = holds();
      const t = cartTotals();
      list.unshift({
        id: 'h' + Date.now(), at: new Date().toISOString(), cart: cart.map((l) => ({ ...l })),
        customer, discount: invoiceDiscount, total: t.total, items: cart.length
      });
      saveHolds(list.slice(0, 30));
      cart = []; customer = null; invoiceDiscount = 0; paidTouched = false;
      customerEl.value = '';
      discountEl.value = '';
      renderCart();
      ui.toast('تم تعليق الفاتورة، يمكنك استرجاعها لاحقاً');
    }

    function openHolds() {
      const list = holds();
      const m = ui.modal({
        title: 'الفواتير المعلّقة',
        subtitle: 'فواتير محفوظة مؤقتاً على هذا الجهاز',
        size: 'md',
        body: list.length ? list.map((h) => `
          <div class="alert-item" style="padding:12px 0">
            <div class="ai-icon" style="background:var(--accent-soft);color:var(--accent)">${App.icon('clockFast', 16)}</div>
            <div class="ai-main"><div class="ai-title">فاتورة معلّقة · ${fmt.number(h.items, 0)} صنف</div>
              <div class="ai-sub">${fmt.datetime(h.at)} · ${fmt.money(h.total)}${h.customer ? ' · ' + App.esc(h.customer.name) : ''}</div></div>
            <button class="btn sm primary" data-resume="${h.id}">استرجاع</button>
            <button class="btn sm ghost" data-del="${h.id}" style="color:var(--danger)">${App.icon('trash', 14)}</button>
          </div>`).join('') : ui.empty({ icon: 'clockFast', title: 'لا توجد فواتير معلّقة', text: 'استخدم زر التعليق لحفظ السلة مؤقتاً.' }),
        onMount: (h) => {
          h.body.querySelectorAll('[data-resume]').forEach((b) => b.onclick = () => {
            const held = holds().find((x) => x.id === b.dataset.resume);
            if (!held) return;
            cart = held.cart.map((l) => ({ ...l }));
            customer = held.customer || null;
            invoiceDiscount = held.discount || 0;
            paidTouched = false;
            discountEl.value = invoiceDiscount || '';
            customerEl.value = customer ? customer.id : '';
            saveHolds(holds().filter((x) => x.id !== held.id));
            renderCart();
            m.close();
            ui.toast('تم استرجاع الفاتورة');
          });
          h.body.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => {
            saveHolds(holds().filter((x) => x.id !== b.dataset.del));
            m.close();
            openHolds();
          });
        }
      });
    }

    /* ---------------- checkout ---------------- */
    async function checkout() {
      if (!cart.length) return;
      if (!shiftData) {
        ui.toast('افتح وردية أولاً قبل البيع', 'warning');
        return App.openShiftDialog(async () => { await refreshShift(); });
      }
      const t = cartTotals();
      const paid = paidTouched ? Number(paidEl.value) : (payment === 'credit' ? 0 : t.total);
      if (payment !== 'credit' && paid < t.total - 0.009) {
        return ui.toast('المبلغ المدفوع أقل من إجمالي الفاتورة', 'warning');
      }
      checkoutBtn.disabled = true;
      const original = checkoutBtn.innerHTML;
      checkoutBtn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px"></span> جارٍ الحفظ...`;
      try {
        const sale = await App.api('/sales', {
          method: 'POST',
          body: {
            items: cart.map((l) => ({ product_id: l.product_id, qty: l.qty, price: l.price })),
            customer_id: customer ? customer.id : null,
            discount: t.discount,
            payment_method: payment,
            paid
          }
        });
        cart = []; customer = null; invoiceDiscount = 0; paidTouched = false;
        customerEl.value = ''; discountEl.value = '';
        renderCart();
        await refreshShift();
        loadProducts(true);
        App.reloadNotifications();
        showSaleSuccess(sale);
      } catch (err) {
        ui.toast(err.message, 'error');
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = original;
      }
    }

    function showSaleSuccess(sale) {
      const m = ui.modal({
        title: 'تم إتمام البيع بنجاح',
        size: 'sm',
        body: `<div class="text-center" style="padding:8px 0 4px">
          <div style="width:68px;height:68px;border-radius:50%;display:grid;place-items:center;margin:0 auto 12px;background:var(--success-soft);color:var(--success)">${App.icon('circleCheck', 36)}</div>
          <div class="bold" style="font-size:17px">${fmt.money(sale.total)}</div>
          <div class="small muted mt-1">فاتورة <span class="ltr bold">${App.esc(sale.invoice_no)}</span> · ${fmt.statusText(sale.payment_method)}</div>
          ${Number(sale.change_due) > 0 ? `<div class="badge success mt-3" style="font-size:13px;padding:6px 14px">الباقي ${fmt.money(sale.change_due)}</div>` : ''}
        </div>`,
        footer: `<button class="btn" data-print>${App.icon('printer')} طباعة الفاتورة</button>
                 <button class="btn primary" data-new>${App.icon('plus')} فاتورة جديدة</button>`,
        onMount: (h) => {
          h.el.querySelector('[data-print]').onclick = () => App.printReceipt(sale);
          h.el.querySelector('[data-new]').onclick = () => { m.close(); searchEl.focus(); };
        }
      });
    }

    /* ---------------- events ---------------- */
    let searchTimer = null;
    searchEl.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { query = searchEl.value.trim(); loadProducts(true); }, 260);
    };
    searchEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = searchEl.value.trim();
        if (!v) return;
        const exact = items.find((p) => p.barcode === v || p.sku === v);
        if (exact) { addProduct(exact.id, exact); searchEl.value = ''; query = ''; loadProducts(true); return; }
        addByBarcode(v);
      }
    };
    container.querySelector('[data-scan-add]').onclick = () => addByBarcode(searchEl.value);
    moreBtn.onclick = () => { page += 1; loadProducts(false); };

    container.querySelectorAll('[data-pay]').forEach((b) => {
      b.onclick = () => {
        payment = b.dataset.pay;
        container.querySelectorAll('[data-pay]').forEach((x) => x.classList.toggle('active', x.dataset.pay === payment));
        paidTouched = false;
        if (payment === 'credit') { paidEl.value = ''; paidTouched = true; }
        renderCart();
      };
    });

    discountEl.oninput = () => {
      invoiceDiscount = Math.max(0, Number(discountEl.value) || 0);
      renderCart();
    };
    paidEl.oninput = () => { paidTouched = true; updateChange(cartTotals().total); };
    paidEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); checkout(); } };
    checkoutBtn.onclick = checkout;

    container.querySelector('[data-hold]').onclick = holdCurrent;
    container.querySelector('[data-holds]').onclick = openHolds;
    container.querySelector('[data-clear-cart]').onclick = async () => {
      if (!cart.length) return;
      const yes = await ui.confirm({ title: 'تفريغ السلة', message: 'هل تريد حذف جميع الأصناف من سلة البيع؟', confirmText: 'تفريغ', danger: true });
      if (yes) { cart = []; invoiceDiscount = 0; paidTouched = false; discountEl.value = ''; renderCart(); }
    };

    const newCustomerBtn = container.querySelector('[data-new-customer]');
    if (newCustomerBtn) newCustomerBtn.onclick = () => {
      const m = ui.modal({
        title: 'عميل جديد', size: 'sm',
        body: `<div class="form-grid">
          ${ui.field({ label: 'اسم العميل', name: 'name', required: true, col: 'span-2' })}
          ${ui.field({ label: 'الهاتف', name: 'phone', type: 'tel' })}
          ${ui.field({ label: 'التأمين / الجهة', name: 'insurance' })}
        </div>`,
        footer: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${App.icon('save')} حفظ</button>`,
        onMount: (h) => {
          h.el.querySelector('[data-save]').onclick = async () => {
            const f = App.formValues(h.el.querySelector('.modal-body'));
            if (!f.name) return ui.toast('اسم العميل مطلوب', 'warning');
            try {
              const c = await App.api('/customers', { method: 'POST', body: f });
              customers.push(c);
              customer = c;
              await loadCustomers();
              customerEl.value = String(c.id);
              m.close();
              ui.toast('تم إضافة العميل');
            } catch (err) { ui.toast(err.message, 'error'); }
          };
        }
      });
    };

    const keyHandler = (e) => {
      if (ui.modalStack.length) return;
      if (e.key === 'F2') { e.preventDefault(); searchEl.focus(); searchEl.select(); }
      else if (e.key === 'F4') { e.preventDefault(); checkout(); }
      else if (e.key === 'F9') { e.preventDefault(); holdCurrent(); }
    };
    document.addEventListener('keydown', keyHandler);

    /* ---------------- init ---------------- */
    renderCart();
    paintShift();
    await Promise.all([loadCats(), loadCustomers(), refreshShift()]);
    await loadProducts(true);
    if (query) {
      setTimeout(() => addByBarcode(query), 120);
    } else {
      setTimeout(() => searchEl.focus(), 60);
    }

    return () => {
      document.removeEventListener('keydown', keyHandler);
      clearTimeout(searchTimer);
      if (paidTouched) { /* preserve paid state for next visit */ }
    };
  }

  App.register('pos', {
    title: 'نقطة البيع',
    subtitle: 'كاشير سريع بالباركود مع إدارة الورديات',
    perm: 'pos.use',
    render
  });
})();
