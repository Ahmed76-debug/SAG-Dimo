import type { ElementType, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus, ShieldAlert } from 'lucide-react';
import { Badge, Button, EmptyState, Progress, Skeleton } from './primitives';
import { Sparkline } from './charts';
import { cn, daysLeft, formatDate, formatMoney, MODE_META, PLAN_META, STATUS_META } from '@/lib/utils';

/* --------------------------------- Stat -------------------------------- */
const TONES: Record<string, string> = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
  accent: 'var(--accent)',
};

export function StatCard({
  label, value, hint, icon: Icon, tone = 'primary', trend, spark, delay = 0, onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ElementType;
  tone?: keyof typeof TONES;
  trend?: number | null;
  spark?: number[];
  delay?: number;
  onClick?: () => void;
}) {
  const color = TONES[tone] || TONES.primary;
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={cn('card group relative overflow-hidden p-4 pb-5', onClick && 'cursor-pointer transition-colors hover:border-line-strong')}
    >
      <div
        className="pointer-events-none absolute -end-10 -top-12 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-30"
        style={{ background: color }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11.5px] font-medium text-muted">{label}</p>
          <p className="numeric mt-2 text-[26px] font-bold leading-none text-ink">{value}</p>
        </div>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
          style={{ color, background: `color-mix(in oklab, ${color} 13%, transparent)`, borderColor: `color-mix(in oklab, ${color} 26%, transparent)` }}
        >
          <Icon size={17} strokeWidth={1.9} />
        </span>
      </div>
      <div className="relative mt-3 flex min-h-[18px] flex-wrap items-center gap-x-2 gap-y-1">
        {typeof trend === 'number' && <TrendPill value={trend} />}
        {hint && <span className="text-[10.5px] text-muted">{hint}</span>}
      </div>
      {spark && spark.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-50">
          <Sparkline values={spark} color={color} height={30} />
        </div>
      )}
    </motion.article>
  );
}

export function TrendPill({ value }: { value: number }) {
  if (!Number.isFinite(value)) return null;
  const positive = value > 0;
  const zero = value === 0;
  const Icon = zero ? Minus : positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
      zero ? 'bg-surface-3 text-muted' : positive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
    )}>
      <Icon size={11} />
      {Math.abs(value)}%
    </span>
  );
}

/* -------------------------------- Panel -------------------------------- */
export function Panel({
  title, description, action, children, className, padded = true, bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
  bodyClassName?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn('card overflow-hidden', className)}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-[13.5px] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[11px] text-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn(padded && 'p-4', bodyClassName)}>{children}</div>
    </motion.section>
  );
}

/* -------------------------------- Table -------------------------------- */
export function DataTable({ children, minWidth = 720, className }: {
  children: ReactNode; minWidth?: number; className?: string;
}) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-[12.5px]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, width }: { children?: ReactNode; className?: string; width?: number | string }) {
  return (
    <th
      className={cn('whitespace-nowrap border-b border-line px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-[0.08em] text-muted', className)}
      style={width ? { width } : undefined}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn('px-4 py-3 align-middle', className)}>{children}</td>;
}

export function Tr({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'group/row border-b border-line/60 transition-colors last:border-0',
        onClick && 'cursor-pointer hover:bg-surface-2/70',
        className
      )}
    >
      {children}
    </tr>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={cn('h-8 flex-1 rounded-lg', c === 0 && 'max-w-[240px]')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- Badges -------------------------------- */
export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, tone: 'neutral' as const, dot: '#94a3b8' };
  return <Badge tone={meta.tone} dot>{meta.label}</Badge>;
}

export function PlanBadge({ plan }: { plan: string }) {
  const meta = PLAN_META[plan] || { label: plan, tone: 'info' as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function ModeBadge({ mode }: { mode: string }) {
  const meta = MODE_META[mode] || { label: mode, tone: 'info' as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/* -------------------------------- Seats -------------------------------- */
export function SeatMeter({ used, max }: { used: number; max: number }) {
  const full = used >= max;
  return (
    <div className="w-[92px]">
      <div className="mb-1 flex items-center justify-between text-[10.5px]">
        <span className="numeric font-medium text-soft">{used}/{max}</span>
        <span className="text-muted">مقاعد</span>
      </div>
      <Progress value={used} max={max} tone={full ? 'warning' : 'primary'} />
    </div>
  );
}

/* -------------------------------- Expiry ------------------------------- */
export function ExpiryCell({ expiresAt, plan }: { expiresAt: string | null; plan?: string }) {
  if (!expiresAt) {
    return <span className="text-[11.5px] font-medium text-success">دائم</span>;
  }
  const left = daysLeft(expiresAt);
  const tone = left === null ? 'text-muted' : left < 0 ? 'text-danger' : left <= 30 ? 'text-warning' : 'text-soft';
  return (
    <div className="leading-tight">
      <p className="text-[11.5px] text-soft">{formatDate(expiresAt)}</p>
      <p className={cn('mt-0.5 text-[10px] font-medium', tone)}>
        {left === null ? '—' : left < 0 ? `انتهى قبل ${Math.abs(left)} يوم` : left === 0 ? 'ينتهي اليوم' : `متبقٍ ${left} يوم`}
      </p>
    </div>
  );
}

/* ------------------------------- Money --------------------------------- */
export function Money({ value, currency = 'USD', compact = false, className }: {
  value: number; currency?: string; compact?: boolean; className?: string;
}) {
  return <span className={cn('numeric', className)}>{formatMoney(value, currency, compact)}</span>;
}

/* ------------------------------ Filter bar ----------------------------- */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

/* ------------------------------ Permission ----------------------------- */
export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="card">
      <EmptyState
        icon={<ShieldAlert size={26} />}
        title="لا تملك صلاحية الوصول"
        description={message || 'تواصل مع مالك الاستوديو لمنحك الصلاحية المطلوبة لهذا القسم.'}
      />
    </div>
  );
}

/* ------------------------------ Summary strip -------------------------- */
export function SummaryStrip({ items }: { items: { label: string; value: ReactNode; tone?: string }[] }) {
  return (
    <div className="grid grid-cols-2 divide-y divide-line rounded-2xl border border-line bg-surface/60 sm:grid-cols-4 sm:divide-y-0 sm:divide-x sm:divide-x-reverse">
      {items.map((item) => (
        <div key={item.label} className="px-4 py-3">
          <p className="text-[10.5px] text-muted">{item.label}</p>
          <p className="numeric mt-0.5 text-[15px] font-semibold" style={item.tone ? { color: item.tone } : undefined}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Loading page --------------------------- */
export function PageLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><Skeleton className="h-7 w-52" /><Skeleton className="h-3.5 w-80" /></div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-[330px] rounded-2xl xl:col-span-2" />
        <Skeleton className="h-[330px] rounded-2xl" />
      </div>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card">
      <EmptyState
        icon={<ShieldAlert size={26} />}
        title="تعذر تحميل البيانات"
        description={message}
        action={onRetry ? <Button variant="secondary" onClick={onRetry}>إعادة المحاولة</Button> : undefined}
      />
    </div>
  );
}
