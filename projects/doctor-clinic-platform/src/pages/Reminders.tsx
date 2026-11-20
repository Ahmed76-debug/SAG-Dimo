import React, { useMemo, useState } from "react";
import {
  BellRing,
  CalendarCheck,
  Check,
  ClipboardCopy,
  Cloud,
  CreditCard,
  Download,
  HeartPulse,
  MessageCircle,
  Phone,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Avatar, Badge, Button, Card, EmptyState, Modal, PageHead, StatCard, Tabs } from "@/components/ui";
import type { ReminderKind, ReminderLog } from "@/lib/types";
import {
  addDays,
  downloadText,
  fmtDate,
  fmtMoney,
  invoiceTotals,
  relDay,
  to12h,
  toCSV,
  todayISO,
  uid,
} from "@/lib/utils";

type TabKey = "all" | ReminderKind;

interface Row {
  key: string;
  kind: ReminderKind;
  refId: string;
  name: string;
  phone: string;
  title: string;
  sub: string;
  meta: string;
  amount?: number;
  message: string;
  log?: ReminderLog;
}

const KIND_LABEL: Record<ReminderKind, string> = {
  appointment: "تأكيد موعد",
  booking: "دفع حجز",
  invoice: "تحصيل فاتورة",
  followup: "متابعة مريض",
};

const KIND_ICON: Record<ReminderKind, React.ReactNode> = {
  appointment: <CalendarCheck size={16} />,
  booking: <Wallet size={16} />,
  invoice: <CreditCard size={16} />,
  followup: <HeartPulse size={16} />,
};

