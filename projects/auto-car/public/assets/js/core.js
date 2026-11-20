/* ============================================================
   Auto Car — النواة: الحالة، الاتصال بالـ API، التنسيق، الثيم، اللغة
   ============================================================ */
import { dict } from './i18n.js';

export const state = {
  user: null, csrf: '', settings: {}, currencies: [],
  lang: localStorage.getItem('ac_lang') || 'ar',
  theme: localStorage.getItem('ac_theme') || 'light',
  meta: null, boot: null, alerts: {}, branding: null,
};

/* ---------- الترجمة ---------- */
export function t(key, fb) {
  const d = dict[state.lang] || dict.ar;
  return d[key] ?? dict.ar[key] ?? fb ?? key;
}
/* اختيار النص حسب اللغة من صف بيانات (يدعم name / name_en) */
export function pick(row, field = 'name') {
  if (!row) return '';
  if (state.lang === 'en' && row[field + '_en']) return row[field + '_en'];
  return row[field] ?? row[field + '_en'] ?? '';
}

/* ---------- أدوات مساعدة ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function icon(name, cls = '') { return `<svg class="icon ${cls}"><use href="#i-${name}"></use></svg>`; }
export function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
export function uid() { return 'u' + Math.random().toString(36).slice(2, 9); }

/* ---------- الأرقام والتواريخ ---------- */
export function fmtNum(n, decimals = 2) {
  const v = Number(n) || 0;
  return v.toLocaleString(state.lang === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
export function fmtInt(n) { return (Number(n) || 0).toLocaleString(state.lang === 'ar' ? 'ar-EG' : 'en-US'); }
export function currencySymbol() { return state.settings.currency_symbol || 'ج.م'; }
export function money(n, withSymbol = true) {
  const s = fmtNum(n);
  return withSymbol ? `${s} ${currencySymbol()}` : s;
}
export function fmtDate(s) {
  if (!s) return '—';
  const d = String(s).slice(0, 10);
  return d;
}
export function fmtDateTime(s) { return s ? String(s).slice(0, 16) : '—'; }
export function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function monthStart() { return todayStr().slice(0, 8) + '01'; }

/* ---------- الاتصال بالخادم ---------- */
export async function api(path, { method = 'GET', body, raw, headers = {}, filename } = {}) {
  const opts = { method, headers: { ...headers }, credentials: 'same-origin' };
  if (method !== 'GET' && method !== 'HEAD') opts.headers['x-csrf'] = state.csrf;
  if (body !== undefined && !raw) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  else if (raw) { opts.body = raw; if (filename) opts.headers['x-filename'] = filename; }
  const res = await fetch('/api' + path, opts);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res;
  }
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    if (res.status === 401) { state.user = null; window.dispatchEvent(new CustomEvent('ac:unauthorized')); }
    throw new Error(data.error || 'خطأ غير متوقع');
  }
  return data;
}

/* ---------- الهوية العامة (شعار المعرض وصورة السيارة) ---------- */
export async function loadBranding() {
  try { state.branding = await api('/branding'); }
  catch { state.branding = null; }
  return state.branding;
}
/* شعار المعرض: من الإعدادات بعد الدخول، أو من الهوية العامة قبل الدخول */
export function brandLogo() {
  return (state.settings && state.settings.logo) || (state.branding && state.branding.logo) || '';
}
export function loginCar() {
  return (state.settings && state.settings.login_car) || (state.branding && state.branding.login_car) || '';
}

/* ---------- التنبيهات (Toast) ---------- */
export function toast(msg, type = 'success', timeout = 3200) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const ic = type === 'error' ? 'alert' : type === 'warn' ? 'alert' : 'check-circle';
  const node = el(`<div class="toast ${type}">${icon(ic)}<div class="t-msg">${esc(msg)}</div><button class="t-close">${icon('x', 'sm')}</button></div>`);
  node.querySelector('.t-close').onclick = () => node.remove();
  root.appendChild(node);
  setTimeout(() => { node.style.opacity = '0'; node.style.transform = 'translateX(30px)'; setTimeout(() => node.remove(), 300); }, timeout);
}

