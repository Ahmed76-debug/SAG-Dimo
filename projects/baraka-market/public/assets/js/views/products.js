/* ============================================================
   المنتجات — الأصناف، الأسعار، التصنيفات
   ============================================================ */
import { state, api, can, icon, esc, fmt, debounce } from '../core.js';
import { toast, modal, openForm, confirmDialog, emptyState, pager } from '../ui.js';
import { stockBadge, exportCsv, metric } from './_shared.js';

const price = (v) => fmt.money(v);

export async function render(root, { params } = {}) {
  let alive = true;
  const filters = { search: '', category: '', stock: '', page: 1, limit: 20 };

  root.innerHTML = `
    <div class="kpis" id="prod-stats">
      ${Array(4).fill('<div class="skeleton" style="height:108px;border-radius:18px"></div>').join('')}
    </div>
    <div class="card flush mt-3">
      <div class="toolbar">
        <div class="input-icon">${icon('search')}
          <input class="input" id="prod-search" placeholder="ابحث بالاسم أو الباركود أو الكود…" autocomplete="off" />
        </div>
        <select class="select" id="prod-cat" aria-label="التصنيف">
          <option value="">كل التصنيفات</option>
          ${(state.categories || []).map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
        <select class="select" id="prod-stock" aria-label="حالة المخزون">
          <option value="">كل الحالات</option>
          <option value="low">مخزون منخفض</option>
          <option value="out">نفد من المخزون</option>
          <option value="expiring">قرب انتهاء الصلاحية</option>
        </select>
        <div class="spacer"></div>
        ${can('products.manage') ? `<button class="btn btn-secondary btn-sm" data-categories>${icon('tag')} التصنيفات</button>` : ''}
        <button class="btn btn-secondary btn-sm" data-export>${icon('download')} تصدير</button>
        ${can('products.manage') ? `<button class="btn btn-primary btn-sm" data-new>${icon('plus')} منتج جديد</button>` : ''}
      </div>
      <div id="prod-results">
        <div style="padding:16px">${Array(6).fill('<div class="skeleton" style="height:46px;border-radius:9px;margin-bottom:8px"></div>').join('')}</div>
      </div>
    </div>`;

  async function loadStats() {
    if (!alive) return;
    try {
      const [all, low, out, exp] = await Promise.all([
        api('/products?limit=1'),
        api('/products?stock=low&limit=1'),
        api('/products?stock=out&limit=1'),
        api('/products?stock=expiring&limit=1'),
      ]);
      if (!alive) return;
      const el = root.querySelector('#prod-stats');
      if (!el) return;
      el.innerHTML = [
        metric({ label: 'إجمالي الأصناف', value: fmt.int(all.total), unit: 'صنف', iconName: 'box', foot: '<span class="muted">نشطة في الكتالوج</span>' }),
        metric({ label: 'مخزون منخفض', value: fmt.int(low.total), unit: 'صنف', iconName: 'alert', color: 'var(--warn)', soft: 'var(--warn-soft)', foot: '<a class="btn-link" href="#/inventory?filter=low">مراجعة</a>' }),
        metric({ label: 'نفد من المخزون', value: fmt.int(out.total), unit: 'صنف', iconName: 'x-circle', color: 'var(--danger)', soft: 'var(--danger-soft)', foot: '<a class="btn-link" href="#/inventory?filter=out">مراجعة</a>' }),
        metric({ label: 'قرب انتهاء الصلاحية', value: fmt.int(exp.total), unit: 'صنف', iconName: 'clock', color: 'var(--info)', soft: 'var(--info-soft)', foot: '<span class="muted">خلال 30 يومًا</span>' }),
      ].join('');
    } catch { /* المؤشرات اختيارية */ }
  }

  async function load(page = filters.page) {
    filters.page = page;
    const qs = new URLSearchParams({ page: String(page), limit: String(filters.limit) });
    if (filters.search) qs.set('search', filters.search);
    if (filters.category) qs.set('category', filters.category);
    if (filters.stock) qs.set('stock', filters.stock);
    try {
      const res = await api('/products?' + qs.toString());
      if (!alive) return;
      paint(res);
    } catch (err) {
      if (!alive) return;
      root.querySelector('#prod-results').innerHTML = `<div class="empty"><div class="empty-ico">${icon('alert')}</div><div class="empty-title">تعذر تحميل المنتجات</div><div class="empty-text">${esc(err.message)}</div></div>`;
    }
  }

  function paint(res) {
    const rows = res.rows || [];
    const results = root.querySelector('#prod-results');
    if (!results) return;
    if (!rows.length) {
      results.innerHTML = emptyState({
        title: filters.search || filters.category || filters.stock ? 'لا توجد نتائج مطابقة' : 'لا توجد منتجات بعد',
        text: filters.search ? `لم نجد منتجًا يطابق «${esc(filters.search)}».` : 'أضف أول صنف ليظهر في الكاشير والمخزون.',
        iconName: 'box',
        action: can('products.manage') ? '<button class="btn btn-primary" data-new>إضافة منتج</button>' : '',
      });
      bindInnerActions(results);
      return;
    }
    results.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr>
        <th>الصنف</th><th>الباركود</th><th>التصنيف</th><th>سعر البيع</th><th>التكلفة</th>
        <th>المخزون</th><th>الحالة</th><th></th>
      </tr></thead>
      <tbody>${rows.map((p) => {
        const color = p.category_color || 'var(--brand)';
        const stock = Number(p.stock) || 0;
        const pct = p.min_stock > 0 ? Math.min(100, (stock / p.min_stock) * 100) : (stock > 0 ? 100 : 0);
        return `<tr>
          <td>
            <div class="product-cell">
              <div class="thumb" style="--c:${esc(color)}">${esc((p.name || '؟').slice(0, 2))}</div>
              <div><b>${esc(p.name)}</b><span>${esc(p.unit || 'قطعة')}${p.sku ? ` · ${esc(p.sku)}` : ''}</span></div>
            </div>
          </td>
          <td><span class="small mono" style="direction:ltr;color:var(--text-2)">${esc(p.barcode || '—')}</span></td>
          <td>${p.category_name ? `<span class="badge badge-muted"><i class="badge-dot" style="background:${esc(color)}"></i> ${esc(p.category_name)}</span>` : '<span class="muted">—</span>'}</td>
          <td class="num bolder">${price(p.price)}</td>
          <td class="num muted">${price(p.cost)}</td>
          <td>
            <div class="stock-line">
              <b>${fmt.qty(stock)}</b><span class="unit">${esc(p.unit || '')}</span>
              <div class="bar"><i style="--w:${Math.max(3, pct)}%;background:${stock <= 0 ? 'var(--danger)' : stock <= p.min_stock ? 'var(--warn)' : 'var(--brand)'}"></i></div>
            </div>
          </td>
          <td>${stockBadge(stock, p.min_stock)}</td>
          <td>
            <div class="actions">
              <button class="icon-btn" data-view="${p.id}" title="سجل الحركة">${icon('clock')}</button>
              ${can('inventory.manage') ? `<button class="icon-btn" data-adjust="${p.id}" title="تسوية المخزون">${icon('sliders')}</button>` : ''}
              ${can('products.manage') ? `<button class="icon-btn" data-edit="${p.id}" title="تعديل">${icon('edit')}</button>
              <button class="icon-btn danger" data-del="${p.id}" title="حذف">${icon('trash')}</button>` : ''}
            </div>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
    ${pager({ page: res.page, pages: res.pages, total: res.total, limit: res.limit })}`;

    results.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => load(Number(b.dataset.page))));
    bindInnerActions(results, rows);
  }

  function bindInnerActions(scope, rows = []) {
    const find = (id) => rows.find((r) => String(r.id) === String(id));
    scope.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => openProductForm(null, refresh)));
    scope.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openProductForm(find(b.dataset.edit), refresh)));
    scope.querySelectorAll('[data-adjust]').forEach((b) => b.addEventListener('click', () => openAdjust(find(b.dataset.adjust), refresh)));
    scope.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => openMoves(find(b.dataset.view))));
    scope.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const p = find(b.dataset.del);
      const yes = await confirmDialog({
        title: 'حذف المنتج',
        message: `سيتم حذف «${esc(p.name)}» من الكتالوج مع الاحتفاظ بسجلات البيع السابقة. هل تريد المتابعة؟`,
        confirmText: 'حذف', danger: true, iconName: 'trash',
      });
      if (!yes) return;
      try {
        const res = await api(`/products/${p.id}`, { method: 'DELETE' });
        toast(res.message);
        refresh();
      } catch (e) { toast(e.message, 'error'); }
    }));
  }

  function refresh() {
    load(filters.page);
    loadStats();
  }

  /* ---------- الأحداث ---------- */
  const searchInput = root.querySelector('#prod-search');
  const doSearch = debounce(() => { filters.search = searchInput.value.trim(); load(1); }, 320);
  searchInput.addEventListener('input', doSearch);
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
  root.querySelector('#prod-cat').addEventListener('change', (e) => { filters.category = e.target.value; load(1); });
  root.querySelector('#prod-stock').addEventListener('change', (e) => { filters.stock = e.target.value; load(1); });
  root.querySelector('[data-new]')?.addEventListener('click', () => openProductForm(null, refresh));
  root.querySelector('[data-export]')?.addEventListener('click', async () => {
    try {
      const qs = new URLSearchParams({ limit: '500', page: '1' });
      if (filters.search) qs.set('search', filters.search);
      if (filters.category) qs.set('category', filters.category);
      if (filters.stock) qs.set('stock', filters.stock);
      const res = await api('/products?' + qs.toString());
      exportCsv(`baraka-products-${fmt.today()}.csv`, res.rows, [
        { key: 'name', label: 'المنتج' }, { key: 'barcode', label: 'الباركود' }, { key: 'sku', label: 'الكود' },
        { key: 'category_name', label: 'التصنيف' }, { key: 'unit', label: 'الوحدة' }, { key: 'cost', label: 'التكلفة' },
        { key: 'price', label: 'سعر البيع' }, { key: 'wholesale_price', label: 'سعر الجملة' }, { key: 'stock', label: 'المخزون' },
        { key: 'min_stock', label: 'حد الطلب' }, { key: 'expiry_date', label: 'الصلاحية' },
      ]);
      toast('تم تصدير قائمة المنتجات');
    } catch (e) { toast(e.message, 'error'); }
  });
  root.querySelector('[data-categories]')?.addEventListener('click', () => openCategories(refresh));

  await Promise.all([load(1), loadStats()]);
  if (params?.get('new') && can('products.manage')) {
    setTimeout(() => openProductForm(null, refresh), 250);
  }
  return () => { alive = false; };
}

