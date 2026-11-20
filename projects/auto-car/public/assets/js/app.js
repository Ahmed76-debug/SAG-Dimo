/* ============================================================
   Auto Car — التطبيق: الهيكل، الدخول، التنقّل، الموجّه
   ============================================================ */
import { state, t, esc, icon, el, api, toast, applyTheme, applyLang, toggleTheme, toggleLang, can, initials, pick, isDark, loadBranding, brandLogo, loginCar } from './core.js';
import { modal, dropdown, confirmDialog, formHtml, readForm, openThemeGallery } from './ui.js';

/* ============================================================
   خريطة التنقّل (قوائم مجمّعة — قائمة رئيسية غير مزدحمة)
   ============================================================ */
const NAV = [
  { key: 'dashboard', label: 'nav_dashboard', icon: 'gauge', direct: 'dashboard' },
  {
    key: 'showroom', label: 'nav_showroom', icon: 'car', desc: 'grp_showroom_d', items: [
      { key: 'vehicles', label: 'vehicles', desc: 'vehicles_d', icon: 'car', view: 'vehicles', color: '#2563eb' },
      { key: 'consignment', label: 'consignment', desc: 'consignment_d', icon: 'handshake', view: 'consignment', color: '#8b5cf6' },
      { key: 'brands', label: 'brands', desc: 'brands_d', icon: 'star', view: 'catalog', color: '#f59e0b' },
      { key: 'car-models', label: 'car_models', desc: 'car_models_d', icon: 'layers', view: 'catalog', color: '#0ea5e9' },
      { key: 'car-types', label: 'car_types', desc: 'car_types_d', icon: 'tag', view: 'catalog', color: '#10b981' },
      { key: 'colors', label: 'colors', desc: 'colors_d', icon: 'palette', view: 'catalog', color: '#ec4899' },
    ],
  },
  {
    key: 'sales', label: 'nav_sales', icon: 'receipt', desc: 'grp_sales_d', items: [
      { key: 'sale-new', label: 'new_sale', desc: 'new_sale_d', icon: 'cart', view: 'sale-new', color: '#10b981', perm: 'sales.manage' },
      { key: 'sales', label: 'sales_invoices', desc: 'sales_invoices_d', icon: 'receipt', view: 'sales', color: '#2563eb' },
      { key: 'installment-plans', label: 'installment_plans', desc: 'installment_plans_d', icon: 'calendar', view: 'installment-plans', color: '#8b5cf6' },
      { key: 'installments', label: 'installments_due', desc: 'installments_due_d', icon: 'clock', view: 'installments', color: '#f59e0b' },
    ],
  },
  {
    key: 'purchases', label: 'nav_purchases', icon: 'cart', desc: 'grp_purchases_d', items: [
      { key: 'purchase-new', label: 'new_purchase', desc: 'new_purchase_d', icon: 'plus', view: 'purchase-new', color: '#0ea5e9', perm: 'purchases.manage' },
      { key: 'purchases', label: 'purchases_list', desc: 'purchases_list_d', icon: 'receipt', view: 'purchases', color: '#2563eb' },
    ],
  },
  {
    key: 'partners', label: 'nav_partners', icon: 'users', desc: 'grp_partners_d', items: [
      { key: 'customers', label: 'customers', desc: 'customers_d', icon: 'user', view: 'partners', color: '#2563eb' },
      { key: 'suppliers', label: 'suppliers', desc: 'suppliers_d', icon: 'truck', view: 'partners', color: '#0ea5e9' },
    ],
  },
  {
    key: 'finance', label: 'nav_finance', icon: 'ledger', desc: 'grp_finance_d', items: [
      { key: 'accounts', label: 'chart_of_accounts', desc: 'chart_of_accounts_d', icon: 'layers', view: 'accounts', color: '#2563eb' },
      { key: 'journal', label: 'journal', desc: 'journal_d', icon: 'ledger', view: 'journal', color: '#8b5cf6' },
      { key: 'treasuries', label: 'treasuries', desc: 'treasuries_d', icon: 'wallet', view: 'treasuries', color: '#10b981' },
      { key: 'vouchers', label: 'vouchers', desc: 'vouchers_d', icon: 'receipt', view: 'vouchers', color: '#f59e0b' },
      { key: 'fiscal-years', label: 'fiscal_years', desc: 'fiscal_years_d', icon: 'calendar', view: 'fiscal-years', color: '#0ea5e9' },
    ],
  },
  {
    key: 'reports', label: 'nav_reports', icon: 'chart', desc: 'grp_reports_d', items: [
      { key: 'trial-balance', label: 'trial_balance', desc: 'trial_balance_d', icon: 'scale', view: 'reports', color: '#2563eb' },
      { key: 'income-statement', label: 'income_statement', desc: 'income_statement_d', icon: 'trend', view: 'reports', color: '#10b981' },
      { key: 'balance-sheet', label: 'balance_sheet', desc: 'balance_sheet_d', icon: 'building', view: 'reports', color: '#8b5cf6' },
      { key: 'equity', label: 'equity_statement', desc: 'equity_statement_d', icon: 'shield', view: 'reports', color: '#0ea5e9' },
      { key: 'ledger', label: 'general_ledger', desc: 'general_ledger_d', icon: 'ledger', view: 'reports', color: '#f59e0b' },
      { key: 'report-sales', label: 'report_sales', desc: 'report_sales_d', icon: 'cart', view: 'reports', color: '#ec4899' },
      { key: 'report-purchases', label: 'report_purchases', desc: 'report_purchases_d', icon: 'truck', view: 'reports', color: '#0ea5e9' },
      { key: 'report-inventory', label: 'report_inventory', desc: 'report_inventory_d', icon: 'car', view: 'reports', color: '#2563eb' },
      { key: 'report-receivables', label: 'report_receivables', desc: 'report_receivables_d', icon: 'trend', view: 'reports', color: '#10b981' },
      { key: 'report-payables', label: 'report_payables', desc: 'report_payables_d', icon: 'trend', view: 'reports', color: '#ef4444' },
      { key: 'report-installments', label: 'report_installments', desc: 'report_installments_d', icon: 'calendar', view: 'reports', color: '#f59e0b' },
      { key: 'report-profit', label: 'report_profit', desc: 'report_profit_d', icon: 'pie', view: 'reports', color: '#8b5cf6' },
    ],
  },
  {
    key: 'admin', label: 'nav_admin', icon: 'settings', desc: 'grp_admin_d', items: [
      { key: 'users', label: 'users', desc: 'users_d', icon: 'shield', view: 'users', color: '#2563eb', perm: 'users.manage' },
      { key: 'settings', label: 'settings', desc: 'settings_d', icon: 'settings', view: 'settings', color: '#0ea5e9', perm: 'settings.manage' },
      { key: 'currencies', label: 'currencies', desc: 'currencies_d', icon: 'cash', view: 'currencies', color: '#10b981' },
      { key: 'backup', label: 'backup', desc: 'backup_d', icon: 'database', view: 'backup', color: '#8b5cf6', perm: 'backup.manage' },
      { key: 'importexport', label: 'importexport', desc: 'importexport_d', icon: 'sheet', view: 'importexport', color: '#f59e0b', perm: 'import.manage' },
      { key: 'trash', label: 'trash', desc: 'trash_d', icon: 'trash', view: 'trash', color: '#ef4444', perm: 'trash.manage' },
      { key: 'activity', label: 'activity', desc: 'activity_d', icon: 'clock', view: 'activity', color: '#64748b', perm: 'activity.view' },
      { key: 'truncate', label: 'truncate', desc: 'truncate_d', icon: 'database', view: 'truncate', color: '#dc2626', perm: 'truncate.manage' },
      { key: 'tutorials', label: 'tutorials', desc: 'tutorials_desc', icon: 'play', view: 'tutorials', color: '#0ea5e9' },
    ],
  },
];

