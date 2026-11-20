/* ============================================================
   التطبيق — الهيكل، التوجيه، الدخول، الشريط العلوي
   ============================================================ */
import { state, api, can, icon, esc, fmt, theme, initials, setBranch, branchName, $, $$ } from './core.js';
import { toast, modal, openForm, confirmDialog } from './ui.js';
import * as Dashboard from './views/dashboard.js';
import * as Pos from './views/pos.js';
import * as Products from './views/products.js';
import * as Inventory from './views/inventory.js';
import * as Sales from './views/sales.js';
import * as Purchases from './views/purchases.js';
import * as Contacts from './views/contacts.js';
import * as Treasury from './views/treasury.js';
import * as Reports from './views/reports.js';
import * as Users from './views/users.js';
import * as Settings from './views/settings.js';
import * as Backup from './views/backup.js';
import * as Branches from './views/branches.js';
import * as DataTools from './views/data-tools.js';

const NAV = [
  {
    label: 'الرئيسية',
    items: [
      { key: 'dashboard', label: 'لوحة التحكم', icon: 'grid' },
      { key: 'pos', label: 'الكاشير', icon: 'scan' },
      { key: 'sales', label: 'المبيعات', icon: 'receipt' },
    ],
  },
  {
    label: 'المخزون والمشتريات',
    items: [
      { key: 'products', label: 'المنتجات', icon: 'box' },
      { key: 'inventory', label: 'المخزون', icon: 'layers' },
      { key: 'purchases', label: 'المشتريات', icon: 'truck' },
    ],
  },
  {
    label: 'الحسابات',
    items: [
      { key: 'contacts', label: 'العملاء والموردون', icon: 'users' },
      { key: 'treasury', label: 'الخزينة والورديات', icon: 'wallet' },
      { key: 'reports', label: 'التقارير', icon: 'chart' },
    ],
  },
  {
    label: 'النظام',
    items: [
      { key: 'branches', label: 'الفروع', icon: 'building' },
      { key: 'users', label: 'المستخدمون', icon: 'user-cog' },
      { key: 'settings', label: 'الإعدادات', icon: 'sliders' },
      { key: 'data-tools', label: 'أدوات البيانات', icon: 'table' },
      { key: 'backup', label: 'النسخ الاحتياطي', icon: 'database' },
    ],
  },
];

const ROUTES = {
  dashboard: { title: 'لوحة التحكم', sub: 'نظرة سريعة على أداء متجرك اليوم', perm: 'dashboard.view', view: Dashboard },
  pos: { title: 'الكاشير', sub: 'نقطة البيع — ابدأ بمسح الباركود أو اختيار المنتجات', perm: 'pos.use', view: Pos, pos: true },
  sales: { title: 'المبيعات', sub: 'فواتير البيع والمرتجعات والتحصيل', perm: 'sales.view', view: Sales },
  purchases: { title: 'المشتريات', sub: 'فواتير التوريد والموردون', perm: 'purchases.view', view: Purchases },
  products: { title: 'المنتجات', sub: 'إدارة الأصناف والأسعار والتصنيفات', perm: 'products.view', view: Products },
  inventory: { title: 'المخزون', sub: 'الأرصدة وحركات المخزون والتسويات', perm: 'inventory.view', view: Inventory },
  contacts: { title: 'العملاء والموردون', sub: 'العملاء والمديونيات والموردون', perm: 'contacts.view', view: Contacts },
  treasury: { title: 'الخزينة والورديات', sub: 'الحركة النقدية والمصروفات والورديات', perm: 'treasury.view', view: Treasury },
  reports: { title: 'التقارير', sub: 'تحليلات المبيعات والأرباح والمخزون', perm: 'reports.view', view: Reports },
  branches: { title: 'الفروع', sub: 'إدارة فروع المتجر وأدائها وأرصدتها', perm: 'branches.manage', view: Branches },
  users: { title: 'المستخدمون والصلاحيات', sub: 'إدارة فريق العمل وأذونات الوصول', perm: 'users.manage', view: Users },
  settings: { title: 'الإعدادات', sub: 'بيانات المتجر والفواتير والنظام', perm: 'settings.manage', view: Settings },
  'data-tools': { title: 'أدوات البيانات', sub: 'تفريغ الجداول، سجل التدقيق، واستعادة المحذوف', perm: 'settings.manage', view: DataTools },
  backup: { title: 'النسخ الاحتياطي', sub: 'حماية بياناتك واستعادتها في أي وقت', perm: 'backup.manage', view: Backup },
};

