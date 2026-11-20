import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "@/lib/liveQuery";
import { PlayCircle, Plus, Pencil, Trash2, Upload, Film, Search, RotateCcw } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/AppShell";
import { Button, Field, Input, Textarea, Badge, IconButton, EmptyState } from "@/components/ui/primitives";
import { Modal, useToast, ConfirmDialog } from "@/components/ui/overlays";
import { db, uid, nowISO } from "@/lib/db";
import type { TutorialVideo } from "@/lib/types";

interface FormState {
  title: string;
  pageName: string;
  videoNumber: string;
  description: string;
  file: File | null;
  existing?: TutorialVideo;
}

const emptyForm = (): FormState => ({ title: "", pageName: "", videoNumber: "", description: "", file: null });

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("READ_FAIL"));
    reader.readAsDataURL(file);
  });
}

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Tutorials() {
  const toast = useToast();
  const videos = useLiveQuery(() => db.tutorialVideos.orderBy("videoNumber").toArray(), [], []) ?? [];
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"active" | "trash">("active");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [player, setPlayer] = useState<TutorialVideo | null>(null);
  const [confirmDel, setConfirmDel] = useState<TutorialVideo | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<TutorialVideo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeVideos = useMemo(() => videos.filter((v) => !v.deletedAt), [videos]);
  const trashVideos = useMemo(() => videos.filter((v) => !!v.deletedAt), [videos]);
  const source = tab === "trash" ? trashVideos : activeVideos;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return source;
    return source.filter((v) =>
      [v.title, v.pageName, v.description, String(v.videoNumber)].some((x) => (x || "").toLowerCase().includes(term)),
    );
  }, [source, q]);

  const openAdd = () => { setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (v: TutorialVideo) => {
    setForm({ title: v.title, pageName: v.pageName, videoNumber: String(v.videoNumber), description: v.description || "", file: null, existing: v });
    setFormOpen(true);
  };

  const save = async () => {
    const title = form.title.trim();
    const pageName = form.pageName.trim();
    const videoNumber = Number(form.videoNumber);
    if (!title || !pageName || !Number.isFinite(videoNumber) || videoNumber <= 0) {
      toast.error("بيانات ناقصة", "يرجى إدخال اسم الفيديو والصفحة ورقم فيديو صحيح.");
      return;
    }
    if (!form.existing && !form.file) {
      toast.error("ملف مطلوب", "يرجى اختيار ملف الفيديو.");
      return;
    }
    setSaving(true);
    try {
      const now = nowISO();
      let videoData = form.existing?.videoData || "";
      let fileName = form.existing?.fileName || "";
      let mimeType = form.existing?.mimeType || "";
      let size = form.existing?.size || 0;
      if (form.file) {
        videoData = await fileToDataUrl(form.file);
        fileName = form.file.name;
        mimeType = form.file.type || "video/mp4";
        size = form.file.size;
      }
      const payload = { title, pageName, videoNumber, description: form.description.trim(), fileName, mimeType, size, videoData, updatedAt: now };
      if (form.existing) {
        await db.tutorialVideos.update(form.existing.id, payload);
        toast.success("تم تحديث الفيديو");
      } else {
        await db.tutorialVideos.add({ id: uid("tut_"), ...payload, createdAt: now });
        toast.success("تمت إضافة الفيديو");
      }
      setFormOpen(false);
      setForm(emptyForm());
    } catch {
      toast.error("تعذر حفظ الفيديو", "قد يكون الملف كبيرًا جدًا للتخزين المحلي.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmDel) return;
    const now = nowISO();
    await db.tutorialVideos.update(confirmDel.id, { deletedAt: now, updatedAt: now });
    toast.success("تم نقل الفيديو إلى سلة المحذوفات");
    if (player?.id === confirmDel.id) setPlayer(null);
    setConfirmDel(null);
  };

  const restore = async (video: TutorialVideo) => {
    const now = nowISO();
    await db.tutorialVideos.update(video.id, { deletedAt: null, updatedAt: now });
    toast.success("تم استعادة الفيديو");
  };

  const purge = async () => {
    if (!confirmPurge) return;
    await db.tutorialVideos.delete(confirmPurge.id);
    toast.success("تم حذف الفيديو نهائيًا");
    if (player?.id === confirmPurge.id) setPlayer(null);
    setConfirmPurge(null);
  };

  return (
    <>
      <PageHeader
        title="فيديوهات شرح البرنامج"
        subtitle="مكتبة فيديوهات تشرح صفحات ووظائف البرنامج — متاحة للجميع مع إمكانية الإضافة والتعديل والحذف والاستعادة"
        icon={
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-2 to-accent text-accent-ink">
            <PlayCircle className="size-6" />
          </span>
        }
        actions={<Button variant="primary" icon={Plus} onClick={openAdd}>إضافة فيديو</Button>}
      />
      <PageBody className="space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input className="ps-9" placeholder="بحث بالاسم أو الصفحة أو الرقم…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1">
              <Button size="sm" variant={tab === "active" ? "soft" : "ghost"} onClick={() => setTab("active")}>
                الفيديوهات ({activeVideos.length})
              </Button>
              <Button size="sm" variant={tab === "trash" ? "soft" : "ghost"} onClick={() => setTab("trash")}>
                سلة المحذوفات ({trashVideos.length})
              </Button>
            </div>
            <Badge tone="info">{filtered.length} فيديو</Badge>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState
              icon={tab === "trash" ? RotateCcw : Film}
              title={tab === "trash" ? "سلة المحذوفات فارغة" : "لا توجد فيديوهات بعد"}
              description={
                tab === "trash"
                  ? "الفيديوهات المحذوفة تظهر هنا ويمكن استعادتها أو حذفها نهائيًا."
                  : "أضف فيديو يشرح إحدى صفحات البرنامج ليظهر هنا كبطاقة يمكن تشغيلها."
              }
              action={
                tab === "trash" ? undefined : (
                  <Button variant="primary" icon={Plus} onClick={openAdd}>إضافة أول فيديو</Button>
                )
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((v) => (
              <div key={v.id} className="card card-hover group flex flex-col overflow-hidden">
                <button type="button" onClick={() => setPlayer(v)} className="relative flex h-40 items-center justify-center bg-gradient-to-br from-accent-soft/60 via-surface-2 to-brand-soft/40">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-lg transition group-hover:scale-105">
                    <PlayCircle className="size-7" />
                  </div>
                  <span className="absolute start-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-bold text-accent shadow-sm">#{v.videoNumber}</span>
                </button>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-[14px] font-bold text-ink">{v.title}</h3>
                    <p className="mt-0.5 truncate text-[12px] text-muted">الصفحة: {v.pageName}</p>
                  </div>
                  {v.description && <p className="line-clamp-2 text-[12px] text-muted">{v.description}</p>}
                  <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-faint">
                    <span>{fmtSize(v.size)}</span>
                    <span>{new Date(v.updatedAt || v.createdAt).toLocaleDateString("ar-SA")}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {tab === "trash" ? (
                      <>
                        <IconButton icon={RotateCcw} label="استعادة" size="sm" onClick={() => void restore(v)} />
                        <IconButton icon={Trash2} label="حذف نهائي" size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setConfirmPurge(v)} />
                      </>
                    ) : (
                      <>
                        <IconButton icon={Pencil} label="تعديل" size="sm" onClick={() => openEdit(v)} />
                        <IconButton icon={Trash2} label="حذف" size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setConfirmDel(v)} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageBody>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.existing ? "تعديل فيديو الشرح" : "إضافة فيديو شرح"}
        description="أدخل بيانات الفيديو وارفع ملف الشرح"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>إلغاء</Button>
            <Button variant="primary" icon={form.existing ? Pencil : Plus} onClick={() => void save()} loading={saving}>حفظ</Button>
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
              <Button variant="outline" icon={Upload} onClick={() => fileRef.current?.click()}>اختيار ملف فيديو</Button>
              <span className="text-[12px] text-muted">
                {form.file ? `${form.file.name} (${fmtSize(form.file.size)})` : form.existing ? "اتركه فارغًا للإبقاء على الملف الحالي" : "لم يتم اختيار ملف"}
              </span>
            </div>
          </Field>
        </div>
      </Modal>

      <Modal open={!!player} onClose={() => setPlayer(null)} title={player?.title} description={player ? `الصفحة: ${player.pageName} · #${player.videoNumber}` : undefined} size="xl">
        {player && (
          <div className="space-y-3">
            <video key={player.id} controls autoPlay className="w-full rounded-2xl bg-black" src={player.videoData} />
            {player.description && <p className="text-[13px] leading-relaxed text-muted">{player.description}</p>}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={() => void remove()}
        title="حذف الفيديو"
        message={`سيتم نقل فيديو "${confirmDel?.title || ""}" إلى سلة المحذوفات ويمكنك استعادته لاحقًا.`}
        confirmLabel="حذف"
      />

      <ConfirmDialog
        open={!!confirmPurge}
        onClose={() => setConfirmPurge(null)}
        onConfirm={() => void purge()}
        title="حذف نهائي"
        message={`سيتم حذف فيديو "${confirmPurge?.title || ""}" نهائيًا ولا يمكن التراجع.`}
        confirmLabel="حذف نهائي"
      />
    </>
  );
}

