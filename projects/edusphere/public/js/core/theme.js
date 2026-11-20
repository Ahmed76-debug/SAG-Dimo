import { store, saveLocalPrefs } from './store.js';
import { api } from './api.js';

const media = window.matchMedia('(prefers-color-scheme: dark)');

export const THEMES = ['light', 'light-sand', 'light-mist', 'dark', 'dark-midnight', 'dark-emerald'];

export const THEME_OPTIONS = [
  { value: 'light', en: 'Light', ar: 'فاتح (افتراضي)', mode: 'light' },
  { value: 'light-sand', en: 'Light sand', ar: 'فاتح رملي', mode: 'light' },
  { value: 'light-mist', en: 'Light mist', ar: 'فاتح ضبابي', mode: 'light' },
  { value: 'dark', en: 'Dark', ar: 'داكن (افتراضي)', mode: 'dark' },
  { value: 'dark-midnight', en: 'Dark midnight', ar: 'داكن ليلي', mode: 'dark' },
  { value: 'dark-emerald', en: 'Dark emerald', ar: 'داكن زمردي', mode: 'dark' },
  { value: 'system', en: 'System', ar: 'حسب النظام', mode: 'system' },
];

export function isDarkTheme(theme) {
  return String(theme || '').startsWith('dark');
}

export function resolvedTheme(theme) {
  if (theme === 'system' || !theme) return media.matches ? 'dark' : 'light';
  return THEMES.includes(theme) ? theme : 'light';
}

export function applyTheme(theme = store.get('theme')) {
  const resolved = resolvedTheme(theme);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = isDarkTheme(resolved) ? 'dark' : 'light';
  store.set({ theme });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDarkTheme(resolved) ? '#080f1c' : '#f4f6fb');
}

export async function setTheme(theme, { persist = true } = {}) {
  applyTheme(theme);
  try {
    localStorage.setItem('edusphere.theme', theme);
  } catch {
    /* ignore */
  }
  if (persist && store.get('user')) {
    try {
      await api.patch('/api/auth/preferences', { theme });
    } catch {
      /* best-effort */
    }
  }
  window.dispatchEvent(new CustomEvent('edusphere:theme', { detail: { theme } }));
}

export function cycleTheme() {
  const currentTheme = store.get('theme') || 'system';
  const idx = THEME_OPTIONS.findIndex((t) => t.value === currentTheme);
  const next = THEME_OPTIONS[(idx + 1) % THEME_OPTIONS.length];
  return setTheme(next.value);
}

export function toggleTheme() {
  const current = resolvedTheme(store.get('theme'));
  return setTheme(isDarkTheme(current) ? 'light' : 'dark');
}

export function initTheme() {
  const user = store.get('user');
  const settings = store.get('settings') || {};
  let theme = null;
  try {
    theme = localStorage.getItem('edusphere.theme');
  } catch {
    /* ignore */
  }
  theme = theme || user?.theme || settings?.locale?.default_theme || 'system';
  applyTheme(theme);
  const onChange = () => {
    if ((store.get('theme') || 'system') === 'system') applyTheme('system');
  };
  if (media.addEventListener) media.addEventListener('change', onChange);
  else if (media.addListener) media.addListener(onChange);
}

export function applyDensity(density = store.get('density')) {
  document.documentElement.dataset.density = density;
  store.set({ density });
  saveLocalPrefs();
}

/* ------------------------------------------------------------------ *
 * Branding
 * ------------------------------------------------------------------ */
function hexToRgb(hex) {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function shade(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const target = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const out = rgb.map((c) => Math.round(c + (target - c) * p));
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function applyBranding(branding = {}) {
  const root = document.documentElement;
  const primary = branding.primary || '#4f7cff';
  const accent = branding.accent || '#12b981';
  const rgb = hexToRgb(primary);
  root.style.setProperty('--brand', primary);
  root.style.setProperty('--brand-600', shade(primary, -0.14));
  root.style.setProperty('--brand-700', shade(primary, -0.28));
  root.style.setProperty('--brand-050', shade(primary, 0.92));
  root.style.setProperty('--brand-100', shade(primary, 0.84));
  if (rgb) root.style.setProperty('--brand-rgb', rgb.join(', '));
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-600', shade(accent, -0.16));
  root.style.setProperty('--accent-050', shade(accent, 0.9));
  if (branding.radius === 'sm') root.style.setProperty('--r-lg', '12px');
  else if (branding.radius === 'xl') root.style.setProperty('--r-lg', '24px');
  else root.style.setProperty('--r-lg', '18px');
}
