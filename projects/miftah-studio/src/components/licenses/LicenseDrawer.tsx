import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, ArrowUpLeft, CalendarClock, Check, Clock3, Copy, Download, Edit3, Fingerprint,
  History, KeyRound, Laptop, MonitorSmartphone, Package, Pencil, Play, Plus, RefreshCw, ShieldCheck,
  ShieldOff, ShoppingBag, Trash2, User, Wifi, WifiOff, X,
} from 'lucide-react';
import { Drawer, ConfirmDialog, Menu, Modal } from '@/components/ui/overlays';
import {
  Badge, Button, CopyButton, EmptyState, Field, Input, ProductIcon, Segmented, Textarea,
} from '@/components/ui/primitives';
import { TagInput } from '@/components/ui/forms';
import {
  DataTable, ExpiryCell, ModeBadge, Money, PlanBadge, SeatMeter, StatusBadge, SummaryStrip, TableSkeleton, Td, Th, Tr,
} from '@/components/ui/page';
import { api, downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiQuery } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import type { LicenseDetailData } from '@/lib/types';
import { actionMeta, cn, daysLeft, formatDate, formatMoney, formatNumber, timeAgo } from '@/lib/utils';

type Tab = 'overview' | 'devices' | 'requests' | 'history';

const RENEW_PRESETS = [30, 90, 180, 365, 730];