/* ---------- الثيم واللغة ---------- */
export const THEMES = [
  /* ثيمات فاتحة */
  { id: 'light',         mode: 'light', ar: 'أزرق كلاسيكي',     en: 'Classic Blue',   brand: '#2563eb', bg: '#f4f6fb', surface: '#ffffff', accent: '#f59e0b', text: '#0f172a', success: '#10b981' },
  { id: 'light-emerald', mode: 'light', ar: 'زمردي',            en: 'Emerald',        brand: '#059669', bg: '#f2f8f5', surface: '#ffffff', accent: '#f59e0b', text: '#0f172a', success: '#10b981' },
  { id: 'light-royal',   mode: 'light', ar: 'بنفسجي ملكي',      en: 'Royal Violet',   brand: '#7c3aed', bg: '#f7f4fd', surface: '#ffffff', accent: '#ec4899', text: '#0f172a', success: '#10b981' },
  { id: 'light-rose',    mode: 'light', ar: 'وردي الغروب',      en: 'Sunset Rose',    brand: '#e11d48', bg: '#fdf3f5', surface: '#ffffff', accent: '#f59e0b', text: '#0f172a', success: '#10b981' },
  { id: 'light-ocean',   mode: 'light', ar: 'أزرق محيطي',       en: 'Ocean Teal',     brand: '#0891b2', bg: '#f0f9fb', surface: '#ffffff', accent: '#f59e0b', text: '#0f172a', success: '#10b981' },
  { id: 'light-sand',    mode: 'light', ar: 'رملي دافئ',        en: 'Warm Sand',      brand: '#b45309', bg: '#faf6ef', surface: '#ffffff', accent: '#0d9488', text: '#0f172a', success: '#10b981' },
  /* ثيمات داكنة */
  { id: 'dark',          mode: 'dark',  ar: 'كحلي منتصف الليل', en: 'Midnight Navy',  brand: '#3b82f6', bg: '#070d18', surface: '#0f1a2c', accent: '#f59e0b', text: '#eaf0fa', success: '#10b981' },
  { id: 'dark-emerald',  mode: 'dark',  ar: 'ليل زمردي',        en: 'Emerald Night',  brand: '#10b981', bg: '#06120f', surface: '#0d1f1a', accent: '#f59e0b', text: '#eaf0fa', success: '#10b981' },
  { id: 'dark-violet',   mode: 'dark',  ar: 'غسق بنفسجي',       en: 'Violet Dusk',    brand: '#8b5cf6', bg: '#0a0816', surface: '#16112c', accent: '#ec4899', text: '#eaf0fa', success: '#10b981' },
  { id: 'dark-rose',     mode: 'dark',  ar: 'أسود وردي',        en: 'Rose Noir',      brand: '#f43f5e', bg: '#140709', surface: '#260d15', accent: '#f59e0b', text: '#eaf0fa', success: '#10b981' },
  { id: 'dark-ocean',    mode: 'dark',  ar: 'أعماق المحيط',      en: 'Deep Ocean',     brand: '#06b6d4', bg: '#04101a', surface: '#0a2130', accent: '#f59e0b', text: '#eaf0fa', success: '#10b981' },
  { id: 'dark-amber',    mode: 'dark',  ar: 'جمر عنبري',         en: 'Amber Ember',    brand: '#f59e0b', bg: '#120d05', surface: '#221910', accent: '#06b6d4', text: '#eaf0fa', success: '#10b981' },
];
export function themeById(id) { return THEMES.find((x) => x.id === id) || THEMES[0]; }
export function themeMode(id) { return themeById(id).mode; }
export function isDark() { return themeMode(state.theme) === 'dark'; }
export function themeLabel(th) { return state.lang === 'en' ? th.en : th.ar; }

export function applyTheme(id) {
  const th = themeById(id);
  state.theme = th.id;
  const root = document.documentElement;
  root.setAttribute('data-theme', th.id);
  root.setAttribute('data-mode', th.mode);
  localStorage.setItem('ac_theme', th.id);
  localStorage.setItem(th.mode === 'dark' ? 'ac_theme_dark' : 'ac_theme_light', th.id);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', th.mode === 'dark' ? th.bg : th.brand);
  window.dispatchEvent(new CustomEvent('ac:theme', { detail: th }));
}
export function toggleTheme() {
  if (isDark()) applyTheme(localStorage.getItem('ac_theme_light') || 'light');
  else applyTheme(localStorage.getItem('ac_theme_dark') || 'dark');
}

export function applyLang(lang) {
  state.lang = lang;
  localStorage.setItem('ac_lang', lang);
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
}
export function toggleLang() { applyLang(state.lang === 'ar' ? 'en' : 'ar'); }

/* ---------- الصلاحيات ---------- */
export function can(perm) {
  if (!perm) return true;
  if (!state.user) return false;
  if (state.user.role === 'admin') return true;
  const p = state.user.permissions || [];
  return p.includes('*') || p.includes(perm);
}

/* ---------- التنزيل والتصدير ---------- */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}
export async function exportEntity(entity, format = 'xlsx') {
  const res = await fetch(`/api/export/${entity}?format=${format}`, { credentials: 'same-origin' });
  if (!res.ok) { toast('تعذر التصدير', 'error'); return; }
  const blob = await res.blob();
  downloadBlob(blob, `${entity}.${format}`);
}
export async function exportCustom(title, columns, rows, filename = 'report.xlsx') {
  const res = await fetch('/api/export/custom', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'x-csrf': state.csrf },
    body: JSON.stringify({ title, columns, rows }),
  });
  if (!res.ok) { toast('تعذر التصدير', 'error'); return; }
  downloadBlob(await res.blob(), filename);
}

/* ---------- الطباعة ---------- */
export function printHtml(innerHtml, title = '') {
  const root = document.getElementById('print-root');
  root.innerHTML = `<div class="print-doc">${innerHtml}</div>`;
  const prev = document.title;
  if (title) document.title = title;
  window.print();
  setTimeout(() => { document.title = prev; root.innerHTML = ''; }, 600);
}

/* ---------- إعدادات عامة ---------- */
export function debounce(fn, ms = 300) {
  let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
}
export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