const app = document.getElementById('app');
let cleanup = null;

/* ============================ الدخول ============================ */
function loginHtml() {
  const demo = [
    { role: 'مدير النظام', u: 'admin', p: 'admin123' },
    { role: 'كاشير', u: 'cashier', p: 'Cashier@2026' },
    { role: 'محاسب', u: 'manager', p: 'Manager@2026' },
  ];
  return `<div class="login-page">
    <section class="login-brand">
      <div class="lb-head">
        <div class="brand-logo"><svg viewBox="0 0 48 48" width="28" height="28"><path d="M24 5C15 5 8 12 8 21c0 11 10 19.5 16 23 6-3.5 16-12 16-23 0-9-7-16-16-16z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M24 13v19M16 22h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></div>
        <div><b>سوق البركة</b><span>BARAKA MARKET ERP</span></div>
      </div>
      <div class="lb-body">
        <div class="lb-eyebrow"><i></i> الإصدار 1.0 — جاهز للانطلاق</div>
        <h1 class="lb-title">كل متجرك في<br><em>مكان واحد</em>، بذكاء.</h1>
        <p class="lb-desc">نظام متكامل لإدارة السوبر ماركت والخضروات واللحوم: كاشير فائق السرعة، مخزون دقيق، حسابات محكمة، وتقارير تكشف لك أين يذهب كل جنيه.</p>
        <div class="lb-features">
          <div class="lb-feature">${icon('scan')} كاشير وباركود</div>
          <div class="lb-feature">${icon('layers')} مخزون ذكي</div>
          <div class="lb-feature">${icon('chart')} تقارير وأرباح</div>
          <div class="lb-feature">${icon('shield')} نسخ واستعادة</div>
          <div class="lb-feature">${icon('users')} مستخدمون وصلاحيات</div>
          <div class="lb-feature">${icon('moon')} داكن وفاتح</div>
        </div>
      </div>
      <div class="lb-foot"><span>© ${new Date().getFullYear()} سوق البركة</span><span>•</span><span>يعمل محليًا وعلى الاستضافة</span><span>•</span><span>SQLite</span></div>
    </section>

    <section class="login-form-side">
      <button class="icon-btn login-theme" data-theme-toggle aria-label="تبديل المظهر" data-theme-icon>${icon('moon')}</button>
      <div class="login-card">
        <div class="login-logo-mobile">
          <div class="brand-logo" style="width:44px;height:44px"><svg viewBox="0 0 48 48" width="26" height="26"><path d="M24 5C15 5 8 12 8 21c0 11 10 19.5 16 23 6-3.5 16-12 16-23 0-9-7-16-16-16z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M24 13v19M16 22h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></div>
          <div><b>سوق البركة</b><span>نظام إدارة المتجر</span></div>
        </div>
        <h2>أهلًا بعودتك 👋</h2>
        <p>سجّل الدخول لمتابعة يومك في المتجر</p>
        <div class="alert alert-danger login-error" id="login-error">${icon('alert')}<span></span></div>
        <form class="login-form" id="login-form" novalidate>
          <div class="field">
            <label for="login-user">اسم المستخدم</label>
            <div class="input-icon">${icon('users')}<input class="input" id="login-user" name="username" autocomplete="username" placeholder="admin" required autofocus /></div>
          </div>
          <div class="field">
            <label for="login-pass">كلمة المرور</label>
            <div class="input-icon">${icon('key')}
              <input class="input" id="login-pass" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required style="padding-inline-end:44px" />
              <button type="button" class="pw-toggle" data-pw-toggle aria-label="إظهار كلمة المرور">${icon('eye')}</button>
            </div>
          </div>
          <button class="btn btn-primary login-btn" type="submit" id="login-submit">${icon('arrow-left')} تسجيل الدخول</button>
        </form>
        <div class="demo-box">
          <span>حسابات تجريبية — اضغط للتعبئة السريعة</span>
          <div class="demo-chips">
            ${demo.map((d) => `<button type="button" class="demo-chip" data-demo-user="${d.u}" data-demo-pass="${d.p}"><b>${d.role}</b><span>${d.u}</span></button>`).join('')}
          </div>
        </div>
        <div class="login-copy">بياناتك محفوظة على خادمك الخاص — لا نجمع أي معلومات</div>
      </div>
    </section>
  </div>`;
}

