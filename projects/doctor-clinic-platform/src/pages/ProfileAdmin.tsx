import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  BadgeCheck,
  BookOpen,
  BriefcaseMedical,
  ExternalLink,
  GraduationCap,
  Languages,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Stethoscope,
  Trash2,
  UserRound,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Badge, Button, Card, Field, PageHead } from "@/components/ui";
import type { DoctorProfile } from "@/lib/types";
import { fmtMoney } from "@/lib/utils";

const ICON_OPTIONS = [
  { key: "stethoscope", label: "فحص عام" },
  { key: "heart", label: "قلب" },
  { key: "baby", label: "أطفال" },
  { key: "brain", label: "مخ وأعصاب" },
  { key: "bone", label: "عظام" },
  { key: "syringe", label: "تحصين" },
  { key: "activity", label: "متابعة" },
  { key: "file", label: "تقارير" },
];

function clone(p: DoctorProfile): DoctorProfile {
  return JSON.parse(JSON.stringify(p)) as DoctorProfile;
}

export default function ProfileAdmin() {
  const { db, setDb, toast } = useApp();
  const [form, setForm] = useState<DoctorProfile>(() => clone(db.profile));
  const [tab, setTab] = useState<"basic" | "about" | "services" | "credentials">("basic");

  const set = <K extends keyof DoctorProfile>(key: K, value: DoctorProfile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const dirty = JSON.stringify(form) !== JSON.stringify(db.profile);

  const saveForm = () => {
    if (!form.name.trim() || !form.title.trim()) {
      toast("اسم الطبيب والمسمى المهني مطلوبان", "err");
      return;
    }
    setDb((prev) => ({ ...prev, profile: clone(form) }));
    toast("تم حفظ الملف التعريفي وتحديث الصفحة العامة");
  };

  const resetForm = () => {
    setForm(clone(db.profile));
    toast("تم التراجع عن التعديلات غير المحفوظة", "info");
  };

  const addEdu = () => set("education", [...form.education, { year: "", title: "", place: "" }]);
  const editEdu = (i: number, key: "year" | "title" | "place", v: string) =>
    set("education", form.education.map((e, idx) => (idx === i ? { ...e, [key]: v } : e)));
  const delEdu = (i: number) => set("education", form.education.filter((_, idx) => idx !== i));

  const addCert = () => set("certifications", [...form.certifications, { year: "", title: "", org: "" }]);
  const editCert = (i: number, key: "year" | "title" | "org", v: string) =>
    set("certifications", form.certifications.map((e, idx) => (idx === i ? { ...e, [key]: v } : e)));
  const delCert = (i: number) => set("certifications", form.certifications.filter((_, idx) => idx !== i));

  const addService = () =>
    set("services", [...form.services, { icon: "stethoscope", title: "", desc: "", price: undefined }]);
  const editService = (i: number, patch: Partial<DoctorProfile["services"][number]>) =>
    set("services", form.services.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const delService = (i: number) => set("services", form.services.filter((_, idx) => idx !== i));

  const addAward = () => set("awards", [...form.awards, { year: "", title: "" }]);
  const editAward = (i: number, key: "year" | "title", v: string) =>
    set("awards", form.awards.map((a, idx) => (idx === i ? { ...a, [key]: v } : a)));
  const delAward = (i: number) => set("awards", form.awards.filter((_, idx) => idx !== i));

  const tabs: { key: typeof tab; label: string; icon: React.ReactNode }[] = [
    { key: "basic", label: "البيانات الأساسية", icon: <UserRound size={14} /> },
    { key: "about", label: "نبذة ومؤهلات", icon: <BookOpen size={14} /> },
    { key: "services", label: "الخدمات والأسعار", icon: <Stethoscope size={14} /> },
    { key: "credentials", label: "العضويات والجوائز", icon: <Award size={14} /> },
  ];

  return (
    <>
      <PageHead
        title="الملف التعريفي للطبيب"
        sub="كل ما تعدّله هنا يظهر مباشرة في الصفحة العامة التي يراها المرضى."
        eyebrow="الصفحة العامة"
        actions={
          <>
            <Link to="/doctor" target="_blank" className="btn btn-sm">
              <ExternalLink size={14} /> معاينة عامة
            </Link>
            <Button size="sm" onClick={resetForm} disabled={!dirty}>
              <RotateCcw size={14} /> تراجع
            </Button>
            <Button size="sm" variant="primary" onClick={saveForm} disabled={!dirty}>
              <Save size={14} /> حفظ التغييرات
            </Button>
          </>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", alignItems: "start" }}>
        <div>
          <div className="tabs mb-16">
            {tabs.map((t) => (
              <button key={t.key} className={`tab ${tab === t.key ? "on" : ""}`} onClick={() => setTab(t.key)}>
                <span className="row gap-6">{t.icon} {t.label}</span>
              </button>
            ))}
          </div>

          {tab === "basic" ? (
            <Card className="card-pad">
              <div className="row gap-12 mb-16">
                <div
                  className="pf-photo"
                  style={{ width: 58, height: 58, fontSize: "1.2rem", borderRadius: 16, flex: "0 0 auto" }}
                >
                  {form.photoInitials || "ط ب"}
                </div>
                <div className="grow">
                  <b className="small">الهوية البصرية</b>
                  <div className="tiny muted">تظهر الأحرف الأولى في الصفحة العامة وفي بطاقة الطبيب.</div>
                </div>
              </div>

              <div className="grid grid-2 gap-12">
                <Field label="اسم الطبيب" required>
                  <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label="المسمى المهني" required>
                  <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} />
                </Field>
                <Field label="التخصص">
                  <input className="input" value={form.specialty} onChange={(e) => set("specialty", e.target.value)} />
                </Field>
                <Field label="التخصص الدقيق">
                  <input
                    className="input"
                    value={form.subSpecialty}
                    onChange={(e) => set("subSpecialty", e.target.value)}
                  />
                </Field>
                <Field label="سنوات الخبرة">
                  <input
                    className="input"
                    type="number"
                    value={form.experienceYears}
                    onChange={(e) => set("experienceYears", Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="عدد المرضى (نص عرض)">
                  <input
                    className="input"
                    value={form.patientsCount}
                    onChange={(e) => set("patientsCount", e.target.value)}
                    placeholder="+12,000"
                  />
                </Field>
                <Field label="التقييم العام" hint="من 5">
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    max={5}
                    value={form.rating}
                    onChange={(e) => set("rating", Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="عدد التقييمات">
                  <input
                    className="input"
                    type="number"
                    value={form.reviewsCount}
                    onChange={(e) => set("reviewsCount", Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="الأحرف الأولى للصورة" hint="حرفان أو ثلاثة">
                  <input
                    className="input"
                    value={form.photoInitials}
                    onChange={(e) => set("photoInitials", e.target.value)}
                    maxLength={4}
                  />
                </Field>
                <Field label="الرابط العام (slug)" hint="يستخدم في رابط الصفحة التعريفية">
                  <input
                    className="input"
                    dir="ltr"
                    style={{ textAlign: "right" }}
                    value={form.publicSlug}
                    onChange={(e) => set("publicSlug", e.target.value.replace(/\s+/g, "-").toLowerCase())}
                  />
                </Field>
              </div>

              <div className="divider" />
              <Field label="اللغات" hint="افصل بين اللغات بفاصلة">
                <input
                  className="input"
                  value={form.languages.join("، ")}
                  onChange={(e) =>
                    set(
                      "languages",
                      e.target.value
                        .split(/[،,]/)
                        .map((x) => x.trim())
                        .filter(Boolean)
                    )
                  }
                />
              </Field>
              <div className="row gap-6 mt-8 wrap">
                {form.languages.map((l) => (
                  <Badge key={l} tone="line">
                    <Languages size={11} /> {l}
                  </Badge>
                ))}
              </div>
            </Card>
          ) : null}

          {tab === "about" ? (
            <Card className="card-pad">
              <Field label="نبذة عن الطبيب">
                <textarea
                  className="textarea"
                  style={{ minHeight: 110 }}
                  value={form.bio}
                  onChange={(e) => set("bio", e.target.value)}
                />
              </Field>
              <div className="mt-12">
                <Field label="فلسفة الرعاية" hint="جملة أو فقرة قصيرة تظهر في الصفحة العامة">
                  <textarea
                    className="textarea"
                    style={{ minHeight: 90 }}
                    value={form.philosophy}
                    onChange={(e) => set("philosophy", e.target.value)}
                  />
                </Field>
              </div>

              <div className="divider" />
              <div className="row-between mb-8">
                <div>
                  <b className="small">المؤهلات العلمية</b>
                  <div className="tiny muted">الدرجات والشهادات الجامعية.</div>
                </div>
                <Button size="sm" variant="soft" onClick={addEdu}>
                  <Plus size={13} /> إضافة
                </Button>
              </div>
              <div className="col gap-8">
                {form.education.map((e, i) => (
                  <div key={i} className="soft-box" style={{ padding: 10 }}>
                    <div className="row gap-8" style={{ alignItems: "flex-start" }}>
                      <div className="grid gap-8" style={{ gridTemplateColumns: "74px 1fr 1fr", flex: "1 1 auto" }}>
                        <input
                          className="input"
                          placeholder="السنة"
                          value={e.year}
                          onChange={(ev) => editEdu(i, "year", ev.target.value)}
                        />
                        <input
                          className="input"
                          placeholder="الدرجة العلمية"
                          value={e.title}
                          onChange={(ev) => editEdu(i, "title", ev.target.value)}
                        />
                        <input
                          className="input"
                          placeholder="الجامعة / الجهة"
                          value={e.place}
                          onChange={(ev) => editEdu(i, "place", ev.target.value)}
                        />
                      </div>
                      <Button size="sm" variant="danger-soft" onClick={() => delEdu(i)} aria-label="حذف">
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                ))}
                {!form.education.length ? (
                  <div className="tiny muted center" style={{ padding: 12 }}>
                    <GraduationCap size={18} style={{ marginBottom: 4 }} />
                    <div>لا توجد مؤهلات مسجلة بعد.</div>
                  </div>
                ) : null}
              </div>

              <div className="divider" />
              <div className="row-between mb-8">
                <div>
                  <b className="small">الشهادات والزمالات</b>
                  <div className="tiny muted">شهادات التخصص والاعتماد المهني.</div>
                </div>
                <Button size="sm" variant="soft" onClick={addCert}>
                  <Plus size={13} /> إضافة
                </Button>
              </div>
              <div className="col gap-8">
                {form.certifications.map((c, i) => (
                  <div key={i} className="soft-box" style={{ padding: 10 }}>
                    <div className="row gap-8" style={{ alignItems: "flex-start" }}>
                      <div className="grid gap-8" style={{ gridTemplateColumns: "74px 1fr 1fr", flex: "1 1 auto" }}>
                        <input
                          className="input"
                          placeholder="السنة"
                          value={c.year}
                          onChange={(ev) => editCert(i, "year", ev.target.value)}
                        />
                        <input
                          className="input"
                          placeholder="اسم الشهادة"
                          value={c.title}
                          onChange={(ev) => editCert(i, "title", ev.target.value)}
                        />
                        <input
                          className="input"
                          placeholder="الجهة المانحة"
                          value={c.org}
                          onChange={(ev) => editCert(i, "org", ev.target.value)}
                        />
                      </div>
                      <Button size="sm" variant="danger-soft" onClick={() => delCert(i)} aria-label="حذف">
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                ))}
                {!form.certifications.length ? (
                  <div className="tiny muted center" style={{ padding: 12 }}>
                    <BadgeCheck size={18} style={{ marginBottom: 4 }} />
                    <div>لا توجد شهادات مسجلة بعد.</div>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          {tab === "services" ? (
            <Card className="card-pad">
              <div className="row-between mb-12">
                <div>
                  <b className="small">الخدمات الطبية</b>
                  <div className="tiny muted">تظهر في الصفحة العامة وفي نموذج الحجز الإلكتروني.</div>
                </div>
                <Button size="sm" variant="soft" onClick={addService}>
                  <Plus size={13} /> خدمة جديدة
                </Button>
              </div>
              <div className="col gap-10">
                {form.services.map((s, i) => (
                  <div key={i} className="soft-box">
                    <div className="row-between mb-8">
                      <div className="row gap-6">
                        <Badge tone="primary">خدمة {i + 1}</Badge>
                        {s.price ? <Badge tone="ok">{fmtMoney(s.price, db.settings.currency)}</Badge> : null}
                      </div>
                      <Button size="sm" variant="danger-soft" onClick={() => delService(i)} aria-label="حذف">
                        <Trash2 size={13} />
                      </Button>
                    </div>
                    <div className="grid grid-2 gap-8">
                      <Field label="اسم الخدمة">
                        <input
                          className="input"
                          value={s.title}
                          onChange={(e) => editService(i, { title: e.target.value })}
                        />
                      </Field>
                      <Field label="الأيقونة">
                        <select
                          className="select"
                          value={s.icon}
                          onChange={(e) => editService(i, { icon: e.target.value })}
                        >
                          {ICON_OPTIONS.map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="الوصف">
                        <input
                          className="input"
                          value={s.desc}
                          onChange={(e) => editService(i, { desc: e.target.value })}
                        />
                      </Field>
                      <Field label="السعر (اختياري)">
                        <input
                          className="input"
                          type="number"
                          value={s.price ?? ""}
                          onChange={(e) =>
                            editService(i, { price: e.target.value ? Number(e.target.value) : undefined })
                          }
                        />
                      </Field>
                    </div>
                  </div>
                ))}
                {!form.services.length ? (
                  <div className="empty" style={{ padding: 24 }}>
                    <div className="empty-ico">
                      <Stethoscope size={22} />
                    </div>
                    <h4>لا توجد خدمات</h4>
                    <p>أضف خدمة واحدة على الأقل ليتمكن المرضى من الحجز.</p>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          {tab === "credentials" ? (
            <Card className="card-pad">
              <Field label="العضويات المهنية" hint="افصل بين العضويات بفاصلة">
                <textarea
                  className="textarea"
                  style={{ minHeight: 80 }}
                  value={form.memberships.join("، ")}
                  onChange={(e) =>
                    set(
                      "memberships",
                      e.target.value
                        .split(/[،,]/)
                        .map((x) => x.trim())
                        .filter(Boolean)
                    )
                  }
                />
              </Field>
              <div className="row gap-6 mt-8 wrap">
                {form.memberships.map((m) => (
                  <Badge key={m} tone="info">
                    <BriefcaseMedical size={11} /> {m}
                  </Badge>
                ))}
              </div>

              <div className="divider" />
              <div className="row-between mb-8">
                <div>
                  <b className="small">الجوائز والتكريمات</b>
                  <div className="tiny muted">تظهر في قسم منفصل بالصفحة التعريفية.</div>
                </div>
                <Button size="sm" variant="soft" onClick={addAward}>
                  <Plus size={13} /> إضافة
                </Button>
              </div>
              <div className="col gap-8">
                {form.awards.map((a, i) => (
                  <div key={i} className="row gap-8">
                    <input
                      className="input"
                      style={{ width: 86, flex: "0 0 auto" }}
                      placeholder="السنة"
                      value={a.year}
                      onChange={(e) => editAward(i, "year", e.target.value)}
                    />
                    <input
                      className="input grow"
                      placeholder="اسم الجائزة أو التكريم"
                      value={a.title}
                      onChange={(e) => editAward(i, "title", e.target.value)}
                    />
                    <Button size="sm" variant="danger-soft" onClick={() => delAward(i)} aria-label="حذف">
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
                {!form.awards.length ? (
                  <div className="tiny muted center" style={{ padding: 12 }}>
                    <Award size={18} style={{ marginBottom: 4 }} />
                    <div>لا توجد جوائز مسجلة بعد.</div>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>

        {/* live preview */}
        <div className="col gap-12" style={{ position: "sticky", top: 82 }}>
          <Card style={{ overflow: "hidden" }}>
            <div
              style={{
                background: "linear-gradient(135deg,#0a5f5a,#0d7c74 55%,#12a79a)",
                padding: "18px 16px",
                color: "#fff",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 80% 0%, rgba(255,255,255,.16), transparent 60%)" }} />
              <div className="row gap-10" style={{ position: "relative" }}>
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 15,
                    background: "rgba(255,255,255,.18)",
                    border: "1px solid rgba(255,255,255,.28)",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: "1rem",
                    flex: "0 0 auto",
                  }}
                >
                  {form.photoInitials || "ط ب"}
                </div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: ".95rem" }} className="truncate">
                    {form.name || "اسم الطبيب"}
                  </div>
                  <div style={{ fontSize: ".72rem", opacity: 0.85 }} className="truncate">
                    {form.title || "المسمى المهني"}
                  </div>
                </div>
              </div>
              <div className="row gap-6 wrap" style={{ marginTop: 12, position: "relative" }}>
                <span className="badge" style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}>
                  <Sparkles size={11} /> {form.experienceYears} سنة خبرة
                </span>
                <span className="badge" style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}>
                  ★ {form.rating} ({form.reviewsCount})
                </span>
              </div>
            </div>
            <div className="card-pad" style={{ padding: 14 }}>
              <div className="tiny muted">التخصص</div>
              <div className="small strong">{form.specialty || "—"}</div>
              <div className="divider" style={{ margin: "10px 0" }} />
              <div className="tiny muted">عدد الخدمات</div>
              <div className="small strong">{form.services.length} خدمة</div>
              <div className="divider" style={{ margin: "10px 0" }} />
              <div className="tiny muted">الرابط العام</div>
              <div className="tiny mono truncate" dir="ltr" style={{ textAlign: "right", color: "var(--primary)" }}>
                /{form.publicSlug || "doctor"}
              </div>
            </div>
          </Card>

          {dirty ? (
            <div className="alert alert-warn">
              <Save size={15} />
              <div className="grow">
                <div className="strong small">لديك تغييرات غير محفوظة</div>
                <div className="tiny">اضغط «حفظ التغييرات» لتحديث الصفحة العامة.</div>
              </div>
            </div>
          ) : (
            <div className="alert alert-ok">
              <BadgeCheck size={15} />
              <span>كل التغييرات محفوظة ومتزامنة مع الصفحة العامة.</span>
            </div>
          )}

          <div className="soft-box">
            <div className="row gap-8">
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
                <Sparkles size={15} />
              </div>
              <div>
                <div className="small strong">نصيحة</div>
                <div className="tiny muted" style={{ lineHeight: 1.7 }}>
                  صورة واضحة ونبذة مختصرة تزيد نسبة الحجز الإلكتروني بشكل ملحوظ.
                </div>
              </div>
            </div>
          </div>

          <Button variant="primary" className="btn-block" onClick={saveForm} disabled={!dirty}>
            <Save size={15} /> حفظ التغييرات
          </Button>
        </div>
      </div>

      <div className="mt-16 center tiny muted">
        آخر تحديث للصفحة العامة يظهر فورًا بعد الحفظ — جرّب <Link to="/doctor" target="_blank" style={{ color: "var(--primary)" }}>المعاينة</Link>.
      </div>
    </>
  );
}
