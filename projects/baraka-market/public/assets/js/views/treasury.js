/* ============================================================
   الخزينة والورديات — الحركة النقدية والمصروفات
   ============================================================ */
import { state, api, can, icon, esc, fmt } from '../core.js';
import { toast, modal, openForm, confirmDialog, emptyState } from '../ui.js';
import { areaChart, bindChart, donutChart } from '../ui.js';
import { rangeControls, bindRange, defaultRange, metric, exportCsv, PAY_OPTIONS } from './_shared.js';

const TYPE_LABELS = {
  sale: 'مبيعات', return: 'مرتجعات', purchase: 'مشتريات', expense: 'مصروفات',
  customer_payment: 'تحصيل عملاء', supplier_payment: 'سداد موردين', shift_open: 'نقدية افتتاحية',
};
const EXPENSE_CATS = ['إيجار', 'كهرباء ومياه', 'رواتب وأجور', 'نقل وشحن', 'صيانة', 'نظافة', 'تسويق وإعلان', 'مصروفات عامة'];
const COLORS = ['var(--brand)', 'var(--info)', 'var(--purple)', 'var(--warn)', 'var(--danger)', 'var(--accent)', 'var(--muted)'];

export async function render(root, { params } = {}) {
  let alive = true;
  let tab = ['overview', 'expenses', 'shifts'].includes(params?.get('tab')) ? params.get('tab') : 'overview';
  const range = defaultRange(29);
  let treasury = null;
  let shiftsData = null;

  root.innerHTML = `
    <div class="tabs" id="treasury-tabs">
      <button class="tab ${tab === 'overview' ? 'active' : ''}" data-tab="overview">${icon('chart', 'icon-sm')} نظرة عامة</button>
      <button class="tab ${tab === 'expenses' ? 'active' : ''}" data-tab="expenses">${icon('receipt', 'icon-sm')} المصروفات</button>
      <button class="tab ${tab === 'shifts' ? 'active' : ''}" data-tab="shifts">${icon('clock', 'icon-sm')} الورديات</button>
    </div>
    <div id="treasury-body"></div>`;

  async function loadTreasury() {
    try {
      treasury = await api(`/treasury?from=${range.from}&to=${range.to}`);
      if (!alive) return;
      paint();
    } catch (e) {
      if (!alive) return;
      root.querySelector('#treasury-body').innerHTML = `<div class="card"><div class="empty"><div class="empty-ico">${icon('alert')}</div><div class="empty-title">تعذر تحميل الخزينة</div><div class="empty-text">${esc(e.message)}</div></div></div>`;
    }
  }

  async function loadShifts() {
    try {
      shiftsData = await api('/shifts');
      if (!alive) return;
      if (tab === 'shifts') paint();
    } catch {}
  }

  function paint() {
    const body = root.querySelector('#treasury-body');
    if (!body) return;
    if (tab === 'overview') body.innerHTML = overviewHtml(treasury);
    else if (tab === 'expenses') body.innerHTML = expensesHtml(treasury);
    else body.innerHTML = shiftsHtml(shiftsData);
    bind();
  }

  function bind() {
    const body = root.querySelector('#treasury-body');
    if (!body) return;
    if (tab === 'overview') {
      bindRange(body, range.from, range.to, (f, t) => { range.from = f; range.to = t; loadTreasury(); });
      if (treasury) {
        bindChart(body);
        body.querySelectorAll('[data-pay-row]').forEach((tr) => tr.addEventListener('click', () => openPaymentDetail(treasury.rows.find((r) => String(r.id) === tr.dataset.payRow))));
      }
      body.querySelector('[data-add-expense]')?.addEventListener('click', () => openExpenseForm(() => loadTreasury()));
      body.querySelectorAll('[data-goto-tab]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.gotoTab)));
    }
    if (tab === 'expenses') {
      bindRange(body, range.from, range.to, (f, t) => { range.from = f; range.to = t; loadTreasury(); });
      body.querySelector('[data-add-expense]')?.addEventListener('click', () => openExpenseForm(() => loadTreasury()));
      body.querySelectorAll('[data-del-expense]').forEach((b) => b.addEventListener('click', () => deleteExpense(b.dataset.delExpense, () => loadTreasury())));
      body.querySelector('[data-export]')?.addEventListener('click', () => {
        if (!treasury) return;
        exportCsv(`baraka-expenses-${range.from}-${range.to}.csv`, treasury.expenses, [
          { key: 'category', label: 'البند' }, { key: 'description', label: 'الوصف' }, { key: 'amount', label: 'المبلغ' },
          { key: 'method', label: 'طريقة الدفع' }, { key: 'user_name', label: 'المستخدم' }, { key: 'created_at', label: 'التاريخ' },
        ]);
      });
    }
    if (tab === 'shifts') {
      body.querySelector('[data-open-shift]')?.addEventListener('click', openShiftForm);
      body.querySelectorAll('[data-close-shift]').forEach((b) => b.addEventListener('click', () => closeShift(Number(b.dataset.closeShift))));
      body.querySelectorAll('[data-shift-detail]').forEach((b) => b.addEventListener('click', () => openShiftDetail(shiftsData.rows.find((s) => String(s.id) === b.dataset.shiftDetail))));
    }
  }

  function switchTab(next) {
    if (!['overview', 'expenses', 'shifts'].includes(next)) return;
    tab = next;
    history.replaceState(null, '', `#/treasury?tab=${tab}`);
    root.querySelectorAll('#treasury-tabs [data-tab]').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
    if (tab === 'shifts' && !shiftsData) loadShifts().then(paint);
    else paint();
  }

  root.querySelector('#treasury-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) switchTab(b.dataset.tab);
  });

  await Promise.all([loadTreasury(), tab === 'shifts' ? loadShifts() : Promise.resolve()]);
  return () => { alive = false; };
}

