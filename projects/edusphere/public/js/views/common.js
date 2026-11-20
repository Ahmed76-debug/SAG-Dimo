/**
 * Shared building blocks for views: tables, forms, detail drawers, filters.
 */
import {
  h, icon, frag, fmtNumber, fmtMoney, fmtPercent, fmtDate, fmtDateTime,
  statusTone, initials, todayIso, debounce, humanSize, copyText,
} from '../core/dom.js';
import { t, entityLabel, fieldLabel, optionLabel, statusLabel } from '../core/i18n.js';
import { store } from '../core/store.js';
import { api } from '../core/api.js';
import {
  notify, openModal, openDrawer, confirmDialog, badge, emptyState, spinner, progressBar,
} from '../core/ui.js';

/* ------------------------------------------------------------------ *
 * Locale helpers
 * ------------------------------------------------------------------ */
export const isAr = () => store.get('locale') === 'ar';
export const L = (en, ar) => (isAr() ? ar : en);
export const tt = (key, en, ar, vars) => t(key, L(en, ar), vars);

export const money = (value, currency) => fmtMoney(value, currency || store.get('baseCurrency') || 'USD');
export const num = (value, decimals = 0) => fmtNumber(value, { decimals });
export const dateFmt = (value) => fmtDate(value, store.get('locale'));
export const dateTimeFmt = (value) => fmtDateTime(value, store.get('locale'));

const AUDIT_FIELDS = new Set(['created_at', 'updated_at', 'deleted_at', 'deleted_by', 'created_by', 'updated_by', 'password_hash', 'password']);

export function entityTitle(entity) {
  return entityLabel(entity);
}

export function entityIcon(entity) {
  return entity?.icon || 'table';
}

export function displayName(entity, row, { ar = isAr() } = {}) {
  if (!row) return '';
  const fields = (ar ? entity.displayAr : entity.displayEn) || [];
  const parts = fields.map((f) => row[f]).filter(Boolean);
  if (parts.length) return parts.join(' ');
  const fallback = ['name_en', 'title_en', 'first_name_en', 'code']
    .map((f) => row[f])
    .filter(Boolean);
  return fallback.join(' ') || `#${row.id}`;
}

export function refLabel(field, row) {
  if (!row) return '';
  const ar = isAr();
  const label = ar ? row[`${field.name}__label_ar`] : row[`${field.name}__label`];
  return label || row[`${field.name}__label`] || row[`${field.name}__label_ar`] || (row[field.name] ? `#${row[field.name]}` : '');
}

/* ------------------------------------------------------------------ *
 * Cell rendering
 * ------------------------------------------------------------------ */
