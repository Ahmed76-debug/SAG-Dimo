import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from "@/lib/liveQuery"
import {
  BarChart3, FileText, PieChart, TrendingUp, Wallet, LineChart, Scale,
  ShieldCheck, ArrowUpRight, AlertTriangle, FileSpreadsheet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReportType } from '@/types'
import { REPORT_TYPES } from '@/types'
import { computeStatements, getReportModel } from '@/lib/finance'
import { buildCompanyDataset } from '@/services/tb.service'
import { formatMoney, formatNumber, pick } from '@/lib/format'
import { useI18nStore } from '@/stores/i18n.store'
import {
  useCompanies, useCompanyYears, useOfficeProfile, usePersistedSelection, readStoredCompany,
  CompanySelect, YearSelect,
} from '@/components/CompanySelector'
import { ReportView } from '@/components/ReportView'
import {
  PageHeader, Card, Button, EmptyState, LoadingBlock, StatCard, Badge, SectionCard,
} from '@/components/ui'

const REPORT_META: Record<ReportType, { nav: string; icon: LucideIcon; tone: 'primary' | 'success' | 'warning' | 'info' | 'danger' | 'muted' }> = {
  income: { nav: 'nav.income', icon: BarChart3, tone: 'primary' },
  balance: { nav: 'nav.balance', icon: PieChart, tone: 'info' },
  equity: { nav: 'nav.equity', icon: TrendingUp, tone: 'success' },
  cashflow: { nav: 'nav.cashflow', icon: Wallet, tone: 'warning' },
  position: { nav: 'nav.position', icon: LineChart, tone: 'primary' },
  trial: { nav: 'nav.trialBalance', icon: Scale, tone: 'muted' },
}

function isReportType(value: string | undefined): value is ReportType {
  return !!value && (REPORT_TYPES as readonly string[]).includes(value)
}

