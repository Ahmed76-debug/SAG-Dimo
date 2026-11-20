import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowUpLeft, Boxes, CircleDollarSign, Edit3, KeyRound, Layers, LayoutGrid, List, Package,
  Plus, Power, Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Badge, Button, EmptyState, Field, Input, ProductIcon, SearchInput, Segmented, Select,
  StatusDot, Textarea,
} from '@/components/ui/primitives';
import { ConfirmDialog, Drawer, Menu, Modal } from '@/components/ui/overlays';
import { ColorPicker, IconPicker, TagInput } from '@/components/ui/forms';
import {
  DataTable, ErrorPanel, FilterBar, ModeBadge, Money, Panel, PlanBadge, StatCard, SummaryStrip, TableSkeleton, Td, Th, Tr,
} from '@/components/ui/page';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiQuery, useDebounced } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import type { Product } from '@/lib/types';
import { cn, formatDate, formatMoney, formatNumber, PLAN_META } from '@/lib/utils';

interface ProductDetail {
  product: Product;
  stats: { total: number; active: number; revenue: number };
  recent: {
    id: number; uid: string; key_hint: string; plan: string; status: string; expires_at: string | null;
    issued_at: string; customer_name: string | null; company: string | null;
  }[];
}

type FormState = {
  name: string; nameEn: string; code: string; description: string; category: string; platform: string;
  version: string; vendor: string; website: string; color: string; icon: string;
  activationMode: 'online' | 'offline' | 'hybrid';
  defaultPlan: 'subscription' | 'perpetual' | 'trial';
  defaultDays: number; defaultSeats: number; features: string[]; status: 'active' | 'inactive';
};

const EMPTY_FORM: FormState = {
  name: '', nameEn: '', code: '', description: '', category: '', platform: 'Windows', version: '1.0.0',
  vendor: '', website: '', color: '#6366f1', icon: 'app-window', activationMode: 'hybrid',
  defaultPlan: 'subscription', defaultDays: 365, defaultSeats: 1, features: [], status: 'active',
};

function productToForm(product: Product): FormState {
  return {
    name: product.name, nameEn: product.nameEn || '', code: product.code, description: product.description || '',
    category: product.category || '', platform: product.platform || '', version: product.version || '',
    vendor: product.vendor || '', website: product.website || '', color: product.color, icon: product.icon,
    activationMode: product.activationMode, defaultPlan: product.defaultPlan, defaultDays: product.defaultDays,
    defaultSeats: product.defaultSeats, features: product.features || [], status: product.status,
  };
}

function toPayload(form: FormState, overrides: Partial<FormState> = {}) {
  const merged = { ...form, ...overrides };
  return {
    name: merged.name, nameEn: merged.nameEn, code: merged.code, description: merged.description,
    category: merged.category, platform: merged.platform, version: merged.version, vendor: merged.vendor,
    website: merged.website, color: merged.color, icon: merged.icon, activationMode: merged.activationMode,
    defaultPlan: merged.defaultPlan, defaultDays: merged.defaultDays, defaultSeats: merged.defaultSeats,
    features: merged.features, status: merged.status,
  };
}

