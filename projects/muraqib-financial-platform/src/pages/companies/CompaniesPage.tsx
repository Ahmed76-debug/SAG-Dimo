import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from "@/lib/liveQuery"
import { useTranslation } from 'react-i18next'
import {
  Building2, Plus, Search, Pencil, Trash2, FileSpreadsheet, BarChart3, Mail, Phone,
  MapPin, Filter, Globe2, Landmark,
} from 'lucide-react'
import { db, type Company } from '@/lib/db'
import { CURRENCIES, COMPANY_ACTIVITIES, COMPANY_SIZES, LEGAL_FORMS, type CompanyActivity, type CompanySize, type CurrencyCode, type LegalForm } from '@/types'
import { initializeChartOfAccounts } from '@/services/account.service'
import { logAudit } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { useI18nStore } from '@/stores/i18n.store'
import {
  PageHeader, Card, Badge, Button, IconButton, Modal, Field, inputClass, EmptyState, toast,
} from '@/components/ui'
import { formatDate, pick } from '@/lib/format'

const emptyForm: Omit<Company, 'id' | 'createdAt' | 'updatedAt'> = {
  code: '',
  nameAr: '',
  nameEn: '',
  legalForm: 'llc',
  size: 'medium',
  activity: 'commercial',
  activityDetailsAr: '',
  activityDetailsEn: '',
  taxId: '',
  registrationNo: '',
  phone: '',
  email: '',
  addressAr: '',
  addressEn: '',
  baseCurrency: 'EGP',
  fiscalYearStart: `${new Date().getFullYear()}-01-01`,
  fiscalYearEnd: `${new Date().getFullYear()}-12-31`,
  status: 'active',
  notes: '',
}

