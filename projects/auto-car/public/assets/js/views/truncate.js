/* ============================================================
   Auto Car — تفريغ الجداول (حذف بيانات محددة)
   ============================================================ */
import { t, esc, icon, api, fmtNum, can } from '../core.js';
import { toast, confirmDialog, emptyState } from '../ui.js';

export async function render(container) {
  container.innerHTML = `
    <div class="alert warn mb-2">${icon('alert', 'sm')} ${t('truncate_confirm')}</div>
    <div class="toolbar mb-2">
      <button class="btn btn-ghost btn-sm" data-all>${t('select_all')}</button>
      <button class="btn btn-ghost btn-sm" data-clear>${t('clear')}</button>
      <div class="grow"></div>
      <button class="btn btn-danger" data-run>${icon('trash', 'sm')} ${t('empty_tables')}</button>
    </div>
    <div data-list class="tile-grid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))"></div>`;

  async function load() {
    const d = await api('/truncate/tables');
    const list = container.querySelector('[data-list]');
    if (!d.items.length) { list.innerHTML = emptyState(t('no_data'), 'database'); return; }
    list.innerHTML = d.items.map((x) => `
      <label class="card card-pad check table-pick">
        <input type="checkbox" data-t="${esc(x.table)}">
        <div style="flex:1"><b>${esc(x.label)}</b><div class="small muted mono">${esc(x.table)}</div></div>
        <span class="badge ${x.count ? 'badge-warn' : ''}">${fmtNum(x.count, 0)}</span>
      </label>`).join('');
  }
  container.querySelector('[data-all]').onclick = () => container.querySelectorAll('[data-t]').forEach((c) => c.checked = true);
  container.querySelector('[data-clear]').onclick = () => container.querySelectorAll('[data-t]').forEach((c) => c.checked = false);
  container.querySelector('[data-run]').onclick = async () => {
    const tables = Array.from(container.querySelectorAll('[data-t]')).filter((c) => c.checked).map((c) => c.dataset.t);
    if (!tables.length) return toast(t('select_tables'), 'warn');
    if (!(await confirmDialog(t('truncate_confirm')))) return;
    try { const r = await api('/truncate', { method: 'POST', body: { tables } }); toast(r.message); load(); }
    catch (e) { toast(e.message, 'error'); }
  };
  load();
}
