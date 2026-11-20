import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from "@/lib/liveQuery"
import {
  Building2, Save, Database, Trash2, RefreshCw, Globe2, Palette, FolderOpen,
  ImagePlus, ShieldCheck, Coins, Plus, NotebookPen, CircleDollarSign,
} from 'lucide-react'
import { db, type AppSettings, type CurrencyRate, type OfficeProfile } from '@/lib/db'
import type { CurrencyCode } from '@/types'
import { CURRENCIES } from '@/types'
import { seedDemoData, clearAllData } from '@/data/seedData'
import { logAudit } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { useI18nStore } from '@/stores/i18n.store'
import { useThemeStore, THEME_OPTIONS } from '@/stores/theme.store'
import { formatDate, pick } from '@/lib/format'
import {
  PageHeader, Button, Field, inputClass, SectionCard, Toggle, Badge, toast, EmptyState,
} from '@/components/ui'

const EMPTY_OFFICE: OfficeProfile = {
  nameAr: '', nameEn: '', ownerNameAr: '', ownerNameEn: '', titleAr: '', titleEn: '',
  email: '', phone: '', addressAr: '', addressEn: '', website: '', logoDataUrl: '', updatedAt: '',
}

const EMPTY_SETTINGS: AppSettings = {
  defaultLanguage: 'ar', defaultTheme: 'light' as AppSettings['defaultTheme'], autoBackup: true, auditTightening: true,
  backupFolderName: '',
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { language, setLanguage } = useI18nStore()
  const { theme, setTheme } = useThemeStore()
  const user = useAuthStore((s) => s.user)
  const lang = language
  const office = useLiveQuery(async () => (await db.officeProfile.toArray())[0], [])
  const settings = useLiveQuery(async () => (await db.appSettings.toArray())[0], [])
  const rates = useLiveQuery(() => db.currencyRates.orderBy('code').toArray(), []) || []
  const companiesCount = useLiveQuery(() => db.companies.count(), []) || 0
  const tbCount = useLiveQuery(() => db.trialBalanceImports.count(), []) || 0
  const userCount = useLiveQuery(() => db.users.count(), []) || 0
  const logoSaved = useRef<string>('')

  const [officeForm, setOfficeForm] = useState<OfficeProfile>(EMPTY_OFFICE)
  const [prefs, setPrefs] = useState<AppSettings>(EMPTY_SETTINGS)
  const [rateCode, setRateCode] = useState<CurrencyCode>('USD')
  const [rateValue, setRateValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetText, setResetText] = useState('')
  const [folderName, setFolderName] = useState('')

  useEffect(() => {
    if (office) {
      setOfficeForm({ ...office })
      logoSaved.current = office.logoDataUrl || ''
    }
  }, [office])

  useEffect(() => {
    if (settings) {
      setPrefs({ ...EMPTY_SETTINGS, ...settings })
      setFolderName(settings.backupFolderName || '')
    }
  }, [settings])

  const rateMap = useMemo(() => new Map(rates.map((rate) => [rate.code, rate])), [rates])

  const saveOffice = async () => {
    if (!officeForm.nameAr.trim() || !officeForm.ownerNameAr.trim()) {
      toast(pick('اسم المكتب واسم المراقب المالي مطلوبان.', 'Office name and owner name are required.', lang), 'warning')
      return
    }
    setBusy(true)
    try {
      const now = new Date().toISOString()
      const { id: officeId, ...changes } = officeForm
      const payload = { ...changes, updatedAt: now }
      const existing = await db.officeProfile.toArray()
      const target = existing.find((item) => item.id === officeId) ?? existing[0]
      if (target?.id) await db.officeProfile.update(target.id, payload)
      else await db.officeProfile.add(payload)
      let syncedAdmins = 0
      const admins = await db.users.where('role').equals('admin').toArray()
      const chiefMatches = admins.filter((admin) => /(مدير عام|managing director)/i.test(`${admin.fullNameAr} ${admin.fullNameEn}`))
      const managingDirectors = chiefMatches.length > 0 ? chiefMatches : (admins.length === 1 ? admins : [])
      for (const admin of managingDirectors) {
        const cleanOwnerName = (value: string, suffix: RegExp) => value.trim().replace(suffix, '').trim()
        const baseAr = cleanOwnerName(payload.ownerNameAr, /\s*[-–]?\s*المدير العام للمكتب\s*$/i)
        const baseEn = cleanOwnerName(payload.ownerNameEn || payload.ownerNameAr, /\s*[-–]?\s*Managing Director\s*$/i)
        const fullNameAr = `${baseAr} - المدير العام للمكتب`
        const fullNameEn = `${baseEn} - Managing Director`
        if (admin.fullNameAr === fullNameAr && admin.fullNameEn === fullNameEn) continue
        const changedAt = new Date().toISOString()
        await db.users.update(admin.id!, { fullNameAr, fullNameEn, updatedAt: changedAt })
        syncedAdmins += 1
        const session = useAuthStore.getState().user
        if (session && session.id === admin.id) {
          useAuthStore.getState().setUser({
            ...session,
            id: session.id,
            fullNameAr,
            fullNameEn,
          })
        }
      }
      try {
        await logAudit('update', 'office_profile', target?.id, `تحديث هوية مكتب المراقب المالي المعتمد ومزامنة ${syncedAdmins} حساب مدير عام`, `Updated the certified financial controller office identity and synced ${syncedAdmins} managing director account(s)`, user?.fullNameAr)
      } catch {
        // The identity is saved even if the audit log is unavailable.
      }
      toast(syncedAdmins > 0
        ? pick('تم حفظ هوية المكتب وتحديث اسم مدير عام المكتب في المنصة تلقائياً.', 'Office identity saved and the managing director account was synced automatically.', lang)
        : t('settings.savedOffice'))
    } catch {
      toast(pick('تعذر حفظ هوية المكتب. تحقق من البيانات وحاول مرة أخرى.', 'Could not save the office identity. Check the data and try again.', lang), 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleLogo = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast(pick('يرجى اختيار ملف صورة.', 'Please choose an image file.', lang), 'warning')
      return
    }
    if (file.size > 800_000) {
      toast(pick('حجم الشعار كبير. استخدم صورة أقل من 800 كيلوبايت.', 'The logo is too large. Use an image below 800 KB.', lang), 'warning')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setOfficeForm((current) => ({ ...current, logoDataUrl: String(reader.result || '') }))
    reader.readAsDataURL(file)
  }

  const savePreferences = async () => {
    setBusy(true)
    try {
      const payload: AppSettings = {
        defaultLanguage: prefs.defaultLanguage,
        defaultTheme: prefs.defaultTheme,
        autoBackup: prefs.autoBackup,
        auditTightening: prefs.auditTightening,
        backupFolderName: folderName,
      }
      const existing = await db.appSettings.toArray()
      const target = existing[0]
      if (target?.id) await db.appSettings.update(target.id, payload)
      else await db.appSettings.add(payload)
      setLanguage(prefs.defaultLanguage)
      setTheme(prefs.defaultTheme)
      try {
        await logAudit('update', 'app_settings', target?.id, 'تحديث تفضيلات المنصة والنسخ الاحتياطي', 'Updated platform preferences and backup settings', user?.fullNameAr)
      } catch {
        // The preferences are saved even if the audit log is unavailable.
      }
      toast(t('settings.preferencesSaved'))
    } catch {
      toast(pick('تعذر حفظ التفضيلات. تحقق من البيانات وحاول مرة أخرى.', 'Could not save the preferences. Check the data and try again.', lang), 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveRate = async () => {
    const rate = Number(rateValue)
    if (!Number.isFinite(rate) || rate <= 0) {
      toast(pick('أدخل سعر صرف صحيحاً أكبر من صفر.', 'Enter a valid exchange rate greater than zero.', lang), 'warning')
      return
    }
    setBusy(true)
    try {
      const now = new Date().toISOString()
      const existing = rateMap.get(rateCode)
      const payload: CurrencyRate = {
        code: rateCode,
        nameAr: CURRENCIES.find((c) => c.code === rateCode)?.nameAr || rateCode,
        nameEn: CURRENCIES.find((c) => c.code === rateCode)?.nameEn || rateCode,
        rateToEGP: rate,
        date: now.slice(0, 10),
        source: 'manual',
      }
      if (existing?.id) await db.currencyRates.update(existing.id, payload)
      else await db.currencyRates.add(payload)
      await logAudit('update', 'currency_rate', existing?.id, `تحديث سعر ${rateCode} مقابل الجنيه المصري`, `Updated ${rateCode} rate against EGP`, user?.fullNameAr)
      setRateValue('')
      toast(t('settings.ratesSaved'))
    } finally {
      setBusy(false)
    }
  }

  const seed = async () => {
    setBusy(true)
    try {
      const result = await seedDemoData(false)
      if (result.seeded) toast(t('settings.seedDone'))
      else toast(pick('توجد بيانات بالفعل. استخدم إعادة التعبئة الشاملة بعد تصدير نسخة احتياطية.', 'Data already exists. Use full reseed after exporting a backup.', lang), 'info')
    } finally {
      setBusy(false)
    }
  }

  const reseed = async () => {
    if (!window.confirm(pick('سيتم حذف جميع البيانات الحالية وإعادة ملء المنصة بالبيانات التجريبية. هل تريد المتابعة؟', 'All current data will be deleted and replaced with demo data. Continue?', lang))) return
    setBusy(true)
    try {
      await seedDemoData(true)
      localStorage.setItem('muraqib-bootstrapped', '1')
      toast(t('settings.seedDone'))
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    if (resetText.trim().toUpperCase() !== 'RESET') {
      toast(pick('اكتب RESET للتأكيد.', 'Type RESET to confirm.', lang), 'warning')
      return
    }
    setBusy(true)
    try {
      await clearAllData()
      localStorage.setItem('muraqib-bootstrapped', '1')
      setResetText('')
      toast(t('settings.resetDone'))
    } finally {
      setBusy(false)
    }
  }

  const chooseFolder = async () => {
    const picker = (window as unknown as { showDirectoryPicker?: () => Promise<{ name: string }> }).showDirectoryPicker
    if (!picker) {
      toast(t('settings.folderNotSupported'), 'info')
      return
    }
    try {
      const handle = await picker()
      setFolderName(handle.name)
      setPrefs((current) => ({ ...current, backupFolderName: handle.name }))
      toast(t('settings.folderChosen'))
    } catch {
      // User cancelled the picker.
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Configuration"
        icon={<ShieldCheck className="h-6 w-6" />}
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        actions={<Badge tone="primary">SQLite · Local-first</Badge>}
      />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title={t('settings.office')}
          subtitle={pick('تظهر هذه الهوية في الموقع والتقارير والمطبوعات.', 'This identity appears on the portfolio, reports and printouts.', lang)}
          action={<Building2 className="h-4 w-4 text-primary" />}
        >
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface-2/35 p-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface">
              {officeForm.logoDataUrl ? (
                <img src={officeForm.logoDataUrl} alt="office logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xl font-black text-primary">C.F.C</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold">{t('settings.logo')}</p>
              <p className="mt-0.5 text-[11px] text-text-secondary">PNG / JPG · ≤ 800 KB</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold hover:bg-surface-2">
                  <ImagePlus className="h-3.5 w-3.5" /> {t('settings.uploadLogo')}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogo(e.target.files?.[0])} />
                </label>
                {officeForm.logoDataUrl && (
                  <button type="button" onClick={() => setOfficeForm((current) => ({ ...current, logoDataUrl: '' }))} className="rounded-xl border border-danger/30 px-3 py-1.5 text-[11px] font-semibold text-danger hover:bg-danger/10">
                    {t('settings.removeLogo')}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t('settings.officeNameAr')} required><input className={inputClass} value={officeForm.nameAr} onChange={(e) => setOfficeForm({ ...officeForm, nameAr: e.target.value })} /></Field>
            <Field label={t('settings.officeNameEn')} required><input className={inputClass} value={officeForm.nameEn} onChange={(e) => setOfficeForm({ ...officeForm, nameEn: e.target.value })} dir="ltr" /></Field>
            <Field label={t('settings.ownerNameAr')} required><input className={inputClass} value={officeForm.ownerNameAr} onChange={(e) => setOfficeForm({ ...officeForm, ownerNameAr: e.target.value })} /></Field>
            <Field label={t('settings.ownerNameEn')} required><input className={inputClass} value={officeForm.ownerNameEn} onChange={(e) => setOfficeForm({ ...officeForm, ownerNameEn: e.target.value })} dir="ltr" /></Field>
            <Field label={t('settings.titleAr')}><input className={inputClass} value={officeForm.titleAr} onChange={(e) => setOfficeForm({ ...officeForm, titleAr: e.target.value })} /></Field>
            <Field label={t('settings.titleEn')}><input className={inputClass} value={officeForm.titleEn} onChange={(e) => setOfficeForm({ ...officeForm, titleEn: e.target.value })} dir="ltr" /></Field>
            <Field label={t('settings.email')}><input className={inputClass} type="email" value={officeForm.email || ''} onChange={(e) => setOfficeForm({ ...officeForm, email: e.target.value })} dir="ltr" /></Field>
            <Field label={t('settings.phone')}><input className={inputClass} value={officeForm.phone || ''} onChange={(e) => setOfficeForm({ ...officeForm, phone: e.target.value })} dir="ltr" /></Field>
            <Field label={t('settings.website')}><input className={inputClass} value={officeForm.website || ''} onChange={(e) => setOfficeForm({ ...officeForm, website: e.target.value })} dir="ltr" /></Field>
            <Field label={t('settings.addressAr')}><input className={inputClass} value={officeForm.addressAr || ''} onChange={(e) => setOfficeForm({ ...officeForm, addressAr: e.target.value })} /></Field>
            <Field label={t('settings.addressEn')} className="md:col-span-2"><input className={inputClass} value={officeForm.addressEn || ''} onChange={(e) => setOfficeForm({ ...officeForm, addressEn: e.target.value })} dir="ltr" /></Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" icon={<Save className="h-4 w-4" />} onClick={saveOffice} disabled={busy}>{t('settings.saveOffice')}</Button>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title={t('settings.currencies')} subtitle={t('settings.currenciesHint')} action={<Coins className="h-4 w-4 text-primary" />}>
            <div className="mb-4 grid gap-2 rounded-2xl border border-border bg-surface-2/35 p-3 sm:grid-cols-[1fr_1fr_auto]">
              <Field label={t('settings.currency')}>
                <select className={inputClass} value={rateCode} onChange={(e) => setRateCode(e.target.value as CurrencyCode)}>
                  {CURRENCIES.filter((currency) => currency.code !== 'OTHER').map((currency) => (
                    <option key={currency.code} value={currency.code}>{currency.code} — {pick(currency.nameAr, currency.nameEn, lang)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('settings.rate')}>
                <input className={inputClass} type="number" min="0.0001" step="0.0001" value={rateValue} onChange={(e) => setRateValue(e.target.value)} placeholder="50.0000" dir="ltr" />
              </Field>
              <div className="flex items-end">
                <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={saveRate} disabled={busy}>{t('settings.updateRate')}</Button>
              </div>
            </div>
            {rates.length === 0 ? (
              <EmptyState icon={<CircleDollarSign className="h-5 w-5" />} title={pick('لا توجد أسعار محفوظة. أضف سعر الدولار أولاً.', 'No rates saved. Start with the USD rate.', lang)} />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-2/60">
                      <th className="px-3 py-2.5 text-start text-[11px] font-bold">{t('settings.currency')}</th>
                      <th className="px-3 py-2.5 text-end text-[11px] font-bold">{t('settings.rate')}</th>
                      <th className="px-3 py-2.5 text-start text-[11px] font-bold">{t('common.date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((rate) => (
                      <tr key={rate.code} className="border-t border-border/60">
                        <td className="px-3 py-2">
                          <p className="font-semibold">{rate.code}</p>
                          <p className="text-[10px] text-text-secondary">{pick(rate.nameAr, rate.nameEn, lang)}</p>
                        </td>
                        <td className="px-3 py-2 text-end font-mono font-bold tabular-nums">{rate.rateToEGP.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                        <td className="px-3 py-2 text-[11px] text-text-secondary">{formatDate(rate.date, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[10px] leading-5 text-text-secondary">{t('settings.currenciesHint')}</p>
          </SectionCard>

          <SectionCard title={t('settings.preferences')} subtitle={pick('تفضيلات اللغة والمظهر والنسخ.', 'Language, appearance and backup preferences.', lang)} action={<Palette className="h-4 w-4 text-primary" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('settings.defaultLang')}>
                <select className={inputClass} value={prefs.defaultLanguage} onChange={(e) => setPrefs({ ...prefs, defaultLanguage: e.target.value as 'ar' | 'en' })}>
                  <option value="ar">{pick('العربية', 'Arabic', lang)}</option>
                  <option value="en">{pick('الإنجليزية', 'English', lang)}</option>
                </select>
              </Field>
              <Field label={t('settings.defaultTheme')}>
                <div className="grid gap-3">
                  {(() => {
                    const previews: Record<string, { bg:string; surface:string; brand:string; accent:string }> = {"light":{"bg":"#f4f6fb","surface":"#ffffff","brand":"#2563eb","accent":"#0891b2"},"light-sand":{"bg":"#f6f1e8","surface":"#fffaf2","brand":"#b7791f","accent":"#0f766e"},"light-mist":{"bg":"#eef4ff","surface":"#ffffff","brand":"#2563eb","accent":"#0891b2"},"dark":{"bg":"#0b1220","surface":"#121a2b","brand":"#60a5fa","accent":"#22d3ee"},"dark-midnight":{"bg":"#060816","surface":"#0f1428","brand":"#8b5cf6","accent":"#22d3ee"},"dark-emerald":{"bg":"#071311","surface":"#102220","brand":"#34d399","accent":"#14b8a6"}};
                    const Card = (opt: typeof THEME_OPTIONS[number]) => {
                      const c = previews[opt.id] || previews.light;
                      const active = prefs.defaultTheme === opt.id;
                      return (
                        <button key={opt.id} type="button" onClick={() => setPrefs({ ...prefs, defaultTheme: opt.id as AppSettings['defaultTheme'] })} title={opt.label[lang]}
                          className={`relative text-start rounded-2xl p-2.5 bg-surface border-2 transition-all duration-150 w-full ${active ? 'border-primary shadow-[0_0_0_3px_rgba(37,99,235,0.15),0_10px_24px_rgba(0,0,0,0.12)]' : 'border-border hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg'}`}>
                          <span className="grid grid-cols-[22px_1fr] h-[60px] rounded-[10px] overflow-hidden border border-border/60 relative" style={{ background: c.bg }}>
                            <span className="relative" style={{ background: c.brand }}><span className="absolute top-[8px] left-[5px] right-[5px] h-[5px] rounded bg-white/60" /></span>
                            <span className="p-[6px] flex flex-col gap-[4px]">
                              <span className="h-[8px] rounded-[4px] border border-border/50" style={{ background: c.surface }} />
                              <span className="h-[5px] w-[70%] rounded border border-border/40" style={{ background: c.surface }} />
                              <span className="flex gap-1 mt-auto"><i className="w-[12px] h-[12px] rounded block" style={{ background: c.brand }} /><i className="w-[12px] h-[12px] rounded block" style={{ background: c.accent }} /></span>
                            </span>
                            <span className={`absolute top-1.5 end-1.5 w-5 h-5 rounded-full bg-primary text-white grid place-items-center text-[11px] font-bold transition-all ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.6]'}`}>âœ“</span>
                          </span>
                          <span className="flex items-center gap-1.5 mt-2 font-extrabold text-[12px] text-text">{opt.label[lang]}<span className={`text-[10px] px-[6px] py-[1px] rounded-full font-extrabold ${active ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-text-secondary'}`}>{opt.mode === 'dark' ? (lang==='ar'?'داكن':'Dark') : (lang==='ar'?'فاتح':'Light')}</span></span>
                        </button>
                      );
                    };
                    const lights = THEME_OPTIONS.filter(t=>t.mode==='light');
                    const darks = THEME_OPTIONS.filter(t=>t.mode==='dark');
                    return (
                      <div className="grid gap-3">
                        <div><div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-gradient-to-br from-amber-200 to-white border border-border" /><span className="text-[12px] font-extrabold">{lang==='ar'?'الثيمات الفاتحة':'Light themes'}</span></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{lights.map(Card)}</div></div>
                        <div><div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-gradient-to-br from-slate-600 to-slate-950 border border-border" /><span className="text-[12px] font-extrabold">{lang==='ar'?'الثيمات الداكنة':'Dark themes'}</span></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{darks.map(Card)}</div></div>
                      </div>
                    );
                  })()}
                </div>
              </Field>
            </div>
            <div className="mt-4 space-y-3 rounded-xl border border-border bg-surface-2/30 p-3">
              <Toggle checked={prefs.autoBackup} onChange={(value) => setPrefs({ ...prefs, autoBackup: value })} label={t('settings.autoBackup')} />
              <Toggle checked={prefs.auditTightening} onChange={(value) => setPrefs({ ...prefs, auditTightening: value })} label={t('settings.auditTightening')} />
            </div>
            <div className="mt-4">
              <Field label={t('settings.backupFolder')} hint={t('settings.chooseFolder')}>
                <div className="flex overflow-hidden rounded-xl border border-border bg-surface">
                  <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-xs">
                    <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{folderName || t('settings.chooseFolder')}</span>
                  </div>
                  <button type="button" onClick={chooseFolder} className="border-s border-border bg-surface-2/50 px-3 text-xs font-semibold text-primary hover:bg-surface-2">{t('settings.chooseFolder')}</button>
                </div>
              </Field>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] text-text-secondary"><Globe2 className="h-3.5 w-3.5" /> {lang === 'ar' ? 'العربية' : 'English'} · {theme === 'dark' ? t('settings.dark') : t('settings.light')}</div>
              <Button variant="primary" icon={<Save className="h-4 w-4" />} onClick={savePreferences} disabled={busy}>{t('settings.savePreferences')}</Button>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <SectionCard title={t('settings.data')} subtitle={t('settings.seedHint')} action={<Database className="h-4 w-4 text-primary" />}>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: t('nav.companies'), value: companiesCount },
              { label: t('nav.trialBalance'), value: tbCount },
              { label: t('nav.users'), value: userCount },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-surface-2/30 p-3 text-center">
                <p className="text-xl font-black text-primary">{item.value}</p>
                <p className="text-[10px] text-text-secondary">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon={<Database className="h-4 w-4" />} onClick={seed} disabled={busy}>{t('settings.seed')}</Button>
            <Button icon={<RefreshCw className="h-4 w-4" />} onClick={reseed} disabled={busy}>{t('settings.reseed')}</Button>
          </div>
          <div className="mt-5 rounded-2xl border border-danger/25 bg-danger/5 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-danger"><Trash2 className="h-4 w-4" /> {t('settings.reset')}</div>
            <p className="mt-1 text-[11px] leading-5 text-text-secondary">{t('settings.resetHint')}</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label={t('settings.resetConfirm')} className="min-w-[180px] flex-1">
                <input className={inputClass} value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="RESET" dir="ltr" />
              </Field>
              <Button variant="danger" onClick={reset} disabled={busy || resetText.trim().toUpperCase() !== 'RESET'}>{t('settings.reset')}</Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={t('settings.about')} subtitle={t('settings.syncNote')} action={<NotebookPen className="h-4 w-4 text-primary" />}>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/25 px-3 py-2.5">
              <span className="text-text-secondary">{t('settings.version')}</span><Badge tone="primary">1.0.0</Badge>
            </div>
            <div className="rounded-xl border border-border bg-surface-2/25 px-3 py-2.5">
              <p className="text-text-secondary">{t('settings.tech')}</p>
              <p className="mt-1 text-[11px] leading-5" dir="ltr">{t('settings.techValue')}</p>
            </div>
            <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-[11px] leading-5 text-text-secondary">{t('settings.syncNote')}</p>
            <p className="text-[10px] leading-5 text-text-secondary">{pick('كل البيانات تبقى محلية على هذا الجهاز حتى يتم تفعيل طبقة السحابة. لا تُرسل أي بيانات خارج المتصفح.', 'All data remains local to this device until the cloud layer is enabled. Nothing is sent outside the browser.', lang)}</p>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}


