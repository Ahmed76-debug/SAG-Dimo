import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR, DB_FILE } from "./config.mjs";

let db = null;

/**
 * Managed SQLite schema for the clinic platform.
 *
 * Every business collection is stored in its own table. Scalar columns that are
 * useful for indexing/filtering are mirrored next to the canonical JSON payload,
 * so the API can serve the rich domain model without losing SQL semantics.
 */
const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  specialty TEXT,
  extraPermissions TEXT,
  passwordHash TEXT,
  salt TEXT,
  createdAt TEXT,
  data TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT,
  phone TEXT,
  createdAt TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  patientId TEXT,
  date TEXT,
  time TEXT,
  status TEXT,
  doctorId TEXT,
  createdAt TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patientId);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  ref TEXT,
  phone TEXT,
  status TEXT,
  preferredDate TEXT,
  createdAt TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(preferredDate);

CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  patientId TEXT,
  date TEXT,
  doctorId TEXT,
  createdAt TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patientId);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(date);

CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  number TEXT,
  patientId TEXT,
  date TEXT,
  status TEXT,
  createdAt TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patientId);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  number TEXT,
  patientId TEXT,
  date TEXT,
  status TEXT,
  createdAt TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patientId);

CREATE TABLE IF NOT EXISTS archive (
  id TEXT PRIMARY KEY,
  patientId TEXT,
  date TEXT,
  category TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_archive_patient ON archive(patientId);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  kind TEXT,
  refId TEXT,
  sentAt TEXT,
  status TEXT,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  at TEXT,
  userId TEXT,
  action TEXT,
  entity TEXT,
  entityId TEXT,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit(at);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

export const ARRAY_TABLES = [
  "patients",
  "appointments",
  "bookings",
  "visits",
  "prescriptions",
  "invoices",
  "archive",
  "users",
  "reminders",
  "audit",
];

export const SINGLETON_TABLES = ["settings", "profile"];

export const ALL_TABLES = [...ARRAY_TABLES, ...SINGLETON_TABLES];

export function getDb() {
  if (!db) throw new Error("Database not initialized");
  return db;
}

export function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec(SCHEMA);
  return db;
}

export function closeDb() {
  try {
    db?.close();
  } catch {
    /* ignore */
  }
  db = null;
}

export function dbFilePath() {
  return path.resolve(DB_FILE);
}

export function checkpoint() {
  try {
    db?.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch {
    /* ignore */
  }
}
