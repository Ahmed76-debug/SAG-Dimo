/* ==========================================================================
   Cloud data layer — Supabase/PostgreSQL
   - الوضع المحلي (بدون مفاتيح) يبقى يعمل كما هو.
   - عند وجود VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY يتم استخدام السحابة.
   ========================================================================== */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DB, DoctorProfile, Settings, User } from "./types";

const RAW_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const RAW_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

export const cloudEnabled = Boolean(RAW_URL && RAW_KEY);

let clientPromise: Promise<SupabaseClient> | null = null;

/** تحميل مكتبة Supabase عند الحاجة فقط (لا تزيد حجم الوضع المحلي). */
export function getSupabase(): Promise<SupabaseClient> {
  if (!cloudEnabled) return Promise.reject(new Error("إعدادات السحابة غير موجودة"));
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(RAW_URL, RAW_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "tabib.auth.v1",
        },
      })
    );
  }
  return clientPromise;
}

/* ------------------------------------------------------------------ mapping */

export type Collection = Exclude<keyof DB, "settings" | "profile" | "users" | "audit"> | "users";
export const COLLECTIONS: Collection[] = [
  "patients",
  "appointments",
  "bookings",
  "visits",
  "prescriptions",
  "invoices",
  "archive",
  "users",
  "reminders",
];

interface TableDef {
  table: string;
  columns: string[];
  /** ترتيب الإدخال يحترم المفاتيح الأجنبية */
  order: number;
}

/** أعمدة قاعدة البيانات مكتوبة snake_case، والتطبيق camelCase — التحويل تلقائي. */
export const TABLES: Record<Collection, TableDef> = {
  patients: {
    table: "patients",
    order: 1,
    columns: [
      "id", "code", "name", "phone", "gender", "birthDate", "nationalId", "bloodType",
      "allergies", "chronic", "address", "insurance", "job", "emergencyName",
      "emergencyPhone", "notes", "tags", "createdAt",
    ],
  },
  bookings: {
    table: "bookings",
    order: 4,
    columns: [
      "id", "ref", "patientName", "phone", "email", "gender", "service", "preferredDate",
      "preferredTime", "complaint", "paymentMethod", "paymentRef", "paymentAmount",
      "receiptName", "status", "createdAt", "reviewNote", "appointmentId", "patientId",
    ],
  },
  appointments: {
    table: "appointments",
    order: 3,
    columns: [
      "id", "patientId", "date", "time", "duration", "type", "status", "doctorId", "room",
      "fee", "source", "complaint", "notes", "createdAt",
    ],
  },
  visits: {
    table: "visits",
    order: 5,
    columns: [
      "id", "patientId", "date", "doctorId", "type", "chiefComplaint", "history",
      "examination", "diagnosis", "icd", "plan", "vitals", "notes", "followUpDate",
      "attachments", "createdAt",
    ],
  },
  prescriptions: {
    table: "prescriptions",
    order: 6,
    columns: [
      "id", "number", "patientId", "visitId", "doctorId", "date", "diagnosis", "items",
      "advice", "status", "createdAt",
    ],
  },
  invoices: {
    table: "invoices",
    order: 7,
    columns: [
      "id", "number", "patientId", "appointmentId", "date", "items", "discount", "taxRate",
      "paid", "method", "status", "notes", "createdAt",
    ],
  },
  archive: {
    table: "archive",
    order: 8,
    columns: ["id", "title", "category", "patientId", "date", "tags", "size", "format", "note"],
  },
  reminders: {
    table: "reminders",
    order: 9,
    columns: [
      "id", "kind", "refId", "patientName", "phone", "message", "channel", "sentAt",
      "status", "provider", "providerMessageId", "error",
    ],
  },
  users: {
    table: "profiles",
    order: 0,
    columns: ["id", "name", "role", "email", "phone", "active", "specialty", "extraPermissions", "createdAt"],
  },
};

export const toSnake = (s: string) => s.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
export const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** الحقول المخزنة كـ date في PostgreSQL — نقصّ أي وقت ISO قبل الإرسال. */
const DATE_COLUMNS: Partial<Record<Collection, ReadonlySet<string>>> = {
  patients: new Set(["birthDate", "createdAt"]),
  appointments: new Set(["date", "createdAt"]),
  bookings: new Set(["preferredDate", "createdAt"]),
  visits: new Set(["date", "followUpDate", "createdAt"]),
  prescriptions: new Set(["date", "createdAt"]),
  invoices: new Set(["date", "createdAt"]),
  archive: new Set(["date"]),
  users: new Set(["createdAt"]),
};