export function cellContent(entity, field, row) {
  const value = row[field.name];
  if (field.type === 'ref') {
    const label = refLabel(field, row);
    return label ? h('span', { class: 'truncate' }, label) : h('span', { class: 'faint' }, '—');
  }
  if (value === null || value === undefined || value === '') return h('span', { class: 'faint' }, '—');
  switch (field.type) {
    case 'boolean':
      return value
        ? badge(tt('common.yes', 'Yes', 'نعم'), 'success')
        : badge(tt('common.no', 'No', 'لا'), 'muted');
    case 'money':
      return h('span', { class: `money ${Number(value) < 0 ? 'neg' : ''}` }, money(value));
    case 'number':
    case 'integer':
      return h('span', { class: 'num' }, num(value));
    case 'percent':
      return h('span', { class: 'num' }, fmtPercent(value));
    case 'date':
      return h('span', { class: 'nowrap' }, dateFmt(value));
    case 'datetime':
      return h('span', { class: 'nowrap' }, dateTimeFmt(value));
    case 'time':
      return h('span', { class: 'mono' }, String(value).slice(0, 5));
    case 'select': {
      if (field.name === 'status') return badge(statusLabel(value), statusTone(value));
      if (field.name === 'priority' || field.name === 'severity') {
        return badge(optionLabel(field, value), value === 'urgent' || value === 'critical' ? 'danger' : value === 'high' ? 'warning' : 'muted');
      }
      return h('span', {}, optionLabel(field, value));
    }
    case 'multiselect':
      return h('div', { class: 'row-wrap gap-2' }, (Array.isArray(value) ? value : []).slice(0, 3).map((v) => h('span', { class: 'pill' }, optionLabel(field, v))));
    case 'json':
      return h('span', { class: 'faint mono' }, JSON.stringify(value).slice(0, 48));
    case 'email':
      return h('a', { href: `mailto:${value}` }, value);
    case 'phone':
      return h('a', { href: `tel:${value}` }, value);
    case 'url':
      return h('a', { href: value, target: '_blank', rel: 'noopener' }, value);
    case 'color':
      return h('span', { class: 'row gap-2' }, h('span', { style: { width: '14px', height: '14px', borderRadius: '4px', background: value, display: 'inline-block', border: '1px solid var(--border)' } }), String(value));
    default: {
      const text = String(value);
      return h('span', { class: text.length > 90 ? 'truncate' : '' }, text.length > 90 ? `${text.slice(0, 90)}…` : text);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Table
 * ------------------------------------------------------------------ */
export function dataTable({
  columns = [],
  rows = [],
  selectable = false,
  selected = new Set(),
  onToggle = null,
  onToggleAll = null,
  onRowClick = null,
  rowActions = null,
  sort = '',
  onSort = null,
  empty = null,
  compact = false,
  minWidth = 720,
}) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const head = h('tr', {},
    selectable
      ? h('th', { class: 'col-check' },
          h('input', {
            type: 'checkbox', checked: allSelected, 'aria-label': tt('common.selectAll', 'Select all', 'تحديد الكل'),
            onchange: (e) => onToggleAll?.(e.target.checked),
          }))
      : null,
    ...columns.map((col) => {
      const isSorted = sort && col.sortable !== false && sort.split(/\s+/)[0] === col.key;
      const dir = isSorted ? sort.split(/\s+/)[1] || 'asc' : '';
      return h('th', {
        class: `${col.sortable !== false && onSort ? 'sortable' : ''} ${isSorted ? 'sorted' : ''} ${col.align === 'end' ? 'text-end' : ''}`,
        style: col.width ? { width: typeof col.width === 'number' ? `${col.width}px` : col.width } : undefined,
        onclick: col.sortable !== false && onSort ? () => onSort(col.key) : undefined,
      },
        col.label,
        onSort && col.sortable !== false
          ? h('span', { class: 'sort-ind' }, icon(isSorted && dir === 'desc' ? 'arrow-down' : 'arrow-up'))
          : null,
      );
    }),
    rowActions ? h('th', { class: 'col-actions' }, '') : null,
  );

  const body = rows.length
    ? rows.map((row) =>
        h('tr', {
          class: selected.has(row.id) ? 'is-selected' : '',
          onclick: onRowClick ? (e) => {
            if (e.target.closest('button, a, input, select, label')) return;
            onRowClick(row);
          } : undefined,
          style: onRowClick ? { cursor: 'pointer' } : undefined,
        },
          selectable
            ? h('td', { class: 'col-check' },
                h('input', {
                  type: 'checkbox', checked: selected.has(row.id), 'aria-label': tt('common.select', 'Select', 'تحديد'),
                  onclick: (e) => e.stopPropagation(),
                  onchange: () => onToggle?.(row.id),
                }))
            : null,
          ...columns.map((col) => h('td', {
            class: `${col.align === 'end' ? 'text-end num' : ''} ${col.primary ? 'primary-cell' : ''}`,
          }, col.render ? col.render(row) : cellContent(store.entity(col.entity || ''), col.field, row))),
          rowActions ? h('td', { class: 'col-actions' }, h('div', { class: 'cell-actions' }, rowActions(row))) : null,
        ),
      )
    : h('tr', {}, h('td', { colspan: columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0) }, empty || emptyState({ title: tt('common.noData', 'No data', 'لا توجد بيانات') })));

  return h('div', { class: 'table-wrap' },
    h('table', { class: `table ${compact ? 'table--compact' : ''}`, style: { minWidth: `${minWidth}px` } },
      h('thead', {}, head),
      h('tbody', {}, body),
    ),
  );
}

/* ------------------------------------------------------------------ *
 * Pagination
 * ------------------------------------------------------------------ */
export function pagination({ page = 1, pages = 1, total = 0, pageSize = 25, onPage = null, onPageSize = null }) {
  const buttons = [];
  const push = (p) => buttons.push(h('button', {
    class: `page-btn ${p === page ? 'is-active' : ''}`,
    onclick: () => onPage?.(p),
  }, String(p)));

  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(pages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  buttons.push(h('button', { class: 'page-btn', disabled: page <= 1, onclick: () => onPage?.(page - 1), 'aria-label': tt('common.previous', 'Previous', 'السابق') }, icon('chevron-left')));
  if (start > 1) { push(1); if (start > 2) buttons.push(h('span', { class: 'faint' }, '…')); }
  for (let p = start; p <= end; p += 1) push(p);
  if (end < pages) { if (end < pages - 1) buttons.push(h('span', { class: 'faint' }, '…')); push(pages); }
  buttons.push(h('button', { class: 'page-btn', disabled: page >= pages, onclick: () => onPage?.(page + 1), 'aria-label': tt('common.next', 'Next', 'التالي') }, icon('chevron-right')));

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return h('div', { class: 'pagination' },
    h('span', { class: 'pagination__info' },
      t('common.showing', L(`${from}–${to} of ${num(total)}`, `${from}–${to} من ${num(total)}`))),
    onPageSize
      ? h('div', { class: 'row gap-2' },
          h('span', { class: 'faint', style: { fontSize: 'var(--fs-2xs)' } }, tt('common.perPage', 'Rows', 'صفوف')),
          h('select', {
            class: 'select', style: { width: '78px', height: '32px' },
            onchange: (e) => onPageSize(Number(e.target.value)),
          }, [10, 25, 50, 100].map((n) => h('option', { value: n, selected: n === pageSize }, String(n)))))
      : null,
    h('div', { class: 'pagination__pages' }, buttons),
  );
}

/* ------------------------------------------------------------------ *
 * Reference option cache
 * ------------------------------------------------------------------ */
const optionCache = new Map();

export async function loadRefOptions(entityName, { force = false } = {}) {
  if (!entityName) return [];
  if (!force && optionCache.has(entityName)) return optionCache.get(entityName);
  try {
    const data = await api.get(`/api/${entityName}/options`, { limit: 400 });
    const rows = data.rows || [];
    optionCache.set(entityName, rows);
    return rows;
  } catch {
    return [];
  }
}

export function clearOptionCache() {
  optionCache.clear();
}

export function refOptionsLabel(row) {
  return isAr() ? row.label_ar || row.label : row.label || row.label_ar;
}

/* ------------------------------------------------------------------ *
 * Form field controls
 * ------------------------------------------------------------------ */
function textInput(field, value, attrs = {}) {
  return h('input', {
    class: 'input', id: `f_${field.name}`, name: field.name,
    type: attrs.type || 'text', value: value ?? '', placeholder: attrs.placeholder || '',
    step: attrs.step, min: attrs.min, max: attrs.max, autocomplete: attrs.autocomplete || 'off',
    dir: attrs.dir,
  });
}

function buildControl(field, value, refOptions) {
  const id = `f_${field.name}`;
  switch (field.type) {
    case 'text':
    case 'richtext':
    case 'json': {
      const el = h('textarea', { class: 'textarea', id, name: field.name });
      el.value = field.type === 'json'
        ? (value && typeof value === 'object' ? JSON.stringify(value, null, 2) : value ?? '')
        : value ?? '';
      return { el, get: () => el.value };
    }
    case 'boolean': {
      const input = h('input', { type: 'checkbox', id, checked: Boolean(Number(value) || value === true) });
      const el = h('label', { class: 'switch', for: id }, input, h('span', { class: 'switch__track' }));
      return { el, get: () => (input.checked ? 1 : 0), focus: () => input.focus() };
    }
    case 'select': {
      const options = field.options || [];
      const el = h('select', { class: 'select', id, name: field.name },
        field.required ? null : h('option', { value: '' }, tt('common.none', '— None —', '— بدون —')),
        options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value ?? '') },
          isAr() ? o.labelAr || o.labelEn : o.labelEn || o.labelAr)),
      );
      return { el, get: () => el.value };
    }
    case 'multiselect': {
      const options = field.options || [];
      const current = Array.isArray(value) ? value.map(String) : [];
      const inputs = [];
      const wrap = h('div', { class: 'row-wrap gap-2', id },
        options.map((o) => {
          const cb = h('input', { type: 'checkbox', value: o.value, checked: current.includes(String(o.value)) });
          inputs.push(cb);
          return h('label', { class: 'chip' }, cb, isAr() ? o.labelAr || o.labelEn : o.labelEn || o.labelAr);
        }));
      return {
        el: wrap,
        get: () => inputs.filter((i) => i.checked).map((i) => i.value),
      };
    }
    case 'ref': {
      const el = h('select', { class: 'select', id, name: field.name },
        h('option', { value: '' }, refOptions?.loading ? tt('common.loading', 'Loading…', 'جارٍ التحميل…') : tt('common.none', '— None —', '— بدون —')),
        (refOptions?.rows || []).map((o) => h('option', { value: o.value, selected: String(o.value) === String(value ?? '') }, refOptionsLabel(o))),
      );
      return { el, get: () => el.value };
    }
    case 'number':
    case 'integer':
      return { el: textInput(field, value, { type: 'number', step: field.type === 'integer' ? '1' : 'any' }), get: (el) => el.value };
    case 'money':
    case 'percent':
      return { el: textInput(field, value, { type: 'number', step: '0.01', min: field.type === 'percent' ? '0' : undefined }), get: (el) => el.value };
    case 'date':
      return { el: textInput(field, value ? String(value).slice(0, 10) : '', { type: 'date' }), get: (el) => el.value };
    case 'datetime':
      return { el: textInput(field, value ? String(value).replace(' ', 'T').slice(0, 16) : '', { type: 'datetime-local' }), get: (el) => el.value };
    case 'time':
      return { el: textInput(field, value ? String(value).slice(0, 5) : '', { type: 'time' }), get: (el) => el.value };
    case 'email':
      return { el: textInput(field, value, { type: 'email' }), get: (el) => el.value };
    case 'phone':
      return { el: textInput(field, value, { type: 'tel', dir: 'ltr' }), get: (el) => el.value };
    case 'url':
      return { el: textInput(field, value, { type: 'url', dir: 'ltr' }), get: (el) => el.value };
    case 'password': {
      const input = textInput(field, '', { type: 'password', autocomplete: 'new-password', placeholder: field.required ? '' : tt('common.optional', 'Optional', 'اختياري') });
      const toggle = h('button', {
        type: 'button', class: 'icon-btn', tabindex: '-1',
        onclick: () => {
          input.type = input.type === 'password' ? 'text' : 'password';
          toggle.replaceChildren(icon(input.type === 'password' ? 'eye' : 'eye-off'));
        },
      }, icon('eye'));
      return { el: h('div', { class: 'password-field' }, input, toggle), get: () => input.value, focus: () => input.focus() };
    }
    case 'color': {
      const input = h('input', { class: 'input', type: 'color', value: value || '#4f7cff', id, name: field.name });
      return { el: input, get: () => input.value };
    }
    case 'image':
    case 'file': {
      const input = h('input', { class: 'input', value: value ?? '', id, name: field.name, placeholder: tt('common.uploadHint', 'URL or upload a file', 'رابط أو ارفع ملفاً') });
      const file = h('input', { type: 'file', class: 'sr-only' });
      const btn = h('button', {
        type: 'button', class: 'btn btn--sm btn--outline',
        onclick: () => file.click(),
      }, icon('upload'), tt('common.upload', 'Upload', 'رفع'));
      file.addEventListener('change', async () => {
        const f = file.files?.[0];
        if (!f) return;
        try {
          btn.disabled = true;
          btn.replaceChildren(spinner(), document.createTextNode(tt('common.uploading', 'Uploading…', 'جارٍ الرفع…')));
          const res = await api.upload(f, { category: field.type === 'image' ? 'images' : 'files', entity: 'general' });
          input.value = res.path;
          notify.success(tt('common.uploaded', 'File uploaded', 'تم رفع الملف'), res.name);
        } catch (err) {
          notify.error(tt('common.error', 'Error', 'خطأ'), err.message);
        } finally {
          btn.disabled = false;
          btn.replaceChildren(icon('upload'), document.createTextNode(tt('common.upload', 'Upload', 'رفع')));
        }
      });
      return { el: h('div', { class: 'col gap-2' }, input, h('div', { class: 'row gap-2' }, btn, file)), get: () => input.value };
    }
    default:
      return { el: textInput(field, value), get: (el) => el.value };
  }
}

