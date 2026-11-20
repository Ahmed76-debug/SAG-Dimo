import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive, Database, Download, RefreshCw, RotateCcw, Trash2, Lock, CheckSquare, Square, ShieldAlert,
} from 'lucide-react'
import { db, type ArchiveItem } from '@/lib/db'
import { logAudit, can } from '@/services/auth.service'
import { restoreArchiveToDraft } from '@/services/tb.service'
import { sqlStats, sqliteReady, downloadSqliteFile, flushSqlSync } from '@/lib/sqlMirror'
import { useAuthStore } from '@/stores/auth.store'
import { useI18nStore } from '@/stores/i18n.store'
import {
  PageHeader, SectionCard, Button, Badge, Modal, IconButton, toast,
} from '@/components/ui'

const PROTECTED = new Set([
  'officeProfile',
  'appSettings',
  'users',
  'auditLogs',
  'tutorialVideos',
  'currencyRates',
])

const DEPENDENTS: Record<string, string[]> = {
  companies: [
    'accounts',
    'trialBalanceImports',
    'trialBalanceLines',
    'adjustments',
    'reminders',
    'archive',
    'budgets',
  ],
  trialBalanceImports: ['trialBalanceLines'],
  accounts: ['trialBalanceLines'],
}

const LABELS: Record<string, { ar: string; en: string }> = {
  officeProfile: { ar: 'ملف المكتب', en: 'Office profile' },
  appSettings: { ar: 'إعدادات التطبيق', en: 'App settings' },
  companies: { ar: 'الشركات', en: 'Companies' },
  accounts: { ar: 'دليل الحسابات', en: 'Chart of accounts' },
  trialBalanceImports: { ar: 'عمليات استيراد الميزان', en: 'Trial balance imports' },
  trialBalanceLines: { ar: 'بنود ميزان المراجعة', en: 'Trial balance lines' },
  adjustments: { ar: 'قيود التسوية', en: 'Adjustments' },
  users: { ar: 'المستخدمون', en: 'Users' },
  reminders: { ar: 'التذكيرات', en: 'Reminders' },
  archive: { ar: 'الأرشيف', en: 'Archive' },
  currencyRates: { ar: 'أسعار العملات', en: 'Currency rates' },
  budgets: { ar: 'الموازنات', en: 'Budgets' },
  auditLogs: { ar: 'سجل التدقيق', en: 'Audit log' },
  tutorialVideos: { ar: 'فيديوهات الشرح', en: 'Tutorial videos' },
}