export function LicenseDrawer({ open, licenseId, onClose, onChanged, onOpenProduct }: {
  open: boolean;
  licenseId: number | null;
  onClose: () => void;
  onChanged?: () => void;
  onOpenProduct?: (id: number) => void;
}) {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const detail = useApiQuery<LicenseDetailData>(licenseId ? `/licenses/${licenseId}` : null, undefined, [licenseId, open]);

  const [tab, setTab] = useState<Tab>('overview');
  const [keyValue, setKeyValue] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmState, setConfirmState] = useState<null | { action: 'suspend' | 'activate'; title: string; description: string }>(null);

  useEffect(() => {
    if (!open) return;
    setTab('overview');
    setKeyValue(null);
    setEditOpen(false);
    setRenewOpen(false);
    setRevokeOpen(false);
    setOfflineOpen(false);
    setDeleteOpen(false);
    setConfirmState(null);
  }, [open, licenseId]);

  const license = detail.data?.license || null;

  const refresh = () => {
    detail.reload();
    onChanged?.();
  };

  const reveal = async () => {
    if (!license) return;
    setRevealing(true);
    try {
      const data = await api<{ key: string }>(`/licenses/${license.id}/reveal`, { method: 'POST' });
      setKeyValue(data.key);
      success('تم كشف المفتاح', 'لا تشارك المفتاح مع أي طرف غير مصرح له.');
    } catch (err) {
      toastError('تعذر كشف المفتاح', err instanceof Error ? err.message : undefined);
    } finally {
      setRevealing(false);
    }
  };

  const changeStatus = async (action: 'suspend' | 'activate') => {
    if (!license) return;
    setBusy(true);
    try {
      await api(`/licenses/${license.id}/status`, {
        method: 'POST',
        body: { status: action === 'suspend' ? 'suspended' : 'active' },
      });
      success(action === 'suspend' ? 'تم إيقاف الترخيص مؤقتاً' : 'تم تفعيل الترخيص', license.uid);
      setConfirmState(null);
      setKeyValue(null);
      refresh();
    } catch (err) {
      toastError('تعذر تحديث الحالة', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (id: number) => {
    setBusy(true);
    try {
      await api(`/activations/${id}/deactivate`, { method: 'POST' });
      success('تم إلغاء تفعيل الجهاز', 'أصبح المقعد متاحاً لجهاز آخر.');
      refresh();
    } catch (err) {
      toastError('تعذر إلغاء التفعيل', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const removeActivation = async (id: number) => {
    setBusy(true);
    try {
      await api(`/activations/${id}`, { method: 'DELETE' });
      success('تم حذف سجل التفعيل');
      refresh();
    } catch (err) {
      toastError('تعذر حذف التفعيل', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const removeLicense = async () => {
    if (!license) return;
    setBusy(true);
    try {
      await api(`/licenses/${license.id}`, { method: 'DELETE' });
      success('تم حذف الترخيص', license.uid);
      setDeleteOpen(false);
      onChanged?.();
      onClose();
    } catch (err) {
      toastError('تعذر حذف الترخيص', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: typeof Activity; count?: number }[] = license && detail.data ? [
    { id: 'overview', label: 'نظرة عامة', icon: Fingerprint },
    { id: 'devices', label: 'الأجهزة', icon: MonitorSmartphone, count: detail.data.activations.length },
    { id: 'requests', label: 'الطلبات', icon: Activity, count: detail.data.requests.length },
    { id: 'history', label: 'السجل', icon: History, count: detail.data.history.length },
  ] : [
    { id: 'overview', label: 'نظرة عامة', icon: Fingerprint },
    { id: 'devices', label: 'الأجهزة', icon: MonitorSmartphone },
    { id: 'requests', label: 'الطلبات', icon: Activity },
    { id: 'history', label: 'السجل', icon: History },
  ];

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width="max-w-2xl"
        title={license ? (
          <div className="flex items-center gap-3">
            <ProductIcon icon={license.product.icon} color={license.product.color} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink">{license.product.name}</p>
              <p className="numeric text-[10.5px] text-muted">{license.uid}</p>
            </div>
          </div>
        ) : <p className="text-[14px] font-semibold text-ink">تفاصيل الترخيص</p>}
        footer={license ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {can('licenses.manage') && (
                <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)} title="حذف الترخيص">
                  <Trash2 size={14} /> حذف
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {can('licenses.export') && (
                <Button variant="ghost" size="sm" onClick={() => setOfflineOpen(true)}>
                  <Download size={14} /> ملف .lic
                </Button>
              )}
              {can('licenses.manage') && license.plan !== 'perpetual' && license.rawStatus !== 'revoked' && (
                <Button variant="secondary" size="sm" onClick={() => setRenewOpen(true)}>
                  <RefreshCw size={14} /> تجديد
                </Button>
              )}
              {can('licenses.manage') && (
                <Button variant="primary" size="sm" onClick={() => setEditOpen(true)}>
                  <Edit3 size={14} /> تعديل
                </Button>
              )}
            </div>
          </div>
        ) : undefined}
      >
        {detail.loading && !detail.data ? (
          <div className="p-5"><TableSkeleton rows={6} cols={3} /></div>
        ) : !detail.data || !license ? (
          <div className="p-6"><EmptyState title="تعذر تحميل الترخيص" description={detail.error || undefined} /></div>
        ) : (
          <div className="space-y-4 p-5">
            {/* state chips & actions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={license.status} />
                <PlanBadge plan={license.plan} />
                <ModeBadge mode={license.activationMode} />
                {license.status === 'expired' && <Badge tone="warning">انتهت الصلاحية</Badge>}
              </div>
              <div className="flex items-center gap-1">
                {detail.data && (
                  <Menu items={[
                    ...(can('licenses.manage') ? [{
                      label: license.rawStatus === 'active' ? 'إيقاف مؤقت' : 'إعادة تفعيل',
                      icon: license.rawStatus === 'active' ? <ShieldOff size={14} /> : <ShieldCheck size={14} />,
                      onClick: () => setConfirmState({
                        action: license.rawStatus === 'active' ? 'suspend' : 'activate',
                        title: license.rawStatus === 'active' ? 'إيقاف الترخيص مؤقتاً؟' : 'إعادة تفعيل الترخيص؟',
                        description: license.rawStatus === 'active'
                          ? 'سيتوقف الترخيص عن العمل على جميع الأجهزة حتى إعادة تفعيله.'
                          : 'سيستأنف الترخيص العمل على الأجهزة المفعّلة وفق تاريخ الانتهاء.',
                      }),
                    }] : []),
                    ...(can('licenses.manage') && license.rawStatus !== 'revoked' ? [{
                      label: 'إلغاء الترخيص نهائياً', icon: <X size={14} />, danger: true, onClick: () => setRevokeOpen(true),
                    }] : []),
                    ...(can('licenses.view') ? [{
                      label: 'عرض المنتج', icon: <ArrowUpLeft size={14} />, onClick: () => onOpenProduct?.(license.product.id),
                    }] : []),
                  ]} />
                )}
              </div>
            </div>

            {license.revokeReason && (
              <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.07] px-3 py-2.5 text-[11px] leading-relaxed text-danger">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>سبب الإلغاء: {license.revokeReason}</span>
              </div>
            )}

            {/* key card */}
            <div className="relative overflow-hidden rounded-2xl border border-line bg-deep/70">
              <div className="pointer-events-none absolute -end-16 -top-16 h-44 w-44 rounded-full bg-primary/15 blur-3xl" />
              <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-line/60 px-4 py-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-soft"><KeyRound size={13} /> مفتاح الترخيص</p>
                <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[9.5px] text-muted">مشفّر AES-256-GCM</span>
              </div>
              <div className="relative px-4 py-3.5">
                {keyValue ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2" dir="ltr">
                      <code className="flex-1 break-all rounded-lg border border-line bg-surface-2 px-2.5 py-2 font-mono text-[12px] text-ink">{keyValue}</code>
                      <CopyButton value={keyValue} label="نسخ" className="border border-line bg-surface px-2 py-1.5" />
                    </div>
                    <p className="text-[10px] text-warning">تنبيه: كشف المفتاح مسجّل في سجل النشاط.</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div dir="ltr">
                      <p className="font-mono text-[13px] tracking-[0.12em] text-soft">{license.keyHint}</p>
                      <p className="mt-0.5 font-mono text-[10px] tracking-[0.2em] text-muted">•••• •••• •••• ••••</p>
                    </div>
                    {can('licenses.reveal') ? (
                      <Button size="sm" variant="secondary" onClick={reveal} loading={revealing}><KeyRound size={13} /> كشف المفتاح</Button>
                    ) : (
                      <Badge tone="neutral">لا تملك صلاحية الكشف</Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            <SummaryStrip items={[
              { label: 'المقاعد', value: `${license.activeActivations}/${license.maxSeats}` },
              { label: 'القيمة', value: formatMoney(license.price, license.currency) },
              { label: 'أُصدر في', value: formatDate(license.issuedAt) },
              { label: 'الانتهاء', value: license.expiresAt ? formatDate(license.expiresAt) : 'دائم', tone: license.expiresAt && (daysLeft(license.expiresAt) ?? 0) < 0 ? 'var(--danger)' : undefined },
            ]} />

            {/* tabs */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-line pb-px no-scrollbar">
              {TABS.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={cn(
                      'relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[12px] font-medium transition-colors',
                      active ? 'text-ink' : 'text-muted hover:text-soft'
                    )}
                  >
                    <item.icon size={13} />
                    {item.label}
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[9.5px]', active ? 'bg-primary-soft text-primary' : 'bg-surface-3 text-muted')}>{item.count}</span>
                    )}
                    {active && <motion.span layoutId="license-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
                  </button>
                );
              })}
            </div>

            {tab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'العميل', value: license.customer?.name || 'بدون عميل', hint: license.customer?.company || license.customer?.email || '—', icon: User },
                    { label: 'المنتج', value: license.product.name, hint: license.product.code, icon: Package },
                    { label: 'المقاعد المستخدمة', value: `${license.activeActivations} من ${license.maxSeats}`, hint: license.activeActivations >= license.maxSeats ? 'كل المقاعد مستهلكة' : `${license.maxSeats - license.activeActivations} متاح`, icon: MonitorSmartphone },
                    { label: 'آخر ظهور', value: license.lastSeenAt ? timeAgo(license.lastSeenAt) : 'لم يُفعّل بعد', hint: license.lastSeenAt ? formatDate(license.lastSeenAt, true) : 'بانتظار أول تفعيل', icon: Clock3 },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-line bg-surface-2/40 px-3 py-2.5">
                      <p className="flex items-center gap-1 text-[9.5px] text-muted"><item.icon size={10} /> {item.label}</p>
                      <p className="mt-1 truncate text-[11.5px] font-medium text-ink">{item.value}</p>
                      <p className="mt-0.5 truncate text-[9.5px] text-muted">{item.hint}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-line bg-surface px-3 py-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[10.5px] font-semibold text-soft">استهلاك المقاعد</p>
                    <span className="numeric text-[10px] text-muted">{license.activeActivations}/{license.maxSeats}</span>
                  </div>
                  <SeatMeter used={license.activeActivations} max={license.maxSeats} />
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-soft">الميزات المشمولة</p>
                  <div className="flex flex-wrap gap-1.5">
                    {license.features.length === 0 ? <span className="text-[11px] text-muted">لا ميزات مسجلة.</span> : license.features.map((f) => (
                      <span key={f} className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-[10.5px] text-soft">{f}</span>
                    ))}
                  </div>
                </div>

                {license.notes && (
                  <div className="rounded-xl border border-line bg-surface-2/50 px-3 py-2">
                    <p className="text-[9.5px] text-muted">ملاحظات</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-soft">{license.notes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2/40 px-3 py-2">
                  <div>
                    <p className="text-[10.5px] font-medium text-soft">تسليم أوفلاين</p>
                    <p className="text-[9.5px] text-muted">نزّل ملفاً موقّعاً يعمل دون اتصال.</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setOfflineOpen(true)} disabled={!can('licenses.export')}>
                    <Download size={13} /> تنزيل .lic
                  </Button>
                </div>
              </div>
            )}

            {tab === 'devices' && (
              <div className="space-y-2">
                {detail.data.activations.length === 0 ? (
                  <EmptyState
                    icon={<Laptop size={22} />}
                    title="لا أجهزة مفعّلة"
                    description="سيظهر هنا كل جهاز يُفعّل هذا الترخيص عبر API أو ملف أوفلاين."
                    className="rounded-xl border border-dashed border-line py-8"
                  />
                ) : detail.data.activations.map((a) => (
                  <div key={a.id} className="rounded-xl border border-line bg-surface px-3 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', a.status === 'active' ? 'bg-success/10 text-success' : 'bg-surface-3 text-muted')}>
                          {a.mode === 'online' ? <Wifi size={15} /> : <WifiOff size={15} />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[11.5px] font-semibold text-ink">{a.machineName || 'جهاز بدون اسم'}</p>
                          <p className="numeric truncate text-[9.5px] text-muted" dir="ltr">{a.machineId}</p>
                          <p className="mt-0.5 text-[9.5px] text-muted">{a.os || 'نظام غير معروف'} · {a.mode === 'online' ? 'أونلاين' : 'أوفلاين'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={a.status === 'active' ? 'success' : 'neutral'} dot>{a.status === 'active' ? 'نشط' : 'ملغى'}</Badge>
                        {can('activations.manage') && a.status === 'active' && (
                          <Button size="sm" variant="ghost" onClick={() => deactivate(a.id)}>إلغاء التفعيل</Button>
                        )}
                        {can('activations.manage') && (
                          <Button size="icon" variant="ghost" onClick={() => removeActivation(a.id)} title="حذف السجل"><Trash2 size={13} /></Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/60 pt-1.5 text-[9.5px] text-muted">
                      <span>فُعّل {timeAgo(a.activatedAt)}</span>
                      <span>آخر نبضة {a.lastSeenAt ? timeAgo(a.lastSeenAt) : '—'}</span>
                      {a.appVersion && <span className="numeric" dir="ltr">v{a.appVersion}</span>}
                      {a.ip && <span className="numeric" dir="ltr">{a.ip}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'requests' && (
              <div className="space-y-2">
                {detail.data.requests.length === 0 ? (
                  <EmptyState icon={<Activity size={22} />} title="لا طلبات تفعيل" description="طلبات التفعيل الأوفلاين المرتبطة بهذا الترخيص تظهر هنا." className="rounded-xl border border-dashed border-line py-8" />
                ) : detail.data.requests.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="numeric truncate text-[10.5px] text-soft">{r.uid}</p>
                      <p className="truncate text-[9.5px] text-muted">{r.machine_name || 'جهاز'} · {r.os || '—'} · {timeAgo(r.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={r.status} />
                      {r.status === 'approved' && can('requests.manage') && (
                        <Button size="sm" variant="ghost" onClick={() => downloadFile(`/requests/${r.id}/download`)}><Download size={12} /> الملف</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'history' && (
              <div className="space-y-1.5">
                {detail.data.history.length === 0 ? (
                  <EmptyState icon={<History size={22} />} title="لا سجل بعد" description="ستظهر العمليات على هذا الترخيص هنا." className="rounded-xl border border-dashed border-line py-8" />
                ) : detail.data.history.map((entry) => {
                  const meta = actionMeta(entry.action);
                  return (
                    <div key={entry.id} className="flex items-start gap-2.5 rounded-xl border border-line/70 bg-surface px-3 py-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium text-ink">{meta.label}</span>
                          <span className="text-[9.5px] text-muted">{entry.actor}</span>
                        </div>
                        <p className="mt-0.5 text-[9.5px] text-muted">{formatDate(entry.at, true)} · {timeAgo(entry.at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {license && (
        <>
          <EditLicenseModal
            open={editOpen}
            license={license}
            onClose={() => setEditOpen(false)}
            onSaved={() => { setEditOpen(false); refresh(); }}
          />
          <RenewLicenseModal
            open={renewOpen}
            license={license}
            onClose={() => setRenewOpen(false)}
            onRenewed={() => { setRenewOpen(false); refresh(); }}
          />
          <RevokeLicenseModal
            open={revokeOpen}
            license={license}
            onClose={() => setRevokeOpen(false)}
            onRevoked={() => { setRevokeOpen(false); setKeyValue(null); refresh(); }}
          />
          <OfflineLicenseModal open={offlineOpen} license={license} onClose={() => setOfflineOpen(false)} />
          <ConfirmDialog
            open={!!confirmState}
            onClose={() => setConfirmState(null)}
            onConfirm={() => confirmState && changeStatus(confirmState.action)}
            loading={busy}
            tone={confirmState?.action === 'suspend' ? 'danger' : 'primary'}
            title={confirmState?.title || ''}
            description={confirmState?.description}
            confirmText={confirmState?.action === 'suspend' ? 'إيقاف الترخيص' : 'إعادة التفعيل'}
          />
          <ConfirmDialog
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            onConfirm={removeLicense}
            loading={busy}
            title={`حذف الترخيص ${license.uid}؟`}
            description="سيُحذف الترخيص وكل سجلات التفعيل المرتبطة به نهائياً. لا يمكن التراجع عن هذا الإجراء."
            confirmText="حذف نهائي"
          />
        </>
      )}
    </>
  );
}

/* ------------------------------ Edit modal ----------------------------- */
function EditLicenseModal({ open, license, onClose, onSaved }: {
  open: boolean; license: LicenseDetailData['license']; onClose: () => void; onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [seats, setSeats] = useState(license.maxSeats);
  const [price, setPrice] = useState(license.price);
  const [features, setFeatures] = useState<string[]>(license.features);
  const [notes, setNotes] = useState(license.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSeats(license.maxSeats);
    setPrice(license.price);
    setFeatures(license.features);
    setNotes(license.notes || '');
    setError(null);
  }, [open, license]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/licenses/${license.id}`, { method: 'PATCH', body: { maxSeats: seats, price, features, notes } });
      success('تم تحديث الترخيص', license.uid);
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر حفظ التعديلات';
      setError(message);
      toastError('تعذر حفظ التعديلات', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="تعديل الترخيص"
      description="المقاعد والسعر والميزات والملاحظات — المفتاح وتاريخ الإصدار لا يتغيران."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={() => submit()} loading={saving}>حفظ التعديلات</Button>
        </>
      )}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="عدد المقاعد" hint="لا يمكن تقليله عن عدد الأجهزة المفعّلة">
            <Input type="number" min={Math.max(1, license.activeActivations)} value={seats} onChange={(e) => setSeats(Number(e.target.value))} dir="ltr" />
          </Field>
          <Field label={`السعر (${license.currency})`}>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} dir="ltr" />
          </Field>
        </div>
        <Field label="الميزات">
          <TagInput value={features} onChange={setFeatures} suggestions={['دعم فني', 'تحديثات مجانية', 'نسخ احتياطي', 'تعدد الفروع', 'تقارير متقدمة']} />
        </Field>
        <Field label="ملاحظات">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="ملاحظات داخلية غير ظاهرة للعميل" />
        </Field>
        {error && <div className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-[11.5px] text-danger">{error}</div>}
      </form>
    </Modal>
  );
}

/* ----------------------------- Renew modal ----------------------------- */
function RenewLicenseModal({ open, license, onClose, onRenewed }: {
  open: boolean; license: LicenseDetailData['license']; onClose: () => void; onRenewed: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [days, setDays] = useState(365);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDays(license.plan === 'trial' ? 14 : 365);
    setError(null);
  }, [open, license]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await api<{ expiresAt: string }>(`/licenses/${license.id}/renew`, { method: 'POST', body: { days } });
      success('تم تجديد الترخيص', `الانتهاء الجديد: ${formatDate(data.expiresAt)}`);
      onRenewed();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر تجديد الترخيص';
      setError(message);
      toastError('تعذر تجديد الترخيص', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="تجديد الترخيص"
      description="تُضاف المدة إلى تاريخ الانتهاء الحالي إن كان مستقبلياً، أو من اليوم إن كان منتهياً."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={submit} loading={saving}><RefreshCw size={14} /> تجديد</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface-2/50 px-3 py-2.5 text-[11px]">
          <div className="flex justify-between"><span className="text-muted">الانتهاء الحالي</span><span className="text-soft">{license.expiresAt ? formatDate(license.expiresAt) : 'دائم'}</span></div>
          <div className="mt-1 flex justify-between"><span className="text-muted">المدة المضافة</span><span className="text-soft">{days} يوم</span></div>
        </div>
        <Field label="مدة التجديد">
          <div className="flex flex-wrap gap-1.5">
            {RENEW_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn('rounded-lg border px-2.5 py-1.5 text-[11px] transition', days === d ? 'border-primary/40 bg-primary-soft text-primary' : 'border-line text-muted hover:text-soft')}
              >
                {d} يوم
              </button>
            ))}
          </div>
        </Field>
        <Field label="أو أدخل عدد الأيام">
          <Input type="number" min={1} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value)))} dir="ltr" />
        </Field>
        {error && <div className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-[11.5px] text-danger">{error}</div>}
      </div>
    </Modal>
  );
}

/* ----------------------------- Revoke modal ---------------------------- */
function RevokeLicenseModal({ open, license, onClose, onRevoked }: {
  open: boolean; license: LicenseDetailData['license']; onClose: () => void; onRevoked: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setError(null);
  }, [open]);

  const submit = async () => {
    if (reason.trim().length < 3) {
      setError('يرجى إدخال سبب الإلغاء (٣ أحرف على الأقل)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(`/licenses/${license.id}/status`, { method: 'POST', body: { status: 'revoked', reason: reason.trim() } });
      success('تم إلغاء الترخيص', license.uid);
      onRevoked();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر إلغاء الترخيص';
      setError(message);
      toastError('تعذر إلغاء الترخيص', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="إلغاء الترخيص نهائياً"
      description="سيُوقف الترخيص على جميع الأجهزة ويُمنع تجديده. يمكن إعادة تفعيله لاحقاً من الإجراءات."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>تراجع</Button>
          <Button variant="danger" onClick={submit} loading={saving}><ShieldOff size={14} /> تأكيد الإلغاء</Button>
        </>
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/[0.07] px-3 py-2.5 text-[11px] leading-relaxed text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>ستتوقف جميع الأجهزة عن التحقق من الترخيص. هذا الإجراء مسجّل في سجل النشاط.</p>
        </div>
        <Field label="سبب الإلغاء" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: مخالفة شروط الترخيص / طلب العميل…" rows={3} />
        </Field>
        {error && <div className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-[11.5px] text-danger">{error}</div>}
      </div>
    </Modal>
  );
}

/* --------------------------- Offline license --------------------------- */
function OfflineLicenseModal({ open, license, onClose }: {
  open: boolean; license: LicenseDetailData['license']; onClose: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [machineId, setMachineId] = useState('');
  const [machineName, setMachineName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMachineId('');
    setMachineName('');
  }, [open]);

  const download = async () => {
    setBusy(true);
    try {
      const query = new URLSearchParams();
      if (machineId.trim()) query.set('machineId', machineId.trim());
      if (machineName.trim()) query.set('machineName', machineName.trim());
      const suffix = query.toString() ? `?${query.toString()}` : '';
      await downloadFile(`/licenses/${license.id}/offline-license${suffix}`);
      success('تم تنزيل ملف الترخيص', 'الملف موقّع بمفتاح Ed25519 ويعمل دون اتصال.');
      onClose();
    } catch (err) {
      toastError('تعذر تنزيل الملف', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="تنزيل ملف ترخيص موقّع"
      description="اربط الملف بجهاز محدد لاحتساب المقعد تلقائياً، أو اتركه عاماً."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={download} loading={busy}><Download size={14} /> تنزيل .lic</Button>
        </>
      )}
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="معرّف الجهاز" hint="اختياري">
            <Input value={machineId} onChange={(e) => setMachineId(e.target.value)} placeholder="HWID-…" dir="ltr" />
          </Field>
          <Field label="اسم الجهاز" hint="اختياري">
            <Input value={machineName} onChange={(e) => setMachineName(e.target.value)} placeholder="اسم الجهاز" />
          </Field>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2.5 text-[10.5px] leading-relaxed text-muted">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />
          <p>عند ربط ملف بجهاز جديد سيُحتسب مقعد من أصل {license.maxSeats}. إذا كانت المقاعد ممتلئة سيُرفض التنزيل.</p>
        </div>
      </div>
    </Modal>
  );
}
