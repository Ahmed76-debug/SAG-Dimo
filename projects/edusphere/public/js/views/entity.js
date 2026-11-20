import { h, icon, frag, debounce } from '../core/dom.js';
import { store } from '../core/store.js';
import { api } from '../core/api.js';
import { router, navigate, href, buildQuery } from '../core/router.js';
import { pageHeader, card, badge, emptyState, spinner, confirmDialog, notify, breadcrumbs } from '../core/ui.js';
import { t, entityLabel, fieldLabel } from '../core/i18n.js';
import {
  L, tt, isAr, dataTable, pagination, searchInput, openEntityForm, openEntityDetail,
  deleteEntityRow, restoreEntityRow, cellContent, displayName, loadRefOptions,
  refOptionsLabel, money, dateFmt,
} from './common.js';

export default async function renderEntity(route) {
  const name = route.params.entity;
  const entity = store.entity(name);
  if (!entity) return renderMissing(name);
  if (!store.can(`${name}.read`)) return renderForbidden(entity);

  // Detail route: /e/:entity/:id
  if (route.params.id) return renderEntityPage(entity, route.params.id);

  return renderEntityList(entity, route);
}

function renderMissing(name) {
  return h('div', { class: 'view' },
    card({ body: emptyState({ iconName: 'table', title: tt('entity.notFound', 'Module not found', 'الوحدة غير موجودة'), message: name, action: h('a', { class: 'btn', href: '#/modules' }, L('All modules', 'جميع الوحدات')) }) }));
}

function renderForbidden(entity) {
  return h('div', { class: 'view' },
    card({ body: emptyState({ iconName: 'shield', title: L('Access denied', 'الوصول مرفوض'), message: L(`You do not have permission to view ${entity.labelEn}.`, `ليس لديك صلاحية لعرض ${entity.labelAr}.`) }) }));
}

