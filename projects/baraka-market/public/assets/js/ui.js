/* ============================================================
   مكونات الواجهة — مودالات، إشعارات، نماذج، رسوم بيانية
   ============================================================ */
import { icon, esc, fmt, state, $ } from './core.js';

/* ============================ Toasts ============================ */
export function toast(message, type = 'success', timeout = 3600) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const icons = { success: 'check-circle', error: 'x-circle', warn: 'alert', info: 'info' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(icons[type] || 'info')}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 260);
  }, timeout);
}

export function setLoading(button, loading, text = 'جارٍ الحفظ…') {
  if (!button) return;
  if (loading) {
    button.dataset.original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span><span>${esc(text)}</span>`;
  } else {
    button.disabled = false;
    if (button.dataset.original) button.innerHTML = button.dataset.original;
  }
}

/* ============================ Modals ============================ */
let openModals = 0;
const modalStack = [];

export function modal({
  title = '', subtitle = '', body = '', footer = '', size = '',
  onMount, onClose, closeOnBackdrop = true, showClose = true,
} = {}) {
  const root = document.getElementById('modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.zIndex = 80 + openModals;
  backdrop.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      ${title || showClose ? `<div class="modal-head">
        <div class="mh-body">
          ${title ? `<div class="modal-title">${title}</div>` : ''}
          ${subtitle ? `<div class="modal-sub">${subtitle}</div>` : ''}
        </div>
        ${showClose ? `<button class="icon-btn" data-close aria-label="إغلاق">${icon('x')}</button>` : ''}
      </div>` : ''}
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  root.appendChild(backdrop);
  openModals++;
  document.body.style.overflow = 'hidden';
  const modalEl = backdrop.querySelector('.modal');
  const bodyEl = backdrop.querySelector('.modal-body');
  let closed = false;

  const api = {
    root: backdrop,
    el: modalEl,
    body: bodyEl,
    close(result) {
      if (closed) return;
      closed = true;
      openModals = Math.max(0, openModals - 1);
      if (openModals === 0) document.body.style.overflow = '';
      backdrop.style.opacity = '0';
      backdrop.style.transition = 'opacity .15s';
      setTimeout(() => backdrop.remove(), 150);
      document.removeEventListener('keydown', onKey, true);
      const idx = modalStack.indexOf(api);
      if (idx >= 0) modalStack.splice(idx, 1);
      if (onClose) onClose(result);
    },
  };
  modalStack.push(api);

  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); api.close(); return; }
    if (e.key === 'Tab') {
      const focusables = [...modalEl.querySelectorAll('button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => !el.disabled && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener('keydown', onKey, true);

  backdrop.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => api.close()));
  if (closeOnBackdrop) {
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) api.close(); });
  }
  if (onMount) onMount(api);
  setTimeout(() => {
    const first = modalEl.querySelector('[autofocus], input:not([type="hidden"]):not([disabled]), select, textarea');
    if (first) first.focus();
  }, 60);
  return api;
}

/* ============================ تأكيد ============================ */
export function confirmDialog({
  title = 'تأكيد العملية', message = '', confirmText = 'تأكيد', cancelText = 'إلغاء',
  danger = false, iconName = 'alert',
} = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title: `<span class="confirm-ico ${danger ? 'danger' : ''}">${icon(iconName)}</span> ${esc(title)}`,
      body: `<p style="font-size:12.5px;line-height:1.9;color:var(--text-2)">${message}</p>`,
      footer: `<button class="btn btn-secondary" data-cancel>${esc(cancelText)}</button>
               <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(confirmText)}</button>`,
      size: 'sm',
      onClose: () => { if (!done) resolve(false); },
    });
    m.root.querySelector('[data-cancel]').addEventListener('click', () => { done = true; m.close(); resolve(false); });
    m.root.querySelector('[data-ok]').addEventListener('click', () => { done = true; m.close(); resolve(true); });
    setTimeout(() => m.root.querySelector('[data-ok]')?.focus(), 80);
  });
}

/* ============================ Forms ============================ */
export function openForm({
  title, subtitle = '', fields = [], submitText = 'حفظ', size = '', body: extraBody = '',
  onSubmit, submitVariant = 'btn-primary', footerExtra = '', onMount,
}) {
  const fieldsHtml = fields.map((f) => fieldHtml(f)).join('');
  const m = modal({
    title, subtitle, size,
    body: `<form id="modal-form" class="form-grid" novalidate>
      ${fieldsHtml}
      ${extraBody ? `<div class="span-2">${extraBody}</div>` : ''}
    </form>`,
    footer: `${footerExtra}
      <button class="btn btn-secondary" data-close>إلغاء</button>
      <button class="btn ${submitVariant}" data-submit form="modal-form">${esc(submitText)}</button>`,
    onMount: (api) => {
      const form = api.body.querySelector('#modal-form');
      const submitBtn = api.root.querySelector('[data-submit]');
      api.root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()));
      form.addEventListener('submit', (e) => { e.preventDefault(); submitBtn.click(); });
      submitBtn.addEventListener('click', async () => {
        if (!form.reportValidity()) return;
        const values = formValues(form);
        setLoading(submitBtn, true);
        try {
          await onSubmit(values, api);
        } catch (err) {
          toast(err.message || 'حدث خطأ', 'error');
          setLoading(submitBtn, false);
        }
      });
      if (onMount) onMount(api, form);
    },
  });
  return m;
}

function fieldHtml(f) {
  const span = f.span === 2 ? 'span-2' : f.span === 3 ? 'span-3' : '';
  const req = f.required ? 'required' : '';
  const label = f.label ? `<label for="f-${f.name}">${esc(f.label)}${f.required ? ' <i class="req">*</i>' : ''}</label>` : '';
  const hint = f.hint ? `<span class="hint">${f.hint}</span>` : '';
  const value = f.value ?? '';
  const disabled = f.disabled ? 'disabled' : '';
  let control = '';
  if (f.type === 'select') {
    control = `<select id="f-${f.name}" name="${f.name}" class="select" ${req} ${disabled}>
      ${(f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : '')}
      ${(f.options || []).map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
    </select>`;
  } else if (f.type === 'textarea') {
    control = `<textarea id="f-${f.name}" name="${f.name}" class="textarea" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}" ${req}>${esc(value)}</textarea>`;
  } else if (f.type === 'switch' || f.type === 'checkbox') {
    control = `<label class="switch">
      <input type="hidden" name="${f.name}" value="0" ${disabled} />
      <input id="f-${f.name}" type="checkbox" name="${f.name}" value="1" ${Number(value) ? 'checked' : ''} ${disabled} />
      <span class="switch-track"></span>
      <span class="switch-label">${esc(f.switchLabel || 'مفعّل')}</span>
    </label>`;
  } else if (f.type === 'custom') {
    control = f.html || '';
  } else {
    const min = f.min !== undefined ? `min="${f.min}"` : '';
    const max = f.max !== undefined ? `max="${f.max}"` : '';
    const step = f.step !== undefined ? `step="${f.step}"` : '';
    const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
    const dir = f.ltr ? 'dir="ltr" style="text-align:left"' : '';
    control = `<input id="f-${f.name}" name="${f.name}" type="${f.type || 'text'}" class="input" value="${esc(value)}" ${ph} ${min} ${max} ${step} ${req} ${disabled} ${dir} ${f.autofocus ? 'autofocus' : ''} />`;
  }
  return `<div class="field ${span}">${label}${control}${hint}</div>`;
}

