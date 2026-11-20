import { h, icon } from '../core/dom.js';
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { pageHeader, card, emptyState, spinner, notify } from '../core/ui.js';
import { L } from './common.js';

const SCOPES = [
  { key: 'school', en: 'School profile', ar: 'ملف المدرسة', icon: 'building' },
  { key: 'branding', en: 'Branding & theme', ar: 'الهوية والمظهر', icon: 'palette' },
  { key: 'finance', en: 'Finance', ar: 'المالية', icon: 'wallet' },
  { key: 'academic', en: 'Academic', ar: 'الأكاديميات', icon: 'graduation' },
  { key: 'numbering', en: 'Numbering sequences', ar: 'تسلسل الترقيم', icon: 'hash' },
  { key: 'locale', en: 'Locale & display', ar: 'اللغة والعرض', icon: 'languages' },
  { key: 'notifications', en: 'Notifications', ar: 'الإشعارات', icon: 'bell' },
];

export default async function renderSettings() {
  if (!store.can('settings.manage')) {
    return h('div', { class: 'view' }, card({ body: emptyState({ iconName: 'shield', title: L('Access denied', 'الوصول مرفوض') }) }));
  }

  const host = h('div', {}, h('div', { style: { padding: '28px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
  let all = {};

  async function load() {
    try {
      const data = await api.get('/api/settings');
      all = data.settings || data || {};
      render();
    } catch (err) {
      host.replaceChildren(h('div', { class: 'alert alert--danger' }, err.message));
    }
  }

  function inputFor(key, value, hint) {
    const type = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'checkbox' : (String(value).length > 60 ? 'textarea' : 'text');
    if (type === 'checkbox' || value === 0 || value === 1) {
      const cb = h('input', { type: 'checkbox', checked: !!Number(value) || value === true });
      return { el: h('label', { class: 'row gap-2' }, cb, h('span', { class: 'faint', style: { fontSize: 'var(--fs-xs)' } }, hint || '')), get: () => cb.checked ? 1 : 0 };
    }
    if (type === 'textarea') {
      const ta = h('textarea', { class: 'textarea' }); ta.value = value ?? '';
      return { el: ta, get: () => ta.value };
    }
    const inp = h('input', { class: 'input', type: type === 'number' ? 'number' : 'text', value: value ?? '' });
    return { el: inp, get: () => type === 'number' ? Number(inp.value) : inp.value };
  }

  function render() {
    const sections = SCOPES.map((scope) => {
      const data = all[scope.key] || {};
      const controls = new Map();
      const rows = Object.entries(data).map(([k, v]) => {
        const ctl = inputFor(k, v);
        controls.set(k, ctl);
        return h('label', { class: 'field' },
          h('span', { class: 'field__label' }, prettyKey(k)),
          ctl.el);
      });
      const save = h('button', { class: 'btn btn--primary btn--sm', onclick: async () => {
        save.disabled = true;
        try {
          const payload = {};
          for (const [k, ctl] of controls) payload[k] = ctl.get();
          await api.put(`/api/settings/${scope.key}`, payload);
          notify.success(L('Settings saved', 'تم حفظ الإعدادات'), L(scope.en, scope.ar));
          all[scope.key] = { ...data, ...payload };
          store.set({ settings: { ...store.get('settings'), [scope.key]: { ...(store.get('settings')?.[scope.key] || {}), ...payload } } });
        } catch (err) { notify.error(L('Save failed', 'فشل الحفظ'), err.message); }
        finally { save.disabled = false; }
      } }, icon('save'), L('Save', 'حفظ'));

      return card({
        title: L(scope.en, scope.ar),
        actions: [save],
        body: rows.length ? h('div', { class: 'form-grid' }, rows) : h('p', { class: 'faint' }, L('No settings in this scope.', 'لا توجد إعدادات في هذا القسم.')),
      });
    });

    host.replaceChildren(h('div', { class: 'col gap-4' }, sections));
  }

  load();

  return h('div', { class: 'view view--settings' },
    pageHeader({ title: L('Settings', 'الإعدادات'), iconName: 'settings', subtitle: L('Configure school profile, finance, academics, numbering, locale and more.', 'اضبط ملف المدرسة والمالية والأكاديميات والترقيم واللغة والمزيد.') }),
    host,
  );
}

function prettyKey(k) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
