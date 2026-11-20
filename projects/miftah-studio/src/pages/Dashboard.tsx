import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowUpLeft, CalendarClock, CircleDollarSign, Inbox, KeyRound, MonitorSmartphone,
  Package, Plus, TrendingUp, UsersRound, Activity, Sparkles, Clock3,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge, Button, EmptyState, ProductIcon, Progress } from '@/components/ui/primitives';
import { AreaTrend, ChartLegend, Donut, MiniBars } from '@/components/ui/charts';
import {
  DataTable, ErrorPanel, ExpiryCell, PageLoading, Panel, PlanBadge, StatCard, Td, Th, Tr,
} from '@/components/ui/page';
import { Segmented } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';
import { useApiQuery } from '@/lib/hooks';
import type { DashboardData } from '@/lib/types';
import {
  actionMeta, cn, formatMonth, formatMoney, formatNumber, greeting, timeAgo, todayLabel,
} from '@/lib/utils';

const PLAN_COLORS: Record<string, string> = {
  perpetual: 'var(--success)',
  subscription: 'var(--primary)',
  trial: 'var(--warning)',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--success)',
  expired: 'var(--warning)',
  suspended: 'var(--muted)',
  revoked: 'var(--danger)',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'نشطة',
  expired: 'منتهية',
  suspended: 'موقوفة',
  revoked: 'ملغاة',
};

