/* ============================================================
   Auto Car — فواتير الشراء (قائمة + تفاصيل)
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, fmtDate, can } from '../core.js';
import { modal, toast, confirmDialog, renderTable, statusBadge } from '../ui.js';
import { exportEntity } from '../core.js';

export async function render(container) {
  let page = 1, filters = {};
  container.innerHTML = `
    <div class="toolbar mb-2">
      <div class="search-box grow" style="max-width:280px">${icon('search')}<input class="input" data-q placeholder="${t('search')}"></div>
      <input class="input" type="date" data-f="from" style="max-width:160px">
      <input class="input" type="date" data-f="to" style="max-width:160px">
      <div class="grow"></div>
      <button class="btn btn-ghost" data-export>${icon('sheet', 'sm')} ${t('export_excel')}</button>
      ${can('purchases.manage') ? `<a class="btn btn-primary" href="#/v/purchase-new">${icon('plus', 'sm')} ${t('new_purchase')}</a>` : ''}
    </div>
    <div data-totals class="grid cols-3 mb-2"></div>
    <div data-table></div>`;

  async function load() {
    const tbl = container.querySelector('[data-table]');
    tbl.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const p = new URLSearchParams({ page, limit: 50 });
    const q = container.querySelector('[data-q]').value.trim(); if (q) p.set('q', q);
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    const d = await api('/purchases?' + p);
    const tt = d.totals || {};
    container.querySelector('[data-totals]').innerHTML = `
      <div class="stat"><div class="stat-icon tone-brand">${icon('truck', 'lg')}</div><div><div class="stat-label">${t('purchases_list')}</div><div class="stat-val">${fmtNum(d.total, 0)}</div></div></div>
      <div class="stat"><div class="stat-icon tone-success">${icon('cash', 'lg')}</div><div><div class="stat-label">${t('total')}</div><div class="stat-val">${money(tt.total)}</div></div></div>
      <div class="stat"><div class="stat-icon tone-warn">${icon('clock', 'lg')}</div><div><div class="stat-label">${t('remaining')}</div><div class="stat-val">${money(Number(tt.total) - Number(tt.paid))}</div></div></div>`;
    const cols = [
      { key: 'invoice_no', label: t('invoice_no'), render: (r) => `<b>${esc(r.invoice_no)}</b>` },
      { key: 'date', label: t('date'), render: (r) => esc(fmtDate(r.date)) },
      { key: 'supplier_name', label: t('supplier'), render: (r) => esc(r.supplier_name || '—') },
      { key: 'items_count', label: t('vehicles'), align: 'end', render: (r) => fmtNum(r.items_count, 0) },
      { key: 'payment_method', label: t('payment_method'), render: (r) => statusBadge(r.payment_method === 'credit' ? 'credit' : 'cash') },
      { key: 'total', label: t('invoice_total'), align: 'end', render: (r) => `<b>${money(r.total)}</b>` },
      { key: 'paid', label: t('paid'), align: 'end', render: (r) => money(r.paid) },
      { key: 'remaining', label: t('remaining'), align: 'end', render: (r) => Number(r.remaining) > 0 ? `<span class="text-danger">${money(r.remaining)}</span>` : money(0) },
      { key: 'actions', label: t('actions'), align: 'end', width: '120px', render: (r) => `<div class="row-actions">
        <button class="btn btn-ghost btn-icon btn-sm" data-view="${r.id}">${icon('eye', 'sm')}</button>
        ${can('purchases.manage') ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}">${icon('trash', 'sm')}</button>` : ''}</div>` },
    ];
    const pages = Math.max(1, Math.ceil((d.total || 0) / 50));
    tbl.innerHTML = renderTable({ columns: cols, rows: d.items, empty: t('no_data') }) +
      `<div class="pagination"><button class="btn btn-ghost btn-sm" data-prev ${page <= 1 ? 'disabled' : ''}>${icon('chevron-right', 'sm')} ${t('prev')}</button><span class="small muted">${t('page')} ${page} ${t('of')} ${pages}</span><button class="btn btn-ghost btn-sm" data-next ${page >= pages ? 'disabled' : ''}>${t('next')} ${icon('chevron-left', 'sm')}</button></div>`;
    tbl.querySelector('[data-prev]').onclick = () => { page--; load(); };
    tbl.querySelector('[data-next]').onclick = () => { page++; load(); };
    tbl.querySelectorAll('[data-view]').forEach((b) => b.onclick = async () => {
      const r = await api(`/purchases/${b.dataset.view}`); const s = r.item;
      modal({
        title: `${t('purchase') || t('purchases_list')} — ${esc(s.invoice_no)}`, size: 'modal-lg',
        body: `<div class="detail-list two mb-2">
          <div class="di"><span class="k">${t('supplier')}</span><span class="v">${esc(s.supplier_name || '—')}</span></div>
          <div class="di"><span class="k">${t('date')}</span><span class="v">${esc(s.date)}</span></div>
          <div class="di"><span class="k">${t('payment_method')}</span><span class="v">${esc(t(s.payment_method))}</span></div>
          <div class="di"><span class="k">${t('invoice_total')}</span><span class="v">${money(s.total)}</span></div></div>
          <div class="table-wrap"><table class="data"><thead><tr><th>${t('code')}</th><th>${t('vin')}</th><th class="num">${t('cost_price')}</th></tr></thead>
          <tbody>${(s.items || []).map((it) => `<tr><td><b>${esc(it.vehicle_code || '—')}</b></td><td class="mono small">${esc(it.vin || '')}</td><td class="num">${money(it.price, false)}</td></tr>`).join('')}</tbody></table></div>`,
        footer: `<button class="btn btn-ghost" data-x>${t('close')}</button>`,
      }).node.querySelector('[data-x]').onclick = (e) => e.target.closest('.modal-backdrop').remove();
    });
    tbl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      if (await confirmDialog(t('confirm_delete'))) { try { await api(`/purchases/${b.dataset.del}`, { method: 'DELETE' }); toast(t('msg_deleted')); load(); } catch (e) { toast(e.message, 'error'); } }
    });
  }
  container.querySelectorAll('[data-f]').forEach((s) => s.onchange = () => { filters[s.dataset.f] = s.value; page = 1; load(); });
  container.querySelector('[data-q]').oninput = () => { clearTimeout(container._h); container._h = setTimeout(() => { page = 1; load(); }, 300); };
  container.querySelector('[data-export]').onclick = () => exportEntity('purchases');
  load();
}
