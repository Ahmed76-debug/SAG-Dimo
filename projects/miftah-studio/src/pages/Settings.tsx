import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, BadgeCheck, Ban, Check, CheckCircle2, Clock3, Code2, Copy,
  Database, Download, Eye, EyeOff, Fingerprint, Folder, Globe2, KeyRound, LockKeyhole,
  Palette, Plus, RefreshCw, Save, Server, ShieldCheck, SlidersHorizontal, Sparkles,
  Trash2, UserCog, Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Avatar, Badge, Button, CodeBlock, CopyButton, EmptyState, Field, Input, Segmented,
  Select, Switch,
} from '@/components/ui/primitives';
import { ColorPicker } from '@/components/ui/forms';
import { ConfirmDialog, Modal, Tabs } from '@/components/ui/overlays';
import { DataTable, ErrorPanel, Panel, StatCard, TableSkeleton, Td, Th, Tr } from '@/components/ui/page';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiQuery } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { THEMES, useTheme } from '@/lib/theme';
import type { ApiKeyRecord, SystemInfo } from '@/lib/types';
import { cn, formatBytes, formatDate, formatMoney, formatNumber, timeAgo } from '@/lib/utils';

type Tab = 'general' | 'licensing' | 'security' | 'api' | 'system';
type ThemeId = (typeof THEMES)[number]['id'];

interface SettingsData {
  settings: Record<string, string>;
  system: SystemInfo;
}

const TAB_IDS: Tab[] = ['general', 'licensing', 'security', 'api', 'system'];

const CURRENCIES = [
  { value: 'USD', label: 'دولار أمريكي ($)' },
  { value: 'SAR', label: 'ريال سعودي (ر.س)' },
  { value: 'AED', label: 'درهم إماراتي (د.إ)' },
  { value: 'EGP', label: 'جنيه مصري (ج.م)' },
  { value: 'DZD', label: 'دينار جزائري (د.ج)' },
  { value: 'QAR', label: 'ريال قطري (ر.ق)' },
  { value: 'KWD', label: 'دينار كويتي (د.ك)' },
  { value: 'BHD', label: 'دينار بحريني (د.ب)' },
  { value: 'JOD', label: 'دينار أردني (د.أ)' },
  { value: 'MAD', label: 'درهم مغربي (د.م)' },
  { value: 'OMR', label: 'ريال عماني (ر.ع)' },
  { value: 'TND', label: 'دينار تونسي (د.ت)' },
];

const SCORE_SCOPES = [
  { value: 'activate', label: 'تفعيل الأجهزة', hint: '/activate و /deactivate' },
  { value: 'validate', label: 'التحقق الدوري', hint: '/validate' },
];

const API_ENDPOINTS = [
  { method: 'POST', path: '/api/v1/activate' },
  { method: 'POST', path: '/api/v1/validate' },
  { method: 'POST', path: '/api/v1/deactivate' },
  { method: 'POST', path: '/api/v1/offline-request' },
  { method: 'GET', path: '/api/v1/offline-request/:code' },
  { method: 'GET', path: '/api/v1/public-key' },
  { method: 'GET', path: '/api/v1/health' },
];

function formatUptime(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return `${formatNumber(days)} يوم ${formatNumber(hours)} ساعة`;
  if (hours) return `${formatNumber(hours)} ساعة ${formatNumber(minutes)} دقيقة`;
  return `${formatNumber(minutes)} دقيقة`;
}

