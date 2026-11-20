import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, Coffee, Calculator, Dumbbell, GraduationCap,
  Loader2, Pill, Search, Stethoscope, Store, Wrench, BookOpen, AppWindow, Copy, X,
} from 'lucide-react';
import { cn, copyText } from '@/lib/utils';

/* ------------------------------- Button ------------------------------- */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'soft';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-ink hover:bg-primary-hover shadow-[0_14px_34px_-18px_var(--primary)]',
  secondary: 'bg-surface-2 text-ink border border-line hover:border-line-strong hover:bg-surface-3',
  ghost: 'text-soft hover:bg-surface-2 hover:text-ink',
  outline: 'border border-line-strong text-soft hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger/12 text-danger border border-danger/25 hover:bg-danger/20',
  soft: 'bg-primary-soft text-primary hover:bg-primary/20',
};

const BTN_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[12px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-[13px] gap-2 rounded-xl',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-xl justify-center',
};

export function Button({
  variant = 'secondary', size = 'md', loading = false, className, children, disabled, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant; size?: ButtonSize; loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-all duration-200 active:scale-[0.975] disabled:pointer-events-none disabled:opacity-45',
        BTN_VARIANTS[variant], BTN_SIZES[size], className
      )}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

/* -------------------------------- Badge ------------------------------- */
type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'primary';
const BADGE_TONES: Record<Tone, string> = {
  success: 'bg-success/10 text-success border-success/25',
  danger: 'bg-danger/10 text-danger border-danger/25',
  warning: 'bg-warning/10 text-[var(--warning)] border-warning/25',
  info: 'bg-info/10 text-info border-info/25',
  neutral: 'bg-surface-3 text-muted border-line',
  primary: 'bg-primary-soft text-primary border-primary/25',
};

