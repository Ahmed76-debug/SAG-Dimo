import { getDb, ARRAY_TABLES, ALL_TABLES } from "./db.mjs";
import { hashPassword, randomSalt, serializeUser } from "./auth.mjs";
import { nowIso, uid, parseJson } from "./util.mjs";

/** Scalar mirror columns kept next to the canonical JSON payload. */
export const COLUMNS = {
  patients: ["code", "name", "phone", "createdAt"],
  appointments: ["patientId", "date", "time", "status", "doctorId", "createdAt"],
  bookings: ["ref", "phone", "status", "preferredDate", "createdAt"],
  visits: ["patientId", "date", "doctorId", "createdAt"],
  prescriptions: ["number", "patientId", "date", "status", "createdAt"],
  invoices: ["number", "patientId", "date", "status", "createdAt"],
  archive: ["patientId", "date", "category"],
  reminders: ["kind", "refId", "sentAt", "status"],
  audit: ["at", "userId", "action", "entity", "entityId"],
};

const ORDER_BY = {
  patients: "name ASC",
  appointments: "date ASC, time ASC",
  bookings: "createdAt DESC",
  visits: "date DESC",
  prescriptions: "date DESC",
  invoices: "date DESC",
  archive: "date DESC",
  reminders: "sentAt DESC",
  audit: "at DESC",
  users: "createdAt ASC",
};

export function j(value) {
  return value == null ? null : JSON.stringify(value);
}

export function insertCollectionRow(table, row) {
  const db = getDb();
  const columns = COLUMNS[table] || [];
  const names = ["id", "data", ...columns];
  const values = [row.id, j(row), ...columns.map((column) => row[column] ?? null)];
  const sql = `INSERT OR REPLACE INTO "${table}" (${names.map((n) => `"${n}"`).join(",")})
    VALUES (${names.map(() => "?").join(",")})`;
  db.prepare(sql).run(...values);
}

export function insertUser(user, password) {
  const db = getDb();
  const salt = randomSalt();
  const passwordHash = hashPassword(password, salt);
  const extra = Array.isArray(user.extraPermissions) ? user.extraPermissions : [];
  db.prepare(
    `INSERT OR REPLACE INTO users
      (id,name,role,email,phone,active,specialty,extraPermissions,passwordHash,salt,createdAt,data)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    user.id,
    user.name ?? "",
    user.role ?? "receptionist",
    user.email ?? "",
    user.phone ?? "",
    user.active === false ? 0 : 1,
    user.specialty ?? "",
    j(extra),
    passwordHash,
    salt,
    user.createdAt ?? nowIso(),
    j({ ...user, active: user.active !== false })
  );
}

export function rowToEntity(table, row) {
  if (!row) return row;
  if (table === "users") return serializeUser(row);
  return parseJson(row.data, { id: row.id });
}

export function readState() {
  const db = getDb();
  const state = {};
  for (const table of ARRAY_TABLES) {
    const order = ORDER_BY[table] ? ` ORDER BY ${ORDER_BY[table]}` : "";
    const rows = db.prepare(`SELECT * FROM "${table}"${order}`).all();
    state[table] = rows.map((row) => rowToEntity(table, row));
  }
  state.settings = parseJson(
    db.prepare("SELECT data FROM settings WHERE id='settings'").get()?.data,
    null
  );
  state.profile = parseJson(
    db.prepare("SELECT data FROM profile WHERE id='profile'").get()?.data,
    null
  );
  return state;
}

export function readPublicContent() {
  const db = getDb();
  return {
    settings: parseJson(
      db.prepare("SELECT data FROM settings WHERE id='settings'").get()?.data,
      null
    ),
    profile: parseJson(
      db.prepare("SELECT data FROM profile WHERE id='profile'").get()?.data,
      null
    ),
  };
}

export function bookedSlots(from, to) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT date, time FROM appointments
       WHERE date >= ? AND date <= ? AND status <> 'cancelled'
       ORDER BY date ASC, time ASC`
    )
    .all(String(from || ""), String(to || ""));
  return rows.map((row) => ({ date: row.date, time: row.time }));
}

