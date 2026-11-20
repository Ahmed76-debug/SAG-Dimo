import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Scale,
  Users,
  ListTodo,
  CalendarDays,
  FolderOpen,
  Archive,
  BookOpen,
  BarChart3,
  Award,
  UserCog,
  Settings as SettingsIcon,
  Database,
  Printer,
  Search,
  Bell,
  Monitor,
  Menu,
  Plus,
  LogOut,
  PanelRightClose,
  PanelRightOpen,
  X,
  Sparkles,
  Command,
  Pencil,
  PlayCircle,
  Palette,
  Check,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useApp } from "@/state/AppProvider";
import { Button, IconButton, Avatar, Badge } from "@/components/ui/primitives";
import { CommandPalette } from "./CommandPalette";
import { NotificationCenter } from "./NotificationCenter";
import type { Permission, ThemeMode } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/permissions";

type ThemeOpt = {
  id: ThemeMode;
  label: string;
  mode: "light" | "dark" | "system";
  colors?: { bg: string; surface: string; brand: string; accent: string; text: string };
};

const THEME_OPTIONS: ThemeOpt[] = [
  { id: "light", label: "فاتح (افتراضي)", mode: "light", colors: { bg: "#f8fafc", surface: "#ffffff", brand: "#8c6a3d", accent: "#2563eb", text: "#0f172a" } },
  { id: "light-sand", label: "فاتح رملي", mode: "light", colors: { bg: "#f6f1e8", surface: "#fffaf2", brand: "#b7791f", accent: "#0f766e", text: "#2b2116" } },
  { id: "light-mist", label: "فاتح ضبابي", mode: "light", colors: { bg: "#eef4ff", surface: "#ffffff", brand: "#2563eb", accent: "#0891b2", text: "#0f172a" } },
  { id: "dark", label: "داكن (افتراضي)", mode: "dark", colors: { bg: "#0b1220", surface: "#121a2b", brand: "#d4a574", accent: "#60a5fa", text: "#e8eef8" } },
  { id: "dark-midnight", label: "داكن ليلي", mode: "dark", colors: { bg: "#060816", surface: "#0f1428", brand: "#8b5cf6", accent: "#22d3ee", text: "#e8ebff" } },
  { id: "dark-emerald", label: "داكن زمردي", mode: "dark", colors: { bg: "#071311", surface: "#102220", brand: "#34d399", accent: "#14b8a6", text: "#e6fffb" } },
  { id: "system", label: "حسب النظام", mode: "system" },
];

function ThemeCard({ t, active, onPick }: { t: ThemeOpt; active: boolean; onPick: () => void }) {
  const c = t.colors || { bg: "#e5e7eb", surface: "#fff", brand: "#64748b", accent: "#94a3b8", text: "#111827" };
  return (
    <button
      type="button"
      onClick={onPick}
      title={t.label}
      aria-pressed={active}
      className={cn(
        "group relative w-full rounded-2xl border-2 bg-surface p-2.5 text-start transition-all",
        active
          ? "border-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
          : "border-line hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[var(--shadow-pop)]",
      )}
    >
      <div
        className="relative grid h-[74px] grid-cols-[22px_1fr] overflow-hidden rounded-xl border border-line/70"
        style={{ background: c.bg } as React.CSSProperties}
      >
        <div className="relative" style={{ background: c.brand }}>
          <span className="absolute inset-x-1.5 top-2 h-1.5 rounded bg-white/55" />
        </div>
        <div className="flex flex-col gap-1.5 p-2">
          <span className="h-2.5 rounded-md border border-black/10" style={{ background: c.surface }} />
          <span className="h-1.5 w-[70%] rounded border border-black/10" style={{ background: c.surface }} />
          <span className="h-1.5 w-[45%] rounded border border-black/10" style={{ background: c.surface }} />
          <span className="mt-auto flex gap-1">
            <i className="block size-3.5 rounded" style={{ background: c.brand }} />
            <i className="block size-3.5 rounded" style={{ background: c.accent }} />
            <i className="block size-3.5 rounded border border-black/10" style={{ background: c.surface }} />
          </span>
        </div>
        <span
          className={cn(
            "absolute end-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-accent text-white transition-all",
            active ? "scale-100 opacity-100" : "scale-75 opacity-0",
          )}
        >
          <Check className="size-3" />
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="truncate text-[13px] font-bold text-ink">{t.label}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
            active ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
          )}
        >
          {t.mode === "dark" ? "داكن" : t.mode === "light" ? "فاتح" : "تلقائي"}
        </span>
      </div>
    </button>
  );
}

