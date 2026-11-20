import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from "@/lib/liveQuery"
import {
  SlidersHorizontal, Plus, Pencil, Trash2, CheckCircle2, XCircle, Clock3,
  AlertTriangle, Scale, Save, Send, BookOpen,
} from 'lucide-react'
import { db, type Account, type Adjustment, type AdjustmentLine } from '@/lib/db'
import type { AccountType } from '@/types'
import { ACCOUNT_TYPES } from '@/types'
import {
  approveAdjustment, deleteAdjustment, getAdjustments, rejectAdjustment, saveAdjustment,
} from '@/services/tb.service'
import { sectionLabel } from '@/data/trialBalanceTemplates'
import { formatMoney, formatDate, pick, todayISO } from '@/lib/format'
import { r2 } from '@/lib/exports'
import { useI18nStore } from '@/stores/i18n.store'
import { useAuthStore } from '@/stores/auth.store'
import {
  useCompanies, useCompanyYears, usePersistedSelection, readStoredCompany,
  CompanySelect, YearSelect,
} from '@/components/CompanySelector'
import {
  PageHeader, Card, Button, Badge, Modal, Field, inputClass, EmptyState, toast, IconButton, SectionCard,
} from '@/components/ui'

const blankLine: AdjustmentLine = {
  code: '', nameAr: '', nameEn: '', type: 'expense', section: 'expense_admin', debit: 0, credit: 0,
}

interface FormState {
  date: string
  descriptionAr: string
  descriptionEn: string
  reference: string
  lines: AdjustmentLine[]
}

const blankForm = (): FormState => ({
  date: todayISO(),
  descriptionAr: '',
  descriptionEn: '',
  reference: '',
  lines: [{ ...blankLine }, { ...blankLine }],
})

function statusTone(status: Adjustment['status']) {
  return status === 'approved' ? 'success' : status === 'pending_approval' ? 'warning' : status === 'rejected' ? 'danger' : 'muted'
}

