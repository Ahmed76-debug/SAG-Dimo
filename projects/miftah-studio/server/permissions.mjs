export const PERMISSIONS = [
  { key: 'dashboard.view', group: 'عام', label: 'عرض لوحة التحكم' },

  { key: 'products.view', group: 'المنتجات', label: 'عرض المنتجات' },
  { key: 'products.manage', group: 'المنتجات', label: 'إدارة المنتجات' },

  { key: 'customers.view', group: 'العملاء', label: 'عرض العملاء' },
  { key: 'customers.manage', group: 'العملاء', label: 'إدارة العملاء' },

  { key: 'licenses.view', group: 'التراخيص', label: 'عرض التراخيص' },
  { key: 'licenses.create', group: 'التراخيص', label: 'توليد تراخيص جديدة' },
  { key: 'licenses.manage', group: 'التراخيص', label: 'تعديل وإيقاف التراخيص' },
  { key: 'licenses.reveal', group: 'التراخيص', label: 'كشف مفاتيح الترخيص' },
  { key: 'licenses.export', group: 'التراخيص', label: 'تصدير ملفات الترخيص' },

  { key: 'activations.view', group: 'التفعيلات', label: 'عرض التفعيلات' },
  { key: 'activations.manage', group: 'التفعيلات', label: 'إدارة الأجهزة المفعّلة' },

  { key: 'requests.view', group: 'طلبات التفعيل', label: 'عرض الطلبات' },
  { key: 'requests.manage', group: 'طلبات التفعيل', label: 'اعتماد الطلبات ورفضها' },

  { key: 'users.view', group: 'الفريق', label: 'عرض المستخدمين' },
  { key: 'users.manage', group: 'الفريق', label: 'إدارة المستخدمين' },
  { key: 'roles.view', group: 'الفريق', label: 'عرض الأدوار' },
  { key: 'roles.manage', group: 'الفريق', label: 'إدارة الأدوار والصلاحيات' },

  { key: 'backups.view', group: 'النظام', label: 'عرض النسخ الاحتياطية' },
  { key: 'backups.manage', group: 'النظام', label: 'إنشاء واستعادة النسخ' },
  { key: 'settings.view', group: 'النظام', label: 'عرض الإعدادات' },
  { key: 'settings.manage', group: 'النظام', label: 'تعديل الإعدادات' },
  { key: 'audit.view', group: 'النظام', label: 'عرض سجل النشاط' },
  { key: 'api.manage', group: 'النظام', label: 'إدارة مفاتيح API' },
];

export const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.key);

export const ROLE_TEMPLATES = {
  owner: {
    name: 'المالك',
    name_en: 'Owner',
    description: 'تحكم كامل في كل أجزاء الاستوديو',
    permissions: ALL_PERMISSIONS,
  },
  manager: {
    name: 'مدير',
    name_en: 'Manager',
    description: 'إدارة المنتجات والتراخيص والعملاء والنسخ الاحتياطية',
    permissions: ALL_PERMISSIONS.filter((p) => !['users.manage', 'roles.manage', 'settings.manage', 'api.manage'].includes(p)),
  },
  support: {
    name: 'دعم فني',
    name_en: 'Support',
    description: 'متابعة التفعيلات والطلبات وتوليد التراخيص',
    permissions: [
      'dashboard.view',
      'products.view',
      'customers.view',
      'licenses.view',
      'licenses.create',
      'licenses.export',
      'activations.view',
      'activations.manage',
      'requests.view',
      'requests.manage',
      'backups.view',
      'audit.view',
    ],
  },
  viewer: {
    name: 'مراقب',
    name_en: 'Viewer',
    description: 'وصول للقراءة فقط',
    permissions: [
      'dashboard.view',
      'products.view',
      'customers.view',
      'licenses.view',
      'activations.view',
      'requests.view',
      'backups.view',
    ],
  },
};
