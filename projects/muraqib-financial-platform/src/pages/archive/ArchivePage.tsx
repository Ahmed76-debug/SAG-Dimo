import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from "@/lib/liveQuery"
import {
  Archive, FolderOpen, Search, RotateCcw, Trash2, Download, Eye, FileText,
  FileSpreadsheet, Scale, Building2, CalendarDays, ShieldCheck, AlertTriangle,
} from 'lucide-react'
import { db, type ArchiveItem } from '@/lib/db'
import { restoreArchiveToDraft } from '@/services/tb.service'
import { exportJsonFile } from '@/lib/exports'
import { logAudit } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { useI18nStore } from '@/stores/i18n.store'
import { formatMoney, formatDate, pick } from '@/lib/format'
import {
  PageHeader, Card, Button, Badge, Modal, EmptyState, toast, IconButton, inputClass, SectionCard,
} from '@/components/ui'

const TYPE_META: Record<ArchiveItem['type'], { icon: typeof Archive; labelKey: string; tone: 'primary' | 'info' | 'success' | 'warning' }> = {
  financial_statements: { icon: FileText, labelKey: 'archive.financial', tone: 'primary' },
  trial_balance: { icon: Scale, labelKey: 'archive.trial', tone: 'success' },
  reports: { icon: FileSpreadsheet, labelKey: 'archive.reports', tone: 'info' },
  documents: { icon: FolderOpen, labelKey: 'archive.documents', tone: 'warning' },
}

