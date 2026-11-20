import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ArrowUp, CalendarClock, CheckCircle2, DatabaseBackup, Download, ExternalLink,
  FileArchive, Folder, FolderOpen, FolderPlus, HardDrive, History, Home, Loader2, Plus,
  RefreshCw, RotateCcw, ShieldCheck, Trash2, Upload, X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Badge, Button, EmptyState, Field, Input, SearchInput, Select, Textarea,
} from '@/components/ui/primitives';
import { ConfirmDialog, Menu, Modal, Tabs } from '@/components/ui/overlays';
import {
  DataTable, ErrorPanel, Panel, StatCard, TableSkeleton, Td, Th, Tr,
} from '@/components/ui/page';
import { api, downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiQuery } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import type { BackupFile, BackupRecord, BrowseResult } from '@/lib/types';
import { cn, formatBytes, formatDate, formatNumber, timeAgo } from '@/lib/utils';

interface BackupsResponse {
  dir: string;
  defaultDir: string;
  autoHours: number;
  keep: number;
  history: BackupRecord[];
  files: BackupFile[];
}

type BrowserMode = 'folder' | 'restore' | 'settings';
type RestoreTarget = { path: string; filename: string };

const KIND_META: Record<string, { label: string; tone: 'primary' | 'info' | 'warning' }> = {
  manual: { label: 'يدوية', tone: 'primary' },
  auto: { label: 'تلقائية', tone: 'info' },
  'pre-restore': { label: 'قبل الاستعادة', tone: 'warning' },
  'pre-truncate': { label: 'قبل التفريغ', tone: 'warning' },
};

function joinPath(base: string, name: string) {
  const sep = base.includes('\\') || base === '' ? '\\' : '/';
  return `${base.replace(/[\\/]+$/, '')}${sep}${name}`;
}