function showLogin(message = '') {
  cleanup?.(); cleanup = null;
  window.removeEventListener('hashchange', handleRoute);
  state.user = null; state.csrf = null;
  document.body.style.overflow = '';
  app.className = '';
  app.innerHTML = loginHtml();
  theme.apply();
  $('[data-theme-toggle]')?.addEventListener('click', () => theme.toggle());
  const form = $('#login-form');
  const errEl = $('#login-error');
  const showErr = (msg) => {
    errEl.querySelector('span').textContent = msg;
    errEl.classList.add('show');
  };
  if (message) showErr(message);

  $('#login-user').focus();
  $$('[data-demo-user]').forEach((btn) => btn.addEventListener('click', () => {
    $('#login-user').value = btn.dataset.demoUser;
    $('#login-pass').value = btn.dataset.demoPass;
    errEl.classList.remove('show');
    $('#login-submit').focus();
  }));
  $('[data-pw-toggle]')?.addEventListener('click', () => {
    const input = $('#login-pass');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('[data-pw-toggle]').innerHTML = icon(show ? 'eye-off' : 'eye');
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.classList.remove('show');
    const btn = $('#login-submit');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> جارٍ الدخول…';
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { username: $('#login-user').value.trim(), password: $('#login-pass').value },
      });
      state.user = data.user;
      state.csrf = data.csrf;
      state.settings = data.settings || {};
      const boot = await api('/bootstrap');
      hydrate(boot);
      await startApp();
    } catch (err) {
      showErr(err.message);
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });
}

/* ============================ الهيكل ============================ */
function hydrate(data) {
  state.user = data.user || state.user;
  state.csrf = data.csrf || state.csrf;
  state.settings = data.settings || state.settings;
  state.categories = data.categories || [];
  state.shift = data.shift || null;
  state.alerts = data.alerts || {};
  state.version = data.version || '';
  if (data.branches) {
    state.branches = data.branches;
    state.defaultBranchId = Number(data.default_branch_id) || state.defaultBranchId;
    const allowed = allowedBranches().map((b) => Number(b.id));
    if (!allowed.length) allowed.push(state.defaultBranchId);
    let active = Number(data.active_branch_id) || state.branchId || state.defaultBranchId;
    if (!allowed.includes(active)) active = allowed.includes(state.defaultBranchId) ? state.defaultBranchId : allowed[0];
    if (active && Number(active) !== Number(state.branchId)) {
      state.branchId = Number(active);
      localStorage.setItem('baraka-branch', String(active));
    }
  }
  if (state.user?.branch_id && !state.branchId) {
    state.branchId = Number(state.user.branch_id);
    localStorage.setItem('baraka-branch', String(state.branchId));
  }
}

function allowedBranches() {
  const active = (state.branches || []).filter((b) => b.active);
  if (state.user?.role === 'admin' || can('branches.manage')) return active;
  if (state.user?.branch_id) return active.filter((b) => Number(b.id) === Number(state.user.branch_id));
  return active;
}