/** حقول اختيارية في قاعدة البيانات: نرسل null عند مسحها حتى لا تبقى القيمة القديمة. */
const NULLABLE_COLUMNS: Partial<Record<Collection, ReadonlySet<string>>> = {
  users: new Set(["specialty"]),
  patients: new Set([
    "nationalId",
    "bloodType",
    "address",
    "insurance",
    "job",
    "emergencyName",
    "emergencyPhone",
    "notes",
  ]),
  appointments: new Set(["room", "complaint", "notes"]),
  bookings: new Set([
    "email",
    "complaint",
    "receiptName",
    "reviewNote",
    "appointmentId",
    "patientId",
  ]),
  visits: new Set(["history", "examination", "icd", "plan", "notes", "followUpDate"]),
  prescriptions: new Set(["visitId", "diagnosis", "advice"]),
  invoices: new Set(["appointmentId", "notes"]),
  archive: new Set(["patientId", "note"]),
  reminders: new Set(["provider", "providerMessageId", "error"]),
};

export function toRow(collection: Collection, item: Record<string, any>): Record<string, any> {
  const row: Record<string, any> = {};
  const dateCols = DATE_COLUMNS[collection];
  const nullable = NULLABLE_COLUMNS[collection];
  for (const col of TABLES[collection].columns) {
    if (item[col] === undefined) {
      if (nullable?.has(col)) row[toSnake(col)] = null;
      continue;
    }
    let value = item[col];
    if (dateCols?.has(col)) {
      value = typeof value === "string" && value.length > 10 ? value.slice(0, 10) : value || null;
    }
    row[toSnake(col)] = value;
  }
  return row;
}

export function fromRow(collection: Collection, row: Record<string, any>): any {
  const item: Record<string, any> = {};
  for (const col of TABLES[collection].columns) {
    const key = toSnake(col);
    if (row[key] !== undefined) item[col] = row[key];
  }
  return item;
}

/* ------------------------------------------------------------------ diffing */

export interface DBChange {
  upserts: { collection: Collection; rows: Record<string, any>[] }[];
  deletes: { collection: Collection; ids: string[] }[];
  settings: boolean;
  profile: boolean;
}

export function emptyChange(): DBChange {
  return { upserts: [], deletes: [], settings: false, profile: false };
}

export function isEmptyChange(c: DBChange): boolean {
  return !c.upserts.length && !c.deletes.length && !c.settings && !c.profile;
}

/** يقارن نسختين من البيانات ويستخرج الحد الأدنى من عمليات الكتابة. */
export function diffDB(prev: DB, next: DB): DBChange {
  const change = emptyChange();

  for (const collection of COLLECTIONS) {
    const prevList = ((prev as any)[collection] ?? []) as any[];
    const nextList = ((next as any)[collection] ?? []) as any[];
    const prevMap = new Map(prevList.map((x) => [x.id, JSON.stringify(x)]));
    const nextIds = new Set(nextList.map((x) => x.id));

    const changed = nextList.filter((x) => prevMap.get(x.id) !== JSON.stringify(x));
    if (changed.length) {
      change.upserts.push({ collection, rows: changed });
    }

    const removed = prevList.filter((x) => !nextIds.has(x.id)).map((x) => x.id);
    if (removed.length) {
      change.deletes.push({ collection, ids: removed });
    }
  }

  change.settings = JSON.stringify(prev.settings) !== JSON.stringify(next.settings);
  change.profile = JSON.stringify(prev.profile) !== JSON.stringify(next.profile);
  return change;
}

/* --------------------------------------------------------------- cloud I/O */

export interface CloudSnapshot {
  db: DB;
  settingsExists: boolean;
  profileExists: boolean;
}

