import { useTranslation } from 'react-i18next'
import { Download, Printer, FileSpreadsheet, ShieldCheck } from 'lucide-react'
import type { ReportModel } from '@/lib/finance'
import { formatNumber, formatMoney, formatDate } from '@/lib/format'
import { exportElementToPdf, printElement, exportReportToExcel, r2 } from '@/lib/exports'
import type { OfficeProfile } from '@/lib/db'
import { Button, toast } from '@/components/ui'
import { useI18nStore } from '@/stores/i18n.store'

export interface ReportMeta {
  companyNameAr: string
  companyNameEn: string
  year: string
  periodStart: string
  periodEnd: string
  currency: string
  approvedBy?: string
  approvedAt?: string
  legalForm?: string
}

function RowAmount({ value, currency, lang, negative }: { value?: number; currency: string; lang: string; negative?: boolean }) {
  if (value === undefined) return <span className="text-slate-500">—</span>
  const number = negative ? -Math.abs(value) : value
  return <span className={number < 0 ? 'text-red-600' : ''}>{formatMoney(number, currency, lang)}</span>
}

export function ReportView({
  model,
  meta,
  profile,
  elementId,
  insights,
}: {
  model: ReportModel
  meta: ReportMeta
  profile?: OfficeProfile
  elementId: string
  insights?: Array<{ ar: string; en: string; tone: string }>
}) {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const lang = language
  const companyName = lang === 'ar' ? meta.companyNameAr : meta.companyNameEn
  const reportTitle = lang === 'ar' ? model.titleAr : model.titleEn
  const subtitle = lang === 'ar' ? model.subtitleAr : model.subtitleEn
  const officeName = profile ? (lang === 'ar' ? profile.nameAr : profile.nameEn) : t('app.name')
  const owner = profile ? (lang === 'ar' ? profile.ownerNameAr : profile.ownerNameEn) : ''
  const notes = lang === 'ar' ? model.notesAr : model.notesEn
  const exportMeta = {
    companyNameAr: meta.companyNameAr,
    companyNameEn: meta.companyNameEn,
    year: meta.year,
    periodStart: meta.periodStart,
    periodEnd: meta.periodEnd,
    currency: meta.currency,
    approvedBy: meta.approvedBy,
    generatedAt: formatDate(new Date().toISOString(), lang),
  }

  const doPdf = async () => {
    try {
      await exportElementToPdf(elementId, `${reportTitle}-${meta.year}`, lang)
      toast(t('reports.pdfReady'))
    } catch {
      toast(t('reports.noElement'), 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-xs text-text-secondary">{t('reports.exportHint')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Download className="h-4 w-4" />} onClick={doPdf}>
            {t('actions.exportPdf')}
          </Button>
          <Button icon={<Printer className="h-4 w-4" />} onClick={() => printElement(elementId)}>
            {t('actions.print')}
          </Button>
          <Button
            icon={<FileSpreadsheet className="h-4 w-4" />}
            onClick={() => {
              exportReportToExcel(model, exportMeta, lang)
              toast(t('actions.exportExcel'))
            }}
          >
            {t('actions.exportExcel')}
          </Button>
        </div>
      </div>

      <div id={elementId} className="print-area overflow-hidden rounded-2xl border border-border bg-white text-slate-900 shadow-soft">
        <div className="border-b-4 border-slate-900/80 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-center gap-3">
              {profile?.logoDataUrl ? (
                <img src={profile.logoDataUrl} alt="logo" className="h-14 w-14 rounded-xl object-contain" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-lg font-black text-white">C.F.C</div>
              )}
              <div>
                <p className="text-base font-extrabold leading-tight">{officeName}</p>
                {owner && <p className="text-xs text-slate-600">{owner}</p>}
                {profile?.phone && (
                  <p className="text-[11px] text-slate-500">
                    {profile.phone} {profile.email ? `· ${profile.email}` : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="text-end">
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">Financial Statements</p>
              <p className="mt-1 text-xl font-extrabold">{reportTitle}</p>
              <p className="text-xs text-slate-600">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="font-semibold text-slate-500">{t('common.company')}: </span>
            {companyName}
          </div>
          <div>
            <span className="font-semibold text-slate-500">{t('common.year')}: </span>
            {meta.year}
          </div>
          <div>
            <span className="font-semibold text-slate-500">{t('common.period')}: </span>
            {meta.periodStart} — {meta.periodEnd}
          </div>
          <div>
            <span className="font-semibold text-slate-500">{t('common.currency')}: </span>
            {meta.currency}
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6">
          {model.sections.map((section, sectionIndex) => (
            <div key={`${section.titleAr}-${sectionIndex}`} className="mb-5 break-inside-avoid">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-3 py-2 text-start text-xs font-bold">{lang === 'ar' ? section.titleAr : section.titleEn}</th>
                    {model.columns === 'debit-credit' ? (
                      <>
                        <th className="w-32 px-3 py-2 text-end text-xs font-bold">{t('common.debit')}</th>
                        <th className="w-32 px-3 py-2 text-end text-xs font-bold">{t('common.credit')}</th>
                      </>
                    ) : model.columns === 'amount-prior' ? (
                      <>
                        <th className="w-36 px-3 py-2 text-end text-xs font-bold">{meta.year}</th>
                        <th className="w-36 px-3 py-2 text-end text-xs font-bold">{t('common.prior')}</th>
                      </>
                    ) : (
                      <th className="w-40 px-3 py-2 text-end text-xs font-bold">{t('common.amount')}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, rowIndex) => {
                    const label = lang === 'ar' ? row.labelAr : row.labelEn
                    const bold = row.isTotal || row.isSubtotal || row.isHeader
                    return (
                      <tr
                        key={`${row.labelAr}-${rowIndex}`}
                        className={
                          row.isTotal
                            ? 'border-y border-slate-300 bg-slate-100 font-extrabold'
                            : row.isSubtotal
                              ? 'border-y border-slate-200 bg-slate-50 font-bold'
                              : row.isHeader
                                ? 'bg-slate-50/70 font-bold text-slate-700'
                                : 'border-b border-slate-100'
                        }
                      >
                        <td className={`px-3 py-1.5 ${bold ? 'font-bold' : ''}`} style={{ paddingInlineStart: `${12 + (row.indent || 0) * 18}px` }}>
                          {label}
                        </td>
                        {model.columns === 'debit-credit' ? (
                          <>
                            <td className="px-3 py-1.5 text-end tabular-nums">{row.debit !== undefined ? formatNumber(row.debit, lang) : ''}</td>
                            <td className="px-3 py-1.5 text-end tabular-nums">{row.credit !== undefined ? formatNumber(row.credit, lang) : ''}</td>
                          </>
                        ) : model.columns === 'amount-prior' ? (
                          <>
                            <td className="px-3 py-1.5 text-end tabular-nums">
                              {row.amount !== undefined ? <RowAmount value={row.amount} currency={meta.currency} lang={lang} negative={row.isNegative} /> : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-end tabular-nums text-slate-500">
                              {row.prior !== undefined ? <RowAmount value={row.prior} currency={meta.currency} lang={lang} negative={row.isNegative} /> : '—'}
                            </td>
                          </>
                        ) : (
                          <td className="px-3 py-1.5 text-end tabular-nums">
                            {row.amount !== undefined ? <RowAmount value={row.amount} currency={meta.currency} lang={lang} negative={row.isNegative} /> : '—'}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {model.columns === 'amount-prior' && (
            <p className="mb-4 text-[11px] italic text-slate-500">
              {lang === 'ar'
                ? 'أرقام السنة السابقة معروضة للمقارنة فقط وتُستخرج من ميزان المراجعة المعتمد للسنة السابقة.'
                : 'Prior-year figures are presented for comparison only and are drawn from the prior-year approved trial balance.'}
            </p>
          )}

          {insights && insights.length > 0 && (
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700">
                <ShieldCheck className="h-4 w-4" /> {t('reports.insights')}
              </p>
              <ul className="space-y-1.5 text-xs leading-5 text-slate-700">
                {insights.map((insight, i) => (
                  <li key={i} className="flex gap-2">
                    <span className={insight.tone === 'negative' ? 'text-red-600' : insight.tone === 'warning' ? 'text-amber-600' : 'text-emerald-700'}>•</span>
                    <span>{lang === 'ar' ? insight.ar : insight.en}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-1.5 text-xs font-bold text-slate-700">{t('reports.notes')}</p>
            <ol className="list-decimal space-y-1 ps-4 text-[11px] leading-5 text-slate-600">
              {notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ol>
          </div>

          <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 text-xs text-slate-700 sm:grid-cols-3">
            <div>
              <p className="font-bold">{t('reports.signaturePrepared')}</p>
              <p className="mt-1">{t('reports.signatureOffice')}</p>
              <p className="mt-6 border-t border-slate-300 pt-1 text-[11px] text-slate-500">
                {t('common.generatedAt')}: {formatDate(new Date().toISOString(), lang)}
              </p>
            </div>
            <div>
              <p className="font-bold">{t('reports.signatureReviewed')}</p>
              <p className="mt-1">{meta.approvedBy || '—'}</p>
              <p className="mt-6 border-t border-slate-300 pt-1 text-[11px] text-slate-500">{meta.approvedAt ? formatDate(meta.approvedAt, lang) : '—'}</p>
            </div>
            <div className="flex flex-col justify-end">
              <p className="rounded-lg border border-slate-300 px-3 py-2 text-[11px]">
                {t('common.currency')}: <strong>{meta.currency}</strong>
              </p>
              <p className="mt-2 text-[10px] text-slate-500">C.F.C</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function reportTotals(model: ReportModel) {
  const rows = model.sections.flatMap((s) => s.rows)
  return {
    debit: r2(rows.reduce((sum, row) => sum + (row.debit || 0), 0)),
    credit: r2(rows.reduce((sum, row) => sum + (row.credit || 0), 0)),
  }
}
