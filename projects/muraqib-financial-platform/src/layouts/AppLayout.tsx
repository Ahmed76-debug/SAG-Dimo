import { useState } from 'react'
import { Outlet, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Building2, BookOpen, FileSpreadsheet, FileUp, ShieldCheck,
  BriefcaseBusiness, SlidersHorizontal, Scale, BarChart3, TrendingUp, Wallet,
  LineChart, PieChart, CalendarClock, Archive, Users, Settings, DatabaseBackup, Database,
  Menu, X, Languages, LogOut, ChevronRight, PlayCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ThemePicker } from '@/components/ThemePicker'
import { useI18nStore } from '@/stores/i18n.store'
import { useAuthStore } from '@/stores/auth.store'
import { can, isPortalRole } from '@/services/auth.service'
import { useOfficeProfile } from '@/components/CompanySelector'
import { ToastHost } from '@/components/ui'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  permission: string
}

interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'workspace',
    label: 'nav.workspace',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'nav.dashboard', permission: 'reports' },
      { to: '/companies', icon: Building2, label: 'nav.companies', permission: 'companies' },
      { to: '/accounts', icon: BookOpen, label: 'nav.accounts', permission: 'accounts' },
      { to: '/trialbalance/generator', icon: FileSpreadsheet, label: 'nav.tbGenerator', permission: 'tb' },
      { to: '/trialbalance/import', icon: FileUp, label: 'nav.tbImport', permission: 'tb' },
      { to: '/trialbalance/review', icon: ShieldCheck, label: 'nav.tbReview', permission: 'review' },
      { to: '/portal', icon: BriefcaseBusiness, label: 'nav.portal', permission: 'portal' },
      { to: '/adjustments', icon: SlidersHorizontal, label: 'nav.adjustments', permission: 'adjustments' },
    ],
  },
  {
    key: 'statements',
    label: 'nav.statements',
    items: [
      { to: '/reports/trial', icon: Scale, label: 'nav.trialBalance', permission: 'reports' },
      { to: '/reports/income', icon: BarChart3, label: 'nav.income', permission: 'reports' },
      { to: '/reports/balance', icon: PieChart, label: 'nav.balance', permission: 'reports' },
      { to: '/reports/equity', icon: TrendingUp, label: 'nav.equity', permission: 'reports' },
      { to: '/reports/cashflow', icon: Wallet, label: 'nav.cashflow', permission: 'reports' },
      { to: '/reports/position', icon: LineChart, label: 'nav.position', permission: 'reports' },
      { to: '/analysis', icon: TrendingUp, label: 'nav.analysis', permission: 'analysis' },
      { to: '/budget', icon: BarChart3, label: 'nav.budget', permission: 'budget' },
    ],
  },
  {
    key: 'office',
    label: 'nav.office',
    items: [
      { to: '/archive', icon: Archive, label: 'nav.archive', permission: 'archive' },
      { to: '/reminders', icon: CalendarClock, label: 'nav.reminders', permission: 'reminders' },
      { to: '/users', icon: Users, label: 'nav.users', permission: 'admin' },
      { to: '/settings', icon: Settings, label: 'nav.settings', permission: 'admin' },
      { to: '/data-tools', icon: Database, label: 'nav.dataTools', permission: 'admin' },
      { to: '/backup', icon: DatabaseBackup, label: 'nav.backup', permission: 'admin' },
    ],
  },
  {
    key: 'help',
    label: 'nav.help',
    items: [
      { to: '/tutorials', icon: PlayCircle, label: 'nav.tutorials', permission: 'tutorials' },
    ],
  },
]

const PORTAL_GROUP: NavGroup = {
  key: 'portal',
  label: 'nav.workspace',
  items: [{ to: '/portal', icon: BriefcaseBusiness, label: 'nav.portal', permission: 'portal' }],
}

function findLabel(pathname: string, t: (key: string) => string) {
  const flat = [...NAV_GROUPS.flatMap((g) => g.items), ...PORTAL_GROUP.items]
  const item = flat.find((i) => pathname === i.to || (i.to !== '/dashboard' && pathname.startsWith(i.to)))
  if (pathname === '/dashboard') return t('nav.dashboard')
  return item ? t(item.label) : t('app.shortName')
}

