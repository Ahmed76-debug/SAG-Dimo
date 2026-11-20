import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  FileImage,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHead, Tabs } from "@/components/ui";
import { BOOKING_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/types";
import type { Appointment, BookingRequest, Patient } from "@/lib/types";
import { fmtDate, fmtMoney, genCode, relDay, to12h, todayISO, uid } from "@/lib/utils";

const TONE: Record<string, "warn" | "ok" | "primary" | "danger"> = {
  pending: "warn",
  verified: "ok",
  converted: "primary",
  rejected: "danger",
};

export default function BookingRequests() {
  const { db, save, toast } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"all" | "pending" | "verified" | "converted" | "rejected">("pending");
  const [q, setQ] = useState("");
  const [approve, setApprove] = useState<BookingRequest | null>(null);
  const [reject, setReject] = useState<BookingRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const list = useMemo(() => {
    return db.bookings
      .filter((b) => (tab === "all" ? true : b.status === tab))
      .filter((b) => !q.trim() || b.patientName.includes(q) || b.phone.includes(q) || b.ref.includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db.bookings, tab, q]);

  const counts = {
    pending: db.bookings.filter((b) => b.status === "pending").length,
    verified: db.bookings.filter((b) => b.status === "verified").length,
    converted: db.bookings.filter((b) => b.status === "converted").length,
    rejected: db.bookings.filter((b) => b.status === "rejected").length,
  };
  const deposits = db.bookings.filter((b) => b.status !== "rejected").reduce((s, b) => s + b.paymentAmount, 0);

  const doReject = () => {
    if (!reject) return;
    save("bookings", { ...reject, status: "rejected", reviewNote: rejectNote || "مرفوض من إدارة العيادة" });
    toast("تم رفض طلب الحجز", "err");
    setReject(null);
    setRejectNote("");
  };

  return (
    <>
      <PageHead
        title="طلبات الحجز الإلكتروني"
        sub="راجع الدفعات المقدمة ثم حوّل الطلب إلى موعد مؤكد"
        actions={
          <>
            <Button onClick={() => navigate("/book")}>
              <CalendarCheck size={15} /> صفحة الحجز العامة
            </Button>
            <Button variant="primary" onClick={() => navigate("/appointments?new=1")}>
              <UserPlus size={15} /> حجز يدوي
            </Button>
          </>
        }
      />

      <div className="grid grid-4 mb-16">
        {[
          { l: "بانتظار التحقق", v: counts.pending, c: "var(--warn)", b: "var(--warn-soft)", i: <Clock size={18} /> },
          { l: "تم التحقق", v: counts.verified, c: "var(--ok)", b: "var(--ok-soft)", i: <BadgeCheck size={18} /> },
          { l: "تحولت لمواعيد", v: counts.converted, c: "var(--primary)", b: "var(--primary-soft)", i: <CalendarCheck size={18} /> },
          { l: "إجمالي الدفعات", v: Math.round(deposits), c: "var(--info)", b: "var(--info-soft)", i: <Wallet size={18} /> },
        ].map((s) => (
          <div className="stat" key={s.l} style={{ "--stat-tint": s.b, "--stat-color": s.c } as React.CSSProperties}>
            <div className="row gap-8">
              <div className="stat-ico" style={{ width: 33, height: 33, borderRadius: 9 }}>{s.i}</div>
              <div>
                <div className="stat-label" style={{ marginTop: 0 }}>{s.l}</div>
                <div className="stat-value num" style={{ fontSize: "1.28rem" }}>
                  {s.v}
                  {s.l.includes("الدفعات") ? <small>{db.settings.currency}</small> : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <div className="toolbar">
          <Tabs
            tabs={[
              { key: "pending", label: "بانتظار التحقق", count: counts.pending },
              { key: "verified", label: "تم التحقق", count: counts.verified },
              { key: "converted", label: "محولة", count: counts.converted },
              { key: "rejected", label: "مرفوضة", count: counts.rejected },
              { key: "all", label: "الكل", count: db.bookings.length },
            ]}
            value={tab}
            onChange={(v) => setTab(v as any)}
          />
          <div className="spacer" />
          <div className="searchbar" style={{ maxWidth: 240, flex: "1 1 160px" }}>
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو رقم الطلب…" />
          </div>
        </div>

        <div className="card-bd">
          {list.length ? (
            <div className="grid grid-2">
              {list.map((b) => (
                <div key={b.id} className="soft-box" style={{ padding: 15, background: "var(--surface)" }}>
                  <div className="row-between mb-8">
                    <div className="row gap-8">
                      <Avatar name={b.patientName} />
                      <div>
                        <div className="strong" style={{ fontSize: ".88rem" }}>{b.patientName}</div>
                        <div className="tiny muted">{b.ref} · {relDay(b.createdAt)}</div>
                      </div>
                    </div>
                    <Badge tone={TONE[b.status]} dot>{BOOKING_STATUS_LABEL[b.status]}</Badge>
                  </div>

                  <div className="row gap-6 wrap mb-8">
                    <Badge tone="primary">{b.service}</Badge>
                    <Badge tone="line"><CalendarDays size={11} /> {fmtDate(b.preferredDate)}</Badge>
                    <Badge tone="line"><Clock size={11} /> {to12h(b.preferredTime)}</Badge>
                  </div>

                  {b.complaint ? <p className="tiny ink-2" style={{ lineHeight: 1.7, marginBottom: 9 }}>{b.complaint}</p> : null}

                  <div className="row gap-12 wrap tiny muted" style={{ marginBottom: 9 }}>
                    <span className="row gap-4" dir="ltr"><Phone size={12} /> {b.phone}</span>
                    {b.email ? <span className="row gap-4" dir="ltr"><Mail size={12} /> {b.email}</span> : null}
                  </div>

                  <div
                    style={{
                      background: "var(--surface-2)",
                      border: "1px dashed var(--line-2)",
                      borderRadius: 10,
                      padding: "9px 11px",
                    }}
                  >
                    <div className="row-between">
                      <span className="tiny muted row gap-4"><CreditCard size={12} /> {PAYMENT_METHOD_LABEL[b.paymentMethod]}</span>
                      <b className="num small">{fmtMoney(b.paymentAmount, db.settings.currency)}</b>
                    </div>
                    <div className="row-between mt-4">
                      <span className="tiny muted">رقم العملية</span>
                      <span className="tiny mono">{b.paymentRef}</span>
                    </div>
                    {b.receiptName ? (
                      <div className="row gap-6 tiny" style={{ marginTop: 5, color: "var(--info)" }}>
                        <FileImage size={12} /> {b.receiptName} — إيصال مرفق
                      </div>
                    ) : null}
                  </div>

                  {b.reviewNote ? (
                    <div className="tiny mt-8" style={{ color: "var(--danger)" }}>
                      <AlertTriangle size={12} /> {b.reviewNote}
                    </div>
                  ) : null}

                  {b.status === "pending" || b.status === "verified" ? (
                    <div className="row gap-6 mt-12">
                      <Button size="sm" variant="primary" className="grow" onClick={() => setApprove(b)}>
                        <Check size={14} /> تحقق وحوّل لموعد
                      </Button>
                      <Button size="sm" variant="danger-soft" onClick={() => setReject(b)}>
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="row gap-6 mt-12">
                      <Button
                        size="sm"
                        className="grow"
                        onClick={() => {
                          const p = db.patients.find((x) => x.name === b.patientName);
                          if (p) navigate(`/patients/${p.id}`);
                          else toast("لم يتم ربط هذا الطلب بملف مريض", "info");
                        }}
                      >
                        فتح ملف المريض <ArrowLeft size={13} />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ShieldCheck size={26} />}
              title="لا طلبات في هذا القسم"
              desc="ستظهر هنا طلبات الحجز القادمة من الصفحة العامة للعيادة."
            />
          )}
        </div>
      </Card>

      {approve ? (
        <ApproveModal
          booking={approve}
          onClose={() => setApprove(null)}
          onDone={() => {
            setApprove(null);
            setTab("converted");
          }}
        />
      ) : null}

      {reject ? (
        <Modal
          open
          onClose={() => setReject(null)}
          title="رفض طلب الحجز"
          sub={`${reject.patientName} · ${reject.ref}`}
          icon={<X size={18} />}
          size="sm"
          footer={
            <>
              <Button onClick={() => setReject(null)}>تراجع</Button>
              <Button variant="danger" onClick={doReject}>تأكيد الرفض</Button>
            </>
          }
        >
          <Field label="سبب الرفض" hint="سيُحفظ في سجل الطلب للرجوع إليه">
            <textarea
              className="textarea"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="مثال: لم يتم العثور على إيصال الدفع أو رقم العملية غير صحيح."
            />
          </Field>
        </Modal>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- approve */
function ApproveModal({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const { db, save, toast } = useApp();
  const [date, setDate] = useState(booking.preferredDate);
  const [time, setTime] = useState(booking.preferredTime);
  const [fee, setFee] = useState(String(db.settings.consultationFee));
  const [linkId, setLinkId] = useState(() => {
    const match = db.patients.find((p) => p.phone === booking.phone);
    return match?.id ?? "";
  });
  const [createNew, setCreateNew] = useState(!db.patients.some((p) => p.phone === booking.phone));

  const submit = () => {
    let pid = linkId;
    if (createNew || !pid) {
      const existing = db.patients.find((p) => p.phone === booking.phone);
      if (existing) pid = existing.id;
      else {
        const np: Patient = {
          id: uid("pat"),
          code: genCode("PT", db.patients.length + 1),
          name: booking.patientName,
          phone: booking.phone,
          gender: booking.gender,
          birthDate: "1990-01-01",
          allergies: [],
          chronic: [],
          tags: ["أونلاين", "جديد"],
          notes: `حجز إلكتروني ${booking.ref} — دفع ${PAYMENT_METHOD_LABEL[booking.paymentMethod]}`,
          createdAt: todayISO(),
        };
        save("patients", np);
        pid = np.id;
      }
    }
    const appt: Appointment = {
      id: uid("apt"),
      patientId: pid,
      date,
      time,
      duration: 30,
      type: "consultation",
      status: "confirmed",
      doctorId: "usr_doctor",
      room: "غرفة 1",
      fee: Number(fee) || 0,
      source: "online",
      complaint: booking.complaint,
      notes: `تحقق دفع ${fmtMoney(booking.paymentAmount, db.settings.currency)} — ${booking.paymentRef}`,
      createdAt: todayISO(),
    };
    save("appointments", appt);
    save("bookings", {
      ...booking,
      status: "converted",
      appointmentId: appt.id,
      patientId: pid,
      reviewNote: "تم التحقق من الدفع وتحويل الطلب إلى موعد مؤكد.",
    });
    toast("تم التحقق من الدفع وإضافة الموعد للجدول");
    onDone();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="تحقق من الدفع وتحويل الطلب"
      sub={`${booking.patientName} · ${booking.ref}`}
      icon={<CheckCircle2 size={18} />}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={submit}>
            <Check size={15} /> تأكيد وتحويل لموعد
          </Button>
        </>
      }
    >
      <div className="alert alert-ok mb-16">
        <BadgeCheck size={17} />
        <div>
          <strong>الدفعة المقدمة:</strong> {fmtMoney(booking.paymentAmount, db.settings.currency)} عبر{" "}
          {PAYMENT_METHOD_LABEL[booking.paymentMethod]} — رقم العملية <span className="mono">{booking.paymentRef}</span>
        </div>
      </div>

      <div className="grid grid-3 gap-12">
        <Field label="تاريخ الموعد" required>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="التوقيت" required>
          <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label={`الرسوم (${db.settings.currency})`}>
          <input className="input num" value={fee} onChange={(e) => setFee(e.target.value)} dir="ltr" style={{ textAlign: "right" }} />
        </Field>
      </div>

      <div className="divider" />

      <div className="row-between mb-12">
        <b className="small">ملف المريض</b>
        <label className="switch">
          <input type="checkbox" checked={createNew} onChange={(e) => setCreateNew(e.target.checked)} />
          <span className="track" />
          إنشاء ملف جديد
        </label>
      </div>

      {!createNew ? (
        <Field label="ربط بملف مريض موجود">
          <select className="select" value={linkId} onChange={(e) => setLinkId(e.target.value)}>
            <option value="">— اختر ملفًا —</option>
            {db.patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.code} — {p.phone}</option>
            ))}
          </select>
        </Field>
      ) : (
        <div className="soft-box small">
          سيتم إنشاء ملف جديد باسم <b>{booking.patientName}</b> ورقم هاتف <span dir="ltr" className="mono">{booking.phone}</span>.
        </div>
      )}
    </Modal>
  );
}
