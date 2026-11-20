import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { PlayCircle, Plus, Pencil, Trash2, Upload, Film, Search, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/page';
import { Badge, Button, EmptyState, Field, Input, Textarea } from '@/components/ui/primitives';
import { ConfirmDialog, Modal } from '@/components/ui/overlays';
import { useToast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';

const STORAGE_KEY = 'miftah.tutorials.v1';

interface TutorialVideo {
  id: string;
  title: string;
  pageName: string;
  videoNumber: number;
  description?: string;
  fileName: string;
  mimeType: string;
  size: number;
  videoData: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

function loadVideos(): TutorialVideo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveVideos(list: TutorialVideo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('READ_FAIL'));
    reader.readAsDataURL(file);
  });
}

function fmtSize(bytes: number) {
  const b = Number(bytes) || 0;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

interface FormState {
  title: string;
  pageName: string;
  videoNumber: string;
  description: string;
  file: File | null;
  existing?: TutorialVideo;
}

const emptyForm = (): FormState => ({ title: '', pageName: '', videoNumber: '', description: '', file: null });

export function Tutorials() {
  const { success, error } = useToast();
  const [videos, setVideos] = useState<TutorialVideo[]>(() => loadVideos());
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'active' | 'trash'>('active');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [player, setPlayer] = useState<TutorialVideo | null>(null);
  const [confirmDel, setConfirmDel] = useState<TutorialVideo | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<TutorialVideo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeVideos = useMemo(() => videos.filter((v) => !v.deletedAt), [videos]);
  const trashVideos = useMemo(() => videos.filter((v) => !!v.deletedAt), [videos]);
  const source = tab === 'trash' ? trashVideos : activeVideos;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const sorted = [...source].sort((a, b) => (a.videoNumber || 0) - (b.videoNumber || 0));
    if (!term) return sorted;
    return sorted.filter((v) =>
      [v.title, v.pageName, v.description, String(v.videoNumber)]
        .some((x) => String(x || '').toLowerCase().includes(term)),
    );
  }, [source, q]);

  const openAdd = () => { setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (v: TutorialVideo) => {
    setForm({
      title: v.title,
      pageName: v.pageName,
      videoNumber: String(v.videoNumber),
      description: v.description || '',
      file: null,
      existing: v,
    });
    setFormOpen(true);
  };

  const save = async () => {
    const title = form.title.trim();
    const pageName = form.pageName.trim();
    const videoNumber = Number(form.videoNumber);
    if (!title || !pageName || !Number.isFinite(videoNumber) || videoNumber <= 0) {
      error('بيانات ناقصة', 'يرجى إدخال اسم الفيديو والصفحة ورقم فيديو صحيح');
      return;
    }
    if (!form.existing && !form.file) {
      error('ملف مطلوب', 'يرجى اختيار ملف الفيديو');
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      let videoData = form.existing?.videoData || '';
      let fileName = form.existing?.fileName || '';
      let mimeType = form.existing?.mimeType || '';
      let size = form.existing?.size || 0;
      if (form.file) {
        videoData = await fileToDataUrl(form.file);
        fileName = form.file.name;
        mimeType = form.file.type || 'video/mp4';
        size = form.file.size;
      }
      let next: TutorialVideo[];
      if (form.existing) {
        next = videos.map((v) =>
          v.id === form.existing!.id
            ? { ...v, title, pageName, videoNumber, description: form.description.trim(), fileName, mimeType, size, videoData, updatedAt: now }
            : v,
        );
      } else {
        next = [
          ...videos,
          {
            id: `tut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            title, pageName, videoNumber,
            description: form.description.trim(),
            fileName, mimeType, size, videoData,
            createdAt: now, updatedAt: now,
          },
        ];
      }
      saveVideos(next);
      setVideos(next);
      success(form.existing ? 'تم تحديث الفيديو' : 'تمت إضافة الفيديو');
      setFormOpen(false);
      setForm(emptyForm());
    } catch {
      error('تعذر حفظ الفيديو', 'قد يكون الملف كبيرًا جدًا للتخزين المحلي');
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!confirmDel) return;
    const now = new Date().toISOString();
    const next = videos.map((v) =>
      v.id === confirmDel.id ? { ...v, deletedAt: now, updatedAt: now } : v,
    );
    saveVideos(next);
    setVideos(next);
    if (player?.id === confirmDel.id) setPlayer(null);
    setConfirmDel(null);
    success('تم نقل الفيديو إلى سلة المحذوفات');
  };

  const restore = (video: TutorialVideo) => {
    const now = new Date().toISOString();
    const next = videos.map((v) =>
      v.id === video.id ? { ...v, deletedAt: null, updatedAt: now } : v,
    );
    saveVideos(next);
    setVideos(next);
    success('تم استعادة الفيديو');
  };

  const purge = () => {
    if (!confirmPurge) return;
    const next = videos.filter((v) => v.id !== confirmPurge.id);
    saveVideos(next);
    setVideos(next);
    if (player?.id === confirmPurge.id) setPlayer(null);
    setConfirmPurge(null);
    success('تم حذف الفيديو نهائيًا');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><PlayCircle size={13} /> مكتبة الشرح</>}
        title="فيديوهات شرح البرنامج"
        description="مكتبة فيديوهات تشرح صفحات ووظائف البرنامج — مشاهدة وإضافة وتعديل وحذف واستعادة."
        actions={
          <Button variant="primary" onClick={openAdd}>
            <Plus size={16} /> إضافة فيديو
          </Button>
        }
      />

      <Panel padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="relative w-full max-w-sm">
            <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input className="ps-9" placeholder="بحث بالاسم أو الصفحة أو الرقم…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1">
              <button
                type="button"
                onClick={() => setTab('active')}
                className={`rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition ${tab === 'active' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
              >
                الفيديوهات ({activeVideos.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('trash')}
                className={`rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition ${tab === 'trash' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
              >
                سلة المحذوفات ({trashVideos.length})
              </button>
            </div>
            <Badge tone="info">{filtered.length} فيديو</Badge>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={tab === 'trash' ? <RotateCcw size={24} /> : <Film size={24} />}
              title={tab === 'trash' ? 'سلة المحذوفات فارغة' : 'لا توجد فيديوهات بعد'}
              description={
                tab === 'trash'
                  ? 'الفيديوهات المحذوفة تظهر هنا ويمكن استعادتها أو حذفها نهائيًا.'
                  : 'أضف فيديو يشرح إحدى صفحات البرنامج ليظهر هنا كبطاقة يمكن تشغيلها.'
              }
              action={
                tab === 'trash' ? undefined : (
                  <Button variant="primary" onClick={openAdd}>
                    <Plus size={16} /> إضافة أول فيديو
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((v) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-2/40 transition hover:border-line-strong hover:shadow-pop"
              >
                <button
                  type="button"
                  onClick={() => setPlayer(v)}
                  className="relative flex h-40 items-center justify-center bg-gradient-to-br from-primary-soft via-surface-2 to-surface-3"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-ink shadow-pop transition group-hover:scale-105">
                    <PlayCircle size={27} />
                  </span>
                  <span className="absolute start-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-bold text-primary shadow-sm">
                    #{v.videoNumber}
                  </span>
                </button>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-[13.5px] font-bold text-ink">{v.title}</h3>
                    <p className="mt-0.5 truncate text-[11.5px] text-muted">الصفحة: {v.pageName}</p>
                  </div>
                  {v.description ? <p className="line-clamp-2 text-[11.5px] text-muted">{v.description}</p> : null}
                  <div className="mt-auto flex items-center justify-between pt-2 text-[10.5px] text-muted">
                    <span>{fmtSize(v.size)}</span>
                    <span>{formatDate(v.updatedAt || v.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {tab === 'trash' ? (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => restore(v)}>
                          <RotateCcw size={14} /> استعادة
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmPurge(v)} className="text-danger hover:bg-danger/10">
                          <Trash2 size={14} /> حذف نهائي
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => openEdit(v)}>
                          <Pencil size={14} /> تعديل
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDel(v)} className="text-danger hover:bg-danger/10">
                          <Trash2 size={14} /> حذف
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Panel>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.existing ? 'تعديل فيديو الشرح' : 'إضافة فيديو شرح'}
        description="أدخل بيانات الفيديو وارفع ملف الشرح."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>إلغاء</Button>
            <Button variant="primary" loading={saving} onClick={() => void save()}>حفظ</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم الفيديو (الصفحة المشروحة)" required className="sm:col-span-2">
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="مثال: شرح صفحة لوحة التحكم" />
          </Field>
          <Field label="اسم الصفحة" required>
            <Input value={form.pageName} onChange={(e) => setForm((f) => ({ ...f, pageName: e.target.value }))} placeholder="مثال: لوحة التحكم" />
          </Field>
          <Field label="رقم الفيديو" required>
            <Input type="number" min={1} value={form.videoNumber} onChange={(e) => setForm((f) => ({ ...f, videoNumber: e.target.value }))} />
          </Field>
          <Field label="وصف مختصر" className="sm:col-span-2">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="ماذا يشرح هذا الفيديو؟" />
          </Field>
          <Field label="ملف الفيديو" required={!form.existing} className="sm:col-span-2">
            <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload size={15} /> اختيار ملف فيديو
              </Button>
              <span className="text-[11.5px] text-muted">
                {form.file
                  ? `${form.file.name} (${fmtSize(form.file.size)})`
                  : form.existing
                    ? 'اتركه فارغًا للإبقاء على الملف الحالي'
                    : 'لم يتم اختيار ملف'}
              </span>
            </div>
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!player}
        onClose={() => setPlayer(null)}
        title={player?.title}
        description={player ? `الصفحة: ${player.pageName} · #${player.videoNumber}` : undefined}
        size="xl"
      >
        {player ? (
          <div className="space-y-3">
            <video key={player.id} controls autoPlay src={player.videoData} className="w-full rounded-2xl bg-black" />
            {player.description ? <p className="text-[12.5px] leading-relaxed text-muted">{player.description}</p> : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={remove}
        title="حذف الفيديو"
        description={`سيتم نقل فيديو "${confirmDel?.title || ''}" إلى سلة المحذوفات ويمكنك استعادته لاحقًا.`}
        confirmText="حذف"
      />

      <ConfirmDialog
        open={!!confirmPurge}
        onClose={() => setConfirmPurge(null)}
        onConfirm={purge}
        title="حذف نهائي"
        description={`سيتم حذف فيديو "${confirmPurge?.title || ''}" نهائيًا ولا يمكن التراجع.`}
        confirmText="حذف نهائي"
      />
    </div>
  );
}
