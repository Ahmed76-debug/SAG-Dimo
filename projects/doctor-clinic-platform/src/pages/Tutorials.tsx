import { useMemo, useRef, useState } from "react";
import { PlayCircle, Plus, Pencil, Trash2, Upload, Film, Video, RotateCcw } from "lucide-react";
import { useApp } from "@/state/AppProvider";
import {
  PageHead, Button, Badge, Field, Modal, ConfirmDialog, EmptyState, SearchInput, Card, IconButton,
} from "@/components/ui";
import type { TutorialVideo } from "@/lib/types";

const STORAGE_KEY = "tabib.tutorials.v1";

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
    reader.onerror = () => reject(new Error("READ_FAIL"));
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

const emptyForm = (): FormState => ({ title: "", pageName: "", videoNumber: "", description: "", file: null });

export default function Tutorials() {
  const { toast } = useApp();
  const [videos, setVideos] = useState<TutorialVideo[]>(() => loadVideos());
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
    const sorted = [...source].sort((a, b) => (a.videoNumber || 0) - (b.videoNumber || 0));
    if (!term) return sorted;
    return sorted.filter((v) =>
      [v.title, v.pageName, v.description, String(v.videoNumber)]
        .some((x) => String(x || "").toLowerCase().includes(term)),
    );
  }, [source, q]);

  const openAdd = () => {
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (v: TutorialVideo) => {
    setForm({
      title: v.title,
      pageName: v.pageName,
      videoNumber: String(v.videoNumber),
      description: v.description || "",
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
      toast("يرجى إدخال اسم الفيديو والصفحة ورقم فيديو صحيح", "err");
      return;
    }
    if (!form.existing && !form.file) {
      toast("يرجى اختيار ملف الفيديو", "err");
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
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
      toast(form.existing ? "تم تحديث الفيديو" : "تمت إضافة الفيديو", "ok");
      setFormOpen(false);
      setForm(emptyForm());
    } catch {
      toast("تعذر حفظ الفيديو (قد يكون الملف كبيرًا جدًا)", "err");
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
    toast("تم نقل الفيديو إلى سلة المحذوفات", "ok");
  };

  const restore = (video: TutorialVideo) => {
    const now = new Date().toISOString();
    const next = videos.map((v) =>
      v.id === video.id ? { ...v, deletedAt: null, updatedAt: now } : v,
    );
    saveVideos(next);
    setVideos(next);
    toast("تم استعادة الفيديو", "ok");
  };

  const purge = () => {
    if (!confirmPurge) return;
    const next = videos.filter((v) => v.id !== confirmPurge.id);
    saveVideos(next);
    setVideos(next);
    if (player?.id === confirmPurge.id) setPlayer(null);
    setConfirmPurge(null);
    toast("تم حذف الفيديو نهائيًا", "ok");
  };

  return (
    <>
      <PageHead
        title="فيديوهات شرح البرنامج"
        sub="مكتبة فيديوهات تشرح صفحات ووظائف العيادة — مشاهدة وإضافة وتعديل وحذف واستعادة."
        actions={
          <Button variant="primary" onClick={openAdd}>
            <Plus size={16} /> إضافة فيديو
          </Button>
        }
      />

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ width: "min(360px, 100%)" }}>
            <SearchInput value={q} onChange={setQ} placeholder="بحث بالاسم أو الصفحة أو الرقم…" />
          </div>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            <div className="row gap-1" style={{ padding: 3, border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-2)" }}>
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
      </div>

      {filtered.length === 0 ? (
        <Card className="card-pad">
          <EmptyState
            icon={tab === "trash" ? <RotateCcw size={26} /> : <Film size={26} />}
            title={tab === "trash" ? "سلة المحذوفات فارغة" : "لا توجد فيديوهات بعد"}
            desc={
              tab === "trash"
                ? "الفيديوهات المحذوفة تظهر هنا ويمكن استعادتها أو حذفها نهائيًا."
                : "أضف فيديو يشرح إحدى صفحات البرنامج ليظهر هنا كبطاقة يمكن تشغيلها."
            }
            action={
              tab === "trash" ? undefined : (
                <Button variant="primary" onClick={openAdd}>
                  <Plus size={16} /> إضافة أول فيديو
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {filtered.map((v) => (
            <Card key={v.id} style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <button
                type="button"
                onClick={() => setPlayer(v)}
                style={{
                  position: "relative", height: 140, border: "none", cursor: "pointer",
                  display: "grid", placeItems: "center",
                  background: "linear-gradient(135deg, var(--primary-soft), var(--surface-3))",
                }}
              >
                <span
                  style={{
                    width: 54, height: 54, borderRadius: 16, display: "grid", placeItems: "center",
                    background: "var(--primary)", color: "#fff", boxShadow: "var(--shadow-md)",
                  }}
                >
                  <PlayCircle size={26} />
                </span>
                <span
                  style={{
                    position: "absolute", top: 10, insetInlineEnd: 10, padding: "2px 9px",
                    borderRadius: 999, background: "var(--surface)", color: "var(--primary)",
                    fontSize: ".72rem", fontWeight: 700, boxShadow: "var(--shadow-xs)",
                  }}
                >
                  #{v.videoNumber}
                </span>
              </button>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: ".95rem" }} className="truncate">{v.title}</h3>
                <div className="tiny muted">الصفحة: {v.pageName}</div>
                {v.description ? <p className="tiny muted" style={{ margin: "4px 0 0" }}>{v.description}</p> : null}
                <div className="row tiny muted" style={{ justifyContent: "space-between", marginTop: 8 }}>
                  <span>{fmtSize(v.size)}</span>
                  <span>{new Date(v.updatedAt || v.createdAt).toLocaleDateString("ar-EG")}</span>
                </div>
                <div className="row gap-2" style={{ marginTop: 8 }}>
                  {tab === "trash" ? (
                    <>
                      <IconButton onClick={() => restore(v)} title="استعادة" aria-label="استعادة">
                        <RotateCcw size={16} />
                      </IconButton>
                      <IconButton onClick={() => setConfirmPurge(v)} title="حذف نهائي" aria-label="حذف نهائي" style={{ color: "var(--danger)" }}>
                        <Trash2 size={16} />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <IconButton onClick={() => openEdit(v)} title="تعديل" aria-label="تعديل">
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton onClick={() => setConfirmDel(v)} title="حذف" aria-label="حذف" style={{ color: "var(--danger)" }}>
                        <Trash2 size={16} />
                      </IconButton>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.existing ? "تعديل فيديو الشرح" : "إضافة فيديو شرح"}
        sub="أدخل بيانات الفيديو وارفع ملف الشرح."
        icon={<Video size={18} />}
        size="lg"
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>إلغاء</Button>
            <Button variant="primary" onClick={() => void save()} disabled={saving}>
              {saving ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
          </>
        }
      >
        <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="اسم الفيديو (الصفحة المشروحة)" required className="span-2" >
            <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="مثال: شرح صفحة لوحة التحكم" />
          </Field>
          <Field label="اسم الصفحة" required>
            <input className="input" value={form.pageName} onChange={(e) => setForm((f) => ({ ...f, pageName: e.target.value }))} placeholder="مثال: لوحة التحكم" />
          </Field>
          <Field label="رقم الفيديو" required>
            <input className="input" type="number" min={1} value={form.videoNumber} onChange={(e) => setForm((f) => ({ ...f, videoNumber: e.target.value }))} />
          </Field>
          <Field label="وصف مختصر" className="span-2">
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="ماذا يشرح هذا الفيديو؟" />
          </Field>
          <Field label="ملف الفيديو" required={!form.existing} className="span-2">
            <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              <Button onClick={() => fileRef.current?.click()}>
                <Upload size={16} /> اختيار ملف فيديو
              </Button>
              <span className="tiny muted">
                {form.file
                  ? `${form.file.name} (${fmtSize(form.file.size)})`
                  : form.existing
                    ? "اتركه فارغًا للإبقاء على الملف الحالي"
                    : "لم يتم اختيار ملف"}
              </span>
            </div>
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!player}
        onClose={() => setPlayer(null)}
        title={player?.title}
        sub={player ? `الصفحة: ${player.pageName} · #${player.videoNumber}` : undefined}
        icon={<PlayCircle size={18} />}
        size="xl"
      >
        {player ? (
          <div style={{ display: "grid", gap: 10 }}>
            <video key={player.id} controls autoPlay src={player.videoData} style={{ width: "100%", borderRadius: 14, background: "#000" }} />
            {player.description ? <p className="small muted">{player.description}</p> : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="حذف الفيديو"
        message={`سيتم نقل فيديو "${confirmDel?.title || ""}" إلى سلة المحذوفات ويمكنك استعادته لاحقًا.`}
        confirmLabel="حذف"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDel(null)}
      />

      <ConfirmDialog
        open={!!confirmPurge}
        title="حذف نهائي"
        message={`سيتم حذف فيديو "${confirmPurge?.title || ""}" نهائيًا ولا يمكن التراجع.`}
        confirmLabel="حذف نهائي"
        danger
        onConfirm={purge}
        onCancel={() => setConfirmPurge(null)}
      />
    </>
  );
}

