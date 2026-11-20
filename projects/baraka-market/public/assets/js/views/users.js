/* ============================================================
   المستخدمون والصلاحيات
   ============================================================ */
import { state, api, icon, esc, fmt, debounce, initials, roleLabels } from '../core.js';
import { toast, openForm, confirmDialog, emptyState } from '../ui.js';
import { metric } from './_shared.js';

const ROLE_TONES = {
  admin: ['badge-danger', 'shield'],
  manager: ['badge-info', 'user-cog'],
  cashier: ['badge-success', 'scan'],
  accountant: ['badge-purple', 'chart'],
  stock: ['badge-warn', 'layers'],
};

export async function render(root) {
  let alive = true;
  let users = [];
  let meta = { permissions: [], roles: [] };
  const filters = { q: '', role: '' };

  root.innerHTML = `
    <div class="kpis" id="users-stats">
      ${Array(4).fill('<div class="skeleton" style="height:108px;border-radius:18px"></div>').join('')}
    </div>
    <div class="card flush mt-3">
      <div class="toolbar">
        <div class="input-icon">${icon('search')}
          <input class="input" id="users-search" placeholder="ابحث بالاسم أو اسم المستخدم…" autocomplete="off" />
        </div>
        <select class="select" id="users-role" aria-label="الدور الوظيفي">
          <option value="">كل الأدوار</option>
        </select>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-sm" data-add-user>${icon('plus')} مستخدم جديد</button>
      </div>
      <div id="users-results" style="padding:16px">
        ${Array(4).fill('<div class="skeleton" style="height:130px;border-radius:15px;margin-bottom:12px"></div>').join('')}
      </div>
    </div>`;

  async function load() {
    try {
      const [metaRes, usersRes] = await Promise.all([api('/permissions'), api('/users')]);
      if (!alive) return;
      meta = metaRes;
      users = (usersRes.rows || []).map((u) => ({ ...u, perms: parsePerms(u.permissions) }));
      const roleSelect = root.querySelector('#users-role');
      roleSelect.innerHTML = '<option value="">كل الأدوار</option>' + meta.roles.map((r) => `<option value="${esc(r.key)}">${esc(r.label)}</option>`).join('');
      paintStats();
      paint();
    } catch (e) {
      if (!alive) return;
      root.querySelector('#users-stats').innerHTML = '';
      root.querySelector('#users-results').innerHTML = `<div class="empty">
        <div class="empty-ico">${icon('alert')}</div>
        <div class="empty-title">تعذر تحميل المستخدمين</div>
        <div class="empty-text">${esc(e.message)}</div>
      </div>`;
    }
  }

  function paintStats() {
    const active = users.filter((u) => Number(u.active)).length;
    const inactive = users.length - active;
    const admins = users.filter((u) => u.role === 'admin').length;
    root.querySelector('#users-stats').innerHTML = [
      metric({ label: 'إجمالي المستخدمين', value: fmt.int(users.length), unit: 'مستخدم', iconName: 'users', foot: '<span class="muted">فريق العمل المسجل</span>' }),
      metric({ label: 'حسابات نشطة', value: fmt.int(active), unit: 'حساب', iconName: 'check-circle', color: 'var(--info)', soft: 'var(--info-soft)', foot: '<span class="muted">يمكنها تسجيل الدخول</span>' }),
      metric({ label: 'حسابات موقوفة', value: fmt.int(inactive), unit: 'حساب', iconName: 'x-circle', color: 'var(--warn)', soft: 'var(--warn-soft)', foot: '<span class="muted">الوصول إليها محظور</span>' }),
      metric({ label: 'مديرو النظام', value: fmt.int(admins), unit: 'حساب', iconName: 'shield', color: 'var(--purple)', soft: 'var(--purple-soft)', foot: `<span class="muted">${fmt.int(meta.roles.length)} دور وظيفي متاح</span>` }),
    ].join('');
  }

  function filtered() {
    const q = filters.q.toLowerCase();
    return users.filter((u) => (!filters.role || u.role === filters.role)
      && (!q || `${u.name} ${u.username} ${u.phone || ''}`.toLowerCase().includes(q)));
  }

  function paint() {
    const el = root.querySelector('#users-results');
    const rows = filtered();
    if (!rows.length) {
      el.innerHTML = emptyState({
        title: users.length ? 'لا توجد نتائج مطابقة' : 'لا يوجد مستخدمون',
        text: users.length ? 'جرّب تغيير كلمة البحث أو الدور الوظيفي.' : 'أضف أول مستخدم لفريق العمل.',
        iconName: 'users',
        action: '<button class="btn btn-primary" data-add-user>إضافة مستخدم</button>',
      });
      bindInner(el);
      return;
    }
    el.innerHTML = `<div class="grid g3">${rows.map((u) => {
      const perms = u.perms || [];
      const isAdmin = u.role === 'admin' || perms.includes('*');
      const [tone, roleIcon] = ROLE_TONES[u.role] || ['badge-muted', 'user-cog'];
      const self = u.id === state.user?.id;
      return `<div class="card" style="padding:16px;position:relative;overflow:hidden;${Number(u.active) ? '' : 'opacity:.72'}">
        <div class="row" style="align-items:flex-start">
          <div class="avatar lg" style="width:44px;height:44px;border-radius:14px">${esc(initials(u.name))}</div>
          <div style="min-width:0;flex:1">
            <div class="row wrap" style="gap:5px">
              <b style="font-size:12.5px">${esc(u.name)}</b>
              ${self ? '<span class="badge badge-success">أنت</span>' : ''}
            </div>
            <div class="small muted" style="direction:ltr;text-align:start">@${esc(u.username)}</div>
            <div class="row wrap mt-1" style="gap:5px">
              <span class="badge ${tone}">${icon(roleIcon, 'icon-sm')} ${esc(roleLabels[u.role] || u.role)}</span>
              <span class="badge ${Number(u.active) ? 'badge-success' : 'badge-muted'}">${Number(u.active) ? 'نشط' : 'موقوف'}</span>
            </div>
          </div>
        </div>
        <div class="mt-3" style="border-top:1px dashed var(--border);padding-top:10px;display:flex;flex-direction:column;gap:7px">
          <div class="row between small"><span class="muted">${icon('phone', 'icon-sm')} الهاتف</span><span style="direction:ltr">${esc(u.phone || '—')}</span></div>
          <div class="row between small"><span class="muted">${icon('building', 'icon-sm')} الفرع</span><span>${esc(u.branch_name || 'كل الفروع')}</span></div>
          <div class="row between small"><span class="muted">${icon('shield', 'icon-sm')} الصلاحيات</span><b>${isAdmin ? 'وصول كامل' : `${fmt.int(perms.length)} صلاحية`}</b></div>
          <div class="row between small"><span class="muted">${icon('clock', 'icon-sm')} آخر دخول</span><span>${esc(u.last_login ? fmt.relative(u.last_login) : 'لم يدخل بعد')}</span></div>
        </div>
        <div class="row between mt-3" style="border-top:1px solid var(--border);padding-top:10px">
          <button class="btn btn-sm btn-secondary" data-edit="${u.id}">${icon('edit', 'icon-sm')} تعديل</button>
          <div class="actions">
            <button class="icon-btn" data-password="${u.id}" title="كلمة المرور">${icon('key')}</button>
            ${!self ? `<button class="icon-btn ${Number(u.active) ? 'danger' : ''}" data-toggle="${u.id}" title="${Number(u.active) ? 'تعطيل' : 'تفعيل'}">${icon(Number(u.active) ? 'pause' : 'check-circle')}</button>` : ''}
            ${!self ? `<button class="icon-btn danger" data-delete="${u.id}" title="حذف">${icon('trash')}</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('')}</div>`;
    bindInner(el);
  }

  function bindInner(scope) {
    scope.querySelectorAll('[data-add-user]').forEach((b) => b.addEventListener('click', () => openUserForm(null)));
    scope.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openUserForm(find(b.dataset.edit))));
    scope.querySelectorAll('[data-password]').forEach((b) => b.addEventListener('click', () => openPasswordForm(find(b.dataset.password))));
    scope.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggleUser(find(b.dataset.toggle))));
    scope.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => deleteUser(find(b.dataset.delete))));
  }

  function find(id) {
    return users.find((u) => String(u.id) === String(id));
  }

  async function refresh() {
    await load();
  }

  function openUserForm(user) {
    const isNew = !user;
    const roleDefaults = Object.fromEntries(meta.roles.map((r) => [r.key, r.perms || []]));
    const selectedPerms = user ? (user.perms || []) : (roleDefaults.cashier || []);
    const initialRole = user?.role || 'cashier';
    const fields = [
      { name: 'name', label: 'الاسم الكامل', required: true, value: user?.name || '', placeholder: 'مثال: أحمد محمد', autofocus: true },
      { name: 'username', label: 'اسم المستخدم', required: isNew, value: user?.username || '', disabled: !isNew, ltr: true, placeholder: 'ahmed', hint: isNew ? '3 أحرف على الأقل — إنجليزي وأرقام فقط' : 'لا يمكن تغيير اسم المستخدم' },
      { name: 'role', label: 'الدور الوظيفي', type: 'select', value: initialRole, options: meta.roles.map((r) => ({ value: r.key, label: r.label })) },
      { name: 'branch_id', label: 'الفرع المسؤول عنه', type: 'select', value: user?.branch_id || '', options: [
        { value: '', label: 'كل الفروع (غير محدد)' },
        ...(state.branches || []).filter((b) => Number(b.active)).map((b) => ({ value: String(b.id), label: b.name })),
      ], hint: 'يُستخدم كفرع افتراضي للمستخدم ووردياته' },
      { name: 'phone', label: 'رقم الهاتف', value: user?.phone || '', ltr: true, placeholder: '01xxxxxxxxx' },
      ...(isNew ? [{ name: 'password', label: 'كلمة المرور', type: 'password', required: true, minlength: 6, span: 2, hint: '6 أحرف على الأقل — يمكن تغييرها لاحقًا', placeholder: '••••••••' }] : []),
      { name: 'permissions', label: '', type: 'custom', span: 2, html: permissionsHtml(meta.permissions, selectedPerms) },
    ];

    openForm({
      title: isNew ? 'إضافة مستخدم جديد' : 'تعديل بيانات المستخدم',
      subtitle: isNew ? 'أنشئ حسابًا جديدًا وحدد صلاحياته' : `تحديث حساب «${esc(user.name)}»`,
      size: 'wide',
      submitText: isNew ? 'إنشاء المستخدم' : 'حفظ التعديلات',
      fields,
      onMount: (m, form) => {
        const applyRole = (role, fromUser = false) => {
          const isAdmin = role === 'admin';
          const defaults = roleDefaults[role] || [];
          form.querySelectorAll('[data-perm]').forEach((cb) => {
            if (!fromUser) cb.checked = isAdmin || defaults.includes(cb.value);
            else cb.checked = isAdmin || selectedPerms.includes(cb.value);
            cb.disabled = isAdmin;
          });
          const note = form.querySelector('[data-perm-note]');
          if (note) {
            note.innerHTML = isAdmin
              ? `${icon('shield', 'icon-sm')} مدير النظام يملك كل الصلاحيات تلقائيًا`
              : `${icon('info', 'icon-sm')} يمكنك تخصيص الصلاحيات بما يناسب طبيعة عمل المستخدم`;
          }
          form.querySelectorAll('[data-perm-action]').forEach((b) => { b.disabled = isAdmin; });
        };
        const roleInput = form.querySelector('#f-role');
        roleInput?.addEventListener('change', () => applyRole(roleInput.value));
        applyRole(initialRole, true);

        form.querySelector('[data-perm-all]')?.addEventListener('click', () => {
          form.querySelectorAll('[data-perm]:not(:disabled)').forEach((cb) => { cb.checked = true; });
        });
        form.querySelector('[data-perm-none]')?.addEventListener('click', () => {
          form.querySelectorAll('[data-perm]:not(:disabled)').forEach((cb) => { cb.checked = false; });
        });
      },
      onSubmit: async (v, m) => {
        const permissions = v.permissions === undefined ? [] : [].concat(v.permissions);
        const body = {
          name: String(v.name || '').trim(),
          role: v.role,
          phone: String(v.phone || '').trim(),
          branch_id: v.branch_id || null,
          permissions,
        };
        if (isNew) {
          body.username = String(v.username || '').trim();
          body.password = v.password;
          const res = await api('/users', { method: 'POST', body });
          toast(res.message);
        } else {
          body.active = Number(user.active) ? 1 : 0;
          const res = await api(`/users/${user.id}`, { method: 'PUT', body });
          toast(res.message);
          m.close();
          if (Number(user.id) === state.user?.id) {
            setTimeout(() => location.reload(), 600);
            return;
          }
        }
        m.close();
        refresh();
      },
    });
  }

  function openPasswordForm(user) {
    if (!user) return;
    openForm({
      title: 'تغيير كلمة المرور',
      subtitle: `تعيين كلمة مرور جديدة لـ «${esc(user.name)}»`,
      size: 'sm',
      submitText: 'تحديث كلمة المرور',
      fields: [
        { name: 'password', label: 'كلمة المرور الجديدة', type: 'password', required: true, minlength: 6, span: 2, autofocus: true },
        { name: 'confirm', label: 'تأكيد كلمة المرور', type: 'password', required: true, span: 2 },
      ],
      onSubmit: async (v, m) => {
        if (v.password !== v.confirm) throw new Error('كلمتا المرور غير متطابقتين');
        const res = await api(`/users/${user.id}/password`, { method: 'POST', body: { password: v.password } });
        toast(res.message);
        m.close();
        if (Number(user.id) === state.user?.id) setTimeout(() => location.reload(), 800);
      },
    });
  }

  async function toggleUser(user) {
    if (!user) return;
    const activate = !Number(user.active);
    const yes = await confirmDialog({
      title: activate ? 'تفعيل الحساب' : 'تعطيل الحساب',
      message: activate
        ? `سيتمكن «${esc(user.name)}» من تسجيل الدخول مجددًا.`
        : `سيتم منع «${esc(user.name)}» من تسجيل الدخول وإنهاء جلساته الحالية.`,
      confirmText: activate ? 'تفعيل' : 'تعطيل',
      danger: !activate,
      iconName: activate ? 'check-circle' : 'pause',
    });
    if (!yes) return;
    try {
      const res = await api(`/users/${user.id}`, {
        method: 'PUT',
        body: { name: user.name, role: user.role, phone: user.phone || '', branch_id: user.branch_id || null, permissions: user.perms || [], active: activate ? 1 : 0 },
      });
      toast(res.message);
      refresh();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function deleteUser(user) {
    if (!user) return;
    const yes = await confirmDialog({
      title: 'حذف المستخدم',
      message: `هل تريد حذف حساب «${esc(user.name)}»؟ إذا كانت له فواتير سابقة فسيتم تعطيله بدلًا من حذفه للحفاظ على السجلات.`,
      confirmText: 'حذف', danger: true, iconName: 'trash',
    });
    if (!yes) return;
    try {
      const res = await api(`/users/${user.id}`, { method: 'DELETE' });
      toast(res.message);
      refresh();
    } catch (e) { toast(e.message, 'error'); }
  }

  const searchInput = root.querySelector('#users-search');
  searchInput.addEventListener('input', debounce(() => { filters.q = searchInput.value.trim(); paint(); }, 220));
  root.querySelector('#users-role').addEventListener('change', (e) => { filters.role = e.target.value; paint(); });
  root.querySelector('[data-add-user]').addEventListener('click', () => openUserForm(null));

  await load();
  return () => { alive = false; };
}

/* ---------- أدوات ---------- */
function parsePerms(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function permissionsHtml(permissionList, selected) {
  const groups = [];
  const index = new Map();
  for (const perm of permissionList || []) {
    if (!index.has(perm.group)) {
      index.set(perm.group, { name: perm.group, items: [] });
      groups.push(index.get(perm.group));
    }
    index.get(perm.group).items.push(perm);
  }
  return `<div class="field span-2" style="margin:0">
    <div class="row between" style="margin-bottom:8px;flex-wrap:wrap;gap:8px">
      <div>
        <b style="font-size:12px">صلاحيات الوصول</b>
        <div class="tiny muted" style="margin-top:2px">اختر ما يمكن لهذا المستخدم القيام به</div>
      </div>
      <div class="row" style="gap:5px">
        <button type="button" class="btn btn-sm btn-ghost" data-perm-action data-perm-all>تحديد الكل</button>
        <button type="button" class="btn btn-sm btn-ghost" data-perm-action data-perm-none>مسح</button>
      </div>
    </div>
    <div data-perm-note class="alert alert-info" style="margin-bottom:10px;padding:8px 11px;font-size:10.5px"></div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px">
      ${groups.map((g) => `<div style="border:1px solid var(--border);border-radius:11px;padding:9px 11px">
        <div class="tiny" style="font-weight:800;color:var(--muted);margin-bottom:6px">${esc(g.name)}</div>
        <div style="display:flex;flex-direction:column;gap:5px">
          ${g.items.map((p) => `<label class="row" style="gap:7px;font-size:10.5px;cursor:pointer">
            <input type="checkbox" name="permissions" value="${esc(p.key)}" data-perm ${selected.includes(p.key) ? 'checked' : ''} style="accent-color:var(--brand);width:14px;height:14px" />
            <span>${esc(p.label)}</span>
          </label>`).join('')}
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

