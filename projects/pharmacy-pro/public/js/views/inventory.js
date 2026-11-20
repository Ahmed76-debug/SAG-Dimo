/* PharmaPro – Inventory, products, purchases & suppliers */
(function () {
  'use strict';
  const ui = App.ui;
  const fmt = App.fmt;

  let categoriesCache = null;
  let suppliersCache = null;

  async function getCategories(force) {
    if (categoriesCache && !force) return categoriesCache;
    const r = await App.api('/categories');
    categoriesCache = r.items || [];
    return categoriesCache;
  }
  async function getSuppliers(force) {
    if (suppliersCache && !force) return suppliersCache;
    const r = await App.api('/suppliers/options');
    suppliersCache = r.items || [];
    return suppliersCache;
  }
  function stockBadge(p) {
    const stock = Number(p.stock) || 0;
    if (stock <= 0) return `<span class="badge danger">نفد</span>`;
    if (stock <= Number(p.min_stock)) return `<span class="badge warning">${fmt.qty(stock)}</span>`;
    return `<span class="badge success">${fmt.qty(stock)}</span>`;
  }
  function expiryText(date) {
    if (!date) return '<span class="muted">—</span>';
    const today = new Date(fmt.today() + 'T00:00:00');
    const d = new Date(String(date).slice(0, 10) + 'T00:00:00');
    const days = Math.round((d - today) / 86400000);
    if (days < 0) return `<span class="text-danger bold">${fmt.date(date)}</span><div class="xsmall text-danger">منتهية</div>`;
    if (days <= 90) return `<span class="text-warning bold">${fmt.date(date)}</span><div class="xsmall text-warning">بعد ${days} يوم</div>`;
    return `<span>${fmt.date(date)}</span>`;
  }
  function printBarcode(product) {
    const body = `<div style="text-align:center;padding:8mm 4mm">
      <div style="font-weight:700;font-size:13px;margin-bottom:3mm">${App.esc(product.name)}</div>
      <div style="font-size:10px;color:#444;margin-bottom:2mm">${App.esc(product.strength || '')} ${App.esc(product.form || '')}</div>
      <div style="width:58mm;margin:0 auto">${App.barcode39(product.barcode || product.sku || '')}</div>
      <div style="font-size:9px;margin-top:2mm">${fmt.money(product.price)}</div>
    </div>`;
    App.printHTML(body, { title: 'باركود ' + product.name, width: '60mm' });
  }

  /* ================================================================== */
  /*                         PRODUCT FORM                               */
  /* ================================================================== */
  async function openProductForm(id, onDone) {
    let product = null;
    if (id) {
      try { product = await App.api('/products/' + id); } catch (err) { return ui.toast(err.message, 'error'); }
    }
    const cats = await getCategories(true);
    const p = product || {};
    const isNew = !product;
    const catOptions = [{ value: '', label: 'بدون تصنيف' }].concat(cats.map((c) => ({ value: c.id, label: c.name })));

    const body = `
      <div class="form-grid three">
        ${ui.field({ label: 'اسم الصنف', name: 'name', value: p.name || '', required: true, col: 'span-2', placeholder: 'مثال: بانادول أقراص 500 مجم' })}
        ${ui.field({ label: 'الاسم بالإنجليزية', name: 'name_en', value: p.name_en || '', placeholder: 'Panadol 500mg' })}
        ${ui.field({ label: 'الباركود', name: 'barcode', value: p.barcode || '', placeholder: 'اتركه فارغاً للتوليد التلقائي' })}
        ${ui.field({ label: 'الكود الداخلي SKU', name: 'sku', value: p.sku || '', placeholder: 'تلقائي', disabled: !isNew })}
        ${ui.field({ label: 'التصنيف', name: 'category_id', type: 'select', value: p.category_id || '', options: catOptions })}
        ${ui.field({ label: 'الشركة المصنعة', name: 'manufacturer', value: p.manufacturer || '' })}
        ${ui.field({ label: 'الشكل الدوائي', name: 'form', value: p.form || '', placeholder: 'أقراص / شراب / كريم' })}
        ${ui.field({ label: 'التركيز', name: 'strength', value: p.strength || '', placeholder: '500 مجم' })}
        ${ui.field({ label: 'الوحدة', name: 'unit', value: p.unit || 'علبة', placeholder: 'علبة / شريط / زجاجة' })}
        ${ui.field({ label: 'سعر التكلفة', name: 'cost', type: 'number', value: p.cost || 0, min: 0, step: '0.01', required: true })}
        ${ui.field({ label: 'سعر البيع', name: 'price', type: 'number', value: p.price || 0, min: 0, step: '0.01', required: true })}
        ${ui.field({ label: 'نسبة الضريبة %', name: 'tax_rate', type: 'number', value: p.tax_rate || 0, min: 0, step: '0.01' })}
        ${ui.field({ label: 'حد الطلب', name: 'min_stock', type: 'number', value: p.min_stock || 0, min: 0, step: '1' })}
        ${ui.field({ label: 'كمية إعادة الطلب', name: 'reorder_qty', type: 'number', value: p.reorder_qty || 0, min: 0, step: '1' })}
        ${ui.field({ label: 'الرف / الموقع', name: 'shelf', value: p.shelf || '', placeholder: 'A-12' })}
        ${ui.field({ label: 'يستلزم روشتة طبية', name: 'requires_rx', type: 'switch', value: !!p.requires_rx, hint: 'يظهر بعلامة RX في الكاشير' })}
        ${ui.field({ label: 'صنف نشط', name: 'active', type: 'switch', value: isNew ? true : !!p.active, hint: 'الأصناف غير النشطة لا تظهر في البيع' })}
        ${ui.field({ label: 'ملاحظات', name: 'notes', type: 'textarea', value: p.notes || '', col: 'span-3', rows: 2 })}
      </div>
      ${isNew ? `<hr class="hr"><h4 class="mb-3" style="font-size:13px">${App.icon('layers', 15)} رصيد افتتاحي (اختياري)</h4>
        <div class="form-grid three">
          ${ui.field({ label: 'الكمية الافتتاحية', name: 'opening_qty', type: 'number', value: 0, min: 0, step: '1' })}
          ${ui.field({ label: 'رقم الدفعة', name: 'batch_no', value: 'OPENING' })}
          ${ui.field({ label: 'تاريخ الصلاحية', name: 'expiry_date', type: 'date' })}
        </div>` : ''}`;

    const m = ui.modal({
      title: isNew ? 'إضافة صنف جديد' : 'تعديل صنف',
      subtitle: isNew ? 'أدخل بيانات الدواء والسعر والحد الأدنى للمخزون' : App.esc(p.name || ''),
      size: 'lg',
      body,
      footer: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${App.icon('save')} حفظ الصنف</button>`,
      onMount: (h) => {
        h.el.querySelector('[data-save]').onclick = async () => {
          const form = h.el.querySelector('.modal-body');
          const v = App.formValues(form);
          if (!v.name) return ui.toast('اسم الصنف مطلوب', 'warning');
          const payload = {
            ...v,
            category_id: v.category_id ? Number(v.category_id) : null,
            cost: Number(v.cost) || 0,
            price: Number(v.price) || 0,
            tax_rate: Number(v.tax_rate) || 0,
            min_stock: Number(v.min_stock) || 0,
            reorder_qty: Number(v.reorder_qty) || 0,
            requires_rx: form.querySelector('[name=requires_rx]').checked ? 1 : 0,
            active: form.querySelector('[name=active]').checked ? 1 : 0,
            opening_qty: Number(v.opening_qty) || 0
          };
          const btn = h.el.querySelector('[data-save]');
          btn.disabled = true;
          try {
            if (isNew) await App.api('/products', { method: 'POST', body: payload });
            else await App.api('/products/' + id, { method: 'PUT', body: payload });
            ui.toast(isNew ? 'تم إضافة الصنف بنجاح' : 'تم تحديث الصنف');
            m.close();
            categoriesCache = null;
            if (onDone) onDone();
          } catch (err) {
            btn.disabled = false;
            ui.toast(err.message, 'error');
          }
        };
      }
    });
  }

  /* ================================================================== */
  /*                         ADJUST STOCK                               */
  /* ================================================================== */
  async function openAdjust(productId, onDone) {
    let p;
    try { p = await App.api('/products/' + productId); } catch (err) { return ui.toast(err.message, 'error'); }
    const m = ui.modal({
      title: 'تسوية مخزون',
      subtitle: `${App.esc(p.name)} · المتاح حالياً ${fmt.qty(p.stock)} ${App.esc(p.unit || '')}`,
      size: 'sm',
      body: `<div class="form-grid">
        ${ui.field({ label: 'نوع الحركة', name: 'type', type: 'select', value: 'in', options: [{ value: 'in', label: 'إضافة للمخزون' }, { value: 'out', label: 'خصم من المخزون' }] })}
        ${ui.field({ label: 'الكمية', name: 'qty', type: 'number', min: 0.01, step: '0.01', required: true })}
        ${ui.field({ label: 'تكلفة الوحدة', name: 'cost', type: 'number', value: p.cost || 0, min: 0, step: '0.01' })}
        ${ui.field({ label: 'رقم الدفعة', name: 'batch_no', value: 'ADJ' })}
        ${ui.field({ label: 'تاريخ الصلاحية', name: 'expiry_date', type: 'date', col: 'span-2' })}
        ${ui.field({ label: 'سبب التسوية', name: 'reason', type: 'textarea', col: 'span-2', rows: 2, placeholder: 'جرد / تالف / خطأ إدخال...' })}
      </div>`,
      footer: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${App.icon('save')} تطبيق التسوية</button>`,
      onMount: (h) => {
        h.el.querySelector('[data-save]').onclick = async () => {
          const v = App.formValues(h.el.querySelector('.modal-body'));
          if (!Number(v.qty)) return ui.toast('أدخل كمية صحيحة', 'warning');
          try {
            await App.api(`/products/${productId}/adjust`, { method: 'POST', body: v });
            ui.toast('تم تحديث المخزون وتسجيل القيد المحاسبي');
            m.close();
            if (onDone) onDone();
          } catch (err) { ui.toast(err.message, 'error'); }
        };
      }
    });
  }

  /* ================================================================== */
  /*                        PRODUCT DETAIL                              */
  /* ================================================================== */
  async function openProductDetail(id, onChange) {
    let p;
    try { p = await App.api('/products/' + id); } catch (err) { return ui.toast(err.message, 'error'); }
    const body = `
      <div class="flex items-center gap-3 mb-4">
        <div class="stat-icon" style="width:52px;height:52px;border-radius:14px;background:var(--primary-soft);color:var(--primary)">${App.icon('pill', 26)}</div>
        <div style="min-width:0"><div class="bold" style="font-size:16px">${App.esc(p.name)}</div>
          <div class="small muted">${App.esc([p.name_en, p.manufacturer, p.strength, p.form].filter(Boolean).join(' · '))}</div></div>
        <div style="margin-inline-start:auto">${stockBadge(p)}</div>
      </div>
      <div class="kpi-strip" style="margin-bottom:12px">
        <div class="item"><div class="label">سعر البيع</div><div class="value">${fmt.money(p.price)}</div></div>
        <div class="item"><div class="label">التكلفة</div><div class="value">${fmt.money(p.cost)}</div></div>
        <div class="item"><div class="label">المخزون</div><div class="value">${fmt.qty(p.stock)}</div></div>
        <div class="item"><div class="label">حد الطلب</div><div class="value">${fmt.qty(p.min_stock)}</div></div>
      </div>
      <div class="info-row"><span class="k">الباركود</span><span class="v ltr">${App.esc(p.barcode || '—')}</span></div>
      <div class="info-row"><span class="k">التصنيف</span><span class="v">${App.esc(p.category_name || 'غير مصنف')}</span></div>
      <div class="info-row"><span class="k">الرف</span><span class="v">${App.esc(p.shelf || '—')}</span></div>
      <div class="info-row"><span class="k">الضريبة</span><span class="v">${fmt.number(p.tax_rate)}%</span></div>
      <div class="info-row"><span class="k">روشتة طبية</span><span class="v">${p.requires_rx ? 'نعم' : 'لا'}</span></div>
      ${p.notes ? `<div class="card card-pad mt-3" style="background:var(--panel-2);font-size:12px">${App.esc(p.notes)}</div>` : ''}
      <hr class="hr">
      <h4 class="mb-3" style="font-size:13px">${App.icon('layers', 15)} الدفعات المتاحة (${p.batches.length})</h4>
      ${p.batches.length ? ui.table({
        className: 'compact',
        columns: [
          { label: 'الدفعة', render: (b) => `<span class="ltr">${App.esc(b.batch_no || '—')}</span>` },
          { label: 'الصلاحية', render: (b) => expiryText(b.expiry_date) },
          { label: 'الكمية', render: (b) => `<b>${fmt.qty(b.qty)}</b>` },
          { label: 'التكلفة', render: (b) => fmt.money(b.cost) },
          { label: 'المورد', render: (b) => App.esc(b.supplier_name || '—') }
        ],
        rows: p.batches
      }) : ui.empty({ icon: 'boxOpen', title: 'لا توجد دفعات متاحة' })}
      <hr class="hr">
      <h4 class="mb-3" style="font-size:13px">${App.icon('history', 15)} آخر حركات المخزون</h4>
      ${p.movements.length ? ui.table({
        className: 'compact',
        columns: [
          { label: 'التاريخ', render: (m) => `<span class="small">${fmt.datetime(m.created_at)}</span>` },
          { label: 'النوع', render: (m) => `<span class="badge ${m.type === 'in' ? 'success' : 'warning'}">${m.type === 'in' ? 'إضافة' : 'صرف'}</span>` },
          { label: 'الكمية', render: (m) => `${m.type === 'out' ? '-' : '+'}${fmt.qty(Math.abs(m.qty))}` },
          { label: 'المرجع', render: (m) => `<span class="small muted">${App.esc(m.note || m.ref_type || '')}</span>` },
          { label: 'المستخدم', render: (m) => `<span class="small">${App.esc(m.user_name || '')}</span>` }
        ],
        rows: p.movements.slice(0, 15)
      }) : ui.empty({ icon: 'history', title: 'لا توجد حركات' })}`;

    const drawer = ui.drawer({
      title: 'بطاقة الصنف',
      width: 620,
      body,
      onMount: (h) => {
        h.body.querySelector('.drawer-body');
      }
    });
    const head = drawer.el.querySelector('.drawer-head');
    const actions = document.createElement('div');
    actions.className = 'flex gap-1';
    actions.style.marginInlineStart = 'auto';
    actions.innerHTML = `
      <button class="btn icon sm" data-print title="طباعة الباركود">${App.icon('barcode', 15)}</button>
      ${App.can('inventory.manage') ? `<button class="btn icon sm" data-adjust title="تسوية">${App.icon('layers', 15)}</button>` : ''}
      ${App.can('products.manage') ? `<button class="btn icon sm" data-edit title="تعديل">${App.icon('edit', 15)}</button>` : ''}`;
    head.insertBefore(actions, head.querySelector('[data-close]'));
    actions.querySelector('[data-print]').onclick = () => printBarcode(p);
    const adj = actions.querySelector('[data-adjust]');
    if (adj) adj.onclick = () => openAdjust(p.id, () => { drawer.close(); if (onChange) onChange(); });
    const edit = actions.querySelector('[data-edit]');
    if (edit) edit.onclick = () => openProductForm(p.id, () => { drawer.close(); if (onChange) onChange(); });
  }

  /* ================================================================== */
  /*                         CATEGORIES                                 */
  /* ================================================================== */
  async function openCategories(onDone) {
    const m = ui.modal({
      title: 'إدارة التصنيفات',
      subtitle: 'تنظيم الأصناف داخل مجموعات',
      size: 'md',
      body: `<div id="cat-list" class="mb-4"></div>
        <hr class="hr">
        <h4 class="mb-3" style="font-size:13px">إضافة تصنيف</h4>
        <div class="form-grid three">
          ${ui.field({ label: 'اسم التصنيف', name: 'name', placeholder: 'مضادات حيوية' })}
          ${ui.field({ label: 'اللون', name: 'color', type: 'color', value: '#0ea5e9' })}
          <div class="field"><label class="label">&nbsp;</label><button class="btn primary" data-add>${App.icon('plus')} إضافة</button></div>
        </div>`,
      onMount: (h) => {
        const list = h.body.querySelector('#cat-list');
        const load = async () => {
          const cats = await getCategories(true);
          list.innerHTML = cats.length ? cats.map((c) => `
            <div class="alert-item" style="padding:9px 0">
              <span class="pill-dot" style="background:${App.esc(c.color || '#0ea5e9')};width:11px;height:11px"></span>
              <div class="ai-main"><div class="ai-title">${App.esc(c.name)}</div>
                <div class="ai-sub">${c.products_count || 0} صنف</div></div>
              <button class="btn icon sm" data-edit="${c.id}" title="تعديل">${App.icon('edit', 14)}</button>
              <button class="btn icon sm" data-del="${c.id}" title="حذف" style="color:var(--danger)">${App.icon('trash', 14)}</button>
            </div>`).join('') : ui.empty({ icon: 'box', title: 'لا توجد تصنيفات بعد' });
          list.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => {
            const c = cats.find((x) => String(x.id) === b.dataset.edit);
            const em = ui.modal({
              title: 'تعديل التصنيف', size: 'sm',
              body: `<div class=\"form-grid\">${ui.field({ label: 'اسم التصنيف', name: 'name', value: c.name, required: true })}${ui.field({ label: 'اللون', name: 'color', type: 'color', value: c.color || '#0ea5e9' })}</div>`,
              footer: `<button class=\"btn\" data-close>إلغاء</button><button class=\"btn primary\" data-save>${App.icon('save')} حفظ</button>`,
              onMount: (h2) => {
                h2.el.querySelector('[data-save]').onclick = async () => {
                  const v = App.formValues(h2.el.querySelector('.modal-body'));
                  if (!v.name) return ui.toast('اسم التصنيف مطلوب', 'warning');
                  try {
                    await App.api('/categories/' + c.id, { method: 'PUT', body: { ...c, name: v.name, color: v.color } });
                    ui.toast('تم تحديث التصنيف');
                    em.close();
                    load();
                    if (onDone) onDone();
                  } catch (err) { ui.toast(err.message, 'error'); }
                };
              }
            });
          });
          list.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
            const yes = await ui.confirm({ title: 'حذف تصنيف', message: 'سيتم حذف التصنيف نهائياً إذا لم يكن مرتبطاً بأصناف.', confirmText: 'حذف', danger: true });
            if (!yes) return;
            try { await App.api('/categories/' + b.dataset.del, { method: 'DELETE' }); load(); if (onDone) onDone(); } catch (err) { ui.toast(err.message, 'error'); }
          });
        };
        h.body.querySelector('[data-add]').onclick = async () => {
          const v = App.formValues(h.body);
          if (!v.name) return ui.toast('اسم التصنيف مطلوب', 'warning');
          try {
            await App.api('/categories', { method: 'POST', body: v });
            h.body.querySelector('[name=name]').value = '';
            ui.toast('تم إضافة التصنيف');
            load();
            if (onDone) onDone();
          } catch (err) { ui.toast(err.message, 'error'); }
        };
        load();
      }
    });
  }

  /* ================================================================== */
  /*                          PRODUCTS VIEW                             */
  /* ================================================================== */
  async function renderProducts(container, params) {
    const cats = await getCategories(true).catch(() => []);
    const state = {
      search: params.search || '', category: params.category || '',
      status: params.low ? 'low' : (params.expiring ? 'expiring' : (params.expired ? 'expired' : '')),
      sort: 'name', page: 1
    };
    const catOptions = [{ value: '', label: 'كل التصنيفات' }].concat(cats.map((c) => ({ value: c.id, label: c.name })));

    container.innerHTML = `
      ${ui.pageHead({
        title: 'الأصناف والأدوية',
        subtitle: 'إدارة كتالوج الأدوية والأسعار والباركود',
        actions: `
          ${App.can('products.manage') ? `<button class="btn" data-cats>${App.icon('box')} التصنيفات</button>` : ''}
          ${App.can('products.manage') ? `<button class="btn primary" data-new>${App.icon('plus')} صنف جديد</button>` : ''}
        `
      })}
      <div class="card">
        <div class="toolbar">
          <div class="search-box" style="flex:1;min-width:240px;max-width:380px">
            ${App.icon('search')}
            <input class="input" id="p-search" placeholder="بحث بالاسم أو الباركود أو الشركة..." value="${App.esc(state.search)}">
          </div>
          <select class="select" id="p-cat" style="width:180px">${catOptions.map((o) => `<option value="${o.value}" ${String(state.category) === String(o.value) ? 'selected' : ''}>${App.esc(o.label)}</option>`).join('')}</select>
          <select class="select" id="p-status" style="width:165px">
            <option value="">كل الحالات</option>
            <option value="low" ${state.status === 'low' ? 'selected' : ''}>تحت حد الطلب</option>
            <option value="expiring" ${state.status === 'expiring' ? 'selected' : ''}>قاربت الانتهاء</option>
            <option value="expired" ${state.status === 'expired' ? 'selected' : ''}>منتهية الصلاحية</option>
          </select>
          <select class="select" id="p-sort" style="width:165px">
            <option value="name">الاسم (أ - ي)</option>
            <option value="newest">الأحدث</option>
            <option value="stock_asc">المخزون الأقل</option>
            <option value="stock_desc">المخزون الأكثر</option>
            <option value="price_desc">السعر الأعلى</option>
            <option value="price_asc">السعر الأقل</option>
          </select>
          <button class="btn icon" data-reload title="تحديث">${App.icon('refresh')}</button>
        </div>
        <div id="p-table"><div class="loading-block"><span class="spinner"></span> جارٍ التحميل...</div></div>
      </div>`;

    const tableEl = container.querySelector('#p-table');
    const searchEl = container.querySelector('#p-search');
    const catEl = container.querySelector('#p-cat');
    const statusEl = container.querySelector('#p-status');
    const sortEl = container.querySelector('#p-sort');

    async function load() {
      const qs = new URLSearchParams({ page: state.page, perPage: 25, sort: state.sort });
      if (state.search) qs.set('search', state.search);
      if (state.category) qs.set('category', state.category);
      if (state.status === 'low') qs.set('low', '1');
      if (state.status === 'expiring') qs.set('expiring', '90');
      if (state.status === 'expired') qs.set('expired', '1');
      try {
        const r = await App.api('/products?' + qs.toString());
        state.page = r.page;
        tableEl.innerHTML = ui.table({
          columns: [
            {
              label: 'الصنف',
              render: (p) => `<div class="main-cell">
                <div class="stat-icon" style="width:34px;height:34px;border-radius:9px;background:var(--primary-soft);color:var(--primary)">${App.icon('pill', 17)}</div>
                <div style="min-width:0"><div class="cell-title">${App.esc(p.name)} ${p.requires_rx ? '<span class="badge purple" style="font-size:9px;padding:0 4px">RX</span>' : ''}</div>
                <div class="cell-sub ltr">${App.esc(p.barcode || p.sku || '')}${p.strength ? ' · ' + App.esc(p.strength) : ''}</div></div></div>`
            },
            { label: 'التصنيف', render: (p) => `<span class="small muted">${App.esc(p.category_name || 'غير مصنف')}</span>` },
            { label: 'الشركة', render: (p) => `<span class="small">${App.esc(p.manufacturer || '—')}</span>` },
            { label: 'التكلفة', tdClass: 'num', render: (p) => fmt.money(p.cost) },
            { label: 'سعر البيع', tdClass: 'num', render: (p) => `<b class="text-primary">${fmt.money(p.price)}</b>` },
            { label: 'المخزون', render: (p) => stockBadge(p) },
            { label: 'أقرب صلاحية', render: (p) => expiryText(p.nearest_expiry) },
            {
              label: '', tdClass: 'actions', render: (p) => `
                <button class="btn icon sm" data-act="view" data-id="${p.id}" title="عرض">${App.icon('eye', 14)}</button>
                ${App.can('products.manage') ? `<button class="btn icon sm" data-act="edit" data-id="${p.id}" title="تعديل">${App.icon('edit', 14)}</button>` : ''}
                ${App.can('inventory.manage') ? `<button class="btn icon sm" data-act="adjust" data-id="${p.id}" title="تسوية">${App.icon('layers', 14)}</button>` : ''}
                ${App.can('products.manage') ? `<button class="btn icon sm" data-act="del" data-id="${p.id}" title="إيقاف" style="color:var(--danger)">${App.icon('trash', 14)}</button>` : ''}`
            }
          ],
          rows: r.items,
          empty: ui.empty({ icon: 'search', title: 'لا توجد أصناف مطابقة', text: 'جرّب تعديل البحث أو إضافة صنف جديد.' })
        }) + ui.pager(r);
        ui.bindPager(tableEl, (p) => { state.page = p; load(); });
        tableEl.querySelectorAll('[data-act]').forEach((b) => {
          const id = Number(b.dataset.id);
          b.onclick = async () => {
            if (b.dataset.act === 'view') openProductDetail(id, load);
            else if (b.dataset.act === 'edit') openProductForm(id, load);
            else if (b.dataset.act === 'adjust') openAdjust(id, load);
            else if (b.dataset.act === 'del') {
              const yes = await ui.confirm({ title: 'إيقاف الصنف', message: 'سيتم إخفاء الصنف من شاشة البيع مع الاحتفاظ بسجلاته. هل تريد المتابعة؟', confirmText: 'إيقاف', danger: true });
              if (!yes) return;
              try { await App.api('/products/' + id, { method: 'DELETE' }); ui.toast('تم إيقاف الصنف'); load(); } catch (err) { ui.toast(err.message, 'error'); }
            }
          };
        });
      } catch (err) {
        tableEl.innerHTML = `<div class="card-pad">${ui.empty({ icon: 'alert', title: 'تعذر تحميل الأصناف', text: App.esc(err.message) })}</div>`;
      }
    }

    let t = null;
    searchEl.oninput = () => {
      clearTimeout(t);
      t = setTimeout(() => { state.search = searchEl.value.trim(); state.page = 1; load(); }, 280);
    };
    catEl.onchange = () => { state.category = catEl.value; state.page = 1; load(); };
    statusEl.onchange = () => { state.status = statusEl.value; state.page = 1; load(); };
    sortEl.onchange = () => { state.sort = sortEl.value; state.page = 1; load(); };
    container.querySelector('[data-reload]').onclick = load;
    const catsBtn = container.querySelector('[data-cats]');
    if (catsBtn) catsBtn.onclick = () => openCategories(() => { getCategories(true).then((c) => { categoriesCache = c; }); });
    const newBtn = container.querySelector('[data-new]');
    if (newBtn) newBtn.onclick = () => openProductForm(null, load);

    await load();
    if (params.new && App.can('products.manage')) setTimeout(() => openProductForm(null, load), 80);
  }

  /* ================================================================== */
  /*                         INVENTORY VIEW                             */
  /* ================================================================== */
  async function renderInventory(container, params) {
    const state = { tab: params.tab || 'stock', days: 90, type: '', search: '' };
    container.innerHTML = `
      ${ui.pageHead({
        title: 'المخزون والصلاحية',
        subtitle: 'متابعة الأرصدة والدفعات وتواريخ الانتهاء وحركات المخزون',
        actions: `<button class="btn" data-print>${App.icon('printer')} طباعة</button>`
      })}
      <div class="card">
        <div id="inv-tabs">
          ${ui.tabs([
            { id: 'stock', label: 'الأرصدة والتقييم', icon: 'layers' },
            { id: 'expiry', label: 'الصلاحية', icon: 'clock' },
            { id: 'movements', label: 'حركات المخزون', icon: 'history' }
          ], state.tab)}
        </div>
        <div id="inv-body"><div class="loading-block"><span class="spinner"></span> جارٍ التحميل...</div></div>
      </div>`;

    const bodyEl = container.querySelector('#inv-body');

    async function loadStock() {
      const r = await App.api('/reports/inventory');
      const cats = r.by_category || [];
      const items = (r.items || []).slice().sort((a, b) => Number(a.stock) - Number(b.stock));
      bodyEl.innerHTML = `
        <div class="card-body">
          <div class="stat-grid">
            ${ui.stat({ label: 'قيمة المخزون بالتكلفة', valueHtml: `${fmt.number(r.totals.cost)} <span class="cur">${App.currency()}</span>`, icon: 'layers', tone: 'var(--primary)', tint: 'var(--primary-soft)' })}
            ${ui.stat({ label: 'قيمة المخزون بسعر البيع', valueHtml: `${fmt.number(r.totals.retail)} <span class="cur">${App.currency()}</span>`, icon: 'banknote', tone: 'var(--accent)', tint: 'var(--accent-soft)' })}
            ${ui.stat({ label: 'إجمالي الوحدات', valueHtml: fmt.number(r.totals.units, 0), icon: 'box', tone: 'var(--purple)', tint: 'var(--purple-soft)' })}
            ${ui.stat({ label: 'هامش الربح المتوقع', valueHtml: `${fmt.number(r.totals.retail - r.totals.cost)} <span class="cur">${App.currency()}</span>`, icon: 'trendingUp', tone: 'var(--success)', tint: 'var(--success-soft)' })}
          </div>
          <div class="two-col" style="align-items:start">
            <div>${ui.section({
              title: 'الأرصدة حسب الصنف',
              subtitle: 'الأصناف مرتبة من الأقل رصيداً',
              flush: true,
              body: ui.table({
                className: 'compact',
                columns: [
                  { label: 'الصنف', render: (p) => `<div class="cell-title">${App.esc(p.name)}</div><div class="cell-sub">${App.esc(p.unit || '')} · ${App.esc(p.category_name || '')}</div>` },
                  { label: 'المخزون', render: (p) => stockBadge(p) },
                  { label: 'حد الطلب', tdClass: 'num', render: (p) => fmt.qty(p.min_stock) },
                  { label: 'التكلفة', tdClass: 'num', render: (p) => fmt.money(p.cost) },
                  { label: 'قيمة البيع', tdClass: 'num', render: (p) => fmt.money(Number(p.stock) * Number(p.price)) },
                  { label: 'أقرب صلاحية', render: (p) => expiryText(p.nearest_expiry) }
                ],
                rows: items
              })
            })}</div>
            <div class="flex flex-col gap-4">
              ${ui.section({ title: 'قيمة المخزون حسب التصنيف', body: cats.length ? App.charts.donut(cats.map((c) => ({ label: c.name, value: c.cost_value })), { size: 154 }) : ui.empty({ icon: 'chart', title: 'لا توجد بيانات' }) })}
              ${ui.section({ title: 'ملخص التصنيفات', flush: true, body: ui.table({
                className: 'compact',
                columns: [
                  { label: 'التصنيف', render: (c) => App.esc(c.name) },
                  { label: 'أصناف', tdClass: 'num', render: (c) => fmt.number(c.products, 0) },
                  { label: 'وحدات', tdClass: 'num', render: (c) => fmt.number(c.units, 0) },
                  { label: 'القيمة', tdClass: 'num', render: (c) => fmt.money(c.cost_value) }
                ],
                rows: cats
              }) })}
            </div>
          </div>
        </div>`;
      container.querySelector('[data-print]').onclick = () => printInventory(r, cats);
    }

    async function loadExpiry() {
      const r = await App.api('/reports/expiry?days=' + state.days);
      bodyEl.innerHTML = `
        <div class="toolbar">
          <span class="small muted">عرض الدفعات التي تنتهي خلال:</span>
          <div class="chip-row" id="exp-chips">
            ${[30, 60, 90, 180, 365].map((n) => `<button class="chip ${state.days === n ? 'active' : ''}" data-days="${n}">${n} يوم</button>`).join('')}
          </div>
          <span class="flex-1"></span>
          <button class="btn sm danger" data-print-exp>${App.icon('printer')} طباعة التقرير</button>
        </div>
        <div class="card-body">
          <div class="stat-grid">
            ${ui.stat({ label: 'دفعات قاربت الانتهاء', valueHtml: fmt.number(r.totals.count, 0), icon: 'clock', tone: 'var(--warning)', tint: 'var(--warning-soft)', foot: `خلال ${r.days} يوم` })}
            ${ui.stat({ label: 'دفعات منتهية فعلاً', valueHtml: fmt.number(r.totals.expired, 0), icon: 'alert', tone: 'var(--danger)', tint: 'var(--danger-soft)' })}
            ${ui.stat({ label: 'الوحدات المعرضة', valueHtml: fmt.number(r.totals.qty, 0), icon: 'box', tone: 'var(--purple)', tint: 'var(--purple-soft)' })}
            ${ui.stat({ label: 'قيمة المخزون المعرض', valueHtml: `${fmt.number(r.totals.value)} <span class="cur">${App.currency()}</span>`, icon: 'wallet', tone: 'var(--danger)', tint: 'var(--danger-soft)' })}
          </div>
          ${ui.table({
            columns: [
              { label: 'الصنف', render: (b) => `<div class="cell-title">${App.esc(b.name)}</div><div class="cell-sub ltr">${App.esc(b.batch_no || '—')}</div>` },
              { label: 'الكمية', render: (b) => `<b>${fmt.qty(b.qty)}</b> ${App.esc(b.unit || '')}` },
              { label: 'تاريخ الانتهاء', render: (b) => expiryText(b.expiry_date) },
              { label: 'المتبقي', render: (b) => `<span class="badge ${b.days_left < 0 ? 'danger' : b.days_left <= 30 ? 'warning' : 'info'}">${b.days_left < 0 ? `منتهية ${Math.abs(b.days_left)} يوم` : `${b.days_left} يوم`}</span>` },
              { label: 'قيمة المخزون', tdClass: 'num', render: (b) => fmt.money(b.stock_value) }
            ],
            rows: r.items,
            empty: ui.empty({ icon: 'circleCheck', title: 'لا توجد دفعات قريبة الانتهاء', text: 'كل الدفعات سليمة خلال الفترة المحددة.' })
          })}
        </div>`;
      bodyEl.querySelectorAll('[data-days]').forEach((b) => b.onclick = () => { state.days = Number(b.dataset.days); loadExpiry(); });
      bodyEl.querySelector('[data-print-exp]').onclick = () => printExpiry(r);
    }

    async function loadMovements() {
      const qs = new URLSearchParams({ limit: 200 });
      if (state.type) qs.set('type', state.type);
      if (state.search) qs.set('search', state.search);
      const r = await App.api('/inventory/movements?' + qs.toString());
      const typeText = { in: 'إضافة', out: 'صرف' };
      const refText = {
        sale: 'بيع', purchase: 'شراء', sale_return: 'مرتجع بيع', purchase_return: 'مرتجع شراء',
        adjustment: 'تسوية', opening: 'رصيد افتتاحي', sale_void: 'إلغاء فاتورة'
      };
      bodyEl.innerHTML = `
        <div class="toolbar">
          <div class="search-box" style="flex:1;max-width:340px">${App.icon('search')}
            <input class="input" id="mv-search" placeholder="بحث بالصنف أو الدفعة أو الملاحظة..." value="${App.esc(state.search)}">
          </div>
          <select class="select" id="mv-type" style="width:160px">
            <option value="">كل الحركات</option>
            <option value="in" ${state.type === 'in' ? 'selected' : ''}>إضافة</option>
            <option value="out" ${state.type === 'out' ? 'selected' : ''}>صرف</option>
          </select>
          <button class="btn icon" data-reload-mv>${App.icon('refresh')}</button>
        </div>
        <div class="card-body">
          ${ui.table({
            columns: [
              { label: 'التاريخ', render: (m) => `<span class="small">${fmt.datetime(m.created_at)}</span>` },
              { label: 'الصنف', render: (m) => `<div class="cell-title">${App.esc(m.product_name || '—')}</div><div class="cell-sub ltr">${App.esc(m.batch_no || '')}</div>` },
              { label: 'الحركة', render: (m) => `<span class="badge ${m.type === 'in' ? 'success' : 'warning'}">${typeText[m.type] || m.type}</span>` },
              { label: 'الكمية', tdClass: 'num', render: (m) => `<b class="${m.type === 'out' ? 'text-danger' : 'text-success'}">${m.type === 'out' ? '' : '+'}${fmt.qty(m.qty)}</b>` },
              { label: 'المرجع', render: (m) => `<span class="small">${App.esc(refText[m.ref_type] || m.ref_type || '—')}</span>` },
              { label: 'الملاحظة', render: (m) => `<span class="small muted">${App.esc(m.note || '—')}</span>` },
              { label: 'المستخدم', render: (m) => `<span class="small">${App.esc(m.user_name || '—')}</span>` }
            ],
            rows: r.items,
            empty: ui.empty({ icon: 'history', title: 'لا توجد حركات مخزون' })
          })}
        </div>`;
      bodyEl.querySelector('[data-reload-mv]').onclick = loadMovements;
      bodyEl.querySelector('#mv-type').onchange = (e) => { state.type = e.target.value; loadMovements(); };
      let t2 = null;
      bodyEl.querySelector('#mv-search').oninput = (e) => {
        clearTimeout(t2);
        t2 = setTimeout(() => { state.search = e.target.value.trim(); loadMovements(); }, 300);
      };
    }

    async function load() {
      bodyEl.innerHTML = `<div class="loading-block"><span class="spinner"></span> جارٍ التحميل...</div>`;
      const pb = container.querySelector('[data-print]');
      if (pb) pb.style.display = state.tab === 'movements' ? 'none' : '';
      try {
        if (state.tab === 'expiry') await loadExpiry();
        else if (state.tab === 'movements') await loadMovements();
        else await loadStock();
      } catch (err) {
        bodyEl.innerHTML = `<div class="card-pad">${ui.empty({ icon: 'alert', title: 'تعذر تحميل البيانات', text: App.esc(err.message) })}</div>`;
      }
    }

    ui.bindTabs(container.querySelector('#inv-tabs'), (tab) => { state.tab = tab; load(); });
    const printBtn = container.querySelector('[data-print]');
    printBtn.style.display = state.tab === 'movements' ? 'none' : '';
    load();
  }

  function printInventory(r, cats) {
    const rows = (r.items || []).map((p) => `<tr><td>${App.esc(p.name)}</td><td>${App.esc(p.category_name || '')}</td>
      <td class="num">${fmt.qty(p.stock)}</td><td class="num">${fmt.qty(p.min_stock)}</td>
      <td class="num">${fmt.money(p.cost)}</td><td class="num">${fmt.money(p.price)}</td>
      <td class="num">${fmt.money(Number(p.stock) * Number(p.cost))}</td></tr>`).join('');
    App.printA4('تقرير المخزون', `
      <h1>تقرير المخزون والأرصدة</h1>
      <div class="small">تاريخ الطباعة: ${fmt.datetime(new Date().toISOString())} · عدد الأصناف: ${r.items.length}</div>
      <div class="totals" style="width:100%;margin-top:10px"><div class="row"><span>قيمة المخزون بالتكلفة</span><b>${fmt.money(r.totals.cost)}</b></div>
      <div class="row"><span>القيمة بسعر البيع</span><b>${fmt.money(r.totals.retail)}</b></div>
      <div class="row"><span>إجمالي الوحدات</span><b>${fmt.number(r.totals.units, 0)}</b></div></div>
      <table><thead><tr><th>الصنف</th><th>التصنيف</th><th>المخزون</th><th>حد الطلب</th><th>التكلفة</th><th>البيع</th><th>قيمة التكلفة</th></tr></thead>
      <tbody>${rows}</tbody></table>`);
  }
  function printExpiry(r) {
    const rows = (r.items || []).map((b) => `<tr><td>${App.esc(b.name)}</td><td>${App.esc(b.batch_no || '')}</td>
      <td class="num">${fmt.qty(b.qty)}</td><td>${fmt.date(b.expiry_date)}</td>
      <td class="num">${b.days_left < 0 ? 'منتهية' : b.days_left + ' يوم'}</td><td class="num">${fmt.money(b.stock_value)}</td></tr>`).join('');
    App.printA4('تقرير الصلاحية', `
      <h1>تقرير الدفعات قاربة الانتهاء (${r.days} يوم)</h1>
      <table><thead><tr><th>الصنف</th><th>الدفعة</th><th>الكمية</th><th>الانتهاء</th><th>المتبقي</th><th>القيمة</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals"><div class="row grand"><span>إجمالي القيمة المعرضة</span><b>${fmt.money(r.totals.value)}</b></div></div>`);
  }

  /* ================================================================== */
  /*                        PURCHASES VIEW                              */
  /* ================================================================== */
  async function getPurchase(id) {
    return App.api('/purchases/' + id);
  }

  async function openPurchaseForm(onDone) {
    const [suppliers, categoriesUnused] = await Promise.all([getSuppliers(true), getCategories(true).catch(() => [])]);
    const rows = [];
    let searchTimer = null;

    const m = ui.modal({
      title: 'فاتورة شراء جديدة',
      subtitle: 'توريد أصناف جديدة أو زيادة المخزون بدفعات وتواريخ صلاحية',
      size: 'xl',
      body: `
        <div class="form-grid three mb-4">
          ${ui.field({ label: 'المورد', name: 'supplier_id', type: 'select', required: true, options: [{ value: '', label: 'اختر المورد...' }].concat(suppliers.map((s) => ({ value: s.id, label: s.name }))) })}
          ${ui.field({ label: 'تاريخ الفاتورة', name: 'date', type: 'date', value: fmt.today() })}
          ${ui.field({ label: 'مرجع فاتورة المورد', name: 'invoice_ref', placeholder: 'رقم فاتورة المورد' })}
        </div>
        <label class="label mb-2">أصناف الفاتورة</label>
        <div class="search-box mb-2">${App.icon('search')}
          <input class="input" id="pi-search" placeholder="ابحث عن صنف بالاسم أو الباركود لإضافته..." autocomplete="off">
        </div>
        <div id="pi-results" class="mb-3"></div>
        <div id="pi-lines"></div>
        <div class="form-grid three mt-4">
          ${ui.field({ label: 'الخصم', name: 'discount', type: 'number', value: 0, min: 0, step: '0.01' })}
          ${ui.field({ label: 'ضريبة الشراء', name: 'tax', type: 'number', value: 0, min: 0, step: '0.01' })}
          ${ui.field({ label: 'المبلغ المدفوع', name: 'paid', type: 'number', value: 0, min: 0, step: '0.01' })}
          ${ui.field({ label: 'ملاحظات', name: 'notes', type: 'textarea', col: 'span-3', rows: 2 })}
        </div>
        <div class="card card-pad mt-3" style="background:var(--panel-2)">
          <div class="sum-row"><span>الإجمالي الفرعي</span><span class="v" id="pt-sub">0.00</span></div>
          <div class="sum-row"><span>الخصم + الضريبة</span><span class="v" id="pt-adj">0.00</span></div>
          <div class="sum-row total"><span>إجمالي الفاتورة</span><span class="v" id="pt-total">0.00</span></div>
          <div class="sum-row"><span>المتبقي على المورد</span><span class="v text-warning" id="pt-due">0.00</span></div>
        </div>`,
      footer: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${App.icon('save')} حفظ فاتورة الشراء</button>`,
      onMount: (h) => {
        const modalBody = h.el.querySelector('.modal-body');
        const linesEl = modalBody.querySelector('#pi-lines');
        const resultsEl = modalBody.querySelector('#pi-results');
        const searchInput = modalBody.querySelector('#pi-search');
        const discountInput = modalBody.querySelector('[name=discount]');
        const taxInput = modalBody.querySelector('[name=tax]');
        const paidInput = modalBody.querySelector('[name=paid]');

        const totals = () => {
          const sub = Math.round(rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.cost) || 0), 0) * 100) / 100;
          const disc = Math.min(Number(discountInput.value) || 0, sub);
          const tax = Number(taxInput.value) || 0;
          const total = Math.round((sub - disc + tax) * 100) / 100;
          const paid = Math.min(Number(paidInput.value) || 0, total);
          modalBody.querySelector('#pt-sub').textContent = fmt.money(sub);
          modalBody.querySelector('#pt-adj').textContent = fmt.money(tax - disc);
          modalBody.querySelector('#pt-total').textContent = fmt.money(total);
          modalBody.querySelector('#pt-due').textContent = fmt.money(Math.max(0, total - paid));
          return { sub, disc, tax, total, paid };
        };

        const paint = () => {
          if (!rows.length) {
            linesEl.innerHTML = `<div class="empty" style="padding:26px"><div class="icon-wrap">${App.icon('boxOpen', 26)}</div><h4>لم تُضف أصناف بعد</h4><p>ابحث عن صنف بالأعلى لإضافته إلى الفاتورة.</p></div>`;
          } else {
            linesEl.innerHTML = `<div class="table-wrap"><table class="table compact">
              <thead><tr><th>الصنف</th><th style="width:90px">الكمية</th><th style="width:110px">التكلفة</th><th style="width:120px">الدفعة</th><th style="width:140px">الصلاحية</th><th style="width:110px">الإجمالي</th><th></th></tr></thead>
              <tbody>${rows.map((r, i) => `<tr>
                <td><div class="cell-title">${App.esc(r.name)}</div><div class="cell-sub">${App.esc(r.unit || '')}</div></td>
                <td><input class="input sm num" data-i="${i}" data-f="qty" type="number" min="0.01" step="0.01" value="${r.qty}"></td>
                <td><input class="input sm num" data-i="${i}" data-f="cost" type="number" min="0" step="0.01" value="${r.cost}"></td>
                <td><input class="input sm ltr" data-i="${i}" data-f="batch_no" value="${App.esc(r.batch_no)}" placeholder="B-001"></td>
                <td><input class="input sm" data-i="${i}" data-f="expiry_date" type="date" value="${r.expiry_date || ''}"></td>
                <td class="num"><b>${fmt.money(Number(r.qty) * Number(r.cost))}</b></td>
                <td><button class="btn icon sm" data-rm="${i}" style="color:var(--danger)">${App.icon('trash', 14)}</button></td>
              </tr>`).join('')}</tbody></table></div>`;
            linesEl.querySelectorAll('[data-f]').forEach((inp) => {
              inp.onchange = () => {
                const r = rows[Number(inp.dataset.i)];
                r[inp.dataset.f] = inp.dataset.f === 'qty' || inp.dataset.f === 'cost' ? Number(inp.value) || 0 : inp.value.trim();
                paint();
              };
            });
            linesEl.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { rows.splice(Number(b.dataset.rm), 1); paint(); });
          }
          totals();
        };

        const addProduct = (p) => {
          if (rows.some((r) => r.product_id === p.id)) {
            const r = rows.find((x) => x.product_id === p.id);
            r.qty = Number(r.qty) + 1;
          } else {
            rows.push({ product_id: p.id, name: p.name, unit: p.unit, qty: 1, cost: Number(p.cost) || 0, batch_no: '', expiry_date: '' });
          }
          resultsEl.innerHTML = '';
          searchInput.value = '';
          paint();
        };

        const doSearch = async () => {
          const q = searchInput.value.trim();
          if (!q) { resultsEl.innerHTML = ''; return; }
          try {
            const r = await App.api('/products?search=' + encodeURIComponent(q) + '&perPage=8');
            resultsEl.innerHTML = r.items.length ? `<div class="card" style="overflow:hidden">${r.items.map((p) => `
              <button class="pal-item" data-add-p="${p.id}" style="width:100%;border:0;border-bottom:1px solid var(--border);background:none;text-align:start">
                ${App.icon('pill')}<span>${App.esc(p.name)}</span>
                <span class="sub">${fmt.money(p.cost)} · مخزون ${fmt.qty(p.stock)}</span>
              </button>`).join('')}</div>` : `<div class="small muted">لا توجد نتائج</div>`;
            resultsEl.querySelectorAll('[data-add-p]').forEach((b) => {
              const p = r.items.find((x) => String(x.id) === b.dataset.addP);
              b.onclick = () => addProduct(p);
            });
          } catch (_) { /* ignore */ }
        };
        searchInput.oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(doSearch, 260); };
        searchInput.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const first = resultsEl.querySelector('[data-add-p]');
            if (first) first.click();
          }
        };
        [discountInput, taxInput, paidInput].forEach((i) => { i.oninput = totals; });

        h.el.querySelector('[data-save]').onclick = async () => {
          const v = App.formValues(modalBody);
          if (!v.supplier_id) return ui.toast('اختر المورد', 'warning');
          if (!rows.length) return ui.toast('أضف صنفاً واحداً على الأقل', 'warning');
          if (rows.some((r) => !r.qty || r.qty <= 0)) return ui.toast('تحقق من كميات الأصناف', 'warning');
          const t = totals();
          const btn = h.el.querySelector('[data-save]');
          btn.disabled = true;
          try {
            await App.api('/purchases', {
              method: 'POST',
              body: {
                supplier_id: Number(v.supplier_id), date: v.date, discount: t.disc, tax: t.tax, paid: t.paid,
                invoice_ref: v.invoice_ref || '', notes: v.notes || '',
                items: rows.map((r) => ({ product_id: r.product_id, qty: r.qty, cost: r.cost, batch_no: r.batch_no, expiry_date: r.expiry_date || null }))
              }
            });
            ui.toast('تم حفظ فاتورة الشراء وإضافة المخزون');
            m.close();
            suppliersCache = null;
            if (onDone) onDone();
          } catch (err) { btn.disabled = false; ui.toast(err.message, 'error'); }
        };
        paint();
        searchInput.focus();
      }
    });
  }

  async function openPurchaseDetail(id, onChange) {
    let p;
    try { p = await getPurchase(id); } catch (err) { return ui.toast(err.message, 'error'); }
    const remaining = Math.max(0, Number(p.total) - Number(p.paid));
    const m = ui.modal({
      title: 'فاتورة شراء ' + p.invoice_no,
      subtitle: `${App.esc(p.supplier_name || '')} · ${fmt.datetime(p.date)}`,
      size: 'lg',
      body: `
        <div class="kpi-strip">
          <div class="item"><div class="label">إجمالي الفاتورة</div><div class="value">${fmt.money(p.total)}</div></div>
          <div class="item"><div class="label">المدفوع</div><div class="value text-success">${fmt.money(p.paid)}</div></div>
          <div class="item"><div class="label">المتبقي</div><div class="value text-warning">${fmt.money(remaining)}</div></div>
          <div class="item"><div class="label">الحالة</div><div class="value" style="font-size:13px">${App.badge(remaining > 0 ? 'partially_paid' : 'paid')}</div></div>
        </div>
        ${ui.table({
          columns: [
            { label: 'الصنف', render: (i) => `<div class="cell-title">${App.esc(i.name)}</div><div class="cell-sub ltr">${App.esc(i.batch_no || '')}</div>` },
            { label: 'الصلاحية', render: (i) => expiryText(i.expiry_date) },
            { label: 'الكمية', tdClass: 'num', render: (i) => fmt.qty(i.qty) },
            { label: 'التكلفة', tdClass: 'num', render: (i) => fmt.money(i.cost) },
            { label: 'الإجمالي', tdClass: 'num', render: (i) => `<b>${fmt.money(i.total)}</b>` }
          ],
          rows: p.items
        })}
        <div class="info-row mt-3"><span class="k">الإجمالي الفرعي</span><span class="v">${fmt.money(p.subtotal)}</span></div>
        <div class="info-row"><span class="k">الخصم</span><span class="v">${fmt.money(p.discount)}</span></div>
        <div class="info-row"><span class="k">الضريبة</span><span class="v">${fmt.money(p.tax)}</span></div>
        <div class="info-row"><span class="k">ملاحظات</span><span class="v">${App.esc(p.notes || '—')}</span></div>`,
      footer: `
        <button class="btn" data-print>${App.icon('printer')} طباعة</button>
        ${remaining > 0 && App.can('purchases.manage') ? `<button class="btn success" data-pay>${App.icon('banknote')} سداد دفعة</button>` : ''}
        ${App.can('purchases.manage') ? `<button class="btn danger" data-return>${App.icon('rotate')} مرتجع مورد</button>` : ''}
        <button class="btn primary" data-close>إغلاق</button>`,
      onMount: (h) => {
        h.el.querySelector('[data-print]').onclick = () => printPurchase(p);
        const payBtn = h.el.querySelector('[data-pay]');
        if (payBtn) payBtn.onclick = () => openPayPurchase(p, () => { m.close(); if (onChange) onChange(); });
        const returnBtn = h.el.querySelector('[data-return]');
        if (returnBtn) returnBtn.onclick = () => { m.close(); openPurchaseReturn(p, onChange); };
      }
    });
  }

  function openPayPurchase(p, onDone) {
    const remaining = Math.max(0, Number(p.total) - Number(p.paid));
    const m = ui.modal({
      title: 'سداد دفعة لمورد',
      subtitle: `${App.esc(p.supplier_name || '')} · المتبقي ${fmt.money(remaining)}`,
      size: 'sm',
      body: `<div class="field"><label class="label">مبلغ الدفعة (${App.currency()})</label>
        <input class="input num" type="number" min="0.01" max="${remaining}" step="0.01" value="${remaining}" data-amount>
        <span class="hint">سيتم خصم المبلغ من مستحقات المورد وتسجيله في الصندوق.</span></div>`,
      footer: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${App.icon('save')} تأكيد السداد</button>`,
      onMount: (h) => {
        h.el.querySelector('[data-save]').onclick = async () => {
          try {
            await App.api(`/purchases/${p.id}/pay`, { method: 'POST', body: { amount: Number(h.el.querySelector('[data-amount]').value) } });
            ui.toast('تم تسجيل الدفعة');
            m.close();
            if (onDone) onDone();
          } catch (err) { ui.toast(err.message, 'error'); }
        };
      }
    });
  }

  function openPurchaseReturn(p, onDone) {
    const rows = p.items.map((i) => ({ ...i, return_qty: 0 }));
    const m = ui.modal({
      title: 'مرتجع مشتريات',
      subtitle: 'إرجاع أصناف للمورد وخصمها من المخزون',
      size: 'lg',
      body: `
        <div class="form-grid mb-4">
          ${ui.field({ label: 'طريقة التسوية', name: 'refund_method', type: 'select', value: 'credit', options: [{ value: 'credit', label: 'خصم من مستحقات المورد' }, { value: 'cash', label: 'استرداد نقدي' }] })}
          ${ui.field({ label: 'سبب الإرجاع', name: 'reason', placeholder: 'تالف / قارب الانتهاء / خطأ توريد' })}
        </div>
        ${ui.table({
          columns: [
            { label: 'الصنف', render: (i) => `<div class="cell-title">${App.esc(i.name)}</div><div class="cell-sub ltr">${App.esc(i.batch_no || '')}</div>` },
            { label: 'الكمية المشتراة', tdClass: 'num', render: (i) => fmt.qty(i.qty) },
            { label: 'التكلفة', tdClass: 'num', render: (i) => fmt.money(i.cost) },
            { label: 'كمية الإرجاع', render: (i) => `<input class="input sm num" data-ret="${i.product_id}" type="number" min="0" max="${i.qty}" step="0.01" value="0" style="width:100px">` }
          ],
          rows: p.items
        })}`,
      footer: `<button class="btn" data-close>إلغاء</button><button class="btn danger" data-save>${App.icon('rotate')} تنفيذ المرتجع</button>`,
      onMount: (h) => {
        h.el.querySelector('[data-save]').onclick = async () => {
          const method = h.el.querySelector('[name=refund_method]').value;
          const reason = h.el.querySelector('[name=reason]').value;
          const items = [...h.el.querySelectorAll('[data-ret]')]
            .map((inp) => ({ product_id: Number(inp.dataset.ret), qty: Number(inp.value) || 0 }))
            .filter((x) => x.qty > 0);
          if (!items.length) return ui.toast('حدد كمية صنف واحد على الأقل', 'warning');
          try {
            await App.api(`/purchases/${p.id}/return`, { method: 'POST', body: { items, refund_method: method, reason } });
            ui.toast('تم تسجيل مرتجع المشتريات');
            m.close();
            if (onDone) onDone();
          } catch (err) { ui.toast(err.message, 'error'); }
        };
      }
    });
  }

  function printPurchase(p) {
    const rows = p.items.map((i) => `<tr><td>${App.esc(i.name)}</td><td>${App.esc(i.batch_no || '')}</td>
      <td>${fmt.date(i.expiry_date)}</td><td class="num">${fmt.qty(i.qty)}</td><td class="num">${fmt.money(i.cost)}</td>
      <td class="num">${fmt.money(i.total)}</td></tr>`).join('');
    App.printA4('فاتورة شراء ' + p.invoice_no, `
      <h1>فاتورة مشتريات</h1>
      <div class="small">رقم الفاتورة: ${App.esc(p.invoice_no)} · التاريخ: ${fmt.datetime(p.date)}</div>
      <div class="small">المورد: ${App.esc(p.supplier_name || '—')} · المسؤول: ${App.esc(p.user_name || '')}</div>
      <table><thead><tr><th>الصنف</th><th>الدفعة</th><th>الصلاحية</th><th>الكمية</th><th>التكلفة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals">
        <div class="row"><span>الإجمالي الفرعي</span><b>${fmt.money(p.subtotal)}</b></div>
        <div class="row"><span>الخصم</span><b>${fmt.money(p.discount)}</b></div>
        <div class="row"><span>الضريبة</span><b>${fmt.money(p.tax)}</b></div>
        <div class="row grand"><span>الإجمالي</span><b>${fmt.money(p.total)}</b></div>
        <div class="row"><span>المدفوع</span><b>${fmt.money(p.paid)}</b></div>
        <div class="row"><span>المتبقي</span><b>${fmt.money(Math.max(0, p.total - p.paid))}</b></div>
      </div>`);
  }

  async function renderPurchases(container, params) {
    const suppliers = await getSuppliers(true).catch(() => []);
    const state = { search: '', supplier: '', unpaid: false, page: 1 };

    container.innerHTML = `
      ${ui.pageHead({
        title: 'المشتريات والتوريد',
        subtitle: 'فواتير الشراء، دفعات التوريد، والمدفوعات للموردين',
        actions: `${App.can('purchases.manage') ? `<button class="btn primary" data-new>${App.icon('plus')} فاتورة شراء</button>` : ''}`
      })}
      <div class="card">
        <div class="toolbar">
          <div class="search-box" style="flex:1;min-width:240px;max-width:360px">${App.icon('search')}
            <input class="input" id="pur-search" placeholder="رقم الفاتورة أو اسم المورد...">
          </div>
          <select class="select" id="pur-supplier" style="width:190px"><option value="">كل الموردين</option>${suppliers.map((s) => `<option value="${s.id}">${App.esc(s.name)}</option>`).join('')}</select>
          <label class="check" style="font-size:12.5px"><input type="checkbox" id="pur-unpaid"> غير المسددة فقط</label>
          <button class="btn icon" data-reload title="تحديث">${App.icon('refresh')}</button>
        </div>
        <div id="pur-table"><div class="loading-block"><span class="spinner"></span> جارٍ التحميل...</div></div>
      </div>`;

    const tableEl = container.querySelector('#pur-table');
    const searchEl = container.querySelector('#pur-search');

    async function load() {
      const qs = new URLSearchParams({ page: state.page, perPage: 25 });
      if (state.search) qs.set('search', state.search);
      if (state.supplier) qs.set('supplier', state.supplier);
      if (state.unpaid) qs.set('status', 'unpaid');
      try {
        const r = await App.api('/purchases?' + qs.toString());
        tableEl.innerHTML = ui.table({
          columns: [
            { label: 'الفاتورة', render: (p) => `<div class="cell-title ltr">${App.esc(p.invoice_no)}</div><div class="cell-sub">${fmt.date(p.date)} · ${p.items_count} صنف</div>` },
            { label: 'المورد', render: (p) => `<span class="bold">${App.esc(p.supplier_name || '—')}</span>` },
            { label: 'الإجمالي', tdClass: 'num', render: (p) => `<b>${fmt.money(p.total)}</b>` },
            { label: 'المدفوع', tdClass: 'num', render: (p) => `<span class="text-success">${fmt.money(p.paid)}</span>` },
            { label: 'المتبقي', tdClass: 'num', render: (p) => { const d = p.total - p.paid; return d > 0.009 ? `<span class="text-warning bold">${fmt.money(d)}</span>` : '<span class="muted">—</span>'; } },
            { label: 'الحالة', render: (p) => App.badge(p.total - p.paid > 0.009 ? 'partially_paid' : 'paid') },
            { label: '', tdClass: 'actions', render: (p) => `<button class="btn icon sm" data-view="${p.id}" title="عرض">${App.icon('eye', 14)}</button>
              <button class="btn icon sm" data-print="${p.id}" title="طباعة">${App.icon('printer', 14)}</button>` }
          ],
          rows: r.items,
          empty: ui.empty({ icon: 'truck', title: 'لا توجد فواتير شراء', text: 'ابدأ بتسجيل فاتورة توريد جديدة.' })
        }) + ui.pager(r);
        ui.bindPager(tableEl, (p) => { state.page = p; load(); });
        tableEl.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => openPurchaseDetail(Number(b.dataset.view), load));
        tableEl.querySelectorAll('[data-print]').forEach((b) => b.onclick = async () => {
          try { printPurchase(await getPurchase(Number(b.dataset.print))); } catch (err) { ui.toast(err.message, 'error'); }
        });
      } catch (err) {
        tableEl.innerHTML = `<div class="card-pad">${ui.empty({ icon: 'alert', title: 'تعذر تحميل المشتريات', text: App.esc(err.message) })}</div>`;
      }
    }

    let t = null;
    searchEl.oninput = () => { clearTimeout(t); t = setTimeout(() => { state.search = searchEl.value.trim(); state.page = 1; load(); }, 280); };
    container.querySelector('#pur-supplier').onchange = (e) => { state.supplier = e.target.value; state.page = 1; load(); };
    container.querySelector('#pur-unpaid').onchange = (e) => { state.unpaid = e.target.checked; state.page = 1; load(); };
    container.querySelector('[data-reload]').onclick = () => { suppliersCache = null; load(); };
    const newBtn = container.querySelector('[data-new]');
    if (newBtn) newBtn.onclick = () => openPurchaseForm(load);

    await load();
    if (params.new && App.can('purchases.manage')) setTimeout(() => openPurchaseForm(load), 80);
  }

  /* ================================================================== */
  /*                         SUPPLIERS VIEW                             */
  /* ================================================================== */
  function supplierFormModal(supplier, onDone) {
    const s = supplier || {};
    const m = ui.modal({
      title: supplier ? 'تعديل مورد' : 'إضافة مورد جديد',
      size: 'md',
      body: `<div class="form-grid">
        ${ui.field({ label: 'اسم المورد', name: 'name', value: s.name || '', required: true, col: 'span-2' })}
        ${ui.field({ label: 'مسؤول التواصل', name: 'contact_name', value: s.contact_name || '' })}
        ${ui.field({ label: 'الهاتف', name: 'phone', value: s.phone || '', type: 'tel' })}
        ${ui.field({ label: 'البريد الإلكتروني', name: 'email', value: s.email || '', type: 'email' })}
        ${ui.field({ label: 'الرقم الضريبي', name: 'tax_no', value: s.tax_no || '' })}
        ${ui.field({ label: 'العنوان', name: 'address', value: s.address || '', col: 'span-2' })}
        ${ui.field({ label: 'رصيد افتتاحي', name: 'opening_balance', value: s.opening_balance || 0, type: 'number', step: '0.01' })}
        ${ui.field({ label: 'نشط', name: 'active', type: 'switch', value: supplier ? !!s.active : true, hint: 'الموردون غير النشطين لا يظهرون في الفواتير' })}
        ${ui.field({ label: 'ملاحظات', name: 'notes', value: s.notes || '', type: 'textarea', col: 'span-2', rows: 2 })}
      </div>`,
      footer: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${App.icon('save')} حفظ</button>`,
      onMount: (h) => {
        h.el.querySelector('[data-save]').onclick = async () => {
          const form = h.el.querySelector('.modal-body');
          const v = App.formValues(form);
          v.active = form.querySelector('[name=active]').checked ? 1 : 0;
          v.opening_balance = Number(v.opening_balance) || 0;
          if (!v.name) return ui.toast('اسم المورد مطلوب', 'warning');
          try {
            if (supplier) await App.api('/suppliers/' + supplier.id, { method: 'PUT', body: v });
            else await App.api('/suppliers', { method: 'POST', body: v });
            ui.toast('تم حفظ بيانات المورد');
            suppliersCache = null;
            m.close();
            if (onDone) onDone();
          } catch (err) { ui.toast(err.message, 'error'); }
        };
      }
    });
  }

  async function openSupplierDetail(id, onDone) {
    let r;
    try { r = await App.api('/suppliers/' + id); } catch (err) { return ui.toast(err.message, 'error'); }
    const s = r.supplier;
    const body = `
      <div class="flex items-center gap-3 mb-4">
        <div class="stat-icon" style="width:48px;height:48px;border-radius:13px">${App.icon('truck', 23)}</div>
        <div><div class="bold" style="font-size:16px">${App.esc(s.name)}</div>
          <div class="small muted">${App.esc([s.contact_name, s.phone].filter(Boolean).join(' · ') || 'مورد')}</div></div>
        <div style="margin-inline-start:auto">${s.active ? '<span class="badge success">نشط</span>' : '<span class="badge">موقوف</span>'}</div>
      </div>
      <div class="info-row"><span class="k">الهاتف</span><span class="v ltr">${App.esc(s.phone || '—')}</span></div>
      <div class="info-row"><span class="k">البريد</span><span class="v">${App.esc(s.email || '—')}</span></div>
      <div class="info-row"><span class="k">العنوان</span><span class="v">${App.esc(s.address || '—')}</span></div>
      <div class="info-row"><span class="k">الرقم الضريبي</span><span class="v ltr">${App.esc(s.tax_no || '—')}</span></div>
      <div class="info-row"><span class="k">الرصيد المستحق</span><span class="v ${Number(r.balance) > 0 ? 'text-warning' : 'text-success'} bold">${fmt.money(r.balance)}</span></div>
      <hr class="hr">
      <h4 class="mb-3" style="font-size:13px">${App.icon('truck', 15)} فواتير التوريد (${r.purchases.length})</h4>
      ${r.purchases.length ? ui.table({
        className: 'compact',
        columns: [
          { label: 'الفاتورة', render: (p) => `<span class="ltr">${App.esc(p.invoice_no)}</span>` },
          { label: 'التاريخ', render: (p) => fmt.date(p.date) },
          { label: 'الإجمالي', tdClass: 'num', render: (p) => fmt.money(p.total) },
          { label: 'المتبقي', tdClass: 'num', render: (p) => p.total - p.paid > 0.009 ? `<span class="text-warning">${fmt.money(p.total - p.paid)}</span>` : '—' }
        ],
        rows: r.purchases.slice(0, 10)
      }) : ui.empty({ icon: 'truck', title: 'لا توجد فواتير' })}
      ${r.returns.length ? `<h4 class="mb-3 mt-4" style="font-size:13px">${App.icon('rotate', 15)} المرتجعات</h4>
      ${ui.table({ className: 'compact', columns: [
        { label: 'المرتجع', render: (x) => `<span class="ltr">${App.esc(x.return_no)}</span>` },
        { label: 'التاريخ', render: (x) => fmt.date(x.date) },
        { label: 'القيمة', tdClass: 'num', render: (x) => fmt.money(x.total) }
      ], rows: r.returns }) }` : ''}`;
    const d = ui.drawer({ title: 'بطاقة المورد', width: 600, body });
    const head = d.el.querySelector('.drawer-head');
    const actions = document.createElement('div');
    actions.className = 'flex gap-1';
    actions.style.marginInlineStart = 'auto';
    actions.innerHTML = `${App.can('suppliers.manage') ? `<button class="btn icon sm" data-edit>${App.icon('edit', 15)}</button>` : ''}`;
    head.insertBefore(actions, head.querySelector('[data-close]'));
    const edit = actions.querySelector('[data-edit]');
    if (edit) edit.onclick = () => supplierFormModal(s, () => { d.close(); if (onDone) onDone(); });
  }

  async function renderSuppliers(container, params) {
    const state = { search: '', page: 1 };
    container.innerHTML = `
      ${ui.pageHead({
        title: 'الموردون',
        subtitle: 'بيانات الموردين والأرصدة وفواتير التوريد',
        actions: `${App.can('suppliers.manage') ? `<button class="btn primary" data-new>${App.icon('userPlus')} مورد جديد</button>` : ''}`
      })}
      <div class="card">
        <div class="toolbar">
          <div class="search-box" style="flex:1;max-width:360px">${App.icon('search')}
            <input class="input" id="sup-search" placeholder="بحث بالاسم أو الهاتف أو مسؤول التواصل...">
          </div>
          <button class="btn icon" data-reload>${App.icon('refresh')}</button>
        </div>
        <div id="sup-table"><div class="loading-block"><span class="spinner"></span> جارٍ التحميل...</div></div>
      </div>`;
    const tableEl = container.querySelector('#sup-table');

    async function load() {
      const qs = new URLSearchParams();
      if (state.search) qs.set('search', state.search);
      try {
        const r = await App.api('/suppliers?' + qs.toString());
        tableEl.innerHTML = ui.table({
          columns: [
            { label: 'المورد', render: (s) => `<div class="main-cell"><div class="avatar sm" style="background:var(--accent)">${App.esc(s.name.charAt(0))}</div>
              <div><div class="cell-title">${App.esc(s.name)}</div><div class="cell-sub">${App.esc(s.contact_name || '')}</div></div></div>` },
            { label: 'الهاتف', render: (s) => `<span class="ltr">${App.esc(s.phone || '—')}</span>` },
            { label: 'فواتير التوريد', tdClass: 'num', render: (s) => fmt.number(s.purchases_count, 0) },
            { label: 'إجمالي المشتريات', tdClass: 'num', render: (s) => fmt.money(s.purchases_total) },
            { label: 'الرصيد المستحق', tdClass: 'num', render: (s) => Number(s.balance) > 0.009 ? `<b class="text-warning">${fmt.money(s.balance)}</b>` : '<span class="badge success">مسدد</span>' },
            { label: '', tdClass: 'actions', render: (s) => `<button class="btn icon sm" data-view="${s.id}" title="عرض">${App.icon('eye', 14)}</button>
              ${App.can('suppliers.manage') ? `<button class="btn icon sm" data-edit="${s.id}" title="تعديل">${App.icon('edit', 14)}</button>` : ''}` }
          ],
          rows: r.items,
          empty: ui.empty({ icon: 'truck', title: 'لا يوجد موردون', text: 'أضف موردك الأول لبدء تسجيل المشتريات.' })
        });
        tableEl.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => openSupplierDetail(Number(b.dataset.view), load));
        tableEl.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => {
          const s = r.items.find((x) => String(x.id) === b.dataset.edit);
          supplierFormModal(s, () => { suppliersCache = null; load(); });
        });
      } catch (err) {
        tableEl.innerHTML = `<div class="card-pad">${ui.empty({ icon: 'alert', title: 'تعذر تحميل الموردين', text: App.esc(err.message) })}</div>`;
      }
    }

    let t = null;
    container.querySelector('#sup-search').oninput = (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.search = e.target.value.trim(); load(); }, 280);
    };
    container.querySelector('[data-reload]').onclick = () => { suppliersCache = null; load(); };
    const newBtn = container.querySelector('[data-new]');
    if (newBtn) newBtn.onclick = () => supplierFormModal(null, () => { suppliersCache = null; load(); });

    await load();
    if (params.new && App.can('suppliers.manage')) setTimeout(() => supplierFormModal(null, load), 80);
  }

  App.register('products', { title: 'الأصناف والأدوية', subtitle: 'كتالوج الأدوية والأسعار والباركود', perm: 'products.view', render: renderProducts });
  App.register('inventory', { title: 'المخزون والصلاحية', subtitle: 'الأرصدة والدفعات وحركات المخزون', perm: 'products.view', render: renderInventory });
  App.register('purchases', { title: 'المشتريات', subtitle: 'فواتير التوريد والموردون', perm: 'purchases.view', render: renderPurchases });
  App.register('suppliers', { title: 'الموردون', subtitle: 'بيانات الموردين والأرصدة', perm: 'suppliers.manage', render: renderSuppliers });
})();
