import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, Boxes, CalendarDays, ChevronDown, Copy, DatabaseBackup, Download, FileJson,
  History, Inbox, KeyRound, LogIn, MonitorSmartphone, RefreshCw, Search, ServerCog,
  Settings2, ShieldCheck, SlidersHorizontal, UserCog, UsersRound, X,
} from 'lucide-react';
import type { ElementType } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, CopyButton, EmptyState, Input, Pagination, SearchInput, Select } from '@/components/ui/primitives';
import { Menu } from '@/components/ui/overlays';
import { ErrorPanel, Panel, StatCard, TableSkeleton } from '@/components/ui/page';
import { useApiQuery, useDebounced } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import type { AuditEntry } from '@/lib/types';
import { actionMeta, cn, formatDate, formatNumber, timeAgo } from '@/lib/utils';

interface AuditResponse {
  items: AuditEntry[];
  total: number;
  page: number;
  pages: number;
  actions: string[];
}

const ENTITIES = [
  { value: 'license', label: 'ترخيص' },
  { value: 'product', label: 'منتج' },
  { value: 'customer', label: 'عميل' },
  { value: 'activation', label: 'تفعيل' },
  { value: 'request', label: 'طلب تفعيل' },
  { value: 'user', label: 'مستخدم' },
  { value: 'role', label: 'دور' },
  { value: 'backup', label: 'نسخة احتياطية' },
  { value: 'settings', label: 'إعدادات' },
  { value: 'api_key', label: 'مفتاح API' },
  { value: 'system', label: 'النظام' },
];

const ENTITY_LABEL: Record<string, string> = Object.fromEntries(ENTITIES.map((e) => [e.value, e.label]));

const ICONS: Record<string, ElementType> = {
  auth: LogIn,
  license: KeyRound,
  licenses: KeyRound,
  activation: MonitorSmartphone,
  request: Inbox,
  product: Boxes,
  customer: UsersRound,
  backup: DatabaseBackup,
  settings: Settings2,
  user: UserCog,
  role: ShieldCheck,
  apikey: KeyRound,
  system: ServerCog,
};