/* ------------------------------------------------------------------ *
 * Field grouping (forms + detail views)
 * ------------------------------------------------------------------ */
const GROUPS = [
  {
    key: 'identity',
    en: 'Identification', ar: 'البيانات الأساسية',
    names: ['code', 'admission_no', 'name_en', 'name_ar', 'title_en', 'title_ar', 'first_name_en', 'last_name_en', 'first_name_ar', 'last_name_ar', 'username', 'full_name_en', 'full_name_ar', 'invoice_no', 'receipt_no', 'entry_no', 'expense_no', 'loan_no', 'order_no', 'membership_no', 'employee_no', 'student_no', 'serial', 'reference', 'relation'],
  },
  {
    key: 'contact',
    en: 'Contact details', ar: 'بيانات الاتصال',
    names: ['email', 'mobile', 'phone', 'whatsapp', 'website', 'address', 'city', 'country', 'nationality', 'national_id', 'passport_no', 'photo', 'avatar', 'guardian_name', 'guardian_phone', 'guardian_email', 'emergency_contact', 'emergency_phone'],
  },
  {
    key: 'academic',
    en: 'Academic placement', ar: 'البيانات الأكاديمية',
    names: ['academic_year_id', 'term_id', 'grade_level_id', 'section_id', 'subject_id', 'classroom_id', 'department_id', 'curriculum_id', 'teacher_id', 'student_id', 'staff_id', 'guardian_id', 'course_id', 'module_id', 'assessment_id', 'exam_id', 'is_teacher', 'is_primary', 'grade_scale', 'max_score', 'pass_score', 'credits', 'duration_minutes', 'period', 'day_of_week'],
  },
  {
    key: 'schedule',
    en: 'Dates & schedule', ar: 'التواريخ والجدولة',
    names: ['date', 'start_date', 'end_date', 'start_time', 'end_time', 'issue_date', 'due_date', 'payment_date', 'entry_date', 'expense_date', 'loan_date', 'return_date', 'dob', 'enrollment_date', 'admission_date', 'join_date', 'hire_date', 'start_at', 'end_at', 'created_at', 'updated_at', 'processed_at', 'posted_at'],
  },
  {
    key: 'finance',
    en: 'Financial details', ar: 'البيانات المالية',
    names: ['amount', 'total', 'subtotal', 'tax_total', 'discount_total', 'paid_total', 'balance', 'unit_price', 'quantity', 'price', 'cost', 'basic_salary', 'allowances', 'deductions', 'net', 'gross', 'budget', 'actual', 'debit', 'credit', 'exchange_rate', 'currency_code', 'account_id', 'fee_structure_id', 'fee_category_id', 'fee_item_id', 'method_id', 'method', 'reference_no', 'journal_entry_id', 'vendor_id', 'customer_id', 'bank_account_id', 'tax_rate', 'discount', 'discount_percent', 'discount_amount', 'salvage_value', 'useful_life_years', 'accumulated_depreciation', 'book_value', 'fine', 'scholarship_id', 'payment_plan_id', 'installment_no'],
  },
  {
    key: 'details',
    en: 'Details', ar: 'التفاصيل',
    names: ['description', 'description_en', 'description_ar', 'notes', 'summary', 'content', 'body', 'reason', 'remarks', 'status', 'priority', 'severity', 'type', 'category', 'is_active', 'sort_order', 'color', 'tags', 'visibility', 'level', 'capacity', 'available_copies', 'total_copies', 'location', 'room', 'floor', 'area', 'latitude', 'longitude'],
  },
  {
    key: 'system',
    en: 'System', ar: 'النظام',
    names: ['created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by', 'user_id', 'role_id', 'permission_id', 'branch_id'],
  },
];

