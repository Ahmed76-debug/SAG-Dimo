export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value?: string | null, withTime = false) {
  const d = parseDate(value);
  if (!d) return '—';
  const base = `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (!withTime) return base;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${base} · ${hh}:${mm}`;
}

export function formatShortDate(value?: string | null) {
  const d = parseDate(value);
  if (!d) return '—';
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]}`;
}

export function formatMonth(month: string) {
  const [year, m] = month.split('-');
  return `${AR_MONTHS[Number(m) - 1]} ${String(year).slice(2)}`;
}

export function formatWeekday(value: Date | string) {
  const d = typeof value === 'string' ? parseDate(value) : value;
  if (!d) return '';
  return AR_DAYS[d.getDay()];
}

export function timeAgo(value?: string | null) {
  const d = parseDate(value);
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);
  const minute = 60000;
  const hour = 3600000;
  const day = 86400000;
  let text: string;
  if (abs < minute) text = 'الآن';
  else if (abs < hour) text = `${Math.floor(abs / minute)} دقيقة`;
  else if (abs < day) text = `${Math.floor(abs / hour)} ساعة`;
  else if (abs < 30 * day) text = `${Math.floor(abs / day)} يوم`;
  else if (abs < 365 * day) text = `${Math.floor(abs / (30 * day))} شهر`;
  else text = `${Math.floor(abs / (365 * day))} سنة`;
  if (text === 'الآن') return text;
  return future ? `بعد ${text}` : `قبل ${text}`;
}

export function daysLeft(value?: string | null) {
  const d = parseDate(value);
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

export function formatNumber(value: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, ...opts }).format(value || 0);
}

const CURRENCIES: Record<string, string> = {
  USD: '$', SAR: 'ر.س', AED: 'د.إ', EGP: 'ج.م', DZD: 'د.ج', QAR: 'ر.ق',
  KWD: 'د.ك', BHD: 'د.ب', JOD: 'د.أ', MAD: 'د.م', OMR: 'ر.ع', TND: 'د.ت',
};

export function formatMoney(value: number, currency = 'USD', compact = false) {
  const symbol = CURRENCIES[currency] || currency;
  const abs = Math.abs(value || 0);
  let amount: string;
  if (compact && abs >= 1000000) amount = `${(abs / 1000000).toFixed(abs % 1000000 === 0 ? 0 : 1)}M`;
  else if (compact && abs >= 1000) amount = `${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}K`;
  else amount = formatNumber(abs);
  const sign = value < 0 ? '-' : '';
  return symbol === '$' ? `${sign}$${amount}` : `${sign}${amount} ${symbol}`;
}

export function initials(name?: string | null) {
  if (!name) return '؟';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}

export function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export const STATUS_META: Record<string, { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral'; dot: string }> = {
  active: { label: 'نشط', tone: 'success', dot: '#34d399' },
  expired: { label: 'منتهي', tone: 'warning', dot: '#fbbf24' },
  suspended: { label: 'موقوف', tone: 'neutral', dot: '#94a3b8' },
  revoked: { label: 'ملغى', tone: 'danger', dot: '#fb7185' },
  pending: { label: 'قيد المراجعة', tone: 'warning', dot: '#fbbf24' },
  approved: { label: 'معتمد', tone: 'success', dot: '#34d399' },
  rejected: { label: 'مرفوض', tone: 'danger', dot: '#fb7185' },
  deactivated: { label: 'ملغى التفعيل', tone: 'neutral', dot: '#94a3b8' },
  inactive: { label: 'معطّل', tone: 'neutral', dot: '#94a3b8' },
};

export const PLAN_META: Record<string, { label: string; description: string; tone: 'info' | 'success' | 'warning' }> = {
  perpetual: { label: 'دائم', description: 'دفعة واحدة — بدون انتهاء', tone: 'success' },
  subscription: { label: 'اشتراك', description: 'صلاحية لمدة محددة قابلة للتجديد', tone: 'info' },
  trial: { label: 'تجريبي', description: 'فترة تجربة قصيرة الأمد', tone: 'warning' },
};

export const MODE_META: Record<string, { label: string; tone: 'success' | 'info' | 'warning' }> = {
  online: { label: 'أونلاين', tone: 'success' },
  offline: { label: 'أوفلاين', tone: 'warning' },
  hybrid: { label: 'هجين', tone: 'info' },
};

export const ACTION_META: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
  'auth.login': { label: 'تسجيل دخول', tone: 'info' },
  'auth.logout': { label: 'تسجيل خروج', tone: 'neutral' },
  'auth.login_failed': { label: 'محاولة دخول فاشلة', tone: 'danger' },
  'auth.password_change': { label: 'تغيير كلمة المرور', tone: 'warning' },
  'license.create': { label: 'توليد ترخيص', tone: 'success' },
  'license.update': { label: 'تعديل ترخيص', tone: 'info' },
  'license.renew': { label: 'تجديد ترخيص', tone: 'success' },
  'license.revoke': { label: 'إلغاء ترخيص', tone: 'danger' },
  'license.suspended': { label: 'إيقاف ترخيص', tone: 'warning' },
  'license.active': { label: 'تفعيل ترخيص', tone: 'success' },
  'license.reveal': { label: 'كشف مفتاح', tone: 'warning' },
  'license.delete': { label: 'حذف ترخيص', tone: 'danger' },
  'license.delete_license': { label: 'حذف ترخيص', tone: 'danger' },
  'licenses.export': { label: 'تصدير التراخيص', tone: 'info' },
  'activation.create': { label: 'تفعيل جهاز', tone: 'success' },
  'activation.heartbeat': { label: 'نبضة جهاز', tone: 'info' },
  'activation.failed': { label: 'فشل تفعيل', tone: 'danger' },
  'activation.deactivate': { label: 'إلغاء تفعيل', tone: 'warning' },
  'activation.delete': { label: 'حذف تفعيل', tone: 'danger' },
  'request.create': { label: 'طلب تفعيل', tone: 'info' },
  'request.approve': { label: 'اعتماد طلب', tone: 'success' },
  'request.reject': { label: 'رفض طلب', tone: 'danger' },
  'product.create': { label: 'إضافة منتج', tone: 'success' },
  'product.update': { label: 'تحديث منتج', tone: 'info' },
  'product.delete': { label: 'حذف منتج', tone: 'danger' },
  'customer.create': { label: 'إضافة عميل', tone: 'success' },
  'customer.update': { label: 'تحديث عميل', tone: 'info' },
  'customer.delete': { label: 'حذف عميل', tone: 'danger' },
  'backup.create': { label: 'نسخة احتياطية', tone: 'success' },
  'backup.restore': { label: 'استعادة نسخة', tone: 'warning' },
  'backup.download': { label: 'تنزيل نسخة', tone: 'info' },
  'backup.delete': { label: 'حذف نسخة', tone: 'danger' },
  'settings.update': { label: 'تحديث الإعدادات', tone: 'warning' },
  'user.create': { label: 'إضافة مستخدم', tone: 'success' },
  'user.update': { label: 'تحديث مستخدم', tone: 'info' },
  'user.delete': { label: 'حذف مستخدم', tone: 'danger' },
  'user.password_reset': { label: 'إعادة تعيين كلمة المرور', tone: 'warning' },
  'role.create': { label: 'إضافة دور', tone: 'success' },
  'role.update': { label: 'تحديث دور', tone: 'info' },
  'role.delete': { label: 'حذف دور', tone: 'danger' },
  'apikey.create': { label: 'إنشاء مفتاح API', tone: 'success' },
  'apikey.revoke': { label: 'إلغاء مفتاح API', tone: 'danger' },
  'database.truncate': { label: 'تفريغ جداول قاعدة البيانات', tone: 'danger' },
};

export function actionMeta(action: string) {
  return ACTION_META[action] || { label: action, tone: 'neutral' as const };
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'مساء النور';
  return 'مساء الخير';
}

export function todayLabel() {
  const d = new Date();
  return `${AR_DAYS[d.getDay()]}، ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
