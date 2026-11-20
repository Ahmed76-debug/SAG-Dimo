'use strict';
/* ============================================================
   كافيه برو — نقل بيانات SQLite الحالية إلى MySQL/MariaDB
   الاستخدام:
     node scripts/sync-sqlite-to-mysql.js            # عرض فقط (Dry run)
     node scripts/sync-sqlite-to-mysql.js --yes      # تنفيذ النقل
   المتطلبات:
     - DATABASE_URL لقاعدة MySQL فارغة (أو يمكن استبدال بياناتها)
     - ملف SQLite: CAFE_DB أو cafe.db بجوار المشروع
   تحذير: هذا السكربت يفرّغ جداول قاعدة MySQL المستهدفة ثم ينسخ
   بيانات SQLite إليها. خُذ نسخة احتياطية من الهدف قبل التشغيل.
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

const qcol = c => '`' + String(c).replace(/`/g, '``') + '`';
const TABLES = ['branches','users','suppliers','accounts','items','recipes','sales','purchases','finance','journal','shifts','tables','orders','order_items'];
const sqliteFile = path.resolve(process.env.CAFE_DB || process.env.SQLITE_DB || path.join(__dirname, '..', 'cafe.db'));
const url = String(process.env.DATABASE_URL || '').trim();
const yes = process.argv.includes('--yes');

if (!fs.existsSync(sqliteFile)) {
  console.error('✗ ملف SQLite غير موجود:', sqliteFile);
  process.exit(1);
}

(async () => {
  const { DatabaseSync } = require('node:sqlite');
  const lite = new DatabaseSync(sqliteFile, { readOnly: true });
  const data = {};
  let total = 0;
  console.log('📦 SQLite:', sqliteFile);
  for (const t of TABLES) {
    try {
      data[t] = lite.prepare(`SELECT * FROM \`${t}\``).all();
    } catch (e) {
      data[t] = [];
      console.warn(`  ⚠️ الجدول ${t} غير موجود في SQLite — سيُترك فارغًا`);
    }
    total += data[t].length;
    console.log('  ' + t.padEnd(14), data[t].length);
  }
  lite.close();
  console.log('  المجموع:', total, 'صف');

  if (!url) {
    console.error('\n✗ DATABASE_URL غير معيّن — لا يمكن النقل.');
    process.exit(1);
  }
  if (/^postgres(ql)?:/i.test(url)) {
    console.error('✗ PostgreSQL غير مدعوم — استخدم mysql:// أو mariadb://');
    process.exit(1);
  }
  if (!yes) {
    console.log('\nℹ️ هذه معاينة فقط. لتنفيذ النقل أضف --yes:');
    console.log('   node scripts/sync-sqlite-to-mysql.js --yes');
    return;
  }

  let mysql;
  try { mysql = require('mysql2/promise'); }
  catch (e) { console.error('✗ الحزمة mysql2 غير مثبتة. نفّذ: npm install --omit=dev'); process.exit(1); }

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

    /* إنشاء المخطط إن لم يكن موجودًا */
    const schema = fs.readFileSync(path.join(__dirname, '..', 'schema', '001_init.sql'), 'utf8');
    for (const stmt of splitSql(schema)) await conn.query(stmt);

    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    for (const t of TABLES) await conn.query(`TRUNCATE TABLE \`${t}\``);

    let inserted = 0;
    for (const t of TABLES) {
      const rows = data[t] || [];
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]);
      const colList = cols.map(qcol).join(',');
      const ph = cols.map(() => '?').join(',');
      const sql = `INSERT INTO \`${t}\` (${colList}) VALUES (${ph})`;
      for (const row of rows) {
        await conn.execute(sql, cols.map(c => row[c] === undefined ? null : row[c]));
        inserted++;
      }
    }
    await conn.query('SET FOREIGN_KEY_CHECKS=1');
    console.log(`\n✓ تم نقل ${inserted} صف إلى MySQL بنجاح.`);
    console.log('  أعد تشغيل التطبيق مع نفس DATABASE_URL.');
  } catch (e) {
    console.error('✗ فشل النقل:', e.message);
    process.exitCode = 1;
  } finally {
    if (conn) { try { await conn.end(); } catch (e) { /* تجاهل */ } }
  }
})();
