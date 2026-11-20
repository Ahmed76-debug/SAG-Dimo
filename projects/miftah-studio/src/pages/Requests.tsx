import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowUpLeft, BadgeCheck, CheckCircle2, ClipboardList, Clock3, Download, FileCheck2, Inbox,
  Laptop, ShieldCheck, XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge, Button, EmptyState, Field, ProductIcon, SearchInput, Select, Textarea } from '@/components/ui/primitives';
import { ConfirmDialog, Drawer, Modal } from '@/components/ui/overlays';
import {
  DataTable, ErrorPanel, Panel, StatCard, StatusBadge, TableSkeleton, Td, Th, Tr,
} from '@/components/ui/page';
import { api, downloadFile, downloadJson } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiQuery, useDebounced } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import type { ActivationRequest } from '@/lib/types';
import { cn, formatDate, formatNumber, timeAgo } from '@/lib/utils';

interface RequestsResponse {
  items: ActivationRequest[];
  total: number;
  page: number;
  pages: number;
  pending: number;
}

const TABS = [
  { id: 'all', label: 'الكل' },
  { id: 'pending', label: 'قيد المراجعة' },
  { id: 'approved', label: 'معتمدة' },
  { id: 'rejected', label: 'مرفوضة' },
];

export function Requests() {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [approveTarget, setApproveTarget] = useState<ActivationRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ActivationRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ document: unknown; filename: string; request: ActivationRequest } | null>(null);

  const list = useApiQuery<RequestsResponse>('/requests', {
    q: debounced || undefined,
    status: status === 'all' ? undefined : status,
    page,
    limit: 12,
  }, [debounced, status, page]);

  const allStats = useApiQuery<RequestsResponse>('/requests', { limit: 1 });
  const approvedStats = useApiQuery<RequestsResponse>('/requests', { status: 'approved', limit: 1 });
  const rejectedStats = useApiQuery<RequestsResponse>('/requests', { status: 'rejected', limit: 1 });

  const items = list.data?.items || [];
  const total = allStats.data?.total ?? 0;
  const pending = allStats.data?.pending ?? 0;
  const approved = approvedStats.data?.total ?? 0;
  const rejected = rejectedStats.data?.total ?? 0;

  useEffect(() => { setPage(1); }, [debounced, status]);

  const selected = items.find((r) => r.id === openId) || null;

  const refresh = () => {
    list.reload();
    allStats.reload();
    approvedStats.reload();
    rejectedStats.reload();
  };

  const approve = async () => {
    if (!approveTarget) return;
    setBusy(true);
    try {
      const data = await api<{ document: unknown; filename: string }>(`/requests/${approveTarget.id}/approve`, { method: 'POST' });
      success('تم اعتماد الطلب', `أُصدر ملف ${data.filename}`);
      setIssued({ ...data, request: approveTarget });
      setApproveTarget(null);
      setOpenId(null);
      refresh();
    } catch (err) {
      toastError('تعذر اعتماد الطلب', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setBusy(true);
    try {
      await api(`/requests/${rejectTarget.id}/reject`, { method: 'POST', body: { reason: rejectReason.trim() } });
      success('تم رفض الطلب', rejectTarget.machineName || rejectTarget.machineId);
      setRejectTarget(null);
      setRejectReason('');
      setOpenId(null);
      refresh();
    } catch (err) {
      toastError('تعذر رفض الطلب', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><Inbox size={12} /> طلبات التفعيل الأوفلاين</>}
        title="طلبات التفعيل"
        description="راجع طلبات الأجهزة التي تحتاج ترخيصاً دون اتصال، ثم اعتمد الطلب لإنشاء ملف موقّع أو ارفضه مع بيان السبب."
        actions={pending > 0 ? <Badge tone="warning" dot>{formatNumber(pending)} طلب بانتظارك</Badge> : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="طلبات معلّقة" value={formatNumber(pending)} hint={pending ? 'تحتاج قراراً من الفريق' : 'لا طلبات معلّقة'} icon={Clock3} tone="warning" delay={0} />
        <StatCard label="طلبات معتمدة" value={formatNumber(approved)} hint="ملفات ترخيص صادرة" icon={FileCheck2} tone="success" delay={0.05} />
        <StatCard label="طلبات مرفوضة" value={formatNumber(rejected)} hint="مع تسجيل الأسباب" icon={XCircle} tone="danger" delay={0.1} />
        <StatCard label="إجمالي الطلبات" value={formatNumber(total)} hint="منذ بداية الاستوديو" icon={ClipboardList} tone="primary" delay={0.15} />
      </div>

      <Panel padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-3">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => {
              const active = status === tab.id;
              const count = tab.id === 'all' ? total : tab.id === 'pending' ? pending : tab.id === 'approved' ? approved : rejected;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatus(tab.id)}
                  className={cn(
                    'relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition',
                    active ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-soft'
                  )}
                >
                  {tab.label}
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[9px]', active ? 'bg-primary/15' : 'bg-surface-3')}>{formatNumber(count)}</span>
                </button>
              );
            })}
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="بحث بالجهاز أو العميل…" className="w-full sm:w-60" />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36 sm:hidden" aria-label="حالة الطلب">
              <option value="all">كل الحالات</option>
              <option value="pending">قيد المراجعة</option>
              <option value="approved">معتمد</option>
              <option value="rejected">مرفوض</option>
            </Select>
          </div>
        </div>

        {list.loading && !list.data ? (
          <TableSkeleton rows={5} cols={5} />
        ) : list.error ? (
          <ErrorPanel message={list.error} onRetry={list.reload} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Inbox size={25} />}
            title={search || status !== 'all' ? 'لا طلبات مطابقة' : 'لا طلبات تفعيل حالياً'}
            description={search || status !== 'all'
              ? 'جرّب تغيير الفلتر أو كلمة البحث.'
              : 'عندما يطلب تطبيق العميل تفعيلاً أوفلاين عبر API سيظهر الطلب هنا فوراً.'}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <DataTable minWidth={920}>
                <thead>
                  <tr>
                    <Th>الطلب</Th>
                    <Th>المنتج / الترخيص</Th>
                    <Th>العميل</Th>
                    <Th>الجهاز</Th>
                    <Th>الحالة</Th>
                    <Th>التاريخ</Th>
                    <Th width={130}>إجراء</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <Tr key={r.id} onClick={() => setOpenId(r.id)}>
                      <Td>
                        <p className="numeric text-[10.5px] font-medium text-ink">{r.uid}</p>
                        <p className="mt-0.5 text-[9.5px] text-muted">{r.appVersion ? `v${r.appVersion}` : 'بدون إصدار'}</p>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <ProductIcon icon="app-window" color={r.product.color} size="sm" />
                          <div className="min-w-0">
                            <p className="max-w-[160px] truncate text-[11.5px] text-soft">{r.product.name}</p>
                            <p className="numeric max-w-[160px] truncate text-[9.5px] text-muted" dir="ltr">{r.licenseUid || 'بدون ترخيص'}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <p className="max-w-[140px] truncate text-[11.5px] text-soft">{r.customer?.name || '—'}</p>
                        <p className="max-w-[140px] truncate text-[9.5px] text-muted">{r.customer?.company || ''}</p>
                      </Td>
                      <Td>
                        <p className="max-w-[150px] truncate text-[11px] text-soft">{r.machineName || 'جهاز بدون اسم'}</p>
                        <p className="numeric max-w-[150px] truncate text-[9px] text-muted" dir="ltr">{r.machineId}</p>
                      </Td>
                      <Td><StatusBadge status={r.status} /></Td>
                      <Td>
                        <p className="text-[11px] text-soft">{formatDate(r.createdAt)}</p>
                        <p className="text-[9.5px] text-muted">{timeAgo(r.createdAt)}</p>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {r.status === 'pending' && can('requests.manage') ? (
                            <>
                              <Button size="sm" variant="soft" onClick={() => setApproveTarget(r)}><CheckCircle2 size={13} /> اعتماد</Button>
                              <Button size="icon" variant="ghost" onClick={() => { setRejectTarget(r); setRejectReason(''); }} title="رفض"><XCircle size={14} /></Button>
                            </>
                          ) : r.status === 'approved' ? (
                            <Button size="sm" variant="ghost" onClick={() => downloadFile(`/requests/${r.id}/download`)}><Download size={13} /> الملف</Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setOpenId(r.id)}>التفاصيل</Button>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </div>

            <div className="space-y-2 p-3 md:hidden">
              {items.map((r, index) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.2) }}
                  className="rounded-xl border border-line bg-surface p-3"
                >
                  <button onClick={() => setOpenId(r.id)} className="w-full text-start">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="numeric text-[10px] text-muted">{r.uid}</p>
                        <p className="truncate text-[12px] font-medium text-ink">{r.product.name}</p>
                        <p className="truncate text-[10px] text-muted">{r.customer?.name || 'بدون عميل'} · {r.machineName || 'جهاز'}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-1 text-[9.5px] text-muted">{timeAgo(r.createdAt)}</p>
                  </button>
                  {r.status === 'pending' && can('requests.manage') && (
                    <div className="mt-2 flex gap-1.5 border-t border-line/60 pt-2">
                      <Button size="sm" variant="soft" className="flex-1" onClick={() => setApproveTarget(r)}><CheckCircle2 size={13} /> اعتماد</Button>
                      <Button size="sm" variant="ghost" className="flex-1" onClick={() => { setRejectTarget(r); setRejectReason(''); }}><XCircle size={13} /> رفض</Button>
                    </div>
                  )}
                  {r.status === 'approved' && (
                    <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => downloadFile(`/requests/${r.id}/download`)}><Download size={13} /> تنزيل الملف</Button>
                  )}
                </motion.div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-line px-3 py-2.5">
              <p className="text-[10.5px] text-muted">{page} / {list.data?.pages ?? 1}</p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
                <Button size="sm" variant="outline" disabled={page >= (list.data?.pages ?? 1)} onClick={() => setPage((p) => p + 1)}>التالي</Button>
              </div>
            </div>
          </>
        )}
      </Panel>

      {/* request detail */}
      <Drawer
        open={!!selected}
        onClose={() => setOpenId(null)}
        width="max-w-lg"
        title={selected ? (
          <div>
            <p className="text-[15px] font-semibold text-ink">طلب تفعيل</p>
            <p className="numeric text-[10px] text-muted">{selected.uid}</p>
          </div>
        ) : <p className="text-[14px] font-semibold text-ink">تفاصيل الطلب</p>}
        footer={selected && selected.status === 'pending' && can('requests.manage') ? (
          <div className="flex items-center justify-between gap-2">
            <Button variant="danger" size="sm" onClick={() => { setRejectTarget(selected); setRejectReason(''); }}><XCircle size={14} /> رفض الطلب</Button>
            <Button variant="primary" size="sm" onClick={() => setApproveTarget(selected)}><BadgeCheck size={14} /> اعتماد وإصدار الملف</Button>
          </div>
        ) : selected?.status === 'approved' ? (
          <Button variant="secondary" className="w-full" onClick={() => downloadFile(`/requests/${selected.id}/download`)}>
            <Download size={14} /> تنزيل ملف الترخيص
          </Button>
        ) : undefined}
      >
        {selected && (
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/40 p-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><Laptop size={20} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-ink">{selected.machineName || 'جهاز بدون اسم'}</p>
                <p className="numeric truncate text-[10px] text-muted" dir="ltr">{selected.machineId}</p>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            {selected.message && (
              <div className="rounded-xl border border-line bg-surface-2/40 px-3 py-2.5">
                <p className="text-[9.5px] text-muted">رسالة العميل</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-soft">{selected.message}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'المنتج', value: selected.product.name },
                { label: 'الترخيص', value: selected.licenseUid || 'بدون ترخيص' },
                { label: 'العميل', value: selected.customer?.name || '—' },
                { label: 'الشركة', value: selected.customer?.company || '—' },
                { label: 'النظام', value: selected.os || '—' },
                { label: 'إصدار التطبيق', value: selected.appVersion ? `v${selected.appVersion}` : '—' },
                { label: 'تاريخ الطلب', value: formatDate(selected.createdAt, true) },
                { label: 'تاريخ المعالجة', value: selected.approvedAt ? formatDate(selected.approvedAt, true) : '—' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-line bg-surface-2/50 px-3 py-2">
                  <p className="text-[9.5px] text-muted">{item.label}</p>
                  <p className="mt-0.5 truncate text-[11px] text-soft">{item.value}</p>
                </div>
              ))}
            </div>

            {selected.rejectedReason && (
              <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.07] px-3 py-2.5 text-[11px] text-danger">
                <XCircle size={14} className="mt-0.5 shrink-0" />
                <span>سبب الرفض: {selected.rejectedReason}</span>
              </div>
            )}

            {selected.licenseId && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate(`/licenses?open=${selected.licenseId}`)}
              >
                <ArrowUpLeft size={14} /> فتح الترخيص المرتبط
              </Button>
            )}

            <div className="flex items-start gap-2 rounded-xl border border-info/25 bg-info/[0.06] px-3 py-2.5 text-[10.5px] leading-relaxed text-info">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              <p>الاعتماد يحتجز مقعداً للجهاز ويصدر ملف <span className="numeric">.lic</span> موقّعاً باسم المنتج. يمكن تنزيله لاحقاً من هذه الصفحة.</p>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={approve}
        loading={busy}
        tone="primary"
        title="اعتماد طلب التفعيل؟"
        description={`سيُحتجز مقعد ويصدر ملف ترخيص للجهاز «${approveTarget?.machineName || approveTarget?.machineId || ''}».`}
        confirmText="اعتماد وإصدار"
      />

      <Modal
        open={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectReason(''); }}
        size="sm"
        title="رفض طلب التفعيل"
        description={`الجهاز: ${rejectTarget?.machineName || rejectTarget?.machineId || ''}`}
        footer={(
          <>
            <Button variant="ghost" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>إلغاء</Button>
            <Button variant="danger" onClick={reject} loading={busy}><XCircle size={14} /> رفض الطلب</Button>
          </>
        )}
      >
        <Field label="سبب الرفض" hint="يُسجَّل في الطلب ويظهر للفريق">
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="مثال: بيانات الجهاز غير مكتملة / الترخيص منتهٍ…" rows={3} />
        </Field>
      </Modal>

      <Modal
        open={!!issued}
        onClose={() => setIssued(null)}
        size="md"
        title="تم اعتماد الطلب"
        description="ملف الترخيص جاهز للتسليم للعميل."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setIssued(null)}>إغلاق</Button>
            <Button
              variant="primary"
              onClick={() => issued && downloadJson(issued.document, issued.filename)}
            >
              <Download size={14} /> تنزيل {issued?.filename}
            </Button>
          </>
        )}
      >
        {issued && (
          <div className="space-y-4">
            <div className="flex flex-col items-center rounded-2xl border border-success/25 bg-success/[0.06] px-4 py-6 text-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success ring-1 ring-success/30"
              >
                <BadgeCheck size={28} />
              </motion.span>
              <p className="mt-3 text-[14px] font-semibold text-ink">{issued.request.machineName || 'جهاز العميل'}</p>
              <p className="numeric text-[10px] text-muted">{issued.filename}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-xl border border-line bg-surface-2/50 px-3 py-2">
                <p className="text-[9.5px] text-muted">المنتج</p>
                <p className="mt-0.5 truncate text-soft">{issued.request.product.name}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface-2/50 px-3 py-2">
                <p className="text-[9.5px] text-muted">الترخيص</p>
                <p className="numeric mt-0.5 truncate text-soft" dir="ltr">{issued.request.licenseUid || '—'}</p>
              </div>
            </div>
            <p className="text-[10.5px] leading-relaxed text-muted">
              يمكنك تنزيل الملف لاحقاً من زر «الملف» في قائمة الطلبات. الملف موقّع بمفتاح Ed25519 ويعمل دون اتصال حتى تاريخ انتهاء الترخيص.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
