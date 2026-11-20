/* ============================================================
   Auto Car — البيع بالعمولة: تسويات مستحقات أصحاب السيارات
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, fmtDate, state, pick, todayStr, can } from '../core.js';
import { modal, toast, renderTable, statusBadge, emptyState } from '../ui.js';

export async function render(container) {
  let tab = 'settlements';
  container.innerHTML = `
    <div class="tabs mb-2">
      <button class="tab active" data-tab="settlements">${icon('handshake', 'sm')} ${t('consignment')} — ${t('statements')}</button>
      <button class="tab" data-tab="vehicles">${icon('car', 'sm')} ${t('vehicles')} (${t('consignment_own')})</button>
    </div>
    <div data-body></div>`;
  container.querySelectorAll('.tab').forEach((b) => b.onclick = () => { tab = b.dataset.tab; container.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b)); renderBody(); });
  const body = container.querySelector('[data-body]');

  async function renderBody() {
    if (tab === 'vehicles') return renderVehicles();
    body.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const d = await api('/consignments');
    const tt = d.totals || {};
    body.innerHTML = `
      <div class="grid cols-2 mb-2">
        <div class="stat"><div class="stat-icon tone-purple">${icon('percent', 'lg')}</div><div><div class="stat-label">${t('commission_amount')}</div><div class="stat-val">${money(tt.commission)}</div></div></div>
        <div class="stat"><div class="stat-icon tone-warn">${icon('handshake', 'lg')}</div><div><div class="stat-label">${t('payables')}</div><div class="stat-val">${money(tt.payable)}</div></div></div>
      </div>
      <div data-table></div>`;
    const cols = [
      { key: 'vehicle_code', label: t('vehicles'), render: (r) => `<b>${esc(r.vehicle_code || '—')}</b><div class="small muted">${esc([r.brand_name, r.model_name, r.year].filter(Boolean).join(' '))}</div>` },
      { key: 'owner_name', label: t('owner_name'), render: (r) => esc(r.owner_name || '—') },
      { key: 'invoice_no', label: t('invoice_no'), render: (r) => `<span class="mono small">${esc(r.invoice_no || '—')}</span>` },
      { key: 'sale_amount', label: t('sale_price'), align: 'end', render: (r) => money(r.sale_amount) },
      { key: 'commission_amount', label: t('commission_amount'), align: 'end', render: (r) => `<b class="text-success">${money(r.commission_amount)}</b>` },
      { key: 'owner_amount', label: t('payables'), align: 'end', render: (r) => money(r.owner_amount) },
      { key: 'status', label: t('status'), render: (r) => r.status === 'settled' ? `<span class="badge badge-success">${t('mark_done')}</span>` : `<span class="badge badge-warn">${t('pending')}</span>` },
      { key: 'settled_date', label: t('date'), render: (r) => r.settled_date ? esc(fmtDate(r.settled_date)) : '—' },
      { key: 'actions', label: t('actions'), align: 'end', width: '110px', render: (r) => r.status !== 'settled' && can('consignment.manage') ? `<button class="btn btn-primary btn-sm" data-settle="${r.id}">${icon('cash', 'sm')} ${t('pay')}</button>` : '' },
    ];
    body.querySelector('[data-table]').innerHTML = renderTable({ columns: cols, rows: d.items, empty: t('no_data') });
    body.querySelectorAll('[data-settle]').forEach((b) => b.onclick = () => settle(d.items.find((x) => x.id == b.dataset.settle)));
  }

  function settle(cs) {
    const m = modal({
      title: `${t('pay')} — ${esc(cs.owner_name || cs.vehicle_code || '')}`,
      body: `<div class="mini-stat mb-2"><div class="ms-label">${t('payables')}</div><div class="ms-val strong">${money(cs.owner_amount)}</div></div>
        <div class="form-grid">
          <div class="field"><label>${t('amount')}</label><input class="input" type="number" step="any" name="amount" value="${cs.owner_amount}"></div>
          <div class="field"><label>${t('date')}</label><input class="input" type="date" name="date" value="${todayStr()}"></div>
          <div class="field full"><label>${t('treasury')}</label><select class="select" name="treasury_id"><option value="">— ${t('select')} —</option>${(state.meta.treasuries || []).map((tr) => `<option value="${tr.id}">${esc(pick(tr))}</option>`).join('')}</select></div>
        </div>`,
      footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-save>${icon('check', 'sm')} ${t('confirm')}</button>`,
    });
    m.node.querySelector('[data-x]').onclick = m.close;
    m.node.querySelector('[data-save]').onclick = async () => {
      const g = (n) => m.node.querySelector(`[name=${n}]`).value;
      try { await api(`/consignments/${cs.id}/settle`, { method: 'POST', body: { amount: Number(g('amount')), date: g('date'), treasury_id: g('treasury_id') || null } }); toast(t('saved')); m.close(); renderBody(); }
      catch (e) { toast(e.message, 'error'); }
    };
  }

  async function renderVehicles() {
    body.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const d = await api('/consignments/vehicles');
    if (!d.items.length) { body.innerHTML = emptyState(t('no_data'), 'car'); return; }
    body.innerHTML = `<div class="tile-grid stagger">${d.items.map((v) => `
      <div class="card card-pad">
        <div class="row between"><b>${esc(v.code)}</b>${statusBadge(v.status)}</div>
        <div class="muted mt-1">${esc([v.brand_name, v.model_name, v.year].filter(Boolean).join(' '))}</div>
        <div class="detail-list mt-2">
          <div class="di"><span class="k">${t('owner_name')}</span><span class="v">${esc(v.owner_name || '—')}</span></div>
          <div class="di"><span class="k">${t('owner_phone')}</span><span class="v">${esc(v.owner_phone || '—')}</span></div>
          <div class="di"><span class="k">${t('commission_value')}</span><span class="v">${v.commission_type === 'fixed' ? money(v.commission_value) : fmtNum(v.commission_value, 0) + '%'}</span></div>
          <div class="di"><span class="k">${t('target_price')}</span><span class="v">${money(v.target_price)}</span></div>
        </div>
      </div>`).join('')}</div>`;
  }

  renderBody();
}