function findItem(key) {
  for (const g of NAV) {
    if (g.direct === key) return { item: { key: g.key, label: g.label, icon: g.icon, view: g.direct, color: '#2563eb' }, group: g };
    if (g.items) { const it = g.items.find((i) => i.key === key); if (it) return { item: it, group: g }; }
  }
  return null;
}

/* ============================================================
   الدخول
   ============================================================ */
function renderLogin(app) {
  app.classList.remove('app-loading');
  const logo = brandLogo();
  const car = loginCar();
  const b = state.branding || {};
  const brandName = (state.lang === 'en' ? (b.company_name_en || b.company_name) : (b.company_name || b.company_name_en)) || t('app_name');
  const logoMark = logo
    ? `<span class="logo-badge has-img"><img class="login-logo-img" src="${esc(logo)}" alt="${esc(brandName)}"></span>`
    : `<span class="logo-badge">${icon('car', 'lg')}</span>`;
  const carLayer = car
    ? `<div class="login-car-photo" aria-hidden="true"><img src="${esc(car)}" alt=""></div>`
    : `<div class="login-cars" aria-hidden="true"></div>`;
  app.innerHTML = `
  <div class="login-wrap">
    <div class="login-side">
      <div class="showroom" aria-hidden="true"></div>
      ${carLayer}
      <div class="showroom-fade" aria-hidden="true"></div>
      <div class="sweep" aria-hidden="true"></div>
      <div class="login-brand">${logoMark} <span>${esc(brandName)}</span></div>
      <div class="login-hero">
        <h1>${esc(t('login_hero'))}</h1>
        <p>${esc(t('login_hero_p'))}</p>
        <div class="login-feats"><span>${icon('car', 'sm')} ${esc(t('feat1'))}</span><span>${icon('cash', 'sm')} ${esc(t('feat2'))}</span><span>${icon('ledger', 'sm')} ${esc(t('feat3'))}</span><span>${icon('chart', 'sm')} ${esc(t('feat4'))}</span></div>
      </div>
      <div class="login-copy" style="font-size:13px;color:#9fb4d6">© ${new Date().getFullYear()} ${esc(t('app_name'))}</div>
    </div>
    <div class="login-form-side">
      <form class="login-card" id="login-form">
        <div class="login-emblem">${icon('car')}</div>
        <div class="row between">
          <h2>${esc(t('login_title'))}</h2>
          <button type="button" class="chip-btn" id="lg-lang">${icon('globe', 'sm')} ${state.lang === 'ar' ? 'EN' : 'ع'}</button>
        </div>
        <div class="sub">${esc(t('login_sub'))}</div>
        <div class="field"><label>${esc(t('username'))}</label><div class="input-icon">${icon('user')}<input class="input" name="username" autocomplete="username" required></div></div>
        <div class="field"><label>${esc(t('password'))}</label><div class="input-icon pw-wrap">${icon('key')}<input class="input" type="password" name="password" autocomplete="current-password" required><button type="button" class="pw-toggle" data-pw-toggle title="${esc(t('show_password'))}">${icon('eye')}</button></div></div>
        <button class="btn btn-primary btn-block" type="submit">${icon('logout', 'sm')} ${esc(t('login_btn'))}</button>
        <div class="login-hint">${esc(t('demo_hint'))}</div>
      </form>
    </div>
  </div>`;
  app.querySelector('#lg-lang').onclick = () => { toggleLang(); renderLogin(app); };
  const pwInput = app.querySelector('[name=password]');
  const pwBtn = app.querySelector('[data-pw-toggle]');
  if (pwBtn && pwInput) pwBtn.onclick = () => {
    const show = pwInput.type === 'password';
    pwInput.type = show ? 'text' : 'password';
    pwBtn.innerHTML = show ? icon('eye-off') : icon('eye');
    pwBtn.setAttribute('title', show ? t('hide_password') : t('show_password'));
  };
  app.querySelector('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const fd = new FormData(e.target);
    btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>`;
    try {
      const r = await api('/auth/login', { method: 'POST', body: { username: fd.get('username'), password: fd.get('password') } });
      state.user = r.user; state.csrf = r.csrf; state.settings = r.settings || {};
      await boot();
    } catch (err) { toast(err.message || t('login_error'), 'error'); btn.disabled = false; btn.innerHTML = `${icon('logout', 'sm')} ${t('login_btn')}`; }
  };
}

/* ============================================================
   الهيكل
   ============================================================ */
function navHtml() {
  const cur = currentRoute();
  const curGroup = findItem(cur.key)?.group?.key;
  return NAV.map((g) => {
    if (g.direct) {
      const active = cur.key === g.key;
      return `<div class="nav-item ${active ? 'active' : ''}" data-go="${g.key}">${icon(g.icon)}<span>${esc(t(g.label))}</span></div>`;
    }
    const visible = g.items.filter((i) => can(i.perm));
    if (!visible.length) return '';
    const active = curGroup === g.key;
    return `<div class="nav-item ${active ? 'active' : ''}" data-group="${g.key}">${icon(g.icon)}<span>${esc(t(g.label))}</span><span class="nav-count">${visible.length}</span></div>`;
  }).join('');
}

function shellHtml() {
  const u = state.user;
  return `
  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <span class="logo-badge${brandLogo() ? ' has-img' : ''}">${brandLogo() ? `<img class="login-logo-img" src="${esc(brandLogo())}" alt="">` : icon('car')}</span>
        <div><b>${esc(t('app_short'))}</b><small>${esc(t('tagline'))}</small></div>
      </div>
      <nav class="sidebar-nav" id="side-nav">${navHtml()}</nav>
      <div class="sidebar-footer">
        <button class="sidebar-logout" id="btn-logout" title="${esc(t('logout'))}">${icon('logout')} <span>${esc(t('logout'))}</span></button>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="side-backdrop"></div>
    <div class="main">
      <header class="topbar">
        <button class="chip-btn sidebar-toggle" id="side-toggle">${icon('menu')}</button>
        <div class="page-title" id="page-title">${esc(t('nav_dashboard'))}</div>
        <div class="topbar-spacer"></div>
        <div class="top-actions">
          <button class="chip-btn" id="btn-theme" title="${t('theme_gallery')}">${icon('palette', 'sm')}</button>
          <button class="chip-btn" id="btn-lang" title="${t('language')}">${icon('globe', 'sm')} <span>${state.lang === 'ar' ? 'EN' : 'ع'}</span></button>
          <div class="pop-wrap"><button class="chip-btn notif-dot" id="btn-notif">${icon('bell', 'sm')}<span class="dot hidden" id="notif-count">0</span></button></div>
          <div class="pop-wrap"><div class="user-chip" id="btn-user"><span class="avatar">${esc(initials(u.name))}</span><div><div class="u-name">${esc(u.name)}</div><div class="u-role">${esc(t('role_' + u.role, u.role))}</div></div></div></div>
        </div>
      </header>
      <main class="content" id="view"></main>
    </div>
  </div>`;
}

function bindShell(app) {
  app.querySelectorAll('[data-go]').forEach((n) => n.onclick = () => { location.hash = `#/v/${n.dataset.go}`; closeSidebar(); });
  app.querySelectorAll('[data-group]').forEach((n) => n.onclick = () => { location.hash = `#/g/${n.dataset.group}`; closeSidebar(); });
  app.querySelector('#btn-theme').onclick = () => openThemeGallery();
  app.querySelector('#btn-lang').onclick = () => { toggleLang(); renderShell(); };
  const lo = app.querySelector('#btn-logout'); if (lo) lo.onclick = doLogout;
  app.querySelector('#btn-user').onclick = () => dropdown(app.querySelector('#btn-user'), [
    { label: t('profile'), icon: 'user', onClick: openProfile },
    { label: t('change_password'), icon: 'key', onClick: openChangePassword },
    { sep: true },
    { label: t('theme_gallery'), icon: 'palette', onClick: openThemeGallery },
    { label: (isDark() ? t('light') : t('dark')), icon: isDark() ? 'sun' : 'moon', onClick: () => { toggleTheme(); renderShell(); } },
    { label: t('language') + ': ' + (state.lang === 'ar' ? 'English' : 'العربية'), icon: 'globe', onClick: () => { toggleLang(); renderShell(); } },
    { sep: true },
    { label: t('logout'), icon: 'logout', danger: true, onClick: doLogout },
  ]);
  app.querySelector('#btn-notif').onclick = openNotifications;
  app.querySelector('#side-toggle').onclick = () => { app.querySelector('#sidebar').classList.toggle('open'); app.querySelector('#side-backdrop').classList.toggle('show'); };
  app.querySelector('#side-backdrop').onclick = closeSidebar;
}
function closeSidebar() {
  const sb = document.getElementById('sidebar'), bd = document.getElementById('side-backdrop');
  if (sb) sb.classList.remove('open'); if (bd) bd.classList.remove('show');
}

function renderShell() {
  const app = document.getElementById('app');
  app.classList.remove('app-loading');
  app.innerHTML = shellHtml();
  bindShell(app);
  refreshNotifCount();
  route();
}

/* ============================================================
   الموجّه
   ============================================================ */
function currentRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'g' && parts[1]) return { kind: 'group', key: parts[1] };
  if (parts[0] === 'v' && parts[1]) return { kind: 'view', key: parts[1] };
  return { kind: 'view', key: 'dashboard' };
}