export function groupedFields(entity, { forForm = false } = {}) {
  const fields = entity.fields.filter((f) => {
    if (AUDIT_FIELDS.has(f.name) && f.name !== 'created_at' && f.name !== 'updated_at') return false;
    if (forForm && f.readonly) return false;
    if (forForm && f.type === 'password' && f.name === 'password_hash') return false;
    return true;
  });
  const assigned = new Map();
  const out = [];
  for (const group of GROUPS) {
    const list = fields.filter((f) => group.names.includes(f.name) && !assigned.has(f.name));
    list.forEach((f) => assigned.set(f.name, group.key));
    if (list.length) out.push({ ...group, fields: list });
  }
  const rest = fields.filter((f) => !assigned.has(f.name));
  if (rest.length) out.push({ key: 'other', en: 'Other information', ar: 'معلومات أخرى', fields: rest });
  return out;
}

/* ------------------------------------------------------------------ *
 * Form builder
 * ------------------------------------------------------------------ */
export async function buildForm(entity, row = {}, { onDirty = null } = {}) {
  const groups = groupedFields(entity, { forForm: true });
  const controls = new Map();
  const errors = new Map();
  let dirty = false;

  const refFields = entity.fields.filter((f) => f.type === 'ref');
  const refData = new Map();
  await Promise.all(refFields.map(async (f) => {
    const rows = await loadRefOptions(f.ref);
    refData.set(f.name, { rows });
  }));

  const sections = [];
  for (const group of groups) {
    const grid = h('div', { class: 'form-grid' });
    for (const field of group.fields) {
      const control = buildControl(field, row[field.name], refData.get(field.name));
      controls.set(field.name, control);
      const errorEl = h('div', { class: 'field__error', style: { display: 'none' } });
      errors.set(field.name, errorEl);
      const isWide = ['text', 'richtext', 'json', 'multiselect', 'file', 'image'].includes(field.type);
      const isBool = field.type === 'boolean';

      const fieldEl = isBool
        ? h('div', { class: 'field', style: { justifyContent: 'flex-end' } },
            h('div', { class: 'row gap-2' }, control.el, h('span', { class: 'strong', style: { fontSize: 'var(--fs-sm)' } }, fieldLabel(field))),
            errorEl)
        : h('div', { class: `field ${isWide ? 'span-full' : ''}` },
            h('label', { class: 'field__label', for: `f_${field.name}` },
              fieldLabel(field), field.required ? h('span', { class: 'req' }, '*') : null),
            control.el,
            errorEl);

      fieldEl.addEventListener('input', () => { dirty = true; onDirty?.(true); });
      fieldEl.addEventListener('change', () => { dirty = true; onDirty?.(true); });
      grid.appendChild(fieldEl);
    }
    sections.push(h('div', { class: 'form-section' },
      h('div', { class: 'form-section__title' }, L(group.en, group.ar)),
      grid,
    ));
  }

  const el = h('div', { class: 'entity-form' }, sections);

  function getValues() {
    const values = {};
    for (const [name, control] of controls) {
      const field = entity.fields.find((f) => f.name === name);
      let value = control.get.length ? control.get(control.el) : control.get();
      if (field.type === 'password' && !value) continue;
      if (field.type === 'json' && typeof value === 'string' && value.trim()) {
        try { value = JSON.parse(value); } catch { /* keep raw; server reports */ }
      }
      values[name] = value;
    }
    return values;
  }

  function setErrors(list = []) {
    for (const errorEl of errors.values()) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }
    el.querySelectorAll('.is-invalid').forEach((n) => n.classList.remove('is-invalid'));
    let first = null;
    for (const err of list) {
      const errorEl = errors.get(err.field);
      if (!errorEl) continue;
      const message = validationMessage(err);
      errorEl.textContent = message;
      errorEl.style.display = 'flex';
      const control = controls.get(err.field);
      const input = control?.el?.matches?.('input, select, textarea') ? control.el : control?.el?.querySelector?.('input, select, textarea');
      if (input) {
        input.classList.add('is-invalid');
        first = first || input;
      }
    }
    first?.focus();
  }

  function validate() {
    const list = [];
    const values = getValues();
    for (const field of entity.fields) {
      if (!controls.has(field.name)) continue;
      const value = values[field.name];
      const empty = value === '' || value === null || value === undefined || (Array.isArray(value) && !value.length);
      if (field.required && empty) list.push({ field: field.name, code: 'required' });
      else if (field.type === 'email' && value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) list.push({ field: field.name, code: 'email' });
      else if (field.min && typeof value === 'string' && value.length < field.min) list.push({ field: field.name, code: 'minLength', min: field.min });
      else if (field.type === 'password' && value && String(value).length < 6) list.push({ field: field.name, code: 'minLength', min: 6 });
    }
    return list;
  }

  return { el, getValues, setErrors, validate, isDirty: () => dirty };
}