/* ============================ نظرة عامة ============================ */
function overviewHtml(d) {
  if (!d) return `<div class="card"><div class="skeleton" style="height:260px"></div></div>`;
  const s = d.summary;
  const totalIn = Number(s.total_in) || 0;
  const totalOut = Number(s.total_out) || 0;
  const cashIn = Number(s.cash_in) || 0;
  const cashOut = Number(s.cash_out) || 0;
  const seriesIn = d.byDay.map((x) => x.total_in);
  const seriesOut = d.byDay.map((x) => x.total_out);
  const typeItems = d.byType.filter((t) => t.direction === 'in' && Number(t.total) > 0)
    .slice(0, 6).map((t, i) => ({ label: TYPE_LABELS[t.type] || t.type, value: t.total, color: COLORS[i % COLORS.length] }));

  return `
    <div class="kpis">
      ${metric({ label: 'إجمالي الوارد', value: fmt.money(totalIn, false), unit: state.settings.currency, iconName: 'arrow-down', foot: `<span class="muted">${esc(fmt.date(d.from))} — ${esc(fmt.date(d.to))}</span>` })}
      ${metric({ label: 'إجمالي الصادر', value: fmt.money(totalOut, false), unit: state.settings.currency, iconName: 'arrow-up', color: 'var(--danger)', soft: 'var(--danger-soft)', foot: '<span class="muted">مصروفات ومرتجعات ومشتريات</span>' })}
      ${metric({ label: 'صافي الحركة', value: fmt.money(totalIn - totalOut, false), unit: state.settings.currency, iconName: 'wallet', color: 'var(--info)', soft: 'var(--info-soft)', foot: `<span class="muted">${totalIn >= totalOut ? 'رصيد موجب' : 'رصيد سالب'}</span>` })}
      ${metric({ label: 'النقدية بالخزينة', value: fmt.money(cashIn - cashOut, false), unit: state.settings.currency, iconName: 'cash', color: 'var(--accent)', soft: 'var(--accent-soft)', foot: `<span class="muted">داخل ${fmt.money(cashIn)} · خارج ${fmt.money(cashOut)}</span>` })}
    </div>

    <div class="row wrap mt-3" style="justify-content:space-between">
      ${rangeControls({ from: d.from, to: d.to })}
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" data-goto-tab="shifts">${icon('clock')} الورديات</button>
        <button class="btn btn-primary btn-sm" data-add-expense>${icon('plus')} مصروف جديد</button>
      </div>
    </div>

    <div class="dash-grid">
      <div class="card">
        <div class="card-head">
          <div><div class="card-title">حركة الخزينة اليومية</div><div class="card-sub">الوارد مقابل الصادر</div></div>
          <div class="spacer"></div>
          <div class="chart-legend">
            <span><i style="--c:var(--brand)"></i> وارد</span>
            <span><i style="--c:var(--danger)"></i> صادر</span>
          </div>
        </div>
        ${areaChart({ labels: d.byDay.map((x) => x.date), series: [
          { name: 'وارد', values: seriesIn, color: 'var(--brand)' },
          { name: 'صادر', values: seriesOut, color: 'var(--danger)' },
        ], height: 240 })}
      </div>
      <div class="card">
        <div class="card-head"><div><div class="card-title">مصادر الوارد</div><div class="card-sub">توزيع حسب النوع</div></div><div class="spacer"></div>${icon('chart', 'icon-lg')}</div>
        ${typeItems.length ? donutChart(typeItems, { centerLabel: 'إجمالي الوارد', centerValue: fmt.money(totalIn, false) })
          : '<div class="empty" style="padding:30px 10px"><div class="empty-text">لا توجد حركة وارد في هذه الفترة</div></div>'}
      </div>
    </div>

    <div class="card flush mt-3">
      <div class="card-head" style="padding:18px 20px 12px;margin:0">
        <div><div class="card-title">آخر الحركات المالية</div><div class="card-sub">أحدث 200 عملية في الفترة</div></div>
        <div class="spacer"></div>
        <span class="badge badge-muted">${fmt.int(d.rows.length)} عملية</span>
      </div>
      ${d.rows.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>النوع</th><th>الاتجاه</th><th>المبلغ</th><th>طريقة الدفع</th><th>البيان</th><th>المستخدم</th><th>التاريخ</th></tr></thead>
        <tbody>${d.rows.map((p) => `<tr data-pay-row="${p.id}" style="cursor:pointer">
          <td><span class="badge ${p.direction === 'in' ? 'badge-success' : 'badge-danger'}">${esc(TYPE_LABELS[p.type] || p.type)}</span></td>
          <td class="small">${p.direction === 'in' ? `<span class="text-success">${icon('arrow-down', 'icon-sm')} وارد</span>` : `<span class="text-danger">${icon('arrow-up', 'icon-sm')} صادر</span>`}</td>
          <td class="num bolder ${p.direction === 'in' ? 'text-success' : 'text-danger'}">${p.direction === 'in' ? '+' : '-'} ${fmt.money(p.amount)}</td>
          <td>${esc(methodLabel(p.method))}</td>
          <td class="small muted">${esc(p.note || '—')}</td>
          <td class="small">${esc(p.user_name || '—')}</td>
          <td class="small muted nowrap">${esc(fmt.datetime(p.created_at))}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : emptyState({ title: 'لا توجد حركات مالية', text: 'ستظهر هنا كل عمليات القبض والصرف', iconName: 'wallet' })}
    </div>`;
}

/* ============================ المصروفات ============================ */
function expensesHtml(d) {
  if (!d) return `<div class="card"><div class="skeleton" style="height:260px"></div></div>`;
  const total = d.expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const byCat = {};
  for (const e of d.expenses) byCat[e.category] = (byCat[e.category] || 0) + (Number(e.amount) || 0);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  return `
    <div class="kpis">
      ${metric({ label: 'إجمالي المصروفات', value: fmt.money(total, false), unit: state.settings.currency, iconName: 'receipt', color: 'var(--danger)', soft: 'var(--danger-soft)', foot: `<span class="muted">${fmt.int(d.expenses.length)} مصروف</span>` })}
      ${metric({ label: 'أكبر بند', value: cats[0] ? esc(cats[0][0]) : '—', iconName: 'tag', color: 'var(--warn)', soft: 'var(--warn-soft)', foot: `<span class="muted">${cats[0] ? fmt.money(cats[0][1]) : 'لا توجد بيانات'}</span>` })}
      ${metric({ label: 'متوسط المصروف', value: fmt.money(d.expenses.length ? total / d.expenses.length : 0, false), unit: state.settings.currency, iconName: 'chart', color: 'var(--info)', soft: 'var(--info-soft)', foot: '<span class="muted">لكل عملية صرف</span>' })}
      ${metric({ label: 'نسبة من الصادر', value: fmt.percent(Number(d.summary.total_out) ? (total / Number(d.summary.total_out)) * 100 : 0), iconName: 'percent', color: 'var(--purple)', soft: 'var(--purple-soft)', foot: '<span class="muted">من إجمالي الحركة الخارجة</span>' })}
    </div>

    <div class="row wrap mt-3" style="justify-content:space-between">
      ${rangeControls({ from: d.from, to: d.to })}
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" data-export>${icon('download')} تصدير</button>
        <button class="btn btn-primary btn-sm" data-add-expense>${icon('plus')} مصروف جديد</button>
      </div>
    </div>

    ${cats.length ? `<div class="card mt-2"><div class="card-head"><div><div class="card-title">توزيع المصروفات</div><div class="card-sub">حسب البند</div></div></div>
      <div class="bar-list">${cats.map(([name, value], i) => `<div class="bar-item">
        <div class="bar-top"><span>${esc(name)}</span><b>${fmt.money(value)}</b></div>
        <div class="bar-track"><i style="--c:${COLORS[i % COLORS.length]};width:${Math.max(4, (value / cats[0][1]) * 100)}%"></i></div>
      </div>`).join('')}</div></div>` : ''}

    <div class="card flush mt-3">
      <div class="card-head" style="padding:18px 20px 12px;margin:0">
        <div><div class="card-title">سجل المصروفات</div><div class="card-sub">${esc(fmt.date(d.from))} — ${esc(fmt.date(d.to))}</div></div>
        <div class="spacer"></div>
      </div>
      ${d.expenses.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>البند</th><th>الوصف</th><th>المبلغ</th><th>طريقة الدفع</th><th>المستخدم</th><th>التاريخ</th><th></th></tr></thead>
        <tbody>${d.expenses.map((e) => `<tr>
          <td class="cell-strong">${esc(e.category)}</td>
          <td class="small muted">${esc(e.description || '—')}</td>
          <td class="num bolder text-danger">${fmt.money(e.amount)}</td>
          <td>${esc(methodLabel(e.method))}</td>
          <td class="small">${esc(e.user_name || '—')}</td>
          <td class="small muted nowrap">${esc(fmt.datetime(e.created_at))}</td>
          <td><div class="actions">${can('treasury.manage') ? `<button class="icon-btn danger" data-del-expense="${e.id}" title="حذف">${icon('trash')}</button>` : ''}</div></td>
        </tr>`).join('')}</tbody>
      </table></div>` : emptyState({ title: 'لا توجد مصروفات', text: 'سجّل أول مصروف لإدارة تكاليف التشغيل.', iconName: 'receipt', action: '<button class="btn btn-primary" data-add-expense>تسجيل مصروف</button>' })}
    </div>`;
}

