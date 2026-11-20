/* ============================================================
   Auto Car — سلة المحذوفات (استرجاع / حذف نهائي)
   ============================================================ */
import { t, esc, icon, api, fmtDateTime, can } from '../core.js';
import { toast, confirmDialog, emptyState } from '../ui.js';

export async function render(container) {
  container.innerHTML = `
    <div class="alert info mb-2">${icon('info', 'sm')} ${t('trash_hint')}</div>
    <div data-body></div>`;

  async function load() {
    const body = container.querySelector('[data-body]');
    body.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const d = await api('/trash');
    const groups = (d.groups || []).filter((g) => g.count > 0);
    if (!groups.length) { body.innerHTML = emptyState(t('no_data'), 'trash'); return; }
    body.innerHTML = groups.map((g) => `
      <div class="card mb-2">
        <div class="card-head"><h3>${icon('trash', 'sm')} ${esc(g.label)} <span class="badge badge-danger">${g.count}</span></h3></div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>#</th><th>${t('name')}</th><th>${t('deleted_at') || t('date')}</th><th class="num">${t('actions')}</th></tr></thead>
          <tbody>${g.rows.map((r) => `<tr>
            <td class="mono small">${r.id}</td>
            <td><b>${esc(r.name || r.name_en || r.code || r.invoice_no || r.entry_no || r.voucher_no || r.username || r.title || ('#' + r.id))}</b></td>
            <td class="small muted">${esc(fmtDateTime(r.deleted_at))}</td>
            <td class="num"><div class="row-actions">
              <button class="btn btn-soft btn-sm" data-restore="${g.table}:${r.id}">${icon('restore', 'sm')} ${t('restore')}</button>
              <button class="btn btn-ghost btn-icon btn-sm" data-purge="${g.table}:${r.id}" title="${t('purge')}">${icon('trash', 'sm')}</button>
            </div></td></tr>`).join('')}</tbody>
        </table></div>
      </div>`).join('');
    body.querySelectorAll('[data-restore]').forEach((b) => b.onclick = async () => {
      const [tbl, id] = b.dataset.restore.split(':');
      try { await api(`/trash/${tbl}/${id}/restore`, { method: 'POST' }); toast(t('msg_restored')); load(); } catch (e) { toast(e.message, 'error'); }
    });
    body.querySelectorAll('[data-purge]').forEach((b) => b.onclick = async () => {
      const [tbl, id] = b.dataset.purge.split(':');
      if (!(await confirmDialog(t('purge_confirm')))) return;
      try { await api(`/trash/${tbl}/${id}`, { method: 'DELETE' }); toast(t('deleted')); load(); } catch (e) { toast(e.message, 'error'); }
    });
  }
  load();
}
