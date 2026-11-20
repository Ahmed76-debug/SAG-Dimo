import React, { useRef, useState } from "react";
import {
  Building2,
  CalendarClock,
  Check,
  Clock,
  Cloud,
  CreditCard,
  Database,
  Download,
  FileJson,
  FolderOpen,
  Globe,
  KeyRound,
  Lock,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Settings as SettingsIcon,
  ShieldCheck,
  Upload,
  UploadCloud,
  Wallet,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Badge, Button, Card, CardHead, ConfirmDialog, Field, Modal, PageHead, Tabs } from "@/components/ui";
import {
  buildBackup,
  nativeFilePickersSupported,
  nativeFolderPickerSupported,
  pickBackupFile,
  pickBackupFromFolder,
  readBackupFile,
  saveBackupFile,
  type ParsedBackup,
} from "@/lib/backup";
import { clinicBackupToSql, downloadSqlFile } from "@/lib/sql";
import type { Settings as SettingsType, WorkingDay } from "@/lib/types";

type Tab = "clinic" | "booking" | "payments" | "hours" | "cloud" | "data";

const CLOUD_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "line" }> = {
  local: { label: "محلي", tone: "line" },
  connecting: { label: "جارٍ الاتصال", tone: "warn" },
  online: { label: "متصل", tone: "ok" },
  syncing: { label: "جارٍ المزامنة", tone: "warn" },
  error: { label: "تعذر الاتصال", tone: "danger" },
};

