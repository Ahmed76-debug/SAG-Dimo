/* ============================================================
   Auto Car — التنبيهات والتذكيرات
   ============================================================ */
import { t, esc, icon, api, fmtDate, state } from '../core.js';
import { toast, confirmDialog, emptyState, statusBadge } from '../ui.js';

const PRIO = { high: 'badge-danger', normal: 'badge-info', low: 'badge' };
const KIND_ICON = { alert: 'alert', reminder: 'clock', system: 'bell' };

export async function render(container) {
  let status = '';
  container.innerHTML = `
    <div class="toolbar mb-2">
      <select class="select" data-status style="max-width:180px">
        <option value="">${t('all')}</option>
        <option value="unread">${t('unread')}</option>
        <option value="read">${t('read') || t('unread')}</option>
        <option value="done">${t('mark_done')}</option>
      </select>
      <div class="grow"></div>
      <button class="btn btn-soft" data-gen>${icon('refresh', 'sm')} ${t('generate_alerts')}</button>
      <button class="btn btn-ghost" data-all>${icon('check', 'sm')} ${t('read_all')}</button>
    </div>
    <div data-list></div>`;

  async function load() {
    const list = container.querySelector('[data-list]');
    list.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const d = await api('/notifications' + (status ? `?status=${status}` : ''));
    if (!d.items.length) { list.innerHTML = emptyState(t('no_notifications'), 'bell'); return; }
    list.innerHTML = `<div class="notif-list stagger">${d.items.map((n) => `
      <div class="notif-item ${n.status === 'unread' ? 'unread' : ''}" data-id="${n.id}">
        <div class="notif-ic tone-${n.priority === 'high' ? 'danger' : 'brand'}">${icon(KIND_ICON[n.kind] || 'bell', 'lg')}</div>
        <div style="min-width:0;flex:1">
          <div class="row between"><b>${esc(n.title)}</b><span class="badge ${PRIO[n.priority] || 'badge'}">${esc(t(n.priority, n.priority))}</span></div>
          <div class="muted small mt-1">${esc(n.body || '')}</div>
          <div class="row small muted mt-1" style="gap:12px">
            ${n.due_date ? `<span>${icon('calendar', 'sm')} ${esc(fmtDate(n.due_date))}</span>` : ''}
            <span>${icon('clock', 'sm')} ${esc(fmtDate(n.created_at))}</span>
          </div>
        </div>
        <div class="row-actions">
          ${n.status === 'unread' ? `<button class="btn btn-ghost btn-icon btn-sm" data-read="${n.id}" title="${t('mark_read')}">${icon('check', 'sm')}</button>` : ''}
          <button class="btn btn-ghost btn-icon btn-sm" data-done="${n.id}" title="${t('mark_done')}">${icon('check-circle', 'sm')}</button>
          <button class="btn btn-ghost btn-icon btn-sm" data-del="${n.id}" title="${t('delete')}">${icon('trash', 'sm')}</button>
        </div>
      </div>`).join('')}</div>`;
    const bind = (attr, fn) => list.querySelectorAll(`[data-${attr}]`).forEach((b) => b.onclick = fn);
    bind('read', async (e) => { await api(`/notifications/${e.currentTarget.dataset.read}/read`, { method: 'POST' }); load(); });
    bind('done', async (e) => { await api(`/notifications/${e.currentTarget.dataset.done}/done`, { method: 'POST' }); load(); });
    bind('del', async (e) => { if (await confirmDialog(t('confirm_delete'))) { await api(`/notifications/${e.currentTarget.dataset.del}`, { method: 'DELETE' }); toast(t('msg_deleted')); load(); } });
  }
  container.querySelector('[data-status]').onchange = (e) => { status = e.target.value; load(); };
  container.querySelector('[data-gen]').onclick = async () => { try { const r = await api('/notifications/generate', { method: 'POST' }); toast(r.message); load(); } catch (e) { toast(e.message, 'error'); } };
  container.querySelector('[data-all]').onclick = async () => { await api('/notifications/read-all', { method: 'POST' }); toast(t('saved')); load(); };
  load();
}
