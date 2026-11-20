/**
 * Field & entity factories.
 *
 * A field descriptor drives BOTH the backend (validation, coercion, query building)
 * and the frontend (auto-generated table columns, forms, filters, exports).
 */

export const f = (name, type, labelEn, labelAr, opts = {}) => ({
  name,
  type,
  labelEn,
  labelAr,
  ...opts,
});

/* ------------------------------------------------------------------ *
 * Field type shorthands
 * ------------------------------------------------------------------ */
export const S = (name, en, ar, o = {}) => f(name, 'string', en, ar, { list: true, ...o });
export const T = (name, en, ar, o = {}) => f(name, 'text', en, ar, o);
export const RT = (name, en, ar, o = {}) => f(name, 'richtext', en, ar, o);
export const N = (name, en, ar, o = {}) => f(name, 'number', en, ar, { list: true, ...o });
export const I = (name, en, ar, o = {}) => f(name, 'integer', en, ar, { list: true, ...o });
export const M = (name, en, ar, o = {}) => f(name, 'money', en, ar, { list: true, ...o });
export const P = (name, en, ar, o = {}) => f(name, 'percent', en, ar, { list: true, ...o });
export const B = (name, en, ar, o = {}) => f(name, 'boolean', en, ar, { list: true, ...o });
export const D = (name, en, ar, o = {}) => f(name, 'date', en, ar, { list: true, ...o });
export const DT = (name, en, ar, o = {}) => f(name, 'datetime', en, ar, { list: true, ...o });
export const TM = (name, en, ar, o = {}) => f(name, 'time', en, ar, o);
export const SEL = (name, en, ar, options, o = {}) => f(name, 'select', en, ar, { options, list: true, ...o });
export const MSEL = (name, en, ar, options, o = {}) => f(name, 'multiselect', en, ar, { options, ...o });
export const REF = (name, en, ar, entity, o = {}) => f(name, 'ref', en, ar, { ref: entity, list: true, filter: true, ...o });
export const EMAIL = (name, en, ar, o = {}) => f(name, 'email', en, ar, o);
export const PHONE = (name, en, ar, o = {}) => f(name, 'phone', en, ar, o);
export const URLF = (name, en, ar, o = {}) => f(name, 'url', en, ar, o);
export const PWD = (name, en, ar, o = {}) => f(name, 'password', en, ar, o);
export const COLOR = (name, en, ar, o = {}) => f(name, 'color', en, ar, o);
export const JSONF = (name, en, ar, o = {}) => f(name, 'json', en, ar, o);
export const FILE = (name, en, ar, o = {}) => f(name, 'file', en, ar, o);
export const IMG = (name, en, ar, o = {}) => f(name, 'image', en, ar, o);
export const ENUM = (name, en, ar, values, o = {}) =>
  f(name, 'select', en, ar, {
    options: values.map((v) => ({ value: v, labelEn: title(v), labelAr: title(v) })),
    list: true,
    ...o,
  });

const title = (v) => String(v).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/* ------------------------------------------------------------------ *
 * Reusable/common fields
 * ------------------------------------------------------------------ */