const T = {
  ar: {
    title: 'أدوات البيانات',
    subtitle: 'تفريغ الجداول المحددة نهائياً واستعادة النسخ المؤرشفة مع حماية الحسابات والإعدادات وسجل التدقيق.',
    refresh: 'تحديث',
    truncate: 'تفريغ المحدد',
    protectedNote: 'الحذف نهائي ولا يمكن التراجع عنه. الجداول المحمية تظهر بقفل ولا يمكن تحديدها.',
    tables: 'الجداول',
    tablesSub: 'حدد الجداول التي تريد تفريغها. سيتم تسجيل العملية في سجل التدقيق.',
    selectAll: 'تحديد الكل',
    clearAll: 'إلغاء تحديد الكل',
    protected: 'محمي',
    selected: 'المحدد',
    rows: 'صف',
    dependentNote: 'سيتم أيضاً تفريغ الجداول التابعة:',
    confirmTitle: 'تأكيد تفريغ الجداول',
    confirmBody: 'سيتم حذف جميع الصفوف من {{count}} جدولاً ({{rows}} صف). لا يمكن التراجع عن هذه العملية.',
    confirm: 'تفريغ نهائي',
    cancel: 'إلغاء',
    done: 'تم تفريغ الجداول المحددة',
    failed: 'تعذّر تفريغ الجداول',
    noAccess: 'لا تملك صلاحية الوصول إلى أدوات البيانات.',
    loading: 'جارٍ قراءة الجداول…',
    tabTruncate: 'تفريغ الجداول',
    tabArchive: 'الأرشيف والاستعادة',
    archiveTitle: 'النسخ المؤرشفة',
    archiveSubtitle: 'استعد نسخة مؤرشفة إلى مسودة ميزان مراجعة جديدة، أو احذفها نهائياً.',
    archiveLoading: 'جارٍ قراءة الأرشيف…',
    archiveEmpty: 'لا توجد نسخ مؤرشفة حالياً.',
    restore: 'استعادة',
    delete: 'حذف نهائي',
    restoreConfirm: 'سيتم إنشاء مسودة ميزان مراجعة جديدة من هذه النسخة المؤرشفة. هل تريد المتابعة؟',
    deleteConfirm: 'سيتم حذف هذه النسخة المؤرشفة نهائياً. هل تريد المتابعة؟',
    restoreDone: 'تمت استعادة النسخة إلى مسودة ميزان المراجعة',
    deleteDone: 'تم حذف النسخة المؤرشفة نهائياً',
    restoreFailed: 'تعذّرت استعادة النسخة',
    deleteFailed: 'تعذّر حذف النسخة المؤرشفة',
    sqlTitle: 'قاعدة SQLite المحلية',
    sqlSub: '{{tables}} جدول · {{rows}} صف · {{columns}} عمود',
    sqlReady: 'متصل',
    sqlNotReady: 'غير مهيأ',
    sqlDownload: 'تنزيل SQLite',
  },
  en: {
    title: 'Data tools',
    subtitle: 'Permanently clear selected tables and restore archived snapshots while protecting accounts, settings, and the audit log.',
    refresh: 'Refresh',
    truncate: 'Clear selected',
    protectedNote: 'Deletion is permanent and cannot be undone. Protected tables are locked and cannot be selected.',
    tables: 'Tables',
    tablesSub: 'Select the tables you want to clear. The operation is written to the audit log.',
    selectAll: 'Select all',
    clearAll: 'Clear selection',
    protected: 'Protected',
    selected: 'Selected',
    rows: 'rows',
    dependentNote: 'Dependent tables will also be cleared:',
    confirmTitle: 'Confirm table truncation',
    confirmBody: 'All rows will be deleted from {{count}} table(s) ({{rows}} rows). This cannot be undone.',
    confirm: 'Truncate permanently',
    cancel: 'Cancel',
    done: 'Selected tables were cleared',
    failed: 'Failed to clear tables',
    noAccess: 'You do not have permission to access data tools.',
    loading: 'Reading tables…',
    tabTruncate: 'Truncate tables',
    tabArchive: 'Archive & restore',
    archiveTitle: 'Archived snapshots',
    archiveSubtitle: 'Restore an archived snapshot into a new trial balance draft, or delete it permanently.',
    archiveLoading: 'Reading archive…',
    archiveEmpty: 'No archived snapshots yet.',
    restore: 'Restore',
    delete: 'Delete permanently',
    restoreConfirm: 'A new trial balance draft will be created from this archived snapshot. Continue?',
    deleteConfirm: 'This archived snapshot will be deleted permanently. Continue?',
    restoreDone: 'Snapshot restored to a trial balance draft',
    deleteDone: 'Archived snapshot deleted permanently',
    restoreFailed: 'Failed to restore snapshot',
    deleteFailed: 'Failed to delete archived snapshot',
    sqlTitle: 'Local SQLite database',
    sqlSub: '{{tables}} tables · {{rows}} rows · {{columns}} columns',
    sqlReady: 'Connected',
    sqlNotReady: 'Not ready',
    sqlDownload: 'Download SQLite',
  },
}

interface TableInfo {
  name: string
  count: number
  protected: boolean
}

type TabKey = 'truncate' | 'archive'
type ArchiveRow = ArchiveItem & { companyName: string }

