/* ============================================================
   Auto Car — لوحة التحكم
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, fmtDate, state, pick } from '../core.js';
import { kpiCard, barChart, donutChart, statusBadge, emptyState } from '../ui.js';

export async function render(container) {
  container.innerHTML = `<div class="empty"><div class="spinner" style="border-color:var(--border);border-top-color:var(--brand)"></div></div>`;
  let d;
  try { d = await api('/dashboard'); } catch (e) { container.innerHTML = emptyState(e.message, 'alert'); return; }
  const k = d.kpi;

  container.innerHTML = `
    <div class="row between mb-2">
      <div>
        <h2 style="margin:0;font-size:24px;font-weight:900">${icon('gauge', 'lg')} ${esc(t('welcome_back'))}، ${esc(state.user.name)}</h2>
        <div class="muted mt-1">${esc(d.today)} — ${esc(t('tagline'))}</div>
      </div>
      <div class="btn-group">
        <a class="btn btn-primary" href="#/v/sale-new">${icon('plus', 'sm')} ${t('new_sale')}</a>
        <a class="btn btn-ghost" href="#/v/purchase-new">${icon('cart', 'sm')} ${t('new_purchase')}</a>
      </div>
    </div>

    <div class="grid cols-4 stagger">
      ${kpiCard({ label: t('kpi_available'), value: fmtNum(k.vehicles_available, 0), sub: `${t('kpi_inventory_value')}: ${money(k.inventory_value)}`, icon: 'car', tone: 'brand' })}
      ${kpiCard({ label: t('kpi_sales_month'), value: money(k.sales_month), sub: `${t('kpi_sales_today')}: ${money(k.sales_today)}`, icon: 'cart', tone: 'success' })}
      ${kpiCard({ label: t('kpi_profit_month'), value: money(k.profit_month), sub: `${t('kpi_commission_month')}: ${money(k.commission_month)}`, icon: 'trend', tone: 'purple' })}
      ${kpiCard({ label: t('kpi_sold_month'), value: fmtNum(k.vehicles_sold_month, 0), sub: `${t('kpi_reserved', 'محجوزة')}: ${fmtNum(k.vehicles_reserved, 0)}`, icon: 'check-circle', tone: 'info' })}
    </div>

    <div class="grid cols-4 stagger mt-2">
      ${kpiCard({ label: t('kpi_cash'), value: money(k.cash_balance), icon: 'wallet', tone: 'success' })}
      ${kpiCard({ label: t('kpi_bank'), value: money(k.bank_balance), icon: 'bank', tone: 'brand' })}
      ${kpiCard({ label: t('kpi_receivables'), value: money(k.receivables), icon: 'trend', tone: 'warn' })}
      ${kpiCard({ label: t('kpi_payables'), value: money(k.payables), icon: 'truck', tone: 'danger' })}
    </div>

    <div class="grid cols-3 mt-2" style="align-items:start">
      <div class="card card-pad" style="grid-column:span 2">
        <div class="card-head" style="padding:0 0 14px;border:none"><h3>${t('chart_sales_12m')}</h3></div>
        ${barChart(d.series, { valueKey: 'total', labelKey: 'month' })}
      </div>
      <div class="card card-pad">
        <div class="card-head" style="padding:0 0 14px;border:none"><h3>${t('chart_by_type')}</h3></div>
        ${d.byType.length ? donutChart(d.byType, { valueKey: 'total', labelKey: 'type' }) : emptyState(t('no_data'))}
      </div>
    </div>

    <div class="grid cols-3 mt-2" style="align-items:start">
      <div class="card">
        <div class="card-head"><h3>${icon('receipt', 'sm')} ${t('recent_sales')}</h3><div class="spacer"></div><a class="small" href="#/v/sales">${t('all')}</a></div>
        <div style="padding:6px 4px">
          ${d.recentSales.length ? d.recentSales.map((s) => `
            <div class="row between" style="padding:10px 14px;border-bottom:1px solid var(--border)">
              <div><div class="strong" style="font-size:14px">${esc(s.customer_name)}</div><div class="small muted">${esc(s.invoice_no)} — ${esc(fmtDate(s.date))}</div></div>
              <div style="text-align:end"><div class="strong">${money(s.total)}</div>${statusBadge(s.sale_type)}</div>
            </div>`).join('') : emptyState(t('no_data'))}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>${icon('clock', 'sm')} ${t('upcoming_installments')}</h3><div class="spacer"></div><a class="small" href="#/v/installments">${t('all')}</a></div>
        <div style="padding:6px 4px">
          ${d.upcoming.length ? d.upcoming.map((i) => `
            <div class="row between" style="padding:10px 14px;border-bottom:1px solid var(--border)">
              <div><div class="strong" style="font-size:14px">${esc(i.customer_name || '—')}</div><div class="small muted">${t('due_date')}: ${esc(fmtDate(i.due_date))}</div></div>
              <div style="text-align:end"><div class="strong">${money(i.amount - i.paid_amount)}</div>${statusBadge(i.status)}</div>
            </div>`).join('') : emptyState(t('no_data'))}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>${icon('car', 'sm')} ${t('inventory_aging')}</h3><div class="spacer"></div><a class="small" href="#/v/vehicles">${t('all')}</a></div>
        <div style="padding:6px 4px">
          ${d.lowStock.length ? d.lowStock.map((v) => `
            <div class="row between" style="padding:10px 14px;border-bottom:1px solid var(--border)">
              <div><div class="strong" style="font-size:14px">${esc(v.code)}</div><div class="small muted">${esc(v.year || '')} ${statusBadge(v.condition)}</div></div>
              <div style="text-align:end"><div class="strong">${money(v.target_price)}</div><div class="small muted">${t('cost_price')}: ${money(v.cost_price)}</div></div>
            </div>`).join('') : emptyState(t('no_data'))}
        </div>
      </div>
    </div>

    <div class="grid cols-2 mt-2" style="align-items:start">
      <div class="card card-pad">
        <div class="card-head" style="padding:0 0 14px;border:none"><h3>${t('chart_by_brand')}</h3></div>
        ${d.byBrand.length ? barChart(d.byBrand.map((b) => ({ month: b.name, total: b.count })), { valueKey: 'total', labelKey: 'month', money: false }) : emptyState(t('no_data'))}
      </div>
      <div class="card card-pad">
        <div class="card-head" style="padding:0 0 14px;border:none"><h3>${t('kpi_installments_due')}</h3></div>
        <div class="grid cols-2">
          ${kpiCard({ label: t('kpi_installments_due'), value: money(k.installments_due), icon: 'calendar', tone: 'warn' })}
          ${kpiCard({ label: t('kpi_installments_overdue'), value: money(k.installments_overdue), icon: 'alert', tone: 'danger' })}
        </div>
        <div class="mt-2"><a class="btn btn-soft btn-block" href="#/v/installments">${icon('clock', 'sm')} ${t('installments_due')}</a></div>
      </div>
    </div>
  `;
}