function branchSwitcherHtml() {
  const list = allowedBranches();
  if (list.length < 1) return '';
  const current = state.branchId || state.defaultBranchId;
  return `<label class="branch-switch" title="الفرع النشط">
    ${icon('building', 'icon-sm')}
    <select data-branch-switch aria-label="اختيار الفرع">
      ${list.map((b) => `<option value="${b.id}" ${Number(b.id) === Number(current) ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}
    </select>
    ${icon('chevron-down', 'icon-xs')}
  </label>`;
}

function shiftBlock(compact = false) {
  if (!state.shift) {
    return `<div class="side-shift closed">
      <div class="side-shift-top"><span>الوردية</span><span class="badge badge-warn">مغلقة</span></div>
      <div class="side-shift-name">لا توجد وردية مفتوحة${state.branchId ? ` — ${esc(branchName())}` : ''}</div>
      <a class="btn btn-sm btn-soft w-full mt-1" href="#/treasury?tab=shifts">${icon('clock')} فتح وردية</a>
    </div>`;
  }
  return `<div class="side-shift">
    <div class="side-shift-top"><span>الوردية الحالية</span><span class="shift-live"><i></i> مباشر</span></div>
    <div class="side-shift-name">${esc(state.shift.user_name)}</div>
    <div class="side-shift-time">${esc(state.shift.branch_name || branchName())} · بدء ${esc(fmt.time(state.shift.opened_at))} · نقدية ${fmt.money(state.shift.opening_cash, false)}</div>
  </div>`;
}

function sidebarHtml() {
  return `<aside class="sidebar">
    <button class="side-collapse" data-collapse title="طي القائمة">${icon('chevron-left')}</button>
    <a class="brand" href="#/dashboard">
      <div class="brand-logo"><svg viewBox="0 0 48 48" width="26" height="26"><path d="M24 5C15 5 8 12 8 21c0 11 10 19.5 16 23 6-3.5 16-12 16-23 0-9-7-16-16-16z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M24 13v19M16 22h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></div>
      <div class="brand-text"><div class="brand-name">${esc(state.settings.store_name || 'سوق البركة')}</div><div class="brand-tag">${esc(state.settings.store_tagline || 'نظام إدارة المتجر')}</div></div>
    </a>
    <div class="side-scroll">
      ${NAV.map((group) => {
        const items = group.items.filter((it) => can(ROUTES[it.key].perm));
        if (!items.length) return '';
        return `<div class="nav-section">${esc(group.label)}</div>
          ${items.map((it) => `<a class="nav-item" href="#/${it.key}" data-nav="${it.key}" title="${esc(it.label)}">
            ${icon(it.icon)}<span class="nav-label">${esc(it.label)}</span>
            ${it.key === 'inventory' && state.alerts.low_stock ? `<span class="nav-badge">${state.alerts.low_stock}</span>` : ''}
          </a>`).join('')}`;
      }).join('')}
      <div style="height:8px"></div>
    </div>
    ${shiftBlock()}
    <div class="side-user" data-user-menu>
      <div class="avatar">${esc(initials(state.user?.name))}</div>
      <div class="side-user-info">
        <div class="side-user-name">${esc(state.user?.name || '')}</div>
        <div class="side-user-role">${esc(roleName(state.user?.role))}</div>
      </div>
      ${icon('chevron-down')}
    </div>
  </aside>`;
}

function roleName(role) {
  return { admin: 'مدير النظام', manager: 'مدير فرع', cashier: 'كاشير', accountant: 'محاسب', stock: 'مسؤول مخازن' }[role] || role || '';
}

function mobileNavHtml() {
  const items = [
    { key: 'dashboard', icon: 'grid', label: 'الرئيسية' },
    { key: 'pos', icon: 'scan', label: 'الكاشير' },
    { key: 'sales', icon: 'receipt', label: 'المبيعات' },
    { key: 'products', icon: 'box', label: 'المنتجات' },
    { key: 'reports', icon: 'chart', label: 'التقارير' },
  ].filter((i) => can(ROUTES[i.key].perm));
  return `<nav class="mobile-nav">
    ${items.map((i) => `<a href="#/${i.key}" data-nav="${i.key}">${icon(i.icon)}<span>${i.label}</span></a>`).join('')}
    <a href="#/settings" data-mobile-more>${icon('menu')}<span>المزيد</span></a>
  </nav>`;
}

function shellHtml() {
  return `<div class="sidebar-backdrop" data-close-drawer></div>
    ${sidebarHtml()}
    <div class="main">
      <header class="topbar">
        <button class="icon-btn mobile-menu-btn" data-open-drawer aria-label="القائمة">${icon('menu')}</button>
        <div class="page-heading">
          <div class="page-title" id="page-title">لوحة التحكم</div>
          <div class="page-sub" id="page-sub"></div>
        </div>
        ${branchSwitcherHtml()}
        <button class="top-search" data-command>
          ${icon('search')}
          <span>بحث سريع في النظام…</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div class="top-actions">
          <a class="top-shift ${state.shift ? '' : 'closed'}" href="#/treasury?tab=shifts" title="حالة الوردية">
            ${state.shift ? '<i></i> وردية مفتوحة' : `${icon('clock', 'icon-sm')} وردية مغلقة`}
          </a>
          <div class="dropdown">
            <button class="icon-btn" data-notif-toggle aria-label="التنبيهات">
              ${icon('bell')}${alertsCount() ? '<span class="dot"></span>' : ''}
            </button>
            <div class="dropdown-menu notif-panel hide" data-notif-menu></div>
          </div>
          <button class="icon-btn theme-btn" data-theme-toggle aria-label="تبديل المظهر" data-theme-icon>${icon('moon')}</button>
          <div class="dropdown">
            <button class="avatar-btn" data-user-toggle>
              <div class="avatar">${esc(initials(state.user?.name))}</div>
              <div class="avatar-meta"><b>${esc(state.user?.name || '')}</b><span>${esc(roleName(state.user?.role))}</span></div>
              ${icon('chevron-down', 'icon-sm')}
            </button>
            <div class="dropdown-menu hide" data-user-dropdown>
              <div class="dropdown-head"><b>${esc(state.user?.name || '')}</b><span>@${esc(state.user?.username || '')}</span></div>
              <button class="dropdown-item" data-profile>${icon('user-cog')} الملف الشخصي</button>
              ${can('settings.manage') ? `<a class="dropdown-item" href="#/settings">${icon('sliders')} الإعدادات</a>` : ''}
              ${can('backup.manage') ? `<a class="dropdown-item" href="#/backup">${icon('database')} النسخ الاحتياطي</a>` : ''}
              <div class="dropdown-sep"></div>
              <button class="dropdown-item danger" data-logout>${icon('logout')} تسجيل الخروج</button>
            </div>
          </div>
        </div>
      </header>
      <main class="view" id="view"></main>
    </div>
    ${mobileNavHtml()}`;
}

function alertsCount() {
  return (state.alerts.low_stock || 0) + (state.alerts.out_stock || 0);
}

function refreshShellTop() {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === state.route);
  });
  const route = ROUTES[state.route];
  if (route) {
    const t = document.getElementById('page-title');
    const s = document.getElementById('page-sub');
    if (t) t.textContent = route.title;
    if (s) s.textContent = route.sub;
  }
  const brandName = document.querySelector('.brand-name');
  const brandTag = document.querySelector('.brand-tag');
  if (brandName) brandName.textContent = state.settings.store_name || 'سوق البركة';
  if (brandTag) brandTag.textContent = state.settings.store_tagline || 'نظام إدارة المتجر';
  document.title = `${route?.title || 'سوق البركة'} — ${state.settings.store_name || 'سوق البركة'}`;
}

async function startApp() {
  cleanup?.(); cleanup = null;
  app.className = 'app';
  if (localStorage.getItem('baraka-sidebar') === 'collapsed') app.classList.add('sidebar-collapsed');
  app.innerHTML = shellHtml();
  theme.apply();
  bindShell();
  if (!location.hash) location.hash = '#/dashboard';
  window.removeEventListener('hashchange', handleRoute);
  window.addEventListener('hashchange', handleRoute);
  await handleRoute();
}

/* ============================ ربط الهيكل ============================ */
function bindShell() {
  const closeAllDropdowns = () => {
    $$('[data-notif-menu], [data-user-dropdown]').forEach((m) => m.classList.add('hide'));
  };

  $('[data-open-drawer]')?.addEventListener('click', () => app.classList.add('drawer-open'));
  $('[data-close-drawer]')?.addEventListener('click', () => app.classList.remove('drawer-open'));
  $('[data-collapse]')?.addEventListener('click', () => {
    app.classList.toggle('sidebar-collapsed');
    localStorage.setItem('baraka-sidebar', app.classList.contains('sidebar-collapsed') ? 'collapsed' : 'open');
  });
  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => theme.toggle()));
  window.addEventListener('baraka:settings', refreshShellTop);
  $('[data-branch-switch]')?.addEventListener('change', async (e) => {
    const id = Number(e.target.value);
    if (!id || id === Number(state.branchId)) return;
    setBranch(id);
    try {
      const boot = await api('/bootstrap');
      hydrate(boot);
      refreshShellTop();
      await handleRoute();
      toast(`تم التبديل إلى ${branchName(id)}`);
    } catch (err) {
      toast(err.message, 'danger');
    }
  });

  $('[data-command]')?.addEventListener('click', openCommandPalette);

  $('[data-notif-toggle]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = $('[data-notif-menu]');
    const isHidden = menu.classList.contains('hide');
    closeAllDropdowns();
    if (isHidden) {
      menu.innerHTML = notifPanelHtml();
      menu.classList.remove('hide');
      bindNotif(menu);
    }
  });
  $('[data-user-toggle]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = $('[data-user-dropdown]');
    const isHidden = menu.classList.contains('hide');
    closeAllDropdowns();
    if (isHidden) menu.classList.remove('hide');
  });
  $('[data-user-menu]')?.addEventListener('click', () => openProfile());
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) closeAllDropdowns();
    if (!e.target.closest('.sidebar') && !e.target.closest('[data-open-drawer]')) app.classList.remove('drawer-open');
  });
  $$('[data-logout]').forEach((b) => b.addEventListener('click', logout));
  $$('[data-profile]').forEach((b) => b.addEventListener('click', openProfile));
  $('[data-mobile-more]')?.addEventListener('click', (e) => { e.preventDefault(); app.classList.add('drawer-open'); });
  $$('.mobile-nav a[data-nav]').forEach((a) => a.addEventListener('click', () => app.classList.remove('drawer-open')));
  $$('.nav-item').forEach((a) => a.addEventListener('click', () => app.classList.remove('drawer-open')));

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommandPalette(); }
  });
}

function bindNotif(root) {
  root.querySelectorAll('[data-close-notif]').forEach((b) => b.addEventListener('click', () => root.classList.add('hide')));
}

function notifPanelHtml() {
  const rows = [];
  if (state.alerts.low_stock) rows.push(`<a class="notif-item" href="#/inventory?filter=low">${icon('alert')}<div><b>${state.alerts.low_stock} منتجًا بمخزون منخفض</b><span>راجع الأصناف التي أوشكت على النفاد</span></div></a>`);
  if (state.alerts.out_stock) rows.push(`<a class="notif-item" href="#/inventory?filter=out" style="color:var(--danger)">${icon('x-circle')}<div><b>${state.alerts.out_stock} منتجًا نفد من المخزون</b><span>أضف الكميات لتجنب توقف البيع</span></div></a>`);
  if (state.alerts.debts) rows.push(`<a class="notif-item" href="#/contacts?tab=customers">${icon('wallet')}<div><b>مديونيات العملاء ${fmt.money(state.alerts.debts)}</b><span>تابع التحصيلات المستحقة</span></div></a>`);
  if (!state.shift) rows.push(`<a class="notif-item" href="#/treasury?tab=shifts">${icon('clock')}<div><b>لا توجد وردية مفتوحة</b><span>افتح وردية لبدء تسجيل المبيعات</span></div></a>`);
  if (!rows.length) rows.push(`<div class="notif-item">${icon('check-circle')}<div><b>كل شيء على ما يرام</b><span>لا توجد تنبيهات حالية</span></div></div>`);
  return `<div class="notif-head"><b>التنبيهات</b><span class="badge badge-muted">${rows.length}</span></div>
    <div class="notif-list">${rows.join('')}</div>
    <div class="notif-foot"><a class="btn btn-sm btn-ghost w-full" href="#/inventory" data-close-notif>عرض المخزون</a></div>`;
}

function openProfile() {
  const u = state.user;
  modal({
    title: 'الملف الشخصي',
    subtitle: 'بيانات حسابك وكلمة المرور',
    size: 'sm',
    body: `<div class="row" style="gap:14px;padding-bottom:16px;border-bottom:1px solid var(--border)">
        <div class="avatar lg" style="width:56px;height:56px;border-radius:18px;font-size:19px">${esc(initials(u.name))}</div>
        <div><div class="bolder" style="font-size:15px">${esc(u.name)}</div>
        <div class="small muted">@${esc(u.username)} · ${esc(roleName(u.role))}</div></div>
      </div>
      <div class="mt-3" style="display:flex;flex-direction:column;gap:10px">
        <div class="setting-row"><div><b>الدور الوظيفي</b><span>تحدد الصلاحيات المتاحة لحسابك</span></div><span class="badge badge-success">${esc(roleName(u.role))}</span></div>
        <div class="setting-row"><div><b>الفرع</b><span>الفرع النشط الحالي</span></div><span class="badge badge-muted">${esc(branchName() || 'كل الفروع')}</span></div>
        <div class="setting-row"><div><b>آخر تسجيل دخول</b><span>${esc(fmt.datetime(u.last_login))}</span></div></div>
        <div class="setting-row"><div><b>الصلاحيات</b><span>${u.role === 'admin' ? 'وصول كامل لكل النظام' : `${(u.permissions || []).length} صلاحية مفعّلة`}</span></div></div>
      </div>`,
    footer: `<button class="btn btn-secondary" data-close>إغلاق</button>
      <button class="btn btn-primary" data-change-pw>${icon('key')} تغيير كلمة المرور</button>`,
    onMount: (m) => {
      m.root.querySelector('[data-change-pw]').addEventListener('click', () => {
        m.close();
        changePassword();
      });
    },
  });
}

function changePassword() {
  openForm({
    title: 'تغيير كلمة المرور',
    subtitle: 'سيتم تسجيل الخروج من الأجهزة الأخرى بعد التغيير',
    size: 'sm',
    submitText: 'تحديث كلمة المرور',
    fields: [
      { name: 'current', label: 'كلمة المرور الحالية', type: 'password', required: true, span: 2, autofocus: true },
      { name: 'next', label: 'كلمة المرور الجديدة', type: 'password', required: true, span: 2, minlength: 6, hint: '6 أحرف على الأقل' },
      { name: 'confirm', label: 'تأكيد كلمة المرور', type: 'password', required: true, span: 2 },
    ],
    onSubmit: async (v, m) => {
      if (v.next !== v.confirm) throw new Error('كلمتا المرور غير متطابقتين');
      await api('/auth/password', { method: 'POST', body: { current: v.current, next: v.next } });
      m.close();
      toast('تم تحديث كلمة المرور بنجاح');
    },
  });
}

async function logout() {
  const yes = await confirmDialog({ title: 'تسجيل الخروج', message: 'هل تريد الخروج من حسابك الآن؟', confirmText: 'خروج', danger: false, iconName: 'logout' });
  if (!yes) return;
  try { await api('/auth/logout', { method: 'POST', body: {} }); } catch {}
  window.removeEventListener('hashchange', handleRoute);
  showLogin('تم تسجيل الخروج بنجاح');
}

/* ============================ لوحة الأوامر ============================ */
function openCommandPalette() {
  const commands = [];
  for (const g of NAV) for (const it of g.items) {
    if (can(ROUTES[it.key].perm)) commands.push({ label: it.label, hint: g.label, icon: it.icon, href: `#/${it.key}` });
  }
  if (can('pos.use')) commands.push({ label: 'فاتورة بيع جديدة', hint: 'إجراء سريع', icon: 'plus', href: '#/pos' });
  if (can('products.manage')) commands.push({ label: 'إضافة منتج جديد', hint: 'إجراء سريع', icon: 'box', href: '#/products?new=1' });
  if (can('purchases.manage')) commands.push({ label: 'تسجيل فاتورة مشتريات', hint: 'إجراء سريع', icon: 'truck', href: '#/purchases?new=1' });
  if (can('backup.manage')) commands.push({ label: 'إنشاء نسخة احتياطية الآن', hint: 'حماية البيانات', icon: 'database', href: '#/backup?create=1' });
  if (can('reports.view')) commands.push({ label: 'تقرير المبيعات الشهري', hint: 'تحليلات', icon: 'chart', href: '#/reports' });

  const m = modal({
    size: 'sm',
    showClose: false,
    body: `<div class="input-icon" style="margin-bottom:10px">${icon('search')}
        <input class="input" id="cmd-input" placeholder="ابحث عن صفحة أو إجراء…" autofocus style="height:46px;font-size:14px" />
      </div>
      <div id="cmd-list" style="max-height:320px;overflow:auto;display:flex;flex-direction:column;gap:2px"></div>
      <div class="hint-badge mt-2" style="justify-content:flex-end">${icon('command')} Esc للإغلاق</div>`,
  });
  const input = m.root.querySelector('#cmd-input');
  const list = m.root.querySelector('#cmd-list');
  let filtered = commands;
  let active = 0;
  const render = () => {
    list.innerHTML = filtered.map((c, i) => `<a href="${c.href}" class="dropdown-item ${i === active ? 'active' : ''}" data-cmd="${i}"
      style="${i === active ? 'background:var(--brand-soft);color:var(--brand-strong)' : ''}">
      ${icon(c.icon)}<span style="flex:1">${esc(c.label)}</span><span class="tiny muted">${esc(c.hint)}</span></a>`).join('')
      || '<div class="empty" style="padding:26px"><div class="empty-text">لا توجد نتائج مطابقة</div></div>';
    list.querySelectorAll('[data-cmd]').forEach((a) => a.addEventListener('click', () => m.close()));
  };
  const filter = () => {
    const q = input.value.trim().toLowerCase();
    filtered = commands.filter((c) => (c.label + ' ' + c.hint).toLowerCase().includes(q));
    active = 0;
    render();
  };
  input.addEventListener('input', filter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(filtered.length - 1, active + 1); render(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); render(); }
    if (e.key === 'Enter' && filtered[active]) { e.preventDefault(); location.hash = filtered[active].href; m.close(); }
  });
  render();
}

