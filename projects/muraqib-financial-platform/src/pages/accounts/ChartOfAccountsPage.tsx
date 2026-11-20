import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from "@/lib/liveQuery"
import { useTranslation } from 'react-i18next'
import { BookOpen, Plus, Search, Pencil, Trash2, RefreshCw, Network } from 'lucide-react'
import { db, type Account, type Company } from '@/lib/db'
import type { AccountNature, AccountType } from '@/types'
import { ACCOUNT_TYPES } from '@/types'
import { syncAccountsFromLines } from '@/services/account.service'
import { generateTemplateForCompany } from '@/data/trialBalanceTemplates'
import { sectionOptions } from '@/lib/finance'
import { accountLevel, accountNature } from '@/data/trialBalanceTemplates'
import { logAudit } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { useI18nStore } from '@/stores/i18n.store'
import { useCompanies, usePersistedSelection, readStoredCompany, CompanySelect } from '@/components/CompanySelector'
import { PageHeader, Card, Button, IconButton, Modal, Field, inputClass, EmptyState, Badge, toast, Toggle } from '@/components/ui'
import { pick } from '@/lib/format'

export function ChartOfAccountsPage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const user = useAuthStore((s) => s.user)
  const lang = language
  const companies = useCompanies() || []
  const [companyId, setCompanyId] = useState<number | undefined>(readStoredCompany())
  usePersistedSelection(companyId, setCompanyId)

  useEffect(() => {
    if (!companyId && companies.length) setCompanyId(companies[0].id)
  }, [companies, companyId])

  const company = companies.find((c) => c.id === companyId)
  const accounts = useLiveQuery(() => (companyId ? db.accounts.where({ companyId }).sortBy('code') : []), [companyId]) || []
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<Partial<Account>>({})

  const sections = useMemo(() => sectionOptions(), [])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return accounts.filter((a) => {
      if (typeFilter && a.type !== typeFilter) return false
      if (!q) return true
      return `${a.code} ${a.nameAr} ${a.nameEn}`.toLowerCase().includes(q)
    })
  }, [accounts, search, typeFilter])

  const openCreate = () => {
    setEditing(null)
    setForm({ companyId, code: '', nameAr: '', nameEn: '', parentCode: '', type: 'asset', section: 'asset_current', level: 3, nature: 'debit', isActive: true, isSystem: false, allowPosting: true })
    setModalOpen(true)
  }

  const openEdit = (account: Account) => {
    setEditing(account)
    setForm({ ...account })
    setModalOpen(true)
  }

  const save = async () => {
    if (!companyId || !form.code || !form.nameAr || !form.nameEn) {
      toast(t('common.required'), 'warning')
      return
    }
    setBusy(true)
    try {
      const now = new Date().toISOString()
      if (editing) {
        await db.accounts.update(editing.id!, { ...form, updatedAt: now })
        await logAudit('update', 'account', editing.id, `تعديل حساب ${form.code}`, `Updated account ${form.code}`, user?.fullNameAr)
      } else {
        await db.accounts.add({
          ...form,
          companyId,
          nameAr: form.nameAr,
          nameEn: form.nameEn,
          code: form.code,
          type: (form.type || 'asset') as AccountType,
          nature: (form.nature || accountNature((form.type || 'asset') as AccountType)) as AccountNature,
          level: form.level || accountLevel(form.code),
          isActive: form.isActive ?? true,
          allowPosting: form.allowPosting ?? true,
          isSystem: false,
          createdAt: now,
          updatedAt: now,
        } as Account)
        await logAudit('create', 'account', undefined, `إضافة حساب ${form.code}`, `Added account ${form.code}`, user?.fullNameAr)
      }
      toast(t('common.saved'))
      setModalOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (account: Account) => {
    const used = await db.trialBalanceLines.where({ companyId: companyId!, code: account.code }).count()
    if (used > 0) {
      toast(t('accounts.deleteBlocked'), 'warning')
      return
    }
    if (!window.confirm(t('common.confirmDelete'))) return
    await db.accounts.delete(account.id!)
    await logAudit('delete', 'account', account.id, `حذف حساب ${account.code}`, `Deleted account ${account.code}`, user?.fullNameAr)
    toast(t('common.deleted'))
  }

  const sync = async () => {
    if (!company) return
    await syncAccountsFromLines(company.id!, generateTemplateForCompany(company as Company))
    toast(t('accounts.syncDone'))
  }

  const set = <K extends keyof Account>(key: K, value: Account[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Accounts"
        icon={<BookOpen className="h-6 w-6" />}
        title={t('accounts.title')}
        subtitle={t('accounts.subtitle')}
        actions={
          <>
            {company && <Button icon={<RefreshCw className="h-4 w-4" />} onClick={sync}>{t('accounts.sync')}</Button>}
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate} disabled={!companyId}>{t('accounts.add')}</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <CompanySelect companies={companies} value={companyId} onChange={setCompanyId} label={t('common.company')} className="w-full sm:w-80" />
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input className={`${inputClass} ps-9`} placeholder={t('accounts.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={`${inputClass} w-full sm:w-52`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">{t('accounts.type')}</option>
          {ACCOUNT_TYPES.map((a) => <option key={a.value} value={a.value}>{lang === 'ar' ? a.labelAr : a.labelEn}</option>)}
        </select>
      </div>

      {!companyId ? (
        <EmptyState icon={<Network className="h-6 w-6" />} title={t('common.selectCompany')} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-6 w-6" />} title={t('accounts.empty')} action={<Button variant="primary" icon={<RefreshCw className="h-4 w-4" />} onClick={sync}>{t('accounts.sync')}</Button>} />
      ) : (
        <Card bodyClassName="p-0">
          <div className="max-h-[calc(100vh-320px)] overflow-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-surface-2 text-[11px] uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-4 py-2.5 text-start">{t('accounts.code')}</th>
                  <th className="px-4 py-2.5 text-start">{t('accounts.nameAr')}</th>
                  <th className="px-4 py-2.5 text-start">{t('accounts.nameEn')}</th>
                  <th className="px-4 py-2.5 text-start">{t('accounts.type')}</th>
                  <th className="px-4 py-2.5 text-start">{t('accounts.section')}</th>
                  <th className="px-4 py-2.5 text-start">{t('accounts.nature')}</th>
                  <th className="px-4 py-2.5 text-center">{t('accounts.active')}</th>
                  <th className="px-4 py-2.5 text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((account) => (
                  <tr key={account.id} className="border-t border-border/70 hover:bg-surface-2/40">
                    <td className="px-4 py-2 font-mono text-xs font-semibold text-primary" style={{ paddingInlineStart: `${16 + Math.max(0, (account.level || 1) - 1) * 12}px` }}>{account.code}</td>
                    <td className="px-4 py-2 text-xs">{account.nameAr}</td>
                    <td className="px-4 py-2 text-xs text-text-secondary">{account.nameEn}</td>
                    <td className="px-4 py-2"><Badge tone={account.type === 'asset' ? 'primary' : account.type === 'liability' ? 'danger' : account.type === 'equity' ? 'info' : account.type === 'revenue' ? 'success' : 'warning'}>{ACCOUNT_TYPES.find((a) => a.value === account.type)?.[lang === 'ar' ? 'labelAr' : 'labelEn']}</Badge></td>
                    <td className="px-4 py-2 text-[11px] text-text-secondary">{pick(sections.find((s) => s.key === account.section)?.labelAr, sections.find((s) => s.key === account.section)?.labelEn, lang)}</td>
                    <td className="px-4 py-2 text-[11px]">{t(`accounts.nature${account.nature === 'debit' ? 'Debit' : account.nature === 'credit' ? 'Credit' : 'Both'}`)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-block h-2 w-2 rounded-full ${account.isActive ? 'bg-accent' : 'bg-border'}`} />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-0.5">
                        <IconButton title={t('actions.edit')} onClick={() => openEdit(account)}><Pencil className="h-3.5 w-3.5" /></IconButton>
                        <IconButton title={t('actions.delete')} tone="danger" onClick={() => remove(account)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('accounts.edit') : t('accounts.new')}
        wide
        footer={<><Button onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button><Button variant="primary" onClick={save} disabled={busy}>{t('actions.save')}</Button></>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('accounts.code')} required><input className={inputClass} value={form.code || ''} onChange={(e) => set('code', e.target.value)} /></Field>
          <Field label={t('accounts.parent')}><input className={inputClass} value={form.parentCode || ''} onChange={(e) => set('parentCode', e.target.value)} /></Field>
          <Field label={t('accounts.nameAr')} required><input className={inputClass} value={form.nameAr || ''} onChange={(e) => set('nameAr', e.target.value)} /></Field>
          <Field label={t('accounts.nameEn')} required><input className={inputClass} value={form.nameEn || ''} onChange={(e) => set('nameEn', e.target.value)} /></Field>
          <Field label={t('accounts.type')}>
            <select className={inputClass} value={form.type || 'asset'} onChange={(e) => { const type = e.target.value as AccountType; set('type', type); set('nature', accountNature(type)) }}>
              {ACCOUNT_TYPES.map((a) => <option key={a.value} value={a.value}>{lang === 'ar' ? a.labelAr : a.labelEn}</option>)}
            </select>
          </Field>
          <Field label={t('accounts.section')}>
            <select className={inputClass} value={form.section || ''} onChange={(e) => set('section', e.target.value)}>
              {sections.map((s) => <option key={s.key} value={s.key}>{pick(s.labelAr, s.labelEn, lang)}</option>)}
            </select>
          </Field>
          <Field label={t('accounts.nature')}>
            <select className={inputClass} value={form.nature || 'debit'} onChange={(e) => set('nature', e.target.value as AccountNature)}>
              {(['debit', 'credit', 'both'] as AccountNature[]).map((n) => <option key={n} value={n}>{t(`accounts.nature${n === 'debit' ? 'Debit' : n === 'credit' ? 'Credit' : 'Both'}`)}</option>)}
            </select>
          </Field>
          <Field label={t('accounts.level')}><input type="number" className={inputClass} value={form.level || 1} onChange={(e) => set('level', Number(e.target.value))} /></Field>
          <div className="flex items-center gap-6 md:col-span-2">
            <Toggle checked={!!form.isActive} onChange={(v) => set('isActive', v)} label={t('accounts.active')} />
            <Toggle checked={!!form.allowPosting} onChange={(v) => set('allowPosting', v)} label={t('accounts.posting')} />
          </div>
        </div>
      </Modal>
    </div>
  )
}