export function CompaniesPage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const user = useAuthStore((s) => s.user)
  const lang = language
  const companies = useLiveQuery(() => db.companies.orderBy('code').toArray(), []) || []
  const approvedImports = useLiveQuery(() => db.trialBalanceImports.where({ status: 'approved' }).toArray(), []) || []
  const [search, setSearch] = useState('')
  const [legal, setLegal] = useState('')
  const [size, setSize] = useState('')
  const [activity, setActivity] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return companies.filter((c) => {
      if (legal && c.legalForm !== legal) return false
      if (size && c.size !== size) return false
      if (activity && c.activity !== activity) return false
      if (!q) return true
      return [c.nameAr, c.nameEn, c.code, c.taxId, c.registrationNo].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    })
  }, [companies, search, legal, size, activity])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, code: `MFC-${String(companies.length + 1).padStart(3, '0')}` })
    setModalOpen(true)
  }

  const openEdit = (company: Company) => {
    setEditing(company)
    setForm({
      code: company.code,
      nameAr: company.nameAr,
      nameEn: company.nameEn,
      legalForm: company.legalForm,
      size: company.size,
      activity: company.activity,
      activityDetailsAr: company.activityDetailsAr || '',
      activityDetailsEn: company.activityDetailsEn || '',
      taxId: company.taxId || '',
      registrationNo: company.registrationNo || '',
      phone: company.phone || '',
      email: company.email || '',
      addressAr: company.addressAr || '',
      addressEn: company.addressEn || '',
      baseCurrency: company.baseCurrency,
      fiscalYearStart: company.fiscalYearStart,
      fiscalYearEnd: company.fiscalYearEnd || '',
      status: company.status,
      notes: company.notes || '',
    })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.nameAr.trim() || !form.nameEn.trim() || !form.code.trim()) {
      toast(t('common.required'), 'warning')
      return
    }
    setBusy(true)
    try {
      const now = new Date().toISOString()
      if (editing) {
        await db.companies.update(editing.id!, { ...form, updatedAt: now })
        await logAudit('update', 'company', editing.id, `تعديل شركة ${form.nameAr}`, `Updated company ${form.nameEn}`, user?.fullNameAr)
        toast(t('common.saved'))
      } else {
        const id = await db.companies.add({ ...form, createdAt: now, updatedAt: now } as Company)
        const company = (await db.companies.get(id))!
        await initializeChartOfAccounts(company)
        await logAudit('create', 'company', id, `إضافة شركة ${form.nameAr}`, `Added company ${form.nameEn}`, user?.fullNameAr)
        toast(t('companies.templateReady'))
      }
      setModalOpen(false)
    } catch {
      toast(t('common.noData'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (company: Company) => {
    if (approvedImports.some((i) => i.companyId === company.id)) {
      toast(t('companies.deleteBlocked'), 'warning')
      return
    }
    if (!window.confirm(t('common.confirmDelete'))) return
    await db.transaction('rw', [db.companies, db.accounts, db.trialBalanceImports, db.trialBalanceLines, db.adjustments, db.reminders, db.archive, db.budgets], async () => {
      const imports = await db.trialBalanceImports.where({ companyId: company.id! }).toArray()
      for (const item of imports) await db.trialBalanceLines.where({ importId: item.id! }).delete()
      await db.trialBalanceImports.where({ companyId: company.id! }).delete()
      await db.accounts.where({ companyId: company.id! }).delete()
      await db.adjustments.where({ companyId: company.id! }).delete()
      await db.reminders.where({ companyId: company.id! }).delete()
      await db.archive.where({ companyId: company.id! }).delete()
      await db.budgets.where({ companyId: company.id! }).delete()
      await db.companies.delete(company.id!)
    })
    await logAudit('delete', 'company', company.id, `حذف شركة ${company.nameAr}`, `Deleted company ${company.nameEn}`, user?.fullNameAr)
    toast(t('companies.deleted'))
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Portfolio"
        icon={<Building2 className="h-6 w-6" />}
        title={t('companies.title')}
        subtitle={t('companies.subtitle')}
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>{t('companies.add')}</Button>}
      />

      <Card className="mb-5" bodyClassName="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input className={`${inputClass} ps-9`} placeholder={t('companies.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className={inputClass} value={legal} onChange={(e) => setLegal(e.target.value)}>
            <option value="">{t('companies.filterLegal')}</option>
            {LEGAL_FORMS.map((f) => <option key={f.value} value={f.value}>{lang === 'ar' ? f.labelAr : f.labelEn}</option>)}
          </select>
          <select className={inputClass} value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="">{t('companies.filterSize')}</option>
            {COMPANY_SIZES.map((s) => <option key={s.value} value={s.value}>{lang === 'ar' ? s.labelAr : s.labelEn}</option>)}
          </select>
          <select className={inputClass} value={activity} onChange={(e) => setActivity(e.target.value)}>
            <option value="">{t('companies.filterActivity')}</option>
            {COMPANY_ACTIVITIES.map((a) => <option key={a.value} value={a.value}>{lang === 'ar' ? a.labelAr : a.labelEn}</option>)}
          </select>
        </div>
        {(search || legal || size || activity) && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-text-secondary">
            <Filter className="h-3.5 w-3.5" /> {filtered.length} / {companies.length}
            <button className="font-semibold text-primary hover:underline" onClick={() => { setSearch(''); setLegal(''); setSize(''); setActivity('') }}>{t('actions.reset')}</button>
          </div>
        )}
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={<Building2 className="h-6 w-6" />} title={t('companies.empty')} action={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>{t('companies.add')}</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((company) => {
            const latestApproved = approvedImports.filter((i) => i.companyId === company.id).sort((a, b) => b.fiscalYear.localeCompare(a.fiscalYear))[0]
            return (
              <Card key={company.id} className="group relative overflow-hidden transition hover:border-primary/30">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/40 via-info/40 to-accent/40" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="primary">{company.code}</Badge>
                        <Badge tone={company.status === 'active' ? 'success' : company.status === 'archived' ? 'muted' : 'danger'}>{t(`status.${company.status}`)}</Badge>
                      </div>
                      <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-6">{lang === 'ar' ? company.nameAr : company.nameEn}</h3>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-text-secondary">{lang === 'ar' ? company.nameEn : company.nameAr}</p>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <IconButton title={t('actions.edit')} onClick={() => openEdit(company)}><Pencil className="h-3.5 w-3.5" /></IconButton>
                      <IconButton title={t('actions.delete')} tone="danger" onClick={() => remove(company)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1"><Landmark className="h-3 w-3" /> {LEGAL_FORMS.find((f) => f.value === company.legalForm)?.[lang === 'ar' ? 'labelAr' : 'labelEn']}</span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1"><Building2 className="h-3 w-3" /> {COMPANY_SIZES.find((f) => f.value === company.size)?.[lang === 'ar' ? 'labelAr' : 'labelEn']}</span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1"><Globe2 className="h-3 w-3" /> {COMPANY_ACTIVITIES.find((f) => f.value === company.activity)?.[lang === 'ar' ? 'labelAr' : 'labelEn']}</span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 font-bold text-primary">{company.baseCurrency}</span>
                  </div>

                  <p className="mt-2 line-clamp-2 min-h-[32px] text-[11px] leading-4 text-text-secondary">{pick(company.activityDetailsAr, company.activityDetailsEn, lang) || t('common.none')}</p>

                  <div className="mt-3 grid gap-1.5 border-t border-border pt-2.5 text-[10px] text-text-secondary">
                    {company.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3" /> {company.phone}</span>}
                    {company.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3" /> {company.email}</span>}
                    {company.addressAr && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {pick(company.addressAr, company.addressEn, lang)}</span>}
                    {company.taxId && <span className="inline-flex items-center gap-1.5"><FileSpreadsheet className="h-3 w-3" /> {company.taxId}</span>}
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-2/70 px-3 py-2 text-[10px]">
                    <span className="text-text-secondary">{t('dashboard.lastApproved')}: <strong className="text-text">{latestApproved?.fiscalYear || t('common.none')}</strong></span>
                    <span className="text-text-secondary">{formatDate(company.createdAt, lang)}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link to={`/trialbalance/generator?company=${company.id}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-2.5 py-2 text-[11px] font-semibold hover:bg-surface-2">
                      <FileSpreadsheet className="h-3.5 w-3.5" /> {t('companies.openTb')}
                    </Link>
                    <Link to={`/reports/income?company=${company.id}${latestApproved ? `&year=${latestApproved.fiscalYear}` : ''}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 px-2.5 py-2 text-[11px] font-semibold text-primary hover:bg-primary/15">
                      <BarChart3 className="h-3.5 w-3.5" /> {t('companies.openReports')}
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('companies.edit') : t('companies.new')}
        subtitle={t('companies.createHint')}
        wide
        footer={
          <>
            <Button onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button variant="primary" onClick={save} disabled={busy}>{busy ? '...' : t('actions.save')}</Button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('companies.code')} required><input className={inputClass} value={form.code} onChange={(e) => set('code', e.target.value)} /></Field>
          <Field label={t('companies.baseCurrency')} required>
            <select className={inputClass} value={form.baseCurrency} onChange={(e) => set('baseCurrency', e.target.value as CurrencyCode)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{lang === 'ar' ? c.nameAr : c.nameEn} ({c.code})</option>
              ))}
            </select>
          </Field>
          <Field label={t('companies.nameAr')} required><input className={inputClass} value={form.nameAr} onChange={(e) => set('nameAr', e.target.value)} /></Field>
          <Field label={t('companies.nameEn')} required><input className={inputClass} value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} /></Field>
          <Field label={t('companies.legalForm')} required>
            <select className={inputClass} value={form.legalForm} onChange={(e) => set('legalForm', e.target.value as LegalForm)}>
              {LEGAL_FORMS.map((f) => <option key={f.value} value={f.value}>{lang === 'ar' ? f.labelAr : f.labelEn}</option>)}
            </select>
          </Field>
          <Field label={t('companies.size')} required>
            <select className={inputClass} value={form.size} onChange={(e) => set('size', e.target.value as CompanySize)}>
              {COMPANY_SIZES.map((s) => <option key={s.value} value={s.value}>{lang === 'ar' ? s.labelAr : s.labelEn}</option>)}
            </select>
          </Field>
          <Field label={t('companies.activity')} required>
            <select className={inputClass} value={form.activity} onChange={(e) => set('activity', e.target.value as CompanyActivity)}>
              {COMPANY_ACTIVITIES.map((a) => <option key={a.value} value={a.value}>{lang === 'ar' ? a.labelAr : a.labelEn}</option>)}
            </select>
          </Field>
          <Field label={t('companies.status')}>
            <select className={inputClass} value={form.status} onChange={(e) => set('status', e.target.value as Company['status'])}>
              {['active', 'archived', 'suspended'].map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
            </select>
          </Field>
          <Field label={t('companies.taxId')}><input className={inputClass} value={form.taxId} onChange={(e) => set('taxId', e.target.value)} /></Field>
          <Field label={t('companies.registrationNo')}><input className={inputClass} value={form.registrationNo} onChange={(e) => set('registrationNo', e.target.value)} /></Field>
          <Field label={t('companies.phone')}><input className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label={t('companies.email')}><input className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label={t('companies.fiscalYearStart')}><input type="date" className={inputClass} value={form.fiscalYearStart} onChange={(e) => set('fiscalYearStart', e.target.value)} /></Field>
          <Field label={t('companies.fiscalYearEnd')}><input type="date" className={inputClass} value={form.fiscalYearEnd || ''} onChange={(e) => set('fiscalYearEnd', e.target.value)} /></Field>
          <Field label={t('companies.activityDetails')} className="md:col-span-2"><input className={inputClass} value={form.activityDetailsAr} onChange={(e) => set('activityDetailsAr', e.target.value)} /></Field>
          <Field label={`${t('companies.activityDetails')} (EN)`} className="md:col-span-2"><input className={inputClass} value={form.activityDetailsEn} onChange={(e) => set('activityDetailsEn', e.target.value)} /></Field>
          <Field label={t('companies.addressAr')}><input className={inputClass} value={form.addressAr} onChange={(e) => set('addressAr', e.target.value)} /></Field>
          <Field label={t('companies.addressEn')}><input className={inputClass} value={form.addressEn} onChange={(e) => set('addressEn', e.target.value)} /></Field>
          <Field label={t('companies.notes')} className="md:col-span-2"><textarea className={`${inputClass} min-h-[80px]`} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  )
}

