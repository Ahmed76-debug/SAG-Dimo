import { academicEntities } from './academic.js';
import { peopleEntities } from './people.js';
import { financeEntities } from './finance.js';
import { erpEntities } from './erp.js';
import { learningEntities } from './learning.js';
import { operationsEntities } from './operations.js';
import { systemEntities } from './system.js';
import { tableColumns } from '../lib/db.js';

export const ALL_ENTITIES = [
  ...systemEntities,
  ...academicEntities,
  ...peopleEntities,
  ...financeEntities,
  ...erpEntities,
  ...learningEntities,
  ...operationsEntities,
];

export const ENTITY_MAP = new Map(ALL_ENTITIES.map((e) => [e.name, e]));
export const TABLE_MAP = new Map(ALL_ENTITIES.map((e) => [e.table, e]));

export function getEntity(name) {
  return ENTITY_MAP.get(name) || null;
}

export function getEntityByTable(table) {
  return TABLE_MAP.get(table) || null;
}

export const GROUP_ORDER = [
  'system',
  'setup',
  'people',
  'academics',
  'finance',
  'erp',
  'hr',
  'library',
  'elearning',
  'student-services',
  'transport',
  'operations',
  'general',
];

export const GROUP_LABELS = {
  system: { en: 'Administration', ar: 'الإدارة والنظام' },
  setup: { en: 'School Setup', ar: 'إعدادات المدرسة' },
  people: { en: 'Students & People', ar: 'الطلاب والأفراد' },
  academics: { en: 'Academics', ar: 'الشؤون الأكاديمية' },
  finance: { en: 'Student Finance', ar: 'مالية الطلاب' },
  erp: { en: 'Accounting & ERP', ar: 'المحاسبة وتخطيط الموارد' },
  hr: { en: 'Human Resources', ar: 'الموارد البشرية' },
  library: { en: 'Library', ar: 'المكتبة' },
  elearning: { en: 'E-Learning', ar: 'التعليم الإلكتروني' },
  'student-services': { en: 'Student Services', ar: 'خدمات الطلاب' },
  transport: { en: 'Transport', ar: 'المواصلات' },
  operations: { en: 'Operations', ar: 'التشغيل' },
  general: { en: 'General', ar: 'عام' },
};

/** Generate the permission catalogue from entity metadata + extra capabilities. */
export function buildPermissionCatalogue() {
  const perms = [];
  for (const e of ALL_ENTITIES) {
    if (e.hidden) continue;
    for (const action of ['read', 'create', 'update', 'delete', 'export']) {
      perms.push({
        code: `${e.name}.${action}`,
        module: e.group,
        action,
        nameEn: `${action[0].toUpperCase()}${action.slice(1)} — ${e.labelEn}`,
        nameAr: `${action[0].toUpperCase()}${action.slice(1)} — ${e.labelAr}`,
      });
    }
  }
  const extra = [
    ['reports.view', 'reports', 'view', 'View financial & academic reports', 'عرض التقارير المالية والأكاديمية'],
    ['reports.financial', 'reports', 'financial', 'Financial statements', 'القوائم المالية'],
    ['erp.post', 'erp', 'post', 'Post journal entries', 'ترحيل القيود'],
    ['erp.close', 'erp', 'close', 'Close fiscal periods', 'إقفال الفترات المالية'],
    ['backup.manage', 'system', 'backup', 'Manage backups & restore', 'إدارة النسخ الاحتياطي والاسترجاع'],
    ['users.manage', 'system', 'users', 'Manage users & permissions', 'إدارة المستخدمين والصلاحيات'],
    ['settings.manage', 'system', 'settings', 'Manage system settings', 'إدارة إعدادات النظام'],
    ['i18n.manage', 'system', 'i18n', 'Manage translations', 'إدارة الترجمات'],
    ['attendance.mark', 'academics', 'attendance', 'Mark attendance', 'تسجيل الحضور'],
    ['grades.enter', 'academics', 'grades', 'Enter grades', 'إدخال الدرجات'],
    ['fees.collect', 'finance', 'collect', 'Collect fee payments', 'تحصيل الرسوم'],
    ['dashboard.executive', 'reports', 'dashboard', 'Executive dashboard', 'لوحة القيادة التنفيذية'],
  ].map(([code, module, action, nameEn, nameAr]) => ({ code, module, action, nameEn, nameAr }));
  return [...perms, ...extra];
}

function supportsSoftDelete(entity) {
  if (!entity.softDelete) return false;
  try {
    return tableColumns(entity.table).includes('deleted_at');
  } catch {
    return false;
  }
}

export function entityMetaForApi() {
  return ALL_ENTITIES.filter((e) => !e.hidden).map((e) => ({
    name: e.name,
    group: e.group,
    icon: e.icon,
    labelEn: e.labelEn,
    labelAr: e.labelAr,
    displayEn: e.displayEn,
    displayAr: e.displayAr,
    softDelete: supportsSoftDelete(e),
    branchScoped: e.branchScoped,
    searchable: e.searchable,
    defaultSort: e.defaultSort,
    fields: e.fields,
    meta: e.meta,
  }));
}
