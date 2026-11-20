import React from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FlaskConical,
  GraduationCap,
  Heart,
  Languages,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Scan,
  ShieldCheck,
  Star,
  Stethoscope,
  Video,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Badge, Button } from "@/components/ui";
import type { DoctorProfile as DP } from "@/lib/types";

const ICONS: Record<string, React.ComponentType<{ size?: number | string }>> = {
  stethoscope: Stethoscope,
  activity: Activity,
  scan: Scan,
  flask: FlaskConical,
  video: Video,
  heart: Heart,
};

const REVIEWS = [
  { name: "منى ع.", text: "الدكتور أول مرة أحس إنه سمعني للآخر. شرح كل تحليل بالتفصيل وطمّنني، والخطة كانت واضحة جدًا.", stars: 5, date: "قبل أسبوع" },
  { name: "أحمد م.", text: "متابعة الضغط معاه من سنة، الأرقام استقرت أخيرًا. التعامل راقي والانتظار قصير.", stars: 5, date: "قبل شهر" },
  { name: "دينا س.", text: "حجزت أونلاين والدفع كان سهل، ودخلت في ميعادي بالدقيقة. تجربة منظمة ومريحة.", stars: 5, date: "قبل 3 أسابيع" },
];

export default function DoctorProfile() {
  const { db } = useApp();
  const p: DP = db.profile;
  const s = db.settings;
  const todayName = new Date().toLocaleDateString("ar-EG", { weekday: "long" });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", backgroundImage: "var(--bg-grad)" }}>
      <nav className="public-nav">
        <div className="row gap-8">
          <div className="brand-mark" style={{ width: 36, height: 36, borderRadius: 11 }}>
            <Stethoscope size={19} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: ".95rem", lineHeight: 1.1 }}>{p.name}</div>
            <div className="tiny muted">{p.specialty}</div>
          </div>
        </div>
        <div className="row gap-8">
          <Link to="/" className="btn btn-ghost btn-sm hide-sm">دخول النظام</Link>
          <Link to="/book" className="btn btn-primary btn-sm">
            <CalendarCheck size={14} /> احجز موعدًا
          </Link>
        </div>
      </nav>

      <div className="public-wrap">
        {/* hero */}
        <section className="pf-hero">
          <div>
            <div className="eyebrow"><ShieldCheck size={12} /> طبيب معتمد · {p.experienceYears} عامًا من الخبرة</div>
            <h1 style={{ marginTop: 12 }}>
              {p.name}
              <span style={{ display: "block", fontSize: ".95rem", color: "var(--ink-2)", fontWeight: 500, marginTop: 6, fontFamily: "var(--font-body)" }}>
                {p.title}
              </span>
            </h1>
            <p className="lead">{p.bio}</p>

            <div className="row gap-8 wrap mt-16">
              <Link to="/book" className="btn btn-primary btn-lg">
                <CalendarCheck size={17} /> احجز موعدك الآن
              </Link>
              <a href={`tel:${s.phone}`} className="btn btn-lg">
                <Phone size={16} /> {s.phone}
              </a>
            </div>

            <div className="row gap-16 wrap mt-20">
              <div className="pf-stat">
                <b>{p.experienceYears}+</b>
                <span>سنة خبرة</span>
              </div>
              <div style={{ width: 1, height: 38, background: "var(--line)" }} />
              <div className="pf-stat">
                <b>{p.patientsCount}</b>
                <span>مريض</span>
              </div>
              <div style={{ width: 1, height: 38, background: "var(--line)" }} />
              <div className="pf-stat">
                <b className="row" style={{ justifyContent: "center", gap: 4 }}>
                  {p.rating} <Star size={16} fill="var(--gold)" stroke="var(--gold)" />
                </b>
                <span>{p.reviewsCount} تقييم</span>
              </div>
            </div>
          </div>

          <div>
            <div className="pf-photo">
              <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "3.6rem", lineHeight: 1 }}>{p.photoInitials}</div>
                <div style={{ fontSize: ".82rem", fontWeight: 600, opacity: .9, marginTop: 8, fontFamily: "var(--font-body)" }}>{p.specialty}</div>
              </div>
              <div style={{ position: "absolute", insetInlineStart: 16, bottom: 16, zIndex: 2 }}>
                <div style={{ background: "rgba(255,255,255,.18)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.28)", borderRadius: 10, padding: "5px 9px", fontSize: ".68rem", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#7dffcf" }} />
                  متاح للحجز
                </div>
              </div>
            </div>

            <div className="pf-card" style={{ marginTop: 14 }}>
              <div className="row gap-8 mb-8"><Languages size={15} style={{ color: "var(--primary)" }} /><b className="small">لغات التواصل</b></div>
              <div className="row gap-6 wrap">
                {p.languages.map((l) => <Badge key={l} tone="line">{l}</Badge>)}
              </div>
              <div className="divider" style={{ margin: "12px 0" }} />
              <div className="row gap-8 mb-8"><MapPin size={15} style={{ color: "var(--primary)" }} /><b className="small">العيادة</b></div>
              <div className="tiny ink-2" style={{ lineHeight: 1.8 }}>{s.address}<br />{s.city}</div>
            </div>
          </div>
        </section>

        {/* services */}
        <section className="pf-section">
          <h2>الخدمات الطبية</h2>
          <div className="sec-sub">رعاية متكاملة تبدأ من التشخيص الصحيح وتنتهي بمتابعة حقيقية</div>
          <div className="grid grid-3">
            {p.services.map((sv) => {
              const Ic = ICONS[sv.icon] ?? Stethoscope;
              return (
                <div key={sv.title} className="service-card">
                  <div className="service-ico"><Ic size={21} /></div>
                  <h4>{sv.title}</h4>
                  <p>{sv.desc}</p>
                  {sv.price ? (
                    <div className="row-between mt-12">
                      <span className="tiny muted">تبدأ من</span>
                      <b className="small" style={{ color: "var(--primary)" }}>{sv.price} {s.currency}</b>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* about + education */}
        <section className="pf-section">
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <h2>فلسفتي في العلاج</h2>
              <div className="sec-sub">كيف أتعامل مع كل حالة</div>
              <blockquote
                style={{
                  borderInlineStart: "3px solid var(--primary)",
                  paddingInlineStart: 16,
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: "1.05rem",
                  lineHeight: 1.9,
                  color: "var(--ink-2)",
                }}
              >
                “{p.philosophy}”
              </blockquote>
              <div className="col gap-12 mt-20">
                {[
                  { i: CheckCircle2, t: "تشخيص مبني على الأدلة والتحاليل", d: "لا قرار علاجي بدون صورة واضحة من الفحوصات والتاريخ المرضي." },
                  { i: CheckCircle2, t: "خطة علاج يفهمها المريض", d: "شرح مبسط لكل دواء وسبب استخدامه والمدة المتوقعة للتحسن." },
                  { i: CheckCircle2, t: "متابعة حقيقية لا تنتهي بالروشتة", d: "تذكير بالمواعيد ومراجعة النتائج وتعديل الجرعات عند الحاجة." },
                ].map((x) => (
                  <div key={x.t} className="row gap-12" style={{ alignItems: "flex-start" }}>
                    <div className="service-ico" style={{ width: 30, height: 30, marginBottom: 0, borderRadius: 9, flex: "0 0 auto" }}>
                      <x.i size={16} />
                    </div>
                    <div>
                      <b className="small">{x.t}</b>
                      <div className="tiny muted" style={{ lineHeight: 1.8 }}>{x.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2>المؤهلات العلمية</h2>
              <div className="sec-sub">مسار تعليمي ومهني موثّق</div>
              <div className="timeline">
                {p.education.map((e) => (
                  <div className="timeline-item" key={e.title}>
                    <div className="row gap-8">
                      <Badge tone="primary">{e.year}</Badge>
                      <b className="small">{e.title}</b>
                    </div>
                    <div className="tiny muted" style={{ marginTop: 2 }}>{e.place}</div>
                  </div>
                ))}
                {p.certifications.map((c) => (
                  <div className="timeline-item" key={c.title}>
                    <div className="row gap-8">
                      <Badge tone="line">{c.year}</Badge>
                      <b className="small">{c.title}</b>
                    </div>
                    <div className="tiny muted" style={{ marginTop: 2 }}>{c.org}</div>
                  </div>
                ))}
              </div>

              <div className="row gap-8 mt-16" style={{ alignItems: "flex-start" }}>
                <GraduationCap size={18} style={{ color: "var(--primary)", marginTop: 2 }} />
                <div>
                  <b className="small">العضويات المهنية</b>
                  {p.memberships.map((m) => (
                    <div key={m} className="tiny muted" style={{ lineHeight: 1.9 }}>• {m}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* hours + contact */}
        <section className="pf-section">
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <h2>مواعيد العيادة</h2>
              <div className="sec-sub">نستقبل مرضانا في المواعيد التالية</div>
              <div className="pf-card">
                {s.workingDays.map((d) => (
                  <div key={d.day} className={`hours-row ${d.day === todayName ? "today" : ""}`}>
                    <span className="row gap-6">
                      {d.day}
                      {d.day === todayName ? <span className="tag" style={{ fontSize: ".6rem" }}>اليوم</span> : null}
                    </span>
                    <span className="num">{d.open ? `${d.from} — ${d.to}` : "مغلق"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2>تواصل معنا</h2>
              <div className="sec-sub">نجيب على استفساراتك قبل الحجز</div>
              <div className="pf-card col gap-12">
                <a href={`tel:${s.phone}`} className="row gap-10">
                  <div className="service-ico" style={{ marginBottom: 0, width: 34, height: 34 }}><Phone size={16} /></div>
                  <div><div className="tiny muted">الهاتف</div><b className="small" dir="ltr">{s.phone}</b></div>
                </a>
                <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer" className="row gap-10">
                  <div className="service-ico" style={{ marginBottom: 0, width: 34, height: 34 }}><MessageCircle size={16} /></div>
                  <div><div className="tiny muted">واتساب</div><b className="small" dir="ltr">{s.whatsapp}</b></div>
                </a>
                <a href={`mailto:${s.email}`} className="row gap-10">
                  <div className="service-ico" style={{ marginBottom: 0, width: 34, height: 34 }}><Mail size={16} /></div>
                  <div><div className="tiny muted">البريد</div><b className="small" dir="ltr">{s.email}</b></div>
                </a>
                <div className="row gap-10">
                  <div className="service-ico" style={{ marginBottom: 0, width: 34, height: 34 }}><MapPin size={16} /></div>
                  <div><div className="tiny muted">العنوان</div><b className="small">{s.address}</b></div>
                </div>
                <Link to="/book" className="btn btn-primary btn-block mt-8"><CalendarCheck size={15} /> احجز موعدًا الآن</Link>
              </div>
            </div>
          </div>
        </section>

        {/* reviews */}
        <section className="pf-section">
          <div className="row-between wrap gap-8">
            <div>
              <h2>آراء المرضى</h2>
              <div className="sec-sub" style={{ marginBottom: 0 }}>تقييم {p.rating} من ٥ بناءً على {p.reviewsCount} تقييم</div>
            </div>
            <div className="row gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={17} fill="var(--gold)" stroke="var(--gold)" />
              ))}
            </div>
          </div>
          <div className="grid grid-3 mt-16">
            {REVIEWS.map((r) => (
              <div key={r.name} className="pf-card">
                <div className="row gap-4 mb-8">
                  {Array.from({ length: r.stars }).map((_, i) => (
                    <Star key={i} size={13} fill="var(--gold)" stroke="var(--gold)" />
                  ))}
                  <span className="tiny muted" style={{ marginInlineStart: "auto" }}>{r.date}</span>
                </div>
                <p className="small" style={{ lineHeight: 1.9, color: "var(--ink-2)" }}>“{r.text}”</p>
                <div className="row gap-6 mt-12">
                  <div className="avatar avatar-sm" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>{r.name.slice(0, 1)}</div>
                  <span className="tiny strong">{r.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: "10px 0 44px" }}>
          <div
            style={{
              borderRadius: "var(--r-xl)",
              padding: "32px 28px",
              background: "linear-gradient(120deg,#0a5f5a,#0d7c74 55%,#12a79a)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
              boxShadow: "var(--shadow-glow)",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.35rem" }}>صحتك لا تحتمل التأجيل</h2>
              <p style={{ color: "rgba(255,255,255,.82)", fontSize: ".86rem", marginTop: 4 }}>
                احجز موعدك في دقيقة واحدة — اختر الوقت، ادفع العربون، ونحن نتولى الباقي.
              </p>
            </div>
            <div className="row gap-8 wrap">
              <Link to="/book" className="btn btn-lg" style={{ background: "#fff", color: "#0a5f5a", borderColor: "transparent" }}>
                <CalendarCheck size={17} /> احجز الآن
              </Link>
              <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer" className="btn btn-lg" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.35)" }}>
                <MessageCircle size={17} /> اسأل عبر واتساب
              </a>
            </div>
          </div>
        </section>
      </div>

      <footer style={{ borderTop: "1px solid var(--line)", padding: "18px 22px", background: "var(--surface)" }}>
        <div className="public-wrap row-between wrap gap-8">
          <div className="row gap-8">
            <div className="brand-mark" style={{ width: 30, height: 30, borderRadius: 9 }}>
              <Stethoscope size={15} />
            </div>
            <span className="tiny muted">{s.clinicName} — جميع الحقوق محفوظة © {new Date().getFullYear()}</span>
          </div>
          <div className="row gap-12 tiny muted">
            <span className="row gap-4"><Clock size={12} /> {s.city}</span>
            <Link to="/" style={{ color: "var(--primary)" }}>دخول النظام</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
