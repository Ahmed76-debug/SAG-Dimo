import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, KeyRound, Boxes, UsersRound, MonitorSmartphone, Inbox, ShieldCheck,
  DatabaseBackup, History, Settings2, PanelRightClose, PanelRightOpen, LogOut, X, CircleDot,
  PlayCircle, Database,
} from 'lucide-react';
import { Brand } from '@/components/Brand';
import { Avatar, Tip } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: string;
  badge?: number;
  end?: boolean;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'الرئيسية',
    items: [
      { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard, permission: 'dashboard.view', end: true },
    ],
  },
  {
    label: 'إدارة التراخيص',
    items: [
      { to: '/licenses', label: 'التراخيص', icon: KeyRound, permission: 'licenses.view' },
      { to: '/products', label: 'المنتجات', icon: Boxes, permission: 'products.view' },
      { to: '/customers', label: 'العملاء', icon: UsersRound, permission: 'customers.view' },
      { to: '/activations', label: 'التفعيلات', icon: MonitorSmartphone, permission: 'activations.view' },
      { to: '/requests', label: 'طلبات التفعيل', icon: Inbox, permission: 'requests.view' },
    ],
  },
  {
    label: 'النظام',
    items: [
      { to: '/team', label: 'الفريق والصلاحيات', icon: ShieldCheck, permission: 'users.view' },
      { to: '/backups', label: 'النسخ الاحتياطي', icon: DatabaseBackup, permission: 'backups.view' },
      { to: '/audit', label: 'سجل النشاط', icon: History, permission: 'audit.view' },
      { to: '/data-tools', label: 'أدوات البيانات', icon: Database, permission: 'settings.manage' },
      { to: '/settings', label: 'الإعدادات', icon: Settings2, permission: 'settings.view' },
    ],
  },
  {
    label: 'المساعدة',
    items: [
      { to: '/tutorials', label: 'فيديوهات الشرح', icon: PlayCircle, permission: 'tutorials.view' },
    ],
  },
];

export function navLabel(pathname: string) {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.end ? pathname === item.to : pathname.startsWith(item.to)) return item.label;
    }
  }
  return 'مفتاح';
}

function NavContent({ collapsed, onNavigate, onClose, pending }: {
  collapsed: boolean; onNavigate?: () => void; onClose?: () => void; pending: number;
}) {
  const { user, logout, can } = useAuth();
  const location = useLocation();

  return (
    <>
      <div className={cn('flex items-center', collapsed ? 'justify-center px-3' : 'justify-between px-4', 'h-16 shrink-0')}>
        {collapsed ? <BrandMarkMobile /> : <Brand />}
        {onClose ? (
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="إغلاق القائمة">
            <X size={17} />
          </button>
        ) : null}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-1 no-scrollbar">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => item.permission === 'tutorials.view' || can(item.permission));
          if (!items.length) return null;
          return (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <p className="mb-1.5 px-2.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted/80">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
                  const Icon = item.icon;
                  const badge = item.to === '/requests' ? pending : 0;
                  const link = (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      className={cn(
                        'group relative flex items-center gap-2.5 rounded-xl text-[12.5px] font-medium transition-all duration-200',
                        collapsed ? 'mx-auto h-10 w-10 justify-center' : 'h-10 px-2.5',
                        active
                          ? 'bg-primary-soft text-primary'
                          : 'text-muted hover:bg-surface-2 hover:text-soft'
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId={onClose ? 'nav-active-mobile' : 'nav-active'}
                          className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-primary"
                          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        />
                      )}
                      <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                      {!collapsed && badge > 0 && (
                        <span className="numeric rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">{badge}</span>
                      )}
                      {collapsed && badge > 0 && (
                        <span className="absolute end-1 top-1 h-1.5 w-1.5 rounded-full bg-warning" />
                      )}
                    </NavLink>
                  );
                  return collapsed ? <Tip key={item.to} label={item.label}>{link}</Tip> : link;
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className={cn('shrink-0 border-t border-line', collapsed ? 'px-2 py-3' : 'p-3')}>
        {!collapsed && (
          <div className="mb-2.5 overflow-hidden rounded-xl border border-line bg-surface-2/60">
            <div className="relative px-3 py-2.5">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="flex items-center gap-2">
                <CircleDot size={13} className="text-success" />
                <p className="text-[11px] font-medium text-soft">الخادم يعمل</p>
                <span className="ms-auto text-[9.5px] text-muted">v2.0</span>
              </div>
              <p className="mt-0.5 text-[9.5px] text-muted">تشفير Ed25519 · SQLite</p>
            </div>
          </div>
        )}
        <div className={cn('flex items-center gap-2 rounded-xl', collapsed ? 'justify-center' : 'bg-surface-2/60 border border-line p-2')}>
          <Avatar name={user?.name || '؟'} color={user?.avatarColor} size="sm" />
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11.5px] font-semibold text-ink">{user?.name}</p>
                <p className="truncate text-[9.5px] text-muted">{user?.role.name}</p>
              </div>
              <button onClick={() => logout()} className="rounded-lg p-1.5 text-muted transition hover:bg-danger/10 hover:text-danger" title="تسجيل الخروج">
                <LogOut size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function BrandMarkMobile() {
  return <Brand compact />;
}

export function Sidebar({ collapsed, pending, onToggle }: { collapsed: boolean; pending: number; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        'sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-e border-line bg-surface/60 backdrop-blur-xl transition-[width] duration-300 lg:flex',
        collapsed ? 'w-[76px]' : 'w-[264px]'
      )}
    >
      <NavContent collapsed={collapsed} pending={pending} />
      <button
        onClick={onToggle}
        className="absolute -end-3 top-[72px] z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-sm transition hover:text-ink lg:flex"
        title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
      >
        {collapsed ? <PanelRightOpen size={12} /> : <PanelRightClose size={12} />}
      </button>
    </aside>
  );
}

export function MobileSidebar({ open, onClose, pending }: { open: boolean; onClose: () => void; pending: number }) {
  return (
    <div className={cn('fixed inset-0 z-[90] lg:hidden', open ? 'pointer-events-auto' : 'pointer-events-none')}>
      <div
        onClick={onClose}
        className={cn('absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
      />
      <aside
        className={cn(
          'absolute inset-y-0 end-0 flex w-[280px] max-w-[86vw] flex-col border-s border-line bg-surface transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ boxShadow: 'var(--shadow-pop)' }}
      >
        <NavContent collapsed={false} pending={pending} onClose={onClose} onNavigate={onClose} />
      </aside>
    </div>
  );
}
