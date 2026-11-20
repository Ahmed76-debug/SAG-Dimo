import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from "@/lib/liveQuery"
import {
  BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Info, Download, Printer,
  Target, Percent, Activity, ArrowUpRight, FileSpreadsheet,
} from 'lucide-react'
import { buildCompanyDataset } from '@/services/tb.service'
import { computeStatements, type Insight, type RatioResult } from '@/lib/finance'
import { formatMoney, formatNumber, formatPercent, pick } from '@/lib/format'
import { exportElementToPdf, printElement } from '@/lib/exports'
import { useI18nStore } from '@/stores/i18n.store'
import {
  useCompanies, useCompanyYears, usePersistedSelection, readStoredCompany,
  CompanySelect, YearSelect,
} from '@/components/CompanySelector'
import {
  PageHeader, Card, Button, EmptyState, LoadingBlock, StatCard, Badge, SectionCard, Progress, toast,
} from '@/components/ui'

function ratioTone(status: RatioResult['status']) {
  return status === 'good' ? 'success' : status === 'warn' ? 'warning' : status === 'bad' ? 'danger' : 'muted'
}

function insightTone(tone: Insight['tone']) {
  return tone === 'positive' ? 'success' : tone === 'warning' ? 'warning' : tone === 'negative' ? 'danger' : 'muted'
}

