import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Cloud, ShieldAlert, Stethoscope } from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Button, ToastHost } from "@/components/ui";
import type { Permission } from "@/lib/types";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Patients from "@/pages/Patients";
import PatientProfile from "@/pages/PatientProfile";
import Appointments from "@/pages/Appointments";
import BookingRequests from "@/pages/BookingRequests";
import Reminders from "@/pages/Reminders";
import MedicalRecords from "@/pages/MedicalRecords";
import Prescriptions from "@/pages/Prescriptions";
import Billing from "@/pages/Billing";
import Archive from "@/pages/Archive";
import Reports from "@/pages/Reports";
import Users from "@/pages/Users";
import Settings from "@/pages/Settings";
import DoctorProfile from "@/pages/DoctorProfile";
import ProfileAdmin from "@/pages/ProfileAdmin";
import PublicBooking from "@/pages/PublicBooking";
import PrintCenter from "@/pages/PrintCenter";
import Tutorials from "@/pages/Tutorials";
import Audit from "@/pages/Audit";
import DataTools from "@/pages/DataTools";

function Guard({ perm, children }: { perm?: Permission; children: React.ReactNode }) {
  const { session, hasPerm, recoveryMode } = useApp();
  const location = useLocation();

  if (recoveryMode) return <Navigate to="/login" replace />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (perm && !hasPerm(perm)) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="card card-pad" style={{ maxWidth: 420, textAlign: "center" }}>
          <div className="empty-ico" style={{ margin: "0 auto 14px", color: "var(--danger)", background: "var(--danger-soft)" }}>
            <ShieldAlert size={26} />
          </div>
          <h2 style={{ fontSize: "1.1rem" }}>لا تملك صلاحية الوصول</h2>
          <p className="muted small" style={{ marginTop: 6 }}>
            هذه الصفحة متاحة لأدوار محددة فقط. تواصل مع مدير العيادة لمنحك الصلاحية.
          </p>
          <Button variant="primary" style={{ marginTop: 16 }} onClick={() => (window.location.href = "/")}>
            العودة للوحة التحكم
          </Button>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

function LoginRoute() {
  const { session, recoveryMode } = useApp();
  if (session && !recoveryMode) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  const { toasts, dismissToast, cloud } = useApp();

  if (!cloud.ready) {
    return (
      <div className="cloud-boot">
        <div className="cloud-boot-card">
          <div className="brand-mark" style={{ width: 58, height: 58, margin: "0 auto 16px", borderRadius: 18 }}>
            <Stethoscope size={28} />
          </div>
          <div className="row gap-8" style={{ justifyContent: "center", fontWeight: 700 }}>
            <Cloud size={16} className="spin" />
            {cloud.enabled ? "جارٍ تجهيز عيادتك السحابية" : "جارٍ تجهيز بيانات العيادة"}
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>
            {cloud.enabled
              ? "اتصال مشفّر، تحقق من الهوية، وتحميل أحدث بيانات العيادة…"
              : "تحميل البيانات من قاعدة SQLite المُدارة على الخادم…"}
          </p>
          <div className="cloud-boot-bar">
            <span />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        {/* public */}
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/doctor" element={<DoctorProfile />} />
        <Route path="/book" element={<PublicBooking />} />

        {/* private */}
        <Route path="/" element={<Guard perm="dashboard.view"><Dashboard /></Guard>} />
        <Route path="/patients" element={<Guard perm="patients.view"><Patients /></Guard>} />
        <Route path="/patients/:id" element={<Guard perm="patients.view"><PatientProfile /></Guard>} />
        <Route path="/appointments" element={<Guard perm="appointments.view"><Appointments /></Guard>} />
        <Route path="/booking-requests" element={<Guard perm="appointments.view"><BookingRequests /></Guard>} />
        <Route path="/reminders" element={<Guard perm="appointments.view"><Reminders /></Guard>} />
        <Route path="/medical-records" element={<Guard perm="records.view"><MedicalRecords /></Guard>} />
        <Route path="/prescriptions" element={<Guard perm="prescriptions.view"><Prescriptions /></Guard>} />
        <Route path="/billing" element={<Guard perm="billing.view"><Billing /></Guard>} />
        <Route path="/archive" element={<Guard perm="archive.view"><Archive /></Guard>} />
        <Route path="/reports" element={<Guard perm="reports.view"><Reports /></Guard>} />
        <Route path="/print" element={<Guard perm="records.view"><PrintCenter /></Guard>} />
        <Route path="/tutorials" element={<Guard><Tutorials /></Guard>} />
        <Route path="/audit" element={<Guard perm="settings.edit"><Audit /></Guard>} />
        <Route path="/data-tools" element={<Guard perm="settings.edit"><DataTools /></Guard>} />
        <Route path="/users" element={<Guard perm="users.view"><Users /></Guard>} />
        <Route path="/settings" element={<Guard perm="settings.edit"><Settings /></Guard>} />
        <Route path="/profile/edit" element={<Guard perm="profile.edit"><ProfileAdmin /></Guard>} />

        <Route path="*" element={<NotFound />} />
      </Routes>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

function NotFound() {
  useLocation();
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div className="brand-mark" style={{ width: 64, height: 64, margin: "0 auto 16px", borderRadius: 20 }}>
          <Stethoscope size={30} />
        </div>
        <h1 style={{ fontSize: "2.4rem" }}>404</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <Button variant="primary" style={{ marginTop: 18 }} onClick={() => (window.location.href = "/")}>
          العودة للرئيسية
        </Button>
      </div>
    </div>
  );
}
