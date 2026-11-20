import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from "@/lib/liveQuery"
import {
  FileUp, Upload, Plus, Trash2, Save, Send, FileSpreadsheet, AlertTriangle, CheckCircle2,
  Wand2, ArrowLeft, ArrowRight, Info, RefreshCw,
} from 'lucide-react'
import { db, type TrialBalanceImport } from '@/lib/db'
import type { AccountType, CurrencyCode } from '@/types'
import { CURRENCIES } from '@/types'
import { generateTemplateForCompany } from '@/data/trialBalanceTemplates'
import { parseTrialBalanceFile, r2 } from '@/lib/exports'
import { formatMoney, formatDate } from '@/lib/format'
import { saveTrialBalance, getTrialBalanceDetail, getRateMap } from '@/services/tb.service'
import { useAuthStore } from '@/stores/auth.store'
import { useI18nStore } from '@/stores/i18n.store'
import { useCompanies, useCompanyYears, usePersistedSelection, readStoredCompany, CompanySelect, YearSelect } from '@/components/CompanySelector'
import { PageHeader, Card, Button, IconButton, Field, inputClass, Badge, toast, SectionCard } from '@/components/ui'

interface EditableLine {
  code: string
  nameAr: string
  nameEn: string
  type: AccountType
  section: string
  debit: number
  credit: number
  currency: CurrencyCode
  exchangeRate: number
}

