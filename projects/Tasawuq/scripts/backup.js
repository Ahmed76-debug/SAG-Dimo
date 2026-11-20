/* ============================================================
   تسوق - نظام النسخ الاحتياطي التلقائي
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { DATA_DIR, BACKUP_DIR, DB_PATH } = require("../lib/db");

function backup() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `tasawuq_backup_${ts}.db`;
  const dest = path.join(BACKUP_DIR, file);
  try {
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, dest);
      console.log("✓ تم إنشاء نسخة احتياطية بنجاح");
      console.log("  الملف: " + dest);
      console.log("  التاريخ: " + new Date().toLocaleString('ar-EG'));
    } else {
      console.log("⚠ لا توجد قاعدة بيانات للنسخ الاحتياطي بعد");
    }
  } catch(e) {
    console.error("✗ خطأ:", e.message);
  }
}

backup();
module.exports = backup;
