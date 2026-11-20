import React, { useRef, useState } from "react";
import { Download, FileText, Printer, Stethoscope } from "lucide-react";
import type { Invoice, Patient, Prescription, Settings, Visit } from "@/lib/types";
import { PAYMENT_METHOD_LABEL } from "@/lib/types";
import {
  ageFrom,
  bmi,
  bmiLabel,
  exportPdf,
  fmtDate,
  fmtMoney,
  fmtNum,
  invoiceTotals,
  to12h,
} from "@/lib/utils";
import { Button, Modal } from "@/components/ui";

/* ------------------------------------------------------------------ shared */
function DocHeader({ settings, kind, number, date }: { settings: Settings; kind: string; number: string; date: string }) {
  return (
    <>
      <div className="doc-head">
        <div className="doc-brand">
          <div className="doc-logo">
            <Stethoscope size={24} />
          </div>
          <div>
            <div className="doc-clinic">{settings.clinicName}</div>
            <small>{settings.specialty}</small>
          </div>
        </div>
        <div className="doc-meta">
          <div>{settings.phone}</div>
          <div>{settings.address}</div>
          <div>{settings.email}</div>
        </div>
      </div>
      <div className="doc-title">
        <h3>{kind}</h3>
        <div className="no">
          رقم: {number} — التاريخ: {fmtDate(date)}
        </div>
      </div>
    </>
  );
}

