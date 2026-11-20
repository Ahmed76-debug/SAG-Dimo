import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  Download,
  FileText,
  Heart,
  Plus,
  Printer,
  Search,
  Stethoscope,
  Thermometer,
  User,
  Weight,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHead } from "@/components/ui";
import { DocPreview, VisitDoc } from "@/components/docs";
import type { Visit } from "@/lib/types";
import { addDays, ageFrom, bmi, bmiLabel, downloadText, fmtDate, fmtNum, relDay, toCSV, todayISO, uid } from "@/lib/utils";

const TYPES: { v: Visit["type"]; l: string }[] = [
  { v: "consultation", l: "كشف جديد" },
  { v: "followup", l: "متابعة" },
  { v: "emergency", l: "طوارئ" },
  { v: "telemedicine", l: "عن بُعد" },
];

export default function MedicalRecords() {
  const { db, save, toast } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | Visit["type"]>("all");
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Visit | null>(null);

  const list = useMemo(() => {
    return db.visits
      .map((v) => ({ v, p: db.patients.find((p) => p.id === v.patientId) }))
      .filter(({ v, p }) => {
        if (typeFilter !== "all" && v.type !== typeFilter) return false;
        if (!q.trim()) return true;
        return (
          (p?.name.includes(q) ?? false) ||
          v.diagnosis.some((d) => d.includes(q)) ||
          v.chiefComplaint.includes(q)
        );
      })
      .sort((a, b) => b.v.date.localeCompare(a.v.date));
  }, [db.visits, db.patients, q, typeFilter]);

  const thisMonth = db.visits.filter((v) => v.date.slice(0, 7) === todayISO().slice(0, 7)).length;
  const dueFollowUps = db.visits.filter((v) => v.followUpDate && v.followUpDate <= addDays(todayISO(), 7)).length;

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["التاريخ", "المريض", "الكود", "نوع الزيارة", "الشكوى", "التشخيص", "ICD", "الخطة", "متابعة"],
      ...list.map(({ v, p }) => [
        v.date,
        p?.name ?? "",
        p?.code ?? "",
        TYPES.find((t) => t.v === v.type)?.l ?? v.type,
        v.chiefComplaint,
        v.diagnosis.join(" / "),
        v.icd ?? "",
        v.plan ?? "",
        v.followUpDate ?? "",
      ]),
    ];
    downloadText(`medical-records-${todayISO()}.csv`, toCSV(rows), "text/csv;charset=utf-8");
    toast("تم تصدير السجلات الطبية");
  };

  return (
    <>
      <PageHead
        title="السجلات الطبية"
        sub={`${db.visits.length} زيارة مسجلة — توثيق كامل لكل حالة`}
        actions={
          <>
            <Button onClick={exportCsv}><Download size={15} /> تصدير</Button>
            <Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> زيارة جديدة</Button>
          </>
        }
      />

      <div className="grid grid-4 mb-16">
        {[
          { l: "إجمالي الزيارات", v: fmtNum(db.visits.length), c: "var(--primary)", b: "var(--primary-soft)", i: <Stethoscope size={18} /> },
          { l: "زيارات هذا الشهر", v: fmtNum(thisMonth), c: "var(--info)", b: "var(--info-soft)", i: <CalendarDays size={18} /> },
          { l: "متابعات مستحقة", v: fmtNum(dueFollowUps), c: "var(--warn)", b: "var(--warn-soft)", i: <ClipboardList size={18} /> },
          { l: "حالات عن بُعد", v: fmtNum(db.visits.filter((v) => v.type === "telemedicine").length), c: "var(--violet)", b: "var(--violet-soft)", i: <Activity size={18} /> },
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالمريض، التشخيص أو الشكوى…" />
          </div>
          <select className="select" style={{ width: 150 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
            <option value="all">كل الأنواع</option>
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <div className="spacer" />
          <span className="tiny muted">{list.length} سجل</span>
        </div>

        {list.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>المريض</th>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th>الشكوى</th>
                  <th>التشخيص</th>
                  <th>علامات حيوية</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map(({ v, p }) => (
                  <tr key={v.id}>
                    <td>
                      <div className="cell-main">
                        <Avatar name={p?.name ?? "مريض"} size="sm" />
                        <div>
                          <div className="strong" style={{ fontSize: ".84rem" }}>{p?.name ?? "—"}</div>
                          <div className="tiny muted">{p?.code} · {ageFrom(p?.birthDate)} سنة</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="small">{fmtDate(v.date)}</div>
                      <div className="tiny muted">{relDay(v.date)}</div>
                    </td>
                    <td>
                      <Badge tone={v.type === "emergency" ? "danger" : v.type === "telemedicine" ? "violet" : v.type === "followup" ? "info" : "primary"}>
                        {TYPES.find((t) => t.v === v.type)?.l}
                      </Badge>
                    </td>
                    <td className="truncate" style={{ maxWidth: 200 }}>{v.chiefComplaint}</td>
                    <td>
                      <div className="small">{v.diagnosis.join(" · ")}</div>
                      {v.icd ? <div className="tiny muted mono">{v.icd}</div> : null}
                    </td>
                    <td>
                      <div className="row gap-4 wrap tiny">
                        {v.vitals.bpSys ? <span className="tag"><Heart size={10} /> {v.vitals.bpSys}/{v.vitals.bpDia}</span> : null}
                        {v.vitals.pulse ? <span className="tag"><Activity size={10} /> {v.vitals.pulse}</span> : null}
                        {v.vitals.temp ? <span className="tag"><Thermometer size={10} /> {v.vitals.temp}°</span> : null}
                        {v.vitals.weight ? <span className="tag"><Weight size={10} /> {v.vitals.weight}</span> : null}
                      </div>
                    </td>
                    <td className="actions">
                      <Button size="sm" variant="ghost" onClick={() => setPreview(v)}><Printer size={13} /> تقرير</Button>
                      <Button size="sm" variant="ghost" onClick={() => p && navigate(`/patients/${p.id}`)}><User size={13} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<ClipboardList size={24} />} title="لا سجلات مطابقة" desc="ابدأ بتسجيل زيارة جديدة أو عدّل معايير البحث." />
        )}
      </Card>

      {open ? <VisitForm onClose={() => setOpen(false)} /> : null}

      {preview ? (
        <DocPreview
          open
          onClose={() => setPreview(null)}
          title={`تقرير زيارة — ${fmtDate(preview.date)}`}
          filename={`visit-${preview.date}.pdf`}
          doc={<VisitDoc visit={preview} patient={db.patients.find((p) => p.id === preview.patientId)} settings={db.settings} />}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------- form */
function VisitForm({ onClose }: { onClose: () => void }) {
  const { db, save, toast } = useApp();
  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState<Visit["type"]>("consultation");
  const [complaint, setComplaint] = useState("");
  const [history, setHistory] = useState("");
  const [exam, setExam] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [icd, setIcd] = useState("");
  const [plan, setPlan] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [notes, setNotes] = useState("");
  const [v, setV] = useState({ temp: "", bpSys: "", bpDia: "", pulse: "", weight: "", height: "", spo2: "", glucose: "" });

  const patient = db.patients.find((p) => p.id === patientId);
  const b = bmi(Number(v.weight) || undefined, Number(v.height) || undefined);

  const submit = () => {
    if (!patientId) return toast("اختر المريض أولًا", "err");
    if (!complaint.trim() || !diagnosis.trim()) return toast("الشكوى والتشخيص مطلوبان", "err");
    const visit: Visit = {
      id: uid("vis"),
      patientId,
      date,
      doctorId: "usr_doctor",
      type,
      chiefComplaint: complaint,
      history,
      examination: exam,
      diagnosis: diagnosis.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
      icd,
      plan,
      vitals: {
        temp: Number(v.temp) || undefined,
        bpSys: Number(v.bpSys) || undefined,
        bpDia: Number(v.bpDia) || undefined,
        pulse: Number(v.pulse) || undefined,
        weight: Number(v.weight) || undefined,
        height: Number(v.height) || undefined,
        spo2: Number(v.spo2) || undefined,
        glucose: Number(v.glucose) || undefined,
      },
      notes,
      followUpDate: followUp || undefined,
      attachments: [],
      createdAt: new Date().toISOString(),
    };
    save("visits", visit);
    toast("تم حفظ الزيارة في الملف الطبي");
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="تسجيل زيارة جديدة"
      sub="سيتم إضافتها للسجل الطبي للمريض"
      icon={<Stethoscope size={18} />}
      size="xl"
      footer={
        <>
          <Button onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={submit}><FileText size={15} /> حفظ الزيارة</Button>
        </>
      }
    >
      <div className="grid grid-3 gap-12">
        <Field label="المريض" required>
          <select className="select" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">— اختر المريض —</option>
            {db.patients.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.code}</option>)}
          </select>
        </Field>
        <Field label="التاريخ" required><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="نوع الزيارة">
          <select className="select" value={type} onChange={(e) => setType(e.target.value as Visit["type"])}>
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </Field>
      </div>

      {patient ? (
        <div className="row gap-8 wrap mt-12">
          {patient.chronic.map((c) => <Badge key={c} tone="warn">{c}</Badge>)}
          {patient.allergies.map((a) => <Badge key={a} tone="danger">حساسية: {a}</Badge>)}
          <Badge tone="line">{ageFrom(patient.birthDate)} سنة</Badge>
          <Badge tone="line">{patient.bloodType ?? "—"}</Badge>
        </div>
      ) : null}

      <div className="divider" />
      <b className="small">العلامات الحيوية</b>
      <div className="grid mt-8" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 9 }}>
        {[
          { k: "temp", l: "الحرارة °C", ph: "37.0" },
          { k: "bpSys", l: "ضغط انقباضي", ph: "120" },
          { k: "bpDia", l: "ضغط انبساطي", ph: "80" },
          { k: "pulse", l: "النبض", ph: "78" },
          { k: "weight", l: "الوزن كجم", ph: "70" },
          { k: "height", l: "الطول سم", ph: "170" },
          { k: "spo2", l: "الأكسجين %", ph: "98" },
          { k: "glucose", l: "السكر", ph: "95" },
        ].map((f) => (
          <Field key={f.k} label={f.l}>
            <input
              className="input num"
              value={(v as any)[f.k]}
              onChange={(e) => setV({ ...v, [f.k]: e.target.value })}
              placeholder={f.ph}
              dir="ltr"
              style={{ textAlign: "right" }}
            />
          </Field>
        ))}
      </div>
      {b ? <div className="tiny muted mt-8">مؤشر كتلة الجسم: <b>{b}</b> — {bmiLabel(b)}</div> : null}

      <div className="divider" />
      <div className="grid grid-2 gap-12">
        <Field label="الشكوى الرئيسية" required>
          <textarea className="textarea" value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="ماذا يشكو المريض اليوم؟" />
        </Field>
        <Field label="التاريخ المرضي">
          <textarea className="textarea" value={history} onChange={(e) => setHistory(e.target.value)} placeholder="أمراض سابقة، أدوية، عمليات…" />
        </Field>
      </div>

      <div className="mt-12">
        <Field label="الفحص الإكلينيكي">
          <textarea className="textarea" value={exam} onChange={(e) => setExam(e.target.value)} placeholder="نتائج الفحص العام والمحلي…" />
        </Field>
      </div>

      <div className="grid grid-3 gap-12 mt-12">
        <Field label="التشخيص" required hint="افصل بين التشخيصات بفاصلة" className="grid-span-2">
          <input className="input" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="التهاب شعبي حاد، حساسية موسمية" />
        </Field>
        <Field label="كود ICD-10">
          <input className="input" value={icd} onChange={(e) => setIcd(e.target.value)} placeholder="J20.9" dir="ltr" style={{ textAlign: "right" }} />
        </Field>
      </div>

      <div className="grid grid-2 gap-12 mt-12">
        <Field label="خطة العلاج">
          <textarea className="textarea" value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="الأدوية، التحاليل المطلوبة، التعليمات…" />
        </Field>
        <div className="col gap-12">
          <Field label="موعد المتابعة">
            <input type="date" className="input" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          </Field>
          <Field label="ملاحظات إضافية">
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