function waHref(phone: string, message: string): string | null {
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "20" + d.slice(1);
  else if (!d.startsWith("20") && d.length === 10) d = "20" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(message)}`;
}

export default function Reminders() {
  const { db, save, remove, toast, cloud, runDispatch } = useApp();
  const s = db.settings;
  const p = db.profile;
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const [tab, setTab] = useState<TabKey>("all");
  const [selected, setSelected] = useState<Row | null>(null);
  const [dispatchBusy, setDispatchBusy] = useState(false);

  const logs = db.reminders ?? [];
  const logFor = (kind: ReminderKind, refId: string) =>
    logs.find((l) => l.kind === kind && l.refId === refId && l.sentAt.slice(0, 10) === today);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];

    // 1) tomorrow's appointments
    db.appointments
      .filter(
        (a) =>
          a.date === tomorrow &&
          (a.status === "scheduled" || a.status === "confirmed" || a.status === "waiting")
      )
      .sort((a, b) => a.time.localeCompare(b.time))
      .forEach((a) => {
        const pat = db.patients.find((x) => x.id === a.patientId);
        if (!pat) return;
        out.push({
          key: `appointment:${a.id}`,
          kind: "appointment",
          refId: a.id,
          name: pat.name,
          phone: pat.phone,
          title: "تأكيد موعد الغد",
          sub: `${fmtDate(a.date)} — ${to12h(a.time)} · ${a.type === "followup" ? "متابعة" : a.type === "telemedicine" ? "استشارة عن بُعد" : "كشف"}`,
          meta: "موعد غدًا",
          amount: a.fee,
          message: `مرحبًا ${pat.name}،\nنذكّركم بموعدكم غدًا ${fmtDate(a.date)} الساعة ${to12h(a.time)} في ${s.clinicName}.\nيرجى تأكيد الموعد بالرد على هذه الرسالة، أو الاتصال على ${s.phone}.\nالعنوان: ${s.address}`,
          log: logFor("appointment", a.id),
        });
      });

    // 2) pending online bookings
    db.bookings
      .filter((b) => b.status === "pending")
      .forEach((b) => {
        out.push({
          key: `booking:${b.id}`,
          kind: "booking",
          refId: b.id,
          name: b.patientName,
          phone: b.phone,
          title: "تأكيد دفع طلب حجز",
          sub: `${b.ref} · ${fmtDate(b.preferredDate)} — ${to12h(b.preferredTime)}`,
          meta: "بانتظار التحقق",
          amount: b.paymentAmount,
          message: `مرحبًا ${b.patientName}،\nاستلمنا طلب حجزكم رقم ${b.ref} في ${s.clinicName}.\nالموعد المطلوب: ${fmtDate(b.preferredDate)} — ${to12h(b.preferredTime)}.\nالطلب بانتظار التحقق من الدفع (${fmtMoney(b.paymentAmount, s.currency)}).\nللاستفسار: ${s.phone}`,
          log: logFor("booking", b.id),
        });
      });

    // 3) unpaid / partially paid invoices
    db.invoices
      .filter((i) => i.status === "unpaid" || i.status === "partial")
      .forEach((inv) => {
        const pat = db.patients.find((x) => x.id === inv.patientId);
        const t = invoiceTotals(inv.items, inv.discount, inv.taxRate);
        const rem = Math.max(0, t.total - inv.paid);
        if (!pat || rem <= 0) return;
        const late = inv.date < today;
        out.push({
          key: `invoice:${inv.id}`,
          kind: "invoice",
          refId: inv.id,
          name: pat.name,
          phone: pat.phone,
          title: "تذكير بمبلغ متبقٍ",
          sub: `${inv.number} · ${fmtDate(inv.date)}${late ? ` · متأخرة ${relDay(inv.date)}` : ""}`,
          meta: late ? "متأخرة" : "مستحقة",
          amount: rem,
          message: `مرحبًا ${pat.name}،\nلديكم مبلغ متبقٍ قدره ${fmtMoney(rem, s.currency)} على الفاتورة ${inv.number} بتاريخ ${fmtDate(inv.date)}.\nيمكن السداد في العيادة أو عبر إنستاباي: ${s.instapayHandle}.\nشكرًا لتعاونكم — ${s.clinicName}`,
          log: logFor("invoice", inv.id),
        });
      });

    // 4) due follow-ups (latest visit per patient)
    const latest = new Map<string, { date: string; followUpDate?: string; diagnosis: string[] }>();
    [...db.visits]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((v) => latest.set(v.patientId, { date: v.date, followUpDate: v.followUpDate, diagnosis: v.diagnosis }));
    latest.forEach((v, patientId) => {
      if (!v.followUpDate || v.followUpDate > today || v.followUpDate < addDays(today, -30)) return;
      const pat = db.patients.find((x) => x.id === patientId);
      if (!pat) return;
      out.push({
        key: `followup:${patientId}`,
        kind: "followup",
        refId: patientId,
        name: pat.name,
        phone: pat.phone,
        title: "حان موعد المتابعة",
        sub: `آخر زيارة ${fmtDate(v.date)} · ${v.diagnosis.slice(0, 2).join(" / ") || "متابعة دورية"}`,
        meta: `متابعة ${relDay(v.followUpDate)}`,
        message: `مرحبًا ${pat.name}،\nحان موعد المتابعة الدورية في ${s.clinicName} بعد زيارتكم بتاريخ ${fmtDate(v.date)}.\nيرجى التواصل لحجز موعد مناسب على ${s.phone}.\n${p.name}`,
        log: logFor("followup", patientId),
      });
    });

    return out;
  }, [db.appointments, db.bookings, db.invoices, db.patients, db.visits, logs, p.name, s, today, tomorrow]);

  const filtered = tab === "all" ? rows : rows.filter((r) => r.kind === tab);
  const sentToday = logs.filter((l) => l.sentAt.slice(0, 10) === today);
  const count = (k: ReminderKind) => rows.filter((r) => r.kind === k).length;
  const pending = rows.filter((r) => !r.log);

  const markSent = (row: Row, channel: ReminderLog["channel"]) => {
    const existing = logFor(row.kind, row.refId);
    if (existing) return;
    save("reminders", {
      id: uid("rem"),
      kind: row.kind,
      refId: row.refId,
      patientName: row.name,
      phone: row.phone,
      message: row.message,
      channel,
      sentAt: new Date().toISOString(),
    });
    toast(`تم تسجيل التواصل مع ${row.name}`);
    setSelected(null);
  };

  const undo = (row: Row) => {
    const existing = logFor(row.kind, row.refId);
    if (!existing) return;
    remove("reminders", existing.id);
    toast("تم التراجع عن تسجيل الإرسال", "info");
    setSelected(null);
  };

  const copyText = async (text: string, label = "تم نسخ الرسالة") => {
    try {
      await navigator.clipboard.writeText(text);
      toast(label);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast(label);
    }
  };

  const copyAll = () => {
    if (!pending.length) {
      toast("لا توجد تذكيرات مستحقة الآن", "info");
      return;
    }
    const text = pending.map((r) => `— ${r.name} (${r.phone})\n${r.message}`).join("\n\n");
    copyText(text, `تم نسخ ${pending.length} رسالة`);
  };

  const exportCsv = () => {
    const data = [
      ["النوع", "المريض", "الهاتف", "التفاصيل", "المبلغ", "الحالة"],
      ...rows.map((r) => [
        KIND_LABEL[r.kind],
        r.name,
        r.phone,
        r.sub,
        r.amount ?? "",
        r.log ? "تم التواصل" : "مستحق",
      ]),
    ];
    downloadText(`reminders-${today}.csv`, "\uFEFF" + toCSV(data), "text/csv;charset=utf-8");
    toast("تم تصدير قائمة التذكيرات");
  };

  const sendAllChannels = () => {
    if (!pending.length) {
      toast("لا توجد تذكيرات مستحقة الآن", "info");
      return;
    }
    setSelected(pending[0]);
  };

  const dispatch = async () => {
    setDispatchBusy(true);
    const res = await runDispatch();
    setDispatchBusy(false);
    if (!res.ok) {
      toast(res.error ?? "تعذر تشغيل محرك التذكيرات", "err");
      return;
    }
    const summary = res.summary ?? {};
    const candidates = Number(summary.candidates ?? summary.scanned ?? 0);
    const sent = Number(summary.sent ?? 0);
    const failed = Number(summary.failed ?? 0);
    if (summary.dryRun) {
      toast(`معاينة آمنة: ${candidates} تذكير جاهز. أضف مفاتيح واتساب للبدء الفعلي.`, "info");
    } else {
      toast(
        failed
          ? `تم إرسال ${sent} تذكيرًا، وتعذر ${failed}. راجع السجل.`
          : `تم إرسال ${sent} تذكيرًا تلقائيًا عبر واتساب.`,
        failed ? "err" : "ok"
      );
    }
  };

  return (
    <>
      <PageHead
        title="مركز التذكيرات والمتابعة"
        sub="رسائل جاهزة للواتساب: تأكيد مواعيد الغد، متابعة الدفع، تحصيل الفواتير، والمتابعة الدورية."
        eyebrow="تشغيل العيادة"
        actions={
          <>
            <Button size="sm" onClick={exportCsv}>
              <Download size={14} /> تصدير CSV
            </Button>
            <Button size="sm" onClick={copyAll}>
              <ClipboardCopy size={14} /> نسخ كل الرسائل
            </Button>
            <Button size="sm" variant="primary" onClick={sendAllChannels}>
              <MessageCircle size={14} /> بدء الإرسال
            </Button>
          </>
        }
      />

      {cloud.enabled ? (
        <div
          className="soft-box mb-16 row-between gap-12"
          style={{ flexWrap: "wrap", borderColor: "color-mix(in srgb, var(--ok) 26%, transparent)" }}
        >
          <div className="row gap-10" style={{ alignItems: "flex-start" }}>
            <div className="rem-ico" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
              <Cloud size={17} />
            </div>
            <div>
              <b className="small">محرك الإرسال التلقائي (السحابة ← واتساب)</b>
              <p className="tiny muted" style={{ marginTop: 3, maxWidth: 620, lineHeight: 1.7 }}>
                يفحص مواعيد الغد، الحجوزات غير المدفوعة، الفواتير المتأخرة، والمتابعات — ثم يرسل القوالب
                المعتمدة ويسجّل نتيجة كل رسالة هنا تلقائيًا. يعمل الآن في وضع المعاينة حتى ربط مفاتيح Meta.
              </p>
            </div>
          </div>
          <Button variant="soft" size="sm" onClick={dispatch} disabled={dispatchBusy}>
            <RefreshCw size={14} className={dispatchBusy ? "spin" : ""} />
            {dispatchBusy ? "جارٍ الفحص…" : "فحص وتشغيل الآن"}
          </Button>
        </div>
      ) : null}

      <div className="grid grid-4 mb-16">
        <StatCard label="تأكيد مواعيد الغد" value={count("appointment")} unit="موعد" icon={<CalendarCheck size={18} />} tone="primary" foot={<span className="muted tiny">تُرسل قبل الموعد بيوم</span>} />
        <StatCard label="طلبات دفع معلّقة" value={count("booking")} unit="طلب" icon={<Wallet size={18} />} tone="warn" foot={<span className="muted tiny">بانتظار تحقق الاستقبال</span>} />
        <StatCard label="فواتير مستحقة" value={count("invoice")} unit="فاتورة" icon={<CreditCard size={18} />} tone="danger" foot={<span className="muted tiny">مبالغ متبقية قابلة للتحصيل</span>} />
        <StatCard label="متابعات مستحقة" value={count("followup")} unit="مريض" icon={<HeartPulse size={18} />} tone="violet" foot={<span className="muted tiny">حسب تاريخ المتابعة في الزيارة</span>} />
      </div>

      <Card>
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <div className="row-between wrap gap-12 mb-12">
            <Tabs<TabKey>
              tabs={[
                { key: "all", label: "كل التذكيرات", count: rows.length },
                { key: "appointment", label: "مواعيد الغد", count: count("appointment") },
                { key: "booking", label: "طلبات الحجز", count: count("booking") },
                { key: "invoice", label: "الفواتير", count: count("invoice") },
                { key: "followup", label: "المتابعة", count: count("followup") },
              ]}
              value={tab}
              onChange={setTab}
            />
            <div className="row gap-6">
              <Badge tone="ok" dot>{sentToday.length} تم التواصل اليوم</Badge>
              <Badge tone="warn" dot>{pending.length} بانتظار الإرسال</Badge>
            </div>
          </div>
        </div>

        <div className="card-bd" style={{ paddingTop: 4 }}>
          {filtered.length ? (
            <div className="col gap-8">
              {filtered.map((r) => {
                const wa = waHref(r.phone, r.message);
                return (
                  <div
                    key={r.key}
                    className={`rem-row ${r.log ? "sent" : ""}`}
                    onClick={() => setSelected(r)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setSelected(r);
                    }}
                  >
                    <div className={`rem-ico ${r.kind}`}>{KIND_ICON[r.kind]}</div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row gap-6 wrap">
                        <b className="small">{r.name}</b>
                        <Badge tone={r.kind === "invoice" ? "danger" : r.kind === "booking" ? "warn" : r.kind === "appointment" ? "primary" : "violet"}>
                          {KIND_LABEL[r.kind]}
                        </Badge>
                        {r.log ? <Badge tone="ok" dot>تم التواصل</Badge> : null}
                      </div>
                      <div className="tiny muted truncate" style={{ marginTop: 2 }}>{r.title} — {r.sub}</div>
                      <div className="row gap-10 tiny muted mt-4 wrap">
                        <span className="row gap-4" dir="ltr"><Phone size={11} /> {r.phone}</span>
                        {typeof r.amount === "number" ? <span>{fmtMoney(r.amount, s.currency)}</span> : null}
                        <span>{r.meta}</span>
                      </div>
                    </div>
                    <div className="row gap-6 rem-actions" onClick={(e) => e.stopPropagation()}>
                      {wa ? (
                        <a
                          className="btn btn-sm btn-ok"
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => markSent(r, "whatsapp")}
                          title="فتح واتساب"
                        >
                          <MessageCircle size={13} /> واتساب
                        </a>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        title="نسخ الرسالة"
                        onClick={() => copyText(r.message, `تم نسخ رسالة ${r.name}`)}
                      >
                        <ClipboardCopy size={14} />
                      </Button>
                      {r.log ? (
                        <Button size="sm" variant="ghost" title="تراجع" onClick={() => undo(r)}>
                          <RotateCcw size={14} />
                        </Button>
                      ) : (
                        <Button size="sm" variant="soft" onClick={() => markSent(r, "manual")}>
                          <Check size={14} /> تم
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<BellRing size={26} />}
              title="لا توجد تذكيرات في هذا التصنيف"
              desc="كل المواعيد مؤكدة والفواتير محصّلة — عمل رائع. ستظهر التذكيرات الجديدة تلقائيًا."
            />
          )}
        </div>

        <div className="card-ft row-between wrap gap-8">
          <div className="tiny muted row gap-6">
            <Sparkles size={13} style={{ color: "var(--primary)" }} />
            الروابط تفتح واتساب برسالة جاهزة؛ لا يتم إرسال أي رسالة تلقائيًا دون ضغطك.
          </div>
          <div className="tiny muted">{pending.length} تذكير مستحق · {rows.length} إجمالي</div>
        </div>
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `رسالة إلى ${selected.name}` : "معاينة الرسالة"}
        sub={selected ? `${KIND_LABEL[selected.kind]} · ${selected.phone}` : undefined}
        icon={<BellRing size={18} />}
        size="md"
        footer={
          selected ? (
            <>
              <Button onClick={() => copyText(selected.message)}>
                <ClipboardCopy size={14} /> نسخ
              </Button>
              {selected.log ? (
                <Button variant="danger-soft" onClick={() => undo(selected)}>
                  <RotateCcw size={14} /> تراجع عن الإرسال
                </Button>
              ) : (
                <Button variant="ok" onClick={() => markSent(selected, "manual")}>
                  <Check size={14} /> تسجيل التواصل
                </Button>
              )}
              {waHref(selected.phone, selected.message) ? (
                <a
                  className="btn btn-primary"
                  href={waHref(selected.phone, selected.message)!}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => markSent(selected, "whatsapp")}
                >
                  <Send size={14} /> إرسال واتساب
                </a>
              ) : null}
            </>
          ) : null
        }
      >
        {selected ? (
          <>
            <div className="soft-box" style={{ whiteSpace: "pre-wrap", lineHeight: 1.9, fontSize: ".84rem" }}>
              {selected.message}
            </div>
            <div className="row-between mt-12 tiny muted wrap gap-8">
              <span className="row gap-4"><Phone size={12} /> {selected.phone}</span>
              <span>{selected.sub}</span>
              {typeof selected.amount === "number" ? <span>{fmtMoney(selected.amount, s.currency)}</span> : null}
            </div>
            {selected.log ? (
              <div className="alert alert-ok mt-12">
                <Check size={15} />
                <span>تم تسجيل التواصل اليوم — يمكنك التراجع إن أُرسلت بالخطأ.</span>
              </div>
            ) : (
              <div className="alert alert-info mt-12">
                <MessageCircle size={15} />
                <span>يفتح واتساب في نافذة جديدة بالرسالة كاملة، ولا يُرسل شيئًا تلقائيًا.</span>
              </div>
            )}
          </>
        ) : null}
      </Modal>
    </>
  );
}