export function TrialBalanceImportPage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const user = useAuthStore((s) => s.user)
  const lang = language
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const companies = useCompanies() || []
  const [companyId, setCompanyId] = useState<number | undefined>(() => {
    const raw = params.get('company')
    return raw ? Number(raw) : readStoredCompany()
  })
  usePersistedSelection(companyId, setCompanyId)
  useEffect(() => {
    if (!companyId && companies.length) setCompanyId(companies[0].id)
  }, [companies, companyId])

  const company = companies.find((c) => c.id === companyId)
  const years = useCompanyYears(companyId) || [String(new Date().getFullYear())]
  const [year, setYear] = useState(params.get('year') || String(new Date().getFullYear()))
  useEffect(() => {
    if (!years.includes(year)) setYear(years[0])
  }, [years, year])

  const importIdParam = params.get('id') ? Number(params.get('id')) : undefined
  const existing = useLiveQuery(() => (importIdParam ? getTrialBalanceDetail(importIdParam) : undefined), [importIdParam])
  const [loadedExisting, setLoadedExisting] = useState(false)
  const [lines, setLines] = useState<EditableLine[]>([])
  const [periodStart, setPeriodStart] = useState(`${year}-01-01`)
  const [periodEnd, setPeriodEnd] = useState(`${year}-12-31`)
  const [notes, setNotes] = useState('')
  const [source, setSource] = useState<TrialBalanceImport['source']>('direct_entry')
  const [busy, setBusy] = useState(false)
  const [parseInfo, setParseInfo] = useState('')
  const [parseError, setParseError] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    setPeriodStart(`${year}-01-01`)
    setPeriodEnd(`${year}-12-31`)
  }, [year])

  useEffect(() => {
    if (!existing || loadedExisting) return
    if (existing.header) {
      setCompanyId(existing.header.companyId)
      setYear(existing.header.fiscalYear)
      setPeriodStart(existing.header.periodStart)
      setPeriodEnd(existing.header.periodEnd)
      setNotes(existing.header.notes || '')
      setSource(existing.header.source)
      setLines(existing.lines.map((l) => ({
        code: l.code, nameAr: l.nameAr, nameEn: l.nameEn, type: l.type, section: l.section || '',
        debit: l.debit, credit: l.credit, currency: (l.currency || 'EGP') as CurrencyCode, exchangeRate: l.exchangeRate || 1,
      })))
      setLoadedExisting(true)
    }
  }, [existing, loadedExisting, setCompanyId])

  const baseCurrency = company?.baseCurrency || 'EGP'
  const totals = useMemo(() => {
    const debit = r2(lines.reduce((s, l) => s + (l.debit || 0), 0))
    const credit = r2(lines.reduce((s, l) => s + (l.credit || 0), 0))
    return { debit, credit, difference: r2(debit - credit), balanced: Math.abs(debit - credit) < 0.01 }
  }, [lines])

  const loadTemplate = () => {
    if (!company) {
      toast(t('common.selectCompany'), 'warning')
      return
    }
    const template = generateTemplateForCompany(company)
    setLines(template.map((item) => ({
      code: item.code, nameAr: item.nameAr, nameEn: item.nameEn, type: item.type, section: item.section,
      debit: 0, credit: 0, currency: company.baseCurrency, exchangeRate: 1,
    })))
    setSource('generated_template')
    toast(t('tb.templateInfo', { count: template.length, company: lang === 'ar' ? company.nameAr : company.nameEn }))
  }

  const loadAccounts = async () => {
    if (!companyId) return
    const accounts = await db.accounts.where({ companyId }).toArray()
    setLines(accounts.map((a) => ({
      code: a.code, nameAr: a.nameAr, nameEn: a.nameEn, type: a.type, section: a.section || '',
      debit: 0, credit: 0, currency: baseCurrency, exchangeRate: 1,
    })))
    setSource('direct_entry')
  }

  const addLine = () => {
    setLines((prev) => [...prev, { code: '', nameAr: '', nameEn: '', type: 'asset', section: 'asset_current', debit: 0, credit: 0, currency: baseCurrency, exchangeRate: 1 }])
  }

  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index))

  const updateLine = <K extends keyof EditableLine>(index: number, key: K, value: EditableLine[K]) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [key]: value } : line)))
  }

  const handleFile = async (file: File) => {
    if (!company) return
    setParseError('')
    setParseInfo('')
    try {
      const rates = await getRateMap()
      const baseFactor = baseCurrency === 'EGP' ? 1 : 1 / (rates[baseCurrency] || 1)
      const parsed = await parseTrialBalanceFile(file, baseCurrency, baseFactor)
      setLines(parsed.lines.map((l) => ({
        code: l.code, nameAr: l.nameAr, nameEn: l.nameEn, type: l.type, section: l.section,
        debit: l.debit, credit: l.credit, currency: l.currency as CurrencyCode, exchangeRate: l.exchangeRate,
      })))
      setSource('excel_import')
      setWarnings(parsed.warnings)
      setParseInfo(t('tb.parseSuccess', { count: parsed.lines.length }))
      toast(t('tb.parseSuccess', { count: parsed.lines.length }))
    } catch {
      setParseError(t('tb.parseError'))
    }
  }

  const submit = async (submitForReview: boolean) => {
    if (!company || !companyId) {
      toast(t('common.selectCompany'), 'warning')
      return
    }
    if (!lines.length) {
      toast(t('tb.empty'), 'warning')
      return
    }
    setBusy(true)
    try {
      const id = await saveTrialBalance({
        importId: importIdParam,
        company,
        year,
        periodStart,
        periodEnd,
        source,
        status: submitForReview ? 'pending_approval' : 'draft',
        lines,
        notes,
        submittedBy: user?.id,
        submittedByName: user ? (lang === 'ar' ? user.fullNameAr : user.fullNameEn) : undefined,
      })
      toast(submitForReview ? t('tb.submitted') : t('tb.savedDraft'))
      if (submitForReview) navigate(`/trialbalance/review?id=${id}`)
      else navigate(`/trialbalance/import?id=${id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      toast(message === 'UNBALANCED_TB' ? t('tb.cannotApprove') : t('common.noData'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Trial Balance"
        icon={<FileUp className="h-6 w-6" />}
        title={t('tb.importTitle')}
        subtitle={t('tb.importSubtitle')}
        actions={
          <>
            <Button icon={<Wand2 className="h-4 w-4" />} onClick={loadTemplate} disabled={!company}>{t('actions.generateTemplate')}</Button>
            <Button variant="primary" icon={<Save className="h-4 w-4" />} onClick={() => submit(false)} disabled={busy || !lines.length}>{t('tb.saveDraft')}</Button>
          </>
        }
      />

      {existing?.header?.status === 'approved' && (
        <Card className="mb-4 border-accent/30 bg-accent/5">
          <div className="flex items-center gap-2 p-3 text-xs text-text-secondary"><CheckCircle2 className="h-4 w-4 text-accent" /> {t('portal.locked')}</div>
        </Card>
      )}
      {existing?.header?.status === 'pending_approval' && (
        <Card className="mb-4 border-warning/30 bg-warning/5">
          <div className="flex items-center gap-2 p-3 text-xs text-text-secondary"><Info className="h-4 w-4 text-warning" /> {t('tb.submitReviewHint')}</div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <CompanySelect companies={companies} value={companyId} onChange={setCompanyId} label={t('common.company')} />
          <YearSelect years={years} value={year} onChange={setYear} label={t('tb.year')} />
          <Field label={t('tb.periodStart')}><input type="date" className={inputClass} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></Field>
          <Field label={t('tb.periodEnd')}><input type="date" className={inputClass} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></Field>
        </div>
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div className="flex flex-wrap gap-2">
              <Button icon={<Wand2 className="h-4 w-4" />} onClick={loadTemplate} disabled={!company}>{t('actions.generateTemplate')}</Button>
              <Button icon={<RefreshCw className="h-4 w-4" />} onClick={loadAccounts} disabled={!companyId}>{t('accounts.sync')}</Button>
              <Button icon={<Plus className="h-4 w-4" />} onClick={addLine}>{t('tb.addLine')}</Button>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Badge tone={totals.balanced ? 'success' : 'danger'}>{totals.balanced ? t('status.balanced') : t('status.unbalanced')}</Badge>
              <Badge tone="muted">{lines.length} {t('tb.lineCount')}</Badge>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <p className="text-xs font-bold">{t('tb.excelImport')}</p>
            <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-2/40 px-3 py-4 text-center transition hover:border-primary/40">
              <Upload className="mb-1.5 h-5 w-5 text-primary" />
              <span className="text-[11px] leading-4 text-text-secondary">{t('tb.dropHint')}</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFile(file) }} />
            </label>
            {parseInfo && <p className="mt-2 text-[11px] text-accent">{parseInfo}</p>}
            {parseError && <p className="mt-2 text-[11px] text-danger">{parseError}</p>}
            {warnings.length > 0 && <p className="mt-1 text-[10px] text-warning">{warnings.join(' · ')}</p>}
          </div>
        </Card>
      </div>

      {!companyId ? (
        <Card><div className="p-8 text-center text-sm text-text-secondary">{t('common.selectCompany')}</div></Card>
      ) : lines.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <FileSpreadsheet className="mb-2 h-8 w-8 text-primary/50" />
            <p className="text-sm font-semibold">{t('tb.empty')}</p>
            <p className="mt-1 max-w-md text-xs leading-5 text-text-secondary">{t('tb.templateHint')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" icon={<Wand2 className="h-4 w-4" />} onClick={loadTemplate}>{t('tb.goGenerator')}</Button>
              <Button icon={<Upload className="h-4 w-4" />} onClick={() => document.querySelector<HTMLInputElement>('input[type=file]')?.click()}>{t('tb.importFile')}</Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card bodyClassName="p-0">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-surface-2 text-[11px] uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-2 py-2.5 text-start">{t('tb.code')}</th>
                    <th className="px-2 py-2.5 text-start">{t('tb.nameAr')}</th>
                    <th className="px-2 py-2.5 text-start">{t('tb.nameEn')}</th>
                    <th className="px-2 py-2.5 text-start">{t('tb.type')}</th>
                    <th className="px-2 py-2.5 text-start">{t('tb.currency')}</th>
                    <th className="px-2 py-2.5 text-end">{t('tb.rate')}</th>
                    <th className="px-2 py-2.5 text-end">{t('tb.debit')}</th>
                    <th className="px-2 py-2.5 text-end">{t('tb.credit')}</th>
                    <th className="px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index} className="border-t border-border/60 hover:bg-surface-2/30">
                      <td className="px-2 py-1"><input className={`${inputClass} min-w-[85px] px-2 py-1 font-mono text-xs`} value={line.code} onChange={(e) => updateLine(index, 'code', e.target.value)} /></td>
                      <td className="px-2 py-1"><input className={`${inputClass} min-w-[150px] px-2 py-1 text-xs`} value={line.nameAr} onChange={(e) => updateLine(index, 'nameAr', e.target.value)} /></td>
                      <td className="px-2 py-1"><input className={`${inputClass} min-w-[150px] px-2 py-1 text-xs`} value={line.nameEn} onChange={(e) => updateLine(index, 'nameEn', e.target.value)} /></td>
                      <td className="px-2 py-1">
                        <select className={`${inputClass} min-w-[90px] px-2 py-1 text-[11px]`} value={line.type} onChange={(e) => updateLine(index, 'type', e.target.value as AccountType)}>
                          {(['asset', 'liability', 'equity', 'revenue', 'expense'] as AccountType[]).map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select className={`${inputClass} min-w-[80px] px-2 py-1 text-[11px]`} value={line.currency} onChange={(e) => updateLine(index, 'currency', e.target.value as CurrencyCode)}>
                          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1"><input type="number" className={`${inputClass} min-w-[75px] px-2 py-1 text-end text-xs`} value={line.exchangeRate} onChange={(e) => updateLine(index, 'exchangeRate', Number(e.target.value))} /></td>
                      <td className="px-2 py-1"><input type="number" className={`${inputClass} min-w-[100px] px-2 py-1 text-end text-xs`} value={line.debit} onChange={(e) => updateLine(index, 'debit', Number(e.target.value))} /></td>
                      <td className="px-2 py-1"><input type="number" className={`${inputClass} min-w-[100px] px-2 py-1 text-end text-xs`} value={line.credit} onChange={(e) => updateLine(index, 'credit', Number(e.target.value))} /></td>
                      <td className="px-2 py-1 text-center"><IconButton title={t('actions.remove')} tone="danger" onClick={() => removeLine(index)}><Trash2 className="h-3.5 w-3.5" /></IconButton></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-surface-2 font-bold">
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-xs">{t('common.total')}</td>
                    <td className="px-2 py-2 text-end text-xs tabular-nums">{formatMoney(totals.debit, baseCurrency, lang)}</td>
                    <td className="px-2 py-2 text-end text-xs tabular-nums">{formatMoney(totals.credit, baseCurrency, lang)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
            <SectionCard title={t('tb.notes')} bodyClassName="p-4">
              <textarea className={`${inputClass} min-h-[110px]`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('tb.templateHint')} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button icon={<Save className="h-4 w-4" />} onClick={() => submit(false)} disabled={busy}>{t('tb.saveDraft')}</Button>
                <Button variant="primary" icon={<Send className="h-4 w-4" />} onClick={() => submit(true)} disabled={busy || !totals.balanced}>{t('tb.submitReview')}</Button>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-text-secondary">{t('tb.submitReviewHint')}</p>
            </SectionCard>

            <Card>
              <div className="p-4">
                <p className="text-xs font-bold">{t('tb.preview')}</p>
                <div className="mt-3 space-y-2 text-xs">
                  <SummaryRow label={t('tb.lineCount')} value={lines.length} />
                  <SummaryRow label={t('tb.totalDebit')} value={formatMoney(totals.debit, baseCurrency, lang)} />
                  <SummaryRow label={t('tb.totalCredit')} value={formatMoney(totals.credit, baseCurrency, lang)} />
                  <SummaryRow label={t('tb.difference')} value={formatMoney(Math.abs(totals.difference), baseCurrency, lang)} tone={totals.balanced ? 'text-accent' : 'text-danger'} />
                </div>
                {!totals.balanced && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] leading-5 text-text-secondary">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    {t('tb.unbalancedWarning', { amount: formatMoney(Math.abs(totals.difference), baseCurrency, lang), currency: baseCurrency })}
                  </div>
                )}
                {totals.balanced && lines.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-[11px] text-accent">
                    <CheckCircle2 className="h-4 w-4" /> {t('tb.balanced')}
                  </div>
                )}
                {existing?.header && (
                  <p className="mt-3 text-[10px] text-text-secondary">
                    {t('common.updatedAt')}: {formatDate(existing.header.updatedAt, lang)} · {t(`tb.source${existing.header.source === 'excel_import' ? 'Excel' : existing.header.source === 'cfo_portal' ? 'Portal' : existing.header.source === 'generated_template' ? 'Generated' : existing.header.source === 'archive_restore' ? 'Archive' : 'Direct'}`)}
                  </p>
                )}
              </div>
            </Card>
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-text-secondary">
        <Link to={`/trialbalance/review`} className="inline-flex items-center gap-1 font-semibold text-primary">{t('tb.goReview')} {lang === 'ar' ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}</Link>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5">
      <span className="text-text-secondary">{label}</span>
      <span className={`font-bold tabular-nums ${tone || ''}`}>{value}</span>
    </div>
  )
}

