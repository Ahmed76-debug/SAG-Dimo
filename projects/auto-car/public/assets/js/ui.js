/* ============================================================
   Auto Car — مكتبة الواجهة: مودال، جداول، نماذج، محرّك CRUD، رسوم
   ============================================================ */
import { state, t, esc, icon, el, api, toast, fmtNum, money, debounce, pick, can, THEMES, applyTheme, themeLabel } from './core.js';

/* ============================================================
   المودال
   ============================================================ */
export function modal({ title = '', body = '', footer = '', size = '', onMount, closeOnBackdrop = true } = {}) {
  const root = document.getElementById('modal-root');
  const backdrop = el(`<div class="modal-backdrop">
    <div class="modal ${size}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close">${icon('x')}</button></div>
      <div class="modal-body"></div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>
  </div>`);
  const bodyEl = backdrop.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
  root.appendChild(backdrop);
  const close = () => { backdrop.style.animation = 'fadeIn .15s reverse'; setTimeout(() => backdrop.remove(), 130); };
  backdrop.querySelector('.modal-close').onclick = close;
  if (closeOnBackdrop) backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  const escHandler = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
  if (onMount) onMount(backdrop, close);
  const first = backdrop.querySelector('input,select,textarea'); if (first) setTimeout(() => first.focus(), 60);
  return { node: backdrop, close, body: bodyEl };
}

