/* PharmaPro – Users, roles, settings, backups & audit */
(function () {
  'use strict';
  const ui = App.ui;
  const fmt = App.fmt;

  const PERM_LABELS = {
    'dashboard.view': 'عرض لوحة التحكم',
    'pos.use': 'استخدام نقطة البيع',
    'products.view': 'عرض الأصناف',
    'products.manage': 'إدارة الأصناف',
    'inventory.manage': 'إدارة المخزون والتسويات',
    'purchases.view': 'عرض المشتريات',
    'purchases.manage': 'إدارة المشتريات',
    'suppliers.manage': 'إدارة الموردين',
    'customers.manage': 'إدارة العملاء',
    'prescriptions.manage': 'إدارة الروشتات',
    'sales.view': 'عرض المبيعات',
    'sales.manage': 'إدارة المبيعات وإلغاء الفواتير',
    'returns.manage': 'إدارة المرتجعات',
    'reports.view': 'عرض التقارير',
    'accounting.view': 'عرض المحاسبة',
    'accounting.manage': 'إدارة القيود والمصروفات',
    'shifts.use': 'استخدام الورديات',
    'shifts.manage': 'إدارة ورديات الآخرين',
    'users.manage': 'إدارة المستخدمين والأدوار',
    'settings.manage': 'إدارة الإعدادات',
    'backup.manage': 'النسخ الاحتياطي والاستعادة',
    'audit.view': 'عرض سجل النشاط'
  };
  const PERM_GROUPS = [
    { title: 'لوحة التحكم والكاشير', perms: ['dashboard.view', 'pos.use'] },
    { title: 'الأصناف والمخزون', perms: ['products.view', 'products.manage', 'inventory.manage'] },
    { title: 'المشتريات والموردون', perms: ['purchases.view', 'purchases.manage', 'suppliers.manage'] },
    { title: 'العملاء والروشتات', perms: ['customers.manage', 'prescriptions.manage'] },
    { title: 'المبيعات والمرتجعات', perms: ['sales.view', 'sales.manage', 'returns.manage'] },
    { title: 'التقارير والمحاسبة', perms: ['reports.view', 'accounting.view', 'accounting.manage'] },
    { title: 'الورديات', perms: ['shifts.use', 'shifts.manage'] },
    { title: 'إدارة النظام', perms: ['users.manage', 'settings.manage', 'backup.manage', 'audit.view'] }
  ];
  const ACTION_LABELS = {
    login: 'تسجيل دخول', logout: 'تسجيل خروج', create: 'إضافة', update: 'تعديل', delete: 'حذف',
    sale: 'بيع', void_sale: 'إلغاء فاتورة', purchase: 'شراء', sale_return: 'مرتجع بيع',
    purchase_return: 'مرتجع شراء', open_shift: 'فتح وردية', close_shift: 'إغلاق وردية',
    cash_movement: 'حركة نقدية', backup: 'نسخ احتياطي', restore: 'استعادة', adjust: 'تسوية مخزون',
    dispense: 'صرف روشتة', payment: 'سداد'
  };
  const ACTION_TONES = {
    create: 'success', update: 'info', delete: 'danger', login: 'success', logout: 'warning',
    sale: 'success', void_sale: 'danger', restore: 'danger', backup: 'info', delete_backup: 'danger'
  };
  const BACKUP_TYPES = { manual: 'يدوية', auto: 'تلقائية', 'pre-restore': 'أمان قبل الاستعادة', upload: 'مرفوعة' };

  function bytes(n) {
    if (!n && n !== 0) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }
  function permList(p) {
    if (Array.isArray(p)) return p;
    try { return JSON.parse(p || '[]'); } catch (_) { return []; }
  }

  /* ================================================================== */
  /*                              USERS                                 */
  /* ================================================================== */
  function userFormModal(user, roles, onDone) {
    const u = user || {};
    let customPerms = null;
    if (u.permissions) { try { const p = JSON.parse(u.permissions); if (Array.isArray(p)) customPerms = p; } catch (_) { /* inherit */ } }
    const isCustom = customPerms !== null;
    const m = ui.modal({
      title: user ? 'تعديل مستخدم' : 'مستخدم جديد',
      subtitle: user ? `@${u.username}` : 'إنشاء حساب موظف وتحديد دوره الوظيفي',
      size: 'md',
      body: `<div class=\"form-grid\">
        ${ui.field({ label: 'الاسم الكامل', name: 'full_name', value: u.full_name || '', required: true, col: 'span-2' })}
        ${ui.field({ label: 'اسم المستخدم', name: 'username', value: u.username || '', required: true, disabled: !!user, dir: 'ltr', hint: user ? 'لا يمكن تغييره بعد الإنشاء' : 'أحرف إنجليزية وأرقام بدون مسافات' })}
        ${ui.field({ label: 'الدور الوظيفي', name: 'role_id', type: 'select', value: u.role_id || '', options: roles.map((r) => ({ value: r.id, label: r.name })) })}
        ${ui.field({ label: user ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور', name: 'password', type: 'password', required: !user, dir: 'ltr', hint: '6 أحرف على الأقل' })}
        ${ui.field({ label: 'الهاتف', name: 'phone', value: u.phone || '', type: 'tel' })}
        ${ui.field({ label: 'البريد الإلكتروني', name: 'email', value: u.email || '', type: 'email' })}
        ${ui.field({ label: 'لون الحساب', name: 'color', type: 'color', value: u.color || '#0ea5e9' })}
        ${ui.field({ label: 'الحساب نشط', name: 'active', type: 'switch', value: user ? !!u.active : true, hint: 'يستطيع تسجيل الدخول' })}
        ${ui.field({ label: 'استخدام صلاحيات مخصصة', name: 'custom_permissions', type: 'switch', value: isCustom, hint: 'تجاوز صلاحيات الدور واختيار صلاحيات محددة لهذا المستخدم', col: 'span-2' })}
      </div>
      <div id="user-perm-wrap" style="display:${isCustom ? 'block' : 'none'};margin-top:4px">
        <div class="small muted mb-3">حدد الصلاحيات المسموحة لهذا المستخدم (تتجاوز صلاحيات الدور):</div>
        ${PERM_GROUPS.map((g) => `<div class="perm-group">
          <div class="perm-group-title">${g.title}</div>
          <div class="perm-grid">
            ${g.perms.map((p) => `<label class="check"><input type="checkbox" data-perm="${p}" ${isCustom && customPerms.includes(p) ? 'checked' : ''}> ${PERM_LABELS[p] || p}</label>`).join('')}
          </div>
        </div>`).join('')}
      </div>`,
      footer: `<button class=\"btn\" data-close>إلغاء</button><button class=\"btn primary\" data-save>${App.icon('save')} حفظ المستخدم</button>`,
      onMount: (h) => {
        const form = h.el.querySelector('.modal-body');
        const sw = form.querySelector('[name=custom_permissions]');
        const wrap = h.el.querySelector('#user-perm-wrap');
        const toggle = () => { if (wrap) wrap.style.display = sw.checked ? 'block' : 'none'; };
        if (sw) sw.addEventListener('change', toggle);
        h.el.querySelector('[data-save]').onclick = async () => {
          const v = App.formValues(form);
          v.active = form.querySelector('[name=active]').checked ? 1 : 0;
          v.role_id = v.role_id ? Number(v.role_id) : null;
          delete v.custom_permissions;
          if (sw && sw.checked) {
            const perms = [...h.el.querySelectorAll('#user-perm-wrap [data-perm]:checked')].map((i) => i.dataset.perm);
            if (!perms.length) return ui.toast('حدد صلاحية واحدة على الأقل', 'warning');
            v.permissions = perms;
          } else {
            v.permissions = null;
          }
          if (!v.full_name) return ui.toast('الاسم الكامل مطلوب', 'warning');
          if (!user && !v.username) return ui.toast('اسم المستخدم مطلوب', 'warning');
          if (!user && !v.password) return ui.toast('كلمة المرور مطلوبة', 'warning');
          if (v.password && v.password.length < 6) return ui.toast('كلمة المرور 6 أحرف على الأقل', 'warning');
          try {
            if (user) await App.api('/users/' + user.id, { method: 'PUT', body: v });
            else await App.api('/users', { method: 'POST', body: v });
            ui.toast(user ? 'تم تحديث المستخدم' : 'تم إنشاء المستخدم');
            m.close();
            if (onDone) onDone();
          } catch (err) { ui.toast(err.message, 'error'); }
        };
      }
    });
  }

  function resetPasswordModal(user, onDone) {
    const m = ui.modal({
      title: 'إعادة تعيين كلمة المرور',
      subtitle: `${user.full_name} · @${user.username}`,
      size: 'sm',
      body: `<div class=\"form-grid\">
        ${ui.field({ label: 'كلمة المرور الجديدة', name: 'password', type: 'password', dir: 'ltr', required: true, col: 'span-2', hint: '6 أحرف على الأقل' })}
        ${ui.field({ label: 'تأكيد كلمة المرور', name: 'confirm', type: 'password', dir: 'ltr', required: true, col: 'span-2' })}
      </div>`,
      footer: `<button class=\"btn\" data-close>إلغاء</button><button class=\"btn primary\" data-save>${App.icon('key')} تعيين</button>`,
      onMount: (h) => {
        h.el.querySelector('[data-save]').onclick = async () => {
          const v = App.formValues(h.el.querySelector('.modal-body'));
          if (!v.password || v.password.length < 6) return ui.toast('كلمة المرور 6 أحرف على الأقل', 'warning');
          if (v.password !== v.confirm) return ui.toast('كلمتا المرور غير متطابقتين', 'warning');
          try {
            await App.api('/users/' + user.id, {
              method: 'PUT',
              body: { ...user, password: v.password, role_id: user.role_id, active: user.active }
            });
            ui.toast('تم تعيين كلمة المرور الجديدة');
            m.close();
            if (onDone) onDone();
          } catch (err) { ui.toast(err.message, 'error'); }
        };
      }
    });
  }

  function roleFormModal(role, allPermissions, onDone) {
    const isSuper = role && permList(role.permissions).includes('*');
    const current = isSuper ? allPermissions.slice() : permList(role && role.permissions);
    const m = ui.modal({
      title: role ? 'تعديل الدور' : 'دور جديد',
      subtitle: isSuper ? 'دور مدير النظام يمتلك كل الصلاحيات دائماً' : 'حدد الصلاحيات المسموحة لهذا الدور',
      size: 'lg',
      body: `<div class=\"form-grid\">
        ${ui.field({ label: 'اسم الدور', name: 'name', value: (role && role.name) || '', required: true })}
        ${ui.field({ label: 'الوصف', name: 'description', value: (role && role.description) || '' })}
      </div>
      ${isSuper ? `<div class=\"shift-banner mt-3\" style=\"background:var(--primary-soft);color:var(--primary)\">${App.icon('shield', 15)} هذا دور نظامي بصلاحيات كاملة، لا يمكن تقييده.</div>` : ''}
      <div class=\"mt-4\" ${isSuper ? 'style=\"opacity:.65;pointer-events:none\"' : ''}>
        ${PERM_GROUPS.map((g) => `<div class=\"perm-group\">
          <div class=\"perm-group-title\">${g.title}</div>
          <div class=\"perm-grid\">
            ${g.perms.map((p) => `<label class=\"check\"><input type=\"checkbox\" data-perm=\"${p}\" ${current.includes(p) ? 'checked' : ''}> ${PERM_LABELS[p] || p}</label>`).join('')}
          </div>
        </div>`).join('')}
      </div>`,
      footer: `<button class=\"btn\" data-close>إلغاء</button><button class=\"btn primary\" data-save>${App.icon('save')} حفظ الدور</button>`,
      onMount: (h) => {
        h.el.querySelector('[data-save]').onclick = async () => {
          const v = App.formValues(h.el.querySelector('.modal-body'));
          if (!v.name) return ui.toast('اسم الدور مطلوب', 'warning');
          const permissions = isSuper ? ['*'] : [...h.el.querySelectorAll('[data-perm]:checked')].map((i) => i.dataset.perm);
          if (!permissions.length) return ui.toast('حدد صلاحية واحدة على الأقل', 'warning');
          try {
            if (role) await App.api('/roles/' + role.id, { method: 'PUT', body: { ...v, permissions } });
            else await App.api('/roles', { method: 'POST', body: { ...v, permissions } });
            ui.toast('تم حفظ الدور والصلاحيات');
            m.close();
            if (onDone) onDone();
          } catch (err) { ui.toast(err.message, 'error'); }
        };
      }
    });
  }

  async function renderUsers(container, params) {
    let tab = params.tab === 'roles' ? 'roles' : 'users';
    container.innerHTML = `
      ${ui.pageHead({
        title: 'المستخدمون والصلاحيات',
        subtitle: 'إدارة حسابات الموظفين والأدوار وصلاحيات الوصول',
        actions: `<button class=\"btn primary\" data-new>${App.icon('plus')} ${tab === 'roles' ? 'دور جديد' : 'مستخدم جديد'}</button>`
      })}
      <div class=\"card\">
        <div id=\"admin-tabs\">${ui.tabs([{ id: 'users', label: 'المستخدمون', icon: 'users' }, { id: 'roles', label: 'الأدوار والصلاحيات', icon: 'shield' }], tab)}</div>
        <div id=\"admin-body\"><div class=\"loading-block\"><span class=\"spinner\"></span> جارٍ التحميل...</div></div>
      </div>`;
    const bodyEl = container.querySelector('#admin-body');
    const newBtn = container.querySelector('[data-new]');

    async function load() {
      bodyEl.innerHTML = `<div class=\"loading-block\"><span class=\"spinner\"></span> جارٍ التحميل...</div>`;
      newBtn.innerHTML = `${App.icon('plus')} ${tab === 'roles' ? 'دور جديد' : 'مستخدم جديد'}`;
      try {
        if (tab === 'roles') {
          const [rolesRes, permsRes] = await Promise.all([App.api('/roles'), App.api('/permissions')]);
          const perms = permsRes.items || [];
          bodyEl.innerHTML = `<div class=\"card-body\">${ui.table({
            columns: [
              { label: 'الدور', render: (r) => `<div class=\"cell-title\">${App.esc(r.name)} ${r.is_system ? '<span class=\"badge\">نظامي</span>' : ''}</div><div class=\"cell-sub\">${App.esc(r.description || '—')}</div>` },
              { label: 'المستخدمون', tdClass: 'num', render: (r) => fmt.number(r.users_count, 0) },
              { label: 'الصلاحيات', render: (r) => {
                const p = permList(r.permissions);
                return p.includes('*') ? '<span class=\"badge success\">كل الصلاحيات</span>' :
                  `<span class=\"badge info\">${p.length} صلاحية</span>`;
              } },
              { label: '', tdClass: 'actions', render: (r) => `<button class=\"btn icon sm\" data-view=\"${r.id}\" title=\"عرض الصلاحيات\">${App.icon('eye', 14)}</button>
                <button class=\"btn icon sm\" data-edit=\"${r.id}\" title=\"تعديل\">${App.icon('edit', 14)}</button>
                ${!r.is_system ? `<button class=\"btn icon sm\" data-del=\"${r.id}\" title=\"حذف\" style=\"color:var(--danger)\">${App.icon('trash', 14)}</button>` : ''}` }
            ],
            rows: rolesRes.items,
            empty: ui.empty({ icon: 'shield', title: 'لا توجد أدوار' })
          })}</div>`;
          bodyEl.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => {
            const role = rolesRes.items.find((r) => String(r.id) === b.dataset.edit);
            roleFormModal(role, perms, load);
          });
          bodyEl.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => {
            const role = rolesRes.items.find((r) => String(r.id) === b.dataset.view);
            const p = permList(role.permissions);
            ui.modal({
              title: 'صلاحيات ' + role.name,
              subtitle: role.description || '',
              size: 'md',
              body: p.includes('*') ? `<div class=\"shift-banner\" style=\"background:var(--success-soft);color:var(--success)\">${App.icon('shield', 15)} يمتلك هذا الدور كل صلاحيات النظام.</div>` :
                PERM_GROUPS.map((g) => {
                  const has = g.perms.filter((x) => p.includes(x));
                  if (!has.length) return '';
                  return `<div class=\"perm-group\"><div class=\"perm-group-title\">${g.title}</div><div class=\"perm-grid\">${has.map((x) => `<span class=\"perm-chip\">${App.icon('check', 12)} ${PERM_LABELS[x] || x}</span>`).join('')}</div></div>`;
                }).join(''),
              footer: `<button class=\"btn primary\" data-close>إغلاق</button>`
            });
          });
          bodyEl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
            const yes = await ui.confirm({ title: 'حذف الدور', message: 'سيتم حذف هذا الدور نهائياً. لا يمكن حذف دور مرتبط بمستخدمين.', confirmText: 'حذف', danger: true });
            if (!yes) return;
            try { await App.api('/roles/' + b.dataset.del, { method: 'DELETE' }); ui.toast('تم حذف الدور'); load(); } catch (err) { ui.toast(err.message, 'error'); }
          });
          newBtn.onclick = () => roleFormModal(null, perms, load);
        } else {
          const [usersRes, rolesRes] = await Promise.all([App.api('/users'), App.api('/roles')]);
          const roles = rolesRes.items || [];
          bodyEl.innerHTML = `<div class=\"card-body\">${ui.table({
            columns: [
              { label: 'المستخدم', render: (u) => `<div class=\"main-cell\"><div class=\"avatar sm\" style=\"background:${u.color || 'var(--primary)'}\">${App.esc((u.full_name || '?').charAt(0))}</div>
                <div><div class=\"cell-title\">${App.esc(u.full_name)} ${u.id === App.state.user.id ? '<span class=\"badge info\">أنت</span>' : ''}</div>
                <div class=\"cell-sub ltr\">@${App.esc(u.username)}</div></div></div>` },
              { label: 'الدور', render: (u) => `<span class=\"badge\">${App.esc(u.role_name || 'بدون دور')}</span> ${u.permissions ? '<span class=\"badge info\">مخصص</span>' : ''}` },
              { label: 'الاتصال', render: (u) => `<div class=\"small ltr\">${App.esc(u.phone || '—')}</div><div class=\"cell-sub\">${App.esc(u.email || '')}</div>` },
              { label: 'آخر دخول', render: (u) => u.last_login ? `<span class=\"small\">${fmt.datetime(u.last_login)}</span>` : '<span class=\"muted small\">لم يسجل بعد</span>' },
              { label: 'الحالة', render: (u) => u.active ? '<span class="badge success">نشط</span>' : '<span class="badge">موقوف</span>' },
              { label: '', tdClass: 'actions', render: (u) => `<button class=\"btn icon sm\" data-edit=\"${u.id}\" title=\"تعديل\">${App.icon('edit', 14)}</button>
                <button class=\"btn icon sm\" data-pass=\"${u.id}\" title=\"كلمة المرور\">${App.icon('key', 14)}</button>
                ${u.username !== 'admin' && u.id !== App.state.user.id ? `<button class=\"btn icon sm\" data-del=\"${u.id}\" title=\"إيقاف / تعطيل\" style=\"color:var(--danger)\">${App.icon('ban', 14)}</button>` : ''}` }
            ],
            rows: usersRes.items,
            empty: ui.empty({ icon: 'users', title: 'لا يوجد مستخدمون' })
          })}</div>`;
          newBtn.onclick = () => userFormModal(null, roles, load);
          bodyEl.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => {
            const u = usersRes.items.find((x) => String(x.id) === b.dataset.edit);
            userFormModal(u, roles, load);
          });
          bodyEl.querySelectorAll('[data-pass]').forEach((b) => b.onclick = () => {
            const u = usersRes.items.find((x) => String(x.id) === b.dataset.pass);
            resetPasswordModal(u, load);
          });
          bodyEl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
            const u = usersRes.items.find((x) => String(x.id) === b.dataset.del);
            const yes = await ui.confirm({
              title: 'تعطيل المستخدم', danger: true, confirmText: 'تعطيل الحساب',
              message: `سيتم تعطيل حساب <b>${App.esc(u.full_name)}</b> ومنعه من تسجيل الدخول. يمكنك إعادة تفعيله لاحقاً من التعديل.`
            });
            if (!yes) return;
            try { await App.api('/users/' + u.id, { method: 'DELETE' }); ui.toast('تم تعطيل الحساب'); load(); } catch (err) { ui.toast(err.message, 'error'); }
          });
        }
      } catch (err) {
        bodyEl.innerHTML = `<div class=\"card-pad\">${ui.empty({ icon: 'alert', title: 'تعذر تحميل البيانات', text: App.esc(err.message) })}</div>`;
      }
    }

    ui.bindTabs(container.querySelector('#admin-tabs'), (t) => { tab = t; load(); });
    await load();
  }

  /* ================================================================== */
  /*                            SETTINGS                                */
  /* ================================================================== */
  async function renderSettings(container) {
    container.innerHTML = `
      ${ui.pageHead({
        title: 'إعدادات النظام',
        subtitle: 'بيانات الصيدلية، الضريبة، الفاتورة والتنبيهات',
        actions: `<button class=\"btn primary\" data-save>${App.icon('save')} حفظ التغييرات</button>`
      })}
      <div id=\"set-body\"><div class=\"loading-block\"><span class=\"spinner\"></span> جارٍ التحميل...</div></div>`;
    const bodyEl = container.querySelector('#set-body');
    let settings;
    try { settings = await App.api('/settings'); } catch (err) {
      bodyEl.innerHTML = `<div class=\"card card-pad\">${ui.empty({ icon: 'alert', title: 'تعذر تحميل الإعدادات', text: App.esc(err.message) })}</div>`;
      return;
    }
    const s = (k, d) => (settings[k] === undefined || settings[k] === null ? d || '' : settings[k]);
    bodyEl.innerHTML = `
      <div class=\"settings-grid\">
        ${ui.section({
          title: 'بيانات الصيدلية', subtitle: 'تظهر على الفواتير والتقارير المطبوعة',
          body: `<div class=\"form-grid\">
            ${ui.field({ label: 'اسم الصيدلية (عربي)', name: 'pharmacy_name', value: s('pharmacy_name'), required: true })}
            ${ui.field({ label: 'اسم الصيدلية (إنجليزي)', name: 'pharmacy_name_en', value: s('pharmacy_name_en'), dir: 'ltr' })}
            ${ui.field({ label: 'رقم الهاتف', name: 'phone', value: s('phone'), type: 'tel' })}
            ${ui.field({ label: 'البريد الإلكتروني', name: 'email', value: s('email'), type: 'email', dir: 'ltr' })}
            ${ui.field({ label: 'العنوان', name: 'address', value: s('address'), col: 'span-2' })}
            ${ui.field({ label: 'الرقم الضريبي', name: 'tax_no', value: s('tax_no') })}
            ${ui.field({ label: 'رقم الترخيص', name: 'license_no', value: s('license_no') })}
          </div>`
        })}
        ${ui.section({
          title: 'العملة والضريبة', subtitle: 'إعدادات الفواتير والحسابات',
          body: `<div class=\"form-grid\">
            ${ui.field({ label: 'رمز العملة', name: 'currency', value: s('currency', 'ج.م') })}
            ${ui.field({ label: 'نسبة ضريبة القيمة المضافة %', name: 'vat_rate', value: s('vat_rate', '14'), type: 'number', min: 0, max: 100, step: '0.01' })}
            ${ui.field({ label: 'بداية السنة المالية (شهر-يوم)', name: 'fiscal_year_start', value: s('fiscal_year_start', '01-01'), placeholder: '01-01', dir: 'ltr' })}
            ${ui.field({ label: 'قيمة نقطة الولاء', name: 'loyalty_per_point', value: s('loyalty_per_point', '10'), type: 'number', min: 1, step: '1', hint: 'مبلغ الشراء لكل نقطة' })}
          </div>`
        })}
        ${ui.section({
          title: 'الفاتورة والطباعة', subtitle: 'تخصيص الإيصال الحراري والفاتورة A4',
          body: `<div class=\"form-grid\">
            ${ui.field({ label: 'نص أسفل الفاتورة', name: 'receipt_footer', value: s('receipt_footer'), type: 'textarea', col: 'span-2', rows: 2 })}
            ${ui.field({ label: 'الطابعة الافتراضية', name: 'default_printer', type: 'select', value: s('default_printer', 'receipt'), options: [
              { value: 'receipt', label: 'إيصال حراري 80mm' }, { value: 'a4', label: 'فاتورة A4' }
            ] })}
            ${ui.field({ label: 'إظهار الشعار', name: 'receipt_show_logo', type: 'switch', value: s('receipt_show_logo', '1') === '1' })}
          </div>`
        })}
        ${ui.section({
          title: 'التنبيهات والمظهر', subtitle: 'حدود المخزون وتنبيهات الصلاحية',
          body: `<div class=\"form-grid\">
            ${ui.field({ label: 'تنبيهات المخزون المنخفض', name: 'low_stock_alert', type: 'switch', value: s('low_stock_alert', '1') === '1' })}
            ${ui.field({ label: 'تنبيه الصلاحية قبل (أيام)', name: 'expiry_alert_days', value: s('expiry_alert_days', '90'), type: 'number', min: 1, max: 730, step: '1' })}
            ${ui.field({ label: 'المظهر الافتراضي', name: 'theme', type: 'select', value: s('theme', 'auto'), options: [
              { value: 'auto', label: 'حسب الجهاز' }, { value: 'light', label: 'فاتح' }, { value: 'dark', label: 'داكن' }
            ], hint: 'يمكن لكل مستخدم التبديل من الشريط العلوي' })}
          </div>`
        })}
      </div>`;
    container.querySelector('[data-save]').onclick = async () => {
      const form = bodyEl;
      const v = App.formValues(form);
      ['receipt_show_logo', 'low_stock_alert'].forEach((k) => {
        const input = form.querySelector(`[name=${k}]`);
        v[k] = input && input.checked ? '1' : '0';
      });
      try {
        const updated = await App.api('/settings', { method: 'PUT', body: v });
        App.state.settings = updated;
        ui.toast('تم حفظ الإعدادات بنجاح');
        const brand = document.querySelector('.brand-sub');
        if (brand) brand.textContent = updated.pharmacy_name || 'منصة إدارة الصيدلية';
        App.setTheme(v.theme || 'auto');
      } catch (err) { ui.toast(err.message, 'error'); }
    };
  }

  /* ================================================================== */
  /*                             BACKUP                                 */
  /* ================================================================== */
  async function renderBackup(container) {
    const state = { dir: '' };
    container.innerHTML = `
      ${ui.pageHead({
        title: 'النسخ الاحتياطي والاستعادة',
        subtitle: 'حماية بيانات الصيدلية على القرص أو مجلد شبكي',
        actions: `<button class=\"btn primary\" data-create>${App.icon('database')} إنشاء نسخة الآن</button>`
      })}
      <div class=\"card mb-4\">
        <div class=\"card-body\">
          <div class=\"field\" style=\"margin-bottom:12px\">
            <label class=\"label\">مجلد النسخ الاحتياطي</label>
            <div class=\"flex gap-2 flex-wrap\">
              <input class=\"input ltr\" data-dir placeholder=\"C:\\PharmaBackups\" style=\"flex:1;min-width:240px\">
              <button class=\"btn\" data-pick>${App.icon('folder')} اختيار مجلد</button>
              <button class=\"btn\" data-browse>${App.icon('search')} استعراض</button>
            </div>
            <span class=\"hint\">تُحفظ النسخ بصيغة SQLite قابلة للاستعادة في أي وقت. يمكنك اختيار مجلد خارجي أو قرص شبكي.</span>
          </div>
          <div class=\"flex gap-2 flex-wrap\">
            <button class=\"btn primary\" data-create>${App.icon('save')} نسخ احتياطي</button>
            <button class=\"btn\" data-refresh>${App.icon('refresh')} تحديث القائمة</button>
            <span class=\"flex-1\"></span>
            <span class=\"small muted\" data-dir-label></span>
          </div>
          <div class=\"shift-banner mt-4\" style=\"background:var(--info-soft);color:var(--info)\">
            ${App.icon('info', 15)} تُنشأ نسخة أمان تلقائياً قبل كل عملية استعادة. تُحفظ جلسات الدخول الحالية بعد الاستعادة.
          </div>
        </div>
      </div>
      <div class=\"card\">
        <div class=\"card-title\"><div><h3>ملفات النسخ الاحتياطي</h3><p data-count>جارٍ التحميل...</p></div>
          <div class=\"actions\"><button class=\"btn icon\" data-refresh title=\"تحديث\">${App.icon('refresh')}</button></div></div>
        <div id=\"bak-table\"><div class=\"loading-block\"><span class=\"spinner\"></span> جارٍ التحميل...</div></div>
      </div>`;
    const tableEl = container.querySelector('#bak-table');
    const dirInput = container.querySelector('[data-dir]');
    const dirLabel = container.querySelector('[data-dir-label]');
    let currentDir = '';

    async function load() {
      const qs = state.dir ? '?dir=' + encodeURIComponent(state.dir) : '';
      try {
        const r = await App.api('/backups' + qs);
        currentDir = r.dir || '';
        dirInput.value = currentDir;
        dirLabel.textContent = currentDir;
        const history = new Map((r.history || []).map((h) => [h.filename, h]));
        const rows = (r.items || []).map((f) => {
          const h = history.get(f.name);
          return { ...f, type: h ? h.type : '', user_name: h ? h.user_name : '' };
        });
        container.querySelector('[data-count]').textContent = `${rows.length} ملف · ${bytes(rows.reduce((s, f) => s + Number(f.size || 0), 0))}`;
        tableEl.innerHTML = ui.table({
          columns: [
            { label: 'الملف', render: (f) => `<div class=\"cell-title ltr\" style=\"font-size:12px\">${App.esc(f.name)}</div><div class=\"cell-sub ltr\">${App.esc(f.path)}</div>` },
            { label: 'النوع', render: (f) => `<span class=\"badge ${f.type === 'pre-restore' ? 'warning' : f.type === 'auto' ? 'info' : ''}\">${BACKUP_TYPES[f.type] || '—'}</span>` },
            { label: 'الحجم', tdClass: 'num', render: (f) => bytes(f.size) },
            { label: 'التاريخ', render: (f) => fmt.datetime(f.mtime) },
            { label: 'المستخدم', render: (f) => `<span class=\"small muted\">${App.esc(f.user_name || 'النظام')}</span>` },
            { label: '', tdClass: 'actions', render: (f) => `<button class=\"btn sm\" data-restore=\"${f.path}\">${App.icon('rotate', 13)} استعادة</button>
              <button class=\"btn icon sm\" data-del=\"${f.path}\" title=\"حذف\" style=\"color:var(--danger)\">${App.icon('trash', 14)}</button>` }
          ],
          rows,
          empty: ui.empty({ icon: 'database', title: 'لا توجد نسخ احتياطية في هذا المجلد', text: 'اضغط «إنشاء نسخة الآن» لإنشاء أول نسخة.' })
        });
        tableEl.querySelectorAll('[data-restore]').forEach((b) => b.onclick = () => restore(b.dataset.restore));
        tableEl.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => removeBackup(b.dataset.del));
      } catch (err) {
        tableEl.innerHTML = `<div class=\"card-pad\">${ui.empty({ icon: 'alert', title: 'تعذر تحميل النسخ', text: App.esc(err.message) })}</div>`;
      }
    }

    async function create() {
      state.dir = dirInput.value.trim() || state.dir;
      try {
        const info = await App.api('/backups/create', { method: 'POST', body: { dir: state.dir || undefined } });
        ui.toast('تم إنشاء النسخة: ' + info.name);
        load();
      } catch (err) { ui.toast(err.message, 'error'); }
    }

    async function restore(file) {
      const yes = await ui.confirm({
        title: 'استعادة قاعدة البيانات',
        danger: true,
        confirmText: 'استعادة النسخة',
        message: `سيتم استبدال <b>كل البيانات الحالية</b> بمحتوى النسخة المحددة، بعد إنشاء نسخة أمان تلقائية. هل تريد المتابعة؟<br><div class=\"ltr small muted mt-2\" style=\"word-break:break-all\">${App.esc(file)}</div>`
      });
      if (!yes) return;
      try {
        ui.toast('جارٍ الاستعادة... قد تستغرق لحظات', 'info');
        await App.api('/backups/restore', { method: 'POST', body: { file } });
        ui.toast('تمت الاستعادة بنجاح، سيتم تحديث الصفحة');
        setTimeout(() => location.reload(), 1200);
      } catch (err) { ui.toast(err.message, 'error'); }
    }

    async function removeBackup(file) {
      const yes = await ui.confirm({ title: 'حذف نسخة احتياطية', message: 'سيتم حذف ملف النسخة نهائياً من القرص.', confirmText: 'حذف', danger: true });
      if (!yes) return;
      try { await App.api('/backups/delete', { method: 'POST', body: { file } }); ui.toast('تم حذف النسخة'); load(); } catch (err) { ui.toast(err.message, 'error'); }
    }

    async function openBrowse(startDir) {
      const m = ui.modal({
        title: 'استعراض المجلدات', subtitle: 'اختر مجلداً لحفظ النسخ الاحتياطية أو استعادة ملف منه', size: 'lg',
        body: `<div class=\"loading-block\"><span class=\"spinner\"></span> جارٍ فتح المجلد...</div>`,
        footer: `<button class=\"btn\" data-close>إلغاء</button><button class=\"btn primary\" data-choose>${App.icon('folder')} اختيار هذا المجلد</button>`,
        onMount: (h) => {
          let current = '';
          const paint = (r) => {
            current = r.dir;
            h.body.innerHTML = `
              <div class=\"folder-path mb-3\">
                <button class=\"btn icon sm\" data-up title=\"أعلى\">${App.icon('arrowUp', 14)}</button>
                <span class=\"small ltr truncate\" style=\"flex:1\">${App.esc(r.dir)}</span>
              </div>
              <div class=\"drive-chips\">${(r.drives || []).map((d) => `<button class=\"drive-chip\" data-drive=\"${App.esc(d)}\">${App.icon('hardDrive', 13)} ${App.esc(d)}</button>`).join('')}</div>
              <div class=\"folder-list\">
                ${r.parent ? `<button class=\"folder-row\" data-dir=\"${App.esc(r.parent)}\">${App.icon('arrowUp', 16)} <span>..</span></button>` : ''}
                ${(r.entries || []).map((e) => `<button class=\"folder-row\" data-dir=\"${App.esc(e.path)}\">${App.icon('folder', 16)} <span>${App.esc(e.name)}</span></button>`).join('')}
                ${!(r.entries || []).length ? `<div class=\"empty small\" style=\"padding:14px\">لا توجد مجلدات فرعية</div>` : ''}
              </div>
              ${(r.backups || []).length ? `<hr class=\"hr\"><div class=\"small bold mb-2\">نسخ احتياطية في هذا المجلد</div>
                <div class=\"folder-list\">${r.backups.map((f) => `<button class=\"folder-row\" data-file=\"${App.esc(f.path)}\">${App.icon('database', 16)} <span class=\"ltr\">${App.esc(f.name)}</span><span class=\"size\">${bytes(f.size)}</span></button>`).join('')}</div>` : ''}`;
            h.body.querySelectorAll('[data-dir]').forEach((b) => b.onclick = () => loadDir(b.dataset.dir));
            h.body.querySelectorAll('[data-drive]').forEach((b) => b.onclick = () => loadDir(b.dataset.drive));
            h.body.querySelectorAll('[data-file]').forEach((b) => b.onclick = async () => {
              m.close();
              await restore(b.dataset.file);
            });
            const up = h.body.querySelector('[data-up]');
            if (up) up.onclick = () => r.parent && loadDir(r.parent);
          };
          const loadDir = async (dir) => {
            try { paint(await App.api('/backups/browse' + (dir ? '?dir=' + encodeURIComponent(dir) : ''))); }
            catch (err) { ui.toast(err.message, 'error'); }
          };
          h.el.querySelector('[data-choose]').onclick = () => {
            state.dir = current;
            dirInput.value = current;
            m.close();
            load();
          };
          loadDir(startDir);
        }
      });
    }

    container.querySelectorAll('[data-create]').forEach((b) => b.onclick = create);
    container.querySelectorAll('[data-refresh]').forEach((b) => b.onclick = load);
    container.querySelector('[data-pick]').onclick = async () => {
      ui.toast('جارٍ فتح نافذة اختيار المجلد...', 'info');
      try {
        const r = await App.api('/backups/pick-folder', { method: 'POST', body: {} });
        if (r.canceled) return;
        if (r.path) { state.dir = r.path; dirInput.value = r.path; load(); }
        else if (r.error) ui.toast(r.error, 'warning');
      } catch (err) { ui.toast(err.message, 'error'); }
    };
    container.querySelector('[data-browse]').onclick = () => openBrowse(state.dir || '');
    dirInput.onchange = () => { state.dir = dirInput.value.trim(); load(); };
    await load();
  }

  /* ================================================================== */
  /*                              AUDIT                                 */
  /* ================================================================== */
  async function renderAudit(container) {
    const state = { search: '', entity: '', page: 1 };
    container.innerHTML = `
      ${ui.pageHead({ title: 'سجل النشاط', subtitle: 'تتبع كل العمليات الحساسة على النظام' })}
      <div class=\"card\">
        <div class=\"toolbar\">
          <div class=\"search-box\" style=\"flex:1;max-width:340px\">${App.icon('search')}
            <input class=\"input\" data-search placeholder=\"بحث في النشاط أو المستخدم أو التفاصيل...\">
          </div>
          <select class=\"select\" data-entity style=\"width:170px\">
            <option value=\"\">كل الكيانات</option>
            <option value=\"sale\">المبيعات</option>
            <option value=\"purchase\">المشتريات</option>
            <option value=\"product\">الأصناف</option>
            <option value=\"user\">المستخدمون</option>
            <option value=\"shift\">الورديات</option>
            <option value=\"expense\">المصروفات</option>
            <option value=\"settings\">الإعدادات</option>
            <option value=\"backup\">النسخ الاحتياطي</option>
          </select>
          <span class=\"flex-1\"></span>
          <button class=\"btn icon\" data-refresh>${App.icon('refresh')}</button>
        </div>
        <div id=\"audit-table\"><div class=\"loading-block\"><span class=\"spinner\"></span> جارٍ التحميل...</div></div>
      </div>`;
    const tableEl = container.querySelector('#audit-table');

    async function load() {
      const qs = new URLSearchParams({ page: state.page, perPage: 30 });
      if (state.search) qs.set('search', state.search);
      if (state.entity) qs.set('entity', state.entity);
      try {
        const r = await App.api('/audit?' + qs.toString());
        tableEl.innerHTML = ui.table({
          columns: [
            { label: 'التاريخ', render: (a) => `<span class=\"small\">${fmt.datetime(a.created_at)}</span>` },
            { label: 'المستخدم', render: (a) => `<div class=\"main-cell\"><div class=\"avatar sm\">${App.esc((a.user_name || '?').charAt(0))}</div><div class=\"cell-title\" style=\"font-size:12.5px\">${App.esc(a.user_name || 'النظام')}</div></div>` },
            { label: 'الإجراء', render: (a) => `<span class=\"badge ${ACTION_TONES[a.action] || 'info'}\">${ACTION_LABELS[a.action] || a.action}</span>` },
            { label: 'الكيان', render: (a) => `<span class=\"small\">${App.esc(a.entity || '—')}${a.entity_id ? ' #' + a.entity_id : ''}</span>` },
            { label: 'التفاصيل', render: (a) => {
              const d = a.details ? String(a.details) : '';
              return `<span class=\"small muted truncate\" style=\"display:block;max-width:320px\">${App.esc(d || '—')}</span>`;
            } },
            { label: '', tdClass: 'actions', render: (a) => a.details ? `<button class=\"btn icon sm\" data-view=\"${a.id}\" title=\"عرض\">${App.icon('eye', 14)}</button>` : '' }
          ],
          rows: r.items,
          empty: ui.empty({ icon: 'activity', title: 'لا توجد أنشطة مسجلة', text: 'ستظهر هنا كل العمليات الحساسة تلقائياً.' })
        }) + ui.pager(r);
        ui.bindPager(tableEl, (p) => { state.page = p; load(); });
        tableEl.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => {
          const a = r.items.find((x) => String(x.id) === b.dataset.view);
          let details = a.details;
          try { const parsed = JSON.parse(details); details = JSON.stringify(parsed, null, 2); } catch (_) { /* keep */ }
          ui.modal({
            title: 'تفاصيل النشاط',
            subtitle: `${fmt.datetime(a.created_at)} · ${App.esc(a.user_name || 'النظام')}`,
            size: 'md',
            body: `<div class=\"info-row\"><span class=\"k\">الإجراء</span><span class=\"v\">${ACTION_LABELS[a.action] || a.action}</span></div>
              <div class=\"info-row\"><span class=\"k\">الكيان</span><span class=\"v\">${App.esc(a.entity || '—')} ${a.entity_id ? '#' + a.entity_id : ''}</span></div>
              <div class=\"info-row\"><span class=\"k\">عنوان IP</span><span class=\"v ltr\">${App.esc(a.ip || '—')}</span></div>
              <pre class=\"code-block\">${App.esc(details || '—')}</pre>`,
            footer: `<button class=\"btn primary\" data-close>إغلاق</button>`
          });
        });
      } catch (err) {
        tableEl.innerHTML = `<div class=\"card-pad\">${ui.empty({ icon: 'alert', title: 'تعذر تحميل السجل', text: App.esc(err.message) })}</div>`;
      }
    }

    let t = null;
    container.querySelector('[data-search]').oninput = (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 280);
    };
    container.querySelector('[data-entity]').onchange = (e) => { state.entity = e.target.value; state.page = 1; load(); };
    container.querySelector('[data-refresh]').onclick = load;
    await load();
  }

  App.register('users', { title: 'المستخدمون والصلاحيات', subtitle: 'الحسابات والأدوار', perm: 'users.manage', render: renderUsers });
  App.register('settings', { title: 'الإعدادات', subtitle: 'إعدادات النظام', perm: 'settings.manage', render: renderSettings });
  App.register('backup', { title: 'النسخ الاحتياطي', subtitle: 'الحماية والاستعادة', perm: 'backup.manage', render: renderBackup });
  App.register('audit', { title: 'سجل النشاط', subtitle: 'تتبع العمليات', perm: 'audit.view', render: renderAudit });
})();