/* ============================ التوجيه ============================ */
function parseHash() {
  const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
  const [name, query] = raw.split('?');
  return { name: ROUTES[name] ? name : 'dashboard', params: new URLSearchParams(query || '') };
}

async function handleRoute() {
  const { name, params } = parseHash();
  const route = ROUTES[name];
  state.route = name;
  refreshShellTop();
  const view = document.getElementById('view');
  if (!view) return;

  if (!can(route.perm)) {
    view.className = 'view';
    view.innerHTML = `<div class="card" style="max-width:560px;margin:40px auto">${`
      <div class="empty"><div class="empty-ico">${icon('shield')}</div>
      <div class="empty-title">لا تملك صلاحية الوصول</div>
      <div class="empty-text">هذه الصفحة تتطلب صلاحية «${esc(route.title)}». تواصل مع مدير النظام لمنحك الوصول.</div>
      <a class="btn btn-secondary mt-2" href="#/dashboard">العودة للرئيسية</a></div>`}</div>`;
    return;
  }

  app.classList.remove('drawer-open');
  if (typeof cleanup === 'function') { try { cleanup(); } catch {} }
  cleanup = null;
  view.className = 'view' + (route.pos ? ' pos-view' : '');
  view.innerHTML = `<div class="skeleton" style="height:120px;border-radius:18px;margin-bottom:16px"></div>
    <div class="skeleton" style="height:320px;border-radius:18px"></div>`;
  view.insertAdjacentHTML('beforebegin', '<div class="loader-line" id="route-loader"></div>');
  try {
    cleanup = await route.view.render(view, { params, route: name });
    if (params.get('tab')) { /* handled inside views */ }
  } catch (err) {
    if (String(err.message || '').includes('الجلسة')) return;
    view.innerHTML = `<div class="card" style="max-width:560px;margin:30px auto"><div class="empty">
      <div class="empty-ico">${icon('alert')}</div>
      <div class="empty-title">تعذر تحميل الصفحة</div>
      <div class="empty-text">${esc(err.message || 'خطأ غير متوقع')}</div>
      <button class="btn btn-primary mt-2" onclick="location.reload()">${icon('refresh')} إعادة المحاولة</button>
    </div></div>`;
  } finally {
    document.getElementById('route-loader')?.remove();
  }
  window.scrollTo({ top: 0 });
  view.classList.remove('app-loading');
}

/* ============================ الإقلاع ============================ */
window.addEventListener('baraka:unauthorized', () => {
  if (!state.user) return;
  showLogin('انتهت جلستك — يرجى تسجيل الدخول مجددًا');
});

async function boot() {
  theme.apply();
  try {
    const data = await api('/bootstrap');
    hydrate(data);
    await startApp();
  } catch (err) {
    if (!state.user) showLogin();
    else {
      app.className = '';
      app.innerHTML = `<div style="min-height:100vh;display:grid;place-items:center;padding:24px">
        <div class="card" style="max-width:480px;text-align:center">
          <div class="empty-ico" style="margin:0 auto 12px">${icon('alert')}</div>
          <div class="empty-title">تعذر الاتصال بالنظام</div>
          <div class="empty-text" style="margin:6px auto">${esc(err.message)}</div>
          <button class="btn btn-primary mt-3" onclick="location.reload()">${icon('refresh')} إعادة المحاولة</button>
        </div></div>`;
    }
  }
}

boot();
