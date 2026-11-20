import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function PageHeader({ eyebrow, title, description, actions, className }: {
  eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn('flex flex-wrap items-end justify-between gap-4', className)}
    >
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium text-muted">{eyebrow}</div>}
        <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[26px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
