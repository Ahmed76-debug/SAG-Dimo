/* ==========================================================================
   Managed SQL bridge — منصة طبيب
   - لم يعد العميل يحتفظ بقاعدة sql.js/IndexedDB محلية.
   - الخادم (Node + node:sqlite) هو مصدر الحقيقة ويُدير قاعدة tabib.db.
   - هذه الوحدة تحافظ على واجهة أدوات البيانات (إحصاءات/تنزيل) فقط.
   ========================================================================== */

import { api, apiDownload } from "./api";

export interface SqlTableStat {
  name: string;
  rows: number;
  columns: number;
}

let cached: { tables: SqlTableStat[]; totalRows: number } = {
  tables: [],
  totalRows: 0,
};

/** القاعدة مُدارة بالخادم دائمًا. */
export function sqliteReady(): boolean {
  return true;
}

export function sqlStats(): { tables: SqlTableStat[]; totalRows: number } {
  return cached;
}

/** يجلب إحصاءات الجداول من الخادم ويحدّث الذاكرة المؤقتة. */
export async function refreshSqlStats(): Promise<{ tables: SqlTableStat[]; totalRows: number }> {
  try {
    const data = await api<{ tables: SqlTableStat[]; totalRows: number }>("/admin/stats");
    if (data && Array.isArray(data.tables)) {
      cached = {
        tables: data.tables.map((table) => ({
          name: table.name,
          rows: Number(table.rows) || 0,
          columns: Number(table.columns) || 0,
        })),
        totalRows: Number(data.totalRows) || 0,
      };
    }
  } catch {
    /* تبقى آخر إحصاءات معروفة */
  }
  return cached;
}

/**
 * كان يدفع نسخة sql.js إلى IndexedDB. الآن الحفظ يتم تلقائيًا عبر /api/state،
 * لذا نكتفي بتحديث الإحصاءات لتعكس حالة الخادم.
 */
export async function flushSqlSync(_db?: unknown): Promise<boolean> {
  await refreshSqlStats();
  return true;
}

export function scheduleSqlSync(_db?: unknown): void {
  /* الحفظ يتم في AppProvider عبر طلب /api/state المؤجل */
}

export async function initSqlMirror(): Promise<void> {
  /* لا يوجد تهيئة محلية — القاعدة على الخادم */
}

export function downloadSqliteFile(filename = "tabib.sqlite"): void {
  void apiDownload("/admin/sqlite", filename);
}
