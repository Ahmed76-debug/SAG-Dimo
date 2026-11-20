'use strict';
/* ============================================================
   كافيه برو — إنشاء جداول MySQL/MariaDB
   - طباعة SQL للاستيراد اليدوي:
       node scripts/schema-mysql.js --print
   - تنفيذ SQL على قاعدة البيانات في DATABASE_URL:
       node scripts/schema-mysql.js
   ملاحظة: التطبيق ينشئ الجداول تلقائيًا عند أول تشغيل أيضًا.
   ============================================================ */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const f = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(f)) return;
  const text = fs.readFileSync(f, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined && process.env[m[1]] !== '') continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadEnv();

function splitSql(text) {
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      cur += ch;
      if (ch === quote && text[i - 1] !== '\\') quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch; cur += ch;
    } else if (ch === '-' && text[i + 1] === '-') {
      while (i < text.length && text[i] !== '\n') i++;
      cur += '\n';
    } else if (ch === ';') {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const file = path.join(__dirname, '..', 'schema', '001_init.sql');
if (!fs.existsSync(file)) {
  console.error('✗ ملف schema/001_init.sql غير موجود');
  process.exit(1);
}
const sql = fs.readFileSync(file, 'utf8');
const url = String(process.env.DATABASE_URL || '').trim();

if (!url || process.argv.includes('--print')) {
  process.stdout.write(sql);
  if (!url) console.error('\n# لم يتم تعيين DATABASE_URL — تمت طباعة SQL فقط. استورده في phpMyAdmin ثم شغّل التطبيق.');
  process.exit(0);
}
if (/^postgres(ql)?:/i.test(url)) {
  console.error('✗ PostgreSQL غير مدعوم — استخدم mysql:// أو mariadb://');
  process.exit(1);
}

(async () => {
  let mysql;
  try {
    mysql = require('mysql2/promise');
  } catch (e) {
    console.error('✗ الحزمة mysql2 غير مثبتة. نفّذ: npm install --omit=dev');
    process.exit(1);
  }
  let conn;
  try {
    const u = new URL(url);
    const cfg = {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username || ''),
      password: decodeURIComponent(u.password || ''),
      database: decodeURIComponent((u.pathname || '').replace(/^\//, '')),
      charset: 'utf8mb4',
      multipleStatements: false,
    };
    const sslMode = u.searchParams.get('ssl') || u.searchParams.get('sslmode');
    if (sslMode && !/^(disable|false|0)$/i.test(sslMode)) cfg.ssl = { rejectUnauthorized: false };
    conn = await mysql.createConnection(cfg);
    const statements = splitSql(sql);
    for (const stmt of statements) await conn.query(stmt);
    console.log(`✓ تم تنفيذ ${statements.length} عبارة SQL على قاعدة البيانات.`);
    console.log('  شغّل التطبيق الآن؛ سيُكمل البيانات الافتراضية إذا كانت القاعدة فارغة.');
  } catch (e) {
    console.error('✗ فشل إنشاء الجداول:', e.message);
    process.exitCode = 1;
  } finally {
    if (conn) { try { await conn.end(); } catch (e) { /* تجاهل */ } }
  }
})();
