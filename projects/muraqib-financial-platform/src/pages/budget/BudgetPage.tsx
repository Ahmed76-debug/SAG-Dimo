import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from "@/lib/liveQuery"
import {
  Calculator, Save, FileSpreadsheet, Sparkles, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Search, RotateCcw,
} from 'lucide-react'
import { db, type Budget } from '@/lib/db'
import { buildCompanyDataset } from '@/services/tb.service'
import { computeStatements } from '@/lib/finance'
import { formatMoney, formatNumber, formatPercent, pick } from '@/lib/format'
import { exportBudgetToExcel, r2 } from '@/lib/exports'
import { logAudit } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { useI18nStore } from '@/stores/i18n.store'
import {
  useCompanies, useCompanyYears, usePersistedSelection, readStoredCompany,
  CompanySelect, YearSelect,
} from '@/components/CompanySelector'
import {
  PageHeader, Card, Button, EmptyState, LoadingBlock, StatCard, Badge, SectionCard, inputClass, toast,
} from '@/components/ui'

interface BudgetRow {
  code: string
  nameAr: string
  nameEn: string
  type: 'revenue' | 'expense'
  actual: number
  budget: number
}

export function BudgetPage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const user = useAuthStore((s) => s.user)
  const lang = language
  const companies = useCompanies() || []
  const [companyId, setCompanyId] = useState<number | undefined>(readStoredCompany())
  const years = useCompanyYears(companyId) || []
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<BudgetRow[]>([])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  usePersistedSelection(companyId, setCompanyId)

  useEffect(() => {
    if (!companyId && companies.length) setCompanyId(companies[0].id)
  }, [companies, companyId])

  useEffect(() => {
    if (years.length && !years.includes(year)) setYear(years[0])
  }, [years, year])

  const company = companies.find((c) => c.id === companyId)
  const dataset = useLiveQuery(async () => {
    if (!companyId || !year) return null
    return buildCompanyDataset(companyId, year).catch(() => null)
  }, [companyId, year])
  const budgetRecord = useLiveQuery<Budget | undefined>(
    async () => (companyId && year ? db.budgets.where({ companyId, year }).first() : undefined),
    [companyId, year],
  )
  const financials = useMemo(() => (dataset ? computeStatements(dataset) : null), [dataset])

  const actualRows = useMemo<BudgetRow[]>(() => {
    if (!financials) return []
    return financials.lines
      .filter((line) => line.type === 'revenue' || line.type === 'expense')
      .map((line) => {
        const actual = r2(Math.abs(line.type === 'revenue' ? -line.balance : line.balance))
        return {
          code: line.code,
          nameAr: line.nameAr,
          nameEn: line.nameEn,
          type: line.type as 'revenue' | 'expense',
          actual,
          budget: 0,
        }
      })
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [financials])

  useEffect(() => {
    if (!actualRows.length) {
      setRows([])
      return
    }
    const budgetMap = new Map((budgetRecord?.lines || []).map((line) => [line.code, line.amount]))
    setRows(actualRows.map((row) => ({ ...row, budget: r2(budgetMap.get(row.code) || 0) })))
    setNotes(budgetRecord?.notes || '')
  }, [actualRows, budgetRecord])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => [row.code, row.nameAr, row.nameEn].some((value) => value.toLowerCase().includes(q)))
  }, [rows, search])

  const totals = useMemo(() => {
    const revenue = rows.filter((r) => r.type === 'revenue')
    const expenses = rows.filter((r) => r.type === 'expense')
    return {
      actualRevenue: r2(revenue.reduce((s, r) => s + r.actual, 0)),
      budgetRevenue: r2(revenue.reduce((s, r) => s + r.budget, 0)),
      actualExpenses: r2(expenses.reduce((s, r) => s + r.actual, 0)),
      budgetExpenses: r2(expenses.reduce((s, r) => s + r.budget, 0)),
      actualResult: r2(revenue.reduce((s, r) => s + r.actual, 0) - expenses.reduce((s, r) => s + r.actual, 0)),
      budgetResult: r2(revenue.reduce((s, r) => s + r.budget, 0) - expenses.reduce((s, r) => s + r.budget, 0)),
    }
  }, [rows])

  const setBudget = (code: string, value: number) => {
    setRows((current) => current.map((row) => (row.code === code ? { ...row, budget: r2(Math.max(0, value)) } : row)))
  }

  const autoFill = () => {
    setRows((current) => current.map((row) => ({ ...row, budget: r2(row.actual * (row.type === 'revenue' ? 1.05 : 1.03)) })))
    toast(t('budget.autoFill'))
  }

  const resetActuals = () => {
    setRows((current) => current.map((row) => ({ ...row, budget: 0 })))
  }

  const save = async () => {
    if (!company) return
    setBusy(true)
    try {
      const now = new Date().toISOString()
      const lines = rows.map((row) => ({ code: row.code, amount: row.budget }))
      if (budgetRecord?.id) {
        await db.budgets.update(budgetRecord.id, { lines, notes, updatedAt: now })
      } else {
        await db.budgets.add({ companyId: company.id!, year, lines, notes, createdAt: now, updatedAt: now } as Budget)
      }
      await logAudit('create', 'budget', budgetRecord?.id, `حفظ موازنة ${company.nameAr} لسنة ${year}`, `Saved budget of ${company.nameEn} for ${year}`, user?.fullNameAr)
      toast(t('budget.saved'))
    } finally {
      setBusy(false)
    }
  }

  const exportExcel = () => {
    if (!company) return
    exportBudgetToExcel(
      lang === 'ar' ? company.nameAr : company.nameEn,
      year,
      rows.map((row) => ({ code: row.code, nameAr: row.nameAr, nameEn: row.nameEn, actual: row.actual, budget: row.budget })),
      company.baseCurrency,
      lang,
    )
    toast(t('actions.exportExcel'))
  }

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Budgeting"
        icon={<Calculator className="h-6 w-6" />}
        title={t('budget.title')}
        subtitle={t('budget.subtitle')}
        actions={
          <>
            <Button icon={<Sparkles className="h-4 w-4" />} onClick={autoFill} disabled={!rows.length}>{t('budget.autoFill')}</Button>
            <Button icon={<FileSpreadsheet className="h-4 w-4" />} onClick={exportExcel} disabled={!rows.length}>{t('budget.export')}</Button>
            <Button variant="primary" icon={<Save className="h-4 w-4" />} onClick={save} disabled={!rows.length || busy}>{t('budget.save')}</Button>
          </>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-4">
          <CompanySelect companies={companies} value={companyId} onChange={setCompanyId} label={t('common.company')} className="md:col-span-2" />
          <YearSelect years={years} value={year} onChange={setYear} label={t('budget.year')} />
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input className={`${inputClass} ps-9`} placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </Card>

      {!companyId ? (
        <Card><LoadingBlock text={t('common.loading')} /></Card>
      ) : !financials ? (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title={t('budget.noApproved')}
          text={t('reports.noApprovedHint')}
          action={<Link to="/trialbalance/import"><Button variant="primary">{t('tb.goImport')}</Button></Link>}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t('budget.actual')} value={formatMoney(totals.actualResult, company?.baseCurrency, lang)} hint={`${t('budget.totalActual')} · ${formatMoney(totals.actualRevenue, company?.baseCurrency, lang)}`} icon={<TrendingUp className="h-5 w-5" />} />
            <StatCard label={t('budget.budget')} value={formatMoney(totals.budgetResult, company?.baseCurrency, lang)} hint={`${t('budget.totalBudget')} · ${formatMoney(totals.budgetRevenue, company?.baseCurrency, lang)}`} icon={<Calculator className="h-5 w-5" />} tone="info" />
            <StatCard label={t('budget.variance')} value={formatMoney(totals.actualResult - totals.budgetResult, company?.baseCurrency, lang)} hint={`${t('budget.variancePercent')}: ${totals.budgetResult ? formatPercent(((totals.actualResult - totals.budgetResult) / Math.abs(totals.budgetResult)) * 100, lang) : '—'}`} icon={<TrendingDown className="h-5 w-5" />} tone={totals.actualResult >= totals.budgetResult ? 'success' : 'warning'} />
            <StatCard label={t('tb.lineCount')} value={formatNumber(rows.length, lang, 0)} hint={`${t('budget.actual')}: ${formatMoney(totals.actualExpenses, company?.baseCurrency, lang)} · ${t('budget.budget')}: ${formatMoney(totals.budgetExpenses, company?.baseCurrency, lang)}`} icon={<CheckCircle2 className="h-5 w-5" />} tone="muted" />
          </div>

          {!rows.length ? (
            <EmptyState icon={<Calculator className="h-6 w-6" />} title={t('budget.empty')} />
          ) : (
            <SectionCard
              title={t('budget.title')}
              subtitle={`${pick(company?.nameAr || '', company?.nameEn || '', lang)} · ${year}`}
              action={<Button icon={<RotateCcw className="h-4 w-4" />} onClick={resetActuals}>{t('actions.reset')}</Button>}
              bodyClassName="p-0"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-2/60">
                      <th className="px-4 py-3 text-start text-xs font-bold">{t('common.code')}</th>
                      <th className="px-4 py-3 text-start text-xs font-bold">{t('common.name')}</th>
                      <th className="px-4 py-3 text-end text-xs font-bold">{t('budget.actual')}</th>
                      <th className="px-4 py-3 text-end text-xs font-bold">{t('budget.budget')}</th>
                      <th className="px-4 py-3 text-end text-xs font-bold">{t('budget.variance')}</th>
                      <th className="px-4 py-3 text-end text-xs font-bold">{t('budget.variancePercent')}</th>
                      <th className="px-4 py-3 text-start text-xs font-bold">{t('analysis.assessment')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const variance = r2(row.actual - row.budget)
                      const favorable = row.type === 'revenue' ? variance >= 0 : variance <= 0
                      const variancePct = row.budget ? (variance / Math.abs(row.budget)) * 100 : 0
                      return (
                        <tr key={row.code} className="border-t border-border/60">
                          <td className="px-4 py-2 font-mono text-xs text-text-secondary">{row.code}</td>
                          <td className="px-4 py-2">
                            <p className="font-medium">{pick(row.nameAr, row.nameEn, lang)}</p>
                            <p className="text-[10px] text-text-secondary">{row.type === 'revenue' ? t('nav.income') : t('tb.section')}</p>
                          </td>
                          <td className="px-4 py-2 text-end tabular-nums">{formatMoney(row.actual, company?.baseCurrency, lang)}</td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className={`${inputClass} min-w-[120px] text-end tabular-nums`}
                              value={row.budget || ''}
                              onChange={(e) => setBudget(row.code, Number(e.target.value))}
                            />
                          </td>
                          <td className={`px-4 py-2 text-end font-semibold tabular-nums ${variance === 0 ? '' : favorable ? 'text-accent' : 'text-danger'}`}>
                            {formatMoney(variance, company?.baseCurrency, lang)}
                          </td>
                          <td className="px-4 py-2 text-end tabular-nums">{row.budget ? formatPercent(variancePct, lang) : '—'}</td>
                          <td className="px-4 py-2">
                            {variance === 0 ? <Badge tone="muted">{t('analysis.neutral')}</Badge> : favorable ? <Badge tone="success">{t('budget.favorable')}</Badge> : <Badge tone="danger">{t('budget.unfavorable')}</Badge>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-surface-2/60 font-bold">
                      <td className="px-4 py-3" colSpan={2}>{t('common.total')}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{formatMoney(totals.actualResult, company?.baseCurrency, lang)}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{formatMoney(totals.budgetResult, company?.baseCurrency, lang)}</td>
                      <td className={`px-4 py-3 text-end tabular-nums ${totals.actualResult >= totals.budgetResult ? 'text-accent' : 'text-danger'}`}>{formatMoney(totals.actualResult - totals.budgetResult, company?.baseCurrency, lang)}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{totals.budgetResult ? formatPercent(((totals.actualResult - totals.budgetResult) / Math.abs(totals.budgetResult)) * 100, lang) : '—'}</td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>
          )}

          <SectionCard title={t('budget.notes')}>
            <textarea className={`${inputClass} min-h-[90px]`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('budget.notes')} />
          </SectionCard>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs leading-5 text-text-secondary">
            {pick(
              'الموازنة التقديرية أداة رقابة استباقية: تُقارن بالفعلي المستخرج من ميزان المراجعة المعتمد، ولا تحل محل القوائم الرسمية.',
              'The budget is a forward-looking control tool compared with actual figures from the approved trial balance; it does not replace the official statements.',
              lang,
            )}
          </div>
        </div>
      )}
    </div>
  )
}

