import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  CalendarDays,
  FileText,
  Plus,
  Printer,
  Search,
  Stethoscope,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHead } from "@/components/ui";
import { DocPreview, PrescriptionDoc } from "@/components/docs";
import type { Prescription, PrescriptionItem } from "@/lib/types";
import { ageFrom, fmtDate, genNumber, relDay, todayISO, uid } from "@/lib/utils";

const FORMS = ["أقراص", "كبسولات", "شراب", "أمبولات", "بخاخ", "دهان", "قطرة", "لبوس", "فوار"];
const ROUTES = ["فموي", "موضعي", "استنشاق", "وريدي", "عضلي", "أنفي", "عيني", "تحت اللسان"];

const emptyItem = (): PrescriptionItem => ({
  id: uid("itm"),
  name: "",
  form: "أقراص",
  dose: "قرص",
  frequency: "كل 8 ساعات",
  duration: "5 أيام",
  route: "فموي",
  notes: "",
});

export default function Prescriptions() {
  const { db, save, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "completed">("all");
  const [open, setOpen] = useState(params.get("new") === "1");
  const [presetPatient, setPresetPatient] = useState(params.get("patient") ?? "");
  const [preview, setPreview] = useState<Prescription | null>(null);

  React.useEffect(() => {
    if (params.get("new") === "1") {
      setOpen(true);
      setPresetPatient(params.get("patient") ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const closeForm = () => {
    setOpen(false);
    if (params.get("new")) {
      params.delete("new");
      params.delete("patient");
      setParams(params, { replace: true });
    }
  };

  const list = useMemo(() => {
    return db.prescriptions
      .map((r) => ({ r, p: db.patients.find((p) => p.id === r.patientId) }))
      .filter(({ r, p }) => {
        if (status !== "all" && r.status !== status) return false;
        if (!q.trim()) return true;
        return (p?.name.includes(q) ?? false) || r.number.includes(q) || (r.diagnosis ?? "").includes(q);
      })
      .sort((a, b) => b.r.date.localeCompare(a.r.date));
  }, [db.prescriptions, db.patients, q, status]);

  const thisMonth = db.prescriptions.filter((r) => r.date.slice(0, 7) === todayISO().slice(0, 7)).length;
  const drugs = db.prescriptions.reduce((s, r) => s + r.items.length, 0);

  return (
    <>
      <PageHead
        title="الوصفات الطبية"
        sub={`${db.prescriptions.length} وصفة — جاهزة للطباعة أو التصدير PDF`}
        actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> وصفة جديدة</Button>}
      />

      <div className="grid grid-4 mb-16">
        {[
          { l: "إجمالي الوصفات", v: db.prescriptions.length, c: "var(--primary)", b: "var(--primary-soft)", i: <FileText size={18} /> },
          { l: "وصفات نشطة", v: db.prescriptions.filter((r) => r.status === "active").length, c: "var(--ok)", b: "var(--ok-soft)", i: <Activity size={18} /> },
          { l: "هذا الشهر", v: thisMonth, c: "var(--info)", b: "var(--info-soft)", i: <CalendarDays size={18} /> },
          { l: "أدوية موصوفة", v: drugs, c: "var(--violet)", b: "var(--violet-soft)", i: <Stethoscope size={18} /> },
        ].map((s) => (
          <div className="stat" key={s.l} style={{ "--stat-tint": s.b, "--stat-color": s.c } as React.CSSProperties}>
            <div className="row gap-8">
              <div className="stat-ico" style={{ width: 33, height: 33, borderRadius: 9 }}>{s.i}</div>
              <div>
                <div className="stat-label" style={{ marginTop: 0 }}>{s.l}</div>
                <div className="stat-value num" style={{ fontSize: "1.28rem" }}>{s.v}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <div className="toolbar">
          <div className="searchbar" style={{ maxWidth: 300 }}>
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث برقم الوصفة، المريض أو التشخيص…" />
          </div>
          <select className="select" style={{ width: 140 }} value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="all">كل الحالات</option>
            <option value="active">نشطة</option>
            <option value="completed">منتهية</option>
          </select>
          <div className="spacer" />
          <span className="tiny muted">{list.length} وصفة</span>
        </div>

        {list.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>رقم الوصفة</th>
                  <th>المريض</th>
                  <th>التشخيص</th>
                  <th>الأدوية</th>
                  <th>التاريخ</th>
                  <th>الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map(({ r, p }) => (
                  <tr key={r.id}>
                    <td className="mono">{r.number}</td>
                    <td>
                      <div className="cell-main">
                        <Avatar name={p?.name ?? "مريض"} size="sm" />
                        <div>
                          <div className="strong" style={{ fontSize: ".84rem" }}>{p?.name}</div>
                          <div className="tiny muted">{p?.code} · {ageFrom(p?.birthDate)} سنة</div>
                        </div>
                      </div>
                    </td>
                    <td className="truncate" style={{ maxWidth: 200 }}>{r.diagnosis}</td>
                    <td>
                      <div className="tiny">{r.items.slice(0, 2).map((i) => i.name).join(" · ")}{r.items.length > 2 ? ` +${r.items.length - 2}` : ""}</div>
                    </td>
                    <td>
                      <div className="tiny">{fmtDate(r.date)}</div>
                      <div className="tiny muted">{relDay(r.date)}</div>
                    </td>
                    <td><Badge tone={r.status === "active" ? "primary" : "default"}>{r.status === "active" ? "نشطة" : "منتهية"}</Badge></td>
                    <td className="actions">
                      <Button size="sm" variant="ghost" onClick={() => setPreview(r)}><Printer size={13} /> طباعة</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<FileText size={24} />}
            title="لا وصفات مطابقة"
            desc="اكتب وصفة جديدة وستظهر هنا مع إمكانية الطباعة والتصدير."
            action={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={15} /> وصفة جديدة</Button>}
          />
        )}
      </Card>

      {open ? <RxForm onClose={closeForm} presetPatient={presetPatient} /> : null}

      {preview ? (
        <DocPreview
          open
          onClose={() => setPreview(null)}
          title={`وصفة طبية ${preview.number}`}
          filename={`${preview.number}.pdf`}
          doc={<PrescriptionDoc prescription={preview} patient={db.patients.find((p) => p.id === preview.patientId)} settings={db.settings} />}
        />
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------- form */
function RxForm({ onClose, presetPatient }: { onClose: () => void; presetPatient?: string }) {
  const { db, save, remove, toast } = useApp();
  const [patientId, setPatientId] = useState(presetPatient ?? "");
  const [visitId, setVisitId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [diagnosis, setDiagnosis] = useState("");
  const [advice, setAdvice] = useState("الإكثار من السوائل والراحة، وتجنب المجهود العنيف. العودة فورًا عند ظهور أعراض حادة.");
  const [items, setItems] = useState<PrescriptionItem[]>([emptyItem()]);

  const patient = db.patients.find((p) => p.id === patientId);
  const visits = db.visits.filter((v) => v.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date));

  const setItem = (id: string, patch: Partial<PrescriptionItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const submit = () => {
    if (!patientId) return toast("اختر المريض أولًا", "err");
    const valid = items.filter((i) => i.name.trim());
    if (!valid.length) return toast("أضف دواءً واحدًا على الأقل", "err");
    const rx: Prescription = {
      id: uid("rx"),
      number: genNumber("RX"),
      patientId,
      visitId: visitId || undefined,
      doctorId: "usr_doctor",
      date,
      diagnosis: diagnosis || visits.find((v) => v.id === visitId)?.diagnosis.join(" / "),
      items: valid,
      advice,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    save("prescriptions", rx);
    toast("تم حفظ الوصفة الطبية بنجاح");
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="وصفة طبية جديدة"
      sub={patient ? `${patient.name} — ${patient.code}` : "اختر المريض ثم أضف الأدوية"}
      icon={<FileText size={18} />}
      size="xl"
      footer={
        <>
          <Button onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={submit}><FileText size={15} /> حفظ الوصفة</Button>
        </>
      }
    >
      <div className="grid grid-3 gap-12">
        <Field label="المريض" required>
          <select className="select" value={patientId} onChange={(e) => { setPatientId(e.target.value); setVisitId(""); }}>
            <option value="">— اختر المريض —</option>
            {db.patients.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.code}</option>)}
          </select>
        </Field>
        <Field label="ربط بزيارة (اختياري)">
          <select className="select" value={visitId} onChange={(e) => setVisitId(e.target.value)} disabled={!patientId}>
            <option value="">— بدون ربط —</option>
            {visits.map((v) => <option key={v.id} value={v.id}>{fmtDate(v.date)} — {v.diagnosis.join(" / ")}</option>)}
          </select>
        </Field>
        <Field label="التاريخ">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      {patient ? (
        <div className="row gap-6 wrap mt-12">
          {patient.allergies.length ? (
            <Badge tone="danger">⚠ حساسية: {patient.allergies.join("، ")}</Badge>
          ) : (
            <Badge tone="ok">لا حساسية مسجلة</Badge>
          )}
          <Badge tone="line">{ageFrom(patient.birthDate)} سنة</Badge>
          {patient.chronic.map((c) => <Badge key={c} tone="warn">{c}</Badge>)}
        </div>
      ) : null}

      <div className="mt-12">
        <Field label="التشخيص">
          <input className="input" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="مثال: التهاب شعبي حاد" />
        </Field>
      </div>

      <div className="divider" />
      <div className="row-between mb-8">
        <b className="small row gap-6"><Stethoscope size={15} /> الأدوية الموصوفة ({items.length})</b>
        <Button size="sm" variant="soft" onClick={() => setItems((p) => [...p, emptyItem()])}>
          <Plus size={13} /> إضافة دواء
        </Button>
      </div>

      <div className="col gap-8">
        {items.map((it, idx) => (
          <div key={it.id} className="soft-box" style={{ padding: 11 }}>
            <div className="row-between mb-8">
              <span className="tiny muted">دواء {idx + 1}</span>
              {items.length > 1 ? (
                <button className="icon-btn" style={{ width: 26, height: 26, color: "var(--danger)" }} onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}>
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
            <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr 1.4fr 1fr 1fr", gap: 7 }}>
              <Field label="اسم الدواء">
                <input className="input" value={it.name} onChange={(e) => setItem(it.id, { name: e.target.value })} placeholder="باراسيتامول 500 مجم" style={{ height: 36 }} />
              </Field>
              <Field label="الشكل">
                <select className="select" value={it.form} onChange={(e) => setItem(it.id, { form: e.target.value })} style={{ height: 36 }}>
                  {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="الجرعة">
                <input className="input" value={it.dose} onChange={(e) => setItem(it.id, { dose: e.target.value })} style={{ height: 36 }} />
              </Field>
              <Field label="التكرار">
                <input className="input" value={it.frequency} onChange={(e) => setItem(it.id, { frequency: e.target.value })} style={{ height: 36 }} />
              </Field>
              <Field label="المدة">
                <input className="input" value={it.duration} onChange={(e) => setItem(it.id, { duration: e.target.value })} style={{ height: 36 }} />
              </Field>
              <Field label="الطريقة">
                <select className="select" value={it.route} onChange={(e) => setItem(it.id, { route: e.target.value })} style={{ height: 36 }}>
                  {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>
            <input className="input mt-8" style={{ height: 34 }} value={it.notes ?? ""} onChange={(e) => setItem(it.id, { notes: e.target.value })} placeholder="ملاحظة على الدواء (اختياري) — مثال: بعد الأكل" />
          </div>
        ))}
      </div>

      <div className="mt-12">
        <Field label="إرشادات للمريض">
          <textarea className="textarea" value={advice} onChange={(e) => setAdvice(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
