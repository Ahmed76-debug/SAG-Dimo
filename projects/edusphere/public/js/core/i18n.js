import { store } from './store.js';
import { api } from './api.js';

export function setTranslations(map, locale) {
  store.set({ translations: map || {}, locale: locale || store.get('locale') });
  applyDirection();
}

export function applyDirection() {
  const locale = store.get('locale') || 'ar';
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = locale;
  document.documentElement.dir = dir;
  store.set({ dir });
}

export function t(key, fallback = '', vars = null) {
  const map = store.get('translations') || {};
  let value = map[key];
  if (value === undefined || value === null || value === '') {
    value = fallback || key;
  }
  if (vars) {
    value = String(value).replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
  }
  return value;
}

export function entityLabel(entity) {
  if (!entity) return '';
  const name = typeof entity === 'string' ? entity : entity.name;
  const meta = typeof entity === 'string' ? store.entity(name) : entity;
  return t(`entity.${name}`, meta ? (store.get('locale') === 'ar' ? meta.labelAr : meta.labelEn) : name);
}

export function fieldLabel(field) {
  if (!field) return '';
  const isAr = store.get('locale') === 'ar';
  return t(`field.${field.name}`, isAr ? field.labelAr || field.labelEn : field.labelEn || field.name);
}

export function optionLabel(field, value) {
  if (!field || !Array.isArray(field.options)) return value;
  const match = field.options.find((o) => String(o.value) === String(value));
  if (!match) return value;
  return store.get('locale') === 'ar' ? match.labelAr || match.labelEn : match.labelEn || match.labelAr;
}

export function groupLabel(group) {
  const entry = store.get('groups')?.find((g) => g.code === group);
  if (entry) return store.get('locale') === 'ar' ? entry.ar : entry.en;
  return group;
}

export function statusLabel(status) {
  return t(`status.${status}`, String(status || '').replace(/[-_]/g, ' '));
}

export async function loadLocale(locale) {
  if (!locale) return;
  try {
    const data = await api.get(`/api/i18n/${locale}`);
    setTranslations(data.translations || {}, locale);
    try {
      await api.patch('/api/auth/preferences', { locale });
    } catch {
      /* preference is best-effort */
    }
    window.dispatchEvent(new CustomEvent('edusphere:locale', { detail: { locale } }));
  } catch (err) {
    console.error('Failed to load locale', locale, err);
  }
}

export async function toggleLocale() {
  const next = store.get('locale') === 'ar' ? 'en' : 'ar';
  await loadLocale(next);
}

export function isRtl() {
  return store.get('dir') === 'rtl';
}
