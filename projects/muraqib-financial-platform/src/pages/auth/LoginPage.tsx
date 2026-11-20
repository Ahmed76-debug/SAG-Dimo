import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Languages, Lock, ShieldCheck, Sparkles, Sun, Moon, UserRound, KeyRound, Eye, EyeOff } from 'lucide-react'
import { login, isPortalRole } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { useI18nStore } from '@/stores/i18n.store'
import { useThemeStore } from '@/stores/theme.store'
import { useOfficeProfile } from '@/components/CompanySelector'
import { Button, Field, Spinner, inputClass, toast, ToastHost } from '@/components/ui'

const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'admin123', role: 'auth.adminDesc', tone: 'border-primary/30 bg-primary/5' },
  { username: 'reviewer', password: 'reviewer123', role: 'auth.reviewerDesc', tone: 'border-accent/30 bg-accent/5' },
  { username: 'accountant', password: 'accountant123', role: 'auth.accountantDesc', tone: 'border-info/30 bg-info/5' },
  { username: 'ext_gh', password: 'ext123', role: 'auth.clientDesc', tone: 'border-warning/30 bg-warning/5' },
  { username: 'viewer', password: 'viewer123', role: 'auth.viewerDesc', tone: 'border-border bg-surface-2/60' },
]

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { language, toggleLanguage } = useI18nStore()
  const { theme, toggleTheme } = useThemeStore()
  const setUser = useAuthStore((s) => s.setUser)
  const currentUser = useAuthStore((s) => s.user)
  const profile = useOfficeProfile()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!username.trim() || !password.trim()) return
    setBusy(true)
    setError('')
    try {
      const user = await login(username, password)
      setUser(user)
      toast(`${t('auth.signedInAs')}: ${language === 'ar' ? user.fullNameAr : user.fullNameEn}`)
      navigate(isPortalRole(user.role) ? '/portal' : '/dashboard')
    } catch {
      setError(t('auth.invalid'))
    } finally {
      setBusy(false)
    }
  }

  const fill = (u: string, p: string) => {
    setUsername(u)
    setPassword(p)
    setError('')
  }

  const officeName = profile ? (language === 'ar' ? profile.nameAr : profile.nameEn) : t('app.name')
  const officeTitle = profile ? (language === 'ar' ? profile.titleAr : profile.titleEn) : t('app.tagline')

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-text">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgb(var(--color-primary)/0.14),transparent_45%),radial-gradient(circle_at_85%_80%,rgb(var(--color-info)/0.14),transparent_45%)]" />
      <div className="hero-grid absolute inset-0 opacity-40" />

      <div className="no-print absolute top-4 end-4 z-20 flex gap-2">
        <button
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface/80 text-text-secondary backdrop-blur hover:bg-surface-2"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          onClick={toggleLanguage}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-border bg-surface/80 px-3 text-xs font-semibold text-text-secondary backdrop-blur hover:bg-surface-2"
        >
          <Languages className="h-4 w-4" /> {language === 'ar' ? 'EN' : 'AR'}
        </button>
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-[1440px] items-center gap-8 px-4 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-10">
        <section className="hidden flex-col gap-8 lg:flex">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-4 w-4" /> C.F.C · Certified Financial Controller
          </div>
          <div>
            <h1 className="max-w-[620px] text-4xl font-extrabold leading-[1.15] tracking-tight xl:text-5xl">{t('portfolio.title')}</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-text-secondary">{t('auth.signInSubtitle')}</p>
          </div>
          <div className="grid max-w-xl grid-cols-3 gap-3">
            {[
              { value: '6', label: t('portfolio.statsCompanies') },
              { value: '12', label: t('portfolio.statsReports') },
              { value: '5', label: t('portfolio.statsSectors') },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur">
                <p className="text-2xl font-extrabold text-primary">{stat.value}</p>
                <p className="mt-1 text-[11px] leading-4 text-text-secondary">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="grid max-w-xl gap-2.5">
            {[t('portfolio.cap1'), t('portfolio.cap2'), t('portfolio.cap3'), t('portfolio.cap4')].map((cap) => (
              <div key={cap} className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-surface/50 px-3 py-2 text-xs leading-5 text-text-secondary">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {cap}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-text-secondary">
            <span className="font-bold uppercase tracking-[0.25em] text-primary">C.F.C</span>
            <span>·</span>
            <span>{t('portfolio.trust')}</span>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[480px]">
          <div className="rounded-3xl border border-border bg-surface/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-info text-sm font-black text-white shadow-card animate-[logoFloatY_3.2s_ease-in-out_infinite]">
                C.F.C
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{officeName}</p>
                <p className="truncate text-[11px] font-semibold text-text">{profile ? (language === 'ar' ? profile.ownerNameAr : profile.ownerNameEn) : officeName}</p>
                <p className="truncate text-[11px] text-text-secondary">{officeTitle}</p>
              </div>
            </div>

            <h2 className="text-xl font-bold">{t('auth.signIn')}</h2>
            <p className="mt-1 text-xs leading-5 text-text-secondary">{t('auth.signInSubtitle')}</p>

            <form onSubmit={submit} className="mt-5 space-y-3">
              <Field label={t('auth.username')} required>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-text-secondary/70" />
                  <input
                    className={`${inputClass} ps-9`}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="admin"
                  />
                </div>
              </Field>
              <Field label={t('auth.password')} required>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-text-secondary/70" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`${inputClass} ps-9 pe-10`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute top-1/2 end-3 -translate-y-1/2 text-text-secondary/70 hover:text-text" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              {error && <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>}
              <Button type="submit" variant="primary" className="w-full py-3" disabled={busy || !username || !password}>
                {busy ? <Spinner /> : <Lock className="h-4 w-4" />}
                {busy ? t('auth.loggingIn') : t('auth.login')}
              </Button>
            </form>

            {currentUser && (
              <div className="mt-3 rounded-xl border border-accent/25 bg-accent/5 p-3 text-xs">
                <p className="font-semibold">{t('auth.signedInAs')}</p>
                <p className="mt-0.5 text-text-secondary">{currentUser.fullNameAr} · {t(`roles.${currentUser.role}`)}</p>
                <button
                  onClick={() => navigate(isPortalRole(currentUser.role) ? '/portal' : '/dashboard')}
                  className="mt-2 inline-flex items-center gap-1 font-semibold text-primary"
                >
                  {t('common.open')} {language === 'ar' ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}

            <div className="mt-5 border-t border-border pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">{t('auth.demoTitle')}</p>
              <p className="mt-0.5 text-[11px] text-text-secondary">{t('auth.demoHint')}</p>
              <div className="mt-2.5 grid gap-1.5">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.username}
                    type="button"
                    onClick={() => fill(account.username, account.password)}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start transition hover:brightness-105 ${account.tone}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-bold">{account.username} / {account.password}</span>
                      <span className="block truncate text-[10px] text-text-secondary">{t(account.role)}</span>
                    </span>
                    <span className="rounded-lg bg-surface px-2 py-1 text-[10px] font-bold text-text-secondary">{t('common.choose')}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-4 text-[10px] leading-4 text-text-secondary">{t('auth.sessionNote')}</p>
            <Link to="/" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              {language === 'ar' ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />} {t('nav.portfolio')}
            </Link>
          </div>
        </section>
      </div>
      <ToastHost />
    </div>
  )
}
