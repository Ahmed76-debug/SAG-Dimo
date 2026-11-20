import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from "@/lib/liveQuery"
import {
  ShieldCheck, CheckCircle2, XCircle, AlertTriangle, FileText, Eye,
  Download, CalendarClock, UserRound, MessageSquare, Check,
} from 'lucide-react'
import { db } from '@/lib/db'
import type { ApprovalStatus } from '@/types'
import { approveTrialBalance, rejectTrialBalance, getTrialBalanceDetail, listTrialBalances } from '@/services/tb.service'
import { exportTrialBalanceLinesToExcel } from '@/lib/exports'
import { formatMoney, formatDateTime, formatDate, pick } from '@/lib/format'
import { useAuthStore } from '@/stores/auth.store'
import { useI18nStore } from '@/stores/i18n.store'
import { PageHeader, Card, Button, Badge, Field, inputClass, EmptyState, toast, SectionCard } from '@/components/ui'
import { cn } from '@/lib/utils'

const STATUS_TABS: Array<{ key: ApprovalStatus | 'all'; label: string }> = [
  { key: 'pending_approval', label: 'review.pending' },
  { key: 'approved', label: 'review.approved' },
  { key: 'rejected', label: 'review.rejected' },
  { key: 'draft', label: 'review.draft' },
  { key: 'all', label: 'review.all' },
]

