'use strict';
/* ============================================================
   talabatak — إنشاء جداول MySQL/MariaDB
   الاستخدام:
     - طباعة SQL فقط (لاستيراده يدويًا في phpMyAdmin):
         node scripts/schema-mysql.js --print
     - تنفيذ SQL على قاعدة البيانات الموجودة في DATABASE_URL:
         node scripts/schema-mysql.js
   ملاحظة: التطبيق نفسه ينشئ الجداول ويزرع البيانات تلقائيًا
   عند أول تشغيل إذا كانت قاعدة البيانات فارغة.
   ============================================================ */
const fs = require('fs');
const path = require('path');

/* قارئ .env بسيط — دون تبعيات */
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
const printOnly = process.argv.includes('--print') || !url;

if (printOnly) {
  process.stdout.write(sql);
  if (!url) console.error('\n# لم يتم تعيين DATABASE_URL — تمت طباعة SQL فقط. استورده في phpMyAdmin ثم شغّل التطبيق.');
  process.exit(0);
}

(async () => {
  let parseUrl;
  try {
    ({ parseUrl } = require('../lib/mysql-sync'));
  } catch (e) {
    console.error('✗ تعذّر تحميل lib/mysql-sync:', e.message);
    process.exit(1);
  }
  let mysql;
  try {
    mysql = require('mysql2/promise');
  } catch (e) {
    console.error('✗ الحزمة mysql2 غير مثبتة. نفّذ: npm install --omit=dev');
    process.exit(1);
  }
  let conn;
  try {
    const cfg = parseUrl(url);
    conn = await mysql.createConnection(cfg);
    const statements = splitSql(sql);
    for (const stmt of statements) await conn.query(stmt);
    console.log(`✓ تم تنفيذ ${statements.length} عبارة SQL على قاعدة البيانات.`);
    console.log('  شغّل التطبيق الآن؛ سيُكمل زرع البيانات الافتراضية إذا كانت القاعدة فارغة.');
  } catch (e) {
    console.error('✗ فشل إنشاء الجداول:', e.message);
    process.exitCode = 1;
  } finally {
    if (conn) { try { await conn.end(); } catch (e) { /* تجاهل */ } }
  }
})();
