// توافق: تم نقل قاعدة البيانات إلى خادم SQLite مُدار (server/data/muraqib.db)
export function sqliteReady() { return true }
export function sqlStats() { return { tables: [] as { name: string; rows: number; columns: number }[], totalRows: 0 } }
export async function flushSqlSync() {}
export function downloadSqliteFile(_name?: string) { console.info('SQLite managed on server (data/muraqib.db)') }
export async function initSqlMirror() {}
