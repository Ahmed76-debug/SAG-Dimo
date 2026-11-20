import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Building2, CalendarClock, Check, Infinity as InfinityIcon,
  KeyRound, MonitorSmartphone, Plus, Search, ShieldCheck, Sparkles, UserPlus, Users, Wand2, Wifi, WifiOff,
} from 'lucide-react';
import { Modal } from '@/components/ui/overlays';
import {
  Badge, Button, CopyButton, EmptyState, Field, Input, ProductIcon, Segmented, Select, Textarea,
} from '@/components/ui/primitives';
import { TagInput } from '@/components/ui/forms';
import { api, downloadFile } from '@/lib/api';
import { useApiQuery } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import type { Customer, License, Plan, Product } from '@/lib/types';
import { cn, formatDate, formatMoney, PLAN_META } from '@/lib/utils';

const STEPS = ['المنتج والعميل', 'الخطة والتفاصيل', 'المراجعة'];

const CURRENCIES = ['USD', 'SAR', 'AED', 'EGP', 'QAR', 'KWD', 'BHD', 'JOD', 'MAD', 'OMR', 'TND', 'DZD'];

const PLAN_ICON = { perpetual: InfinityIcon, subscription: CalendarClock, trial: Sparkles } as const;

const SUB_DAYS = [30, 90, 180, 365, 730];
const TRIAL_DAYS = [7, 14, 30, 60];

type NewCustomer = { name: string; company: string; email: string; phone: string; country: string };

const EMPTY_CUSTOMER: NewCustomer = { name: '', company: '', email: '', phone: '', country: '' };

