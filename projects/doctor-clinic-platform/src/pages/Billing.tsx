import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Banknote,
  CreditCard,
  Download,
  FileText,
  Plus,
  Printer,
  Receipt,
  Search,
  TrendingUp,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHead } from "@/components/ui";
import { DocPreview, InvoiceDoc } from "@/components/docs";
import type { Invoice, InvoiceItem } from "@/lib/types";
import { PAYMENT_METHOD_LABEL } from "@/lib/types";
import { downloadText, fmtDate, fmtMoney, fmtNum, genNumber, invoiceTotals, todayISO, toCSV, uid } from "@/lib/utils";

const METHODS: Invoice["method"][] = ["cash", "card", "instapay", "vodafone-cash", "transfer", "insurance"];

const emptyItem = (): InvoiceItem => ({ id: uid("ii"), desc: "", qty: 1, price: 0 });

export default function Billing() {
  const { db, save, toast } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "partial" | "unpaid">("all");
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [payFor, setPayFor] = useState<Invoice | null>(null);

  const list = useMemo(() => {
    return db.invoices
      .map((i) => ({ i, p: db.patients.find((p) => p.id === i.patientId) }))
      .filter(({ i, p }) => {
        if (status !== "all" && i.status !== status) return false;
        if (!q.trim()) return true;
        return (p?.name.includes(q) ?? false) || i.number.includes(q);
      })
      .sort((a, b) => b.i.date.localeCompare(a.i.date));
  }, [db.invoices, db.patients, q, status]);

  const month = todayISO().slice(0, 7);
  const monthInvoices = db.invoices.filter((i) => i.date.slice(0, 7) === month);
  const monthTotal = monthInvoices.reduce((s, i) => s + invoiceTotals(i.items, i.discount, i.taxRate).total, 0);
  const monthPaid = monthInvoices.reduce((s, i) => s + i.paid, 0);
  const outstanding = db.invoices.reduce(
    (s, i) => s + Math.max(0, invoiceTotals(i.items, i.discount, i.taxRate).total - i.paid),
    0
  );

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["رقم الفاتورة", "المريض", "التاريخ", "الإجمالي", "المدفوع", "المتبقي", "الحالة", "طريقة الدفع"],
      ...list.map(({ i, p }) => {
        const t = invoiceTotals(i.items, i.discount, i.taxRate);
        return [i.number, p?.name ?? "", i.date, t.total, i.paid, Math.max(0, t.total - i.paid), i.status, PAYMENT_METHOD_LABEL[i.method]];
      }),
    ];
    downloadText(`invoices-${todayISO()}.csv`, toCSV(rows), "text/csv;charset=utf-8");
    toast("تم تصدير الفواتير");
  };

  return (
    <>
      <PageHead
        title="الفواتير والمدفوعات"
        sub="إصدار الفواتير، تحصيل المدفوعات، ومتابعة المستحقات"
        actions={
          <>
            <Button onClick={exportCsv}><Download size={15} /> تصدير</Button>
            <Button variant="primary" onClick={() => setOpen(true)}><Plus size={16} /> فاتورة جديدة</Button>
          </>
        }
      />

      <div className="grid grid-4 mb-16">
        <div className="stat" style={{ "--stat-tint": "var(--primary-soft)", "--stat-color": "var(--primary)" } as React.CSSProperties}>
          <div className="stat-ico"><Wallet size={19} /></div>
          <div className="stat-label">إيراد الشهر</div>
          <div className="stat-value num">{fmtNum(Math.round(monthTotal))}<small>{db.settings.currency}</small></div>
          <div className="stat-foot"><TrendingUp size={12} className="trend-up" /> {monthInvoices.length} فاتورة</div>
        </div>
        <div className="stat" style={{ "--stat-tint": "var(--ok-soft)", "--stat-color": "var(--ok)" } as React.CSSProperties}>
          <div className="stat-ico"><Banknote size={19} /></div>
          <div className="stat-label">محصّل فعليًا</div>
          <div className="stat-value num">{fmtNum(Math.round(monthPaid))}<small>{db.settings.currency}</small></div>
          <div className="stat-foot"><span className="muted">{monthTotal ? Math.round((monthPaid / monthTotal) * 100) : 0}% من إيراد الشهر</span></div>
        </div>
        <div className="stat" style={{ "--stat-tint": "var(--danger-soft)", "--stat-color": "var(--danger)" } as React.CSSProperties}>
          <div className="stat-ico"><Receipt size={19} /></div>
          <div className="stat-label">مستحقات غير مسددة</div>
          <div className="stat-value num">{fmtNum(Math.round(outstanding))}<small>{db.settings.currency}</small></div>
          <div className="stat-foot"><span className="muted">{db.invoices.filter((i) => i.status !== "paid").length} فاتورة تحتاج متابعة</span></div>
        </div>
        <div className="stat" style={{ "--stat-tint": "var(--info-soft)", "--stat-color": "var(--info)" } as React.CSSProperties}>
          <div className="stat-ico"><FileText size={19} /></div>
          <div className="stat-label">إجمالي الفواتير</div>
          <div className="stat-value num">{db.invoices.length}</div>
          <div className="stat-foot"><span className="muted">منذ بداية التشغيل</span></div>
        </div>
      </div>

      <Card>
        <div className="toolbar">
          <div className="searchbar" style={{ maxWidth: 300 }}>
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث برقم الفاتورة أو اسم المريض…" />
          </div>
          <select className="select" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="all">كل الحالات</option>
            <option value="paid">مدفوعة</option>
            <option value="partial">مدفوعة جزئيًا</option>
            <option value="unpaid">غير مدفوعة</option>
          </select>
          <div className="spacer" />
          <span className="tiny muted">{list.length} فاتورة</span>
        </div>

        {list.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>المريض</th>
                  <th>التاريخ</th>
                  <th>الإجمالي</th>
                  <th>المدفوع</th>
                  <th>المتبقي</th>
                  <th>الطريقة</th>
                  <th>الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map(({ i, p }) => {
                  const t = invoiceTotals(i.items, i.discount, i.taxRate);
                  const rem = Math.max(0, t.total - i.paid);
                  return (
                    <tr key={i.id}>
                      <td className="mono">{i.number}</td>
                      <td>
                        <div className="cell-main">
                          <Avatar name={p?.name ?? "مريض"} size="sm" />
                          <div className="strong" style={{ fontSize: ".84rem" }}>{p?.name ?? "—"}</div>
                        </div>
                      </td>
                      <td className="tiny muted">{fmtDate(i.date)}</td>
                      <td className="num strong">{fmtMoney(t.total, db.settings.currency)}</td>
                      <td className="num" style={{ color: "var(--ok)" }}>{fmtMoney(i.paid, db.settings.currency)}</td>
                      <td className="num" style={{ color: rem ? "var(--danger)" : "var(--ink-3)" }}>{fmtMoney(rem, db.settings.currency)}</td>
                      <td><Badge tone="line">{PAYMENT_METHOD_LABEL[i.method]}</Badge></td>
                      <td>
                        <Badge tone={i.status === "paid" ? "ok" : i.status === "partial" ? "warn" : "danger"} dot>
                          {i.status === "paid" ? "مدفوعة" : i.status === "partial" ? "جزئية" : "غير مدفوعة"}
                        </Badge>
                      </td>
                      <td className="actions">
                        {rem > 0 ? (
                          <Button size="sm" variant="soft" onClick={() => setPayFor(i)}>
                            <CreditCard size={13} /> تحصيل
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => setPreview(i)}><Printer size={13} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => p && navigate(`/patients/${p.id}`)}><User size={13} /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Receipt size={24} />}
            title="لا فواتير مطابقة"
            desc="أصدر فاتورة جديدة وستظهر هنا مع إمكانية التحصيل والطباعة."
            action={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={15} /> فاتورة جديدة</Button>}
          />
        )}
      </Card>

      {open ? <InvoiceForm onClose={() => setOpen(false)} /> : null}

      {preview ? (
        <DocPreview
          open
          onClose={() => setPreview(null)}
          title={`فاتورة ${preview.number}`}
          filename={`${preview.number}.pdf`}
          doc={<InvoiceDoc invoice={preview} patient={db.patients.find((p) => p.id === preview.patientId)} settings={db.settings} />}
        />
      ) : null}

      {payFor ? <PaymentModal invoice={payFor} onClose={() => setPayFor(null)} /> : null}
    </>
  );
}