export function validationMessage(err) {
  switch (err.code) {
    case 'required': return tt('validation.required', 'This field is required', 'هذا الحقل مطلوب');
    case 'email': return tt('validation.email', 'Enter a valid email address', 'أدخل بريداً إلكترونياً صالحاً');
    case 'minLength': return t('validation.minLength', L(`At least ${err.min} characters`, `على الأقل ${err.min} أحرف`), { min: err.min });
    case 'max': return t('validation.max', L(`Maximum ${err.max}`, `الحد الأقصى ${err.max}`), { max: err.max });
    case 'unique': return tt('validation.unique', 'This value is already in use', 'هذه القيمة مستخدمة بالفعل');
    case 'option': return tt('validation.option', 'Choose a valid option', 'اختر قيمة صحيحة');
    case 'number': return tt('validation.number', 'Enter a valid number', 'أدخل رقماً صحيحاً');
    default: return err.message || tt('validation.invalid', 'Invalid value', 'قيمة غير صحيحة');
  }
}

/* ------------------------------------------------------------------ *
 * Entity form drawer
 * ------------------------------------------------------------------ */
export async function openEntityForm(entity, { id = null, defaults = {}, onSaved = null } = {}) {
  let row = { ...defaults };
  let loading = false;
  const title = id
    ? t('common.editEntity', L(`Edit ${entity.labelEn}`, `تعديل ${entity.labelAr}`))
    : t('common.newEntity', L(`New ${entity.labelEn}`, `إضافة ${entity.labelAr}`));

  const bodyWrap = h('div', {}, h('div', { style: { padding: '32px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
  const drawer = openDrawer({
    title,
    subtitle: entity.labelEn,
    wide: true,
    body: bodyWrap,
    footer: null,
  });

  if (id) {
    try {
      const data = await api.get(`/api/${entity.name}/${id}`);
      row = data.row || row;
    } catch (err) {
      notify.error(tt('common.error', 'Error', 'خطأ'), err.message);
      drawer.close();
      return;
    }
  }

  const form = await buildForm(entity, row);
  const saveBtn = h('button', { class: 'btn btn--primary' }, icon('save'), tt('common.save', 'Save', 'حفظ'));
  const saveNewBtn = id ? null : h('button', { class: 'btn btn--soft' }, tt('common.saveAndNew', 'Save & new', 'حفظ وإضافة'));
  const cancelBtn = h('button', { class: 'btn' }, tt('common.cancel', 'Cancel', 'إلغاء'));
  const foot = h('div', { class: 'drawer__foot', style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } }, cancelBtn, saveNewBtn, saveBtn);
  drawer.el.appendChild(foot);
  bodyWrap.replaceChildren(form.el);

  const close = () => drawer.close();
  cancelBtn.addEventListener('click', close);

  async function submit(andNew = false) {
    const clientErrors = form.validate();
    if (clientErrors.length) {
      form.setErrors(clientErrors);
      notify.warning(tt('validation.fixErrors', 'Please fix the highlighted fields', 'يرجى تصحيح الحقول المحددة'));
      return;
    }
    saveBtn.disabled = true;
    saveNewBtn && (saveNewBtn.disabled = true);
    const original = saveBtn.innerHTML;
    saveBtn.replaceChildren(spinner(), document.createTextNode(tt('common.saving', 'Saving…', 'جارٍ الحفظ…')));
    try {
      const payload = form.getValues();
      const data = id
        ? await api.patch(`/api/${entity.name}/${id}`, payload)
        : await api.post(`/api/${entity.name}`, payload);
      notify.success(tt('common.saved', 'Saved successfully', 'تم الحفظ بنجاح'), displayName(entity, data.row || payload));
      clearOptionCache();
      onSaved?.(data.row);
      if (andNew) {
        drawer.close();
        openEntityForm(entity, { defaults, onSaved });
      } else {
        close();
      }
    } catch (err) {
      if (err.data?.errors) {
        form.setErrors(err.data.errors);
        notify.warning(tt('validation.fixErrors', 'Please fix the highlighted fields', 'يرجى تصحيح الحقول المحددة'));
      } else {
        notify.error(tt('common.error', 'Error', 'خطأ'), err.message);
      }
    } finally {
      saveBtn.disabled = false;
      if (saveNewBtn) saveNewBtn.disabled = false;
      saveBtn.innerHTML = original;
    }
  }

  saveBtn.addEventListener('click', () => submit(false));
  saveNewBtn?.addEventListener('click', () => submit(true));
  form.el.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit(false);
  });
}

/* ------------------------------------------------------------------ *
 * Entity detail drawer
 * ------------------------------------------------------------------ */
export async function openEntityDetail(entity, id, { onChanged = null } = {}) {
  const body = h('div', { style: { padding: '32px', display: 'grid', placeItems: 'center' } }, spinner('lg'));
  const drawer = openDrawer({
    title: entityTitle(entity),
    subtitle: `#${id}`,
    wide: true,
    body,
    footer: null,
  });

  let row;
  try {
    const data = await api.get(`/api/${entity.name}/${id}`);
    row = data.row;
  } catch (err) {
    notify.error(tt('common.error', 'Error', 'خطأ'), err.message);
    drawer.close();
    return;
  }

  const groups = groupedFields(entity).filter((g) => g.key !== 'system' || store.can(`${entity.name}.update`));
  const sections = groups.map((group) => h('div', { class: 'detail-section' },
    h('h3', {}, L(group.en, group.ar)),
    h('div', { class: 'kv' },
      group.fields.map((field) => h('div', { class: 'kv__item' },
        h('div', { class: 'kv__label' }, fieldLabel(field)),
        h('div', { class: 'kv__value' }, cellContent(entity, field, row)),
      )),
    ),
  ));

  const avatar = entity.fields.some((f) => f.name === 'photo' || f.name === 'avatar')
    ? h('div', { class: 'detail-hero__avatar' },
        row.photo || row.avatar
          ? h('img', { src: row.photo || row.avatar, alt: '' })
          : initials(displayName(entity, row)))
    : h('div', { class: 'detail-hero__avatar' }, initials(displayName(entity, row)));

  const statusField = entity.fields.find((f) => f.name === 'status');
  const actions = [];
  if (store.can(`${entity.name}.update`)) {
    actions.push(h('button', {
      class: 'btn btn--primary btn--sm',
      onclick: () => { drawer.close(); openEntityForm(entity, { id, onSaved: (r) => { onChanged?.(r); } }); },
    }, icon('edit'), tt('common.edit', 'Edit', 'تعديل')));
  }
  if (entity.name === 'students') {
    actions.push(h('a', { class: 'btn btn--sm', href: `#/reports/student-statement?student=${id}` }, icon('receipt'), tt('finance.statement', 'Statement', 'كشف حساب')));
  }
  if (store.can(`${entity.name}.delete`)) {
    actions.push(h('button', {
      class: 'btn btn--danger btn--sm',
      onclick: async () => {
        const ok = await confirmDialog({
          title: tt('common.confirmDelete', 'Delete record?', 'حذف السجل؟'),
          message: tt('common.confirmDeleteMsg', 'The record will be archived and can be restored later.', 'سيتم أرشفة السجل ويمكن استعادته لاحقاً.'),
          confirmText: tt('common.delete', 'Delete', 'حذف'),
          danger: true,
          iconName: 'trash',
        });
        if (!ok) return;
        try {
          await api.del(`/api/${entity.name}/${id}`);
          notify.success(tt('common.deleted', 'Record archived', 'تم أرشفة السجل'));
          drawer.close();
          onChanged?.(null);
        } catch (err) {
          notify.error(tt('common.error', 'Error', 'خطأ'), err.message);
        }
      },
    }, icon('trash'), tt('common.delete', 'Delete', 'حذف')));
  }

  body.replaceChildren(
    h('div', { class: 'detail-hero' },
      avatar,
      h('div', { class: 'detail-hero__meta' },
        h('h2', {}, displayName(entity, row), statusField && row.status ? badge(statusLabel(row.status), statusTone(row.status)) : null),
        h('p', {}, [row.code, row.email, row.mobile].filter(Boolean).join(' · ') || `#${row.id}`),
      ),
      h('div', { class: 'detail-hero__actions' }, actions),
    ),
    h('div', { class: 'card', style: { boxShadow: 'none' } }, sections),
    row.deleted_at
      ? h('div', { class: 'archive-banner', style: { margin: '16px 24px' } }, icon('archive'), tt('common.archivedNotice', 'This record is archived.', 'هذا السجل مؤرشف.'))
      : null,
  );
}

/* ------------------------------------------------------------------ *
 * Delete / restore helpers
 * ------------------------------------------------------------------ */
export async function deleteEntityRow(entity, row, { onDone = null } = {}) {
  const ok = await confirmDialog({
    title: tt('common.confirmDelete', 'Delete record?', 'حذف السجل؟'),
    message: L(`“${displayName(entity, row)}” will be archived.`, `سيتم أرشفة «${displayName(entity, row)}».`),
    confirmText: tt('common.delete', 'Delete', 'حذف'),
    danger: true,
    iconName: 'trash',
  });
  if (!ok) return false;
  try {
    await api.del(`/api/${entity.name}/${row.id}`);
    notify.success(tt('common.deleted', 'Record archived', 'تم أرشفة السجل'));
    onDone?.();
    return true;
  } catch (err) {
    notify.error(tt('common.error', 'Error', 'خطأ'), err.message);
    return false;
  }
}

export async function restoreEntityRow(entity, row, { onDone = null } = {}) {
  try {
    await api.post(`/api/${entity.name}/${row.id}/restore`);
    notify.success(tt('common.restored', 'Record restored', 'تم استعادة السجل'));
    onDone?.();
  } catch (err) {
    notify.error(tt('common.error', 'Error', 'خطأ'), err.message);
  }
}

/* ------------------------------------------------------------------ *
 * Misc UI
 * ------------------------------------------------------------------ */
export function kpiCard({ label, value, iconName = 'chart', tint = 'var(--brand-050)', color = 'var(--brand)', foot = null, small = null }) {
  return h('div', { class: 'kpi', style: { '--kpi-tint': tint, '--kpi-color': color } },
    h('div', { class: 'kpi__top' },
      h('div', {}, h('div', { class: 'kpi__label' }, label)),
      h('div', { class: 'kpi__icon' }, icon(iconName)),
    ),
    h('div', { class: 'kpi__value' }, value, small ? h('small', {}, ` ${small}`) : null),
    foot ? h('div', { class: 'kpi__foot' }, foot) : null,
  );
}

export function sectionTitle(title, actions = []) {
  return h('div', { class: 'row', style: { marginBottom: 'var(--sp-3)' } },
    h('h2', { style: { fontSize: 'var(--fs-lg)' } }, title),
    h('div', { class: 'grow' }),
    ...actions,
  );
}

export function kvItem(label, value) {
  return h('div', { class: 'kv__item' },
    h('div', { class: 'kv__label' }, label),
    h('div', { class: `kv__value ${value ? '' : 'empty-val'}` }, value || '—'),
  );
}

export function filterSelect({ label, value, options, onChange, anyLabel = null }) {
  return h('label', { class: 'row gap-2', style: { fontSize: 'var(--fs-2xs)', color: 'var(--muted)' } },
    h('span', {}, label),
    h('select', { class: 'select', onchange: (e) => onChange(e.target.value) },
      h('option', { value: '' }, anyLabel || tt('common.all', 'All', 'الكل')),
      options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value ?? '') }, o.label)),
    ),
  );
}