/* ============================ نموذج المنتج ============================ */
function openProductForm(product, onSaved) {
  const p = product || {};
  const cats = state.categories || [];
  openForm({
    title: product ? 'تعديل المنتج' : 'منتج جديد',
    subtitle: product ? `تحديث بيانات «${p.name}»` : 'أضف صنفًا جديدًا إلى الكتالوج',
    size: 'wide',
    submitText: product ? 'حفظ التعديلات' : 'إضافة المنتج',
    fields: [
      { name: 'name', label: 'اسم المنتج', value: p.name || '', required: true, span: 2, autofocus: true, placeholder: 'مثال: طماطم بلدي' },
      { name: 'barcode', label: 'الباركود', value: p.barcode || '', ltr: true, placeholder: 'امسح الباركود أو اكتبه' },
      { name: 'sku', label: 'كود الصنف', value: p.sku || '', ltr: true, placeholder: 'SKU-001' },
      { name: 'category_id', label: 'التصنيف', type: 'select', value: p.category_id || '', placeholder: 'بدون تصنيف', options: cats.map((c) => ({ value: c.id, label: c.name })) },
      { name: 'unit', label: 'وحدة القياس', type: 'select', value: p.unit || 'قطعة', options: [
        { value: 'قطعة', label: 'قطعة' }, { value: 'كيلو', label: 'كيلو' }, { value: 'جرام', label: 'جرام' },
        { value: 'لتر', label: 'لتر' }, { value: 'علبة', label: 'علبة' }, { value: 'كرتونة', label: 'كرتونة' },
        { value: 'كيس', label: 'كيس' }, { value: 'حزمة', label: 'حزمة' }, { value: 'دستة', label: 'دستة' },
      ] },
      { name: 'cost', label: 'سعر التكلفة', type: 'number', step: '0.01', min: 0, value: p.cost ?? 0, required: true },
      { name: 'price', label: 'سعر البيع', type: 'number', step: '0.01', min: 0, value: p.price ?? 0, required: true },
      { name: 'wholesale_price', label: 'سعر الجملة', type: 'number', step: '0.01', min: 0, value: p.wholesale_price ?? 0 },
      { name: 'min_stock', label: 'حد إعادة الطلب', type: 'number', step: '0.01', min: 0, value: p.min_stock ?? 5, hint: 'تنبيه عند وصول المخزون لهذا الحد' },
      ...(product ? [] : [{ name: 'stock', label: 'المخزون الافتتاحي', type: 'number', step: '0.01', min: 0, value: '', hint: 'يمكن تركها صفرًا والتوريد لاحقًا' }]),
      { name: 'expiry_date', label: 'تاريخ انتهاء الصلاحية', type: 'date', value: (p.expiry_date || '').slice(0, 10) },
      { name: 'notes', label: 'ملاحظات', type: 'textarea', value: p.notes || '', span: 2, rows: 2, placeholder: 'أي تفاصيل إضافية عن الصنف…' },
    ],
    onSubmit: async (v, m) => {
      const body = { ...v };
      if (product) delete body.stock;
      const res = product
        ? await api(`/products/${product.id}`, { method: 'PUT', body })
        : await api('/products', { method: 'POST', body });
      toast(res.message);
      m.close();
      if (onSaved) onSaved();
    },
  });
}

