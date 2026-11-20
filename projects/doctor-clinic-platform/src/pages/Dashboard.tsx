import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Play,
  Plus,
  Receipt,
  Stethoscope,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Avatar, Badge, Button, Card, CardHead, EmptyState, PageHead, Progress, StatCard } from "@/components/ui";
import { BarChart, Donut, Legend } from "@/components/charts";
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_TYPE_LABEL,
} from "@/lib/types";
import type { Appointment } from "@/lib/types";
import {
  ageFrom,
  addDays,
  dayName,
  fmtDate,
  fmtMoney,
  fmtNum,
  greeting,
  invoiceTotals,
  nowTime,
  relDay,
  to12h,
  todayISO,
} from "@/lib/utils";

const STATUS_TONE: Record<string, "default" | "ok" | "warn" | "info" | "primary" | "danger" | "violet"> = {
  completed: "ok",
  waiting: "warn",
  confirmed: "info",
  scheduled: "default",
  "in-progress": "primary",
  cancelled: "danger",
  "no-show": "danger",
};

export default function Dashboard() {
  const { db, session, save, toast } = useApp();
  const navigate = useNavigate();
  const today = todayISO();
  const now = nowTime();

  const todayAppts = useMemo(
    () => db.appointments.filter((a) => a.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [db.appointments, today]
  );

  const waiting = todayAppts.filter((a) => a.status === "waiting");
  const completed = todayAppts.filter((a) => a.status === "completed");
  const pendingBookings = db.bookings.filter((b) => b.status === "pending");
  const unpaidInvoices = db.invoices.filter((i) => i.status !== "paid");

  const monthStart = today.slice(0, 8) + "01";
  const monthInvoices = db.invoices.filter((i) => i.date >= monthStart);
  const monthRevenue = monthInvoices.reduce(
    (sum, inv) => sum + invoiceTotals(inv.items, inv.discount, inv.taxRate).total,
    0
  );
  const collected = monthInvoices.reduce((s, i) => s + i.paid, 0);

  const next = todayAppts.find(
    (a) => a.time >= now && a.status !== "completed" && a.status !== "cancelled" && a.status !== "in-progress"
  );
  const nextPatient = next ? db.patients.find((p) => p.id === next.patientId) : undefined;

  const week = useMemo(() => {
    const days: { label: string; value: number; alt?: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const iso = addDays(today, -i);
      const total = db.invoices
        .filter((inv) => inv.date === iso)
        .reduce((s, inv) => s + invoiceTotals(inv.items, inv.discount, inv.taxRate).total, 0);
      days.push({ label: dayName(iso).replace("ال", "").slice(0, 3), value: Math.round(total) });
    }
    return days;
  }, [db.invoices, today]);

  const typeSegments = useMemo(() => {
    const map: Record<string, number> = {};
    todayAppts.forEach((a) => {
      map[a.type] = (map[a.type] ?? 0) + 1;
    });
    const colors = ["#0d7c74", "#12a79a", "#5b8def", "#c9a227", "#9b7bf0"];
    return Object.entries(map).map(([k, v], i) => ({
      label: APPOINTMENT_TYPE_LABEL[k as keyof typeof APPOINTMENT_TYPE_LABEL] ?? k,
      value: v,
      color: colors[i % colors.length],
    }));
  }, [todayAppts]);

  const followUps = useMemo(() => {
    const due = db.visits
      .filter((v) => v.followUpDate && v.followUpDate <= addDays(today, 7))
      .sort((a, b) => (a.followUpDate ?? "").localeCompare(b.followUpDate ?? ""))
      .slice(0, 4);
    return due.map((v) => ({ visit: v, patient: db.patients.find((p) => p.id === v.patientId) }));
  }, [db.visits, db.patients, today]);

  const recentRx = useMemo(
    () =>
      [...db.prescriptions]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4)
        .map((rx) => ({ rx, patient: db.patients.find((p) => p.id === rx.patientId) })),
    [db.prescriptions, db.patients]
  );

  const startVisit = (a: Appointment) => {
    save("appointments", { ...a, status: "in-progress" });
    toast("تم بدء الكشف — بالتوفيق دكتور");
  };

  const done = todayAppts.length ? Math.round((completed.length / todayAppts.length) * 100) : 0;

  return (
    <>
      <PageHead
        title={`${greeting()}، ${session?.name?.replace("د. ", "د. ") ?? "دكتور"}`}
        sub={`${dayName(today)} · ${fmtDate(today)} — إليك ملخص عيادتك اليوم`}
        actions={
          <>
            <Button onClick={() => navigate("/booking-requests")}>
              <CalendarCheck size={16} />
              طلبات الحجز
              {pendingBookings.length ? (
                <span className="badge badge-danger" style={{ height: 18, padding: "0 6px", fontSize: ".65rem" }}>
                  {pendingBookings.length}
                </span>
              ) : null}
            </Button>
            <Button variant="primary" onClick={() => navigate("/appointments?new=1")}>
              <Plus size={16} /> حجز موعد جديد
            </Button>
          </>
        }
      />

      {/* hero */}
      <div className="hero">
        <div>
          <div className="hero-pill">
            <Activity size={13} /> العيادة مفتوحة الآن
          </div>
          <h1 style={{ marginTop: 10 }}>
            {todayAppts.length - completed.length} موعد متبقٍ اليوم
          </h1>
          <p>
            أنجزت <b>{completed.length}</b> من <b>{todayAppts.length}</b> موعدًا حتى الآن —{" "}
            {waiting.length ? `و${waiting.length} مريض في الانتظار.` : "لا يوجد انتظار حاليًا."}
          </p>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button size="sm" variant="primary" onClick={() => navigate("/appointments")} style={{ background: "rgba(255,255,255,.2)", boxShadow: "none", border: "1px solid rgba(255,255,255,.25)" }}>
              <CalendarDays size={14} /> فتح جدول اليوم
            </Button>
            <Button size="sm" onClick={() => navigate("/patients?new=1")} style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.3)" }}>
              <UserPlus size={14} /> تسجيل مريض جديد
            </Button>
          </div>
        </div>

        <div className="hero-next">
          <div className="lbl">الموعد القادم</div>
          {next && nextPatient ? (
            <>
              <div className="nm">{nextPatient.name}</div>
              <div className="tm">
                <Clock size={13} /> {to12h(next.time)} · {APPOINTMENT_TYPE_LABEL[next.type]}
              </div>
              <div className="row" style={{ marginTop: 9, gap: 6 }}>
                <span
                  className="badge"
                  style={{ background: "rgba(255,255,255,.18)", color: "#fff", fontSize: ".66rem" }}
                >
                  {nextPatient.code}
                </span>
                {nextPatient.chronic.length ? (
                  <span className="badge" style={{ background: "rgba(255,220,150,.22)", color: "#ffe9b8", fontSize: ".66rem" }}>
                    ملف مزمن
                  </span>
                ) : null}
              </div>
              <button
                className="btn btn-sm"
                style={{ marginTop: 11, width: "100%", background: "#fff", color: "#0a5f5a", borderColor: "transparent" }}
                onClick={() => navigate(`/patients/${nextPatient.id}`)}
              >
                فتح الملف الطبي <ArrowLeft size={13} />
              </button>
            </>
          ) : (
            <>
              <div className="nm" style={{ marginTop: 2 }}>لا مواعيد متبقية</div>
              <div className="tm">
                <CheckCircle2 size={13} /> انتهى جدول اليوم بنجاح
              </div>
            </>
          )}
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-4 mt-16">
        <StatCard
          label="مواعيد اليوم"
          value={todayAppts.length}
          unit="موعد"
          icon={<CalendarDays size={19} />}
          tone="primary"
          foot={
            <span className="trend-up row" style={{ gap: 4 }}>
              <TrendingUp size={12} /> {completed.length} مكتمل · {waiting.length} منتظر
            </span>
          }
        />
        <StatCard
          label="إيراد الشهر"
          value={fmtNum(Math.round(monthRevenue))}
          unit={db.settings.currency}
          icon={<Wallet size={19} />}
          tone="ok"
          foot={<span className="muted">{fmtMoney(collected, db.settings.currency)} محصّل فعليًا</span>}
        />
        <StatCard
          label="طلبات حجز معلّقة"
          value={pendingBookings.length}
          unit="طلب"
          icon={<CalendarCheck size={19} />}
          tone="warn"
          foot={<span className="trend-down row" style={{ gap: 4 }}><AlertTriangle size={12} /> تحتاج تحقق من الدفع</span>}
        />
        <StatCard
          label="فواتير غير مسددة"
          value={unpaidInvoices.length}
          unit="فاتورة"
          icon={<Receipt size={19} />}
          tone="info"
          foot={<span className="muted">{db.patients.length} مريض مسجل بالعيادة</span>}
        />
      </div>

      {/* queue + summary */}
      <div className="grid mt-16" style={{ gridTemplateColumns: "1.55fr 1fr" }}>
        <Card>
          <CardHead
            icon={<Stethoscope size={17} style={{ color: "var(--primary)" }} />}
            title="قائمة اليوم"
            sub={`${todayAppts.length} موعد — ${completed.length} مكتمل`}
            action={
              <Button size="sm" variant="ghost" onClick={() => navigate("/appointments")}>
                عرض الجدول <ArrowLeft size={13} />
              </Button>
            }
          />
          <div className="card-bd" style={{ paddingTop: 10, paddingBottom: 10 }}>
            <div className="row-between mb-12">
              <span className="tiny muted">نسبة الإنجاز اليوم</span>
              <span className="small bold num">{done}%</span>
            </div>
            <Progress value={done} />
            <div className="mt-16">
              {todayAppts.length ? (
                todayAppts.slice(0, 8).map((a) => {
                  const p = db.patients.find((x) => x.id === a.patientId);
                  if (!p) return null;
                  const isDone = a.status === "completed";
                  return (
                    <div
                      key={a.id}
                      className={`queue-item ${a.status === "waiting" ? "is-waiting" : ""} ${isDone ? "is-done" : ""}`}
                    >
                      <div className="queue-time num">{to12h(a.time).replace(" ", " ")}</div>
                      <Avatar name={p.name} size="sm" />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="nm strong" style={{ fontSize: ".855rem" }}>
                          {p.name}
                          {p.chronic.length ? <span className="tag tag-warn" style={{ marginInlineStart: 6, fontSize: ".63rem" }}>مزمن</span> : null}
                        </div>
                        <div className="tiny muted truncate">
                          {a.complaint ?? APPOINTMENT_TYPE_LABEL[a.type]} · {ageFrom(p.birthDate)} سنة
                        </div>
                      </div>
                      <Badge tone={STATUS_TONE[a.status]} dot>
                        {APPOINTMENT_STATUS_LABEL[a.status]}
                      </Badge>
                      {a.status === "waiting" ? (
                        <Button size="sm" variant="primary" onClick={() => startVisit(a)}>
                          <Play size={12} /> بدء
                        </Button>
                      ) : (
                        <button
                          className="icon-btn"
                          onClick={() => navigate(`/patients/${p.id}`)}
                          title="فتح الملف"
                          style={{ width: 30, height: 30 }}
                        >
                          <ArrowLeft size={15} />
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  icon={<CalendarDays size={24} />}
                  title="لا توجد مواعيد اليوم"
                  desc="يمكنك إضافة موعد جديد أو مراجعة طلبات الحجز الإلكتروني."
                  action={
                    <Button variant="primary" size="sm" onClick={() => navigate("/appointments?new=1")}>
                      <Plus size={14} /> إضافة موعد
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        </Card>

        <div className="col gap-16">
          <Card>
            <CardHead title="توزيع المواعيد" sub="حسب نوع الزيارة — اليوم" />
            <div className="card-bd">
              <div className="row gap-16" style={{ alignItems: "center" }}>
                <Donut
                  segments={typeSegments.length ? typeSegments : [{ label: "لا مواعيد", value: 1, color: "var(--line)" }]}
                  center={
                    <div>
                      <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 800 }}>
                        {todayAppts.length}
                      </div>
                      <div className="tiny muted">موعد</div>
                    </div>
                  }
                />
                <div className="grow">
                  <Legend items={typeSegments} />
                  {!typeSegments.length ? <span className="tiny muted">لا توجد بيانات اليوم</span> : null}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead
              icon={<AlertTriangle size={16} style={{ color: "var(--warn)" }} />}
              title="يحتاج انتباهك"
              action={<Badge tone="warn">{pendingBookings.length + unpaidInvoices.length}</Badge>}
            />
            <div className="card-bd" style={{ paddingTop: 8, paddingBottom: 8 }}>
              {pendingBookings.slice(0, 2).map((b) => (
                <button
                  key={b.id}
                  className="list-row"
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "start" }}
                  onClick={() => navigate("/booking-requests")}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--warn-soft)", color: "var(--warn)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                    <CalendarCheck size={15} />
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small strong truncate">طلب حجز — {b.patientName}</div>
                    <div className="meta">بانتظار التحقق من الدفع · {relDay(b.preferredDate)}</div>
                  </div>
                  <ArrowLeft size={14} className="muted" />
                </button>
              ))}
              {unpaidInvoices.slice(0, 2).map((inv) => {
                const p = db.patients.find((x) => x.id === inv.patientId);
                const t = invoiceTotals(inv.items, inv.discount, inv.taxRate);
                return (
                  <button
                    key={inv.id}
                    className="list-row"
                    style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "start" }}
                    onClick={() => navigate("/billing")}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--info-soft)", color: "var(--info)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                      <Receipt size={15} />
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="small strong truncate">فاتورة غير مكتملة — {p?.name}</div>
                      <div className="meta">
                        متبقي {fmtMoney(t.total - inv.paid, db.settings.currency)} · {inv.number}
                      </div>
                    </div>
                    <ArrowLeft size={14} className="muted" />
                  </button>
                );
              })}
              {!pendingBookings.length && !unpaidInvoices.length ? (
                <div className="row gap-8" style={{ padding: "10px 2px", color: "var(--ok)", fontSize: ".82rem" }}>
                  <CheckCircle2 size={16} /> كل شيء تحت السيطرة، لا مهام معلّقة.
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      {/* revenue + followups */}
      <div className="grid mt-16" style={{ gridTemplateColumns: "1.55fr 1fr" }}>
        <Card>
          <CardHead
            icon={<TrendingUp size={17} style={{ color: "var(--ok)" }} />}
            title="حركة الإيراد"
            sub="آخر ٧ أيام"
            action={<Badge tone="ok">{fmtMoney(week.reduce((s, d) => s + d.value, 0), db.settings.currency)}</Badge>}
          />
          <div className="card-bd">
            <BarChart data={week} highlightLast />
          </div>
        </Card>

        <Card>
          <CardHead
            icon={<Clock size={16} style={{ color: "var(--violet)" }} />}
            title="متابعات مستحقة"
            sub="خلال الأسبوع القادم"
          />
          <div className="card-bd" style={{ paddingTop: 8, paddingBottom: 8 }}>
            {followUps.length ? (
              followUps.map(({ visit, patient }) => (
                <button
                  key={visit.id}
                  className="list-row"
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "start" }}
                  onClick={() => patient && navigate(`/patients/${patient.id}`)}
                >
                  <Avatar name={patient?.name ?? "مريض"} size="sm" />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small strong truncate">{patient?.name}</div>
                    <div className="meta truncate">{visit.diagnosis.join(" · ")}</div>
                  </div>
                  <Badge tone={visit.followUpDate && visit.followUpDate < today ? "danger" : "default"}>
                    {relDay(visit.followUpDate ?? "")}
                  </Badge>
                </button>
              ))
            ) : (
              <div className="small muted" style={{ padding: "10px 2px" }}>لا توجد متابعات مستحقة قريبًا.</div>
            )}
          </div>
        </Card>
      </div>

      {/* recent prescriptions */}
      <Card className="mt-16">
        <CardHead
          icon={<FileText size={17} style={{ color: "var(--primary)" }} />}
          title="أحدث الوصفات الطبية"
          sub="آخر ما كتبته لمرضاك"
          action={
            <Button size="sm" variant="ghost" onClick={() => navigate("/prescriptions")}>
              كل الوصفات <ArrowLeft size={13} />
            </Button>
          }
        />
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>المريض</th>
                <th>رقم الوصفة</th>
                <th>التشخيص</th>
                <th>عدد الأدوية</th>
                <th>التاريخ</th>
                <th>الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recentRx.map(({ rx, patient }) => (
                <tr key={rx.id}>
                  <td>
                    <div className="cell-main">
                      <Avatar name={patient?.name ?? "مريض"} size="sm" />
                      <div>
                        <div className="strong" style={{ fontSize: ".83rem" }}>{patient?.name}</div>
                        <div className="tiny muted">{patient?.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{rx.number}</td>
                  <td className="truncate" style={{ maxWidth: 220 }}>{rx.diagnosis}</td>
                  <td className="num">{rx.items.length}</td>
                  <td className="tiny muted">{fmtDate(rx.date)}</td>
                  <td>
                    <Badge tone={rx.status === "active" ? "primary" : "default"}>
                      {rx.status === "active" ? "نشطة" : "منتهية"}
                    </Badge>
                  </td>
                  <td className="actions">
                    <Button size="sm" variant="ghost" onClick={() => navigate("/prescriptions")}>
                      عرض
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
