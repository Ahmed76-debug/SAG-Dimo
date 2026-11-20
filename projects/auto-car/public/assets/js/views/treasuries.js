/* ============================================================
   Auto Car — الخزائن والبنوك + التحويل بينها
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, state, pick, todayStr, can } from '../core.js';
import { modal, toast, confirmDialog, emptyState, statusBadge } from '../ui.js';

const KINDS = ['cash', 'bank', 'wallet'];

export async function render(container) {
  container.innerHTML = `
    <div class="toolbar mb-2"><div class="grow"></div>
      ${can('accounting.manage') ? `<button class="btn btn-soft" data-transfer>${icon('swap', 'sm')} ${t('transfer_funds')}</button>
      <button class="btn btn-primary" data-add>${icon('plus', 'sm')} ${t('add')}</button>` : ''}
    </div>
    <div data-cards class="tile-grid mb-2"></div>
    <div data-table></div>`;

  async function load() {
    const d = await api('/treasuries');
    const cards = container.querySelector('[data-cards]');
    const totals = { cash: 0, bank: 0 };
    d.items.forEach((x) => { totals[x.kind === 'bank' ? 'bank' : 'cash'] += Number(x.balance) || 0; });
    cards.innerHTML = `
      <div class="stat"><div class="stat-icon tone-success">${icon('cash', 'lg')}</div><div><div class="stat-label">${t('kpi_cash')}</div><div class="stat-val">${money(totals.cash)}</div></div></div>
      <div class="stat"><div class="stat-icon tone-brand">${icon('bank', 'lg')}</div><div><div class="stat-label">${t('kpi_bank')}</div><div class="stat-val">${money(totals.bank)}</div></div></div>
      <div class="stat"><div class="stat-icon tone-purple">${icon('wallet', 'lg')}</div><div><div class="stat-label">${t('treasuries')}</div><div class="stat-val">${fmtNum(d.items.length, 0)}</div></div></div>`;
    const tbl = container.querySelector('[data-table]');
    if (!d.items.length) { tbl.innerHTML = emptyState(t('no_data'), 'wallet'); return; }
    tbl.innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr><th>${t('treasury_name')}</th><th>${t('treasury_kind')}</th><th>${t('account_name')}</th><th>${t('bank_name')}</th><th class="num">${t('opening_bal')}</th><th class="num">${t('current_balance')}</th><th class="num">${t('actions')}</th></tr></thead>
      <tbody>${d.items.map((r) => `<tr>
        <td><b>${esc(state.lang === 'en' && r.name_en ? r.name_en : r.name)}</b></td>
        <td>${r.kind === 'bank' ? `<span class="badge badge-brand">${icon('bank', 'sm')} ${t('bank_name')}</span>` : `<span class="badge badge-success">${icon('cash', 'sm')} ${t('cash')}</span>`}</td>
        <td><span class="small muted">${esc(r.account_name || '—')}</span></td>
        <td>${esc(r.bank_name || '—')}${r.account_number ? `<div class="small muted mono">${esc(r.account_number)}</div>` : ''}</td>
        <td class="num">${money(r.opening_balance)}</td>
        <td class="num"><b>${money(r.balance)}</b> ${r.currency_code ? `<span class="small muted">${esc(r.currency_code)}</span>` : ''}</td>
        <td class="num"><div class="row-actions">${can('accounting.manage') ? `<button class="btn btn-ghost btn-icon btn-sm" data-edit="${r.id}">${icon('edit', 'sm')}</button>` : ''}</div></td>
      </tr>`).join('')}</tbody></table></div>`;
    tbl.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(d.items.find((x) => x.id == b.dataset.edit)));
  }

  function openForm(tr) {
    const isEdit = !!tr; const d = tr || { kind: 'cash', active: 1, opening_balance: 0 };
    const m = modal({
      title: isEdit ? `${t('edit')} — ${esc(d.name)}` : `${t('add')} ${t('treasury')}`,
      body: `<div class="form-grid">
        <div class="field"><label>${t('treasury_name')} <span class="req">*</span></label><input class="input" name="name" value="${esc(d.name || '')}"></div>
        <div class="field"><label>${t('name_en')}</label><input class="input" name="name_en" value="${esc(d.name_en || '')}"></div>
        <div class="field"><label>${t('treasury_kind')}</label><select class="select" name="kind" ${isEdit ? 'disabled' : ''}>${KINDS.map((k) => `<option value="${k}" ${d.kind === k ? 'selected' : ''}>${t(k === 'bank' ? 'bank_name' : k === 'wallet' ? 'wallet' : 'cash')}</option>`).join('')}</select></div>
        <div class="field"><label>${t('currency')}</label><select class="select" name="currency_id"><option value="">— ${t('select')} —</option>${(state.currencies || []).map((c) => `<option value="${c.id}" ${String(c.id) === String(d.currency_id) ? 'selected' : ''}>${esc(c.code)}</option>`).join('')}</select></div>
        ${!isEdit ? `<div class="field"><label>${t('opening_bal')}</label><input class="input" type="number" step="any" name="opening_balance" value="0"></div>` : ''}
        <div class="field"><label>${t('bank_name')}</label><input class="input" name="bank_name" value="${esc(d.bank_name || '')}"></div>
        <div class="field"><label>${t('account_number')}</label><input class="input" name="account_number" value="${esc(d.account_number || '')}"></div>
        <div class="field"><label>${t('iban')}</label><input class="input" name="iban" value="${esc(d.iban || '')}"></div>
        <div class="field"><label>${t('account_name')}</label><select class="select" name="account_id"><option value="">— ${t('select')} —</option>${(state.meta.accounts || []).map((a) => `<option value="${a.id}" ${String(a.id) === String(d.account_id) ? 'selected' : ''}>${esc(a.code)} — ${esc(a.name)}</option>`).join('')}</select></div>
        <div class="field full"><label class="check"><input type="checkbox" name="active" ${d.active === 0 ? '' : 'checked'}> ${t('active')}</label></div>
      </div>`,
      footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-save>${icon('save', 'sm')} ${t('save')}</button>`,
    });
    m.node.querySelector('[data-x]').onclick = m.close;
    m.node.querySelector('[data-save]').onclick = async () => {
      const g = (n) => { const el = m.node.querySelector(`[name=${n}]`); return el ? el.value : ''; };
      const payload = { name: g('name'), name_en: g('name_en'), kind: g('kind'), currency_id: g('currency_id') || null, bank_name: g('bank_name'), account_number: g('account_number'), iban: g('iban'), account_id: g('account_id') || null, active: m.node.querySelector('[name=active]').checked ? 1 : 0 };
      if (!isEdit) payload.opening_balance = Number(g('opening_balance')) || 0;
      if (!payload.name) return toast(t('required'), 'warn');
      try { await api(isEdit ? `/treasuries/${tr.id}` : '/treasuries', { method: isEdit ? 'PUT' : 'POST', body: payload }); toast(isEdit ? t('msg_updated') : t('msg_added')); m.close(); load(); }
      catch (e) { toast(e.message, 'error'); }
    };
  }

  function transfer() {
    const list = state.meta.treasuries || [];
    const m = modal({
      title: t('transfer_funds'),
      body: `<div class="form-grid">
        <div class="field"><label>${t('from_treasury')}</label><select class="select" name="from_id">${list.map((x) => `<option value="${x.id}">${esc(pick(x))} — ${money(x.balance)}</option>`).join('')}</select></div>
        <div class="field"><label>${t('to_treasury')}</label><select class="select" name="to_id">${list.map((x) => `<option value="${x.id}">${esc(pick(x))} — ${money(x.balance)}</option>`).join('')}</select></div>
        <div class="field"><label>${t('amount')}</label><input class="input" type="number" step="any" name="amount"></div>
        <div class="field"><label>${t('date')}</label><input class="input" type="date" name="date" value="${todayStr()}"></div>
      </div>`,
      footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-save>${icon('swap', 'sm')} ${t('confirm')}</button>`,
    });
    m.node.querySelector('[data-x]').onclick = m.close;
    m.node.querySelector('[data-save]').onclick = async () => {
      const g = (n) => m.node.querySelector(`[name=${n}]`).value;
      try { await api('/treasuries/transfer', { method: 'POST', body: { from_id: g('from_id'), to_id: g('to_id'), amount: Number(g('amount')), date: g('date') } }); toast(t('saved')); m.close(); load(); }
      catch (e) { toast(e.message, 'error'); }
    };
  }

  const addBtn = container.querySelector('[data-add]'); if (addBtn) addBtn.onclick = () => openForm(null);
  const trBtn = container.querySelector('[data-transfer]'); if (trBtn) trBtn.onclick = transfer;
  load();
}
