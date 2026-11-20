import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Info,
  Landmark,
  Phone,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  User,
  Wallet,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Badge, Button, Field } from "@/components/ui";
import type { Gender, Patient } from "@/lib/types";
import { addDays, fmtDate, fmtMoney, genCode, todayISO, to12h, uid } from "@/lib/utils";

const AR_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function serviceOptions() {
  return [] as { title: string; price?: number; desc: string }[];
}

export default function PublicBooking() {
  const { db, toast, cloud, getBookedSlots, submitPublicBooking } = useApp();
  const s = db.settings;
  const p = db.profile;

  const [step, setStep] = useState(1);
  const [serviceIdx, setServiceIdx] = useState(0);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [complaint, setComplaint] = useState("");
  const [method, setMethod] = useState<"instapay" | "vodafone-cash" | "bank-transfer" | "card">("instapay");
  const [ref, setRef] = useState("");
  const [receipt, setReceipt] = useState("");
  const [done, setDone] = useState<{ ref: string; date: string; time: string } | null>(null);
  const [cloudSlots, setCloudSlots] = useState<{ date: string; time: string }[]>([]);
  const [slotsError, setSlotsError] = useState(false);
  const [busy, setBusy] = useState(false);

  const services = p.services;
  const service = services[serviceIdx];

  useEffect(() => {
    if (!cloud.enabled) return;
    let alive = true;
    getBookedSlots(todayISO(), addDays(todayISO(), 13))
      .then((rows) => {
        if (alive) {
          setCloudSlots(rows);
          setSlotsError(false);
        }
      })
      .catch(() => {
        if (alive) setSlotsError(true);
      });
    return () => {
      alive = false;
    };
  }, [cloud.enabled, getBookedSlots]);

  const bookedSlots = useMemo(
    () =>
      cloud.enabled
        ? cloudSlots
        : db.appointments
            .filter((a) => a.status !== "cancelled")
            .map((a) => ({ date: a.date, time: a.time })),
    [cloud.enabled, cloudSlots, db.appointments]
  );

  const days = useMemo(() => {
    const out: { iso: string; open: boolean; label: string; day: string; count: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const iso = addDays(todayISO(), i);
      const d = new Date(iso);
      const dayName = AR_DAYS[d.getDay()];
      const wd = s.workingDays.find((w) => w.day === dayName);
      const count = bookedSlots.filter((a) => a.date === iso).length;
      out.push({ iso, open: !!wd?.open, label: String(d.getDate()), day: dayName.replace("ال", ""), count });
    }
    return out;
  }, [bookedSlots, s.workingDays]);

  const slots = useMemo(() => {
    if (!date) return [];
    const wd = s.workingDays.find((w) => w.day === AR_DAYS[new Date(date).getDay()]);
    if (!wd?.open) return [];
    const [fh, fm] = wd.from.split(":").map(Number);
    const [th] = wd.to.split(":").map(Number);
    const out: { time: string; taken: boolean }[] = [];
    let h = fh;
    let m = fm;
    while (h < th) {
      const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const taken = bookedSlots.some((a) => a.date === date && a.time === t);
      const past = date === todayISO() && t <= new Date().toTimeString().slice(0, 5);
      out.push({ time: t, taken: taken || past });
      m += 30;
      if (m >= 60) {
        m = 0;
        h += 1;
      }
    }
    return out;
  }, [bookedSlots, date, s.workingDays]);

  const deposit = s.requirePayment ? s.depositAmount : 0;

  const canNext = () => {
    if (step === 1) return !!date && !!time && !!service;
    if (step === 2) return name.trim().length > 2 && phone.trim().length >= 10;
    if (step === 3) return !s.requirePayment || ref.trim().length >= 5;
    return true;
  };

  const next = () => {
    if (!canNext()) {
      toast(
        step === 1 ? "اختر اليوم والتوقيت أولًا" : step === 2 ? "أدخل اسمك ورقم هاتف صحيح" : "أدخل رقم عملية الدفع",
        "err"
      );
      return;
    }
    setStep((x) => Math.min(4, x + 1));
  };

  const submit = async () => {
    if (busy) return;
    const bookingRef = `BK-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const booking = {
      id: uid("bk"),
      ref: bookingRef,
      patientName: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      gender,
      service: service.title,
      preferredDate: date,
      preferredTime: time,
      complaint: complaint.trim(),
      paymentMethod: method,
      paymentRef: ref.trim() || "بدون دفع",
      paymentAmount: deposit,
      receiptName: receipt || undefined,
      status: "pending",
      createdAt: todayISO(),
    };
    setBusy(true);
    try {
      await submitPublicBooking(booking);
      if (cloud.enabled) setCloudSlots((prev) => [...prev, { date, time }]);
      setDone({ ref: bookingRef, date, time });
      setStep(4);
      toast("تم إرسال طلب الحجز بنجاح");
    } catch (err) {
      toast(err instanceof Error ? err.message : "تعذر إرسال طلب الحجز. حاول مرة أخرى.", "err");
    } finally {
      setBusy(false);
    }
  };

  const resetAll = () => {
    setDone(null);
    setStep(1);
    setServiceIdx(0);
    setDate("");
    setTime("");
    setName("");
    setPhone("");
    setEmail("");
    setComplaint("");
    setRef("");
    setReceipt("");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", backgroundImage: "var(--bg-grad)" }}>
      <nav className="public-nav">
        <Link to="/doctor" className="row gap-8" style={{ color: "inherit" }}>
          <div className="brand-mark" style={{ width: 36, height: 36, borderRadius: 11 }}>
            <Stethoscope size={19} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: ".95rem", lineHeight: 1.1 }}>{s.clinicName}</div>
            <div className="tiny muted">{p.specialty}</div>
          </div>
        </Link>
        <div className="row gap-8">
          <Link to="/doctor" className="btn btn-ghost btn-sm hide-sm">الملف التعريفي</Link>
          <a href={`tel:${s.phone}`} className="btn btn-sm"><Phone size={14} /> اتصل بنا</a>
        </div>
      </nav>

      <div className="public-wrap" style={{ paddingBlock: 28 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div className="center" style={{ marginBottom: 22 }}>
            <div className="eyebrow"><CalendarCheck size={12} /> حجز إلكتروني آمن</div>
            <h1 style={{ fontSize: "1.7rem", marginTop: 10 }}>احجز موعدك في دقيقة</h1>
            <p className="muted small" style={{ marginTop: 4 }}>
              اختر الخدمة والوقت المناسب، وسيتواصل معك فريق العيادة لتأكيد الحجز.
            </p>
          </div>

          {!done ? (
            <>
              <div className="booking-steps">
                {[
                  { n: 1, t: "الخدمة والموعد" },
                  { n: 2, t: "بياناتك" },
                  { n: 3, t: "تأكيد الدفع" },
                  { n: 4, t: "التأكيد" },
                ].map((x, i) => (
                  <React.Fragment key={x.n}>
                    {i > 0 ? <div className="bstep-line" /> : null}
                    <div className={`bstep ${step === x.n ? "on" : ""} ${step > x.n ? "done" : ""}`} style={{ flex: "0 0 auto" }}>
                      <div className="n">{step > x.n ? <Check size={13} /> : x.n}</div>
                      <div className="t">{x.t}</div>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", alignItems: "start" }}>
                <div className="card card-pad">
                  {step === 1 ? (
                    <div>
                      <h3 style={{ fontSize: "1rem" }}>١. اختر الخدمة</h3>
                      <p className="tiny muted" style={{ marginTop: 3, marginBottom: 12 }}>كل خدمة لها مدة ورسوم محددة.</p>
                      <div className="col gap-8">
                        {services.map((sv, i) => (
                          <button
                            key={sv.title}
                            onClick={() => setServiceIdx(i)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              textAlign: "start",
                              padding: "10px 12px",
                              borderRadius: 11,
                              border: `1.5px solid ${serviceIdx === i ? "var(--primary)" : "var(--line)"}`,
                              background: serviceIdx === i ? "var(--primary-soft)" : "var(--surface)",
                              cursor: "pointer",
                            }}
                          >
                            <div
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                border: `2px solid ${serviceIdx === i ? "var(--primary)" : "var(--line-2)"}`,
                                background: serviceIdx === i ? "var(--primary)" : "transparent",
                                display: "grid",
                                placeItems: "center",
                                flex: "0 0 auto",
                              }}
                            >
                              {serviceIdx === i ? <Check size={12} style={{ color: "#fff" }} /> : null}
                            </div>
                            <div className="grow">
                              <div className="strong small">{sv.title}</div>
                              <div className="tiny muted" style={{ lineHeight: 1.6 }}>{sv.desc}</div>
                            </div>
                            {sv.price ? <Badge tone="primary">{sv.price} {s.currency}</Badge> : null}
                          </button>
                        ))}
                      </div>

                      <div className="divider" />
                      <h3 style={{ fontSize: "1rem" }}>٢. اختر اليوم</h3>
                      <p className="tiny muted" style={{ marginTop: 3, marginBottom: 12 }}>الأيام المغلقة لا تظهر للحجز.</p>
                      {cloud.enabled && slotsError ? (
                        <div className="alert alert-warn" style={{ marginBottom: 12 }}>
                          <Info size={15} />
                          <span>تعذر تحميل الأوقات المحجوزة الآن. يمكنك إرسال الطلب وسيراجعه فريق العيادة قبل التأكيد.</span>
                        </div>
                      ) : null}
                      <div className="row gap-6" style={{ overflowX: "auto", paddingBottom: 6 }}>
                        {days.map((d) => (
                          <button
                            key={d.iso}
                            disabled={!d.open}
                            onClick={() => { setDate(d.iso); setTime(""); }}
                            style={{
                              minWidth: 64,
                              padding: "8px 6px",
                              borderRadius: 10,
                              border: `1.5px solid ${date === d.iso ? "var(--primary)" : "var(--line)"}`,
                              background: date === d.iso ? "var(--primary)" : d.open ? "var(--surface)" : "var(--surface-3)",
                              color: date === d.iso ? "#fff" : d.open ? "var(--ink)" : "var(--ink-3)",
                              opacity: d.open ? 1 : 0.55,
                              cursor: d.open ? "pointer" : "not-allowed",
                              textAlign: "center",
                            }}
                          >
                            <div style={{ fontSize: ".66rem", opacity: 0.75 }}>{d.day}</div>
                            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.1rem", lineHeight: 1.2 }}>{d.label}</div>
                            <div style={{ fontSize: ".58rem", opacity: 0.7 }}>{d.open ? `${d.count} محجوز` : "مغلق"}</div>
                          </button>
                        ))}
                      </div>

                      {date ? (
                        <>
                          <div className="divider" />
                          <h3 style={{ fontSize: "1rem" }}>٣. اختر التوقيت</h3>
                          <div className="slot-grid mt-8">
                            {slots.map((sl) => (
                              <button
                                key={sl.time}
                                disabled={sl.taken}
                                className={`slot ${time === sl.time ? "on" : ""} ${sl.taken ? "off" : ""}`}
                                onClick={() => setTime(sl.time)}
                              >
                                {to12h(sl.time)}
                              </button>
                            ))}
                          </div>
                          {!slots.length ? <div className="alert alert-warn mt-12"><Info size={15} /> لا توجد أوقات متاحة في هذا اليوم.</div> : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div>
                      <h3 style={{ fontSize: "1rem" }}>بياناتك الشخصية</h3>
                      <p className="tiny muted" style={{ marginTop: 3, marginBottom: 14 }}>نحتاجها للتواصل معك وتجهيز ملفك الطبي.</p>
                      <div className="grid grid-2 gap-12">
                        <Field label="الاسم بالكامل" required>
                          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: أحمد محمود" />
                        </Field>
                        <Field label="رقم الهاتف" required>
                          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" dir="ltr" style={{ textAlign: "right" }} />
                        </Field>
                        <Field label="البريد الإلكتروني">
                          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" dir="ltr" style={{ textAlign: "right" }} />
                        </Field>
                        <Field label="النوع">
                          <select className="select" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                            <option value="male">ذكر</option>
                            <option value="female">أنثى</option>
                          </select>
                        </Field>
                      </div>
                      <div className="mt-12">
                        <Field label="سبب الزيارة / الشكوى" hint="كلما كانت التفاصيل أوضح، كان استعداد الطبيب أفضل">
                          <textarea className="textarea" value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="اشرح باختصار ما تشعر به..." />
                        </Field>
                      </div>
                      <div className="alert alert-info mt-12">
                        <ShieldCheck size={15} />
                        <span>بياناتك محفوظة بسرية تامة ولا تُشارك مع أي طرف خارج العيادة.</span>
                      </div>
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div>
                      <h3 style={{ fontSize: "1rem" }}>تأكيد الحجز بالدفع</h3>
                      <p className="tiny muted" style={{ marginTop: 3, marginBottom: 14 }}>
                        {s.requirePayment
                          ? `لضمان جدية الحجز، يُرجى تحويل العربون ثم إدخال رقم العملية.`
                          : "الدفع اختياري — يمكنك الدفع في العيادة."}
                      </p>

                      <div className="soft-box mb-12">
                        <div className="row-between">
                          <span className="small muted">المبلغ المطلوب</span>
                          <b style={{ color: "var(--primary)", fontSize: "1.1rem" }}>{fmtMoney(deposit, s.currency)}</b>
                        </div>
                        <div className="tiny muted" style={{ marginTop: 3 }}>يُحسب ضمن قيمة الخدمة عند الزيارة.</div>
                      </div>

                      <div className="col gap-8">
                        {[
                          { k: "instapay" as const, t: "إنستاباي", d: s.instapayHandle, i: Smartphone },
                          { k: "vodafone-cash" as const, t: "فودافون كاش", d: s.vodafoneCash, i: Wallet },
                          { k: "bank-transfer" as const, t: "تحويل بنكي", d: s.bankAccount, i: Landmark },
                          { k: "card" as const, t: "بطاقة بنكية", d: "الدفع عند الزيارة أو عبر رابط آمن", i: CreditCard },
                        ].map((m) => (
                          <button
                            key={m.k}
                            onClick={() => setMethod(m.k)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "9px 12px",
                              borderRadius: 11,
                              border: `1.5px solid ${method === m.k ? "var(--primary)" : "var(--line)"}`,
                              background: method === m.k ? "var(--primary-soft)" : "var(--surface)",
                              cursor: "pointer",
                              textAlign: "start",
                            }}
                          >
                            <m.i size={18} style={{ color: method === m.k ? "var(--primary)" : "var(--ink-3)" }} />
                            <div className="grow">
                              <div className="small strong">{m.t}</div>
                              <div className="tiny muted mono" dir="ltr" style={{ textAlign: "right" }}>{m.d}</div>
                            </div>
                            {method === m.k ? <BadgeCheck size={17} style={{ color: "var(--primary)" }} /> : null}
                          </button>
                        ))}
                      </div>

                      {s.requirePayment ? (
                        <>
                          <div className="grid grid-2 gap-12 mt-12">
                            <Field label="رقم عملية الدفع" required hint="الرقم الظاهر في إشعار التحويل">
                              <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="TRX123456789" dir="ltr" style={{ textAlign: "right" }} />
                            </Field>
                            <Field label="اسم ملف الإيصال (اختياري)">
                              <input className="input" value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="receipt.jpg" dir="ltr" style={{ textAlign: "right" }} />
                            </Field>
                          </div>
                          <div style={{
                            marginTop: 12,
                            border: "1.5px dashed var(--line-2)",
                            borderRadius: 11,
                            padding: "16px 12px",
                            textAlign: "center",
                            color: "var(--ink-3)",
                            background: "var(--surface-2)",
                          }}>
                            <Banknote size={20} style={{ marginBottom: 4 }} />
                            <div className="tiny">ارفع صورة الإيصال (اختياري) — يمكنك إرسالها واتساب بعد الحجز</div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="row-between mt-20" style={{ flexWrap: "wrap", gap: 8 }}>
                    <Button onClick={() => setStep((x) => Math.max(1, x - 1))} disabled={step === 1}>
                      <ArrowRight size={15} /> السابق
                    </Button>
                    {step < 3 ? (
                      <Button variant="primary" onClick={next}>
                        التالي <ArrowLeft size={15} />
                      </Button>
                    ) : (
                      <Button variant="primary" onClick={submit} disabled={busy}>
                        <CheckCircle2 size={16} /> {busy ? "جارٍ الإرسال…" : "تأكيد طلب الحجز"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* summary */}
                <div className="card card-pad" style={{ position: "sticky", top: 82 }}>
                  <b className="small">ملخص الحجز</b>
                  <div className="divider" style={{ margin: "10px 0" }} />
                  <div className="row gap-8 mb-12">
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                      <Stethoscope size={18} />
                    </div>
                    <div>
                      <div className="small strong">{service?.title}</div>
                      <div className="tiny muted">{p.name}</div>
                    </div>
                  </div>
                  <div className="row-between small" style={{ padding: "6px 0" }}>
                    <span className="muted row gap-4"><CalendarDays size={12} /> التاريخ</span>
                    <span className="strong">{date ? fmtDate(date) : "—"}</span>
                  </div>
                  <div className="row-between small" style={{ padding: "6px 0" }}>
                    <span className="muted row gap-4"><Clock size={12} /> التوقيت</span>
                    <span className="strong">{time ? to12h(time) : "—"}</span>
                  </div>
                  <div className="row-between small" style={{ padding: "6px 0" }}>
                    <span className="muted row gap-4"><User size={12} /> المريض</span>
                    <span className="strong truncate" style={{ maxWidth: 140 }}>{name || "—"}</span>
                  </div>
                  <div className="divider" style={{ margin: "10px 0" }} />
                  <div className="row-between">
                    <span className="small muted">العربون</span>
                    <b style={{ color: "var(--primary)" }}>{fmtMoney(deposit, s.currency)}</b>
                  </div>
                  <div className="row-between tiny muted mt-8">
                    <span>سعر الخدمة</span>
                    <span>{service?.price ? fmtMoney(service.price, s.currency) : "حسب الزيارة"}</span>
                  </div>
                  <div className="alert alert-ok mt-12" style={{ fontSize: ".72rem" }}>
                    <BadgeCheck size={14} />
                    <span>تأكيد فوري بعد مراجعة الدفع</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ maxWidth: 620, margin: "0 auto", overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(120deg,#0a5f5a,#0d7c74,#12a79a)", color: "#fff", padding: "26px 24px", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,.18)", display: "grid", placeItems: "center", margin: "0 auto 10px", border: "1px solid rgba(255,255,255,.3)" }}>
                  <CheckCircle2 size={28} />
                </div>
                <h2 style={{ fontSize: "1.25rem" }}>تم استلام طلب حجزك</h2>
                <p style={{ color: "rgba(255,255,255,.85)", fontSize: ".82rem", marginTop: 4 }}>
                  سنراجع الدفعة ونؤكد الموعد في أقرب وقت. احتفظ برقم الطلب.
                </p>
              </div>
              <div className="card-pad">
                <div className="soft-box center" style={{ padding: 16 }}>
                  <div className="tiny muted">رقم طلب الحجز</div>
                  <div className="mono" style={{ fontSize: "1.3rem", fontWeight: 800, letterSpacing: ".02em", color: "var(--primary)" }}>{done.ref}</div>
                </div>
                <div className="row-between small mt-12"><span className="muted">الخدمة</span><b>{service?.title}</b></div>
                <div className="row-between small mt-8"><span className="muted">الموعد المطلوب</span><b>{fmtDate(done.date)} — {to12h(done.time)}</b></div>
                <div className="row-between small mt-8"><span className="muted">الحالة</span><Badge tone="warn" dot>بانتظار التحقق من الدفع</Badge></div>
                <div className="alert alert-info mt-16">
                  <Info size={15} />
                  <span>لو احتجت تعديل الموعد، تواصل معنا على {s.phone} مع ذكر رقم الطلب.</span>
                </div>
                <div className="row gap-8 mt-16">
                  <Button variant="primary" className="grow" onClick={resetAll}>حجز آخر</Button>
                  <Link to="/doctor" className="btn btn-block grow">الملف التعريفي</Link>
                </div>
              </div>
            </div>
          )}

          <div className="center tiny muted" style={{ marginTop: 22 }}>
            <Link to="/" style={{ color: "var(--primary)" }}>دخول فريق العيادة</Link>
            <span style={{ margin: "0 6px" }}>·</span>
            <span>{s.clinicName} — {s.address}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
