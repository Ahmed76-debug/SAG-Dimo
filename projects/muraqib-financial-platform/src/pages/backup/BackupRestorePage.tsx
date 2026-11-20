import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from "@/lib/liveQuery"
import {
  DatabaseBackup, Download, Upload, FolderOpen, HardDrive, ShieldCheck,
  RefreshCw, FileJson, AlertTriangle, CheckCircle2, Clock3, Cloud, Lock,
} from 'lucide-react'
import { db, type AppSettings } from '@/lib/db'
import { exportJsonFile } from '@/lib/exports'
import { backupJsonToSql, downloadSqlFile } from '@/lib/sql'
import { logAudit } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { useI18nStore } from '@/stores/i18n.store'
import { formatDateTime, pick } from '@/lib/format'
import {
  PageHeader, Card, Button, Badge, SectionCard, toast,
} from '@/components/ui'

interface PickableDirectory {
  name: string
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<{
    createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>
    getFile: () => Promise<File>
  }>
  values: () => AsyncIterable<{ kind: string; name: string; getFile: () => Promise<File> }>
  requestPermission?: (options?: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
}

function directoryPicker(): ((options?: { mode?: 'read' | 'readwrite' }) => Promise<PickableDirectory>) | undefined {
  return (window as unknown as { showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<PickableDirectory> }).showDirectoryPicker
}

function backupName() {
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  return `Muraqib-Backup-${stamp}.json`
}

export function BackupRestorePage() {
  const { t } = useTranslation()
  const { language } = useI18nStore()
  const user = useAuthStore((s) => s.user)
  const lang = language
  const settings = useLiveQuery(async () => (await db.appSettings.toArray())[0], []) as AppSettings | undefined
  const counts = useLiveQuery(async () => {
    const [companies, imports, lines, adjustments, users, archive, reminders, rates, budgets] = await Promise.all([
      db.companies.count(), db.trialBalanceImports.count(), db.trialBalanceLines.count(),
      db.adjustments.count(), db.users.count(), db.archive.count(), db.reminders.count(),
      db.currencyRates.count(), db.budgets.count(),
    ])
    return { companies, imports, lines, adjustments, users, archive, reminders, rates, budgets }
  }, []) || { companies: 0, imports: 0, lines: 0, adjustments: 0, users: 0, archive: 0, reminders: 0, rates: 0, budgets: 0 }
  const [folderName, setFolderName] = useState('')
  const [folderHandle, setFolderHandle] = useState<PickableDirectory | null>(null)
  const [restoreText, setRestoreText] = useState('')
  const [restoreFile, setRestoreFile] = useState('')
  const [busy, setBusy] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (settings?.backupFolderName) setFolderName(settings.backupFolderName)
    else setFolderName('')
  }, [settings?.backupFolderName])

  const preview = useMemo(() => {
    if (!restoreText) return null
    try {
      const parsed = JSON.parse(restoreText)
      const tables = parsed?.tables && typeof parsed.tables === 'object' ? parsed.tables : parsed
      const valid = !!tables && (Array.isArray(tables.companies) || Array.isArray(parsed?.companies))
      return {
        valid,
        exportedAt: (parsed?.createdAt || parsed?.exportedAt) as string | undefined,
        companies: Array.isArray(tables?.companies) ? tables.companies.length : Array.isArray(parsed?.companies) ? parsed.companies.length : 0,
        imports: Array.isArray(tables?.trialBalanceImports) ? tables.trialBalanceImports.length : Array.isArray(parsed?.trialBalanceImports) ? parsed.trialBalanceImports.length : 0,
        lines: Array.isArray(tables?.trialBalanceLines) ? tables.trialBalanceLines.length : Array.isArray(parsed?.trialBalanceLines) ? parsed.trialBalanceLines.length : 0,
        users: Array.isArray(tables?.users) ? tables.users.length : Array.isArray(parsed?.users) ? parsed.users.length : 0,
      }
    } catch {
      return { valid: false, exportedAt: undefined, companies: 0, imports: 0, lines: 0, users: 0 }
    }
  }, [restoreText])

  const updateSettings = async (patch: Partial<AppSettings>) => {
    const existing = await db.appSettings.toArray()
    if (existing[0]?.id) await db.appSettings.update(existing[0].id, patch)
    else await db.appSettings.add({
      defaultLanguage: 'ar', defaultTheme: 'light', autoBackup: true, auditTightening: true, ...patch,
    } as AppSettings)
  }

  const chooseBackupFolder = async () => {
    const picker = directoryPicker()
    if (!picker) {
      toast(t('backup.notSupported'), 'info')
      return
    }
    try {
      await toolsPermission(picker, 'readwrite')
    } catch {
      // Continue; write permission is requested on first write in some browsers.
    }
  }

  const toolsPermission = async (picker: NonNullable<ReturnType<typeof directoryPicker>>, mode: 'read' | 'readwrite') => {
    const handle = await picker({ mode })
    if (handle.requestPermission) {
      const permission = await handle.requestPermission({ mode })
      if (permission !== 'granted') throw new Error('PERMISSION_DENIED')
    }
    setFolderHandle(handle)
    setFolderName(handle.name)
    await updateSettings({ backupFolderName: handle.name })
    toast(t('backup.folderSet'))
    return handle
  }

  const exportSql = async () => {
    setBusy(true)
    try {
      const json = await db.exportBackup()
      const sql = backupJsonToSql(json)
      downloadSqlFile(sql, `Muraqib-${new Date().toISOString().slice(0, 10)}.sql`)
      await logAudit('export', 'database', undefined, 'تصدير قاعدة البيانات بصيغة SQL', 'Exported database as SQL dump', user?.fullNameAr)
      toast(pick('تم تصدير قاعدة البيانات بصيغة SQL', 'Database exported as SQL', lang))
    } catch {
      toast(pick('تعذر تصدير SQL', 'Could not export SQL', lang), 'error')
    } finally {
      setBusy(false)
    }
  }

  const exportBackup = async (directToFolder = false) => {
    setBusy(true)
    try {
      const json = await db.exportBackup()
      const now = new Date().toISOString()
      const filename = backupName()
      if (directToFolder) {
        let handle = folderHandle
        if (!handle) {
          const picker = directoryPicker()
          if (!picker) {
            exportJsonFile(json, filename)
            toast(t('backup.notSupported'), 'info')
          } else {
            handle = await toolsPermission(picker, 'readwrite')
          }
        }
        if (handle) {
          const fileHandle = await handle.getFileHandle(filename, { create: true })
          const writable = await fileHandle.createWritable()
          await writable.write(json)
          await writable.close()
        } else {
          exportJsonFile(json, filename)
        }
      } else {
        exportJsonFile(json, filename)
      }
      await updateSettings({ lastBackupAt: now })
      await logAudit('backup', 'database', undefined, 'إنشاء نسخة احتياطية كاملة لبيانات المنصة', 'Created a full platform database backup', user?.fullNameAr)
      toast(t('backup.backupDone'))
    } catch {
      toast(pick('تعذر إنشاء النسخة الاحتياطية. تحقق من صلاحية المجلد.', 'Could not create the backup. Check folder permission.', lang), 'error')
    } finally {
      setBusy(false)
    }
  }

  const pickRestoreFile = async (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.json')) {
      toast(t('backup.invalid'), 'warning')
      return
    }
    const text = await file.text()
    setRestoreFile(file.name)
    setRestoreText(text)
    setShowConfirm(false)
  }

  const chooseRestoreFolder = async () => {
    const picker = directoryPicker()
    if (!picker) {
      toast(t('backup.notSupported'), 'info')
      return
    }
    try {
      const handle = await toolsPermission(picker, 'read')
      const candidates: Array<{ name: string; file: File }> = []
      for await (const entry of handle.values()) {
        if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith('.json')) continue
        if (!/muraqib|backup|نسخة/i.test(entry.name)) continue
        candidates.push({ name: entry.name, file: await entry.getFile() })
      }
      if (!candidates.length) {
        toast(pick('لم يتم العثور على ملف نسخة احتياطية بصيغة JSON في المجلد.', 'No JSON backup file was found in the folder.', lang), 'warning')
        return
      }
      candidates.sort((a, b) => b.name.localeCompare(a.name))
      const latest = candidates[0]
      const text = await latest.file.text()
      setRestoreFile(latest.name)
      setRestoreText(text)
      setShowConfirm(false)
      toast(pick(`تم تحميل ${latest.name} للاستعادة.`, `Loaded ${latest.name} for restore.`, lang))
    } catch {
      toast(pick('تعذر قراءة المجلد.', 'Could not read the folder.', lang), 'error')
    }
  }

  const restoreBackup = async () => {
    if (!restoreText || !preview?.valid) {
      toast(t('backup.invalid'), 'error')
      return
    }
    if (!window.confirm(t('backup.confirmImport'))) return
    setBusy(true)
    try {
      await db.importBackup(restoreText)
      const now = new Date().toISOString()
      await updateSettings({ lastRestoreAt: now })
      await logAudit('restore', 'database', undefined, `استعادة نسخة احتياطية من الملف ${restoreFile}`, `Restored database from ${restoreFile}`, user?.fullNameAr)
      setRestoreText('')
      setRestoreFile('')
      setShowConfirm(false)
      toast(t('backup.imported'))
      window.setTimeout(() => window.location.reload(), 900)
    } catch {
      toast(t('backup.invalid'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="C.F.C · Business continuity"
        icon={<DatabaseBackup className="h-6 w-6" />}
        title={t('backup.title')}
        subtitle={t('backup.subtitle')}
        actions={<Badge tone="success"><ShieldCheck className="h-3 w-3" /> SQLite</Badge>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-text-secondary"><HardDrive className="h-4 w-4 text-primary" /> {t('backup.storage')}</div>
          <p className="mt-1 text-2xl font-black text-text">{counts.companies + counts.imports + counts.lines + counts.users} <span className="text-xs font-normal text-text-secondary">{pick('سجل', 'records', lang)}</span></p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-text-secondary"><Clock3 className="h-4 w-4 text-info" /> {t('backup.lastBackup')}</div>
          <p className="mt-1 text-sm font-bold text-text">{settings?.lastBackupAt ? formatDateTime(settings.lastBackupAt, lang) : t('backup.never')}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-text-secondary"><RefreshCw className="h-4 w-4 text-warning" /> {t('backup.lastRestore')}</div>
          <p className="mt-1 text-sm font-bold text-text">{settings?.lastRestoreAt ? formatDateTime(settings.lastRestoreAt, lang) : t('backup.never')}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-text-secondary"><FolderOpen className="h-4 w-4 text-accent" /> {t('backup.folder')}</div>
          <p className="mt-1 truncate text-sm font-bold text-text">{folderName || t('backup.noFolder')}</p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title={t('backup.exportTitle')} subtitle={t('backup.exportText')} action={<Download className="h-4 w-4 text-primary" />}>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: t('nav.companies'), value: counts.companies },
              { label: t('backup.tb'), value: counts.imports },
              { label: t('backup.lines'), value: counts.lines },
              { label: t('backup.entries'), value: counts.adjustments },
              { label: t('backup.users'), value: counts.users },
              { label: t('backup.archive'), value: counts.archive },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-surface-2/30 px-3 py-2.5">
                <p className="text-[10px] text-text-secondary">{item.label}</p>
                <p className="text-lg font-black text-primary">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" icon={<Download className="h-4 w-4" />} onClick={() => exportBackup(false)} disabled={busy}>{t('backup.exportNow')}</Button>
            <Button icon={<DatabaseBackup className="h-4 w-4" />} onClick={() => void exportSql()} disabled={busy}>SQL</Button>
            <Button icon={<FolderOpen className="h-4 w-4" />} onClick={() => exportBackup(true)} disabled={busy}>{t('backup.exportFolder')}</Button>
            <Button icon={<FolderOpen className="h-4 w-4" />} onClick={chooseBackupFolder} disabled={busy}>{t('backup.chooseFolder')}</Button>
          </div>
          {settings?.autoBackup && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-info/20 bg-info/5 px-3 py-2.5 text-[11px] leading-5 text-text-secondary"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-info" /> {t('backup.autoText')}</p>
          )}
        </SectionCard>

        <SectionCard title={t('backup.importTitle')} subtitle={t('backup.importText')} action={<Upload className="h-4 w-4 text-warning" />}>
          <div className="rounded-2xl border border-dashed border-border bg-surface-2/25 p-5 text-center">
            <FileJson className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-2 text-xs font-semibold">{restoreFile || pick('لم يتم اختيار ملف', 'No file selected', lang)}</p>
            <p className="mt-1 text-[10px] text-text-secondary">JSON · نسخة كاملة تشمل الحسابات والبيانات</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-semibold hover:bg-surface-2">
                <Upload className="h-4 w-4" /> {t('backup.chooseFile')}
                <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => pickRestoreFile(e.target.files?.[0])} />
              </label>
              <Button icon={<FolderOpen className="h-4 w-4" />} onClick={chooseRestoreFolder}>{t('backup.chooseFolder')}</Button>
            </div>
          </div>

          {preview && (
            <div className={`mt-4 rounded-xl border px-4 py-3 text-xs ${preview.valid ? 'border-accent/25 bg-accent/5' : 'border-danger/25 bg-danger/5'}`}>
              <div className="flex items-center gap-2 font-bold">
                {preview.valid ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <AlertTriangle className="h-4 w-4 text-danger" />}
                {preview.valid ? pick('ملف نسخة احتياطية صالح', 'Valid backup file', lang) : t('backup.invalid')}
              </div>
              {preview.valid && (
                <div className="mt-2 grid gap-1.5 text-[11px] text-text-secondary sm:grid-cols-2">
                  <p>{t('backup.companies')}: {preview.companies}</p>
                  <p>{t('backup.tb')}: {preview.imports}</p>
                  <p>{t('backup.lines')}: {preview.lines}</p>
                  <p>{t('backup.users')}: {preview.users}</p>
                  {preview.exportedAt && <p className="sm:col-span-2">{t('common.generatedAt')}: {formatDateTime(preview.exportedAt, lang)}</p>}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button variant="danger" icon={<RefreshCw className="h-4 w-4" />} onClick={() => setShowConfirm(true)} disabled={busy || !preview?.valid}>{t('backup.importNow')}</Button>
          </div>

          {showConfirm && (
            <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-4">
              <p className="text-xs font-bold text-danger">{t('backup.confirmImport')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => setShowConfirm(false)}>{t('actions.cancel')}</Button>
                <Button variant="danger" onClick={restoreBackup} disabled={busy}>{t('backup.importNow')}</Button>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard className="mt-5" title={t('backup.counts')} subtitle={t('backup.storageText')} action={<Cloud className="h-4 w-4 text-info" />}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: t('backup.companies'), value: counts.companies },
            { label: t('backup.tb'), value: counts.imports },
            { label: t('backup.lines'), value: counts.lines },
            { label: t('backup.entries'), value: counts.adjustments },
            { label: t('backup.users'), value: counts.users },
            { label: t('nav.archive'), value: counts.archive },
            { label: t('nav.reminders'), value: counts.reminders },
            { label: t('settings.currencies'), value: counts.rates },
            { label: t('nav.budget'), value: counts.budgets },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface-2/20 px-3 py-2 text-[11px]">
              <span className="text-text-secondary">{item.label}</span>
              <Badge tone="primary">{item.value}</Badge>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-[11px] leading-5 text-text-secondary"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t('backup.cloudNote')}</p>
      </SectionCard>
    </div>
  )
}

