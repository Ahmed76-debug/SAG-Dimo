/* ============================================================
   التقارير — تحليلات المبيعات والأرباح والمخزون
   ============================================================ */
import { state, api, icon, esc, fmt } from '../core.js';
import { areaChart, bindChart, donutChart, emptyState } from '../ui.js';
import { rangeControls, bindRange, defaultRange, metric, statMini, exportCsv, exportExcel, exportPdf, stockBadge, sectionHead } from './_shared.js';

const PAY_COLORS = { cash: 'var(--brand)', card: 'var(--info)', wallet: 'var(--purple)', credit: 'var(--warn)' };
const PAY_LABELS = { cash: 'نقدي', card: 'بطاقة', wallet: 'محفظة إلكترونية', credit: 'آجل', mixed: 'مختلط' };
const FALLBACK_COLORS = ['var(--brand)', 'var(--info)', 'var(--purple)', 'var(--warn)', 'var(--danger)', 'var(--accent)', '#0ea5e9', '#84cc16', '#f97316'];

export async function render(root) {
  let alive = true;
  const range = defaultRange(29);
  let report = null;

  root.innerHTML = `
    <div class="card">
      <div class="toolbar" style="padding:0;border:0">
        <div>
          <div class="card-title">فترة التقرير</div>
          <div class="card-sub">اختر الفترة التي تريد تحليلها</div>
        </div>
        <div class="spacer"></div>
        ${rangeControls({ from: range.from, to: range.to })}
        <span class="badge badge-muted hide-mobile">${icon('building', 'icon-sm')} ${esc(branchTitle())}</span>
        <button class="btn btn-secondary btn-sm" data-export>${icon('download')} CSV</button>
        <button class="btn btn-secondary btn-sm" data-export-excel>${icon('table')} Excel</button>
        <button class="btn btn-primary btn-sm" data-export-pdf>${icon('printer')} PDF</button>
      </div>
    </div>

    <div class="kpis mt-3" id="report-kpis">
      ${Array(4).fill('<div class="skeleton" style="height:108px;border-radius:18px"></div>').join('')}
    </div>

    <div id="report-body" class="mt-3">
      <div class="skeleton" style="height:340px;border-radius:18px"></div>
    </div>`;

  async function load() {
    try {
      report = await api(`/reports?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`);
      if (!alive) return;
      paint();
    } catch (e) {
      if (!alive) return;
      root.querySelector('#report-kpis').innerHTML = '';
      root.querySelector('#report-body').innerHTML = `<div class="card"><div class="empty">
        <div class="empty-ico">${icon('alert')}</div>
        <div class="empty-title">تعذر تحميل التقرير</div>
        <div class="empty-text">${esc(e.message)}</div>
      </div></div>`;
    }
  }

  function paint() {
    const d = report;
    const total = Number(d.sales.total) || 0;
    const profit = Number(d.sales.profit) || 0;
    const expenses = Number(d.expenses.total) || 0;
    const purchases = Number(d.purchases.total) || 0;
    const invoices = Number(d.sales.invoices) || 0;
    const net = profit - expenses;
    const margin = total ? (profit / total) * 100 : 0;

    root.querySelector('#report-kpis').innerHTML = [
      metric({
        label: 'إجمالي المبيعات', value: fmt.money(total, false), unit: state.settings.currency,
        iconName: 'cash', foot: `<span class="muted">${fmt.int(invoices)} فاتورة · متوسط ${fmt.money(invoices ? total / invoices : 0)}</span>`,
      }),
      metric({
        label: 'إجمالي الربح', value: fmt.money(profit, false), unit: state.settings.currency,
        iconName: 'trend-up', color: 'var(--info)', soft: 'var(--info-soft)',
        foot: `<span class="muted">هامش ربح ${fmt.percent(margin)}</span>`,
      }),
      metric({
        label: 'المصروفات', value: fmt.money(expenses, false), unit: state.settings.currency,
        iconName: 'wallet', color: 'var(--warn)', soft: 'var(--warn-soft)',
        foot: `<span class="muted">صافي بعد المصروفات ${fmt.money(net, false)}</span>`,
      }),
      metric({
        label: 'المشتريات', value: fmt.money(purchases, false), unit: state.settings.currency,
        iconName: 'truck', color: 'var(--purple)', soft: 'var(--purple-soft)',
        foot: `<span class="muted">${fmt.int(d.purchases.invoices)} فاتورة توريد</span>`,
      }),
    ].join('');

    const labels = d.series.map((x) => x.date);
    const salesSeries = d.series.map((x) => x.sales);
    const profitSeries = d.series.map((x) => x.profit);
    const expenseSeries = d.series.map((x) => x.expenses);
    const catItems = d.byCategory.map((c, i) => ({
      label: c.name, value: c.revenue, color: c.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    }));
    const maxCategory = Math.max(1, ...d.byCategory.map((c) => Number(c.revenue) || 0));
    const maxCustomer = Math.max(1, ...d.topCustomers.map((c) => Number(c.total) || 0));
    const payTotal = d.paymentMix.reduce((a, p) => a + (Number(p.total) || 0), 0);

    root.querySelector('#report-body').innerHTML = `
      <div class="report-grid">
        <div class="card full">
          <div class="card-head">
            <div>
              <div class="card-title">حركة المبيعات والأرباح والمصروفات</div>
              <div class="card-sub">${esc(fmt.date(d.from))} — ${esc(fmt.date(d.to))}</div>
            </div>
            <div class="spacer"></div>
            <div class="chart-legend">
              <span><i style="--c:var(--brand)"></i> المبيعات</span>
              <span><i style="--c:var(--info)"></i> الأرباح</span>
              <span><i style="--c:var(--warn)"></i> المصروفات</span>
            </div>
          </div>
          ${areaChart({
            labels,
            series: [
              { name: 'المبيعات', values: salesSeries, color: 'var(--brand)' },
              { name: 'الأرباح', values: profitSeries, color: 'var(--info)' },
              { name: 'المصروفات', values: expenseSeries, color: 'var(--warn)' },
            ],
            height: 275,
          })}
          <div class="summary-strip mt-2" style="border-top:1px dashed var(--border);padding-top:12px">
            <div class="summary-item"><span>المبيعات</span><b>${fmt.money(total)}</b></div>
            <div class="summary-item"><span>تكلفة البضاعة</span><b>${fmt.money(total - profit)}</b></div>
            <div class="summary-item"><span>الربح الإجمالي</span><b style="color:var(--brand)">${fmt.money(profit)}</b></div>
            <div class="summary-item"><span>المصروفات</span><b style="color:var(--warn)">${fmt.money(expenses)}</b></div>
            <div class="summary-item"><span>الصافي بعد المصروفات</span><b style="color:${net >= 0 ? 'var(--brand)' : 'var(--danger)'}">${fmt.money(net)}</b></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div><div class="card-title">المبيعات حسب التصنيف</div><div class="card-sub">حصة كل تصنيف من الإيراد</div></div>
            <div class="spacer"></div>
            ${icon('tag', 'icon-lg')}
          </div>
          ${catItems.length
            ? donutChart(catItems, { centerLabel: 'إجمالي المبيعات', centerValue: fmt.money(total, false) })
            : emptyState({ title: 'لا توجد مبيعات في الفترة', text: 'ابدأ بتسجيل الفواتير لعرض تحليل التصنيفات', iconName: 'tag' })}
          ${d.byCategory.length ? `<div class="mt-2" style="border-top:1px dashed var(--border);padding-top:10px">
            ${d.byCategory.slice(0, 5).map((c, i) => `<div class="bar-item" style="margin-bottom:9px">
              <div class="bar-top"><b>${esc(c.name)}</b><span class="num">${fmt.money(c.revenue)}</span></div>
              <div class="bar-track"><i style="--c:${esc(c.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length])};width:${Math.max(2, ((Number(c.revenue) || 0) / maxCategory) * 100)}%"></i></div>
            </div>`).join('')}
          </div>` : ''}
        </div>

        <div class="card">
          <div class="card-head">
            <div><div class="card-title">طرق الدفع</div><div class="card-sub">كيف يدفع عملاؤك؟</div></div>
            <div class="spacer"></div>
            ${icon('card', 'icon-lg')}
          </div>
          ${d.paymentMix.length ? `<div class="bar-list">
            ${d.paymentMix.map((p) => {
              const pct = payTotal ? (Number(p.total) / payTotal) * 100 : 0;
              return `<div class="bar-item">
                <div class="bar-top">
                  <b>${esc(PAY_LABELS[p.method] || p.method)}</b>
                  <span class="num">${fmt.money(p.total)}</span>
                </div>
                <div class="bar-track"><i style="--c:${PAY_COLORS[p.method] || 'var(--muted)'};width:${Math.max(2, pct)}%"></i></div>
                <div class="row between tiny muted mt-1">
                  <span>${fmt.percent(pct)} من الإجمالي</span>
                  <span>${fmt.int(p.count)} فاتورة</span>
                </div>
              </div>`;
            }).join('')}
          </div>
          <div class="row between mt-3" style="border-top:1px dashed var(--border);padding-top:12px">
            <span class="small muted">إجمالي المدفوعات</span>
            <b>${fmt.money(payTotal)}</b>
          </div>` : emptyState({ title: 'لا توجد مدفوعات', text: 'لم تُسجل فواتير مكتملة في هذه الفترة', iconName: 'card' })}
        </div>

        <div class="card full">
          ${sectionHead('الأصناف الأكثر مبيعًا', 'مرتبة حسب الإيراد خلال الفترة', `<span class="badge badge-success">${icon('star', 'icon-sm')} TOP ${fmt.int(d.topProducts.length)}</span>`)}
          ${d.topProducts.length ? `<div class="table-wrap">
            <table class="table">
              <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>الإيراد</th><th>التكلفة</th><th>الربح</th><th>الهامش</th></tr></thead>
              <tbody>${d.topProducts.map((p, i) => {
                const rev = Number(p.revenue) || 0;
                const pr = Number(p.profit) || 0;
                return `<tr>
                  <td><span class="badge ${i < 3 ? 'badge-success' : 'badge-muted'}">${i + 1}</span></td>
                  <td><div class="product-cell"><div class="thumb">${esc((p.name || '؟').slice(0, 2))}</div>
                    <div><b>${esc(p.name)}</b><span>${esc(p.unit || '')}</span></div></div></td>
                  <td class="num">${fmt.qty(p.qty)}</td>
                  <td class="num bolder">${fmt.money(rev)}</td>
                  <td class="num muted">${fmt.money(p.cost)}</td>
                  <td class="num ${pr >= 0 ? 'text-success' : 'text-danger'}">${fmt.money(pr)}</td>
                  <td><span class="badge ${rev && pr / rev >= 0.25 ? 'badge-success' : rev && pr / rev >= 0.1 ? 'badge-warn' : 'badge-muted'}">${fmt.percent(rev ? (pr / rev) * 100 : 0)}</span></td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>` : emptyState({ title: 'لا توجد مبيعات', text: 'ستظهر الأصناف الأكثر مبيعًا بعد تسجيل الفواتير', iconName: 'box' })}
        </div>

        <div class="card">
          ${sectionHead('أفضل العملاء', 'أعلى العملاء شراءً في الفترة')}
          ${d.topCustomers.length ? `<div class="list">
            ${d.topCustomers.map((c, i) => `<div class="list-row">
              <div class="thumb" style="--c:${i === 0 ? 'var(--accent)' : 'var(--brand)'}">${i + 1}</div>
              <div class="lr-body">
                <div class="lr-title">${esc(c.name)}</div>
                <div class="lr-sub">${fmt.int(c.invoices)} فاتورة</div>
                <div class="mini-bar"><i style="--w:${Math.max(5, ((Number(c.total) || 0) / maxCustomer) * 100)}%"></i></div>
              </div>
              <div class="lr-value">${fmt.money(c.total)}</div>
            </div>`).join('')}
          </div>` : emptyState({ title: 'لا يوجد عملاء مسجلون', text: 'الفواتير النقدية لا ترتبط بعميل محدد', iconName: 'users' })}
        </div>

        <div class="card">
          ${sectionHead('المخزون والمديونيات', 'نظرة على رأس المال والالتزامات')}
          <div class="grid g2" style="gap:8px">
            ${statMini({ label: 'قيمة المخزون بالتكلفة', value: fmt.money(d.inventory.value_cost, false), iconName: 'layers' })}
            ${statMini({ label: 'قيمة المخزون بالبيع', value: fmt.money(d.inventory.value_sale, false), iconName: 'tag', tone: 'info' })}
            ${statMini({ label: 'أصناف منخفضة', value: fmt.int(d.inventory.low_stock), iconName: 'alert', tone: 'warn' })}
            ${statMini({ label: 'أصناف نافدة', value: fmt.int(d.inventory.out_stock), iconName: 'x-circle', tone: 'danger' })}
          </div>
          <div class="setting-row mt-3"><div><b>مديونيات العملاء</b><span>مستحقات لم تُحصل بعد</span></div><b style="color:var(--warn)">${fmt.money(d.debts.customers)}</b></div>
          <div class="setting-row"><div><b>مستحقات الموردين</b><span>التزامات تجاه الموردين</span></div><b style="color:var(--danger)">${fmt.money(d.debts.suppliers)}</b></div>
          <div class="setting-row"><div><b>عدد الأصناف النشطة</b><span>المنتجات المتاحة في الكتالوج</span></div><b>${fmt.int(d.inventory.products)}</b></div>
        </div>

        <div class="card full">
          ${sectionHead('أصناف تحتاج إعادة طلب', `${fmt.int(d.lowStock.length)} صنف عند حد الطلب أو أقل`, `<a class="btn btn-sm btn-secondary" href="#/inventory?filter=low">إدارة المخزون ${icon('arrow-left', 'icon-sm')}</a>`)}
          ${d.lowStock.length ? `<div class="table-wrap">
            <table class="table">
              <thead><tr><th>الصنف</th><th>المخزون الحالي</th><th>حد الطلب</th><th>الحالة</th><th>نسبة التوفر</th></tr></thead>
              <tbody>${d.lowStock.slice(0, 12).map((p) => {
                const stock = Number(p.stock) || 0;
                const min = Number(p.min_stock) || 0;
                const pct = min > 0 ? Math.min(100, (stock / min) * 100) : (stock > 0 ? 100 : 0);
                return `<tr>
                  <td class="cell-strong">${esc(p.name)}</td>
                  <td class="num">${fmt.qty(stock)} <span class="tiny muted">${esc(p.unit || '')}</span></td>
                  <td class="num muted">${fmt.qty(min)}</td>
                  <td>${stockBadge(stock, min)}</td>
                  <td><div class="bar-track" style="max-width:170px"><i style="--c:${stock <= 0 ? 'var(--danger)' : 'var(--warn)'};width:${Math.max(2, pct)}%"></i></div></td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>` : emptyState({ title: 'المخزون بحالة ممتازة', text: 'لا توجد أصناف عند حد الطلب أو أقل', iconName: 'check-circle' })}
        </div>
      </div>`;

    bindChart(root);
  }

  bindRange(root, range.from, range.to, (from, to) => {
    range.from = from;
    range.to = to;
    load();
  });

  function branchTitle() {
    const b = (state.branches || []).find((x) => Number(x.id) === Number(state.branchId || state.defaultBranchId));
    return b?.name || 'كل الفروع';
  }

  function exportSections() {
    const d = report;
    const p = (v) => PAY_LABELS[v] || v || '—';
    return [
      {
        title: 'حركة المبيعات اليومية',
        columns: [
          { key: 'date', label: 'التاريخ' }, { key: 'sales', label: 'المبيعات' },
          { key: 'profit', label: 'الربح' }, { key: 'invoices', label: 'الفواتير' },
          { key: 'expenses', label: 'المصروفات' },
        ],
        rows: d.series.map((x) => ({
          date: fmt.date(x.date), sales: fmt.money(x.sales, false), profit: fmt.money(x.profit, false),
          invoices: fmt.int(x.invoices), expenses: fmt.money(x.expenses, false),
        })),
      },
      {
        title: 'الأصناف الأكثر مبيعًا',
        columns: [
          { key: 'name', label: 'الصنف' }, { key: 'qty', label: 'الكمية' },
          { key: 'revenue', label: 'الإيراد' }, { key: 'cost', label: 'التكلفة' },
          { key: 'profit', label: 'الربح' },
        ],
        rows: d.topProducts.map((x) => ({
          name: x.name, qty: fmt.qty(x.qty), revenue: fmt.money(x.revenue, false),
          cost: fmt.money(x.cost, false), profit: fmt.money(x.profit, false),
        })),
      },
      {
        title: 'المبيعات حسب التصنيف',
        columns: [{ key: 'name', label: 'التصنيف' }, { key: 'qty', label: 'الكمية' }, { key: 'revenue', label: 'الإيراد' }],
        rows: d.byCategory.map((x) => ({ name: x.name, qty: fmt.qty(x.qty), revenue: fmt.money(x.revenue, false) })),
      },
      {
        title: 'طرق الدفع',
        columns: [{ key: 'method', label: 'الطريقة' }, { key: 'count', label: 'عدد الفواتير' }, { key: 'total', label: 'الإجمالي' }],
        rows: d.paymentMix.map((x) => ({ method: p(x.method), count: fmt.int(x.count), total: fmt.money(x.total, false) })),
      },
      {
        title: 'أفضل العملاء',
        columns: [{ key: 'name', label: 'العميل' }, { key: 'invoices', label: 'الفواتير' }, { key: 'total', label: 'إجمالي الشراء' }],
        rows: d.topCustomers.map((x) => ({ name: x.name, invoices: fmt.int(x.invoices), total: fmt.money(x.total, false) })),
      },
      {
        title: 'أصناف تحتاج إعادة طلب',
        columns: [
          { key: 'name', label: 'الصنف' }, { key: 'stock', label: 'المخزون' },
          { key: 'min', label: 'حد الطلب' }, { key: 'unit', label: 'الوحدة' },
        ],
        rows: d.lowStock.map((x) => ({ name: x.name, stock: fmt.qty(x.stock), min: fmt.qty(x.min_stock), unit: x.unit || '' })),
      },
    ];
  }

  function exportMeta() {
    const d = report;
    return {
      title: 'تقرير أداء المتجر',
      subtitle: `${branchTitle()} · من ${fmt.date(d.from)} إلى ${fmt.date(d.to)}`,
      generated: fmt.datetime(new Date().toISOString()),
      footer: `${state.settings.store_name || 'سوق البركة'} · ${branchTitle()}`,
      summary: [
        { label: 'إجمالي المبيعات', value: fmt.money(d.sales.total) },
        { label: 'إجمالي الربح', value: fmt.money(d.sales.profit) },
        { label: 'المصروفات', value: fmt.money(d.expenses.total) },
        { label: 'صافي الربح', value: fmt.money(Number(d.sales.profit) - Number(d.expenses.total)) },
        { label: 'عدد الفواتير', value: fmt.int(d.sales.invoices) },
        { label: 'قيمة المخزون', value: fmt.money(d.inventory.value_cost) },
      ],
    };
  }

  const showExportError = (e) => {
    root.querySelector('#report-body').insertAdjacentHTML('afterbegin', `<div class="alert alert-danger show" style="margin-bottom:12px">${icon('alert')}<span>${esc(e.message)}</span></div>`);
  };

  root.querySelector('[data-export]').addEventListener('click', () => {
    if (!report) return;
    try {
      exportCsv(`baraka-report-${range.from}-${range.to}.csv`, report.series, [
        { key: 'date', label: 'التاريخ' },
        { key: 'sales', label: 'المبيعات' },
        { key: 'profit', label: 'الأرباح' },
        { key: 'invoices', label: 'الفواتير' },
        { key: 'expenses', label: 'المصروفات' },
      ]);
    } catch (e) { showExportError(e); }
  });

  root.querySelector('[data-export-excel]').addEventListener('click', () => {
    if (!report) return;
    try {
      exportExcel(`baraka-report-${range.from}-${range.to}`, exportSections(), exportMeta());
    } catch (e) { showExportError(e); }
  });

  root.querySelector('[data-export-pdf]').addEventListener('click', () => {
    if (!report) return;
    try {
      exportPdf('تقرير أداء المتجر', exportSections(), exportMeta());
    } catch (e) { showExportError(e); }
  });

  await load();
  return () => { alive = false; };
}