async function route() {
  const r = currentRoute();
  const view = document.getElementById('view');
  if (!view) return;
  document.getElementById('side-nav').innerHTML = navHtml();
  document.querySelectorAll('#side-nav [data-go]').forEach((n) => n.onclick = () => { location.hash = `#/v/${n.dataset.go}`; closeSidebar(); });
  document.querySelectorAll('#side-nav [data-group]').forEach((n) => n.onclick = () => { location.hash = `#/g/${n.dataset.group}`; closeSidebar(); });

  if (r.kind === 'group') {
    const g = NAV.find((x) => x.key === r.key);
    if (!g) { location.hash = '#/v/dashboard'; return; }
    setTitle(t(g.label), t(g.desc || ''));
    renderGroup(view, g);
    return;
  }
  const found = findItem(r.key);
  if (!found) { location.hash = '#/v/dashboard'; return; }
  const { item } = found;
  if (!can(item.perm)) { view.innerHTML = `<div class="empty">${icon('shield', 'lg')}<h4>${t('no_permission')}</h4></div>`; return; }
  setTitle(t(item.label), t(item.desc || ''));
  view.innerHTML = `<div class="empty"><div class="spinner" style="border-color:var(--border);border-top-color:var(--brand)"></div></div>`;
  try {
    const mod = await import(`./views/${item.view}.js`);
    await mod.render(view, item);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="empty">${icon('alert', 'lg')}<h4>${esc(e.message)}</h4><p>${esc(item.view)}</p></div>`;
  }
}

function setTitle(title, sub = '') {
  const el = document.getElementById('page-title');
  if (el) el.innerHTML = `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
}

function renderGroup(view, g) {
  const items = g.items ? g.items.filter((i) => can(i.perm)) : [];
  view.innerHTML = `
    <div class="group-hero">
      <h2>${icon(g.icon, 'lg')} ${esc(t(g.label))}</h2>
      <p>${esc(t(g.desc || ''))}</p>
    </div>
    <div class="tile-grid stagger">
      ${items.map((it) => `
        <div class="tile" data-open="${it.key}" style="--tile-color:${it.color || 'var(--brand)'}">
          <div class="tile-arrow">${icon('arrow-left')}</div>
          <div class="tile-icon">${icon(it.icon)}</div>
          <h3>${esc(t(it.label))}</h3>
          <p>${esc(t(it.desc || ''))}</p>
        </div>`).join('')}
    </div>`;
  view.querySelectorAll('[data-open]').forEach((n) => n.onclick = () => { location.hash = `#/v/${n.dataset.open}`; });
}

/* ============================================================
   التنبيهات (شريط علوي)
   ============================================================ */
async function refreshNotifCount() {
  try {
    const r = await api('/notifications/count');
    const dot = document.getElementById('notif-count');
    if (dot) { dot.textContent = r.unread; dot.classList.toggle('hidden', !r.unread); }
  } catch {}
}
async function openNotifications() {
  const btn = document.getElementById('btn-notif');
  const r = await api('/notifications');
  const items = r.items || [];
  const menu = dropdown(btn, []);
  const wrap = btn.closest('.pop-wrap');
  if (menu) menu.remove();
  wrap.querySelectorAll('.dropdown').forEach((n) => n.remove());
  const box = el(`<div class="dropdown" style="min-width:340px;max-height:420px;overflow:auto;padding:10px">
    <div class="row between" style="padding:4px 6px 10px"><b>${esc(t('notifications'))}</b><button class="btn btn-ghost btn-sm" data-gen>${icon('refresh', 'sm')} ${t('generate_alerts')}</button></div>
    ${items.length ? items.slice(0, 30).map((n) => `
      <div class="dropdown-item" data-notif="${n.id}" style="align-items:flex-start;flex-direction:column;gap:3px">
        <div class="row between" style="width:100%"><b style="font-size:13.5px">${esc(n.title)}</b>${n.status === 'unread' ? '<span class="dot-status" style="background:var(--danger)"></span>' : ''}</div>
        <div class="small muted">${esc(n.body || '')}</div>
      </div>`).join('') : `<div class="empty" style="padding:26px">${icon('bell', 'lg')}<h4>${t('no_notifications')}</h4></div>`}
    <div class="dropdown-sep"></div>
    <div class="dropdown-item" data-all>${icon('check', 'sm')} ${t('read_all')}</div>
    <div class="dropdown-item" data-goto>${icon('bell', 'sm')} ${t('notifications')}</div>
  </div>`);
  wrap.appendChild(box);
  const off = (e) => { if (!wrap.contains(e.target)) { box.remove(); document.removeEventListener('mousedown', off); } };
  setTimeout(() => document.addEventListener('mousedown', off), 10);
  box.querySelector('[data-gen]').onclick = async () => { try { const g = await api('/notifications/generate', { method: 'POST' }); toast(g.message); box.remove(); refreshNotifCount(); } catch (e) { toast(e.message, 'error'); } };
  box.querySelector('[data-all]').onclick = async () => { await api('/notifications/read-all', { method: 'POST' }); box.remove(); refreshNotifCount(); };
  box.querySelector('[data-goto]').onclick = () => { box.remove(); location.hash = '#/v/notifications'; };
  box.querySelectorAll('[data-notif]').forEach((n) => n.onclick = async () => { await api(`/notifications/${n.dataset.notif}/read`, { method: 'POST' }); n.querySelector('.dot-status')?.remove(); refreshNotifCount(); });
}

/* ============================================================
   الملف الشخصي / كلمة المرور / الخروج
   ============================================================ */
function openProfile() {
  const u = state.user;
  modal({
    title: t('profile'),
    body: `<div class="row" style="gap:16px;align-items:center"><span class="avatar" style="width:64px;height:64px;font-size:24px">${esc(initials(u.name))}</span>
      <div><div class="strong" style="font-size:19px">${esc(u.name)}</div><div class="muted">@${esc(u.username)} — ${esc(t('role_' + u.role, u.role))}</div></div></div>
      <div class="divider"></div>
      <div class="detail-list">
        <div class="di"><span class="k">${t('phone')}</span><span class="v">${esc(u.phone || '—')}</span></div>
        <div class="di"><span class="k">${t('email')}</span><span class="v">${esc(u.email || '—')}</span></div>
        <div class="di"><span class="k">${t('role')}</span><span class="v">${esc(t('role_' + u.role, u.role))}</span></div>
        <div class="di"><span class="k">${t('created_at')}</span><span class="v">${esc((u.created_at || '').slice(0, 10))}</span></div>
      </div>`,
    footer: `<button class="btn btn-ghost" data-x>${t('close')}</button><button class="btn btn-primary" data-pw>${icon('key', 'sm')} ${t('change_password')}</button>`,
  }).node.querySelector('[data-pw]').onclick = () => { document.querySelector('.modal-backdrop')?.remove(); openChangePassword(); };
}
function openChangePassword() {
  const m = modal({
    title: t('change_password'),
    body: `<div class="field"><label>${t('current_password')}</label><input class="input" type="password" name="current"></div>
           <div class="field"><label>${t('new_password')}</label><input class="input" type="password" name="next"></div>
           <div class="field"><label>${t('confirm_password')}</label><input class="input" type="password" name="confirm"></div>`,
    footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-save>${icon('save', 'sm')} ${t('save')}</button>`,
  });
  m.node.querySelector('[data-x]').onclick = m.close;
  m.node.querySelector('[data-save]').onclick = async () => {
    const b = m.node.querySelector('.modal-body');
    const cur = b.querySelector('[name=current]').value, nxt = b.querySelector('[name=next]').value, cf = b.querySelector('[name=confirm]').value;
    if (nxt !== cf) return toast(t('password_mismatch'), 'warn');
    try { await api('/auth/password', { method: 'POST', body: { current: cur, next: nxt } }); toast(t('saved')); m.close(); } catch (e) { toast(e.message, 'error'); }
  };
}
async function doLogout() {
  if (!(await confirmDialog(t('logout') + '?', { danger: false, okText: t('logout') }))) return;
  try { await api('/auth/logout', { method: 'POST' }); } catch {}
  state.user = null; state.csrf = '';
  renderLogin(document.getElementById('app'));
}

/* ============================================================
   الإقلاع
   ============================================================ */
export async function boot() {
  const app = document.getElementById('app');
  try {
    if (!state.user) {
      const me = await api('/auth/me');
      state.user = me.user; state.csrf = me.csrf; state.settings = me.settings || {};
    }
    const b = await api('/bootstrap');
    state.meta = await api('/meta');
    state.alerts = b.alerts || {};
    state.settings = b.settings || state.settings;
    state.currencies = b.currencies || [];
    applyLang(state.settings.language || state.lang);
    applyTheme(state.theme);
    if (!location.hash) location.hash = '#/v/dashboard';
    renderShell();
  } catch (e) {
    await loadBranding();
    renderLogin(app);
  }
}

window.addEventListener('hashchange', () => { if (state.user) route(); });
window.addEventListener('ac:unauthorized', () => { if (state.user) { state.user = null; toast(t('session_expired'), 'warn'); renderLogin(document.getElementById('app')); } });
window.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); document.querySelector('[data-search]')?.focus(); } });

document.addEventListener('DOMContentLoaded', boot);
if (document.readyState !== 'loading') boot();
