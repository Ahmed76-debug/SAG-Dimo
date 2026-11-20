/* ============================================================
   Auto Car — فواتير البيع (قائمة + تفاصيل + طباعة)
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, fmtDate, can } from '../core.js';
import { modal, toast, confirmDialog, renderTable, statusBadge, emptyState } from '../ui.js';
import { exportEntity } from '../core.js';
import { showInvoice } from './sale-new.js';

export async function render(container) {
  let page = 1, filters = {};
  container.innerHTML = `
    <div class="toolbar mb-2">
      <div class="search-box grow" style="max-width:280px">${icon('search')}<input class="input" data-q placeholder="${t('search')}"></div>
      <select class="select" data-f="sale_type" style="max-width:160px"><option value="">${t('sale_type')}</option>${['cash', 'installment', 'commission'].map((s) => `<option value="${s}">${t(s)}</option>`).join('')}</select>
      <input class="input" type="date" data-f="from" style="max-width:160px">
      <input class="input" type="date" data-f="to" style="max-width:160px">
      <div class="grow"></div>
      <button class="btn btn-ghost" data-export>${icon('sheet', 'sm')} ${t('export_excel')}</button>
      ${can('sales.manage') ? `<a class="btn btn-primary" href="#/v/sale-new">${icon('plus', 'sm')} ${t('new_sale')}</a>` : ''}
    </div>
    <div data-totals class="grid cols-4 mb-2"></div>
    <div data-table></div>`;

  async function load() {
    const tbl = container.querySelector('[data-table]');
    tbl.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const p = new URLSearchParams({ page, limit: 50 });
    const q = container.querySelector('[data-q]').value.trim(); if (q) p.set('q', q);
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    const d = await api('/sales?' + p);
    const tt = d.totals || {};
    container.querySelector('[data-totals]').innerHTML = `
      <div class="stat"><div class="stat-icon tone-brand">${icon('receipt', 'lg')}</div><div><div class="stat-label">${t('invoices') || t('sales_invoices')}</div><div class="stat-val">${fmtNum(d.total, 0)}</div></div></div>
      <div class="stat"><div class="stat-icon tone-success">${icon('cash', 'lg')}</div><div><div class="stat-label">${t('total')}</div><div class="stat-val">${money(tt.total)}</div></div></div>
      <div class="stat"><div class="stat-icon tone-info">${icon('check', 'lg')}</div><div><div class="stat-label">${t('paid')}</div><div class="stat-val">${money(tt.paid)}</div></div></div>
      <div class="stat"><div class="stat-icon tone-purple">${icon('trend', 'lg')}</div><div><div class="stat-label">${t('profit')}</div><div class="stat-val">${money(tt.profit)}</div></div></div>`;
    const cols = [
      { key: 'invoice_no', label: t('invoice_no'), render: (r) => `<b>${esc(r.invoice_no)}</b>` },
      { key: 'date', label: t('date'), render: (r) => esc(fmtDate(r.date)) },
      { key: 'customer_name', label: t('customer'), render: (r) => esc(r.customer_name) },
      { key: 'sale_type', label: t('sale_type'), render: (r) => statusBadge(r.sale_type) },
      { key: 'items_count', label: t('vehicles'), align: 'end', render: (r) => fmtNum(r.items_count, 0) },
      { key: 'total', label: t('invoice_total'), align: 'end', render: (r) => `<b>${money(r.total)}</b>` },
      { key: 'paid', label: t('paid'), align: 'end', render: (r) => money(r.paid) },
      { key: 'remaining', label: t('remaining'), align: 'end', render: (r) => Number(r.remaining) > 0 ? `<span class="text-danger">${money(r.remaining)}</span>` : money(0) },
      { key: 'profit', label: t('profit'), align: 'end', render: (r) => money(r.profit) },
      { key: 'actions', label: t('actions'), align: 'end', width: '120px', render: (r) => `<div class="row-actions">
        <button class="btn btn-ghost btn-icon btn-sm" data-view="${r.id}" title="${t('view')}">${icon('eye', 'sm')}</button>
        ${can('sales.manage') ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}" title="${t('delete')}">${icon('trash', 'sm')}</button>` : ''}</div>` },
    ];
    const pages = Math.max(1, Math.ceil((d.total || 0) / 50));
    tbl.innerHTML = renderTable({ columns: cols, rows: d.items, empty: t('no_data') }) +
      `<div class="pagination"><button class="btn btn-ghost btn-sm" data-prev ${page <= 1 ? 'disabled' : ''}>${icon('chevron-right', 'sm')} ${t('prev')}</button><span class="small muted">${t('page')} ${page} ${t('of')} ${pages}</span><button class="btn btn-ghost btn-sm" data-next ${page >= pages ? 'disabled' : ''}>${t('next')} ${icon('chevron-left', 'sm')}</button></div>`;
    tbl.querySelector('[data-prev]').onclick = () => { page--; load(); };
    tbl.querySelector('[data-next]').onclick = () => { page++; load(); };
    tbl.querySelectorAll('[data-view]').forEach((b) => b.onclick = async () => { const r = await api(`/sales/${b.dataset.view}`); showInvoice(r.item); });
    tbl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      if (await confirmDialog(t('confirm_delete'))) { try { await api(`/sales/${b.dataset.del}`, { method: 'DELETE' }); toast(t('msg_deleted')); load(); } catch (e) { toast(e.message, 'error'); } }
    });
  }
  container.querySelectorAll('[data-f]').forEach((s) => s.onchange = () => { filters[s.dataset.f] = s.value; page = 1; load(); });
  container.querySelector('[data-q]').oninput = () => { clearTimeout(container._h); container._h = setTimeout(() => { page = 1; load(); }, 300); };
  container.querySelector('[data-export]').onclick = () => exportEntity('sales');
  load();
}
