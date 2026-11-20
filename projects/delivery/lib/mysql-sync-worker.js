/* ============================================================
   طلباتك — MySQL sync worker
   يستقبل الاستعلامات من الخيط الرئيسي وينفّذها على اتصال واحد،
   ثم يوقظ الخيط الرئيسي عبر Atomics.notify.
   ============================================================ */
"use strict";

const { workerData } = require("node:worker_threads");
const { port, shared, config } = workerData;
const flag = new Int32Array(shared);

function reply(payload) {
  port.postMessage(payload);
  Atomics.store(flag, 0, 1);
  Atomics.notify(flag, 0);
}

(async () => {
  let conn;
  try {
    let mysql;
    try {
      mysql = require("mysql2/promise");
    } catch (e) {
      throw new Error("الحزمة mysql2 غير مثبتة. نفّذ: npm install mysql2");
    }
    const pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 1,
      queueLimit: 0,
      enableKeepAlive: true,
    });
    conn = await pool.getConnection();
    await conn.query("SET NAMES utf8mb4");
    reply({ ready: true });
  } catch (e) {
    reply({ ready: false, error: String((e && e.message) || e) });
    return;
  }

  port.on("message", async (msg) => {
    try {
      const [result] = await conn.query(msg.sql, msg.params || []);
      if (Array.isArray(result)) {
        reply({ id: msg.id, ok: true, rows: result });
      } else {
        const insertId = Number(result && result.insertId) || 0;
        const affected = Number(result && result.affectedRows) || 0;
        reply({
          id: msg.id,
          ok: true,
          info: {
            insertId,
            affectedRows: affected,
            changedRows: Number(result && result.changedRows) || 0,
            // توافق مع واجهة node:sqlite
            lastInsertRowid: insertId,
            changes: affected,
          },
        });
      }
    } catch (e) {
      reply({ id: msg.id, ok: false, error: String((e && e.message) || e) });
    }
  });
})();
