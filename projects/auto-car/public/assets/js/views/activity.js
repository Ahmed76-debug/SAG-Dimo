/* ============================================================
   Auto Car — سجل النشاط (تتبع كل العمليات)
   ============================================================ */
import { t, esc, icon, api, fmtDateTime, debounce } from '../core.js';
import { renderTable, emptyState, toast } from '../ui.js';
import { exportCustom } from '../core.js';

const ACTION_TONE = { create: 'badge-success', update: 'badge-info', delete: 'badge-danger', restore: 'badge-warn', login: 'badge-brand', backup: 'badge-purple', import: 'badge-info', password: 'badge-warn' };

export async function render(container) {
  let page = 1, q = '', action = '';
  container.innerHTML = `
    <div class="toolbar mb-2">
      <div class="search-box grow" style="max-width:340px">${icon('search')}<input class="input" data-q placeholder="${t('search')}"></div>
      <select class="select" data-action style="max-width:180px">
        <option value="">${t('action')}</option>
        ${['create', 'update', 'delete', 'restore', 'login', 'backup', 'import', 'password'].map((a) => `<option value="${a}">${a}</option>`).join('')}
      </select>
      <div class="grow"></div>
      <button class="btn btn-ghost" data-export>${icon('sheet', 'sm')} ${t('export_excel')}</button>
    </div>
    <div data-table></div>`;

  async function load() {
    const tbl = container.querySelector('[data-table]');
    tbl.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const p = new URLSearchParams({ page, limit: 50 });
    if (q) p.set('q', q); if (action) p.set('action', action);
    const d = await api('/activity?' + p);
    const cols = [
      { key: 'created_at', label: t('date'), render: (r) => `<span class="small muted">${esc(fmtDateTime(r.created_at))}</span>` },
      { key: 'user_name', label: t('user'), render: (r) => `<b>${esc(r.user_name || '—')}</b>` },
      { key: 'action', label: t('action'), render: (r) => `<span class="badge ${ACTION_TONE[r.action] || 'badge'}">${esc(r.action)}</span>` },
      { key: 'entity', label: t('entity'), render: (r) => esc(r.entity || '—') },
      { key: 'details', label: t('details'), render: (r) => `<span class="small muted mono" style="max-width:340px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom">${esc(r.details || '')}</span>` },
      { key: 'ip', label: 'IP', render: (r) => `<span class="small muted mono">${esc(r.ip || '')}</span>` },
    ];
    const pages = Math.max(1, Math.ceil((d.total || 0) / 50));
    tbl.innerHTML = renderTable({ columns: cols, rows: d.items, empty: t('no_data') }) +
      `<div class="pagination"><button class="btn btn-ghost btn-sm" data-prev ${page <= 1 ? 'disabled' : ''}>${icon('chevron-right', 'sm')} ${t('prev')}</button><span class="small muted">${t('page')} ${page} ${t('of')} ${pages}</span><button class="btn btn-ghost btn-sm" data-next ${page >= pages ? 'disabled' : ''}>${t('next')} ${icon('chevron-left', 'sm')}</button></div>`;
    tbl.querySelector('[data-prev]').onclick = () => { page--; load(); };
    tbl.querySelector('[data-next]').onclick = () => { page++; load(); };
    container._rows = d.items;
  }
  container.querySelector('[data-q]').oninput = debounce((e) => { q = e.target.value.trim(); page = 1; load(); });
  container.querySelector('[data-action]').onchange = (e) => { action = e.target.value; page = 1; load(); };
  container.querySelector('[data-export]').onclick = () => exportCustom(t('activity'), [
    { key: 'created_at', label: t('date') }, { key: 'user_name', label: t('user') }, { key: 'action', label: t('action') },
    { key: 'entity', label: t('entity') }, { key: 'details', label: t('details') }, { key: 'ip', label: 'IP' },
  ], container._rows || [], 'activity.xlsx');
  load();
}
