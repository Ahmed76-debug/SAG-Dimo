/* ============================================================
   Auto Car — خطط التقسيط
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, fmtDate, can } from '../core.js';
import { modal, toast, renderTable, statusBadge } from '../ui.js';
import { payModal } from './installments.js';

export async function render(container) {
  let status = '', q = '';
  container.innerHTML = `
    <div class="toolbar mb-2">
      <div class="search-box grow" style="max-width:280px">${icon('search')}<input class="input" data-q placeholder="${t('search')}"></div>
      <select class="select" data-status style="max-width:170px"><option value="">${t('all')}</option><option value="active">${t('active_plan')}</option><option value="closed">${t('closed')}</option><option value="defaulted">${t('defaulted')}</option></select>
      <div class="grow"></div>
    </div>
    <div data-table></div>`;

  async function load() {
    const tbl = container.querySelector('[data-table]');
    tbl.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const p = new URLSearchParams(); if (status) p.set('status', status); if (q) p.set('q', q);
    const d = await api('/installments/plans?' + p);
    const cols = [
      { key: 'customer_name', label: t('customer'), render: (r) => `<b>${esc(r.customer_name || '—')}</b>` },
      { key: 'invoice_no', label: t('invoice_no'), render: (r) => `<span class="mono small">${esc(r.invoice_no || '—')}</span>` },
      { key: 'financed_amount', label: t('total'), align: 'end', render: (r) => money(r.financed_amount) },
      { key: 'installment_amount', label: t('amount'), align: 'end', render: (r) => money(r.installment_amount) },
      { key: 'progress', label: t('seq'), align: 'end', render: (r) => `${fmtNum(r.count_paid, 0)} / ${fmtNum(r.count_total, 0)}` },
      { key: 'remaining', label: t('remaining'), align: 'end', render: (r) => `<b class="${Number(r.remaining) > 0 ? 'text-danger' : 'text-success'}">${money(r.remaining)}</b>` },
      { key: 'start_date', label: t('start_date'), render: (r) => esc(fmtDate(r.start_date)) },
      { key: 'status', label: t('status'), render: (r) => statusBadge(r.status) },
      { key: 'actions', label: t('actions'), align: 'end', width: '80px', render: (r) => `<button class="btn btn-ghost btn-icon btn-sm" data-view="${r.id}">${icon('eye', 'sm')}</button>` },
    ];
    tbl.innerHTML = renderTable({ columns: cols, rows: d.items, empty: t('no_data') });
    tbl.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => detail(b.dataset.view, load));
  }
  container.querySelector('[data-q]').oninput = () => { clearTimeout(container._h); container._h = setTimeout(() => { q = container.querySelector('[data-q]').value.trim(); load(); }, 300); };
  container.querySelector('[data-status]').onchange = (e) => { status = e.target.value; load(); };
  load();

  async function detail(id, reload) {
    const d = await api(`/installments/plans/${id}`);
    const p = d.item;
    const m = modal({
      title: `${t('installment_plan') || t('installment_plans')} — ${esc(p.customer_name || '')}`,
      size: 'modal-lg',
      body: `<div class="grid cols-4 mb-2">
        <div class="mini-stat"><div class="ms-label">${t('total')}</div><div class="ms-val">${money(p.total_amount)}</div></div>
        <div class="mini-stat"><div class="ms-label">${t('down_payment')}</div><div class="ms-val">${money(p.down_payment)}</div></div>
        <div class="mini-stat"><div class="ms-label">${t('installments_count')}</div><div class="ms-val">${fmtNum(p.installments_count, 0)}</div></div>
        <div class="mini-stat"><div class="ms-label">${t('plan_status')}</div><div class="ms-val">${t(p.status)}</div></div>
      </div>
      <div class="table-wrap"><table class="data"><thead><tr><th>${t('seq')}</th><th>${t('due_date')}</th><th class="num">${t('amount')}</th><th class="num">${t('paid_amount')}</th><th>${t('status')}</th><th></th></tr></thead>
      <tbody>${(p.installments || []).map((i) => `<tr><td>${i.seq}</td><td>${esc(fmtDate(i.due_date))}</td><td class="num">${money(i.amount, false)}</td><td class="num">${money(i.paid_amount, false)}</td><td>${statusBadge(i.status)}</td>
        <td class="num">${i.status !== 'paid' && can('installments.manage') ? `<button class="btn btn-soft btn-sm" data-pay="${i.id}">${t('pay')}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
      ${(p.payments || []).length ? `<h4 class="mt-2">${t('collect')}</h4><div class="table-wrap"><table class="data"><thead><tr><th>${t('date')}</th><th class="num">${t('amount')}</th><th>${t('treasury')}</th><th>${t('user')}</th></tr></thead><tbody>${p.payments.map((x) => `<tr><td>${esc(fmtDate(x.date))}</td><td class="num">${money(x.amount, false)}</td><td>${esc(x.treasury_name || '—')}</td><td>${esc(x.user_name || '—')}</td></tr>`).join('')}</tbody></table></div>` : ''}`,
      footer: `<button class="btn btn-ghost" data-x>${t('close')}</button>`,
    });
    m.node.querySelector('[data-x]').onclick = () => { m.close(); reload(); };
    m.node.querySelectorAll('[data-pay]').forEach((b) => b.onclick = () => {
      const inst = p.installments.find((x) => x.id == b.dataset.pay);
      payModal(inst, async () => { m.close(); reload(); });
    });
  }
}
