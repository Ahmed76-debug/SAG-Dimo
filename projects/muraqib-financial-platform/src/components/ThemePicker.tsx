import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Palette } from 'lucide-react'
import { useThemeStore, THEME_OPTIONS, type ThemeId } from '@/stores/theme.store'
import { useI18nStore } from '@/stores/i18n.store'
import { cn } from '@/lib/utils'

interface Props {
  compact?: boolean
  className?: string
}

const THEME_PREVIEWS: Record<ThemeId, { bg: string; surface: string; brand: string; accent: string }> = {
  light:          { bg: '#f4f6fb', surface: '#ffffff', brand: '#2563eb', accent: '#0891b2' },
  'light-sand':   { bg: '#f6f1e8', surface: '#fffaf2', brand: '#b7791f', accent: '#0f766e' },
  'light-mist':   { bg: '#eef4ff', surface: '#ffffff', brand: '#2563eb', accent: '#0891b2' },
  dark:           { bg: '#0b1220', surface: '#121a2b', brand: '#60a5fa', accent: '#22d3ee' },
  'dark-midnight':{ bg: '#060816', surface: '#0f1428', brand: '#8b5cf6', accent: '#22d3ee' },
  'dark-emerald': { bg: '#071311', surface: '#102220', brand: '#34d399', accent: '#14b8a6' },
}

export function ThemePicker({ compact, className }: Props) {
  const { theme, setTheme } = useThemeStore()
  const { language } = useI18nStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const light = THEME_OPTIONS.filter((t) => t.mode === 'light')
  const dark = THEME_OPTIONS.filter((t) => t.mode === 'dark')
  const title = language === 'ar' ? 'معرض الثيمات' : 'Theme gallery'
  const L = (ar: string, en: string) => (language === 'ar' ? ar : en)

  const Card = (opt: (typeof THEME_OPTIONS)[number]) => {
    const c = THEME_PREVIEWS[opt.id]
    const active = theme === opt.id
    return (
      <button
        key={opt.id}
        type="button"
        onClick={() => { setTheme(opt.id); setOpen(false) }}
        title={opt.label[language]}
        className={cn(
          'relative text-start rounded-2xl p-2.5 bg-surface border-2 transition-all duration-150 w-full',
          active ? 'border-primary shadow-[0_0_0_3px_rgba(37,99,235,0.15),0_10px_24px_rgba(0,0,0,0.12)]' : 'border-border hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg',
        )}
      >
        <span className="grid grid-cols-[22px_1fr] h-[68px] rounded-[10px] overflow-hidden border border-border/60 relative" style={{ background: c.bg }}>
          <span className="relative" style={{ background: c.brand }}><span className="absolute top-[9px] left-[5px] right-[5px] h-[6px] rounded bg-white/60" /></span>
          <span className="p-[7px_6px] flex flex-col gap-[5px]">
            <span className="h-[9px] rounded-[5px] border border-border/50" style={{ background: c.surface }} />
            <span className="h-[6px] w-[70%] rounded border border-border/40" style={{ background: c.surface }} />
            <span className="h-[6px] w-[45%] rounded border border-border/40" style={{ background: c.surface }} />
            <span className="flex gap-1 mt-auto">
              <i className="w-[13px] h-[13px] rounded block" style={{ background: c.brand }} />
              <i className="w-[13px] h-[13px] rounded block" style={{ background: c.accent }} />
              <i className="w-[13px] h-[13px] rounded block border border-border/40" style={{ background: c.surface }} />
            </span>
          </span>
          <span className={cn('absolute top-1.5 end-1.5 w-5 h-5 rounded-full bg-primary text-white grid place-items-center text-[11px] font-bold transition-all', active ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.6]')}>✓</span>
        </span>
        <span className="flex items-center gap-1.5 mt-2 font-extrabold text-[12.5px] text-text">
          {opt.label[language]}
          <span className={cn('text-[10px] px-[6px] py-[1px] rounded-full font-extrabold', active ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-text-secondary')}>
            {opt.mode === 'dark' ? L('داكن', 'Dark') : L('فاتح', 'Light')}
          </span>
        </span>
      </button>
    )
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={title}
        aria-label={title}
        className={cn(
          'flex items-center justify-center gap-1.5 rounded-xl border border-border text-text-secondary transition hover:bg-surface-2 hover:text-text',
          compact ? 'h-9 w-9' : 'h-9 flex-1 px-2 text-xs font-semibold',
        )}
      >
        <Palette className="h-4 w-4" />
        {!compact && <span>{title}</span>}
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          style={{ zIndex: 1000 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="w-[min(760px,94vw)] rounded-2xl border border-border bg-surface p-4 shadow-2xl"
            style={{ maxHeight: '86vh', overflow: 'auto' }}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="m-0 text-[15px] font-extrabold text-text">{title}</h3>
              <button type="button" className="text-xs font-semibold text-text-secondary hover:text-text px-2 py-1 rounded-lg hover:bg-surface-2" onClick={() => setOpen(false)}>{L('إغلاق', 'Close')}</button>
            </div>
            <div className="grid gap-4">
              <section>
                <div className="flex items-center gap-2 mb-2"><span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-amber-200 to-white border border-border" /><h4 className="m-0 text-[14px] font-extrabold">{L('الثيمات الفاتحة', 'Light themes')}</h4><span className="text-[11px] text-text-secondary font-bold">{light.length}</span></div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{light.map(Card)}</div>
              </section>
              <section>
                <div className="flex items-center gap-2 mb-2"><span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-slate-600 to-slate-950 border border-border" /><h4 className="m-0 text-[14px] font-extrabold">{L('الثيمات الداكنة', 'Dark themes')}</h4><span className="text-[11px] text-text-secondary font-bold">{dark.length}</span></div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{dark.map(Card)}</div>
              </section>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
