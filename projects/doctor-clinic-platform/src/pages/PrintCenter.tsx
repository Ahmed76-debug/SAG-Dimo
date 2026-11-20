import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, FileText, Printer, Receipt, Stethoscope, ArrowLeft } from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Avatar, Badge, Button, Card, CardHead, PageHead } from "@/components/ui";
import { DocPreview, InvoiceDoc, PrescriptionDoc, VisitDoc } from "@/components/docs";
import type { Invoice, Prescription, Visit } from "@/lib/types";
import { fmtDate } from "@/lib/utils";

type Preview = { kind: "rx"; data: Prescription } | { kind: "invoice"; data: Invoice } | { kind: "visit"; data: Visit };

export default function PrintCenter() {
  const { db } = useApp();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Preview | null>(null);

  const prescriptions = [...db.prescriptions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const invoices = [...db.invoices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const visits = [...db.visits].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const doc = () => {
    if (!preview) return null;
    const p = db.patients.find((x) => x.id === preview.data.patientId);
    if (preview.kind === "rx")
      return {
        title: `وصفة ${preview.data.number}`,
        filename: `${preview.data.number}.pdf`,
        doc: <PrescriptionDoc prescription={preview.data} patient={p} settings={db.settings} />,
      };
    if (preview.kind === "invoice")
      return {
        title: `فاتورة ${preview.data.number}`,
        filename: `${preview.data.number}.pdf`,
        doc: <InvoiceDoc invoice={preview.data} patient={p} settings={db.settings} />,
      };
    return {
      title: `تقرير زيارة ${fmtDate(preview.data.date)}`,
      filename: `visit-${preview.data.date}.pdf`,
      doc: <VisitDoc visit={preview.data} patient={p} settings={db.settings} />,
    };
  };
  const d = doc();

  return (
    <>
      <PageHead
        title="مركز الطباعة"
        sub="اطبع أي مستند طبي مباشرة أو صدّره PDF بنفس التنسيق الاحترافي"
        actions={<Badge tone="ok" dot>جاهز للطباعة</Badge>}
      />

      <Card className="mb-16" style={{ overflow: "hidden" }}>
        <div
          style={{
            background: "linear-gradient(120deg,#0a5f5a,#0d7c74 50%,#12a79a)",
            color: "#fff",
            padding: "22px 24px",
          }}
        >
          <div className="row gap-16 wrap" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: "1.2rem" }}>طباعة ذكية… بدون فوضى</h2>
              <p style={{ color: "rgba(255,255,255,.82)", fontSize: ".85rem", marginTop: 4, maxWidth: 560, lineHeight: 1.8 }}>
                كل مستند مصمم على مقاس A4 بهوية العيادة، ويحتوي زرين منفصلين: <b>طباعة</b> للطابعة الورقية، و<b>تصدير PDF</b> لإرساله للمريض أو حفظه في الأرشيف.
              </p>
            </div>
            <div className="row gap-8">
              <div style={{ background: "rgba(255,255,255,.14)", borderRadius: 12, padding: "10px 14px", textAlign: "center", minWidth: 90 }}>
                <Printer size={18} />
                <div className="tiny" style={{ marginTop: 3 }}>طباعة مباشرة</div>
              </div>
              <div style={{ background: "rgba(255,255,255,.14)", borderRadius: 12, padding: "10px 14px", textAlign: "center", minWidth: 90 }}>
                <Download size={18} />
                <div className="tiny" style={{ marginTop: 3 }}>تصدير PDF</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-3">
        <Card>
          <CardHead
            icon={<FileText size={16} style={{ color: "var(--primary)" }} />}
            title="أحدث الوصفات"
            action={<Button size="sm" variant="ghost" onClick={() => navigate("/prescriptions")}>الكل <ArrowLeft size={12} /></Button>}
          />
          <div className="card-bd" style={{ paddingTop: 8 }}>
            {prescriptions.map((rx) => {
              const p = db.patients.find((x) => x.id === rx.patientId);
              return (
                <div key={rx.id} className="list-row">
                  <Avatar name={p?.name ?? "مريض"} size="sm" />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small strong truncate">{p?.name}</div>
                    <div className="meta">{rx.number} · {fmtDate(rx.date)}</div>
                  </div>
                  <Button size="sm" variant="soft" onClick={() => setPreview({ kind: "rx", data: rx })}>
                    <Printer size={12} />
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHead
            icon={<Receipt size={16} style={{ color: "var(--ok)" }} />}
            title="أحدث الفواتير"
            action={<Button size="sm" variant="ghost" onClick={() => navigate("/billing")}>الكل <ArrowLeft size={12} /></Button>}
          />
          <div className="card-bd" style={{ paddingTop: 8 }}>
            {invoices.map((inv) => {
              const p = db.patients.find((x) => x.id === inv.patientId);
              return (
                <div key={inv.id} className="list-row">
                  <Avatar name={p?.name ?? "مريض"} size="sm" />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small strong truncate">{p?.name}</div>
                    <div className="meta">{inv.number} · {fmtDate(inv.date)}</div>
                  </div>
                  <Button size="sm" variant="soft" onClick={() => setPreview({ kind: "invoice", data: inv })}>
                    <Printer size={12} />
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHead
            icon={<Stethoscope size={16} style={{ color: "var(--violet)" }} />}
            title="أحدث الزيارات"
            action={<Button size="sm" variant="ghost" onClick={() => navigate("/medical-records")}>الكل <ArrowLeft size={12} /></Button>}
          />
          <div className="card-bd" style={{ paddingTop: 8 }}>
            {visits.map((v) => {
              const p = db.patients.find((x) => x.id === v.patientId);
              return (
                <div key={v.id} className="list-row">
                  <Avatar name={p?.name ?? "مريض"} size="sm" />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small strong truncate">{p?.name}</div>
                    <div className="meta">{fmtDate(v.date)} · {v.diagnosis[0]}</div>
                  </div>
                  <Button size="sm" variant="soft" onClick={() => setPreview({ kind: "visit", data: v })}>
                    <Printer size={12} />
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {d ? <DocPreview open onClose={() => setPreview(null)} title={d.title} filename={d.filename} doc={d.doc} /> : null}
    </>
  );
}
