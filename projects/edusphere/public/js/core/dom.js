import { iconSvg } from './icons.js';

/* ------------------------------------------------------------------ *
 * Element factory
 * ------------------------------------------------------------------ */
export function h(tag, props, ...children) {
  if (
    props === null ||
    props === undefined ||
    typeof props === 'string' ||
    typeof props === 'number' ||
    Array.isArray(props) ||
    props instanceof Node
  ) {
    if (props !== null && props !== undefined) children.unshift(props);
    props = null;
  }

  const el = document.createElement(tag);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class' || key === 'className') el.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
      else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key === 'html') el.innerHTML = value;
      else if (key === 'text') el.textContent = value;
      else if (key === 'ref' && typeof value === 'function') value(el);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'value') el.value = value;
      else if (key === 'checked' || key === 'disabled' || key === 'readOnly' || key === 'required' || key === 'multiple' || key === 'selected') el[key] = Boolean(value);
      else if (key === 'for') el.htmlFor = value;
      else if (value === true) el.setAttribute(key, '');
      else el.setAttribute(key, String(value));
    }
  }

  appendChildren(el, children);
  return el;
}

export function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (Array.isArray(child)) appendChildren(el, child);
    else if (child instanceof Node) el.appendChild(child);
    else el.appendChild(document.createTextNode(String(child)));
  }
}

export function frag(...children) {
  const f = document.createDocumentFragment();
  appendChildren(f, children);
  return f;
}

export function icon(name, className = '') {
  const wrap = document.createElement('span');
  wrap.style.display = 'contents';
  wrap.innerHTML = iconSvg(name);
  const svg = wrap.firstElementChild;
  if (className) svg.setAttribute('class', className);
  return svg;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(el, node) {
  clear(el);
  if (node) el.appendChild(node);
  return el;
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ------------------------------------------------------------------ *
 * Misc helpers
 * ------------------------------------------------------------------ */
export function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function uid(prefix = 'u') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function humanSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value);
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

const NUM_LOCALE = 'en-US';

export function fmtNumber(value, { decimals = 0 } = {}) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat(NUM_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function fmtMoney(value, currency = 'USD', { decimals = 2 } = {}) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  try {
    return new Intl.NumberFormat(NUM_LOCALE, {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  } catch {
    return `${fmtNumber(n, { decimals })} ${currency || ''}`.trim();
  }
}

export function fmtPercent(value, { decimals = 1 } = {}) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${fmtNumber(n, { decimals })}%`;
}

export function fmtDate(value, locale = 'en') {
  const d = parseDate(value);
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function fmtDateTime(value, locale = 'en') {
  const d = parseDate(value);
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export function relativeTime(value, locale = 'en') {
  const d = parseDate(value);
  if (!d) return '';
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  const units = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['week', 604800000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'minute') return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(Math.round(diff / 1000), 'second');
}

export function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoMonthStart() {
  return `${todayIso().slice(0, 7)}-01`;
}

export function isoYearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (['active', 'present', 'paid', 'posted', 'completed', 'approved', 'available', 'resolved', 'confirmed', 'success'].includes(s)) return 'success';
  if (['pending', 'partial', 'late', 'draft', 'scheduled', 'open', 'in-progress', 'warning'].includes(s)) return 'warning';
  if (['absent', 'overdue', 'cancelled', 'rejected', 'suspended', 'void', 'terminated', 'danger', 'failed'].includes(s)) return 'danger';
  if (['excused', 'borrowed', 'issued', 'live', 'transferred', 'info'].includes(s)) return 'info';
  return 'muted';
}

export function get(obj, path, fallback = undefined) {
  const parts = String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return fallback;
    cur = cur[p];
  }
  return cur === undefined ? fallback : cur;
}

export function set(obj, path, value) {
  const parts = String(path).split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
