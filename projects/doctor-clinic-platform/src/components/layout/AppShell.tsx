import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Archive,
  Award,
  BarChart3,
  Bell,
  BellRing,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Cloud,
  Database,
  FileText,
  FolderOpen,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Pencil,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  Stethoscope,
  UserCog,
  Users,
  Video,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { ROLE_LABEL } from "@/lib/types";
import type { Permission } from "@/lib/types";
import { Avatar, Badge } from "@/components/ui";
import { dayName, addDays, fmtDate, nowTime, todayISO } from "@/lib/utils";

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  perm?: Permission;
  end?: boolean;
  badge?: number;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { db, session, logout, theme, setTheme, hasPerm, cloud } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [q, setQ] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setNotifOpen(false);
    setUserOpen(false);
    setQ("");
    setSearchFocus(false);
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!themeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setThemeOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [themeOpen]);

  const pendingBookings = db.bookings.filter((b) => b.status === "pending");
  const today = todayISO();
  const todayAppts = db.appointments.filter((a) => a.date === today);
  const waiting = todayAppts.filter((a) => a.status === "waiting" || a.status === "confirmed");

  const reminderDue = useMemo(() => {
    const tomorrow = addDays(today, 1);
    const appts = db.appointments.filter(
      (a) =>
        a.date === tomorrow &&
        (a.status === "scheduled" || a.status === "confirmed" || a.status === "waiting")
    ).length;
    const bookings = db.bookings.filter((b) => b.status === "pending").length;
    const invoices = db.invoices.filter((i) => i.status === "unpaid" || i.status === "partial").length;
    const latest = new Map<string, string | undefined>();
    [...db.visits].sort((a, b) => a.date.localeCompare(b.date)).forEach((v) => latest.set(v.patientId, v.followUpDate));
    let follow = 0;
    const windowStart = addDays(today, -30);
    latest.forEach((d) => {
      if (d && d <= today && d >= windowStart) follow += 1;
    });
    return appts + bookings + invoices + follow;
  }, [db.appointments, db.bookings, db.invoices, db.visits, today]);

  const mainNav: NavEntry[] = [
    { to: "/", label: "لوحة التحكم", icon: LayoutDashboard, perm: "dashboard.view", end: true },
    { to: "/patients", label: "المرضى", icon: Users, perm: "patients.view" },
    { to: "/appointments", label: "جدول المواعيد", icon: CalendarDays, perm: "appointments.view" },
    { to: "/booking-requests", label: "طلبات الحجز", icon: CalendarCheck, perm: "appointments.view", badge: pendingBookings.length },
    { to: "/reminders", label: "مركز التذكيرات", icon: BellRing, perm: "appointments.view", badge: reminderDue },
    { to: "/medical-records", label: "السجلات الطبية", icon: FolderOpen, perm: "records.view" },
    { to: "/prescriptions", label: "الوصفات الطبية", icon: FileText, perm: "prescriptions.view" },
  ];

  const financeNav: NavEntry[] = [
    { to: "/billing", label: "الفواتير والمدفوعات", icon: Receipt, perm: "billing.view" },    { to: "/archive", label: "الأرشيف الطبي", icon: Archive, perm: "archive.view" },
    { to: "/reports", label: "التقارير والإحصائيات", icon: BarChart3, perm: "reports.view" },
    { to: "/print", label: "مركز الطباعة", icon: Printer, perm: "records.view" },
  ];

  const systemNav: NavEntry[] = [
    { to: "/tutorials", label: "فيديوهات الشرح", icon: Video },
    { to: "/audit", label: "سجل النشاط", icon: History, perm: "settings.edit" },
    { to: "/data-tools", label: "النسخ الاحتياطي وأدوات البيانات", icon: Database, perm: "settings.edit" },
    { to: "/users", label: "المستخدمون والصلاحيات", icon: UserCog, perm: "users.view" },
    { to: "/settings", label: "إعدادات العيادة", icon: SettingsIcon, perm: "settings.edit" },
  ];

  const profileNav: NavEntry[] = [
    { to: "/doctor", label: "الملف التعريفي العام", icon: Award },
    { to: "/profile/edit", label: "تحرير الملف التعريفي", icon: Pencil, perm: "profile.edit" },
  ];

  const visible = (list: NavEntry[]) => list.filter((n) => !n.perm || hasPerm(n.perm));

  const renderGroup = (title: string, list: NavEntry[]) => {
    const items = visible(list);
    if (!items.length) return null;
    return (
      <React.Fragment>
        <div className="nav-group-title">{title}</div>
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <n.icon size={17} strokeWidth={2} className="ico" />
            <span className="grow">{n.label}</span>
            {n.badge ? <span className="nav-badge">{n.badge}</span> : null}
          </NavLink>
        ))}
      </React.Fragment>
    );
  };

  const searchResults = useMemo(() => {
    const term = q.trim();
    if (term.length < 2) return { patients: [], pages: [] };
    const patients = db.patients
      .filter((p) => p.name.includes(term) || p.phone.includes(term) || p.code.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 5);
    const pages = [...mainNav, ...financeNav, ...systemNav, ...profileNav]
      .filter((n) => n.label.includes(term))
      .slice(0, 4);
    return { patients, pages };
  }, [q, db.patients, session]);

  const openSearchResult = (to: string) => {
    navigate(to);
    setQ("");
    setSearchFocus(false);
  };

  return (
    <div className="app-shell">
      {mobileOpen ? (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(4,22,26,.45)",
            backdropFilter: "blur(2px)",
            zIndex: 55,
          }}
        />
      ) : null}

      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Stethoscope size={22} strokeWidth={2.2} />
          </div>
          <div className="grow">
            <div className="brand-name">منصة طبيب</div>
            <div className="brand-sub">نظام إدارة العيادة المتكامل</div>
          </div>
          <button className="icon-btn mobile-only" onClick={() => setMobileOpen(false)} aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <nav className="nav-scroll">
          {renderGroup("العمل اليومي", mainNav)}
          {renderGroup("المالية والأرشيف", financeNav)}
          {renderGroup("الملف التعريفي", profileNav)}
          {renderGroup("النظام", systemNav)}
        </nav>

        <div className="sidebar-foot">
          <div className="side-card">
            <div className="side-card-title">
              <Activity size={14} /> العيادة تعمل الآن
            </div>
            <p>
              {dayName(today)} · {todayAppts.length} موعد اليوم · {waiting.length} في الانتظار
            </p>
            <button
              className="btn btn-primary btn-sm btn-block"
              style={{ marginTop: 9 }}
              onClick={() => navigate("/appointments?new=1")}
            >
              <Plus size={14} /> حجز موعد جديد
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setMobileOpen(true)} aria-label="القائمة">
            <Menu size={20} />
          </button>

          <div className="searchbar" style={{ position: "relative" }}>
            <Search size={15} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => window.setTimeout(() => setSearchFocus(false), 160)}
              placeholder="ابحث عن مريض، رقم ملف، أو صفحة…"
            />
            <kbd>⌘K</kbd>
            {searchFocus && q.trim().length >= 2 ? (
              <div className="menu" style={{ insetInlineStart: 0, insetInlineEnd: 0, top: 46, minWidth: 0 }}>
                {searchResults.patients.length ? (
                  <>
                    <div className="nav-group-title" style={{ padding: "4px 8px 6px" }}>المرضى</div>
                    {searchResults.patients.map((p) => (
                      <button key={p.id} className="menu-item" onMouseDown={() => openSearchResult(`/patients/${p.id}`)}>
                        <Avatar name={p.name} size="sm" />
                        <div className="grow" style={{ lineHeight: 1.3 }}>
                          <div className="truncate">{p.name}</div>
                          <div className="tiny muted">
                            {p.code} · {p.phone}
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                ) : null}
                {searchResults.pages.length ? (
                  <>
                    <div className="menu-sep" />
                    <div className="nav-group-title" style={{ padding: "4px 8px 6px" }}>صفحات</div>
                    {searchResults.pages.map((p) => (
                      <button key={p.to} className="menu-item" onMouseDown={() => openSearchResult(p.to)}>
                        <p.icon size={15} />
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </>
                ) : null}
                {!searchResults.patients.length && !searchResults.pages.length ? (
                  <div className="menu-item muted">لا توجد نتائج مطابقة</div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grow" />

          <span className="tiny muted hide-sm">{nowTime()}</span>

          <button
            type="button"
            className={`cloud-badge hide-sm ${cloud.status === "error" ? "err" : cloud.status === "online" ? "ok" : "warn"}`}
            onClick={() => navigate("/settings")}
            title={
              cloud.enabled
                ? cloud.lastSync
                  ? `آخر مزامنة: ${new Date(cloud.lastSync).toLocaleString("ar-EG")}`
                  : "جارٍ الاتصال بقاعدة البيانات"
                : "الوضع المحلي — البيانات على هذا الجهاز"
            }
          >
            {cloud.status === "syncing" || cloud.status === "connecting" ? (
              <RefreshCw size={13} className="spin" />
            ) : (
              <Cloud size={13} />
            )}
            {!cloud.enabled
              ? "محلي آمن"
              : cloud.status === "error"
                ? "تعذر المزامنة"
                : cloud.pending
                  ? "بانتظار المزامنة"
                  : "سحابي متصل"}
          </button>

          <button className="icon-btn" onClick={() => navigate("/appointments?new=1")} title="حجز موعد">
            <Plus size={19} />
          </button>

          <div ref={notifRef} style={{ position: "relative" }}>
            <button
              className={`icon-btn ${pendingBookings.length ? "dot" : ""}`}
              onClick={() => setNotifOpen((o) => !o)}
              title="التنبيهات"
            >
              <Bell size={19} />
            </button>
            {notifOpen ? (
              <div className="menu" style={{ width: 320, minWidth: 320 }}>
                <div className="row-between" style={{ padding: "6px 8px 8px" }}>
                  <b className="small">التنبيهات</b>
                  <span className="tiny muted">{pendingBookings.length + waiting.length} جديد</span>
                </div>
                <div className="menu-sep" />
                {pendingBookings.slice(0, 3).map((b) => (
                  <button key={b.id} className="menu-item" onClick={() => navigate("/booking-requests")}>
                    <CalendarCheck size={15} style={{ color: "var(--warn)" }} />
                    <div className="grow" style={{ lineHeight: 1.35 }}>
                      <div className="truncate small">{b.patientName} — طلب حجز جديد</div>
                      <div className="tiny muted">
                        {b.service} · بانتظار تحقق الدفع
                      </div>
                    </div>
                  </button>
                ))}
                {waiting.slice(0, 3).map((a) => {
                  const p = db.patients.find((x) => x.id === a.patientId);
                  return (
                    <button key={a.id} className="menu-item" onClick={() => navigate("/appointments")}>
                      <ClipboardList size={15} style={{ color: "var(--primary)" }} />
                      <div className="grow" style={{ lineHeight: 1.35 }}>
                        <div className="truncate small">{p?.name ?? "مريض"} في الانتظار</div>
                        <div className="tiny muted">موعد {a.time}</div>
                      </div>
                    </button>
                  );
                })}
                {!pendingBookings.length && !waiting.length ? (
                  <div className="menu-item muted">لا توجد تنبيهات الآن</div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div ref={themeRef} style={{ position: "relative" }}>
            <button className="icon-btn" onClick={() => setThemeOpen((o) => !o)} title="معرض الثيمات" aria-label="معرض الثيمات">
              <Palette size={19} />
            </button>
            {themeOpen
              ? createPortal(
                  <div
                    className="overlay"
                    onMouseDown={(event) => {
                      if (event.target === event.currentTarget) setThemeOpen(false);
                    }}
                  >
                    <div className="modal modal-lg" role="dialog" aria-modal="true" aria-label="معرض الثيمات">
                      <div className="modal-hd">
                        <div>
                          <h3>معرض الثيمات</h3>
                          <div className="sub">اختر المظهر المناسب للعيادة</div>
                        </div>
                        <button className="icon-btn" onClick={() => setThemeOpen(false)} aria-label="إغلاق">
                          <X size={18} />
                        </button>
                      </div>
                      <div className="modal-bd">
                        {(() => {
                  const THEMES = [
                    { id: "light", name: "فاتح (افتراضي)", mode: "light", c: { bg: "#f4f7fb", surface: "#ffffff", brand: "#2563eb", accent: "#0891b2" } },
                    { id: "light-sand", name: "فاتح رملي", mode: "light", c: { bg: "#f6f1e8", surface: "#fffaf2", brand: "#b7791f", accent: "#0f766e" } },
                    { id: "light-mist", name: "فاتح ضبابي", mode: "light", c: { bg: "#eef4ff", surface: "#ffffff", brand: "#2563eb", accent: "#0891b2" } },
                    { id: "dark", name: "داكن (افتراضي)", mode: "dark", c: { bg: "#0b1220", surface: "#121a2b", brand: "#60a5fa", accent: "#22d3ee" } },
                    { id: "dark-midnight", name: "داكن ليلي", mode: "dark", c: { bg: "#060816", surface: "#0f1428", brand: "#8b5cf6", accent: "#22d3ee" } },
                    { id: "dark-emerald", name: "داكن زمردي", mode: "dark", c: { bg: "#071311", surface: "#102220", brand: "#34d399", accent: "#14b8a6" } },
                    { id: "system", name: "حسب النظام", mode: "system", c: { bg: "#e5e7eb", surface: "#ffffff", brand: "#64748b", accent: "#94a3b8" } },
                  ] as const;
                  const Card = (t: typeof THEMES[number]) => {
                    const active = theme === t.id;
                    return (
                      <button key={t.id} type="button" onClick={() => { setTheme(t.id as any); setThemeOpen(false); }} title={t.name}
                        style={{ textAlign: "start", border: `2px solid ${active ? "var(--primary)" : "var(--border)"}`, borderRadius: 16, padding: 10, background: "var(--surface)", cursor: "pointer", width: "100%" }}>
                        <span style={{ display: "grid", gridTemplateColumns: "22px 1fr", height: 68, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: t.c.bg, position: "relative" }}>
                          <span style={{ background: t.c.brand, position: "relative" }}><span style={{ position: "absolute", top: 9, left: 5, right: 5, height: 6, borderRadius: 4, background: "rgba(255,255,255,.55)" }} /></span>
                          <span style={{ padding: "7px 6px", display: "flex", flexDirection: "column", gap: 5 }}>
                            <span style={{ height: 9, borderRadius: 5, background: t.c.surface, border: "1px solid rgba(128,128,128,.2)" }} />
                            <span style={{ height: 6, width: "70%", borderRadius: 4, background: t.c.surface, border: "1px solid rgba(128,128,128,.16)" }} />
                            <span style={{ height: 6, width: "45%", borderRadius: 4, background: t.c.surface, border: "1px solid rgba(128,128,128,.16)" }} />
                            <span style={{ display: "flex", gap: 4, marginTop: "auto" }}><i style={{ width: 13, height: 13, borderRadius: 4, background: t.c.brand, display: "block" }} /><i style={{ width: 13, height: 13, borderRadius: 4, background: t.c.accent, display: "block" }} /><i style={{ width: 13, height: 13, borderRadius: 4, background: t.c.surface, border: "1px solid rgba(128,128,128,.25)", display: "block" }} /></span>
                          </span>
                          {active ? <span style={{ position: "absolute", top: 6, insetInlineEnd: 6, width: 20, height: 20, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>✓</span> : null}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontWeight: 800, fontSize: 13 }}>{t.name}<span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: active ? "rgba(37,99,235,.12)" : "var(--surface-2)", color: active ? "var(--primary)" : "var(--muted)", fontWeight: 800 }}>{t.mode === "dark" ? "داكن" : t.mode === "light" ? "فاتح" : "تلقائي"}</span></span>
                      </button>
                    );
                  };
                  const lights = THEMES.filter(t=>t.mode==="light");
                  const darks = THEMES.filter(t=>t.mode==="dark");
                  const sys = THEMES.filter(t=>t.mode==="system");
                  return (
                    <div style={{ display: "grid", gap: 16 }}>
                      <section><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "linear-gradient(135deg,#fde68a,#fff)", border: "1px solid #d6dbe6" }} /><h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>الثيمات الفاتحة</h4><span className="tiny muted">{lights.length}</span></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>{lights.map(Card)}</div></section>
                      <section><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "linear-gradient(135deg,#334155,#0b1220)", border: "1px solid #334155" }} /><h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>الثيمات الداكنة</h4><span className="tiny muted">{darks.length}</span></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>{darks.map(Card)}</div></section>
                      <section><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "linear-gradient(135deg,#cbd5e1,#fff)", border: "1px solid #cbd5e1" }} /><h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>تلقائي</h4><span className="tiny muted">{sys.length}</span></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>{sys.map(Card)}</div></section>
                    </div>
                  );
                })()}
                      </div>
                    </div>
                  </div>,
                  document.body
                )
              : null}
          </div>

          <div ref={userRef} style={{ position: "relative" }}>
            <button className="user-chip" onClick={() => setUserOpen((o) => !o)}>
              <Avatar name={session?.name ?? "طبيب"} size="sm" />
              <div className="user-meta">
                <b>{session?.name}</b>
                <span>{session ? ROLE_LABEL[session.role] : ""}</span>
              </div>
              <ChevronDown size={14} className="muted" />
            </button>
            {userOpen ? (
              <div className="menu">
                <div style={{ padding: "8px 10px 10px" }}>
                  <div className="small bold">{session?.name}</div>
                  <div className="tiny muted">{session?.email}</div>
                </div>
                <div className="menu-sep" />
                <button className="menu-item" onClick={() => navigate("/settings")}>
                  <SettingsIcon size={15} /> إعدادات العيادة
                </button>
                <button className="menu-item" onClick={() => navigate("/doctor")}>
                  <Award size={15} /> الملف التعريفي
                </button>
                <div className="menu-sep" />
                <button className="menu-item" onClick={logout} style={{ color: "var(--danger)" }}>
                  <LogOut size={15} /> تسجيل الخروج
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="content">{children}</main>

        <footer className="no-print" style={{ padding: "14px 22px 22px", textAlign: "center", color: "var(--ink-3)", fontSize: ".72rem" }}>
          منصة طبيب © {new Date().getFullYear()} — {db.settings.clinicName} ·{" "}
          {cloud.enabled
            ? "بيانات مشفّرة على Supabase مع نسخ احتياطي دوري"
            : "نسخة محلية تجريبية — فعّل السحابة من الإعدادات للوصول من أي جهاز"}
        </footer>
      </div>
    </div>
  );
}
