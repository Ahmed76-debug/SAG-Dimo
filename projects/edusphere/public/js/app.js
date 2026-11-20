import { h, icon } from './core/dom.js';
import { store, loadLocalPrefs } from './core/store.js';
import { api } from './core/api.js';
import { router, route, setRenderer, navigate, current } from './core/router.js';
import { initTheme, applyTheme } from './core/theme.js';
import { setTranslations, applyDirection } from './core/i18n.js';
import { skeletonTable, emptyState } from './core/ui.js';
import { buildShell, bindGlobalShortcuts } from './core/shell.js';
import { renderLogin } from './views/login.js';
import { tt, L } from './views/common.js';

let shell = null;
let bootstrapped = false;

const root = () => document.getElementById('app');

function setRoot(node) {
  const el = root();
  if (!el) return;
  el.replaceChildren(node);
}

function loadingScreen(msg = '') {
  return h('div', { style: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' } },
    h('div', { style: { width: 'min(720px, 100%)' } },
      h('div', { class: 'row gap-3', style: { marginBottom: '16px', alignItems: 'center', justifyContent: 'center' } },
        h('div', { class: 'brand-mark' }, 'ES'),
        h('strong', { style: { fontSize: '20px' } }, 'EduSphere')),
      skeletonTable(4),
      msg ? h('p', { class: 'muted', style: { textAlign: 'center', marginTop: '12px' } }, msg) : null));
}

async function bootstrap() {
  try {
    const data = await api.get('/api/bootstrap');
    store.set({
      boot: data,
      user: data.user || null,
      settings: data.settings || {},
      locale: data.locale || 'ar',
      dir: (data.locale || 'ar') === 'ar' ? 'rtl' : 'ltr',
      translations: data.translations || {},
      entities: data.entities || [],
      entityMap: new Map((data.entities || []).map((e) => [e.name, e])),
      groups: data.groups || [],
      branches: data.branches || [],
      currencies: data.currencies || [],
      baseCurrency: data.baseCurrency || 'USD',
      academicYears: data.academicYears || [],
      terms: data.terms || [],
      unread: data.unreadNotifications || 0,
    });
    applyDirection();
    bootstrapped = true;
    return true;
  } catch (err) {
    if (err.status === 401) return false;
    throw err;
  }
}

async function ensureShell() {
  if (!shell) {
    shell = buildShell();
    setRoot(shell.el);
  }
  return shell;
}

async function showLogin() {
  shell = null;
  bootstrapped = false;
  setRoot(await renderLogin());
}

async function renderRoute(matched) {
  try {
    if (!matched || matched.notFound || !matched.handler) {
      const { renderNotFound } = await import('./views/misc.js');
      const view = await renderNotFound(matched);
      const sh = await ensureShell();
      sh.content.replaceChildren(view);
      sh.setActive(matched);
      return;
    }

    if (matched.meta?.public) {
      const node = await matched.handler(matched);
      setRoot(node);
      return;
    }

    if (!bootstrapped) {
      const ok = await bootstrap();
      if (!ok) { await showLogin(); return; }
    }
    if (!store.get('user')) { await showLogin(); return; }

    const sh = await ensureShell();
    sh.setActive(matched);
    sh.content.replaceChildren(h('div', { style: { padding: '12px' } }, skeletonTable(3)));
    try {
      const node = await matched.handler(matched);
      sh.content.replaceChildren(node);
    } catch (err) {
      console.error(err);
      sh.content.replaceChildren(emptyState({
        iconName: 'alert-triangle',
        title: L('Something went wrong', 'حدث خطأ ما'),
        message: err.message || String(err),
        action: h('button', { class: 'btn', onclick: () => router.resolve() }, icon('refresh'), L('Retry', 'إعادة المحاولة')),
      }));
    }
  } catch (err) {
    console.error(err);
    setRoot(h('div', { style: { padding: '24px' } }, h('div', { class: 'alert alert--danger' }, err.message || String(err))));
  }
}

function registerRoutes() {
  const v = (path) => async (r) => (await import(path)).default(r);
  route('/login', async () => renderLogin(), { public: true });
  route('/dashboard', v('./views/dashboard.js'));
  route('/modules', v('./views/modules.js'));
  route('/notifications', async (r) => (await import('./views/misc.js')).renderNotifications(r));
  route('/account', async (r) => (await import('./views/misc.js')).renderAccount(r));
  route('/reports', v('./views/reports.js'));
  route('/reports/:key', v('./views/reports.js'));
  route('/attendance', v('./views/attendance.js'));
  route('/gradebook', v('./views/gradebook.js'));
  route('/timetable', v('./views/timetable.js'));
  route('/treasury', async (r) => (await import('./views/treasury.js')).renderTreasury(r));
  route('/settlements', async (r) => (await import('./views/treasury.js')).renderSettlements(r));
  route('/opening-balances', async (r) => (await import('./views/treasury.js')).renderOpeningBalances(r));
  route('/backup', v('./views/backup.js'));
  route('/data-tools', v('./views/data-tools.js'));
  route('/settings', v('./views/settings.js'));
  route('/users', v('./views/users.js'));
  route('/roles', v('./views/users.js'));
  route('/translations', v('./views/translations.js'));
  route('/tutorials', v('./views/tutorials.js'));
  route('/e/:entity', v('./views/entity.js'));
  route('/e/:entity/:id', v('./views/entity.js'));
  route('/archive', async () => (await import('./views/entity.js')).default({ params: { entity: 'archive_records' }, query: {} }));
  route('/audit', async () => (await import('./views/entity.js')).default({ params: { entity: 'audit_log' }, query: {} }));
}

async function afterLogin() {
  setRoot(loadingScreen(L('Loading your workspace…', 'جارٍ تحميل مساحة العمل…')));
  await bootstrap();
  await router.start();
}

async function main() {
  loadLocalPrefs();
  initTheme(store.get('theme'));
  applyTheme(store.get('theme'));
  document.documentElement.lang = store.get('locale') || 'en';
  document.documentElement.dir = store.get('locale') === 'ar' ? 'rtl' : 'ltr';

  registerRoutes();
  setRenderer(renderRoute);
  bindGlobalShortcuts();

  window.addEventListener('edusphere:login', () => afterLogin());
  window.addEventListener('edusphere:logout', async () => { shell = null; bootstrapped = false; await showLogin(); });
  window.addEventListener('edusphere:unauthorized', async () => { if (store.get('user')) { store.set({ user: null }); bootstrapped = false; shell = null; await showLogin(); } });
  window.addEventListener('edusphere:locale', async () => { shell = null; await router.resolve(); });
  window.addEventListener('edusphere:rerender', async () => { if (!store.get('user')) await showLogin(); else { shell = null; await router.resolve(); } });

  setRoot(loadingScreen());
  const ok = await bootstrap();
  if (ok) {
    await router.start();
  } else {
    await showLogin();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  setRoot(h('div', { style: { padding: '24px', fontFamily: 'system-ui' } }, h('h2', {}, 'EduSphere failed to start'), h('pre', {}, err.stack || err.message || String(err))));
});