export async function fetchPublicContent(supabase: SupabaseClient): Promise<{
  settings?: Settings;
  profile?: DoctorProfile;
}> {
  const [s, p] = await Promise.all([
    supabase.from("settings").select("data").eq("id", 1).maybeSingle(),
    supabase.from("doctor_profile").select("data").eq("id", 1).maybeSingle(),
  ]);
  if (s.error) throw s.error;
  if (p.error) throw p.error;
  return {
    settings: (s.data?.data as Settings | undefined) ?? undefined,
    profile: (p.data?.data as DoctorProfile | undefined) ?? undefined,
  };
}

export async function fetchAllData(
  supabase: SupabaseClient,
  canSeeUsers: boolean,
  selfId: string,
  fallbackSettings: Settings,
  fallbackProfile: DoctorProfile
): Promise<CloudSnapshot> {
  const entries = COLLECTIONS.filter((c) => c !== "users" || canSeeUsers);

  const results = await Promise.all([
    ...entries.map((c) => supabase.from(TABLES[c].table).select("*")),
    supabase.from("settings").select("data").eq("id", 1).maybeSingle(),
    supabase.from("doctor_profile").select("data").eq("id", 1).maybeSingle(),
  ]);

  const db: DB = {
    patients: [],
    appointments: [],
    bookings: [],
    visits: [],
    prescriptions: [],
    invoices: [],
    archive: [],
    users: [],
    reminders: [],
    audit: [],
    settings: fallbackSettings,
    profile: fallbackProfile,
  };

  entries.forEach((collection, i) => {
    const res = results[i] as { data: any[] | null; error: any };
    if (res.error) throw res.error;
    (db as any)[collection] = (res.data ?? []).map((row: any) => fromRow(collection, row));
  });

  if (!canSeeUsers) {
    // المستخدم يرى ملفه فقط (RLS تفرض ذلك)، نضيفه يدويًا لشريط المستخدم
    const own = await supabase.from("profiles").select("*").eq("id", selfId).maybeSingle();
    if (own.error) throw own.error;
    if (own.data) db.users = [fromRow("users", own.data as Record<string, any>)];
  }

  const settingsRes = results[entries.length] as { data: { data: Settings } | null; error: any };
  const profileRes = results[entries.length + 1] as { data: { data: DoctorProfile } | null; error: any };
  if (settingsRes.error) throw settingsRes.error;
  if (profileRes.error) throw profileRes.error;

  const settingsExists = Boolean(settingsRes.data?.data);
  const profileExists = Boolean(profileRes.data?.data);
  if (settingsRes.data?.data) db.settings = settingsRes.data.data;
  if (profileRes.data?.data) db.profile = profileRes.data.data;

  return { db, settingsExists, profileExists };
}

export async function pushChange(supabase: SupabaseClient, change: DBChange): Promise<void> {
  // الإدخال بالترتيب لاحترام المفاتيح الأجنبية
  const upserts = [...change.upserts].sort(
    (a, b) => TABLES[a.collection].order - TABLES[b.collection].order
  );
  for (const { collection, rows } of upserts) {
    if (!rows.length) continue;
    const payload = rows.map((r) => toRow(collection, r));
    const res = await supabase.from(TABLES[collection].table).upsert(payload, { onConflict: "id" });
    if (res.error) throw res.error;
  }

  // الحذف بترتيب معاكس
  const deletes = [...change.deletes].sort(
    (a, b) => TABLES[b.collection].order - TABLES[a.collection].order
  );
  for (const { collection, ids } of deletes) {
    if (!ids.length) continue;
    const res = await supabase.from(TABLES[collection].table).delete().in("id", ids);
    if (res.error) throw res.error;
  }
}

export async function pushSingletons(
  supabase: SupabaseClient,
  settings: Settings | null,
  profile: DoctorProfile | null
): Promise<void> {
  if (settings) {
    const res = await supabase.from("settings").upsert({ id: 1, data: settings }, { onConflict: "id" });
    if (res.error) throw res.error;
  }
  if (profile) {
    const res = await supabase.from("doctor_profile").upsert({ id: 1, data: profile }, { onConflict: "id" });
    if (res.error) throw res.error;
  }
}

/** كتابة مجموعة كاملة (بيانات العرض) بالترتيب الصحيح — بدون المستخدمين لأنهم مرتبطون بـ Auth. */
export async function pushAll(supabase: SupabaseClient, db: DB): Promise<void> {
  for (const collection of [...COLLECTIONS].sort((a, b) => TABLES[a].order - TABLES[b].order)) {
    if (collection === "users") continue;
    const rows = (db as any)[collection] as any[];
    if (!rows.length) continue;
    const res = await supabase
      .from(TABLES[collection].table)
      .upsert(rows.map((r) => toRow(collection, r)), { onConflict: "id" });
    if (res.error) throw res.error;
  }
  await pushSingletons(supabase, db.settings, db.profile);
}

