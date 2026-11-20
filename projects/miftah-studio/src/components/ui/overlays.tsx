import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, MoreHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './primitives';

/* -------------------------------- Modal ------------------------------- */
const SIZES = {
  sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl',
};

export function Modal({ open, onClose, title, description, children, footer, size = 'md', className, hideClose }: {
  open: boolean; onClose: () => void; title?: ReactNode; description?: ReactNode; children: ReactNode;
  footer?: ReactNode; size?: keyof typeof SIZES; className?: string; hideClose?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-deep/70 backdrop-blur-[3px]"
            style={{ backgroundColor: 'color-mix(in oklab, var(--bg-deep) 72%, transparent)' }}
          />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className={cn(
              'relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-surface shadow-pop',
              'rounded-t-3xl sm:rounded-3xl', SIZES[size], className
            )}
          >
            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
                  {description && <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p>}
                </div>
                {!hideClose && (
                  <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="إغلاق">
                    <X size={17} />
                  </button>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/40 px-5 py-3.5 sm:px-6">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------- Drawer ------------------------------ */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'max-w-xl' }: {
  open: boolean; onClose: () => void; title?: ReactNode; subtitle?: ReactNode; children: ReactNode;
  footer?: ReactNode; width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  const hiddenX = typeof document !== 'undefined' && document.dir === 'rtl' ? '100%' : '-100%';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 backdrop-blur-[2px]"
            style={{ backgroundColor: 'color-mix(in oklab, var(--bg-deep) 64%, transparent)' }}
          />
          <motion.aside
            initial={{ x: hiddenX }} animate={{ x: 0 }} exit={{ x: hiddenX }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            className={cn('absolute inset-y-0 start-0 flex w-full flex-col border-e border-line bg-surface shadow-pop', width)}
            style={{ boxShadow: 'var(--shadow-pop)' }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div className="min-w-0">{title}{subtitle}</div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="إغلاق">
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer && <div className="border-t border-line bg-surface-2/40 px-5 py-3.5">{footer}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ---------------------------- ConfirmDialog --------------------------- */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmText = 'تأكيد', cancelText = 'إلغاء', tone = 'danger', loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; description?: ReactNode;
  confirmText?: string; cancelText?: string; tone?: 'danger' | 'primary'; loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      hideClose
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{cancelText}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmText}</Button>
        </>
      )}
    >
      <div className="flex gap-3.5">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-primary-soft text-primary')}>
          <AlertTriangle size={20} />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {description && <div className="mt-1 text-[12.5px] leading-relaxed text-muted">{description}</div>}
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------- Menu -------------------------------- */
export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export function Menu({ items, trigger, align = 'end', triggerClassName }: {
  items: MenuItem[]; trigger?: ReactNode; align?: 'start' | 'end'; triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-ink',
          open && 'bg-surface-3 text-ink',
          triggerClassName
        )}
        aria-label={trigger ? undefined : 'خيارات'}
      >
        {trigger || <MoreHorizontal size={16} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className={cn(
              'absolute top-full z-50 mt-1.5 min-w-[184px] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop',
              align === 'end' ? 'end-0' : 'start-0'
            )}
          >
            {items.map((item, index) => (
              <div key={`${item.label}-${index}`}>
                {item.separator && <div className="my-1 h-px bg-line" />}
                <button
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    item.onClick?.();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[12px] transition disabled:opacity-40',
                    item.danger ? 'text-danger hover:bg-danger/10' : 'text-soft hover:bg-surface-2 hover:text-ink'
                  )}
                >
                  {item.icon && <span className="shrink-0 opacity-80">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------- Tabs -------------------------------- */
export function Tabs<T extends string>({ tabs, value, onChange, className }: {
  tabs: { id: T; label: string; icon?: ReactNode; count?: number }[];
  value: T; onChange: (id: T) => void; className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto border-b border-line pb-px no-scrollbar', className)}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[12.5px] font-medium transition-colors',
              active ? 'text-ink' : 'text-muted hover:text-soft'
            )}
          >
            {tab.icon}
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', active ? 'bg-primary-soft text-primary' : 'bg-surface-3 text-muted')}>{tab.count}</span>
            )}
            {active && <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------- Section Header --------------------------- */
export function SectionHeader({ title, description, action, className }: {
  title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[12px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
