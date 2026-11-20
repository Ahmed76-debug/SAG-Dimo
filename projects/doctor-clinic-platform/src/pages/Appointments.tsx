import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Globe,
  Play,
  Plus,
  Stethoscope,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Avatar, Badge, Button, Card, CardHead, EmptyState, Field, Modal, PageHead, Segmented } from "@/components/ui";
import type { Appointment, AppointmentStatus, AppointmentType, Patient } from "@/lib/types";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_TYPE_LABEL } from "@/lib/types";
import { addDays, dayName, fmtDate, fmtMoney, genCode, relDay, to12h, todayISO, uid } from "@/lib/utils";

const STATUS_TONE: Record<AppointmentStatus, "default" | "ok" | "warn" | "info" | "primary" | "danger" | "violet"> = {
  scheduled: "default",
  confirmed: "info",
  waiting: "warn",
  "in-progress": "primary",
  completed: "ok",
  cancelled: "danger",
  "no-show": "danger",
};

const TYPES: AppointmentType[] = ["consultation", "followup", "procedure", "telemedicine", "emergency"];

function slots() {
  const out: string[] = [];
  for (let h = 9; h <= 18; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 18) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}

export default function Appointments() {
  const { db, save, toast } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [date, setDate] = useState(todayISO());
  const [filter, setFilter] = useState<"all" | "waiting" | "completed">("all");
  const [formOpen, setFormOpen] = useState(params.get("new") === "1");
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  const [presetPatient, setPresetPatient] = useState(params.get("patient") ?? "");

  React.useEffect(() => {
    if (params.get("new") === "1") {
      setFormOpen(true);
      setPresetPatient(params.get("patient") ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const closeForm = () => {
    setFormOpen(false);
    setEditAppt(null);
    if (params.get("new")) {
      params.delete("new");
      params.delete("patient");
      setParams(params, { replace: true });
    }
  };

  const weekStart = useMemo(() => {
    const d = new Date(date);
    const day = d.getDay(); // 0 Sun ... 6 Sat  → week starts Saturday
    const diff = (day + 1) % 7;
    return addDays(date, -diff);
  }, [date]);

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const dayAppts = useMemo(
    () =>
      db.appointments
        .filter((a) => a.date === date)
        .filter((a) => (filter === "waiting" ? a.status === "waiting" || a.status === "in-progress" : filter === "completed" ? a.status === "completed" : true))
        .sort((a, b) => a.time.localeCompare(b.time)),
    [db.appointments, date, filter]
  );

  const dayAll = db.appointments.filter((a) => a.date === date);
  const waitingCount = dayAll.filter((a) => a.status === "waiting" || a.status === "in-progress").length;
  const doneCount = dayAll.filter((a) => a.status === "completed").length;
  const revenue = dayAll.filter((a) => a.status === "completed").reduce((s, a) => s + a.fee, 0);

  const updateStatus = (a: Appointment, status: AppointmentStatus) => {
    save("appointments", { ...a, status });
    const map: Record<string, string> = {
      confirmed: "تم تأكيد الموعد",
      "in-progress": "بدأ الكشف",
      completed: "تم إنهاء الزيارة بنجاح",
      cancelled: "تم إلغاء الموعد",
      "no-show": "تم تسجيل عدم الحضور",
    };
    toast(map[status] ?? "تم التحديث", status === "cancelled" || status === "no-show" ? "err" : "ok");
  };

  const countFor = (iso: string) => db.appointments.filter((a) => a.date === iso).length;

  return (
    <>
      <PageHead
        title="جدول المواعيد"
        sub={`${fmtDate(date)} · ${dayName(date)}`}
        actions={
          <>
            <Segmented
              options={[
                { value: "all", label: "الكل" },
                { value: "waiting", label: "في الانتظار" },
                { value: "completed", label: "مكتملة" },
              ]}
              value={filter}
              onChange={(v) => setFilter(v as any)}
            />
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              <CalendarPlus size={16} /> موعد جديد
            </Button>
          </>
        }
      />

      <Card className="mb-16">
        <div className="card-bd" style={{ paddingBottom: 12 }}>
          <div className="row-between mb-12">
            <div className="row gap-6">
              <Button size="sm" variant="ghost" onClick={() => setDate(addDays(weekStart, -7))} title="الأسبوع السابق">
                <ArrowRight size={15} />
              </Button>
              <b className="small">
                {fmtDate(week[0])} — {fmtDate(week[6])}
              </b>
              <Button size="sm" variant="ghost" onClick={() => setDate(addDays(weekStart, 7))} title="الأسبوع التالي">
                <ArrowLeft size={15} />
              </Button>
            </div>
            <div className="row gap-6">
              <input type="date" className="input" style={{ width: 150, height: 34 }} value={date} onChange={(e) => setDate(e.target.value)} />
              <Button size="sm" onClick={() => setDate(todayISO())}>اليوم</Button>
            </div>
          </div>
          <div className="grid week-strip" style={{ gridTemplateColumns: "repeat(7,1fr)", gap: 7 }}>
            {week.map((iso) => {
              const active = iso === date;
              const isToday = iso === todayISO();
              return (
                <button
                  key={iso}
                  onClick={() => setDate(iso)}
                  style={{
                    border: `1px solid ${active ? "var(--primary)" : "var(--line)"}`,
                    background: active ? "var(--primary)" : isToday ? "var(--primary-soft)" : "var(--surface)",
                    color: active ? "#fff" : "var(--ink)",
                    borderRadius: 11,
                    padding: "8px 4px",
                    cursor: "pointer",
                    transition: "all .15s",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: ".68rem", opacity: active ? 0.85 : 0.6 }}>{dayName(iso).replace("ال", "")}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.02rem" }}>{iso.slice(-2)}</div>
                  <div style={{ fontSize: ".64rem", opacity: active ? 0.9 : 0.55 }}>
                    {countFor(iso) ? `${countFor(iso)} موعد` : "—"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <Card>
          <CardHead
            icon={<CalendarDays size={17} style={{ color: "var(--primary)" }} />}
            title={`مواعيد ${relDay(date)}`}
            sub={`${dayAll.length} موعد — ${doneCount} مكتمل · ${waitingCount} في الانتظار`}
            action={<Badge tone="primary">{fmtMoney(revenue, db.settings.currency)}</Badge>}
          />
          <div className="card-bd" style={{ paddingTop: 8 }}>
            {dayAppts.length ? (
              <div className="col gap-8">
                {dayAppts.map((a) => {
                  const p = db.patients.find((x) => x.id === a.patientId);
                  if (!p) return null;
                  return (
                    <div
                      key={a.id}
                      className="soft-box"
                      style={{
                        padding: "11px 12px",
                        display: "flex",
                        alignItems: "center",
                        gap: 11,
                        flexWrap: "wrap",
                        borderInlineStart: `3px solid ${a.status === "completed" ? "var(--ok)" : a.status === "waiting" ? "var(--warn)" : a.status === "in-progress" ? "var(--primary)" : "var(--line-2)"}`,
                      }}
                    >
                      <div className="queue-time num" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
                        {to12h(a.time)}
                      </div>
                      <Avatar name={p.name} size="sm" />
                      <div className="grow" style={{ minWidth: 120 }}>
                        <div className="row gap-6 wrap">
                          <b style={{ fontSize: ".85rem" }}>{p.name}</b>
                          <span className="tiny muted">{p.code}</span>
                          {a.source === "online" ? (
                            <Badge tone="violet" style={{ fontSize: ".62rem", height: 19 }}>
                              <Globe size={10} /> أونلاين
                            </Badge>
                          ) : null}
                        </div>
                        <div className="tiny muted truncate" style={{ maxWidth: 320 }}>
                          {a.complaint ?? APPOINTMENT_TYPE_LABEL[a.type]} · {a.room} · {fmtMoney(a.fee, db.settings.currency)}
                        </div>
                      </div>
                      <Badge tone={STATUS_TONE[a.status]} dot>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>

                      <div className="row gap-4">
                        {a.status === "scheduled" ? (
                          <Button size="sm" variant="soft" onClick={() => updateStatus(a, "confirmed")}>
                            <Check size={13} /> تأكيد
                          </Button>
                        ) : null}
                        {a.status === "confirmed" ? (
                          <Button size="sm" variant="soft" onClick={() => updateStatus(a, "waiting")}>
                            <Clock size={13} /> وصول
                          </Button>
                        ) : null}
                        {a.status === "waiting" ? (
                          <Button size="sm" variant="primary" onClick={() => updateStatus(a, "in-progress")}>
                            <Play size={13} /> بدء
                          </Button>
                        ) : null}
                        {a.status === "in-progress" ? (
                          <Button size="sm" variant="ok" onClick={() => updateStatus(a, "completed")}>
                            <CheckCircle2 size={13} /> إنهاء
                          </Button>
                        ) : null}
                        <button
                          className="icon-btn"
                          style={{ width: 28, height: 28 }}
                          title="فتح ملف المريض"
                          onClick={() => navigate(`/patients/${p.id}`)}
                        >
                          <User size={14} />
                        </button>
                        {a.status !== "completed" ? (
                          <button
                            className="icon-btn"
                            style={{ width: 28, height: 28, color: "var(--danger)" }}
                            title="إلغاء الموعد"
                            onClick={() => updateStatus(a, "cancelled")}
                          >
                            <X size={14} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<CalendarDays size={24} />}
                title="لا مواعيد في هذا اليوم"
                desc="اختر يومًا آخر من الشريط أو أضف موعدًا جديدًا."
                action={<Button variant="primary" onClick={() => setFormOpen(true)}><Plus size={15} /> إضافة موعد</Button>}
              />
            )}
          </div>
        </Card>

        <div className="col gap-16">
          <Card>
            <CardHead title="ملخص اليوم" sub={fmtDate(date)} />
            <div className="card-bd">
              <div className="grid grid-2" style={{ gap: 9 }}>
                {[
                  { l: "إجمالي", v: dayAll.length, c: "var(--primary)", b: "var(--primary-soft)" },
                  { l: "منتظر", v: waitingCount, c: "var(--warn)", b: "var(--warn-soft)" },
                  { l: "مكتمل", v: doneCount, c: "var(--ok)", b: "var(--ok-soft)" },
                  { l: "أونلاين", v: dayAll.filter((a) => a.source === "online").length, c: "var(--violet)", b: "var(--violet-soft)" },
                ].map((x) => (
                  <div key={x.l} style={{ background: x.b, borderRadius: 10, padding: "9px 11px" }}>
                    <div className="tiny" style={{ color: x.c, fontWeight: 600 }}>{x.l}</div>
                    <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.25rem", color: x.c }}>{x.v}</div>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <div className="row-between small">
                <span className="muted">إيراد اليوم المتوقع</span>
                <b className="num">{fmtMoney(dayAll.reduce((s, a) => s + a.fee, 0), db.settings.currency)}</b>
              </div>
              <div className="row-between small mt-8">
                <span className="muted">إيراد محقق</span>
                <b className="num" style={{ color: "var(--ok)" }}>{fmtMoney(revenue, db.settings.currency)}</b>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead icon={<Stethoscope size={16} style={{ color: "var(--info)" }} />} title="روابط سريعة" />
            <div className="card-bd" style={{ paddingTop: 10 }}>
              <Button className="btn-block" onClick={() => navigate("/booking-requests")} style={{ justifyContent: "space-between" }}>
                <span className="row gap-6"><Globe size={14} /> طلبات الحجز الإلكتروني</span>
                <Badge tone="warn">{db.bookings.filter((b) => b.status === "pending").length}</Badge>
              </Button>
              <Button className="btn-block mt-8" onClick={() => navigate("/patients?new=1")} style={{ justifyContent: "space-between" }}>
                <span className="row gap-6"><UserPlus size={14} /> تسجيل مريض جديد</span>
                <ArrowLeft size={14} />
              </Button>
              <Button className="btn-block mt-8" onClick={() => navigate("/book")} style={{ justifyContent: "space-between" }}>
                <span className="row gap-6"><Globe size={14} /> صفحة الحجز العامة</span>
                <ArrowLeft size={14} />
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {formOpen ? (
        <AppointmentForm
          open={formOpen}
          onClose={closeForm}
          defaultDate={date}
          presetPatient={presetPatient}
          edit={editAppt}
        />
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------- form */
function AppointmentForm({
  open,
  onClose,
  defaultDate,
  presetPatient,
  edit,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
  presetPatient?: string;
  edit?: Appointment | null;
}) {
  const { db, save, toast } = useApp();
  const [patientId, setPatientId] = useState(edit?.patientId ?? presetPatient ?? "");
  const [date, setDate] = useState(edit?.date ?? defaultDate);
  const [time, setTime] = useState(edit?.time ?? "10:00");
  const [type, setType] = useState<AppointmentType>(edit?.type ?? "consultation");
  const [fee, setFee] = useState(String(edit?.fee ?? db.settings.consultationFee));
  const [complaint, setComplaint] = useState(edit?.complaint ?? "");
  const [notes, setNotes] = useState(edit?.notes ?? "");
  const [newPatient, setNewPatient] = useState(false);
  const [pName, setPName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pGender, setPGender] = useState<"male" | "female">("male");

  React.useEffect(() => {
    if (type === "followup" && !edit) setFee(String(db.settings.followUpFee));
    else if (type === "consultation" && !edit) setFee(String(db.settings.consultationFee));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const taken = db.appointments.filter((a) => a.date === date && a.id !== edit?.id).map((a) => a.time);

  const submit = () => {
    let pid = patientId;
    if (newPatient) {
      if (!pName.trim() || !pPhone.trim()) {
        toast("أدخل اسم وهاتف المريض الجديد", "err");
        return;
      }
      const np: Patient = {
        id: uid("pat"),
        code: genCode("PT", db.patients.length + 1),
        name: pName,
        phone: pPhone,
        gender: pGender,
        birthDate: "1990-01-01",
        allergies: [],
        chronic: [],
        tags: ["جديد"],
        createdAt: todayISO(),
      };
      save("patients", np);
      pid = np.id;
    }
    if (!pid) {
      toast("اختر المريض أولًا", "err");
      return;
    }
    if (taken.includes(time)) {
      toast("هذا التوقيت محجوز بالفعل — اختر وقتًا آخر", "err");
      return;
    }
    const rec: Appointment = {
      id: edit?.id ?? uid("apt"),
      patientId: pid,
      date,
      time,
      duration: 30,
      type,
      status: edit?.status ?? "scheduled",
      doctorId: "usr_doctor",
      room: "غرفة 1",
      fee: Number(fee) || 0,
      source: edit?.source ?? "clinic",
      complaint,
      notes,
      createdAt: edit?.createdAt ?? todayISO(),
    };
    save("appointments", rec);
    toast(edit ? "تم تحديث الموعد" : "تم حجز الموعد بنجاح");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? "تعديل الموعد" : "حجز موعد جديد"}
      sub={`${fmtDate(date)} · ${dayName(date)}`}
      icon={<CalendarPlus size={18} />}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={submit}>{edit ? "حفظ التعديلات" : "تأكيد الحجز"}</Button>
        </>
      }
    >
      <div className="row-between mb-12">
        <b className="small">بيانات المريض</b>
        <label className="switch">
          <input type="checkbox" checked={newPatient} onChange={(e) => setNewPatient(e.target.checked)} />
          <span className="track" />
          مريض جديد
        </label>
      </div>

      {newPatient ? (
        <div className="grid grid-3 gap-12 mb-16">
          <Field label="اسم المريض" required><input className="input" value={pName} onChange={(e) => setPName(e.target.value)} /></Field>
          <Field label="الهاتف" required><input className="input" value={pPhone} onChange={(e) => setPPhone(e.target.value)} dir="ltr" style={{ textAlign: "right" }} /></Field>
          <Field label="النوع">
            <select className="select" value={pGender} onChange={(e) => setPGender(e.target.value as any)}>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </Field>
        </div>
      ) : (
        <Field label="اختر المريض" required>
          <select className="select" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">— اختر من قائمة المرضى —</option>
            {db.patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.code}</option>
            ))}
          </select>
        </Field>
      )}

      <div className="divider" />

      <div className="grid grid-3 gap-12">
        <Field label="التاريخ" required><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="نوع الزيارة">
          <select className="select" value={type} onChange={(e) => setType(e.target.value as AppointmentType)}>
            {TYPES.map((t) => <option key={t} value={t}>{APPOINTMENT_TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label={`الرسوم (${db.settings.currency})`}>
          <input className="input num" value={fee} onChange={(e) => setFee(e.target.value)} dir="ltr" style={{ textAlign: "right" }} />
        </Field>
      </div>

      <div className="mt-12">
        <Field label="التوقيت" hint="الأوقات المشغولة تظهر باهتة">
          <div className="slot-grid" style={{ marginTop: 4, gridTemplateColumns: "repeat(auto-fill,minmax(74px,1fr))" }}>
            {slots().map((s) => {
              const busy = taken.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  className={`slot ${time === s ? "on" : ""} ${busy ? "off" : ""}`}
                  onClick={() => !busy && setTime(s)}
                  disabled={busy}
                >
                  {to12h(s)}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div className="grid grid-2 gap-12 mt-12">
        <Field label="سبب الزيارة / الشكوى">
          <input className="input" value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="مثال: ألم بالصدر عند المجهود" />
        </Field>
        <Field label="ملاحظات داخلية">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
