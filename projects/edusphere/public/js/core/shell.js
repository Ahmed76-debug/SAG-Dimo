/**
 * Application shell: sidebar navigation, topbar, global search palette,
 * notifications and the user menu.
 */
import {
  h, icon, initials, relativeTime, debounce,
} from './dom.js';
import { t, entityLabel, toggleLocale } from './i18n.js';
import { store, saveLocalPrefs } from './store.js';
import { api } from './api.js';
import {
  notify, attachDropdown, emptyState, spinner, badge,
} from './ui.js';
import { setTheme, THEME_OPTIONS } from './theme.js';
import { current, navigate } from './router.js';
import { isAr, L } from '../views/common.js';

/* ------------------------------------------------------------------ *
 * Navigation definition
 * ------------------------------------------------------------------ */
const NAV = [
  {
    key: 'main',
    en: 'Overview', ar: 'نظرة عامة',
    items: [
      { path: '/dashboard', icon: 'dashboard', en: 'Dashboard', ar: 'لوحة القيادة', exact: true },
      { path: '/modules', icon: 'grid', en: 'All modules', ar: 'جميع الوحدات' },
    ],
  },
  {
    key: 'people',
    en: 'Students & people', ar: 'الطلاب والأفراد',
    items: [
      { path: '/e/students', icon: 'graduation', en: 'Students', ar: 'الطلاب', entity: 'students' },
      { path: '/e/staff', icon: 'presentation', en: 'Staff & teachers', ar: 'الموظفون والمعلمون', entity: 'staff' },
      { path: '/e/guardians', icon: 'shield', en: 'Guardians', ar: 'أولياء الأمور', entity: 'guardians' },
      { path: '/e/sections', icon: 'users', en: 'Class sections', ar: 'الشعب الدراسية', entity: 'sections' },
    ],
  },
  {
    key: 'academics',
    en: 'Academics', ar: 'الشؤون الأكاديمية',
    items: [
      { path: '/attendance', icon: 'calendar-check', en: 'Attendance', ar: 'الحضور والغياب', perm: 'attendance_records.read' },
      { path: '/gradebook', icon: 'star', en: 'Gradebook', ar: 'دفتر الدرجات', perm: 'grades.read' },
      { path: '/timetable', icon: 'table', en: 'Timetable', ar: 'الجدول الدراسي', perm: 'timetable_slots.read' },
      { path: '/e/assessments', icon: 'clipboard-check', en: 'Assessments', ar: 'التقييمات', entity: 'assessments' },
      { path: '/e/report_cards', icon: 'file-text', en: 'Report cards', ar: 'كشوف الدرجات', entity: 'report_cards' },
      { path: '/e/subjects', icon: 'book-open', en: 'Subjects', ar: 'المواد', entity: 'subjects' },
      { path: '/e/curricula', icon: 'book', en: 'Curricula', ar: 'المناهج', entity: 'curricula' },
    ],
  },
  {
    key: 'finance',
    en: 'Student finance', ar: 'مالية الطلاب',
    items: [
      { path: '/e/invoices', icon: 'receipt', en: 'Invoices', ar: 'الفواتير', entity: 'invoices' },
      { path: '/e/payments', icon: 'banknote', en: 'Payments & receipts', ar: 'المدفوعات والإيصالات', entity: 'payments' },
      { path: '/e/fee_structures', icon: 'layers', en: 'Fee structures', ar: 'هياكل الرسوم', entity: 'fee_structures' },
      { path: '/e/payment_plans', icon: 'calendar', en: 'Payment plans', ar: 'خطط السداد', entity: 'payment_plans' },
    ],
  },
  {
    key: 'erp',
    en: 'Accounting & ERP', ar: 'المحاسبة وتخطيط الموارد',
    items: [
      { path: '/e/bank_accounts', icon: 'wallet', en: 'Banks & cashboxes', ar: 'البنوك والخزائن', entity: 'bank_accounts' },
      { path: '/treasury', icon: 'banknote', en: 'Treasury transactions', ar: 'معاملات الخزائن والبنوك', perm: 'journal_entries.create' },
      { path: '/settlements', icon: 'scale', en: 'Balance settlements', ar: 'التسويات', perm: 'journal_entries.create' },
      { path: '/opening-balances', icon: 'flag', en: 'Opening balances', ar: 'الأرصدة الافتتاحية', perm: 'journal_entries.create' },
      { path: '/e/accounts', icon: 'layers', en: 'Chart of accounts', ar: 'دليل الحسابات', entity: 'accounts' },
      { path: '/e/journal_entries', icon: 'book', en: 'Journal entries', ar: 'القيود اليومية', entity: 'journal_entries' },
      { path: '/e/expenses', icon: 'receipt', en: 'Expenses', ar: 'المصروفات', entity: 'expenses' },
      { path: '/e/budgets', icon: 'pie-chart', en: 'Budgets', ar: 'الميزانيات', entity: 'budgets' },
      { path: '/e/vendors', icon: 'truck', en: 'Vendors', ar: 'الموردون', entity: 'vendors' },
      { path: '/e/customers', icon: 'users', en: 'Customers', ar: 'العملاء', entity: 'customers' },
    ],
  },
  {
    key: 'hr',
    en: 'Human resources', ar: 'الموارد البشرية',
    items: [
      { path: '/e/payroll_runs', icon: 'banknote', en: 'Payroll runs', ar: 'مسيرات الرواتب', entity: 'payroll_runs' },
      { path: '/e/payslips', icon: 'receipt', en: 'Payslips', ar: 'قسائم الرواتب', entity: 'payslips' },
      { path: '/e/leave_requests', icon: 'send', en: 'Leave requests', ar: 'طلبات الإجازة', entity: 'leave_requests' },
      { path: '/e/staff_attendance', icon: 'clock', en: 'Staff attendance', ar: 'حضور الموظفين', entity: 'staff_attendance' },
    ],
  },
  {
    key: 'reports',
    en: 'Reports & financial statements', ar: 'التقارير والقوائم المالية',
    items: [
      { path: '/reports', icon: 'bar-chart', en: 'Reports centre', ar: 'مركز التقارير', perm: 'reports.view' },
      { path: '/reports/trial-balance', icon: 'table', en: 'Trial balance', ar: 'ميزان المراجعة', perm: 'reports.financial' },
      { path: '/reports/income-statement', icon: 'line-chart', en: 'Income statement', ar: 'قائمة الدخل', perm: 'reports.financial' },
      { path: '/reports/balance-sheet', icon: 'clipboard', en: 'Balance sheet', ar: 'الميزانية العمومية (المركز المالي)', perm: 'reports.financial' },
      { path: '/reports/equity-changes', icon: 'trending-up', en: 'Statement of changes in equity', ar: 'قائمة التغيرات في حقوق الملكية', perm: 'reports.financial' },
      { path: '/reports/cash-flow', icon: 'wallet', en: 'Cash flow statement', ar: 'قائمة التدفقات النقدية', perm: 'reports.financial' },
      { path: '/reports/general-ledger', icon: 'book', en: 'General ledger', ar: 'دفتر الأستاذ العام', perm: 'reports.financial' },
    ],
  },
  {
    key: 'learning',
    en: 'Library & e-learning', ar: 'المكتبة والتعليم الإلكتروني',
    items: [
      { path: '/e/books', icon: 'book', en: 'Library books', ar: 'كتب المكتبة', entity: 'books' },
      { path: '/e/book_loans', icon: 'book-open', en: 'Book loans', ar: 'إعارة الكتب', entity: 'book_loans' },
      { path: '/e/courses', icon: 'presentation', en: 'Online courses', ar: 'الدورات الإلكترونية', entity: 'courses' },
      { path: '/e/videos', icon: 'video', en: 'Video library', ar: 'مكتبة الفيديو', entity: 'videos' },
    ],
  },
  {
    key: 'operations',
    en: 'Operations', ar: 'التشغيل',
    items: [
      { path: '/e/bookings', icon: 'calendar', en: 'Bookings', ar: 'الحجوزات', entity: 'bookings' },
      { path: '/e/events', icon: 'calendar', en: 'Events', ar: 'الفعاليات', entity: 'events' },
      { path: '/e/transport_routes', icon: 'route', en: 'Transport routes', ar: 'خطوط المواصلات', entity: 'transport_routes' },
      { path: '/e/inventory_items', icon: 'boxes', en: 'Inventory', ar: 'المخزون', entity: 'inventory_items' },
    ],
  },
  {
    key: 'system',
    en: 'System', ar: 'النظام',
    items: [
      { path: '/users', icon: 'users', en: 'Users', ar: 'المستخدمون', perm: 'users.manage' },
      { path: '/roles', icon: 'shield-check', en: 'Roles & permissions', ar: 'الأدوار والصلاحيات', perm: 'users.manage' },
      { path: '/translations', icon: 'languages', en: 'Translations', ar: 'الترجمات', perm: 'i18n.manage' },
      { path: '/settings', icon: 'settings', en: 'Settings', ar: 'الإعدادات', perm: 'settings.manage' },
      { path: '/backup', icon: 'database', en: 'Backup & restore', ar: 'النسخ الاحتياطي والاسترجاع', perm: 'backup.manage' },
      { path: '/data-tools', icon: 'database', en: 'Data tools', ar: 'أدوات البيانات', perm: 'users.manage' },
      { path: '/audit', icon: 'clipboard', en: 'Audit trail', ar: 'سجل التغييرات', perm: 'users.manage' },
      { path: '/archive', icon: 'archive', en: 'Archive', ar: 'الأرشيف', perm: 'archive_records.read' },
    ],
  },
  {
    key: 'help',
    en: 'Help', ar: 'المساعدة',
    items: [
      { path: '/tutorials', icon: 'video', en: 'Tutorial videos', ar: 'فيديوهات الشرح' },
    ],
  },
];