export const C = {
  code: S('code', 'Code', 'الكود', { required: true, unique: true, width: 120 }),
  nameEn: S('name_en', 'Name (EN)', 'الاسم (إنجليزي)', { required: true, min: 2, width: 220 }),
  nameAr: S('name_ar', 'Name (AR)', 'الاسم (عربي)', { required: true, min: 2, width: 220 }),
  nameEnOpt: S('name_en', 'Name (EN)', 'الاسم (إنجليزي)', { required: true, width: 220 }),
  nameArOpt: S('name_ar', 'Name (AR)', 'الاسم (عربي)', { width: 220 }),
  titleEn: S('title_en', 'Title (EN)', 'العنوان (إنجليزي)', { required: true, width: 240 }),
  titleAr: S('title_ar', 'Title (AR)', 'العنوان (عربي)', { width: 240 }),
  firstEn: S('first_name_en', 'First name (EN)', 'الاسم الأول (إنجليزي)', { required: true }),
  lastEn: S('last_name_en', 'Last name (EN)', 'اسم العائلة (إنجليزي)'),
  firstAr: S('first_name_ar', 'First name (AR)', 'الاسم الأول (عربي)'),
  lastAr: S('last_name_ar', 'Last name (AR)', 'اسم العائلة (عربي)'),
  notes: T('notes', 'Notes', 'ملاحظات'),
  description: T('description', 'Description', 'الوصف'),
  descriptionEn: T('description_en', 'Description (EN)', 'الوصف (إنجليزي)'),
  descriptionAr: T('description_ar', 'Description (AR)', 'الوصف (عربي)'),
  branch: REF('branch_id', 'Branch', 'الفرع', 'branches', { filter: true }),
  sortOrder: I('sort_order', 'Sort order', 'الترتيب', { list: false }),
  isActive: B('is_active', 'Active', 'نشط', { default: 1 }),
  status: SEL('status', 'Status', 'الحالة', [], { options: [] }),
  createdAt: DT('created_at', 'Created at', 'تاريخ الإنشاء', { list: false, readonly: true }),
  updatedAt: DT('updated_at', 'Updated at', 'تاريخ التعديل', { list: false, readonly: true }),
  photo: IMG('photo', 'Photo', 'الصورة'),
  email: EMAIL('email', 'Email', 'البريد الإلكتروني'),
  phone: PHONE('phone', 'Phone', 'الهاتف'),
  mobile: PHONE('mobile', 'Mobile', 'الجوال'),
  gender: SEL('gender', 'Gender', 'الجنس', [
    { value: 'male', labelEn: 'Male', labelAr: 'ذكر' },
    { value: 'female', labelEn: 'Female', labelAr: 'أنثى' },
  ]),
  address: T('address', 'Address', 'العنوان', { list: false }),
  city: S('city', 'City', 'المدينة', { list: false }),
  country: S('country', 'Country', 'الدولة', { list: false }),
  currency: SEL('currency_code', 'Currency', 'العملة', [], { list: false }),
  isTeacher: B('is_teacher', 'Teaching staff', 'عضو هيئة تدريس', { default: 1 }),
  capacity: I('capacity', 'Capacity', 'السعة'),
  amount: M('amount', 'Amount', 'المبلغ'),
};

/* ------------------------------------------------------------------ *
 * Entity factory
 * ------------------------------------------------------------------ */
export const entity = (name, opts) => ({
  name,
  table: opts.table || name,
  group: opts.group || 'general',
  icon: opts.icon || 'table',
  labelEn: opts.labelEn || title(name),
  labelAr: opts.labelAr || title(name),
  labelField: opts.labelField || null,
  displayEn: opts.displayEn || ['name_en'],
  displayAr: opts.displayAr || ['name_ar'],
  softDelete: opts.softDelete !== false,
  branchScoped: Boolean(opts.branchScoped),
  auditable: opts.auditable !== false,
  searchable: opts.searchable || [],
  defaultSort: opts.defaultSort || 'id desc',
  fields: opts.fields || [],
  listColumns: opts.listColumns || null,
  detailSections: opts.detailSections || null,
  hidden: Boolean(opts.hidden),
  readonly: Boolean(opts.readonly),
  hasStatus: Boolean(opts.hasStatus),
  meta: opts.meta || {},
});

