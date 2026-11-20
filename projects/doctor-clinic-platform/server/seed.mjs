import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./db.mjs";
import { hashPassword, randomSalt } from "./auth.mjs";
import { insertCollectionRow, insertUser, COLUMNS, j } from "./repo.mjs";
import { nowIso } from "./util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_FILE = path.join(__dirname, "demo-seed.json");

const ALL_PERMISSIONS = [
  "dashboard.view",
  "patients.view",
  "patients.edit",
  "appointments.view",
  "appointments.edit",
  "records.view",
  "records.edit",
  "prescriptions.view",
  "prescriptions.edit",
  "billing.view",
  "billing.edit",
  "archive.view",
  "reports.view",
  "users.view",
  "users.edit",
  "settings.edit",
  "profile.edit",
];

function ensureDemoData() {
  const db = getDb();
  const already = db.prepare("SELECT value FROM meta WHERE key='seeded'").get();
  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (already?.value === "1" || userCount > 0) return;

  let demo = null;
  try {
    demo = JSON.parse(fs.readFileSync(DEMO_FILE, "utf8"));
  } catch {
    demo = null;
  }
  if (!demo) return;

  db.exec("BEGIN");
  try {
    for (const table of Object.keys(COLUMNS)) {
      const rows = Array.isArray(demo[table]) ? demo[table] : [];
      for (const row of rows) {
        if (row?.id) insertCollectionRow(table, row);
      }
    }
    for (const user of Array.isArray(demo.users) ? demo.users : []) {
      if (!user?.id) continue;
      insertUser(user, user.id === "usr_admin" ? "admin123" : "1234");
    }
    if (demo.settings) {
      db.prepare("INSERT OR REPLACE INTO settings (id,data) VALUES ('settings',?)").run(
        j(demo.settings)
      );
    }
    if (demo.profile) {
      db.prepare("INSERT OR REPLACE INTO profile (id,data) VALUES ('profile',?)").run(
        j(demo.profile)
      );
    }
    db.prepare("INSERT OR REPLACE INTO meta (key,value) VALUES ('seeded','1')").run();
    db.prepare("INSERT OR REPLACE INTO meta (key,value) VALUES ('seeded_at',?)").run(nowIso());
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  }
}

function ensureAdmin() {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM users WHERE id = 'usr_admin'").get();
  const salt = randomSalt();
  const passwordHash = hashPassword("admin123", salt);

  if (!existing) {
    insertUser(
      {
        id: "usr_admin",
        name: "مدير النظام",
        role: "manager",
        email: "admin",
        phone: "admin",
        active: true,
        specialty: "مدير النظام — صلاحيات كاملة",
        extraPermissions: ALL_PERMISSIONS,
        createdAt: nowIso(),
      },
      "admin123"
    );
    return;
  }

  // The unified demo administrator always signs in with admin / admin123.
  db.prepare(
    `UPDATE users SET role='manager', active=1,
      email=CASE WHEN email IS NULL OR email='' THEN 'admin' ELSE email END,
      extraPermissions=?, passwordHash=?, salt=? WHERE id='usr_admin'`
  ).run(j(ALL_PERMISSIONS), passwordHash, salt);
}

export function runSeed() {
  ensureDemoData();
  ensureAdmin();
}
