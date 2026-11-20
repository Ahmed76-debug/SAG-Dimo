/* ============================================================
   Auto Car — البيانات المرجعية: الماركات، الطرازات، الفئات، الألوان
   ============================================================ */
import { t, esc, state, pick } from '../core.js';
import { crudView } from '../ui.js';

export function render(container, item) {
  const activeField = { key: 'active', label: t('active'), type: 'checkbox', default: 1 };
  const PERM = 'catalog.manage';
  const configs = {
    brands: {
      title: t('brands'), endpoint: '/brands', perm: PERM, titleField: 'name', exportEntity: 'brands',
      columns: [
        { key: 'name', label: t('name'), render: (r) => `<b>${esc(pick(r))}</b>` },
        { key: 'name_en', label: t('name_en'), render: (r) => esc(r.name_en || '—') },
        { key: 'country', label: t('origin'), render: (r) => esc(r.country || '—') },
        { key: 'active', label: t('status'), render: (r) => r.active ? `<span class="badge badge-success">${t('active')}</span>` : `<span class="badge">${t('inactive')}</span>` },
      ],
      fields: [
        { key: 'name', label: t('name'), required: true },
        { key: 'name_en', label: t('name_en') },
        { key: 'country', label: t('origin') },
        activeField,
      ],
    },
    'car-models': {
      title: t('car_models'), endpoint: '/car-models', perm: PERM, titleField: 'name', exportEntity: null,
      columns: [
        { key: 'name', label: t('model'), render: (r) => `<b>${esc(pick(r))}</b>` },
        { key: 'brand_name', label: t('brand'), render: (r) => esc(r.brand_name || '—') },
        { key: 'name_en', label: t('name_en'), render: (r) => esc(r.name_en || '—') },
        { key: 'active', label: t('status'), render: (r) => r.active ? `<span class="badge badge-success">${t('active')}</span>` : `<span class="badge">${t('inactive')}</span>` },
      ],
      fields: [
        { key: 'brand_id', label: t('brand'), type: 'select', meta: 'brands', required: true },
        { key: 'name', label: t('model'), required: true },
        { key: 'name_en', label: t('name_en') },
        { key: 'type_id', label: t('type'), type: 'select', meta: 'car_types' },
        activeField,
      ],
    },
    'car-types': {
      title: t('car_types'), endpoint: '/car-types', perm: PERM, titleField: 'name', exportEntity: 'car_types',
      columns: [
        { key: 'name', label: t('name'), render: (r) => `<b>${esc(pick(r))}</b>` },
        { key: 'name_en', label: t('name_en'), render: (r) => esc(r.name_en || '—') },
        { key: 'active', label: t('status'), render: (r) => r.active ? `<span class="badge badge-success">${t('active')}</span>` : `<span class="badge">${t('inactive')}</span>` },
      ],
      fields: [{ key: 'name', label: t('name'), required: true }, { key: 'name_en', label: t('name_en') }, activeField],
    },
    colors: {
      title: t('colors'), endpoint: '/colors', perm: PERM, titleField: 'name', exportEntity: 'colors',
      columns: [
        { key: 'name', label: t('name'), render: (r) => `<span class="row" style="gap:8px"><span style="width:18px;height:18px;border-radius:6px;border:1px solid var(--border);background:${esc(r.hex || '#ccc')}"></span><b>${esc(pick(r))}</b></span>` },
        { key: 'name_en', label: t('name_en'), render: (r) => esc(r.name_en || '—') },
        { key: 'hex', label: 'HEX', render: (r) => `<span class="mono">${esc(r.hex || '—')}</span>` },
        { key: 'active', label: t('status'), render: (r) => r.active ? `<span class="badge badge-success">${t('active')}</span>` : `<span class="badge">${t('inactive')}</span>` },
      ],
      fields: [{ key: 'name', label: t('name'), required: true }, { key: 'name_en', label: t('name_en') }, { key: 'hex', label: 'HEX', type: 'color' }, activeField],
    },
  };
  const cfg = configs[item.key];
  crudView(cfg)(container);
}
