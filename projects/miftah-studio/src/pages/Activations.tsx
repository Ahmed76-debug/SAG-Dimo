import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowUpLeft, Copy, Laptop, MonitorCheck, MonitorSmartphone, Power, Search, ShieldCheck, Trash2,
  Wifi, WifiOff,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, EmptyState, ProductIcon, SearchInput, Select } from '@/components/ui/primitives';
import { ConfirmDialog, Drawer, Menu } from '@/components/ui/overlays';
import {
  DataTable, ErrorPanel, Panel, StatCard, StatusBadge, TableSkeleton, Td, Th, Tr,
} from '@/components/ui/page';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiQuery, useDebounced } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import type { ActivationRow, Paginated } from '@/lib/types';
import { cn, copyText, formatDate, formatNumber, timeAgo } from '@/lib/utils';

export function Activations() {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState('all');
  const [mode, setMode] = useState('all');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [actionTarget, setActionTarget] = useState<null | { type: 'deactivate' | 'delete'; activation: ActivationRow }>(null);
  const [busy, setBusy] = useState(false);

  const query = {
    q: debounced || undefined,
    status: status === 'all' ? undefined : status,
    mode: mode === 'all' ? undefined : mode,
    page,
    limit: 12,
  };
  const list = useApiQuery<Paginated<ActivationRow>>('/activations', query, [debounced, status, mode, page]);
  const allStats = useApiQuery<Paginated<ActivationRow>>('/activations', { limit: 1 });
  const activeStats = useApiQuery<Paginated<ActivationRow>>('/activations', { status: 'active', limit: 1 });
  const offlineStats = useApiQuery<Paginated<ActivationRow>>('/activations', { mode: 'offline', limit: 1 });

  const items = list.data?.items || [];
  const total = allStats.data?.total ?? 0;
  const activeCount = activeStats.data?.total ?? 0;
  const offlineCount = offlineStats.data?.total ?? 0;
  const deactivated = Math.max(0, total - activeCount);

  useEffect(() => { setPage(1); }, [debounced, status, mode]);

  const selected = items.find((a) => a.id === openId) || list.data?.items.find((a) => a.id === openId) || null;
  const drawerActivation = selected || (openId ? null : null);

  const refresh = () => {
    list.reload();
    allStats.reload();
    activeStats.reload();
    offlineStats.reload();
  };

  const runAction = async () => {
    if (!actionTarget) return;
    setBusy(true);
    try {
      if (actionTarget.type === 'deactivate') {
        await api(`/activations/${actionTarget.activation.id}/deactivate`, { method: 'POST' });
        success('تم إلغاء تفعيل الجهاز', actionTarget.activation.machineName || actionTarget.activation.machineId);
      } else {
        await api(`/activations/${actionTarget.activation.id}`, { method: 'DELETE' });
        success('تم حذف سجل التفعيل', actionTarget.activation.machineName || actionTarget.activation.machineId);
      }
      setActionTarget(null);
      if (actionTarget.activation.id === openId) setOpenId(null);
      refresh();
    } catch (err) {
      toastError('تعذر تنفيذ الإجراء', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const copyMachine = async (value: string) => {
    const ok = await copyText(value);
    if (ok) success('تم نسخ معرّف الجهاز', value);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><MonitorSmartphone size={12} /> الأجهزة المفعّلة</>}
        title="التفعيلات"
        description="راقب الأجهزة المرتبطة بتراخيصك، وآخر نبضة اتصال، وألغِ التفعيل لتحرير المقاعد عند الحاجة."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي التفعيلات" value={formatNumber(total)} hint="عبر جميع التراخيص" icon={MonitorSmartphone} tone="primary" delay={0} />
        <StatCard label="أجهزة نشطة" value={formatNumber(activeCount)} hint={total ? `${Math.round((activeCount / total) * 100)}% من التفعيلات` : '—'} icon={MonitorCheck} tone="success" delay={0.05} />
        <StatCard label="تفعيلات أوفلاين" value={formatNumber(offlineCount)} hint="ملفات ترخيص دون اتصال" icon={WifiOff} tone="warning" delay={0.1} />
        <StatCard label="تفعيلات ملغاة" value={formatNumber(deactivated)} hint="مقاعد محررة" icon={ShieldCheck} tone="accent" delay={0.15} />
      </div>

      <Panel padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-3">
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث بالجهاز أو الترخيص أو العميل…" className="w-full sm:w-72" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36" aria-label="حالة التفعيل">
            <option value="all">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="deactivated">ملغى التفعيل</option>
          </Select>
          <Select value={mode} onChange={(e) => setMode(e.target.value)} className="w-36" aria-label="وضع التفعيل">
            <option value="all">كل الأنماط</option>
            <option value="online">أونلاين</option>
            <option value="offline">أوفلاين</option>
          </Select>
          <span className="ms-auto text-[10px] text-muted">{formatNumber(list.data?.total ?? 0)} نتيجة</span>
        </div>

        {list.loading && !list.data ? (
          <TableSkeleton rows={6} cols={5} />
        ) : list.error ? (
          <ErrorPanel message={list.error} onRetry={list.reload} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Laptop size={25} />}
            title={search || status !== 'all' || mode !== 'all' ? 'لا تفعيلات مطابقة' : 'لا أجهزة مفعّلة بعد'}
            description={search || status !== 'all' || mode !== 'all'
              ? 'جرّب تغيير الفلاتر أو كلمات البحث.'
              : 'عند تفعيل أول جهاز عبر API أو ملف أوفلاين سيظهر هنا مباشرة.'}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <DataTable minWidth={900}>
                <thead>
                  <tr>
                    <Th>الجهاز</Th>
                    <Th>الترخيص</Th>
                    <Th>العميل</Th>
                    <Th>النمط</Th>
                    <Th>الحالة</Th>
                    <Th>آخر نبضة</Th>
                    <Th width={44}><span className="sr-only">إجراءات</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <Tr key={a.id} onClick={() => setOpenId(a.id)}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', a.status === 'active' ? 'bg-success/10 text-success' : 'bg-surface-3 text-muted')}>
                            {a.mode === 'online' ? <Wifi size={15} /> : <WifiOff size={15} />}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-medium text-ink">{a.machineName || 'جهاز بدون اسم'}</p>
                            <p className="numeric max-w-[200px] truncate text-[9.5px] text-muted" dir="ltr">{a.machineId}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <ProductIcon icon="app-window" color={a.product.color} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[11.5px] text-soft">{a.product.name}</p>
                            <p className="numeric truncate text-[9.5px] text-muted" dir="ltr">{a.licenseUid}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <p className="max-w-[140px] truncate text-[11.5px] text-soft">{a.customer?.name || 'بدون عميل'}</p>
                        <p className="max-w-[140px] truncate text-[9.5px] text-muted">{a.customer?.company || '—'}</p>
                      </Td>
                      <Td>
                        <span className={cn('inline-flex items-center gap-1 text-[10.5px]', a.mode === 'online' ? 'text-success' : 'text-warning')}>
                          {a.mode === 'online' ? <Wifi size={11} /> : <WifiOff size={11} />}
                          {a.mode === 'online' ? 'أونلاين' : 'أوفلاين'}
                        </span>
                      </Td>
                      <Td><StatusBadge status={a.status} /></Td>
                      <Td>
                        <p className="text-[11px] text-soft">{a.lastSeenAt ? timeAgo(a.lastSeenAt) : '—'}</p>
                        <p className="text-[9.5px] text-muted">{a.lastSeenAt ? formatDate(a.lastSeenAt, true) : 'لم يتصل'}</p>
                      </Td>
                      <Td className="text-end">
                        <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
                          <Menu items={[
                            { label: 'عرض التفاصيل', icon: <Search size={14} />, onClick: () => setOpenId(a.id) },
                            { label: 'فتح الترخيص', icon: <ArrowUpLeft size={14} />, onClick: () => navigate(`/licenses?open=${a.licenseId}`) },
                            { label: 'نسخ معرّف الجهاز', icon: <Copy size={14} />, onClick: () => copyMachine(a.machineId) },
                            ...(can('activations.manage') && a.status === 'active' ? [{
                              label: 'إلغاء التفعيل', icon: <Power size={14} />, separator: true, onClick: () => setActionTarget({ type: 'deactivate', activation: a }),
                            }] : []),
                            ...(can('activations.manage') ? [{
                              label: 'حذف السجل', icon: <Trash2 size={14} />, danger: true, onClick: () => setActionTarget({ type: 'delete', activation: a }),
                            }] : []),
                          ]} />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </div>

            <div className="space-y-2 p-3 md:hidden">
              {items.map((a, index) => (
                <motion.button
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.2) }}
                  onClick={() => setOpenId(a.id)}
                  className="w-full rounded-xl border border-line bg-surface p-3 text-start"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-ink">{a.machineName || 'جهاز بدون اسم'}</p>
                      <p className="numeric truncate text-[9px] text-muted" dir="ltr">{a.machineId}</p>
                      <p className="mt-0.5 truncate text-[9.5px] text-muted">{a.product.name} · {a.customer?.name || 'بدون عميل'}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-line/60 pt-1.5 text-[9.5px] text-muted">
                    <span>{a.mode === 'online' ? 'أونلاين' : 'أوفلاين'}</span>
                    <span>{a.lastSeenAt ? `آخر نبضة ${timeAgo(a.lastSeenAt)}` : 'لم يتصل بعد'}</span>
                  </div>
                </motion.button>
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

      <Drawer
        open={!!drawerActivation}
        onClose={() => setOpenId(null)}
        width="max-w-lg"
        title={drawerActivation ? (
          <div>
            <p className="text-[15px] font-semibold text-ink">{drawerActivation.machineName || 'جهاز بدون اسم'}</p>
            <p className="numeric text-[10px] text-muted" dir="ltr">{drawerActivation.machineId}</p>
          </div>
        ) : <p className="text-[14px] font-semibold text-ink">تفاصيل التفعيل</p>}
        footer={drawerActivation && can('activations.manage') ? (
          <div className="flex items-center justify-between gap-2">
            <Button variant="danger" size="sm" onClick={() => setActionTarget({ type: 'delete', activation: drawerActivation })}>
              <Trash2 size={14} /> حذف السجل
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => navigate(`/licenses?open=${drawerActivation.licenseId}`)}>
                <ArrowUpLeft size={14} /> فتح الترخيص
              </Button>
              {drawerActivation.status === 'active' && (
                <Button variant="primary" size="sm" onClick={() => setActionTarget({ type: 'deactivate', activation: drawerActivation })}>
                  <Power size={14} /> إلغاء التفعيل
                </Button>
              )}
            </div>
          </div>
        ) : undefined}
      >
        {drawerActivation && (
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/40 p-3">
              <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', drawerActivation.status === 'active' ? 'bg-success/10 text-success' : 'bg-surface-3 text-muted')}>
                {drawerActivation.mode === 'online' ? <Wifi size={20} /> : <WifiOff size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-ink">{drawerActivation.product.name}</p>
                <p className="numeric truncate text-[10px] text-muted" dir="ltr">{drawerActivation.licenseUid}</p>
              </div>
              <StatusBadge status={drawerActivation.status} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'العميل', value: drawerActivation.customer?.name || 'بدون عميل' },
                { label: 'الشركة', value: drawerActivation.customer?.company || '—' },
                { label: 'نظام التشغيل', value: drawerActivation.os || '—' },
                { label: 'إصدار التطبيق', value: drawerActivation.appVersion ? `v${drawerActivation.appVersion}` : '—' },
                { label: 'عنوان IP', value: drawerActivation.ip || '—' },
                { label: 'نمط التفعيل', value: drawerActivation.mode === 'online' ? 'أونلاين' : 'أوفلاين' },
                { label: 'تاريخ التفعيل', value: formatDate(drawerActivation.activatedAt, true) },
                { label: 'آخر نبضة', value: drawerActivation.lastSeenAt ? formatDate(drawerActivation.lastSeenAt, true) : '—' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-line bg-surface-2/50 px-3 py-2">
                  <p className="text-[9.5px] text-muted">{item.label}</p>
                  <p className="mt-0.5 truncate text-[11px] text-soft" dir={item.label === 'عنوان IP' ? 'ltr' : undefined}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-line bg-deep/60 px-3 py-2.5">
              <p className="text-[9.5px] text-muted">معرّف الجهاز (HWID)</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="numeric flex-1 break-all font-mono text-[10.5px] text-soft" dir="ltr">{drawerActivation.machineId}</code>
                <Button size="icon" variant="ghost" onClick={() => copyMachine(drawerActivation.machineId)} title="نسخ"><Copy size={13} /></Button>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!actionTarget}
        onClose={() => setActionTarget(null)}
        onConfirm={runAction}
        loading={busy}
        tone={actionTarget?.type === 'delete' ? 'danger' : 'primary'}
        title={actionTarget?.type === 'delete' ? 'حذف سجل التفعيل؟' : 'إلغاء تفعيل الجهاز؟'}
        description={actionTarget?.type === 'delete'
          ? 'سيُحذف سجل الجهاز نهائياً من قاعدة البيانات. لتحرير المقعد فقط استخدم «إلغاء التفعيل».'
          : `سيتوقف الجهاز «${actionTarget?.activation.machineName || actionTarget?.activation.machineId}» عن العمل ويصبح المقعد متاحاً لجهاز آخر.`}
        confirmText={actionTarget?.type === 'delete' ? 'حذف السجل' : 'إلغاء التفعيل'}
      />
    </div>
  );
}
