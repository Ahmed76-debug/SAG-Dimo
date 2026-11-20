import { KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BrandMark({ size = 40, glow = false, className }: { size?: number; glow?: boolean; className?: string }) {
  return (
    <div className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      {glow && <div className="absolute inset-0 rounded-[30%] bg-primary/40 blur-xl" />}
      <div
        className="relative flex h-full w-full items-center justify-center rounded-[30%] shadow-[0_10px_30px_-12px_var(--primary)]"
        style={{ background: 'linear-gradient(145deg, var(--primary), color-mix(in oklab, var(--primary) 52%, var(--accent)))' }}
      >
        <KeyRound size={Math.round(size * 0.52)} strokeWidth={2.2} style={{ color: 'var(--primary-contrast)' }} />
        <span className="absolute end-1.5 top-1.5 h-1 w-1 rounded-full bg-[var(--primary-contrast)] opacity-70" />
      </div>
    </div>
  );
}

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandMark size={compact ? 32 : 38} glow />
      {!compact && (
        <div className="leading-none">
          <p className="text-[17px] font-bold tracking-tight text-ink">مفتاح</p>
          <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.22em] text-muted">Miftah Studio</p>
        </div>
      )}
    </div>
  );
}