export function ReportPage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const { type } = useParams<{ type: string }>()
  const [params] = useSearchParams()
  const lang = language
  const reportType: ReportType = isReportType(type) ? type : 'income'
  const meta = REPORT_META[reportType]
  const Icon = meta.icon

  const companies = useCompanies() || []
  const [companyId, setCompanyId] = useState<number | undefined>(() => {
    const raw = params.get('company')
    return raw ? Number(raw) : readStoredCompany()
  })
  const years = useCompanyYears(companyId) || []
  const [year, setYear] = useState<string>(params.get('year') || String(new Date().getFullYear()))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId && companies.length) setCompanyId(companies[0].id)
  }, [companies, companyId])

  useEffect(() => {
    if (years.length && !years.includes(year)) setYear(years[0])
  }, [years, year])

  usePersistedSelection(companyId, setCompanyId)

  const dataset = useLiveQuery(async () => {
    if (!companyId || !year) return null
    return buildCompanyDataset(companyId, year).catch(() => null)
  }, [companyId, year])

  useEffect(() => {
    setLoading(!!companyId && dataset === undefined)
  }, [companyId, dataset])

  const financials = useMemo(() => (dataset ? computeStatements(dataset) : null), [dataset])
  const model = useMemo(() => (financials ? getReportModel(reportType, financials) : null), [financials, reportType])
  const profile = useOfficeProfile()
  const company = companies.find((c) => c.id === companyId)
  const insights = useMemo(() => {
    if (!financials) return undefined
    if (reportType === 'income') return financials.analysis.income
    if (reportType === 'balance') return financials.analysis.balance
    if (reportType === 'cashflow') return financials.analysis.cashflow
    if (reportType === 'equity') return financials.analysis.equity
    if (reportType === 'position') return financials.analysis.position
    return undefined
  }, [financials, reportType])

  const kpis = useMemo(() => {
    if (!financials) return []
    const cur = financials.meta.currency
    if (reportType === 'income') {
      return [
        { label: t('reports.netRevenue'), value: formatMoney(financials.income.netRevenue, cur, lang) },
        { label: t('reports.grossProfit'), value: formatMoney(financials.income.grossProfit, cur, lang) },
        { label: t('reports.netIncome'), value: formatMoney(financials.income.netIncome, cur, lang) },
        { label: t('analysis.score'), value: `${formatNumber(financials.analysis.score, lang, 0)}/100` },
      ]
    }
    if (reportType === 'balance' || reportType === 'position') {
      return [
        { label: t('reports.totalAssets'), value: formatMoney(financials.balance.totalAssets, cur, lang) },
        { label: t('reports.totalLiabilities'), value: formatMoney(financials.balance.totalLiabilities, cur, lang) },
        { label: t('reports.totalEquity'), value: formatMoney(financials.balance.totalEquity, cur, lang) },
        { label: t('reports.health'), value: `${formatNumber(financials.analysis.score, lang, 0)}/100` },
      ]
    }
    if (reportType === 'cashflow') {
      return [
        { label: t('reports.operatingCash'), value: formatMoney(financials.cashflow.netOperating, cur, lang) },
        { label: `${t('common.total')} ${t('nav.cashflow')}`, value: formatMoney(financials.cashflow.netChange, cur, lang) },
        { label: t('reports.closingCash'), value: formatMoney(financials.cashflow.closingCash, cur, lang) },
        { label: t('reports.health'), value: `${formatNumber(financials.analysis.score, lang, 0)}/100` },
      ]
    }
    if (reportType === 'equity') {
      return [
        { label: t('reports.totalEquity'), value: formatMoney(financials.balance.totalEquity, cur, lang) },
        { label: t('reports.netIncome'), value: formatMoney(financials.income.netIncome, cur, lang) },
        { label: t('analysis.equityGrowth'), value: `${formatNumber(financials.analysis.ratios.find((r) => r.key === 'roe')?.value || 0, lang, 1)}%` },
        { label: t('reports.health'), value: `${formatNumber(financials.analysis.score, lang, 0)}/100` },
      ]
    }
    return [
      { label: t('common.debit'), value: formatMoney(financials.totalDebit, cur, lang) },
      { label: t('common.credit'), value: formatMoney(financials.totalCredit, cur, lang) },
      { label: t('common.difference'), value: formatMoney(financials.totalDebit - financials.totalCredit, cur, lang) },
      { label: t('common.status'), value: financials.balanced ? t('status.balanced') : t('status.unbalanced') },
    ]
  }, [financials, reportType, lang, t])

  const missing = !companyId || dataset === null

  return (
    <div>
      <PageHeader
        eyebrow={`C.F.C · ${t('nav.statements')}`}
        icon={<Icon className="h-6 w-6" />}
        title={t(meta.nav)}
        subtitle={t('reports.subtitle')}
        actions={
          <>
            <Link to="/analysis"><Button icon={<TrendingUp className="h-4 w-4" />}>{t('nav.analysis')}</Button></Link>
            <Link to="/trialbalance/review"><Button icon={<ShieldCheck className="h-4 w-4" />}>{t('nav.tbReview')}</Button></Link>
          </>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-4">
          <CompanySelect companies={companies} value={companyId} onChange={setCompanyId} label={t('common.company')} className="md:col-span-2" />
          <YearSelect years={years} value={year} onChange={setYear} label={t('common.year')} />
          <div className="flex items-end gap-2">
            <Button
              className="w-full"
              icon={<FileText className="h-4 w-4" />}
              onClick={() => setLoading(false)}
              disabled={!companyId}
            >
              {t('reports.generate')}
            </Button>
          </div>
        </div>
      </Card>

      {loading && companyId ? (
        <Card><LoadingBlock text={t('common.loading')} /></Card>
      ) : missing || !financials || !model || !company ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-6 w-6" />}
          title={t('reports.noApproved')}
          text={t('reports.noApprovedHint')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/trialbalance/import"><Button variant="primary">{t('tb.goImport')}</Button></Link>
              <Link to="/trialbalance/generator"><Button>{t('tb.goGenerator')}</Button></Link>
            </div>
          }
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <StatCard key={kpi.label} label={kpi.label} value={kpi.value} tone={meta.tone} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">{t('reports.approvedTb')}</Badge>
            <Badge tone={financials.balanced ? 'success' : 'danger'}>
              {financials.balanced ? t('status.balanced') : t('status.unbalanced')}
            </Badge>
            {financials.meta.approvedBy && <Badge tone="muted">{t('common.approvedBy')}: {financials.meta.approvedBy}</Badge>}
            {financials.meta.priorYear && <Badge tone="info">{t('reports.priorYear')}: {financials.meta.priorYear}</Badge>}
            <Link to={`/analysis?company=${companyId}&year=${year}`} className="ms-auto inline-flex items-center gap-1 text-xs font-semibold text-primary">
              {t('reports.analysis')} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {!financials.balanced && (
            <SectionCard className="border-warning/30 bg-warning/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-semibold">{t('status.unbalanced')}</p>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    {pick(
                      `يوجد فرق في ميزان المراجعة قدره ${formatMoney(financials.totalDebit - financials.totalCredit, financials.meta.currency, 'ar')}، يلزم تسويته قبل الاعتماد النهائي.`,
                      `The trial balance is out of balance by ${formatMoney(financials.totalDebit - financials.totalCredit, financials.meta.currency, 'en')}; rectify it before final approval.`,
                      lang,
                    )}
                  </p>
                </div>
              </div>
            </SectionCard>
          )}

          <ReportView
            model={model}
            meta={{
              companyNameAr: financials.meta.companyNameAr,
              companyNameEn: financials.meta.companyNameEn,
              year: financials.meta.year,
              periodStart: financials.meta.periodStart,
              periodEnd: financials.meta.periodEnd,
              currency: financials.meta.currency,
              approvedBy: financials.meta.approvedBy,
              approvedAt: financials.meta.approvedAt,
            }}
            profile={profile}
            elementId={`report-${reportType}`}
            insights={insights}
          />
        </div>
      )}
    </div>
  )
}