function ThemeGalleryModal({ theme, onChange, onClose }: { theme: ThemeMode; onChange: (t: ThemeMode) => void; onClose: () => void }) {
  const lights = THEME_OPTIONS.filter((t) => t.mode === "light");
  const darks = THEME_OPTIONS.filter((t) => t.mode === "dark");
  const system = THEME_OPTIONS.filter((t) => t.mode === "system");
  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 my-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-pop)] animate-scale-in">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent"><Palette className="size-4" /></span>
            <div>
              <div className="text-[15px] font-bold text-ink">معرض الثيمات</div>
              <div className="text-[12px] text-muted">اختر المظهر المناسب — نفس نمط الثيمات المتعدد</div>
            </div>
          </div>
          <IconButton icon={X} label="إغلاق" size="sm" onClick={onClose} />
        </div>
        <div className="scroll-thin max-h-[70vh] space-y-6 overflow-y-auto p-5">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-amber-300 ring-4 ring-amber-100" />
              <h4 className="text-[14px] font-extrabold text-ink">الثيمات الفاتحة</h4>
              <span className="text-[11px] font-bold text-muted">{lights.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lights.map((t) => (
                <ThemeCard key={t.id} t={t} active={theme === t.id} onPick={() => { onChange(t.id); onClose(); }} />
              ))}
            </div>
          </section>
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-slate-700 ring-4 ring-slate-200 dark:ring-slate-800" />
              <h4 className="text-[14px] font-extrabold text-ink">الثيمات الداكنة</h4>
              <span className="text-[11px] font-bold text-muted">{darks.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {darks.map((t) => (
                <ThemeCard key={t.id} t={t} active={theme === t.id} onPick={() => { onChange(t.id); onClose(); }} />
              ))}
            </div>
          </section>
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Monitor className="size-4 text-muted" />
              <h4 className="text-[14px] font-extrabold text-ink">تلقائي</h4>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {system.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { onChange(t.id); onClose(); }}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-start transition-all",
                    theme === t.id ? "border-accent bg-accent-soft/40" : "border-line hover:border-accent/50 hover:bg-surface-2",
                  )}
                >
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-ink"><Monitor className="size-4" />{t.label}</span>
                  {theme === t.id && <Check className="size-4 text-accent" />}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ThemeMenu({ theme, onChange }: { theme: ThemeMode; onChange: (t: ThemeMode) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="معرض الثيمات"
        className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Palette className="size-4" />
        <span className="hidden max-w-[88px] truncate sm:inline">{THEME_OPTIONS.find((t) => t.id === theme)?.label ?? "المظهر"}</span>
      </button>
      {open && <ThemeGalleryModal theme={theme} onChange={onChange} onClose={() => setOpen(false)} />}
    </>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: typeof Scale;
  perm?: Permission;
  end?: boolean;
}

const NAV_MAIN: NavItem[] = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, perm: "dashboard.view", end: true },
  { to: "/matters", label: "القضايا والملفات", icon: Scale, perm: "matters.view" },
  { to: "/clients", label: "الموكلون", icon: Users, perm: "clients.view" },
  { to: "/tasks", label: "المهام", icon: ListTodo, perm: "tasks.view" },
  { to: "/calendar", label: "المواعيد والجلسات", icon: CalendarDays, perm: "events.view" },
  { to: "/documents", label: "الوثائق والأوراق", icon: FolderOpen, perm: "documents.view" },
];

const NAV_KNOWLEDGE: NavItem[] = [
  { to: "/library", label: "المكتبة القانونية", icon: BookOpen, perm: "library.view" },
  { to: "/archive", label: "الأرشيف", icon: Archive, perm: "archive.view" },
  { to: "/reports", label: "التقارير والتحليلات", icon: BarChart3, perm: "reports.view" },
  { to: "/print", label: "مركز الطباعة", icon: Printer, perm: "documents.print" },
  { to: "/tutorials", label: "فيديوهات الشرح", icon: PlayCircle },
];

const NAV_SYSTEM: NavItem[] = [
  { to: "/users", label: "المستخدمون والصلاحيات", icon: UserCog, perm: "users.view" },
  { to: "/data-tools", label: "أدوات البيانات", icon: Database, perm: "settings.edit" },
  { to: "/settings", label: "الإعدادات", icon: SettingsIcon, perm: "settings.edit" },
];

