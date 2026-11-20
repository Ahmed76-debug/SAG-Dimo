import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowUpLeft, Building2, CircleDollarSign, Edit3, Globe2, KeyRound, Mail, MapPin, Phone,
  Plus, Receipt, Trash2, UserPlus, UsersRound,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Avatar, Badge, Button, EmptyState, Field, Input, SearchInput, Select, Textarea,
} from '@/components/ui/primitives';
import { ConfirmDialog, Drawer, Menu, Modal } from '@/components/ui/overlays';
import {
  DataTable, ErrorPanel, ExpiryCell, FilterBar, Money, Panel, PlanBadge, StatCard, StatusBadge,
  SummaryStrip, TableSkeleton, Td, Th, Tr,
} from '@/components/ui/page';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiQuery, useDebounced } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import type { Customer } from '@/lib/types';
import { cn, formatDate, formatMoney, formatNumber } from '@/lib/utils';

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#f43f5e', '#14b8a6'];
const colorFor = (id: number) => COLORS[id % COLORS.length];

const COUNTRIES = ['السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عمان', 'مصر', 'الأردن', 'الجزائر', 'المغرب', 'تونس', 'ليبيا', 'العراق', 'لبنان', 'سوريا', 'فلسطين', 'السودان', 'اليمن'];

interface CustomerDetail {
  customer: Customer;
  licenses: {
    id: number; uid: string; key_hint: string; plan: string; status: string; expires_at: string | null;
    issued_at: string; price: number; product_name: string; product_color: string; product_code: string;
    effective_status: string;
  }[];
}

type FormState = { name: string; company: string; email: string; phone: string; country: string; taxId: string; notes: string };
const EMPTY: FormState = { name: '', company: '', email: '', phone: '', country: 'السعودية', taxId: '', notes: '' };

function toForm(customer: Customer): FormState {
  return {
    name: customer.name, company: customer.company || '', email: customer.email || '', phone: customer.phone || '',
    country: customer.country || '', taxId: customer.taxId || '', notes: customer.notes || '',
  };
}