export function formValues(form) {
  const fd = new FormData(form);
  const out = {};
  for (const [key, val] of fd.entries()) {
    if (val instanceof File) continue;
    if (key in out) {
      if (!Array.isArray(out[key])) out[key] = [out[key]];
      out[key].push(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

/* ============================ Empty & pager ============================ */
export function emptyState({ title = 'لا توجد بيانات', text = '', iconName = 'box', action = '' } = {}) {
  return `<div class="empty">
    <div class="empty-ico">${icon(iconName)}</div>
    <div class="empty-title">${esc(title)}</div>
    ${text ? `<div class="empty-text">${text}</div>` : ''}
    ${action ? `<div class="mt-2">${action}</div>` : ''}
  </div>`;
}

export function pager({ page, pages, total, limit }) {
  if (!total) return '';
  const start = (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);
  const nums = [];
  const from = Math.max(1, page - 2);
  const to = Math.min(pages, page + 2);
  for (let i = from; i <= to; i++) nums.push(i);
  return `<div class="pagination">
    <div class="info">عرض ${fmt.int(start)}–${fmt.int(end)} من ${fmt.int(total)}</div>
    <div class="pages">
      <button class="page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="السابق">${icon('chevron-right', 'icon-sm')}</button>
      ${from > 1 ? `<button class="page-btn" data-page="1">1</button>${from > 2 ? '<span class="muted">…</span>' : ''}` : ''}
      ${nums.map((n) => `<button class="page-btn ${n === page ? 'active' : ''}" data-page="${n}">${n}</button>`).join('')}
      ${to < pages ? `${to < pages - 1 ? '<span class="muted">…</span>' : ''}<button class="page-btn" data-page="${pages}">${pages}</button>` : ''}
      <button class="page-btn" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="التالي">${icon('chevron-left', 'icon-sm')}</button>
    </div>
  </div>`;
}

/* ============================ Charts ============================ */
let chartSeq = 0;

export function areaChart({
  labels = [], series = [], height = 235, currency = true, formatter,
  showAxes = true, smooth = true,
}) {
  const W = 760;
  const H = height;
  const pad = { t: 14, r: 12, b: 26, l: showAxes ? 52 : 8 };
  const allValues = series.flatMap((s) => s.values.map((v) => Number(v) || 0));
  const maxRaw = Math.max(1, ...allValues);
  const pow = Math.pow(10, Math.floor(Math.log10(maxRaw)));
  const max = Math.ceil(maxRaw / (pow / 2 || 1)) * (pow / 2 || 1) || 1;
  const n = Math.max(labels.length, ...series.map((s) => s.values.length), 2);
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const x = (i) => pad.l + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const y = (v) => pad.t + innerH * (1 - (Number(v) || 0) / max);
  const fmtV = formatter || ((v) => currency ? fmt.money(v, false) : fmt.num(v));
  const uid = `c${++chartSeq}`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const yy = pad.t + innerH * (1 - t);
    return `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="var(--border)" stroke-width="1" ${t === 0 ? '' : 'stroke-dasharray="3 5"'}/>
      ${showAxes ? `<text x="${pad.l - 9}" y="${yy + 3.5}" text-anchor="end" font-size="9" fill="var(--muted)" font-family="Cairo, sans-serif">${fmt.num(max * t >= 1000 ? Math.round(max * t) : (max * t).toFixed(0))}</text>` : ''}`;
  }).join('');

  const labelStep = Math.max(1, Math.ceil(n / (W < 600 ? 5 : 8)));
  const xLabels = labels.map((l, i) => {
    if (i % labelStep !== 0 && i !== n - 1) return '';
    return `<text x="${x(i)}" y="${H - 7}" text-anchor="middle" font-size="9" fill="var(--muted)" font-family="Cairo, sans-serif">${esc(fmt.shortDate(l) || l)}</text>`;
  }).join('');

  const paths = series.map((s, si) => {
    const values = s.values.map((v) => Number(v) || 0);
    if (!values.length) return '';
    const pts = values.map((v, i) => [x(i), y(v)]);
    let d = '';
    if (smooth && pts.length > 2) {
      d = `M ${pts[0][0]} ${pts[0][1]}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const t = 0.16;
        const c1x = p1[0] + (p2[0] - p0[0]) * t;
        const c1y = p1[1] + (p2[1] - p0[1]) * t;
        const c2x = p2[0] - (p3[0] - p1[0]) * t;
        const c2y = p2[1] - (p3[1] - p1[1]) * t;
        d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
      }
    } else {
      d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
    }
    const area = `${d} L ${pts[pts.length - 1][0]} ${pad.t + innerH} L ${pts[0][0]} ${pad.t + innerH} Z`;
    const last = pts[pts.length - 1];
    return `
      <defs><linearGradient id="${uid}-g${si}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${s.color}" stop-opacity=".26"/>
        <stop offset="100%" stop-color="${s.color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${uid}-g${si})"/>
      <path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="var(--surface)" stroke="${s.color}" stroke-width="2.4"/>`;
  }).join('');

  const points = labels.map((l, i) => {
    const vals = series.map((s) => Number(s.values[i]) || 0);
    return { x: x(i), y: Math.min(...series.map((s) => y(s.values[i] || 0))), label: l, vals };
  });
  const hitRects = labels.map((l, i) => {
    const w = innerW / Math.max(1, n - 1);
    return `<rect x="${x(i) - w / 2}" y="${pad.t}" width="${w}" height="${innerH}" fill="transparent"
      data-idx="${i}" class="chart-hit" style="cursor:crosshair"/>`;
  }).join('');

  return `<div class="chart-box" data-chart>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">
      ${gridLines}${xLabels}${paths}
      <line class="chart-guide" x1="0" y1="${pad.t}" x2="0" y2="${pad.t + innerH}" stroke="var(--border-strong)" stroke-dasharray="3 3" opacity="0"/>
      ${hitRects}
    </svg>
    <div class="chart-tip"></div>
  </div>
  <script type="application/json" class="chart-data">${JSON.stringify({ points, series: series.map((s) => ({ name: s.name, color: s.color })) }).replace(/</g, '\\u003c')}</script>`;
}

export function bindChart(root) {
  root.querySelectorAll('[data-chart]').forEach((box) => {
    const dataEl = box.parentElement.querySelector('.chart-data');
    if (!dataEl) return;
    let data;
    try { data = JSON.parse(dataEl.textContent); } catch { return; }
    const svg = box.querySelector('svg');
    const tip = box.querySelector('.chart-tip');
    const guide = box.querySelector('.chart-guide');
    const hits = box.querySelectorAll('.chart-hit');
    const W = 760;
    const show = (i) => {
      const pt = data.points[i];
      if (!pt) return;
      const left = (pt.x / W) * 100;
      const top = (pt.y / svg.viewBox.baseVal.height) * 100;
      tip.style.left = `${left}%`;
      tip.style.top = `${top}%`;
      tip.innerHTML = `<b>${esc(fmt.date(pt.label))}</b><br>${data.series.map((s, si) => `${esc(s.name)}: ${fmt.money(pt.vals[si])}`).join('<br>')}`;
      tip.classList.add('show');
      if (guide) {
        guide.setAttribute('x1', pt.x); guide.setAttribute('x2', pt.x); guide.setAttribute('opacity', '.55');
      }
    };
    const hide = () => { tip.classList.remove('show'); if (guide) guide.setAttribute('opacity', '0'); };
    hits.forEach((r) => {
      r.addEventListener('mouseenter', () => show(Number(r.dataset.idx)));
      r.addEventListener('mousemove', () => show(Number(r.dataset.idx)));
      r.addEventListener('mouseleave', hide);
    });
    box.addEventListener('mouseleave', hide);
  });
}

export function donutChart(items, { size = 148, centerLabel = 'الإجمالي', centerValue = '', thickness = 15 } = {}) {
  const total = items.reduce((a, b) => a + (Number(b.value) || 0), 0);
  const r = 50;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segments = items.map((item) => {
    const value = Number(item.value) || 0;
    const len = total > 0 ? (value / total) * c : 0;
    const gap = Math.min(3, Math.max(0, len - 1));
    const seg = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${item.color}" stroke-width="${thickness}"
      stroke-dasharray="${Math.max(0, len - gap)} ${c - Math.max(0, len - gap)}" stroke-dashoffset="${-offset}" stroke-linecap="butt"/>`;
    offset += len;
    return seg;
  }).join('');
  return `<div class="donut-wrap">
    <div class="donut" style="width:${size}px;height:${size}px">
      <svg viewBox="0 0 140 140" width="${size}" height="${size}">
        <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${thickness}"/>
        ${total > 0 ? segments : ''}
      </svg>
      <div class="donut-center">
        <b>${centerValue !== '' ? centerValue : fmt.money(total, false)}</b>
        <span>${esc(centerLabel)}</span>
      </div>
    </div>
    <div class="donut-legend">
      ${items.map((i) => `<div class="dl" style="--c:${i.color}"><i></i><span>${esc(i.label)}</span><b>${fmt.percent(total ? ((Number(i.value) || 0) / total) * 100 : 0, 0)}</b></div>`).join('')}
    </div>
  </div>`;
}

export function sparkline(values, color = 'var(--brand)') {
  const vals = (values || []).map((v) => Number(v) || 0);
  if (!vals.length) return '';
  const W = 100, H = 30;
  const max = Math.max(1, ...vals);
  const min = Math.min(...vals);
  const range = max - min || 1;
  const step = W / Math.max(1, vals.length - 1);
  const pts = vals.map((v, i) => [i * step, H - 3 - ((v - min) / range) * (H - 6)]);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${d} L ${W} ${H} L 0 ${H} Z`;
  const uid = 'sp' + Math.random().toString(36).slice(2, 7);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".22"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${uid})"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`;
}

/* ============================ Receipt ============================ */
export function receiptHtml(sale, settings = {}) {
  const s = settings || {};
  const cur = s.currency || 'ج.م';
  const width = s.receipt_width === '58' ? '58mm' : '80mm';
  const items = (sale.items || []).map((it) => `<tr>
      <td style="padding:2px 0">${esc(it.name)}</td>
      <td style="text-align:center">${fmt.qty(it.qty)}</td>
      <td style="text-align:center">${fmt.num(it.unit_price)}</td>
      <td style="text-align:end">${fmt.num(it.total)}</td>
    </tr>`).join('');
  return `<div style="width:${width};font-family:Cairo,Tahoma,sans-serif;font-size:10.5px;color:#111;direction:rtl;padding:2mm">
    <div style="text-align:center;border-bottom:1px dashed #888;padding-bottom:6px;margin-bottom:7px">
      <div style="font-size:17px;font-weight:900;letter-spacing:-.5px">${esc(s.store_name || 'سوق البركة')}</div>
      <div style="font-size:9px;color:#444;margin-top:1px">${esc(s.store_tagline || '')}</div>
      <div style="font-size:8.5px;color:#555;margin-top:2px">${esc(s.store_address || '')}</div>
      <div style="font-size:8.5px;color:#555">${esc(s.store_phone || '')}${s.tax_number ? ` — س.ت: ${esc(s.tax_number)}` : ''}</div>
    </div>
    <table style="width:100%;font-size:9.5px;margin-bottom:5px">
      <tr><td>فاتورة: <b>${esc(sale.invoice_no)}</b></td><td style="text-align:end">${esc(fmt.date(sale.created_at))} ${esc(fmt.time(sale.created_at))}</td></tr>
      <tr><td>الكاشير: ${esc(sale.user_name || '')}</td><td style="text-align:end">${esc(sale.customer_name || 'عميل نقدي')}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:9.5px">
      <thead><tr style="border-top:1px dashed #888;border-bottom:1px dashed #888">
        <th style="text-align:start;padding:3px 0;font-weight:700">الصنف</th>
        <th style="padding:3px 0;font-weight:700">كمية</th>
        <th style="padding:3px 0;font-weight:700">سعر</th>
        <th style="text-align:end;padding:3px 0;font-weight:700">إجمالي</th>
      </tr></thead>
      <tbody>${items}</tbody>
    </table>
    <div style="border-top:1px dashed #888;margin-top:6px;padding-top:5px;font-size:10px">
      <div style="display:flex;justify-content:space-between"><span>الإجمالي قبل الخصم</span><span>${fmt.num(sale.subtotal)} ${cur}</span></div>
      ${Number(sale.discount) ? `<div style="display:flex;justify-content:space-between"><span>الخصم</span><span>- ${fmt.num(sale.discount)} ${cur}</span></div>` : ''}
      ${Number(sale.tax) ? `<div style="display:flex;justify-content:space-between"><span>الضريبة</span><span>${fmt.num(sale.tax)} ${cur}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:900;border-top:1px dashed #888;margin-top:4px;padding-top:4px"><span>الإجمالي</span><span>${fmt.num(sale.total)} ${cur}</span></div>
      <div style="display:flex;justify-content:space-between;margin-top:3px"><span>المدفوع (${esc(paymentLabel(sale.payment_method))})</span><span>${fmt.num(sale.paid)} ${cur}</span></div>
      ${Number(sale.change_due) ? `<div style="display:flex;justify-content:space-between"><span>الباقي</span><span>${fmt.num(sale.change_due)} ${cur}</span></div>` : ''}
    </div>
    <div style="text-align:center;border-top:1px dashed #888;margin-top:8px;padding-top:6px;font-size:8.5px;color:#333;line-height:1.8">
      ${esc(s.receipt_footer || 'شكرًا لتعاملكم معنا')}<br>
      <span style="font-size:8px;color:#777">${esc(sale.invoice_no)} · ${esc(fmt.datetime(sale.created_at))}</span>
    </div>
  </div>`;
}

function paymentLabel(m) {
  return { cash: 'نقدي', card: 'بطاقة', wallet: 'محفظة', credit: 'آجل' }[m] || m;
}

export function printHtml(innerHtml, { width = '80mm' } = {}) {
  const old = document.getElementById('print-frame');
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'print-frame';
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
    <title>طباعة</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>@page{size:${width} auto;margin:0} *{box-sizing:border-box} body{margin:0;background:#fff}</style>
    </head><body>${innerHtml}</body></html>`);
  doc.close();
  const doPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {}
    setTimeout(() => iframe.remove(), 1500);
  };
  setTimeout(doPrint, 550);
}

export function printReceipt(sale, settings) {
  printHtml(receiptHtml(sale, settings), { width: settings?.receipt_width === '58' ? '58mm' : '80mm' });
}

/* ============================ Misc ============================ */
export function statusBadge(status) {
  const map = {
    completed: ['مكتملة', 'badge-success'],
    returned: ['مرتجعة', 'badge-danger'],
    held: ['معلقة', 'badge-warn'],
    open: ['مفتوحة', 'badge-success'],
    closed: ['مغلقة', 'badge-muted'],
    active: ['نشط', 'badge-success'],
    inactive: ['موقوف', 'badge-muted'],
  };
  const [label, cls] = map[status] || [status, 'badge-muted'];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

export function methodBadge(method) {
  const map = {
    cash: ['نقدي', 'badge-success', 'cash'],
    card: ['بطاقة', 'badge-info', 'card'],
    wallet: ['محفظة', 'badge-purple', 'phone'],
    credit: ['آجل', 'badge-warn', 'clock'],
    mixed: ['مختلط', 'badge-muted', 'wallet'],
  };
  const [label, cls, ic] = map[method] || [method, 'badge-muted', 'cash'];
  return `<span class="badge ${cls}">${icon(ic, 'icon-sm')} ${esc(label)}</span>`;
}

export function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast('تم النسخ')).catch(() => toast('تعذر النسخ', 'error'));
  }
}

export function showLoader(target) {
  target.innerHTML = `<div class="grid g4" style="margin-bottom:16px">${Array(4).fill('<div class="skeleton" style="height:110px;border-radius:18px"></div>').join('')}</div>
    <div class="skeleton" style="height:320px;border-radius:18px"></div>`;
}