/* ================================================================== */
/*                     TUTORIAL VIDEOS + DATA TOOLS                    */
/* ================================================================== */
(function () {
  'use strict';
  const ui = App.ui;
  const fmt = App.fmt;

  async function renderTutorials(container) {
    const KEY = 'pp_tutorial_videos_v1';
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
    const save = (list) => localStorage.setItem(KEY, JSON.stringify(list));
    const uid = () => 'tv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const human = (b) => { b = Number(b) || 0; if (b > 1048576) return (b / 1048576).toFixed(1) + ' MB'; if (b > 1024) return (b / 1024).toFixed(0) + ' KB'; return b + ' B'; };
    const readFile = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
    let q = '';
    let showDeleted = false;

    function draw() {
      const term = q.trim().toLowerCase();
      const rows = load()
        .filter((v) => (showDeleted ? !!v.deletedAt : !v.deletedAt))
        .sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0))
        .filter((v) => !term || [v.title, v.page, v.desc, v.num].some((x) => String(x || '').toLowerCase().includes(term)));
      container.querySelector('#tv-count').textContent = rows.length + (showDeleted ? ' محذوف' : ' فيديو');
      const tb = container.querySelector('#tv-trash');
      if (tb) { tb.classList.toggle('primary', showDeleted); }
      const grid = container.querySelector('#tv-grid');
      if (!rows.length) {
        grid.innerHTML = '<div class="card" style="grid-column:1/-1;padding:30px;text-align:center"><div style="font-size:40px">🎬</div><h3 style="margin:8px 0 4px">' + (showDeleted ? 'لا توجد فيديوهات محذوفة' : 'لا توجد فيديوهات شرح بعد') + '</h3><p class="muted small" style="margin-bottom:12px">' + (showDeleted ? 'كل ما تحذفه من فيديوهات سيظهر هنا لإمكانية استعادته.' : 'أضف فيديو يشرح إحدى صفحات البرنامج ليعود إليه المستخدم عند الحاجة.') + '</p>' + (showDeleted ? '' : '<button class="btn primary" id="tv-first">' + App.icon('plus') + ' إضافة أول فيديو</button>') + '</div>';
        const b = container.querySelector('#tv-first'); if (b) b.onclick = () => openForm();
        return;
      }
      grid.innerHTML = rows.map((v) => '<div class="card" style="padding:0;overflow:hidden"><button type="button" data-play="' + v.id + '" style="display:grid;place-items:center;position:relative;width:100%;height:150px;border:0;cursor:pointer;background:var(--panel-2)"><span style="display:grid;place-items:center;width:54px;height:54px;border-radius:16px;background:var(--primary);color:#fff;font-size:22px">▶</span><span class="badge info" style="position:absolute;top:10px;inset-inline-end:10px">#' + App.esc(String(v.num || '')) + '</span></button><div style="padding:12px"><h3 style="margin:0 0 2px;font-size:14px">' + App.esc(v.title) + '</h3><div class="small muted">الصفحة: ' + App.esc(v.page || '-') + '</div>' + (v.desc ? '<p class="small muted" style="margin:6px 0 0">' + App.esc(v.desc) + '</p>' : '') + '<div class="flex items-center" style="justify-content:space-between;font-size:11.5px;color:var(--muted);margin-top:8px"><span>' + human(v.size) + '</span><span>' + App.esc((v.updatedAt || v.createdAt || '').slice(0, 16).replace('T', ' ')) + '</span></div><div class="flex gap-2" style="margin-top:10px">' + (showDeleted
        ? '<button class="btn sm primary" data-restore="' + v.id + '">' + App.icon('refresh', 14) + ' استعادة</button><button class="btn sm danger" data-purge="' + v.id + '">' + App.icon('trash', 14) + ' حذف نهائي</button>'
        : '<button class="btn sm" data-edit="' + v.id + '">' + App.icon('edit', 14) + ' تعديل</button><button class="btn sm danger" data-del="' + v.id + '">' + App.icon('trash', 14) + ' حذف</button>') + '</div></div></div>').join('');
      grid.querySelectorAll('[data-play]').forEach((b) => (b.onclick = () => openPlayer(load().find((x) => x.id === b.dataset.play))));
      grid.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => openForm(load().find((x) => x.id === b.dataset.edit))));
      grid.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
        const v = load().find((x) => x.id === b.dataset.del); if (!v) return;
        if (await ui.confirm({ title: 'نقل إلى السلة؟', message: 'سيتم نقل "' + v.title + '" إلى سلة المحذوفات ويمكن استعادته.', danger: true, confirmText: 'حذف' })) {
          save(load().map((x) => (x.id === v.id ? { ...x, deletedAt: new Date().toISOString() } : x)));
          ui.toast('تم نقله إلى سلة المحذوفات', 'success'); draw();
        }
      }));
      grid.querySelectorAll('[data-restore]').forEach((b) => (b.onclick = () => {
        save(load().map((x) => (x.id === b.dataset.restore ? { ...x, deletedAt: null, restoredAt: new Date().toISOString() } : x)));
        ui.toast('تمت الاستعادة', 'success'); draw();
      }));
      grid.querySelectorAll('[data-purge]').forEach((b) => (b.onclick = async () => {
        if (await ui.confirm({ title: 'حذف نهائي؟', message: 'لا يمكن التراجع عن الحذف النهائي.', danger: true, confirmText: 'حذف نهائي' })) {
          save(load().filter((x) => x.id !== b.dataset.purge)); ui.toast('تم الحذف النهائي', 'success'); draw();
        }
      }));
    }
    function openPlayer(v) {
      if (!v) return;
      ui.modal({ title: App.esc(v.title) + ' <span class="badge info">#' + App.esc(String(v.num || '')) + '</span>', size: 'lg',
        body: '<div class="small muted" style="margin-bottom:8px">الصفحة: ' + App.esc(v.page || '-') + '</div><video controls autoplay src="' + v.data + '" style="width:100%;max-height:60vh;border-radius:12px;background:#000"></video>' + (v.desc ? '<p class="small muted" style="margin-top:10px">' + App.esc(v.desc) + '</p>' : ''),
        footer: '<button class="btn" data-close>إغلاق</button>' });
    }
    function openForm(v) {
      const edit = !!v;
      const m = ui.modal({ title: edit ? 'تعديل الفيديو' : 'إضافة فيديو شرح', size: 'lg',
        body: '<div class="form-grid">' +
          ui.field({ label: 'اسم الفيديو (الصفحة المشروحة)', name: 'title', value: v?.title || '', col: 'span-2' }) +
          ui.field({ label: 'اسم الصفحة', name: 'page', value: v?.page || '' }) +
          ui.field({ label: 'رقم الفيديو', name: 'num', type: 'number', value: v?.num ?? '' }) +
          ui.field({ label: 'وصف مختصر', name: 'desc', type: 'textarea', value: v?.desc || '', col: 'span-2', rows: 3 }) +
          '<div class="field span-2"><label class="label">ملف الفيديو</label><input class="input" name="file" type="file" accept="video/*"><span class="hint">' + (edit ? 'اتركه فارغًا للإبقاء على الملف الحالي.' : 'اختر ملف فيديو للرفع.') + '</span></div>' +
          '</div>',
        footer: '<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>' + App.icon('save') + ' حفظ</button>' });
      m.el.querySelector('[data-save]').onclick = async () => {
        const form = m.body;
        const vals = App.formValues(form);
        const title = (vals.title || '').trim(), page = (vals.page || '').trim(), num = Number(vals.num), desc = (vals.desc || '').trim();
        const file = form.querySelector('[name=file]').files && form.querySelector('[name=file]').files[0];
        if (!title || !page || !Number.isFinite(num) || num <= 0) { ui.toast('أدخل اسم الفيديو والصفحة ورقمًا صحيحًا', 'warning'); return; }
        if (!edit && !file) { ui.toast('يرجى اختيار ملف فيديو', 'warning'); return; }
        const btn = m.el.querySelector('[data-save]'); btn.disabled = true;
        try {
          let media = edit ? { data: v.data, fileName: v.fileName, mime: v.mime, size: v.size } : {};
          if (file) media = { data: await readFile(file), fileName: file.name, mime: file.type || 'video/mp4', size: file.size };
          const now = new Date().toISOString(); const list = load();
          if (edit) { const i = list.findIndex((x) => x.id === v.id); if (i >= 0) list[i] = { ...list[i], title, page, num, desc, ...media, updatedAt: now }; ui.toast('تم تحديث الفيديو', 'success'); }
          else { list.push({ id: uid(), title, page, num, desc, ...media, createdAt: now, updatedAt: now }); ui.toast('تمت إضافة الفيديو', 'success'); }
          save(list); m.close(); draw();
        } catch (e) { ui.toast('تعذر حفظ الفيديو (قد يكون الملف كبيرًا)', 'error'); }
        finally { btn.disabled = false; }
      };
    }

    container.innerHTML = ui.pageHead({ title: 'فيديوهات الشرح', subtitle: 'مكتبة فيديوهات تشرح صفحات البرنامج — عرض وإضافة وتعديل وحذف واستعادة', actions: '<button class="btn" id="tv-trash">' + App.icon('trash') + ' سلة المحذوفات</button><span class="badge info" id="tv-count"></span><button class="btn primary" id="tv-add">' + App.icon('plus') + ' إضافة فيديو</button>' }) +
      '<div class="toolbar mb-3"><div class="search-box" style="max-width:360px">' + App.icon('search') + '<input class="input" id="tv-q" placeholder="ابحث بالاسم أو الصفحة أو الرقم..."></div></div>' +
      '<div id="tv-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px"></div>';
    container.querySelector('#tv-q').oninput = (e) => { q = e.target.value; draw(); };
    container.querySelector('#tv-add').onclick = () => openForm();
    container.querySelector('#tv-trash').onclick = () => { showDeleted = !showDeleted; draw(); };
    draw();
  }

  /* ------------------------------- DATA TOOLS ------------------------------- */
  async function renderDataTools(container) {
    let tab = 'tables';
    let tools = { tables: [] };
    let trash = { groups: [], total: 0 };

    async function loadAll() {
      [tools, trash] = await Promise.all([App.api('/data-tools'), App.api('/trash')]);
      paint();
    }

    function paint() {
      const tabs = [
        { key: 'tables', label: 'تفريغ الجداول', icon: 'layers' },
        { key: 'trash', label: 'سلة المهملات', icon: 'trash', count: trash.total },
      ];
      container.innerHTML = ui.pageHead({ title: 'أدوات البيانات', subtitle: 'تفريغ جداول محددة بأمان، واستعادة العناصر المحذوفة. كل إجراء يُسجَّل في سجل النشاط.' }) +
        '<div class="card"><div class="tabs" style="display:flex;gap:6px;margin-bottom:14px">' +
        tabs.map((t) => '<button class="btn ' + (tab === t.key ? 'primary' : '') + '" data-tab="' + t.key + '">' + App.icon(t.icon, 14) + ' ' + t.label + (t.count ? ' <span class="badge danger">' + fmt.number(t.count, 0) + '</span>' : '') + '</button>').join('') +
        '</div><div id="dt-panel"></div></div>';
      container.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; paint(); }));
      const panel = container.querySelector('#dt-panel');
      if (tab === 'tables') paintTables(panel); else paintTrash(panel);
    }

    function paintTables(panel) {
      panel.innerHTML = '<div class="alert warn" style="margin-bottom:12px">تحذير: التفريغ يحذف البيانات نهائيًا. تُضاف الجداول المرتبطة تلقائيًا للحفاظ على سلامة العلاقات. خذ نسخة احتياطية أولًا.</div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th style="width:44px"></th><th>الجدول</th><th>الاسم</th><th>الصفوف</th><th>الحالة</th></tr></thead><tbody>' +
        (tools.tables || []).map((t) => '<tr><td><input type="checkbox" data-table="' + App.esc(t.name) + '" ' + (t.protected ? 'disabled' : '') + '></td><td class="ltr">' + App.esc(t.name) + '</td><td>' + App.esc(t.label) + '</td><td class="num">' + fmt.number(t.rows, 0) + '</td><td>' + (t.protected ? '<span class="badge">محمي</span>' : '<span class="badge success">قابل للتفريغ</span>') + '</td></tr>').join('') +
        '</tbody></table></div>' +
        '<div class="flex items-center" style="justify-content:space-between;margin-top:12px"><span class="small muted" data-sel>لم يتم تحديد أي جدول</span><button class="btn danger" data-truncate disabled>' + App.icon('trash') + ' تفريغ المحدد</button></div>';
      const boxes = () => [...panel.querySelectorAll('[data-table]:not(:disabled)')];
      const upd = () => {
        const n = boxes().filter((b) => b.checked).length;
        panel.querySelector('[data-sel]').textContent = n ? 'تم تحديد ' + n + ' جدول' : 'لم يتم تحديد أي جدول';
        panel.querySelector('[data-truncate]').disabled = !n;
      };
      boxes().forEach((b) => (b.onchange = upd));
      panel.querySelector('[data-truncate]').onclick = async (e) => {
        const selected = boxes().filter((b) => b.checked).map((b) => b.dataset.table);
        if (!selected.length) return;
        if (!(await ui.confirm({ title: 'تفريغ الجداول؟', message: 'سيتم حذف كل صفوف: ' + selected.join(', ') + '. قد تُضاف جداول مرتبطة تلقائيًا. لا يمكن التراجع.', danger: true, confirmText: 'نعم، فرّغ الآن' }))) return;
        const btn = e.currentTarget; btn.disabled = true;
        try {
          const r = await App.api('/data-tools/truncate', { method: 'POST', body: { tables: selected } });
          ui.toast('تم تفريغ ' + (r.cleared || []).length + ' جدول', 'success');
          await loadAll();
        } catch (err) { ui.toast(err.message, 'error'); btn.disabled = false; }
      };
    }

    function paintTrash(panel) {
      const groups = (trash.groups || []).filter((g) => g.rows.length);
      panel.innerHTML = groups.length ? groups.map((g) => '<div style="margin-bottom:18px"><div class="flex items-center" style="justify-content:space-between;margin-bottom:6px"><b>' + App.esc(g.label) + '</b><span class="badge">' + fmt.number(g.rows.length, 0) + '</span></div><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>الاسم</th><th>تاريخ الإنشاء</th><th style="width:190px"></th></tr></thead><tbody>' +
        g.rows.map((r) => '<tr><td class="num">' + r.id + '</td><td>' + App.esc(r.name || '—') + '</td><td class="small muted">' + App.esc(r.created_at || '—') + '</td><td class="actions"><button class="btn sm" data-restore="' + g.entity + ':' + r.id + '">' + App.icon('refresh', 14) + ' استعادة</button><button class="btn sm danger" data-purge="' + g.entity + ':' + r.id + '">' + App.icon('trash', 14) + ' نهائي</button></td></tr>').join('') +
        '</tbody></table></div></div>').join('') : '<div class="card" style="padding:30px;text-align:center"><div style="font-size:40px">🗑️</div><h3 style="margin:8px 0 4px">السلة فارغة</h3><p class="muted small">عند حذف صنف أو عميل أو مورد أو مستخدم سيظهر هنا لإمكانية استعادته.</p></div>';
      panel.querySelectorAll('[data-restore]').forEach((b) => (b.onclick = async () => {
        const [entity, id] = b.dataset.restore.split(':');
        try { await App.api('/trash/' + entity + '/' + id + '/restore', { method: 'POST' }); ui.toast('تمت الاستعادة', 'success'); await loadAll(); }
        catch (e) { ui.toast(e.message, 'error'); }
      }));
      panel.querySelectorAll('[data-purge]').forEach((b) => (b.onclick = async () => {
        const [entity, id] = b.dataset.purge.split(':');
        if (!(await ui.confirm({ title: 'حذف نهائي؟', message: 'لا يمكن التراجع عن الحذف النهائي.', danger: true, confirmText: 'حذف نهائي' }))) return;
        try { await App.api('/trash/' + entity + '/' + id, { method: 'DELETE' }); ui.toast('تم الحذف النهائي', 'success'); await loadAll(); }
        catch (e) { ui.toast(e.message, 'error'); }
      }));
    }

    await loadAll();
  }

  App.register('tutorials', { title: 'فيديوهات الشرح', subtitle: 'مكتبة فيديوهات تشرح صفحات البرنامج', perm: 'dashboard.view', render: renderTutorials });
  App.register('data-tools', { title: 'أدوات البيانات', subtitle: 'تفريغ الجداول واستعادة المحذوف', perm: 'settings.manage', render: renderDataTools });
})();