export function Badge({ tone = 'neutral', children, className, dot = false }: {
  tone?: Tone; children: ReactNode; className?: string; dot?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap', BADGE_TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* -------------------------------- Fields ------------------------------ */
export function Field({ label, hint, error, required, children, className }: {
  label?: string; hint?: string; error?: string; required?: boolean; children: ReactNode; className?: string;
}) {
  const uid = useId();
  const describedBy = hint || error ? `${uid}-hint` : undefined;
  let controlId: string | undefined;
  let control = children;

  if (isValidElement(children) && (children.type === Input || children.type === Select || children.type === Textarea)) {
    const props = children.props as Record<string, unknown>;
    controlId = (props.id as string) || `${uid}-control`;
    control = cloneElement(children as ReactElement<Record<string, unknown>>, {
      id: controlId,
      'aria-label': props['aria-label'] || label,
      'aria-required': required || undefined,
      'aria-invalid': error ? true : props['aria-invalid'],
      'aria-describedby': describedBy || props['aria-describedby'],
    });
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={controlId} className="flex items-center gap-1 text-[12px] font-medium text-soft">
          {label}
          {required && <span className="text-danger">*</span>}
        </label>
      )}
      {control}
      {error ? <p id={describedBy} className="text-[11px] text-danger">{error}</p> : hint ? <p id={describedBy} className="text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

const CONTROL = 'w-full rounded-xl border border-line bg-surface-2 text-[13px] text-ink placeholder:text-muted/70 transition-colors hover:border-line-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-[var(--ring)] focus:ring-opacity-20 disabled:opacity-50';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, 'h-10 px-3', className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(CONTROL, 'min-h-[88px] resize-y px-3 py-2.5 leading-relaxed', className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={cn(CONTROL, 'h-10 appearance-none ps-3 pe-9', className)}>
        {children}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'بحث…', className }: {
  value: string; onChange: (value: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(CONTROL, 'h-10 ps-9 pe-9')}
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-surface-3 hover:text-ink" aria-label="مسح">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

/* -------------------------------- Switch ------------------------------ */
export function Switch({ checked, onChange, label, hint, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string; hint?: string; disabled?: boolean;
}) {
  return (
    <label className={cn('flex cursor-pointer items-center justify-between gap-4', disabled && 'pointer-events-none opacity-50')}>
      {(label || hint) && (
        <span>
          {label && <span className="block text-[13px] font-medium text-ink">{label}</span>}
          {hint && <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-300',
          checked ? 'border-primary bg-primary' : 'border-line-strong bg-surface-3'
        )}
      >
        <motion.span
          animate={{ x: checked ? (document.dir === 'rtl' ? -20 : 20) : 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          className={cn(
            'absolute top-0.5 start-0.5 h-[18px] w-[18px] rounded-full shadow-sm',
            checked ? 'bg-primary-ink' : 'bg-muted'
          )}
        />
      </button>
    </label>
  );
}

/* -------------------------------- Avatar ------------------------------ */
export function Avatar({ name, color = '#6366f1', size = 'md', className }: {
  name: string; color?: string; size?: 'sm' | 'md' | 'lg'; className?: string;
}) {
  const dims = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-[11px]';
  const letters = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('');
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', dims, className)}
      style={{ backgroundColor: `${color}22`, color: `color-mix(in oklab, ${color} 66%, var(--text))`, boxShadow: `inset 0 0 0 1px ${color}44` }}
    >
      {letters || '؟'}
    </span>
  );
}

/* ------------------------------- Progress ----------------------------- */
export function Progress({ value, max = 100, tone = 'primary', className }: {
  value: number; max?: number; tone?: 'primary' | 'success' | 'warning' | 'danger'; className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100));
  const color = tone === 'success' ? 'var(--success)' : tone === 'warning' ? 'var(--warning)' : tone === 'danger' ? 'var(--danger)' : 'var(--primary)';
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  );
}

export function RingProgress({ value, max, size = 88, stroke = 7, color = 'var(--primary)', children }: {
  value: number; max: number; size?: number; stroke?: number; color?: string; children?: ReactNode;
}) {
  const pct = Math.min(1, value / Math.max(1, max));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ------------------------------- Segmented ---------------------------- */
export function Segmented<T extends string>({ options, value, onChange, size = 'md', className }: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T; onChange: (v: T) => void; size?: 'sm' | 'md'; className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface-2 p-0.5', className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex items-center gap-1.5 rounded-[10px] font-medium transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-[11.5px]' : 'h-8 px-3 text-[12px]',
              active ? 'text-ink' : 'text-muted hover:text-soft'
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-[10px] border border-line-strong bg-surface shadow-sm"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">{opt.icon}{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ CopyButton ---------------------------- */
export function CopyButton({ value, className, label, size = 14 }: {
  value: string; className?: string; label?: string; size?: number;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copyText(value);
        if (ok) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }
      }}
      className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-muted transition hover:bg-surface-3 hover:text-ink', className)}
      title="نسخ"
    >
      {copied ? <Check size={size} className="text-success" /> : <Copy size={size} />}
      {label && <span className="text-[11px]">{copied ? 'تم النسخ' : label}</span>}
    </button>
  );
}

/* ------------------------------ EmptyState ---------------------------- */
export function EmptyState({ icon, title, description, action, className }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface-2 text-muted">
        <div className="absolute inset-0 rounded-2xl bg-primary-soft opacity-40 blur-xl" />
        <span className="relative">{icon || <Search size={24} />}</span>
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------- Skeleton ----------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-lg bg-surface-3', className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

/* ------------------------------ Pagination ---------------------------- */
export function Pagination({ page, pages, total, onChange, className }: {
  page: number; pages: number; total?: number; onChange: (page: number) => void; className?: string;
}) {
  if (pages <= 1) return null;
  return (
    <div className={cn('flex items-center justify-between gap-3 px-1', className)}>
      <p className="text-[11px] text-muted">
        صفحة {page} من {pages}{typeof total === 'number' ? ` · ${total} عنصر` : ''}
      </p>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="السابق">
          <ChevronRight size={15} />
        </Button>
        <Button size="icon" variant="outline" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="التالي">
          <ChevronLeft size={15} />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- Tooltip ------------------------------ */
export function Tip({ label, children, side = 'top' }: { label: string; children: ReactNode; side?: 'top' | 'bottom' }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span className={cn(
        'pointer-events-none absolute start-1/2 z-50 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2 py-1 text-[10.5px] text-soft shadow-pop group-hover/tip:block',
        side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
      )}>
        {label}
      </span>
    </span>
  );
}

/* ------------------------------ CodeBlock ----------------------------- */
export function CodeBlock({ code, language, className }: { code: string; language?: string; className?: string }) {
  return (
    <div className={cn('group relative overflow-hidden rounded-xl border border-line bg-deep', className)}>
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted">{language || 'code'}</span>
        <CopyButton value={code} size={12} />
      </div>
      <pre className="max-h-80 overflow-auto p-3 text-[11.5px] leading-relaxed text-soft" dir="ltr">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ----------------------------- ProductIcon ---------------------------- */
const ICON_MAP: Record<string, React.ElementType> = {
  coffee: Coffee,
  stethoscope: Stethoscope,
  pill: Pill,
  dumbbell: Dumbbell,
  calculator: Calculator,
  'graduation-cap': GraduationCap,
  'app-window': AppWindow,
  store: Store,
  wrench: Wrench,
  book: BookOpen,
};

export function ProductIcon({ icon, color, size = 'md', className }: {
  icon: string; color: string; size?: 'sm' | 'md' | 'lg'; className?: string;
}) {
  const Icon = ICON_MAP[icon] || AppWindow;
  const dims = size === 'sm' ? 'h-8 w-8 rounded-lg' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-10 w-10 rounded-xl';
  const iconSize = size === 'sm' ? 15 : size === 'lg' ? 24 : 19;
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center border', dims, className)}
      style={{ backgroundColor: `${color}18`, borderColor: `${color}35`, color }}
    >
      <Icon size={iconSize} strokeWidth={1.8} />
    </span>
  );
}

export const PRODUCT_ICONS = Object.keys(ICON_MAP);

/* --------------------------- Inline status dot ------------------------ */
export function StatusDot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

/* ------------------------------ ScrollShadow -------------------------- */
export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOutside]);
  return ref;
}
