/* PharmaPro – Customers, prescriptions, sales & returns */
(function () {
  'use strict';
  const ui = App.ui;
  const fmt = App.fmt;

  function money(v) { return fmt.money(v); }
  function methodText(m) { return fmt.statusText(m); }
  function methodIcon(m) { return App.payIcon(m); }

  function dateFilterBar(id, state, onChange) {
    return `<div class="filter-bar" id="${id}">
      <div class="flex items-center gap-2">
        <label class="small muted">من</label>
        <input class="input sm" type="date" data-from value="${state.from || ''}" style="width:145px">
        <label class="small muted">إلى</label>
        <input class="input sm" type="date" data-to value="${state.to || ''}" style="width:145px">
      </div>
      <div class="chip-row">
        <button class="chip" data-quick="today">اليوم</button>
        <button class="chip" data-quick="yesterday">أمس</button>
        <button class="chip" data-quick="7">7 أيام</button>
        <button class="chip" data-quick="30">30 يوم</button>
        <button class="chip" data-quick="month">هذا الشهر</button>
      </div>
    </div>`;
  }
  function bindDateFilter(root, state, onChange) {
    root.querySelectorAll('[data-quick]').forEach((b) => b.onclick = () => {
      const q = b.dataset.quick;
      const today = fmt.today();
      if (q === 'today') { state.from = today; state.to = today; }
      else if (q === 'yesterday') { const d = fmt.addDays(today, -1); state.from = d; state.to = d; }
      else if (q === 'month') { state.from = today.slice(0, 7) + '-01'; state.to = today; }
      else { state.from = fmt.addDays(today, -(Number(q) - 1)); state.to = today; }
      const f = root.querySelector('[data-from]'); const t = root.querySelector('[data-to]');
      if (f) f.value = state.from;
      if (t) t.value = state.to;
      onChange();
    });
    const f = root.querySelector('[data-from]'); const t = root.querySelector('[data-to]');
    if (f) f.onchange = () => { state.from = f.value; onChange(); };
    if (t) t.onchange = () => { state.to = t.value; onChange(); };
  }

  /* ================================================================== */
  /*                          SALE DETAIL                               */
  /* ================================================================== */
  function saleItemsTable(sale, { showReturned = true } = {}) {
    return ui.table({
      className: 'compact',
      columns: [
        { label: 'الصنف', render: (i) => `<div class="cell-title">${App.esc(i.name)}</div><div class="cell-sub ltr">${App.esc(i.batch_no || '')}</div>` },
        { label: 'الكمية', tdClass: 'num', render: (i) => fmt.qty(i.qty) },
        ...(showReturned ? [{ label: 'مرتجع', tdClass: 'num', render: (i) => i.returned_qty ? `<span class="text-warning">${fmt.qty(i.returned_qty)}</span>` : '—' }] : []),
        { label: 'السعر', tdClass: 'num', render: (i) => fmt.money(i.price) },
        { label: 'الخصم', tdClass: 'num', render: (i) => fmt.money(i.discount) },
        { label: 'الإجمالي', tdClass: 'num', render: (i) => `<b>${fmt.money(i.total)}</b>` }
      ],
      rows: sale.items
    });
  }

  App.openSaleModal = async function (id, onChange) {
    let sale;
    try { sale = await App.api('/sales/' + id); } catch (err) { return ui.toast(err.message, 'error'); }
    const remainingQty = sale.items.reduce((s, i) => s + Math.max(0, Number(i.qty) - Number(i.returned_qty || 0)), 0);
    const m = ui.modal({
      title: 'فاتورة بيع ' + sale.invoice_no,
      subtitle: `${fmt.datetime(sale.date)} · ${App.esc(sale.cashier_name || '')}`,
      size: 'lg',
      body: `
        <div class="kpi-strip">
          <div class="item"><div class="label">الإجمالي</div><div class="value">${money(sale.total)}</div></div>
          <div class="item"><div class="label">المدفوع</div><div class="value text-success">${money(sale.paid)}</div></div>
          <div class="item"><div class="label">المتبقي</div><div class="value text-warning">${money(Math.max(0, sale.total - sale.paid))}</div></div>
          <div class="item"><div class="label">الحالة</div><div class="value" style="font-size:13px">${App.badge(sale.status)}</div></div>
        </div>
        <div class="equal-grid mb-4">
          <div>
            <div class="info-row"><span class="k">العميل</span><span class="v">${App.esc(sale.customer_name || 'عميل نقدي')}${sale.customer_phone ? ` · <span class="ltr">${App.esc(sale.customer_phone)}</span>` : ''}</span></div>
            <div class="info-row"><span class="k">طريقة الدفع</span><span class="v">${App.icon(methodIcon(sale.payment_method), 14)} ${App.esc(methodText(sale.payment_method))}</span></div>
            <div class="info-row"><span class="k">الكاشير</span><span class="v">${App.esc(sale.cashier_name || '—')}</span></div>
          </div>
          <div>
            <div class="info-row"><span class="k">الإجمالي الفرعي</span><span class="v">${money(sale.subtotal)}</span></div>
            <div class="info-row"><span class="k">الخصم</span><span class="v">${money(sale.discount)}</span></div>
            <div class="info-row"><span class="k">ض.ق.م</span><span class="v">${money(sale.tax)}</span></div>
            <div class="info-row"><span class="k">الباقي للعميل</span><span class="v">${money(sale.change_due)}</span></div>
          </div>
        </div>
        ${saleItemsTable(sale)}
        ${sale.returns && sale.returns.length ? `<hr class="hr"><h4 class="mb-3" style="font-size:13px">${App.icon('rotate', 15)} المرتجعات على هذه الفاتورة</h4>
          ${ui.table({ className: 'compact', columns: [
            { label: 'المرتجع', render: (r) => `<span class="ltr">${App.esc(r.return_no)}</span>` },
            { label: 'التاريخ', render: (r) => fmt.datetime(r.date) },
            { label: 'القيمة', tdClass: 'num', render: (r) => money(r.total) },
            { label: 'طريقة الرد', render: (r) => App.esc(methodText(r.refund_method)) },
            { label: 'السبب', render: (r) => `<span class="small muted">${App.esc(r.reason || '—')}</span>` }
          ], rows: sale.returns })}` : ''}
        ${sale.notes ? `<div class="card card-pad mt-3" style="background:var(--panel-2);font-size:12px">${App.esc(sale.notes)}</div>` : ''}`,
      footer: `
        <button class="btn" data-print>${App.icon('printer')} طباعة</button>
        ${App.can('returns.manage') && remainingQty > 0 && sale.status !== 'void' ? `<button class="btn warning" data-return>${App.icon('rotate')} مرتجع</button>` : ''}
        ${App.can('sales.manage') && sale.status !== 'void' && sale.status !== 'returned' ? `<button class="btn danger" data-void>${App.icon('circleX')} إلغاء الفاتورة</button>` : ''}
        <button class="btn primary" data-close>إغلاق</button>`,
      onMount: (h) => {
        h.el.querySelector('[data-print]').onclick = () => App.printReceipt(sale);
        const rbtn = h.el.querySelector('[data-return]');
        if (rbtn) rbtn.onclick = () => { m.close(); openReturnModal(sale, onChange); };
        const vbtn = h.el.querySelector('[data-void]');
        if (vbtn) vbtn.onclick = async () => {
          const yes = await ui.confirm({
            title: 'إلغاء الفاتورة', danger: true, confirmText: 'إلغاء الفاتورة',
            message: `سيتم إرجاع الأصناف إلى المخزون وعكس القيود المحاسبية للفاتورة <b class="ltr">${App.esc(sale.invoice_no)}</b>. لا يمكن التراجع عن هذه العملية.`
          });
          if (!yes) return;
          try {
            await App.api(`/sales/${sale.id}/void`, { method: 'POST', body: {} });
            ui.toast('تم إلغاء الفاتورة وعكس القيود');
            m.close();
            App.reloadNotifications();
            if (onChange) onChange();
          } catch (err) { ui.toast(err.message, 'error'); }
        };
      }
    });
  };

  function openReturnModal(sale, onChange) {
    const rows = sale.items.map((i) => ({ ...i, return_qty: 0, available: Math.max(0, Number(i.qty) - Number(i.returned_qty || 0)) }));
    const m = ui.modal({
      title: 'مرتجع مبيعات',
      subtitle: `فاتورة ${sale.invoice_no} · ${App.esc(sale.customer_name || 'عميل نقدي')}`,
      size: 'lg',
      body: `
        <div class="shift-banner" style="background:var(--warning-soft);color:var(--warning)">${App.icon('info', 15)} حدد الكميات المرتجعة. سيتم إرجاعها إلى نفس دفعات الصرف تلقائياً.</div>
        <div class="form-grid mb-4">
          ${ui.field({ label: 'طريقة رد المبلغ', name: 'refund_method', type: 'select', value: 'cash', options: [
            { value: 'cash', label: 'نقدي من الصندوق' },
            { value: 'card', label: 'إلى البطاقة / البنك' },
            { value: 'credit', label: 'خصم من حساب العميل (آجل)' }
          ] })}
          ${ui.field({ label: 'سبب الإرجاع', name: 'reason', placeholder: 'خطأ في الصرف / طلب العميل / تالف' })}
        </div>
        ${ui.table({
          columns: [
            { label: 'الصنف', render: (i) => `<div class="cell-title">${App.esc(i.name)}</div><div class="cell-sub ltr">${App.esc(i.batch_no || '')}</div>` },
            { label: 'المشتراة', tdClass: 'num', render: (i) => fmt.qty(i.qty) },
            { label: 'مرتجع سابقاً', tdClass: 'num', render: (i) => fmt.qty(i.returned_qty || 0) },
            { label: 'سعر الوحدة', tdClass: 'num', render: (i) => money(i.price) },
            { label: 'كمية الإرجاع', render: (i) => i.available > 0
              ? `<input class="input sm num" data-ret="${i.product_id}" type="number" min="0" max="${i.available}" step="0.01" value="0" style="width:95px">`
              : '<span class="badge">لا يوجد متاح</span>' }
          ],
          rows: sale.items.map((i) => ({ ...i, available: Math.max(0, Number(i.qty) - Number(i.returned_qty || 0)) }))
        })}
        <div class="xsmall muted mt-2">لا يمكن إرجاع أكثر من الكمية المتاحة. يتم احتساب الضريبة المستردة تناسبياً.</div>`,
      footer: `<button class="btn" data-close>إلغاء</button><button class="btn warning" data-save>${App.icon('rotate')} تنفيذ المرتجع</button>`,
      onMount: (h) => {
        h.el.querySelector('[data-save]').onclick = async () => {
          const method = h.el.querySelector('[name=refund_method]').value;
          const reason = h.el.querySelector('[name=reason]').value;
          const items = [...h.el.querySelectorAll('[data-ret]')]
            .map((inp) => ({ product_id: Number(inp.dataset.ret), qty: Number(inp.value) || 0 }))
            .filter((x) => x.qty > 0);
          if (!items.length) return ui.toast('حدد كمية صنف واحد على الأقل', 'warning');
          try {
            const ret = await App.api(`/sales/${sale.id}/return`, { method: 'POST', body: { items, refund_method: method, reason } });
            ui.toast(`تم تسجيل المرتجع ${ret.return_no}`);
            m.close();
            App.reloadNotifications();
            if (onChange) onChange();
          } catch (err) { ui.toast(err.message, 'error'); }
        };
      }
    });
  }

  /* ================================================================== */
  /*                          CUSTOMERS                                */
  /* ================================================================== */
  async function customerOptions() {
    try { const r = await App.api('/customers/options'); return r.items || []; } catch (_) { return []; }
  }

  function customerFormModal(customer, onDone) {
    const c = customer || {};
    const m = ui.modal({
      title: customer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد',
      subtitle: 'بيانات العميل ونقاط الولاء وحساب الآجل',
      size: 'md',
      body: `<div class="form-grid">
        ${ui.field({ label: 'اسم العميل', name: 'name', value: c.name || '', required: true, col: 'span-2' })}
        ${ui.field({ label: 'الهاتف', name: 'phone', value: c.phone || '', type: 'tel' })}
        ${ui.field({ label: 'البريد الإلكتروني', name: 'email', value: c.email || '', type: 'email' })}
        ${ui.field({ label: 'شركة التأمين / الجهة', name: 'insurance', value: c.insurance || '', placeholder: 'تكافل / مصر للتأمين...' })}
        ${ui.field({ label: 'نقاط الولاء', name: 'loyalty_points', value: c.loyalty_points || 0, type: 'number', min: 0, step: '1' })}
        ${ui.field({ label: 'العنوان', name: 'address', value: c.address || '', col: 'span-2' })}
        ${ui.field({ label: 'رصيد افتتاحي (آجل)', name: 'opening_balance', value: c.opening_balance || 0, type: 'number', step: '0.01' })}
        ${ui.field({ label: 'نشط', name: 'active', type: 'switch', value: customer ? !!c.active : true, hint: 'يظهر في الكاشير' })}
        ${ui.field({ label: 'ملاحظات', name: 'notes', value: c.notes || '', type: 'textarea', col: 'span-2', rows: 2 })}
      </div>`,
      footer: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${App.icon('save')} حفظ</button>`,
      onMount: (h) => {
        h.el.querySelector('[data-save]').onclick = async () => {
          const form = h.el.querySelector('.modal-body');
          const v = App.formValues(form);
          v.active = form.querySelector('[name=active]').checked ? 1 : 0;
          v.opening_balance = Number(v.opening_balance) || 0;
          v.loyalty_points = Number(v.loyalty_points) || 0;
          if (!v.name) return ui.toast('اسم العميل مطلوب', 'warning');
          try {
            if (customer) await App.api('/customers/' + customer.id, { method: 'PUT', body: v });
            else await App.api('/customers', { method: 'POST', body: v });
            ui.toast('تم حفظ بيانات العميل');
            m.close();
            if (onDone) onDone();
          } catch (err) { ui.toast(err.message, 'error'); }
        };
      }
    });
  }

  async function openCustomerDetail(id, onChange) {
    let r;
    try { r = await App.api(`/customers/${id}/statement`); } catch (err) { return ui.toast(err.message, 'error'); }
    const c = r.customer;
    const body = `
      <div class="flex items-center gap-3 mb-4">
        <div class="avatar" style="width:48px;height:48px;font-size:17px;background:var(--primary)">${App.esc((c.name || '؟').charAt(0))}</div>
        <div><div class="bold" style="font-size:16px">${App.esc(c.name)}</div>
          <div class="small muted">${App.esc([c.phone, c.insurance].filter(Boolean).join(' · ') || 'عميل')}</div></div>
        <div style="margin-inline-start:auto">${c.active ? '<span class="badge success">نشط</span>' : '<span class="badge">موقوف</span>'}</div>
      </div>
      <div class="kpi-strip">
        <div class="item"><div class="label">عدد الفواتير</div><div class="value">${fmt.number(r.sales.length, 0)}</div></div>
        <div class="item"><div class="label">إجمالي المشتريات</div><div class="value">${money(r.sales.reduce((s, x) => s + Number(x.total), 0))}</div></div>
        <div class="item"><div class="label">نقاط الولاء</div><div class="value">${fmt.number(c.loyalty_points, 0)}</div></div>
        <div class="item"><div class="label">الرصيد المستحق</div><div class="value text-warning">${money(c.opening_balance + r.sales.reduce((s, x) => s + Math.max(0, x.total - x.paid), 0))}</div></div>
      </div>
      <div class="info-row"><span class="k">الهاتف</span><span class="v ltr">${App.esc(c.phone || '—')}</span></div>
      <div class="info-row"><span class="k">البريد</span><span class="v">${App.esc(c.email || '—')}</span></div>
      <div class="info-row"><span class="k">التأمين</span><span class="v">${App.esc(c.insurance || '—')}</span></div>
      <div class="info-row"><span class="k">العنوان</span><span class="v">${App.esc(c.address || '—')}</span></div>
      ${c.notes ? `<div class="card card-pad mt-3" style="background:var(--panel-2);font-size:12px">${App.esc(c.notes)}</div>` : ''}
      <hr class="hr">
      <h4 class="mb-3" style="font-size:13px">${App.icon('receipt', 15)} آخر الفواتير</h4>
      ${r.sales.length ? ui.table({
        className: 'compact',
        columns: [
          { label: 'الفاتورة', render: (s) => `<span class="ltr">${App.esc(s.invoice_no)}</span>` },
          { label: 'التاريخ', render: (s) => fmt.datetime(s.date) },
          { label: 'الإجمالي', tdClass: 'num', render: (s) => money(s.total) },
          { label: 'المتبقي', tdClass: 'num', render: (s) => Math.max(0, s.total - s.paid) > 0.009 ? `<span class="text-warning">${money(s.total - s.paid)}</span>` : '—' },
          { label: 'الحالة', render: (s) => App.badge(s.status) }
        ],
        rows: r.sales.slice(0, 10)
      }) : ui.empty({ icon: 'receipt', title: 'لا توجد فواتير' })}
      ${r.returns.length ? `<h4 class="mb-3 mt-4" style="font-size:13px">${App.icon('rotate', 15)} المرتجعات</h4>
      ${ui.table({ className: 'compact', columns: [
        { label: 'المرتجع', render: (x) => `<span class="ltr">${App.esc(x.return_no)}</span>` },
        { label: 'الفاتورة', render: (x) => `<span class="ltr small">${App.esc(x.invoice_no || '')}</span>` },
        { label: 'التاريخ', render: (x) => fmt.date(x.date) },
        { label: 'القيمة', tdClass: 'num', render: (x) => money(x.total) }
      ], rows: r.returns })}` : ''}`;
    const d = ui.drawer({ title: 'حساب العميل', width: 640, body });
    const head = d.el.querySelector('.drawer-head');
    const actions = document.createElement('div');
    actions.className = 'flex gap-1';
    actions.style.marginInlineStart = 'auto';
    actions.innerHTML = `${App.can('customers.manage') ? `<button class="btn icon sm" data-edit>${App.icon('edit', 15)}</button>` : ''}`;
    head.insertBefore(actions, head.querySelector('[data-close]'));
    const edit = actions.querySelector('[data-edit]');
    if (edit) edit.onclick = () => customerFormModal(c, () => { d.close(); if (onChange) onChange(); });
  }

  async function renderCustomers(container, params) {
    const state = { search: '', page: 1 };
    container.innerHTML = `
      ${ui.pageHead({
        title: 'العملاء',
        subtitle: 'ملفات العملاء، التأمين، نقاط الولاء والأرصدة',
        actions: `${App.can('customers.manage') ? `<button class="btn primary" data-new>${App.icon('userPlus')} عميل جديد</button>` : ''}`
      })}
      <div class="card">
        <div class="toolbar">
          <div class="search-box" style="flex:1;max-width:380px">${App.icon('search')}
            <input class="input" id="c-search" placeholder="بحث بالاسم أو الهاتف أو البريد...">
          </div>
          <label class="check" style="font-size:12.5px"><input type="checkbox" id="c-all"> عرض الموقوفين</label>
          <button class="btn icon" data-reload>${App.icon('refresh')}</button>
        </div>
        <div id="c-table"><div class="loading-block"><span class="spinner"></span> جارٍ التحميل...</div></div>
      </div>`;

    const tableEl = container.querySelector('#c-table');
    async function load() {
      const qs = new URLSearchParams();
      if (state.search) qs.set('search', state.search);
      if (container.querySelector('#c-all').checked) qs.set('active', 'all');
      try {
        const r = await App.api('/customers?' + qs.toString());
        tableEl.innerHTML = ui.table({
          columns: [
            { label: 'العميل', render: (c) => `<div class="main-cell"><div class="avatar sm">${App.esc((c.name || '؟').charAt(0))}</div>
              <div><div class="cell-title">${App.esc(c.name)} ${!c.active ? '<span class="badge">موقوف</span>' : ''}</div>
              <div class="cell-sub ltr">${App.esc(c.phone || '')}</div></div></div>` },
            { label: 'التأمين', render: (c) => `<span class="small">${App.esc(c.insurance || '—')}</span>` },
            { label: 'الفواتير', tdClass: 'num', render: (c) => fmt.number(c.invoices, 0) },
            { label: 'إجمالي المشتريات', tdClass: 'num', render: (c) => money(c.total_spent) },
            { label: 'الرصيد', tdClass: 'num', render: (c) => Number(c.balance) > 0.009 ? `<b class="text-warning">${money(c.balance)}</b>` : '<span class="muted">—</span>' },
            { label: 'نقاط', tdClass: 'num', render: (c) => fmt.number(c.loyalty_points, 0) },
            { label: 'آخر زيارة', render: (c) => c.last_visit ? `<span class="small">${fmt.date(c.last_visit)}</span>` : '<span class="muted">—</span>' },
            { label: '', tdClass: 'actions', render: (c) => `<button class="btn icon sm" data-view="${c.id}" title="الحساب">${App.icon('eye', 14)}</button>
              ${App.can('customers.manage') ? `<button class="btn icon sm" data-edit="${c.id}" title="تعديل">${App.icon('edit', 14)}</button>` : ''}` }
          ],
          rows: r.items,
          empty: ui.empty({ icon: 'users', title: 'لا يوجد عملاء', text: 'أضف عميلاً جديداً لبدء تتبع المبيعات والولاء.' })
        });
        tableEl.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => openCustomerDetail(Number(b.dataset.view), load));
        tableEl.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => {
          const c = r.items.find((x) => String(x.id) === b.dataset.edit);
          customerFormModal(c, load);
        });
      } catch (err) {
        tableEl.innerHTML = `<div class="card-pad">${ui.empty({ icon: 'alert', title: 'تعذر تحميل العملاء', text: App.esc(err.message) })}</div>`;
      }
    }

    let t = null;
    container.querySelector('#c-search').oninput = (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.search = e.target.value.trim(); load(); }, 280);
    };
    container.querySelector('#c-all').onchange = load;
    container.querySelector('[data-reload]').onclick = load;
    const newBtn = container.querySelector('[data-new]');
    if (newBtn) newBtn.onclick = () => customerFormModal(null, load);

    await load();
    if (params.new && App.can('customers.manage')) setTimeout(() => customerFormModal(null, load), 80);
  }

  /* ================================================================== */
  /*                          SALES LIST                                */
  /* ================================================================== */
  async function renderSales(container, params) {
    const state = {
      from: fmt.addDays(fmt.today(), -30), to: fmt.today(), status: '', method: '',
      search: '', page: 1, customer: params.customer ? String(params.customer) : ''
    };
    container.innerHTML = `
      ${ui.pageHead({
        title: 'المبيعات والفواتير',
        subtitle: 'سجل كامل للفواتير مع الطباعة والمرتجعات والإلغاء',
        actions: `<button class="btn" data-export-excel>${App.icon('download')} Excel</button>
          <button class="btn" data-export-pdf>${App.icon('file')} PDF</button>
          ${App.can('pos.use') ? `<button class="btn primary" onclick="App.go('pos')">${App.icon('cart')} بيع جديد</button>` : ''}`
      })}
      <div class="card">
        ${dateFilterBar('sale-dates', state, () => { state.page = 1; load(); })}
        <div class="toolbar" style="border-top:1px solid var(--border)">
          <div class="search-box" style="flex:1;max-width:330px">${App.icon('search')}
            <input class="input" id="s-search" placeholder="رقم الفاتورة أو العميل أو الهاتف...">
          </div>
          <select class="select" id="s-status" style="width:150px">
            <option value="">كل الحالات</option>
            <option value="completed">مكتملة</option>
            <option value="partially_returned">مرتجع جزئي</option>
            <option value="returned">مرتجعة</option>
            <option value="void">ملغاة</option>
          </select>
          <select class="select" id="s-method" style="width:150px">
            <option value="">كل طرق الدفع</option>
            <option value="cash">نقدي</option>
            <option value="card">بطاقة</option>
            <option value="wallet">محفظة</option>
            <option value="credit">آجل</option>
          </select>
          <button class="btn icon" data-reload>${App.icon('refresh')}</button>
        </div>
        <div id="s-table"><div class="loading-block"><span class="spinner"></span> جارٍ التحميل...</div></div>
      </div>`;

    const tableEl = container.querySelector('#s-table');
    bindDateFilter(container.querySelector('#sale-dates'), state, () => { state.page = 1; load(); });

    let lastItems = [];
    async function load() {
      const qs = new URLSearchParams({ page: state.page, perPage: 25, from: state.from, to: state.to });
      if (state.status) qs.set('status', state.status);
      if (state.method) qs.set('method', state.method);
      if (state.search) qs.set('search', state.search);
      if (state.customer) qs.set('customer', state.customer);
      try {
        const r = await App.api('/sales?' + qs.toString());
        lastItems = r.items;
        tableEl.innerHTML = ui.table({
          columns: [
            { label: 'الفاتورة', render: (s) => `<div class="cell-title ltr">${App.esc(s.invoice_no)}</div><div class="cell-sub">${fmt.datetime(s.date)}</div>` },
            { label: 'العميل', render: (s) => `<div class="cell-title">${App.esc(s.customer_name || 'عميل نقدي')}</div><div class="cell-sub">${s.items_count} صنف</div>` },
            { label: 'الكاشير', render: (s) => `<span class="small">${App.esc(s.cashier_name || '—')}</span>` },
            { label: 'الدفع', render: (s) => `<span class="small">${App.icon(methodIcon(s.payment_method), 13)} ${App.esc(methodText(s.payment_method))}</span>` },
            { label: 'الإجمالي', tdClass: 'num', render: (s) => `<b>${money(s.total)}</b>` },
            { label: 'المتبقي', tdClass: 'num', render: (s) => Math.max(0, s.total - s.paid) > 0.009 ? `<span class="text-warning">${money(s.total - s.paid)}</span>` : '—' },
            { label: 'الحالة', render: (s) => App.badge(s.status) },
            { label: '', tdClass: 'actions', render: (s) => `<button class="btn icon sm" data-view="${s.id}" title="عرض">${App.icon('eye', 14)}</button>
              <button class="btn icon sm" data-print="${s.id}" title="طباعة">${App.icon('printer', 14)}</button>
              ${App.can('returns.manage') && s.status !== 'returned' && s.status !== 'void' ? `<button class="btn icon sm" data-return="${s.id}" title="مرتجع" style="color:var(--warning)">${App.icon('rotate', 14)}</button>` : ''}` }
          ],
          rows: r.items,
          empty: ui.empty({ icon: 'receipt', title: 'لا توجد فواتير في الفترة المحددة', text: 'جرّب توسيع نطاق التاريخ أو تغيير الفلاتر.' })
        }) + ui.pager(r);
        ui.bindPager(tableEl, (p) => { state.page = p; load(); });
        tableEl.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => App.openSaleModal(Number(b.dataset.view), load));
        tableEl.querySelectorAll('[data-print]').forEach((b) => b.onclick = async () => {
          try { App.printReceipt(await App.api('/sales/' + b.dataset.print)); } catch (err) { ui.toast(err.message, 'error'); }
        });
        tableEl.querySelectorAll('[data-return]').forEach((b) => b.onclick = async () => {
          try { openReturnModal(await App.api('/sales/' + b.dataset.return), load); } catch (err) { ui.toast(err.message, 'error'); }
        });
      } catch (err) {
        tableEl.innerHTML = `<div class="card-pad">${ui.empty({ icon: 'alert', title: 'تعذر تحميل المبيعات', text: App.esc(err.message) })}</div>`;
      }
    }

    let t = null;
    container.querySelector('#s-search').oninput = (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 280);
    };
    container.querySelector('#s-status').onchange = (e) => { state.status = e.target.value; state.page = 1; load(); };
    container.querySelector('#s-method').onchange = (e) => { state.method = e.target.value; state.page = 1; load(); };
    container.querySelector('[data-reload]').onclick = load;
    const exBtn = container.querySelector('[data-export-excel]');
    const pdfBtn = container.querySelector('[data-export-pdf]');
    if (exBtn) exBtn.onclick = () => {
      App.exportExcel('sales-' + fmt.today(), ['الفاتورة', 'التاريخ', 'العميل', 'الكاشير', 'طريقة الدفع', 'الإجمالي', 'المدفوع', 'الحالة'], lastItems.map((s) => [s.invoice_no, s.date, s.customer_name || 'عميل نقدي', s.cashier_name || '', methodText(s.payment_method), s.total, s.paid, fmt.statusText(s.status)]));
    };
    if (pdfBtn) pdfBtn.onclick = () => {
      App.exportPDF('المبيعات', ['الفاتورة', 'التاريخ', 'العميل', 'الكاشير', 'طريقة الدفع', 'الإجمالي', 'المدفوع', 'الحالة'], lastItems.map((s) => [s.invoice_no, s.date, s.customer_name || 'عميل نقدي', s.cashier_name || '', methodText(s.payment_method), s.total, s.paid, fmt.statusText(s.status)]));
    };
    await load();
  }

  /* ================================================================== */
  /*                          RETURNS LIST                              */
  /* ================================================================== */
  function printReturn(r) {
    const rows = r.items.map((i) => `<tr><td>${App.esc(i.name)}</td><td class="num">${fmt.qty(i.qty)}</td>
      <td class="num">${fmt.money(i.price)}</td><td class="num">${fmt.money(i.total)}</td></tr>`).join('');
    App.printA4('إيصال مرتجع ' + r.return_no, `
      <h1>${r.type === 'sale' ? 'إيصال مرتجع مبيعات' : 'إيصال مرتجع مشتريات'}</h1>
      <div class="small">رقم المرتجع: ${App.esc(r.return_no)} · التاريخ: ${fmt.datetime(r.date)}</div>
      <div class="small">المرجع: ${App.esc(r.sale_invoice || r.purchase_invoice || '—')} · ${r.type === 'sale' ? 'العميل' : 'المورد'}: ${App.esc(r.customer_name || r.supplier_name || '—')}</div>
      <div class="small">طريقة الرد: ${App.esc(methodText(r.refund_method))} · السبب: ${App.esc(r.reason || '—')}</div>
      <table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals"><div class="row grand"><span>إجمالي المرتجع</span><b>${fmt.money(r.total)}</b></div></div>`);
  }

  async function openReturnDetail(id) {
    let r;
    try { r = await App.api('/returns/' + id); } catch (err) { return ui.toast(err.message, 'error'); }
    const m = ui.modal({
      title: 'مرتجع ' + r.return_no,
      subtitle: `${r.type === 'sale' ? 'مرتجع مبيعات' : 'مرتجع مشتريات'} · ${fmt.datetime(r.date)}`,
      size: 'md',
      body: `
        <div class="kpi-strip">
          <div class="item"><div class="label">القيمة</div><div class="value">${money(r.total)}</div></div>
          <div class="item"><div class="label">طريقة الرد</div><div class="value" style="font-size:13px">${App.esc(methodText(r.refund_method))}</div></div>
          <div class="item"><div class="label">الفاتورة الأصلية</div><div class="value ltr" style="font-size:13px">${App.esc(r.sale_invoice || r.purchase_invoice || '—')}</div></div>
          <div class="item"><div class="label">المستخدم</div><div class="value" style="font-size:13px">${App.esc(r.user_name || '—')}</div></div>
        </div>
        <div class="info-row"><span class="k">${r.type === 'sale' ? 'العميل' : 'المورد'}</span><span class="v">${App.esc(r.customer_name || r.supplier_name || '—')}</span></div>
        <div class="info-row"><span class="k">السبب</span><span class="v">${App.esc(r.reason || '—')}</span></div>
        ${ui.table({
          className: 'compact',
          columns: [
            { label: 'الصنف', render: (i) => App.esc(i.name || '—') },
            { label: 'الكمية', tdClass: 'num', render: (i) => fmt.qty(i.qty) },
            { label: 'السعر', tdClass: 'num', render: (i) => money(i.price) },
            { label: 'الإجمالي', tdClass: 'num', render: (i) => `<b>${money(i.total)}</b>` }
          ],
          rows: r.items
        })}`,
      footer: `<button class="btn" data-print>${App.icon('printer')} طباعة الإيصال</button><button class="btn primary" data-close>إغلاق</button>`,
      onMount: (h) => { h.el.querySelector('[data-print]').onclick = () => printReturn(r); }
    });
  }

  async function renderReturns(container) {
    const state = { from: fmt.addDays(fmt.today(), -90), to: fmt.today(), type: '', page: 1 };
    container.innerHTML = `
      ${ui.pageHead({ title: 'المرتجعات', subtitle: 'مرتجعات المبيعات والمشتريات وطرق رد المبالغ' })}
      <div class="card">
        ${dateFilterBar('ret-dates', state, () => { state.page = 1; load(); })}
        <div class="toolbar" style="border-top:1px solid var(--border)">
          <select class="select" id="r-type" style="width:170px">
            <option value="">كل الأنواع</option>
            <option value="sale">مرتجع مبيعات</option>
            <option value="purchase">مرتجع مشتريات</option>
          </select>
          <span class="flex-1"></span>
          <button class="btn icon" data-reload>${App.icon('refresh')}</button>
        </div>
        <div id="r-table"><div class="loading-block"><span class="spinner"></span> جارٍ التحميل...</div></div>
      </div>`;
    const tableEl = container.querySelector('#r-table');
    bindDateFilter(container.querySelector('#ret-dates'), state, () => { state.page = 1; load(); });

    async function load() {
      const qs = new URLSearchParams({ page: state.page, perPage: 25, from: state.from, to: state.to });
      if (state.type) qs.set('type', state.type);
      try {
        const r = await App.api('/returns?' + qs.toString());
        tableEl.innerHTML = ui.table({
          columns: [
            { label: 'المرتجع', render: (x) => `<div class="cell-title ltr">${App.esc(x.return_no)}</div><div class="cell-sub">${fmt.datetime(x.date)}</div>` },
            { label: 'النوع', render: (x) => `<span class="badge ${x.type === 'sale' ? 'warning' : 'info'}">${x.type === 'sale' ? 'مرتجع بيع' : 'مرتجع شراء'}</span>` },
            { label: 'الطرف', render: (x) => `<div>${App.esc(x.customer_name || x.supplier_name || '—')}</div><div class="cell-sub ltr">${App.esc(x.ref_invoice || '')}</div>` },
            { label: 'طريقة الرد', render: (x) => App.esc(methodText(x.refund_method)) },
            { label: 'الأصناف', tdClass: 'num', render: (x) => fmt.number(x.items_count, 0) },
            { label: 'القيمة', tdClass: 'num', render: (x) => `<b>${money(x.total)}</b>` },
            { label: '', tdClass: 'actions', render: (x) => `<button class="btn icon sm" data-view="${x.id}">${App.icon('eye', 14)}</button>` }
          ],
          rows: r.items,
          empty: ui.empty({ icon: 'rotate', title: 'لا توجد مرتجعات', text: 'يمكن إنشاء مرتجع من شاشة الفاتورة أو فاتورة الشراء.' })
        }) + ui.pager(r);
        ui.bindPager(tableEl, (p) => { state.page = p; load(); });
        tableEl.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => openReturnDetail(Number(b.dataset.view)));
      } catch (err) {
        tableEl.innerHTML = `<div class="card-pad">${ui.empty({ icon: 'alert', title: 'تعذر تحميل المرتجعات', text: App.esc(err.message) })}</div>`;
      }
    }
    container.querySelector('#r-type').onchange = (e) => { state.type = e.target.value; state.page = 1; load(); };
    container.querySelector('[data-reload]').onclick = load;
    await load();
  }

  /* ================================================================== */
  /*                        PRESCRIPTIONS                               */
  /* ================================================================== */
  async function openPrescriptionForm(id, onDone) {
    let rx = null;
    if (id) {
      try { rx = await App.api('/prescriptions/' + id); } catch (err) { return ui.toast(err.message, 'error'); }
    }
    const customers = await customerOptions();
    const r = rx || {};
    const items = (rx && rx.items ? rx.items : [{ name: '', dosage: '', qty: 1, dispensed: 0 }]).map((i) => ({ ...i }));
    let itemRows = items.length ? items : [{ name: '', dosage: '', qty: 1, dispensed: 0 }];

    const m = ui.modal({
      title: rx ? 'تعديل روشتة' : 'روشتة طبية جديدة',
      subtitle: rx ? rx.rx_no : 'تسجيل بيانات المريض والطبيب والأدوية الموصوفة',
      size: 'lg',
      body: `
        <div class="form-grid three mb-4">
          ${ui.field({ label: 'اسم المريض', name: 'patient_name', value: r.patient_name || '', required: true })}
          ${ui.field({ label: 'العميل المسجل', name: 'customer_id', type: 'select', value: r.customer_id || '', options: [{ value: '', label: 'بدون ربط' }].concat(customers.map((c) => ({ value: c.id, label: c.name }))) })}
          ${ui.field({ label: 'اسم الطبيب', name: 'doctor_name', value: r.doctor_name || '' })}
          ${ui.field({ label: 'هاتف الطبيب', name: 'doctor_phone', value: r.doctor_phone || '', type: 'tel' })}
          ${ui.field({ label: 'تاريخ الروشتة', name: 'date', type: 'date', value: (r.date || fmt.today()).slice(0, 10) })}
          ${ui.field({ label: 'الحالة', name: 'status', type: 'select', value: r.status || 'pending', options: [
            { value: 'pending', label: 'قيد الانتظار' }, { value: 'dispensed', label: 'تم الصرف' }, { value: 'cancelled', label: 'ملغاة' }
          ] })}
          ${ui.field({ label: 'ملاحظات', name: 'notes', type: 'textarea', value: r.notes || '', col: 'span-3', rows: 2 })}
        </div>
        <div class="flex items-center justify-between mb-2">
          <label class="label" style="margin:0">الأدوية الموصوفة</label>
          <button class="btn sm" data-add-item>${App.icon('plus', 14)} إضافة دواء</button>
        </div>
        <div id="rx-items"></div>
        <div class="hint mt-2">يمكنك كتابة اسم الدواء يدوياً أو اختياره من المخزون لاحقاً عند الصرف من الكاشير.</div>`,
      footer: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${App.icon('save')} حفظ الروشتة</button>`,
      onMount: (h) => {
        const itemsEl = h.body.querySelector('#rx-items');
        const paint = () => {
          itemsEl.innerHTML = `<div class="table-wrap"><table class="table compact"><thead><tr>
            <th>اسم الدواء</th><th style="width:150px">الجرعة / التعليمات</th><th style="width:80px">الكمية</th><th style="width:80px">تم الصرف</th><th></th>
          </tr></thead><tbody>${itemRows.map((i, idx) => `<tr>
            <td><input class="input sm" data-i="${idx}" data-f="name" value="${App.esc(i.name || '')}" placeholder="اسم الدواء والتركيز"></td>
            <td><input class="input sm" data-i="${idx}" data-f="dosage" value="${App.esc(i.dosage || '')}" placeholder="قرص 3 مرات"></td>
            <td><input class="input sm num" data-i="${idx}" data-f="qty" type="number" min="1" step="1" value="${i.qty || 1}"></td>
            <td style="text-align:center"><input type="checkbox" data-i="${idx}" data-f="dispensed" ${i.dispensed ? 'checked' : ''}></td>
            <td><button class="btn icon sm" data-rm="${idx}" style="color:var(--danger)">${App.icon('trash', 14)}</button></td>
          </tr>`).join('')}</tbody></table></div>`;
          itemsEl.querySelectorAll('[data-f]').forEach((inp) => {
            inp.onchange = () => {
              const row = itemRows[Number(inp.dataset.i)];
              row[inp.dataset.f] = inp.dataset.f === 'qty' ? (Number(inp.value) || 1) : inp.dataset.f === 'dispensed' ? (inp.checked ? 1 : 0) : inp.value.trim();
            };
          });
          itemsEl.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => {
            itemRows.splice(Number(b.dataset.rm), 1);
            if (!itemRows.length) itemRows.push({ name: '', dosage: '', qty: 1, dispensed: 0 });
            paint();
          });
        };
        h.body.querySelector('[data-add-item]').onclick = () => { itemRows.push({ name: '', dosage: '', qty: 1, dispensed: 0 }); paint(); };
        h.el.querySelector('[data-save]').onclick = async () => {
          const v = App.formValues(h.body);
          if (!v.patient_name) return ui.toast('اسم المريض مطلوب', 'warning');
          const payload = {
            ...v,
            customer_id: v.customer_id ? Number(v.customer_id) : null,
            items: itemRows.filter((i) => i.name && String(i.name).trim())
          };
          if (!payload.items.length) return ui.toast('أضف دواءً واحداً على الأقل', 'warning');
          try {
            if (rx) await App.api('/prescriptions/' + rx.id, { method: 'PUT', body: payload });
            else await App.api('/prescriptions', { method: 'POST', body: payload });
            ui.toast('تم حفظ الروشتة');
            m.close();
            if (onDone) onDone();
          } catch (err) { ui.toast(err.message, 'error'); }
        };
        paint();
      }
    });
  }

  async function openPrescriptionDetail(id, onChange) {
    let rx;
    try { rx = await App.api('/prescriptions/' + id); } catch (err) { return ui.toast(err.message, 'error'); }
    const m = ui.modal({
      title: 'روشتة ' + rx.rx_no,
      subtitle: `${App.esc(rx.patient_name)} · ${fmt.date(rx.date)}`,
      size: 'md',
      body: `
        <div class="kpi-strip">
          <div class="item"><div class="label">المريض</div><div class="value" style="font-size:14px">${App.esc(rx.patient_name)}</div></div>
          <div class="item"><div class="label">الطبيب</div><div class="value" style="font-size:14px">${App.esc(rx.doctor_name || '—')}</div></div>
          <div class="item"><div class="label">الحالة</div><div class="value" style="font-size:13px">${App.badge(rx.status)}</div></div>
          <div class="item"><div class="label">الأدوية</div><div class="value">${rx.items.length}</div></div>
        </div>
        <div class="info-row"><span class="k">العميل</span><span class="v">${App.esc(rx.customer_name || '—')}</span></div>
        <div class="info-row"><span class="k">هاتف الطبيب</span><span class="v ltr">${App.esc(rx.doctor_phone || '—')}</span></div>
        <div class="info-row"><span class="k">ملاحظات</span><span class="v">${App.esc(rx.notes || '—')}</span></div>
        ${ui.table({
          className: 'compact',
          columns: [
            { label: 'الدواء', render: (i) => App.esc(i.name) },
            { label: 'الجرعة', render: (i) => App.esc(i.dosage || '—') },
            { label: 'الكمية', tdClass: 'num', render: (i) => fmt.qty(i.qty) },
            { label: 'الصرف', render: (i) => i.dispensed ? '<span class="badge success">تم</span>' : '<span class="badge">لم يتم</span>' }
          ],
          rows: rx.items
        })}`,
      footer: `<button class="btn" data-print>${App.icon('printer')} طباعة</button>
        ${App.can('prescriptions.manage') ? `<button class="btn danger" data-del>${App.icon('trash')} حذف</button><button class="btn primary" data-edit>${App.icon('edit')} تعديل</button>` : ''}`,
      onMount: (h) => {
        h.el.querySelector('[data-print]').onclick = () => App.printA4('روشتة طبية ' + rx.rx_no, `
          <h1>روشتة طبية</h1>
          <div class="small">رقم: ${App.esc(rx.rx_no)} · التاريخ: ${fmt.date(rx.date)}</div>
          <div class="small">المريض: ${App.esc(rx.patient_name)} · الطبيب: ${App.esc(rx.doctor_name || '—')}</div>
          <table><thead><tr><th>الدواء</th><th>الجرعة</th><th>الكمية</th></tr></thead>
          <tbody>${rx.items.map((i) => `<tr><td>${App.esc(i.name)}</td><td>${App.esc(i.dosage || '')}</td><td class="num">${fmt.qty(i.qty)}</td></tr>`).join('')}</tbody></table>`);
        const edit = h.el.querySelector('[data-edit]');
        if (edit) edit.onclick = () => { m.close(); openPrescriptionForm(rx.id, onChange); };
        const del = h.el.querySelector('[data-del]');
        if (del) del.onclick = async () => {
          const yes = await ui.confirm({ title: 'حذف الروشتة', message: 'سيتم حذف الروشتة وأدويةها نهائياً.', confirmText: 'حذف', danger: true });
          if (!yes) return;
          try { await App.api('/prescriptions/' + rx.id, { method: 'DELETE' }); ui.toast('تم حذف الروشتة'); m.close(); if (onChange) onChange(); } catch (err) { ui.toast(err.message, 'error'); }
        };
      }
    });
  }

  async function renderPrescriptions(container, params) {
    const state = { search: '', status: '', page: 1 };
    container.innerHTML = `
      ${ui.pageHead({
        title: 'الروشتات الطبية',
        subtitle: 'أرشفة الروشتات ومتابعة صرف الأدوية',
        actions: `<button class="btn primary" data-new>${App.icon('plus')} روشتة جديدة</button>`
      })}
      <div class="card">
        <div class="toolbar">
          <div class="search-box" style="flex:1;max-width:360px">${App.icon('search')}
            <input class="input" id="rx-search" placeholder="اسم المريض أو الطبيب أو رقم الروشتة...">
          </div>
          <select class="select" id="rx-status" style="width:160px">
            <option value="">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="dispensed">تم الصرف</option>
            <option value="cancelled">ملغاة</option>
          </select>
          <button class="btn icon" data-reload>${App.icon('refresh')}</button>
        </div>
        <div id="rx-table"><div class="loading-block"><span class="spinner"></span> جارٍ التحميل...</div></div>
      </div>`;
    const tableEl = container.querySelector('#rx-table');

    async function load() {
      const qs = new URLSearchParams({ page: state.page, perPage: 25 });
      if (state.search) qs.set('search', state.search);
      if (state.status) qs.set('status', state.status);
      try {
        const r = await App.api('/prescriptions?' + qs.toString());
        tableEl.innerHTML = ui.table({
          columns: [
            { label: 'الروشتة', render: (x) => `<div class="cell-title ltr">${App.esc(x.rx_no)}</div><div class="cell-sub">${fmt.date(x.date)}</div>` },
            { label: 'المريض', render: (x) => `<div class="cell-title">${App.esc(x.patient_name)}</div><div class="cell-sub">${App.esc(x.customer_name || 'غير مسجل')}</div>` },
            { label: 'الطبيب', render: (x) => `<span class="small">${App.esc(x.doctor_name || '—')}</span>` },
            { label: 'الأدوية', tdClass: 'num', render: (x) => fmt.number(x.items_count, 0) },
            { label: 'الحالة', render: (x) => App.badge(x.status) },
            { label: '', tdClass: 'actions', render: (x) => `<button class="btn icon sm" data-view="${x.id}">${App.icon('eye', 14)}</button>
              <button class="btn icon sm" data-edit="${x.id}">${App.icon('edit', 14)}</button>` }
          ],
          rows: r.items,
          empty: ui.empty({ icon: 'clipboard', title: 'لا توجد روشتات', text: 'أضف روشتة جديدة بأدوية المريض.' })
        }) + ui.pager(r);
        ui.bindPager(tableEl, (p) => { state.page = p; load(); });
        tableEl.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => openPrescriptionDetail(Number(b.dataset.view), load));
        tableEl.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openPrescriptionForm(Number(b.dataset.edit), load));
      } catch (err) {
        tableEl.innerHTML = `<div class="card-pad">${ui.empty({ icon: 'alert', title: 'تعذر تحميل الروشتات', text: App.esc(err.message) })}</div>`;
      }
    }

    let t = null;
    container.querySelector('#rx-search').oninput = (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 280);
    };
    container.querySelector('#rx-status').onchange = (e) => { state.status = e.target.value; state.page = 1; load(); };
    container.querySelector('[data-reload]').onclick = load;
    container.querySelector('[data-new]').onclick = () => openPrescriptionForm(null, load);

    await load();
    if (params.new) setTimeout(() => openPrescriptionForm(null, load), 80);
  }

  App.register('customers', { title: 'العملاء', subtitle: 'ملفات العملاء والولاء والأرصدة', perm: 'customers.manage', render: renderCustomers });
  App.register('sales', { title: 'المبيعات', subtitle: 'الفواتير والمرتجعات', perm: 'sales.view', render: renderSales });
  App.register('returns', { title: 'المرتجعات', subtitle: 'مرتجعات البيع والشراء', perm: 'returns.manage', render: renderReturns });
  App.register('prescriptions', { title: 'الروشتات الطبية', subtitle: 'أرشفة الروشتات وصرف الأدوية', perm: 'prescriptions.manage', render: renderPrescriptions });
})();
