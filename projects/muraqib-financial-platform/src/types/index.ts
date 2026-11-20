export type Language = 'ar' | 'en'
export type Theme = 'light' | 'dark'

export type CurrencyCode =
  | 'EGP' | 'USD' | 'EUR' | 'GBP' | 'SAR' | 'AED' | 'KWD'
  | 'QAR' | 'OMR' | 'BHD' | 'JOD' | 'TRY' | 'OTHER'

export type LegalForm = 'jsc' | 'llc' | 'partnership' | 'sole' | 'other'
export type CompanySize =
  | 'international' | 'large' | 'medium' | 'small'
  | 'doctor' | 'pharmacy' | 'lawyer' | 'supermarket' | 'craftsman' | 'other'
export type CompanyActivity =
  | 'industrial' | 'commercial' | 'contracting' | 'service'
  | 'agricultural' | 'other'
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export type AccountNature = 'debit' | 'credit' | 'both'
export type UserRole = 'admin' | 'reviewer' | 'accountant' | 'client_finance_manager' | 'external' | 'viewer'
export type ApprovalStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected'
export type PeriodStatus = 'open' | 'closed'

export interface CurrencyInfo {
  code: CurrencyCode
  nameAr: string
  nameEn: string
  symbolAr: string
  symbolEn: string
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'EGP', nameAr: 'الجنيه المصري', nameEn: 'Egyptian Pound', symbolAr: 'ج.م', symbolEn: 'EGP' },
  { code: 'USD', nameAr: 'الدولار الأمريكي', nameEn: 'US Dollar', symbolAr: '$', symbolEn: 'USD' },
  { code: 'EUR', nameAr: 'اليورو', nameEn: 'Euro', symbolAr: '€', symbolEn: 'EUR' },
  { code: 'GBP', nameAr: 'الجنيه الإسترليني', nameEn: 'British Pound', symbolAr: '£', symbolEn: 'GBP' },
  { code: 'SAR', nameAr: 'الريال السعودي', nameEn: 'Saudi Riyal', symbolAr: 'ر.س', symbolEn: 'SAR' },
  { code: 'AED', nameAr: 'الدرهم الإماراتي', nameEn: 'UAE Dirham', symbolAr: 'د.إ', symbolEn: 'AED' },
  { code: 'KWD', nameAr: 'الدينار الكويتي', nameEn: 'Kuwaiti Dinar', symbolAr: 'د.ك', symbolEn: 'KWD' },
  { code: 'QAR', nameAr: 'الريال القطري', nameEn: 'Qatari Riyal', symbolAr: 'ر.ق', symbolEn: 'QAR' },
  { code: 'OMR', nameAr: 'الريال العماني', nameEn: 'Omani Rial', symbolAr: 'ر.ع', symbolEn: 'OMR' },
  { code: 'BHD', nameAr: 'الدينار البحريني', nameEn: 'Bahraini Dinar', symbolAr: 'د.ب', symbolEn: 'BHD' },
  { code: 'JOD', nameAr: 'الدينار الأردني', nameEn: 'Jordanian Dinar', symbolAr: 'د.أ', symbolEn: 'JOD' },
  { code: 'TRY', nameAr: 'الليرة التركية', nameEn: 'Turkish Lira', symbolAr: '₺', symbolEn: 'TRY' },
  { code: 'OTHER', nameAr: 'عملة أخرى', nameEn: 'Other currency', symbolAr: '', symbolEn: 'OTHER' },
]

export const LEGAL_FORMS = [
  { value: 'jsc' as const, labelAr: 'شركة مساهمة', labelEn: 'Joint Stock Company' },
  { value: 'llc' as const, labelAr: 'شركة ذات مسئولية محدودة', labelEn: 'Limited Liability Company' },
  { value: 'partnership' as const, labelAr: 'شركة تضامن', labelEn: 'General Partnership' },
  { value: 'sole' as const, labelAr: 'مؤسسة فردية', labelEn: 'Sole Proprietorship' },
  { value: 'other' as const, labelAr: 'شكل قانوني آخر', labelEn: 'Other Legal Form' },
]

export const COMPANY_SIZES = [
  { value: 'international' as const, labelAr: 'دولية', labelEn: 'International' },
  { value: 'large' as const, labelAr: 'كبيرة', labelEn: 'Large' },
  { value: 'medium' as const, labelAr: 'متوسطة', labelEn: 'Medium' },
  { value: 'small' as const, labelAr: 'صغيرة', labelEn: 'Small' },
  { value: 'doctor' as const, labelAr: 'طبيب / عيادة', labelEn: 'Medical Practice' },
  { value: 'pharmacy' as const, labelAr: 'صيدلية', labelEn: 'Pharmacy' },
  { value: 'lawyer' as const, labelAr: 'مكتب محاماة', labelEn: 'Law Firm' },
  { value: 'supermarket' as const, labelAr: 'سوبر ماركت', labelEn: 'Supermarket' },
  { value: 'craftsman' as const, labelAr: 'حرفي / ورشة', labelEn: 'Craftsman / Workshop' },
  { value: 'other' as const, labelAr: 'حجم آخر', labelEn: 'Other Size' },
]

export const COMPANY_ACTIVITIES = [
  { value: 'industrial' as const, labelAr: 'صناعي', labelEn: 'Industrial' },
  { value: 'commercial' as const, labelAr: 'تجاري', labelEn: 'Commercial' },
  { value: 'contracting' as const, labelAr: 'مقاولات', labelEn: 'Contracting' },
  { value: 'service' as const, labelAr: 'خدمي', labelEn: 'Service' },
  { value: 'agricultural' as const, labelAr: 'زراعي', labelEn: 'Agricultural' },
  { value: 'other' as const, labelAr: 'نشاط آخر', labelEn: 'Other Activity' },
]

export const ACCOUNT_TYPES = [
  { value: 'asset' as const, labelAr: 'أصول', labelEn: 'Assets' },
  { value: 'liability' as const, labelAr: 'خصوم', labelEn: 'Liabilities' },
  { value: 'equity' as const, labelAr: 'حقوق ملكية', labelEn: 'Equity' },
  { value: 'revenue' as const, labelAr: 'إيرادات', labelEn: 'Revenue' },
  { value: 'expense' as const, labelAr: 'مصروفات', labelEn: 'Expenses' },
]

export const ROLES: Array<{ value: UserRole; labelAr: string; labelEn: string }> = [
  { value: 'admin', labelAr: 'مدير المكتب', labelEn: 'Office Administrator' },
  { value: 'reviewer', labelAr: 'مراجع معتمد', labelEn: 'Certified Reviewer' },
  { value: 'accountant', labelAr: 'محاسب / مُعد', labelEn: 'Accountant / Preparer' },
  { value: 'client_finance_manager', labelAr: 'مدير مالي للشركة', labelEn: 'Company Finance Manager' },
  { value: 'external', labelAr: 'موظف الشركة (خارجي)', labelEn: 'Company External User' },
  { value: 'viewer', labelAr: 'مشاهد / مراجع داخلي', labelEn: 'Viewer / Internal Auditor' },
]

export const REPORT_TYPES = ['income', 'balance', 'equity', 'cashflow', 'position', 'trial'] as const
export type ReportType = typeof REPORT_TYPES[number]
