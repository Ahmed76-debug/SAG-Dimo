import { all, get, run, transaction, setSetting } from './db.js';
import { nowIso } from './util.js';
import { DICTIONARY } from './dictionary.js';
import { ALL_ENTITIES } from '../entities/index.js';

const LOCALES = [
  { code: 'ar', name_en: 'Arabic', name_ar: 'العربية', native_name: 'العربية', direction: 'rtl', is_default: 1, sort_order: 1 },
  { code: 'en', name_en: 'English', name_ar: 'الإنجليزية', native_name: 'English', direction: 'ltr', is_default: 0, sort_order: 2 },
];

/** Build the full key/value map: base dictionary + entity labels + field labels. */
export function buildDefaultDictionary() {
  const en = { ...DICTIONARY.en };
  const ar = { ...DICTIONARY.ar };
  const seenFields = new Set();

  for (const e of ALL_ENTITIES) {
    en[`entity.${e.name}`] = e.labelEn;
    ar[`entity.${e.name}`] = e.labelAr;
    for (const f of e.fields) {
      if (seenFields.has(f.name)) continue;
      seenFields.add(f.name);
      en[`field.${f.name}`] = f.labelEn || f.name;
      ar[`field.${f.name}`] = f.labelAr || f.labelEn || f.name;
    }
  }
  return { en, ar };
}

export function seedLocales() {
  for (const l of LOCALES) {
    const existing = get(`SELECT id FROM locales WHERE code = ?`, [l.code]);
    if (!existing) {
      run(
        `INSERT INTO locales (code, name_en, name_ar, native_name, direction, is_default, is_active, sort_order)
         VALUES (?,?,?,?,?,?,1,?)`,
        [l.code, l.name_en, l.name_ar, l.native_name, l.direction, l.is_default, l.sort_order],
      );
    }
  }
}

/** Seed translations; existing custom values are preserved unless force = true. */
export function seedTranslations({ force = false } = {}) {
  const dict = buildDefaultDictionary();
  let inserted = 0;
  transaction(() => {
    for (const [locale, entries] of Object.entries(dict)) {
      for (const [key, value] of Object.entries(entries)) {
        const existing = get(`SELECT id, is_custom FROM translations WHERE locale = ? AND key = ?`, [locale, key]);
        if (!existing) {
          run(`INSERT INTO translations (locale, key, value, namespace, is_custom, updated_at) VALUES (?,?,?,?,0,?)`, [
            locale,
            key,
            value,
            key.split('.')[0],
            nowIso(),
          ]);
          inserted += 1;
        } else if (force && !existing.is_custom) {
          run(`UPDATE translations SET value = ?, updated_at = ? WHERE id = ?`, [value, nowIso(), existing.id]);
        }
      }
    }
  });
  return inserted;
}

export function translationsFor(locale) {
  const rows = all(`SELECT key, value FROM translations WHERE locale = ?`, [locale]);
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export function allTranslations(locale, { search = '', limit = 500, offset = 0 } = {}) {
  const where = ['locale = ?'];
  const params = [locale];
  if (search) {
    where.push('(key LIKE ? OR value LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const total = get(`SELECT COUNT(*) AS c FROM translations WHERE ${where.join(' AND ')}`, params)?.c || 0;
  const rows = all(
    `SELECT id, locale, key, value, namespace, is_custom FROM translations WHERE ${where.join(' AND ')}
     ORDER BY key LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return { rows, total };
}

export function upsertTranslation(locale, key, value, isCustom = true) {
  const existing = get(`SELECT id FROM translations WHERE locale = ? AND key = ?`, [locale, key]);
  if (existing) {
    run(`UPDATE translations SET value = ?, is_custom = ?, updated_at = ? WHERE id = ?`, [value, isCustom ? 1 : 0, nowIso(), existing.id]);
    return existing.id;
  }
  return run(`INSERT INTO translations (locale, key, value, namespace, is_custom, updated_at) VALUES (?,?,?,?,?,?)`, [
    locale,
    key,
    value,
    key.split('.')[0],
    isCustom ? 1 : 0,
    nowIso(),
  ]).lastInsertRowid;
}

export function localeList() {
  return all(`SELECT * FROM locales ORDER BY sort_order`);
}

export function seedI18n() {
  seedLocales();
  const inserted = seedTranslations();
  setSetting('app', 'i18n_seeded_at', nowIso());
  return inserted;
}