export function Backups() {
  const { can } = useAuth();
  const { success, error: toastError } = useToast();
  const manage = can('backups.manage');
  const canSettings = can('settings.manage');

  const [tab, setTab] = useState<'history' | 'files'>('history');
  const [createOpen, setCreateOpen] = useState(false);
  const [note, setNote] = useState('');
  const [targetDir, setTargetDir] = useState('');
  const [browser, setBrowser] = useState<{ mode: BrowserMode; initial?: string } | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<RestoreTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupRecord | null>(null);
  const [upload, setUpload] = useState<{ filename: string; dataBase64: string; size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const backups = useApiQuery<BackupsResponse>('/backups', undefined, []);
  const data = backups.data;
  const history = data?.history || [];
  const files = data?.files || [];

  const totalSize = history.reduce((sum, item) => sum + (item.size || 0), 0);
  const latest = history[0]?.createdAt;

  const openCreate = () => {
    setNote('');
    setTargetDir(data?.defaultDir || data?.dir || '');
    setCreateOpen(true);
  };

  const createBackup = async () => {
    setBusy(true);
    try {
      await api('/backups', { method: 'POST', body: { targetDir: targetDir.trim() || undefined, note: note.trim() } });
      success('تم إنشاء النسخة الاحتياطية', targetDir || data?.defaultDir);
      setCreateOpen(false);
      setNote('');
      backups.reload();
    } catch (err) {
      toastError('تعذر إنشاء النسخة الاحتياطية', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const setDefaultDir = async (dir: string) => {
    setBusy(true);
    try {
      await api('/settings', { method: 'PUT', body: { 'backup.dir': dir } });
      success('تم تحديث مجلد النسخ الاحتياطي', dir);
      setBrowser(null);
      backups.reload();
    } catch (err) {
      toastError('تعذر تحديث المجلد', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!restoreTarget) return;
    setBusy(true);
    try {
      await api('/backups/restore', { method: 'POST', body: { path: restoreTarget.path } });
      success('تمت استعادة النسخة بنجاح', `أُنشئت نسخة أمان قبل الاستعادة من ${restoreTarget.filename}`);
      setRestoreTarget(null);
      backups.reload();
    } catch (err) {
      toastError('تعذر استعادة النسخة', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const restoreUpload = async () => {
    if (!upload) return;
    setBusy(true);
    try {
      await api('/backups/restore-upload', {
        method: 'POST',
        body: { filename: upload.filename, dataBase64: upload.dataBase64 },
      });
      success('تمت استعادة الملف المرفوع', 'أُنشئت نسخة أمان قبل الاستعادة تلقائياً');
      setUpload(null);
      backups.reload();
    } catch (err) {
      toastError('تعذر استعادة الملف', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api(`/backups/${deleteTarget.id}`, { method: 'DELETE' });
      success('تم حذف سجل النسخة', deleteTarget.filename);
      setDeleteTarget(null);
      backups.reload();
    } catch (err) {
      toastError('تعذر حذف النسخة', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const download = async (item: { path: string; filename: string }) => {
    try {
      await downloadFile(`/backups/download?path=${encodeURIComponent(item.path)}`, item.filename);
    } catch (err) {
      toastError('تعذر تنزيل الملف', err instanceof Error ? err.message : undefined);
    }
  };

  const reveal = async (path: string) => {
    try {
      await api('/system/reveal', { method: 'POST', body: { path } });
      success('تم فتح المجلد في المستكشف');
    } catch (err) {
      toastError('تعذر فتح المجلد', err instanceof Error ? err.message : undefined);
    }
  };

  const pickNative = async (apply: (dir: string) => void) => {
    setPicking(true);
    try {
      const result = await api<{ path: string | null }>('/system/pick-folder', {
        method: 'POST',
        body: { initial: targetDir || data?.dir },
      });
      if (result.path) {
        apply(result.path);
        success('تم اختيار المجلد', result.path);
      }
    } catch (err) {
      toastError('تعذر فتح منتقي المجلدات', err instanceof Error ? err.message : undefined);
    } finally {
      setPicking(false);
    }
  };

  const onUploadPicked = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.mftbak')) {
      toastError('ملف غير صالح', 'يجب اختيار ملف بامتداد .mftbak');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
      setUpload({ filename: file.name, dataBase64: base64, size: file.size });
    };
    reader.onerror = () => toastError('تعذر قراءة الملف');
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><DatabaseBackup size={12} /> حماية البيانات</>}
        title="النسخ الاحتياطي"
        description="أنشئ نسخاً موقّعة من قاعدة البيانات، واحفظها في المجلد الذي تختاره — محلياً أو على خادم العميل."
        actions={(
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".mftbak"
              className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) onUploadPicked(file); }}
            />
            {manage && (
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload size={15} /> استعادة من ملف
              </Button>
            )}
            {manage && (
              <Button variant="primary" onClick={openCreate}>
                <Plus size={15} /> إنشاء نسخة
              </Button>
            )}
          </>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="النسخ المسجّلة"
          value={formatNumber(history.length)}
          hint={`${formatNumber(files.length)} ملف في المجلد الحالي`}
          icon={DatabaseBackup}
          tone="primary"
          delay={0}
        />
        <StatCard
          label="آخر نسخة"
          value={latest ? timeAgo(latest) : '—'}
          hint={latest ? formatDate(latest, true) : 'لم تُنشأ نسخ بعد'}
          icon={History}
          tone="info"
          delay={0.05}
        />
        <StatCard
          label="الحجم الإجمالي"
          value={formatBytes(totalSize)}
          hint="لجميع النسخ المسجّلة"
          icon={FileArchive}
          tone="accent"
          delay={0.1}
        />
        <StatCard
          label="الجدولة التلقائية"
          value={data?.autoHours ? `${data.autoHours} س` : 'يدوي'}
          hint={data?.autoHours ? `كل ${formatNumber(data.autoHours)} ساعة` : `الاحتفاظ بآخر ${formatNumber(data?.keep || 0)} نسخة`}
          icon={CalendarClock}
          tone={data?.autoHours ? 'success' : 'warning'}
          delay={0.15}
        />
      </div>

      <Panel
        title="مجلد النسخ الاحتياطي"
        description="المسار الذي تُحفظ فيه النسخ الجديدة افتراضياً — يمكن تغييره في أي وقت."
        action={(
          <div className="flex flex-wrap items-center gap-2">
            {manage && (
              <Button variant="ghost" size="sm" onClick={() => reveal(data?.dir || '')} disabled={!data?.dir}>
                <FolderOpen size={14} /> فتح في المستكشف
              </Button>
            )}
            {canSettings && (
              <Button variant="secondary" size="sm" onClick={() => setBrowser({ mode: 'settings', initial: data?.dir })}>
                <Folder size={14} /> تغيير المجلد
              </Button>
            )}
          </div>
        )}
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/55 p-3.5 sm:flex-row sm:items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary-soft text-primary">
              <FolderOpen size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[12px] font-semibold text-ink">المجلد الحالي</p>
                {data?.dir === data?.defaultDir && <Badge tone="primary" dot>الافتراضي</Badge>}
              </div>
              <p dir="ltr" className="mt-1 break-all font-mono text-[11.5px] text-soft">{data?.dir || '…'}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Badge tone="neutral">حفظ {formatNumber(data?.keep || 0)} نسخة</Badge>
              <Badge tone={data?.autoHours ? 'success' : 'neutral'}>
                {data?.autoHours ? `تلقائي كل ${formatNumber(data.autoHours)} ساعة` : 'تلقائي معطّل'}
              </Badge>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.07] px-3.5 py-2.5">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-[11px] leading-relaxed text-soft">
              الاستعادة تستبدل قاعدة البيانات الحالية بالكامل. ينشئ النظام نسخة أمان تلقائية قبل كل استعادة،
              ويمكنك الرجوع إليها من السجل في أي وقت.
            </p>
          </div>
        </div>
      </Panel>

      <Panel padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5">
          <Tabs
            tabs={[
              { id: 'history', label: 'سجل النسخ', icon: <History size={14} />, count: history.length },
              { id: 'files', label: 'ملفات المجلد', icon: <FileArchive size={14} />, count: files.length },
            ]}
            value={tab}
            onChange={setTab}
            className="border-0"
          />
          <div className="flex items-center gap-1.5">
            <Button size="icon" variant="ghost" onClick={backups.reload} title="تحديث">
              <RefreshCw size={15} className={backups.loading ? 'animate-spin' : undefined} />
            </Button>
          </div>
        </div>

        {backups.loading && !backups.data ? (
          <TableSkeleton rows={6} cols={5} />
        ) : backups.error ? (
          <ErrorPanel message={backups.error} onRetry={backups.reload} />
        ) : tab === 'history' ? (
          history.length === 0 ? (
            <EmptyState
              icon={<DatabaseBackup size={25} />}
              title="لا توجد نسخ احتياطية بعد"
              description="أنشئ أول نسخة لحماية المنتجات والعملاء والتراخيص، أو فعّل النسخ التلقائي من الإعدادات."
              action={manage ? <Button variant="primary" onClick={openCreate}><Plus size={15} /> إنشاء نسخة</Button> : undefined}
            />
          ) : (
            <>
              <div className="hidden md:block">
                <DataTable minWidth={900}>
                  <thead>
                    <tr>
                      <Th>الملف</Th>
                      <Th>النوع</Th>
                      <Th>الحجم</Th>
                      <Th>التاريخ</Th>
                      <Th>أنشأها</Th>
                      <Th>الحالة</Th>
                      <Th width={54}><span className="sr-only">إجراءات</span></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <Tr key={item.id}>
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted">
                              <FileArchive size={16} />
                            </span>
                            <div className="min-w-0">
                              <p dir="ltr" className="max-w-[280px] truncate font-mono text-[11px] text-soft">{item.filename}</p>
                              <p className="mt-0.5 max-w-[280px] truncate text-[10px] text-muted">{item.note || 'بدون ملاحظات'}</p>
                            </div>
                          </div>
                        </Td>
                        <Td><Badge tone={KIND_META[item.kind]?.tone || 'neutral'}>{KIND_META[item.kind]?.label || item.kind}</Badge></Td>
                        <Td><span className="numeric text-[11.5px] text-soft">{formatBytes(item.size)}</span></Td>
                        <Td>
                          <p className="text-[11px] text-soft">{formatDate(item.createdAt, true)}</p>
                          <p className="mt-0.5 text-[10px] text-muted">{timeAgo(item.createdAt)}</p>
                        </Td>
                        <Td><span className="text-[11.5px] text-soft">{item.createdBy || '—'}</span></Td>
                        <Td>
                          {item.exists
                            ? <Badge tone="success" dot>متاحة</Badge>
                            : <Badge tone="danger" dot>مفقودة</Badge>}
                        </Td>
                        <Td>
                          <Menu
                            items={[
                              { label: 'تنزيل', icon: <Download size={14} />, onClick: () => download(item), disabled: !item.exists },
                              ...(manage ? [{ label: 'استعادة', icon: <RotateCcw size={14} />, onClick: () => setRestoreTarget({ path: item.path, filename: item.filename }), disabled: !item.exists }] : []),
                              { label: 'فتح المجلد', icon: <FolderOpen size={14} />, onClick: () => reveal(item.path.replace(/[\\/][^\\/]+$/, '')), disabled: !manage },
                              ...(manage ? [{ label: 'حذف السجل', icon: <Trash2 size={14} />, danger: true, onClick: () => setDeleteTarget(item) }] : []),
                            ]}
                          />
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </DataTable>
              </div>

              <div className="divide-y divide-line md:hidden">
                {history.map((item) => (
                  <div key={item.id} className="px-3.5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p dir="ltr" className="truncate font-mono text-[11px] text-soft">{item.filename}</p>
                        <p className="mt-1 text-[10px] text-muted">{item.note || 'بدون ملاحظات'}</p>
                      </div>
                      <Menu
                        items={[
                          { label: 'تنزيل', icon: <Download size={14} />, onClick: () => download(item), disabled: !item.exists },
                          ...(manage ? [{ label: 'استعادة', icon: <RotateCcw size={14} />, onClick: () => setRestoreTarget({ path: item.path, filename: item.filename }), disabled: !item.exists }] : []),
                          ...(manage ? [{ label: 'حذف السجل', icon: <Trash2 size={14} />, danger: true, onClick: () => setDeleteTarget(item) }] : []),
                        ]}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={KIND_META[item.kind]?.tone || 'neutral'}>{KIND_META[item.kind]?.label || item.kind}</Badge>
                      {item.exists ? <Badge tone="success" dot>متاحة</Badge> : <Badge tone="danger" dot>مفقودة</Badge>}
                      <span className="numeric text-[10.5px] text-muted">{formatBytes(item.size)}</span>
                      <span className="text-[10.5px] text-muted">· {formatDate(item.createdAt, true)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        ) : files.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={25} />}
            title="لا توجد ملفات في هذا المجلد"
            description="ملفات النسخ الاحتياطي بامتداد .mftbak ستظهر هنا مباشرة من المجلد المحدد."
            action={manage ? <Button variant="secondary" onClick={openCreate}><Plus size={15} /> إنشاء نسخة</Button> : undefined}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <DataTable minWidth={720}>
                <thead>
                  <tr>
                    <Th>الملف</Th>
                    <Th>الحجم</Th>
                    <Th>آخر تعديل</Th>
                    <Th width={190}>إجراء</Th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <Tr key={file.path}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted">
                            <FileArchive size={16} />
                          </span>
                          <p dir="ltr" className="max-w-[340px] truncate font-mono text-[11px] text-soft">{file.filename}</p>
                        </div>
                      </Td>
                      <Td><span className="numeric text-[11.5px] text-soft">{formatBytes(file.size)}</span></Td>
                      <Td><span className="text-[11px] text-soft">{formatDate(file.modifiedAt, true)}</span></Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => download(file)}><Download size={13} /> تنزيل</Button>
                          {manage && (
                            <Button size="sm" variant="soft" onClick={() => setRestoreTarget({ path: file.path, filename: file.filename })}>
                              <RotateCcw size={13} /> استعادة
                            </Button>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </div>

            <div className="divide-y divide-line md:hidden">
              {files.map((file) => (
                <div key={file.path} className="px-3.5 py-3">
                  <p dir="ltr" className="truncate font-mono text-[11px] text-soft">{file.filename}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[10.5px] text-muted">
                      {formatBytes(file.size)} · {formatDate(file.modifiedAt)}
                    </p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => download(file)}><Download size={13} /></Button>
                      {manage && (
                        <Button size="sm" variant="soft" onClick={() => setRestoreTarget({ path: file.path, filename: file.filename })}>
                          <RotateCcw size={13} /> استعادة
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      {/* ---------------------------------- create -------------------------------- */}
      <Modal
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        title="إنشاء نسخة احتياطية"
        description="تُحفظ النسخة بصيغة .mftbak مضغوطة ومشفّرة مع بصمة تحقق SHA-256."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={busy}>إلغاء</Button>
            <Button variant="primary" onClick={createBackup} loading={busy}>
              <DatabaseBackup size={15} /> إنشاء النسخة
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label="مجلد الحفظ" hint="اتركه كما هو لاستخدام المجلد الافتراضي، أو اختر مجلداً آخر.">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={targetDir}
                onChange={(e) => setTargetDir(e.target.value)}
                dir="ltr"
                aria-label="مجلد الحفظ"
                className="font-mono text-[11.5px]"
                placeholder="C:\\Backups\\Miftah"
              />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setBrowser({ mode: 'folder', initial: targetDir })}>
                  <Folder size={14} /> استعراض
                </Button>
                <Button variant="secondary" onClick={() => pickNative(setTargetDir)} loading={picking} title="منتقي Windows">
                  <HardDrive size={14} />
                </Button>
              </div>
            </div>
          </Field>

          <Field label="ملاحظة" hint="اختيارية — تساعدك على تمييز النسخة لاحقاً.">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: نسخة ما قبل إصدار المنتج الجديد…"
              maxLength={300}
            />
          </Field>

          <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-success" />
            <p className="text-[11px] leading-relaxed text-muted">
              تُحفظ نسخة كاملة من المنتجات والعملاء والتراخيص والتفعيلات والإعدادات. لا تُحفظ مفاتيح التوقيع
              الخاصة داخل النسخة، بل تبقى في مجلد آمن منفصل.
            </p>
          </div>
        </div>
      </Modal>

      {/* --------------------------------- browser -------------------------------- */}
      <FolderBrowser
        open={!!browser}
        mode={browser?.mode || 'folder'}
        initial={browser?.initial}
        onClose={() => setBrowser(null)}
        onPickFolder={(dir) => {
          if (browser?.mode === 'settings') setDefaultDir(dir);
          else {
            setTargetDir(dir);
            setBrowser(null);
          }
        }}
        onPickFile={(file) => {
          setBrowser(null);
          setRestoreTarget({ path: file.path, filename: file.filename });
        }}
      />

      {/* --------------------------------- restore -------------------------------- */}
      <ConfirmDialog
        open={!!restoreTarget}
        onClose={() => !busy && setRestoreTarget(null)}
        onConfirm={restore}
        loading={busy}
        tone="primary"
        confirmText="استعادة النسخة"
        title="استعادة النسخة الاحتياطية؟"
        description={(
          <div className="space-y-2">
            <p>سيتم استبدال قاعدة البيانات الحالية بالكامل بمحتوى هذه النسخة.</p>
            <p dir="ltr" className="break-all rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[10.5px] text-soft">
              {restoreTarget?.filename}
            </p>
            <p className="text-[11px]">ينشئ النظام نسخة أمان تلقائية قبل الاستعادة، ويمكن التراجع عنها من السجل.</p>
          </div>
        )}
      />

      <ConfirmDialog
        open={!!upload}
        onClose={() => !busy && setUpload(null)}
        onConfirm={restoreUpload}
        loading={busy}
        tone="primary"
        confirmText="استعادة الملف"
        title="استعادة من ملف خارجي؟"
        description={(
          <div className="space-y-2">
            <p>سيتم رفع الملف إلى مجلد النسخ ثم استعادة محتواه فوق قاعدة البيانات الحالية.</p>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5">
              <span dir="ltr" className="truncate font-mono text-[10.5px] text-soft">{upload?.filename}</span>
              <span className="numeric shrink-0 text-[10px] text-muted">{formatBytes(upload?.size || 0)}</span>
            </div>
            <p className="text-[11px]">تُنشأ نسخة أمان تلقائية قبل الاستعادة.</p>
          </div>
        )}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !busy && setDeleteTarget(null)}
        onConfirm={remove}
        loading={busy}
        confirmText="حذف النسخة"
        title="حذف سجل النسخة الاحتياطية؟"
        description={(
          <>
            سيُحذف الملف «<span dir="ltr" className="font-mono text-[11px]">{deleteTarget?.filename}</span>» من القرص
            ومن السجل نهائياً. لا يمكن التراجع عن هذا الإجراء.
          </>
        )}
      />
    </div>
  );
}

/* ------------------------------- folder browser ------------------------------ */
function FolderBrowser({
  open, mode, initial, onClose, onPickFolder, onPickFile,
}: {
  open: boolean;
  mode: BrowserMode;
  initial?: string;
  onClose: () => void;
  onPickFolder: (dir: string) => void;
  onPickFile: (file: BackupFile) => void;
}) {
  const { success, error: toastError } = useToast();
  const [path, setPath] = useState(initial || '');
  const [pathInput, setPathInput] = useState(initial || '');
  const [newFolder, setNewFolder] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPath(initial || '');
    setPathInput(initial || '');
    setNewFolder('');
  }, [open, initial]);

  const browse = useApiQuery<BrowseResult>('/system/browse', { path: path || undefined }, [path]);
  const data = browse.data;
  const dirs = data?.dirs || [];
  const files = data?.files || [];
  const drives = data?.drives || [];
  const shortcuts = [
    { label: 'الرئيسية', path: data?.home || '', icon: Home },
    { label: 'بيانات الاستوديو', path: data?.dataDir || '', icon: DatabaseBackup },
    { label: 'مجلد النسخ', path: data?.backupsDir || '', icon: FolderOpen },
  ].filter((item) => item.path);

  const go = (next: string) => {
    setPath(next);
    setPathInput(next);
  };

  const createFolder = async () => {
    if (!path || !newFolder.trim()) return;
    const next = joinPath(path, newFolder.trim());
    setCreating(true);
    try {
      await api('/system/mkdir', { method: 'POST', body: { path: next } });
      success('تم إنشاء المجلد', next);
      setNewFolder('');
      go(next);
      browse.reload();
    } catch (err) {
      toastError('تعذر إنشاء المجلد', err instanceof Error ? err.message : undefined);
    } finally {
      setCreating(false);
    }
  };

  const pick = () => {
    if (!path) return;
    setBusy(true);
    onPickFolder(path);
    setBusy(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={mode === 'restore' ? 'اختر ملف نسخة احتياطية' : 'اختر مجلد النسخ الاحتياطي'}
      description="تنقّل بين الأقراص والمجلدات، أو الصق مساراً مباشراً في الأعلى."
      footer={(
        <>
          <span dir="ltr" className="me-auto hidden max-w-[46%] truncate font-mono text-[10px] text-muted sm:block">
            {path || '…'}
          </span>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          {mode !== 'restore' && (
            <Button variant="primary" onClick={pick} disabled={!path} loading={busy}>
              <CheckCircle2 size={15} /> اختيار هذا المجلد
            </Button>
          )}
        </>
      )}
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="icon" variant="outline" onClick={() => data?.parent && go(data.parent)} disabled={!data?.parent} title="المجلد الأعلى">
            <ArrowUp size={15} />
          </Button>
          <Input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') go(pathInput.trim()); }}
            dir="ltr"
            placeholder="C:\\Backups"
            className="font-mono text-[11.5px]"
          />
          <Button variant="secondary" onClick={() => go(pathInput.trim())}>
            <ExternalLink size={14} /> انتقال
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => go(item.path)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2/60 px-2 py-1 text-[10.5px] text-muted transition hover:border-line-strong hover:text-ink"
              >
                <Icon size={12} /> {item.label}
              </button>
            );
          })}
          {drives.map((drive) => (
            <button
              key={drive}
              onClick={() => go(drive)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[10.5px] transition',
                path.startsWith(drive) ? 'border-primary/30 bg-primary-soft text-primary' : 'border-line bg-surface-2/60 text-muted hover:border-line-strong hover:text-ink'
              )}
            >
              <HardDrive size={12} /> {drive}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-3 py-2">
              <p className="text-[11px] font-semibold text-soft">المجلدات</p>
              <span className="numeric text-[10px] text-muted">{formatNumber(dirs.length)}</span>
            </div>
            <div className="max-h-[280px] min-h-[180px] overflow-y-auto p-1.5">
              {browse.loading && !data ? (
                <div className="flex items-center justify-center py-16 text-muted"><Loader2 size={18} className="animate-spin" /></div>
              ) : dirs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 py-14 text-center text-muted">
                  <Folder size={22} className="opacity-60" />
                  <p className="text-[11px]">{path ? 'لا توجد مجلدات فرعية' : 'اختر قرصاً للبدء'}</p>
                </div>
              ) : (
                dirs.map((dir) => (
                  <motion.button
                    key={dir.path}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => go(dir.path)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[11.5px] text-soft transition hover:bg-surface-2 hover:text-ink"
                  >
                    <Folder size={14} className="shrink-0 text-primary/80" />
                    <span className="truncate">{dir.name}</span>
                  </motion.button>
                ))
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line">
            <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-3 py-2">
              <p className="text-[11px] font-semibold text-soft">ملفات النسخ (.mftbak)</p>
              <span className="numeric text-[10px] text-muted">{formatNumber(files.length)}</span>
            </div>
            <div className="max-h-[280px] min-h-[180px] overflow-y-auto p-1.5">
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 py-14 text-center text-muted">
                  <FileArchive size={22} className="opacity-60" />
                  <p className="text-[11px]">لا توجد ملفات هنا</p>
                </div>
              ) : (
                files.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => (mode === 'restore' ? onPickFile(file) : undefined)}
                    disabled={mode !== 'restore'}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start transition',
                      mode === 'restore' ? 'hover:bg-surface-2' : 'cursor-default'
                    )}
                  >
                    <FileArchive size={14} className="shrink-0 text-info/80" />
                    <span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-soft">{file.filename}</span>
                    <span className="numeric shrink-0 text-[9.5px] text-muted">{formatBytes(file.size)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {path && (
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2/40 p-2.5 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2">
              <FolderPlus size={15} className="text-muted" />
              <Input
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                placeholder="اسم مجلد جديد داخل المسار الحالي…"
                className="h-9 flex-1 text-[11.5px]"
                onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); }}
              />
            </div>
            <Button size="sm" variant="secondary" onClick={createFolder} loading={creating} disabled={!newFolder.trim()}>
              إنشاء مجلد
            </Button>
          </div>
        )}

        {browse.error && <p className="text-[11px] text-danger">{browse.error}</p>}
      </div>
    </Modal>
  );
}
