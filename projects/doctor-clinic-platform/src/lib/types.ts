/* ==========================================================================
   Domain model — منصة طبيب
   ========================================================================== */

export type Role = "doctor" | "manager" | "receptionist" | "nurse" | "accountant";

export type Permission =
  | "dashboard.view"
  | "patients.view"
  | "patients.edit"
  | "appointments.view"
  | "appointments.edit"
  | "records.view"
  | "records.edit"
  | "prescriptions.view"
  | "prescriptions.edit"
  | "billing.view"
  | "billing.edit"
  | "archive.view"
  | "reports.view"
  | "users.view"
  | "users.edit"
  | "settings.edit"
  | "profile.edit";

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  phone: string;
  active: boolean;
  specialty?: string;
  extraPermissions: Permission[];
  createdAt: string;
}

export type Gender = "male" | "female";

export interface Patient {
  id: string;
  code: string;
  name: string;
  phone: string;
  gender: Gender;
  birthDate: string;
  nationalId?: string;
  bloodType?: string;
  allergies: string[];
  chronic: string[];
  address?: string;
  insurance?: string;
  job?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  notes?: string;
  tags: string[];
  createdAt: string;
}

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "waiting"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "no-show";

export type AppointmentType = "consultation" | "followup" | "procedure" | "telemedicine" | "emergency";

export interface Appointment {
  id: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  duration: number; // minutes
  type: AppointmentType;
  status: AppointmentStatus;
  doctorId: string;
  room?: string;
  fee: number;
  source: "clinic" | "online";
  complaint?: string;
  notes?: string;
  createdAt: string;
}

export type BookingStatus = "pending" | "verified" | "rejected" | "converted";

export interface BookingRequest {
  id: string;
  ref: string;
  patientName: string;
  phone: string;
  email?: string;
  gender: Gender;
  service: string;
  preferredDate: string;
  preferredTime: string;
  complaint?: string;
  paymentMethod: "instapay" | "vodafone-cash" | "bank-transfer" | "card" | "cash";
  paymentRef: string;
  paymentAmount: number;
  receiptName?: string;
  status: BookingStatus;
  createdAt: string;
  reviewNote?: string;
  appointmentId?: string;
  patientId?: string;
}

export interface Vitals {
  temp?: number;
  bpSys?: number;
  bpDia?: number;
  pulse?: number;
  weight?: number;
  height?: number;
  spo2?: number;
  glucose?: number;
}

export interface Visit {
  id: string;
  patientId: string;
  date: string;
  doctorId: string;
  type: "consultation" | "followup" | "emergency" | "telemedicine";
  chiefComplaint: string;
  history?: string;
  examination?: string;
  diagnosis: string[];
  icd?: string;
  plan?: string;
  vitals: Vitals;
  notes?: string;
  followUpDate?: string;
  attachments: { name: string; kind: string }[];
  createdAt: string;
}

export interface PrescriptionItem {
  id: string;
  name: string;
  form: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  notes?: string;
}

export interface Prescription {
  id: string;
  number: string;
  patientId: string;
  visitId?: string;
  doctorId: string;
  date: string;
  diagnosis?: string;
  items: PrescriptionItem[];
  advice?: string;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  desc: string;
  qty: number;
  price: number;
}

export interface Invoice {
  id: string;
  number: string;
  patientId: string;
  appointmentId?: string;
  date: string;
  items: InvoiceItem[];
  discount: number;
  taxRate: number;
  paid: number;
  method: "cash" | "card" | "instapay" | "vodafone-cash" | "insurance" | "transfer";
  status: "paid" | "partial" | "unpaid" | "refunded";
  notes?: string;
  createdAt: string;
}

export interface ArchiveItem {
  id: string;
  title: string;
  category: "lab" | "radiology" | "consent" | "report" | "insurance" | "other";
  patientId?: string;
  date: string;
  tags: string[];
  size: string;
  format: "pdf" | "jpg" | "png" | "docx";
  note?: string;
}

export interface WorkingDay {
  day: string;
  open: boolean;
  from: string;
  to: string;
}

