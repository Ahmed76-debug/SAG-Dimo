import { h, icon, debounce } from '../core/dom.js';
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { pageHeader, card, emptyState, spinner, notify, openModal } from '../core/ui.js';
import { L } from './common.js';

export default async function renderTranslations() {
  if (!store.can('i18n.manage')) {
    return h('div', { class: 'view' }, card({ body: emptyState({ iconName: 'shield', title: L('Access denied', 'الوصول مرفوض') }) }));
  }

  const host = h('div', {}, h('div', { style: { padding: '28px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
  const search = h('input', { class: 'input', type: 'search', placeholder: L('Search keys or text…', 'ابحث في المفاتيح أو النص…') });
  let rows = [];

  async function load(q = '') {
    host.replaceChildren(h('div', { style: { padding: '28px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
    try {
      const data = await api.get('/api/i18n', q ? { q } : undefined);
      rows = data.rows || data.translations || data.items || [];
      // /api/i18n may return {en:{}, ar:{}} or list; normalize
      if (!Array.isArray(rows) && data.en && data.ar) {
        const keys = Array.from(new Set([...Object.keys(data.en), ...Object.keys(data.ar)]));
        rows = keys.map((k) => ({ key: k, en: data.en[k] ?? '', ar: data.ar[k] ?? '', namespace: k.split('.')[0] || 'general' }));
      }
      render();
    } catch (err) {
      host.replaceChildren(h('div', { class: 'alert alert--danger' }, err.message));
    }
  }

  function render() {
    if (!rows.length) { host.replaceChildren(emptyState({ iconName: 'languages', title: L('No translations found', 'لا توجد ترجمات') })); return; }
    host.replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, L('Key', 'المفتاح')), h('th', {}, 'English'), h('th', {}, 'العربية'), h('th', {}, ''))),
      h('tbody', {}, rows.slice(0, 500).map((r) => h('tr', {},
        h('td', { class: 'mono', style: { fontSize: 'var(--fs-xs)' } }, r.key || r.code || '—'),
        h('td', {}, r.en ?? r.value_en ?? r.text_en ?? '—'),
        h('td', {}, r.ar ?? r.value_ar ?? r.text_ar ?? '—'),
        h('td', { class: 'col-actions' }, h('button', { class: 'icon-btn icon-btn--sm', onclick: () => editRow(r) }, icon('edit'))),
      ))))));
  }

  function editRow(r) {
    const key = r.key || r.code;
    const en = h('textarea', { class: 'textarea' }); en.value = r.en ?? r.value_en ?? r.text_en ?? '';
    const ar = h('textarea', { class: 'textarea' }); ar.value = r.ar ?? r.value_ar ?? r.text_ar ?? '';
    const save = h('button', { class: 'btn btn--primary' }, icon('save'), L('Save', 'حفظ'));
    const modal = openModal({
      title: L('Edit translation', 'تعديل الترجمة'),
      subtitle: key,
      body: h('div', { class: 'col gap-3' },
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'English'), en),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'العربية'), ar)),
      footer: [h('button', { class: 'btn', onclick: () => modal.close() }, L('Cancel', 'إلغاء')), save],
    });
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        await api.put(`/api/i18n/${encodeURIComponent(key)}`, { key, en: en.value, ar: ar.value });
        r.en = en.value; r.ar = ar.value;
        // update live translations
        const tr = store.get('translations') || {};
        tr[key] = store.get('locale') === 'ar' ? ar.value : en.value;
        store.set({ translations: { ...tr } });
        notify.success(L('Translation saved', 'تم حفظ الترجمة')); modal.close(); render();
      } catch (err) { notify.error(L('Error', 'خطأ'), err.message); }
      finally { save.disabled = false; }
    });
  }

  search.addEventListener('input', debounce(() => load(search.value.trim()), 300));
  load();

  return h('div', { class: 'view' },
    pageHeader({ title: L('Translations', 'الترجمات'), iconName: 'languages', subtitle: L('Edit UI labels in Arabic and English. Changes apply immediately.', 'عدّل تسميات الواجهة بالعربية والإنجليزية. التغييرات تُطبق فوراً.') }),
    card({ body: h('div', { class: 'col gap-3' },
      h('div', { class: 'toolbar' }, h('div', { class: 'toolbar__search' }, icon('search'), search)),
      host,
    ) }),
  );
}
