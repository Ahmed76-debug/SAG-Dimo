import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CalendarPlus,
  Download,
  Droplet,
  Phone,
  Plus,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Modal, PageHead, SearchInput } from "@/components/ui";
import type { Gender, Patient } from "@/lib/types";
import { ageFrom, downloadText, fmtDate, genCode, genNumber, toCSV, todayISO, uid } from "@/lib/utils";

const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function emptyPatient(code: string): Patient {
  return {
    id: "",
    code,
    name: "",
    phone: "",
    gender: "male",
    birthDate: "1990-01-01",
    bloodType: "O+",
    allergies: [],
    chronic: [],
    tags: ["جديد"],
    createdAt: todayISO(),
  };
}

export default function Patients() {
  const { db, save, remove, toast } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [gender, setGender] = useState<"all" | Gender>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [editing, setEditing] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState<Patient | null>(null);
  const [showForm, setShowForm] = useState(params.get("new") === "1");

  const nextCode = genCode("PT", db.patients.length + 1);

  const openNew = () => {
    setEditing(emptyPatient(nextCode));
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    if (params.get("new")) {
      params.delete("new");
      setParams(params, { replace: true });
    }
  };

  React.useEffect(() => {
    if (params.get("new") === "1") {
      setEditing(emptyPatient(nextCode));
      setShowForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const tags = useMemo(() => {
    const s = new Set<string>();
    db.patients.forEach((p) => p.tags.forEach((t) => s.add(t)));
    return Array.from(s);
  }, [db.patients]);

  const filtered = useMemo(() => {
    const term = q.trim();
    return db.patients
      .filter((p) => {
        if (term && !(p.name.includes(term) || p.phone.includes(term) || p.code.toLowerCase().includes(term.toLowerCase())))
          return false;
        if (gender !== "all" && p.gender !== gender) return false;
        if (tagFilter !== "all" && !p.tags.includes(tagFilter)) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db.patients, q, gender, tagFilter]);

  const lastVisitOf = (patientId: string) => {
    const vs = db.visits.filter((v) => v.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date));
    return vs[0];
  };

  const onSave = (p: Patient) => {
    if (!p.name.trim() || !p.phone.trim()) {
      toast("الاسم ورقم الهاتف مطلوبان", "err");
      return;
    }
    const isNew = !p.id;
    const rec: Patient = { ...p, id: p.id || uid("pat"), createdAt: p.createdAt || todayISO() };
    save("patients", rec);
    toast(isNew ? "تم تسجيل المريض بنجاح" : "تم تحديث بيانات المريض");
    closeForm();
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["الكود", "الاسم", "الهاتف", "النوع", "تاريخ الميلاد", "فصيلة الدم", "الأمراض المزمنة", "الحساسية", "العنوان", "التأمين"],
      ...filtered.map((p) => [
        p.code,
        p.name,
        p.phone,
        p.gender === "male" ? "ذكر" : "أنثى",
        p.birthDate,
        p.bloodType ?? "",
        p.chronic.join(" / "),
        p.allergies.join(" / "),
        p.address ?? "",
        p.insurance ?? "",
      ]),
    ];
    downloadText(`patients-${todayISO()}.csv`, toCSV(rows), "text/csv;charset=utf-8");
    toast("تم تصدير قائمة المرضى");
  };

  const chronicCount = db.patients.filter((p) => p.chronic.length).length;
  const newThisMonth = db.patients.filter((p) => p.createdAt.slice(0, 7) === todayISO().slice(0, 7)).length;

  return (
    <>
      <PageHead
        title="المرضى"
        sub={`${db.patients.length} ملف مريض مسجل بالعيادة`}
        actions={
          <>
            <Button onClick={exportCsv}>
              <Download size={15} /> تصدير
            </Button>
            <Button variant="primary" onClick={openNew}>
              <UserPlus size={16} /> مريض جديد
            </Button>
          </>
        }
      />

      <div className="grid grid-4 mb-16">
        {[
          { label: "إجمالي المرضى", value: db.patients.length, icon: <Users size={18} />, tone: "var(--primary)", bg: "var(--primary-soft)" },
          { label: "ملفات مزمنة", value: chronicCount, icon: <Activity size={18} />, tone: "var(--warn)", bg: "var(--warn-soft)" },
          { label: "مسجلون هذا الشهر", value: newThisMonth, icon: <UserPlus size={18} />, tone: "var(--info)", bg: "var(--info-soft)" },
          { label: "حساسية دوائية", value: db.patients.filter((p) => p.allergies.length).length, icon: <Droplet size={18} />, tone: "var(--danger)", bg: "var(--danger-soft)" },
        ].map((s) => (
          <div className="stat" key={s.label} style={{ padding: "13px 15px", "--stat-tint": s.bg, "--stat-color": s.tone } as React.CSSProperties}>
            <div className="row gap-8">
              <div className="stat-ico" style={{ width: 32, height: 32, borderRadius: 9 }}>{s.icon}</div>
              <div>
                <div className="stat-label" style={{ marginTop: 0 }}>{s.label}</div>
                <div className="stat-value num" style={{ fontSize: "1.3rem" }}>{s.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <div className="toolbar">
          <div className="searchbar" style={{ maxWidth: 300 }}>
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم، الهاتف أو رقم الملف…" />
          </div>
          <select className="select" style={{ width: 130 }} value={gender} onChange={(e) => setGender(e.target.value as any)}>
            <option value="all">كل الأنواع</option>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
          <select className="select" style={{ width: 150 }} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="all">كل التصنيفات</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div className="spacer" />
          <span className="tiny muted">{filtered.length} نتيجة</span>
        </div>

        {filtered.length ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>المريض</th>
                  <th>الهاتف</th>
                  <th>العمر / النوع</th>
                  <th>الدم</th>
                  <th>الملف الطبي</th>
                  <th>آخر زيارة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const lv = lastVisitOf(p.id);
                  return (
                    <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/patients/${p.id}`)}>
                      <td>
                        <div className="cell-main">
                          <Avatar name={p.name} />
                          <div>
                            <div className="strong" style={{ fontSize: ".86rem" }}>{p.name}</div>
                            <div className="tiny muted">{p.code} · {p.job ?? "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="num tiny" dir="ltr" style={{ textAlign: "right" }}>{p.phone}</td>
                      <td className="small">
                        {ageFrom(p.birthDate) ?? "—"} سنة · {p.gender === "male" ? "ذكر" : "أنثى"}
                      </td>
                      <td>
                        <Badge tone="danger" dot>{p.bloodType ?? "—"}</Badge>
                      </td>
                      <td>
                        <div className="row gap-4" style={{ flexWrap: "wrap" }}>
                          {p.chronic.slice(0, 1).map((c) => (
                            <Badge key={c} tone="warn">{c}</Badge>
                          ))}
                          {p.allergies.length ? <Badge tone="danger">حساسية</Badge> : null}
                          {!p.chronic.length && !p.allergies.length ? <span className="muted tiny">سليم</span> : null}
                        </div>
                      </td>
                      <td className="tiny muted">{lv ? fmtDate(lv.date) : "—"}</td>
                      <td className="actions" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/patients/${p.id}`)}>
                          الملف <ArrowLeft size={13} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Users size={24} />}
            title="لا يوجد مرضى مطابقون"
            desc="جرّب تعديل كلمة البحث أو أضف ملف مريض جديد."
            action={<Button variant="primary" onClick={openNew}><Plus size={15} /> إضافة مريض</Button>}
          />
        )}
      </Card>

      {editing ? (
        <PatientForm
          open={showForm}
          patient={editing}
          onClose={closeForm}
          onSave={onSave}
          onDelete={editing.id ? () => { setDeleting(editing); closeForm(); } : undefined}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        title="حذف ملف المريض"
        message={`سيتم حذف ملف «${deleting?.name}» وكل ما يخصه من بيانات العرض. لا يمكن التراجع عن هذه الخطوة.`}
        confirmLabel="حذف نهائي"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            remove("patients", deleting.id);
            toast("تم حذف ملف المريض", "err");
          }
          setDeleting(null);
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------- form */
function PatientForm({
  open,
  patient,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  patient: Patient;
  onClose: () => void;
  onSave: (p: Patient) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<Patient>(patient);
  const [allergyText, setAllergyText] = useState(patient.allergies.join("، "));
  const [chronicText, setChronicText] = useState(patient.chronic.join("، "));
  const [tagText, setTagText] = useState(patient.tags.join("، "));

  const set = <K extends keyof Patient>(k: K, v: Patient[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    onSave({
      ...form,
      allergies: allergyText.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
      chronic: chronicText.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
      tags: tagText.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<UserPlus size={18} />}
      title={patient.id ? "تعديل ملف المريض" : "تسجيل مريض جديد"}
      sub={patient.id ? `${patient.code} — تحديث البيانات الأساسية` : `سيتم إنشاء رقم ملف ${patient.code}`}
      footer={
        <>
          {onDelete ? (
            <Button variant="danger-soft" onClick={onDelete} style={{ marginInlineEnd: "auto" }}>
              <X size={14} /> حذف الملف
            </Button>
          ) : null}
          <Button onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={submit}>
            {patient.id ? "حفظ التعديلات" : "تسجيل المريض"}
          </Button>
        </>
      }
    >
      <div className="grid grid-2 gap-12">
        <Field label="الاسم الكامل" required>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="مثال: أحمد محمود عبد الرحمن" />
        </Field>
        <Field label="رقم الهاتف" required>
          <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01xxxxxxxxx" dir="ltr" style={{ textAlign: "right" }} />
        </Field>
        <Field label="النوع">
          <select className="select" value={form.gender} onChange={(e) => set("gender", e.target.value as Gender)}>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
        </Field>
        <Field label="تاريخ الميلاد">
          <input className="input" type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
        </Field>
        <Field label="فصيلة الدم">
          <select className="select" value={form.bloodType ?? ""} onChange={(e) => set("bloodType", e.target.value)}>
            <option value="">غير محددة</option>
            {BLOOD.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="الرقم القومي">
          <input className="input" value={form.nationalId ?? ""} onChange={(e) => set("nationalId", e.target.value)} dir="ltr" style={{ textAlign: "right" }} />
        </Field>
        <Field label="الوظيفة">
          <input className="input" value={form.job ?? ""} onChange={(e) => set("job", e.target.value)} />
        </Field>
        <Field label="التأمين الطبي">
          <input className="input" value={form.insurance ?? ""} onChange={(e) => set("insurance", e.target.value)} placeholder="اسم شركة التأمين أو اتركه فارغًا" />
        </Field>
        <Field label="العنوان" className="grid-span-2">
          <input className="input" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="الأمراض المزمنة" hint="افصل بينها بفاصلة">
          <input className="input" value={chronicText} onChange={(e) => setChronicText(e.target.value)} placeholder="ارتفاع ضغط الدم، السكري" />
        </Field>
        <Field label="الحساسية الدوائية" hint="مهم قبل كتابة أي وصفة">
          <input className="input" value={allergyText} onChange={(e) => setAllergyText(e.target.value)} placeholder="البنسلين، الأسبرين" />
        </Field>
        <Field label="تصنيفات الملف" hint="مثال: متابعة دورية، مزمن، جديد">
          <input className="input" value={tagText} onChange={(e) => setTagText(e.target.value)} />
        </Field>
        <Field label="ملاحظات">
          <input className="input" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
