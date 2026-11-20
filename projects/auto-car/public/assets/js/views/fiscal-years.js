/* ============================================================
   Auto Car — السنوات المالية
   ============================================================ */
import { t, esc } from '../core.js';
import { crudView, statusBadge } from '../ui.js';

export function render(container) {
  crudView({
    title: t('fiscal_years'), endpoint: '/fiscal-years', perm: 'accounting.manage',
    titleField: 'name', addLabel: t('add'), canEdit: () => false, canDelete: () => false,
    columns: [
      { key: 'name', label: t('name'), render: (r) => `<b>${esc(r.name)}</b>` },
      { key: 'start_date', label: t('start_date') },
      { key: 'end_date', label: t('end_date') },
      { key: 'status', label: t('status'), render: (r) => statusBadge(r.status) },
    ],
    fields: [
      { key: 'name', label: t('name'), required: true, placeholder: '2026' },
      { key: 'start_date', label: t('start_date'), type: 'date', required: true },
      { key: 'end_date', label: t('end_date'), type: 'date', required: true },
    ],
  })(container);
}