export function Dashboard() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [metric, setMetric] = useState<'count' | 'revenue'>('count');
  const { data, loading, error, reload } = useApiQuery<DashboardData>('/dashboard');

  if (loading && !data) return <PageLoading />;
  if (error && !data) return <ErrorPanel message={error} onRetry={reload} />;
  if (!data) return <PageLoading />;

  const { cards, series, planSplit, statusSplit, topProducts, expiringSoon, recent, activationsDaily } = data;
  const totalPlan = planSplit.reduce((sum, item) => sum + item.count, 0);
  const totalStatus = statusSplit.reduce((sum, item) => sum + item.count, 0);
  const maxProduct = Math.max(...topProducts.map((p) => p.licenses), 1);
  const totalIssuedYear = series.reduce((sum, item) => sum + item.count, 0);
  const revenueYear = series.reduce((sum, item) => sum + item.revenue, 0);
  const bestMonth = [...series].sort((a, b) => b[metric] - a[metric])[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={(
          <>
            <CalendarClock size={12} />
            {todayLabel()}
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-success">
              <span className="h-1 w-1 animate-pulse rounded-full bg-success" /> مباشر
            </span>
          </>
        )}
        title={<>{greeting()}، {user?.name?.split(' ')[0] || 'صديقي'} 👋</>}
        description="نظرة شاملة على أداء تراخيصك وتفعيلاتك — كل ما يحتاج انتباهك في مكان واحد."
        actions={(
          <>
            {can('backups.manage') && (
              <Button variant="secondary" onClick={() => navigate('/backups?new=1')}>
                <Package size={15} /> نسخة احتياطية
              </Button>
            )}
            {can('licenses.create') && (
              <Button variant="primary" onClick={() => navigate('/licenses?new=1')}>
                <Plus size={15} /> توليد ترخيص
              </Button>
            )}
          </>
        )}
      />

      {cards.pendingRequests > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-warning/25 bg-warning/[0.07] p-3.5">
          <div className="pointer-events-none absolute -end-8 -top-10 h-28 w-28 rounded-full bg-warning/15 blur-2xl" />
          <div className="relative flex flex-wrap items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <Inbox size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold text-ink">
                {formatNumber(cards.pendingRequests)} طلب تفعيل بانتظار المراجعة
              </p>
              <p className="mt-0.5 text-[10.5px] text-muted">أجهزة تنتظر إصدار ملف ترخيص أوفلاين — راجعها قبل أن يتأخر عملاؤك.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate('/requests')}>
              مراجعة الطلبات <ArrowLeft size={13} />
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="التراخيص النشطة" value={formatNumber(cards.activeLicenses)}
          hint={`من أصل ${formatNumber(cards.licenses)} ترخيص`} icon={KeyRound} tone="primary"
          trend={cards.activeGrowth} spark={series.map((s) => s.count)} delay={0}
          onClick={() => navigate('/licenses?status=active')}
        />
        <StatCard
          label="إيرادات آخر ٣٠ يوماً" value={formatMoney(cards.revenue, 'USD', true)}
          hint={`الإجمالي ${formatMoney(cards.totalRevenue, 'USD', true)}`} icon={CircleDollarSign} tone="success"
          trend={cards.revenueGrowth} spark={series.map((s) => s.revenue)} delay={0.05}
        />
        <StatCard
          label="الأجهزة المفعّلة" value={formatNumber(cards.activations)}
          hint={`${formatNumber(cards.onlineActivations)} أونلاين خلال ٧ أيام`} icon={MonitorSmartphone} tone="info"
          spark={activationsDaily.map((d) => d.count)} delay={0.1}
          onClick={() => navigate('/activations')}
        />
        <StatCard
          label="تنتهي قريباً" value={formatNumber(cards.expiring)}
          hint="خلال ٤٥ يوماً · تحتاج متابعة" icon={CalendarClock} tone="warning" delay={0.15}
          onClick={() => navigate('/licenses?status=active&expiring=45')}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="نمو الإصدارات"
          description="حركة إصدار التراخيص خلال آخر ١٢ شهراً"
          action={(
            <Segmented
              size="sm"
              value={metric}
              onChange={setMetric}
              options={[{ value: 'count', label: 'العدد' }, { value: 'revenue', label: 'الإيراد' }]}
            />
          )}
        >
          <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="numeric text-[26px] font-bold leading-none text-ink">
                {metric === 'count' ? formatNumber(totalIssuedYear) : formatMoney(revenueYear, 'USD', true)}
              </p>
              <p className="mt-1 text-[10.5px] text-muted">
                {metric === 'count' ? 'ترخيص صادر خلال ١٢ شهراً' : 'إيراد محقق خلال ١٢ شهراً'}
              </p>
            </div>
            {bestMonth && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[10px] text-muted">
                <TrendingUp size={11} className="text-success" />
                أفضل شهر: {formatMonth(bestMonth.month)} · {metric === 'count' ? formatNumber(bestMonth.count) : formatMoney(bestMonth.revenue, 'USD', true)}
              </span>
            )}
          </div>
          <AreaTrend
            data={series.map((item) => ({
              label: formatMonth(item.month),
              fullLabel: formatMonth(item.month),
              value: metric === 'count' ? item.count : item.revenue,
            }))}
            color={metric === 'count' ? 'var(--chart-1)' : 'var(--chart-5)'}
            formatValue={(value) => metric === 'count' ? `${formatNumber(value)} ترخيص` : formatMoney(value, 'USD')}
            height={228}
          />
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
            {[
              { label: 'إجمالي الإصدارات', value: formatNumber(totalIssuedYear) },
              { label: 'إجمالي الإيراد', value: formatMoney(revenueYear, 'USD', true) },
              { label: 'متوسط شهري', value: formatNumber(Math.round(totalIssuedYear / 12)) },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[10px] text-muted">{item.label}</p>
                <p className="numeric mt-0.5 text-[13px] font-semibold text-soft">{item.value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="توزيع الخطط" description="التراخيص حسب نموذج البيع">
          <div className="flex flex-col items-center gap-4 py-1">
            <Donut
              size={166}
              centerValue={formatNumber(totalPlan)}
              centerLabel="إجمالي التراخيص"
              segments={planSplit.map((item) => ({
                label: item.plan,
                value: item.count,
                color: PLAN_COLORS[item.plan] || 'var(--muted)',
              }))}
            />
            <div className="w-full space-y-1.5">
              {planSplit.map((item) => {
                const pct = totalPlan ? Math.round((item.count / totalPlan) * 100) : 0;
                return (
                  <div key={item.plan} className="flex items-center gap-2 rounded-lg px-1 py-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: PLAN_COLORS[item.plan] }} />
                    <span className="text-[11px] text-soft">{item.plan === 'perpetual' ? 'دائم' : item.plan === 'subscription' ? 'اشتراك' : 'تجريبي'}</span>
                    <span className="numeric ms-auto text-[11px] font-semibold text-ink">{formatNumber(item.count)}</span>
                    <span className="w-9 text-end text-[10px] text-muted">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 space-y-2.5 border-t border-line pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">حالة التراخيص</p>
            {statusSplit.map((item) => (
              <div key={item.status} className="space-y-1">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-soft">{STATUS_LABELS[item.status] || item.status}</span>
                  <span className="numeric text-muted">{formatNumber(item.count)}</span>
                </div>
                <Progress value={item.count} max={totalStatus} tone={item.status === 'active' ? 'success' : item.status === 'revoked' ? 'danger' : item.status === 'expired' ? 'warning' : 'primary'} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          className="xl:col-span-2"
          padded={false}
          title="تراخيص تقترب من الانتهاء"
          description="خلال ٤٥ يوماً — بادر بالتجديد قبل التوقف"
          action={<Button variant="ghost" size="sm" onClick={() => navigate('/licenses?status=active&expiring=45')}>عرض الكل <ArrowUpLeft size={13} /></Button>}
        >
          {expiringSoon.length === 0 ? (
            <EmptyState icon={<CalendarClock size={24} />} title="لا تراخيص تنتهي قريباً" description="كل اشتراكاتك في أمان خلال الفترة القادمة." />
          ) : (
            <DataTable minWidth={600}>
              <thead>
                <tr>
                  <Th>المنتج</Th>
                  <Th>العميل</Th>
                  <Th>الخطة</Th>
                  <Th>الانتهاء</Th>
                  <Th><span className="sr-only">فتح الترخيص</span></Th>
                </tr>
              </thead>
              <tbody>
                {expiringSoon.map((license) => (
                  <Tr key={license.id} onClick={() => navigate(`/licenses?open=${license.id}`)}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <ProductIcon icon="app-window" color={license.product_color} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium text-ink">{license.product_name}</p>
                          <p className="numeric text-[10px] text-muted">{license.uid}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <p className="truncate text-[11.5px] text-soft">{license.customer_name || '—'}</p>
                      <p className="truncate text-[10px] text-muted">{license.customer_company || 'بدون شركة'}</p>
                    </Td>
                    <Td><PlanBadge plan={license.plan} /></Td>
                    <Td><ExpiryCell expiresAt={license.expires_at} /></Td>
                    <Td className="text-end"><ArrowUpLeft size={14} className="ms-auto text-muted transition group-hover/row:text-primary" /></Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Panel>

        <Panel title="الأكثر مبيعاً" description="المنتجات حسب عدد التراخيص">
          <div className="space-y-3.5">
            {topProducts.map((product, index) => (
              <button
                key={product.id}
                onClick={() => navigate(`/products?open=${product.id}`)}
                className="group block w-full text-start"
              >
                <div className="flex items-center gap-2.5">
                  <span className="numeric w-4 shrink-0 text-[10px] font-bold text-muted">{index + 1}</span>
                  <ProductIcon icon={product.icon} color={product.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-medium text-ink group-hover:text-primary">{product.name}</p>
                    <p className="text-[9.5px] text-muted">{formatNumber(product.licenses)} ترخيص · {formatMoney(product.revenue, 'USD', true)}</p>
                  </div>
                  <ArrowUpLeft size={12} className="text-muted opacity-0 transition group-hover:opacity-100" />
                </div>
                <div className="mt-1.5 ps-[26px]">
                  <Progress value={product.licenses} max={maxProduct} tone="primary" />
                </div>
              </button>
            ))}
            {topProducts.length === 0 && (
              <p className="py-8 text-center text-[11px] text-muted">لا توجد منتجات بعد</p>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3">
            <button onClick={() => navigate('/customers')} className="rounded-xl border border-line bg-surface-2/50 p-2.5 text-start transition hover:border-line-strong">
              <UsersRound size={14} className="text-info" />
              <p className="numeric mt-1 text-[16px] font-bold text-ink">{formatNumber(cards.customers)}</p>
              <p className="text-[9.5px] text-muted">عميل مسجّل</p>
            </button>
            <button onClick={() => navigate('/products')} className="rounded-xl border border-line bg-surface-2/50 p-2.5 text-start transition hover:border-line-strong">
              <Package size={14} className="text-accent" />
              <p className="numeric mt-1 text-[16px] font-bold text-ink">{formatNumber(cards.products)}</p>
              <p className="text-[9.5px] text-muted">منتج نشط</p>
            </button>
          </div>
        </Panel>

        <Panel
          className="xl:col-span-2"
          padded={false}
          title="النشاط الأخير"
          description="آخر العمليات على الاستوديو"
          action={<Button variant="ghost" size="sm" onClick={() => navigate('/audit')}>السجل الكامل <ArrowUpLeft size={13} /></Button>}
        >
          <div className="divide-y divide-line/60">
            {recent.map((entry) => {
              const meta = actionMeta(entry.action);
              return (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold',
                    meta.tone === 'success' && 'bg-success/10 text-success',
                    meta.tone === 'danger' && 'bg-danger/10 text-danger',
                    meta.tone === 'warning' && 'bg-warning/10 text-warning',
                    meta.tone === 'info' && 'bg-info/10 text-info',
                    meta.tone === 'neutral' && 'bg-surface-3 text-muted',
                  )}>
                    {entry.actor.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] text-soft">
                      <span className="font-medium text-ink">{entry.actor}</span>
                      <span className="mx-1 text-muted">·</span>
                      {meta.label}
                      {entry.entityId && <span className="numeric ms-1 text-muted">#{entry.entityId}</span>}
                    </p>
                    <p className="text-[9.5px] text-muted">{entry.ip || '—'} · {timeAgo(entry.at)}</p>
                  </div>
                  <Badge tone={meta.tone} className="hidden sm:inline-flex">{meta.label}</Badge>
                </div>
              );
            })}
            {recent.length === 0 && <p className="px-4 py-10 text-center text-[11px] text-muted">لا يوجد نشاط بعد</p>}
          </div>
        </Panel>

        <Panel title="التفعيلات اليومية" description="آخر ١٤ يوماً">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="numeric text-[24px] font-bold leading-none text-ink">
                {formatNumber(activationsDaily.reduce((sum, d) => sum + d.count, 0))}
              </p>
              <p className="mt-1 text-[10px] text-muted">إجمالي التفعيلات</p>
            </div>
            <Badge tone="success" dot>{formatNumber(cards.onlineActivations)} نشط أونلاين</Badge>
          </div>
          <div className="mt-4">
            <MiniBars data={activationsDaily.map((d) => ({ label: d.date, value: d.count }))} color="var(--chart-2)" height={88} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] text-muted">
            <span>{activationsDaily[0]?.date.slice(5)}</span>
            <span>اليوم</span>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface-2/50 p-2.5">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-primary" />
            <p className="text-[10px] leading-relaxed text-muted">
              نصيحة: راقب الأجهزة التي لم ترسل نبضة منذ أسبوع لتحديث مقاعدها تلقائياً.
            </p>
          </div>
        </Panel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1.5"><Clock3 size={11} /> آخر تحديث الآن · يتم التحديث تلقائياً عند التنقل</span>
        <span className="inline-flex items-center gap-1.5"><Activity size={11} /> البيانات محفوظة محلياً في SQLite</span>
      </div>
    </div>
  );
}
