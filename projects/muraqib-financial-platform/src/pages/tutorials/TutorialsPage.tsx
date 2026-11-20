import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from "@/lib/liveQuery"
import { PlayCircle, Plus, Pencil, Trash2, Upload, Search, Film, RotateCcw } from 'lucide-react'
import { db, type TutorialVideo } from '@/lib/db'
import { logAudit } from '@/services/auth.service'
import { useI18nStore } from '@/stores/i18n.store'
import { formatDate } from '@/lib/format'
import { PageHeader, Card, Button, Badge, Field, inputClass, EmptyState, Modal, IconButton, toast } from '@/components/ui'

interface FormState {
  title: string
  pageName: string
  videoNumber: string
  description: string
  file: File | null
  existing?: TutorialVideo
}

const emptyForm = (): FormState => ({
  title: '',
  pageName: '',
  videoNumber: '',
  description: '',
  file: null,
})

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('READ_FAIL'))
    reader.readAsDataURL(file)
  })
}

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function TutorialsPage() {
  const { language } = useI18nStore()
  const videos = useLiveQuery(() => db.tutorialVideos.orderBy('videoNumber').toArray(), [], []) ?? []
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'active' | 'trash'>('active')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [player, setPlayer] = useState<TutorialVideo | null>(null)
  const [confirmDel, setConfirmDel] = useState<TutorialVideo | null>(null)
  const [confirmPurge, setConfirmPurge] = useState<TutorialVideo | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isAr = language === 'ar'

  const activeVideos = useMemo(() => videos.filter((v) => !v.deletedAt), [videos])
  const trashVideos = useMemo(() => videos.filter((v) => !!v.deletedAt), [videos])
  const source = tab === 'trash' ? trashVideos : activeVideos

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return source
    return source.filter((v) =>
      [v.title, v.pageName, v.description, String(v.videoNumber)].some((x) => (x || '').toLowerCase().includes(term)),
    )
  }, [source, q])

  const openAdd = () => { setForm(emptyForm()); setFormOpen(true) }
  const openEdit = (v: TutorialVideo) => {
    setForm({
      title: v.title,
      pageName: v.pageName,
      videoNumber: String(v.videoNumber),
      description: v.description || '',
      file: null,
      existing: v,
    })
    setFormOpen(true)
  }

  const save = async () => {
    const title = form.title.trim()
    const pageName = form.pageName.trim()
    const videoNumber = Number(form.videoNumber)
    if (!title || !pageName || !Number.isFinite(videoNumber) || videoNumber <= 0) {
      toast(isAr ? 'يرجى إدخال اسم الفيديو والصفحة ورقم فيديو صحيح' : 'Please enter title, page and a valid video number', 'error')
      return
    }
    if (!form.existing && !form.file) {
      toast(isAr ? 'يرجى اختيار ملف الفيديو' : 'Please choose a video file', 'error')
      return
    }
    setSaving(true)
    try {
      const now = new Date().toISOString()
      let videoData = form.existing?.videoData || ''
      let fileName = form.existing?.fileName || ''
      let mimeType = form.existing?.mimeType || ''
      let size = form.existing?.size || 0
      if (form.file) {
        videoData = await fileToDataUrl(form.file)
        fileName = form.file.name
        mimeType = form.file.type || 'video/mp4'
        size = form.file.size
      }
      const payload = { title, pageName, videoNumber, description: form.description.trim(), fileName, mimeType, size, videoData, updatedAt: now }
      if (form.existing?.id) {
        await db.tutorialVideos.update(form.existing.id, payload)
        await logAudit('update', 'tutorialVideo', form.existing.id, 'تعديل فيديو شرح', 'Updated tutorial video')
        toast(isAr ? 'تم تحديث الفيديو' : 'Video updated', 'success')
      } else {
        const id = await db.tutorialVideos.add({ ...payload, createdAt: now })
        await logAudit('create', 'tutorialVideo', id as number, 'إضافة فيديو شرح', 'Added tutorial video')
        toast(isAr ? 'تمت إضافة الفيديو' : 'Video added', 'success')
      }
      setFormOpen(false)
      setForm(emptyForm())
    } catch {
      toast(isAr ? 'تعذر حفظ الفيديو (قد يكون الملف كبيرًا جدًا)' : 'Could not save video (file may be too large)', 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirmDel?.id) return
    const now = new Date().toISOString()
    await db.tutorialVideos.update(confirmDel.id, { deletedAt: now, updatedAt: now })
    await logAudit('delete', 'tutorialVideo', confirmDel.id, 'نقل فيديو شرح إلى سلة المحذوفات', 'Moved tutorial video to trash')
    toast(isAr ? 'تم نقل الفيديو إلى سلة المحذوفات' : 'Video moved to trash', 'success')
    if (player?.id === confirmDel.id) setPlayer(null)
    setConfirmDel(null)
  }

  const restore = async (video: TutorialVideo) => {
    if (!video.id) return
    const now = new Date().toISOString()
    await db.tutorialVideos.update(video.id, { deletedAt: null, updatedAt: now })
    await logAudit('restore', 'tutorialVideo', video.id, 'استعادة فيديو شرح', 'Restored tutorial video')
    toast(isAr ? 'تم استعادة الفيديو' : 'Video restored', 'success')
  }

  const purge = async () => {
    if (!confirmPurge?.id) return
    await db.tutorialVideos.delete(confirmPurge.id)
    await logAudit('delete', 'tutorialVideo', confirmPurge.id, 'حذف فيديو شرح نهائيًا', 'Permanently deleted tutorial video')
    toast(isAr ? 'تم حذف الفيديو نهائيًا' : 'Video permanently deleted', 'success')
    if (player?.id === confirmPurge.id) setPlayer(null)
    setConfirmPurge(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<PlayCircle className="h-5 w-5" />}
        title={isAr ? 'فيديوهات شرح البرنامج' : 'Tutorial videos'}
        subtitle={isAr ? 'مكتبة فيديوهات تشرح صفحات ووظائف البرنامج — يمكن للجميع المشاهدة والإدارة والاستعادة' : 'A library of videos explaining the app pages and features, with restore support'}
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openAdd}>{isAr ? 'إضافة فيديو' : 'Add video'}</Button>}
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input className={`${inputClass} ps-9`} placeholder={isAr ? 'بحث بالاسم أو الصفحة أو الرقم…' : 'Search by title, page or number…'} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-2 p-1">
              <Button variant={tab === 'active' ? 'primary' : 'ghost'} onClick={() => setTab('active')}>
                {isAr ? `الفيديوهات (${activeVideos.length})` : `Videos (${activeVideos.length})`}
              </Button>
              <Button variant={tab === 'trash' ? 'primary' : 'ghost'} onClick={() => setTab('trash')}>
                {isAr ? `سلة المحذوفات (${trashVideos.length})` : `Trash (${trashVideos.length})`}
              </Button>
            </div>
            <Badge tone="info">{filtered.length} {isAr ? 'فيديو' : 'videos'}</Badge>
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={tab === 'trash' ? <RotateCcw className="h-6 w-6" /> : <Film className="h-6 w-6" />}
          title={tab === 'trash' ? (isAr ? 'سلة المحذوفات فارغة' : 'Trash is empty') : (isAr ? 'لا توجد فيديوهات بعد' : 'No tutorial videos yet')}
          text={
            tab === 'trash'
              ? (isAr ? 'الفيديوهات المحذوفة تظهر هنا ويمكن استعادتها أو حذفها نهائيًا.' : 'Deleted videos appear here and can be restored or permanently deleted.')
              : (isAr ? 'أضف فيديو يشرح إحدى صفحات البرنامج ليظهر هنا كبطاقة يمكن تشغيلها.' : 'Add a video explaining a page and it will appear here as a playable card.')
          }
          action={
            tab === 'trash' ? undefined : (
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openAdd}>{isAr ? 'إضافة أول فيديو' : 'Add first video'}</Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setPlayer(v)}
              className="card-hover group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface text-start shadow-soft transition"
            >
              <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-primary/15 via-surface-2 to-accent/10">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg transition group-hover:scale-105">
                  <PlayCircle className="h-7 w-7" />
                </div>
                <span className="absolute start-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-bold text-primary shadow-sm">#{v.videoNumber}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-text">{v.title}</h3>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">{isAr ? 'الصفحة:' : 'Page:'} {v.pageName}</p>
                </div>
                {v.description && <p className="line-clamp-2 text-xs text-text-secondary">{v.description}</p>}
                <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-text-secondary">
                  <span>{fmtSize(v.size)}</span>
                  <span>{formatDate(v.updatedAt || v.createdAt, language)}</span>
                </div>
                <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  {tab === 'trash' ? (
                    <>
                      <IconButton title={isAr ? 'استعادة' : 'Restore'} onClick={() => void restore(v)}><RotateCcw className="h-4 w-4" /></IconButton>
                      <IconButton title={isAr ? 'حذف نهائي' : 'Delete permanently'} tone="danger" onClick={() => setConfirmPurge(v)}><Trash2 className="h-4 w-4" /></IconButton>
                    </>
                  ) : (
                    <>
                      <IconButton title={isAr ? 'تعديل' : 'Edit'} onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></IconButton>
                      <IconButton title={isAr ? 'حذف' : 'Delete'} tone="danger" onClick={() => setConfirmDel(v)}><Trash2 className="h-4 w-4" /></IconButton>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.existing ? (isAr ? 'تعديل فيديو الشرح' : 'Edit tutorial video') : (isAr ? 'إضافة فيديو شرح' : 'Add tutorial video')}
        subtitle={isAr ? 'أدخل بيانات الفيديو وارفع ملف الشرح' : 'Enter details and upload the video file'}
        footer={<>
          <Button onClick={() => setFormOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
          <Button variant="primary" icon={form.existing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} onClick={save} disabled={saving}>{saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}</Button>
        </>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={isAr ? 'اسم الفيديو (الصفحة المشروحة)' : 'Video name (explained page)'} required className="sm:col-span-2">
            <input className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={isAr ? 'مثال: شرح صفحة لوحة التحكم' : 'e.g. Dashboard overview'} />
          </Field>
          <Field label={isAr ? 'اسم الصفحة' : 'Page name'} required>
            <input className={inputClass} value={form.pageName} onChange={(e) => setForm((f) => ({ ...f, pageName: e.target.value }))} placeholder={isAr ? 'مثال: لوحة التحكم' : 'e.g. Dashboard'} />
          </Field>
          <Field label={isAr ? 'رقم الفيديو' : 'Video number'} required>
            <input className={inputClass} type="number" min={1} value={form.videoNumber} onChange={(e) => setForm((f) => ({ ...f, videoNumber: e.target.value }))} />
          </Field>
          <Field label={isAr ? 'وصف مختصر' : 'Short description'} className="sm:col-span-2">
            <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={isAr ? 'ماذا يشرح هذا الفيديو؟' : 'What does this video explain?'} />
          </Field>
          <Field label={isAr ? 'ملف الفيديو' : 'Video file'} required={!form.existing} className="sm:col-span-2">
            <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
            <div className="flex flex-wrap items-center gap-3">
              <Button icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>{isAr ? 'اختيار ملف فيديو' : 'Choose video file'}</Button>
              <span className="text-xs text-text-secondary">
                {form.file ? `${form.file.name} (${fmtSize(form.file.size)})` : form.existing ? (isAr ? 'اتركه فارغًا للإبقاء على الملف الحالي' : 'Leave empty to keep current file') : (isAr ? 'لم يتم اختيار ملف' : 'No file selected')}
              </span>
            </div>
          </Field>
        </div>
      </Modal>

      <Modal open={!!player} onClose={() => setPlayer(null)} title={player?.title || ''} subtitle={player ? `${isAr ? 'الصفحة:' : 'Page:'} ${player.pageName} · #${player.videoNumber}` : ''} wide>
        {player && (
          <div className="space-y-3">
            <video key={player.id} controls autoPlay className="w-full rounded-2xl bg-black" src={player.videoData} />
            {player.description && <p className="text-sm text-text-secondary">{player.description}</p>}
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={isAr ? 'حذف الفيديو' : 'Delete video'}
        subtitle={isAr ? 'سيتم نقله إلى سلة المحذوفات ويمكن استعادته' : 'It will be moved to trash and can be restored'}
        footer={<>
          <Button onClick={() => setConfirmDel(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={remove}>{isAr ? 'حذف' : 'Delete'}</Button>
        </>}
      >
        <p className="text-sm text-text-secondary">{isAr ? `هل تريد نقل فيديو "${confirmDel?.title || ''}" إلى سلة المحذوفات؟` : `Move video "${confirmDel?.title || ''}" to trash?`}</p>
      </Modal>

      <Modal
        open={!!confirmPurge}
        onClose={() => setConfirmPurge(null)}
        title={isAr ? 'حذف نهائي' : 'Delete permanently'}
        subtitle={isAr ? 'لا يمكن التراجع عن هذا الإجراء' : 'This action cannot be undone'}
        footer={<>
          <Button onClick={() => setConfirmPurge(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={purge}>{isAr ? 'حذف نهائي' : 'Delete permanently'}</Button>
        </>}
      >
        <p className="text-sm text-text-secondary">{isAr ? `سيتم حذف فيديو "${confirmPurge?.title || ''}" نهائيًا.` : `Permanently delete video "${confirmPurge?.title || ''}"?`}</p>
      </Modal>
    </div>
  )
}

