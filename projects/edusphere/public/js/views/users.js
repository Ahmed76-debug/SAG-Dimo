import { h, icon } from '../core/dom.js';
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { pageHeader, card, emptyState, spinner, notify, confirmDialog, openDrawer, openModal, badge } from '../core/ui.js';
import { L, dataTable, openEntityForm, loadRefOptions, refOptionsLabel } from './common.js';

export default async function renderUsers(route) {
  if (!store.can('users.manage')) {
    return h('div', { class: 'view' }, card({ body: emptyState({ iconName: 'shield', title: L('Access denied', 'الوصول مرفوض') }) }));
  }
  const tab = route.path === '/roles' ? 'roles' : 'users';
  return tab === 'roles' ? renderRoles() : renderUsersTab();
}

async function renderUsersTab() {
  const host = h('div', {}, h('div', { style: { padding: '28px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
  let users = [], roles = [];

  async function load() {
    host.replaceChildren(h('div', { style: { padding: '28px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
    try {
      const [u, r] = await Promise.all([api.get('/api/users'), api.get('/api/roles')]);
      users = u.rows || u.users || [];
      roles = r.rows || r.roles || [];
      render();
    } catch (err) {
      host.replaceChildren(h('div', { class: 'alert alert--danger' }, err.message));
    }
  }

  function render() {
    if (!users.length) { host.replaceChildren(emptyState({ iconName: 'users', title: L('No users', 'لا يوجد مستخدمون') })); return; }
    host.replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, L('User', 'المستخدم')), h('th', {}, L('Username', 'اسم المستخدم')), h('th', {}, L('Email', 'البريد')), h('th', {}, L('Status', 'الحالة')), h('th', {}, L('Roles', 'الأدوار')), h('th', {}, ''))),
      h('tbody', {}, users.map((u) => h('tr', {},
        h('td', {}, h('div', { class: 'strong' }, L(u.full_name_en || '', u.full_name_ar || u.full_name_en || '') || u.username), u.is_super ? badge(L('Super', 'مدير عام'), 'warning') : null),
        h('td', { class: 'mono' }, u.username || '—'),
        h('td', {}, u.email || '—'),
        h('td', {}, badge(u.is_active !== false ? L('Active', 'نشط') : L('Inactive', 'غير نشط'), u.is_active !== false ? 'success' : 'muted')),
        h('td', {}, h('div', { class: 'row-wrap gap-2' }, (u.roles || []).map((r) => h('span', { class: 'pill' }, L(r.name_en, r.name_ar || r.name_en))))),
        h('td', { class: 'col-actions' }, h('div', { class: 'cell-actions' },
          h('button', { class: 'icon-btn icon-btn--sm', title: L('Edit roles', 'تعديل الأدوار'), onclick: () => editUserRoles(u) }, icon('shield-check')),
          h('a', { class: 'icon-btn icon-btn--sm', title: L('Edit user', 'تعديل المستخدم'), href: `#/e/users/${u.id}` }, icon('edit')),
        )),
      ))))));
  }

  async function editUserRoles(user) {
    let current = [];
    try { const d = await api.get(`/api/users/${user.id}/roles`); current = (d.roles || d.roleIds || []).map((r) => typeof r === 'object' ? r.id : r); } catch { current = (user.roles || []).map((r) => r.id); }
    const checks = roles.map((r) => {
      const cb = h('input', { type: 'checkbox', checked: current.includes(r.id), value: r.id });
      return { cb, row: h('label', { class: 'row gap-2', style: { padding: '6px 0' } }, cb, h('span', {}, L(r.name_en, r.name_ar || r.name_en)), h('span', { class: 'faint', style: { fontSize: 'var(--fs-2xs)' } }, r.code || '')) };
    });
    const save = h('button', { class: 'btn btn--primary' }, icon('save'), L('Save', 'حفظ'));
    const modal = openModal({
      title: L('User roles', 'أدوار المستخدم'), subtitle: L(user.full_name_en || user.username, user.full_name_ar || user.full_name_en || ''),
      body: h('div', { class: 'col' }, checks.map((c) => c.row)),
      footer: [h('button', { class: 'btn', onclick: () => modal.close() }, L('Cancel', 'إلغاء')), save],
    });
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        const roleIds = checks.filter((c) => c.cb.checked).map((c) => Number(c.cb.value));
        await api.put(`/api/users/${user.id}/roles`, { roleIds, roles: roleIds });
        notify.success(L('Roles updated', 'تم تحديث الأدوار')); modal.close(); load();
      } catch (err) { notify.error(L('Error', 'خطأ'), err.message); }
      finally { save.disabled = false; }
    });
  }

  load();

  return h('div', { class: 'view' },
    pageHeader({
      title: L('Users', 'المستخدمون'), iconName: 'users',
      subtitle: L('Manage user accounts and role assignments.', 'إدارة حسابات المستخدمين وتعيين الأدوار.'),
      actions: [
        h('a', { class: 'btn', href: '#/roles' }, icon('shield-check'), L('Roles & permissions', 'الأدوار والصلاحيات')),
        h('a', { class: 'btn btn--primary', href: '#/e/users' }, icon('plus'), L('Manage user records', 'إدارة سجلات المستخدمين')),
      ],
    }),
    card({ body: host }),
  );
}