export function ArchivePage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const lang = language
  const items = useLiveQuery(async () => (await db.archive.toArray()).sort((a, b) => b.archivedAt.localeCompare(a.archivedAt)), []) || []
  const companies = useLiveQuery(() => db.companies.toArray(), []) || []
  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies])
  const [search, setSearch] = useState('')
  const [type, setType] = useState<ArchiveItem['type'] | 'all'>('all')
  const [companyId, setCompanyId] = useState<string>('')
  const [selected, setSelected] = useState<ArchiveItem | null>(null)
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      if (type !== 'all' && item.type !== type) return false
      if (companyId && item.companyId !== Number(companyId)) return false
      if (!query) return true
      const company = companyMap.get(item.companyId)
      return [item.titleAr, item.titleEn, item.year, company?.nameAr || '', company?.nameEn || '']
        .some((value) => value.toLowerCase().includes(query))
    })
  }, [items, type, companyId, search, companyMap])

  const detail = useMemo(() => {
    if (!selected) return null
    const data = selected.data as {
      lines?: Array<{ code: string; nameAr: string; nameEn: string; debitBase?: number; creditBase?: number; debit?: number; credit?: number }>
      approvedBy?: string
      approvedAt?: string
      totalDebit?: number
      totalCredit?: number
    }
    return {
      lines: data?.lines || [],
      approvedBy: data?.approvedBy,
      approvedAt: data?.approvedAt,
      totalDebit: data?.totalDebit || 0,
      totalCredit: data?.totalCredit || 0,
    }
  }, [selected])

  const restore = async (item: ArchiveItem) => {
    if (!item.id || !user) return
    if (!window.confirm(t('archive.restoreHint'))) return
    setBusy(true)
    try {
      const newImport = await restoreArchiveToDraft(item.id, { id: user.id, nameAr: user.fullNameAr })
      toast(t('archive.restoreDone'))
      setSelected(null)
      navigate(`/trialbalance/review?id=${newImport}`)
    } catch {
      toast(t('common.noData'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (item: ArchiveItem) => {
    if (!item.id) return
    if (!window.confirm(t('common.confirmDelete'))) return
    await db.archive.delete(item.id)
    await logAudit('delete', 'archive', item.id, `حذف نسخة مؤرشفة: ${item.titleAr}`, `Deleted archive item: ${item.titleEn}`, user?.fullNameAr)
    if (selected?.id === item.id) setSelected(null)
    toast(t('archive.deleted'))
  }

  const exportItem = (item: ArchiveItem) => {
    exportJsonFile(item.data, `Archive-${item.year}-${item.companyId}.json`)
    toast(t('archive.exportJson'))
  }

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Institutional memory"
        icon={<Archive className="h-6 w-6" />}
        title={t('archive.title')}
        subtitle={t('archive.subtitle')}
        actions={<Badge tone="primary">{items.length} {pick('نسخة', 'snapshots', lang)}</Badge>}
      />

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-[1fr_200px_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input className={`${inputClass} ps-9`} placeholder={t('archive.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as ArchiveItem['type'] | 'all')}>
            <option value="all">{t('archive.allTypes')}</option>
            <option value="financial_statements">{t('archive.financial')}</option>
            <option value="trial_balance">{t('archive.trial')}</option>
            <option value="reports">{t('archive.reports')}</option>
            <option value="documents">{t('archive.documents')}</option>
          </select>
          <select className={inputClass} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">{t('common.allCompanies')}</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{pick(company.nameAr, company.nameEn, lang)}</option>)}
          </select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={<Archive className="h-6 w-6" />} title={t('archive.empty')} text={t('archive.restoreHint')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((item) => {
            const meta = TYPE_META[item.type]
            const Icon = meta.icon
            const company = companyMap.get(item.companyId)
            return (
              <Card key={item.id} className="group relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/50 via-info/40 to-accent/50" />
                <div className="flex flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={meta.tone}>{t(meta.labelKey)}</Badge>
                          <Badge tone="muted">{item.year}</Badge>
                        </div>
                        <h2 className="mt-1.5 truncate text-sm font-bold">{pick(item.titleAr, item.titleEn, lang)}</h2>
                        <p className="mt-0.5 truncate text-[11px] text-text-secondary">{item.titleEn}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <IconButton title={t('archive.view')} onClick={() => setSelected(item)}><Eye className="h-4 w-4" /></IconButton>
                      <IconButton title={t('archive.exportJson')} onClick={() => exportItem(item)}><Download className="h-4 w-4" /></IconButton>
                      <IconButton title={t('archive.delete')} tone="danger" onClick={() => remove(item)}><Trash2 className="h-4 w-4" /></IconButton>
                    </div>
                  </div>
                  <div className="grid gap-2 text-[11px] text-text-secondary sm:grid-cols-2">
                    <p className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {company ? pick(company.nameAr, company.nameEn, lang) : '—'}</p>
                    <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {t('archive.archiveDate')}: {formatDate(item.archivedAt, lang)}</p>
                    {item.archivedBy && <p className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {t('archive.archivedBy')}: {item.archivedBy}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button icon={<RotateCcw className="h-4 w-4" />} onClick={() => restore(item)} disabled={busy}>{t('archive.restore')}</Button>
                    <Link to={`/reports/income?company=${item.companyId}&year=${item.year}`}>
                      <Button icon={<FileText className="h-4 w-4" />}>{t('archive.linkedReport')}</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={t('archive.detail')}
        subtitle={selected ? `${selected.year} · ${t(TYPE_META[selected.type].labelKey)}` : undefined}
        wide
        footer={
          selected && (
            <>
              <Button onClick={() => setSelected(null)}>{t('common.close')}</Button>
              <Button icon={<Download className="h-4 w-4" />} onClick={() => exportItem(selected)}>{t('archive.exportJson')}</Button>
              <Button variant="primary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => restore(selected)} disabled={busy}>{t('archive.restore')}</Button>
            </>
          )
        }
      >
        {selected && detail && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface-2/30 p-4">
              <h3 className="text-sm font-bold">{pick(selected.titleAr, selected.titleEn, lang)}</h3>
              <p className="mt-1 text-[11px] text-text-secondary">{selected.titleEn}</p>
              <div className="mt-3 grid gap-2 text-[11px] text-text-secondary sm:grid-cols-2">
                <p>{t('common.company')}: {companyMap.get(selected.companyId) ? pick(companyMap.get(selected.companyId)!.nameAr, companyMap.get(selected.companyId)!.nameEn, lang) : '—'}</p>
                <p>{t('common.year')}: {selected.year}</p>
                <p>{t('archive.archiveDate')}: {formatDate(selected.archivedAt, lang)}</p>
                <p>{t('archive.archivedBy')}: {selected.archivedBy || '—'}</p>
                {detail.approvedAt && <p>{t('common.approvedBy')}: {detail.approvedBy || '—'} · {formatDate(detail.approvedAt, lang)}</p>}
              </div>
            </div>

            {detail.lines.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-warning/25 bg-warning/5 px-4 py-3 text-xs text-warning">
                <AlertTriangle className="h-4 w-4" /> {t('archive.noLines')}
              </div>
            ) : (
              <SectionCard title={t('archive.lines')} subtitle={`${detail.lines.length} ${t('tb.lineCount')}`} bodyClassName="p-0">
                <div className="max-h-[46vh] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-surface-2">
                      <tr>
                        <th className="px-3 py-2 text-start font-bold">{t('common.code')}</th>
                        <th className="px-3 py-2 text-start font-bold">{t('common.name')}</th>
                        <th className="px-3 py-2 text-end font-bold">{t('common.debit')}</th>
                        <th className="px-3 py-2 text-end font-bold">{t('common.credit')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((line, index) => (
                        <tr key={`${line.code}-${index}`} className="border-t border-border/60">
                          <td className="px-3 py-1.5 font-mono text-text-secondary">{line.code}</td>
                          <td className="px-3 py-1.5">{pick(line.nameAr, line.nameEn, lang)}</td>
                          <td className="px-3 py-1.5 text-end tabular-nums">{formatMoney(line.debitBase ?? line.debit ?? 0, companyMap.get(selected.companyId)?.baseCurrency, lang)}</td>
                          <td className="px-3 py-1.5 text-end tabular-nums">{formatMoney(line.creditBase ?? line.credit ?? 0, companyMap.get(selected.companyId)?.baseCurrency, lang)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-surface-2/60 font-bold">
                        <td className="px-3 py-2" colSpan={2}>{t('common.total')}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{formatMoney(detail.totalDebit, companyMap.get(selected.companyId)?.baseCurrency, lang)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{formatMoney(detail.totalCredit, companyMap.get(selected.companyId)?.baseCurrency, lang)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </SectionCard>
            )}
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[11px] leading-5 text-text-secondary">{t('archive.restoreHint')}</div>
          </div>
        )}
      </Modal>
    </div>
  )
}

