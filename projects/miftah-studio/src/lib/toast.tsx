import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from './utils';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (input: { type?: ToastType; title: string; description?: string }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const TONES: Record<ToastType, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-info',
  warning: 'text-warning',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(({ type = 'info', title, description }: { type?: ToastType; title: string; description?: string }) => {
    const id = ++counter.current;
    setItems((prev) => [...prev.slice(-3), { id, type, title, description }]);
    window.setTimeout(() => remove(id), 4600);
  }, [remove]);

  const success = useCallback((title: string, description?: string) => toast({ type: 'success', title, description }), [toast]);
  const error = useCallback((title: string, description?: string) => toast({ type: 'error', title, description }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      {children}
      <div className="fixed top-4 left-1/2 z-[120] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2 no-print">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const Icon = ICONS[item.type];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="glass flex items-start gap-3 rounded-2xl px-4 py-3 shadow-pop"
              >
                <Icon size={19} className={cn('mt-0.5 shrink-0', TONES[item.type])} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink">{item.title}</p>
                  {item.description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.description}</p>}
                </div>
                <button onClick={() => remove(item.id)} className="rounded-lg p-1 text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="إغلاق">
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
