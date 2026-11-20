import React, { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  ClipboardList,
  Download,
  Droplet,
  FileText,
  FolderOpen,
  Heart,
  IdCard,
  MapPin,
  Phone,
  Printer,
  Receipt,
  ShieldAlert,
  Stethoscope,
  UserPen,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Avatar, Badge, Button, Card, CardHead, ConfirmDialog, EmptyState, Field, Modal, Tabs } from "@/components/ui";
import { DocPreview, DocRow, InvoiceDoc, PrescriptionDoc, VisitDoc } from "@/components/docs";
import type { Invoice, Patient, Prescription, Visit } from "@/lib/types";
import {
  ageFrom,
  bmi,
  bmiLabel,
  fmtDate,
  fmtMoney,
  fmtNum,
  invoiceTotals,
  todayISO,
} from "@/lib/utils";

type Tab = "overview" | "visits" | "rx" | "invoices" | "files";

export default function PatientProfile() {
  const { id } = useParams();
  const { db, toast } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [preview, setPreview] = useState<{ kind: "invoice" | "rx" | "visit"; id: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const patient = db.patients.find((p) => p.id === id);

  const visits = useMemo(
    () => db.visits.filter((v) => v.patientId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [db.visits, id]
  );
  const prescriptions = useMemo(
    () => db.prescriptions.filter((r) => r.patientId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [db.prescriptions, id]
  );
  const invoices = useMemo(
    () => db.invoices.filter((i) => i.patientId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [db.invoices, id]
  );
  const files = useMemo(() => db.archive.filter((a) => a.patientId === id), [db.archive, id]);
  const appts = useMemo(
    () => db.appointments.filter((a) => a.patientId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [db.appointments, id]
  );

  if (!patient) {
    return (
      <EmptyState
        icon={<ShieldAlert size={26} />}
        title="ملف المريض غير موجود"
        desc="ربما تم حذف الملف أو أن الرابط غير صحيح."
        action={<Button variant="primary" onClick={() => navigate("/patients")}>رجوع لقائمة المرضى</Button>}
      />
    );
  }

  const lastVisit = visits[0];
  const totalBilled = invoices.reduce((s, i) => s + invoiceTotals(i.items, i.discount, i.taxRate).total, 0);
  const outstanding = invoices.reduce((s, i) => s + Math.max(0, invoiceTotals(i.items, i.discount, i.taxRate).total - i.paid), 0);
  const latestVitals = lastVisit?.vitals;
  const b = bmi(latestVitals?.weight, latestVitals?.height);
  const nextAppt = appts.filter((a) => a.date >= todayISO() && a.status !== "cancelled").sort((x, y) => x.date.localeCompare(y.date))[0];

  const previewDoc = () => {
    if (!preview) return null;
    if (preview.kind === "invoice") {
      const inv = invoices.find((i) => i.id === preview.id);
      if (!inv) return null;
      return { title: `فاتورة ${inv.number}`, filename: `${inv.number}.pdf`, doc: <InvoiceDoc invoice={inv} patient={patient} settings={db.settings} /> };
    }
    if (preview.kind === "rx") {
      const rx = prescriptions.find((r) => r.id === preview.id);
      if (!rx) return null;
      return { title: `وصفة ${rx.number}`, filename: `${rx.number}.pdf`, doc: <PrescriptionDoc prescription={rx} patient={patient} settings={db.settings} /> };
    }
    const v = visits.find((x) => x.id === preview.id);
    if (!v) return null;
    return { title: `تقرير زيارة ${fmtDate(v.date)}`, filename: `visit-${v.date}.pdf`, doc: <VisitDoc visit={v} patient={patient} settings={db.settings} /> };
  };
  const pd = previewDoc();

  return (
    <>
      <div className="row gap-8 mb-12">
        <Button size="sm" variant="ghost" onClick={() => navigate("/patients")}>
          <ArrowLeft size={14} /> المرضى
        </Button>
        <span className="muted tiny">/</span>
        <span className="small strong">{patient.name}</span>
      </div>

      <Card className="mb-16" style={{ overflow: "hidden" }}>
        <div
          style={{
            height: 86,
            background: "linear-gradient(120deg,#0a5f5a,#0d7c74 55%,#12a79a)",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(500px 200px at 90% 0%, rgba(255,255,255,.2), transparent 60%)" }} />
        </div>
        <div className="card-bd" style={{ paddingTop: 0 }}>
          <div className="row wrap" style={{ alignItems: "flex-end", gap: 16, marginTop: -38 }}>
            <Avatar name={patient.name} size="xl" className="avatar-ring" />
            <div className="grow" style={{ paddingBottom: 2 }}>
              <div className="row gap-8 wrap">
                <h2 style={{ fontSize: "1.3rem" }}>{patient.name}</h2>
                <Badge tone="primary">{patient.code}</Badge>
                {patient.tags.map((t) => (
                  <Badge key={t} tone="line">{t}</Badge>
                ))}
              </div>
              <div className="row gap-16 wrap tiny muted" style={{ marginTop: 5 }}>
                <span className="row gap-4"><IdCard size={13} /> {ageFrom(patient.birthDate)} سنة · {patient.gender === "male" ? "ذكر" : "أنثى"}</span>
                <span className="row gap-4" dir="ltr"><Phone size={13} /> {patient.phone}</span>
                {patient.address ? <span className="row gap-4"><MapPin size={13} /> {patient.address}</span> : null}
                <span className="row gap-4"><CalendarPlus size={13} /> مسجل منذ {fmtDate(patient.createdAt)}</span>
              </div>
            </div>
            <div className="row gap-8 wrap" style={{ paddingBottom: 4 }}>
              <Button onClick={() => setEditOpen(true)}><UserPen size={15} /> تعديل</Button>
              <Button onClick={() => navigate("/prescriptions?new=1&patient=" + patient.id)}><FileText size={15} /> وصفة</Button>
              <Button variant="primary" onClick={() => navigate("/appointments?new=1&patient=" + patient.id)}>
                <CalendarPlus size={15} /> حجز موعد
              </Button>
            </div>
          </div>

          <div className="grid grid-4" style={{ marginTop: 18, gap: 10 }}>
            {[
              { l: "الزيارات", v: visits.length, s: lastVisit ? `آخرها ${fmtDate(lastVisit.date)}` : "لا زيارات" },
              { l: "الوصفات", v: prescriptions.length, s: `${prescriptions.filter((r) => r.status === "active").length} نشطة` },
              { l: "إجمالي الفواتير", v: fmtNum(Math.round(totalBilled)), s: `${db.settings.currency} — ${invoices.length} فاتورة` },
              { l: "مستحقات غير مسددة", v: fmtNum(Math.round(outstanding)), s: outstanding ? "تحتاج متابعة" : "لا مستحقات" },
            ].map((x) => (
              <div key={x.l} className="soft-box" style={{ padding: "10px 12px" }}>
                <div className="tiny muted">{x.l}</div>
                <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.2rem" }}>{x.v}</div>
                <div className="tiny muted truncate">{x.s}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {patient.allergies.length ? (
        <div className="alert alert-danger mb-16">
          <AlertTriangle size={17} />
          <div>
            <strong>تنبيه حساسية:</strong> المريض لديه حساسية معروفة من {patient.allergies.join("، ")} — يجب مراجعتها قبل صرف أي دواء.
          </div>
        </div>
      ) : null}

      <Card>
        <Tabs
          tabs={[
            { key: "overview", label: "نظرة عامة" },
            { key: "visits", label: "الزيارات", count: visits.length },
            { key: "rx", label: "الوصفات", count: prescriptions.length },
            { key: "invoices", label: "الفواتير", count: invoices.length },
            { key: "files", label: "الملفات", count: files.length },
          ]}
          value={tab}
          onChange={(k) => setTab(k as Tab)}
        />

        <div className="card-bd">
          {tab === "overview" ? (
            <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
              <div>
                <div className="row-between mb-12">
                  <h3 style={{ fontSize: ".95rem" }}>السجل الطبي الزمني</h3>
                  <Button size="sm" variant="ghost" onClick={() => setTab("visits")}>
                    كل الزيارات <ArrowLeft size={13} />
                  </Button>
                </div>
                {visits.length ? (
                  <div className="timeline">
                    {visits.slice(0, 5).map((v) => (
                      <div className="timeline-item" key={v.id}>
                        <div className="row-between">
                          <div className="small strong">{v.diagnosis.join(" · ")}</div>
                          <span className="tiny muted">{fmtDate(v.date)}</span>
                        </div>
                        <div className="tiny muted" style={{ marginTop: 2 }}>{v.chiefComplaint}</div>
                        <div className="row gap-6 mt-8">
                          <Badge tone="primary">{v.type === "consultation" ? "كشف" : v.type === "followup" ? "متابعة" : v.type === "telemedicine" ? "عن بُعد" : "طوارئ"}</Badge>
                          <Button size="sm" variant="ghost" onClick={() => setPreview({ kind: "visit", id: v.id })}>
                            <Printer size={12} /> تقرير
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={<Stethoscope size={24} />} title="لا توجد زيارات مسجلة" desc="ابدأ بتسجيل أول زيارة من قسم السجلات الطبية." />
                )}
              </div>

              <div className="col gap-12">
                <div className="soft-box">
                  <div className="row-between mb-8">
                    <b className="small">آخر علامات حيوية</b>
                    <Badge tone="ok" dot>مسجلة</Badge>
                  </div>
                  {latestVitals ? (
                    <>
                      <div className="grid grid-2" style={{ gap: 8 }}>
                        {[
                          { l: "ضغط الدم", v: latestVitals.bpSys ? `${latestVitals.bpSys}/${latestVitals.bpDia}` : "—", ic: <Heart size={13} /> },
                          { l: "النبض", v: latestVitals.pulse ? `${latestVitals.pulse}` : "—", ic: <Activity size={13} /> },
                          { l: "الحرارة", v: latestVitals.temp ? `${latestVitals.temp}°` : "—", ic: <Activity size={13} /> },
                          { l: "الأكسجين", v: latestVitals.spo2 ? `${latestVitals.spo2}%` : "—", ic: <Activity size={13} /> },
                        ].map((x) => (
                          <div key={x.l} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 9, padding: "7px 9px" }}>
                            <div className="tiny muted row gap-4">{x.ic} {x.l}</div>
                            <div className="strong num">{x.v}</div>
                          </div>
                        ))}
                      </div>
                      <div className="row-between mt-8 tiny">
                        <span className="muted">الوزن / الطول</span>
                        <span className="strong num">{latestVitals.weight ?? "—"} كجم / {latestVitals.height ?? "—"} سم</span>
                      </div>
                      {b ? (
                        <div className="row-between tiny">
                          <span className="muted">مؤشر الكتلة</span>
                          <span className="strong num">{b} — {bmiLabel(b)}</span>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="tiny muted">لم تُسجل علامات حيوية بعد.</div>
                  )}
                </div>

                <div className="soft-box">
                  <b className="small">الملف الصحي</b>
                  <DocRow label="فصيلة الدم" value={patient.bloodType ?? "—"} />
                  <DocRow label="الأمراض المزمنة" value={patient.chronic.length ? patient.chronic.join("، ") : "لا يوجد"} />
                  <DocRow label="الحساسية" value={patient.allergies.length ? patient.allergies.join("، ") : "لا يوجد"} />
                  <DocRow label="التأمين" value={patient.insurance ?? "بدون"} />
                  <DocRow label="الرقم القومي" value={<span className="mono">{patient.nationalId ?? "—"}</span>} />
                </div>

                {nextAppt ? (
                  <div className="alert alert-info">
                    <CalendarPlus size={16} />
                    <div>
                      <strong>الموعد القادم:</strong> {fmtDate(nextAppt.date)} الساعة {nextAppt.time}
                    </div>
                  </div>
                ) : null}

                {patient.notes ? (
                  <div className="alert alert-warn">
                    <ClipboardList size={16} />
                    <div>{patient.notes}</div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "visits" ? (
            visits.length ? (
              <div className="col gap-12">
                {visits.map((v) => (
                  <div key={v.id} className="soft-box" style={{ padding: 14 }}>
                    <div className="row-between wrap gap-8">
                      <div>
                        <div className="row gap-8">
                          <b className="small">{fmtDate(v.date)}</b>
                          <Badge tone="primary">{v.type === "consultation" ? "كشف" : v.type === "followup" ? "متابعة" : v.type === "telemedicine" ? "عن بُعد" : "طوارئ"}</Badge>
                          {v.icd ? <span className="tiny muted mono">{v.icd}</span> : null}
                        </div>
                        <div className="small" style={{ marginTop: 4 }}>{v.diagnosis.join(" — ")}</div>
                        <div className="tiny muted" style={{ marginTop: 2 }}>الشكوى: {v.chiefComplaint}</div>
                      </div>
                      <Button size="sm" onClick={() => setPreview({ kind: "visit", id: v.id })}>
                        <Printer size={13} /> عرض / طباعة
                      </Button>
                    </div>
                    {v.plan ? <div className="tiny ink-2 mt-8" style={{ lineHeight: 1.8 }}><b>الخطة:</b> {v.plan}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Stethoscope size={24} />} title="لا زيارات" desc="لم يتم تسجيل أي زيارة لهذا المريض بعد." />
            )
          ) : null}

          {tab === "rx" ? (
            prescriptions.length ? (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>رقم الوصفة</th>
                      <th>التاريخ</th>
                      <th>التشخيص</th>
                      <th>الأدوية</th>
                      <th>الحالة</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{r.number}</td>
                        <td className="tiny muted">{fmtDate(r.date)}</td>
                        <td className="truncate" style={{ maxWidth: 240 }}>{r.diagnosis}</td>
                        <td>
                          <div className="tiny">{r.items.map((i) => i.name).join(" · ")}</div>
                        </td>
                        <td>
                          <Badge tone={r.status === "active" ? "primary" : "default"}>
                            {r.status === "active" ? "نشطة" : "منتهية"}
                          </Badge>
                        </td>
                        <td className="actions">
                          <Button size="sm" variant="ghost" onClick={() => setPreview({ kind: "rx", id: r.id })}>
                            <Printer size={13} /> طباعة
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={<FileText size={24} />}
                title="لا وصفات طبية"
                desc="اكتب أول وصفة لهذا المريض."
                action={<Button variant="primary" onClick={() => navigate("/prescriptions?new=1&patient=" + patient.id)}>وصفة جديدة</Button>}
              />
            )
          ) : null}

          {tab === "invoices" ? (
            invoices.length ? (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>رقم الفاتورة</th>
                      <th>التاريخ</th>
                      <th>الإجمالي</th>
                      <th>المدفوع</th>
                      <th>المتبقي</th>
                      <th>الحالة</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => {
                      const t = invoiceTotals(inv.items, inv.discount, inv.taxRate);
                      const rem = Math.max(0, t.total - inv.paid);
                      return (
                        <tr key={inv.id}>
                          <td className="mono">{inv.number}</td>
                          <td className="tiny muted">{fmtDate(inv.date)}</td>
                          <td className="num strong">{fmtMoney(t.total, db.settings.currency)}</td>
                          <td className="num">{fmtMoney(inv.paid, db.settings.currency)}</td>
                          <td className="num" style={{ color: rem ? "var(--danger)" : "var(--ink-3)" }}>{fmtMoney(rem, db.settings.currency)}</td>
                          <td>
                            <Badge tone={inv.status === "paid" ? "ok" : inv.status === "partial" ? "warn" : "danger"}>
                              {inv.status === "paid" ? "مدفوعة" : inv.status === "partial" ? "جزئية" : "غير مدفوعة"}
                            </Badge>
                          </td>
                          <td className="actions">
                            <Button size="sm" variant="ghost" onClick={() => setPreview({ kind: "invoice", id: inv.id })}>
                              <Printer size={13} /> طباعة
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={<Receipt size={24} />} title="لا فواتير" desc="لم تصدر أي فاتورة لهذا المريض بعد." />
            )
          ) : null}

          {tab === "files" ? (
            files.length ? (
              <div className="grid grid-3">
                {files.map((f) => (
                  <div key={f.id} className="soft-box" style={{ padding: 13 }}>
                    <div className="row-between">
                      <Badge tone="info">{f.format.toUpperCase()}</Badge>
                      <span className="tiny muted">{f.size}</span>
                    </div>
                    <div className="small strong mt-8" style={{ lineHeight: 1.5 }}>{f.title}</div>
                    <div className="tiny muted">{fmtDate(f.date)}</div>
                    <Button size="sm" variant="ghost" className="mt-8" onClick={() => toast("الملف تجريبي في هذه النسخة", "info")}>
                      <Download size={13} /> تنزيل
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<FolderOpen size={24} />} title="لا ملفات مرفقة" desc="ارفع تحاليل وأشعة المريض من قسم الأرشيف الطبي." />
            )
          ) : null}
        </div>
      </Card>

      {pd ? (
        <DocPreview open onClose={() => setPreview(null)} title={pd.title} filename={pd.filename} doc={pd.doc} />
      ) : null}

      {editOpen ? <QuickEdit patient={patient} onClose={() => setEditOpen(false)} /> : null}
    </>
  );
}

function QuickEdit({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const { save, remove, toast } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState(patient);
  const [confirm, setConfirm] = useState(false);

  const set = <K extends keyof Patient>(k: K, v: Patient[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="تعديل بيانات المريض"
        sub={patient.code}
        icon={<UserPen size={17} />}
        footer={
          <>
            <Button variant="danger-soft" onClick={() => setConfirm(true)} style={{ marginInlineEnd: "auto" }}>حذف الملف</Button>
            <Button onClick={onClose}>إلغاء</Button>
            <Button
              variant="primary"
              onClick={() => {
                save("patients", form);
                toast("تم تحديث بيانات المريض");
                onClose();
              }}
            >
              حفظ
            </Button>
          </>
        }
      >
        <div className="grid grid-2 gap-12">
          <Field label="الاسم"><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="الهاتف"><input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} dir="ltr" style={{ textAlign: "right" }} /></Field>
          <Field label="تاريخ الميلاد"><input type="date" className="input" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></Field>
          <Field label="فصيلة الدم">
            <select className="select" value={form.bloodType ?? ""} onChange={(e) => set("bloodType", e.target.value)}>
              <option value="">—</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="العنوان"><input className="input" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="التأمين"><input className="input" value={form.insurance ?? ""} onChange={(e) => set("insurance", e.target.value)} /></Field>
          <Field label="الأمراض المزمنة" hint="افصل بفاصلة">
            <input className="input" value={form.chronic.join("، ")} onChange={(e) => set("chronic", e.target.value.split(/[،,]/).map((s) => s.trim()).filter(Boolean))} />
          </Field>
          <Field label="الحساسية" hint="افصل بفاصلة">
            <input className="input" value={form.allergies.join("، ")} onChange={(e) => set("allergies", e.target.value.split(/[،,]/).map((s) => s.trim()).filter(Boolean))} />
          </Field>
          <Field label="ملاحظات">
            <textarea className="textarea" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="حذف ملف المريض"
        message={`سيتم حذف ملف «${patient.name}» نهائيًا.`}
        confirmLabel="حذف"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          remove("patients", patient.id);
          toast("تم حذف الملف", "err");
          navigate("/patients");
        }}
      />
    </>
  );
}