export function confirmDialog(message, { title = '', danger = true, okText = '' } = {}) {
  return new Promise((resolve) => {
    const m = modal({
      title: title || t('confirm'),
      size: '',
      body: `<div class="row" style="gap:14px"><div style="width:46px;height:46px;border-radius:13px;display:grid;place-items:center;flex:none" class="${danger ? 'tone-danger' : 'tone-info'}">${icon('alert', 'lg')}</div><div><div class="strong" style="font-size:16px">${esc(message)}</div>${danger ? `<div class="small muted mt-1">${t('cannot_undo')}</div>` : ''}</div></div>`,
      footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText || t('confirm'))}</button>`,
    });
    m.node.querySelector('[data-x]').onclick = () => { m.close(); resolve(false); };
    m.node.querySelector('[data-ok]').onclick = () => { m.close(); resolve(true); };
  });
}

/* ============================================================
   القوائم المنسدلة
   ============================================================ */
export function dropdown(anchor, items) {
  const wrap = anchor.closest('.pop-wrap') || anchor.parentElement;
  const existing = wrap.querySelector('.dropdown');
  if (existing) { existing.remove(); return; }
  const menu = el(`<div class="dropdown">${items.map((it, i) => it.sep ? '<div class="dropdown-sep"></div>' : `<div class="dropdown-item ${it.danger ? 'danger' : ''}" data-i="${i}">${it.icon ? icon(it.icon, 'sm') : ''}<span>${esc(it.label)}</span></div>`).join('')}</div>`);
  wrap.appendChild(menu);
  const off = (e) => { if (!wrap.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', off); } };
  setTimeout(() => document.addEventListener('mousedown', off), 10);
  menu.querySelectorAll('.dropdown-item').forEach((n) => {
    n.onclick = () => { const it = items[Number(n.dataset.i)]; menu.remove(); it.onClick && it.onClick(); };
  });
  return menu;
}

/* ============================================================
   الشارات
   ============================================================ */
const STATUS_TONE = {
  available: ['badge-success', 'available'], reserved: ['badge-warn', 'reserved'], sold: ['badge-brand', 'sold'], returned: ['badge-danger', 'returned'],
  pending: ['badge-warn', 'pending'], partial: ['badge-info', 'partial'], overdue: ['badge-danger', 'overdue'], paid: ['badge-success', 'paid'],
  active: ['badge-success', 'active'], closed: ['badge-info', 'closed'], defaulted: ['badge-danger', 'defaulted'],
  completed: ['badge-success', 'completed'], new: ['badge-brand', 'new_car'], used: ['badge-info', 'used_car'],
  own: ['badge-brand', 'own'], consignment: ['badge-purple', 'consignment_own'],
  unread: ['badge-danger', 'unread'], read: ['badge-info', 'unread'], done: ['badge-success', 'mark_done'],
  receipt: ['badge-success', 'receipt'], payment: ['badge-danger', 'payment'],
  cash: ['badge-success', 'cash'], installment: ['badge-info', 'installment'], commission: ['badge-purple', 'commission'],
  manual: ['badge-info', 'manual'], opening: ['badge-brand', 'opening'], adjustment: ['badge-warn', 'adjustment'], closing: ['badge-danger', 'closing'],
  posted: ['badge-success', 'posted'], void: ['badge-danger', 'void'], draft: ['badge-warn', 'draft'],
  asset: ['badge-brand', 'asset'], liability: ['badge-danger', 'liability'], equity: ['badge-purple', 'equity'], revenue: ['badge-success', 'revenue'], expense: ['badge-warn', 'expense'],
};
export function statusBadge(value) {
  if (value === null || value === undefined || value === '') return '—';
  const [cls, key] = STATUS_TONE[value] || ['badge', value];
  return `<span class="badge ${cls}">${esc(t(key, value))}</span>`;
}
export function boolBadge(v) { return v ? `<span class="badge badge-success">${t('active')}</span>` : `<span class="badge">${t('inactive')}</span>`; }

/* ============================================================
   الجداول
   ============================================================ */
export function renderTable({ columns, rows, empty = '', rowKey = 'id', onRowClick }) {
  if (!rows || !rows.length) return `<div class="empty">${icon('box', 'lg')}<h4>${esc(empty || t('no_data'))}</h4><p>${t('add')} — ${t('search')}</p></div>`;
  const head = columns.map((c) => `<th class="${c.align === 'end' ? 'num' : ''}" ${c.width ? `style="width:${c.width}"` : ''}>${esc(c.label)}</th>`).join('');
  const body = rows.map((r) => {
    const tds = columns.map((c) => {
      let v = c.render ? c.render(r) : esc(r[c.key] ?? '—');
      return `<td class="${c.align === 'end' ? 'num' : ''}">${v}</td>`;
    }).join('');
    return `<tr data-id="${r[rowKey]}" ${onRowClick ? 'style="cursor:pointer"' : ''}>${tds}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/* ============================================================
   النماذج
   ============================================================ */
export function resolveOptions(field) {
  if (typeof field.options === 'function') return field.options();
  if (Array.isArray(field.options)) return field.options;
  if (field.meta && state.meta && state.meta[field.meta]) {
    return state.meta[field.meta].map((r) => ({ value: r.id, label: state.lang === 'en' && r.name_en ? r.name_en : r.name }));
  }
  return [];
}
export function fieldHtml(field, value) {
  const req = field.required ? ' <span class="req">*</span>' : '';
  const label = `<label>${esc(field.label)}${req}</label>`;
  const v = value === undefined || value === null ? (field.default ?? '') : value;
  let input = '';
  switch (field.type) {
    case 'textarea':
      input = `<textarea class="textarea" name="${field.key}" ${field.placeholder ? `placeholder="${esc(field.placeholder)}"` : ''}>${esc(v)}</textarea>`; break;
    case 'select': {
      const opts = resolveOptions(field);
      input = `<select class="select" name="${field.key}">${field.placeholder !== false ? `<option value="">— ${t('select')} —</option>` : ''}${opts.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`; break;
    }
    case 'checkbox':
      return `<div class="field ${field.full ? 'full' : ''}"><label class="check" style="margin-top:6px"><input type="checkbox" name="${field.key}" ${v ? 'checked' : ''}> ${esc(field.label)}</label></div>`;
    case 'number':
      input = `<input class="input" type="number" step="${field.step || 'any'}" name="${field.key}" value="${esc(v)}" ${field.placeholder ? `placeholder="${esc(field.placeholder)}"` : ''}>`; break;
    case 'date':
      input = `<input class="input" type="date" name="${field.key}" value="${esc(v)}">`; break;
    case 'color':
      input = `<input class="input" type="color" name="${field.key}" value="${esc(v || '#2563eb')}" style="height:44px;padding:4px">`; break;
    case 'password':
      input = `<input class="input" type="password" name="${field.key}" value="${esc(v)}" autocomplete="new-password">`; break;
    case 'hidden':
      return `<input type="hidden" name="${field.key}" value="${esc(v)}">`;
    default:
      input = `<input class="input" type="text" name="${field.key}" value="${esc(v)}" ${field.placeholder ? `placeholder="${esc(field.placeholder)}"` : ''} ${field.maxlength ? `maxlength="${field.maxlength}"` : ''}>`;
  }
  return `<div class="field ${field.full ? 'full' : ''}" ${field.wrapStyle ? `style="${field.wrapStyle}"` : ''}>${label}${input}${field.help ? `<div class="small muted mt-1">${esc(field.help)}</div>` : ''}</div>`;
}
export function formHtml(fields, data = {}) {
  return `<div class="form-grid">${fields.map((f) => fieldHtml(f, data[f.key])).join('')}</div>`;
}
export function readForm(form, fields) {
  const out = {};
  for (const f of fields) {
    const node = form.querySelector(`[name="${f.key}"]`);
    if (!node) continue;
    if (f.type === 'checkbox') out[f.key] = node.checked ? 1 : 0;
    else if (f.type === 'number') out[f.key] = node.value === '' ? (f.default ?? 0) : Number(node.value);
    else out[f.key] = node.value;
  }
  return out;
}

/* ============================================================
   محرّك CRUD العام
   ============================================================ */
export function crudView(cfg) {
  const {
    title, endpoint, columns, fields = [], perm, titleField = 'name',
    search = true, searchPlaceholder = '', exportEntity = null,
    filters = [], addLabel = null, rowActions = true, onLoad = null,
    canAdd = () => can(perm), canEdit = () => can(perm), canDelete = () => can(perm),
    beforeSave = null, extraToolbar = null, transformRows = null, modalSize = '',
  } = cfg;
  let page = 1, q = '', filterVals = {};

  async function load(container) {
    const tbl = container.querySelector('[data-table]');
    tbl.innerHTML = `<div class="empty"><div class="spinner" style="border-color:var(--border);border-top-color:var(--brand)"></div></div>`;
    const params = new URLSearchParams({ page, limit: 50 });
    if (q) params.set('q', q);
    for (const [k, v] of Object.entries(filterVals)) if (v !== '' && v !== null && v !== undefined) params.set(k, v);
    try {
      let data = await api(`${endpoint}?${params}`);
      if (onLoad) data = onLoad(data) || data;
      let rows = data.items || [];
      if (transformRows) rows = transformRows(rows);
      const total = data.total ?? rows.length;
      const pages = Math.max(1, Math.ceil(total / 50));
      const cols = [...columns];
      if (rowActions || cfg.extraRowActions) cols.push({
        label: t('actions'), align: 'end', width: cfg.actionsWidth || '150px',
        render: (r) => `<div class="row-actions">${cfg.extraRowActions ? cfg.extraRowActions(r) : ''}${canEdit() ? `<button class="btn btn-ghost btn-icon btn-sm" data-edit="${r.id}" title="${t('edit')}">${icon('edit', 'sm')}</button>` : ''}${canDelete() ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}" title="${t('delete')}">${icon('trash', 'sm')}</button>` : ''}</div>`,
      });
      tbl.innerHTML = renderTable({ columns: cols, rows, empty: cfg.empty }) +
        (total > 50 ? `<div class="pagination"><button class="btn btn-ghost btn-sm" data-prev ${page <= 1 ? 'disabled' : ''}>${icon('chevron-right', 'sm')} ${t('prev')}</button><span class="small muted">${t('page')} ${page} ${t('of')} ${pages} — ${fmtNum(total, 0)} ${t('rows')}</span><button class="btn btn-ghost btn-sm" data-next ${page >= pages ? 'disabled' : ''}>${t('next')} ${icon('chevron-left', 'sm')}</button></div>` : '');

      tbl.querySelectorAll('[data-edit]').forEach((b) => b.onclick = async (e) => { e.stopPropagation(); await openForm(container, b.dataset.edit); });
      tbl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async (e) => {
        e.stopPropagation();
        if (await confirmDialog(t('confirm_delete'))) {
          try { await api(`${endpoint}/${b.dataset.del}`, { method: 'DELETE' }); toast(t('msg_deleted')); load(container); } catch (err) { toast(err.message, 'error'); }
        }
      });
      const prev = tbl.querySelector('[data-prev]'); if (prev) prev.onclick = () => { page--; load(container); };
      const next = tbl.querySelector('[data-next]'); if (next) next.onclick = () => { page++; load(container); };
      if (cfg.bindRowActions) cfg.bindRowActions(tbl, container, load);
    } catch (e) { tbl.innerHTML = `<div class="empty">${icon('alert', 'lg')}<h4>${esc(e.message)}</h4></div>`; }
  }

  async function openForm(container, id) {
    let data = {};
    if (id) { try { const r = await api(`${endpoint}/${id}`); data = r.item || {}; } catch (e) { toast(e.message, 'error'); return; } }
    const m = modal({
      title: id ? `${t('edit')} — ${esc(data[titleField] || '')}` : (addLabel || `${t('add')} ${title}`),
      size: modalSize,
      body: formHtml(fields, data),
      footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-save>${icon('save', 'sm')} ${t('save')}</button>`,
    });
    m.node.querySelector('[data-x]').onclick = m.close;
    m.node.querySelector('[data-save]').onclick = async () => {
      const form = m.node.querySelector('.modal-body');
      let payload = readForm(form, fields);
      for (const f of fields) if (f.required && (payload[f.key] === '' || payload[f.key] === null)) { toast(`${f.label} ${t('required')}`, 'warn'); return; }
      if (beforeSave) payload = beforeSave(payload, data, id) || payload;
      const btn = m.node.querySelector('[data-save]');
      btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>`;
      try {
        await api(id ? `${endpoint}/${id}` : endpoint, { method: id ? 'PUT' : 'POST', body: payload });
        toast(id ? t('msg_updated') : t('msg_added'));
        m.close(); load(container);
      } catch (e) { toast(e.message, 'error'); btn.disabled = false; btn.innerHTML = `${icon('save', 'sm')} ${t('save')}`; }
    };
  }

  return function render(container) {
    container.innerHTML = `
      <div class="toolbar" style="margin-bottom:14px">
        ${search ? `<div class="search-box grow" style="max-width:340px">${icon('search')}<input class="input" data-search placeholder="${esc(searchPlaceholder || t('search'))}"></div>` : ''}
        ${filters.map((f) => `<select class="select" data-filter="${f.key}" style="max-width:190px">${`<option value="">${esc(f.label)}</option>`}${(f.options || []).map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select>`).join('')}
        <div class="grow"></div>
        ${extraToolbar ? extraToolbar(container) : ''}
        ${exportEntity ? `<button class="btn btn-ghost" data-export>${icon('sheet', 'sm')} ${t('export_excel')}</button>` : ''}
        ${canAdd() ? `<button class="btn btn-primary" data-add>${icon('plus', 'sm')} ${addLabel || t('add')}</button>` : ''}
      </div>
      <div data-table></div>`;
    const s = container.querySelector('[data-search]');
    if (s) s.oninput = debounce(() => { q = s.value.trim(); page = 1; load(container); });
    container.querySelectorAll('[data-filter]').forEach((sel) => sel.onchange = () => { filterVals[sel.dataset.filter] = sel.value; page = 1; load(container); });
    const add = container.querySelector('[data-add]'); if (add) add.onclick = () => openForm(container, null);
    const ex = container.querySelector('[data-export]'); if (ex) ex.onclick = () => import('./core.js').then((c) => c.exportEntity(exportEntity));
    load(container);
  };
}

/* ============================================================
   الرسوم البيانية
   ============================================================ */
export function barChart(data, { valueKey = 'total', labelKey = 'month', money: isMoney = true } = {}) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return `<div class="chart-bars">${data.map((d) => {
    const v = Number(d[valueKey]) || 0;
    const h = Math.max(3, Math.round((v / max) * 100));
    const lbl = String(d[labelKey] ?? '').slice(-5);
    return `<div class="bar-col"><div class="bar" style="height:${h}%"><span class="tip">${isMoney ? money(v) : fmtNum(v, 0)}</span></div><span class="bar-label">${esc(lbl)}</span></div>`;
  }).join('')}</div>`;
}
const DONUT_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#0ea5e9', '#ec4899'];
export function donutChart(data, { valueKey = 'total', labelKey = 'name', money: isMoney = true } = {}) {
  const total = data.reduce((s, d) => s + (Number(d[valueKey]) || 0), 0) || 1;
  let acc = 0;
  const segs = data.map((d, i) => {
    const v = Number(d[valueKey]) || 0;
    const pct = (v / total) * 100;
    const seg = { color: DONUT_COLORS[i % DONUT_COLORS.length], pct, start: acc, item: d };
    acc += pct; return seg;
  });
  const stops = segs.map((s) => `${s.color} ${s.start.toFixed(1)}% ${(s.start + s.pct).toFixed(1)}%`).join(',');
  return `<div class="donut-wrap">
    <div style="width:170px;height:170px;border-radius:50%;background:conic-gradient(${stops});position:relative;flex:none">
      <div style="position:absolute;inset:22px;border-radius:50%;background:var(--surface);display:grid;place-items:center;text-align:center">
        <div><div style="font-size:12px;color:var(--muted)">${t('total')}</div><div style="font-weight:900;font-size:15px">${isMoney ? money(total) : fmtNum(total, 0)}</div></div>
      </div>
    </div>
    <div class="legend">${segs.map((s) => `<div class="legend-item"><span class="sw" style="background:${s.color}"></span>${esc(s.item[labelKey] || s.item.label || '—')} <b class="mono" style="margin-inline-start:auto">${isMoney ? money(s.item[valueKey]) : fmtNum(s.item[valueKey], 0)}</b> <span class="small muted">${s.pct.toFixed(0)}%</span></div>`).join('')}</div>
  </div>`;
}

/* ============================================================
   أدوات مساعدة للعرض
   ============================================================ */
export function pageHead(title, sub = '', actions = '') {
  return `<div class="row between mb-2"><div><h2 style="margin:0;font-size:22px;font-weight:900">${esc(title)}</h2>${sub ? `<div class="muted mt-1">${esc(sub)}</div>` : ''}</div><div class="btn-group">${actions}</div></div>`;
}
export function kpiCard({ label, value, sub = '', icon: ic = 'chart', tone = 'brand' }) {
  return `<div class="stat"><div class="stat-icon tone-${tone}">${icon(ic, 'lg')}</div><div style="min-width:0"><div class="stat-label">${esc(label)}</div><div class="stat-val">${value}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div></div>`;
}
export function emptyState(msg, ic = 'box') { return `<div class="empty">${icon(ic, 'lg')}<h4>${esc(msg)}</h4></div>`; }

/* ============================================================
   معرض الثيمات — اختيار من عدة ثيمات فاتحة وداكنة
   ============================================================ */
export function themeGallery() {
  const card = (th) => `<button type="button" class="theme-card ${state.theme === th.id ? 'active' : ''}" data-theme-id="${th.id}"
      style="--p-brand:${th.brand};--p-bg:${th.bg};--p-surface:${th.surface};--p-accent:${th.accent};--p-text:${th.text}">
      <span class="tc-preview">
        <span class="tc-side"></span>
        <span class="tc-main">
          <span class="tc-head"></span>
          <span class="tc-line w70"></span>
          <span class="tc-line w45"></span>
          <span class="tc-chips"><i style="background:${th.brand}"></i><i style="background:${th.accent}"></i><i style="background:${th.success}"></i></span>
        </span>
        <span class="tc-check">${icon('check')}</span>
      </span>
      <span class="tc-name">${esc(themeLabel(th))}<span class="tc-mode">${th.mode === 'dark' ? t('dark') : t('light')}</span></span>
    </button>`;
  const lights = THEMES.filter((x) => x.mode === 'light');
  const darks = THEMES.filter((x) => x.mode === 'dark');
  return `<div class="theme-gallery">
    <div class="tg-section">
      <div class="tg-head"><span class="tg-dot light"></span><h4>${t('light_themes')}</h4><span class="tg-count">${lights.length}</span></div>
      <div class="theme-grid">${lights.map(card).join('')}</div>
    </div>
    <div class="tg-section">
      <div class="tg-head"><span class="tg-dot dark"></span><h4>${t('dark_themes')}</h4><span class="tg-count">${darks.length}</span></div>
      <div class="theme-grid">${darks.map(card).join('')}</div>
    </div>
  </div>`;
}
export function bindThemeGallery(root) {
  root.querySelectorAll('[data-theme-id]').forEach((b) => b.onclick = () => {
    applyTheme(b.dataset.themeId);
    root.querySelectorAll('[data-theme-id]').forEach((x) => x.classList.toggle('active', x === b));
  });
}
export function openThemeGallery() {
  const m = modal({ title: t('theme_gallery'), size: 'modal-lg', body: themeGallery(),
    footer: `<button class="btn btn-primary" data-x>${icon('check', 'sm')} ${t('done')}</button>` });
  bindThemeGallery(m.node);
  m.node.querySelector('[data-x]').onclick = m.close;
}

export { pick, toast, confirmDialog as confirm };