/* ------------------------------------------------------------------- users */

export interface NewCloudUser {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: User["role"];
  specialty?: string;
  extraPermissions: User["extraPermissions"];
  active: boolean;
}

export async function createCloudUser(
  supabase: SupabaseClient,
  input: NewCloudUser
): Promise<User> {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "create", ...input },
  });
  if (error) throw new Error(await edgeErrorMessage(error, "تعذر إنشاء المستخدم"));
  if (!data?.ok || !data?.user) throw new Error(data?.error || "تعذر إنشاء المستخدم");
  return data.user as User;
}

export async function callDispatch(supabase: SupabaseClient): Promise<any> {
  const { data, error } = await supabase.functions.invoke("reminders-dispatch", {
    body: { source: "app" },
  });
  if (error) throw new Error(await edgeErrorMessage(error, "تعذر تشغيل محرك التذكيرات"));
  if (data?.ok === false) throw new Error(data.error || "تعذر تشغيل محرك التذكيرات");
  return data;
}

/**
 * استعادة كاملة لبيانات العيادة إلى السحابة.
 * الحسابات (profiles/auth) لا تُستبدل لأنها مرتبطة بـ Supabase Auth.
 */
export async function restoreCloudBackup(supabase: SupabaseClient, db: DB): Promise<any> {
  const payload: Record<string, unknown> = {};
  for (const collection of COLLECTIONS) {
    if (collection === "users") continue;
    const rows = (db as any)[collection] as any[];
    payload[collection] = rows.map((row) => toRow(collection, row));
  }
  payload.settings = db.settings;
  payload.profile = db.profile;

  const { data, error } = await supabase.functions.invoke("restore-backup", {
    body: { payload },
  });
  if (error) throw new Error(await edgeErrorMessage(error, "تعذرت استعادة النسخة الاحتياطية"));
  if (data?.ok === false) throw new Error(data.error || "تعذرت استعادة النسخة الاحتياطية");
  return data;
}

async function edgeErrorMessage(error: any, fallback: string): Promise<string> {
  let message = error?.message || fallback;
  try {
    const body = await error?.context?.json?.();
    if (body?.error) message = body.error;
  } catch {
    /* الاستجابة ليست JSON */
  }
  return message || fallback;
}

/* ------------------------------------------------------------------ errors */

export function cloudError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const map: Record<string, string> = {
    "Invalid login credentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "Email not confirmed": "لم يتم تأكيد البريد الإلكتروني بعد. راجع بريدك.",
    "User not found": "لا يوجد حساب بهذا البريد.",
    "Failed to fetch": "تعذر الاتصال بالسحابة. تحقق من الإنترنت.",
    "NetworkError": "تعذر الاتصال بالسحابة. تحقق من الإنترنت.",
    "Auth session missing": "انتهت صلاحية رابط الاستعادة. اطلب رابطًا جديدًا.",
    "JWT expired": "انتهت صلاحية الجلسة. سجّل الدخول مجددًا.",
  };
  for (const [key, value] of Object.entries(map)) {
    if (msg.includes(key)) return value;
  }
  if (msg.includes("duplicate key") || msg.includes("already registered")) {
    return "هذا البريد مسجّل بالفعل.";
  }
  if (msg.includes("row-level security")) {
    return "لا تملك صلاحية تنفيذ هذه العملية على السحابة.";
  }
  return msg || "حدث خطأ غير متوقع في الاتصال بالسحابة.";
}

export function profileToUser(row: any): User {
  return {
    id: row.id,
    name: row.name ?? "عضو فريق",
    role: row.role ?? "receptionist",
    email: row.email ?? "",
    phone: row.phone ?? "",
    active: row.active ?? true,
    specialty: row.specialty ?? undefined,
    extraPermissions: (row.extraPermissions ?? row.extra_permissions ?? []) as User["extraPermissions"],
    createdAt: row.createdAt ?? row.created_at ?? "",
  };
}