export function Customers() {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
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

  const list = useApiQuery<{ items: Customer[] }>('/customers', { q: debounced }, [debounced]);
  const detail = useApiQuery<CustomerDetail>(openId ? `/customers/${openId}` : null, undefined, [openId]);

  const customers = list.data?.items || [];
  const stats = useMemo(() => ({
    total: customers.length,
    activeLicenses: customers.reduce((sum, c) => sum + (c.activeLicenses || 0), 0),
    revenue: customers.reduce((sum, c) => sum + (c.revenue || 0), 0),
    countries: new Set(customers.map((c) => c.country).filter(Boolean)).size,
  }), [customers]);

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

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api(`/customers/${deleteTarget.id}`, { method: 'DELETE' });
      success('تم حذف العميل', deleteTarget.name);
      setDeleteTarget(null);
      if (openId === String(deleteTarget.id)) closeDetail();
      list.reload();
    } catch (err) {
      toastError('تعذر حذف العميل', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><UsersRound size={12} /> سجل العملاء</>}
        title="العملاء"
        description="ملف موحّد لكل عميل: تواصله، تراخيصه، إيراداته، وآخر نشاط — لخدمة أسرع وقرارات أذكى."
        actions={can('customers.manage') && (
          <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={15} /> عميل جديد</Button>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي العملاء" value={formatNumber(stats.total)} hint="في قاعدة البيانات" icon={UsersRound} tone="primary" delay={0} />
        <StatCard label="تراخيص نشطة" value={formatNumber(stats.activeLicenses)} hint="مرتبطة بعملاء" icon={KeyRound} tone="success" delay={0.05} />
        <StatCard label="إجمالي الإيرادات" value={formatMoney(stats.revenue, 'USD', true)} hint="من كل التراخيص" icon={CircleDollarSign} tone="info" delay={0.1} />
        <StatCard label="دول مختلفة" value={formatNumber(stats.countries)} hint="انتشار إقليمي" icon={Globe2} tone="accent" delay={0.15} />
      </div>

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="ابحث بالاسم، الشركة، البريد أو الهاتف…" className="w-full sm:w-80" />
        <span className="text-[10.5px] text-muted">{formatNumber(customers.length)} نتيجة</span>
      </FilterBar>

      {list.loading && !list.data ? (
        <div className="card"><TableSkeleton rows={7} cols={5} /></div>
      ) : list.error ? (
        <ErrorPanel message={list.error} onRetry={list.reload} />
      ) : customers.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<UserPlus size={25} />}
            title={search ? 'لا عملاء مطابقون' : 'لا يوجد عملاء بعد'}
            description={search ? 'جرّب كلمة بحث أخرى.' : 'أضف عميلاً أو أصدر ترخيصاً جديداً وسيُنشأ ملفه تلقائياً.'}
            action={can('customers.manage') && !search ? <Button variant="primary" onClick={() => setFormOpen(true)}><Plus size={15} /> إضافة عميل</Button> : undefined}
          />
        </div>
      ) : (
        <Panel padded={false}>
          <DataTable minWidth={900}>
            <thead>
              <tr>
                <Th>العميل</Th>
                <Th>التواصل</Th>
                <Th>الدولة</Th>
                <Th>التراخيص</Th>
                <Th>الإيراد</Th>
                <Th>مضاف في</Th>
                <Th><span className="sr-only">إجراءات</span></Th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer, index) => (
                <motion.tr
                  key={customer.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(index * 0.02, 0.2) }}
                  onClick={() => openDetail(customer.id)}
                  className="group/row cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-surface-2/70"
                >
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={customer.name} color={colorFor(customer.id)} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-ink">{customer.name}</p>
                        <p className="truncate text-[10px] text-muted">{customer.company || 'فرد'}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <p className="truncate text-[11px] text-soft" dir="ltr">{customer.email || '—'}</p>
                    <p className="numeric truncate text-[10px] text-muted" dir="ltr">{customer.phone || '—'}</p>
                  </Td>
                  <Td>
                    {customer.country ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-soft"><MapPin size={11} className="text-muted" />{customer.country}</span>
                    ) : <span className="text-[11px] text-muted">—</span>}
                  </Td>
                  <Td>
                    <p className="numeric text-[11.5px] text-soft">{formatNumber(customer.licenses || 0)} <span className="text-[9.5px] text-muted">إجمالي</span></p>
                    <p className="text-[9.5px] text-success">{formatNumber(customer.activeLicenses || 0)} نشط</p>
                  </Td>
                  <Td><Money value={customer.revenue || 0} compact className="text-[12px] text-soft" /></Td>
                  <Td><span className="text-[10.5px] text-muted">{formatDate(customer.createdAt)}</span></Td>
                  <Td className="text-end">
                    <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
                      <Menu items={[
                        { label: 'عرض الملف', icon: <ArrowUpLeft size={14} />, onClick: () => openDetail(customer.id) },
                        ...(can('customers.manage') ? [{ label: 'تعديل', icon: <Edit3 size={14} />, onClick: () => { setEditing(customer); setFormOpen(true); } }] : []),
                        ...(can('licenses.create') ? [{ label: 'توليد ترخيص', icon: <KeyRound size={14} />, onClick: () => navigate(`/licenses?new=1&customer=${customer.id}`) }] : []),
                        ...(can('customers.manage') ? [{ label: 'حذف', icon: <Trash2 size={14} />, danger: true, separator: true, onClick: () => setDeleteTarget(customer) }] : []),
                      ]} />
                    </div>
                  </Td>
                </motion.tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
      )}

      <CustomerFormModal
        open={formOpen}
        customer={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); list.reload(); if (openId) detail.reload(); }}
      />

      <Drawer
        open={!!openId}
        onClose={closeDetail}
        width="max-w-2xl"
        title={detail.data ? (
          <div className="flex items-center gap-3">
            <Avatar name={detail.data.customer.name} color={colorFor(detail.data.customer.id)} size="lg" />
            <div>
              <p className="text-[15px] font-semibold text-ink">{detail.data.customer.name}</p>
              <p className="text-[10.5px] text-muted">{detail.data.customer.company || 'عميل فردي'}</p>
            </div>
          </div>
        ) : <p className="text-[14px] font-semibold text-ink">ملف العميل</p>}
        footer={detail.data && can('customers.manage') ? (
          <div className="flex items-center justify-between gap-2">
            <Button variant="danger" size="sm" onClick={() => setDeleteTarget(detail.data!.customer)}><Trash2 size={14} /> حذف</Button>
            <div className="flex gap-2">
              {can('licenses.create') && (
                <Button variant="secondary" size="sm" onClick={() => navigate(`/licenses?new=1&customer=${detail.data!.customer.id}`)}>
                  <KeyRound size={14} /> ترخيص جديد
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={() => { setEditing(detail.data!.customer); setFormOpen(true); }}><Edit3 size={14} /> تعديل</Button>
            </div>
          </div>
        ) : undefined}
      >
        {detail.loading && !detail.data ? <div className="p-6"><TableSkeleton rows={5} cols={3} /></div> : !detail.data ? (
          <div className="p-6"><EmptyState title="تعذر تحميل العميل" description={detail.error || undefined} /></div>
        ) : (
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap gap-1.5">
              {detail.data.customer.country && <Badge tone="info"><MapPin size={10} /> {detail.data.customer.country}</Badge>}
              {detail.data.customer.taxId && <Badge><Receipt size={10} /> {detail.data.customer.taxId}</Badge>}
              <Badge>عميل منذ {formatDate(detail.data.customer.createdAt)}</Badge>
            </div>

            <SummaryStrip items={[
              { label: 'إجمالي التراخيص', value: formatNumber(detail.data.licenses.length) },
              { label: 'النشطة', value: formatNumber(detail.data.licenses.filter((l) => l.effective_status === 'active').length), tone: 'var(--success)' },
              { label: 'الإيراد', value: formatMoney(detail.data.licenses.reduce((sum, l) => sum + Number(l.price), 0), 'USD', true) },
              { label: 'الدولة', value: detail.data.customer.country || '—' },
            ]} />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { icon: Mail, label: 'البريد الإلكتروني', value: detail.data.customer.email || '—', ltr: true },
                { icon: Phone, label: 'الهاتف', value: detail.data.customer.phone || '—', ltr: true },
                { icon: Building2, label: 'الشركة', value: detail.data.customer.company || '—' },
                { icon: MapPin, label: 'الدولة', value: detail.data.customer.country || '—' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2/50 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-muted"><item.icon size={14} /></span>
                  <div className="min-w-0">
                    <p className="text-[9.5px] text-muted">{item.label}</p>
                    <p className={cn('truncate text-[11.5px] text-soft', item.ltr && 'font-mono text-[10.5px]')} dir={item.ltr ? 'ltr' : undefined}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {detail.data.customer.notes && (
              <div className="rounded-xl border border-line bg-surface-2/50 p-3">
                <p className="mb-1 text-[10px] font-semibold text-muted">ملاحظات</p>
                <p className="text-[11.5px] leading-relaxed text-soft">{detail.data.customer.notes}</p>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold text-soft">تراخيص العميل</p>
                <span className="text-[10px] text-muted">{formatNumber(detail.data.licenses.length)} ترخيص</span>
              </div>
              {detail.data.licenses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[11px] text-muted">لا تراخيص لهذا العميل بعد</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-line">
                  {detail.data.licenses.map((license, index) => (
                    <button
                      key={license.id}
                      onClick={() => navigate(`/licenses?open=${license.id}`)}
                      className={cn('flex w-full items-center gap-2.5 px-3 py-2.5 text-start transition hover:bg-surface-2', index !== 0 && 'border-t border-line/60')}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${license.product_color}18`, color: license.product_color }}>
                        <KeyRound size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-medium text-ink">{license.product_name}</p>
                        <p className="numeric truncate text-[9.5px] text-muted">{license.uid}</p>
                      </div>
                      <div className="hidden text-end sm:block">
                        <PlanBadge plan={license.plan} />
                        <div className="mt-0.5"><StatusBadge status={license.effective_status} /></div>
                      </div>
                      <div className="text-end">
                        <ExpiryCell expiresAt={license.expires_at} />
                        <p className="numeric mt-0.5 text-[9.5px] text-muted">{formatMoney(Number(license.price), 'USD', true)}</p>
                      </div>
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
        title={`حذف العميل ${deleteTarget?.name}؟`}
        description="سيُحذف ملف العميل نهائياً. لا يمكن حذف عميل مرتبط بتراخيص — احذف تراخيصه أولاً."
        confirmText="حذف العميل"
      />
    </div>
  );
}

function CustomerFormModal({ open, customer, onClose, onSaved }: {
  open: boolean; customer: Customer | null; onClose: () => void; onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(customer ? toForm(customer) : EMPTY);
    setFormError(null);
  }, [open, customer]);

  const patch = (values: Partial<FormState>) => setForm((prev) => ({ ...prev, ...values }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('اسم العميل مطلوب'); return; }
    setSaving(true);
    setFormError(null);
    try {
      if (customer) {
        await api(`/customers/${customer.id}`, { method: 'PUT', body: form });
        success('تم تحديث العميل', form.name);
      } else {
        await api('/customers', { method: 'POST', body: form });
        success('تمت إضافة العميل', form.name);
      }
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر حفظ العميل';
      setFormError(message);
      toastError('تعذر حفظ العميل', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={customer ? 'تعديل بيانات العميل' : 'عميل جديد'}
      description={customer ? 'حدّث معلومات التواصل والفوترة.' : 'أضف عميلاً لإصدار تراخيصه ومتابعة أجهزته.'}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={submit} loading={saving}>{customer ? 'حفظ التعديلات' : 'إضافة العميل'}</Button>
        </>
      )}
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم العميل" required><Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="محمد العتيبي" /></Field>
          <Field label="الشركة"><Input value={form.company} onChange={(e) => patch({ company: e.target.value })} placeholder="مؤسسة الريان" /></Field>
          <Field label="البريد الإلكتروني"><Input type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} placeholder="name@company.com" dir="ltr" /></Field>
          <Field label="الهاتف"><Input value={form.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="+966 5x xxx xxxx" dir="ltr" /></Field>
          <Field label="الدولة">
            <Select value={form.country} onChange={(e) => patch({ country: e.target.value })} aria-label="الدولة">
              <option value="">بدون تحديد</option>
              {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
            </Select>
          </Field>
          <Field label="الرقم الضريبي"><Input value={form.taxId} onChange={(e) => patch({ taxId: e.target.value })} placeholder="300xxxxxxxxxx" dir="ltr" /></Field>
        </div>
        <Field label="ملاحظات"><Textarea value={form.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="أي تفاصيل تخص العميل، اتفاقيات، أو تفضيلات تواصل…" rows={3} /></Field>
        {formError && <div className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-[11.5px] text-danger">{formError}</div>}
      </form>
    </Modal>
  );
}