async function renderEntityList(entity, route) {
  const state = {
    page: Number(route.query.page || 1),
    pageSize: Number(route.query.pageSize || 25),
    q: route.query.q || '',
    sort: route.query.sort || '',
    deleted: route.query.deleted || 'exclude',
    filter: { ...(route.query.filter || {}) },
  };
  const selected = new Set();
  let data = { rows: [], total: 0, pages: 1, page: 1, pageSize: state.pageSize };

  const tableHost = h('div', {}, h('div', { style: { padding: '28px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
  const pagerHost = h('div');
  const summaryHost = h('div', { class: 'faint', style: { fontSize: 'var(--fs-xs)' } });

  function syncUrl() {
    const q = { page: state.page, pageSize: state.pageSize, q: state.q, sort: state.sort, deleted: state.deleted, filter: state.filter };
    history.replaceState(null, '', href(`/e/${entity.name}`, q));
  }

  const listFields = entity.fields.filter((f) => f.list).slice(0, 8);
  if (!listFields.find((f) => f.name === 'code') && entity.fields.find((f) => f.name === 'code' && f.list !== false)) {
    // keep as is
  }
  const columns = listFields.map((f) => ({
    key: f.name,
    label: fieldLabel(f),
    sortable: !['json', 'text', 'richtext', 'multiselect', 'file', 'image'].includes(f.type),
    align: ['money', 'number', 'integer', 'percent'].includes(f.type) ? 'end' : 'start',
    field: f,
    entity: entity.name,
    render: (row) => cellContent(entity, f, row),
  }));

  async function load() {
    try {
      data = await api.get(`/api/${entity.name}`, {
        page: state.page, pageSize: state.pageSize, q: state.q || undefined,
        sort: state.sort || undefined, deleted: state.deleted, filter: state.filter,
      });
      state.page = data.page || state.page;
      renderTable();
      renderPager();
    } catch (err) {
      tableHost.replaceChildren(emptyState({ iconName: 'alert-triangle', title: L('Failed to load data', 'تعذّر تحميل البيانات'), message: err.message }));
    }
  }

  function renderPager() {
    pagerHost.replaceChildren(pagination({
      page: data.page || 1, pages: data.pages || 1, total: data.total || 0, pageSize: state.pageSize,
      onPage: (p) => { state.page = p; syncUrl(); load(); },
      onPageSize: (ps) => { state.pageSize = ps; state.page = 1; syncUrl(); load(); },
    }));
  }

  function renderTable() {
    summaryHost.textContent = L(`${data.total || 0} records`, `${data.total || 0} سجل`);
    tableHost.replaceChildren(dataTable({
      columns,
      rows: data.rows || [],
      selectable: store.can(`${entity.name}.update`) || store.can(`${entity.name}.delete`),
      selected,
      onToggle: (id) => { if (selected.has(id)) selected.delete(id); else selected.add(id); renderTable(); renderBulk(); },
      onToggleAll: (checked) => { selected.clear(); if (checked) for (const r of data.rows || []) selected.add(r.id); renderTable(); renderBulk(); },
      onSort: (key) => {
        const [cur, dir] = (state.sort || '').split(/\s+/);
        state.sort = cur === key && dir === 'asc' ? `${key} desc` : `${key} asc`;
        state.page = 1; syncUrl(); load();
      },
      sort: state.sort,
      onRowClick: (row) => openEntityDetail(entity, row.id, { onChanged: () => load() }),
      rowActions: (row) => rowActions(entity, row, load),
      empty: emptyState({
        iconName: entity.icon || 'inbox',
        title: tt('common.noData', 'No records yet', 'لا توجد سجلات بعد'),
        message: L('Create the first record to get started.', 'أنشئ أول سجل للبدء.'),
        action: store.can(`${entity.name}.create`) ? h('button', { class: 'btn btn--primary btn--sm', onclick: () => openEntityForm(entity, { onSaved: () => load() }) }, icon('plus'), tt('common.create', 'Create', 'إنشاء')) : null,
      }),
      minWidth: Math.max(720, columns.length * 140),
    }));
  }

  // Filters
  const filterFields = entity.fields.filter((f) => f.filter);
  const filterBar = h('div', { class: 'toolbar__filters' });
  const filterControls = new Map();

  async function buildFilters() {
    for (const f of filterFields.slice(0, 6)) {
      if (f.type === 'select' && f.options) {
        const sel = h('select', { class: 'select', onchange: (e) => { setFilter(f.name, e.target.value); } },
          h('option', { value: '' }, `${fieldLabel(f)}: ${tt('common.all', 'All', 'الكل')}`),
          f.options.map((o) => h('option', { value: o.value, selected: String(state.filter[f.name] ?? '') === String(o.value) }, L(o.labelEn, o.labelAr || o.labelEn))));
        filterControls.set(f.name, sel);
        filterBar.appendChild(sel);
      } else if (f.type === 'ref') {
        const sel = h('select', { class: 'select', onchange: (e) => { setFilter(f.name, e.target.value); } },
          h('option', { value: '' }, `${fieldLabel(f)}: ${tt('common.all', 'All', 'الكل')}`));
        filterControls.set(f.name, sel);
        filterBar.appendChild(sel);
        loadRefOptions(f.ref).then((rows) => {
          for (const r of rows) sel.appendChild(h('option', { value: r.value, selected: String(state.filter[f.name] ?? '') === String(r.value) }, refOptionsLabel(r)));
        });
      } else if (f.type === 'boolean') {
        const sel = h('select', { class: 'select', onchange: (e) => { setFilter(f.name, e.target.value); } },
          h('option', { value: '' }, `${fieldLabel(f)}: ${tt('common.all', 'All', 'الكل')}`),
          h('option', { value: '1', selected: String(state.filter[f.name]) === '1' }, tt('common.yes', 'Yes', 'نعم')),
          h('option', { value: '0', selected: String(state.filter[f.name]) === '0' }, tt('common.no', 'No', 'لا')));
        filterControls.set(f.name, sel);
        filterBar.appendChild(sel);
      }
    }
  }

  function setFilter(key, value) {
    if (value === '' || value == null) delete state.filter[key];
    else state.filter[key] = value;
    state.page = 1; syncUrl(); load();
  }

  const { el: searchEl, input: searchInp } = searchInput({
    value: state.q,
    placeholder: L(`Search ${entity.labelEn.toLowerCase()}…`, `بحث في ${entity.labelAr}…`),
    onSearch: (v) => { state.q = v; state.page = 1; syncUrl(); load(); },
  });

  const deletedSel = entity.softDelete !== false ? h('select', {
    class: 'select',
    onchange: (e) => { state.deleted = e.target.value; state.page = 1; syncUrl(); load(); },
  },
    h('option', { value: 'exclude', selected: state.deleted === 'exclude' }, L('Active', 'النشطة')),
    h('option', { value: 'only', selected: state.deleted === 'only' }, L('Archived', 'المؤرشفة')),
    h('option', { value: 'with', selected: state.deleted === 'with' }, L('All records', 'كل السجلات')),
  ) : null;

  const bulkBar = h('div', { class: 'bulk-bar', style: { display: 'none' } });
  function renderBulk() {
    const n = selected.size;
    if (!n) { bulkBar.style.display = 'none'; bulkBar.replaceChildren(); return; }
    bulkBar.style.display = 'flex';
    const delBtn = store.can(`${entity.name}.delete`) ? h('button', { class: 'btn btn--danger btn--sm', onclick: async () => {
      const ok = await confirmDialog({ title: L('Archive selected?', 'أرشفة المحدد؟'), message: L(`${n} records will be archived.`, `سيتم أرشفة ${n} سجلات.`), confirmText: L('Archive', 'أرشفة'), danger: true, iconName: 'archive' });
      if (!ok) return;
      try { await api.post(`/api/${entity.name}/bulk/delete`, { ids: [...selected] }); notify.success(L('Records archived', 'تمت أرشفة السجلات')); selected.clear(); load(); renderBulk(); }
      catch (err) { notify.error(L('Error', 'خطأ'), err.message); }
    } }, icon('archive'), L('Archive', 'أرشفة')) : null;
    const restoreBtn = store.can(`${entity.name}.update`) ? h('button', { class: 'btn btn--sm', onclick: async () => {
      try { await api.post(`/api/${entity.name}/bulk/restore`, { ids: [...selected] }); notify.success(L('Records restored', 'تمت استعادة السجلات')); selected.clear(); load(); renderBulk(); }
      catch (err) { notify.error(L('Error', 'خطأ'), err.message); }
    } }, icon('rotate-ccw'), L('Restore', 'استعادة')) : null;
    bulkBar.replaceChildren(
      h('span', { class: 'bulk-bar__count' }, L(`${n} selected`, `${n} محدد`)),
      h('div', { class: 'grow' }),
      state.deleted === 'only' ? restoreBtn : delBtn,
      h('button', { class: 'btn btn--ghost btn--sm', onclick: () => { selected.clear(); renderTable(); renderBulk(); } }, icon('x'), L('Clear', 'مسح')),
    );
  }

  const addBtn = store.can(`${entity.name}.create`) ? h('button', {
    class: 'btn btn--primary',
    onclick: () => openEntityForm(entity, { onSaved: () => load() }),
  }, icon('plus'), t(`entity.new.${entity.name}`, L(`New ${entity.labelEn.replace(/s$/, '')}`, `إضافة ${entity.labelAr}`))) : null;

  const exportBtn = h('button', {
    class: 'btn btn--ghost btn--sm', title: L('Export CSV', 'تصدير CSV'),
    onclick: async () => {
      try { await api.download(`/api/${entity.name}/export`, `${entity.name}.csv`, { q: state.q || undefined, filter: state.filter, sort: state.sort || undefined, deleted: state.deleted }); }
      catch (err) { notify.error(L('Export failed', 'فشل التصدير'), err.message); }
    },
  }, icon('download'));

  const refreshBtn = h('button', { class: 'btn btn--ghost btn--sm', title: L('Refresh', 'تحديث'), onclick: () => load() }, icon('refresh'));

  const specialBtns = specialActions(entity, load);

  buildFilters();
  load();

  return h('div', { class: 'view view--entity' },
    pageHeader({
      title: entityLabel(entity),
      subtitle: entity.group ? L(entity.groupLabel?.en || '', entity.groupLabel?.ar || '') : '',
      iconName: entity.icon || 'table',
      actions: [exportBtn, refreshBtn, ...specialBtns, addBtn].filter(Boolean),
      breadcrumbs: breadcrumbs([{ label: L('Modules', 'الوحدات'), href: '#/modules' }, { label: entityLabel(entity) }]),
    }),
    card({
      flush: true,
      body: h('div', {},
        h('div', { class: 'toolbar', style: { padding: '12px 14px', borderBottom: '1px solid var(--border)' } },
          searchEl, filterBar, h('div', { class: 'grow' }), deletedSel),
        bulkBar,
        tableHost,
        h('div', { style: { padding: '10px 14px', borderTop: '1px solid var(--border)' } }, pagerHost),
      ),
    }),
  );
}

function rowActions(entity, row, reload) {
  const actions = [];
  if (store.can(`${entity.name}.update`)) {
    actions.push(h('button', { class: 'icon-btn icon-btn--sm', title: L('Edit', 'تعديل'), onclick: (e) => { e.stopPropagation(); openEntityForm(entity, { id: row.id, onSaved: reload }); } }, icon('edit')));
  }
  if (entity.softDelete !== false && row.deleted_at && store.can(`${entity.name}.update`)) {
    actions.push(h('button', { class: 'icon-btn icon-btn--sm', title: L('Restore', 'استعادة'), onclick: (e) => { e.stopPropagation(); restoreEntityRow(entity, row, { onDone: reload }); } }, icon('rotate-ccw')));
  } else if (store.can(`${entity.name}.delete`)) {
    actions.push(h('button', { class: 'icon-btn icon-btn--sm', title: L('Archive', 'أرشفة'), onclick: (e) => { e.stopPropagation(); deleteEntityRow(entity, row, { onDone: reload }); } }, icon('trash')));
  }
  return actions;
}

function specialActions(entity, reload) {
  const out = [];
  if (entity.name === 'journal_entries' && store.can('journal_entries.create')) {
    // handled by form normally; posting could be special but keep generic
  }
  if (entity.name === 'payroll_runs' && store.can('payroll_runs.update')) {
    // processing exposed via dedicated endpoint can be added in row click; keep UI simple
  }
  return out;
}

async function renderEntityPage(entity, id) {
  const body = h('div', { style: { padding: '40px', display: 'grid', placeItems: 'center' } }, spinner('lg'));
  const wrap = h('div', { class: 'view view--entity-detail' },
    pageHeader({
      title: entityLabel(entity), subtitle: `#${id}`, iconName: entity.icon || 'table',
      breadcrumbs: breadcrumbs([
        { label: L('Modules', 'الوحدات'), href: '#/modules' },
        { label: entityLabel(entity), href: `#/e/${entity.name}` },
        { label: `#${id}` },
      ]),
      actions: [h('a', { class: 'btn', href: `#/e/${entity.name}` }, icon(L('arrow-left', 'arrow-right')), L('Back', 'رجوع'))],
    }),
    card({ body }),
  );

  try {
    const data = await api.get(`/api/${entity.name}/${id}`);
    const row = data.row;
    body.replaceChildren(renderRecord(entity, row));
  } catch (err) {
    body.replaceChildren(emptyState({ iconName: 'alert-triangle', title: L('Record not found', 'السجل غير موجود'), message: err.message }));
  }
  return wrap;
}

function renderRecord(entity, row) {
  const fields = entity.fields.filter((f) => !['password_hash', 'password', 'deleted_by'].includes(f.name));
  return h('div', { class: 'detail-sections' },
    h('div', { class: 'detail-hero', style: { marginBottom: '16px' } },
      h('div', { class: 'detail-hero__meta' },
        h('h2', {}, displayName(entity, row)),
        h('p', {}, [row.code, row.status, row.email].filter(Boolean).join(' · '))),
      h('div', { class: 'detail-hero__actions' },
        store.can(`${entity.name}.update`) ? h('button', { class: 'btn btn--primary btn--sm', onclick: () => openEntityForm(entity, { id: row.id, onSaved: () => navigate(`/e/${entity.name}/${row.id}`) }) }, icon('edit'), L('Edit', 'تعديل')) : null),
    ),
    h('div', { class: 'kv' },
      fields.slice(0, 40).map((f) => h('div', { class: 'kv__item' },
        h('div', { class: 'kv__label' }, fieldLabel(f)),
        h('div', { class: 'kv__value' }, cellContent(entity, f, row))))),
  );
}
