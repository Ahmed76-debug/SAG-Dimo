/* ============================================================
   Auto Car — المستخدمون والصلاحيات
   ============================================================ */
import { t, esc, icon, api, initials, state, can } from '../core.js';
import { modal, toast, confirmDialog, emptyState } from '../ui.js';

const ROLES = ['admin', 'manager', 'accountant', 'sales', 'viewer'];
const PERMS = [
  ['vehicles.manage', 'إدارة السيارات والمخزون'],
  ['catalog.manage', 'البيانات المرجعية (ماركات/طرازات/ألوان)'],
  ['partners.manage', 'العملاء والموردون'],
  ['sales.manage', 'المبيعات والفواتير'],
  ['purchases.manage', 'المشتريات'],
  ['installments.manage', 'الأقساط والتحصيل'],
  ['consignment.manage', 'البيع بالعمولة والتسويات'],
  ['accounting.manage', 'المحاسبة والقيود والخزائن'],
  ['settings.manage', 'الإعدادات والعملات'],
  ['users.manage', 'إدارة المستخدمين'],
  ['backup.manage', 'النسخ الاحتياطي والاستعادة'],
  ['import.manage', 'استيراد وتصدير Excel'],
  ['trash.manage', 'سلة المحذوفات'],
  ['truncate.manage', 'تفريغ الجداول'],
  ['activity.view', 'سجل النشاط'],
];

export async function render(container) {
  container.innerHTML = `<div class="toolbar mb-2">
      <div class="search-box grow" style="max-width:320px">${icon('search')}<input class="input" data-q placeholder="${t('search')}"></div>
      <div class="grow"></div>
      <button class="btn btn-primary" data-add>${icon('plus', 'sm')} ${t('add')} ${t('user')}</button>
    </div><div data-table></div>`;

  async function load() {
    const tbl = container.querySelector('[data-table]');
    const q = container.querySelector('[data-q]').value.trim();
    tbl.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const d = await api('/users' + (q ? `?q=${encodeURIComponent(q)}` : ''));
    if (!d.items.length) { tbl.innerHTML = emptyState(t('no_data'), 'users'); return; }
    tbl.innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr><th>${t('user')}</th><th>${t('role')}</th><th>${t('phone')}</th><th>${t('permissions')}</th><th>${t('status')}</th><th class="num">${t('actions')}</th></tr></thead>
      <tbody>${d.items.map((u) => `
        <tr>
          <td><div class="row" style="gap:10px"><span class="avatar">${esc(initials(u.name))}</span><div><b>${esc(u.name)}</b><div class="small muted">@${esc(u.username)}</div></div></div></td>
          <td><span class="badge badge-brand">${esc(t('role_' + u.role, u.role))}</span></td>
          <td>${esc(u.phone || '—')}</td>
          <td>${u.role === 'admin' ? `<span class="badge badge-success">${t('all')}</span>` : `<span class="badge">${(u.permissions || []).length}</span>`}</td>
          <td>${u.active ? `<span class="badge badge-success">${t('active')}</span>` : `<span class="badge">${t('inactive')}</span>`}</td>
          <td class="num"><div class="row-actions">
            <button class="btn btn-ghost btn-icon btn-sm" data-edit="${u.id}" title="${t('edit')}">${icon('edit', 'sm')}</button>
            ${u.id !== state.user.id ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${u.id}" title="${t('delete')}">${icon('trash', 'sm')}</button>` : ''}
          </div></td>
        </tr>`).join('')}</tbody></table></div>`;
    tbl.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(d.items.find((x) => x.id == b.dataset.edit)));
    tbl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      if (await confirmDialog(t('confirm_delete'))) { try { await api(`/users/${b.dataset.del}`, { method: 'DELETE' }); toast(t('msg_deleted')); load(); } catch (e) { toast(e.message, 'error'); } }
    });
  }

  function openForm(u) {
    const isEdit = !!u;
    const data = u || { role: 'sales', active: 1, permissions: [] };
    const m = modal({
      title: isEdit ? `${t('edit')} — ${esc(u.name)}` : `${t('add')} ${t('user')}`,
      size: 'modal-lg',
      body: `<div class="form-grid">
          <div class="field"><label>${t('name')} <span class="req">*</span></label><input class="input" name="name" value="${esc(data.name || '')}"></div>
          <div class="field"><label>${t('username')} <span class="req">*</span></label><input class="input" name="username" value="${esc(data.username || '')}" ${isEdit ? 'disabled' : ''}></div>
          <div class="field"><label>${t('password')} ${isEdit ? `<span class="small muted">(${t('cancel')})</span>` : '<span class="req">*</span>'}</label><input class="input" type="password" name="password" autocomplete="new-password"></div>
          <div class="field"><label>${t('role')}</label><select class="select" name="role">${ROLES.map((r) => `<option value="${r}" ${data.role === r ? 'selected' : ''}>${esc(t('role_' + r, r))}</option>`).join('')}</select></div>
          <div class="field"><label>${t('phone')}</label><input class="input" name="phone" value="${esc(data.phone || '')}"></div>
          <div class="field"><label>${t('email')}</label><input class="input" name="email" value="${esc(data.email || '')}"></div>
          <div class="field full"><label class="check"><input type="checkbox" name="active" ${data.active ? 'checked' : ''}> ${t('active')}</label></div>
        </div>
        <div class="divider"></div>
        <div class="row between mb-1"><b>${t('permissions')}</b><span class="small muted">${t('admin')} = ${t('all')}</span></div>
        <div class="perm-grid">
          ${PERMS.map(([key, label]) => `<label class="check perm-item"><input type="checkbox" data-perm="${key}" ${(data.permissions || []).includes(key) ? 'checked' : ''}> ${esc(label)}</label>`).join('')}
        </div>`,
      footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-save>${icon('save', 'sm')} ${t('save')}</button>`,
    });
    m.node.querySelector('[data-x]').onclick = m.close;
    m.node.querySelector('[data-save]').onclick = async () => {
      const b = m.node;
      const payload = {
        name: b.querySelector('[name=name]').value.trim(),
        username: b.querySelector('[name=username]').value.trim(),
        password: b.querySelector('[name=password]').value,
        role: b.querySelector('[name=role]').value,
        phone: b.querySelector('[name=phone]').value,
        email: b.querySelector('[name=email]').value,
        active: b.querySelector('[name=active]').checked ? 1 : 0,
        permissions: Array.from(b.querySelectorAll('[data-perm]')).filter((c) => c.checked).map((c) => c.dataset.perm),
      };
      if (!payload.name || (!isEdit && !payload.username)) return toast(t('required'), 'warn');
      if (!isEdit && payload.password.length < 6) return toast(t('password') + ' 6+', 'warn');
      try {
        await api(isEdit ? `/users/${u.id}` : '/users', { method: isEdit ? 'PUT' : 'POST', body: payload });
        toast(isEdit ? t('msg_updated') : t('msg_added')); m.close(); load();
      } catch (e) { toast(e.message, 'error'); }
    };
  }

  container.querySelector('[data-add]').onclick = () => openForm(null);
  container.querySelector('[data-q]').oninput = () => { clearTimeout(container._h); container._h = setTimeout(load, 300); };
  load();
}