/* ============================ تسوية المخزون ============================ */
function openAdjust(product, onSaved) {
  if (!product) return;
  const cur = Number(product.stock) || 0;
  openForm({
    title: 'تسوية المخزون',
    subtitle: `${product.name} — الرصيد الحالي ${fmt.qty(cur)} ${product.unit || ''}`,
    size: 'sm',
    submitText: 'تنفيذ التسوية',
    fields: [
      { name: 'mode', label: 'نوع التسوية', type: 'select', value: 'add', span: 2, options: [
        { value: 'add', label: 'إضافة كمية' }, { value: 'remove', label: 'خصم كمية' }, { value: 'set', label: 'تعيين رصيد جديد' },
      ] },
      { name: 'qty', label: 'الكمية', type: 'number', step: '0.01', min: 0, value: '', required: true, span: 2, autofocus: true },
      { name: 'note', label: 'سبب التسوية', value: '', span: 2, placeholder: 'مثال: جرد دوري أو تالف' },
    ],
    onSubmit: async (v, m) => {
      const res = await api(`/products/${product.id}/adjust`, { method: 'POST', body: v });
      toast(res.message);
      m.close();
      if (onSaved) onSaved();
    },
  });
}

/* ============================ سجل حركة الصنف ============================ */
async function openMoves(product) {
  if (!product) return;
  let data;
  try { data = await api(`/products/${product.id}/moves`); }
  catch (e) { toast(e.message, 'error'); return; }
  const moves = data.rows || [];
  const typeLabels = { sale: 'بيع', purchase: 'توريد', adjust: 'تسوية', return: 'مرتجع', waste: 'تالف', open: 'افتتاحي' };
  modal({
    title: `حركة «${esc(product.name)}»`,
    subtitle: `الرصيد الحالي ${fmt.qty(product.stock)} ${esc(product.unit || '')} · آخر 100 حركة`,
    size: 'wide',
    body: moves.length ? `<div class="table-wrap" style="border:1px solid var(--border);border-radius:12px">
      <table class="table" style="min-width:560px">
        <thead><tr><th>النوع</th><th>الكمية</th><th>الرصيد بعدها</th><th>الملاحظة</th><th>المستخدم</th><th>التاريخ</th></tr></thead>
        <tbody>${moves.map((mv) => `<tr>
          <td><span class="badge ${mv.type === 'sale' ? 'badge-info' : mv.type === 'purchase' ? 'badge-success' : mv.type === 'return' ? 'badge-warn' : 'badge-muted'}">${esc(typeLabels[mv.type] || mv.type)}</span></td>
          <td class="num ${Number(mv.qty) < 0 ? 'text-danger' : 'text-success'} bolder">${Number(mv.qty) > 0 ? '+' : ''}${fmt.qty(mv.qty)}</td>
          <td class="num">${fmt.qty(mv.balance)}</td>
          <td class="small muted">${esc(mv.note || '—')}</td>
          <td class="small">${esc(mv.user_name || '—')}</td>
          <td class="small muted nowrap">${esc(fmt.datetime(mv.created_at))}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : emptyState({ title: 'لا توجد حركات مخزون', text: 'ستظهر الحركات هنا بعد البيع أو التوريد أو التسوية', iconName: 'layers' }),
    footer: '<button class="btn btn-secondary" data-close>إغلاق</button>',
  });
}

