/* ============================================================
   العملاء والموردون — الحسابات والمديونيات
   ============================================================ */
import { state, api, can, icon, esc, fmt, debounce, initials } from '../core.js';
import { toast, modal, openForm, confirmDialog, emptyState, pager } from '../ui.js';
import { exportCsv, metric } from './_shared.js';

export async function render(root, { params } = {}) {
  let alive = true;
  let tab = params?.get('tab') === 'suppliers' ? 'suppliers' : 'customers';
  const search = { value: '' };
  const page = { customers: 1, suppliers: 1 };

  root.innerHTML = `
    <div class="kpis" id="contacts-stats">
      ${Array(4).fill('<div class="skeleton" style="height:108px;border-radius:18px"></div>').join('')}
    </div>
    <div class="card flush mt-3">
      <div class="tabs" style="padding:0 16px;margin:0" id="contacts-tabs">
        <button class="tab ${tab === 'customers' ? 'active' : ''}" data-tab="customers">${icon('users', 'icon-sm')} العملاء</button>
        <button class="tab ${tab === 'suppliers' ? 'active' : ''}" data-tab="suppliers">${icon('truck', 'icon-sm')} الموردون</button>
      </div>
      <div class="toolbar">
        <div class="input-icon">${icon('search')}
          <input class="input" id="contacts-search" placeholder="ابحث بالاسم أو رقم الهاتف…" autocomplete="off" />
        </div>
        <div class="spacer"></div>
        <button class="btn btn-secondary btn-sm" data-export>${icon('download')} تصدير</button>
        ${can('contacts.manage') ? `<button class="btn btn-primary btn-sm" data-add>${icon('plus')} <span data-add-label>عميل جديد</span></button>` : ''}
      </div>
      <div id="contacts-results"></div>
    </div>`;

  async function loadStats() {
    try {
      const [c, s] = await Promise.all([api('/customers?limit=1'), api('/suppliers')]);
      if (!alive) return;
      const el = root.querySelector('#contacts-stats');
      if (!el) return;
      const customersDebt = Number(c.summary?.debt) || 0;
      const suppliersDebt = Number(s.summary?.debt) || 0;
      el.innerHTML = [
        metric({ label: 'عملاء مسجلون', value: fmt.int(c.total), unit: 'عميل', iconName: 'users', foot: `<span class="muted">إجمالي مبيعاتهم</span>` }),
        metric({ label: 'مديونيات العملاء', value: fmt.money(customersDebt, false), unit: state.settings.currency, iconName: 'wallet', color: 'var(--warn)', soft: 'var(--warn-soft)', foot: '<span class="muted">مستحقة للتحصيل</span>' }),
        metric({ label: 'الموردون', value: fmt.int((s.rows || []).length), unit: 'مورد', iconName: 'truck', color: 'var(--info)', soft: 'var(--info-soft)', foot: '<span class="muted">شركاء التوريد</span>' }),
        metric({ label: 'مستحقات الموردين', value: fmt.money(suppliersDebt, false), unit: state.settings.currency, iconName: 'receipt', color: 'var(--danger)', soft: 'var(--danger-soft)', foot: '<span class="muted">واجبة السداد</span>' }),
      ].join('');
    } catch {}
  }

  async function load(resetPage = false) {
    if (resetPage) page[tab] = 1;
    const el = root.querySelector('#contacts-results');
    try {
      const qs = new URLSearchParams({ q: search.value, page: String(page[tab]), limit: '50' });
      if (tab === 'customers') {
        const res = await api('/customers?' + qs.toString());
        if (!alive) return;
        page[tab] = res.page;
        paintCustomers(res);
      } else {
        const res = await api('/suppliers?' + qs.toString());
        if (!alive) return;
        page[tab] = 1;
        paintSuppliers(res);
      }
    } catch (e) {
      if (!alive) return;
      el.innerHTML = `<div class="empty"><div class="empty-ico">${icon('alert')}</div><div class="empty-title">تعذر تحميل البيانات</div><div class="empty-text">${esc(e.message)}</div></div>`;
    }
  }

  function paintCustomers(res) {
    const rows = res.rows || [];
    const el = root.querySelector('#contacts-results');
    if (!rows.length) {
      el.innerHTML = emptyState({
        title: search.value ? 'لا يوجد عملاء مطابقون' : 'لا يوجد عملاء بعد',
        text: 'أضف عميلًا لتسجيل المبيعات الآجلة وتتبع مديونيته.',
        iconName: 'users',
        action: can('contacts.manage') ? '<button class="btn btn-primary" data-add>إضافة عميل</button>' : '',
      });
      el.querySelector('[data-add]')?.addEventListener('click', () => openContactForm('customers', refresh));
      return;
    }
    el.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>العميل</th><th>الهاتف</th><th>الفواتير</th><th>إجمالي المبيعات</th><th>المديونية</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${rows.map((c) => {
        const debt = Number(c.balance) || 0;
        return `<tr>
          <td><div class="product-cell">
            <div class="thumb" style="--c:${debt > 0 ? 'var(--warn)' : 'var(--brand)'}">${esc(initials(c.name))}</div>
            <div><b>${esc(c.name)}</b><span>${esc(c.address || 'بدون عنوان')}</span></div>
          </div></td>
          <td><span class="small" style="direction:ltr;display:inline-block">${esc(c.phone || '—')}</span></td>
          <td class="num muted">${fmt.int(c.invoices_count)}</td>
          <td class="num">${fmt.money(c.total_sales)}</td>
          <td class="num ${debt > 0 ? 'text-warn bolder' : 'muted'}">${debt > 0 ? fmt.money(debt) : '—'}</td>
          <td>${debt > 0 ? '<span class="badge badge-warn">مديونية</span>' : '<span class="badge badge-success">مسدد</span>'}</td>
          <td><div class="actions">
            <button class="icon-btn" data-statement="${c.id}" title="كشف الحساب">${icon('receipt')}</button>
            ${can('treasury.manage') && debt > 0 ? `<button class="icon-btn" data-pay="${c.id}" title="تحصيل">${icon('cash')}</button>` : ''}
            ${can('contacts.manage') ? `<button class="icon-btn" data-edit="${c.id}" title="تعديل">${icon('edit')}</button>
            <button class="icon-btn danger" data-del="${c.id}" title="حذف">${icon('trash')}</button>` : ''}
          </div></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
    ${pager({ page: res.page, pages: res.pages, total: res.total, limit: res.limit })}`;

    el.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => { page[tab] = Number(b.dataset.page); load(); }));
    el.querySelectorAll('[data-statement]').forEach((b) => b.addEventListener('click', () => openStatement(b.dataset.statement, refresh)));
    el.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => openPay('customers', rows.find((c) => String(c.id) === b.dataset.pay), refresh)));
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openContactForm('customers', refresh, rows.find((c) => String(c.id) === b.dataset.edit))));
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => deleteContact('customers', rows.find((c) => String(c.id) === b.dataset.del), refresh)));
  }

  function paintSuppliers(res) {
    const rows = res.rows || [];
    const el = root.querySelector('#contacts-results');
    if (!rows.length) {
      el.innerHTML = emptyState({
        title: search.value ? 'لا يوجد موردون مطابقون' : 'لا يوجد موردون بعد',
        text: 'أضف الموردين لتسجيل فواتير التوريد ومتابعة المستحقات.',
        iconName: 'truck',
        action: can('contacts.manage') ? '<button class="btn btn-primary" data-add>إضافة مورد</button>' : '',
      });
      el.querySelector('[data-add]')?.addEventListener('click', () => openContactForm('suppliers', refresh));
      return;
    }
    el.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>المورد</th><th>الهاتف</th><th>فواتير التوريد</th><th>المستحقات</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${rows.map((s) => {
        const debt = Number(s.balance) || 0;
        return `<tr>
          <td><div class="product-cell">
            <div class="thumb" style="--c:${debt > 0 ? 'var(--danger)' : 'var(--info)'}">${esc(initials(s.name))}</div>
            <div><b>${esc(s.name)}</b><span>${esc(s.address || 'بدون عنوان')}</span></div>
          </div></td>
          <td><span class="small" style="direction:ltr;display:inline-block">${esc(s.phone || '—')}</span></td>
          <td class="num muted">${fmt.int(s.invoices_count)}</td>
          <td class="num ${debt > 0 ? 'text-danger bolder' : 'muted'}">${debt > 0 ? fmt.money(debt) : '—'}</td>
          <td>${debt > 0 ? '<span class="badge badge-danger">مستحق</span>' : '<span class="badge badge-success">مسدد</span>'}</td>
          <td><div class="actions">
            ${can('treasury.manage') && debt > 0 ? `<button class="icon-btn" data-pay="${s.id}" title="سداد">${icon('cash')}</button>` : ''}
            ${can('contacts.manage') ? `<button class="icon-btn" data-edit="${s.id}" title="تعديل">${icon('edit')}</button>
            <button class="icon-btn danger" data-del="${s.id}" title="حذف">${icon('trash')}</button>` : ''}
          </div></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
    el.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => openPay('suppliers', rows.find((s) => String(s.id) === b.dataset.pay), refresh)));
    el.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openContactForm('suppliers', refresh, rows.find((s) => String(s.id) === b.dataset.edit))));
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => deleteContact('suppliers', rows.find((s) => String(s.id) === b.dataset.del), refresh)));
  }

  function refresh() { load(); loadStats(); }

  /* ---------- التبويبات ---------- */
  root.querySelector('#contacts-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b || b.dataset.tab === tab) return;
    tab = b.dataset.tab;
    search.value = '';
    root.querySelector('#contacts-search').value = '';
    root.querySelectorAll('#contacts-tabs [data-tab]').forEach((x) => x.classList.toggle('active', x === b));
    const label = root.querySelector('[data-add-label]');
    if (label) label.textContent = tab === 'customers' ? 'عميل جديد' : 'مورد جديد';
    history.replaceState(null, '', `#/contacts?tab=${tab}`);
    load(true);
  });

  const searchInput = root.querySelector('#contacts-search');
  searchInput.addEventListener('input', debounce(() => { search.value = searchInput.value.trim(); load(true); }, 300));
  root.querySelector('[data-add]')?.addEventListener('click', () => openContactForm(tab, refresh));
  root.querySelector('[data-export]').addEventListener('click', async () => {
    try {
      if (tab === 'customers') {
        const res = await api('/customers?limit=200&q=' + encodeURIComponent(search.value));
        exportCsv(`baraka-customers-${fmt.today()}.csv`, res.rows, [
          { key: 'name', label: 'العميل' }, { key: 'phone', label: 'الهاتف' }, { key: 'address', label: 'العنوان' },
          { key: 'invoices_count', label: 'الفواتير' }, { key: 'total_sales', label: 'إجمالي المبيعات' }, { key: 'balance', label: 'المديونية' },
        ]);
      } else {
        const res = await api('/suppliers?q=' + encodeURIComponent(search.value));
        exportCsv(`baraka-suppliers-${fmt.today()}.csv`, res.rows, [
          { key: 'name', label: 'المورد' }, { key: 'phone', label: 'الهاتف' }, { key: 'address', label: 'العنوان' },
          { key: 'invoices_count', label: 'فواتير التوريد' }, { key: 'balance', label: 'المستحقات' },
        ]);
      }
      toast('تم تصدير البيانات');
    } catch (e) { toast(e.message, 'error'); }
  });

  await Promise.all([load(true), loadStats()]);
  return () => { alive = false; };
}

/* ============================ إضافة / تعديل ============================ */
function openContactForm(kind, onSaved, row) {
  const isCustomer = kind === 'customers';
  const label = isCustomer ? 'عميل' : 'مورد';
  openForm({
    title: row ? `تعديل ${label}` : `${label} جديد`,
    subtitle: isCustomer ? 'بيانات العميل وحسابه' : 'بيانات المورد وحسابه',
    size: 'sm',
    submitText: row ? 'حفظ التعديلات' : `إضافة ${label}`,
    fields: [
      { name: 'name', label: `اسم ${label}`, value: row?.name || '', required: true, span: 2, autofocus: true },
      { name: 'phone', label: 'رقم الهاتف', value: row?.phone || '', ltr: true, placeholder: '01xxxxxxxxx' },
      { name: 'address', label: 'العنوان', value: row?.address || '' },
      ...(row ? [] : [{ name: 'balance', label: isCustomer ? 'مديونية افتتاحية' : 'مستحقات افتتاحية', type: 'number', step: '0.01', min: 0, value: 0, hint: 'اتركها صفرًا إن لم يوجد رصيد سابق' }]),
      { name: 'notes', label: 'ملاحظات', type: 'textarea', value: row?.notes || '', span: 2, rows: 2 },
    ],
    onSubmit: async (v, m) => {
      const res = row
        ? await api(`/${kind}/${row.id}`, { method: 'PUT', body: v })
        : await api(`/${kind}`, { method: 'POST', body: v });
      toast(res.message); m.close(); onSaved?.();
    },
  });
}

/* ============================ سداد / تحصيل ============================ */
function openPay(kind, row, onSaved) {
  if (!row) return;
  const isCustomer = kind === 'customers';
  const debt = Number(row.balance) || 0;
  openForm({
    title: isCustomer ? 'تحصيل من العميل' : 'سداد للمورد',
    subtitle: `${row.name} — ${isCustomer ? 'المديونية' : 'المستحق'} ${fmt.money(debt)}`,
    size: 'sm',
    submitText: isCustomer ? 'تسجيل التحصيل' : 'تسجيل السداد',
    fields: [
      { name: 'amount', label: 'المبلغ', type: 'number', step: '0.01', min: 0.01, value: debt, required: true, span: 2, autofocus: true, hint: `الحد الأقصى ${fmt.money(debt)}` },
      { name: 'method', label: 'طريقة الدفع', type: 'select', value: 'cash', span: 2, options: [
        { value: 'cash', label: 'نقدي' }, { value: 'card', label: 'بطاقة' }, { value: 'wallet', label: 'محفظة إلكترونية' },
      ] },
      { name: 'note', label: 'ملاحظة', value: '', span: 2, placeholder: isCustomer ? 'دفعة تحت الحساب…' : 'سداد جزء من المستحقات…' },
    ],
    onSubmit: async (v, m) => {
      const res = await api(`/${kind}/${row.id}/pay`, { method: 'POST', body: v });
      toast(res.message); m.close(); onSaved?.();
    },
  });
}

/* ============================ حذف ============================ */
async function deleteContact(kind, row, onSaved) {
  if (!row) return;
  const isCustomer = kind === 'customers';
  if (Number(row.balance) > 0) {
    toast(`لا يمكن حذف ${isCustomer ? 'عميل' : 'مورد'} عليه مبالغ مستحقة`, 'warn');
    return;
  }
  const yes = await confirmDialog({
    title: isCustomer ? 'حذف العميل' : 'حذف المورد',
    message: `سيتم أرشفة «${esc(row.name)}» ولن يظهر في القوائم. السجلات المرتبطة تبقى محفوظة.`,
    danger: true, confirmText: 'حذف', iconName: 'trash',
  });
  if (!yes) return;
  try {
    const res = await api(`/${kind}/${row.id}`, { method: 'DELETE' });
    toast(res.message); onSaved?.();
  } catch (e) { toast(e.message, 'error'); }
}

/* ============================ كشف حساب العميل ============================ */
async function openStatement(id, onChanged) {
  let data;
  try { data = await api(`/customers/${id}/statement`); } catch (e) { toast(e.message, 'error'); return; }
  const c = data.customer;
  const debt = Number(c.balance) || 0;
  const m = modal({
    title: `كشف حساب «${esc(c.name)}»`,
    subtitle: `${esc(c.phone || 'بدون هاتف')} · ${esc(c.address || 'بدون عنوان')}`,
    size: 'wide',
    body: `
      <div class="grid g3" style="gap:10px;margin-bottom:14px">
        <div class="stat-mini"><div class="icon-wrap">${icon('receipt')}</div><div><b>${fmt.int(data.sales.length)}</b><span>فاتورة</span></div></div>
        <div class="stat-mini warn"><div class="icon-wrap">${icon('wallet')}</div><div><b>${fmt.money(debt, false)}</b><span>المديونية الحالية</span></div></div>
        <div class="stat-mini info"><div class="icon-wrap">${icon('cash')}</div><div><b>${fmt.money(data.payments.reduce((a, p) => a + (p.direction === 'in' ? Number(p.amount) : -Number(p.amount)), 0), false)}</b><span>صافي المدفوعات</span></div></div>
      </div>
      <div class="small bold mb-1">الفواتير</div>
      ${data.sales.length ? `<div class="table-wrap" style="border:1px solid var(--border);border-radius:12px;margin-bottom:14px"><table class="table table-compact" style="min-width:460px">
        <thead><tr><th>الفاتورة</th><th>التاريخ</th><th>الإجمالي</th><th>المدفوع</th><th>الحالة</th></tr></thead>
        <tbody>${data.sales.map((s) => `<tr>
          <td class="cell-strong" style="direction:ltr;text-align:start">${esc(s.invoice_no)}</td>
          <td class="small muted">${esc(fmt.date(s.created_at))}</td>
          <td class="num">${fmt.money(s.total)}</td>
          <td class="num">${fmt.money(s.paid)}</td>
          <td>${s.status === 'returned' ? '<span class="badge badge-danger">مرتجعة</span>' : '<span class="badge badge-success">مكتملة</span>'}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<div class="muted small mb-3">لا توجد فواتير.</div>'}
      <div class="small bold mb-1">سجل المدفوعات</div>
      ${data.payments.length ? `<div class="timeline">${data.payments.map((p) => `<div class="tl-item ${p.direction === 'out' ? 'warn' : ''}">
        <span class="tl-dot"></span>
        <div class="tl-title">${p.direction === 'in' ? 'دفعة واردة' : 'دفعة صادرة'} — ${fmt.money(p.amount)} <span class="badge badge-muted">${esc(p.method)}</span></div>
        <div class="tl-sub">${esc(p.note || '')} · ${esc(fmt.datetime(p.created_at))}</div>
      </div>`).join('')}</div>` : '<div class="muted small">لا توجد مدفوعات مسجلة.</div>'}`,
    footer: `${can('treasury.manage') && debt > 0 ? `<button class="btn btn-warn" data-pay>${icon('cash')} تحصيل دفعة</button>` : ''}
      <button class="btn btn-secondary" data-close>إغلاق</button>`,
    onMount: (mm) => {
      mm.root.querySelector('[data-pay]')?.addEventListener('click', () => { mm.close(); openPay('customers', c, onChanged); });
    },
  });
  return m;
}
