import { create } from 'zustand'
import { CheckCircle2, Info, X, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text shadow-sm outline-none transition placeholder:text-text-secondary/60 hover:border-primary/30 focus:border-primary/70 focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60'

export const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary'

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-accent/10 text-accent border-accent/25',
  warning: 'bg-warning/10 text-warning border-warning/25',
  danger: 'bg-danger/10 text-danger border-danger/25',
  info: 'bg-info/10 text-info border-info/25',
  muted: 'bg-surface-2 text-text-secondary border-border',
}

export function Badge({ children, tone = 'muted', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shadow-sm', toneClasses[tone], className)}>
      {children}
    </span>
  )
}

export function Card({ children, className, bodyClassName }: { children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border bg-surface shadow-soft transition-shadow duration-300 hover:shadow-card', className)}>
      {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  icon,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex items-start gap-4">
        {icon && (
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-info/10 text-primary sm:flex">
            {icon}
          </div>
        )}
        <div>
          {eyebrow && <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.32em] text-primary">{eyebrow}</p>}
          <h1 className="max-w-4xl text-2xl font-extrabold tracking-tight text-text sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-text-secondary">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Card className={className}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-bold text-text">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </Card>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: Tone
}) {
  const ring = {
    primary: 'from-primary/15 to-info/5 text-primary',
    success: 'from-accent/15 to-accent/5 text-accent',
    warning: 'from-warning/15 to-warning/5 text-warning',
    danger: 'from-danger/15 to-danger/5 text-danger',
    info: 'from-info/15 to-info/5 text-info',
    muted: 'from-surface-2 to-surface text-text-secondary',
  }[tone]
  return (
    <Card className="card-hover relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/50 via-info/40 to-accent/50" />
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text-secondary">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-text">{value}</p>
          {hint && <div className="mt-1 text-[11px] text-text-secondary">{hint}</div>}
        </div>
        {icon && <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br', ring)}>{icon}</div>}
      </div>
    </Card>
  )
}

export function Field({ label, required, hint, children, className }: { label?: string; required?: boolean; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {label && (
        <label className={labelClass}>
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="mt-1 text-[11px] leading-4 text-text-secondary">{hint}</p>}
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-2/40 px-6 py-12 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-text-secondary shadow-sm">{icon}</div>}
      <p className="text-sm font-semibold text-text">{title}</p>
      {text && <p className="mt-1 max-w-md text-xs leading-5 text-text-secondary">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />
}

export function LoadingBlock({ text }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-secondary">
      <Spinner /> {text || '...'}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-md sm:p-6" onClick={onClose}>
      <div
        className={cn('my-4 w-full animate-[modal-in_.35s_cubic-bezier(.22,1,.36,1)_both] overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl ring-1 ring-white/20', wide ? 'max-w-5xl' : 'max-w-2xl')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-text">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-text-secondary transition hover:bg-surface-2 hover:text-text" aria-label="close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

export function Button({
  children,
  onClick,
  variant = 'secondary',
  type = 'button',
  disabled,
  className,
  icon,
}: {
  children?: ReactNode
  onClick?: () => void
  variant?: ButtonVariant
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
  icon?: ReactNode
}) {
  const styles: Record<ButtonVariant, string> = {
    primary: 'relative overflow-hidden bg-[linear-gradient(110deg,rgb(var(--color-primary)),rgb(var(--color-info))_50%,rgb(var(--color-primary)))] bg-[length:220%_100%] text-primary-foreground shadow-card animate-[shimmer_5s_linear_infinite] hover:-translate-y-0.5 hover:shadow-soft active:translate-y-0',
    secondary: 'border border-border bg-surface text-text hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-2 active:translate-y-0',
    ghost: 'text-text-secondary hover:bg-surface-2 hover:text-text',
    danger: 'border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15',
    success: 'border border-accent/30 bg-accent/10 text-accent hover:bg-accent/15',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function IconButton({ children, onClick, title, tone = 'muted' }: { children: ReactNode; onClick?: () => void; title: string; tone?: 'muted' | 'danger' | 'success' }) {
  const hover = tone === 'danger' ? 'hover:bg-danger/10 hover:text-danger' : tone === 'success' ? 'hover:bg-accent/10 hover:text-accent' : 'hover:bg-surface-2 hover:text-text'
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} className={cn('rounded-lg p-2 text-text-secondary transition', hover)}>
      {children}
    </button>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2.5 text-sm text-text">
      <span className={cn('relative h-5 w-9 rounded-full transition', checked ? 'bg-primary' : 'bg-border')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'start-[18px]' : 'start-0.5')} />
      </span>
      {label && <span>{label}</span>}
    </button>
  )
}

export function Progress({ value, tone = 'primary' }: { value: number; tone?: 'primary' | 'success' | 'warning' | 'danger' }) {
  const color = { primary: 'bg-primary', success: 'bg-accent', warning: 'bg-warning', danger: 'bg-danger' }[tone]
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export interface ToastItem {
  id: number
  message: string
  tone: 'success' | 'error' | 'info' | 'warning'
}

interface ToastState {
  items: ToastItem[]
  push: (message: string, tone?: ToastItem['tone']) => void
  dismiss: (id: number) => void
}

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, tone = 'success') => {
    const id = Date.now() + Math.random()
    set((state) => ({ items: [...state.items, { id, message, tone }] }))
    setTimeout(() => set((state) => ({ items: state.items.filter((i) => i.id !== id) })), 4200)
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
}))

export function toast(message: string, tone: ToastItem['tone'] = 'success') {
  useToastStore.getState().push(message, tone)
}

export function ToastHost() {
  const { items, dismiss } = useToastStore()
  if (!items.length) return null
  return (
    <div className="no-print fixed bottom-5 left-1/2 z-[100] flex w-[92vw] max-w-md -translate-x-1/2 flex-col gap-2">
      {items.map((item) => {
        const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? XCircle : item.tone === 'warning' ? AlertTriangle : Info
        const color = item.tone === 'success' ? 'text-accent' : item.tone === 'error' ? 'text-danger' : item.tone === 'warning' ? 'text-warning' : 'text-info'
        return (
          <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface/95 px-4 py-3 text-sm text-text shadow-2xl backdrop-blur-xl animate-[toast-in_.35s_cubic-bezier(.22,1,.36,1)_both]">
            <Icon className={cn('h-5 w-5 shrink-0', color)} />
            <span className="flex-1 leading-5">{item.message}</span>
            <button onClick={() => dismiss(item.id)} className="text-text-secondary hover:text-text">
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