export default function Settings() {
  const {
    db,
    updateSettings,
    toast,
    resetDemo,
    theme,
    setTheme,
    cloud,
    syncNow,
    pullCloud,
    pushDemoToCloud,
    changePassword,
    restoreBackup,
    session,
    hasPerm,
  } = useApp();
  const [tab, setTab] = useState<Tab>("clinic");
  const [form, setForm] = useState<SettingsType>(db.settings);
  const [danger, setDanger] = useState(false);
  const [demoConfirm, setDemoConfirm] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<{
    backup: ParsedBackup;
    fileName: string;
    folderName?: string;
    folderCount?: number;
  } | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");

  const set = <K extends keyof SettingsType>(k: K, v: SettingsType[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const save = () => {
    updateSettings(form);
    setDirty(false);
    toast("تم حفظ إعدادات العيادة");
  };

  const setDay = (idx: number, patch: Partial<WorkingDay>) => {
    const days = form.workingDays.map((d, i) => (i === idx ? { ...d, ...patch } : d));
    set("workingDays", days);
  };

  const doSync = async () => {
    if (!cloud.enabled) return;
    setBusy(true);
    await syncNow();
    setBusy(false);
    toast("تمت مزامنة أحدث البيانات");
  };

  const doPull = async () => {
    if (!cloud.enabled) return;
    setBusy(true);
    await pullCloud();
    setBusy(false);
    toast("تم تحميل أحدث نسخة من السحابة");
  };

  const doPushDemo = async () => {
    setBusy(true);
    const res = await pushDemoToCloud();
    setBusy(false);
    setDemoConfirm(false);
    if (res.ok) toast("تم رفع بيانات العرض إلى السحابة");
    else toast(res.error ?? "تعذر رفع البيانات", "err");
  };

  const doBackup = async () => {
    setBackupBusy(true);
    try {
      const result = await saveBackupFile(buildBackup(db));
      if (result.status === "saved") {
        toast(
          result.location
            ? `تم حفظ النسخة «${result.fileName}» في مجلد ${result.location}`
            : `تم حفظ النسخة الاحتياطية «${result.fileName}»`
        );
      } else if (result.status === "downloaded") {
        toast(`تم تنزيل النسخة الاحتياطية «${result.fileName}»`);
      } else if (result.status === "cancelled") {
        toast("تم إلغاء حفظ النسخة الاحتياطية", "info");
      } else {
        toast(result.error || "تعذر حفظ النسخة الاحتياطية", "err");
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "تعذر حفظ النسخة الاحتياطية", "err");
    } finally {
      setBackupBusy(false);
    }
  };

  const loadRestoreFile = async (file: File, meta?: { folderName?: string; folderCount?: number }) => {
    const result = await readBackupFile(file);
    if (!result.ok) {
      toast(result.error, "err");
      return;
    }
    setRestoreCandidate({ backup: result.backup, fileName: file.name, ...meta });
  };

  const chooseRestoreFile = async () => {
    const picked = await pickBackupFile();
    if (picked.status === "opened") {
      await loadRestoreFile(picked.file);
      return;
    }
    if (picked.status === "unsupported") {
      restoreInputRef.current?.click();
      return;
    }
    if (picked.status === "error") toast(picked.error, "err");
  };

  const chooseRestoreFolder = async () => {
    if (restoreBusy) return;
    setRestoreBusy(true);
    try {
      const picked = await pickBackupFromFolder();
      if (picked.status === "opened") {
        await loadRestoreFile(picked.file, {
          folderName: picked.folderName,
          folderCount: picked.count,
        });
        return;
      }
      if (picked.status === "empty") {
        toast(
          `لم أجد أي ملف JSON داخل المجلد${picked.folderName ? ` «${picked.folderName}»` : ""}.`,
          "err"
        );
        return;
      }
      if (picked.status === "error") toast(picked.error, "err");
    } finally {
      setRestoreBusy(false);
    }
  };

  const doExportSql = () => {
    try {
      const sql = clinicBackupToSql(buildBackup(db));
      downloadSqlFile(sql, `tabib-${new Date().toISOString().slice(0, 10)}.sql`);
      toast("تم تصدير قاعدة البيانات بصيغة SQL");
    } catch (error) {
      toast(error instanceof Error ? error.message : "تعذر تصدير SQL", "err");
    }
  };

  const doRestore = async () => {
    if (!restoreCandidate || restoreBusy) return;
    setRestoreBusy(true);
    try {
      const result = await restoreBackup(restoreCandidate.backup.db);
      if (!result.ok) {
        toast(result.error ?? "تعذرت استعادة النسخة الاحتياطية", "err");
        return;
      }
      setForm(restoreCandidate.backup.db.settings);
      setDirty(false);
      setRestoreCandidate(null);
      toast(
        cloud.enabled
          ? "تمت استعادة بيانات العيادة إلى السحابة، وبقيت حسابات الدخول كما هي."
          : "تمت استعادة النسخة الاحتياطية بنجاح."
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "تعذرت استعادة النسخة الاحتياطية", "err");
    } finally {
      setRestoreBusy(false);
    }
  };

  const doChangePassword = async () => {
    if (pwd.length < 8) {
      toast("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "err");
      return;
    }
    if (pwd !== pwd2) {
      toast("كلمتا المرور غير متطابقتين", "err");
      return;
    }
    setBusy(true);
    const res = await changePassword(pwd);
    setBusy(false);
    if (res.ok) {
      setPwdOpen(false);
      setPwd("");
      setPwd2("");
      toast("تم تغيير كلمة المرور بأمان");
    } else {
      toast(res.error ?? "تعذر تغيير كلمة المرور", "err");
    }
  };

  const cloudMeta = CLOUD_STATUS[cloud.status] ?? CLOUD_STATUS.local;
  const nativePickers = nativeFilePickersSupported();
  const folderPicker = nativeFolderPickerSupported();
  const restoreCreatedLabel = (() => {
    const iso = restoreCandidate?.backup.createdAt;
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(date);
  })();

  return (
    <>
      <PageHead
        title="إعدادات العيادة"
        sub="كل ما يخص هوية العيادة، الحجز، الدفع وساعات العمل"
        actions={
          <>
            {dirty ? <Badge tone="warn" dot>تغييرات غير محفوظة</Badge> : null}
            <Button variant="primary" onClick={save} disabled={!dirty}>
              <Save size={15} /> حفظ الإعدادات
            </Button>
          </>
        }
      />

      <Card>
        <Tabs
          tabs={[
            { key: "clinic", label: "بيانات العيادة" },
            { key: "booking", label: "الحجز الإلكتروني" },
            { key: "payments", label: "المدفوعات" },
            { key: "hours", label: "ساعات العمل" },
            { key: "cloud", label: "السحابة والأمان" },
            { key: "data", label: "البيانات والمظهر" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />

        <div className="card-bd">
          {tab === "clinic" ? (
            <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
              <div className="col gap-12">
                <div className="row gap-8 mb-4">
                  <Building2 size={17} style={{ color: "var(--primary)" }} />
                  <b className="small">الهوية والبيانات الأساسية</b>
                </div>
                <div className="grid grid-2 gap-12">
                  <Field label="اسم العيادة"><input className="input" value={form.clinicName} onChange={(e) => set("clinicName", e.target.value)} /></Field>
                  <Field label="الاسم بالإنجليزية"><input className="input" value={form.clinicNameEn} onChange={(e) => set("clinicNameEn", e.target.value)} dir="ltr" style={{ textAlign: "right" }} /></Field>
                  <Field label="اسم الطبيب"><input className="input" value={form.doctorName} onChange={(e) => set("doctorName", e.target.value)} /></Field>
                  <Field label="التخصص"><input className="input" value={form.specialty} onChange={(e) => set("specialty", e.target.value)} /></Field>
                  <Field label="الهاتف الأرضي"><input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} dir="ltr" style={{ textAlign: "right" }} /></Field>
                  <Field label="واتساب"><input className="input" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} dir="ltr" style={{ textAlign: "right" }} /></Field>
                  <Field label="البريد الإلكتروني" className="grid-span-2"><input className="input" value={form.email} onChange={(e) => set("email", e.target.value)} dir="ltr" style={{ textAlign: "right" }} /></Field>
                  <Field label="العنوان" className="grid-span-2"><input className="input" value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
                  <Field label="المدينة"><input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
                  <Field label="العملة"><input className="input" value={form.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
                </div>
              </div>

              <div>
                <div className="row gap-8 mb-12">
                  <Wallet size={17} style={{ color: "var(--ok)" }} />
                  <b className="small">الرسوم الافتراضية</b>
                </div>
                <div className="col gap-12">
                  <Field label={`رسوم الكشف (${form.currency})`}>
                    <input className="input num" value={form.consultationFee} onChange={(e) => set("consultationFee", Number(e.target.value) || 0)} dir="ltr" style={{ textAlign: "right" }} />
                  </Field>
                  <Field label={`رسوم المتابعة (${form.currency})`}>
                    <input className="input num" value={form.followUpFee} onChange={(e) => set("followUpFee", Number(e.target.value) || 0)} dir="ltr" style={{ textAlign: "right" }} />
                  </Field>
                  <Field label="نسبة الضريبة %">
                    <input className="input num" value={form.taxRate} onChange={(e) => set("taxRate", Number(e.target.value) || 0)} dir="ltr" style={{ textAlign: "right" }} />
                  </Field>
                  <Field label="مدة الموعد (دقيقة)">
                    <input className="input num" value={form.slotMinutes} onChange={(e) => set("slotMinutes", Number(e.target.value) || 30)} dir="ltr" style={{ textAlign: "right" }} />
                  </Field>
                  <Field label="تذكير قبل الموعد (ساعة)">
                    <input className="input num" value={form.reminderHours} onChange={(e) => set("reminderHours", Number(e.target.value) || 24)} dir="ltr" style={{ textAlign: "right" }} />
                  </Field>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "booking" ? (
            <div className="grid grid-cols-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="col gap-12">
                <div className="row gap-8"><Globe size={17} style={{ color: "var(--primary)" }} /><b className="small">الحجز من الموقع</b></div>
                <label className="switch" style={{ justifyContent: "space-between" }}>
                  <span>
                    <b className="small">تشغيل الحجز الإلكتروني</b>
                    <span className="tiny muted" style={{ display: "block" }}>عرض زر الحجز والصفحة العامة للمرضى</span>
                  </span>
                  <span>
                    <input type="checkbox" checked={form.onlineBookingEnabled} onChange={(e) => set("onlineBookingEnabled", e.target.checked)} />
                    <span className="track" />
                  </span>
                </label>
                <label className="switch" style={{ justifyContent: "space-between" }}>
                  <span>
                    <b className="small">تأكيد تلقائي للمواعيد</b>
                    <span className="tiny muted" style={{ display: "block" }}>إلغاء المراجعة اليدوية لطلبات الحجز</span>
                  </span>
                  <span>
                    <input type="checkbox" checked={form.autoConfirm} onChange={(e) => set("autoConfirm", e.target.checked)} />
                    <span className="track" />
                  </span>
                </label>
                <div className="divider" />
                <Field label={`مبلغ العربون (${form.currency})`} hint="المبلغ المطلوب دفعه لتأكيد الحجز">
                  <input className="input num" value={form.depositAmount} onChange={(e) => set("depositAmount", Number(e.target.value) || 0)} dir="ltr" style={{ textAlign: "right" }} />
                </Field>
                <label className="switch" style={{ justifyContent: "space-between" }}>
                  <span><b className="small">اشتراط الدفع المسبق</b><span className="tiny muted" style={{ display: "block" }}>لن يُقبل الحجز دون تحويل العربون</span></span>
                  <span>
                    <input type="checkbox" checked={form.requirePayment} onChange={(e) => set("requirePayment", e.target.checked)} />
                    <span className="track" />
                  </span>
                </label>
              </div>

              <div className="col gap-12">
                <div className="row gap-8"><Globe size={17} style={{ color: "var(--violet)" }} /><b className="small">رابط الصفحة العامة</b></div>
                <div className="soft-box">
                  <div className="tiny muted mb-4">رابط الحجز — شاركه مع مرضاك</div>
                  <div className="mono small" dir="ltr">yourclinic.com/book</div>
                  <Button size="sm" variant="soft" className="mt-8" onClick={() => { navigator.clipboard?.writeText(location.origin + "/book"); toast("تم نسخ رابط الحجز"); }}>
                    نسخ الرابط
                  </Button>
                </div>
                <div className="soft-box">
                  <div className="tiny muted mb-4">رابط الملف التعريفي</div>
                  <div className="mono small" dir="ltr">yourclinic.com/doctor</div>
                  <Button size="sm" variant="soft" className="mt-8" onClick={() => { navigator.clipboard?.writeText(location.origin + "/doctor"); toast("تم نسخ رابط الملف"); }}>
                    نسخ الرابط
                  </Button>
                </div>
                <div className="alert alert-info">
                  <Check size={15} />
                  <span>كل الطلبات تصل إلى قسم «طلبات الحجز» وتحتاج تحققًا من الدفع قبل التحويل لموعد.</span>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "payments" ? (
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="col gap-12">
                <div className="row gap-8"><CreditCard size={17} style={{ color: "var(--ok)" }} /><b className="small">بيانات تحصيل الدفعات</b></div>
                <Field label="إنستاباي"><input className="input" value={form.instapayHandle} onChange={(e) => set("instapayHandle", e.target.value)} dir="ltr" style={{ textAlign: "right" }} /></Field>
                <Field label="فودافون كاش"><input className="input" value={form.vodafoneCash} onChange={(e) => set("vodafoneCash", e.target.value)} dir="ltr" style={{ textAlign: "right" }} /></Field>
                <Field label="الحساب البنكي"><input className="input" value={form.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} /></Field>
              </div>
              <div>
                <div className="row gap-8 mb-12"><Wallet size={17} style={{ color: "var(--primary)" }} /><b className="small">طرق الدفع المتاحة</b></div>
                {form.paymentMethods.map((m) => (
                  <div key={m} className="row-between soft-box mb-8" style={{ padding: "8px 11px" }}>
                    <span className="small">{m}</span>
                    <Badge tone="ok" dot>مفعّلة</Badge>
                  </div>
                ))}
                <div className="alert alert-warn mt-12">
                  <Clock size={15} />
                  <span>مراجعة الدفعات تتم يدويًا من قسم طلبات الحجز لضمان دقة الأرقام.</span>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "hours" ? (
            <div>
              <div className="row gap-8 mb-12"><CalendarClock size={17} style={{ color: "var(--primary)" }} /><b className="small">ساعات عمل العيادة</b></div>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>اليوم</th>
                      <th>مفتوح</th>
                      <th>من</th>
                      <th>إلى</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.workingDays.map((d, i) => (
                      <tr key={d.day}>
                        <td className="strong">{d.day}</td>
                        <td>
                          <label className="switch">
                            <input type="checkbox" checked={d.open} onChange={(e) => setDay(i, { open: e.target.checked })} />
                            <span className="track" />
                            <span className="tiny">{d.open ? "يعمل" : "مغلق"}</span>
                          </label>
                        </td>
                        <td><input type="time" className="input" style={{ height: 34, width: 120 }} value={d.from} disabled={!d.open} onChange={(e) => setDay(i, { from: e.target.value })} /></td>
                        <td><input type="time" className="input" style={{ height: 34, width: 120 }} value={d.to} disabled={!d.open} onChange={(e) => setDay(i, { to: e.target.value })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="alert alert-info mt-12">
                <Clock size={15} />
                <span>هذه المواعيد تُستخدم في صفحة الحجز العامة لعرض الأوقات المتاحة.</span>
              </div>
            </div>
          ) : null}

          {tab === "cloud" ? (
            <div className="cloud-grid">
              <div className="cloud-panel">
                <div className="row-between">
                  <div className="row gap-8">
                    <Cloud size={18} style={{ color: "var(--primary)" }} />
                    <b className="small">قاعدة البيانات السحابية</b>
                  </div>
                  <span className={`cloud-badge ${cloud.status === "error" ? "err" : cloud.status === "online" ? "ok" : "warn"}`}>
                    <span className="dot" style={{ background: "currentColor" }} />
                    {cloudMeta.label}
                  </span>
                </div>

                {cloud.enabled ? (
                  <>
                    <div className="cloud-meta">
                      <span><Server size={13} /> Supabase / PostgreSQL</span>
                      <span><ShieldCheck size={13} /> RLS مفعّل على كل الجداول</span>
                      <span><Lock size={13} /> {session?.email || "حساب موثّق"}</span>
                    </div>

                    <div className="soft-box" style={{ lineHeight: 1.9 }}>
                      <div className="row-between small">
                        <span className="muted">آخر مزامنة ناجحة</span>
                        <span className="mono" style={{ fontSize: ".72rem" }}>
                          {cloud.lastSync ? new Date(cloud.lastSync).toLocaleString("ar-EG") : "—"}
                        </span>
                      </div>
                      <div className="row-between small">
                        <span className="muted">حالة الكتابة</span>
                        <span className="strong">{cloud.pending ? "تغييرات بانتظار الإرسال" : "كل شيء محفوظ"}</span>
                      </div>
                      <div className="row-between small">
                        <span className="muted">على هذا الجهاز</span>
                        <span className="strong">لا تُخزَّن بيانات المرضى محليًا</span>
                      </div>
                    </div>

                    {cloud.error ? (
                      <div className="alert alert-danger">
                        <ShieldCheck size={15} />
                        <span>{cloud.error}</span>
                      </div>
                    ) : null}

                    <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                      <Button variant="primary" onClick={doSync} disabled={busy}>
                        <RefreshCw size={15} className={busy ? "spin" : ""} /> مزامنة الآن
                      </Button>
                      <Button variant="soft" onClick={doPull} disabled={busy}>
                        <Download size={15} /> تحميل نسخة السحابة
                      </Button>
                      <Button variant="outline" onClick={() => setPwdOpen(true)}>
                        <KeyRound size={15} /> تغيير كلمة المرور
                      </Button>
                    </div>

                    {hasPerm("users.edit") ? (
                      <div className="soft-box" style={{ borderStyle: "dashed" }}>
                        <div className="row-between gap-8" style={{ flexWrap: "wrap" }}>
                          <div>
                            <b className="small">بيانات عرض جاهزة</b>
                            <p className="tiny muted" style={{ marginTop: 3 }}>
                              ارفع المرضى والمواعيد التجريبية إلى مشروع سحابي فارغ لبدء الاستعراض من أي جهاز.
                            </p>
                          </div>
                          <Button variant="soft" size="sm" onClick={() => setDemoConfirm(true)} disabled={busy}>
                            <UploadCloud size={14} /> رفع بيانات العرض
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="alert alert-info">
                      <Cloud size={15} />
                      <span>
                        النظام يعمل الآن محليًا بأمان على هذا الجهاز. فعّل السحابة لتشارك البيانات مع فريقك
                        وتصل إليها من أي جهاز.
                      </span>
                    </div>
                    <ol className="cloud-steps">
                      <li>أنشئ مشروعًا مجانيًا على <code>supabase.com</code>.</li>
                      <li>شغّل ملف <code>supabase/migrations/0001_init.sql</code> من SQL Editor.</li>
                      <li>أضف <code>VITE_SUPABASE_URL</code> و<code>VITE_SUPABASE_ANON_KEY</code> في <code>.env.local</code>.</li>
                      <li>أعد تشغيل الخادم، ثم أنشئ أول مدير بالأمر <code>npm run cloud:bootstrap</code>.</li>
                      <li>سجّل الدخول — أضف بقية الفريق من صفحة المستخدمون.</li>
                    </ol>
                    <div className="alert alert-warn">
                      <ShieldCheck size={15} />
                      <span>لا تضع مفتاح <code>service_role</code> في ملفات الواجهة أو <code>VITE_*</code> إطلاقًا.</span>
                    </div>
                  </>
                )}
              </div>

              <div className="cloud-panel">
                <div className="row-between">
                  <div className="row gap-8">
                    <MessageCircle size={18} style={{ color: "var(--ok)" }} />
                    <b className="small">محرك واتساب التلقائي</b>
                  </div>
                  <span className={`cloud-badge ${cloud.enabled ? "ok" : "warn"}`}>
                    {cloud.enabled ? "جاهز للتفعيل" : "بانتظار السحابة"}
                  </span>
                </div>

                <div className="soft-box" style={{ lineHeight: 1.9 }}>
                  <b className="small">كيف يخدم الواتساب قاعدة البيانات؟</b>
                  <p className="tiny muted" style={{ marginTop: 4 }}>
                    دالة مجدولة تقرأ مواعيد الغد، الحجوزات غير المدفوعة، الفواتير المتأخرة، والمتابعات،
                    ثم ترسل قوالب عربية معتمدة وتكتب نتيجة كل رسالة في سجل التذكيرات تلقائيًا.
                  </p>
                </div>
                <ol className="cloud-steps">
                  <li>انشر الدوال: <code>reminders-dispatch</code> و<code>whatsapp-webhook</code>.</li>
                  <li>أضف أسرار Meta: <code>WHATSAPP_TOKEN</code> و<code>WHATSAPP_PHONE_NUMBER_ID</code>.</li>
                  <li>اعتمد القوالب العربية من WhatsApp Manager (التفاصيل في <code>docs/CLOUD_SETUP.md</code>).</li>
                  <li>اربط الـ Webhook ثم فعّل الجدولة بالساعة.</li>
                </ol>
                <div className="alert alert-warn">
                  <Clock size={15} />
                  <span>
                    الإرسال التلقائي يبدأ في وضع المعاينة الآمن حتى توافق Meta على القوالب. الإرسال اليدوي
                    عبر روابط واتساب يعمل الآن دون أي إعداد.
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "data" ? (
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="col gap-12">
                <div className="row gap-8"><SettingsIcon size={17} style={{ color: "var(--primary)" }} /><b className="small">المظهر</b></div>
                <div className="row gap-8">
                  <Button variant={theme === "light" ? "primary" : "outline"} onClick={() => setTheme("light")}>المظهر الفاتح</Button>
                  <Button variant={theme === "dark" ? "primary" : "outline"} onClick={() => setTheme("dark")}>المظهر الداكن</Button>
                </div>
                <div className="divider" />
                <div className="row gap-8"><Database size={17} style={{ color: "var(--info)" }} /><b className="small">النسخ الاحتياطي</b></div>
                <Button onClick={doBackup} disabled={backupBusy}>
                  {backupBusy ? <RefreshCw size={15} className="spin" /> : <FolderOpen size={15} />}
                  {backupBusy ? "جارٍ حفظ النسخة…" : "حفظ نسخة احتياطية"}
                </Button>
                <Button variant="soft" onClick={doExportSql} disabled={backupBusy}>
                  <Download size={15} />
                  تصدير SQL
                </Button>
                <div className="soft-box tiny muted" style={{ lineHeight: 1.9 }}>
                  {folderPicker ? (
                    <>
                      <b className="small" style={{ color: "var(--ink)" }}>اختيار مجلد الحفظ متاح</b>
                      <br />
                      سيُطلب منك اختيار المجلد الذي تريد حفظ ملف <code>JSON</code> داخله. يبقى الملف على جهازك
                      ولا يُرسل إلى أي خادم.
                    </>
                  ) : nativePickers ? (
                    <>
                      <b className="small" style={{ color: "var(--ink)" }}>اختيار مكان الحفظ متاح</b>
                      <br />
                      سيُطلب منك تحديد مكان واسم الملف عند الحفظ. يبقى الملف على جهازك ولا يُرسل إلى أي خادم.
                    </>
                  ) : (
                    <>
                      <b className="small" style={{ color: "var(--ink)" }}>حفظ متوافق مع كل المتصفحات</b>
                      <br />
                      سينزل الملف في مجلد التنزيلات. لاختيار المجلد يدويًا، فعّل خيار
                      «اسأل عن مكان حفظ كل ملف» في إعدادات المتصفح.
                    </>
                  )}
                </div>
                <div className="divider" />
                <div className="row gap-8"><Upload size={17} style={{ color: "var(--warn)" }} /><b className="small">استعادة نسخة احتياطية</b></div>
                <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                  <Button variant="soft" onClick={chooseRestoreFile} disabled={restoreBusy}>
                    <FileJson size={15} /> استعادة من ملف
                  </Button>
                  {folderPicker ? (
                    <Button variant="soft" onClick={chooseRestoreFolder} disabled={restoreBusy}>
                      {restoreBusy ? <RefreshCw size={15} className="spin" /> : <FolderOpen size={15} />}
                      استعادة من مجلد
                    </Button>
                  ) : null}
                </div>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void loadRestoreFile(file);
                  }}
                />
                <div className="soft-box tiny muted" style={{ lineHeight: 1.9 }}>
                  اختر ملف <code>JSON</code> من أي مجلد على جهازك، أو اختر مجلدًا وسنعرض أحدث ملف JSON
                  بداخله للمعاينة. لن تُستبدل أي بيانات قبل تأكيدك.{" "}
                  {cloud.enabled
                    ? "في الوضع السحابي تُستعاد بيانات العيادة فقط، وتبقى حسابات الدخول والصلاحيات الحالية كما هي."
                    : "في الوضع المحلي تُستبدل البيانات الحالية بالكامل، مع الاحتفاظ بحسابك الحالي."}
                </div>
                <div className="soft-box tiny muted" style={{ lineHeight: 1.9 }}>
                  {cloud.enabled
                    ? "تُحفظ التغييرات تلقائيًا في قاعدة بيانات Supabase، ويُشفَّر الاتصال بالكامل. لا تُخزَّن بيانات المرضى في متصفحك بعد تسجيل الدخول السحابي."
                    : "جميع البيانات تُحفظ تلقائيًا في قاعدة SQLite مُدارة على خادم العيادة المحلي (data/tabib.db)، مع نسخة تخزين مؤقتة داخل المتصفح. فعّل السحابة من تبويب «السحابة والأمان» للوصول من أي جهاز."}
                </div>
              </div>

              <div className="col gap-12">
                <div className="row gap-8"><RotateCcw size={17} style={{ color: "var(--danger)" }} /><b className="small">منطقة الخطر</b></div>
                {cloud.enabled ? (
                  <div className="soft-box">
                    <b className="small">إعادة الضبط معطّلة في السحابة</b>
                    <p className="tiny muted" style={{ marginTop: 4, lineHeight: 1.8 }}>
                      لحماية بيانات المرضى، لا يمكن مسح قاعدة البيانات من الواجهة. استخدم النسخة الاحتياطية
                      ولوحة Supabase عند الحاجة، وتواصل مع مدير النظام.
                    </p>
                  </div>
                ) : (
                  <div className="soft-box" style={{ borderColor: "color-mix(in srgb, var(--danger) 30%, transparent)" }}>
                    <b className="small">إعادة ضبط البيانات التجريبية</b>
                    <p className="tiny muted" style={{ marginTop: 4, lineHeight: 1.8 }}>
                      سيتم حذف كل التعديلات التي أجريتها واستعادة بيانات العرض الأصلية (المرضى، المواعيد، الفواتير…).
                    </p>
                    <Button variant="danger-soft" size="sm" className="mt-8" onClick={() => setDanger(true)}>
                      <RotateCcw size={14} /> إعادة الضبط
                    </Button>
                  </div>
                )}
                <div className="soft-box">
                  <b className="small">معلومات النظام</b>
                  <div className="row-between small mt-8"><span className="muted">الإصدار</span><span className="mono">1.1.0</span></div>
                  <div className="row-between small"><span className="muted">الحالة</span><Badge tone={cloud.status === "error" ? "danger" : "ok"} dot>{cloudMeta.label}</Badge></div>
                  <div className="row-between small"><span className="muted">التخزين</span><span className="mono">{cloud.enabled ? "supabase" : "local"}</span></div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="card-ft row-between">
          <span className="tiny muted">آخر حفظ: {dirty ? "لم يتم بعد" : "كل التغييرات محفوظة"}</span>
          <Button variant="primary" onClick={save} disabled={!dirty}><Save size={15} /> حفظ</Button>
        </div>
      </Card>

      <ConfirmDialog
        open={danger}
        title="إعادة ضبط البيانات"
        message="سيتم استبدال كل البيانات الحالية ببيانات العرض الأصلية. لا يمكن التراجع."
        confirmLabel="نعم، أعد الضبط"
        danger
        onCancel={() => setDanger(false)}
        onConfirm={() => {
          resetDemo();
          setDanger(false);
          toast("تمت إعادة ضبط البيانات التجريبية");
        }}
      />

      <ConfirmDialog
        open={demoConfirm}
        title="رفع بيانات العرض إلى السحابة"
        message="سيتم إدخال بيانات المرضى والمواعيد والفواتير التجريبية إلى قاعدة البيانات السحابية. تعمل هذه الخطوة فقط إذا لم تكن هناك أي ملفات مرضى سحابية، حمايةً لبياناتك الحقيقية."
        confirmLabel="نعم، ارفع البيانات"
        onCancel={() => setDemoConfirm(false)}
        onConfirm={() => {
          void doPushDemo();
        }}
      />

      <Modal
        open={Boolean(restoreCandidate)}
        onClose={() => {
          if (!restoreBusy) setRestoreCandidate(null);
        }}
        title="تأكيد استعادة النسخة الاحتياطية"
        sub={
          restoreCandidate
            ? `الملف: ${restoreCandidate.fileName}${
                restoreCandidate.folderName ? ` — المجلد: ${restoreCandidate.folderName}` : ""
              }`
            : undefined
        }
        icon={<Upload size={18} />}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setRestoreCandidate(null)} disabled={restoreBusy}>
              إلغاء
            </Button>
            <Button variant="danger-soft" onClick={doRestore} disabled={restoreBusy}>
              {restoreBusy ? <RefreshCw size={15} className="spin" /> : <RotateCcw size={15} />}
              {restoreBusy ? "جارٍ الاستعادة…" : "تأكيد الاستعادة"}
            </Button>
          </>
        }
      >
        {restoreCandidate ? (
          <div className="col gap-12">
            <div className="alert alert-danger">
              <Database size={16} />
              <span>
                {cloud.enabled
                  ? "سيتم استبدال بيانات المرضى والمواعيد والحجوزات والزيارات والروشتات والفواتير والأرشيف والتذكيرات والإعدادات والملف التعريفي في السحابة. حسابات الدخول والصلاحيات الحالية لن تتغير. لا يمكن التراجع."
                  : "سيتم استبدال كل البيانات المحلية الحالية بمحتوى النسخة الاحتياطية. سيُحتفظ بحسابك الحالي لتجنب فقدان الدخول. لا يمكن التراجع."}
              </span>
            </div>

            {restoreCreatedLabel ? (
              <div className="row-between small">
                <span className="muted">تاريخ إنشاء النسخة</span>
                <b>{restoreCreatedLabel}</b>
              </div>
            ) : null}

            {restoreCandidate.folderName ? (
              <div className="row-between small">
                <span className="muted">المجلد المختار</span>
                <b>
                  {restoreCandidate.folderName}
                  {restoreCandidate.folderCount && restoreCandidate.folderCount > 1
                    ? ` — أحدث ملف من ${restoreCandidate.folderCount}`
                    : ""}
                </b>
              </div>
            ) : null}

            <div className="soft-box">
              <b className="small">السجلات الموجودة في النسخة</b>
              <div className="grid grid-2 gap-8 mt-8" style={{ fontSize: ".78rem" }}>
                {[
                  ["المرضى", restoreCandidate.backup.counts.patients],
                  ["المواعيد", restoreCandidate.backup.counts.appointments],
                  ["طلبات الحجز", restoreCandidate.backup.counts.bookings],
                  ["الزيارات", restoreCandidate.backup.counts.visits],
                  ["الروشتات", restoreCandidate.backup.counts.prescriptions],
                  ["الفواتير", restoreCandidate.backup.counts.invoices],
                  ["ملفات الأرشيف", restoreCandidate.backup.counts.archive],
                  ["التذكيرات", restoreCandidate.backup.counts.reminders],
                  ["المستخدمون", restoreCandidate.backup.counts.users],
                ].map(([label, count]) => (
                  <div className="row-between" key={String(label)}>
                    <span className="muted">{label}</span>
                    <Badge tone="line">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {cloud.enabled ? (
              <div className="alert alert-info">
                <ShieldCheck size={15} />
                <span>
                  سيتم تنفيذ الاستعادة داخل معاملة واحدة على الخادم. إذا فشل أي سجل، تُلغى العملية كاملة ولا
                  تُحذف البيانات الحالية. المستخدمون في النسخة ({restoreCandidate.backup.counts.users}) لا
                  يُنشئون حسابات دخول جديدة.
                </span>
              </div>
            ) : (
              <div className="alert alert-info">
                <ShieldCheck size={15} />
                <span>يُنصح بحفظ نسخة احتياطية من البيانات الحالية قبل المتابعة.</span>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={pwdOpen}
        onClose={() => setPwdOpen(false)}
        title="تغيير كلمة المرور"
        sub="كلمة المرور تُحفظ مشفّرة في Supabase Auth ولا يمكن لأي شخص قراءتها."
        icon={<KeyRound size={18} />}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>إلغاء</Button>
            <Button variant="primary" onClick={doChangePassword} disabled={busy || !pwd || !pwd2}>
              {busy ? "جارٍ الحفظ…" : "حفظ كلمة المرور"}
            </Button>
          </>
        }
      >
        <div className="col gap-12">
          <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل، ويُفضّل مزيج من الحروف والأرقام">
            <input
              className="input"
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoComplete="new-password"
              dir="ltr"
              style={{ textAlign: "right" }}
            />
          </Field>
          <Field label="تأكيد كلمة المرور">
            <input
              className="input"
              type="password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              autoComplete="new-password"
              dir="ltr"
              style={{ textAlign: "right" }}
            />
          </Field>
          <div className="alert alert-info">
            <ShieldCheck size={15} />
            <span>سيتم إنهاء الجلسات الأخرى تلقائيًا بعد تغيير كلمة المرور.</span>
          </div>
        </div>
      </Modal>
    </>
  );
}
