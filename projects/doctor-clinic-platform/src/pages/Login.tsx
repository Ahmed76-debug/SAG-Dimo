import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Cloud,
  Database,
  Eye,
  EyeOff,
  FileText,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Avatar, Button, Field } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/types";

const FEATURES = [
  { icon: Users, text: "ملف طبي إلكتروني كامل لكل مريض — تاريخ، تشخيص، تحاليل، ووصفات." },
  { icon: CalendarCheck, text: "حجز إلكتروني مع التحقق من الدفع وربط تلقائي بجدول المواعيد." },
  { icon: FileText, text: "وصفات وفواتير بطباعة مباشرة أو تصدير PDF احترافي بضغطة." },
  { icon: ShieldCheck, text: "صلاحيات دقيقة لكل فريق العمل — الطبيب، الاستقبال، التمريض، المحاسب." },
];

export default function Login() {
  const { db, login, toast, cloud, resetPassword, recoveryMode, clearRecovery, changePassword } = useApp();
  const [email, setEmail] = useState(cloud.enabled ? "" : "admin");
  const [password, setPassword] = useState(cloud.enabled ? "" : "admin123");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "تعذر تسجيل الدخول");
      return;
    }
    toast("مرحبًا بك مجددًا 👋");
  };

  const quick = async (mail: string) => {
    setEmail(mail);
    const target = db.users.find((u) => u.email === mail);
    const pwd = target?.id === "usr_admin" ? "admin123" : "1234";
    const res = await login(mail, pwd);
    if (res.ok) toast("تم الدخول بالحساب التجريبي");
    else setError(res.error ?? "");
  };

  const forgot = async () => {
    if (!cloud.enabled) {
      setError("استعادة كلمة المرور متاحة في الوضع السحابي. في الوضع التجريبي استخدم حساب الأدمن admin / admin123.");
      return;
    }
    if (!email.trim()) {
      setError("أدخل بريدك الإلكتروني أولًا لإرسال رابط الاستعادة.");
      return;
    }
    const res = await resetPassword(email);
    if (res.ok) toast("أرسلنا رابط استعادة كلمة المرور إلى بريدك.");
    else setError(res.error ?? "تعذر إرسال الرابط");
  };

  const displayError = error || (cloud.enabled && cloud.status === "error" ? cloud.error : "");

  const submitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setRecoveryBusy(true);
    const res = await changePassword(newPassword);
    setRecoveryBusy(false);
    if (!res.ok) {
      setError(res.error ?? "تعذر تحديث كلمة المرور");
      return;
    }
    clearRecovery();
    toast("تم تحديث كلمة المرور، وتم الدخول إلى حسابك.");
  };

  if (recoveryMode) {
    return (
      <div className="auth">
        <div className="auth-art">
          <div className="row" style={{ gap: 12 }}>
            <div className="brand-mark" style={{ width: 46, height: 46, background: "rgba(255,255,255,.16)", boxShadow: "none" }}>
              <Stethoscope size={24} />
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.15rem" }}>منصة طبيب</div>
              <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.7)" }}>نظام إدارة العيادة المتكامل</div>
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ background: "rgba(255,255,255,.14)", color: "#c8fff6", marginBottom: 16 }}>
              <LockKeyhole size={13} /> استعادة آمنة للحساب
            </div>
            <div className="auth-quote">
              كلمة مرور جديدة،
              <br />
              و<em>وصول آمن</em> من جديد.
            </div>
            <div className="auth-feats">
              <div className="auth-feat">
                <div className="fi">
                  <ShieldCheck size={15} />
                </div>
                <span>الرابط مؤقت ويُستخدم لمرة واحدة لحماية حسابك.</span>
              </div>
              <div className="auth-feat">
                <div className="fi">
                  <Cloud size={15} />
                </div>
                <span>بعد التحديث ستُفتح جلستك الحالية مباشرة.</span>
              </div>
            </div>
          </div>

          <div className="tiny" style={{ color: "rgba(255,255,255,.7)" }}>
            إذا انتهت صلاحية الرابط، اطلب رابطًا جديدًا من صفحة الدخول.
          </div>
        </div>

        <div className="auth-form-wrap">
          <form className="auth-form" onSubmit={submitRecovery}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              <LockKeyhole size={12} /> استعادة كلمة المرور
            </div>
            <h2>اختر كلمة مرور جديدة</h2>
            <p className="sub">اكتب كلمة مرور قوية لا تقل عن 8 أحرف، ثم أكّدها.</p>

            <div className="col gap-12">
              <Field label="كلمة المرور الجديدة" required>
                <div className="input-icon">
                  <LockKeyhole size={16} />
                  <input
                    className="input"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    dir="ltr"
                    style={{ textAlign: "right" }}
                  />
                </div>
              </Field>

              <Field label="تأكيد كلمة المرور" required>
                <div className="input-icon">
                  <LockKeyhole size={16} />
                  <input
                    className="input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    dir="ltr"
                    style={{ textAlign: "right" }}
                  />
                </div>
              </Field>

              {error ? (
                <div className="alert alert-danger">
                  <ShieldCheck size={15} />
                  <span>{error}</span>
                </div>
              ) : null}

              <Button variant="primary" size="lg" type="submit" className="btn-block" disabled={recoveryBusy}>
                {recoveryBusy ? "جارٍ التحديث…" : "حفظ كلمة المرور"}
                {!recoveryBusy ? <ArrowLeft size={17} /> : null}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <div className="auth-art">
        <div className="row" style={{ gap: 12 }}>
          <div className="brand-mark" style={{ width: 46, height: 46, background: "rgba(255,255,255,.16)", boxShadow: "none" }}>
            <Stethoscope size={24} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.15rem" }}>منصة طبيب</div>
            <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.7)" }}>نظام إدارة العيادة المتكامل</div>
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ background: "rgba(255,255,255,.14)", color: "#c8fff6", marginBottom: 16 }}>
            <Activity size={13} /> مصمّم للعيادات التي تحترم وقت الطبيب
          </div>
          <div className="auth-quote">
            كل ما تحتاجه عيادتك
            <br />
            في <em>شاشة واحدة</em> هادئة.
          </div>
          <div className="auth-feats">
            {FEATURES.map((f) => (
              <div className="auth-feat" key={f.text}>
                <div className="fi">
                  <f.icon size={15} />
                </div>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="row" style={{ gap: 18, flexWrap: "wrap", fontSize: ".76rem", color: "rgba(255,255,255,.75)" }}>
          {cloud.enabled ? (
            <>
              <span className="row" style={{ gap: 6 }}>
                <Cloud size={14} /> نسخة سحابية آمنة
              </span>
              <span className="row" style={{ gap: 6 }}>
                <Database size={14} /> بياناتك من أي جهاز
              </span>
              <span className="row" style={{ gap: 6 }}>
                <ShieldCheck size={14} /> صلاحيات على الخادم
              </span>
            </>
          ) : (
            <>
              <span className="row" style={{ gap: 6 }}>
                <CheckCircle2 size={14} /> يعمل بدون إنترنت
              </span>
              <span className="row" style={{ gap: 6 }}>
                <CheckCircle2 size={14} /> بياناتك على جهازك
              </span>
              <span className="row" style={{ gap: 6 }}>
                <CheckCircle2 size={14} /> جاهز للاستضافة
              </span>
            </>
          )}
        </div>
      </div>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            <LockKeyhole size={12} /> دخول آمن
          </div>
          <h2>أهلًا بعودتك</h2>
          <p className="sub">سجّل الدخول للوصول إلى عيادتك وملفات مرضاك بأمان.</p>

          <div
            className="row"
            style={{
              gap: 7,
              margin: "2px 0 14px",
              padding: "8px 11px",
              borderRadius: 10,
              background: cloud.enabled ? "var(--ok-soft)" : "var(--surface-2)",
              color: cloud.enabled ? "var(--ok)" : "var(--ink-3)",
              fontSize: ".74rem",
              fontWeight: 600,
            }}
          >
            {cloud.enabled ? <Cloud size={14} /> : <ShieldCheck size={14} />}
            {cloud.enabled
              ? "اتصال سحابي مشفّر — بياناتك متاحة من أي جهاز بعد تسجيل الدخول."
              : "وضع محلي — البيانات محفوظة في قاعدة SQLite مُدارة على خادم العيادة."}
          </div>

          <div className="col gap-12">
            <Field label="البريد الإلكتروني أو اسم المستخدم" required>
              <div className="input-icon">
                <Mail size={16} />
                <input
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  dir="ltr"
                  style={{ textAlign: "right" }}
                />
              </div>
            </Field>

            <Field
              label="كلمة المرور"
              required
              hint={cloud.enabled ? "8 أحرف على الأقل — تُدار بأمان عبر Supabase Auth" : "الأدمن الموحّد: admin / admin123"}
            >
              <div className="input-icon" style={{ position: "relative" }}>
                <LockKeyhole size={16} />
                <input
                  className="input"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••"
                  autoComplete="current-password"
                  dir="ltr"
                  style={{ textAlign: "right", paddingInlineEnd: 38 }}
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShow((s) => !s)}
                  style={{ position: "absolute", insetInlineEnd: 2, top: "50%", transform: "translateY(-50%)", width: 32, height: 32 }}
                  aria-label="إظهار كلمة المرور"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {displayError ? (
              <div className="alert alert-danger">
                <ShieldCheck size={15} />
                <span>{displayError}</span>
              </div>
            ) : null}

            <div className="row-between">
              <label className="checkline">
                <input type="checkbox" defaultChecked /> تذكّرني
              </label>
              <button
                type="button"
                onClick={forgot}
                className="tiny"
                style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                نسيت كلمة المرور؟
              </button>
            </div>

            <Button variant="primary" size="lg" type="submit" className="btn-block" disabled={busy}>
              {busy ? "جارٍ الدخول…" : "تسجيل الدخول"}
              {!busy ? <ArrowLeft size={17} /> : null}
            </Button>
          </div>

          {!cloud.enabled ? (
            <>
              <div className="divider" style={{ margin: "20px 0 14px" }} />
              <div className="tiny muted" style={{ marginBottom: 8, fontWeight: 600 }}>
                أو ادخل بحساب تجريبي للاستعراض:
              </div>
              <div className="demo-users">
                {db.users
                  .filter((u) => u.active)
                  .slice(0, 4)
                  .map((u) => (
                    <button key={u.id} type="button" className="demo-user" onClick={() => quick(u.email)}>
                      <Avatar name={u.name} size="sm" />
                      <div className="grow" style={{ lineHeight: 1.3 }}>
                        <div className="strong">{u.name}</div>
                        <div className="role">{ROLE_LABEL[u.role]} · {u.email}</div>
                      </div>
                      <ArrowLeft size={14} className="muted" />
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <>
              <div className="divider" style={{ margin: "20px 0 14px" }} />
              <div
                style={{
                  padding: "11px 13px",
                  borderRadius: 11,
                  background: "var(--info-soft)",
                  border: "1px solid var(--line)",
                  fontSize: ".73rem",
                  color: "var(--ink-2)",
                  lineHeight: 1.7,
                }}
              >
                <div className="row gap-6" style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>
                  <Database size={14} /> أول دخول لمشروع جديد؟
                </div>
                جهّز أول مدير بالأمر <code>npm run cloud:bootstrap</code>، ثم أضف بقية الفريق من صفحة
                «المستخدمون». كلمات المرور تُحفظ مشفّرة ولا يمكن لأحد قراءتها.
              </div>
            </>
          )}

          <div className="center tiny muted" style={{ marginTop: 18 }}>
            <Link to="/doctor" style={{ color: "var(--primary)", fontWeight: 600 }}>
              عرض الملف التعريفي العام للطبيب
            </Link>
            <span style={{ margin: "0 6px" }}>·</span>
            <Link to="/book" style={{ color: "var(--primary)", fontWeight: 600 }}>
              حجز موعد كمريض
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

