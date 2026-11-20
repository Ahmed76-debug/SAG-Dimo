import type { DB } from "./types";
import { defaultProfile, defaultSettings } from "./seed";

const APP_ID = "tabib-clinic";
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 30 * 1024 * 1024;

const COLLECTION_KEYS = [
  "patients",
  "appointments",
  "bookings",
  "visits",
  "prescriptions",
  "invoices",
  "archive",
  "users",
  "reminders",
] as const;

export interface BackupCounts {
  patients: number;
  appointments: number;
  bookings: number;
  visits: number;
  prescriptions: number;
  invoices: number;
  archive: number;
  users: number;
  reminders: number;
}

export interface ParsedBackup {
  db: DB;
  createdAt: string | null;
  counts: BackupCounts;
}

type BackupParseResult =
  | { ok: true; backup: ParsedBackup }
  | { ok: false; error: string };

type SaveBackupResult =
  | { status: "saved"; method: "directory" | "file"; fileName: string; location?: string }
  | { status: "downloaded"; fileName: string }
  | { status: "cancelled" }
  | { status: "error"; error: string };

type PickBackupResult =
  | { status: "opened"; file: File }
  | { status: "unsupported" }
  | { status: "cancelled" }
  | { status: "error"; error: string };

type PickBackupFolderResult =
  | { status: "opened"; file: File; folderName: string; count: number }
  | { status: "empty"; folderName: string }
  | { status: "unsupported" }
  | { status: "cancelled" }
  | { status: "error"; error: string };