const TONE_COLOR: Record<string, string> = {
  success: 'var(--success)',
  info: 'var(--info)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  neutral: 'var(--muted)',
  primary: 'var(--primary)',
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (sameDay(d, today)) return 'اليوم';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(d, yesterday)) return 'أمس';
  return formatDate(iso);
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function clock(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function summaryOf(detail: Record<string, unknown> | null) {
  if (!detail) return '';
  for (const key of ['label', 'filename', 'name', 'reason', 'machineId', 'license', 'from', 'keys']) {
    const value = detail[key];
    if (typeof value === 'string' && value) return value;
  }
  const keys = Object.keys(detail);
  if (!keys.length) return '';
  return keys.slice(0, 3).map((key) => `${key}: ${String(detail[key])}`).join(' · ');
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

function exportCsv(items: AuditEntry[]) {
  const head = ['التاريخ', 'المستخدم', 'الإجراء', 'الكيان', 'المعرّف', 'IP', 'التفاصيل'];
  const rows = items.map((e) => [
    e.at, e.actor, e.action, e.entity || '', e.entityId || '', e.ip || '',
    e.detail ? JSON.stringify(e.detail) : '',
  ]);
  const csv = '\uFEFF' + [head, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  downloadText(csv, `miftah-audit-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
}

export function Audit() {
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);

  const start = useMemo(startOfToday, []);

  const list = useApiQuery<AuditResponse>('/audit', {
    q: debounced || undefined,
    action: action || undefined,
    entity: entity || undefined,
    from: from || undefined,
    page,
    limit: 25,
  }, [debounced, action, entity, from, page]);

  const stats = useApiQuery<AuditResponse>('/audit', { limit: 1 });
  const today = useApiQuery<AuditResponse>('/audit', { from: start, limit: 1 });

  const items = list.data?.items || [];
  const actions = list.data?.actions || stats.data?.actions || [];
  const total = stats.data?.total ?? 0;
  const todayCount = today.data?.total ?? 0;
  const latest = stats.data?.items?.[0]?.at;
  const hasFilters = !!search || !!action || !!entity || !!from;

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; items: AuditEntry[] }>();
    for (const entry of items) {
      const key = dayKey(entry.at);
      if (!map.has(key)) map.set(key, { key, label: dayLabel(entry.at), items: [] });
      map.get(key)!.items.push(entry);
    }
    return Array.from(map.values());
  }, [items]);

  const reset = () => {
    setSearch('');
    setAction('');
    setEntity('');
    setFrom('');
    setPage(1);
  };

  const exportMenu = () => {
    if (!items.length) {
      toastError('لا توجد أحداث للتصدير');
      return;
    }
    exportCsv(items);
    success('تم تصدير الصفحة الحالية', `${items.length} حدث بصيغة CSV`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><History size={12} /> تتبّع كامل للعمليات</>}
        title="سجل النشاط"
        description="كل إجراء داخل الاستوديو مسجّل بالتفصيل: من فعله، ومتى، وعلى أي كيان — لمراجعة أمنية كاملة."
        actions={(
          <>
            <Button variant="ghost" size="icon" onClick={() => { list.reload(); stats.reload(); today.reload(); }} title="تحديث">
              <RefreshCw size={15} className={list.loading ? 'animate-spin' : undefined} />
            </Button>
            <Menu
              trigger={<span className="inline-flex items-center gap-1.5 px-1 text-[12px]"><Download size={14} /> تصدير</span>}
              triggerClassName="h-9 w-auto px-3 border border-line bg-surface-2"
              items={[
                { label: 'تصدير CSV', icon: <Download size={14} />, onClick: exportMenu },
                {
                  label: 'تصدير JSON',
                  icon: <FileJson size={14} />,
                  onClick: () => {
                    if (!items.length) return toastError('لا توجد أحداث للتصدير');
                    downloadText(JSON.stringify(items, null, 2), `miftah-audit-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
                    success('تم تصدير الصفحة الحالية', `${items.length} حدث بصيغة JSON`);
                  },
                },
              ]}
            />
          </>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي الأحداث" value={formatNumber(total)} hint="منذ بداية تشغيل الاستوديو" icon={Activity} tone="primary" delay={0} />
        <StatCard label="أحداث اليوم" value={formatNumber(todayCount)} hint={todayCount ? 'نشاط جارٍ الآن' : 'لا نشاط اليوم بعد'} icon={CalendarDays} tone="accent" delay={0.05} />
        <StatCard label="أنواع الإجراءات" value={formatNumber(actions.length)} hint="إجراءات مسجّلة في النظام" icon={SlidersHorizontal} tone="info" delay={0.1} />
        <StatCard label="آخر نشاط" value={latest ? timeAgo(latest) : '—'} hint={latest ? formatDate(latest, true) : 'لا نشاط مسجّل'} icon={History} tone="success" delay={0.15} />
      </div>

      <Panel padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="بحث بالمستخدم أو الإجراء أو التفاصيل…" className="w-full sm:w-64" />
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="w-full sm:w-52" aria-label="نوع الإجراء">
            <option value="">كل الإجراءات</option>
            {actions.map((item) => (
              <option key={item} value={item}>{actionMeta(item).label} — {item}</option>
            ))}
          </Select>
          <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} className="w-full sm:w-40" aria-label="نوع الكيان">
            <option value="">كل الكيانات</option>
            {ENTITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] text-muted">من</span>
            <Input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              aria-label="من تاريخ"
              dir="ltr"
              className="h-9 w-[148px] text-[11px]"
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <X size={13} /> مسح الفلاتر
            </Button>
          )}
          <span className="ms-auto text-[10.5px] text-muted">
            {hasFilters ? `${formatNumber(list.data?.total ?? 0)} نتيجة` : `${formatNumber(total)} حدث`}
          </span>
        </div>

        {list.loading && !list.data ? (
          <TableSkeleton rows={7} cols={4} />
        ) : list.error ? (
          <ErrorPanel message={list.error} onRetry={list.reload} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Search size={25} />}
            title={hasFilters ? 'لا توجد أحداث مطابقة' : 'السجل فارغ'}
            description={hasFilters
              ? 'جرّب توسيع نطاق التاريخ أو تغيير نوع الإجراء أو الكيان.'
              : 'ستظهر هنا كل العمليات التي تُجرى على التراخيص والمنتجات والعملاء والتفعيلات.'}
            action={hasFilters ? <Button variant="secondary" onClick={reset}>مسح الفلاتر</Button> : undefined}
          />
        ) : (
          <div>
            {groups.map((group) => (
              <section key={group.key}>
                <div className="sticky top-16 z-10 flex items-center gap-2 border-y border-line bg-surface/85 px-4 py-1.5 backdrop-blur">
                  <CalendarDays size={12} className="text-muted" />
                  <p className="text-[10.5px] font-semibold text-soft">{group.label}</p>
                  <span className="numeric rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] text-muted">{formatNumber(group.items.length)}</span>
                </div>

                {group.items.map((entry) => {
                  const meta = actionMeta(entry.action);
                  const Icon = ICONS[entry.action.split('.')[0]] || History;
                  const color = TONE_COLOR[meta.tone] || TONE_COLOR.neutral;
                  const summary = summaryOf(entry.detail);
                  const isOpen = openId === entry.id;
                  return (
                    <div key={entry.id} className="border-b border-line/60 last:border-0">
                      <button
                        onClick={() => setOpenId(isOpen ? null : entry.id)}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-start transition-colors',
                          isOpen ? 'bg-surface-2/50' : 'hover:bg-surface-2/40'
                        )}
                      >
                        <span
                          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
                          style={{ color, background: `color-mix(in oklab, ${color} 12%, transparent)`, borderColor: `color-mix(in oklab, ${color} 24%, transparent)` }}
                        >
                          <Icon size={15} strokeWidth={1.9} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-[12.5px] font-semibold text-ink">{meta.label}</p>
                            <span dir="ltr" className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[9px] text-muted">{entry.action}</span>
                            {entry.entity && (
                              <span className="text-[10px] text-muted">
                                {ENTITY_LABEL[entry.entity] || entry.entity}
                                {entry.entityId ? ` #${entry.entityId}` : ''}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted">
                            <span className="font-medium text-soft">{entry.actor}</span>
                            {entry.ip && <span dir="ltr" className="font-mono text-[9.5px]">{entry.ip}</span>}
                            {summary && <span className="max-w-[360px] truncate">· {summary}</span>}
                          </div>
                        </div>
                        <div className="shrink-0 text-end">
                          <p className="numeric text-[10.5px] text-soft">{clock(entry.at)}</p>
                          <p className="mt-0.5 text-[9px] text-muted">{timeAgo(entry.at)}</p>
                        </div>
                        <ChevronDown
                          size={15}
                          className={cn('mt-1.5 shrink-0 text-muted transition-transform duration-200', isOpen && 'rotate-180')}
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="mx-4 mb-3 rounded-xl border border-line bg-surface-2/45 p-3">
                              <div className="grid gap-2.5 text-[10.5px] sm:grid-cols-2 lg:grid-cols-3">
                                {[
                                  ['المستخدم', entry.actor],
                                  ['معرّف المستخدم', entry.userId ? String(entry.userId) : '—'],
                                  ['الإجراء', entry.action],
                                  ['الكيان', entry.entity ? `${ENTITY_LABEL[entry.entity] || entry.entity}${entry.entityId ? ` #${entry.entityId}` : ''}` : '—'],
                                  ['عنوان IP', entry.ip || '—'],
                                  ['التاريخ الكامل', formatDate(entry.at, true)],
                                ].map(([label, value]) => (
                                  <div key={label}>
                                    <p className="text-[9.5px] text-muted">{label}</p>
                                    <p className="mt-0.5 break-all font-medium text-soft" dir={label === 'عنوان IP' || label === 'الإجراء' ? 'ltr' : undefined}>{value}</p>
                                  </div>
                                ))}
                              </div>

                              {entry.detail ? (
                                <div className="mt-3 overflow-hidden rounded-lg border border-line bg-deep">
                                  <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
                                    <span className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-wider text-muted">
                                      <Copy size={10} /> detail
                                    </span>
                                    <CopyButton value={JSON.stringify(entry.detail, null, 2)} size={12} />
                                  </div>
                                  <pre dir="ltr" className="max-h-56 overflow-auto p-2.5 text-[10.5px] leading-relaxed text-soft">
                                    {JSON.stringify(entry.detail, null, 2)}
                                  </pre>
                                </div>
                              ) : (
                                <p className="mt-3 text-[10.5px] text-muted">لا توجد تفاصيل إضافية لهذا الحدث.</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        )}

        {(list.data?.pages || 1) > 1 && (
          <div className="border-t border-line px-3 py-2.5">
            <Pagination
              page={list.data?.page || 1}
              pages={list.data?.pages || 1}
              total={list.data?.total}
              onChange={setPage}
            />
          </div>
        )}
      </Panel>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-surface/50 px-4 py-3">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-primary" />
        <p className="text-[11px] leading-relaxed text-muted">
          يُحفظ السجل داخل قاعدة البيانات نفسها، لذا ينتقل مع النسخ الاحتياطية والاستعادة. يمكن تصدير أي صفحة
          إلى CSV أو JSON لأغراض المراجعة والتدقيق.
        </p>
      </div>
    </div>
  );
}
