/* ============================================================
   لوحة التحكم
   ============================================================ */
import { state, api, can, icon, esc, fmt, paymentLabels, initials } from '../core.js';
import { areaChart, bindChart, donutChart, sparkline, statusBadge, methodBadge, emptyState } from '../ui.js';
import { openInvoiceModal } from './invoice.js';

const PAY_COLORS = { cash: 'var(--brand)', card: 'var(--info)', wallet: 'var(--purple)', credit: 'var(--warn)' };

export async function render(root) {
  let alive = true;
  async function load() {
    const data = await api('/dashboard');
    if (!alive) return;
    paint(root, data, load);
  }
  await load();
  return () => { alive = false; };
}

function paint(root, d, reload) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء الخير';
  const name = (state.user?.name || '').split(' ')[0];
  const yesterdayTotal = Number(d.yesterday.total) || 0;
  const todayTotal = Number(d.today.total) || 0;
  const delta = (cur, prev) => {
    if (!prev) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  };
  const avgBasket = d.today.invoices ? todayTotal / d.today.invoices : 0;
  const seriesSales = d.series.map((s) => s.total);
  const seriesProfit = d.series.map((s) => s.profit);
  const seriesInvoices = d.series.map((s) => s.invoices);
  const last10 = d.series.slice(-10);
  const paymentItems = d.paymentMix.map((p) => ({
    label: paymentLabels[p.method] || p.method,
    value: p.total,
    color: PAY_COLORS[p.method] || 'var(--muted)',
  }));
  if (!paymentItems.length) paymentItems.push({ label: 'لا مبيعات اليوم', value: 1, color: 'var(--surface-3)' });
  const maxTop = Math.max(1, ...d.topToday.map((t) => Number(t.total) || 0));

  root.innerHTML = `
    <div class="greeting">
      <div>
        <h1>${greet}، <em>${esc(name || 'بك')}</em> 👋</h1>
        <p>${esc(fmt.date(fmt.today(), true))} · إليك ملخص أداء متجرك اليوم</p>
      </div>
      <div class="greeting-actions">
        ${can('products.manage') ? `<a class="btn btn-secondary" href="#/products?new=1">${icon('plus')} منتج جديد</a>` : ''}
        <a class="btn btn-secondary" href="#/reports">${icon('chart')} التقارير</a>
        <a class="btn btn-primary" href="#/pos">${icon('scan')} فاتورة جديدة</a>
      </div>
    </div>

    <div class="kpis stagger">
      ${kpi({
        label: 'مبيعات اليوم', value: fmt.money(todayTotal, false), unit: state.settings.currency || 'ج.م',
        iconName: 'cash', color: 'var(--brand)', soft: 'var(--brand-soft)',
        delta: delta(todayTotal, yesterdayTotal), foot: `أمس ${fmt.money(yesterdayTotal)}`,
        spark: seriesSales,
      })}
      ${kpi({
        label: 'أرباح اليوم', value: fmt.money(d.today.profit, false), unit: state.settings.currency || 'ج.م',
        iconName: 'trend-up', color: 'var(--info)', soft: 'var(--info-soft)',
        delta: delta(Number(d.today.profit), Number(d.yesterday.profit)), foot: `هامش ${fmt.percent(todayTotal ? (d.today.profit / todayTotal) * 100 : 0)}`,
        spark: seriesProfit,
      })}
      ${kpi({
        label: 'فواتير اليوم', value: fmt.int(d.today.invoices), unit: 'فاتورة',
        iconName: 'receipt', color: 'var(--purple)', soft: 'var(--purple-soft)',
        delta: delta(Number(d.today.invoices), Number(d.yesterday.invoices)), foot: `متوسط ${fmt.money(avgBasket)}`,
        spark: seriesInvoices,
      })}
      ${kpi({
        label: 'مبيعات الشهر', value: fmt.money(d.month.total, false), unit: state.settings.currency || 'ج.م',
        iconName: 'chart', color: 'var(--accent)', soft: 'var(--accent-soft)',
        delta: null, foot: `${fmt.int(d.month.invoices)} فاتورة هذا الشهر`,
        spark: seriesSales,
      })}
    </div>

    <div class="dash-grid">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">حركة المبيعات والأرباح</div>
            <div class="card-sub">آخر 14 يومًا</div>
          </div>
          <div class="spacer"></div>
          <div class="chart-legend">
            <span><i style="--c:var(--brand)"></i> المبيعات</span>
            <span><i style="--c:var(--accent)"></i> الأرباح</span>
          </div>
        </div>
        ${areaChart({
          labels: d.series.map((s) => s.date),
          series: [
            { name: 'المبيعات', values: seriesSales, color: 'var(--brand)' },
            { name: 'الأرباح', values: seriesProfit, color: 'var(--accent)' },
          ],
          height: 250,
        })}
        <div class="row between mt-2" style="border-top:1px dashed var(--border);padding-top:12px">
          <div class="summary-strip">
            <div class="summary-item"><span>إجمالي 14 يومًا</span><b>${fmt.money(seriesSales.reduce((a, b) => a + Number(b), 0))}</b></div>
            <div class="summary-item"><span>أرباح 14 يومًا</span><b style="color:var(--brand)">${fmt.money(seriesProfit.reduce((a, b) => a + Number(b), 0))}</b></div>
          </div>
          <a class="btn-link" href="#/reports">تحليل كامل ${icon('arrow-left', 'icon-sm')}</a>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div><div class="card-title">مبيعات اليوم حسب الدفع</div><div class="card-sub">${fmt.int(d.today.invoices)} فاتورة</div></div>
          <div class="spacer"></div>
          ${icon('wallet', 'icon-lg')}
        </div>
        ${donutChart(paymentItems, { centerLabel: 'مبيعات اليوم', centerValue: fmt.money(todayTotal, false) })}
        <div class="mt-3" style="border-top:1px dashed var(--border);padding-top:12px">
          <div class="row between small">
            <span class="muted">إجمالي الخزينة اليوم</span>
            <b>${fmt.money(todayTotal)}</b>
          </div>
        </div>
      </div>
    </div>

    <div class="dash-row">
      <div class="card">
        <div class="card-head">
          <div><div class="card-title">الأكثر مبيعًا اليوم</div><div class="card-sub">أعلى الأصناف إيرادًا</div></div>
          <div class="spacer"></div>
          <span class="badge badge-success">${icon('star', 'icon-sm')} TOP 6</span>
        </div>
        ${d.topToday.length ? `<div class="list">${d.topToday.map((t, i) => `
          <div class="list-row">
            <div class="thumb">${i + 1}</div>
            <div class="lr-body">
              <div class="lr-title">${esc(t.name)}</div>
              <div class="lr-sub">${fmt.qty(t.qty)} ${esc(t.unit || '')}</div>
              <div class="mini-bar"><i style="--w:${Math.max(6, (Number(t.total) / maxTop) * 100)}%"></i></div>
            </div>
            <div class="lr-value">${fmt.money(t.total, false)}</div>
          </div>`).join('')}</div>` : emptyState({ title: 'لا مبيعات اليوم بعد', text: 'ابدأ أول فاتورة من الكاشير', iconName: 'cart' })}
      </div>

      <div class="card">
        <div class="card-head">
          <div><div class="card-title">تنبيهات المخزون</div><div class="card-sub">${fmt.int(d.counts.low_stock + d.counts.out_stock)} صنف يحتاج متابعة</div></div>
          <div class="spacer"></div>
          <a class="btn-link" href="#/inventory">الكل ${icon('arrow-left', 'icon-sm')}</a>
        </div>
        ${d.lowStock.length ? `<div class="list">${d.lowStock.map((p) => {
          const pct = p.min_stock > 0 ? Math.min(100, (p.stock / p.min_stock) * 100) : 0;
          return `<div class="list-row">
            <div class="thumb" style="--c:${p.stock <= 0 ? 'var(--danger)' : 'var(--warn)'}">${icon(p.stock <= 0 ? 'x-circle' : 'alert')}</div>
            <div class="lr-body">
              <div class="lr-title">${esc(p.name)}</div>
              <div class="lr-sub">المتاح ${fmt.qty(p.stock)} ${esc(p.unit)} · الحد ${fmt.qty(p.min_stock)}</div>
              <div class="mini-bar"><i style="--c:${p.stock <= 0 ? 'var(--danger)' : 'var(--warn)'};--w:${Math.max(3, pct)}%"></i></div>
            </div>
            <span class="badge ${p.stock <= 0 ? 'badge-danger' : 'badge-warn'}">${p.stock <= 0 ? 'نفد' : 'منخفض'}</span>
          </div>`;
        }).join('')}</div>` : emptyState({ title: 'المخزون بحالة ممتازة', text: 'كل الأصناف أعلى من حد الطلب', iconName: 'check-circle' })}
      </div>

      <div class="card">
        <div class="card-head">
          <div><div class="card-title">قيمة المخزون</div><div class="card-sub">نظرة على رأس المال</div></div>
          <div class="spacer"></div>
          ${icon('layers', 'icon-lg')}
        </div>
        <div style="text-align:center;padding:8px 0 14px">
          <div class="tiny muted">قيمة المخزون بسعر التكلفة</div>
          <div style="font-size:27px;font-weight:900;letter-spacing:-.04em;margin-top:2px">${fmt.money(d.counts.inventory_value, false)} <small style="font-size:11px;color:var(--muted)">${esc(state.settings.currency)}</small></div>
        </div>
        <div class="grid g2" style="gap:8px">
          <div class="stat-mini"><div class="icon-wrap">${icon('box')}</div><div><b>${fmt.int(d.counts.products)}</b><span>صنف نشط</span></div></div>
          <div class="stat-mini danger"><div class="icon-wrap">${icon('x-circle')}</div><div><b>${fmt.int(d.counts.out_stock)}</b><span>نفد</span></div></div>
          <div class="stat-mini warn"><div class="icon-wrap">${icon('alert')}</div><div><b>${fmt.int(d.counts.low_stock)}</b><span>منخفض</span></div></div>
          <div class="stat-mini info"><div class="icon-wrap">${icon('users')}</div><div><b>${fmt.int(d.counts.customers)}</b><span>عميل</span></div></div>
        </div>
        <div class="row between mt-3" style="border-top:1px dashed var(--border);padding-top:10px">
          <span class="small muted">مديونيات العملاء</span>
          <b class="small" style="color:${d.counts.customers_debt > 0 ? 'var(--warn)' : 'var(--brand)'}">${fmt.money(d.counts.customers_debt)}</b>
        </div>
      </div>
    </div>

    ${d.expiring.length ? `<div class="card mt-3" style="border-color:rgba(245,158,11,.25);background:linear-gradient(180deg,var(--warn-soft),var(--surface) 60%)">
      <div class="card-head" style="margin-bottom:8px">
        <div><div class="card-title">${icon('clock', 'icon-sm')} أصناف تقترب من انتهاء الصلاحية</div><div class="card-sub">خلال 30 يومًا — راجعها لتجنب الخسارة</div></div>
        <div class="spacer"></div>
        <a class="btn btn-sm btn-secondary" href="#/inventory?filter=expiring">عرض الكل</a>
      </div>
      <div class="hscroll">
        ${d.expiring.map((p) => `<div style="min-width:180px;flex:1;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 12px">
          <div class="bold" style="font-size:12px">${esc(p.name)}</div>
          <div class="tiny muted">${fmt.qty(p.stock)} ${esc(p.unit)} · تنتهي ${esc(fmt.shortDate(p.expiry_date))}</div>
          <span class="badge ${p.days_left <= 7 ? 'badge-danger' : 'badge-warn'} mt-1">${p.days_left < 0 ? 'منتهي' : p.days_left === 0 ? 'ينتهي اليوم' : `متبقي ${p.days_left} يوم`}</span>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <div class="card flush mt-3">
      <div class="card-head" style="padding:18px 20px 12px;margin:0">
        <div><div class="card-title">أحدث الفواتير</div><div class="card-sub">آخر 7 عمليات بيع</div></div>
        <div class="spacer"></div>
        <a class="btn btn-sm btn-secondary" href="#/sales">كل المبيعات ${icon('arrow-left', 'icon-sm')}</a>
      </div>
      ${d.recent.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>الفاتورة</th><th>العميل</th><th>الكاشير</th><th>الدفع</th><th>الإجمالي</th><th>الوقت</th><th>الحالة</th></tr></thead>
        <tbody>${d.recent.map((s) => `<tr data-sale="${s.id}" style="cursor:pointer">
          <td class="cell-strong" style="direction:ltr;text-align:start">${esc(s.invoice_no)}</td>
          <td>${esc(s.customer_name)}</td>
          <td class="muted">${esc(s.user_name)}</td>
          <td>${methodBadge(s.payment_method)}</td>
          <td class="num bolder">${fmt.money(s.total)}</td>
          <td class="small muted">${esc(fmt.time(s.created_at))}</td>
          <td>${statusBadge(s.status)}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : emptyState({ title: 'لا توجد فواتير بعد', text: 'ستظهر هنا أحدث عمليات البيع فور تسجيلها', iconName: 'receipt', action: '<a class="btn btn-primary" href="#/pos">بدء بيع جديد</a>' })}
    </div>`;

  bindChart(root);
  root.querySelectorAll('[data-sale]').forEach((tr) => tr.addEventListener('click', () => openInvoiceModal(tr.dataset.sale, { onChanged: reload })));
}

function kpi({ label, value, unit, iconName, color, soft, delta, foot, spark }) {
  const deltaHtml = delta === null ? '' : `<span class="delta ${delta >= 0 ? 'up' : 'down'}">${icon(delta >= 0 ? 'arrow-up' : 'arrow-down')} ${fmt.num(Math.abs(delta))}%</span>`;
  return `<div class="kpi" style="--k:${color};--k-soft:${soft}">
    <div class="kpi-top">
      <span class="kpi-label">${esc(label)}</span>
      <span class="kpi-icon">${icon(iconName)}</span>
    </div>
    <div class="kpi-value">${value} <small>${esc(unit)}</small></div>
    <div class="kpi-foot">${deltaHtml}<span>${esc(foot)}</span></div>
    <div class="spark">${sparkline(spark, color)}</div>
  </div>`;
}