function downloadText(text: string, filename: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function Settings() {
  const { can, user, refresh: refreshAuth } = useAuth();
  const { success, error: toastError } = useToast();
  const { setTheme, setDensity } = useTheme();
  const [params, setParams] = useSearchParams();

  const rawTab = params.get('tab');
  const tab: Tab = TAB_IDS.includes(rawTab as Tab) ? (rawTab as Tab) : 'general';
  const setTab = (next: Tab) => setParams(next === 'general' ? {} : { tab: next }, { replace: true });

  const query = useApiQuery<SettingsData>('/settings', undefined, []);
  const system = query.data?.system;
  const canManage = can('settings.manage');

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!query.data?.settings) return;
    setDraft({ ...query.data.settings });
    setSaved({ ...query.data.settings });
  }, [query.data]);

  const value = (key: string, fallback = '') => draft[key] ?? query.data?.settings?.[key] ?? fallback;
  const num = (key: string, fallback = 0) => {
    const parsed = Number(value(key, String(fallback)));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const setValue = (key: string, next: string) => setDraft((prev) => ({ ...prev, [key]: next }));

  const changed = useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of Object.keys(draft)) {
      if ((draft[key] ?? '') !== (saved[key] ?? '')) out[key] = draft[key] ?? '';
    }
    return out;
  }, [draft, saved]);

  const dirty = Object.keys(changed).length > 0;

  const save = async () => {
    if (!dirty) return;
    setBusy(true);
    try {
      await api('/settings', { method: 'PUT', body: changed });
      setSaved({ ...draft });
      if (changed['appearance.defaultTheme']) setTheme(changed['appearance.defaultTheme'] as ThemeId);
      if (changed['appearance.defaultDensity']) setDensity(changed['appearance.defaultDensity'] as 'comfortable' | 'compact');
      success('تم حفظ الإعدادات', 'طُبّقت التغييرات على النظام');
      query.reload();
    } catch (err) {
      toastError('تعذر حفظ الإعدادات', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => setDraft({ ...saved });

  const themeId = value('appearance.defaultTheme', 'nocturne') as ThemeId;
  const themeDef = THEMES.find((item) => item.id === themeId) || THEMES[0];
  const currency = value('studio.currency', 'USD');

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><SlidersHorizontal size={12} /> تهيئة الاستوديو</>}
        title="الإعدادات"
        description="اضبط هوية الاستوديو، وقيم التراخيص الافتراضية، وسياسات الأمان، وتكامل API من مكان واحد."
        actions={(
          <>
            {dirty && <Badge tone="warning" dot>تغييرات غير محفوظة</Badge>}
            {dirty && (
              <Button variant="ghost" onClick={reset} disabled={busy}>
                <RefreshCw size={14} /> تراجع
              </Button>
            )}
            {canManage && (
              <Button variant="primary" onClick={save} loading={busy} disabled={!dirty}>
                <Save size={15} /> حفظ التغييرات
              </Button>
            )}
          </>
        )}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'general', label: 'عام', icon: <SlidersHorizontal size={14} /> },
          { id: 'licensing', label: 'التراخيص', icon: <KeyRound size={14} /> },
          { id: 'security', label: 'الأمان', icon: <ShieldCheck size={14} /> },
          { id: 'api', label: 'API والتكامل', icon: <Code2 size={14} /> },
          { id: 'system', label: 'النظام', icon: <Server size={14} /> },
        ]}
      />

      {query.loading && !query.data ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <TableSkeleton rows={7} cols={3} />
          <TableSkeleton rows={7} cols={3} />
        </div>
      ) : query.error ? (
        <ErrorPanel message={query.error} onRetry={query.reload} />
      ) : tab === 'general' ? (
        <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <div className="space-y-4">
            <Panel title="هوية الاستوديو" description="تظهر هذه البيانات في الواجهة وفي ملفات التراخيص الصادرة.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="اسم الاستوديو" required>
                  <Input value={value('studio.name')} onChange={(e) => setValue('studio.name', e.target.value)} placeholder="مفتاح" />
                </Field>
                <Field label="البريد الإلكتروني للدعم">
                  <Input type="email" dir="ltr" value={value('studio.supportEmail')} onChange={(e) => setValue('studio.supportEmail', e.target.value)} placeholder="support@example.com" />
                </Field>
                <Field label="الشعار النصي" className="sm:col-span-2" hint="جملة قصيرة تظهر أسفل الاسم في الواجهة.">
                  <Input value={value('studio.tagline')} onChange={(e) => setValue('studio.tagline', e.target.value)} placeholder="منصة إدارة التراخيص والتفعيل" />
                </Field>
                <Field label="عملة الفواتير الافتراضية" hint="تُستخدم في الأسعار والتقارير والتصدير.">
                  <Select value={currency} onChange={(e) => setValue('studio.currency', e.target.value)} aria-label="عملة الفواتير الافتراضية">
                    {CURRENCIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </Select>
                </Field>
                <Field label="مثال على العرض">
                  <div className="flex h-10 items-center justify-between rounded-xl border border-line bg-surface-2 px-3">
                    <span className="text-[11px] text-muted">سعر ترخيص سنوي</span>
                    <span className="numeric text-[13px] font-semibold text-ink">{formatMoney(1250, currency)}</span>
                  </div>
                </Field>
              </div>
            </Panel>

            <Panel title="المظهر الافتراضي" description="اختر المظهر الذي يبدأ به الاستوديو والأجهزة الجديدة.">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {THEMES.map((item) => {
                    const active = themeId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setValue('appearance.defaultTheme', item.id)}
                        className={cn(
                          'group overflow-hidden rounded-xl border p-1.5 text-start transition-all',
                          active ? 'border-primary/60 bg-primary-soft' : 'border-line hover:border-line-strong hover:bg-surface-2'
                        )}
                      >
                        <div className="relative h-14 overflow-hidden rounded-lg border border-line" style={{ background: item.bg }}>
                          <div className="absolute inset-x-2 top-2 flex gap-1">
                            {item.swatches.map((color) => (
                              <span key={color} className="h-1.5 flex-1 rounded-full" style={{ background: color, opacity: 0.85 }} />
                            ))}
                          </div>
                          <div
                            className="absolute inset-x-2 bottom-2 top-7 rounded-md border"
                            style={{ background: item.surface, borderColor: 'rgba(255,255,255,0.14)' }}
                          />
                          {active && (
                            <span className="absolute end-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-ink">
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between px-0.5 pt-1.5">
                          <span className="text-[10.5px] font-medium text-ink">{item.name}</span>
                          <span className="text-[8.5px] uppercase tracking-wider text-muted">{item.mode === 'dark' ? 'داكن' : 'فاتح'}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/50 px-3.5 py-3">
                  <div>
                    <p className="text-[12px] font-medium text-ink">كثافة العرض</p>
                    <p className="mt-0.5 text-[10.5px] text-muted">تتحكم في تباعد الجداول والقوائم داخل الواجهة.</p>
                  </div>
                  <Segmented
                    value={value('appearance.defaultDensity', 'comfortable')}
                    onChange={(next) => setValue('appearance.defaultDensity', next)}
                    options={[
                      { value: 'comfortable', label: 'مريح' },
                      { value: 'compact', label: 'مضغوط' },
                    ]}
                  />
                </div>
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="معاينة الهوية" description="هكذا تظهر هوية الاستوديو داخل الواجهة.">
              <div className="rounded-2xl border border-line bg-surface-2/40 p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: 'linear-gradient(145deg, var(--primary), color-mix(in oklab, var(--primary) 55%, var(--accent)))' }}
                  >
                    <KeyRound size={24} style={{ color: 'var(--primary-contrast)' }} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-bold text-ink">{value('studio.name', 'مفتاح') || 'مفتاح'}</p>
                    <p className="mt-0.5 truncate text-[10.5px] text-muted">{value('studio.tagline', 'منصة إدارة التراخيص والتفعيل')}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-line bg-surface/60 px-3 py-2">
                    <p className="text-[9.5px] text-muted">العملة</p>
                    <p className="mt-0.5 text-[11.5px] font-semibold text-soft">{currency}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface/60 px-3 py-2">
                    <p className="text-[9.5px] text-muted">المظهر</p>
                    <p className="mt-0.5 text-[11.5px] font-semibold text-soft">{themeDef.name}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2">
                  <Globe2 size={13} className="shrink-0 text-muted" />
                  <span className="truncate text-[10.5px] text-soft" dir="ltr">{value('studio.supportEmail') || 'support@example.com'}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {THEMES.slice(0, 3).map((item) => (
                    <span key={item.id} className="h-2 w-8 rounded-full" style={{ background: item.swatches[0] }} />
                  ))}
                  <span className="text-[9px] text-muted">6 ثيمات · RTL أصلي</span>
                </div>
              </div>
            </Panel>

            <Panel title="لماذا هذه الإعدادات؟">
              <ul className="space-y-3 text-[11px] leading-relaxed text-muted">
                <li className="flex gap-2">
                  <Sparkles size={14} className="mt-0.5 shrink-0 text-primary" />
                  هوية الاستوديو تظهر في الشريط الجانبي وملفات التراخيص، وتساعد عملاءك على تمييز منصتك.
                </li>
                <li className="flex gap-2">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />
                  المظهر الافتراضي يُطبّق على الأجهزة الجديدة، ويمكن لكل مستخدم تغييره من الشريط العلوي.
                </li>
                <li className="flex gap-2">
                  <Wallet size={14} className="mt-0.5 shrink-0 text-warning" />
                  العملة تؤثر على عرض الأسعار والإيرادات في كل الشاشات والتقارير.
                </li>
              </ul>
            </Panel>
          </div>
        </div>
      ) : tab === 'licensing' ? (
        <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <div className="space-y-4">
            <Panel title="القيم الافتراضية للتراخيص" description="تُقترح هذه القيم عند إنشاء ترخيص جديد ويمكن تجاوزها لكل عميل.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="مدة الاشتراك الافتراضية" hint="بالأيام — تُضاف إلى تاريخ الإصدار.">
                  <Input type="number" min={1} value={value('license.defaultDays', '365')} onChange={(e) => setValue('license.defaultDays', e.target.value)} />
                </Field>
                <Field label="عدد المقاعد الافتراضي" hint="عدد الأجهزة المسموح بتفعيلها في الترخيص الواحد.">
                  <Input type="number" min={1} value={value('license.defaultSeats', '1')} onChange={(e) => setValue('license.defaultSeats', e.target.value)} />
                </Field>
              </div>

              <div className="mt-4 rounded-xl border border-line bg-surface-2/50 px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <BadgeCheck size={14} className="text-success" />
                  <p className="text-[11.5px] font-medium text-ink">مثال على ترخيص جديد</p>
                </div>
                <div className="mt-2 grid gap-2 text-[10.5px] text-muted sm:grid-cols-3">
                  <span>يصدر اليوم</span>
                  <span>ينتهي بعد {formatNumber(num('license.defaultDays', 365))} يوم</span>
                  <span>{formatNumber(num('license.defaultSeats', 1))} مقاعد</span>
                </div>
                <p className="mt-1.5 text-[10px] text-muted">
                  تاريخ الانتهاء المتوقع:{' '}
                  <span className="font-medium text-soft">
                    {formatDate(new Date(Date.now() + num('license.defaultDays', 365) * 86400000).toISOString())}
                  </span>
                </p>
              </div>
            </Panel>

            <Panel title="العمل دون اتصال وفترة السماح" description="تحدد طريقة تعامل التطبيقات المعزولة مع الترخيص عند غياب الاتصال بالخادم.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="صلاحية الترخيص الأوفلاين" hint="عدد الأيام التي يبقى فيها ملف الترخيص الأوفلاين صالحاً قبل التحقق مجدداً.">
                  <Input type="number" min={0} value={value('license.offlineTokenDays', '30')} onChange={(e) => setValue('license.offlineTokenDays', e.target.value)} />
                </Field>
                <Field label="فترة السماح" hint="مهلة إضافية بعد الانتهاء قبل إيقاف التطبيق فعلياً.">
                  <Input type="number" min={0} value={value('license.graceDays', '7')} onChange={(e) => setValue('license.graceDays', e.target.value)} />
                </Field>
              </div>

              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-info/25 bg-info/[0.06] px-3.5 py-2.5">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-info" />
                <p className="text-[10.5px] leading-relaxed text-soft">
                  ارفع صلاحية الأوفلاين للعملاء ذوي الاتصال المتقطع، وقلّلها عندما تحتاج تحكماً أدق في التراخيص.
                </p>
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="ملخّص السياسة الحالية">
              <div className="space-y-2.5">
                {[
                  { label: 'مدة الاشتراك', value: `${formatNumber(num('license.defaultDays', 365))} يوم`, icon: Clock3 },
                  { label: 'المقاعد الافتراضية', value: `${formatNumber(num('license.defaultSeats', 1))} مقعد`, icon: UserCog },
                  { label: 'صلاحية الأوفلاين', value: `${formatNumber(num('license.offlineTokenDays', 30))} يوم`, icon: ShieldCheck },
                  { label: 'فترة السماح', value: `${formatNumber(num('license.graceDays', 7))} يوم`, icon: Activity },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/45 px-3 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1 text-[11.5px] text-soft">{item.label}</span>
                      <span className="numeric text-[11.5px] font-semibold text-ink">{item.value}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="أنواع الخطط المدعومة">
              <div className="space-y-2.5 text-[11px]">
                <div className="rounded-xl border border-line bg-surface-2/45 p-3">
                  <div className="flex items-center gap-2"><Badge tone="success">دائم</Badge><span className="text-[10px] text-muted">Perpetual</span></div>
                  <p className="mt-1.5 leading-relaxed text-muted">دفعة واحدة، بلا تاريخ انتهاء، مع إمكانية ربطه بعدد مقاعد محدد.</p>
                </div>
                <div className="rounded-xl border border-line bg-surface-2/45 p-3">
                  <div className="flex items-center gap-2"><Badge tone="info">اشتراك</Badge><span className="text-[10px] text-muted">Subscription</span></div>
                  <p className="mt-1.5 leading-relaxed text-muted">صلاحية لمدة محددة قابلة للتجديد من صفحة الترخيص بضغطة واحدة.</p>
                </div>
                <div className="rounded-xl border border-line bg-surface-2/45 p-3">
                  <div className="flex items-center gap-2"><Badge tone="warning">تجريبي</Badge><span className="text-[10px] text-muted">Trial</span></div>
                  <p className="mt-1.5 leading-relaxed text-muted">فترة تجربة قصيرة تُدار بنفس محرك الترخيص وتنتهي تلقائياً.</p>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      ) : tab === 'security' ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <Panel title="الجلسات والحماية" description="سياسات عامة تُطبّق على كل مستخدمي الاستوديو.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="مدة الجلسة" hint="عدد الساعات قبل انتهاء صلاحية تسجيل الدخول.">
                  <Input type="number" min={1} value={value('security.sessionHours', '12')} onChange={(e) => setValue('security.sessionHours', e.target.value)} />
                </Field>
                <Field label="حد محاولات الدخول" hint="عدد المحاولات الفاشلة قبل الحظر المؤقت (١٠ دقائق).">
                  <Input type="number" min={1} value={value('security.maxLoginAttempts', '8')} onChange={(e) => setValue('security.maxLoginAttempts', e.target.value)} />
                </Field>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2/45 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <LockKeyhole size={14} className="text-primary" />
                    <span className="text-[11.5px] text-soft">تشفير كلمات المرور</span>
                  </div>
                  <Badge tone="success" dot>scrypt</Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2/45 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <KeyRound size={14} className="text-warning" />
                    <span className="text-[11.5px] text-soft">تشفير مفاتيح التراخيص</span>
                  </div>
                  <Badge tone="success" dot>AES-256-GCM</Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2/45 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-info" />
                    <span className="text-[11.5px] text-soft">توقيع المستندات</span>
                  </div>
                  <Badge tone="success" dot>Ed25519</Badge>
                </div>
              </div>
            </Panel>

            <Panel title="الجلسة الحالية">
              <div className="flex items-center gap-3">
                <Avatar name={user?.name || '؟'} color={user?.avatarColor} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">{user?.name}</p>
                  <p className="truncate text-[10.5px] text-muted">@{user?.username} · {user?.role.name}</p>
                </div>
                <Badge tone="primary">{user?.role.name}</Badge>
              </div>
              <div className="mt-3 grid gap-2 text-[10.5px] sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-surface-2/45 px-3 py-2">
                  <p className="text-muted">آخر تسجيل دخول</p>
                  <p className="mt-0.5 text-soft">{user?.lastLoginAt ? formatDate(user.lastLoginAt, true) : '—'}</p>
                </div>
                <div className="rounded-xl border border-line bg-surface-2/45 px-3 py-2">
                  <p className="text-muted">عدد الصلاحيات</p>
                  <p className="numeric mt-0.5 text-soft">{formatNumber(user?.permissions.length || 0)}</p>
                </div>
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <PasswordPanel />
            <ProfilePanel />
          </div>
        </div>
      ) : tab === 'api' ? (
        <ApiTab system={system} canManage={can('api.manage')} />
      ) : (
        <SystemTab system={system} />
      )}
    </div>
  );
}

/* ------------------------------- password panel ------------------------------ */
function PasswordPanel() {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = !!form.current && form.next.length >= 8 && form.next === form.confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await api('/auth/password', { method: 'POST', body: { currentPassword: form.current, newPassword: form.next } });
      success('تم تغيير كلمة المرور', 'استخدم كلمة المرور الجديدة في الدخول القادم');
      setForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      toastError('تعذر تغيير كلمة المرور', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="تغيير كلمة المرور" description="اختر كلمة مرور قوية لا تقل عن ٨ أحرف.">
      <form onSubmit={submit} className="space-y-3.5">
        <Field label="كلمة المرور الحالية" required>
          <div className="relative">
            <Input
              type={show ? 'text' : 'password'}
              value={form.current}
              onChange={(e) => setForm((prev) => ({ ...prev, current: e.target.value }))}
              autoComplete="current-password"
              aria-label="كلمة المرور الحالية"
              className="pe-10"
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:text-ink" aria-label="إظهار كلمة المرور">
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="كلمة المرور الجديدة" required hint="٨ أحرف على الأقل.">
            <Input type={show ? 'text' : 'password'} value={form.next} onChange={(e) => setForm((prev) => ({ ...prev, next: e.target.value }))} autoComplete="new-password" />
          </Field>
          <Field
            label="تأكيد كلمة المرور"
            required
            error={!!form.confirm && form.confirm !== form.next ? 'غير مطابقة' : undefined}
          >
            <Input type={show ? 'text' : 'password'} value={form.confirm} onChange={(e) => setForm((prev) => ({ ...prev, confirm: e.target.value }))} autoComplete="new-password" />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-[10px] text-muted">سيُسجّل هذا الإجراء في سجل النشاط.</p>
          <Button type="submit" variant="primary" loading={busy} disabled={!valid}>
            <LockKeyhole size={14} /> تحديث كلمة المرور
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/* -------------------------------- profile panel ----------------------------- */
function ProfilePanel() {
  const { user, refresh } = useAuth();
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState({ name: '', email: '', avatarColor: '#6366f1' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({ name: user.name, email: user.email || '', avatarColor: user.avatarColor || '#6366f1' });
  }, [user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await api('/auth/profile', { method: 'PATCH', body: { name: form.name.trim(), email: form.email.trim(), avatarColor: form.avatarColor } });
      await refresh();
      success('تم تحديث الملف الشخصي');
    } catch (err) {
      toastError('تعذر تحديث الملف الشخصي', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="الملف الشخصي" description="بياناتك كما تظهر لباقي أعضاء الفريق.">
      <form onSubmit={submit} className="space-y-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={form.name || user?.name || '؟'} color={form.avatarColor} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold text-ink">{form.name || 'بدون اسم'}</p>
            <p className="truncate text-[10.5px] text-muted" dir="ltr">{form.email || '—'}</p>
          </div>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="الاسم الكامل" required>
            <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </Field>
          <Field label="البريد الإلكتروني">
            <Input type="email" dir="ltr" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
          </Field>
        </div>
        <Field label="لون الصورة الرمزية">
          <ColorPicker value={form.avatarColor} onChange={(color) => setForm((prev) => ({ ...prev, avatarColor: color }))} />
        </Field>
        <div className="flex justify-end pt-1">
          <Button type="submit" variant="secondary" loading={busy} disabled={!form.name.trim()}>
            <Save size={14} /> حفظ الملف
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/* ---------------------------------- API tab --------------------------------- */
function ApiTab({ system, canManage }: { system?: SystemInfo; canManage: boolean }) {
  const { success, error: toastError } = useToast();
  const keys = useApiQuery<{ items: ApiKeyRecord[] }>(canManage ? '/settings/api-keys' : null, undefined, []);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['activate', 'validate']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [example, setExample] = useState<'activate' | 'validate' | 'offline'>('activate');
  const [fingerprint, setFingerprint] = useState('');

  const host = system?.host && system.host !== '0.0.0.0' ? system.host : '127.0.0.1';
  const apiBase = `http://${host}:${system?.port || 4781}`;
  const sampleKey = 'mft_live_xxxxxxxxxxxxxxxxxxxxxxxx';
  const items = keys.data?.items || [];

  useEffect(() => {
    if (!system?.publicKey || !window.crypto?.subtle) return;
    const bytes = new TextEncoder().encode(system.publicKey);
    window.crypto.subtle.digest('SHA-256', bytes)
      .then((buffer) => {
        const hex = Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
        setFingerprint(hex.slice(0, 32).match(/.{1,4}/g)?.join(':').toUpperCase() || '');
      })
      .catch(() => setFingerprint(''));
  }, [system?.publicKey]);

  const createKey = async () => {
    if (!name.trim() || !scopes.length) return;
    setBusy(true);
    try {
      const result = await api<{ key: string; id: number }>('/settings/api-keys', {
        method: 'POST',
        body: { name: name.trim(), scopes },
      });
      setCreatedKey(result.key);
      setCreateOpen(false);
      setName('');
      setScopes(['activate', 'validate']);
      keys.reload();
      success('تم إنشاء مفتاح API', 'انسخه الآن — لن يظهر مرة أخرى');
    } catch (err) {
      toastError('تعذر إنشاء المفتاح', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!revokeTarget) return;
    setBusy(true);
    try {
      await api(`/settings/api-keys/${revokeTarget.id}`, { method: 'DELETE' });
      success('تم إلغاء مفتاح API', revokeTarget.name);
      setRevokeTarget(null);
      keys.reload();
    } catch (err) {
      toastError('تعذر إلغاء المفتاح', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const snippets: Record<'activate' | 'validate' | 'offline', string> = {
    activate: `curl -X POST ${apiBase}/api/v1/activate \\
  -H "X-API-Key: ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "licenseKey": "MFT-XXXX-XXXX-XXXX",
    "machineId": "pc-001",
    "machineName": "كاشير 1",
    "os": "Windows 11",
    "appVersion": "2.4.0"
  }'`,
    validate: `curl -X POST ${apiBase}/api/v1/validate \\
  -H "X-API-Key: ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "licenseKey": "MFT-XXXX-XXXX-XXXX",
    "machineId": "pc-001"
  }'`,
    offline: `curl -X POST ${apiBase}/api/v1/offline-request \\
  -H "X-API-Key: ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "licenseKey": "MFT-XXXX-XXXX-XXXX",
    "machineId": "pc-001",
    "machineName": "كاشير 1",
    "message": "الجهاز بدون اتصال بالإنترنت"
  }'`,
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
      <div className="space-y-4">
        <Panel
          title="مفاتيح API"
          description="تستخدمها تطبيقات العملاء للتفعيل والتحقق من التراخيص عبر الخادم."
          action={canManage && (
            <Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> مفتاح جديد
            </Button>
          )}
        >
          {!canManage ? (
            <EmptyState
              icon={<LockKeyhole size={24} />}
              title="لا تملك صلاحية إدارة مفاتيح API"
              description="يمكنك الاطلاع على أمثلة التكامل، لكن إنشاء المفاتيح وإلغاءها يتطلب صلاحية إدارة API."
            />
          ) : keys.loading && !keys.data ? (
            <TableSkeleton rows={4} cols={4} />
          ) : keys.error ? (
            <ErrorPanel message={keys.error} onRetry={keys.reload} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Code2 size={24} />}
              title="لا توجد مفاتيح API"
              description="أنشئ مفتاحاً واحداً لكل تطبيق أو عميل لتتمكن من تتبّع الاستخدام وإلغاء الوصول بسهولة."
              action={<Button variant="primary" onClick={() => setCreateOpen(true)}><Plus size={14} /> إنشاء مفتاح</Button>}
            />
          ) : (
            <>
              <div className="hidden md:block">
                <DataTable minWidth={680}>
                  <thead>
                    <tr>
                      <Th>الاسم</Th>
                      <Th>النطاقات</Th>
                      <Th>آخر استخدام</Th>
                      <Th>أُنشئ</Th>
                      <Th>الحالة</Th>
                      <Th width={82}><span className="sr-only">إجراءات</span></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <Tr key={item.id}>
                        <Td>
                          <p className="text-[11.5px] font-medium text-ink">{item.name}</p>
                          <p dir="ltr" className="mt-0.5 font-mono text-[9.5px] text-muted">{item.prefix}</p>
                        </Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {item.scopes.map((scope) => (
                              <Badge key={scope} tone="info">{scope === 'activate' ? 'تفعيل' : scope === 'validate' ? 'تحقق' : scope}</Badge>
                            ))}
                          </div>
                        </Td>
                        <Td><span className="text-[10.5px] text-soft">{item.last_used_at ? timeAgo(item.last_used_at) : 'لم يُستخدم'}</span></Td>
                        <Td><span className="text-[10.5px] text-soft">{formatDate(item.created_at)}</span></Td>
                        <Td>{item.revoked_at ? <Badge tone="danger" dot>ملغى</Badge> : <Badge tone="success" dot>نشط</Badge>}</Td>
                        <Td>
                          {!item.revoked_at && (
                            <Button size="sm" variant="ghost" onClick={() => setRevokeTarget(item)} title="إلغاء المفتاح">
                              <Ban size={14} /> إلغاء
                            </Button>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </DataTable>
              </div>

              <div className="divide-y divide-line md:hidden">
                {items.map((item) => (
                  <div key={item.id} className="px-1 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-medium text-ink">{item.name}</p>
                        <p dir="ltr" className="mt-0.5 truncate font-mono text-[9.5px] text-muted">{item.prefix}</p>
                      </div>
                      {item.revoked_at ? <Badge tone="danger" dot>ملغى</Badge> : <Badge tone="success" dot>نشط</Badge>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {item.scopes.map((scope) => (
                        <Badge key={scope} tone="info">{scope === 'activate' ? 'تفعيل' : scope === 'validate' ? 'تحقق' : scope}</Badge>
                      ))}
                      <span className="text-[9.5px] text-muted">· {item.last_used_at ? `استُخدم ${timeAgo(item.last_used_at)}` : 'لم يُستخدم'}</span>
                    </div>
                    {!item.revoked_at && (
                      <Button size="sm" variant="ghost" className="mt-1.5" onClick={() => setRevokeTarget(item)}>
                        <Ban size={13} /> إلغاء المفتاح
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel
          title="أمثلة التكامل"
          description="استدعِ واجهة التفعيل من تطبيق سطح المكتب أو أي لغة برمجة."
          action={(
            <Segmented
              size="sm"
              value={example}
              onChange={setExample}
              options={[
                { value: 'activate', label: 'تفعيل' },
                { value: 'validate', label: 'تحقق' },
                { value: 'offline', label: 'أوفلاين' },
              ]}
            />
          )}
        >
          <CodeBlock code={snippets[example]} language="bash" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {API_ENDPOINTS.map((endpoint) => (
              <span key={endpoint.path} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2/60 px-2 py-1 font-mono text-[9.5px] text-muted">
                <span className={cn('rounded px-1 py-0.5 text-[8px] font-semibold', endpoint.method === 'GET' ? 'bg-info/15 text-info' : 'bg-success/15 text-success')}>
                  {endpoint.method}
                </span>
                <span dir="ltr">{endpoint.path}</span>
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="المفتاح العام للتوقيع" description="يتحقق تطبيق العميل بواسطته من صحة ملفات الترخيص الموقّعة.">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success" dot>Ed25519</Badge>
              {fingerprint && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2/60 px-2 py-1">
                  <Fingerprint size={11} className="text-muted" />
                  <span dir="ltr" className="font-mono text-[9px] text-muted">{fingerprint}</span>
                </span>
              )}
            </div>
            <CodeBlock code={system?.publicKey || '—'} language="pem" />
            <div className="flex flex-wrap gap-2">
              <CopyButton value={system?.publicKey || ''} label="نسخ المفتاح" />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (!system?.publicKey) return;
                  downloadText(system.publicKey, 'miftah-public.pem', 'application/x-pem-file');
                  success('تم تنزيل المفتاح العام');
                }}
              >
                <Download size={14} /> تنزيل .pem
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="عنوان الخادم" description="استخدمه كعنوان أساسي في تطبيقات العملاء.">
          <div className="rounded-xl border border-line bg-surface-2/50 px-3.5 py-3">
            <p className="text-[9.5px] text-muted">Base URL</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <code dir="ltr" className="truncate font-mono text-[11px] text-soft">{apiBase}</code>
              <CopyButton value={apiBase} />
            </div>
          </div>
          <div className="mt-3 space-y-2 text-[10.5px] text-muted">
            <p className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-success" /> رأس المصادقة: <code dir="ltr" className="font-mono text-soft">X-API-Key</code></p>
            <p className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-success" /> الاستجابة بصيغة JSON موحّدة <code dir="ltr" className="font-mono text-soft">{'{ ok, data }'}</code></p>
            <p className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-success" /> حد أقصى ١٨٠ طلباً في الدقيقة لكل عنوان IP</p>
          </div>
        </Panel>

        <Panel title="نصائح أمنية">
          <ul className="space-y-2.5 text-[10.5px] leading-relaxed text-muted">
            <li className="flex gap-2"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-success" /> أنشئ مفتاحاً منفصلاً لكل تطبيق أو عميل لتتبّع الاستخدام.</li>
            <li className="flex gap-2"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-success" /> لا تُضمّن المفتاح داخل الكود المصدري للعميل، بل في إعدادات آمنة.</li>
            <li className="flex gap-2"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-success" /> ألغِ المفاتيح القديمة فور توقف أي تطبيق عن العمل.</li>
          </ul>
        </Panel>
      </div>

      {/* create */}
      <Modal
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        title="إنشاء مفتاح API جديد"
        description="سيظهر المفتاح مرة واحدة فقط بعد الإنشاء — احفظه في مكان آمن."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={busy}>إلغاء</Button>
            <Button variant="primary" onClick={createKey} loading={busy} disabled={!name.trim() || !scopes.length}>
              <Plus size={15} /> إنشاء المفتاح
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label="اسم المفتاح" required hint="مثال: تطبيق الكاشير — الفرع الرئيسي.">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم واضح لتمييز المفتاح" maxLength={100} />
          </Field>
          <Field label="النطاقات" hint="اختر ما يستطيع هذا المفتاح فعله فقط.">
            <div className="space-y-2">
              {SCORE_SCOPES.map((scope) => {
                const selected = scopes.includes(scope.value);
                return (
                  <button
                    key={scope.value}
                    type="button"
                    onClick={() => setScopes((prev) => selected ? prev.filter((s) => s !== scope.value) : [...prev, scope.value])}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-start transition',
                      selected ? 'border-primary/40 bg-primary-soft' : 'border-line bg-surface-2/40 hover:border-line-strong'
                    )}
                  >
                    <span>
                      <span className="block text-[11.5px] font-medium text-ink">{scope.label}</span>
                      <span dir="ltr" className="mt-0.5 block font-mono text-[9.5px] text-muted">{scope.hint}</span>
                    </span>
                    <span className={cn('flex h-5 w-5 items-center justify-center rounded-md border', selected ? 'border-primary bg-primary text-primary-ink' : 'border-line-strong')}>
                      {selected && <Check size={12} strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.07] px-3.5 py-2.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-[10.5px] leading-relaxed text-soft">لن تتمكن من رؤية المفتاح كاملاً بعد إغلاق هذه النافذة. يمكنك إلغاؤه وإنشاء غيره عند الحاجة.</p>
          </div>
        </div>
      </Modal>

      {/* one-time key */}
      <Modal
        open={!!createdKey}
        onClose={() => setCreatedKey(null)}
        hideClose
        title="مفتاح API جاهز"
        description="هذا هو العرض الوحيد للمفتاح — انسخه الآن إلى إعدادات تطبيق العميل."
        footer={(
          <>
            <CopyButton value={createdKey || ''} label="نسخ المفتاح" />
            <Button variant="primary" onClick={() => setCreatedKey(null)}>
              <CheckCircle2 size={15} /> تم، أغلق النافذة
            </Button>
          </>
        )}
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-primary/30 bg-primary-soft px-3.5 py-3">
            <p className="text-[9.5px] text-muted">المفتاح السري</p>
            <p dir="ltr" className="mt-1.5 break-all font-mono text-[12px] font-semibold text-ink">{createdKey}</p>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/[0.06] px-3.5 py-2.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger" />
            <p className="text-[10.5px] leading-relaxed text-soft">لا تشارك هذا المفتاح في محادثات أو مستودعات عامة. إذا تسرّب، ألغِه فوراً من القائمة وأنشئ بديلاً.</p>
          </div>
          <CodeBlock
            language="bash"
            code={`curl -H "X-API-Key: ${createdKey}" \\\n  ${apiBase}/api/v1/health`}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => !busy && setRevokeTarget(null)}
        onConfirm={revoke}
        loading={busy}
        confirmText="إلغاء المفتاح"
        title="إلغاء مفتاح API؟"
        description={(
          <>
            سيتوقف المفتاح «{revokeTarget?.name}» عن العمل فوراً ولن تستطيع أي تطبيقات تستخدمه الاتصال بالخادم.
            هذا الإجراء نهائي.
          </>
        )}
      />
    </div>
  );
}

/* -------------------------------- system tab ------------------------------- */
function SystemTab({ system }: { system?: SystemInfo }) {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();

  const reveal = async (path?: string) => {
    if (!path) return;
    try {
      await api('/system/reveal', { method: 'POST', body: { path } });
      success('تم فتح المجلد في المستكشف');
    } catch (err) {
      toastError('تعذر فتح المجلد', err instanceof Error ? err.message : undefined);
    }
  };

  const paths = [
    { label: 'مجلد البيانات', value: system?.dataDir, icon: Database, color: 'var(--primary)' },
    { label: 'مفاتيح التوقيع', value: system?.keysDir, icon: KeyRound, color: 'var(--warning)' },
    { label: 'النسخ الاحتياطي', value: system?.backupsDir, icon: Folder, color: 'var(--info)' },
    { label: 'قاعدة البيانات', value: system?.dbFile, icon: Database, color: 'var(--success)' },
  ];

  const counts = [
    { key: 'licenses', label: 'تراخيص' },
    { key: 'activations', label: 'تفعيلات' },
    { key: 'products', label: 'منتجات' },
    { key: 'customers', label: 'عملاء' },
    { key: 'users', label: 'مستخدمون' },
    { key: 'requests', label: 'طلبات' },
  ];

  const details = [
    { label: 'الإصدار', value: system ? `v${system.version}` : '—', icon: BadgeCheck },
    { label: 'Node.js', value: system?.node || '—', icon: Server },
    { label: 'المنصة', value: system?.platform || '—', icon: Globe2 },
    { label: 'عنوان الاستماع', value: system ? `${system.host}:${system.port}` : '—', icon: Activity },
    { label: 'وقت التشغيل', value: system ? formatUptime(system.uptime) : '—', icon: Clock3 },
    { label: 'حجم قاعدة البيانات', value: system ? formatBytes(system.dbSize) : '—', icon: Database },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="حالة الخادم" value="يعمل" hint="الخدمة متصلة ومتاحة" icon={Activity} tone="success" />
          <StatCard label="قاعدة البيانات" value={system ? formatBytes(system.dbSize) : '—'} hint="SQLite مدمجة" icon={Database} tone="primary" />
        </div>

        <Panel title="معلومات النظام" description="بيانات تشغيلية عن الخادم والبيئة الحالية.">
          <div className="grid gap-2 sm:grid-cols-2">
            {details.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/45 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[9.5px] text-muted">{item.label}</p>
                    <p className="mt-0.5 truncate text-[11.5px] font-medium text-soft" dir={item.label === 'Node.js' || item.label === 'المنصة' || item.label === 'عنوان الاستماع' ? 'ltr' : undefined}>
                      {item.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="مسارات التخزين" description="حافظ على نسخ احتياطية دورية لهذه المجلدات على خادم العميل.">
          <div className="space-y-2">
            {paths.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/45 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ color: item.color, background: `color-mix(in oklab, ${item.color} 12%, transparent)` }}>
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9.5px] text-muted">{item.label}</p>
                    <p dir="ltr" className="mt-0.5 break-all font-mono text-[10.5px] text-soft">{item.value || '—'}</p>
                  </div>
                  <CopyButton value={item.value || ''} size={13} />
                </div>
              );
            })}
          </div>
          {can('backups.manage') && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => reveal(system?.backupsDir)}>
                <Folder size={14} /> فتح مجلد النسخ
              </Button>
              <Button size="sm" variant="ghost" onClick={() => reveal(system?.dataDir)}>
                <Database size={14} /> فتح مجلد البيانات
              </Button>
            </div>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="محتويات قاعدة البيانات" description="عدد السجلات الحالية في كل جدول رئيسي.">
          <div className="grid grid-cols-2 gap-2">
            {counts.map((item) => (
              <div key={item.key} className="rounded-xl border border-line bg-surface-2/45 px-3 py-2.5">
                <p className="text-[9.5px] text-muted">{item.label}</p>
                <p className="numeric mt-0.5 text-[17px] font-bold text-ink">{formatNumber(system?.counts?.[item.key] || 0)}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="صحة النظام">
          <div className="space-y-2.5 text-[10.5px]">
            {[
              'قاعدة بيانات SQLite محلية — لا تحتاج خدمة خارجية.',
              'مفاتيح التوقيع تُحفظ خارج قاعدة البيانات في مجلد آمن.',
              'النسخ الاحتياطي يدعم الاستعادة الكاملة مع نسخة أمان مسبقة.',
              'كل الطلبات تمر عبر مصادقة وصلاحيات دقيقة.',
            ].map((text) => (
              <p key={text} className="flex gap-2 leading-relaxed text-muted">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success" />
                {text}
              </p>
            ))}
          </div>
        </Panel>

        <Panel title="نشر متعدد الأجهزة">
          <p className="text-[10.5px] leading-relaxed text-muted">
            لتشغيل الاستوديو لدى العميل على أكثر من جهاز، شغّل الخادم على جهاز واحد مع
            <code dir="ltr" className="mx-1 rounded bg-surface-3 px-1 py-0.5 font-mono text-[9.5px] text-soft">HOST=0.0.0.0</code>
            ثم افتح الواجهة من بقية الأجهزة عبر عنوان IP الخاص بالخادم. تأكد من فتح منفذ
            <code dir="ltr" className="mx-1 rounded bg-surface-3 px-1 py-0.5 font-mono text-[9.5px] text-soft">{system?.port || 4781}</code>
            في جدار الحماية.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="primary">Windows</Badge>
            <Badge tone="info">شبكة محلية</Badge>
            <Badge tone="success">SQLite</Badge>
          </div>
        </Panel>
      </div>
    </div>
  );
}
