'use strict';
/**
 * PharmaPro – zero-dependency HTTP server
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const db = require('./db');
const api = require('./api');
const backup = require('./backup');

const PORT = Number(process.env.PORT || process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] || 4173);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY = 200 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('حجم الطلب كبير جداً'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const full = path.join(PUBLIC_DIR, rel);
  if (!full.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.stat(full, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback
      const index = path.join(PUBLIC_DIR, 'index.html');
      return fs.readFile(index, (e2, data) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(data);
      });
    }
    const ext = path.extname(full).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Cache-Control': ext === '.html' ? 'no-cache' : 'no-cache' };
    res.writeHead(200, headers);
    fs.createReadStream(full).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');

  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end('Method not allowed'); }
    return serveStatic(req, res, url.pathname);
  }

  try {
    const raw = req.method === 'GET' || req.method === 'HEAD' ? null : await readBody(req);
    await api.handle(req, res, url, raw);
    const ms = Date.now() - started;
    if (ms > 800) console.log(`  ⏱  ${req.method} ${url.pathname} (${ms}ms)`);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(`  ✖ ${req.method} ${url.pathname}:`, err);
    if (!res.headersSent) {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message || 'خطأ غير متوقع' }));
    } else {
      try { res.end(); } catch (_) { /* ignore */ }
    }
  }
});

function banner() {
  const line = '─'.repeat(56);
  console.log(`\n\u001b[36m┌${line}┐\u001b[0m`);
  console.log(`\u001b[36m│\u001b[0m  \u001b[1mPharmaPro\u001b[0m – منصة إدارة الصيدلية الذكية          \u001b[36m│\u001b[0m`);
  console.log(`\u001b[36m│\u001b[0m  نسخة 1.0.0 · قاعدة بيانات SQLite · بدون أي تبعيات   \u001b[36m│\u001b[0m`);
  console.log(`\u001b[36m└${line}┘\u001b[0m`);
  console.log(`\n  \u001b[32m➜\u001b[0m  التطبيق يعمل الآن على: \u001b[1mhttp://${HOST}:${PORT}\u001b[0m`);
  console.log(`  \u001b[32m➜\u001b[0m  الدخول الافتراضي: admin / admin123`);
  console.log(`  \u001b[90m   لإيقاف الخادم اضغط Ctrl+C\u001b[0m\n`);
}

function start() {
  console.log('  ⏳ تهيئة قاعدة البيانات...');
  db.init();
  const auto = backup.autoBackup();
  if (auto) console.log(`  🗄  نسخة احتياطية تلقائية: ${auto.path}`);
  server.listen(PORT, HOST, banner);
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✖ المنفذ ${PORT} مستخدم بالفعل. شغّل التطبيق على منفذ آخر: node server/app.js --port=4174\n`);
    process.exit(1);
  }
  throw err;
});

process.on('SIGINT', () => {
  console.log('\n  👋 إيقاف الخادم...');
  try { db.getDB().exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch (_) { /* ignore */ }
  process.exit(0);
});

start();
