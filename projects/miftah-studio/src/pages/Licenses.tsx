import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlarmClock, ArrowUpLeft, ChevronLeft, ChevronRight, CircleDollarSign, Download, Eye, KeyRound, Plus,
  RotateCcw, ShieldCheck, SlidersHorizontal, Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Button, EmptyState, ProductIcon, SearchInput, Select,
} from '@/components/ui/primitives';
import { Menu } from '@/components/ui/overlays';
import { LicenseWizard } from '@/components/licenses/LicenseWizard';
import { LicenseDrawer } from '@/components/licenses/LicenseDrawer';
import {
  DataTable, ErrorPanel, ExpiryCell, Money, Panel, PlanBadge, SeatMeter, StatCard, StatusBadge, TableSkeleton, Td, Th, Tr,
} from '@/components/ui/page';
import { api, downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiQuery, useDebounced } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import type { Customer, License, Paginated, Product } from '@/lib/types';
import { cn, copyText, daysLeft, formatDate, formatMoney, formatNumber } from '@/lib/utils';

const STATUS_TABS = [
  { id: 'all', label: 'الكل' },
  { id: 'active', label: 'نشطة' },
  { id: 'expired', label: 'منتهية' },
  { id: 'suspended', label: 'موقوفة' },
  { id: 'revoked', label: 'ملغاة' },
];

const SORTS = [
  { value: 'newest', label: 'الأحدث إصداراً' },
  { value: 'oldest', label: 'الأقدم إصداراً' },
  { value: 'expiring', label: 'الأقرب انتهاءً' },
  { value: 'price', label: 'الأعلى سعراً' },
  { value: 'customer', label: 'اسم العميل' },
];

