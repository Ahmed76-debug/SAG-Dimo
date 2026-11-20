/* ============================================================
   Auto Car — العملاء والموردون + كشوف الحساب
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, fmtDate, state } from '../core.js';
import { crudView, modal, toast, statusBadge } from '../ui.js';

function statementModal(kind, id) {
  const isCust = kind === 'customers';
  const m = modal({
    title: `${t('statement_of')} ${isCust ? t('customers') : t('suppliers')}`,
    size: 'modal-lg',
    body: `<div class="toolbar mb-2">
        <input type="date" class="input" id="st-from" style="max-width:170px">
        <span class="muted">${t('to')}</span>
        <input type="date" class="input" id="st-to" style="max-width:170px" value="${new Date().toISOString().slice(0, 10)}">
        <div class="grow"></div>
        <button class="btn btn-soft" data-reload>${icon('refresh', 'sm')} ${t('recompute')}</button>
        <button class="btn btn-ghost" data-print>${icon('print', 'sm')} ${t('print')}</button>
      </div>
      <div data-stmt-body><div class="empty"><span class="spinner"></span></div></div>`,
  });
  const bodyEl = m.node.querySelector('[data-stmt-body]');

  async function load() {
    bodyEl.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const from = m.node.querySelector('#st-from').value, to = m.node.querySelector('#st-to').value;
    const r = await api(`/${kind}/${id}/statement?from=${from || ''}&to=${to || ''}`);
    m.node.querySelector('.modal-head h3').textContent = `${t('statement_of')} — ${r.party.name}`;
    const rows = r.rows || [];
    bodyEl.innerHTML = `
      <div class="grid cols-3 mb-2">
        ${statBox(t('opening_balance'), r.opening)}
        ${statBox(t('balance'), r.balance, true)}
        ${statBox(t('closing'), r.closing, true)}
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>${t('date')}</th><th>${t('reference')}</th><th>${t('description')}</th><th class="num">${t('debit')}</th><th class="num">${t('credit_col')}</th><th class="num">${t('running_balance')}</th></tr></thead>
        <tbody>
          <tr><td colspan="5" class="muted">${t('opening_balance')}</td><td class="num strong">${money(r.opening)}</td></tr>
          ${rows.map((l) => `<tr><td>${esc(fmtDate(l.date))}</td><td class="mono small">${esc(l.entry_no || l.reference || '—')}</td><td>${esc(l.description || '')}</td><td class="num">${l.debit ? money(l.debit, false) : '—'}</td><td class="num">${l.credit ? money(l.credit, false) : '—'}</td><td class="num strong">${money(l.running, false)}</td></tr>`).join('')}
          ${!rows.length ? `<tr><td colspan="6" class="muted" style="text-align:center;padding:20px">${t('no_data')}</td></tr>` : ''}
        </tbody>
      </table></div>`;
  }
  m.node.querySelector('[data-reload]').onclick = async () => { await api(`/${kind}/${id}/recompute`, { method: 'POST' }); toast(t('saved')); load(); };
  m.node.querySelector('[data-print]').onclick = () => {
    const html = `<h2>${esc(t('statement_of'))} — ${esc(state.settings.company_name || '')}</h2>${bodyEl.innerHTML}`;
    import('../core.js').then((c) => c.printHtml(html, 'Statement'));
  };
  m.node.querySelector('#st-from').onchange = load;
  m.node.querySelector('#st-to').onchange = load;
  load();
}
function statBox(label, value, strong) {
  return `<div class="mini-stat"><div class="ms-label">${esc(label)}</div><div class="ms-val ${strong ? 'strong' : ''}">${money(value)}</div></div>`;
}

export function render(container, item) {
  const isCust = item.key === 'customers';
  const kind = isCust ? 'customers' : 'suppliers';
  const fields = isCust
    ? [
        { key: 'name', label: t('name'), required: true }, { key: 'name_en', label: t('name_en') },
        { key: 'phone', label: t('phone') }, { key: 'phone2', label: t('phone') + ' 2' },
        { key: 'email', label: t('email') }, { key: 'national_id', label: t('national_id') },
        { key: 'job', label: t('job') },
        { key: 'kind', label: t('kind'), type: 'select', options: [{ value: 'individual', label: t('individual') }, { value: 'company', label: t('company') }, { value: 'dealer', label: t('dealer') }], default: 'individual' },
        { key: 'opening_balance', label: t('opening_balance'), type: 'number', default: 0 },
        { key: 'credit_limit', label: t('credit_limit'), type: 'number', default: 0 },
        { key: 'address', label: t('address'), full: true }, { key: 'notes', label: t('notes'), type: 'textarea', full: true },
        { key: 'active', label: t('active'), type: 'checkbox', default: 1 },
      ]
    : [
        { key: 'name', label: t('name'), required: true }, { key: 'name_en', label: t('name_en') },
        { key: 'phone', label: t('phone') }, { key: 'email', label: t('email') },
        { key: 'national_id', label: t('national_id') },
        { key: 'kind', label: t('kind'), type: 'select', options: [{ value: 'individual', label: t('individual') }, { value: 'company', label: t('company') }, { value: 'dealer', label: t('dealer') }], default: 'individual' },
        { key: 'opening_balance', label: t('opening_balance'), type: 'number', default: 0 },
        { key: 'address', label: t('address'), full: true }, { key: 'notes', label: t('notes'), type: 'textarea', full: true },
        { key: 'active', label: t('active'), type: 'checkbox', default: 1 },
      ];

  crudView({
    title: isCust ? t('customers') : t('suppliers'),
    endpoint: `/${kind}`, perm: 'partners.manage', titleField: 'name',
    exportEntity: kind, modalSize: 'modal-lg', actionsWidth: '190px',
    columns: [
      { key: 'name', label: t('name'), render: (r) => `<div class="row" style="gap:10px"><span class="avatar sm">${esc((r.name || '?')[0])}</span><div><b>${esc(r.name)}</b>${r.phone ? `<div class="small muted">${esc(r.phone)}</div>` : ''}</div></div>` },
      { key: 'kind', label: t('kind'), render: (r) => esc(t(r.kind || 'individual')) },
      { key: 'opening_balance', label: t('opening_balance'), align: 'end', render: (r) => money(r.opening_balance) },
      { key: 'balance', label: t('balance'), align: 'end', render: (r) => `<b class="${Number(r.balance) > 0 ? 'text-danger' : ''}">${money(r.balance)}</b>` },
      { key: 'active', label: t('status'), render: (r) => r.active ? `<span class="badge badge-success">${t('active')}</span>` : `<span class="badge">${t('inactive')}</span>` },
    ],
    fields,
    extraRowActions: (r) => `<button class="btn btn-ghost btn-icon btn-sm" data-stmt="${r.id}" title="${t('statement')}">${icon('ledger', 'sm')}</button>`,
    bindRowActions: (tbl) => {
      tbl.querySelectorAll('[data-stmt]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); statementModal(kind, b.dataset.stmt); });
    },
  })(container);
}