/* -------------------------------------------------------------------- form */
function InvoiceForm({ onClose }: { onClose: () => void }) {
  const { db, save, toast } = useApp();
  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: uid("ii"), desc: "كشف استشاري", qty: 1, price: db.settings.consultationFee },
  ]);
  const [discount, setDiscount] = useState("0");
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState<Invoice["method"]>("cash");
  const [notes, setNotes] = useState("");

  const t = invoiceTotals(items, Number(discount) || 0, db.settings.taxRate);
  const paidNum = paid === "" ? 0 : Number(paid);
  const status: Invoice["status"] = paidNum >= t.total && t.total > 0 ? "paid" : paidNum > 0 ? "partial" : "unpaid";

  const submit = () => {
    if (!patientId) return toast("اختر المريض أولًا", "err");
    const valid = items.filter((i) => i.desc.trim());
    if (!valid.length) return toast("أضف بندًا واحدًا على الأقل", "err");
    const inv: Invoice = {
      id: uid("inv"),
      number: genNumber("INV"),
      patientId,
      date,
      items: valid,
      discount: Number(discount) || 0,
      taxRate: db.settings.taxRate,
      paid: Math.min(paidNum, t.total),
      method,
      status,
      notes,
      createdAt: new Date().toISOString(),
    };
    save("invoices", inv);
    toast("تم إصدار الفاتورة بنجاح");
    onClose();
  };

  const setItem = (id: string, patch: Partial<InvoiceItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <Modal
      open
      onClose={onClose}
      title="إصدار فاتورة جديدة"
      sub="أضف البنود ثم حدد المبلغ المدفوع"
      icon={<Receipt size={18} />}
      size="xl"
      footer={
        <>
          <Button onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={submit}><Receipt size={15} /> إصدار الفاتورة</Button>
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
        <Field label="التاريخ"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="طريقة الدفع">
          <select className="select" value={method} onChange={(e) => setMethod(e.target.value as any)}>
            {METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
          </select>
        </Field>
      </div>

      <div className="divider" />
      <div className="row-between mb-8">
        <b className="small">بنود الفاتورة</b>
        <Button size="sm" variant="soft" onClick={() => setItems((p) => [...p, emptyItem()])}><Plus size={13} /> إضافة بند</Button>
      </div>

      <div className="col gap-8">
        {items.map((it, idx) => (
          <div key={it.id} className="row gap-8">
            <span className="tiny muted" style={{ width: 18 }}>{idx + 1}</span>
            <input className="input grow" value={it.desc} onChange={(e) => setItem(it.id, { desc: e.target.value })} placeholder="وصف الخدمة أو الدواء" />
            <input className="input num" style={{ width: 70 }} value={it.qty} onChange={(e) => setItem(it.id, { qty: Number(e.target.value) || 0 })} dir="ltr" placeholder="كمية" />
            <input className="input num" style={{ width: 100 }} value={it.price} onChange={(e) => setItem(it.id, { price: Number(e.target.value) || 0 })} dir="ltr" placeholder="سعر" />
            <span className="tiny muted num" style={{ width: 82, textAlign: "end" }}>{fmtNum(it.qty * it.price)}</span>
            {items.length > 1 ? (
              <button className="icon-btn" style={{ width: 28, height: 28, color: "var(--danger)" }} onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}>
                <Trash2 size={13} />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid grid-3 gap-12 mt-16">
        <Field label="خصم">
          <input className="input num" value={discount} onChange={(e) => setDiscount(e.target.value)} dir="ltr" style={{ textAlign: "right" }} />
        </Field>
        <Field label="المبلغ المدفوع">
          <input className="input num" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" dir="ltr" style={{ textAlign: "right" }} />
        </Field>
        <Field label="ملاحظات">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <div className="soft-box mt-12">
        <div className="row-between small"><span className="muted">الإجمالي قبل الخصم</span><span className="num">{fmtMoney(t.subtotal, db.settings.currency)}</span></div>
        <div className="row-between small mt-4"><span className="muted">الخصم</span><span className="num">− {fmtMoney(Number(discount) || 0, db.settings.currency)}</span></div>
        <div className="divider" style={{ margin: "8px 0" }} />
        <div className="row-between"><b>الإجمالي المستحق</b><b className="num" style={{ color: "var(--primary)", fontSize: "1.05rem" }}>{fmtMoney(t.total, db.settings.currency)}</b></div>
        <div className="row-between small mt-4">
          <span className="muted">المتبقي بعد الدفع</span>
          <span className="num" style={{ color: t.total - paidNum > 0 ? "var(--danger)" : "var(--ok)" }}>{fmtMoney(Math.max(0, t.total - paidNum), db.settings.currency)}</span>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- payment */
function PaymentModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { db, save, toast } = useApp();
  const t = invoiceTotals(invoice.items, invoice.discount, invoice.taxRate);
  const rem = Math.max(0, t.total - invoice.paid);
  const [amount, setAmount] = useState(String(rem));
  const [method, setMethod] = useState<Invoice["method"]>(invoice.method);

  const submit = () => {
    const add = Math.min(Number(amount) || 0, rem);
    const newPaid = invoice.paid + add;
    const status: Invoice["status"] = newPaid >= t.total ? "paid" : newPaid > 0 ? "partial" : "unpaid";
    save("invoices", { ...invoice, paid: newPaid, method, status });
    toast(`تم تسجيل دفعة ${fmtMoney(add, db.settings.currency)}`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="تحصيل دفعة"
      sub={`${invoice.number} — المتبقي ${fmtMoney(rem, db.settings.currency)}`}
      icon={<CreditCard size={18} />}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>إلغاء</Button>
          <Button variant="ok" onClick={submit}>تسجيل الدفع</Button>
        </>
      }
    >
      <div className="col gap-12">
        <Field label={`المبلغ (${db.settings.currency})`}>
          <input className="input num" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" style={{ textAlign: "right" }} />
        </Field>
        <Field label="طريقة الدفع">
          <select className="select" value={method} onChange={(e) => setMethod(e.target.value as any)}>
            {METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
          </select>
        </Field>
        <div className="alert alert-info">
          <Wallet size={15} />
          <span>سيتم تحديث حالة الفاتورة تلقائيًا إلى «مدفوعة» عند اكتمال المبلغ.</span>
        </div>
      </div>
    </Modal>
  );
}
