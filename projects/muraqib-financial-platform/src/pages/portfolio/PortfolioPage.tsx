import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from "@/lib/liveQuery"
import {
  Award, Briefcase, Building2, Mail, MapPin, Phone, ShieldCheck, Sparkles,
  Star, Users, Languages, Sun, Moon, ArrowLeft, ArrowRight, CheckCircle2, BarChart3,
} from 'lucide-react'
import { db } from '@/lib/db'
import { useI18nStore } from '@/stores/i18n.store'
import { useThemeStore } from '@/stores/theme.store'
import { useOfficeProfile } from '@/components/CompanySelector'
import { formatNumber } from '@/lib/format'

const SERVICE_KEYS = ['portfolio.service1', 'portfolio.service2', 'portfolio.service3', 'portfolio.service4', 'portfolio.service5', 'portfolio.service6']
const CERT_KEYS = ['portfolio.cert1', 'portfolio.cert2', 'portfolio.cert3', 'portfolio.cert4']
const CAP_KEYS = ['portfolio.cap1', 'portfolio.cap2', 'portfolio.cap3', 'portfolio.cap4']

export function PortfolioPage() {
  const { t } = useTranslation()
  const { language, toggleLanguage } = useI18nStore()
  const { theme, toggleTheme } = useThemeStore()
  const profile = useOfficeProfile()
  const companies = useLiveQuery(() => db.companies.toArray(), []) || []
  const archiveCount = useLiveQuery(() => db.archive.count(), []) || 0
  const approvedCount = useLiveQuery(() => db.trialBalanceImports.where({ status: 'approved' }).count(), []) || 0

  const officeName = profile ? (language === 'ar' ? profile.nameAr : profile.nameEn) : t('app.name')
  const ownerName = profile ? (language === 'ar' ? profile.ownerNameAr : profile.ownerNameEn) : ''
  const ownerTitle = profile ? (language === 'ar' ? profile.titleAr : profile.titleEn) : ''
  const arrow = language === 'ar' ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />

  const stats = [
    { value: '+25', label: t('portfolio.statsYears') },
    { value: companies.length ? formatNumber(companies.length, language, 0) : '+6', label: t('portfolio.statsCompanies') },
    { value: archiveCount ? formatNumber(archiveCount, language, 0) : '+12', label: t('portfolio.statsReports') },
    { value: '+11', label: t('portfolio.statsSectors') },
  ]

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-info text-[11px] font-black text-white shadow-card">
              C.F.C
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">{officeName}</p>
              <p className="truncate text-[10px] text-text-secondary">{t('app.tagline')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-secondary hover:bg-surface-2"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={toggleLanguage}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-2"
            >
              <Languages className="h-4 w-4" /> {language === 'ar' ? 'EN' : 'AR'}
            </button>
            <Link
              to="/login"
              className="ms-1 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-info px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-card hover:brightness-110"
            >
              {t('portfolio.enter')} {arrow}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="hero-grid absolute inset-0 opacity-50" />
          <div className="absolute -top-24 end-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-24 start-0 h-72 w-72 rounded-full bg-info/15 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-20">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                <Sparkles className="h-4 w-4" /> {t('portfolio.eyebrow')}
              </span>
              <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl xl:text-6xl">{t('portfolio.title')}</h1>
              <p className="max-w-2xl text-base leading-7 text-text-secondary sm:text-lg">{t('portfolio.subtitle')}</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-info px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:brightness-110"
                >
                  <Briefcase className="h-4 w-4" /> {t('portfolio.enter')}
                </Link>
                <a href="#portfolio" className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-6 py-3 text-sm font-semibold hover:bg-surface-2">
                  <Building2 className="h-4 w-4" /> {t('portfolio.explore')}
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-text-secondary">
                {CERT_KEYS.slice(0, 3).map((key) => (
                  <span key={key} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> {t(key)}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-[2rem] border border-border bg-surface shadow-2xl">
                <div className="relative h-[280px] overflow-hidden bg-gradient-to-br from-primary/10 via-surface to-info/10">
                  <img src="/images/cfc-portrait.jpg" alt={ownerName} className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-5 text-white">
                    <p className="text-lg font-bold">{ownerName}</p>
                    <p className="text-xs text-white/80">{ownerTitle}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-px bg-border">
                  {stats.map((stat) => (
                    <div key={stat.label} className="bg-surface p-4 text-center">
                      <p className="text-2xl font-extrabold text-primary">{stat.value}</p>
                      <p className="mt-0.5 text-[10px] leading-4 text-text-secondary">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-4 -end-4 hidden rounded-2xl border border-accent/30 bg-surface px-4 py-3 shadow-xl sm:block">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-xs font-bold">{t('reports.approvedTb')}</p>
                    <p className="text-[10px] text-text-secondary">{formatNumber(approvedCount, language, 0)} · {t('portfolio.trust')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">{t('portfolio.about')}</p>
              <h2 className="mt-2 text-2xl font-bold">{officeName}</h2>
              <p className="mt-3 text-sm leading-7 text-text-secondary">{t('portfolio.aboutText1')}</p>
              <p className="mt-2 text-sm leading-7 text-text-secondary">{t('portfolio.aboutText2')}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {profile?.phone && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-xs">
                    <Phone className="h-4 w-4 text-primary" /> {profile.phone}
                  </span>
                )}
                {profile?.email && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-xs">
                    <Mail className="h-4 w-4 text-primary" /> {profile.email}
                  </span>
                )}
                {(profile?.addressAr || profile?.addressEn) && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-xs">
                    <MapPin className="h-4 w-4 text-primary" /> {language === 'ar' ? profile?.addressAr : profile?.addressEn}
                  </span>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {SERVICE_KEYS.map((key, i) => (
                <div key={key} className="rounded-2xl border border-border bg-surface-2/40 p-4 transition hover:border-primary/30 hover:bg-surface">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {i % 2 === 0 ? <BarChart3 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  </div>
                  <p className="text-xs font-semibold leading-5">{t(key)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="portfolio" className="mx-auto max-w-7xl px-4 py-14 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">{t('portfolio.capabilities')}</p>
              <h2 className="mt-1 text-2xl font-bold">{t('dashboard.portfolioTitle')}</h2>
            </div>
            <span className="text-xs text-text-secondary">{t('portfolio.ctaText')}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {CAP_KEYS.map((key, i) => (
              <div key={key} className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-soft">
                <div className="absolute -end-6 -top-6 h-20 w-20 rounded-full bg-primary/5" />
                <p className="text-3xl font-black text-primary/20">0{i + 1}</p>
                <p className="mt-1 text-sm font-semibold leading-6">{t(key)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-surface-2/40">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">{t('portfolio.certifications')}</p>
              <div className="mt-4 space-y-2.5">
                {CERT_KEYS.map((key) => (
                  <div key={key} className="flex items-start gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 text-xs">
                    <Award className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> {t(key)}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">{t('portfolio.contact')}</p>
              <h2 className="mt-2 text-2xl font-bold">{t('portfolio.ctaTitle')}</h2>
              <p className="mt-2 text-sm leading-7 text-text-secondary">{t('portfolio.ctaText')}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-info px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card"
                >
                  <Users className="h-4 w-4" /> {t('auth.signIn')}
                </Link>
                <span className="inline-flex items-center gap-1.5 rounded-2xl border border-border px-4 py-3 text-xs text-text-secondary">
                  <Star className="h-4 w-4 text-warning" /> {t('portfolio.trust')}
                </span>
              </div>
              <div className="mt-5 grid gap-2 border-t border-border pt-4 text-[11px] text-text-secondary sm:grid-cols-2">
                <span>{t('portfolio.statsYears')}: <strong className="text-text">+25</strong></span>
                <span>{t('portfolio.statsSectors')}: <strong className="text-text">+11</strong></span>
                <span>{t('dashboard.statsCompanies')}: <strong className="text-text">{formatNumber(companies.length, language, 0)}</strong></span>
                <span>{t('dashboard.statsArchive')}: <strong className="text-text">{formatNumber(archiveCount, language, 0)}</strong></span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-[11px] text-text-secondary lg:px-8">
          <span>© {new Date().getFullYear()} {officeName} · {t('app.rights')}</span>
          <span className="font-semibold tracking-wide">C.F.C · {t('licenses.version')}</span>
        </div>
      </footer>
    </div>
  )
}

