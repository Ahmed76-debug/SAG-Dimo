import type { Permission, Role } from "./types";

export const ALL_PERMISSIONS: { key: Permission; label: string; group: string }[] = [
  { key: "dashboard.view", label: "عرض لوحة التحكم", group: "عام" },
  { key: "patients.view", label: "عرض المرضى", group: "المرضى" },
  { key: "patients.edit", label: "إضافة وتعديل المرضى", group: "المرضى" },
  { key: "appointments.view", label: "عرض المواعيد", group: "المواعيد" },
  { key: "appointments.edit", label: "إدارة وحجز المواعيد", group: "المواعيد" },
  { key: "records.view", label: "عرض السجلات الطبية", group: "الملف الطبي" },
  { key: "records.edit", label: "تحرير الزيارات والتشخيص", group: "الملف الطبي" },
  { key: "prescriptions.view", label: "عرض الوصفات", group: "الملف الطبي" },
  { key: "prescriptions.edit", label: "كتابة الوصفات", group: "الملف الطبي" },
  { key: "billing.view", label: "عرض الفواتير", group: "المالية" },
  { key: "billing.edit", label: "إصدار وتحصيل الفواتير", group: "المالية" },
  { key: "archive.view", label: "عرض الأرشيف", group: "الأرشيف" },
  { key: "reports.view", label: "عرض التقارير", group: "التقارير" },
  { key: "users.view", label: "عرض المستخدمين", group: "النظام" },
  { key: "users.edit", label: "إدارة المستخدمين والصلاحيات", group: "النظام" },
  { key: "settings.edit", label: "تعديل إعدادات العيادة", group: "النظام" },
  { key: "profile.edit", label: "تعديل الملف التعريفي", group: "النظام" },
];

const P = (list: Permission[]) => list;

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  doctor: P(ALL_PERMISSIONS.map((p) => p.key)),
  manager: P([
    "dashboard.view",
    "patients.view",
    "patients.edit",
    "appointments.view",
    "appointments.edit",
    "records.view",
    "prescriptions.view",
    "billing.view",
    "billing.edit",
    "archive.view",
    "reports.view",
    "users.view",
    "users.edit",
    "settings.edit",
    "profile.edit",
  ]),
  receptionist: P([
    "dashboard.view",
    "patients.view",
    "patients.edit",
    "appointments.view",
    "appointments.edit",
    "billing.view",
    "billing.edit",
    "archive.view",
    "records.view",
  ]),
  nurse: P([
    "dashboard.view",
    "patients.view",
    "appointments.view",
    "appointments.edit",
    "records.view",
    "records.edit",
    "prescriptions.view",
    "archive.view",
  ]),
  accountant: P([
    "dashboard.view",
    "patients.view",
    "appointments.view",
    "billing.view",
    "billing.edit",
    "reports.view",
    "archive.view",
  ]),
};

/** يتحقق إن كان المستخدم يملك صلاحية معينة */
export function can(role: Role | undefined, extra: Permission[] | undefined, permission: Permission): boolean {
  if (!role) return false;
  const base = ROLE_PERMISSIONS[role] ?? [];
  return base.includes(permission) || (extra ?? []).includes(permission);
}
