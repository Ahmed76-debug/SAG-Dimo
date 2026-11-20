import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Boxes, CornerDownLeft, DatabaseBackup, KeyRound, Loader2, MonitorSmartphone,
  Plus, Search, UsersRound, Command,
} from 'lucide-react';
import { NAV_GROUPS } from './Sidebar';
import { ProductIcon } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDebounced } from '@/lib/hooks';
import type { Customer, License, Paginated, Product } from '@/lib/types';
import { cn, formatMoney } from '@/lib/utils';

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 280);
  const [results, setResults] = useState<{ licenses: License[]; customers: Customer[]; products: Product[] }>({ licenses: [], customers: [], products: [] });
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults({ licenses: [], customers: [], products: [] });
    setActive(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || debounced.trim().length < 2) {
      setResults({ licenses: [], customers: [], products: [] });
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const q = debounced.trim();
    Promise.allSettled([
      can('licenses.view') ? api<Paginated<License>>('/licenses', { query: { q, limit: 4 } }) : Promise.resolve(null),
      can('customers.view') ? api<{ items: Customer[] }>('/customers', { query: { q } }) : Promise.resolve(null),
      can('products.view') ? api<{ items: Product[] }>('/products', { query: { q } }) : Promise.resolve(null),
    ]).then(([lic, cus, prod]) => {
      if (!alive) return;
      setResults({
        licenses: lic.status === 'fulfilled' && lic.value ? lic.value.items.slice(0, 4) : [],
        customers: cus.status === 'fulfilled' && cus.value ? cus.value.items.slice(0, 3) : [],
        products: prod.status === 'fulfilled' && prod.value ? prod.value.items.slice(0, 3) : [],
      });
      setSearching(false);
    });
    return () => { alive = false; };
  }, [debounced, open, can]);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  const items = useMemo<PaletteItem[]>(() => {
    const navItems: PaletteItem[] = [];
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (!can(item.permission)) continue;
        const Icon = item.icon;
        navItems.push({
          id: `nav-${item.to}`,
          group: 'الانتقال السريع',
          label: item.label,
          icon: <Icon size={15} />,
          onSelect: () => go(item.to),
        });
      }
    }

    const actions: PaletteItem[] = [];
    if (can('licenses.create')) {
      actions.push({
        id: 'action-new-license', group: 'إجراءات', label: 'توليد ترخيص جديد', hint: 'معالج الإصدار',
        icon: <Plus size={15} />, onSelect: () => go('/licenses?new=1'),
      });
    }
    if (can('products.manage')) {
      actions.push({
        id: 'action-new-product', group: 'إجراءات', label: 'إضافة منتج جديد', hint: 'كتالوج المنتجات',
        icon: <Boxes size={15} />, onSelect: () => go('/products?new=1'),
      });
    }
    if (can('customers.manage')) {
      actions.push({
        id: 'action-new-customer', group: 'إجراءات', label: 'إضافة عميل جديد', hint: 'سجل العملاء',
        icon: <UsersRound size={15} />, onSelect: () => go('/customers?new=1'),
      });
    }
    if (can('backups.manage')) {
      actions.push({
        id: 'action-backup', group: 'إجراءات', label: 'إنشاء نسخة احتياطية', hint: 'حماية البيانات',
        icon: <DatabaseBackup size={15} />, onSelect: () => go('/backups?new=1'),
      });
    }

    const found: PaletteItem[] = [];
    if (debounced.trim().length >= 2) {
      for (const license of results.licenses) {
        found.push({
          id: `lic-${license.id}`, group: 'التراخيص',
          label: license.product.name,
          hint: `${license.uid} · ${license.customer?.name || 'بدون عميل'}`,
          icon: <ProductIcon icon={license.product.icon} color={license.product.color} size="sm" className="h-7 w-7" />,
          onSelect: () => go(`/licenses?open=${license.id}`),
        });
      }
      for (const customer of results.customers) {
        found.push({
          id: `cus-${customer.id}`, group: 'العملاء',
          label: customer.name,
          hint: customer.company || customer.email || 'عميل',
          icon: <UsersRound size={15} />,
          onSelect: () => go(`/customers?open=${customer.id}`),
        });
      }
      for (const product of results.products) {
        found.push({
          id: `prod-${product.id}`, group: 'المنتجات',
          label: product.name,
          hint: `${product.code} · ${product.licenses ?? 0} ترخيص`,
          icon: <ProductIcon icon={product.icon} color={product.color} size="sm" className="h-7 w-7" />,
          onSelect: () => go(`/products?open=${product.id}`),
        });
      }
    }

    const seen = new Set<string>();
    const unique = [...found, ...navItems, ...actions].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    if (query.trim() && !found.length && !searching) {
      const q = query.trim().toLowerCase();
      return unique.filter((item) => `${item.label} ${item.hint || ''}`.toLowerCase().includes(q) || item.group === 'التراخيص');
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return unique.filter((item) => item.group === 'التراخيص' || item.group === 'العملاء' || item.group === 'المنتجات'
        || `${item.label} ${item.hint || ''}`.toLowerCase().includes(q));
    }
    return unique;
  }, [can, results, query, searching, debounced]);

  const groups = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    for (const item of items) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    }
    return [...map.entries()];
  }, [items]);

  const flat = useMemo(() => groups.flatMap(([, list]) => list), [groups]);

  useEffect(() => {
    setActive(0);
  }, [debounced, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(flat.length - 1, i + 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        flat[active]?.onSelect();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flat, active, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  let counter = -1;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-[10vh] sm:pt-[14vh]">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 backdrop-blur-[3px]"
            style={{ backgroundColor: 'color-mix(in oklab, var(--bg-deep) 70%, transparent)' }}
          />
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="relative z-10 w-full max-w-[620px] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
              {searching ? <Loader2 size={17} className="animate-spin text-primary" /> : <Search size={17} className="text-muted" />}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث عن ترخيص، عميل، منتج أو انتقل إلى…"
                className="h-6 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-muted/70"
              />
              <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[9.5px] text-muted">ESC</kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {groups.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <Command size={22} className="text-muted" />
                  <p className="text-[12px] text-muted">{searching ? 'جارٍ البحث…' : 'لا توجد نتائج مطابقة'}</p>
                </div>
              )}
              {groups.map(([group, list]) => (
                <div key={group} className="mb-1">
                  <p className="px-2.5 pb-1 pt-2 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted/80">{group}</p>
                  {list.map((item) => {
                    counter += 1;
                    const index = counter;
                    return (
                      <button
                        key={item.id}
                        data-index={index}
                        onMouseEnter={() => setActive(index)}
                        onClick={item.onSelect}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start transition-colors',
                          active === index ? 'bg-primary-soft text-primary' : 'text-soft hover:bg-surface-2'
                        )}
                      >
                        <span className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
                          active === index ? 'border-primary/25 bg-primary/10' : 'border-line bg-surface-2 text-muted'
                        )}>
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium">{item.label}</span>
                          {item.hint && <span className="mt-0.5 block truncate text-[10px] text-muted">{item.hint}</span>}
                        </span>
                        {active === index && <CornerDownLeft size={13} className="shrink-0 text-primary/70" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/40 px-4 py-2 text-[10px] text-muted">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><kbd className="rounded border border-line bg-surface px-1 py-0.5">↑</kbd><kbd className="rounded border border-line bg-surface px-1 py-0.5">↓</kbd> للتنقل</span>
                <span className="flex items-center gap-1"><kbd className="rounded border border-line bg-surface px-1 py-0.5">↵</kbd> للفتح</span>
              </div>
              <span className="hidden items-center gap-1 sm:flex"><KeyRound size={11} /> مفتاح ستوديو</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
