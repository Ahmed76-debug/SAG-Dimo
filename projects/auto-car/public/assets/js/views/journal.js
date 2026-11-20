/* ============================================================
   Auto Car — قيود اليومية (عرض + إنشاء + إلغاء)
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, fmtDate, state, pick, todayStr, can, exportCustom, printHtml } from '../core.js';
import { modal, toast, confirmDialog, renderTable, statusBadge, emptyState } from '../ui.js';

const SOURCES = ['manual', 'opening', 'adjustment', 'closing'];

export async function render(container) {
  let page = 1, filters = {};
  container.innerHTML = `
    <div class="toolbar mb-2">
      <div class="search-box grow" style="max-width:260px">${icon('search')}<input class="input" data-q placeholder="${t('search')}"></div>
      <select class="select" data-f="source" style="max-width:150px"><option value="">${t('source')}</option>${SOURCES.map((s) => `<option value="${s}">${t(s)}</option>`).join('')}</select>
      <input class="input" type="date" data-f="from" style="max-width:155px">
      <input class="input" type="date" data-f="to" style="max-width:155px">
      <div class="grow"></div>
      <button class="btn btn-ghost" data-export>${icon('sheet', 'sm')} ${t('export_excel')}</button>
      ${can('accounting.manage') ? `<button class="btn btn-primary" data-add>${icon('plus', 'sm')} ${t('add')} ${t('journal')}</button>` : ''}
    </div>
    <div data-table></div>`;

  async function load() {
    const tbl = container.querySelector('[data-table]');
    tbl.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const p = new URLSearchParams({ page, limit: 50 });
    const q = container.querySelector('[data-q]').value.trim(); if (q) p.set('q', q);
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    const d = await api('/journal?' + p);
    const cols = [
      { key: 'entry_no', label: t('entry_no'), render: (r) => `<b class="mono">${esc(r.entry_no)}</b>` },
      { key: 'date', label: t('date'), render: (r) => esc(fmtDate(r.date)) },
      { key: 'description', label: t('description'), render: (r) => esc(r.description || '—') },
      { key: 'reference', label: t('reference'), render: (r) => `<span class="small muted mono">${esc(r.reference || '')}</span>` },
      { key: 'source', label: t('source'), render: (r) => statusBadge(r.source) },
      { key: 'total_debit', label: t('debit'), align: 'end', render: (r) => money(r.total_debit) },
      { key: 'total_credit', label: t('credit_col'), align: 'end', render: (r) => money(r.total_credit) },
      { key: 'status', label: t('status'), render: (r) => statusBadge(r.status) },
      { key: 'user_name', label: t('user'), render: (r) => `<span class="small muted">${esc(r.user_name || '—')}</span>` },
      { key: 'actions', label: t('actions'), align: 'end', width: '150px', render: (r) => `<div class="row-actions">
        <button class="btn btn-ghost btn-icon btn-sm" data-view="${r.id}" title="${t('view')}">${icon('eye', 'sm')}</button>
        ${can('accounting.manage') && r.status === 'posted' ? `<button class="btn btn-ghost btn-icon btn-sm" data-void="${r.id}" title="${t('void')}">${icon('x', 'sm')}</button>` : ''}
        ${can('accounting.manage') && SOURCES.includes(r.source) ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}" title="${t('delete')}">${icon('trash', 'sm')}</button>` : ''}</div>` },
    ];
    const pages = Math.max(1, Math.ceil((d.total || 0) / 50));
    tbl.innerHTML = renderTable({ columns: cols, rows: d.items, empty: t('no_data') }) +
      `<div class="pagination"><button class="btn btn-ghost btn-sm" data-prev ${page <= 1 ? 'disabled' : ''}>${icon('chevron-right', 'sm')} ${t('prev')}</button><span class="small muted">${t('page')} ${page} ${t('of')} ${pages} — ${fmtNum(d.total, 0)} ${t('rows')}</span><button class="btn btn-ghost btn-sm" data-next ${page >= pages ? 'disabled' : ''}>${t('next')} ${icon('chevron-left', 'sm')}</button></div>`;
    tbl.querySelector('[data-prev]').onclick = () => { page--; load(); };
    tbl.querySelector('[data-next]').onclick = () => { page++; load(); };
    tbl.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => detail(b.dataset.view));
    tbl.querySelectorAll('[data-void]').forEach((b) => b.onclick = async () => { if (await confirmDialog(t('void') + '؟')) { try { await api(`/journal/${b.dataset.void}/void`, { method: 'POST' }); toast(t('saved')); load(); } catch (e) { toast(e.message, 'error'); } } });
    tbl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { if (await confirmDialog(t('confirm_delete'))) { try { await api(`/journal/${b.dataset.del}`, { method: 'DELETE' }); toast(t('msg_deleted')); load(); } catch (e) { toast(e.message, 'error'); } } });
    container._rows = d.items;
  }

  async function detail(id) {
    const d = await api(`/journal/${id}`); const e = d.item;
    const m = modal({
      title: `${t('entry_no')} ${esc(e.entry_no)}`, size: 'modal-lg',
      body: `<div class="detail-list two mb-2">
        <div class="di"><span class="k">${t('date')}</span><span class="v">${esc(e.date)}</span></div>
        <div class="di"><span class="k">${t('source')}</span><span class="v">${t(e.source)}</span></div>
        <div class="di"><span class="k">${t('reference')}</span><span class="v">${esc(e.reference || '—')}</span></div>
        <div class="di"><span class="k">${t('status')}</span><span class="v">${t(e.status)}</span></div>
        <div class="di" style="grid-column:1/-1"><span class="k">${t('description')}</span><span class="v">${esc(e.description || '—')}</span></div>
      </div>
      <div class="table-wrap"><table class="data"><thead><tr><th>${t('account')}</th><th>${t('description')}</th><th class="num">${t('debit')}</th><th class="num">${t('credit_col')}</th></tr></thead>
      <tbody>${e.lines.map((l) => `<tr><td><span class="mono small">${esc(l.account_code)}</span> ${esc(l.account_name)}</td><td class="muted">${esc(l.description || '')}</td><td class="num">${l.debit ? money(l.debit, false) : '—'}</td><td class="num">${l.credit ? money(l.credit, false) : '—'}</td></tr>`).join('')}
      <tr class="strong"><td colspan="2">${t('total')}</td><td class="num">${money(e.total_debit, false)}</td><td class="num">${money(e.total_credit, false)}</td></tr></tbody></table></div>`,
      footer: `<button class="btn btn-ghost" data-print>${icon('print', 'sm')} ${t('print')}</button><button class="btn btn-ghost" data-x>${t('close')}</button>`,
    });
    m.node.querySelector('[data-x]').onclick = m.close;
    m.node.querySelector('[data-print]').onclick = () => printHtml(m.body.innerHTML, e.entry_no);
  }

  function newEntry() {
    const accounts = state.meta.accounts || [];
    const m = modal({
      title: `${t('add')} ${t('journal')}`, size: 'modal-lg',
      body: `<div class="form-grid mb-2">
        <div class="field"><label>${t('date')}</label><input class="input" type="date" name="date" value="${todayStr()}"></div>
        <div class="field"><label>${t('source')}</label><select class="select" name="source">${SOURCES.map((s) => `<option value="${s}">${t(s)}</option>`).join('')}</select></div>
        <div class="field"><label>${t('reference')}</label><input class="input" name="reference"></div>
        <div class="field full"><label>${t('description')}</label><input class="input" name="description"></div>
      </div>
      <div class="row between mb-1"><b>${t('entry_lines')}</b><button class="btn btn-soft btn-sm" data-add-line>${icon('plus', 'sm')} ${t('add_line')}</button></div>
      <div class="table-wrap"><table class="data"><thead><tr><th style="min-width:220px">${t('account')}</th><th>${t('description')}</th><th class="num">${t('debit')}</th><th class="num">${t('credit_col')}</th><th></th></tr></thead><tbody data-lines></tbody></table></div>
      <div class="row between mt-2"><span class="muted">${t('total')}</span><span><b data-d>0</b> / <b data-c>0</b> <span class="badge" data-bal></span></span></div>`,
      footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-save>${icon('save', 'sm')} ${t('post')}</button>`,
    });
    const body = m.node.querySelector('[data-lines]');
    const accOpts = () => `<option value="">— ${t('select')} —</option>${accounts.map((a) => `<option value="${a.id}">${esc(a.code)} — ${esc(state.lang === 'en' && a.name_en ? a.name_en : a.name)}</option>`).join('')}`;
    function addLine() {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><select class="select" data-acc>${accOpts()}</select></td>
        <td><input class="input" data-desc></td>
        <td class="num"><input class="input" type="number" step="any" data-debit style="max-width:120px;text-align:end"></td>
        <td class="num"><input class="input" type="number" step="any" data-credit style="max-width:120px;text-align:end"></td>
        <td class="num"><button class="btn btn-ghost btn-icon btn-sm" data-rm>${icon('x', 'sm')}</button></td>`;
      tr.querySelector('[data-rm]').onclick = () => { tr.remove(); calc(); };
      tr.querySelectorAll('input').forEach((i) => i.oninput = calc);
      body.appendChild(tr); calc();
    }
    function calc() {
      let d = 0, c = 0;
      body.querySelectorAll('tr').forEach((tr) => { d += Number(tr.querySelector('[data-debit]').value) || 0; c += Number(tr.querySelector('[data-credit]').value) || 0; });
      m.node.querySelector('[data-d]').textContent = money(d, false);
      m.node.querySelector('[data-c]').textContent = money(c, false);
      const b = m.node.querySelector('[data-bal]');
      const ok = Math.abs(d - c) < 0.01 && d > 0;
      b.className = 'badge ' + (ok ? 'badge-success' : 'badge-danger'); b.textContent = ok ? t('balanced') : t('unbalanced');
    }
    m.node.querySelector('[data-add-line]').onclick = addLine;
    addLine(); addLine();
    m.node.querySelector('[data-x]').onclick = m.close;
    m.node.querySelector('[data-save]').onclick = async () => {
      const g = (n) => m.node.querySelector(`[name=${n}]`).value;
      const lines = [];
      body.querySelectorAll('tr').forEach((tr) => {
        const account_id = tr.querySelector('[data-acc]').value;
        const debit = Number(tr.querySelector('[data-debit]').value) || 0;
        const credit = Number(tr.querySelector('[data-credit]').value) || 0;
        if (account_id && (debit || credit)) lines.push({ account_id, debit, credit, description: tr.querySelector('[data-desc]').value });
      });
      if (lines.length < 2) return toast(t('entry_lines') + ' 2+', 'warn');
      try { await api('/journal', { method: 'POST', body: { date: g('date'), source: g('source'), reference: g('reference'), description: g('description'), lines } }); toast(t('saved')); m.close(); load(); }
      catch (e) { toast(e.message, 'error'); }
    };
  }

  container.querySelectorAll('[data-f]').forEach((s) => s.onchange = () => { filters[s.dataset.f] = s.value; page = 1; load(); });
  container.querySelector('[data-q]').oninput = () => { clearTimeout(container._h); container._h = setTimeout(() => { page = 1; load(); }, 300); };
  const addBtn = container.querySelector('[data-add]'); if (addBtn) addBtn.onclick = newEntry;
  container.querySelector('[data-export]').onclick = () => exportCustom(t('journal'), [
    { key: 'entry_no', label: t('entry_no') }, { key: 'date', label: t('date') }, { key: 'description', label: t('description') },
    { key: 'source', label: t('source') }, { key: 'total_debit', label: t('debit') }, { key: 'total_credit', label: t('credit_col') }, { key: 'status', label: t('status') },
  ], container._rows || [], 'journal.xlsx');
  load();
}