function canSee(item) {
  if (item.entity) return store.can(`${item.entity}.read`);
  if (item.perm) return store.can(item.perm);
  return true;
}

function isActive(item) {
  const route = current();
  if (!route) return false;
  if (item.exact) return route.path === item.path;
  return route.path === item.path || route.path.startsWith(`${item.path}/`);
}

/* ------------------------------------------------------------------ *
 * Shell builder
 * ------------------------------------------------------------------ */
export function buildShell() {
  const app = h('div', { class: `app-shell ${store.get('sidebarCollapsed') ? 'is-collapsed' : ''}` });
  const scrim = h('div', { class: 'scrim' });
  const content = h('div', { class: 'content', id: 'view-root' });

  const navLinks = [];
  const nav = h('nav', { class: 'sidebar__nav' });
  for (const group of NAV) {
    const items = group.items.filter(canSee);
    if (!items.length) continue;
    nav.appendChild(h('div', { class: 'nav-group' },
      h('span', { class: 'nav-group__label' }, L(group.en, group.ar)),
      items.map((item) => {
        const link = h('a', {
          class: `nav-link ${isActive(item) ? 'active' : ''}`,
          href: `#${item.path}`,
          title: L(item.en, item.ar),
          dataset: { path: item.path },
        }, icon(item.icon), h('span', { class: 'nav-link__text' }, L(item.en, item.ar)));
        navLinks.push(link);
        return link;
      }),
    ));
  }

  const brand = h('a', { class: 'sidebar__brand', href: '#/dashboard', 'aria-label': 'EduSphere' },
    h('div', { class: 'brand-mark' }, 'ES'),
    h('div', { class: 'brand-text' },
      h('strong', {}, 'EduSphere'),
      h('span', {}, L('School ERP', 'نظام إدارة المدرسة')),
    ),
  );

  const user = store.get('user') || {};
  const displayName = (isAr() ? user.full_name_ar : user.full_name_en) || user.full_name_en || user.username || '';
  const roleName = user.is_super
    ? L('Super administrator', 'مدير عام')
    : (isAr() ? user.roles?.[0]?.name_ar : user.roles?.[0]?.name_en) || L('Staff', 'موظف');

  const collapseBtn = h('button', { class: 'sidebar__collapse', type: 'button' },
    icon('chevrons-left'),
    h('span', {}, L('Collapse sidebar', 'طيّ القائمة')),
  );
  collapseBtn.addEventListener('click', () => {
    const collapsed = app.classList.toggle('is-collapsed');
    store.set({ sidebarCollapsed: collapsed });
    saveLocalPrefs();
  });

  const sidebarUser = h('a', { class: 'sidebar-user', href: '#/account' },
    h('div', { class: 'avatar avatar--sm' }, user.avatar ? h('img', { src: user.avatar, alt: '' }) : initials(displayName)),
    h('div', { class: 'sidebar-user__meta' },
      h('strong', {}, displayName),
      h('span', {}, roleName),
    ),
  );

  const sidebar = h('aside', { class: 'sidebar' },
    brand,
    nav,
    h('div', { class: 'sidebar__footer' },
      sidebarUser,
      collapseBtn,
    ),
  );

  /* ---------------- topbar ---------------- */
  const menuBtn = h('button', { class: 'icon-btn topbar__menu', 'aria-label': L('Open menu', 'فتح القائمة'), type: 'button' }, icon('menu'));
  menuBtn.addEventListener('click', () => {
    app.classList.add('nav-open');
    scrim.classList.add('show');
  });
  scrim.addEventListener('click', () => {
    app.classList.remove('nav-open');
    scrim.classList.remove('show');
  });

  const searchInput = h('input', {
    type: 'search', placeholder: L('Search students, invoices, accounts…', 'ابحث عن طالب، فاتورة، حساب…'),
    'aria-label': L('Global search', 'بحث شامل'),
  });
  searchInput.addEventListener('focus', () => {
    searchInput.blur();
    openPalette();
  });
  const searchBox = h('div', { class: 'search-box' }, icon('search'), searchInput, h('kbd', {}, navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'));

  const langBtn = h('button', { class: 'lang-switch', type: 'button', title: L('Switch language', 'تبديل اللغة') },
    icon('languages'), h('span', {}, isAr() ? 'English' : 'العربية'));
  langBtn.addEventListener('click', async () => {
    langBtn.disabled = true;
    await toggleLocale();
    langBtn.disabled = false;
  });

  const themeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': L('Theme gallery', 'معرض الثيمات'), title: L('Theme gallery', 'معرض الثيمات') });
  themeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.48 2 2 6.48 2 12c0 5.08 3.78 9.27 8.67 9.93.61.08 1.13-.43 1.02-1.04-.11-.56-.42-1.36-1.15-2.13-.63-.66-.99-1.55-.88-2.52.18-1.54 1.55-2.74 3.1-2.74H15c3.31 0 6-2.69 6-6 0-4.97-4.03-9-9-9z"/></svg>';
  themeBtn.addEventListener('click', () => openThemeGallery());

  const unreadDot = h('span', { class: 'icon-btn__dot', style: { display: store.get('unread') ? '' : 'none' } });
  const notifBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': L('Notifications', 'الإشعارات') }, icon('bell'), unreadDot);
  const notifMenu = h('div', { style: { width: '340px', padding: '0' } });
  const notifDropdown = attachDropdown(notifBtn, notifMenu);

  let notificationsLoaded = false;
  notifBtn.addEventListener('click', () => {
    if (notifBtn.getAttribute('aria-expanded') === 'true') return;
    loadNotifications();
  });

  async function loadNotifications() {
    notifMenu.replaceChildren(h('div', { style: { padding: '28px', display: 'grid', placeItems: 'center' } }, spinner()));
    try {
      const data = await api.get('/api/notifications');
      notificationsLoaded = true;
      const rows = data.rows || [];
      store.set({ unread: data.unread || 0 });
      unreadDot.style.display = data.unread ? '' : 'none';
      notifMenu.replaceChildren(
        h('div', { class: 'dropdown__head' },
          h('strong', { style: { fontSize: 'var(--fs-sm)' } }, L('Notifications', 'الإشعارات')),
          h('button', {
            class: 'btn btn--ghost btn--sm',
            onclick: async () => {
              await api.post('/api/notifications/read-all', {});
              store.set({ unread: 0 });
              unreadDot.style.display = 'none';
              loadNotifications();
            },
          }, L('Mark all read', 'تحديد الكل كمقروء')),
        ),
        rows.length
          ? h('div', { style: { maxHeight: '380px', overflowY: 'auto' } }, rows.map((n) => notificationItem(n)))
          : h('div', { style: { padding: '12px' } }, emptyState({
              iconName: 'bell', title: L('You are all caught up', 'لا توجد إشعارات جديدة'),
            })),
      );
    } catch (err) {
      notifMenu.replaceChildren(h('div', { style: { padding: '14px' } }, h('div', { class: 'alert alert--danger' }, err.message)));
    }
  }

  function notificationItem(n) {
    const title = isAr() ? n.title_ar || n.title_en : n.title_en || n.title_ar;
    const text = isAr() ? n.body_ar || n.body_en : n.body_en || n.body_ar;
    const item = h('button', {
      class: `notif-item ${n.is_read ? '' : 'is-unread'}`,
      type: 'button',
      style: { width: '100%', textAlign: 'start' },
      onclick: async () => {
        try {
          if (!n.is_read) {
            await api.post(`/api/notifications/${n.id}/read`, {});
            store.set({ unread: Math.max(0, (store.get('unread') || 1) - 1) });
            unreadDot.style.display = store.get('unread') ? '' : 'none';
          }
        } catch { /* ignore */ }
        notifDropdown.close();
        if (n.url) {
          if (n.url.startsWith('#') || n.url.startsWith('/')) navigate(n.url.replace(/^#/, ''));
        }
      },
    },
      h('div', { class: 'notif-item__icon' }, icon(n.type === 'warning' ? 'alert-triangle' : n.type === 'error' ? 'x-circle' : n.type === 'success' ? 'check-circle' : 'info')),
      h('div', { class: 'notif-item__body' },
        h('div', { class: 'notif-item__title' }, title || L('Notification', 'إشعار')),
        text ? h('div', { class: 'notif-item__text' }, text) : null,
        h('div', { class: 'notif-item__time' }, relativeTime(n.created_at, store.get('locale'))),
      ),
    );
    return item;
  }

  const userBtn = h('button', { class: 'user-menu-btn', type: 'button' },
    h('div', { class: 'avatar' }, user.avatar ? h('img', { src: user.avatar, alt: '' }) : initials(displayName)),
    h('span', { class: 'user-menu-btn__name' }, displayName),
    icon('chevron-down'),
  );

  const menuItem = ({ iconName, label, onClick, danger = false, href = null }) => {
    const el = h(href ? 'a' : 'button', {
      class: `dropdown__item ${danger ? 'is-danger' : ''}`,
      href,
      type: href ? undefined : 'button',
      onclick: onClick,
    }, icon(iconName), h('span', {}, label));
    return el;
  };

  const userMenu = h('div', { style: { minWidth: '230px' } },
    h('div', { class: 'dropdown__head' },
      h('div', { class: 'strong' }, displayName),
      h('div', { class: 'faint', style: { fontSize: 'var(--fs-2xs)' } }, user.email || `@${user.username}`),
    ),
    menuItem({ iconName: 'user', label: L('My account', 'حسابي'), href: '#/account' }),
    store.can('settings.manage') ? menuItem({ iconName: 'settings', label: L('Settings', 'الإعدادات'), href: '#/settings' }) : null,
    store.can('users.manage') ? menuItem({ iconName: 'shield-check', label: L('Users & roles', 'المستخدمون والأدوار'), href: '#/users' }) : null,
    store.can('backup.manage') ? menuItem({ iconName: 'database', label: L('Backup & restore', 'النسخ الاحتياطي'), href: '#/backup' }) : null,
    h('div', { class: 'dropdown__sep' }),
    menuItem({
      iconName: 'palette',
      label: L('Theme gallery', 'معرض الثيمات'),
      onClick: () => openThemeGallery(),
    }),
    menuItem({ iconName: 'languages', label: L('Switch language', 'تبديل اللغة'), onClick: () => toggleLocale() }),
    h('div', { class: 'dropdown__sep' }),
    menuItem({
      iconName: 'log-out',
      label: L('Sign out', 'تسجيل الخروج'),
      danger: true,
      onClick: async () => {
        try { await api.post('/api/auth/logout', {}); } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent('edusphere:logout'));
      },
    }),
  );
  attachDropdown(userBtn, userMenu);

  const topbar = h('header', { class: 'topbar' },
    menuBtn,
    searchBox,
    h('div', { class: 'topbar__spacer' }),
    h('div', { class: 'topbar__actions' },
      langBtn,
      themeBtn,
      notifBtn,
      userBtn,
    ),
  );

  const main = h('div', { class: 'main' }, topbar, content);
  app.append(sidebar, main, scrim);

  function setActive(route = current()) {
    for (const link of navLinks) {
      const path = link.dataset.path;
      const active = route && (route.path === path || route.path.startsWith(`${path}/`));
      link.classList.toggle('active', Boolean(active));
    }
    app.classList.remove('nav-open');
    scrim.classList.remove('show');
  }

  return { el: app, content, setActive, refresh: () => buildShell(), notificationsLoaded };
}


/* ------------------------------------------------------------------ *
 * Theme gallery (Auto-Car style)
 * ------------------------------------------------------------------ */
const THEME_PREVIEWS = {
  'light':         { bg:'#f4f6fb', surface:'#ffffff', brand:'#4f7cff', accent:'#12b981' },
  'light-sand':    { bg:'#f6f1e8', surface:'#fffaf2', brand:'#b7791f', accent:'#0f766e' },
  'light-mist':    { bg:'#eef4ff', surface:'#ffffff', brand:'#2563eb', accent:'#0891b2' },
  'dark':          { bg:'#0b1220', surface:'#121a2b', brand:'#60a5fa', accent:'#22d3ee' },
  'dark-midnight': { bg:'#060816', surface:'#0f1428', brand:'#8b5cf6', accent:'#22d3ee' },
  'dark-emerald':  { bg:'#071311', surface:'#102220', brand:'#34d399', accent:'#14b8a6' },
  'system':        { bg:'#e5e7eb', surface:'#ffffff', brand:'#64748b', accent:'#94a3b8' },
};

function openThemeGallery() {
  const cur = store.get('theme') || 'system';
  const lights = THEME_OPTIONS.filter(t => t.mode === 'light');
  const darks = THEME_OPTIONS.filter(t => t.mode === 'dark');
  const sys = THEME_OPTIONS.filter(t => t.mode === 'system');

  const card = (t) => {
    const c = THEME_PREVIEWS[t.value] || THEME_PREVIEWS.light;
    const active = t.value === cur ? ' active' : '';
    return '<button type="button" class="ed-theme-card'+active+'" data-ed-theme="'+t.value+'" title="'+L(t.en,t.ar)+'">'+
      '<span class="ed-tc-preview" style="--p-bg:'+c.bg+';--p-surface:'+c.surface+';--p-brand:'+c.brand+';--p-accent:'+c.accent+'">'+
        '<span class="ed-tc-side"></span><span class="ed-tc-main"><span class="ed-tc-head"></span><span class="ed-tc-line w70"></span><span class="ed-tc-line w45"></span><span class="ed-tc-chips"><i style="background:var(--p-brand)"></i><i style="background:var(--p-accent)"></i><i style="background:var(--p-surface);border:1px solid rgba(128,128,128,.25)"></i></span></span>'+
        '<span class="ed-tc-check">✓</span></span>'+
      '<span class="ed-tc-name">'+L(t.en,t.ar)+'<span class="ed-tc-mode">'+(t.mode==='dark'?L('Dark','داكن'):t.mode==='light'?L('Light','فاتح'):L('System','النظام'))+'</span></span></button>';
  };

  let ov = document.getElementById('ed-theme-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'ed-theme-modal'; ov.className = 'ed-theme-overlay'; document.body.appendChild(ov); }
  const close = () => { ov.style.display = 'none'; ov.innerHTML = ''; };
  ov.innerHTML = '<div class="ed-theme-modal" role="dialog" aria-label="'+L('Theme gallery','معرض الثيمات')+'">'+
    '<div class="ed-theme-modal-head"><h3>'+L('Theme gallery','معرض الثيمات')+'</h3><button type="button" class="btn" data-close>'+L('Close','إغلاق')+'</button></div>'+
    '<div class="ed-theme-gallery">'+
      '<section><div class="ed-tg-head"><span class="ed-tg-dot light"></span><h4>'+L('Light themes','الثيمات الفاتحة')+'</h4><span class="ed-tg-count">'+lights.length+'</span></div><div class="ed-theme-grid">'+lights.map(card).join('')+'</div></section>'+
      '<section><div class="ed-tg-head"><span class="ed-tg-dot dark"></span><h4>'+L('Dark themes','الثيمات الداكنة')+'</h4><span class="ed-tg-count">'+darks.length+'</span></div><div class="ed-theme-grid">'+darks.map(card).join('')+'</div></section>'+
      (sys.length ? '<section><div class="ed-tg-head"><span class="ed-tg-dot light"></span><h4>'+L('Automatic','تلقائي')+'</h4><span class="ed-tg-count">'+sys.length+'</span></div><div class="ed-theme-grid">'+sys.map(card).join('')+'</div></section>' : '')+
    '</div></div>';
  ov.style.display = 'grid';
  ov.querySelector('[data-close]').onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  ov.querySelectorAll('[data-ed-theme]').forEach(b => b.onclick = async () => {
    await setTheme(b.dataset.edTheme);
    ov.querySelectorAll('[data-ed-theme]').forEach(x => x.classList.toggle('active', x === b));
  });
}

/* ------------------------------------------------------------------ *
 * Command palette
 * ------------------------------------------------------------------ */
let paletteOpen = null;

export function openPalette() {
  if (paletteOpen) return paletteOpen;

  const input = h('input', {
    class: 'cmdk__input',
    placeholder: L('Search modules, records and pages…', 'ابحث في الوحدات والسجلات والصفحات…'),
    'aria-label': L('Search', 'بحث'),
  });
  const results = h('div', { class: 'cmdk__results' });
  const panel = h('div', { class: 'cmdk' },
    input,
    results,
    h('div', { class: 'cmdk__foot' },
      h('span', {}, h('kbd', {}, '↑'), h('kbd', {}, '↓'), L('Navigate', 'تنقّل')),
      h('span', {}, h('kbd', {}, '↵'), L('Open', 'فتح')),
      h('span', {}, h('kbd', {}, 'Esc'), L('Close', 'إغلاق')),
    ),
  );
  const overlay = h('div', {
    class: 'overlay',
    style: { alignItems: 'start' },
    onclick: (e) => { if (e.target === overlay) close(); },
  }, panel);

  let items = [];
  let active = 0;

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
    paletteOpen = null;
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); paintActive(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paintActive(); }
    if (e.key === 'Enter' && items[active]) { e.preventDefault(); items[active].run(); close(); }
  };
  const paintActive = () => {
    items.forEach((item, i) => item.el.classList.toggle('is-active', i === active));
    items[active]?.el.scrollIntoView({ block: 'nearest' });
  };

  function render(groups) {
    items = [];
    active = 0;
    results.replaceChildren();
    for (const group of groups) {
      if (!group.items.length) continue;
      results.appendChild(h('div', { class: 'cmdk__group-label' }, group.label));
      for (const entry of group.items) {
        const el = h('button', {
          class: 'cmdk__item',
          type: 'button',
          onclick: () => { entry.run(); close(); },
        }, icon(entry.icon || 'search'), h('span', { class: 'truncate' }, entry.label), entry.hint ? h('small', {}, entry.hint) : null);
        items.push({ el, run: entry.run });
        results.appendChild(el);
      }
    }
    if (!items.length) {
      results.appendChild(h('div', { style: { padding: '18px' } }, emptyState({
        iconName: 'search', title: L('No results found', 'لا توجد نتائج'),
        message: L('Try a different name, code or invoice number.', 'جرّب اسماً أو كوداً أو رقم فاتورة آخر.'),
      })));
    }
    paintActive();
  }

  function quickGroups() {
    const pages = [];
    for (const group of NAV) {
      for (const item of group.items.filter(canSee)) {
        pages.push({
          label: L(item.en, item.ar), icon: item.icon, hint: L(group.en, group.ar),
          run: () => navigate(item.path),
        });
      }
    }
    const entities = store.get('entities')
      .filter((e) => store.can(`${e.name}.read`))
      .map((e) => ({
        label: entityLabel(e), icon: e.icon, hint: L('Open module', 'فتح الوحدة'),
        run: () => navigate(`/e/${e.name}`),
      }));
    return [
      { label: L('Pages', 'الصفحات'), items: pages.slice(0, 8) },
      { label: L('Modules', 'الوحدات'), items: entities.slice(0, 12) },
    ];
  }

  const search = debounce(async (q) => {
    if (!q) { render(quickGroups()); return; }
    const needle = q.toLowerCase();
    const pages = [];
    for (const group of NAV) {
      for (const item of group.items.filter(canSee)) {
        const hay = `${item.en} ${item.ar}`.toLowerCase();
        if (hay.includes(needle)) pages.push({ label: L(item.en, item.ar), icon: item.icon, hint: L(group.en, group.ar), run: () => navigate(item.path) });
      }
    }
    const entities = store.get('entities')
      .filter((e) => store.can(`${e.name}.read`) && `${e.labelEn} ${e.labelAr} ${e.name}`.toLowerCase().includes(needle))
      .map((e) => ({ label: entityLabel(e), icon: e.icon, hint: L('Module', 'وحدة'), run: () => navigate(`/e/${e.name}`) }));

    let records = [];
    try {
      const data = await api.get('/api/search', { q });
      records = (data.results || []).map((r) => ({
        label: r.label || `#${r.id}`,
        icon: store.entity(r.entity)?.icon || 'search',
        hint: `${entityLabel(store.entity(r.entity))} · ${r.sub || `#${r.id}`}`,
        run: () => navigate(`/e/${r.entity}/${r.id}`),
      }));
    } catch { /* search is best-effort */ }

    render([
      { label: L('Pages', 'الصفحات'), items: pages },
      { label: L('Modules', 'الوحدات'), items: entities.slice(0, 8) },
      { label: L('Records', 'السجلات'), items: records },
    ]);
  }, 240);

  input.addEventListener('input', () => search(input.value.trim()));
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey);
  render(quickGroups());
  setTimeout(() => input.focus(), 30);

  paletteOpen = { close };
  return paletteOpen;
}

/* ------------------------------------------------------------------ *
 * Keyboard shortcut
 * ------------------------------------------------------------------ */
export function bindGlobalShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openPalette();
    }
  });
}

export { NAV };