export function searchInput({ value = '', placeholder, onSearch, delay = 300 }) {
  const input = h('input', { class: 'input', type: 'search', value, placeholder });
  const debounced = debounce((v) => onSearch(v), delay);
  input.addEventListener('input', () => debounced(input.value.trim()));
  return { el: h('div', { class: 'toolbar__search' }, icon('search'), input), input };
}

export function printArea(node, title) {
  const w = window.open('', '_blank', 'width=1000,height=760');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#111}
    table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:6px 8px;border-bottom:1px solid #ddd;text-align:start}
    th{background:#f3f5f9;text-transform:uppercase;font-size:10px;letter-spacing:.05em}
    h1{font-size:18px;margin:0 0 4px}p{font-size:11px;color:#555;margin:0 0 16px}
    .report-total{display:flex;justify-content:space-between;font-weight:700;padding:8px 0;border-top:2px solid #999}
    .report-section{margin-bottom:20px}.report-section h3{font-size:12px;text-transform:uppercase;margin:0 0 8px;color:#333}
    </style></head><body><h1>${title}</h1><p>${store.get('settings')?.school?.name_en || 'EduSphere'} — ${new Date().toLocaleString()}</p>${node.outerHTML}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}

export { badge, emptyState, spinner, progressBar, confirmDialog, notify, copyText, humanSize, todayIso, debounce };