export function Products() {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  const openId = params.get('open');

  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing(null);
      setFormOpen(true);
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const list = useApiQuery<{ items: Product[] }>('/products', { q: debounced, status }, [debounced, status]);
  const detail = useApiQuery<ProductDetail>(openId ? `/products/${openId}` : null, undefined, [openId]);

  const products = list.data?.items || [];
  const stats = useMemo(() => {
    const lic = products.reduce((sum, p) => sum + (p.licenses || 0), 0);
    const active = products.filter((p) => p.status === 'active').length;
    const revenue = products.reduce((sum, p) => sum + (p.revenue || 0), 0);
    return { total: products.length, active, lic, revenue };
  }, [products]);

  const openDetail = (id: number) => {
    const next = new URLSearchParams(params);
    next.set('open', String(id));
    setParams(next);
  };
  const closeDetail = () => {
    const next = new URLSearchParams(params);
    next.delete('open');
    setParams(next);
  };

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (product: Product) => { setEditing(product); setFormOpen(true); };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api(`/products/${deleteTarget.id}`, { method: 'DELETE' });
      success('تم حذف المنتج', `${deleteTarget.name} أُزيل من الكتالوج`);
      setDeleteTarget(null);
      if (openId === String(deleteTarget.id)) closeDetail();
      list.reload();
    } catch (err) {
      toastError('تعذر حذف المنتج', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (product: Product) => {
    try {
      await api(`/products/${product.id}`, { method: 'PUT', body: toPayload(productToForm(product), { status: product.status === 'active' ? 'inactive' : 'active' }) });
      success(product.status === 'active' ? 'تم تعطيل المنتج' : 'تم تفعيل المنتج', product.name);
      list.reload();
      if (openId === String(product.id)) detail.reload();
    } catch (err) {
      toastError('تعذر تحديث المنتج', err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><Boxes size={12} /> كتالوج المنتجات</>}
        title="المنتجات"
        description="كل تطبيق تديره من مفتاح — حدّد نموذج الترخيص، المقاعد، والميزات ثم أصدر التراخيص فوراً."
        actions={can('products.manage') && (
          <Button variant="primary" onClick={openCreate}><Plus size={15} /> منتج جديد</Button>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي المنتجات" value={formatNumber(stats.total)} hint={`${stats.active} منتج نشط`} icon={Boxes} tone="primary" delay={0} />
        <StatCard label="التراخيص المرتبطة" value={formatNumber(stats.lic)} hint="عبر كل المنتجات" icon={KeyRound} tone="info" delay={0.05} />
        <StatCard label="الإيرادات" value={formatMoney(stats.revenue, 'USD', true)} hint="إجمالي قيمة التراخيص" icon={CircleDollarSign} tone="success" delay={0.1} />
        <StatCard label="المنتجات النشطة" value={formatNumber(stats.active)} hint={stats.total ? `${Math.round((stats.active / stats.total) * 100)}% من الكتالوج` : '—'} icon={Layers} tone="accent" delay={0.15} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الرمز…" className="w-full sm:w-64" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36" aria-label="حالة المنتج">
            <option value="all">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">معطّل</option>
          </Select>
        </FilterBar>
        <Segmented
          value={view}
          onChange={setView}
          options={[{ value: 'grid', label: 'بطاقات', icon: <LayoutGrid size={13} /> }, { value: 'list', label: 'قائمة', icon: <List size={13} /> }]}
        />
      </div>

      {list.loading && !list.data ? (
        <div className="card"><TableSkeleton rows={4} cols={4} /></div>
      ) : list.error ? (
        <ErrorPanel message={list.error} onRetry={list.reload} />
      ) : products.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Package size={25} />}
            title={search || status !== 'all' ? 'لا منتجات مطابقة' : 'لم تُضف منتجات بعد'}
            description={search || status !== 'all' ? 'جرّب تغيير كلمات البحث أو الفلاتر.' : 'أضف أول منتج لتبدأ توليد التراخيص وتفعيل الأجهزة.'}
            action={can('products.manage') && !search ? <Button variant="primary" onClick={openCreate}><Plus size={15} /> إضافة منتج</Button> : undefined}
          />
        </div>
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product, index) => {
            const activeLic = product.activeLicenses || 0;
            const totalLic = product.licenses || 0;
            return (
              <motion.article
                key={product.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.035, 0.25), duration: 0.35 }}
                whileHover={{ y: -3 }}
                className="card group relative flex cursor-pointer flex-col overflow-hidden p-4 transition-colors hover:border-line-strong"
                onClick={() => openDetail(product.id)}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-primary/30 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ProductIcon icon={product.icon} color={product.color} size="lg" />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{product.name}</p>
                      <p className="truncate text-[10.5px] text-muted">{product.nameEn || product.category || 'منتج برمجي'}</p>
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Menu
                      items={[
                        { label: 'عرض التفاصيل', icon: <ArrowUpLeft size={14} />, onClick: () => openDetail(product.id) },
                        ...(can('products.manage') ? [{ label: 'تعديل المنتج', icon: <Edit3 size={14} />, onClick: () => openEdit(product) }] : []),
                        ...(can('licenses.create') ? [{ label: 'توليد ترخيص', icon: <KeyRound size={14} />, onClick: () => navigate(`/licenses?new=1&product=${product.id}`) }] : []),
                        ...(can('products.manage') ? [{ label: product.status === 'active' ? 'تعطيل المنتج' : 'تفعيل المنتج', icon: <Power size={14} />, onClick: () => toggleStatus(product) }] : []),
                        ...(can('products.manage') ? [{ label: 'حذف المنتج', icon: <Trash2 size={14} />, danger: true, separator: true, onClick: () => setDeleteTarget(product) }] : []),
                      ]}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone={product.status === 'active' ? 'success' : 'neutral'} dot>{product.status === 'active' ? 'نشط' : 'معطّل'}</Badge>
                  <ModeBadge mode={product.activationMode} />
                  <PlanBadge plan={product.defaultPlan} />
                  <span className="numeric rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[9.5px] text-muted">{product.code}</span>
                </div>

                <p className="mt-2.5 line-clamp-2 min-h-[34px] text-[11px] leading-relaxed text-muted">
                  {product.description || 'لا يوجد وصف بعد لهذا المنتج.'}
                </p>

                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'تراخيص', value: formatNumber(totalLic) },
                    { label: 'نشطة', value: formatNumber(activeLic) },
                    { label: 'إيراد', value: formatMoney(product.revenue || 0, 'USD', true) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-surface-2/60 px-2 py-1.5">
                      <p className="text-[9px] text-muted">{item.label}</p>
                      <p className="numeric mt-0.5 text-[11.5px] font-semibold text-soft">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5 text-[10px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <StatusDot color={product.status === 'active' ? 'var(--success)' : 'var(--muted)'} />
                    {product.platform || '—'} · v{product.version || '1.0'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-primary opacity-0 transition group-hover:opacity-100">
                    التفاصيل <ArrowUpLeft size={11} />
                  </span>
                </div>
              </motion.article>
            );
          })}
        </div>
      ) : (
        <Panel padded={false}>
          <DataTable minWidth={860}>
            <thead>
              <tr>
                <Th>المنتج</Th>
                <Th>النموذج</Th>
                <Th>التراخيص</Th>
                <Th>النشطة</Th>
                <Th>الإيراد</Th>
                <Th>الحالة</Th>
                <Th><span className="sr-only">إجراءات</span></Th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <Tr key={product.id} onClick={() => openDetail(product.id)}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <ProductIcon icon={product.icon} color={product.color} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-ink">{product.name}</p>
                        <p className="numeric text-[10px] text-muted">{product.code} · v{product.version || '1.0'}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-1"><PlanBadge plan={product.defaultPlan} /><ModeBadge mode={product.activationMode} /></div>
                  </Td>
                  <Td><span className="numeric text-[12px] text-soft">{formatNumber(product.licenses || 0)}</span></Td>
                  <Td><span className="numeric text-[12px] text-soft">{formatNumber(product.activeLicenses || 0)}</span></Td>
                  <Td><Money value={product.revenue || 0} compact className="text-[12px] text-soft" /></Td>
                  <Td><Badge tone={product.status === 'active' ? 'success' : 'neutral'} dot>{product.status === 'active' ? 'نشط' : 'معطّل'}</Badge></Td>
                  <Td className="text-end">
                    <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
                      <Menu items={[
                        { label: 'عرض التفاصيل', icon: <ArrowUpLeft size={14} />, onClick: () => openDetail(product.id) },
                        ...(can('products.manage') ? [{ label: 'تعديل', icon: <Edit3 size={14} />, onClick: () => openEdit(product) }] : []),
                        ...(can('licenses.create') ? [{ label: 'توليد ترخيص', icon: <KeyRound size={14} />, onClick: () => navigate(`/licenses?new=1&product=${product.id}`) }] : []),
                        ...(can('products.manage') ? [{ label: 'حذف', icon: <Trash2 size={14} />, danger: true, separator: true, onClick: () => setDeleteTarget(product) }] : []),
                      ]} />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
      )}

      <ProductFormModal
        open={formOpen}
        product={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); list.reload(); if (openId) detail.reload(); }}
      />

      <Drawer
        open={!!openId}
        onClose={closeDetail}
        width="max-w-2xl"
        title={detail.data ? (
          <div className="flex items-center gap-3">
            <ProductIcon icon={detail.data.product.icon} color={detail.data.product.color} size="lg" />
            <div>
              <p className="text-[15px] font-semibold text-ink">{detail.data.product.name}</p>
              <p className="numeric text-[10.5px] text-muted">{detail.data.product.code} · إصدار {detail.data.product.version || '1.0'}</p>
            </div>
          </div>
        ) : <p className="text-[14px] font-semibold text-ink">تفاصيل المنتج</p>}
        footer={detail.data && can('products.manage') ? (
          <div className="flex items-center justify-between gap-2">
            <Button variant="danger" size="sm" onClick={() => setDeleteTarget(detail.data!.product)}><Trash2 size={14} /> حذف</Button>
            <div className="flex gap-2">
              {can('licenses.create') && (
                <Button variant="secondary" size="sm" onClick={() => navigate(`/licenses?new=1&product=${detail.data!.product.id}`)}>
                  <KeyRound size={14} /> توليد ترخيص
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={() => openEdit(detail.data!.product)}><Edit3 size={14} /> تعديل</Button>
            </div>
          </div>
        ) : undefined}
      >
        {detail.loading && !detail.data ? <div className="p-6"><TableSkeleton rows={5} cols={3} /></div> : !detail.data ? (
          <div className="p-6"><EmptyState title="تعذر تحميل المنتج" description={detail.error || undefined} /></div>
        ) : (
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={detail.data.product.status === 'active' ? 'success' : 'neutral'} dot>{detail.data.product.status === 'active' ? 'نشط' : 'معطّل'}</Badge>
              <ModeBadge mode={detail.data.product.activationMode} />
              <PlanBadge plan={detail.data.product.defaultPlan} />
              {detail.data.product.category && <Badge>{detail.data.product.category}</Badge>}
              {detail.data.product.platform && <Badge>{detail.data.product.platform}</Badge>}
            </div>

            <p className="text-[12px] leading-relaxed text-soft">{detail.data.product.description || 'لا يوجد وصف.'}</p>

            <SummaryStrip items={[
              { label: 'إجمالي التراخيص', value: formatNumber(detail.data.stats.total) },
              { label: 'النشطة', value: formatNumber(detail.data.stats.active), tone: 'var(--success)' },
              { label: 'الإيراد', value: formatMoney(detail.data.stats.revenue, 'USD', true) },
              { label: 'المقاعد الافتراضية', value: formatNumber(detail.data.product.defaultSeats) },
            ]} />

            <div>
              <p className="mb-2 text-[11px] font-semibold text-soft">الميزات المشمولة</p>
              <div className="flex flex-wrap gap-1.5">
                {detail.data.product.features.length ? detail.data.product.features.map((feature) => (
                  <span key={feature} className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-[10.5px] text-soft">{feature}</span>
                )) : <span className="text-[11px] text-muted">لم تُضف ميزات بعد.</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'المورّد', value: detail.data.product.vendor || '—' },
                { label: 'الموقع', value: detail.data.product.website || '—' },
                { label: 'مدة افتراضية', value: `${detail.data.product.defaultDays} يوم` },
                { label: 'أُضيف في', value: formatDate(detail.data.product.createdAt) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-line bg-surface-2/50 px-3 py-2">
                  <p className="text-[9.5px] text-muted">{item.label}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-soft">{item.value}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold text-soft">أحدث التراخيص</p>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/licenses?product=${detail.data!.product.id}`)}>عرض الكل <ArrowUpLeft size={12} /></Button>
              </div>
              {detail.data.recent.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[11px] text-muted">لا تراخيص لهذا المنتج بعد</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-line">
                  {detail.data.recent.map((license, index) => (
                    <button
                      key={license.id}
                      onClick={() => navigate(`/licenses?open=${license.id}`)}
                      className={cn('flex w-full items-center gap-2 px-3 py-2 text-start transition hover:bg-surface-2', index !== 0 && 'border-t border-line/60')}
                    >
                      <KeyRound size={13} className="text-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="numeric truncate text-[10.5px] text-soft">{license.uid}</p>
                        <p className="truncate text-[9.5px] text-muted">{license.customer_name || 'بدون عميل'} · {formatDate(license.issued_at)}</p>
                      </div>
                      <Badge tone={license.status === 'active' ? 'success' : license.status === 'revoked' ? 'danger' : 'warning'}>
                        {license.status === 'active' ? 'نشط' : license.status === 'revoked' ? 'ملغى' : license.status === 'suspended' ? 'موقوف' : 'منتهي'}
                      </Badge>
                      <span className="text-[9.5px] text-muted">{PLAN_META[license.plan]?.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={busy}
        title={`حذف ${deleteTarget?.name}؟`}
        description="سيُحذف المنتج نهائياً. لا يمكن حذف منتج مرتبط بتراخيص — يمكنك تعطيله بدلاً من ذلك."
        confirmText="حذف المنتج"
      />
    </div>
  );
}

/* ----------------------------- Product form ---------------------------- */
function ProductFormModal({ open, product, onClose, onSaved }: {
  open: boolean; product: Product | null; onClose: () => void; onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(product ? productToForm(product) : EMPTY_FORM);
    setFormError(null);
  }, [open, product]);

  const patch = (values: Partial<FormState>) => setForm((prev) => ({ ...prev, ...values }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      setFormError('اسم المنتج والرمز مطلوبان');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (product) {
        await api(`/products/${product.id}`, { method: 'PUT', body: toPayload(form) });
        success('تم تحديث المنتج', form.name);
      } else {
        await api('/products', { method: 'POST', body: toPayload(form) });
        success('تمت إضافة المنتج', 'يمكنك الآن توليد تراخيص له');
      }
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر حفظ المنتج';
      setFormError(message);
      toastError('تعذر حفظ المنتج', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={product ? 'تعديل المنتج' : 'منتج جديد'}
      description={product ? 'حدّث بيانات المنتج وإعداداته الافتراضية.' : 'أضف تطبيقاً جديداً إلى كتالوج مفتاح.'}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={submit} loading={saving}>{product ? 'حفظ التعديلات' : 'إضافة المنتج'}</Button>
        </>
      )}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم المنتج" required>
            <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="مثال: Cafe Manager Pro" />
          </Field>
          <Field label="الاسم بالإنجليزية">
            <Input value={form.nameEn} onChange={(e) => patch({ nameEn: e.target.value })} placeholder="Cafe Manager Pro" dir="ltr" />
          </Field>
          <Field label="رمز المنتج" required hint="أحرف إنجليزية وأرقام — يُستخدم في مفتاح الترخيص">
            <Input value={form.code} onChange={(e) => patch({ code: e.target.value.toUpperCase() })} placeholder="CAFE" dir="ltr" maxLength={10} />
          </Field>
          <Field label="التصنيف">
            <Input value={form.category} onChange={(e) => patch({ category: e.target.value })} placeholder="نقاط بيع، صحي، تعليم…" />
          </Field>
          <Field label="المنصة">
            <Select value={form.platform} onChange={(e) => patch({ platform: e.target.value })} aria-label="منصة المنتج">
              <option value="Windows">Windows</option>
              <option value="macOS">macOS</option>
              <option value="Linux">Linux</option>
              <option value="Cross-platform">متعدد المنصات</option>
              <option value="Web">ويب</option>
            </Select>
          </Field>
          <Field label="الإصدار">
            <Input value={form.version} onChange={(e) => patch({ version: e.target.value })} placeholder="1.0.0" dir="ltr" />
          </Field>
        </div>

        <Field label="الوصف">
          <Textarea value={form.description} onChange={(e) => patch({ description: e.target.value })} placeholder="وصف مختصر للمنتج وميزاته…" rows={3} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="هوية اللون">
            <ColorPicker value={form.color} onChange={(color) => patch({ color })} />
          </Field>
          <Field label="أيقونة المنتج">
            <IconPicker value={form.icon} color={form.color} onChange={(icon) => patch({ icon })} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="وضع التفعيل">
            <Select value={form.activationMode} onChange={(e) => patch({ activationMode: e.target.value as FormState['activationMode'] })} aria-label="وضع التفعيل">
              <option value="hybrid">هجين — أونلاين وأوفلاين</option>
              <option value="online">أونلاين فقط</option>
              <option value="offline">أوفلاين فقط</option>
            </Select>
          </Field>
          <Field label="نموذج البيع الافتراضي">
            <Select value={form.defaultPlan} onChange={(e) => patch({ defaultPlan: e.target.value as FormState['defaultPlan'] })} aria-label="نموذج البيع الافتراضي">
              <option value="subscription">اشتراك</option>
              <option value="perpetual">دائم</option>
              <option value="trial">تجريبي</option>
            </Select>
          </Field>
          <Field label="المدة الافتراضية (أيام)" hint="تُتجاهل للتراخيص الدائمة">
            <Input type="number" min={0} value={form.defaultDays} onChange={(e) => patch({ defaultDays: Number(e.target.value) })} />
          </Field>
          <Field label="المقاعد الافتراضية">
            <Input type="number" min={1} value={form.defaultSeats} onChange={(e) => patch({ defaultSeats: Number(e.target.value) })} />
          </Field>
          <Field label="المورّد">
            <Input value={form.vendor} onChange={(e) => patch({ vendor: e.target.value })} placeholder="اسم شركتك" />
          </Field>
          <Field label="الموقع الإلكتروني">
            <Input value={form.website} onChange={(e) => patch({ website: e.target.value })} placeholder="https://…" dir="ltr" />
          </Field>
        </div>

        <Field label="الميزات المشمولة" hint="تُنسخ تلقائياً إلى التراخيص الجديدة">
          <TagInput value={form.features} onChange={(features) => patch({ features })} suggestions={['دعم فني', 'تحديثات مجانية', 'نسخ احتياطي سحابي', 'تعدد الفروع', 'تقارير متقدمة']} />
        </Field>

        <Field label="حالة المنتج">
          <Select value={form.status} onChange={(e) => patch({ status: e.target.value as 'active' | 'inactive' })} aria-label="حالة المنتج">
            <option value="active">نشط — يسمح بإصدار التراخيص</option>
            <option value="inactive">معطّل — يوقف الإصدار الجديد</option>
          </Select>
        </Field>

        {formError && <div className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-[11.5px] text-danger">{formError}</div>}
      </form>
    </Modal>
  );
}
