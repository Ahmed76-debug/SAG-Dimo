/* ============================================================
   Auto Car — دليل الحسابات (شجرة + أرصدة + CRUD)
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, pick, can, todayStr, monthStart, exportCustom, printHtml, state } from '../core.js';
import { modal, toast, confirmDialog, emptyState, statusBadge } from '../ui.js';

const TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'];

export async function render(container) {
  let all = [];
  let from = '', to = todayStr();
  container.innerHTML = `
    <div class="toolbar mb-2">
      <input class="input" type="date" data-from style="max-width:160px">
      <span class="muted">${t('to')}</span>
      <input class="input" type="date" data-to style="max-width:160px" value="${to}">
      <button class="btn btn-soft btn-sm" data-reload>${icon('refresh', 'sm')} ${t('refresh')}</button>
      <div class="grow"></div>
      <button class="btn btn-ghost" data-print>${icon('print', 'sm')} ${t('print')}</button>
      <button class="btn btn-ghost" data-export>${icon('sheet', 'sm')} ${t('export_excel')}</button>
      ${can('accounting.manage') ? `<button class="btn btn-primary" data-add>${icon('plus', 'sm')} ${t('add')}</button>` : ''}
    </div>
    <div data-table></div>`;

  async function load() {
    const tbl = container.querySelector('[data-table]');
    tbl.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const p = new URLSearchParams();
    if (from) p.set('from', from); if (to) p.set('to', to);
    const [tree, flat] = await Promise.all([api('/accounts/tree?' + p), api('/accounts')]);
    all = flat.items;
    const byId = new Map(all.map((a) => [a.id, a]));

    function rowsHtml(nodes, depth) {
      return nodes.map((n) => {
        const hasKids = n.children && n.children.length;
        const typeKey = n.type;
        const row = `<tr data-id="${n.id}">
          <td><div class="tree-cell" style="padding-inline-start:${depth * 20}px">
            ${hasKids ? `<button class="tree-toggle" data-toggle="${n.id}">${icon('chevron-down', 'sm')}</button>` : `<span class="tree-dot"></span>`}
            <span class="mono small">${esc(n.code)}</span>
            <b>${esc(state.lang === 'en' && n.name_en ? n.name_en : n.name)}</b>
            ${n.is_group ? `<span class="badge">${t('is_group')}</span>` : ''}
          </div></td>
          <td>${statusBadge(typeKey)}</td>
          <td class="num">${n.debit ? money(n.debit, false) : '—'}</td>
          <td class="num">${n.credit ? money(n.credit, false) : '—'}</td>
          <td class="num"><b>${money(n.signed_balance)}</b></td>
          <td class="num"><div class="row-actions">${can('accounting.manage') ? `<button class="btn btn-ghost btn-icon btn-sm" data-edit="${n.id}">${icon('edit', 'sm')}</button><button class="btn btn-ghost btn-icon btn-sm" data-del="${n.id}">${icon('trash', 'sm')}</button>` : ''}</div></td>
        </tr>`;
        return row + (hasKids ? `<tbody data-kids="${n.id}">${rowsHtml(n.children, depth + 1)}</tbody>` : '');
      }).join('');
    }
    tbl.innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr><th>${t('account')}</th><th>${t('account_type')}</th><th class="num">${t('debit')}</th><th class="num">${t('credit_col')}</th><th class="num">${t('balance')}</th><th class="num">${t('actions')}</th></tr></thead>
      <tbody>${rowsHtml(tree.items, 0)}</tbody></table></div>`;
    tbl.querySelectorAll('[data-toggle]').forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      const kid = tbl.querySelector(`tbody[data-kids="${b.dataset.toggle}"]`);
      if (kid) { const hid = kid.style.display === 'none'; kid.style.display = hid ? '' : 'none'; b.classList.toggle('collapsed', !hid); }
    });
    tbl.querySelectorAll('[data-edit]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); openForm(all.find((a) => a.id == b.dataset.edit)); });
    tbl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      if (await confirmDialog(t('confirm_delete'))) { try { await api(`/accounts/${b.dataset.del}`, { method: 'DELETE' }); toast(t('msg_deleted')); load(); } catch (err) { toast(err.message, 'error'); } }
    });
    container._tree = tree.items;
  }

  function openForm(a) {
    const isEdit = !!a; const d = a || { type: 'asset', nature: 'debit', active: 1 };
    const parents = all.filter((x) => x.is_group && x.id !== (a && a.id));
    const m = modal({
      title: isEdit ? `${t('edit')} — ${esc(d.name)}` : `${t('add')} ${t('account')}`,
      body: `<div class="form-grid">
        <div class="field"><label>${t('account_code')} <span class="req">*</span></label><input class="input" name="code" value="${esc(d.code || '')}" ${isEdit ? 'disabled' : ''}></div>
        <div class="field"><label>${t('account_name')} <span class="req">*</span></label><input class="input" name="name" value="${esc(d.name || '')}"></div>
        <div class="field"><label>${t('name_en')}</label><input class="input" name="name_en" value="${esc(d.name_en || '')}"></div>
        <div class="field"><label>${t('account_type')}</label><select class="select" name="type" ${isEdit ? 'disabled' : ''}>${TYPES.map((x) => `<option value="${x}" ${d.type === x ? 'selected' : ''}>${t(x)}</option>`).join('')}</select></div>
        <div class="field"><label>${t('parent_account')}</label><select class="select" name="parent_id"><option value="">— ${t('select')} —</option>${parents.map((p) => `<option value="${p.id}" ${String(p.id) === String(d.parent_id) ? 'selected' : ''}>${esc(p.code)} — ${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>${t('nature')}</label><select class="select" name="nature"><option value="debit" ${d.nature === 'debit' ? 'selected' : ''}>${t('debit')}</option><option value="credit" ${d.nature === 'credit' ? 'selected' : ''}>${t('credit_col')}</option></select></div>
        <div class="field full row" style="gap:18px">
          <label class="check"><input type="checkbox" name="is_group" ${d.is_group ? 'checked' : ''}> ${t('is_group')}</label>
          <label class="check"><input type="checkbox" name="is_cash" ${d.is_cash ? 'checked' : ''}> ${t('treasury')}</label>
          <label class="check"><input type="checkbox" name="is_bank" ${d.is_bank ? 'checked' : ''}> ${t('bank_name')}</label>
          <label class="check"><input type="checkbox" name="active" ${d.active === 0 ? '' : 'checked'}> ${t('active')}</label>
        </div>
        <div class="field full"><label>${t('notes')}</label><input class="input" name="notes" value="${esc(d.notes || '')}"></div>
      </div>`,
      footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-save>${icon('save', 'sm')} ${t('save')}</button>`,
    });
    m.node.querySelector('[data-x]').onclick = m.close;
    m.node.querySelector('[data-save]').onclick = async () => {
      const g = (n) => m.node.querySelector(`[name=${n}]`).value;
      const ck = (n) => m.node.querySelector(`[name=${n}]`).checked ? 1 : 0;
      const payload = { name: g('name'), name_en: g('name_en'), parent_id: g('parent_id') || null, nature: g('nature'), notes: g('notes'), is_group: ck('is_group'), is_cash: ck('is_cash'), is_bank: ck('is_bank'), active: ck('active') };
      if (!isEdit) { payload.code = g('code'); payload.type = g('type'); }
      if (!payload.name || (!isEdit && !payload.code)) return toast(t('required'), 'warn');
      try { await api(isEdit ? `/accounts/${a.id}` : '/accounts', { method: isEdit ? 'PUT' : 'POST', body: payload }); toast(isEdit ? t('msg_updated') : t('msg_added')); m.close(); load(); }
      catch (e) { toast(e.message, 'error'); }
    };
  }

  container.querySelector('[data-from]').onchange = (e) => { from = e.target.value; load(); };
  container.querySelector('[data-to]').onchange = (e) => { to = e.target.value; load(); };
  container.querySelector('[data-reload]').onclick = load;
  const addBtn = container.querySelector('[data-add]'); if (addBtn) addBtn.onclick = () => openForm(null);
  container.querySelector('[data-export]').onclick = () => {
    const flat = [];
    const walk = (nodes) => nodes.forEach((n) => { flat.push({ code: n.code, name: n.name, name_en: n.name_en, type: t(n.type), debit: n.debit, credit: n.credit, balance: n.signed_balance }); if (n.children) walk(n.children); });
    walk(container._tree || []);
    exportCustom(t('chart_of_accounts'), [{ key: 'code', label: t('account_code') }, { key: 'name', label: t('account_name') }, { key: 'name_en', label: t('name_en') }, { key: 'type', label: t('account_type') }, { key: 'debit', label: t('debit') }, { key: 'credit', label: t('credit_col') }, { key: 'balance', label: t('balance') }], flat, 'chart-of-accounts.xlsx');
  };
  container.querySelector('[data-print]').onclick = () => printHtml(`<h2>${esc(t('chart_of_accounts'))} — ${esc(state.settings.company_name || '')}</h2>${container.querySelector('[data-table]').innerHTML}`, t('chart_of_accounts'));
  load();
}
