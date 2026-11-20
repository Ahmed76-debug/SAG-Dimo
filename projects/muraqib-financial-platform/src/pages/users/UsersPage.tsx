import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from "@/lib/liveQuery"
import {
  Users, Plus, Pencil, Trash2, Search, Shield, UserCheck, Building2,
  BriefcaseBusiness, Eye, Calculator, KeyRound, Mail, Phone, UserRound,
} from 'lucide-react'
import { db, type User } from '@/lib/db'
import type { UserRole } from '@/types'
import { ROLES } from '@/types'
import { createUser, updateUser, logAudit } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { useI18nStore } from '@/stores/i18n.store'
import { formatDate, pick } from '@/lib/format'
import {
  PageHeader, Card, Button, Badge, Field, inputClass, EmptyState, SectionCard, Modal, Toggle, IconButton, toast,
} from '@/components/ui'

const ROLE_ICONS: Record<UserRole, typeof Shield> = {
  admin: Shield,
  reviewer: UserCheck,
  accountant: Calculator,
  client_finance_manager: BriefcaseBusiness,
  external: Building2,
  viewer: Eye,
}

const ROLE_PERMISSIONS: Record<UserRole, { ar: string[]; en: string[] }> = {
  admin: { ar: ['إدارة كاملة', 'المستخدمون', 'الإعدادات', 'النسخ الاحتياطي'], en: ['Full control', 'Users', 'Settings', 'Backup'] },
  reviewer: { ar: ['اعتماد الميزانات', 'القوائم', 'التحليل', 'الأرشيف'], en: ['TB approval', 'Statements', 'Analysis', 'Archive'] },
  accountant: { ar: ['إدخال الميزان', 'قيود التسوية', 'الموازنة', 'التقارير'], en: ['TB entry', 'Adjustments', 'Budget', 'Reports'] },
  client_finance_manager: { ar: ['بوابة شركته فقط', 'رفع ميزان شركته'], en: ['Own company portal', 'Own TB submission'] },
  external: { ar: ['بوابة شركته فقط'], en: ['Own company portal'] },
  viewer: { ar: ['عرض التقارير والتحليل'], en: ['Read reports and analysis'] },
}

interface UserForm {
  username: string
  password: string
  fullNameAr: string
  fullNameEn: string
  email: string
  phone: string
  role: UserRole
  companyId: string
  isActive: boolean
}

const emptyForm = (): UserForm => ({
  username: '', password: '', fullNameAr: '', fullNameEn: '', email: '', phone: '',
  role: 'accountant', companyId: '', isActive: true,
})