export function LicenseWizard({ open, onClose, initialProductId, initialCustomerId, onCreated, onOpenLicense }: {
  open: boolean;
  onClose: () => void;
  initialProductId?: number | null;
  initialCustomerId?: number | null;
  onCreated?: () => void;
  onOpenLicense?: (id: number) => void;
}) {
  const { success, error: toastError } = useToast();
  const productsQuery = useApiQuery<{ items: Product[] }>('/products');
  const customersQuery = useApiQuery<{ items: Customer[] }>('/customers');

  const [step, setStep] = useState(0);
  const [productId, setProductId] = useState<number | null>(null);
  const [customerChoice, setCustomerChoice] = useState<number | 'new' | null>(null);
  const [newCustomer, setNewCustomer] = useState<NewCustomer>(EMPTY_CUSTOMER);
  const [customerSearch, setCustomerSearch] = useState('');
  const [plan, setPlan] = useState<Plan>('subscription');
  const [days, setDays] = useState(365);
  const [seats, setSeats] = useState(1);
  const [price, setPrice] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [mode, setMode] = useState<'online' | 'offline' | 'hybrid'>('hybrid');
  const [features, setFeatures] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ license: License; key: string } | null>(null);

  const products = useMemo(() => (productsQuery.data?.items || []).filter((p) => p.status === 'active'), [productsQuery.data]);
  const customers = customersQuery.data?.items || [];
  const product = products.find((p) => p.id === productId) || null;
  const customer = customerChoice === 'new'
    ? null
    : customers.find((c) => c.id === customerChoice) || null;

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => [c.name, c.company, c.email, c.phone].some((v) => (v || '').toLowerCase().includes(q)));
  }, [customers, customerSearch]);

  const applyProduct = (next: Product, keepCustomer = true) => {
    setProductId(next.id);
    setPlan(next.defaultPlan);
    setDays(next.defaultPlan === 'perpetual' ? 0 : next.defaultPlan === 'trial' ? 14 : next.defaultDays || 365);
    setSeats(next.defaultSeats || 1);
    setMode(next.activationMode);
    setFeatures(next.features || []);
    if (!keepCustomer) setCustomerChoice(null);
  };

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setResult(null);
    setFormError(null);
    setCustomerSearch('');
    setNewCustomer(EMPTY_CUSTOMER);
    setPrice(0);
    setNotes('');
    setCustomerChoice(initialCustomerId ?? null);
    const preset = products.find((p) => p.id === initialProductId) || null;
    if (preset) applyProduct(preset);
    else {
      setProductId(null);
      setPlan('subscription');
      setDays(365);
      setSeats(1);
      setMode('hybrid');
      setFeatures([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialProductId, initialCustomerId]);

  useEffect(() => {
    if (open && !productId && products.length === 1) applyProduct(products[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, products.length]);

  const reset = () => {
    setStep(0);
    setResult(null);
    setProductId(null);
    setCustomerChoice(null);
    setNewCustomer(EMPTY_CUSTOMER);
    setCustomerSearch('');
    setPlan('subscription');
    setDays(365);
    setSeats(1);
    setPrice(0);
    setMode('hybrid');
    setFeatures([]);
    setNotes('');
    setFormError(null);
  };

  const close = () => {
    onClose();
    window.setTimeout(reset, 220);
  };

  const isNewCustomer = customerChoice === 'new';
  const customerValid = isNewCustomer ? newCustomer.name.trim().length >= 2 : !!customerChoice;
  const customerLabel = isNewCustomer
    ? newCustomer.name || 'عميل جديد'
    : customer?.name || '';

  const expiresLabel = plan === 'perpetual'
    ? 'بدون تاريخ انتهاء'
    : formatDate(new Date(Date.now() + Math.max(1, days) * 86400000).toISOString());

  const canNext = step === 0
    ? !!product && customerValid
    : step === 1
      ? (plan === 'perpetual' || days >= 1) && seats >= 1
      : true;

  const next = () => {
    setFormError(null);
    if (step === 0) {
      if (!product) { setFormError('اختر منتجاً لإصدار الترخيص'); return; }
      if (!customerValid) { setFormError('اختر عميلاً أو أدخل بيانات عميل جديد'); return; }
      setCustomerSearch('');
    }
    if (step === 1) {
      if (plan !== 'perpetual' && days < 1) { setFormError('حدّد مدة صلاحية صحيحة'); return; }
      if (seats < 1) { setFormError('عدد المقاعد يجب أن يكون ١ على الأقل'); return; }
    }
    setStep((s) => Math.min(2, s + 1));
  };

  const submit = async () => {
    if (!product || !customerValid) return;
    setCreating(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        productId: product.id,
        plan,
        days: plan === 'perpetual' ? 0 : days,
        maxSeats: seats,
        price,
        currency,
        features,
        notes,
        activationMode: mode,
      };
      if (isNewCustomer) body.customer = newCustomer;
      else body.customerId = customerChoice;

      const data = await api<{ license: License; key: string }>('/licenses', { method: 'POST', body });
      setResult(data);
      success('تم توليد الترخيص', `${data.license.uid} · ${product.name}`);
      onCreated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر توليد الترخيص';
      setFormError(message);
      toastError('تعذر توليد الترخيص', message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title={result ? 'تم توليد الترخيص بنجاح' : 'توليد ترخيص جديد'}
      description={result ? 'احفظ المفتاح الآن — لن يظهر كاملاً مرة أخرى بعد إغلاق هذه النافذة.' : 'ثلاث خطوات سريعة لإنشاء ترخيص موقّع وجاهز للتسليم.'}
      footer={result ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={reset}><Plus size={14} /> ترخيص آخر</Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => downloadFile(`/licenses/${result.license.id}/offline-license`)}>
              <ShieldCheck size={14} /> تنزيل ملف .lic
            </Button>
            <Button variant="primary" size="sm" onClick={() => { close(); onOpenLicense?.(result.license.id); }}>
              عرض الترخيص <ArrowLeft size={14} />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Button variant="ghost" onClick={close}>إلغاء</Button>
          {step > 0 && <Button variant="secondary" onClick={() => setStep((s) => s - 1)}><ArrowRight size={15} /> السابق</Button>}
          {step < 2 ? (
            <Button variant="primary" onClick={next} disabled={!canNext}>التالي <ArrowLeft size={15} /></Button>
          ) : (
            <Button variant="primary" onClick={submit} loading={creating} disabled={!canNext}>
              <Wand2 size={15} /> توليد الترخيص
            </Button>
          )}
        </>
      )}
    >
      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="relative overflow-hidden rounded-2xl border border-success/25 bg-success/[0.06] p-5 text-center">
              <div className="pointer-events-none absolute -end-12 -top-12 h-40 w-40 rounded-full bg-success/20 blur-3xl" />
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.05 }}
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success ring-1 ring-success/30"
              >
                <BadgeCheck size={28} />
              </motion.div>
              <p className="mt-3 text-[15px] font-semibold text-ink">ترخيص {PLAN_META[result.license.plan]?.label} جاهز</p>
              <p className="numeric mt-1 text-[11px] text-muted">{result.license.uid} · {result.license.product.name}</p>
            </div>

            <div className="rounded-2xl border border-line bg-deep/70 p-4" dir="ltr">
              <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-muted">LICENSE KEY</p>
              <p className="break-all text-center font-mono text-[15px] font-semibold tracking-[0.06em] text-ink sm:text-[17px]">
                {result.key}
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <CopyButton value={result.key} label="نسخ المفتاح" className="border border-line bg-surface px-3 py-1.5" />
                <span className="rounded-full border border-warning/25 bg-warning/10 px-2 py-0.5 text-[10px] text-warning">يُعرض مرة واحدة</span>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { label: 'العميل', value: result.license.customer?.name || customerLabel },
                { label: 'المقاعد', value: `${result.license.maxSeats} جهاز` },
                { label: 'الانتهاء', value: result.license.expiresAt ? formatDate(result.license.expiresAt) : 'دائم' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-line bg-surface-2/50 px-3 py-2 text-center">
                  <p className="text-[9.5px] text-muted">{item.label}</p>
                  <p className="mt-0.5 truncate text-[11.5px] font-medium text-soft">{item.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* steps */}
            <div className="mb-5 flex items-center gap-2">
              {STEPS.map((label, index) => {
                const done = index < step;
                const active = index === step;
                return (
                  <div key={label} className="flex flex-1 items-center gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors',
                        done ? 'border-success/40 bg-success/15 text-success' : active ? 'border-primary bg-primary text-primary-ink' : 'border-line bg-surface-2 text-muted'
                      )}>
                        {done ? <Check size={13} /> : index + 1}
                      </span>
                      <span className={cn('hidden truncate text-[11.5px] font-medium sm:block', active ? 'text-ink' : 'text-muted')}>{label}</span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className="relative h-px flex-1 overflow-hidden rounded bg-surface-3">
                        <motion.div
                          initial={false}
                          animate={{ width: done ? '100%' : '0%' }}
                          className="absolute inset-y-0 start-0 bg-success/60"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.22 }}
              >
                {step === 0 && (
                  <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-soft"><MonitorSmartphone size={13} /> اختر المنتج</p>
                      {productsQuery.loading && !productsQuery.data ? (
                        <div className="grid gap-2 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-2" />)}</div>
                      ) : products.length === 0 ? (
                        <EmptyState
                          icon={<Sparkles size={22} />}
                          title="لا توجد منتجات نشطة"
                          description="أضف منتجاً أو فعّل منتجاً موجوداً لتتمكن من إصدار التراخيص."
                          className="rounded-xl border border-dashed border-line py-8"
                        />
                      ) : (
                        <div className="grid max-h-[320px] gap-2 overflow-y-auto pe-1 sm:grid-cols-2">
                          {products.map((item) => {
                            const selected = item.id === productId;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => applyProduct(item)}
                                className={cn(
                                  'group relative flex items-start gap-2.5 rounded-xl border p-3 text-start transition-all',
                                  selected ? 'border-primary/50 bg-primary/[0.06] ring-1 ring-primary/35' : 'border-line bg-surface-2/40 hover:border-line-strong hover:bg-surface-2'
                                )}
                              >
                                <ProductIcon icon={item.icon} color={item.color} size="sm" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12px] font-semibold text-ink">{item.name}</p>
                                  <p className="numeric text-[9.5px] text-muted">{item.code} · {item.defaultSeats} مقاعد</p>
                                  <div className="mt-1 flex items-center gap-1 text-[9px] text-muted">
                                    {PLAN_META[item.defaultPlan]?.label} · {item.activationMode === 'online' ? 'أونلاين' : item.activationMode === 'offline' ? 'أوفلاين' : 'هجين'}
                                  </div>
                                </div>
                                {selected && <span className="absolute end-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-ink"><Check size={10} /></span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-soft"><Users size={13} /> العميل</p>
                        <div className="flex items-center gap-1">
                          <Segmented
                            size="sm"
                            value={customerChoice === 'new' ? 'new' : 'existing'}
                            onChange={(v) => setCustomerChoice(v === 'new' ? 'new' : null)}
                            options={[
                              { value: 'existing', label: 'قائم' },
                              { value: 'new', label: 'جديد', icon: <UserPlus size={11} /> },
                            ]}
                          />
                        </div>
                      </div>

                      {customerChoice === 'new' ? (
                        <div className="space-y-2.5 rounded-xl border border-line bg-surface-2/40 p-3">
                          <Field label="اسم العميل" required>
                            <Input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="مثال: خالد الأحمد" />
                          </Field>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Field label="الشركة"><Input value={newCustomer.company} onChange={(e) => setNewCustomer({ ...newCustomer, company: e.target.value })} placeholder="اسم المنشأة" /></Field>
                            <Field label="البريد"><Input value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="name@company.com" dir="ltr" /></Field>
                            <Field label="الهاتف"><Input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="+966…" dir="ltr" /></Field>
                            <Field label="الدولة"><Input value={newCustomer.country} onChange={(e) => setNewCustomer({ ...newCustomer, country: e.target.value })} placeholder="السعودية" /></Field>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="relative">
                            <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
                            <Input
                              value={customerSearch}
                              onChange={(e) => setCustomerSearch(e.target.value)}
                              placeholder="ابحث بالاسم أو الشركة…"
                              className="ps-8"
                            />
                          </div>
                          <div className="max-h-[232px] space-y-1 overflow-y-auto pe-1">
                            {filteredCustomers.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-line py-6 text-center text-[11px] text-muted">
                                لا عملاء مطابقون — استخدم «جديد» لإضافة عميل.
                              </div>
                            ) : filteredCustomers.map((item) => {
                              const selected = item.id === customerChoice;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setCustomerChoice(item.id)}
                                  className={cn(
                                    'flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-start transition',
                                    selected ? 'border-primary/50 bg-primary/[0.06]' : 'border-transparent hover:border-line hover:bg-surface-2'
                                  )}
                                >
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-[10px] font-semibold text-soft">
                                    {item.name.slice(0, 2)}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11.5px] font-medium text-ink">{item.name}</p>
                                    <p className="truncate text-[9.5px] text-muted">{item.company || item.email || '—'}</p>
                                  </div>
                                  {typeof item.licenses === 'number' && item.licenses > 0 && (
                                    <span className="numeric rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] text-muted">{item.licenses}</span>
                                  )}
                                  {selected && <Check size={13} className="text-primary" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-[12px] font-semibold text-soft">نموذج البيع</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {(Object.keys(PLAN_META) as Plan[]).map((key) => {
                          const Icon = PLAN_ICON[key];
                          const meta = PLAN_META[key];
                          const selected = plan === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setPlan(key);
                                if (key === 'perpetual') setDays(0);
                                else if (key === 'trial') setDays(14);
                                else setDays(product?.defaultDays || 365);
                              }}
                              className={cn(
                                'relative rounded-xl border p-3 text-start transition-all',
                                selected ? 'border-primary/50 bg-primary/[0.06] ring-1 ring-primary/35' : 'border-line bg-surface-2/40 hover:border-line-strong'
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', selected ? 'bg-primary/15 text-primary' : 'bg-surface-3 text-muted')}>
                                  <Icon size={16} />
                                </span>
                                {selected && <Check size={14} className="text-primary" />}
                              </div>
                              <p className="mt-2 text-[12.5px] font-semibold text-ink">{meta.label}</p>
                              <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{meta.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {plan !== 'perpetual' && (
                        <Field label="مدة الصلاحية (أيام)" required hint={plan === 'trial' ? 'فترة التجربة تُحسب من تاريخ اليوم' : undefined}>
                          <Input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} dir="ltr" />
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {(plan === 'trial' ? TRIAL_DAYS : SUB_DAYS).map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setDays(d)}
                                className={cn(
                                  'rounded-md border px-1.5 py-0.5 text-[10px] transition',
                                  days === d ? 'border-primary/40 bg-primary-soft text-primary' : 'border-line text-muted hover:text-soft'
                                )}
                              >
                                {d} يوم
                              </button>
                            ))}
                          </div>
                        </Field>
                      )}
                      <Field label="عدد المقاعد" required hint="عدد الأجهزة التي يمكن تفعيلها في آن واحد">
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" size="icon" onClick={() => setSeats((s) => Math.max(1, s - 1))} aria-label="تقليل">−</Button>
                          <Input
                            type="number"
                            min={1}
                            value={seats}
                            onChange={(e) => setSeats(Math.max(1, Number(e.target.value)))}
                            className="text-center"
                            dir="ltr"
                          />
                          <Button type="button" variant="outline" size="icon" onClick={() => setSeats((s) => s + 1)} aria-label="زيادة">+</Button>
                        </div>
                      </Field>
                      <Field label="سعر الترخيص">
                        <div className="flex gap-2">
                          <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} dir="ltr" />
                          <Select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-24">
                            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </Select>
                        </div>
                      </Field>
                      <Field label="وضع التفعيل">
                        <Segmented
                          value={mode}
                          onChange={setMode}
                          className="w-full"
                          options={[
                            { value: 'online', label: 'أونلاين', icon: <Wifi size={12} /> },
                            { value: 'offline', label: 'أوفلاين', icon: <WifiOff size={12} /> },
                            { value: 'hybrid', label: 'هجين', icon: <Sparkles size={12} /> },
                          ]}
                        />
                      </Field>
                    </div>

                    <Field label="الميزات المشمولة" hint="اضغط Enter لإضافة ميزة جديدة">
                      <TagInput value={features} onChange={setFeatures} suggestions={['دعم فني', 'تحديثات مجانية', 'نسخ احتياطي', 'تعدد الفروع', 'تقارير متقدمة']} />
                    </Field>

                    <Field label="ملاحظات داخلية">
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: ترخيص صادر ضمن عرض المؤسسات — تجديد آلي…" rows={2} />
                    </Field>
                  </div>
                )}

                {step === 2 && product && (
                  <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-2/40 p-4">
                      <div className="pointer-events-none absolute -end-14 -top-14 h-40 w-40 rounded-full opacity-20 blur-3xl" style={{ background: product.color }} />
                      <div className="relative flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <ProductIcon icon={product.icon} color={product.color} size="lg" />
                          <div>
                            <p className="text-[14px] font-semibold text-ink">{product.name}</p>
                            <p className="numeric text-[10px] text-muted">{product.code} · {product.platform || 'منتج برمجي'}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <Badge tone={PLAN_META[plan]?.tone}>{PLAN_META[plan]?.label}</Badge>
                              <Badge tone={mode === 'online' ? 'success' : mode === 'offline' ? 'warning' : 'info'}>
                                {mode === 'online' ? 'أونلاين' : mode === 'offline' ? 'أوفلاين' : 'هجين'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="text-end">
                          <p className="numeric text-[22px] font-bold text-ink">{formatMoney(price, currency)}</p>
                          <p className="text-[10px] text-muted">قيمة الترخيص</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: 'العميل', value: customerLabel, icon: Building2 },
                        { label: 'المقاعد', value: `${seats} جهاز`, icon: MonitorSmartphone },
                        { label: 'الانتهاء', value: expiresLabel, icon: CalendarClock },
                        { label: 'الأسعار', value: price ? formatMoney(price, currency) : 'مجاناً', icon: KeyRound },
                      ].map((item) => (
                        <div key={item.label} className="rounded-xl border border-line bg-surface px-3 py-2.5">
                          <p className="flex items-center gap-1 text-[9.5px] text-muted"><item.icon size={10} /> {item.label}</p>
                          <p className="mt-1 truncate text-[11.5px] font-medium text-soft">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold text-soft">الميزات</p>
                      <div className="flex flex-wrap gap-1.5">
                        {features.length === 0 ? <span className="text-[11px] text-muted">بدون ميزات محددة.</span> : features.map((f) => (
                          <span key={f} className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-[10.5px] text-soft">{f}</span>
                        ))}
                      </div>
                    </div>

                    {notes.trim() && (
                      <div className="rounded-xl border border-line bg-surface-2/50 px-3 py-2">
                        <p className="text-[9.5px] text-muted">ملاحظات داخلية</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-soft">{notes}</p>
                      </div>
                    )}

                    <div className="flex items-start gap-2 rounded-xl border border-info/25 bg-info/[0.06] px-3 py-2.5 text-[10.5px] leading-relaxed text-info">
                      <ShieldCheck size={15} className="mt-0.5 shrink-0" />
                      <p>سيُولَّد مفتاح ترخيص مشفّر، ويُوقَّع ملف <span className="numeric">.lic</span> بمفتاح Ed25519. المفتاح الكامل يظهر مرة واحدة فقط بعد التوليد.</p>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {formError && (
              <div className="mt-4 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-[11.5px] text-danger">{formError}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
