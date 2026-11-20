import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Moon, Palette, Sun } from 'lucide-react';
import { THEMES, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, def } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border border-line bg-surface-2/70 text-muted transition hover:border-line-strong hover:text-ink',
          compact ? 'h-9 w-9 justify-center' : 'h-9 px-3'
        )}
        title="تغيير المظهر"
        aria-label="تغيير المظهر"
      >
        <Palette size={16} />
        {!compact && <span className="text-[11.5px] font-medium">{def.name}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute end-0 top-full z-[70] mt-2 w-[318px] overflow-hidden rounded-2xl border border-line bg-surface p-3 shadow-pop"
          >
            <div className="mb-2.5 flex items-center justify-between px-1">
              <p className="text-[12px] font-semibold text-ink">مظهر الاستوديو</p>
              <span className="text-[10px] text-muted">6 ثيمات</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((item) => {
                const active = item.id === theme;
                const ModeIcon = item.mode === 'dark' ? Moon : Sun;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTheme(item.id)}
                    className={cn(
                      'group relative overflow-hidden rounded-xl border p-1.5 text-start transition-all',
                      active ? 'border-primary/60 bg-primary-soft' : 'border-line hover:border-line-strong hover:bg-surface-2'
                    )}
                  >
                    <div className="relative mb-2 h-[54px] overflow-hidden rounded-lg border border-line" style={{ background: item.bg }}>
                      <div className="absolute inset-x-1.5 top-1.5 flex gap-1">
                        <div className="h-1.5 w-6 rounded-full" style={{ background: item.swatches[0] }} />
                        <div className="h-1.5 w-3 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
                      </div>
                      <div
                        className="absolute inset-x-1.5 bottom-1.5 top-5 rounded-md border"
                        style={{ background: item.surface, borderColor: 'rgba(255,255,255,0.12)' }}
                      >
                        <div className="flex h-full items-end gap-1 p-1.5">
                          {[40, 70, 50, 88, 62].map((h, i) => (
                            <span key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: item.swatches[i % item.swatches.length], opacity: 0.85 }} />
                          ))}
                        </div>
                      </div>
                      {active && (
                        <span className="absolute end-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-ink">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[11px] font-medium text-ink">{item.name}</span>
                      <ModeIcon size={11} className="text-muted" />
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
