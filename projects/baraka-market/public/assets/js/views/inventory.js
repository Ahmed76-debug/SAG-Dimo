/* ============================================================
   المخزون — الأرصدة، التسويات، سجل الحركة
   ============================================================ */
import { state, api, can, icon, esc, fmt, debounce } from '../core.js';
import { toast, modal, openForm, emptyState, pager } from '../ui.js';
import { stockBadge, exportCsv, metric } from './_shared.js';

export async function render(root, { params } = {}) {
  let alive = true;
  const filters = {
    search: '', category: '', stock: params?.get('filter') || '', page: 1, limit: 25,
  };

  root.innerHTML = `
    <div class="kpis" id="inv-stats">
      ${Array(4).fill('<div class="skeleton" style="height:108px;border-radius:18px"></div>').join('')}
    </div>
    <div class="card flush mt-3">
      <div class="toolbar">
        <div class="input-icon">${icon('search')}
          <input class="input" id="inv-search" placeholder="ابحث عن صنف…" autocomplete="off" />
        </div>
        <select class="select" id="inv-cat" aria-label="التصنيف">
          <option value="">كل التصنيفات</option>
          ${(state.categories || []).map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
        <div class="quick-range" id="inv-filters">
          <button class="${!filters.stock ? 'active' : ''}" data-stock="">الكل</button>
          <button class="${filters.stock === 'low' ? 'active' : ''}" data-stock="low">منخفض</button>
          <button class="${filters.stock === 'out' ? 'active' : ''}" data-stock="out">نفد</button>
          <button class="${filters.stock === 'expiring' ? 'active' : ''}" data-stock="expiring">قرب الانتهاء</button>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-secondary btn-sm" data-export>${icon('download')} تصدير</button>
      </div>
      <div id="inv-results"></div>
    </div>`;

  async function loadStats() {
    try {
      const [all, low, out, exp] = await Promise.all([
        api('/products?limit=1'), api('/products?stock=low&limit=1'),
        api('/products?stock=out&limit=1'), api('/products?stock=expiring&limit=1'),
      ]);
      if (!alive) return;
      const el = root.querySelector('#inv-stats');
      if (!el) return;
      el.innerHTML = [
        metric({ label: 'أصناف مسجلة', value: fmt.int(all.total), unit: 'صنف', iconName: 'layers', foot: '<span class="muted">في المخزون النشط</span>' }),
        metric({ label: 'مخزون منخفض', value: fmt.int(low.total), unit: 'صنف', iconName: 'alert', color: 'var(--warn)', soft: 'var(--warn-soft)', foot: '<span class="muted">تحتاج إعادة طلب</span>' }),
        metric({ label: 'نفد من المخزون', value: fmt.int(out.total), unit: 'صنف', iconName: 'x-circle', color: 'var(--danger)', soft: 'var(--danger-soft)', foot: '<span class="muted">غير متاح للبيع</span>' }),
        metric({ label: 'قرب انتهاء الصلاحية', value: fmt.int(exp.total), unit: 'صنف', iconName: 'clock', color: 'var(--info)', soft: 'var(--info-soft)', foot: '<span class="muted">خلال 30 يومًا</span>' }),
      ].join('');
    } catch {}
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
    } catch (e) {
      if (!alive) return;
      root.querySelector('#inv-results').innerHTML = `<div class="empty"><div class="empty-ico">${icon('alert')}</div><div class="empty-title">تعذر تحميل المخزون</div><div class="empty-text">${esc(e.message)}</div></div>`;
    }
  }

  function paint(res) {
    const rows = res.rows || [];
    const el = root.querySelector('#inv-results');
    if (!el) return;
    if (!rows.length) {
      el.innerHTML = emptyState({
        title: filters.stock === 'low' ? 'لا توجد أصناف منخفضة' : filters.stock === 'out' ? 'لا يوجد صنف نافد' : 'لا توجد نتائج',
        text: filters.stock ? 'كل الأصناف في هذه الفئة بحالة جيدة.' : 'جرّب تغيير البحث أو التصنيف.',
        iconName: filters.stock === 'out' ? 'check-circle' : 'layers',
      });
      return;
    }
    const totalValue = rows.reduce((a, p) => a + (Number(p.stock) || 0) * (Number(p.cost) || 0), 0);
    el.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>الصنف</th><th>التصنيف</th><th>المخزون</th><th>حد الطلب</th><th>قيمة التكلفة</th><th>الصلاحية</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${rows.map((p) => {
        const stock = Number(p.stock) || 0;
        const min = Number(p.min_stock) || 0;
        const value = stock * (Number(p.cost) || 0);
        const pct = min > 0 ? Math.min(100, (stock / Math.max(min, 1)) * 100) : (stock > 0 ? 100 : 0);
        const days = p.expiry_date ? Math.ceil((new Date(p.expiry_date + 'T12:00:00') - new Date()) / 86400000) : null;
        return `<tr>
          <td><div class="product-cell">
            <div class="thumb" style="--c:${esc(p.category_color || 'var(--brand)')}">${esc((p.name || '؟').slice(0, 2))}</div>
            <div><b>${esc(p.name)}</b><span>${esc(p.unit || 'قطعة')}${p.barcode ? ` · ${esc(p.barcode)}` : ''}</span></div>
          </div></td>
          <td>${p.category_name ? `<span class="badge badge-muted">${esc(p.category_name)}</span>` : '<span class="muted">—</span>'}</td>
          <td><div class="stock-line"><b>${fmt.qty(stock)}</b><span class="unit">${esc(p.unit || '')}</span>
            <div class="bar"><i style="--w:${Math.max(3, pct)}%;background:${stock <= 0 ? 'var(--danger)' : stock <= min ? 'var(--warn)' : 'var(--brand)'}"></i></div></div></td>
          <td class="num muted">${fmt.qty(min)}</td>
          <td class="num">${fmt.money(value)}</td>
          <td>${p.expiry_date ? `<span class="small ${days !== null && days <= 7 ? 'text-danger' : days !== null && days <= 30 ? 'text-warn' : 'muted'}">${esc(fmt.date(p.expiry_date))}</span>` : '<span class="muted small">—</span>'}</td>
          <td>${stockBadge(stock, min)}</td>
          <td><div class="actions">
            <button class="icon-btn" data-view="${p.id}" title="سجل الحركة">${icon('clock')}</button>
            ${can('inventory.manage') ? `<button class="icon-btn" data-adjust="${p.id}" title="تسوية">${icon('sliders')}</button>` : ''}
          </div></td>
        </tr>`;
      }).join('')}</tbody>
      <tfoot class="tfoot"><tr><td colspan="4">قيمة مخزون الصفحة (بالتكلفة)</td><td class="num">${fmt.money(totalValue)}</td><td colspan="3"></td></tr></tfoot>
    </table></div>
    ${pager({ page: res.page, pages: res.pages, total: res.total, limit: res.limit })}`;

    el.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => load(Number(b.dataset.page))));
    el.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => openMoves(rows.find((p) => String(p.id) === b.dataset.view))));
    el.querySelectorAll('[data-adjust]').forEach((b) => b.addEventListener('click', () => openAdjust(rows.find((p) => String(p.id) === b.dataset.adjust), refresh)));
  }

  function refresh() { load(); loadStats(); }

  const searchInput = root.querySelector('#inv-search');
  const doSearch = debounce(() => { filters.search = searchInput.value.trim(); load(1); }, 300);
  searchInput.addEventListener('input', doSearch);
  root.querySelector('#inv-cat').addEventListener('change', (e) => { filters.category = e.target.value; load(1); });
  root.querySelector('#inv-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-stock]');
    if (!b) return;
    filters.stock = b.dataset.stock;
    root.querySelectorAll('#inv-filters [data-stock]').forEach((x) => x.classList.toggle('active', x === b));
    load(1);
  });
  root.querySelector('[data-export]').addEventListener('click', async () => {
    try {
      const qs = new URLSearchParams({ limit: '500', page: '1' });
      if (filters.search) qs.set('search', filters.search);
      if (filters.category) qs.set('category', filters.category);
      if (filters.stock) qs.set('stock', filters.stock);
      const res = await api('/products?' + qs.toString());
      exportCsv(`baraka-inventory-${fmt.today()}.csv`, res.rows, [
        { key: 'name', label: 'الصنف' }, { key: 'category_name', label: 'التصنيف' }, { key: 'unit', label: 'الوحدة' },
        { key: 'stock', label: 'المخزون' }, { key: 'min_stock', label: 'حد الطلب' }, { key: 'cost', label: 'التكلفة' },
        { key: 'price', label: 'سعر البيع' }, { key: 'expiry_date', label: 'الصلاحية' },
      ]);
      toast('تم تصدير تقرير المخزون');
    } catch (e) { toast(e.message, 'error'); }
  });

  await Promise.all([load(1), loadStats()]);
  return () => { alive = false; };
}

/* ---------- تسوية ---------- */
function openAdjust(product, onSaved) {
  if (!product) return;
  openForm({
    title: 'تسوية المخزون',
    subtitle: `${product.name} — الرصيد ${fmt.qty(product.stock)} ${product.unit || ''}`,
    size: 'sm',
    submitText: 'تنفيذ التسوية',
    fields: [
      { name: 'mode', label: 'نوع التسوية', type: 'select', value: 'add', span: 2, options: [
        { value: 'add', label: 'إضافة كمية' }, { value: 'remove', label: 'خصم كمية' }, { value: 'set', label: 'تعيين رصيد جديد' },
      ] },
      { name: 'qty', label: 'الكمية', type: 'number', step: '0.01', min: 0, required: true, span: 2, autofocus: true },
      { name: 'note', label: 'سبب التسوية', placeholder: 'جرد دوري، تالف، فرق عد…', span: 2 },
    ],
    onSubmit: async (v, m) => {
      const res = await api(`/products/${product.id}/adjust`, {
        method: 'POST', body: { ...v, branch_id: state.branchId || state.defaultBranchId },
      });
      toast(res.message); m.close(); onSaved?.();
    },
  });
}

/* ---------- حركة الصنف ---------- */
async function openMoves(product) {
  if (!product) return;
  let data;
  try { data = await api(`/products/${product.id}/moves`); } catch (e) { toast(e.message, 'error'); return; }
  const labels = { sale: 'بيع', purchase: 'توريد', adjust: 'تسوية', return: 'مرتجع', waste: 'تالف', open: 'افتتاحي' };
  modal({
    title: `حركة «${esc(product.name)}»`,
    subtitle: `الرصيد الحالي ${fmt.qty(product.stock)} ${esc(product.unit || '')} — آخر 100 حركة`,
    size: 'wide',
    body: data.rows.length ? `<div class="table-wrap" style="border:1px solid var(--border);border-radius:12px"><table class="table" style="min-width:560px">
      <thead><tr><th>النوع</th><th>الكمية</th><th>الرصيد بعدها</th><th>الملاحظة</th><th>المستخدم</th><th>التاريخ</th></tr></thead>
      <tbody>${data.rows.map((mv) => `<tr>
        <td><span class="badge ${mv.type === 'sale' ? 'badge-info' : mv.type === 'purchase' ? 'badge-success' : mv.type === 'return' ? 'badge-warn' : 'badge-muted'}">${esc(labels[mv.type] || mv.type)}</span></td>
        <td class="num bolder ${Number(mv.qty) < 0 ? 'text-danger' : 'text-success'}">${Number(mv.qty) > 0 ? '+' : ''}${fmt.qty(mv.qty)}</td>
        <td class="num">${fmt.qty(mv.balance)}</td>
        <td class="small muted">${esc(mv.note || '—')}</td>
        <td class="small">${esc(mv.user_name || '—')}</td>
        <td class="small muted nowrap">${esc(fmt.datetime(mv.created_at))}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : emptyState({ title: 'لا توجد حركات', text: 'لم تُسجل أي حركة على هذا الصنف بعد', iconName: 'layers' }),
    footer: '<button class="btn btn-secondary" data-close>إغلاق</button>',
  });
}