export interface Settings {
  clinicName: string;
  clinicNameEn: string;
  doctorName: string;
  specialty: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  currency: string;
  taxRate: number;
  consultationFee: number;
  followUpFee: number;
  slotMinutes: number;
  workingDays: WorkingDay[];
  onlineBookingEnabled: boolean;
  requirePayment: boolean;
  depositAmount: number;
  autoConfirm: boolean;
  reminderHours: number;
  paymentMethods: string[];
  bankAccount: string;
  instapayHandle: string;
  vodafoneCash: string;
  theme?: "light" | "light-sand" | "light-mist" | "dark" | "dark-midnight" | "dark-emerald" | "system";
}

export type ThemeId =
  | "light"
  | "light-sand"
  | "light-mist"
  | "dark"
  | "dark-midnight"
  | "dark-emerald"
  | "system";

/* ------------------------------ فيديوهات الشرح ------------------------------ */

export interface TutorialVideo {
  id: string;
  title: string;
  pageName: string;
  videoNumber: number;
  description?: string;
  fileName: string;
  mimeType: string;
  size: number;
  videoData: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface DoctorProfile {
  name: string;
  title: string;
  specialty: string;
  subSpecialty: string;
  bio: string;
  philosophy: string;
  experienceYears: number;
  patientsCount: string;
  rating: number;
  reviewsCount: number;
  languages: string[];
  education: { year: string; title: string; place: string }[];
  certifications: { year: string; title: string; org: string }[];
  memberships: string[];
  services: { icon: string; title: string; desc: string; price?: number }[];
  awards: { year: string; title: string }[];
  photoInitials: string;
  publicSlug: string;
}

export type ReminderKind = "appointment" | "booking" | "invoice" | "followup";

export interface ReminderLog {
  id: string;
  kind: ReminderKind;
  refId: string;
  patientName: string;
  phone: string;
  message: string;
  channel: "whatsapp" | "copy" | "manual";
  sentAt: string; // ISO datetime
  /** في الوضع السحابي: حالة الإرسال من محرك واتساب */
  status?: "sent" | "queued" | "delivered" | "read" | "failed";
  provider?: string;
  providerMessageId?: string;
  error?: string;
}

export type CloudStatus = "local" | "connecting" | "online" | "syncing" | "error";

export interface CloudState {
  enabled: boolean;
  ready: boolean;
  status: CloudStatus;
  lastSync: string | null;
  error: string | null;
  pending: boolean;
}

export type AuditAction = "create" | "update" | "delete" | "restore" | "truncate";

export interface AuditEntry {
  id: string;
  at: string;
  userId?: string;
  userName?: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  label?: string;
  before?: unknown;
  after?: unknown;
  /** سجلات مرتبطة حُذفت مع العنصر (مثل حذف مريض يحذف مواعيده وزياراته). */
  bundle?: unknown;
}

export interface DB {
  patients: Patient[];
  appointments: Appointment[];
  bookings: BookingRequest[];
  visits: Visit[];
  prescriptions: Prescription[];
  invoices: Invoice[];
  archive: ArchiveItem[];
  users: User[];
  reminders: ReminderLog[];
  audit: AuditEntry[];
  settings: Settings;
  profile: DoctorProfile;
}

export interface Session {
  userId: string;
  at: string;
}

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "مجدول",
  confirmed: "مؤكد",
  waiting: "في الانتظار",
  "in-progress": "داخل العيادة",
  completed: "مكتمل",
  cancelled: "ملغي",
  "no-show": "لم يحضر",
};

export const APPOINTMENT_TYPE_LABEL: Record<AppointmentType, string> = {
  consultation: "كشف جديد",
  followup: "متابعة",
  procedure: "إجراء طبي",
  telemedicine: "استشارة عن بُعد",
  emergency: "حالة طارئة",
};

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "بانتظار التحقق",
  verified: "تم التحقق",
  rejected: "مرفوض",
  converted: "تم تحويله لموعد",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة بنكية",
  instapay: "إنستاباي",
  "vodafone-cash": "فودافون كاش",
  insurance: "تأمين طبي",
  transfer: "تحويل بنكي",
  "bank-transfer": "تحويل بنكي",
};

export const ROLE_LABEL: Record<Role, string> = {
  doctor: "طبيب",
  manager: "مدير العيادة",
  receptionist: "موظف استقبال",
  nurse: "تمريض",
  accountant: "محاسب",
};