function PatientBox({ patient }: { patient: Patient }) {
  return (
    <div className="doc-box">
      <div className="t">بيانات المريض</div>
      <div className="v">{patient.name}</div>
      <div style={{ fontSize: ".72rem", color: "#587377", marginTop: 3 }}>
        {patient.code} · {patient.gender === "male" ? "ذكر" : "أنثى"} · {ageFrom(patient.birthDate) ?? "—"} سنة
        {patient.bloodType ? ` · فصيلة ${patient.bloodType}` : ""}
        <br />
        {patient.phone}
        {patient.address ? ` · ${patient.address}` : ""}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- invoice */
export function InvoiceDoc({
  invoice,
  patient,
  settings,
}: {
  invoice: Invoice;
  patient?: Patient;
  settings: Settings;
}) {
  const t = invoiceTotals(invoice.items, invoice.discount, invoice.taxRate);
  const remaining = Math.max(0, t.total - invoice.paid);
  const stamp = invoice.status === "paid" ? "مدفوعة" : remaining <= 0 ? "مدفوعة" : invoice.paid > 0 ? "مدفوعة جزئيًا" : "غير مدفوعة";

  return (
    <div className="doc-sheet">
      <DocHeader settings={settings} kind="فاتورة خدمات طبية" number={invoice.number} date={invoice.date} />

      <div className="doc-grid2">
        {patient ? <PatientBox patient={patient} /> : <div className="doc-box">—</div>}
        <div className="doc-box">
          <div className="t">تفاصيل الفاتورة</div>
          <div className="v" style={{ color: "#0d7c74" }}>{stamp}</div>
          <div style={{ fontSize: ".72rem", color: "#587377", marginTop: 3 }}>
            طريقة الدفع: {PAYMENT_METHOD_LABEL[invoice.method] ?? invoice.method}
            <br />
            {invoice.paid > 0 ? `المدفوع: ${fmtMoney(invoice.paid, settings.currency)}` : "لم يُسدد أي مبلغ بعد"}
            {remaining > 0 ? ` · المتبقي: ${fmtMoney(remaining, settings.currency)}` : ""}
          </div>
        </div>
      </div>

      <table className="doc-table">
        <thead>
          <tr>
            <th style={{ width: 34 }}>#</th>
            <th>البيان</th>
            <th style={{ width: 50 }}>الكمية</th>
            <th style={{ width: 90 }}>السعر</th>
            <th style={{ width: 100 }}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, i) => (
            <tr key={it.id}>
              <td>{i + 1}</td>
              <td>{it.desc}</td>
              <td>{it.qty}</td>
              <td>{fmtNum(it.price)}</td>
              <td>{fmtNum(it.price * it.qty)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} style={{ textAlign: "end" }}>الإجمالي قبل الخصم</td>
            <td>{fmtMoney(t.subtotal, settings.currency)}</td>
          </tr>
          {invoice.discount > 0 ? (
            <tr>
              <td colSpan={4} style={{ textAlign: "end" }}>الخصم</td>
              <td>− {fmtMoney(invoice.discount, settings.currency)}</td>
            </tr>
          ) : null}
          {invoice.taxRate > 0 ? (
            <tr>
              <td colSpan={4} style={{ textAlign: "end" }}>ضريبة ({invoice.taxRate}%)</td>
              <td>{fmtMoney(t.tax, settings.currency)}</td>
            </tr>
          ) : null}
          <tr>
            <td colSpan={4} style={{ textAlign: "end", fontSize: ".82rem" }}>الإجمالي المستحق</td>
            <td style={{ fontSize: ".88rem", color: "#0d7c74" }}>{fmtMoney(t.total, settings.currency)}</td>
          </tr>
        </tfoot>
      </table>

      {invoice.notes ? <div className="doc-note">{invoice.notes}</div> : null}

      <div className="doc-sign">
        <div>
          <div className="line" />
          <span>توقيع المحاسب</span>
        </div>
        <div>
          <div className="line" />
          <span>{settings.doctorName}</span>
        </div>
      </div>

      <div className="doc-foot">
        {settings.clinicName} · {settings.address} · {settings.phone} — شكرًا لثقتك بنا، نتمنى لك الشفاء العاجل.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ prescription */
export function PrescriptionDoc({
  prescription,
  patient,
  settings,
}: {
  prescription: Prescription;
  patient?: Patient;
  settings: Settings;
}) {
  return (
    <div className="doc-sheet">
      <DocHeader settings={settings} kind="وصفة طبية" number={prescription.number} date={prescription.date} />

      <div className="doc-grid2">
        {patient ? <PatientBox patient={patient} /> : <div className="doc-box">—</div>}
        <div className="doc-box">
          <div className="t">التشخيص</div>
          <div className="v">{prescription.diagnosis || "—"}</div>
          {patient?.allergies?.length ? (
            <div style={{ marginTop: 5, fontSize: ".7rem", color: "#b23d3d", fontWeight: 700 }}>
              ⚠ حساسية معروفة: {patient.allergies.join("، ")}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 6px" }}>
        <span className="rx-symbol">℞</span>
        <b style={{ fontSize: ".86rem" }}>الأدوية الموصوفة</b>
      </div>

      <table className="doc-table">
        <thead>
          <tr>
            <th style={{ width: 30 }}>#</th>
            <th>الدواء</th>
            <th>الجرعة</th>
            <th>التكرار</th>
            <th>المدة</th>
            <th>طريقة الاستخدام</th>
          </tr>
        </thead>
        <tbody>
          {prescription.items.map((it, i) => (
            <tr key={it.id}>
              <td>{i + 1}</td>
              <td>
                <b>{it.name}</b>
                <div style={{ fontSize: ".68rem", color: "#587377" }}>{it.form}</div>
                {it.notes ? <div style={{ fontSize: ".66rem", color: "#b8892b" }}>{it.notes}</div> : null}
              </td>
              <td>{it.dose}</td>
              <td>{it.frequency}</td>
              <td>{it.duration}</td>
              <td>{it.route}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {prescription.advice ? (
        <>
          <div style={{ marginTop: 12, fontSize: ".72rem", fontWeight: 700, color: "#587377" }}>إرشادات عامة</div>
          <div className="doc-note" style={{ marginTop: 4 }}>{prescription.advice}</div>
        </>
      ) : null}

      <div className="doc-sign">
        <div>
          <div className="line" />
          <span>ختم العيادة</span>
        </div>
        <div>
          <div className="line" />
          <span>{settings.doctorName} — {settings.specialty}</span>
        </div>
      </div>

      <div className="doc-foot">
        هذه الوصفة صادرة إلكترونيًا من {settings.clinicName}. يُرجى الالتزام بالجرعات المحددة ومراجعة الطبيب عند ظهور أي أعراض غير معتادة.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- visit sheet */
export function VisitDoc({
  visit,
  patient,
  settings,
}: {
  visit: Visit;
  patient?: Patient;
  settings: Settings;
}) {
  const v = visit.vitals;
  const b = bmi(v.weight, v.height);
  return (
    <div className="doc-sheet">
      <DocHeader settings={settings} kind="تقرير زيارة طبية" number={visit.id.slice(-6).toUpperCase()} date={visit.date} />
      {patient ? <PatientBox patient={patient} /> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, margin: "12px 0" }}>
        {[
          { l: "الحرارة", v: v.temp ? `${v.temp}°` : "—" },
          { l: "ضغط الدم", v: v.bpSys ? `${v.bpSys}/${v.bpDia}` : "—" },
          { l: "النبض", v: v.pulse ? `${v.pulse} ن/د` : "—" },
          { l: "الأكسجين", v: v.spo2 ? `${v.spo2}%` : "—" },
          { l: "الوزن", v: v.weight ? `${v.weight} كجم` : "—" },
          { l: "الطول", v: v.height ? `${v.height} سم` : "—" },
          { l: "الكتلة", v: b ?? "—" },
          { l: "التقييم", v: bmiLabel(b) },
        ].map((x) => (
          <div className="doc-box" key={x.l} style={{ padding: "7px 9px" }}>
            <div className="t">{x.l}</div>
            <div className="v" style={{ fontSize: ".78rem" }}>{x.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 9 }}>
        <div>
          <b style={{ fontSize: ".78rem", color: "#0a5f5a" }}>الشكوى الرئيسية</b>
          <p style={{ fontSize: ".78rem", marginTop: 2 }}>{visit.chiefComplaint}</p>
        </div>
        {visit.history ? (
          <div>
            <b style={{ fontSize: ".78rem", color: "#0a5f5a" }}>التاريخ المرضي</b>
            <p style={{ fontSize: ".78rem", marginTop: 2 }}>{visit.history}</p>
          </div>
        ) : null}
        {visit.examination ? (
          <div>
            <b style={{ fontSize: ".78rem", color: "#0a5f5a" }}>الفحص الإكلينيكي</b>
            <p style={{ fontSize: ".78rem", marginTop: 2 }}>{visit.examination}</p>
          </div>
        ) : null}
        <div>
          <b style={{ fontSize: ".78rem", color: "#0a5f5a" }}>التشخيص</b>
          <p style={{ fontSize: ".78rem", marginTop: 2 }}>
            {visit.diagnosis.join(" — ")}
            {visit.icd ? ` (${visit.icd})` : ""}
          </p>
        </div>
        {visit.plan ? (
          <div className="doc-note">
            <b style={{ fontSize: ".76rem" }}>خطة العلاج: </b>
            <span style={{ fontSize: ".76rem" }}>{visit.plan}</span>
          </div>
        ) : null}
        {visit.followUpDate ? (
          <div style={{ fontSize: ".76rem" }}>
            <b>موعد المتابعة المقترح:</b> {fmtDate(visit.followUpDate)}
          </div>
        ) : null}
      </div>

      <div className="doc-sign">
        <div>
          <div className="line" />
          <span>توقيع المريض</span>
        </div>
        <div>
          <div className="line" />
          <span>{settings.doctorName}</span>
        </div>
      </div>
      <div className="doc-foot">{settings.clinicName} · {settings.phone}</div>
    </div>
  );
}

/* ------------------------------------------------------------- doc preview */
export function DocPreview({
  open,
  onClose,
  title,
  filename,
  doc,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  filename: string;
  doc: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const doPdf = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      await exportPdf(ref.current, filename, title);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      sub="اطبع مباشرة أو صدّر نسخة PDF بنفس التنسيق"
      icon={<FileText size={18} />}
      size="lg"
      printing
      footer={
        <>
          <Button onClick={onClose}>إغلاق</Button>
          <Button onClick={doPdf} disabled={busy}>
            <Download size={15} /> {busy ? "جارٍ التصدير…" : "تصدير PDF"}
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            <Printer size={15} /> طباعة
          </Button>
        </>
      }
    >
      <div style={{ background: "var(--surface-3)", padding: 14, borderRadius: 12, margin: -4 }}>
        <div ref={ref}>
          <div style={{ background: "#fff", borderRadius: 4, overflow: "hidden" }}>{doc}</div>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------- misc */
export function DocRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="row-between" style={{ padding: "5px 0", borderBottom: "1px dashed var(--line)", fontSize: ".8rem" }}>
      <span className="muted">{label}</span>
      <span className="strong">{value}</span>
    </div>
  );
}

export function timeText(t: string) {
  return to12h(t);
}
