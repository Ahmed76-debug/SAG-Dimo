import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from "@/lib/liveQuery"
import {
  Building2, FileSpreadsheet, CalendarClock, Archive, Activity, Plus, ShieldCheck,
  ArrowUpRight, Clock3, CheckCircle2, AlertCircle, TrendingUp, DatabaseBackup, Users,
} from 'lucide-react'
import { db } from '@/lib/db'
import { LEGAL_FORMS } from '@/types'
import { buildCompanyDataset } from '@/services/tb.service'
import { computeStatements } from '@/lib/finance'
import { formatMoney, formatNumber, formatDate, pick, daysBetween, todayISO } from '@/lib/format'
import { PageHeader, StatCard, Card, SectionCard, Badge, EmptyState, Button, Progress } from '@/components/ui'
import { useI18nStore } from '@/stores/i18n.store'
import { useAuthStore } from '@/stores/auth.store'

export function DashboardPage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const user = useAuthStore((s) => s.user)
  const lang = language

  const companies = useLiveQuery(() => db.companies.orderBy('code').toArray(), []) || []
  const pending = useLiveQuery(async () => {
    const rows = await db.trialBalanceImports.where({ status: 'pending_approval' }).toArray()
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, []) || []
  const reminders = useLiveQuery(async () => {
    const rows = await db.reminders.toArray()
    return rows.filter((r) => r.status !== 'cancelled' && r.status !== 'done').sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6)
  }, []) || []
  const archiveCount = useLiveQuery(() => db.archive.count(), []) || 0
  const logs = useLiveQuery(async () => (await db.auditLogs.toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8), []) || []

  const snapshots = useLiveQuery(async () => {
    const approved = await db.trialBalanceImports.where({ status: 'approved' }).toArray()
    const result: Array<{
      companyId: number
      year: string
      netIncome: number
      assets: number
      health: number
      grade: string
    }> = []
    for (const company of companies) {
      const years = approved
        .filter((i) => i.companyId === company.id)
        .map((i) => i.fiscalYear)
        .sort((a, b) => b.localeCompare(a))
      if (!years.length) continue
      try {
        const dataset = await buildCompanyDataset(company.id!, years[0])
        const fs = computeStatements(dataset)
        result.push({
          companyId: company.id!,
          year: years[0],
          netIncome: fs.income.netIncome,
          assets: fs.balance.totalAssets,
          health: fs.analysis.score,
          grade: lang === 'ar' ? fs.analysis.gradeAr : fs.analysis.gradeEn,
        })
      } catch {
        /* ignore unavailable historical dataset */
      }
    }
    return result
  }, [companies, lang]) || []

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies])
  const upcoming = reminders.filter((r) => daysBetween(todayISO(), r.dueDate) <= 30)

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Workspace"
        icon={<Activity className="h-6 w-6" />}
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={
          <>
            <Link to="/companies"><Button icon={<Plus className="h-4 w-4" />}>{t('dashboard.quick1')}</Button></Link>
            <Link to="/trialbalance/generator"><Button variant="primary" icon={<FileSpreadsheet className="h-4 w-4" />}>{t('dashboard.quick2')}</Button></Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('dashboard.statsCompanies')} value={formatNumber(companies.length, lang, 0)} hint={`${formatNumber(companies.filter((c) => c.status === 'active').length, lang, 0)} ${t('status.active')}`} icon={<Building2 className="h-5 w-5" />} />
        <StatCard label={t('dashboard.statsPending')} value={formatNumber(pending.length, lang, 0)} hint={t('dashboard.pendingSubtitle')} icon={<ShieldCheck className="h-5 w-5" />} tone="warning" />
        <StatCard label={t('dashboard.statsReminders')} value={formatNumber(upcoming.length, lang, 0)} hint={t('dashboard.remindersSubtitle')} icon={<CalendarClock className="h-5 w-5" />} tone="info" />
        <StatCard label={t('dashboard.statsArchive')} value={formatNumber(archiveCount, lang, 0)} hint={`${t('nav.archive')} · ${t('reports.approvedTb')}`} icon={<Archive className="h-5 w-5" />} tone="success" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard
          title={t('dashboard.pendingTitle')}
          subtitle={t('dashboard.pendingSubtitle')}
          action={<Link to="/trialbalance/review" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">{t('review.title')} <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
          bodyClassName="p-0"
        >
          {pending.length === 0 ? (
            <div className="p-5"><EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title={t('dashboard.noPending')} /></div>
          ) : (
            <div className="divide-y divide-border">
              {pending.map((item) => {
                const company = companyMap.get(item.companyId)
                return (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{company ? (lang === 'ar' ? company.nameAr : company.nameEn) : '—'}</p>
                      <p className="mt-0.5 text-[11px] text-text-secondary">
                        {item.fiscalYear} · {item.lineCount} {t('tb.lineCount')} · {formatDate(item.createdAt, lang)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={item.isBalanced ? 'success' : 'danger'}>{item.isBalanced ? t('status.balanced') : t('status.unbalanced')}</Badge>
                      <Link to={`/trialbalance/review?id=${item.id}`} className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-surface-2">
                        {t('actions.review')}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={t('dashboard.remindersTitle')}
          subtitle={t('dashboard.remindersSubtitle')}
          action={<Link to="/reminders" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">{t('nav.reminders')} <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
          bodyClassName="p-0"
        >
          {upcoming.length === 0 ? (
            <div className="p-5"><EmptyState icon={<CalendarClock className="h-5 w-5" />} title={t('dashboard.noReminders')} /></div>
          ) : (
            <div className="divide-y divide-border">
              {upcoming.slice(0, 5).map((reminder) => {
                const days = daysBetween(todayISO(), reminder.dueDate)
                const company = reminder.companyId ? companyMap.get(reminder.companyId) : undefined
                return (
                  <div key={reminder.id} className="flex items-start gap-3 px-5 py-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${days < 0 ? 'bg-danger/10 text-danger' : days <= 2 ? 'bg-warning/10 text-warning' : 'bg-info/10 text-info'}`}>
                      <Clock3 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{pick(reminder.titleAr, reminder.titleEn, lang)}</p>
                      <p className="mt-0.5 text-[10px] text-text-secondary">
                        {company ? (lang === 'ar' ? company.nameAr : company.nameEn) : t('nav.office')} · {formatDate(reminder.dueDate, lang)}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold ${days < 0 ? 'text-danger' : days <= 2 ? 'text-warning' : 'text-text-secondary'}`}>
                      {days < 0 ? t('reminders.overdue', { days: Math.abs(days) }) : t('reminders.daysLeft', { days })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        className="mt-5"
        title={t('dashboard.portfolioTitle')}
        subtitle={t('dashboard.portfolioSubtitle')}
        action={<Link to="/companies" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">{t('nav.companies')} <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => {
            const snapshot = snapshots.find((s) => s.companyId === company.id)
            return (
              <Link
                key={company.id}
                to={`/reports/balance?company=${company.id}${snapshot ? `&year=${snapshot.year}` : ''}`}
                className="group rounded-2xl border border-border bg-surface-2/30 p-4 transition hover:border-primary/30 hover:bg-surface"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold group-hover:text-primary">{lang === 'ar' ? company.nameAr : company.nameEn}</p>
                    <p className="mt-0.5 text-[10px] text-text-secondary">{company.code} · {(lang === 'ar' ? LEGAL_FORMS.find((f) => f.value === company.legalForm)?.labelAr : LEGAL_FORMS.find((f) => f.value === company.legalForm)?.labelEn)} · {company.baseCurrency}</p>
                  </div>
                  <Badge tone={company.status === 'active' ? 'success' : 'muted'}>{t(`status.${company.status}`)}</Badge>
                </div>
                {snapshot ? (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-lg bg-surface px-2.5 py-1.5">
                        <p className="text-text-secondary">{t('dashboard.netIncome')}</p>
                        <p className={`mt-0.5 font-bold tabular-nums ${snapshot.netIncome < 0 ? 'text-danger' : 'text-accent'}`}>{formatMoney(snapshot.netIncome, company.baseCurrency, lang)}</p>
                      </div>
                      <div className="rounded-lg bg-surface px-2.5 py-1.5">
                        <p className="text-text-secondary">{t('dashboard.totalAssets')}</p>
                        <p className="mt-0.5 font-bold tabular-nums">{formatMoney(snapshot.assets, company.baseCurrency, lang)}</p>
                      </div>
                    </div>
                    <div className="mt-2.5">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-text-secondary">
                        <span>{t('dashboard.health')} · {snapshot.grade}</span>
                        <span className="font-bold text-text">{formatNumber(snapshot.health, lang, 0)}/100</span>
                      </div>
                      <Progress value={snapshot.health} tone={snapshot.health >= 70 ? 'success' : snapshot.health >= 45 ? 'warning' : 'danger'} />
                    </div>
                    <p className="mt-2 text-[10px] text-text-secondary">{t('dashboard.lastApproved')}: <strong className="text-text">{snapshot.year}</strong></p>
                  </>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-border bg-surface px-3 py-3 text-[11px] text-text-secondary">{t('dashboard.noApproved')}</div>
                )}
              </Link>
            )
          })}
          {companies.length === 0 && <div className="md:col-span-2 xl:col-span-3"><EmptyState icon={<Building2 className="h-5 w-5" />} title={t('companies.empty')} action={<Link to="/companies"><Button variant="primary" icon={<Plus className="h-4 w-4" />}>{t('companies.add')}</Button></Link>} /></div>}
        </div>
      </SectionCard>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <SectionCard title={t('dashboard.quickActions')} bodyClassName="p-3">
          <div className="grid gap-2">
            <QuickLink to="/companies" icon={<Building2 className="h-4 w-4" />} label={t('dashboard.quick1')} />
            <QuickLink to="/trialbalance/generator" icon={<FileSpreadsheet className="h-4 w-4" />} label={t('dashboard.quick2')} />
            <QuickLink to="/trialbalance/review" icon={<ShieldCheck className="h-4 w-4" />} label={t('dashboard.quick3')} />
            <QuickLink to="/backup" icon={<DatabaseBackup className="h-4 w-4" />} label={t('dashboard.quick4')} />
            {user?.role === 'admin' && <QuickLink to="/users" icon={<Users className="h-4 w-4" />} label={t('nav.users')} />}
          </div>
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-[10px] leading-4 text-text-secondary">
            <p className="font-bold text-primary">{t('reports.approvedTb')}</p>
            <p className="mt-0.5">{t('dashboard.pendingSubtitle')}</p>
          </div>
        </SectionCard>

        <SectionCard title={t('dashboard.activityTitle')} subtitle={t('dashboard.activitySubtitle')} bodyClassName="p-0">
          {logs.length === 0 ? (
            <div className="p-5"><EmptyState icon={<TrendingUp className="h-5 w-5" />} title={t('dashboard.noActivity')} /></div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-secondary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-5">{pick(log.detailsAr, log.detailsEn, lang)}</p>
                    <p className="text-[10px] text-text-secondary">{log.userName || t('common.none')} · {formatDate(log.createdAt, lang)}</p>
                  </div>
                  <Badge tone="muted">{log.action}</Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {pending.some((p) => !p.isBalanced) && (
        <Card className="mt-5 border-warning/30 bg-warning/5">
          <div className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <p className="text-xs leading-5 text-text-secondary">{t('tb.unbalancedWarning', { amount: '0', currency: companies[0]?.baseCurrency || 'EGP' })}</p>
          </div>
        </Card>
      )}
    </div>
  )
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-text-secondary transition hover:border-primary/30 hover:bg-surface-2 hover:text-text">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <span className="flex-1">{label}</span>
      <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  )
}

