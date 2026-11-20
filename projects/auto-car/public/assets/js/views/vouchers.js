/* ============================================================
   Auto Car — سندات القبض والصرف
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, fmtDate, state, pick, todayStr, can, exportCustom, printHtml } from '../core.js';
import { modal, toast, confirmDialog, renderTable, statusBadge, emptyState } from '../ui.js';

export async function render(container) {
  let kind = 'receipt', page = 1, filters = {};
  container.innerHTML = `
    <div class="tabs mb-2">
      <button class="tab active" data-kind="receipt">${icon('cash', 'sm')} ${t('receipt')}</button>
      <button class="tab" data-kind="payment">${icon('cash', 'sm')} ${t('payment')}</button>
    </div>
    <div class="toolbar mb-2">
      <div class="search-box grow" style="max-width:260px">${icon('search')}<input class="input" data-q placeholder="${t('search')}"></div>
      <input class="input" type="date" data-f="from" style="max-width:155px">
      <input class="input" type="date" data-f="to" style="max-width:155px">
      <div class="grow"></div>
      <button class="btn btn-ghost" data-export>${icon('sheet', 'sm')} ${t('export_excel')}</button>
      ${can('accounting.manage') ? `<button class="btn btn-primary" data-add>${icon('plus', 'sm')} ${t('add')}</button>` : ''}
    </div>
    <div data-table></div>`;

  async function load() {
    const tbl = container.querySelector('[data-table]');
    tbl.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const p = new URLSearchParams({ page, limit: 50, kind });
    const q = container.querySelector('[data-q]').value.trim(); if (q) p.set('q', q);
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    const d = await api('/vouchers?' + p);
    const cols = [
      { key: 'voucher_no', label: t('voucher_no'), render: (r) => `<b class="mono">${esc(r.voucher_no)}</b>` },
      { key: 'date', label: t('date'), render: (r) => esc(fmtDate(r.date)) },
      { key: 'party', label: t('party'), render: (r) => esc(r.party_type === 'customer' ? (r.party_id || '') : r.party_type === 'supplier' ? (r.party_id || '') : r.account_name || '—') },
      { key: 'account_name', label: t('account'), render: (r) => `<span class="small muted">${esc(r.account_name || '—')}</span>` },
      { key: 'treasury_name', label: t('treasury'), render: (r) => esc(r.treasury_name || '—') },
      { key: 'method', label: t('payment_method'), render: (r) => statusBadge(r.method) },
      { key: 'amount', label: t('amount'), align: 'end', render: (r) => `<b>${money(r.amount)}</b>` },
      { key: 'description', label: t('description'), render: (r) => `<span class="small muted">${esc(r.description || '')}</span>` },
      { key: 'actions', label: t('actions'), align: 'end', width: '90px', render: (r) => can('accounting.manage') ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}" title="${t('delete')}">${icon('trash', 'sm')}</button>` : '' },
    ];
    const pages = Math.max(1, Math.ceil((d.total || 0) / 50));
    tbl.innerHTML = renderTable({ columns: cols, rows: d.items, empty: t('no_data') }) +
      `<div class="pagination"><button class="btn btn-ghost btn-sm" data-prev ${page <= 1 ? 'disabled' : ''}>${icon('chevron-right', 'sm')} ${t('prev')}</button><span class="small muted">${t('page')} ${page} ${t('of')} ${pages}</span><button class="btn btn-ghost btn-sm" data-next ${page >= pages ? 'disabled' : ''}>${t('next')} ${icon('chevron-left', 'sm')}</button></div>`;
    tbl.querySelector('[data-prev]').onclick = () => { page--; load(); };
    tbl.querySelector('[data-next]').onclick = () => { page++; load(); };
    tbl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { if (await confirmDialog(t('confirm_delete'))) { try { await api(`/vouchers/${b.dataset.del}`, { method: 'DELETE' }); toast(t('msg_deleted')); load(); } catch (e) { toast(e.message, 'error'); } } });
    container._rows = d.items;
  }

  function openForm() {
    const customers = state.meta.customers || [], suppliers = state.meta.suppliers || [], treasuries = state.meta.treasuries || [];
    const m = modal({
      title: `${t('add')} ${kind === 'receipt' ? t('receipt') : t('payment')}`,
      body: `<div class="form-grid">
        <div class="field"><label>${t('party')} — ${t('kind')}</label><select class="select" name="party_type">
          <option value="customer">${t('customer')}</option><option value="supplier">${t('supplier')}</option><option value="other">${t('other') || 'أخرى'}</option></select></div>
        <div class="field" data-party-cust><label>${t('customer')}</label><select class="select" name="customer_id">${customers.map((c) => `<option value="${c.id}">${esc(pick(c))} — ${money(c.balance)}</option>`).join('')}</select></div>
        <div class="field" data-party-sup style="display:none"><label>${t('supplier')}</label><select class="select" name="supplier_id">${suppliers.map((c) => `<option value="${c.id}">${esc(pick(c))} — ${money(c.balance)}</option>`).join('')}</select></div>
        <div class="field" data-party-acc style="display:none"><label>${t('account')}</label><select class="select" name="account_id">${(state.meta.accounts || []).map((a) => `<option value="${a.id}">${esc(a.code)} — ${esc(a.name)}</option>`).join('')}</select></div>
        <div class="field"><label>${t('amount')} <span class="req">*</span></label><input class="input" type="number" step="any" name="amount"></div>
        <div class="field"><label>${t('treasury')}</label><select class="select" name="treasury_id">${treasuries.map((x) => `<option value="${x.id}">${esc(pick(x))} — ${money(x.balance)}</option>`).join('')}</select></div>
        <div class="field"><label>${t('payment_method')}</label><select class="select" name="method"><option value="cash">${t('cash')}</option><option value="transfer">${t('transfer')}</option><option value="card">${t('card') || 'بطاقة'}</option></select></div>
        <div class="field"><label>${t('date')}</label><input class="input" type="date" name="date" value="${todayStr()}"></div>
        <div class="field full"><label>${t('description')}</label><input class="input" name="description"></div>
      </div>`,
      footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-save>${icon('save', 'sm')} ${t('save')}</button>`,
    });
    const pt = m.node.querySelector('[name=party_type]');
    function toggle() {
      const v = pt.value;
      m.node.querySelector('[data-party-cust]').style.display = v === 'customer' ? '' : 'none';
      m.node.querySelector('[data-party-sup]').style.display = v === 'supplier' ? '' : 'none';
      m.node.querySelector('[data-party-acc]').style.display = v === 'other' ? '' : 'none';
    }
    pt.onchange = toggle; toggle();
    m.node.querySelector('[data-x]').onclick = m.close;
    m.node.querySelector('[data-save]').onclick = async () => {
      const g = (n) => { const el = m.node.querySelector(`[name=${n}]`); return el ? el.value : ''; };
      const party_type = g('party_type');
      const body = { kind, amount: Number(g('amount')), treasury_id: g('treasury_id'), method: g('method'), date: g('date'), description: g('description'), party_type };
      if (party_type === 'customer') body.party_id = g('customer_id');
      else if (party_type === 'supplier') body.party_id = g('supplier_id');
      else body.account_id = g('account_id');
      if (!body.amount) return toast(t('amount') + ' ' + t('required'), 'warn');
      try { const r = await api('/vouchers', { method: 'POST', body }); toast(t('saved') + ' — ' + r.voucher_no); m.close(); load(); }
      catch (e) { toast(e.message, 'error'); }
    };
  }

  container.querySelectorAll('.tab').forEach((b) => b.onclick = () => { kind = b.dataset.kind; page = 1; container.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b)); load(); });
  container.querySelectorAll('[data-f]').forEach((s) => s.onchange = () => { filters[s.dataset.f] = s.value; page = 1; load(); });
  container.querySelector('[data-q]').oninput = () => { clearTimeout(container._h); container._h = setTimeout(() => { page = 1; load(); }, 300); };
  const addBtn = container.querySelector('[data-add]'); if (addBtn) addBtn.onclick = openForm;
  container.querySelector('[data-export]').onclick = () => exportCustom(t('vouchers'), [
    { key: 'voucher_no', label: t('voucher_no') }, { key: 'date', label: t('date') }, { key: 'account_name', label: t('account') },
    { key: 'treasury_name', label: t('treasury') }, { key: 'method', label: t('payment_method') }, { key: 'amount', label: t('amount') }, { key: 'description', label: t('description') },
  ], container._rows || [], 'vouchers.xlsx');
  load();
}
