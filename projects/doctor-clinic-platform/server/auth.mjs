import crypto from "node:crypto";
import { getDb } from "./db.mjs";
import { unauthorized, forbidden, verifyToken, parseJson, clientIp } from "./util.mjs";
import { TOKEN_SECRET } from "./config.mjs";

const ITERATIONS = 120000;

export function randomSalt() {
  return crypto.randomBytes(16).toString("hex");
}

export function hashPassword(password, salt) {
  return crypto
    .pbkdf2Sync(String(password), String(salt), ITERATIONS, 32, "sha256")
    .toString("hex");
}

export function verifyPassword(password, user) {
  if (!user?.salt || !user?.passwordHash) return false;
  const hash = hashPassword(password, user.salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(String(user.passwordHash), "hex");
  try {
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

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

const ROLE_PERMISSIONS = {
  doctor: ALL_PERMISSIONS,
  manager: [
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
  ],
  receptionist: [
    "dashboard.view",
    "patients.view",
    "patients.edit",
    "appointments.view",
    "appointments.edit",
    "billing.view",
    "billing.edit",
    "archive.view",
    "records.view",
  ],
  nurse: [
    "dashboard.view",
    "patients.view",
    "appointments.view",
    "appointments.edit",
    "records.view",
    "records.edit",
    "prescriptions.view",
    "archive.view",
  ],
  accountant: [
    "dashboard.view",
    "patients.view",
    "appointments.view",
    "billing.view",
    "billing.edit",
    "reports.view",
    "archive.view",
  ],
};

export function can(role, extra, permission) {
  if (!role) return false;
  const base = ROLE_PERMISSIONS[role] || [];
  return base.includes(permission) || (Array.isArray(extra) && extra.includes(permission));
}

export function serializeUser(row) {
  if (!row) return null;
  const stored = parseJson(row.data, null);
  const user = stored && typeof stored === "object" ? { ...stored } : {};
  user.id = row.id;
  user.name = row.name ?? user.name ?? "";
  user.role = row.role ?? user.role ?? "receptionist";
  user.email = row.email ?? user.email ?? "";
  user.phone = row.phone ?? user.phone ?? "";
  user.active = row.active == null ? user.active !== false : !!row.active;
  user.specialty = row.specialty ?? user.specialty ?? "";
  user.extraPermissions = parseJson(row.extraPermissions, user.extraPermissions || []);
  if (!Array.isArray(user.extraPermissions)) user.extraPermissions = [];
  user.createdAt = row.createdAt ?? user.createdAt ?? "";
  delete user.password;
  delete user.passwordHash;
  delete user.salt;
  return user;
}

/** Finds a user by id, email, phone, or the unified admin account (admin). */
export function findUserByLogin(raw) {
  const input = String(raw || "").trim();
  if (!input) return null;
  const db = getDb();
  const lower = input.toLowerCase();

  const direct =
    db.prepare("SELECT * FROM users WHERE id = ?").get(input) ||
    db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(input) ||
    db.prepare("SELECT * FROM users WHERE phone = ?").get(input);
  if (direct) return direct;

  if (lower === "admin") {
    return (
      db.prepare("SELECT * FROM users WHERE id = 'usr_admin'").get() ||
      db.prepare("SELECT * FROM users WHERE lower(email) = 'admin'").get()
    );
  }
  return null;
}

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = token ? verifyToken(token, TOKEN_SECRET) : null;
  if (!payload?.sub) return next(unauthorized("انتهت الجلسة أو أنها غير صالحة. سجّل الدخول مرة أخرى."));
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(payload.sub);
  if (!row || !row.active) return next(unauthorized("هذا الحساب غير متاح. تواصل مع مدير العيادة."));
  req.user = row;
  req.userSafe = serializeUser(row);
  req.ipAddress = clientIp(req);
  next();
}

export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!can(req.user?.role, req.userSafe?.extraPermissions, permission)) {
      return next(forbidden("لا تملك صلاحية تنفيذ هذه العملية."));
    }
    next();
  };
}