export function DataToolsPage() {
  const { language } = useI18nStore()
  const user = useAuthStore((s) => s.user)
  const lang = language === 'en' ? 'en' : 'ar'
  const tx = T[lang]
  const [tab, setTab] = useState<TabKey>('truncate')
  const [tables, setTables] = useState<TableInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [archiveRows, setArchiveRows] = useState<ArchiveRow[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [sqlInfo, setSqlInfo] = useState<{
    tables: { name: string; rows: number; columns: number }[]
    totalRows: number
  }>({ tables: [], totalRows: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const infos = await Promise.all(
        db.tables.map(async (t) => ({
          name: t.name,
          count: await t.count(),
          protected: PROTECTED.has(t.name),
        })),
      )
      infos.sort((a, b) => {
        if (a.protected !== b.protected) return a.protected ? 1 : -1
        return a.name.localeCompare(b.name)
      })
      setTables(infos)
      setSqlInfo(sqlStats())
      setSelected((prev) => {
        const next = new Set<string>()
        for (const name of prev) {
          const row = infos.find((i) => i.name === name)
          if (row && !row.protected) next.add(name)
        }
        return next
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const loadArchive = useCallback(async () => {
    setArchiveLoading(true)
    try {
      const [items, companies] = await Promise.all([
        db.archive.toArray(),
        db.companies.toArray(),
      ])
      const companyMap = new Map(companies.map((c) => [c.id, c]))
      const rows: ArchiveRow[] = items
        .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt))
        .map((item) => {
          const company = companyMap.get(item.companyId)
          return {
            ...item,
            companyName: company
              ? lang === 'ar'
                ? company.nameAr
                : company.nameEn
              : `#${item.companyId}`,
          }
        })
      setArchiveRows(rows)
    } finally {
      setArchiveLoading(false)
    }
  }, [lang])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (tab === 'archive') void loadArchive()
  }, [tab, loadArchive])

  const selectable = useMemo(() => tables.filter((t) => !t.protected), [tables])
  const expanded = useMemo(() => {
    const set = new Set(selected)
    for (const name of selected) {
      for (const child of DEPENDENTS[name] ?? []) {
        if (!PROTECTED.has(child)) set.add(child)
      }
    }
    return set
  }, [selected])
  const selectedRows = useMemo(
    () => tables.filter((t) => expanded.has(t.name)),
    [tables, expanded],
  )
  const totalRows = useMemo(
    () => selectedRows.reduce((sum, t) => sum + t.count, 0),
    [selectedRows],
  )
  const dependentNames = useMemo(
    () => selectedRows.filter((t) => !selected.has(t.name)).map((t) => t.name),
    [selectedRows, selected],
  )

  const label = (name: string) => LABELS[name]?.[lang] ?? name

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === selectable.length) return new Set()
      return new Set(selectable.map((t) => t.name))
    })
  }

  const truncate = async () => {
    if (!selectedRows.length) return
    setWorking(true)
    const names = selectedRows.map((t) => t.name)
    try {
      const targets = db.tables.filter((t) => names.includes(t.name))
      await db.transaction('rw', targets, async () => {
        for (const t of targets) await t.clear()
      })
      await logAudit(
        'truncate',
        'data-tools',
        undefined,
        `تفريغ الجداول: ${names.join(', ')}`,
        `Truncated tables: ${names.join(', ')}`,
        user?.fullNameAr,
      )
      toast(tx.done, 'success')
      setSelected(new Set())
      setConfirmOpen(false)
      await flushSqlSync()
      await Promise.all([load(), loadArchive()])
    } catch (err) {
      toast(`${tx.failed}: ${err instanceof Error ? err.message : ''}`, 'error')
    } finally {
      setWorking(false)
    }
  }

  const restoreArchive = async (item: ArchiveRow) => {
    if (!item.id || !user) return
    if (!window.confirm(tx.restoreConfirm)) return
    setWorking(true)
    try {
      await restoreArchiveToDraft(item.id, { id: user.id, nameAr: user.fullNameAr })
      toast(tx.restoreDone, 'success')
      await loadArchive()
    } catch (err) {
      toast(`${tx.restoreFailed}: ${err instanceof Error ? err.message : ''}`, 'error')
    } finally {
      setWorking(false)
    }
  }

  const deleteArchive = async (item: ArchiveRow) => {
    if (!item.id) return
    if (!window.confirm(tx.deleteConfirm)) return
    setWorking(true)
    try {
      await db.archive.delete(item.id)
      await logAudit(
        'delete',
        'archive',
        item.id,
        `حذف نسخة مؤرشفة: ${item.titleAr}`,
        `Deleted archive item: ${item.titleEn}`,
        user?.fullNameAr,
      )
      toast(tx.deleteDone, 'success')
      await loadArchive()
    } catch (err) {
      toast(`${tx.deleteFailed}: ${err instanceof Error ? err.message : ''}`, 'error')
    } finally {
      setWorking(false)
    }
  }

  if (!can(user?.role, 'admin')) {
    return (
      <>
        <PageHeader
          title={tx.title}
          subtitle={tx.subtitle}
          icon={<Database className="h-6 w-6" />}
        />
        <SectionCard>
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <ShieldAlert className="h-5 w-5 text-danger" />
            {tx.noAccess}
          </div>
        </SectionCard>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={lang === 'ar' ? 'إدارة النظام' : 'System administration'}
        title={tx.title}
        subtitle={tx.subtitle}
        icon={<Database className="h-6 w-6" />}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => (tab === 'truncate' ? void load() : void loadArchive())}
              disabled={loading || archiveLoading || working}
              icon={<RefreshCw className={loading || archiveLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
            >
              {tx.refresh}
            </Button>
            {tab === 'truncate' && (
              <Button
                variant="danger"
                onClick={() => setConfirmOpen(true)}
                disabled={!selectedRows.length || working}
                icon={<Trash2 className="h-4 w-4" />}
              >
                {tx.truncate} ({selectedRows.length})
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Database className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">{tx.sqlTitle}</p>
            <p className="text-xs text-text-secondary">
              {tx.sqlSub
                .replace('{{tables}}', String(sqlInfo.tables.length))
                .replace('{{rows}}', sqlInfo.totalRows.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US'))
                .replace(
                  '{{columns}}',
                  String(sqlInfo.tables.reduce((sum, table) => sum + table.columns, 0)),
                )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={sqliteReady() ? 'success' : 'muted'}>
            {sqliteReady() ? tx.sqlReady : tx.sqlNotReady}
          </Badge>
          <Button
            variant="secondary"
            onClick={() => downloadSqliteFile('muraqib.sqlite')}
            disabled={!sqliteReady()}
            icon={<Download className="h-4 w-4" />}
          >
            {tx.sqlDownload}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-border">
        {[
          { key: 'truncate' as const, label: tx.tabTruncate, icon: Trash2, count: undefined },
          { key: 'archive' as const, label: tx.tabArchive, icon: Archive, count: archiveRows.length },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={[
              'relative inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors',
              tab === t.key ? 'text-primary' : 'text-text-secondary hover:text-text',
            ].join(' ')}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
                {t.count}
              </span>
            )}
            {tab === t.key && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {tab === 'truncate' ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/25 bg-danger/5 px-4 py-3 text-xs text-text-secondary">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-danger" />
              {tx.protectedNote}
            </div>
            <span className="font-semibold text-danger">
              {tx.selected}: {selectedRows.length} / {totalRows.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')} {tx.rows}
            </span>
          </div>

          <SectionCard
            title={tx.tables}
            subtitle={tx.tablesSub}
            action={
              <Button variant="ghost" onClick={toggleAll} disabled={!selectable.length || working} icon={selected.size === selectable.length && selectable.length > 0 ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}>
                {selected.size === selectable.length && selectable.length > 0 ? tx.clearAll : tx.selectAll}
              </Button>
            }
          >
            {loading ? (
              <div className="py-10 text-center text-sm text-text-secondary">{tx.loading}</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {tables.map((t) => {
                  const isSelected = selected.has(t.name)
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => !t.protected && toggle(t.name)}
                      disabled={t.protected || working}
                      className={[
                        'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-start transition',
                        t.protected
                          ? 'cursor-not-allowed border-border bg-surface-2/40 opacity-70'
                          : isSelected
                            ? 'border-danger/50 bg-danger/5'
                            : 'border-border bg-surface hover:border-primary/40 hover:bg-surface-2',
                      ].join(' ')}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        {t.protected ? (
                          <Lock className="h-4 w-4 shrink-0 text-text-secondary" />
                        ) : isSelected ? (
                          <CheckSquare className="h-4 w-4 shrink-0 text-danger" />
                        ) : (
                          <Square className="h-4 w-4 shrink-0 text-text-secondary" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-text">{label(t.name)}</span>
                          <span className="block truncate text-[11px] text-text-secondary" dir="ltr">{t.name}</span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge tone={t.protected ? 'muted' : t.count ? 'info' : 'muted'}>
                          {t.count.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                        </Badge>
                        {t.protected && <span className="text-[10px] text-text-secondary">{tx.protected}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {dependentNames.length > 0 && (
              <p className="mt-3 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-[11.5px] text-text-secondary">
                {tx.dependentNote}{' '}
                <span className="font-semibold text-text">{dependentNames.map(label).join('، ')}</span>
              </p>
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard title={tx.archiveTitle} subtitle={tx.archiveSubtitle}>
          {archiveLoading ? (
            <div className="py-10 text-center text-sm text-text-secondary">{tx.archiveLoading}</div>
          ) : archiveRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-text-secondary">
              <Archive className="h-8 w-8 opacity-50" />
              {tx.archiveEmpty}
            </div>
          ) : (
            <div className="space-y-2">
              {archiveRows.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Archive className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text">
                        {lang === 'ar' ? item.titleAr : item.titleEn}
                      </p>
                      <p className="truncate text-xs text-text-secondary">
                        {item.companyName} · {item.year} · {item.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      title={tx.restore}
                      tone="success"
                      onClick={() => void restoreArchive(item)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      title={tx.delete}
                      tone="danger"
                      onClick={() => void deleteArchive(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => !working && setConfirmOpen(false)}
        title={tx.confirmTitle}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={working}>{tx.cancel}</Button>
            <Button variant="danger" onClick={() => void truncate()} disabled={working} icon={<Trash2 className="h-4 w-4" />}>
              {tx.confirm}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-text-secondary">
          {tx.confirmBody
            .replace('{{count}}', String(selectedRows.length))
            .replace('{{rows}}', totalRows.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US'))}
        </p>
      </Modal>
    </>
  )
}
