import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FileSpreadsheet, Download, Sparkles, Building2, ListChecks, ArrowRight, ArrowLeft,
  Layers3, CheckCircle2,
} from 'lucide-react'
import type { Company } from '@/lib/db'
import { generateTemplateForCompany, sectionLabel } from '@/data/trialBalanceTemplates'
import { exportTrialBalanceTemplate } from '@/lib/exports'
import { useCompanies, useCompanyYears, usePersistedSelection, readStoredCompany, CompanySelect, YearSelect } from '@/components/CompanySelector'
import { PageHeader, Card, Button, SectionCard, Badge, toast } from '@/components/ui'
import { useI18nStore } from '@/stores/i18n.store'

export function TrialBalanceGeneratorPage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const lang = language
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
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [generated, setGenerated] = useState(false)

  useEffect(() => {
    if (!years.includes(year)) setYear(years[0])
  }, [years, year])

  const template = useMemo(() => (company && generated ? generateTemplateForCompany(company) : []), [company, generated])
  const groups = useMemo(() => {
    const map = new Map<string, typeof template>()
    for (const item of template) {
      if (!map.has(item.section)) map.set(item.section, [])
      map.get(item.section)!.push(item)
    }
    return Array.from(map.entries())
  }, [template])

  const stats = useMemo(() => ({
    total: template.length,
    types: new Set(template.map((item) => item.type)).size,
    sections: new Set(template.map((item) => item.section)).size,
  }), [template])

  const generate = () => {
    if (!company) {
      toast(t('common.selectCompany'), 'warning')
      return
    }
    setGenerated(true)
    toast(t('tb.templateInfo', { count: String(generateTemplateForCompany(company).length), company: lang === 'ar' ? company.nameAr : company.nameEn }))
  }

  const download = () => {
    if (!company) return
    exportTrialBalanceTemplate(company as Company, year, template, lang)
  }

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Trial Balance"
        icon={<FileSpreadsheet className="h-6 w-6" />}
        title={t('tb.generatorTitle')}
        subtitle={t('tb.generatorSubtitle')}
        actions={generated ? <Button variant="primary" icon={<Download className="h-4 w-4" />} onClick={download}>{t('tb.exportTemplate')}</Button> : undefined}
      />

      <Card className="mb-5">
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_auto]">
          <CompanySelect companies={companies} value={companyId} onChange={(v) => { setCompanyId(v); setGenerated(false) }} label={t('common.company')} />
          <YearSelect years={years} value={year} onChange={setYear} label={t('tb.year')} />
          <div className="flex items-end">
            <Button variant="primary" className="w-full md:w-auto" icon={<Sparkles className="h-4 w-4" />} onClick={generate} disabled={!companyId}>
              {t('tb.generate')}
            </Button>
          </div>
        </div>
        {company && (
          <div className="grid gap-2 border-t border-border bg-surface-2/40 px-5 py-3 text-[11px] text-text-secondary sm:grid-cols-2 lg:grid-cols-4">
            <span><strong className="text-text">{t('common.company')}:</strong> {lang === 'ar' ? company.nameAr : company.nameEn}</span>
            <span><strong className="text-text">{t('companies.legalForm')}:</strong> {company.legalForm}</span>
            <span><strong className="text-text">{t('companies.size')}:</strong> {company.size}</span>
            <span><strong className="text-text">{t('common.currency')}:</strong> {company.baseCurrency}</span>
          </div>
        )}
      </Card>

      {!generated ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard className="lg:col-span-2" title={t('portfolio.cap1')}>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: <Building2 className="h-5 w-5" />, title: t('companies.legalForm'), text: company?.legalForm || '—' },
                { icon: <Layers3 className="h-5 w-5" />, title: t('companies.size'), text: company?.size || '—' },
                { icon: <ListChecks className="h-5 w-5" />, title: t('companies.activity'), text: company?.activity || '—' },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-border bg-surface-2/40 p-4">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">{item.icon}</div>
                  <p className="text-[10px] text-text-secondary">{item.title}</p>
                  <p className="mt-0.5 text-sm font-bold">{item.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs leading-6 text-text-secondary">{t('tb.templateHint')}</p>
          </SectionCard>
          <SectionCard title={t('tb.generate')}>
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-info/10 text-primary">
                <Sparkles className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold">{t('tb.templateHint')}</p>
              <Button variant="primary" className="mt-4" onClick={generate} disabled={!companyId} icon={<Sparkles className="h-4 w-4" />}>{t('tb.generate')}</Button>
            </div>
          </SectionCard>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label={t('tb.lineCount')} value={stats.total} />
            <MiniStat label={t('accounts.type')} value={`${stats.types} ${t('common.type')}`} />
            <MiniStat label={t('accounts.section')} value={`${stats.sections} ${t('accounts.section')}`} />
            <MiniStat label={t('tb.year')} value={year} />
          </div>

          <SectionCard
            title={t('tb.preview')}
            subtitle={t('tb.templateInfo', { count: stats.total, company: lang === 'ar' ? company?.nameAr || '' : company?.nameEn || '' })}
            action={<Badge tone="success"><CheckCircle2 className="h-3 w-3" /> {t('portfolio.cap1')}</Badge>}
            bodyClassName="p-0"
          >
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-surface-2 text-[11px] uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-2.5 text-start">{t('tb.code')}</th>
                    <th className="px-4 py-2.5 text-start">{t('tb.nameAr')}</th>
                    <th className="px-4 py-2.5 text-start">{t('tb.nameEn')}</th>
                    <th className="px-4 py-2.5 text-start">{t('tb.type')}</th>
                    <th className="px-4 py-2.5 text-start">{t('tb.section')}</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(([section, rows]) => (
                    <>
                      <tr key={`section-${section}`} className="bg-primary/5">
                        <td colSpan={5} className="px-4 py-2 text-xs font-bold text-primary">{sectionLabel(section, lang)} <span className="text-text-secondary">({rows.length})</span></td>
                      </tr>
                      {rows.map((item) => (
                        <tr key={item.code} className="border-t border-border/60 hover:bg-surface-2/40">
                          <td className="px-4 py-2 font-mono text-xs font-semibold text-primary">{item.code}</td>
                          <td className="px-4 py-2 text-xs">{item.nameAr}</td>
                          <td className="px-4 py-2 text-xs text-text-secondary">{item.nameEn}</td>
                          <td className="px-4 py-2 text-[11px]">{item.type}</td>
                          <td className="px-4 py-2 text-[11px] text-text-secondary">{sectionLabel(item.section, lang)}</td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="text-sm font-bold">{t('tb.exportTemplate')}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{t('tb.templateHint')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon={<Download className="h-4 w-4" />} onClick={download}>{t('actions.downloadTemplate')}</Button>
                <Link to={`/trialbalance/import?company=${companyId}&year=${year}`}>
                  <Button variant="primary" icon={<FileSpreadsheet className="h-4 w-4" />}>{t('tb.goImport')} {lang === 'ar' ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}</Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <div className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
        <p className="mt-1 text-lg font-bold">{value}</p>
      </div>
    </Card>
  )
}

