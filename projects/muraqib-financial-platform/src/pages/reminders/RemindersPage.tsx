import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from "@/lib/liveQuery"
import {
  CalendarClock, Bell, Plus, Pencil, Trash2, CheckCircle2, Clock3, XCircle,
  Building2, CalendarDays, BellRing, AlertTriangle,
} from 'lucide-react'
import { db, type Reminder } from '@/lib/db'
import { logAudit } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { useI18nStore } from '@/stores/i18n.store'
import { formatDate, pick, todayISO, daysBetween } from '@/lib/format'
import {
  PageHeader, Card, Button, Badge, Field, inputClass, EmptyState, Modal, IconButton, toast,
} from '@/components/ui'

const TYPES: Array<{ value: Reminder['type']; key: string }> = [
  { value: 'review', key: 'reminders.review' },
  { value: 'meeting', key: 'reminders.meeting' },
  { value: 'deadline', key: 'reminders.deadline' },
  { value: 'followup', key: 'reminders.followup' },
  { value: 'other', key: 'reminders.other' },
]

interface ReminderForm {
  titleAr: string
  titleEn: string
  descriptionAr: string
  descriptionEn: string
  companyId: string
  dueDate: string
  remindBeforeDays: string
  type: Reminder['type']
}

const emptyForm = (): ReminderForm => ({
  titleAr: '', titleEn: '', descriptionAr: '', descriptionEn: '', companyId: '',
  dueDate: todayISO(), remindBeforeDays: '3', type: 'review',
})

function effectiveStatus(reminder: Reminder): Reminder['status'] {
  if (reminder.status === 'done' || reminder.status === 'cancelled') return reminder.status
  return reminder.dueDate < todayISO() ? 'overdue' : reminder.status
}