export const OPT = {
  yesNo: [
    { value: 1, labelEn: 'Yes', labelAr: 'نعم' },
    { value: 0, labelEn: 'No', labelAr: 'لا' },
  ],
  gender: [
    { value: 'male', labelEn: 'Male', labelAr: 'ذكر' },
    { value: 'female', labelEn: 'Female', labelAr: 'أنثى' },
  ],
  status: [
    { value: 'active', labelEn: 'Active', labelAr: 'نشط' },
    { value: 'inactive', labelEn: 'Inactive', labelAr: 'غير نشط' },
  ],
  studentStatus: [
    { value: 'active', labelEn: 'Active', labelAr: 'مستمر' },
    { value: 'pending', labelEn: 'Pending', labelAr: 'قيد التسجيل' },
    { value: 'graduated', labelEn: 'Graduated', labelAr: 'متخرج' },
    { value: 'transferred', labelEn: 'Transferred', labelAr: 'منقول' },
    { value: 'suspended', labelEn: 'Suspended', labelAr: 'موقوف' },
    { value: 'withdrawn', labelEn: 'Withdrawn', labelAr: 'منسحب' },
  ],
  staffStatus: [
    { value: 'active', labelEn: 'Active', labelAr: 'على العمل' },
    { value: 'on-leave', labelEn: 'On leave', labelAr: 'في إجازة' },
    { value: 'resigned', labelEn: 'Resigned', labelAr: 'مستقيل' },
    { value: 'terminated', labelEn: 'Terminated', labelAr: 'منتهي' },
    { value: 'retired', labelEn: 'Retired', labelAr: 'متقاعد' },
  ],
  attendance: [
    { value: 'present', labelEn: 'Present', labelAr: 'حاضر' },
    { value: 'absent', labelEn: 'Absent', labelAr: 'غائب' },
    { value: 'late', labelEn: 'Late', labelAr: 'متأخر' },
    { value: 'excused', labelEn: 'Excused', labelAr: 'بعذر' },
    { value: 'sick', labelEn: 'Sick', labelAr: 'مرضي' },
  ],
  invoiceStatus: [
    { value: 'draft', labelEn: 'Draft', labelAr: 'مسودة' },
    { value: 'unpaid', labelEn: 'Unpaid', labelAr: 'غير مدفوعة' },
    { value: 'partial', labelEn: 'Partially paid', labelAr: 'مدفوعة جزئياً' },
    { value: 'paid', labelEn: 'Paid', labelAr: 'مدفوعة' },
    { value: 'overdue', labelEn: 'Overdue', labelAr: 'متأخرة' },
    { value: 'cancelled', labelEn: 'Cancelled', labelAr: 'ملغاة' },
  ],
  entryStatus: [
    { value: 'draft', labelEn: 'Draft', labelAr: 'مسودة' },
    { value: 'posted', labelEn: 'Posted', labelAr: 'مرحّل' },
    { value: 'void', labelEn: 'Void', labelAr: 'ملغى' },
  ],
  accountType: [
    { value: 'asset', labelEn: 'Assets', labelAr: 'الأصول' },
    { value: 'liability', labelEn: 'Liabilities', labelAr: 'الالتزامات' },
    { value: 'equity', labelEn: 'Equity', labelAr: 'حقوق الملكية' },
    { value: 'revenue', labelEn: 'Revenue', labelAr: 'الإيرادات' },
    { value: 'expense', labelEn: 'Expenses', labelAr: 'المصروفات' },
  ],
  priority: [
    { value: 'low', labelEn: 'Low', labelAr: 'منخفضة' },
    { value: 'normal', labelEn: 'Normal', labelAr: 'عادية' },
    { value: 'high', labelEn: 'High', labelAr: 'عالية' },
    { value: 'urgent', labelEn: 'Urgent', labelAr: 'عاجلة' },
  ],
  severity: [
    { value: 'low', labelEn: 'Low', labelAr: 'منخفضة' },
    { value: 'medium', labelEn: 'Medium', labelAr: 'متوسطة' },
    { value: 'high', labelEn: 'High', labelAr: 'عالية' },
    { value: 'critical', labelEn: 'Critical', labelAr: 'حرجة' },
  ],
  weekdays: [
    { value: 0, labelEn: 'Sunday', labelAr: 'الأحد' },
    { value: 1, labelEn: 'Monday', labelAr: 'الاثنين' },
    { value: 2, labelEn: 'Tuesday', labelAr: 'الثلاثاء' },
    { value: 3, labelEn: 'Wednesday', labelAr: 'الأربعاء' },
    { value: 4, labelEn: 'Thursday', labelAr: 'الخميس' },
    { value: 5, labelEn: 'Friday', labelAr: 'الجمعة' },
    { value: 6, labelEn: 'Saturday', labelAr: 'السبت' },
  ],
  month: Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    labelEn: new Date(2000, i, 1).toLocaleString('en', { month: 'long' }),
    labelAr: new Date(2000, i, 1).toLocaleString('ar', { month: 'long' }),
  })),
};
