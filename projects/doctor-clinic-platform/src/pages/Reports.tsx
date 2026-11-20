import React, { useMemo } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Download,
  PieChart,
  Receipt,
  Repeat,
  Stethoscope,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Badge, Button, Card, CardHead, PageHead } from "@/components/ui";
import { BarChart, Donut, Legend, Meter } from "@/components/charts";
import { APPOINTMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/types";
import { addDays, ageFrom, downloadText, fmtMoney, fmtNum, invoiceTotals, sum, toCSV, todayISO } from "@/lib/utils";

const MONTH_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default function Reports() {
  const { db, toast } = useApp();
  const today = todayISO();

  const revenue = db.invoices.reduce((s, i) => s + invoiceTotals(i.items, i.discount, i.taxRate).total, 0);
  const collected = db.invoices.reduce((s, i) => s + i.paid, 0);
  const avgVisit = db.invoices.length ? revenue / db.invoices.length : 0;

  const monthly = useMemo(() => {
    const out: { label: string; value: number; alt?: boolean }[] = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const total = db.invoices
        .filter((inv) => inv.date.slice(0, 7) === key)
        .reduce((s, inv) => s + invoiceTotals(inv.items, inv.discount, inv.taxRate).total, 0);
      out.push({ label: MONTH_AR[d.getMonth()].slice(0, 4), value: Math.round(total), alt: i > 0 });
    }
    return out;
  }, [db.invoices]);

  const statusSegments = useMemo(() => {
    const colors: Record<string, string> = {
      completed: "#17946a",
      waiting: "#d98421",
      confirmed: "#3a72c9",
      scheduled: "#708b91",
      cancelled: "#cf4646",
      "no-show": "#9b7bf0",
      "in-progress": "#0d7c74",
    };
    const map: Record<string, number> = {};
    db.appointments.forEach((a) => { map[a.status] = (map[a.status] ?? 0) + 1; });
    return Object.entries(map).map(([k, v]) => ({
      label: APPOINTMENT_STATUS_LABEL[k as keyof typeof APPOINTMENT_STATUS_LABEL] ?? k,
      value: v,
      color: colors[k] ?? "#888",
    }));
  }, [db.appointments]);

  const topDiagnoses = useMemo(() => {
    const map: Record<string, number> = {};
    db.visits.forEach((v) => v.diagnosis.forEach((d) => { map[d] = (map[d] ?? 0) + 1; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [db.visits]);

  const ages = useMemo(() => {
    const groups = [
      { l: "أقل من 18", min: 0, max: 17, c: "#12a79a" },
      { l: "18 — 35", min: 18, max: 35, c: "#5b8def" },
      { l: "36 — 50", min: 36, max: 50, c: "#c9a227" },
      { l: "51 — 65", min: 51, max: 65, c: "#d98421" },
      { l: "أكثر من 65", min: 66, max: 200, c: "#cf4646" },
    ];
    return groups.map((g) => ({
      ...g,
      v: db.patients.filter((p) => {
        const a = ageFrom(p.birthDate);
        return a !== null && a >= g.min && a <= g.max;
      }).length,
    }));
  }, [db.patients]);

  const methods = useMemo(() => {
    const map: Record<string, number> = {};
    db.invoices.forEach((i) => { map[i.method] = (map[i.method] ?? 0) + i.paid; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [db.invoices]);

  const exportReport = () => {
    const rows: (string | number)[][] = [
      ["تقرير العيادة", today],
      [],
      ["المؤشر", "القيمة"],
      ["عدد المرضى", db.patients.length],
      ["عدد الزيارات", db.visits.length],
      ["عدد المواعيد", db.appointments.length],
      ["إجمالي الفواتير", db.invoices.length],
      ["إجمالي الإيراد", revenue],
      ["المحصّل فعليًا", collected],
      ["متوسط الفاتورة", Math.round(avgVisit)],
      [],
      ["التشخيص", "عدد الحالات"],
      ...topDiagnoses,
      [],
      ["طريقة الدفع", "المبلغ المحصل"],
      ...methods.map(([m, v]) => [PAYMENT_METHOD_LABEL[m] ?? m, v]),
    ];
    downloadText(`clinic-report-${today}.csv`, toCSV(rows), "text/csv;charset=utf-8");
    toast("تم تصدير التقرير");
  };

  const completionRate = db.appointments.length
    ? Math.round((db.appointments.filter((a) => a.status === "completed").length / db.appointments.length) * 100)
    : 0;
  const noShowRate = db.appointments.length
    ? Math.round((db.appointments.filter((a) => a.status === "no-show").length / db.appointments.length) * 100)
    : 0;
  const onlineShare = db.appointments.length
    ? Math.round((db.appointments.filter((a) => a.source === "online").length / db.appointments.length) * 100)
    : 0;

  return (
    <>
      <PageHead
        title="التقارير والإحصائيات"
        sub="نظرة تحليلية على أداء العيادة"
        actions={<Button onClick={exportReport}><Download size={15} /> تصدير التقرير</Button>}
      />

      <div className="grid grid-4 mb-16">
        {[
          { l: "إجمالي الإيراد", v: fmtNum(Math.round(revenue)), u: db.settings.currency, i: <Wallet size={19} />, c: "var(--primary)", b: "var(--primary-soft)", f: `${Math.round((collected / (revenue || 1)) * 100)}% محصّل` },
          { l: "عدد المرضى", v: db.patients.length, u: "مريض", i: <Users size={19} />, c: "var(--info)", b: "var(--info-soft)", f: `${db.patients.filter((p) => p.chronic.length).length} ملف مزمن` },
          { l: "الزيارات", v: db.visits.length, u: "زيارة", i: <Stethoscope size={19} />, c: "var(--violet)", b: "var(--violet-soft)", f: `${db.prescriptions.length} وصفة` },
          { l: "متوسط الفاتورة", v: fmtNum(Math.round(avgVisit)), u: db.settings.currency, i: <Receipt size={19} />, c: "var(--warn)", b: "var(--warn-soft)", f: `${db.invoices.length} فاتورة` },
        ].map((s) => (
          <div className="stat" key={s.l} style={{ "--stat-tint": s.b, "--stat-color": s.c } as React.CSSProperties}>
            <div className="stat-ico">{s.i}</div>
            <div className="stat-label">{s.l}</div>
            <div className="stat-value num">{s.v}<small>{s.u}</small></div>
            <div className="stat-foot"><span className="muted">{s.f}</span></div>
          </div>
        ))}
      </div>

      <div className="grid mb-16" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
        <Card>
          <CardHead
            icon={<TrendingUp size={17} style={{ color: "var(--ok)" }} />}
            title="الإيراد الشهري"
            sub="آخر ٦ أشهر"
            action={<Badge tone="ok">{fmtMoney(monthly.reduce((s, m) => s + m.value, 0), db.settings.currency)}</Badge>}
          />
          <div className="card-bd"><BarChart data={monthly} highlightLast height={170} /></div>
        </Card>

        <Card>
          <CardHead icon={<PieChart size={17} style={{ color: "var(--primary)" }} />} title="حالات المواعيد" sub="توزيع كل المواعيد" />
          <div className="card-bd">
            <div className="row gap-16" style={{ alignItems: "center" }}>
              <Donut
                segments={statusSegments}
                center={
                  <div>
                    <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.3rem" }}>{db.appointments.length}</div>
                    <div className="tiny muted">موعد</div>
                  </div>
                }
              />
              <div className="grow"><Legend items={statusSegments} /></div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid mb-16" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <Card>
          <CardHead icon={<Activity size={16} style={{ color: "var(--violet)" }} />} title="أكثر التشخيصات" sub="حسب عدد الحالات" />
          <div className="card-bd">
            {topDiagnoses.length ? (
              <div className="col gap-12">
                {topDiagnoses.map(([d, c], i) => (
                  <Meter
                    key={d}
                    label={d}
                    value={c}
                    max={topDiagnoses[0][1]}
                    color={["#0d7c74", "#12a79a", "#5b8def", "#c9a227", "#d98421", "#9b7bf0"][i % 6]}
                    suffix=" حالة"
                  />
                ))}
              </div>
            ) : <div className="small muted">لا بيانات كافية.</div>}
          </div>
        </Card>

        <Card>
          <CardHead icon={<Users size={16} style={{ color: "var(--info)" }} />} title="الفئات العمرية" sub="توزيع المرضى" />
          <div className="card-bd">
            <div className="col gap-12">
              {ages.map((g) => (
                <Meter key={g.l} label={g.l} value={g.v} max={Math.max(...ages.map((x) => x.v), 1)} color={g.c} suffix=" مريض" />
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHead icon={<CalendarDays size={16} style={{ color: "var(--warn)" }} />} title="مؤشرات التشغيل" sub="جودة الأداء" />
          <div className="card-bd">
            <div className="col gap-14">
              <Meter label="نسبة إكمال المواعيد" value={completionRate} max={100} color="var(--ok)" suffix="%" />
              <Meter label="نسبة عدم الحضور" value={noShowRate} max={100} color="var(--danger)" suffix="%" />
              <Meter label="الحجز الإلكتروني" value={onlineShare} max={100} color="var(--violet)" suffix="%" />
            </div>
            <div className="divider" />
            <div className="row-between small"><span className="muted row gap-4"><Repeat size={13} /> مرضى متابعة</span><b>{db.patients.filter((p) => p.tags.includes("متابعة دورية")).length}</b></div>
            <div className="row-between small mt-8"><span className="muted row gap-4"><BarChart3 size={13} /> متوسط الزيارات/مريض</span><b className="num">{(db.visits.length / (db.patients.length || 1)).toFixed(1)}</b></div>
          </div>
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card>
          <CardHead title="طرق الدفع" sub="المبالغ المحصلة" icon={<Wallet size={16} style={{ color: "var(--ok)" }} />} />
          <div className="card-bd">
            {methods.map(([m, v], i) => (
              <div key={m} className="row-between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <span className="row gap-8">
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: ["#0d7c74", "#5b8def", "#c9a227", "#d98421", "#9b7bf0"][i % 5] }} />
                  <span className="small">{PAYMENT_METHOD_LABEL[m] ?? m}</span>
                </span>
                <b className="num small">{fmtMoney(v, db.settings.currency)}</b>
              </div>
            ))}
            {!methods.length ? <div className="small muted">لا مدفوعات بعد.</div> : null}
          </div>
        </Card>

        <Card>
          <CardHead title="ملخص سريع" sub="أرقام قد تفيدك" icon={<BarChart3 size={16} style={{ color: "var(--primary)" }} />} />
          <div className="card-bd">
            {[
              { l: "مواعيد اليوم", v: db.appointments.filter((a) => a.date === today).length },
              { l: "مواعيد هذا الأسبوع", v: db.appointments.filter((a) => a.date >= today && a.date <= addDays(today, 7)).length },
              { l: "طلبات حجز معلقة", v: db.bookings.filter((b) => b.status === "pending").length },
              { l: "ملفات أرشيف", v: db.archive.length },
              { l: "وصفات نشطة", v: db.prescriptions.filter((r) => r.status === "active").length },
              { l: "فواتير غير مسددة", v: db.invoices.filter((i) => i.status !== "paid").length },
            ].map((x) => (
              <div key={x.l} className="row-between" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <span className="small muted">{x.l}</span>
                <b className="num">{x.v}</b>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