const NAV_PORTFOLIO: NavItem[] = [
  { to: "/portfolio", label: "عرض البورتفوليو العام", icon: Award },
  { to: "/portfolio/manage", label: "تحرير البورتفوليو", icon: Pencil, perm: "portfolio.edit" },
];

const MOBILE_NAV: NavItem[] = [
  { to: "/", label: "الرئيسية", icon: LayoutDashboard, end: true },
  { to: "/matters", label: "القضايا", icon: Scale },
  { to: "/tasks", label: "المهام", icon: ListTodo },
  { to: "/calendar", label: "المواعيد", icon: CalendarDays },
  { to: "/portfolio", label: "البورتفوليو", icon: Award },
];

export function AppShell() {
  const { user, can, logout, theme, setTheme, settings, updateSettings, unreadCount } = useApp();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(settings.sidebarCollapsed);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileNav(false);
    setUserMenu(false);
  }, [location.pathname]);

  const visible = (items: NavItem[]) => items.filter((i) => !i.perm || can(i.perm));

  const NavSection = ({
    items,
    label,
  }: {
    items: NavItem[];
    label?: string;
  }) => (
    <div className="space-y-1">
      {label && !collapsed && (
        <div className="px-3 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-faint">
          {label}
        </div>
      )}
      {visible(items).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200",
              isActive
                ? "bg-accent-soft text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_25%,transparent)]"
                : "text-ink-soft hover:bg-surface-2 hover:text-ink",
              collapsed && "justify-center px-0",
            )
          }
          title={collapsed ? item.label : undefined}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-accent" />
              )}
              <item.icon className="size-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-bg">
      {/* ------------------------------ الشريط الجانبي ------------------------------ */}
      <aside
        className={cn(
          "no-print sticky top-0 hidden h-screen shrink-0 flex-col border-e border-line bg-surface/80 backdrop-blur-xl transition-all duration-300 lg:flex",
          collapsed ? "w-[74px]" : "w-[258px]",
        )}
      >
        <div className={cn("flex items-center gap-3 px-4 py-4", collapsed && "justify-center px-2")}>
          <div className="logo-float relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-2 to-accent text-accent-ink shadow-lg">
            <Scale className="size-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate font-display text-[15px] font-bold text-ink">عدالة</div>
              <div className="truncate text-[10.5px] text-muted">إدارة أعمال المحاماة</div>
            </div>
          )}
          <IconButton
            icon={collapsed ? PanelRightOpen : PanelRightClose}
            label={collapsed ? "توسيع" : "طي"}
            size="xs"
            className="ms-auto"
            onClick={() => {
              setCollapsed((c) => !c);
              void updateSettings({ sidebarCollapsed: !collapsed });
            }}
          />
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto px-3 pb-4">
          <NavSection items={NAV_MAIN} />
          <NavSection items={NAV_KNOWLEDGE} label="المعرفة" />
          <NavSection items={NAV_PORTFOLIO} label="البورتفوليو" />
          <NavSection items={NAV_SYSTEM} label="النظام" />
        </div>

        {!collapsed && user && (
          <div className="border-t border-line p-3">
            <div className="flex items-center gap-2.5 rounded-xl bg-surface-2 p-2.5">
              <Avatar name={user.name} color={user.avatarColor} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-ink">{user.name}</div>
                <div className="truncate text-[11px] text-muted">{ROLE_LABELS[user.role]}</div>
              </div>
              <IconButton icon={LogOut} label="خروج" size="xs" onClick={logout} />
            </div>
          </div>
        )}
      </aside>

      {/* ------------------------------ المحتوى ------------------------------ */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
          <div className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
            <IconButton
              icon={Menu}
              label="القائمة"
              className="lg:hidden"
              onClick={() => setMobileNav(true)}
            />

            <button
              onClick={() => setPaletteOpen(true)}
              className="group flex h-10 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-start transition-colors hover:border-accent/40 sm:max-w-md"
            >
              <Search className="size-4 shrink-0 text-muted" />
              <span className="flex-1 truncate text-[13px] text-faint">بحث سريع… (Ctrl + K)</span>
              <kbd className="hidden items-center gap-1 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted sm:flex">
                <Command className="size-2.5" />K
              </kbd>
            </button>

            <div className="ms-auto flex items-center gap-1.5">
              <span className="hidden sm:inline-flex">
                <Button
                  size="sm"
                  variant="primary"
                  icon={Plus}
                  onClick={() => navigate("/matters?new=1")}
                >
                  قضية جديدة
                </Button>
              </span>

              <div className="relative">
                <IconButton
                  icon={Bell}
                  label="الإشعارات"
                  variant="subtle"
                  onClick={() => setNotifOpen((v) => !v)}
                />
                {unreadCount > 0 && (
                  <span className="absolute -end-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
                {notifOpen && <NotificationCenter onClose={() => setNotifOpen(false)} />}
              </div>

              <ThemeMenu theme={theme} onChange={(v) => void setTheme(v)} />

              <div className="relative">
                <button
                  onClick={() => setUserMenu((v) => !v)}
                  className="flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-surface-2"
                >
                  <Avatar name={user?.name ?? ""} color={user?.avatarColor} size={32} />
                </button>
                {userMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                    <div className="absolute end-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)] animate-scale-in">
                      <div className="border-b border-line p-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={user?.name ?? ""} color={user?.avatarColor} size={40} />
                          <div className="min-w-0">
                            <div className="truncate text-[13.5px] font-bold text-ink">{user?.name}</div>
                            <div className="truncate text-[11.5px] text-muted">{user?.title}</div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <Badge tone="accent">{user ? ROLE_LABELS[user.role] : ""}</Badge>
                          <Badge tone="muted">{user?.username}</Badge>
                        </div>
                      </div>
                      <div className="p-1.5">
                        <button
                          onClick={() => navigate("/portfolio")}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-ink-soft transition-colors hover:bg-surface-2"
                        >
                          <Award className="size-4" /> البورتفوليو العام
                        </button>
                        {can("portfolio.edit") && (
                          <button
                            onClick={() => navigate("/portfolio/manage")}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-ink-soft transition-colors hover:bg-surface-2"
                          >
                            <Pencil className="size-4" /> تحرير البورتفوليو
                          </button>
                        )}
                        {can("settings.edit") && (
                          <button
                            onClick={() => navigate("/settings")}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-ink-soft transition-colors hover:bg-surface-2"
                          >
                            <SettingsIcon className="size-4" /> الإعدادات
                          </button>
                        )}
                        <button
                          onClick={logout}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-danger transition-colors hover:bg-danger-soft"
                        >
                          <LogOut className="size-4" /> تسجيل الخروج
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 pb-24 lg:pb-8">
          <Outlet />
        </main>

        {/* شريط الجوال */}
        <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-5">
            {MOBILE_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition-colors",
                    isActive ? "text-accent" : "text-muted",
                  )
                }
              >
                <item.icon className="size-5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

      {/* درج الجوال */}
      {mobileNav && (
        <div className="no-print fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
          <div className="absolute inset-y-0 end-0 flex w-[82%] max-w-xs flex-col bg-surface shadow-[var(--shadow-pop)] animate-[slide-in-end_.28s_cubic-bezier(.22,1,.36,1)]">
            <div className="flex items-center gap-3 border-b border-line px-4 py-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-2 to-accent text-accent-ink">
                <Scale className="size-5" />
              </div>
              <div>
                <div className="font-display text-[15px] font-bold">عدالة</div>
                <div className="text-[10.5px] text-muted">إدارة أعمال المحاماة</div>
              </div>
              <IconButton icon={X} label="إغلاق" size="sm" className="ms-auto" onClick={() => setMobileNav(false)} />
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto px-3 py-3">
              <NavSection items={NAV_MAIN} />
              <NavSection items={NAV_KNOWLEDGE} label="المعرفة" />
              <NavSection items={NAV_PORTFOLIO} label="البورتفوليو" />
              <NavSection items={NAV_SYSTEM} label="النظام" />
            </div>
            <div className="border-t border-line p-3">
              <Button
                block
                variant="primary"
                icon={Sparkles}
                onClick={() => navigate("/matters?new=1")}
              >
                قضية جديدة
              </Button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-line bg-surface/40">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start gap-4">
          {icon}
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold leading-tight text-ink sm:text-[26px]">{title}</h1>
            {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children && <div className="mt-5">{children}</div>}
      </div>
    </div>
  );
}

export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6", className)}>{children}</div>
  );
}