export function addBooking(input) {
  const booking = { ...(input || {}) };
  if (!booking.id) booking.id = uid("bkg_");
  if (!booking.ref) booking.ref = `BK-${Date.now().toString(36).toUpperCase()}`;
  if (!booking.status) booking.status = "pending";
  if (!booking.createdAt) booking.createdAt = nowIso();
  insertCollectionRow("bookings", booking);
  return booking;
}

export function syncState(payload) {
  const db = getDb();
  const body = payload && typeof payload === "object" ? payload : {};

  db.exec("BEGIN");
  try {
    for (const table of ARRAY_TABLES) {
      if (table === "users") continue;
      if (!Array.isArray(body[table])) continue;

      const existing = new Map(
        db
          .prepare(`SELECT id, data FROM "${table}"`)
          .all()
          .map((row) => [row.id, row.data])
      );
      const seen = new Set();

      for (const row of body[table]) {
        if (!row || typeof row !== "object" || !row.id) continue;
        seen.add(row.id);
        const json = JSON.stringify(row);
        if (existing.get(row.id) === json) continue;
        insertCollectionRow(table, row);
      }

      for (const id of existing.keys()) {
        if (!seen.has(id)) db.prepare(`DELETE FROM "${table}" WHERE id=?`).run(id);
      }
    }

    if (Array.isArray(body.users)) {
      const existingUsers = new Map(
        db
          .prepare("SELECT * FROM users")
          .all()
          .map((row) => [row.id, row])
      );
      const seen = new Set(["usr_admin"]);

      for (const user of body.users) {
        if (!user || typeof user !== "object" || !user.id) continue;
        seen.add(user.id);
        const previous = existingUsers.get(user.id);
        const extra = j(Array.isArray(user.extraPermissions) ? user.extraPermissions : []);
        const data = j({ ...user, active: user.active !== false });

        if (!previous) {
          insertUser(user, user.id === "usr_admin" ? "admin123" : "1234");
          continue;
        }

        const unchanged =
          previous.data === data &&
          previous.extraPermissions === extra &&
          previous.name === (user.name ?? "") &&
          previous.role === (user.role ?? "") &&
          previous.email === (user.email ?? "") &&
          previous.phone === (user.phone ?? "") &&
          Number(previous.active) === (user.active === false ? 0 : 1) &&
          previous.specialty === (user.specialty ?? "");
        if (unchanged) continue;

        db.prepare(
          `UPDATE users SET name=?, role=?, email=?, phone=?, active=?, specialty=?,
            extraPermissions=?, data=? WHERE id=?`
        ).run(
          user.name ?? "",
          user.role ?? "",
          user.email ?? "",
          user.phone ?? "",
          user.active === false ? 0 : 1,
          user.specialty ?? "",
          extra,
          data,
          user.id
        );
      }

      for (const id of existingUsers.keys()) {
        if (!seen.has(id)) db.prepare("DELETE FROM users WHERE id=?").run(id);
      }
    }

    if (body.settings && typeof body.settings === "object") {
      db.prepare("INSERT OR REPLACE INTO settings (id,data) VALUES ('settings',?)").run(
        j(body.settings)
      );
    }
    if (body.profile && typeof body.profile === "object") {
      db.prepare("INSERT OR REPLACE INTO profile (id,data) VALUES ('profile',?)").run(
        j(body.profile)
      );
    }

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

export function sqlStats() {
  const db = getDb();
  const tables = ALL_TABLES.map((name) => {
    let rows = 0;
    let columns = 0;
    try {
      rows = Number(db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get().c || 0);
      columns = db.prepare(`PRAGMA table_info("${name}")`).all().length;
    } catch {
      /* ignore */
    }
    return { name, rows, columns };
  });
  return {
    tables,
    totalRows: tables.reduce((sum, table) => sum + table.rows, 0),
  };
}
