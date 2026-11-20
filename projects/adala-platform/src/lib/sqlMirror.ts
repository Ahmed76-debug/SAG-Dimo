// توافق: تم نقل قاعدة البيانات إلى خادم SQLite مُدار (server/data/adala.db)
// هذا الملف stub للحفاظ على توافق الاستيرادات مع واجهات الأدوات.

export function sqliteReady(): boolean {
  return true;
}

export function sqlStats() {
  return {
    tables: [] as { name: string; rows: number; columns: number }[],
    totalRows: 0,
    mode: "server-sqlite" as const,
  };
}

export async function flushSqlSync(): Promise<void> {
  // تتم المزامنة على الخادم تلقائيًا
}

export function downloadSqliteFile(_name?: string) {
  // قاعدة البيانات مُدارة على الخادم؛ يمكن توفير تنزيل عبر API لاحقًا
  console.info("SQLite database is managed on the server (data/adala.db)");
}

export async function initSqlMirror() {
  // no-op: server-managed SQLite
}