/* ============================ التصنيفات ============================ */
async function openCategories(onChanged) {
  let res;
  try { res = await api('/categories'); } catch (e) { toast(e.message, 'error'); return; }
  const cats = res.rows || [];
  const colors = ['#22c55e', '#f97316', '#ef4444', '#3b82f6', '#eab308', '#06b6d4', '#d97706', '#8b5cf6', '#0ea5e9'];
  const m = modal({
    title: 'إدارة التصنيفات',
    subtitle: 'نظّم المنتجات في مجموعات واضحة للكاشير والتقارير',
    size: 'wide',
    body: `<div class="list" style="margin:-6px 0 8px">${cats.length ? cats.map((c) => `<div class="list-row">
        <div class="thumb" style="--c:${esc(c.color)}">${icon('tag')}</div>
        <div class="lr-body"><div class="lr-title">${esc(c.name)}</div><div class="lr-sub">${fmt.int(c.products_count)} منتج</div></div>
        <button class="icon-btn" data-cat-edit="${c.id}" title="تعديل">${icon('edit')}</button>
        <button class="icon-btn danger" data-cat-del="${c.id}" title="حذف">${icon('trash')}</button>
      </div>`).join('') : emptyState({ title: 'لا توجد تصنيفات', text: 'أضف تصنيفًا لتجميع المنتجات', iconName: 'tag' })}</div>`,
    footer: '<button class="btn btn-secondary" data-close>إغلاق</button><button class="btn btn-primary" data-cat-add>' + icon('plus') + ' تصنيف جديد</button>',
    onMount: (mm) => {
      mm.root.querySelector('[data-close]').addEventListener('click', () => mm.close());
      mm.root.querySelector('[data-cat-add]').addEventListener('click', () => catForm(null));
      mm.root.querySelectorAll('[data-cat-edit]').forEach((b) => b.addEventListener('click', () => catForm(cats.find((c) => String(c.id) === b.dataset.catEdit))));
      mm.root.querySelectorAll('[data-cat-del]').forEach((b) => b.addEventListener('click', async () => {
        const c = cats.find((x) => String(x.id) === b.dataset.catDel);
        const yes = await confirmDialog({ title: 'حذف التصنيف', message: `حذف «${esc(c.name)}»؟ لا يمكن حذف تصنيف يحتوي على منتجات.`, danger: true, confirmText: 'حذف', iconName: 'trash' });
        if (!yes) return;
        try {
          const r = await api(`/categories/${c.id}`, { method: 'DELETE' });
          toast(r.message); mm.close(); openCategories(onChanged); onChanged?.();
        } catch (e) { toast(e.message, 'error'); }
      }));
    },
  });

  function catForm(cat) {
    openForm({
      title: cat ? 'تعديل التصنيف' : 'تصنيف جديد',
      size: 'sm',
      submitText: 'حفظ',
      fields: [
        { name: 'name', label: 'اسم التصنيف', value: cat?.name || '', required: true, span: 2, autofocus: true },
        { name: 'color', label: 'اللون', type: 'select', value: cat?.color || colors[0], span: 2, options: colors.map((c) => ({ value: c, label: c })) },
        { name: 'kind', label: 'النوع', type: 'select', value: cat?.kind || 'grocery', span: 2, options: [
          { value: 'grocery', label: 'بقالة' }, { value: 'veg', label: 'خضروات' }, { value: 'fruits', label: 'فواكه' },
          { value: 'meat', label: 'لحوم' }, { value: 'dairy', label: 'ألبان' }, { value: 'drinks', label: 'مشروبات' },
          { value: 'bakery', label: 'مخبوزات' }, { value: 'cleaning', label: 'منظفات' }, { value: 'frozen', label: 'مجمدات' },
        ] },
        { name: 'sort', label: 'ترتيب العرض', type: 'number', value: cat?.sort ?? 99, span: 2 },
      ],
      onSubmit: async (v, fm) => {
        const r = cat ? await api(`/categories/${cat.id}`, { method: 'PUT', body: v }) : await api('/categories', { method: 'POST', body: v });
        toast(r.message); fm.close(); m.close();
        const boot = await api('/bootstrap').catch(() => null);
        if (boot?.categories) state.categories = boot.categories;
        openCategories(onChanged); onChanged?.();
      },
    });
  }
}