export function AnalysisPage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const [params] = useSearchParams()
  const lang = language
  const companies = useCompanies() || []
  const [companyId, setCompanyId] = useState<number | undefined>(() => {
    const raw = params.get('company')
    return raw ? Number(raw) : readStoredCompany()
  })
  const years = useCompanyYears(companyId) || []
  const [year, setYear] = useState(params.get('year') || String(new Date().getFullYear()))
  usePersistedSelection(companyId, setCompanyId)

  useEffect(() => {
    if (!companyId && companies.length) setCompanyId(companies[0].id)
  }, [companies, companyId])

  useEffect(() => {
    if (years.length && !years.includes(year)) setYear(years[0])
  }, [years, year])

  const dataset = useLiveQuery(async () => {
    if (!companyId || !year) return null
    return buildCompanyDataset(companyId, year).catch(() => null)
  }, [companyId, year])
  const financials = useMemo(() => (dataset ? computeStatements(dataset) : null), [dataset])
  const company = companies.find((c) => c.id === companyId)

  const comparison = useMemo(() => {
    if (!financials) return []
    const items = [
      financials.income.revenueGrowth !== undefined
        ? { label: t('analysis.revenueGrowth'), value: financials.income.revenueGrowth }
        : undefined,
      financials.priorIncome ? { label: t('analysis.netIncomeGrowth'), value: financials.priorIncome.netIncome ? ((financials.income.netIncome - financials.priorIncome.netIncome) / Math.abs(financials.priorIncome.netIncome)) * 100 : 0 } : undefined,
      financials.priorBalance ? { label: t('analysis.equityGrowth'), value: financials.priorBalance.totalEquity ? ((financials.balance.totalEquity - financials.priorBalance.totalEquity) / Math.abs(financials.priorBalance.totalEquity)) * 100 : 0 } : undefined,
    ].filter((x): x is { label: string; value: number } => !!x)
    return items
  }, [financials, t])

  const statementInsights: Array<{ key: string; title: string; items: Insight[] }> = financials
    ? [
        { key: 'income', title: t('analysis.incomeAnalysis'), items: financials.analysis.income },
        { key: 'balance', title: t('analysis.balanceAnalysis'), items: financials.analysis.balance },
        { key: 'cashflow', title: t('analysis.cashAnalysis'), items: financials.analysis.cashflow },
        { key: 'equity', title: t('analysis.equityAnalysis'), items: financials.analysis.equity },
        { key: 'position', title: t('analysis.positionAnalysis'), items: financials.analysis.position },
      ]
    : []

  const exportPdf = async () => {
    try {
      await exportElementToPdf('analysis-report', `Financial-Analysis-${year}`, lang)
      toast(t('actions.exportPdf'))
    } catch {
      toast(t('reports.noElement'), 'error')
    }
  }

  if (!companyId) {
    return (
      <div>
        <PageHeader icon={<BarChart3 className="h-6 w-6" />} title={t('analysis.title')} subtitle={t('analysis.subtitle')} />
        <Card><LoadingBlock text={t('common.loading')} /></Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Financial intelligence"
        icon={<BarChart3 className="h-6 w-6" />}
        title={t('analysis.title')}
        subtitle={t('analysis.subtitle')}
        actions={
          <>
            <Button icon={<Download className="h-4 w-4" />} onClick={exportPdf} disabled={!financials}>{t('actions.exportPdf')}</Button>
            <Button icon={<Printer className="h-4 w-4" />} onClick={() => printElement('analysis-report')} disabled={!financials}>{t('actions.print')}</Button>
            <Link to={`/reports/income?company=${companyId}&year=${year}`}>
              <Button variant="primary" icon={<FileSpreadsheet className="h-4 w-4" />}>{t('reports.viewAll')}</Button>
            </Link>
          </>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <CompanySelect companies={companies} value={companyId} onChange={setCompanyId} label={t('common.company')} className="md:col-span-2" />
          <YearSelect years={years} value={year} onChange={setYear} label={t('common.year')} />
        </div>
      </Card>

      {!financials ? (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title={t('analysis.noData')}
          text={t('reports.noApprovedHint')}
          action={<Link to="/trialbalance/import"><Button variant="primary">{t('tb.goImport')}</Button></Link>}
        />
      ) : (
        <div id="analysis-report" className="space-y-5 rounded-2xl bg-bg">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">C.F.C · Financial analysis</p>
                <h2 className="mt-1 text-xl font-bold">{pick(company?.nameAr || '', company?.nameEn || '', lang)}</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {t('analysis.title')} · {t('common.year')} {year} · {financials.meta.currency} · {financials.meta.periodStart} — {financials.meta.periodEnd}
                </p>
                {financials.meta.approvedBy && <p className="mt-1 text-[11px] text-text-secondary">{t('common.approvedBy')}: {financials.meta.approvedBy}</p>}
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{t('analysis.score')}</p>
                <p className="mt-1 text-3xl font-black text-primary">{formatNumber(financials.analysis.score, lang, 0)}<span className="text-sm text-text-secondary">/100</span></p>
                <Badge tone={financials.analysis.score >= 70 ? 'success' : financials.analysis.score >= 45 ? 'warning' : 'danger'}>
                  {lang === 'ar' ? financials.analysis.gradeAr : financials.analysis.gradeEn}
                </Badge>
              </div>
            </div>
            <div className="mt-4"><Progress value={financials.analysis.score} tone={financials.analysis.score >= 70 ? 'success' : financials.analysis.score >= 45 ? 'warning' : 'danger'} /></div>
            <p className="mt-4 rounded-xl border border-border bg-surface-2/40 px-4 py-3 text-xs leading-6 text-text-secondary">
              {lang === 'ar' ? financials.analysis.summaryAr : financials.analysis.summaryEn}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t('reports.netRevenue')} value={formatMoney(financials.income.netRevenue, financials.meta.currency, lang)} icon={<TrendingUp className="h-5 w-5" />} />
            <StatCard label={t('reports.grossProfit')} value={formatMoney(financials.income.grossProfit, financials.meta.currency, lang)} hint={`${formatPercent(financials.analysis.ratios.find((r) => r.key === 'grossMargin')?.value, lang)}`} icon={<Percent className="h-5 w-5" />} tone="info" />
            <StatCard label={t('reports.netIncome')} value={formatMoney(financials.income.netIncome, financials.meta.currency, lang)} icon={<Target className="h-5 w-5" />} tone="success" />
            <StatCard label={t('reports.operatingCash')} value={formatMoney(financials.cashflow.netOperating, financials.meta.currency, lang)} icon={<Activity className="h-5 w-5" />} tone="warning" />
          </div>

          {comparison.length > 0 && (
            <SectionCard title={t('analysis.comparison')} subtitle={t('reports.priorYear')}>
              <div className="grid gap-3 md:grid-cols-3">
                {comparison.map((item) => (
                  <div key={item.label} className="rounded-xl border border-border bg-surface-2/30 p-4">
                    <p className="text-xs text-text-secondary">{item.label}</p>
                    <p className={`mt-1 text-2xl font-black ${item.value >= 0 ? 'text-accent' : 'text-danger'}`}>{item.value >= 0 ? '+' : ''}{formatPercent(item.value, lang)}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard
            title={t('analysis.ratios')}
            subtitle={t('analysis.subtitle')}
            action={<Link to={`/reports/position?company=${companyId}&year=${year}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">{t('nav.position')} <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2/60">
                    <th className="px-5 py-3 text-start text-xs font-bold">{t('analysis.ratio')}</th>
                    <th className="px-4 py-3 text-end text-xs font-bold">{t('analysis.value')}</th>
                    <th className="px-4 py-3 text-start text-xs font-bold">{t('analysis.benchmark')}</th>
                    <th className="px-4 py-3 text-start text-xs font-bold">{t('analysis.assessment')}</th>
                    <th className="px-5 py-3 text-start text-xs font-bold">{t('common.details')}</th>
                  </tr>
                </thead>
                <tbody>
                  {financials.analysis.ratios.map((ratio) => (
                    <tr key={ratio.key} className="border-t border-border/60">
                      <td className="px-5 py-3">
                        <p className="font-semibold">{lang === 'ar' ? ratio.labelAr : ratio.labelEn}</p>
                      </td>
                      <td className="px-4 py-3 text-end font-bold tabular-nums">{ratio.display}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{lang === 'ar' ? ratio.benchmarkAr : ratio.benchmarkEn}</td>
                      <td className="px-4 py-3"><Badge tone={ratioTone(ratio.status)}>{t(`analysis.${ratio.status}`)}</Badge></td>
                      <td className="max-w-md px-5 py-3 text-[11px] leading-5 text-text-secondary">{lang === 'ar' ? ratio.hintAr : ratio.hintEn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-2">
            {statementInsights.map((section) => (
              <SectionCard key={section.key} title={section.title}>
                <div className="space-y-2.5">
                  {section.items.map((insight, index) => (
                    <div key={index} className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-surface-2/20 px-3 py-2.5">
                      {insight.tone === 'positive' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> : insight.tone === 'negative' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> : insight.tone === 'warning' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />}
                      <p className="text-xs leading-5 text-text-secondary">{lang === 'ar' ? insight.ar : insight.en}</p>
                      <Badge tone={insightTone(insight.tone)} className="ms-auto shrink-0">{t(`analysis.${insight.tone}`)}</Badge>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-surface px-5 py-4 text-[10px] leading-5 text-text-secondary">
            {pick(
              'هذا التحليل آلي واسترشادي، ويخضع لتقييم المراقب المالي المعتمد قبل استخدامه في القرارات الرسمية. جميع الأرقام مستخرجة من ميزان مراجعة معتمد وقيود تسوية معتمدة فقط.',
              'This analysis is automated and indicative; it remains subject to review by the certified financial controller before official use. All figures are drawn only from an approved trial balance and approved adjusting entries.',
              lang,
            )}
          </div>
        </div>
      )}
    </div>
  )
}