export function AppLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { language, toggleLanguage } = useI18nStore()
  const { user, logout } = useAuthStore()
  const profile = useOfficeProfile()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!user) return <Navigate to="/login" replace />
  const portalOnly = isPortalRole(user.role)

  if (portalOnly && !location.pathname.startsWith('/portal')) {
    return <Navigate to="/portal" replace />
  }

  const groups = portalOnly
    ? PORTAL_GROUP.items.length ? [PORTAL_GROUP] : []
    : NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((i) => {
          if (i.permission === 'admin') return user.role === 'admin'
          if (i.permission === 'portal') return false
          if (i.permission === 'tutorials') return true
          return can(user.role, i.permission)
        }),
      })).filter((g) => g.items.length > 0)

  const userName = language === 'ar' ? user.fullNameAr : user.fullNameEn
  const officeName = profile ? (language === 'ar' ? profile.nameAr : profile.nameEn) : t('app.name')
  const officeOwner = profile ? (language === 'ar' ? profile.ownerNameAr : profile.ownerNameEn) : ''
  const officeTitle = profile ? (language === 'ar' ? profile.titleAr : profile.titleEn) : t('app.tagline')

  const navList = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
      {groups.map((group) => (
        <div key={group.key}>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-text-secondary/80">{t(group.label)}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon
              const active = location.pathname === item.to
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-semibold leading-6 transition-all duration-300',
                    active
                      ? 'nav-active font-semibold'
                      : 'text-text-secondary hover:-translate-y-0.5 hover:bg-surface-2 hover:text-text',
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1 truncate">{t(item.label)}</span>
                  <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition', active ? 'opacity-80' : 'opacity-0 group-hover:opacity-50')} />
                </NavLink>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  const identity = (
    <div className="border-b border-border px-4 py-5">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-primary/40 to-info/40 blur-sm" />
          <div className="logo-float relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-info to-accent text-xs font-black text-white ring-1 ring-primary/30">
            C.F.C
            <span className="absolute bottom-0.5 end-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface" />
          </div>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-text">{officeName}</p>
          {officeOwner && <p className="mt-1 truncate text-[11px] font-semibold leading-tight text-text">{officeOwner}</p>}
          <p className="mt-0.5 truncate text-[10px] leading-4 text-text-secondary">{officeTitle}</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-text">
      <div className="pointer-events-none absolute -start-32 top-10 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -end-28 top-1/3 h-72 w-72 rounded-full bg-info/10 blur-3xl" />
      <div className="relative mx-auto flex min-h-screen max-w-[1700px]">
        <aside className="no-print sticky top-0 hidden h-screen w-[276px] shrink-0 flex-col border-e border-primary/10 bg-surface/80 shadow-[-18px_0_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl lg:flex">
          {identity}
          {navList}
          <div className="border-t border-border px-4 py-4">
            <div className="flex items-center gap-2">
              <ThemePicker compact />
              <button
                onClick={toggleLanguage}
                title={language === 'ar' ? t('actions.switchToEn') : t('actions.switchToAr')}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-2 hover:text-text"
              >
                <Languages className="h-4 w-4" />
                {language === 'ar' ? 'EN' : 'AR'}
              </button>
              <button
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
                title={t('auth.logout')}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:bg-danger/10 hover:text-danger"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-[10px] text-text-secondary">© {new Date().getFullYear()} {t('app.shortName')} · C.F.C</p>
          </div>
        </aside>

        {mobileOpen && (
          <div className="no-print fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 start-0 flex w-[290px] flex-col bg-surface shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-sm font-bold">{t('app.name')}</span>
                <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-text-secondary hover:bg-surface-2">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {identity}
              {navList}
              <div className="border-t border-border px-4 py-3">
                <button
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-danger"
                >
                  <LogOut className="h-4 w-4" /> {t('auth.logout')}
                </button>
              </div>
            </aside>
          </div>
        )}

        <main className="relative flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-surface/85 px-4 py-3 backdrop-blur-xl lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-secondary lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{t('app.brand')} · {t('app.shortName')}</p>
                <h2 className="truncate text-base font-bold leading-tight">{findLabel(location.pathname, t)}</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemePicker compact className="lg:hidden" />
              <button
                onClick={toggleLanguage}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text lg:hidden"
              >
                <Languages className="h-4 w-4" /> {language === 'ar' ? 'EN' : 'AR'}
              </button>
              <div className="hidden items-center gap-2 rounded-2xl border border-accent/20 bg-accent/5 px-3 py-1.5 xl:flex">
                <ShieldCheck className="h-4 w-4 text-accent" />
                <div>
                  <p className="text-[10px] font-bold text-accent">SQLite</p>
                  <p className="text-[10px] text-text-secondary">{t('app.localSecure')}</p>
                </div>
              </div>
              <div className="hidden items-center gap-2.5 rounded-2xl border border-border bg-surface-2/60 px-3 py-1.5 md:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-info to-accent text-[10px] font-black text-white">
                  {userName.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="max-w-[220px] truncate text-xs font-semibold leading-tight">{userName}</p>
                  <p className="text-[10px] text-text-secondary">{t(`roles.${user.role}`)}</p>
                </div>
              </div>
            </div>
          </header>

          <div key={location.pathname} className="page-enter flex-1 px-4 py-5 lg:px-8 lg:py-7">
            <Outlet />
          </div>

          <footer className="no-print border-t border-border px-4 py-3 text-[11px] text-text-secondary lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>© {new Date().getFullYear()} {officeName} · {t('app.rights')}</span>
              <span className="font-semibold tracking-wide text-text-secondary/80">C.F.C · {t('portfolio.trust')}</span>
            </div>
          </footer>
        </main>
      </div>
      <ToastHost />
    </div>
  )
}
