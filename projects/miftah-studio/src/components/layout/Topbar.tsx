import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronDown, ChevronLeft, Inbox, KeyRound, Menu as MenuIcon, Search, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import { Avatar } from '@/components/ui/primitives';
import { Menu } from '@/components/ui/overlays';
import { ThemePicker } from './ThemePicker';
import { navLabel } from './Sidebar';
import { useAuth } from '@/lib/auth';
import { cn, formatNumber } from '@/lib/utils';

interface Alerts { pending: number; expiring: number }

export function Topbar({ onOpenMobile, onOpenPalette, alerts }: {
  onOpenMobile: () => void; onOpenPalette: () => void; alerts: Alerts;
}) {
  const { user, logout, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  const total = alerts.pending + alerts.expiring;

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-bg/65 px-4 backdrop-blur-xl sm:gap-3 sm:px-6">
      <button
        onClick={onOpenMobile}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface-2/60 text-muted transition hover:text-ink lg:hidden"
        aria-label="القائمة"
      >
        <MenuIcon size={17} />
      </button>

      <div className="flex min-w-0 items-center gap-1.5 text-[11.5px]">
        <span className="hidden text-muted sm:inline">مفتاح</span>
        <ChevronLeft size={12} className="hidden text-muted/60 sm:inline" />
        <span className="truncate font-medium text-soft">{navLabel(location.pathname)}</span>
      </div>

      <div className="flex-1" />

      <button
        onClick={onOpenPalette}
        className="group hidden h-9 items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 text-muted transition hover:border-line-strong hover:text-soft sm:flex sm:w-48 lg:w-60"
      >
        <Search size={14} />
        <span className="text-[11.5px]">بحث سريع…</span>
        <kbd className="ms-auto rounded-md border border-line bg-surface px-1.5 py-0.5 text-[9.5px] text-muted">Ctrl K</kbd>
      </button>
      <button
        onClick={onOpenPalette}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface-2/60 text-muted sm:hidden"
        aria-label="بحث"
      >
        <Search size={16} />
      </button>

      <ThemePicker compact />

      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className={cn(
            'relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface-2/60 text-muted transition hover:border-line-strong hover:text-ink',
            notifOpen && 'border-line-strong text-ink'
          )}
          aria-label={total ? `التنبيهات — ${formatNumber(total)} جديد` : 'التنبيهات'}
        >
          <Bell size={16} />
          {total > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[9px] font-bold text-black">
              {formatNumber(total)}
            </span>
          )}
        </button>
        <AnimatePresence>
          {notifOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="absolute end-0 top-full z-[70] mt-2 w-[300px] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
            >
              <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                <p className="text-[12px] font-semibold text-ink">التنبيهات</p>
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">{formatNumber(total)} جديد</span>
              </div>
              <div className="p-1.5">
                {can('requests.view') && (
                  <Link
                    to="/requests"
                    onClick={() => setNotifOpen(false)}
                    className="flex items-start gap-2.5 rounded-xl px-2.5 py-2.5 transition hover:bg-surface-2"
                  >
                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10 text-warning"><Inbox size={15} /></span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium text-ink">طلبات تفعيل بانتظار المراجعة</span>
                      <span className="mt-0.5 block text-[10.5px] text-muted">{alerts.pending ? `${formatNumber(alerts.pending)} طلب يحتاج إجراءً` : 'لا توجد طلبات معلقة'}</span>
                    </span>
                  </Link>
                )}
                {can('licenses.view') && (
                  <Link
                    to="/licenses?status=active&expiring=45"
                    onClick={() => setNotifOpen(false)}
                    className="flex items-start gap-2.5 rounded-xl px-2.5 py-2.5 transition hover:bg-surface-2"
                  >
                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary"><KeyRound size={15} /></span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium text-ink">تراخيص تقترب من الانتهاء</span>
                      <span className="mt-0.5 block text-[10.5px] text-muted">{alerts.expiring ? `${formatNumber(alerts.expiring)} ترخيص خلال ٤٥ يوماً` : 'كل التراخيص بخير'}</span>
                    </span>
                  </Link>
                )}
                {can('backups.view') && (
                  <Link
                    to="/backups"
                    onClick={() => setNotifOpen(false)}
                    className="flex items-start gap-2.5 rounded-xl px-2.5 py-2.5 transition hover:bg-surface-2"
                  >
                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-info/10 text-info"><ShieldCheck size={15} /></span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium text-ink">سلامة البيانات</span>
                      <span className="mt-0.5 block text-[10.5px] text-muted">راجع النسخ الاحتياطية التلقائية</span>
                    </span>
                  </Link>
                )}
                {!total && (
                  <div className="flex flex-col items-center gap-2 px-4 py-7 text-center">
                    <Sparkles size={20} className="text-muted" />
                    <p className="text-[11.5px] text-muted">كل شيء تحت السيطرة</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Menu
        triggerClassName="h-9 w-auto gap-2 rounded-xl border border-line bg-surface-2/60 px-1.5 hover:bg-surface-2"
        trigger={(
          <span className="flex items-center gap-2">
            <Avatar name={user?.name || '؟'} color={user?.avatarColor} size="sm" />
            <span className="hidden min-w-0 flex-col items-start md:flex">
              <span className="max-w-[120px] truncate text-[11.5px] font-semibold leading-tight text-ink">{user?.name}</span>
              <span className="text-[9.5px] leading-tight text-muted">{user?.role.name}</span>
            </span>
            <ChevronDown size={12} className="hidden text-muted md:block" />
          </span>
        )}
        items={[
          {
            label: 'الإعدادات الشخصية', icon: <Settings size={14} />,
            onClick: () => navigate('/settings?tab=security'),
          },
          {
            label: 'الفريق والصلاحيات', icon: <ShieldCheck size={14} />,
            onClick: () => navigate('/team'),
            disabled: !can('users.view'),
          },
          { label: 'تسجيل الخروج', onClick: () => logout(), danger: true, separator: true },
        ]}
      />
    </header>
  );
}
