import { Router } from "express";
import { getDb, ALL_TABLES, dbFilePath, checkpoint } from "../db.mjs";
import { requireAuth, requirePermission } from "../auth.mjs";
import {
  readState,
  syncState,
  rowToEntity,
  insertCollectionRow,
  insertUser,
  sqlStats,
} from "../repo.mjs";
import { nowIso, uid, bad, notFound } from "../util.mjs";
import { runSeed } from "../seed.mjs";

export const apiRouter = Router();
apiRouter.use(requireAuth);

const TABLES = new Set(ALL_TABLES);

function ensureTable(table) {
  if (!TABLES.has(table)) throw bad("جدول غير معروف.", "unknown_table", 404);
}

/* ------------------------------------------------------------ full state */

apiRouter.get("/state", (_req, res) => {
  res.json({ ok: true, data: readState() });
});

apiRouter.put("/state", (req, res, next) => {
  try {
    syncState(req.body);
    res.json({ ok: true, data: { saved: true, at: nowIso() } });
  } catch (error) {
    next(error);
  }
});

/* ---------------------------------------------------------- generic CRUD */

apiRouter.get("/tables/:table", (req, res, next) => {
  try {
    const { table } = req.params;
    ensureTable(table);
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM "${table}"`).all();
    res.json({ ok: true, data: rows.map((row) => rowToEntity(table, row)) });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/tables/:table/:id", (req, res, next) => {
  try {
    const { table, id } = req.params;
    ensureTable(table);
    const row = getDb().prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
    if (!row) return next(notFound());
    res.json({ ok: true, data: rowToEntity(table, row) });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/tables/:table", (req, res, next) => {
  try {
    const { table } = req.params;
    ensureTable(table);
    if (table === "settings" || table === "profile") {
      return next(bad("استخدم /state لتحديث الإعدادات والملف التعريفي.", "readonly_table", 400));
    }
    const body = { ...(req.body || {}) };
    if (!body.id) body.id = uid(table.slice(0, 3) + "_");
    if (table === "users") {
      insertUser(body, body.password || (body.id === "usr_admin" ? "admin123" : "1234"));
    } else {
      insertCollectionRow(table, body);
    }
    const saved = getDb().prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(body.id);
    res.status(201).json({ ok: true, data: rowToEntity(table, saved) });
  } catch (error) {
    next(error);
  }
});

apiRouter.put("/tables/:table/:id", (req, res, next) => {
  try {
    const { table, id } = req.params;
    ensureTable(table);
    if (table === "settings" || table === "profile") {
      return next(bad("استخدم /state لتحديث الإعدادات والملف التعريفي.", "readonly_table", 400));
    }
    const existing = getDb().prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
    if (!existing) return next(notFound());
    const body = { ...(req.body || {}), id };
    if (table === "users") {
      const merged = { ...rowToEntity(table, existing), ...body };
      insertUser(merged, body.password || "1234");
    } else {
      insertCollectionRow(table, body);
    }
    const saved = getDb().prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
    res.json({ ok: true, data: rowToEntity(table, saved) });
  } catch (error) {
    next(error);
  }
});

apiRouter.delete("/tables/:table/:id", (req, res, next) => {
  try {
    const { table, id } = req.params;
    ensureTable(table);
    if (table === "users" && id === "usr_admin") {
      return next(bad("لا يمكن حذف حساب مدير النظام.", "protected_user", 400));
    }
    const info = getDb().prepare(`DELETE FROM "${table}" WHERE id = ?`).run(id);
    if (!info.changes) return next(notFound());
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------ admin tools */

apiRouter.get("/admin/stats", requirePermission("settings.edit"), (_req, res) => {
  res.json({ ok: true, data: sqlStats() });
});

apiRouter.get("/admin/sqlite", requirePermission("settings.edit"), (_req, res, next) => {
  try {
    checkpoint();
    res.download(dbFilePath(), "tabib.sqlite");
  } catch (error) {
    next(error);
  }
});

/* --------------------------------------------------- backup / restore */

/** نسخة خام كاملة تشمل بصمات كلمات المرور والإعدادات — للمدير فقط. */
apiRouter.get("/backup", requirePermission("settings.edit"), (_req, res, next) => {
  try {
    const db = getDb();
    const tables = {};
    for (const name of ALL_TABLES) {
      tables[name] = db.prepare(`SELECT * FROM "${name}"`).all();
    }
    res.json({ ok: true, data: { version: 2, createdAt: nowIso(), tables } });
  } catch (error) {
    next(error);
  }
});

/** استعادة ذرية للنسخ الخام التي أنشأها الخادم. */
apiRouter.post("/restore", requirePermission("settings.edit"), (req, res, next) => {
  const db = getDb();
  try {
    const payload = req.body || {};
    const tables = payload.tables && typeof payload.tables === "object" ? payload.tables : null;
    if (!tables) throw bad("نسخة احتياطية غير صالحة.", "invalid_backup", 400);

    db.exec("PRAGMA foreign_keys = OFF");
    try {
      db.exec("BEGIN");
      for (const name of ALL_TABLES) db.exec(`DELETE FROM "${name}"`);

      for (const name of ALL_TABLES) {
        const rows = tables[name];
        if (!Array.isArray(rows) || !rows.length) continue;
        const columns = db.prepare(`PRAGMA table_info("${name}")`).all().map((c) => c.name);
        for (const raw of rows) {
          if (!raw || typeof raw !== "object") continue;
          const allowed = columns.filter((c) => c in raw);
          if (!allowed.length) continue;
          const sql = `INSERT INTO "${name}" (${allowed.map((c) => `"${c}"`).join(",")})
            VALUES (${allowed.map(() => "?").join(",")})`;
          db.prepare(sql).run(...allowed.map((c) => raw[c] ?? null));
        }
      }
      db.exec("COMMIT");
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch { /* ignore */ }
      throw error;
    } finally {
      db.exec("PRAGMA foreign_keys = ON");
    }

    // لا تسمح ببقاء قاعدة بيانات بلا مدير نظام.
    const admin = db.prepare("SELECT id FROM users WHERE id='usr_admin' AND active=1").get();
    if (!admin) runSeed();

    res.json({ ok: true, data: { restored: Object.keys(tables).length } });
  } catch (error) {
    next(error);
  }
});
