import { h, icon, fmtDateTime } from '../core/dom.js';
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { pageHeader, card, emptyState, spinner, notify, confirmDialog } from '../core/ui.js';
import { L } from './common.js';

export default async function renderDataTools() {
  if (!store.can('users.manage')) {
    return h('div', { class: 'view' }, card({
      body: emptyState({
        iconName: 'shield',
        title: L('Access denied', 'الوصول مرفوض'),
        message: L('This page is available to system administrators only.', 'هذه الصفحة متاحة لمدير النظام فقط.'),
      }),
    }));
  }

  const locale = store.get('locale') || 'ar';
  const truncateHost = h('div');
  const trashHost = h('div');
  let tables = [];
  let trashRows = [];
  let trashTotal = 0;
  let trashEntityName = '';
  let trashLoaded = false;

  /* ------------------------------------------------------------------ *
   * Truncate tab
   * ------------------------------------------------------------------ */
  const selectAll = h('button', {
    class: 'btn btn--sm',
    onclick: () => truncateHost.querySelectorAll('input[data-t]').forEach((c) => { if (!c.disabled) c.checked = true; }),
  }, icon('check'), L('Select all', 'تحديد الكل'));

  const clearAll = h('button', {
    class: 'btn btn--sm',
    onclick: () => truncateHost.querySelectorAll('input[data-t]').forEach((c) => { c.checked = false; }),
  }, L('Clear', 'إلغاء التحديد'));

  const runBtn = h('button', {
    class: 'btn btn--danger',
    onclick: async () => {
      const selected = Array.from(truncateHost.querySelectorAll('input[data-t]:checked')).map((c) => c.dataset.t);
      if (!selected.length) return notify.warning(L('No tables selected', 'لم يتم تحديد جداول'), L('Select at least one table.', 'حدد جدولًا واحدًا على الأقل.'));
      const ok = await confirmDialog({
        title: L('Truncate selected tables?', 'تفريغ الجداول المحددة؟'),
        message: L(
          `All rows will be deleted from: ${selected.join(', ')}. Related child tables may be included automatically. This cannot be undone except from a backup.`,
          `سيتم حذف كل السجلات من: ${selected.join(', ')}. قد تُضمّن الجداول التابعة تلقائيًا. لا يمكن التراجع إلا من نسخة احتياطية.`,
        ),
        danger: true,
        confirmText: L('Truncate', 'تفريغ'),
        iconName: 'trash',
      });
      if (!ok) return;
      runBtn.disabled = true;
      try {
        const result = await api.post('/api/data-tools/truncate', { tables: selected });
        notify.success(L('Tables truncated', 'تم تفريغ الجداول'), L(`${(result.cleared || selected).length} table(s) cleared.`, `تم تفريغ ${(result.cleared || selected).length} جدولًا.`));
        trashLoaded = false;
        await loadTruncate();
      } catch (err) {
        notify.error(L('Truncation failed', 'فشل التفريغ'), err.message);
      } finally {
        runBtn.disabled = false;
      }
    },
  }, icon('trash'), L('Truncate selected', 'تفريغ المحدد'));

  function renderTruncate() {
    const selectable = tables.filter((t) => !t.protected);
    if (!tables.length) {
      truncateHost.replaceChildren(emptyState({ iconName: 'database', title: L('No tables found', 'لا توجد جداول') }));
      return;
    }
    truncateHost.replaceChildren(
      h('div', { class: 'alert alert--warning', style: { marginBottom: '12px' } },
        icon('alert-triangle'),
        L(' Protected tables (users, roles, settings, audit log, configuration) cannot be truncated.', ' الجداول المحمية (المستخدمون، الأدوار، الإعدادات، سجل التغييرات، الإعدادات الأساسية) لا يمكن تفريغها.')),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '10px' } },
        tables.map((t) => h('label', {
          class: 'card',
          style: {
            padding: '12px', display: 'flex', gap: '10px', alignItems: 'center',
            opacity: t.protected ? 0.65 : 1, cursor: t.protected ? 'not-allowed' : 'pointer',
          },
        },
          h('input', { type: 'checkbox', 'data-t': t.name, disabled: t.protected }),
          h('div', { style: { flex: '1', minWidth: '0' } },
            h('div', { class: 'strong' }, t.name),
            h('div', { class: 'faint', style: { fontSize: 'var(--fs-2xs)' } }, `${L('Rows', 'الصفوف')}: ${t.rows}`)),
          t.protected ? h('span', { class: 'badge' }, icon('lock'), L('Protected', 'محمي')) : null,
        )),
      ),
    );
    selectAll.disabled = selectable.length === 0;
    clearAll.disabled = selectable.length === 0;
    runBtn.disabled = selectable.length === 0;
  }

  async function loadTruncate() {
    truncateHost.replaceChildren(h('div', { style: { padding: '24px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
    try {
      const data = await api.get('/api/data-tools');
      tables = data.tables || [];
      renderTruncate();
    } catch (err) {
      truncateHost.replaceChildren(h('div', { class: 'alert alert--danger' }, err.message));
    }
  }

  /* ------------------------------------------------------------------ *
   * Deleted-records (trash) tab
   * ------------------------------------------------------------------ */
  const softEntities = (store.get('entities') || [])
    .filter((e) => e.softDelete && store.can(`${e.name}.read`))
    .sort((a, b) => {
      const la = (locale === 'ar' ? a.labelAr : a.labelEn) || a.name;
      const lb = (locale === 'ar' ? b.labelAr : b.labelEn) || b.name;
      return la.localeCompare(lb, locale);
    });

  if (softEntities.length) trashEntityName = softEntities[0].name;

  const entitySelect = h('select', {
    class: 'select',
    style: { minWidth: '220px' },
    onchange: () => {
      trashEntityName = entitySelect.value;
      trashLoaded = true;
      loadTrash();
    },
  }, softEntities.map((e) => h('option', { value: e.name }, (locale === 'ar' ? e.labelAr : e.labelEn) || e.name)));

  const refreshTrashBtn = h('button', {
    class: 'btn btn--sm',
    onclick: () => { trashLoaded = true; loadTrash(); },
  }, icon('refresh'), L('Refresh', 'تحديث'));

  function rowLabel(entity, row) {
    const fields = ((locale === 'ar' ? entity.displayAr : entity.displayEn) || []);
    const values = fields.map((f) => row[f]).filter((v) => v !== null && v !== undefined && v !== '');
    if (values.length) return values.join(' · ');
    const fallback = locale === 'ar'
      ? ['name_ar', 'title_ar', 'label_ar', 'code', 'name_en', 'title_en', 'username', 'email']
      : ['name_en', 'title_en', 'label_en', 'code', 'name_ar', 'title_ar', 'username', 'email'];
    for (const f of fallback) {
      if (row[f] !== null && row[f] !== undefined && row[f] !== '') return String(row[f]);
    }
    return `#${row.id}`;
  }

  function renderTrash() {
    if (!softEntities.length) {
      trashHost.replaceChildren(emptyState({
        iconName: 'archive',
        title: L('No restorable records', 'لا توجد سجلات قابلة للاستعادة'),
        message: L('No entities with soft-delete support are available.', 'لا توجد كيانات تدعم الحذف المؤقت.'),
      }));
      return;
    }
    if (!trashRows.length) {
      trashHost.replaceChildren(emptyState({
        iconName: 'archive',
        title: L('Trash is empty', 'سلة المحذوفات فارغة'),
        message: L('Deleted records will appear here and can be restored at any time.', 'ستظهر السجلات المحذوفة هنا ويمكن استعادتها في أي وقت.'),
      }));
      return;
    }
    const entity = store.entity(trashEntityName);
    trashHost.replaceChildren(
      h('div', { class: 'alert alert--info', style: { marginBottom: '12px' } },
        icon('info'),
        L(` Showing up to 100 deleted records from ${trashTotal}. Restore returns a record to its original table. Permanent deletion cannot be undone.`,
          ` يتم عرض حتى 100 سجل محذوف من أصل ${trashTotal}. الاستعادة تُرجع السجل إلى جدوله الأصلي. الحذف النهائي لا يمكن التراجع عنه.`)),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', {}, h('tr', {},
            h('th', {}, L('Record', 'السجل')),
            h('th', { style: { width: '190px' } }, L('Deleted at', 'تاريخ الحذف')),
            h('th', { style: { width: '220px' } }, L('Actions', 'الإجراءات')),
          )),
          h('tbody', {}, trashRows.map((row) => h('tr', {},
            h('td', {},
              h('div', { class: 'strong' }, entity ? rowLabel(entity, row) : `#${row.id}`),
              h('div', { class: 'faint', style: { fontSize: 'var(--fs-2xs)' } }, `${trashEntityName} · #${row.id}`),
            ),
            h('td', {}, fmtDateTime(row.deleted_at, locale)),
            h('td', {},
              h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
                h('button', {
                  class: 'btn btn--sm btn--primary',
                  onclick: () => restoreRow(row),
                }, icon('rotate-ccw'), L('Restore', 'استعادة')),
                h('button', {
                  class: 'btn btn--sm btn--danger',
                  onclick: () => purgeRow(row),
                }, icon('trash'), L('Delete forever', 'حذف نهائي')),
              ),
            ),
          ))),
        ),
      ),
    );
  }

  async function loadTrash() {
    if (!trashEntityName) {
      renderTrash();
      return;
    }
    trashHost.replaceChildren(h('div', { style: { padding: '24px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
    try {
      const data = await api.get(`/api/${encodeURIComponent(trashEntityName)}`, {
        deleted: 'only',
        pageSize: 100,
        sort: 'deleted_at desc',
      });
      trashRows = data.rows || [];
      trashTotal = Number(data.total || trashRows.length);
      renderTrash();
    } catch (err) {
      trashHost.replaceChildren(h('div', { class: 'alert alert--danger' }, err.message));
    }
  }

  async function restoreRow(row) {
    const entityName = trashEntityName;
    const entity = store.entity(entityName);
    const ok = await confirmDialog({
      title: L('Restore this record?', 'استعادة هذا السجل؟'),
      message: L(
        `${entity ? rowLabel(entity, row) : `#${row.id}`} will be returned to its original table.`,
        `سيتم إرجاع ${entity ? rowLabel(entity, row) : `#${row.id}`} إلى جدوله الأصلي.`,
      ),
      confirmText: L('Restore', 'استعادة'),
      iconName: 'rotate-ccw',
    });
    if (!ok) return;
    try {
      await api.post(`/api/${encodeURIComponent(entityName)}/${row.id}/restore`);
      notify.success(L('Record restored', 'تم استعادة السجل'), L('The record is active again.', 'أصبح السجل نشطًا مرة أخرى.'));
      await loadTrash();
    } catch (err) {
      notify.error(L('Restore failed', 'فشل الاستعادة'), err.message);
    }
  }

  async function purgeRow(row) {
    const entityName = trashEntityName;
    const entity = store.entity(entityName);
    const ok = await confirmDialog({
      title: L('Delete this record permanently?', 'حذف هذا السجل نهائيًا؟'),
      message: L(
        `${entity ? rowLabel(entity, row) : `#${row.id}`} will be permanently removed. This action cannot be undone.`,
        `سيتم حذف ${entity ? rowLabel(entity, row) : `#${row.id}`} نهائيًا. لا يمكن التراجع عن هذا الإجراء.`,
      ),
      danger: true,
      confirmText: L('Delete forever', 'حذف نهائي'),
      iconName: 'trash',
    });
    if (!ok) return;
    try {
      await api.del(`/api/${encodeURIComponent(entityName)}/${row.id}`, { hard: 1 });
      notify.success(L('Record deleted permanently', 'تم الحذف النهائي'), L('The record was removed from the database.', 'تمت إزالة السجل من قاعدة البيانات.'));
      await loadTrash();
    } catch (err) {
      notify.error(L('Permanent deletion failed', 'فشل الحذف النهائي'), err.message);
    }
  }

  /* ------------------------------------------------------------------ *
   * Layout + tabs
   * ------------------------------------------------------------------ */
  const truncateCard = card({
    title: L('Truncate tables', 'تفريغ الجداول'),
    subtitle: L('Select the tables you want to clear. Protected tables are locked.', 'حدد الجداول التي تريد تفريغها. الجداول المحمية مقفلة.'),
    actions: [selectAll, clearAll, runBtn],
    body: truncateHost,
  });

  const trashCard = card({
    title: L('Deleted records', 'السجلات المحذوفة'),
    subtitle: L('Restore soft-deleted records or remove them permanently.', 'استعد السجلات المحذوفة مؤقتًا أو احذفها نهائيًا.'),
    actions: [entitySelect, refreshTrashBtn],
    body: trashHost,
  });

  const tabTruncate = h('button', {
    class: 'is-active',
    onclick: () => setTab('truncate'),
  }, icon('database'), L('Truncate', 'تفريغ'));

  const tabTrash = h('button', {
    onclick: () => setTab('trash'),
  }, icon('archive'), L('Trash', 'سلة المحذوفات'));

  const tabs = h('div', { class: 'segmented' }, tabTruncate, tabTrash);
  const content = h('div');
  let activeTab = 'truncate';

  function setTab(tab) {
    if (activeTab === tab) return;
    activeTab = tab;
    tabTruncate.classList.toggle('is-active', tab === 'truncate');
    tabTrash.classList.toggle('is-active', tab === 'trash');
    content.replaceChildren(tab === 'truncate' ? truncateCard : trashCard);
    if (tab === 'truncate' && !tables.length) loadTruncate();
    if (tab === 'trash' && !trashLoaded) {
      trashLoaded = true;
      loadTrash();
    }
  }

  content.replaceChildren(truncateCard);

  const host = h('div', {},
    pageHeader({
      title: L('Data tools', 'أدوات البيانات'),
      subtitle: L('Truncate tables safely or restore deleted records. Protected tables are never touched.', 'فرّغ الجداول بأمان أو استعد السجلات المحذوفة. الجداول المحمية لا تُمس.'),
      iconName: 'database',
      actions: [tabs],
    }),
    h('div', { class: 'view' }, content),
  );

  await loadTruncate();
  return host;
}
