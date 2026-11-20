#!/usr/bin/env node
/**
 * إنشاء أول مدير للعيادة (أو إضافة عضو فريق) بأمان.
 *
 * الاستخدام:
 *   1) انسخ .env.example إلى .env.local واملأ:
 *        SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *        BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD, BOOTSTRAP_NAME, BOOTSTRAP_ROLE
 *   2) npm run cloud:bootstrap
 *
 * لا تضع service_role في أي متغير يبدأ بـ VITE_ ولا تشاركه مع المتصفح.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

function loadEnvFile(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return;
  for (const rawLine of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const email = (process.env.BOOTSTRAP_EMAIL || "").trim().toLowerCase();
const password = process.env.BOOTSTRAP_PASSWORD || "";
const name = (process.env.BOOTSTRAP_NAME || "").trim();
const role = (process.env.BOOTSTRAP_ROLE || "doctor").trim();
const phone = (process.env.BOOTSTRAP_PHONE || "").trim();
const specialty = (process.env.BOOTSTRAP_SPECIALTY || "").trim();

const ROLES = new Set(["doctor", "manager", "receptionist", "nurse", "accountant"]);

function die(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (!url || !serviceKey) {
  die(
    "إعدادات Supabase ناقصة. أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في .env.local.\n" +
      "هذه الأسرار للخادم فقط، ولا يجب أن تبدأ بـ VITE_."
  );
}
if (!email || !password || !name) {
  die("أضف BOOTSTRAP_EMAIL و BOOTSTRAP_PASSWORD و BOOTSTRAP_NAME في .env.local.");
}
if (password.length < 8) die("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
if (!ROLES.has(role)) die(`الدور غير صالح. اختر واحدًا من: ${[...ROLES].join(", ")}`);

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`\n→ الاتصال بمشروع: ${url}`);
console.log(`→ المستخدم: ${email} (${role})`);

// التأكد من وجود الجداول قبل إنشاء حساب بلا ملف صلاحيات.
const probe = await admin.from("profiles").select("id", { head: true, count: "exact" });
if (probe.error) {
  die(
    `تعذر الوصول إلى جدول profiles: ${probe.error.message}\n` +
      "نفّذ supabase/migrations/0001_init.sql في SQL Editor أولًا."
  );
}

let user = null;
const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { name },
});

if (created.error) {
  const exists =
    created.error.message.toLowerCase().includes("already") ||
    created.error.message.toLowerCase().includes("registered");
  if (!exists) die(`تعذر إنشاء حساب الدخول: ${created.error.message}`);

  // الحساب موجود مسبقًا: نحدّث ملف الصلاحيات فقط ولا نغيّر كلمة المرور.
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) die(`تعذر قراءة المستخدمين: ${listed.error.message}`);
  user = listed.data.users.find((u) => (u.email || "").toLowerCase() === email) ?? null;
  if (!user) die("البريد مسجّل لكن تعذر العثور عليه. راجع لوحة Supabase.");
  console.log("ℹ الحساب موجود مسبقًا — سيتم تحديث ملف الصلاحيات فقط.");
} else {
  user = created.user;
}

if (!user) die("لم يتم إنشاء المستخدم.");

const profile = {
  id: user.id,
  name,
  role,
  email,
  phone,
  active: true,
  extra_permissions: [],
  ...(specialty ? { specialty } : {}),
};

const saved = await admin.from("profiles").upsert(profile, { onConflict: "id" }).select("*").single();
if (saved.error) {
  if (created.user) await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
  die(`تعذر إنشاء ملف الصلاحيات: ${saved.error.message}`);
}

console.log("\n✔ تم تجهيز الحساب بنجاح.");
console.log(`  الاسم: ${name}`);
console.log(`  البريد: ${email}`);
console.log(`  الدور: ${role}`);
console.log("  كلمة المرور محفوظة مشفّرة في Supabase Auth.\n");
console.log("الخطوة التالية: شغّل الواجهة، سجّل الدخول، ثم أضف بقية الفريق من صفحة «المستخدمون».\n");
