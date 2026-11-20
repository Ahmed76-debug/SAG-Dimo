#!/usr/bin/env node
/**
 * فحص سريع لربط Supabase: المتغيرات، الجداول، RPC الحجز، وبكتات التخزين.
 * لا يطبع أي مفتاح. شغّله بعد تنفيذ المايغريشنز: npm run cloud:check
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
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let failures = 0;
function report(ok, label, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "✔" : "✖"} ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("\nفحص إعداد السحابة\n" + "─".repeat(50));
report(Boolean(url), "SUPABASE_URL", url || "غير موجود");
report(Boolean(anonKey), "VITE_SUPABASE_ANON_KEY", anonKey ? "موجود" : "غير موجود");
report(Boolean(serviceKey), "SUPABASE_SERVICE_ROLE_KEY", serviceKey ? "موجود (للفحص فقط)" : "غير موجود — بعض الفحوص ستُتخطى");

if (!url || !anonKey) {
  console.log("\nأضف القيمتين في .env.local ثم أعد المحاولة.\n");
  process.exit(1);
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const admin = serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const from = iso(today);
const to = iso(new Date(today.getTime() + 13 * 86400000));

const settings = await anon.from("settings").select("id,data").eq("id", 1).maybeSingle();
report(!settings.error && Boolean(settings.data), "جدول settings + صف الإعدادات", settings.error?.message ?? "");

const slots = await anon.rpc("booked_slots_range", { from_day: from, to_day: to });
report(!slots.error, "دالة booked_slots_range", slots.error?.message ?? `${(slots.data ?? []).length} حجزًا`);

const tables = [
  "profiles", "patients", "appointments", "bookings", "visits", "prescriptions",
  "invoices", "archive", "reminders", "settings", "doctor_profile", "audit_log", "whatsapp_events",
];

const probeClient = admin ?? anon;
if (admin) {
  for (const table of tables) {
    const res = await probeClient.from(table).select("*", { head: true, count: "exact" });
    report(!res.error, `جدول ${table}`, res.error?.message ?? `${res.count ?? 0} صفًا`);
  }
} else {
  console.log("ℹ تخطّي فحص الجداول المحمية — أضف SUPABASE_SERVICE_ROLE_KEY لفحص المخطط كاملًا.");
}

if (admin) {
  const buckets = await admin.storage.listBuckets();
  const names = (buckets.data ?? []).map((b) => b.name);
  report(!buckets.error && names.includes("medical-files"), "بكت medical-files", buckets.error?.message ?? "");
  report(!buckets.error && names.includes("payment-proofs"), "بكت payment-proofs", buckets.error?.message ?? "");
}

console.log("─".repeat(50));
if (failures) {
  console.log(`\n✖ ${failures} فحصًا لم ينجح. راجع docs/CLOUD_SETUP.md\n`);
  process.exit(1);
}
console.log("\n✔ كل الفحوص الأساسية ناجحة. يمكنك تسجيل الدخول.\n");
