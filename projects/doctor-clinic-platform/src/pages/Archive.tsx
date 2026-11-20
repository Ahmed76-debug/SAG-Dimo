import React, { useMemo, useState } from "react";
import {
  Archive as ArchiveIcon,
  Download,
  FileImage,
  FileText,
  FolderOpen,
  Search,
  Upload,
  X,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHead } from "@/components/ui";
import type { ArchiveItem } from "@/lib/types";
import { downloadText, fmtDate, todayISO, uid } from "@/lib/utils";

const CATS: { key: ArchiveItem["category"] | "all"; label: string }[] = [
  { key: "all", label: "كل الملفات" },
  { key: "lab", label: "تحاليل" },
  { key: "radiology", label: "أشعة" },
  { key: "report", label: "تقارير" },
  { key: "consent", label: "إقرارات" },
  { key: "insurance", label: "تأمين" },
  { key: "other", label: "أخرى" },
];

const CAT_LABEL: Record<string, string> = {
  lab: "تحاليل",
  radiology: "أشعة",
  report: "تقرير",
  consent: "إقرار",
  insurance: "تأمين",
  other: "ملف",
};

export default function Archive() {
  const { db, save, toast } = useApp();
  const [cat, setCat] = useState<ArchiveItem["category"] | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const list = useMemo(
    () =>
      db.archive
        .map((a) => ({ a, p: db.patients.find((p) => p.id === a.patientId) }))
        .filter(({ a, p }) => {
          if (cat !== "all" && a.category !== cat) return false;
          if (!q.trim()) return true;
          return a.title.includes(q) || (p?.name.includes(q) ?? false) || a.tags.some((t) => t.includes(q));
        })
        .sort((x, y) => y.a.date.localeCompare(x.a.date)),
    [db.archive, db.patients, cat, q]
  );

  return (
    <>
      <PageHead
        title="الأرشيف الطبي"
        sub={`${db.archive.length} ملف محفوظ — تحاليل، أشعة، إقرارات وتقارير`}
        actions={<Button variant="primary" onClick={() => setOpen(true)}><Upload size={15} /> رفع ملف</Button>}
      />

      <div className="grid grid-4 mb-16">
        {[
          { l: "كل الملفات", v: db.archive.length, c: "var(--primary)", b: "var(--primary-soft)", k: "all" },
          { l: "تحاليل", v: db.archive.filter((a) => a.category === "lab").length, c: "var(--info)", b: "var(--info-soft)", k: "lab" },
          { l: "أشعة", v: db.archive.filter((a) => a.category === "radiology").length, c: "var(--violet)", b: "var(--violet-soft)", k: "radiology" },
          { l: "إقرارات", v: db.archive.filter((a) => a.category === "consent").length, c: "var(--warn)", b: "var(--warn-soft)", k: "consent" },
        ].map((s) => (
          <button
            key={s.l}
            className="stat"
            onClick={() => setCat(s.k as any)}
            style={{ textAlign: "start", cursor: "pointer", border: cat === s.k ? "1.5px solid var(--primary-2)" : undefined, "--stat-tint": s.b, "--stat-color": s.c } as React.CSSProperties}
          >
            <div className="row gap-8">
              <div className="stat-ico" style={{ width: 33, height: 33, borderRadius: 9 }}><ArchiveIcon size={17} /></div>
              <div>
                <div className="stat-label" style={{ marginTop: 0 }}>{s.l}</div>
                <div className="stat-value num" style={{ fontSize: "1.28rem" }}>{s.v}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Card>
        <div className="toolbar">
          <div className="searchbar" style={{ maxWidth: 300 }}>
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم الملف، المريض أو التصنيف…" />
          </div>
          <div className="segmented" style={{ flexWrap: "wrap" }}>
            {CATS.map((c) => (
              <button key={c.key} className={cat === c.key ? "on" : ""} onClick={() => setCat(c.key)}>{c.label}</button>
            ))}
          </div>
          <div className="spacer" />
          <span className="tiny muted">{list.length} ملف</span>
        </div>

        <div className="card-bd">
          {list.length ? (
            <div className="grid grid-3">
              {list.map(({ a, p }) => (
                <div key={a.id} className="soft-box card-hover" style={{ padding: 14 }}>
                  <div className="row-between">
                    <div className="row gap-8">
                      <div
                        style={{
                          width: 34, height: 34, borderRadius: 9,
                          background: a.format === "pdf" ? "var(--danger-soft)" : "var(--info-soft)",
                          color: a.format === "pdf" ? "var(--danger)" : "var(--info)",
                          display: "grid", placeItems: "center",
                        }}
                      >
                        {a.format === "jpg" || a.format === "png" ? <FileImage size={17} /> : <FileText size={17} />}
                      </div>
                      <div>
                        <Badge tone="line">{a.format.toUpperCase()}</Badge>
                        <div className="tiny muted" style={{ marginTop: 2 }}>{a.size}</div>
                      </div>
                    </div>
                    <Badge tone="primary">{CAT_LABEL[a.category]}</Badge>
                  </div>

                  <div className="small strong mt-8" style={{ lineHeight: 1.55, minHeight: 38 }}>{a.title}</div>
                  {p ? (
                    <div className="row gap-6 mt-4">
                      <Avatar name={p.name} size="sm" />
                      <div className="tiny">
                        <div className="strong">{p.name}</div>
                        <div className="muted">{p.code}</div>
                      </div>
                    </div>
                  ) : null}
                  <div className="row-between mt-8">
                    <span className="tiny muted">{fmtDate(a.date)}</span>
                    <Button size="sm" variant="ghost" onClick={() => {
                      downloadText(`${a.title}.txt`, `ملف تجريبي: ${a.title}\nالمريض: ${p?.name ?? "—"}\nالتصنيف: ${CAT_LABEL[a.category]}\nالتاريخ: ${a.date}\n\nهذا الملف تجريبي ضمن النسخة التجريبية لمنصة طبيب.`);
                      toast("تم تنزيل نسخة من الملف");
                    }}>
                      <Download size={13} /> تنزيل
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<FolderOpen size={24} />} title="لا ملفات في هذا التصنيف" desc="ارفع ملفًا جديدًا أو اختر تصنيفًا آخر." />
          )}
        </div>
      </Card>

      {open ? <UploadModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function UploadModal({ onClose }: { onClose: () => void }) {
  const { db, save, toast } = useApp();
  const [title, setTitle] = useState("");
  const [patientId, setPatientId] = useState("");
  const [category, setCategory] = useState<ArchiveItem["category"]>("lab");
  const [format, setFormat] = useState<ArchiveItem["format"]>("pdf");
  const [tags, setTags] = useState("متابعة");
  const [note, setNote] = useState("");

  const submit = () => {
    if (!title.trim()) return toast("أدخل اسم الملف", "err");
    const item: ArchiveItem = {
      id: uid("arc"),
      title,
      category,
      patientId: patientId || undefined,
      date: todayISO(),
      tags: tags.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
      size: `${(Math.random() * 2 + 0.3).toFixed(1)} MB`,
      format,
      note,
    };
    save("archive", item);
    toast("تم رفع الملف إلى الأرشيف");
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="رفع ملف إلى الأرشيف"
      sub="أضف تحليلًا، أشعة، إقرارًا أو تقريرًا"
      icon={<Upload size={18} />}
      footer={<><Button onClick={onClose}>إلغاء</Button><Button variant="primary" onClick={submit}>حفظ الملف</Button></>}
    >
      <div className="col gap-12">
        <Field label="اسم الملف" required>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تحليل صورة دم كاملة" />
        </Field>
        <div className="grid grid-2 gap-12">
          <Field label="المريض">
            <select className="select" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">— غير مرتبط —</option>
              {db.patients.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.code}</option>)}
            </select>
          </Field>
          <Field label="التصنيف">
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value as any)}>
              {CATS.filter((c) => c.key !== "all").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="نوع الملف">
            <select className="select" value={format} onChange={(e) => setFormat(e.target.value as any)}>
              <option value="pdf">PDF</option>
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
              <option value="docx">DOCX</option>
            </select>
          </Field>
          <Field label="تصنيفات">
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>
        </div>
        <div
          style={{
            border: "1.5px dashed var(--line-2)",
            borderRadius: 12,
            padding: "22px 14px",
            textAlign: "center",
            color: "var(--ink-3)",
            background: "var(--surface-2)",
          }}
        >
          <Upload size={22} style={{ marginBottom: 6 }} />
          <div className="small strong" style={{ color: "var(--ink-2)" }}>اسحب الملف هنا أو اضغط للاختيار</div>
          <div className="tiny">PDF, JPG, PNG — حتى 20 ميجابايت (محاكاة في النسخة التجريبية)</div>
        </div>
        <Field label="ملاحظة">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
