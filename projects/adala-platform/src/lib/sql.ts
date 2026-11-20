/* =============================================================
   SQL dump — تحويل بيانات عدالة (IndexedDB) إلى جداول SQL
   - يُنتج ملف .sql متوافقًا مع SQLite / PostgreSQL
   - الأعمدة تُستنتج من بيانات النسخة الاحتياطية كاملة
   ============================================================= */

import { SQL_SCHEMA } from "./sqlSchema";

type Row = Record<string, unknown>;

const q = (name: string) => '"' + name.replace(/"/g, '""') + '"';

function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "string") return "'" + value.replace(/'/g, "''") + "'";
  return "'" + JSON.stringify(value).replace(/'/g, "''") + "'";
}

function typeOf(value: unknown): string {
  if (typeof value === "number") return Number.isInteger(value) ? "INTEGER" : "REAL";
  if (typeof value === "boolean") return "INTEGER";
  return "TEXT";
}

/** يحوّل كائن جداول (اسم الجدول → صفوف) إلى نص SQL كامل. */
export function tablesToSql(
  tables: Record<string, unknown[]>,
  meta: {
    app: string;
    version?: number | string;
    schema?: Record<string, Record<string, string>>;
  } = { app: "Adala" },
): string {
  const schema = meta.schema ?? SQL_SCHEMA;
  const names = new Set([...Object.keys(schema), ...Object.keys(tables)]);
  const lines: string[] = [];
  lines.push(`-- ${meta.app} — SQL dump`);
  lines.push(`-- version: ${meta.version ?? 1}`);
  lines.push(`-- generated: ${new Date().toISOString()}`);
  lines.push("-- dialect: SQLite / PostgreSQL (double-quoted identifiers)");
  lines.push("BEGIN;");

  for (const name of names) {
    const rows = Array.isArray(tables[name]) ? (tables[name] as unknown[]) : [];
    const schemaColumns = schema[name] ?? {};

    if (rows.length === 0) {
      const defs = [
        '"id" TEXT PRIMARY KEY',
        ...Object.entries(schemaColumns)
          .filter(([column]) => column !== "id")
          .map(([column, type]) => `${q(column)} ${type}`),
      ];
      if (defs.length === 1) defs.push('"_json" TEXT');
      lines.push("");
      lines.push(`-- ${name}: no rows`);
      lines.push(`CREATE TABLE IF NOT EXISTS ${q(name)} (${defs.join(", ")});`);
      continue;
    }

    const columns = new Map<string, string>(
      Object.entries(schemaColumns).filter(([column]) => column !== "id"),
    );
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      for (const [key, value] of Object.entries(row as Row)) {
        const next = typeOf(value);
        const prev = columns.get(key);
        if (!prev) columns.set(key, next);
        else if (prev !== next) {
          const bothNumeric =
            (prev === "INTEGER" && next === "REAL") || (prev === "REAL" && next === "INTEGER");
          columns.set(key, bothNumeric ? "REAL" : "TEXT");
        }
      }
    }
    if (columns.size === 0) columns.set("_json", "TEXT");

    const keys = [...columns.keys()];
    const defs = [
      '"id" TEXT PRIMARY KEY',
      ...keys.filter((key) => key !== "id").map((key) => `${q(key)} ${columns.get(key)}`),
    ];
    lines.push("");
    lines.push(`CREATE TABLE IF NOT EXISTS ${q(name)} (${defs.join(", ")});`);
    for (const row of rows) {
      const r = (row ?? {}) as Row;
      lines.push(
        `INSERT INTO ${q(name)} (${keys.map(q).join(", ")}) VALUES (${keys
          .map((key) => literal(r[key]))
          .join(", ")});`,
      );
    }
  }

  lines.push("");
  lines.push("COMMIT;");
  lines.push("");
  return lines.join("\n");
}

/** يبني جداول SQL من نسخة احتياطية بصيغة عدالة. */
export function backupToSql(payload: {
  version?: number;
  tables?: Record<string, unknown[]>;
  files?: Array<{ id: string; name: string; mime: string; dataUrl: string }>;
}): string {
  const tables: Record<string, unknown[]> = { ...(payload.tables ?? {}) };
  if (Array.isArray(payload.files) && payload.files.length) tables.files = payload.files;
  return tablesToSql(tables, { app: "Adala Legal Suite", version: payload.version ?? 1 });
}
