/* ============================================================
   Auto Car — الأقساط والمتأخرات + التحصيل
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, fmtDate, state, pick, todayStr, can } from '../core.js';
import { modal, toast, renderTable, statusBadge, emptyState } from '../ui.js';
import { exportCustom } from '../core.js';

export async function render(container) {
  let filters = { status: '' };
  container.innerHTML = `
    <div class="toolbar mb-2">
      <select class="select" data-f="status" style="max-width:170px"><option value="">${t('all')}</option>${['pending', 'partial', 'overdue', 'paid'].map((s) => `<option value="${s}">${t(s)}</option>`).join('')}</select>
      <input class="input" type="date" data-f="from" style="max-width:160px">
      <input class="input" type="date" data-f="to" style="max-width:160px">
      <div class="grow"></div>
      <button class="btn btn-ghost" data-refresh>${icon('refresh', 'sm')} ${t('refresh') || t('generate_alerts')}</button>
      <button class="btn btn-ghost" data-export>${icon('sheet', 'sm')} ${t('export_excel')}</button>
    </div>
    <div data-totals class="grid cols-3 mb-2"></div>
    <div data-table></div>`;

  async function load() {
    const tbl = container.querySelector('[data-table]');
    tbl.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    const d = await api('/installments?' + p);
    const tt = d.totals || {};
    container.querySelector('[data-totals]').innerHTML = `
      <div class="stat"><div class="stat-icon tone-brand">${icon('calendar', 'lg')}</div><div><div class="stat-label">${t('total')}</div><div class="stat-val">${money(tt.amount)}</div></div></div>
      <div class="stat"><div class="stat-icon tone-success">${icon('check', 'lg')}</div><div><div class="stat-label">${t('paid')}</div><div class="stat-val">${money(tt.paid)}</div></div></div>
      <div class="stat"><div class="stat-icon tone-danger">${icon('alert', 'lg')}</div><div><div class="stat-label">${t('remaining')}</div><div class="stat-val">${money(tt.remaining)}</div></div></div>`;
    const cols = [
      { key: 'seq', label: t('seq'), render: (r) => `<b>${r.seq}</b>` },
      { key: 'customer_name', label: t('customer'), render: (r) => `${esc(r.customer_name || '—')}${r.phone ? `<div class="small muted">${esc(r.phone)}</div>` : ''}` },
      { key: 'invoice_no', label: t('invoice_no'), render: (r) => `<span class="mono small">${esc(r.invoice_no || '—')}</span>` },
      { key: 'due_date', label: t('due_date'), render: (r) => esc(fmtDate(r.due_date)) },
      { key: 'amount', label: t('amount'), align: 'end', render: (r) => money(r.amount) },
      { key: 'paid_amount', label: t('paid_amount'), align: 'end', render: (r) => money(r.paid_amount) },
      { key: 'rem', label: t('remaining'), align: 'end', render: (r) => `<b>${money(Number(r.amount) - Number(r.paid_amount))}</b>` },
      { key: 'status', label: t('status'), render: (r) => statusBadge(r.status) },
      { key: 'actions', label: t('actions'), align: 'end', width: '90px', render: (r) => r.status !== 'paid' && can('installments.manage') ? `<button class="btn btn-primary btn-sm" data-pay="${r.id}">${icon('cash', 'sm')} ${t('pay')}</button>` : '' },
    ];
    tbl.innerHTML = renderTable({ columns: cols, rows: d.items, empty: t('no_data') });
    tbl.querySelectorAll('[data-pay]').forEach((b) => b.onclick = () => payModal(d.items.find((x) => x.id == b.dataset.pay), load));
    container._rows = d.items;
  }
  container.querySelectorAll('[data-f]').forEach((s) => s.onchange = () => { filters[s.dataset.f] = s.value; load(); });
  container.querySelector('[data-refresh]').onclick = async () => { await api('/installments/refresh', { method: 'POST' }); toast(t('saved')); load(); };
  container.querySelector('[data-export]').onclick = () => exportCustom(t('report_installments'), [
    { key: 'seq', label: t('seq') }, { key: 'customer_name', label: t('customer') }, { key: 'invoice_no', label: t('invoice_no') },
    { key: 'due_date', label: t('due_date') }, { key: 'amount', label: t('amount') }, { key: 'paid_amount', label: t('paid_amount') }, { key: 'status', label: t('status') },
  ], container._rows || [], 'installments.xlsx');
  load();
}

export function payModal(inst, done) {
  const due = Number(inst.amount) - Number(inst.paid_amount);
  const m = modal({
    title: `${t('collect')} — ${esc(inst.customer_name || '')}`,
    body: `<div class="mini-stat mb-2"><div class="ms-label">${t('remaining')}</div><div class="ms-val strong">${money(due)}</div></div>
      <div class="form-grid">
        <div class="field"><label>${t('amount')}</label><input class="input" type="number" step="any" name="amount" value="${due}"></div>
        <div class="field"><label>${t('date')}</label><input class="input" type="date" name="date" value="${todayStr()}"></div>
        <div class="field"><label>${t('payment_method')}</label><select class="select" name="method"><option value="cash">${t('cash')}</option><option value="transfer">${t('transfer')}</option></select></div>
        <div class="field"><label>${t('treasury')}</label><select class="select" name="treasury_id"><option value="">— ${t('select')} —</option>${(state.meta.treasuries || []).map((tr) => `<option value="${tr.id}">${esc(pick(tr))}</option>`).join('')}</select></div>
        <div class="field full"><label>${t('notes')}</label><input class="input" name="note"></div>
      </div>`,
    footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-save>${icon('check', 'sm')} ${t('confirm')}</button>`,
  });
  m.node.querySelector('[data-x]').onclick = m.close;
  m.node.querySelector('[data-save]').onclick = async () => {
    const g = (n) => m.node.querySelector(`[name=${n}]`).value;
    try { await api(`/installments/${inst.id}/pay`, { method: 'POST', body: { amount: Number(g('amount')), date: g('date'), method: g('method'), treasury_id: g('treasury_id') || null, note: g('note') } }); toast(t('saved')); m.close(); done(); }
    catch (e) { toast(e.message, 'error'); }
  };
}
