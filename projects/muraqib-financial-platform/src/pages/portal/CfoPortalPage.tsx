import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from "@/lib/liveQuery"
import {
  BriefcaseBusiness, Download, Upload, Plus, Trash2, Send, Lock, CheckCircle2,
  Clock3, XCircle, AlertTriangle, Building2, FileSpreadsheet,
} from 'lucide-react'
import type { TrialBalanceImport } from '@/lib/db'
import type { AccountType, CurrencyCode } from '@/types'
import { CURRENCIES } from '@/types'
import { generateTemplateForCompany, sectionLabel } from '@/data/trialBalanceTemplates'
import { exportTrialBalanceTemplate, parseTrialBalanceFile, r2 } from '@/lib/exports'
import { saveTrialBalance, listTrialBalances, getRateMap } from '@/services/tb.service'
import { useAuthStore } from '@/stores/auth.store'
import { useI18nStore } from '@/stores/i18n.store'
import { useCompanies, useCompanyYears, CompanySelect, YearSelect } from '@/components/CompanySelector'
import { PageHeader, Card, Button, Badge, Field, inputClass, EmptyState, toast, SectionCard, IconButton } from '@/components/ui'
import { formatMoney, formatDate, pick } from '@/lib/format'

interface PortalLine {
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

export function CfoPortalPage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const user = useAuthStore((s) => s.user)
  const lang = language
  const companies = useCompanies() || []
  const [companyId, setCompanyId] = useState<number | undefined>(user?.companyId)
  useEffect(() => {
    if (!companyId && companies.length) setCompanyId(companies[0].id)
  }, [companies, companyId])

  const company = companies.find((c) => c.id === companyId)
  const years = useCompanyYears(companyId) || [String(new Date().getFullYear())]
  const [year, setYear] = useState(String(new Date().getFullYear()))
  useEffect(() => {
    if (!years.includes(year)) setYear(years[0])
  }, [years, year])

  const imports = useLiveQuery(async () => (companyId ? listTrialBalances(companyId) : []), [companyId]) || []
  const [lines, setLines] = useState<PortalLine[]>([])
  const [periodStart, setPeriodStart] = useState(`${year}-01-01`)
  const [periodEnd, setPeriodEnd] = useState(`${year}-12-31`)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [parseError, setParseError] = useState('')
  const [source, setSource] = useState<TrialBalanceImport['source']>('cfo_portal')

  useEffect(() => {
    setPeriodStart(`${year}-01-01`)
    setPeriodEnd(`${year}-12-31`)
  }, [year])

  const yearImports = imports.filter((i) => i.fiscalYear === year)
  const locked = yearImports.some((i) => i.status === 'approved')
  const pending = yearImports.find((i) => i.status === 'pending_approval')

  const baseCurrency = company?.baseCurrency || 'EGP'
  const totals = useMemo(() => {
    const debit = r2(lines.reduce((s, l) => s + (l.debit || 0), 0))
    const credit = r2(lines.reduce((s, l) => s + (l.credit || 0), 0))
    return { debit, credit, difference: r2(debit - credit), balanced: Math.abs(debit - credit) < 0.01 }
  }, [lines])

  const loadTemplate = () => {
    if (!company) return
    const template = generateTemplateForCompany(company)
    setLines(template.map((item) => ({ code: item.code, nameAr: item.nameAr, nameEn: item.nameEn, type: item.type, section: item.section, debit: 0, credit: 0, currency: company.baseCurrency, exchangeRate: 1 })))
    toast(t('tb.templateInfo', { count: template.length, company: lang === 'ar' ? company.nameAr : company.nameEn }))
  }

  const download = () => {
    if (!company) return
    exportTrialBalanceTemplate(company, year, generateTemplateForCompany(company), lang)
  }

  const handleFile = async (file: File) => {
    if (!company) return
    setParseError('')
    try {
      const rates = await getRateMap()
      const baseFactor = baseCurrency === 'EGP' ? 1 : 1 / (rates[baseCurrency] || 1)
      const parsed = await parseTrialBalanceFile(file, baseCurrency, baseFactor)
      setLines(parsed.lines.map((l) => ({ code: l.code, nameAr: l.nameAr, nameEn: l.nameEn, type: l.type, section: l.section, debit: l.debit, credit: l.credit, currency: l.currency as CurrencyCode, exchangeRate: l.exchangeRate })))
      setSource('cfo_portal')
      toast(t('tb.parseSuccess', { count: parsed.lines.length }))
    } catch {
      setParseError(t('tb.parseError'))
    }
  }