export function RemindersPage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const user = useAuthStore((s) => s.user)
  const lang = language
  const reminders = useLiveQuery(async () => (await db.reminders.toArray()).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), []) || []
  const companies = useLiveQuery(() => db.companies.toArray(), []) || []
  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies])
  const [tab, setTab] = useState<'all' | 'pending' | 'overdue' | 'done'>('pending')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | undefined>()
  const [form, setForm] = useState<ReminderForm>(emptyForm)
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return reminders.filter((reminder) => {
      const status = effectiveStatus(reminder)
      if (tab === 'pending' && !['pending', 'overdue'].includes(status)) return false
      if (tab === 'overdue' && status !== 'overdue') return false
      if (tab === 'done' && status !== 'done') return false
      if (!query) return true
      const company = reminder.companyId ? companyMap.get(reminder.companyId) : undefined
      return [reminder.titleAr, reminder.titleEn, reminder.descriptionAr || '', reminder.descriptionEn || '', company?.nameAr || ''].some((value) => value.toLowerCase().includes(query))
    })
  }, [reminders, tab, search, companyMap])

  const counts = useMemo(() => ({
    total: reminders.length,
    pending: reminders.filter((reminder) => effectiveStatus(reminder) === 'pending').length,
    overdue: reminders.filter((reminder) => effectiveStatus(reminder) === 'overdue').length,
    done: reminders.filter((reminder) => reminder.status === 'done').length,
  }), [reminders])

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    for (const reminder of reminders) {
      if (reminder.status !== 'pending') continue
      const days = daysBetween(todayISO(), reminder.dueDate)
      if (days < 0 || days > reminder.remindBeforeDays) continue
      const key = `muraqib-reminder-notified-${reminder.id}-${reminder.dueDate}`
      if (localStorage.getItem(key)) continue
      try {
        new Notification(lang === 'ar' ? reminder.titleAr : reminder.titleEn, {
          body: lang === 'ar' ? reminder.descriptionAr : reminder.descriptionEn,
          tag: `muraqib-reminder-${reminder.id}`,
        })
        localStorage.setItem(key, '1')
      } catch {
        // Notification can be blocked by the browser even when permission is granted.
      }
    }
  }, [reminders, lang])

  const requestNotifications = async () => {
    if (!('Notification' in window)) {
      toast(t('reminders.notificationBlocked'), 'warning')
      return
    }
    const permission = await Notification.requestPermission()
    toast(permission === 'granted' ? t('reminders.notificationOn') : t('reminders.notificationBlocked'), permission === 'granted' ? 'success' : 'warning')
  }

  const openCreate = () => {
    setEditingId(undefined)
    setForm(emptyForm())
    setModalOpen(true)
  }

  const openEdit = (reminder: Reminder) => {
    setEditingId(reminder.id)
    setForm({
      titleAr: reminder.titleAr,
      titleEn: reminder.titleEn,
      descriptionAr: reminder.descriptionAr || '',
      descriptionEn: reminder.descriptionEn || '',
      companyId: reminder.companyId ? String(reminder.companyId) : '',
      dueDate: reminder.dueDate,
      remindBeforeDays: String(reminder.remindBeforeDays),
      type: reminder.type,
    })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.titleAr.trim() || !form.titleEn.trim() || !form.dueDate) {
      toast(pick('العنوان باللغتين وتاريخ الاستحقاق مطلوبة.', 'Title in both languages and due date are required.', lang), 'warning')
      return
    }
    setBusy(true)
    try {
      const now = new Date().toISOString()
      const payload: Omit<Reminder, 'id' | 'createdAt'> = {
        titleAr: form.titleAr.trim(),
        titleEn: form.titleEn.trim(),
        descriptionAr: form.descriptionAr.trim() || undefined,
        descriptionEn: form.descriptionEn.trim() || undefined,
        companyId: form.companyId ? Number(form.companyId) : undefined,
        dueDate: form.dueDate,
        remindBeforeDays: Math.max(0, Number(form.remindBeforeDays) || 0),
        status: 'pending',
        type: form.type,
        updatedAt: now,
      }
      if (editingId) await db.reminders.update(editingId, payload)
      else await db.reminders.add({ ...payload, createdAt: now } as Reminder)
      await logAudit(editingId ? 'update' : 'create', 'reminder', editingId, `حفظ موعد: ${form.titleAr}`, `Saved reminder: ${form.titleEn}`, user?.fullNameAr)
      setModalOpen(false)
      toast(t('reminders.saved'))
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (reminder: Reminder, status: Reminder['status']) => {
    if (!reminder.id) return
    await db.reminders.update(reminder.id, { status, updatedAt: new Date().toISOString() })
    toast(status === 'done' ? t('reminders.done') : t('reminders.cancel'))
  }

  const remove = async (reminder: Reminder) => {
    if (!reminder.id || !window.confirm(t('common.confirmDelete'))) return
    await db.reminders.delete(reminder.id)
    await logAudit('delete', 'reminder', reminder.id, `حذف موعد: ${reminder.titleAr}`, `Deleted reminder: ${reminder.titleEn}`, user?.fullNameAr)
    toast(t('common.deleted'))
  }

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Practice calendar"
        icon={<CalendarClock className="h-6 w-6" />}
        title={t('reminders.title')}
        subtitle={t('reminders.subtitle')}
        actions={
          <>
            <Button icon={<BellRing className="h-4 w-4" />} onClick={requestNotifications}>{t('actions.notify')}</Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>{t('reminders.add')}</Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t('reminders.title'), value: counts.total, icon: CalendarDays, tone: 'primary' },
          { label: t('status.pending'), value: counts.pending, icon: Clock3, tone: 'info' },
          { label: t('reminders.overdue', { days: 0 }).replace(/\d+/g, '0').replace(' 0', ''), value: counts.overdue, icon: AlertTriangle, tone: 'danger' },
          { label: t('reminders.done'), value: counts.done, icon: CheckCircle2, tone: 'success' },
        ].map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-text-secondary">{item.label}</p>
                  <p className="mt-1 text-2xl font-black text-text">{item.value}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
              </div>
            </Card>
          )
        })}
      </div>

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(['pending', 'overdue', 'done', 'all'] as const).map((key) => (
              <button key={key} onClick={() => setTab(key)} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${tab === key ? 'border-primary/30 bg-primary text-primary-foreground' : 'border-border bg-surface text-text-secondary hover:bg-surface-2'}`}>
                {key === 'all' ? t('common.all') : key === 'pending' ? t('status.pending') : key === 'overdue' ? t('status.overdue') : t('reminders.done')}
              </button>
            ))}
          </div>
          <input className={`${inputClass} lg:max-w-xs`} placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-text-secondary"><Bell className="h-3.5 w-3.5" /> {t('reminders.notifyHelp')}</p>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-6 w-6" />} title={t('reminders.empty')} action={<Button variant="primary" onClick={openCreate}>{t('reminders.add')}</Button>} />
      ) : (
        <div className="space-y-3">
          {filtered.map((reminder) => {
            const status = effectiveStatus(reminder)
            const days = daysBetween(todayISO(), reminder.dueDate)
            const company = reminder.companyId ? companyMap.get(reminder.companyId) : undefined
            const typeKey = TYPES.find((item) => item.value === reminder.type)?.key || 'reminders.other'
            const tone = status === 'done' ? 'success' : status === 'overdue' ? 'danger' : status === 'cancelled' ? 'muted' : days <= reminder.remindBeforeDays ? 'warning' : 'info'
            return (
              <Card key={reminder.id} className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${status === 'overdue' ? 'bg-danger/10 text-danger' : status === 'done' ? 'bg-accent/10 text-accent' : 'bg-warning/10 text-warning'}`}>
                    {status === 'done' ? <CheckCircle2 className="h-5 w-5" /> : status === 'overdue' ? <AlertTriangle className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={tone as 'success' | 'danger' | 'warning' | 'info' | 'muted'}>{t(typeKey)}</Badge>
                      {status === 'overdue' && <Badge tone="danger">{t('reminders.overdue', { days: Math.abs(days) })}</Badge>}
                      {status === 'pending' && <Badge tone="muted">{t('reminders.daysLeft', { days: Math.max(0, days) })}</Badge>}
                      {status === 'done' && <Badge tone="success">{t('reminders.done')}</Badge>}
                    </div>
                    <h2 className="mt-1.5 text-sm font-bold">{pick(reminder.titleAr, reminder.titleEn, lang)}</h2>
                    {reminder.descriptionAr && <p className="mt-0.5 text-xs leading-5 text-text-secondary">{pick(reminder.descriptionAr, reminder.descriptionEn, lang)}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-text-secondary">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(reminder.dueDate, lang)}</span>
                      <span className="flex items-center gap-1"><Bell className="h-3.5 w-3.5" /> {t('reminders.remindBefore')}: {reminder.remindBeforeDays}</span>
                      {company && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {pick(company.nameAr, company.nameEn, lang)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {status !== 'done' && <Button variant="success" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setStatus(reminder, 'done')}>{t('actions.markDone')}</Button>}
                    {status !== 'cancelled' && status !== 'done' && <Button icon={<XCircle className="h-4 w-4" />} onClick={() => setStatus(reminder, 'cancelled')}>{t('reminders.cancel')}</Button>}
                    <IconButton title={t('reminders.edit')} onClick={() => openEdit(reminder)}><Pencil className="h-4 w-4" /></IconButton>
                    <IconButton title={t('reminders.delete')} tone="danger" onClick={() => remove(reminder)}><Trash2 className="h-4 w-4" /></IconButton>
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
        title={editingId ? t('reminders.edit') : t('reminders.new')}
        footer={
          <>
            <Button onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button variant="primary" onClick={save} disabled={busy}>{t('actions.save')}</Button>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t('reminders.titleAr')} required><input className={inputClass} value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} /></Field>
          <Field label={t('reminders.titleEn')} required><input className={inputClass} value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} dir="ltr" /></Field>
          <Field label={t('reminders.description')} className="md:col-span-2"><textarea className={`${inputClass} min-h-[74px]`} value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} /></Field>
          <Field label={`${t('reminders.description')} (EN)`} className="md:col-span-2"><textarea className={`${inputClass} min-h-[64px]`} value={form.descriptionEn} onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })} dir="ltr" /></Field>
          <Field label={t('reminders.dueDate')} required><input className={inputClass} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <Field label={t('reminders.remindBefore')}><input className={inputClass} type="number" min={0} value={form.remindBeforeDays} onChange={(e) => setForm({ ...form, remindBeforeDays: e.target.value })} /></Field>
          <Field label={t('reminders.type')}>
            <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Reminder['type'] })}>
              {TYPES.map((type) => <option key={type.value} value={type.value}>{t(type.key)}</option>)}
            </select>
          </Field>
          <Field label={t('reminders.company')}>
            <select className={inputClass} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
              <option value="">{t('common.allCompanies')}</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{pick(company.nameAr, company.nameEn, lang)}</option>)}
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}

