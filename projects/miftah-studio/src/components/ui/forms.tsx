import { useRef, useState, type KeyboardEvent } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, PRODUCT_ICONS, ProductIcon } from './primitives';

/* ------------------------------- TagInput ------------------------------ */
export function TagInput({ value, onChange, placeholder = 'أضف ميزة ثم اضغط Enter…', suggestions = [], max = 30 }: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  max?: number;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const parts = raw.split(/[,،\n]/).map((p) => p.trim()).filter(Boolean);
    const next = [...value];
    for (const part of parts) {
      if (next.length >= max) break;
      if (!next.some((item) => item.toLowerCase() === part.toLowerCase())) next.push(part);
    }
    if (next.length !== value.length) onChange(next);
    setDraft('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === '،') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8);

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-2 py-1.5 focus-within:border-primary"
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2 py-1 text-[11px] font-medium text-primary">
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(value.filter((v) => v !== tag)); }}
              className="rounded p-0.5 hover:bg-primary/15"
              aria-label={`إزالة ${tag}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? '' : placeholder}
          aria-label="إضافة ميزة"
          className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-[12px] text-ink outline-none placeholder:text-muted/70"
        />
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {unused.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted transition hover:border-line-strong hover:text-soft"
            >
              <Plus size={9} /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ ColorPicker ---------------------------- */
const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#f59e0b',
  '#eab308', '#84cc16', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6',
  '#0ea5e9', '#64748b', '#a855f7', '#ef4444',
];

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn('flex h-7 w-7 items-center justify-center rounded-lg border transition hover:scale-110', value === color ? 'border-ink/40' : 'border-transparent')}
            style={{ background: color }}
            aria-label={color}
          >
            {value === color && <Check size={13} className="text-white" strokeWidth={3} />}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="h-8 w-8 shrink-0 rounded-lg border border-line" style={{ background: value }} />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 font-mono text-[11px]" dir="ltr" maxLength={7} aria-label="قيمة اللون" />
      </div>
    </div>
  );
}

/* ------------------------------- IconPicker ---------------------------- */
export function IconPicker({ value, color, onChange }: { value: string; color: string; onChange: (icon: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRODUCT_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onChange(icon)}
          className={cn(
            'rounded-xl border p-1 transition hover:bg-surface-2',
            value === icon ? 'border-primary bg-primary-soft' : 'border-line'
          )}
          title={icon}
          aria-label={`أيقونة ${icon}`}
        >
          <ProductIcon icon={icon} color={value === icon ? color : '#8b91b5'} size="sm" />
        </button>
      ))}
    </div>
  );
}