export function Licenses() {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState(params.get('status') || 'all');
  const [plan, setPlan] = useState(params.get('plan') || 'all');
  const [productId, setProductId] = useState(params.get('product') || '');
  const [customerId, setCustomerId] = useState(params.get('customer') || '');
  const [expiringDays, setExpiringDays] = useState(params.get('expiring') || '');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPreset, setWizardPreset] = useState<{ product: number | null; customer: number | null }>({ product: null, customer: null });

  const openId = params.get('open');
  const openLicenseId = openId ? Number(openId) : null;

  const list = useApiQuery<Paginated<License>>('/licenses', {
    q: debounced,
    status: status === 'all' ? undefined : status,
    plan: plan === 'all' ? undefined : plan,
    productId: productId || undefined,
    customerId: customerId || undefined,
    expiringDays: expiringDays || undefined,
    sort,
    page,
    limit: 12,
  }, [debounced, status, plan, productId, customerId, expiringDays, sort, page]);

  const overview = useApiQuery<Paginated<License>>('/licenses', { limit: 1 });
  const expiring = useApiQuery<Paginated<License>>('/licenses', { expiringDays: 45, limit: 1 });
  const productsQuery = useApiQuery<{ items: Product[] }>(can('products.view') ? '/products' : null);
  const customersQuery = useApiQuery<{ items: Customer[] }>(can('customers.view') ? '/customers' : null);

  const items = list.data?.items || [];
  const summary = (overview.data?.summary || {}) as Record<string, number>;
  const active = Number(summary.active || 0);
  const expired = Number(summary.expired || 0);
  const suspended = Number(summary.suspended || 0);
  const revoked = Number(summary.revoked || 0);
  const revenue = Number(summary.revenue || 0);
  const total = overview.data?.total ?? 0;
  const expiringCount = expiring.data?.total ?? 0;

  const hasFilters = !!search || status !== 'all' || plan !== 'all' || !!productId || !!customerId || !!expiringDays;

  /* open wizard from URL: ?new=1&product=…&customer=… */
  useEffect(() => {
    if (params.get('new') !== '1') return;
    setWizardPreset({
      product: params.get('product') ? Number(params.get('product')) : null,
      customer: params.get('customer') ? Number(params.get('customer')) : null,
    });
    setWizardOpen(true);
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
  }, [params, setParams]);

  /* sync filters coming from links (products/customers/dashboard) */
  useEffect(() => {
    const p = params.get('product') || '';
    const c = params.get('customer') || '';
    const s = params.get('status') || 'all';
    const pl = params.get('plan') || 'all';
    const ex = params.get('expiring') || '';
    if (p !== productId) setProductId(p);
    if (c !== customerId) setCustomerId(c);
    if (s !== status) setStatus(s);
    if (pl !== plan) setPlan(pl);
    if (ex !== expiringDays) setExpiringDays(ex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    setPage(1);
  }, [debounced, status, plan, productId, customerId, expiringDays, sort]);

  const syncParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const changeStatus = (value: string) => { setStatus(value); syncParam('status', value); };
  const changePlan = (value: string) => { setPlan(value); syncParam('plan', value); };
  const changeProduct = (value: string) => { setProductId(value); syncParam('product', value); };
  const changeCustomer = (value: string) => { setCustomerId(value); syncParam('customer', value); };
  const changeExpiring = (value: string) => { setExpiringDays(value); syncParam('expiring', value); };

  const resetFilters = () => {
    setSearch('');
    changeStatus('all');
    changePlan('all');
    changeProduct('');
    changeCustomer('');
    changeExpiring('');
    setSort('newest');
  };

  const openLicense = (id: number) => {
    const next = new URLSearchParams(params);
    next.set('open', String(id));
    setParams(next);
  };

  const closeLicense = () => {
    const next = new URLSearchParams(params);
    next.delete('open');
    setParams(next);
  };

  const openProduct = (id: number) => {
    closeLicense();
    window.setTimeout(() => navigate(`/products?open=${id}`), 160);
  };

  const products = productsQuery.data?.items || [];
  const customers = customersQuery.data?.items || [];

  const exportQuery = useMemo(() => {
    const query: Record<string, string | number> = {};
    if (debounced) query.q = debounced;
    if (status !== 'all') query.status = status;
    if (plan !== 'all') query.plan = plan;
    if (productId) query.productId = productId;
    if (customerId) query.customerId = customerId;
    if (expiringDays) query.expiringDays = expiringDays;
    query.sort = sort;
    return query;
  }, [debounced, status, plan, productId, customerId, expiringDays, sort]);

  const exportCsv = async () => {
    try {
      const qs = new URLSearchParams(Object.entries(exportQuery).map(([k, v]) => [k, String(v)])).toString();
      await downloadFile(`/licenses/export?${qs}`);
      success('تم تصدير التراخيص', 'ملف CSV متوافق مع Excel');
    } catch (err) {
      toastError('تعذر التصدير', err instanceof Error ? err.message : undefined);
    }
  };

  const copyUid = async (uid: string) => {
    const ok = await copyText(uid);
    if (ok) success('تم النسخ', uid);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><KeyRound size={12} /> إدارة التراخيص</>}
        title="التراخيص"
        description="أصدر التراخيص، تابع المقاعد والتواريخ، وسلّم ملفات موقّعة تعمل أونلاين أو دون اتصال."
        actions={(
          <>
            {can('licenses.export') && (
              <Button variant="secondary" onClick={exportCsv}><Download size={15} /> تصدير CSV</Button>
            )}
            {can('licenses.create') && (
              <Button variant="primary" onClick={() => { setWizardPreset({ product: null, customer: null }); setWizardOpen(true); }}>
                <Plus size={15} /> ترخيص جديد
              </Button>
            )}
          </>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="تراخيص نشطة"
          value={formatNumber(active)}
          hint={`${formatNumber(expired)} منتهية · ${formatNumber(suspended)} موقوفة`}
          icon={ShieldCheck}
          tone="success"
          delay={0}
        />
        <StatCard
          label="تنتهي خلال ٤٥ يوماً"
          value={formatNumber(expiringCount)}
          hint={expiringCount ? 'تحتاج متابعة أو تجديد' : 'لا تراخيص قريبة الانتهاء'}
          icon={AlarmClock}
          tone="warning"
          delay={0.05}
        />
        <StatCard
          label="قيمة الترخيصات"
          value={formatMoney(revenue, 'USD', true)}
          hint={`${formatNumber(total)} ترخيص إجمالاً`}
          icon={Wallet}
          tone="primary"
          delay={0.1}
        />
        <StatCard
          label="نسبة النشاط"
          value={`${total ? Math.round((active / total) * 100) : 0}%`}
          hint={`${formatNumber(revoked)} ملغاة · ${formatNumber(total)} إجمالي`}
          icon={CircleDollarSign}
          tone="accent"
          delay={0.15}
        />
      </div>

      <Panel padded={false}>
        <div className="border-b border-line px-3 pt-1">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {STATUS_TABS.map((tab) => {
              const activeTab = status === tab.id;
              const count = tab.id === 'all'
                ? total
                : tab.id === 'active' ? active
                  : tab.id === 'expired' ? expired
                    : tab.id === 'suspended' ? suspended : revoked;
              return (
                <button
                  key={tab.id}
                  onClick={() => changeStatus(tab.id)}
                  className={cn(
                    'relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[12px] font-medium transition-colors',
                    activeTab ? 'text-ink' : 'text-muted hover:text-soft'
                  )}
                >
                  {tab.label}
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[9.5px]', activeTab ? 'bg-primary-soft text-primary' : 'bg-surface-3 text-muted')}>
                    {formatNumber(count)}
                  </span>
                  {activeTab && <motion.span layoutId="licenses-status-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-3">
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث بالرقم أو المفتاح أو العميل…" className="w-full sm:w-64" />
          <div className="flex flex-wrap items-center gap-1.5">
            <Select value={plan} onChange={(e) => changePlan(e.target.value)} className="w-32" aria-label="نوع الخطة">
              <option value="all">كل الأنواع</option>
              <option value="subscription">اشتراك</option>
              <option value="perpetual">دائم</option>
              <option value="trial">تجريبي</option>
            </Select>
            {can('products.view') && (
              <Select value={productId} onChange={(e) => changeProduct(e.target.value)} className="w-40" aria-label="المنتج">
                <option value="">كل المنتجات</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            )}
            {can('customers.view') && (
              <Select value={customerId} onChange={(e) => changeCustomer(e.target.value)} className="w-40" aria-label="العميل">
                <option value="">كل العملاء</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
            <Select value={expiringDays} onChange={(e) => changeExpiring(e.target.value)} className="w-40" aria-label="قرب الانتهاء">
              <option value="">أي تاريخ انتهاء</option>
              <option value="7">تنتهي خلال ٧ أيام</option>
              <option value="30">تنتهي خلال ٣٠ يوماً</option>
              <option value="45">تنتهي خلال ٤٥ يوماً</option>
              <option value="90">تنتهي خلال ٩٠ يوماً</option>
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-40" aria-label="ترتيب النتائج">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}><RotateCcw size={13} /> مسح</Button>
            )}
          </div>
          <span className="ms-auto hidden items-center gap-1 text-[10px] text-muted lg:flex">
            <SlidersHorizontal size={11} /> {formatNumber(list.data?.total ?? 0)} نتيجة
          </span>
        </div>

        {list.loading && !list.data ? (
          <TableSkeleton rows={6} cols={6} />
        ) : list.error ? (
          <ErrorPanel message={list.error} onRetry={list.reload} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<KeyRound size={25} />}
            title={hasFilters ? 'لا تراخيص مطابقة' : 'لم تُصدر تراخيص بعد'}
            description={hasFilters ? 'جرّب تعديل الفلاتر أو مسحها لعرض نتائج أوسع.' : 'ابدأ بتوليد أول ترخيص لعملائك — دائم أو اشتراك أو تجريبي.'}
            action={can('licenses.create') && !hasFilters ? (
              <Button variant="primary" onClick={() => setWizardOpen(true)}><Plus size={15} /> توليد ترخيص</Button>
            ) : hasFilters ? (
              <Button variant="secondary" onClick={resetFilters}><RotateCcw size={14} /> مسح الفلاتر</Button>
            ) : undefined}
          />
        ) : (
          <>
            {/* desktop table */}
            <div className="hidden md:block">
              <DataTable minWidth={980}>
                <thead>
                  <tr>
                    <Th>الترخيص</Th>
                    <Th>العميل</Th>
                    <Th>النوع</Th>
                    <Th>الحالة</Th>
                    <Th>المقاعد</Th>
                    <Th>الانتهاء</Th>
                    <Th>القيمة</Th>
                    <Th width={44}><span className="sr-only">إجراءات</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((license) => (
                    <Tr key={license.id} onClick={() => openLicense(license.id)}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <ProductIcon icon={license.product.icon} color={license.product.color} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-medium text-ink">{license.product.name}</p>
                            <p className="numeric truncate text-[9.5px] text-muted" dir="ltr">{license.uid}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="min-w-0 max-w-[170px]">
                          <p className="truncate text-[11.5px] text-soft">{license.customer?.name || 'بدون عميل'}</p>
                          <p className="truncate text-[9.5px] text-muted">{license.customer?.company || license.customer?.email || '—'}</p>
                        </div>
                      </Td>
                      <Td><PlanBadge plan={license.plan} /></Td>
                      <Td><StatusBadge status={license.status} /></Td>
                      <Td><SeatMeter used={license.activeActivations} max={license.maxSeats} /></Td>
                      <Td><ExpiryCell expiresAt={license.expiresAt} plan={license.plan} /></Td>
                      <Td><Money value={license.price} currency={license.currency} compact className="text-[12px] text-soft" /></Td>
                      <Td className="text-end">
                        <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
                          <Menu items={[
                            { label: 'عرض التفاصيل', icon: <Eye size={14} />, onClick: () => openLicense(license.id) },
                            ...(can('licenses.export') ? [{
                              label: 'تنزيل ملف .lic',
                              icon: <Download size={14} />,
                              onClick: () => downloadFile(`/licenses/${license.id}/offline-license`).catch((err) => toastError('تعذر التنزيل', err instanceof Error ? err.message : undefined)),
                            }] : []),
                            { label: 'نسخ رقم الترخيص', icon: <KeyRound size={14} />, onClick: () => copyUid(license.uid) },
                            ...(license.customer ? [{ label: 'عرض العميل', icon: <ArrowUpLeft size={14} />, onClick: () => navigate(`/customers?open=${license.customer!.id}`) }] : []),
                          ]} />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </div>

            {/* mobile cards */}
            <div className="space-y-2 p-3 md:hidden">
              {items.map((license, index) => {
                const left = daysLeft(license.expiresAt);
                return (
                  <motion.button
                    key={license.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.2) }}
                    onClick={() => openLicense(license.id)}
                    className="w-full rounded-xl border border-line bg-surface p-3 text-start transition hover:border-line-strong"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ProductIcon icon={license.product.icon} color={license.product.color} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium text-ink">{license.product.name}</p>
                          <p className="numeric truncate text-[9px] text-muted" dir="ltr">{license.uid}</p>
                          <p className="truncate text-[9.5px] text-muted">{license.customer?.name || 'بدون عميل'}</p>
                        </div>
                      </div>
                      <StatusBadge status={license.status} />
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-line/60 pt-2">
                      <div><p className="text-[8.5px] text-muted">النوع</p><p className="mt-0.5 text-[10px] text-soft">{license.planLabel}</p></div>
                      <div><p className="text-[8.5px] text-muted">المقاعد</p><p className="numeric mt-0.5 text-[10px] text-soft">{license.activeActivations}/{license.maxSeats}</p></div>
                      <div>
                        <p className="text-[8.5px] text-muted">الانتهاء</p>
                        <p className={cn('mt-0.5 text-[10px]', left !== null && left < 0 ? 'text-danger' : left !== null && left <= 30 ? 'text-warning' : 'text-soft')}>
                          {license.expiresAt ? formatDate(license.expiresAt) : 'دائم'}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2.5">
              <p className="text-[10.5px] text-muted">عرض {formatNumber(items.length)} من {formatNumber(list.data?.total ?? 0)} ترخيص</p>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="السابق">
                  <ChevronRight size={14} />
                </Button>
                <span className="numeric px-2 text-[11px] text-soft">{page} / {list.data?.pages ?? 1}</span>
                <Button size="icon" variant="outline" disabled={page >= (list.data?.pages ?? 1)} onClick={() => setPage((p) => p + 1)} aria-label="التالي">
                  <ChevronLeft size={14} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Panel>

      <LicenseWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        initialProductId={wizardPreset.product}
        initialCustomerId={wizardPreset.customer}
        onCreated={() => { list.reload(); overview.reload(); expiring.reload(); }}
        onOpenLicense={(id) => { setWizardOpen(false); window.setTimeout(() => openLicense(id), 180); }}
      />

      <LicenseDrawer
        open={!!openId}
        licenseId={openLicenseId}
        onClose={closeLicense}
        onChanged={() => { list.reload(); overview.reload(); expiring.reload(); }}
        onOpenProduct={openProduct}
      />
    </div>
  );
}