  const submit = async () => {
    if (!company) return
    if (!totals.balanced) {
      toast(t('tb.unbalancedWarning', { amount: formatMoney(Math.abs(totals.difference), baseCurrency, lang), currency: baseCurrency }), 'warning')
      return
    }
    if (!lines.length) {
      toast(t('tb.empty'), 'warning')
      return
    }
    setBusy(true)
    try {
      await saveTrialBalance({
        company, year, periodStart, periodEnd, source, status: 'pending_approval', lines, notes,
        submittedBy: user?.id, submittedByName: user ? (lang === 'ar' ? user.fullNameAr : user.fullNameEn) : undefined,
      })
      toast(t('portal.submitted'))
      setLines([])
    } catch {
      toast(t('common.noData'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const updateLine = <K extends keyof PortalLine>(index: number, key: K, value: PortalLine[K]) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [key]: value } : line)))
  }

  if (!company) {
    return (
      <div>
        <PageHeader title={t('portal.title')} subtitle={t('portal.subtitle')} icon={<BriefcaseBusiness className="h-6 w-6" />} />
        <EmptyState icon={<Building2 className="h-6 w-6" />} title={t('portal.noCompany')} />
        {!user?.companyId && companies.length > 0 && (
          <div className="mx-auto mt-4 max-w-md"><CompanySelect companies={companies} value={companyId} onChange={setCompanyId} label={t('common.company')} /></div>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Client Portal"
        icon={<BriefcaseBusiness className="h-6 w-6" />}
        title={t('portal.title')}
        subtitle={t('portal.subtitle')}
        actions={!user?.companyId ? <div className="w-64"><CompanySelect companies={companies} value={companyId} onChange={setCompanyId} /></div> : undefined}
      />

      <Card className="mb-4 overflow-hidden">
        <div className="grid gap-4 p-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <Badge tone="primary">{company.code}</Badge>
            <h2 className="mt-2 text-lg font-bold">{pick(company.nameAr, company.nameEn, lang)}</h2>
            <p className="mt-1 text-xs text-text-secondary">{t('portal.companyOnly')} · {company.baseCurrency}</p>
            <p className="mt-3 text-xs leading-6 text-text-secondary">{t('portal.instructions')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button icon={<Download className="h-4 w-4" />} onClick={download}>{t('portal.downloadTemplate')}</Button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">
                <Upload className="h-4 w-4" /> {t('portal.excel')}
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFile(file) }} />
              </label>
              <Button icon={<FileSpreadsheet className="h-4 w-4" />} onClick={loadTemplate}>{t('portal.enterBalances')}</Button>
            </div>
            {parseError && <p className="mt-2 text-[11px] text-danger">{parseError}</p>}
          </div>
          <div className="rounded-2xl border border-border bg-surface-2/50 p-4">
            <Field label={t('tb.year')}><YearSelect years={years} value={year} onChange={setYear} /></Field>
            <div className="mt-3 space-y-2 text-[11px]">
              <div className="flex items-center justify-between"><span className="text-text-secondary">{t('portal.statusHelp')}</span></div>
              {locked ? (
                <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-accent"><Lock className="h-4 w-4" /> {t('portal.locked')}</div>
              ) : pending ? (
                <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-warning"><Clock3 className="h-4 w-4" /> {t('status.pending_approval')}</div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-info/30 bg-info/10 px-3 py-2 text-info"><CheckCircle2 className="h-4 w-4" /> {t('status.open')}</div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {locked ? (
        <Card className="border-accent/30 bg-accent/5"><div className="flex items-center gap-2 p-4 text-xs text-text-secondary"><Lock className="h-4 w-4 text-accent" /> {t('portal.locked')}</div></Card>
      ) : (
        <>
          {lines.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center p-10 text-center">
                <FileSpreadsheet className="mb-2 h-8 w-8 text-primary/50" />
                <p className="text-sm font-semibold">{t('portal.enterBalances')}</p>
                <p className="mt-1 max-w-md text-xs leading-5 text-text-secondary">{t('portal.instructions')}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button variant="primary" onClick={loadTemplate} icon={<FileSpreadsheet className="h-4 w-4" />}>{t('portal.downloadTemplate')}</Button>
                  <Button onClick={() => document.querySelector<HTMLInputElement>('input[type=file]')?.click()} icon={<Upload className="h-4 w-4" />}>{t('portal.excel')}</Button>
                </div>
              </div>
            </Card>
          ) : (
            <>
              <Card bodyClassName="p-0">
                <div className="max-h-[500px] overflow-auto">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead className="sticky top-0 bg-surface-2 text-[11px] uppercase tracking-wide text-text-secondary">
                      <tr>
                        <th className="px-2 py-2.5 text-start">{t('tb.code')}</th>
                        <th className="px-2 py-2.5 text-start">{t('tb.nameAr')}</th>
                        <th className="px-2 py-2.5 text-start">{t('tb.section')}</th>
                        <th className="px-2 py-2.5 text-start">{t('tb.currency')}</th>
                        <th className="px-2 py-2.5 text-end">{t('tb.debit')}</th>
                        <th className="px-2 py-2.5 text-end">{t('tb.credit')}</th>
                        <th className="px-2 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={index} className="border-t border-border/60">
                          <td className="px-2 py-1 font-mono text-xs text-primary">{line.code}</td>
                          <td className="px-2 py-1"><input className={`${inputClass} min-w-[180px] px-2 py-1 text-xs`} value={line.nameAr} onChange={(e) => updateLine(index, 'nameAr', e.target.value)} /></td>
                          <td className="px-2 py-1 text-[10px] text-text-secondary">{sectionLabel(line.section, lang)}</td>
                          <td className="px-2 py-1">
                            <select className={`${inputClass} min-w-[80px] px-2 py-1 text-[11px]`} value={line.currency} onChange={(e) => updateLine(index, 'currency', e.target.value as CurrencyCode)}>
                              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1"><input type="number" className={`${inputClass} min-w-[100px] px-2 py-1 text-end text-xs`} value={line.debit} onChange={(e) => updateLine(index, 'debit', Number(e.target.value))} /></td>
                          <td className="px-2 py-1"><input type="number" className={`${inputClass} min-w-[100px] px-2 py-1 text-end text-xs`} value={line.credit} onChange={(e) => updateLine(index, 'credit', Number(e.target.value))} /></td>
                          <td className="px-2 py-1"><IconButton title={t('actions.remove')} tone="danger" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></IconButton></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-surface-2">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-xs font-bold">{t('common.total')}</td>
                        <td className="px-2 py-2 text-end text-xs font-bold tabular-nums">{formatMoney(totals.debit, baseCurrency, lang)}</td>
                        <td className="px-2 py-2 text-end text-xs font-bold tabular-nums">{formatMoney(totals.credit, baseCurrency, lang)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
                <SectionCard title={t('common.notes')} bodyClassName="p-4">
                  <textarea className={`${inputClass} min-h-[80px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button icon={<Plus className="h-4 w-4" />} onClick={() => setLines((prev) => [...prev, { code: '', nameAr: '', nameEn: '', type: 'asset', section: 'asset_current', debit: 0, credit: 0, currency: baseCurrency, exchangeRate: 1 }])}>{t('portal.addLine')}</Button>
                    <Button variant="primary" icon={<Send className="h-4 w-4" />} onClick={submit} disabled={busy || !totals.balanced}>{t('portal.save')}</Button>
                  </div>
                  <p className="mt-2 text-[11px] text-text-secondary">{t('portal.statusHelp')}</p>
                </SectionCard>
                <Card>
                  <div className="p-4">
                    <p className="text-xs font-bold">{t('tb.preview')}</p>
                    <div className="mt-2 space-y-1.5 text-[11px]">
                      <div className="flex justify-between"><span className="text-text-secondary">{t('tb.totalDebit')}</span><strong>{formatMoney(totals.debit, baseCurrency, lang)}</strong></div>
                      <div className="flex justify-between"><span className="text-text-secondary">{t('tb.totalCredit')}</span><strong>{formatMoney(totals.credit, baseCurrency, lang)}</strong></div>
                      <div className="flex justify-between"><span className="text-text-secondary">{t('tb.difference')}</span><strong className={totals.balanced ? 'text-accent' : 'text-danger'}>{formatMoney(Math.abs(totals.difference), baseCurrency, lang)}</strong></div>
                    </div>
                    {totals.balanced ? (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/5 px-3 py-2 text-[11px] text-accent"><CheckCircle2 className="h-4 w-4" /> {t('tb.balanced')}</div>
                    ) : (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/5 px-3 py-2 text-[11px] text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t('tb.unbalancedWarning', { amount: formatMoney(Math.abs(totals.difference), baseCurrency, lang), currency: baseCurrency })}</div>
                    )}
                  </div>
                </Card>
              </div>
            </>
          )}
        </>
      )}

      <SectionCard className="mt-4" title={t('portal.history')} subtitle={t('portal.statusHelp')} bodyClassName="p-0">
        {yearImports.length === 0 ? (
          <div className="p-5"><EmptyState icon={<Clock3 className="h-5 w-5" />} title={t('tb.empty')} /></div>
        ) : (
          <div className="divide-y divide-border">
            {yearImports.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold">{item.fiscalYear} · {item.lineCount} {t('tb.lineCount')}</p>
                  <p className="mt-0.5 text-[10px] text-text-secondary">{formatDate(item.createdAt, lang)} · {t(`tb.source${item.source === 'excel_import' ? 'Excel' : item.source === 'cfo_portal' ? 'Portal' : item.source === 'generated_template' ? 'Generated' : item.source === 'archive_restore' ? 'Archive' : 'Direct'}`)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={item.isBalanced ? 'success' : 'danger'}>{item.isBalanced ? t('status.balanced') : t('status.unbalanced')}</Badge>
                  <Badge tone={item.status === 'approved' ? 'success' : item.status === 'pending_approval' ? 'warning' : item.status === 'rejected' ? 'danger' : 'muted'}>{t(`status.${item.status}`)}</Badge>
                  {item.reviewNotes && <span className="max-w-[240px] truncate text-[10px] text-text-secondary">{item.reviewNotes}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

void XCircle