async function renderRoles() {
  const host = h('div', {}, h('div', { style: { padding: '28px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
  let roles = [], permissions = [];

  async function load() {
    try {
      const [r, p] = await Promise.all([api.get('/api/roles'), api.get('/api/permissions')]);
      roles = r.rows || r.roles || [];
      permissions = p.rows || p.permissions || [];
      render();
    } catch (err) { host.replaceChildren(h('div', { class: 'alert alert--danger' }, err.message)); }
  }

  function render() {
    host.replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, L('Role', 'الدور')), h('th', {}, L('Code', 'الرمز')), h('th', {}, L('Level', 'المستوى')), h('th', {}, L('System', 'نظامي')), h('th', {}, ''))),
      h('tbody', {}, roles.map((r) => h('tr', {},
        h('td', {}, h('div', { class: 'strong' }, L(r.name_en, r.name_ar || r.name_en)), r.description_en ? h('div', { class: 'faint', style: { fontSize: 'var(--fs-2xs)' } }, L(r.description_en || '', r.description_ar || '')) : null),
        h('td', { class: 'mono' }, r.code || '—'),
        h('td', {}, String(r.level ?? '—')),
        h('td', {}, r.is_system ? badge(L('System', 'نظامي'), 'muted') : '—'),
        h('td', { class: 'col-actions' }, h('button', { class: 'btn btn--sm', onclick: () => editRolePerms(r) }, icon('shield-check'), L('Permissions', 'الصلاحيات'))),
      ))))));
  }

  async function editRolePerms(role) {
    let current = [];
    try { const d = await api.get(`/api/roles/${role.id}/permissions`); current = (d.permissions || d.permissionIds || []).map((p) => typeof p === 'object' ? p.id : p); } catch { current = []; }
    const byModule = new Map();
    for (const p of permissions) {
      const mod = p.module || 'general';
      if (!byModule.has(mod)) byModule.set(mod, []);
      byModule.get(mod).push(p);
    }
    const allChecks = [];
    const body = h('div', { class: 'col gap-3' },
      [...byModule.entries()].map(([mod, perms]) => {
        const checks = perms.map((p) => {
          const cb = h('input', { type: 'checkbox', checked: current.includes(p.id), value: p.id });
          allChecks.push(cb);
          return h('label', { class: 'row gap-2', style: { padding: '3px 0', fontSize: 'var(--fs-sm)' } }, cb, h('span', {}, L(p.name_en || p.code, p.name_ar || p.name_en || p.code)));
        });
        return h('div', { class: 'card', style: { boxShadow: 'none', border: '1px solid var(--border)' } },
          h('div', { class: 'card__head' }, h('h4', {}, mod)),
          h('div', { class: 'card__body' }, h('div', { class: 'form-grid', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' } }, checks)));
      }),
    );
    const save = h('button', { class: 'btn btn--primary' }, icon('save'), L('Save permissions', 'حفظ الصلاحيات'));
    const drawer = openDrawer({
      title: L('Role permissions', 'صلاحيات الدور'),
      subtitle: L(role.name_en, role.name_ar || role.name_en),
      wide: true,
      body,
      footer: h('div', { class: 'row gap-2', style: { justifyContent: 'flex-end', width: '100%' } },
        h('button', { class: 'btn', onclick: () => drawer.close() }, L('Cancel', 'إلغاء')), save),
    });
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        const permissionIds = allChecks.filter((c) => c.checked).map((c) => Number(c.value));
        await api.put(`/api/roles/${role.id}/permissions`, { permissionIds, permissions: permissionIds });
        notify.success(L('Permissions updated', 'تم تحديث الصلاحيات')); drawer.close();
      } catch (err) { notify.error(L('Error', 'خطأ'), err.message); }
      finally { save.disabled = false; }
    });
  }

  load();

  return h('div', { class: 'view' },
    pageHeader({
      title: L('Roles & permissions', 'الأدوار والصلاحيات'), iconName: 'shield-check',
      subtitle: L('Define roles and control granular access across every module.', 'عرّف الأدوار وتحكم في الصلاحيات التفصيلية عبر جميع الوحدات.'),
      actions: [h('a', { class: 'btn', href: '#/users' }, icon('users'), L('Users', 'المستخدمون')), h('a', { class: 'btn', href: '#/e/roles' }, icon('edit'), L('Edit role records', 'تعديل سجلات الأدوار'))],
    }),
    card({ body: host }),
  );
}