export function UsersPage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const currentUser = useAuthStore((s) => s.user)
  const lang = language
  const users = useLiveQuery(() => db.users.toArray(), []) || []
  const companies = useLiveQuery(() => db.companies.toArray(), []) || []
  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | undefined>()
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const sorted = users.slice().sort((a, b) => a.fullNameAr.localeCompare(b.fullNameAr, 'ar'))
    if (!query) return sorted
    return sorted.filter((user) => [user.username, user.fullNameAr, user.fullNameEn, user.email || ''].some((value) => value.toLowerCase().includes(query)))
  }, [users, search])

  const counts = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.isActive).length,
    portal: users.filter((user) => user.role === 'client_finance_manager' || user.role === 'external').length,
  }), [users])

  const openCreate = () => {
    setEditingId(undefined)
    setForm(emptyForm())
    setModalOpen(true)
  }

  const openEdit = (user: User) => {
    setEditingId(user.id)
    setForm({
      username: user.username,
      password: '',
      fullNameAr: user.fullNameAr,
      fullNameEn: user.fullNameEn,
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      companyId: user.companyId ? String(user.companyId) : '',
      isActive: user.isActive,
    })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.username.trim() || !form.fullNameAr.trim() || !form.fullNameEn.trim()) {
      toast(pick('اسم المستخدم والاسم بالعربية والإنجليزية مطلوبة.', 'Username and both full names are required.', lang), 'warning')
      return
    }
    const portalRole = form.role === 'client_finance_manager' || form.role === 'external'
    if (portalRole && !form.companyId) {
      toast(pick('اختر الشركة المرتبطة بمدير/موظف الشركة.', 'Select the company linked to the portal user.', lang), 'warning')
      return
    }
    if (!editingId && form.password.trim().length < 6) {
      toast(pick('كلمة المرور يجب أن تكون 6 أحرف على الأقل.', 'The password must be at least 6 characters.', lang), 'warning')
      return
    }
    setBusy(true)
    try {
      const companyId = form.companyId ? Number(form.companyId) : undefined
      if (editingId) {
        await updateUser(editingId, {
          username: form.username.trim(),
          fullNameAr: form.fullNameAr.trim(),
          fullNameEn: form.fullNameEn.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          role: form.role,
          companyId,
          isActive: form.isActive,
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
        })
        const session = useAuthStore.getState().user
        const synced = await db.users.get(editingId)
        if (synced && session?.id === editingId) {
          useAuthStore.getState().setUser({
            ...session,
            username: synced.username,
            fullNameAr: synced.fullNameAr,
            fullNameEn: synced.fullNameEn,
            role: synced.role,
            companyId: synced.companyId,
            email: synced.email,
          })
        }
        await logAudit('update', 'user', editingId, `تعديل مستخدم: ${form.fullNameAr}`, `Updated user: ${form.fullNameEn}`, currentUser?.fullNameAr)
      } else {
        const id = await createUser({
          username: form.username.trim(),
          password: form.password.trim(),
          fullNameAr: form.fullNameAr.trim(),
          fullNameEn: form.fullNameEn.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          role: form.role,
          companyId,
          isActive: form.isActive,
        })
        await logAudit('create', 'user', id, `إنشاء مستخدم: ${form.fullNameAr}`, `Created user: ${form.fullNameEn}`, currentUser?.fullNameAr)
      }
      setModalOpen(false)
      toast(t('users.saved'))
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      toast(code === 'USERNAME_EXISTS' ? t('users.usernameExists') : t('common.noData'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (user: User) => {
    if (!user.id) return
    if (user.id === currentUser?.id) {
      toast(t('users.cannotDeleteSelf'), 'warning')
      return
    }
    if (!window.confirm(t('common.confirmDelete'))) return
    await db.users.delete(user.id)
    await logAudit('delete', 'user', user.id, `حذف مستخدم: ${user.fullNameAr}`, `Deleted user: ${user.fullNameEn}`, currentUser?.fullNameAr)
    toast(t('users.deleted'))
  }

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Access control"
        icon={<Users className="h-6 w-6" />}
        title={t('users.title')}
        subtitle={t('users.subtitle')}
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>{t('users.add')}</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: t('users.title'), value: counts.total, icon: Users, tone: 'primary' as const },
          { label: t('users.active'), value: counts.active, icon: UserCheck, tone: 'success' as const },
          { label: t('users.portalOnly'), value: counts.portal, icon: BriefcaseBusiness, tone: 'warning' as const },
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input className={`${inputClass} ps-9`} placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <p className="text-[11px] text-text-secondary">{t('users.roleHelp')}</p>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title={t('users.empty')} action={<Button variant="primary" onClick={openCreate}>{t('users.add')}</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((user) => {
            const RoleIcon = ROLE_ICONS[user.role]
            const company = user.companyId ? companyMap.get(user.companyId) : undefined
            const perms = ROLE_PERMISSIONS[user.role]
            return (
              <SectionCard
                key={user.id}
                title={pick(user.fullNameAr, user.fullNameEn, lang)}
                subtitle={`@${user.username}`}
                action={
                  <div className="flex items-center gap-1">
                    <IconButton title={t('users.edit')} onClick={() => openEdit(user)}><Pencil className="h-4 w-4" /></IconButton>
                    <IconButton title={t('users.deleted')} tone="danger" onClick={() => remove(user)}><Trash2 className="h-4 w-4" /></IconButton>
                  </div>
                }
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone="primary"><RoleIcon className="h-3 w-3" /> {t(`roles.${user.role}`)}</Badge>
                  <Badge tone={user.isActive ? 'success' : 'muted'}>{user.isActive ? t('status.active') : t('users.active')}</Badge>
                  {(user.role === 'client_finance_manager' || user.role === 'external') && <Badge tone="warning">{t('users.portalOnly')}</Badge>}
                </div>
                <div className="space-y-1.5 text-[11px] text-text-secondary">
                  {user.email && <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> <span dir="ltr">{user.email}</span></p>}
                  {user.phone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> <span dir="ltr">{user.phone}</span></p>}
                  {company && <p className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {pick(company.nameAr, company.nameEn, lang)}</p>}
                  <p className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> {t('users.lastLogin')}: {user.lastLogin ? formatDate(user.lastLogin, lang) : t('common.none')}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(lang === 'ar' ? perms.ar : perms.en).map((permission) => (
                    <span key={permission} className="rounded-full border border-border bg-surface-2/50 px-2 py-0.5 text-[10px] text-text-secondary">{permission}</span>
                  ))}
                </div>
              </SectionCard>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t('users.edit') : t('users.new')}
        subtitle={t('users.roleHelp')}
        footer={
          <>
            <Button onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button variant="primary" icon={<UserRound className="h-4 w-4" />} onClick={save} disabled={busy}>{t('actions.save')}</Button>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t('users.username')} required><input className={inputClass} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} dir="ltr" /></Field>
          <Field label={t('users.password')} required={!editingId} hint={t('users.passwordHint')}><input className={inputClass} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" /></Field>
          <Field label={t('users.fullNameAr')} required><input className={inputClass} value={form.fullNameAr} onChange={(e) => setForm({ ...form, fullNameAr: e.target.value })} /></Field>
          <Field label={t('users.fullNameEn')} required><input className={inputClass} value={form.fullNameEn} onChange={(e) => setForm({ ...form, fullNameEn: e.target.value })} dir="ltr" /></Field>
          <Field label={t('users.email')}><input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" /></Field>
          <Field label={t('users.phone')}><input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></Field>
          <Field label={t('users.role')}>
            <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
              {ROLES.map((role) => <option key={role.value} value={role.value}>{pick(role.labelAr, role.labelEn, lang)}</option>)}
            </select>
          </Field>
          <Field label={t('users.company')} hint={form.role === 'client_finance_manager' || form.role === 'external' ? t('users.portalOnly') : undefined}>
            <select className={inputClass} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
              <option value="">{t('common.choose')}</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.code} — {pick(company.nameAr, company.nameEn, lang)}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2 rounded-xl border border-border bg-surface-2/30 p-3">
            <Toggle checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} label={t('users.active')} />
          </div>
        </div>
      </Modal>
    </div>
  )
}

