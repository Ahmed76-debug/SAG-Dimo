/* ============================================================
   طلباتك — جسر MySQL المتزامن
   يسمح للكود الحالي (المكتوب بأسلوب node:sqlite المتزامن) بالعمل
   على MySQL/MariaDB دون تغيير بقية الملفات.
   يعمل الاستعلام في Worker Thread، وينتظر الخيط الرئيسي النتيجة
   عبر SharedArrayBuffer + Atomics.wait.
   ============================================================ */
"use strict";

const path = require("path");
const { Worker, MessageChannel, receiveMessageOnPort } = require("node:worker_threads");

function parseUrl(raw) {
  let u;
  try { u = new URL(raw); } catch (e) {
    throw new Error("DATABASE_URL غير صالح. الصيغة: mysql://user:pass@host:3306/dbname");
  }
  if (!/^(mysql|mariadb):$/.test(u.protocol)) {
    throw new Error("طلباتك يدعم MySQL/MariaDB فقط عبر DATABASE_URL، أو SQLite محليًا بدون DATABASE_URL.");
  }
  const database = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!database) throw new Error("DATABASE_URL لا يحتوي على اسم قاعدة البيانات.");
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username || ""),
    password: decodeURIComponent(u.password || ""),
    database,
    charset: "utf8mb4",
    supportBigNumbers: true,
    bigNumberStrings: false,
    dateStrings: true,
    multipleStatements: false,
    connectTimeout: 20000,
    ...(u.searchParams.get("ssl") === "true" ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

function connect(rawUrl) {
  const config = parseUrl(rawUrl);
  const { port1, port2 } = new MessageChannel();
  const shared = new SharedArrayBuffer(4);
  const flag = new Int32Array(shared);
  let seq = 0;
  let closed = false;

  const worker = new Worker(path.join(__dirname, "mysql-sync-worker.js"), {
    workerData: { port: port2, shared, config },
    transferList: [port2],
  });

  worker.on("error", (e) => {
    // لا يمكن طباعة الكثير هنا؛ الخطأ سيظهر كـ timeout في الاستعلام التالي
    console.error("[mysql-sync] worker error:", e && e.message ? e.message : e);
  });

  function receive(timeoutMs) {
    const r = Atomics.wait(flag, 0, 0, timeoutMs);
    if (r === "timed-out") {
      throw new Error("انتهت مهلة انتظار استجابة MySQL. تحقق من الاتصال وبيانات DATABASE_URL.");
    }
    Atomics.store(flag, 0, 0);
    const rec = receiveMessageOnPort(port1);
    return rec ? rec.message : null;
  }

  // انتظار اتصال العامل بقاعدة البيانات
  const ready = receive(30000);
  if (!ready || !ready.ready) {
    try { worker.terminate(); } catch (e) { /* تجاهل */ }
    throw new Error("فشل الاتصال بـ MySQL: " + ((ready && ready.error) || "انتهت المهلة"));
  }

  function call(sql, params) {
    if (closed) throw new Error("اتصال MySQL مغلق");
    const id = ++seq;
    const clean = (params || []).map(v => (v === undefined ? null : v));
    port1.postMessage({ id, sql: String(sql), params: clean });
    for (;;) {
      const msg = receive(120000);
      if (!msg) continue;
      if (msg.id !== id) continue; // رسالة قديمة
      if (!msg.ok) throw new Error(msg.error || "خطأ MySQL");
      return msg;
    }
  }

  return {
    kind: "mysql",
    all(sql, ...params) { return call(sql, params).rows || []; },
    one(sql, ...params) {
      const rows = call(sql, params).rows || [];
      return rows[0];
    },
    run(sql, ...params) { return call(sql, params).info || { lastInsertRowid: 0, changes: 0 }; },
    exec(sql) { return call(sql, []).info || { lastInsertRowid: 0, changes: 0 }; },
    close() { closed = true; try { worker.terminate(); } catch (e) { /* تجاهل */ } },
  };
}

module.exports = { connect, parseUrl };