/* ============================ الورديات ============================ */
function shiftsHtml(data) {
  if (!data) return `<div class="card"><div class="skeleton" style="height:260px"></div></div>`;
  const cur = data.current;
  const rows = data.rows || [];
  return `
    <div class="card">
      <div class="card-head">
        <div><div class="card-title">الوردية الحالية</div><div class="card-sub">${cur ? `بدأت ${esc(fmt.datetime(cur.opened_at))}` : 'لا توجد وردية مفتوحة الآن'}</div></div>
        <div class="spacer"></div>
        ${cur ? `<span class="badge badge-success">${icon('clock', 'icon-sm')} مفتوحة</span>` : `<span class="badge badge-warn">مغلقة</span>`}
      </div>
      ${cur ? `<div class="grid g3">
          <div class="stat-mini"><div class="icon-wrap">${icon('user-cog')}</div><div><b>${esc(cur.user_name)}</b><span>مسؤول الوردية</span></div></div>
          <div class="stat-mini"><div class="icon-wrap">${icon('cash')}</div><div><b>${fmt.money(cur.opening_cash)}</b><span>نقدية البداية</span></div></div>
          <div class="stat-mini info"><div class="icon-wrap">${icon('clock')}</div><div><b>${esc(fmt.time(cur.opened_at))}</b><span>وقت الفتح</span></div></div>
        </div>
        <div class="row mt-3" style="justify-content:flex-end">
          ${can('treasury.manage') ? `<button class="btn btn-danger" data-close-shift="${cur.id}">${icon('logout')} إغلاق الوردية</button>` : ''}
        </div>`
      : `<div class="empty" style="padding:30px 16px">
          <div class="empty-ico">${icon('clock')}</div>
          <div class="empty-title">ابدأ يومك بفتح وردية</div>
          <div class="empty-text">تساعدك الوردية على تسوية النقدية ومتابعة مبيعات كل موظف.</div>
          <button class="btn btn-primary mt-2" data-open-shift>${icon('plus')} فتح وردية الآن</button>
        </div>`}
    </div>

    <div class="card flush mt-3">
      <div class="card-head" style="padding:18px 20px 12px;margin:0">
        <div><div class="card-title">سجل الورديات</div><div class="card-sub">آخر 60 وردية</div></div>
        <div class="spacer"></div>
        <span class="badge badge-muted">${fmt.int(rows.length)} وردية</span>
      </div>
      ${rows.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>#</th><th>المستخدم</th><th>الفتح</th><th>الإغلاق</th><th>نقدية البداية</th><th>المبيعات</th><th>المتوقع</th><th>الفعلي</th><th>الفرق</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${rows.map((s) => {
          const diff = s.status === 'closed' ? (Number(s.closing_cash) || 0) - (Number(s.expected_cash) || 0) : null;
          return `<tr>
            <td class="muted small">#${s.id}</td>
            <td class="cell-strong">${esc(s.user_name)}</td>
            <td class="small muted nowrap">${esc(fmt.shortDate(s.opened_at))} ${esc(fmt.time(s.opened_at))}</td>
            <td class="small muted nowrap">${s.closed_at ? `${esc(fmt.shortDate(s.closed_at))} ${esc(fmt.time(s.closed_at))}` : '—'}</td>
            <td class="num">${fmt.money(s.opening_cash)}</td>
            <td class="num bolder">${fmt.money(s.sales_total)}</td>
            <td class="num">${s.expected_cash != null ? fmt.money(s.expected_cash) : '—'}</td>
            <td class="num">${s.closing_cash != null ? fmt.money(s.closing_cash) : '—'}</td>
            <td class="num ${diff == null ? 'muted' : Math.abs(diff) < 0.01 ? 'text-success' : 'text-danger'}">${diff == null ? '—' : fmt.money(diff)}</td>
            <td>${s.status === 'open' ? '<span class="badge badge-success">مفتوحة</span>' : '<span class="badge badge-muted">مغلقة</span>'}</td>
            <td><div class="actions"><button class="icon-btn" data-shift-detail="${s.id}" title="تفاصيل">${icon('eye')}</button></div></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : emptyState({ title: 'لا توجد ورديات', text: 'افتح وردية لبدء تسجيل المبيعات.', iconName: 'clock' })}
    </div>`;
}

/* ============================ نماذج ============================ */
function methodLabel(m) {
  return { cash: 'نقدي', card: 'بطاقة', wallet: 'محفظة', credit: 'آجل' }[m] || m || '—';
}

function openExpenseForm(onSaved) {
  openForm({
    title: 'تسجيل مصروف',
    subtitle: 'سيُخصم المبلغ من الخزينة فورًا',
    size: 'sm',
    submitText: 'تسجيل المصروف',
    fields: [
      { name: 'category', label: 'بند المصروف', type: 'select', value: EXPENSE_CATS[0], span: 2, options: EXPENSE_CATS.map((c) => ({ value: c, label: c })) },
      { name: 'amount', label: 'المبلغ', type: 'number', step: '0.01', min: 0.01, required: true, span: 2, autofocus: true },
      { name: 'method', label: 'طريقة الدفع', type: 'select', value: 'cash', span: 2, options: PAY_OPTIONS.filter((o) => o.value !== 'credit') },
      { name: 'description', label: 'الوصف', type: 'textarea', rows: 2, span: 2, placeholder: 'تفاصيل المصروف…' },
    ],
    onSubmit: async (v, m) => {
      const res = await api('/expenses', { method: 'POST', body: v });
      toast(res.message); m.close(); onSaved?.();
    },
  });
}

async function deleteExpense(id, onSaved) {
  const yes = await confirmDialog({ title: 'حذف المصروف', message: 'سيتم حذف المصروف وعكس أثره من الخزينة. هل تريد المتابعة؟', danger: true, confirmText: 'حذف', iconName: 'trash' });
  if (!yes) return;
  try {
    const res = await api(`/expenses/${id}`, { method: 'DELETE' });
    toast(res.message); onSaved?.();
  } catch (e) { toast(e.message, 'error'); }
}

function openShiftForm() {
  openForm({
    title: 'فتح وردية جديدة',
    subtitle: 'أدخل النقدية الموجودة في الدرج عند بداية الوردية',
    size: 'sm',
    submitText: 'فتح الوردية',
    fields: [
      { name: 'opening_cash', label: 'نقدية البداية', type: 'number', step: '0.01', min: 0, value: 0, span: 2, autofocus: true, hint: 'تُسجل كحركة وارد في الخزينة' },
    ],
    onSubmit: async (v, m) => {
      const res = await api('/shifts/open', { method: 'POST', body: v });
      toast(res.message); m.close();
      setTimeout(() => location.reload(), 350);
    },
  });
}

async function closeShift(id) {
  const yes = await confirmDialog({ title: 'إغلاق الوردية', message: 'سيتم حساب النقدية المتوقعة وتسجيل الإغلاق. هل تريد المتابعة؟', confirmText: 'متابعة', iconName: 'clock' });
  if (!yes) return;
  openForm({
    title: 'تسوية وإغلاق الوردية',
    subtitle: 'أدخل النقدية الفعلية الموجودة في الدرج',
    size: 'sm',
    submitText: 'إغلاق الوردية',
    fields: [
      { name: 'closing_cash', label: 'النقدية الفعلية', type: 'number', step: '0.01', min: 0, value: '', required: true, span: 2, autofocus: true, hint: 'سيتم احتساب الفرق تلقائيًا' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea', rows: 2, span: 2, placeholder: 'أي ملاحظات على الوردية…' },
    ],
    onSubmit: async (v, m) => {
      const res = await api(`/shifts/${id}/close`, { method: 'POST', body: v });
      toast(res.message); m.close();
      setTimeout(() => location.reload(), 350);
    },
  });
}

function openShiftDetail(s) {
  if (!s) return;
  const diff = (Number(s.closing_cash) || 0) - (Number(s.expected_cash) || 0);
  modal({
    title: `تفاصيل الوردية #${s.id}`,
    subtitle: `${esc(s.user_name)} · ${esc(fmt.datetime(s.opened_at))}`,
    size: 'sm',
    body: `<div style="display:flex;flex-direction:column;gap:8px">
      <div class="sum-row"><span>وقت الفتح</span><b>${esc(fmt.datetime(s.opened_at))}</b></div>
      <div class="sum-row"><span>وقت الإغلاق</span><b>${s.closed_at ? esc(fmt.datetime(s.closed_at)) : '—'}</b></div>
      <div class="sum-row"><span>نقدية البداية</span><b>${fmt.money(s.opening_cash)}</b></div>
      <div class="sum-row"><span>مبيعات نقدية</span><b>${fmt.money(s.cash_sales)}</b></div>
      <div class="sum-row"><span>مبيعات بطاقة</span><b>${fmt.money(s.card_sales)}</b></div>
      <div class="sum-row"><span>مبيعات محفظة</span><b>${fmt.money(s.wallet_sales)}</b></div>
      <div class="sum-row"><span>إجمالي المبيعات</span><b>${fmt.money(s.sales_total)}</b></div>
      <div class="sum-row"><span>المصروفات</span><b class="text-danger">${fmt.money(s.expenses)}</b></div>
      <div class="sum-row"><span>النقدية المتوقعة</span><b>${s.expected_cash != null ? fmt.money(s.expected_cash) : '—'}</b></div>
      <div class="sum-row"><span>النقدية الفعلية</span><b>${s.closing_cash != null ? fmt.money(s.closing_cash) : '—'}</b></div>
      ${s.closed_at ? `<div class="sum-total"><span>الفرق</span><b class="${Math.abs(diff) < 0.01 ? 'text-success' : 'text-danger'}">${fmt.money(diff)}</b></div>` : ''}
      ${s.notes ? `<div class="alert alert-info">${icon('info')}<span>${esc(s.notes)}</span></div>` : ''}
    </div>`,
    footer: '<button class="btn btn-secondary" data-close>إغلاق</button>',
  });
}

function openPaymentDetail(p) {
  if (!p) return;
  modal({
    title: 'تفاصيل الحركة المالية',
    subtitle: `${esc(TYPE_LABELS[p.type] || p.type)} · ${esc(fmt.datetime(p.created_at))}`,
    size: 'sm',
    body: `<div style="display:flex;flex-direction:column;gap:8px">
      <div class="sum-row"><span>المبلغ</span><b class="${p.direction === 'in' ? 'text-success' : 'text-danger'}">${p.direction === 'in' ? '+' : '-'} ${fmt.money(p.amount)}</b></div>
      <div class="sum-row"><span>الاتجاه</span><b>${p.direction === 'in' ? 'وارد' : 'صادر'}</b></div>
      <div class="sum-row"><span>طريقة الدفع</span><b>${esc(methodLabel(p.method))}</b></div>
      <div class="sum-row"><span>المستخدم</span><b>${esc(p.user_name || '—')}</b></div>
      <div class="sum-row"><span>البيان</span><b>${esc(p.note || '—')}</b></div>
    </div>`,
    footer: '<button class="btn btn-secondary" data-close>إغلاق</button>',
  });
}