const JSON_TYPES = [
  {
    description: "نسخة احتياطية من منصة طبيب",
    accept: { "application/json": [".json"] },
  },
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function backupFileName(date = new Date()): string {
  return (
    `tabib-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.json`
  );
}

/** ملف النسخة الجديد يحمل بيانات وصفية، مع دعم النسخ القديمة المكوّنة من DB مباشرة. */
export function buildBackup(db: DB, date = new Date()): string {
  return JSON.stringify(
    {
      app: APP_ID,
      version: BACKUP_VERSION,
      createdAt: date.toISOString(),
      data: db,
    },
    null,
    2
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return !!value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function backupError(message: string): BackupParseResult {
  return { ok: false, error: message };
}

export function parseBackupText(text: string): BackupParseResult {
  let root: unknown;
  try {
    root = JSON.parse(text.replace(/^\uFEFF/, "").trim());
  } catch {
    return backupError("الملف ليس ملف JSON صالحًا.");
  }

  const rootObject = asRecord(root);
  if (!rootObject) return backupError("بنية النسخة الاحتياطية غير صحيحة.");

  if (rootObject.app !== undefined && rootObject.app !== APP_ID) {
    return backupError("هذا الملف لا يخص منصة طبيب.");
  }

  const wrapped = rootObject.app === APP_ID;
  if (wrapped && Number(rootObject.version) > BACKUP_VERSION) {
    return backupError("النسخة الاحتياطية أُنشئت بإصدار أحدث غير مدعوم.");
  }

  const raw = wrapped ? asRecord(rootObject.data) : rootObject;
  if (!raw) return backupError("النسخة الاحتياطية لا تحتوي على بيانات صالحة.");

  for (const key of COLLECTION_KEYS) {
    if (key === "reminders" && raw[key] === undefined) continue;
    if (!Array.isArray(raw[key])) {
      return backupError(`قسم «${key}» مفقود أو غير صالح في النسخة الاحتياطية.`);
    }
  }

  const settings = asRecord(raw.settings);
  const profile = asRecord(raw.profile);
  if (!settings) return backupError("إعدادات العيادة مفقودة من النسخة الاحتياطية.");
  if (!profile) return backupError("الملف التعريفي للطبيب مفقود من النسخة الاحتياطية.");

  const db: DB = {
    patients: raw.patients as DB["patients"],
    appointments: raw.appointments as DB["appointments"],
    bookings: raw.bookings as DB["bookings"],
    visits: raw.visits as DB["visits"],
    prescriptions: raw.prescriptions as DB["prescriptions"],
    invoices: raw.invoices as DB["invoices"],
    archive: raw.archive as DB["archive"],
    users: raw.users as DB["users"],
    reminders: (raw.reminders as DB["reminders"] | undefined) ?? [],
    audit: Array.isArray(raw.audit) ? (raw.audit as DB["audit"]) : [],
    settings: { ...defaultSettings, ...(settings as Partial<DB["settings"]>) },
    profile: { ...defaultProfile, ...(profile as Partial<DB["profile"]>) },
  };

  // الحقول التي تعتمد عليها الواجهة في صورة مصفوفات.
  if (!Array.isArray(db.settings.workingDays)) db.settings.workingDays = defaultSettings.workingDays;
  if (!Array.isArray(db.settings.paymentMethods)) db.settings.paymentMethods = defaultSettings.paymentMethods;
  for (const key of ["languages", "education", "certifications", "memberships", "services", "awards"] as const) {
    if (!Array.isArray(db.profile[key])) {
      (db.profile as any)[key] = defaultProfile[key];
    }
  }

  const idSets: Partial<Record<(typeof COLLECTION_KEYS)[number], Set<string>>> = {};
  for (const key of COLLECTION_KEYS) {
    const rows = db[key] as any[];
    const ids = new Set<string>();
    for (let index = 0; index < rows.length; index += 1) {
      const row = asRecord(rows[index]);
      if (!row) return backupError(`يوجد سجل غير صالح في قسم «${key}».`);
      if (typeof row.id !== "string" || !row.id.trim()) {
        return backupError(`يوجد سجل بلا معرّف في قسم «${key}».`);
      }
      if (ids.has(row.id)) {
        return backupError(`يوجد معرّف مكرر «${row.id}» في قسم «${key}».`);
      }
      ids.add(row.id);
    }
    idSets[key] = ids;
  }

  const uniqueFields: Array<[keyof DB, string, string]> = [
    ["patients", "code", "كود المريض"],
    ["bookings", "ref", "رقم طلب الحجز"],
    ["prescriptions", "number", "رقم الروشتة"],
    ["invoices", "number", "رقم الفاتورة"],
  ];
  for (const [collection, field, label] of uniqueFields) {
    const seen = new Set<string>();
    for (const row of db[collection] as any[]) {
      const value = row[field];
      if (typeof value !== "string" || !value.trim()) {
        return backupError(`يوجد سجل بلا ${label} في النسخة.`);
      }
      if (seen.has(value)) return backupError(`يوجد ${label} مكرر «${value}» في النسخة.`);
      seen.add(value);
    }
  }

  const patientIds = idSets.patients ?? new Set<string>();
  const appointmentIds = idSets.appointments ?? new Set<string>();
  const visitIds = idSets.visits ?? new Set<string>();

  for (const appointment of db.appointments) {
    if (!patientIds.has(appointment.patientId)) {
      return backupError(`الموعد «${appointment.id}» مرتبط بمريض غير موجود في النسخة.`);
    }
  }
  for (const visit of db.visits) {
    if (!patientIds.has(visit.patientId)) {
      return backupError(`الزيارة «${visit.id}» مرتبطة بمريض غير موجود في النسخة.`);
    }
  }
  for (const prescription of db.prescriptions) {
    if (!patientIds.has(prescription.patientId)) {
      return backupError(`الروشتة «${prescription.id}» مرتبطة بمريض غير موجود في النسخة.`);
    }
    if (prescription.visitId && !visitIds.has(prescription.visitId)) {
      return backupError(`الروشتة «${prescription.id}» مرتبطة بزيارة غير موجودة في النسخة.`);
    }
  }
  for (const invoice of db.invoices) {
    if (!patientIds.has(invoice.patientId)) {
      return backupError(`الفاتورة «${invoice.id}» مرتبطة بمريض غير موجود في النسخة.`);
    }
    if (invoice.appointmentId && !appointmentIds.has(invoice.appointmentId)) {
      return backupError(`الفاتورة «${invoice.id}» مرتبطة بموعد غير موجود في النسخة.`);
    }
  }
  for (const booking of db.bookings) {
    if (booking.patientId && !patientIds.has(booking.patientId)) {
      return backupError(`طلب الحجز «${booking.ref}» مرتبط بمريض غير موجود في النسخة.`);
    }
    if (booking.appointmentId && !appointmentIds.has(booking.appointmentId)) {
      return backupError(`طلب الحجز «${booking.ref}» مرتبط بموعد غير موجود في النسخة.`);
    }
  }
  for (const item of db.archive) {
    if (item.patientId && !patientIds.has(item.patientId)) {
      return backupError(`ملف الأرشيف «${item.title}» مرتبط بمريض غير موجود في النسخة.`);
    }
  }

  const counts = COLLECTION_KEYS.reduce((result, key) => {
    result[key] = (db[key] as any[]).length;
    return result;
  }, {} as BackupCounts);

  return {
    ok: true,
    backup: {
      db,
      createdAt: wrapped && typeof rootObject.createdAt === "string" ? rootObject.createdAt : null,
      counts,
    },
  };
}

export async function readBackupFile(file: File): Promise<BackupParseResult> {
  if (file.size > MAX_BACKUP_BYTES) {
    return backupError("حجم النسخة الاحتياطية أكبر من 30 ميجابايت.");
  }
  if (!/\.json$/i.test(file.name) && file.type !== "application/json") {
    return backupError("اختر ملف نسخة احتياطية بصيغة JSON.");
  }
  try {
    const text = await file.text();
    return parseBackupText(text);
  } catch {
    return backupError("تعذر قراءة ملف النسخة الاحتياطية.");
  }
}

function isCancel(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === "AbortError";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "خطأ غير متوقع");
}

function downloadBackup(fileName: string, content: string) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * المتصفحات الداعمة تسمح باختيار مجلد الحفظ فعليًا.
 * عند عدم الدعم ننتقل إلى نافذة حفظ الملف، ثم إلى التنزيل العادي.
 */
export async function saveBackupFile(content: string, fileName = backupFileName()): Promise<SaveBackupResult> {
  const win = window as any;
  const secure = window.isSecureContext !== false;

  if (secure && typeof win.showDirectoryPicker === "function") {
    try {
      const directory = await win.showDirectoryPicker({ mode: "readwrite" });
      const handle = await directory.getFileHandle(fileName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(new Blob([content], { type: "application/json;charset=utf-8" }));
      await writable.close();
      return {
        status: "saved",
        method: "directory",
        fileName,
        location: typeof directory.name === "string" ? directory.name : undefined,
      };
    } catch (error) {
      if (isCancel(error)) return { status: "cancelled" };
      // نكمل إلى منتقي الملف ثم التنزيل عند منع صلاحية المجلد.
    }
  }

  if (secure && typeof win.showSaveFilePicker === "function") {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: fileName,
        types: JSON_TYPES,
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([content], { type: "application/json;charset=utf-8" }));
      await writable.close();
      return {
        status: "saved",
        method: "file",
        fileName: typeof handle.name === "string" ? handle.name : fileName,
      };
    } catch (error) {
      if (isCancel(error)) return { status: "cancelled" };
      // التنزيل العادي هو الخيار الأخير.
    }
  }

  try {
    downloadBackup(fileName, content);
    return { status: "downloaded", fileName };
  } catch (error) {
    return { status: "error", error: errorMessage(error) };
  }
}

export async function pickBackupFile(): Promise<PickBackupResult> {
  const win = window as any;
  if (window.isSecureContext === false || typeof win.showOpenFilePicker !== "function") {
    return { status: "unsupported" };
  }
  try {
    const handles = await win.showOpenFilePicker({
      multiple: false,
      types: JSON_TYPES,
    });
    const handle = handles?.[0];
    if (!handle) return { status: "cancelled" };
    return { status: "opened", file: await handle.getFile() };
  } catch (error) {
    if (isCancel(error)) return { status: "cancelled" };
    return { status: "unsupported" };
  }
}

/** اختيار مجلد ثم استعادة أحدث ملف JSON بداخله — للمتصفحات التي تدعم اختيار المجلد. */
export async function pickBackupFromFolder(): Promise<PickBackupFolderResult> {
  const win = window as any;
  if (window.isSecureContext === false || typeof win.showDirectoryPicker !== "function") {
    return { status: "unsupported" };
  }
  try {
    const directory = await win.showDirectoryPicker({ mode: "read" });
    const files: File[] = [];
    for await (const handle of directory.values()) {
      if (handle.kind !== "file" || !/\.json$/i.test(handle.name)) continue;
      files.push(await handle.getFile());
    }
    if (!files.length) {
      return { status: "empty", folderName: typeof directory.name === "string" ? directory.name : "" };
    }
    const appBackups = files.filter((file) => /^tabib-backup-.*\.json$/i.test(file.name));
    const candidates = appBackups.length ? appBackups : files;
    candidates.sort((a, b) => b.lastModified - a.lastModified);
    return {
      status: "opened",
      file: candidates[0],
      folderName: typeof directory.name === "string" ? directory.name : "",
      count: candidates.length,
    };
  } catch (error) {
    if (isCancel(error)) return { status: "cancelled" };
    return { status: "error", error: errorMessage(error) };
  }
}

export function nativeFolderPickerSupported(): boolean {
  if (typeof window === "undefined" || window.isSecureContext === false) return false;
  return typeof (window as any).showDirectoryPicker === "function";
}

export function nativeFilePickersSupported(): boolean {
  if (typeof window === "undefined" || window.isSecureContext === false) return false;
  const win = window as any;
  return (
    typeof win.showDirectoryPicker === "function" ||
    typeof win.showSaveFilePicker === "function" ||
    typeof win.showOpenFilePicker === "function"
  );
}