export function AdjustmentsPage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const user = useAuthStore((s) => s.user)
  const lang = language

  const companies = useCompanies() || []
  const [companyId, setCompanyId] = useState<number | undefined>(readStoredCompany())
  const years = useCompanyYears(companyId) || []
  const [year, setYear] = useState(String(new Date().getFullYear()))
  usePersistedSelection(companyId, setCompanyId)

  useEffect(() => {
    if (!companyId && companies.length) setCompanyId(companies[0].id)
  }, [companies, companyId])

  useEffect(() => {
    if (years.length && !years.includes(year)) setYear(years[0])
  }, [years, year])

  const company = companies.find((c) => c.id === companyId)
  const adjustments = useLiveQuery(
    () => (companyId ? getAdjustments(companyId, year) : Promise.resolve([])),
    [companyId, year],
  ) || []
  const accounts = useLiveQuery<Account[]>(
    async () => (companyId ? db.accounts.where({ companyId }).sortBy('code') : []),
    [companyId],
  ) || []

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Adjustment | null>(null)
  const [form, setForm] = useState<FormState>(blankForm)
  const [busy, setBusy] = useState(false)

  const canReview = user?.role === 'admin' || user?.role === 'reviewer'
  const canEdit = user?.role !== 'viewer'
  const totalDebit = useMemo(() => r2(form.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)), [form.lines])
  const totalCredit = useMemo(() => r2(form.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)), [form.lines])
  const difference = r2(totalDebit - totalCredit)
  const balanced = form.lines.filter((l) => l.code.trim()).length >= 2 && totalDebit > 0 && Math.abs(difference) < 0.01

  const openCreate = () => {
    setEditing(null)
    setForm(blankForm())
    setModalOpen(true)
  }

  const openEdit = (adjustment: Adjustment) => {
    setEditing(adjustment)
    setForm({
      date: adjustment.date,
      descriptionAr: adjustment.descriptionAr,
      descriptionEn: adjustment.descriptionEn,
      reference: adjustment.reference || '',
      lines: adjustment.lines.map((l) => ({ ...l })),
    })
    setModalOpen(true)
  }

  const setLine = (index: number, patch: Partial<AdjustmentLine>) => {
    setForm((current) => {
      const lines = current.lines.map((line, i) => {
        if (i !== index) return line
        const next = { ...line, ...patch }
        if (patch.debit !== undefined && Number(patch.debit) > 0) next.credit = 0
        if (patch.credit !== undefined && Number(patch.credit) > 0) next.debit = 0
        return next
      })
      return { ...current, lines }
    })
  }

  const setAccountCode = (index: number, code: string) => {
    const account = accounts.find((a) => a.code === code)
    if (!account) {
      setLine(index, { code, nameAr: '', nameEn: '' })
      return
    }
    setLine(index, {
      code: account.code,
      nameAr: account.nameAr,
      nameEn: account.nameEn,
      type: account.type,
      section: account.section,
    })
  }

  const addLine = () => setForm((current) => ({ ...current, lines: [...current.lines, { ...blankLine }] }))
  const removeLine = (index: number) => setForm((current) => ({ ...current, lines: current.lines.filter((_, i) => i !== index) }))

  const save = async (status: 'draft' | 'pending_approval') => {
    if (!company || !form.descriptionAr.trim()) {
      toast(pick('يرجى إدخال الشركة وبيان القيد بالعربية.', 'Please enter the company and the Arabic description.', lang), 'warning')
      return
    }
    const lines = form.lines.filter((l) => l.code.trim() && (Number(l.debit) > 0 || Number(l.credit) > 0))
    if (lines.length < 2) {
      toast(t('adjustments.minLines'), 'warning')
      return
    }
    if (Math.abs(r2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)) - r2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0))) >= 0.01) {
      toast(t('adjustments.unbalanced', { amount: formatMoney(difference, company.baseCurrency, lang) }), 'error')
      return
    }
    setBusy(true)
    try {
      await saveAdjustment({
        id: editing?.id,
        company,
        year,
        no: editing?.no,
        date: form.date,
        descriptionAr: form.descriptionAr.trim(),
        descriptionEn: form.descriptionEn.trim() || form.descriptionAr.trim(),
        reference: form.reference.trim() || undefined,
        status,
        lines: lines.map((l) => ({
          ...l,
          nameEn: l.nameEn || l.nameAr,
          nameAr: l.nameAr || l.nameEn,
          debit: r2(Number(l.debit) || 0),
          credit: r2(Number(l.credit) || 0),
        })),
        submittedBy: user?.id,
        submittedByName: user?.fullNameAr,
      })
      toast(status === 'pending_approval' ? t('tb.submitted') : t('adjustments.saved'))
      setModalOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      toast(message === 'UNBALANCED_ADJUSTMENT' ? t('adjustments.unbalanced', { amount: difference }) : t('common.noData'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const approve = async (adjustment: Adjustment) => {
    if (!user) return
    setBusy(true)
    try {
      await approveAdjustment(adjustment.id!, { id: user.id, nameAr: user.fullNameAr })
      toast(t('adjustments.approved'))
    } catch {
      toast(t('common.noData'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const reject = async (adjustment: Adjustment) => {
    if (!user) return
    const notes = window.prompt(t('review.reviewNotes'), '')
    if (!notes || !notes.trim()) {
      toast(t('review.noteRequired'), 'warning')
      return
    }
    setBusy(true)
    try {
      await rejectAdjustment(adjustment.id!, { id: user.id, nameAr: user.fullNameAr }, notes.trim())
      toast(t('tb.rejectedSuccess'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (adjustment: Adjustment) => {
    if (!window.confirm(t('common.confirmDelete'))) return
    try {
      await deleteAdjustment(adjustment.id!)
      toast(t('adjustments.deleted'))
    } catch {
      toast(t('common.noData'), 'error')
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Review adjustments"
        icon={<SlidersHorizontal className="h-6 w-6" />}
        title={t('adjustments.title')}
        subtitle={t('adjustments.subtitle')}
        actions={
          canEdit ? (
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate} disabled={!companyId}>
              {t('adjustments.add')}
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <CompanySelect companies={companies} value={companyId} onChange={setCompanyId} label={t('common.company')} className="md:col-span-2" />
          <YearSelect years={years} value={year} onChange={setYear} label={t('common.year')} />
        </div>
      </Card>

      <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs leading-5 text-text-secondary">
        <strong className="text-primary">{t('adjustments.title')}</strong> — {t('adjustments.pendingHint')}
      </div>

      {adjustments.length === 0 ? (
        <EmptyState
          icon={<Scale className="h-6 w-6" />}
          title={t('adjustments.empty')}
          text={t('adjustments.accountHelp')}
          action={canEdit ? <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>{t('adjustments.add')}</Button> : undefined}
        />
      ) : (
        <div className="space-y-4">
          {adjustments.map((adjustment) => (
            <SectionCard
              key={adjustment.id}
              title={adjustment.no}
              subtitle={`${formatDate(adjustment.date, lang)}${adjustment.reference ? ` · ${adjustment.reference}` : ''}`}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(adjustment.status)}>{t(`status.${adjustment.status}`)}</Badge>
                  {canReview && adjustment.status === 'pending_approval' && (
                    <>
                      <Button variant="success" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => approve(adjustment)} disabled={busy}>
                        {t('adjustments.approve')}
                      </Button>
                      <Button variant="danger" icon={<XCircle className="h-4 w-4" />} onClick={() => reject(adjustment)} disabled={busy}>
                        {t('actions.reject')}
                      </Button>
                    </>
                  )}
                  {canEdit && adjustment.status !== 'approved' && (
                    <>
                      <IconButton title={t('actions.edit')} onClick={() => openEdit(adjustment)}><Pencil className="h-4 w-4" /></IconButton>
                      <IconButton title={t('actions.delete')} tone="danger" onClick={() => remove(adjustment)}><Trash2 className="h-4 w-4" /></IconButton>
                    </>
                  )}
                </div>
              }
            >
              <div className="mb-3">
                <p className="text-sm font-semibold">{pick(adjustment.descriptionAr, adjustment.descriptionEn, lang)}</p>
                <p className="mt-1 text-[11px] text-text-secondary">
                  {adjustment.submittedByName ? `${t('tb.submitter')}: ${adjustment.submittedByName}` : ''}
                  {adjustment.reviewedByName ? ` · ${t('common.reviewedBy')}: ${adjustment.reviewedByName}` : ''}
                </p>
                {adjustment.reviewNotes && <p className="mt-1 text-[11px] text-text-secondary">{adjustment.reviewNotes}</p>}
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-2/60">
                      <th className="px-3 py-2 text-start text-xs">{t('adjustments.account')}</th>
                      <th className="px-3 py-2 text-start text-xs">{t('adjustments.debit')}</th>
                      <th className="px-3 py-2 text-start text-xs">{t('adjustments.credit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustment.lines.map((line, index) => (
                      <tr key={`${line.code}-${index}`} className="border-t border-border/60">
                        <td className="px-3 py-2">
                          <span className="font-mono text-xs text-text-secondary">{line.code}</span> — {pick(line.nameAr, line.nameEn, lang)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{line.debit ? formatMoney(line.debit, company?.baseCurrency, lang) : '—'}</td>
                        <td className="px-3 py-2 tabular-nums">{line.credit ? formatMoney(line.credit, company?.baseCurrency, lang) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('adjustments.edit') : t('adjustments.new')}
        subtitle={t('adjustments.subtitle')}
        wide
        footer={
          <>
            <Button onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button icon={<Save className="h-4 w-4" />} onClick={() => save('draft')} disabled={busy}>
              {t('actions.saveDraft')}
            </Button>
            <Button variant="primary" icon={<Send className="h-4 w-4" />} onClick={() => save('pending_approval')} disabled={busy || !balanced}>
              {t('actions.submitReview')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Field label={t('adjustments.date')} required>
            <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label={t('adjustments.reference')}>
            <input className={inputClass} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </Field>
          <Field label={t('adjustments.descriptionAr')} required className="md:col-span-2">
            <input className={inputClass} value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} />
          </Field>
          <Field label={t('adjustments.descriptionEn')} className="md:col-span-4">
            <input className={inputClass} value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} />
          </Field>
        </div>

        <div className="mt-4 rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2/60">
                  <th className="px-2 py-2 text-start text-xs">{t('adjustments.account')}</th>
                  <th className="px-2 py-2 text-start text-xs">{t('common.type')}</th>
                  <th className="px-2 py-2 text-start text-xs">{t('tb.debit')}</th>
                  <th className="px-2 py-2 text-start text-xs">{t('tb.credit')}</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, index) => (
                  <tr key={index} className="border-t border-border/60">
                    <td className="px-2 py-2">
                      <select className={`${inputClass} min-w-[220px]`} value={line.code} onChange={(e) => setAccountCode(index, e.target.value)}>
                        <option value="">{t('common.choose')}</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.code}>{account.code} — {pick(account.nameAr, account.nameEn, lang)}</option>
                        ))}
                        {line.code && !accounts.some((a) => a.code === line.code) && (
                          <option value={line.code}>{line.code} — {pick(line.nameAr, line.nameEn, lang)}</option>
                        )}
                      </select>
                      {line.section && <p className="mt-1 text-[10px] text-text-secondary">{sectionLabel(line.section, lang)}</p>}
                    </td>
                    <td className="px-2 py-2">
                      <select className={`${inputClass} min-w-[120px]`} value={line.type} onChange={(e) => setLine(index, { type: e.target.value as AccountType })}>
                        {ACCOUNT_TYPES.map((type) => <option key={type.value} value={type.value}>{pick(type.labelAr, type.labelEn, lang)}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={`${inputClass} min-w-[110px] text-end tabular-nums`}
                        value={line.debit || ''}
                        onChange={(e) => setLine(index, { debit: Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={`${inputClass} min-w-[110px] text-end tabular-nums`}
                        value={line.credit || ''}
                        onChange={(e) => setLine(index, { credit: Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      {form.lines.length > 2 && (
                        <IconButton title={t('actions.remove')} tone="danger" onClick={() => removeLine(index)}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Button icon={<Plus className="h-4 w-4" />} onClick={addLine}>{t('adjustments.addLine')}</Button>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-text-secondary">{t('tb.totalDebit')}: <strong className="text-text">{formatMoney(totalDebit, company?.baseCurrency, lang)}</strong></span>
            <span className="text-text-secondary">{t('tb.totalCredit')}: <strong className="text-text">{formatMoney(totalCredit, company?.baseCurrency, lang)}</strong></span>
            <Badge tone={balanced ? 'success' : 'warning'}>
              {balanced ? (
                <><CheckCircle2 className="h-3.5 w-3.5" /> {t('adjustments.balanced')}</>
              ) : (
                <><AlertTriangle className="h-3.5 w-3.5" /> {t('adjustments.unbalanced', { amount: formatMoney(difference, company?.baseCurrency, lang) })}</>
              )}
            </Badge>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-[11px] leading-5 text-text-secondary">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {t('adjustments.accountHelp')}
        </div>

        {editing && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-text-secondary">
            <Clock3 className="h-4 w-4" /> {t('adjustments.no')}: <strong className="text-text">{editing.no}</strong>
          </div>
        )}
      </Modal>
    </div>
  )
}