export function TrialBalanceReviewPage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const user = useAuthStore((s) => s.user)
  const lang = language
  const [params] = useSearchParams()
  const imports = useLiveQuery(() => listTrialBalances(), []) || []
  const companies = useLiveQuery(() => db.companies.toArray(), []) || []
  const [status, setStatus] = useState<ApprovalStatus | 'all'>('pending_approval')
  const [selectedId, setSelectedId] = useState<number | undefined>(() => {
    const raw = params.get('id')
    return raw ? Number(raw) : undefined
  })
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => imports.filter((i) => status === 'all' || i.status === status), [imports, status])
  const selected = imports.find((i) => i.id === selectedId)
  const detail = useLiveQuery(() => (selectedId ? getTrialBalanceDetail(selectedId) : undefined), [selectedId])
  const lines = detail?.lines || []
  const company = selected ? companies.find((c) => c.id === selected.companyId) : undefined
  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies])
  const canReview = user?.role === 'admin' || user?.role === 'reviewer'
  const isPending = selected?.status === 'pending_approval'

  useEffect(() => {
    if (!selectedId && filtered.length) setSelectedId(filtered[0].id)
  }, [filtered, selectedId])

  useEffect(() => {
    setNotes(detail?.header?.reviewNotes || '')
  }, [detail?.header?.id, detail?.header?.reviewNotes])

  const approve = async () => {
    if (!selected || !user) return
    if (!window.confirm(t('tb.approveConfirm'))) return
    setBusy(true)
    try {
      await approveTrialBalance(selected.id!, { id: user.id, nameAr: user.fullNameAr, nameEn: user.fullNameEn }, notes)
      toast(t('tb.approvedSuccess'))
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      toast(message === 'UNBALANCED_TB' ? t('tb.cannotApprove') : t('common.noData'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    if (!selected || !user) return
    if (!notes.trim()) {
      toast(t('review.noteRequired'), 'warning')
      return
    }
    if (!window.confirm(t('review.rejectConfirm'))) return
    setBusy(true)
    try {
      await rejectTrialBalance(selected.id!, { id: user.id, nameAr: user.fullNameAr, nameEn: user.fullNameEn }, notes)
      toast(t('tb.rejectedSuccess'))
    } finally {
      setBusy(false)
    }
  }

  const checks = selected
    ? [
        { label: t('review.check1'), ok: selected.isBalanced },
        { label: t('review.check2'), ok: lines.every((l) => ['asset', 'liability', 'equity', 'revenue', 'expense'].includes(l.type)) && lines.length > 0 },
        { label: t('review.check3'), ok: lines.every((l) => !(l.debit > 0 && l.credit > 0)) },
        { label: t('review.check4'), ok: true },
        { label: t('review.check5'), ok: !!selected.reviewNotes || notes.trim().length > 0 },
      ]
    : []

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Assurance"
        icon={<ShieldCheck className="h-6 w-6" />}
        title={t('review.title')}
        subtitle={t('review.subtitle')}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => {
          const count = imports.filter((i) => tab.key === 'all' || i.status === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => { setStatus(tab.key); setSelectedId(undefined) }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition',
                status === tab.key ? 'border-primary/30 bg-primary text-primary-foreground' : 'border-border bg-surface text-text-secondary hover:bg-surface-2',
              )}
            >
              {t(tab.label)} <span className={cn('rounded-md px-1.5 py-0.5 text-[10px]', status === tab.key ? 'bg-white/20' : 'bg-surface-2')}>{count}</span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Card bodyClassName="p-0" className="self-start">
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4"><EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title={t('review.empty')} /></div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((item) => {
                  const c = companyMap.get(item.companyId)
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={cn('w-full px-4 py-3 text-start transition', selectedId === item.id ? 'bg-primary/5' : 'hover:bg-surface-2/60')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold">{c ? pick(c.nameAr, c.nameEn, lang) : '—'}</p>
                          <p className="mt-0.5 text-[10px] text-text-secondary">{item.fiscalYear} · {item.lineCount} {t('tb.lineCount')}</p>
                        </div>
                        <Badge tone={item.status === 'approved' ? 'success' : item.status === 'pending_approval' ? 'warning' : item.status === 'rejected' ? 'danger' : 'muted'}>
                          {t(`status.${item.status}`)}
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-text-secondary">
                        <span>{formatDate(item.createdAt, lang)}</span>
                        <span className={item.isBalanced ? 'text-accent' : 'text-danger'}>{item.isBalanced ? t('status.balanced') : t('status.unbalanced')}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        {!selected ? (
          <Card><div className="p-10"><EmptyState icon={<FileText className="h-6 w-6" />} title={t('review.selectRow')} /></div></Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold">{company ? pick(company.nameAr, company.nameEn, lang) : '—'}</h2>
                    <Badge tone={selected.status === 'approved' ? 'success' : selected.status === 'pending_approval' ? 'warning' : selected.status === 'rejected' ? 'danger' : 'muted'}>{t(`status.${selected.status}`)}</Badge>
                    <Badge tone={selected.isBalanced ? 'success' : 'danger'}>{selected.isBalanced ? t('status.balanced') : t('status.unbalanced')}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-text-secondary">{selected.fiscalYear} · {selected.periodStart} — {selected.periodEnd} · {selected.lineCount} {t('tb.lineCount')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button icon={<Download className="h-4 w-4" />} onClick={() => exportTrialBalanceLinesToExcel(lines, company ? pick(company.nameAr, company.nameEn, lang) : '', selected.fiscalYear, lang)}>{t('actions.exportExcel')}</Button>
                  <Link to={`/trialbalance/import?id=${selected.id}`}><Button icon={<Eye className="h-4 w-4" />}>{t('common.view')}</Button></Link>
                </div>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <InfoTile label={t('tb.totalDebit')} value={formatMoney(selected.totalDebit, company?.baseCurrency, lang)} />
                <InfoTile label={t('tb.totalCredit')} value={formatMoney(selected.totalCredit, company?.baseCurrency, lang)} />
                <InfoTile label={t('tb.difference')} value={formatMoney(Math.abs(selected.totalDebit - selected.totalCredit), company?.baseCurrency, lang)} tone={selected.isBalanced ? 'text-accent' : 'text-danger'} />
                <InfoTile label={t('tb.source')} value={t(`tb.source${selected.source === 'excel_import' ? 'Excel' : selected.source === 'cfo_portal' ? 'Portal' : selected.source === 'generated_template' ? 'Generated' : selected.source === 'archive_restore' ? 'Archive' : 'Direct'}`)} />
              </div>
              <div className="grid gap-3 border-t border-border bg-surface-2/40 px-5 py-3 text-[11px] text-text-secondary sm:grid-cols-3">
                <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> {t('tb.submitter')}: <strong className="text-text">{selected.submittedByName || '—'}</strong></span>
                <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> {t('common.createdAt')}: <strong className="text-text">{formatDateTime(selected.createdAt, lang)}</strong></span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {t('tb.reviewer')}: <strong className="text-text">{selected.reviewedByName || '—'}</strong></span>
              </div>
            </Card>

            {isPending && canReview && (
              <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                <SectionCard title={t('review.checklist')} bodyClassName="p-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {checks.map((check) => (
                      <div key={check.label} className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-5', check.ok ? 'border-accent/25 bg-accent/5 text-text' : 'border-danger/25 bg-danger/5 text-text')}>
                        {check.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
                        {check.label}
                      </div>
                    ))}
                  </div>
                  <Field label={t('review.reviewNotes')} className="mt-4">
                    <textarea className={`${inputClass} min-h-[100px]`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('review.noteRequired')} />
                  </Field>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="success" icon={<Check className="h-4 w-4" />} onClick={approve} disabled={busy || !selected.isBalanced}>{t('review.approve')}</Button>
                    <Button variant="danger" icon={<XCircle className="h-4 w-4" />} onClick={reject} disabled={busy}>{t('review.reject')}</Button>
                  </div>
                  <p className="mt-2 text-[11px] text-text-secondary">{t('tb.approveConfirm')}</p>
                </SectionCard>

                <Card>
                  <div className="p-4">
                    <p className="flex items-center gap-2 text-sm font-bold"><MessageSquare className="h-4 w-4 text-primary" /> {t('tb.approvalNote')}</p>
                    <p className="mt-2 text-[11px] leading-5 text-text-secondary">{t('review.checklist')}</p>
                    <div className="mt-3 space-y-2 text-[11px]">
                      <CheckRow ok={selected.isBalanced} label={t('review.checkBalanced')} />
                      <CheckRow ok={checks.every((c) => c.ok)} label={t('review.checkSections')} />
                      <CheckRow ok={!!selected.submittedByName} label={t('review.checkAudit')} />
                    </div>
                    <div className="mt-3 rounded-xl bg-surface-2/60 p-3 text-[10px] leading-4 text-text-secondary">
                      {selected.isBalanced ? t('tb.balanced') : t('tb.cannotApprove')}
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {selected.status === 'approved' && (
              <Card className="border-accent/30 bg-accent/5">
                <div className="flex items-center gap-3 p-4">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-xs font-bold">{t('tb.approvedSuccess')}</p>
                    <p className="mt-0.5 text-[11px] text-text-secondary">{selected.reviewedByName} · {selected.reviewedAt ? formatDateTime(selected.reviewedAt, lang) : ''}</p>
                  </div>
                </div>
              </Card>
            )}
            {selected.status === 'rejected' && selected.reviewNotes && (
              <Card className="border-danger/30 bg-danger/5">
                <div className="flex items-start gap-3 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-danger" />
                  <div>
                    <p className="text-xs font-bold">{t('review.rejected')}</p>
                    <p className="mt-0.5 text-[11px] leading-5 text-text-secondary">{selected.reviewNotes}</p>
                  </div>
                </div>
              </Card>
            )}

            <SectionCard title={t('review.viewLines')} subtitle={`${lines.length} ${t('tb.lineCount')}`} bodyClassName="p-0">
              <div className="max-h-[440px] overflow-auto">
                <table className="w-full min-w-[700px] border-collapse text-sm">
                  <thead className="sticky top-0 bg-surface-2 text-[11px] uppercase tracking-wide text-text-secondary">
                    <tr>
                      <th className="px-3 py-2 text-start">{t('tb.code')}</th>
                      <th className="px-3 py-2 text-start">{t('tb.nameAr')}</th>
                      <th className="px-3 py-2 text-start">{t('tb.section')}</th>
                      <th className="px-3 py-2 text-end">{t('tb.debit')}</th>
                      <th className="px-3 py-2 text-end">{t('tb.credit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-t border-border/60">
                        <td className="px-3 py-1.5 font-mono text-xs text-primary">{line.code}</td>
                        <td className="px-3 py-1.5 text-xs">{pick(line.nameAr, line.nameEn, lang)}</td>
                        <td className="px-3 py-1.5 text-[10px] text-text-secondary">{line.section || '—'}</td>
                        <td className="px-3 py-1.5 text-end text-xs tabular-nums">{line.debit ? formatMoney(line.debit, company?.baseCurrency, lang) : '—'}</td>
                        <td className="px-3 py-1.5 text-end text-xs tabular-nums">{line.credit ? formatMoney(line.credit, company?.baseCurrency, lang) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoTile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 px-3 py-2.5">
      <p className="text-[10px] text-text-secondary">{label}</p>
      <p className={`mt-0.5 text-xs font-bold tabular-nums ${tone || ''}`}>{value}</p>
    </div>
  )
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-text-secondary">{label}</span>
      {ok ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <XCircle className="h-4 w-4 text-danger" />}
    </div>
  )
}


