/* ============================================================
   طلباتك — HTTP Server
   محليًا: node server.js  →  http://localhost:8080 (SQLite)
   على الاستضافة: نفس الأمر مع DATABASE_URL (MySQL/MariaDB)
   ============================================================ */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { findSession, handleApi } = require("./lib/api");

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".pdf": "application/pdf",
};

function send(res, status, data, type, extraHeaders) {
  let body, ct = type;
  if (Buffer.isBuffer(data)) body = data;
  else if (typeof data === "string") { body = data; ct = type || "text/plain; charset=utf-8"; }
  else { body = JSON.stringify(data ?? {}); ct = type || "application/json; charset=utf-8"; }
  res.writeHead(status, { "Content-Type": ct || "application/json; charset=utf-8", "Cache-Control": "no-cache", ...(extraHeaders || {}) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > 180 * 1024 * 1024) { reject(new Error("حجم البيانات كبير جداً (الحد ١٨٠ ميجا)")); req.destroy(); }
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, urlPath) {
  let file = path.normalize(path.join(PUBLIC, urlPath === "/" ? "/admin.html" : urlPath));
  if (!file.startsWith(PUBLIC)) return send(res, 403, "Forbidden", "text/plain");
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // SPA fallback: /store → متجر العميل، الباقي → لوحة المدير
    if (urlPath === "/admin" || urlPath === "/admin/") file = path.join(PUBLIC, "admin.html");
    else file = path.join(PUBLIC, "index.html");
  }
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  try {
    const data = fs.readFileSync(file);
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(data);
  } catch {
    send(res, 500, "خطأ في قراءة الملف", "text/plain; charset=utf-8");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) {
      const body = ["POST", "PUT", "PATCH"].includes(req.method) ? await readBody(req) : {};
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      let session = null;
      try { session = findSession(token); } catch { session = null; }
      const handled = await handleApi(req, res, url, body, session, (status, data, type, headers) => send(res, status, data, type, headers));
      if (handled === false) return send(res, 404, { error: "المسار غير موجود: " + url.pathname });
      return;
    }
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    console.error("✗", e);
    if (!res.headersSent) send(res, 500, { error: "خطأ في الخادم: " + e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log("──────────────────────────────────────────────");
  console.log("  🛵 طلباتك — نظام التوصيل المتكامل");
  console.log(`  ▸ العميل  : http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}/`);
  console.log(`  ▸ الأدمن  : http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}/admin`);
  console.log("  ▸ الدخول  : admin / admin123");
  console.log("──────────────────────────────────────────────");
});
