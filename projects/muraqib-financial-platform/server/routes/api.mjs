import { Router } from 'express';
import { getDb } from '../db.mjs';
import { verifyToken, nowIso, parseJson, toJson, bad, unauthorized } from '../util.mjs';
import { TOKEN_SECRET } from '../config.mjs';
import { runSeed } from '../seed.mjs';

export const apiRouter = Router();

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token, TOKEN_SECRET) : null;
  if (!payload?.sub) return next(unauthorized());
  req.userId = payload.sub;
  next();
}
apiRouter.use(requireAuth);

function requireAdmin(req, res, next) {
  try {
    const row = getDb().prepare('SELECT role, isActive FROM users WHERE id = ?').get(req.userId);
    if (!row || !row.isActive || row.role !== 'admin') {
      return next(bad('هذه العملية متاحة لمدير النظام فقط.', 'forbidden', 403));
    }
    next();
  } catch (e) { next(e); }
}

const JSON_FIELDS = {
  adjustments: ['lines'],
  archive: ['data'],
  budgets: ['lines'],
};
const BOOL_FIELDS = {
  accounts: ['isActive', 'isSystem', 'allowPosting'],
  trialBalanceImports: ['isBalanced'],
  users: ['isActive'],
  appSettings: ['autoBackup', 'auditTightening'],
};
const TABLES = new Set([
  'officeProfile','appSettings','companies','accounts','trialBalanceImports','trialBalanceLines','adjustments','users','reminders','archive','currencyRates','budgets','auditLogs','tutorialVideos'
]);

function rowToEntity(table, row) {
  if (!row) return row;
  const out = { ...row };
  for (const f of (JSON_FIELDS[table] || [])) if (f in out) out[f] = parseJson(out[f], f === 'data' ? out[f] : []);
  for (const f of (BOOL_FIELDS[table] || [])) if (f in out) out[f] = !!out[f];
  return out;
}
function entityToRow(table, body) {
  const out = { ...body };
  for (const f of (JSON_FIELDS[table] || [])) if (f in out) out[f] = toJson(out[f]);
  for (const f of (BOOL_FIELDS[table] || [])) if (f in out) out[f] = out[f] ? 1 : 0;
  return out;
}
function colsFor(table) { return getDb().prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name); }
function ensureTable(table) { if (!TABLES.has(table)) throw bad('جدول غير معروف'); }
function idParam(v) { const n = Number(v); return Number.isFinite(n) && String(n) === String(v).trim() ? n : v; }

apiRouter.get('/tables/:table', (req, res, next) => {
  try {
    const { table } = req.params; ensureTable(table);
    const rows = getDb().prepare(`SELECT * FROM "${table}"`).all();
    res.json({ ok: true, data: rows.map(r => rowToEntity(table, r)) });
  } catch (e) { next(e); }
});

apiRouter.get('/tables/:table/:id', (req, res, next) => {
  try {
    const { table, id } = req.params; ensureTable(table);
    const row = getDb().prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(idParam(id));
    if (!row) return next(bad('غير موجود', 'not_found', 404));
    res.json({ ok: true, data: rowToEntity(table, row) });
  } catch (e) { next(e); }
});

apiRouter.post('/tables/:table', (req, res, next) => {
  try {
    const { table } = req.params; ensureTable(table);
    const db = getDb();
    const body = { ...req.body };
    const allowedCols = colsFor(table);
    if (allowedCols.includes('createdAt') && !body.createdAt) body.createdAt = nowIso();
    if (allowedCols.includes('updatedAt')) body.updatedAt = body.updatedAt || nowIso();
    const row = entityToRow(table, body);
    // let AUTOINCREMENT assign id if missing for integer PK tables
    let allowed = allowedCols.filter(c => c in row);
    if ((body.id === undefined || body.id === null || body.id === '') && allowedCols.includes('id')) {
      allowed = allowed.filter(c => c !== 'id');
    }
    const sql = `INSERT INTO "${table}" (${allowed.map(c=>`"${c}"`).join(',')}) VALUES (${allowed.map(()=>'?').join(',')})`;
    const info = db.prepare(sql).run(...allowed.map(c => row[c] ?? null));
    const newId = row.id ?? info.lastInsertRowid;
    const saved = db.prepare(`SELECT * FROM "${table}" WHERE id=?`).get(newId);
    res.status(201).json({ ok: true, data: rowToEntity(table, saved) });
  } catch (e) { next(e); }
});

apiRouter.put('/tables/:table/:id', (req, res, next) => {
  try {
    const { table, id } = req.params; ensureTable(table);
    const db = getDb();
    const pk = idParam(id);
    const existing = db.prepare(`SELECT * FROM "${table}" WHERE id=?`).get(pk);
    if (!existing) return next(bad('غير موجود', 'not_found', 404));
    const body = { ...req.body, id: pk };
    const allowedCols = colsFor(table);
    if (allowedCols.includes('updatedAt')) body.updatedAt = nowIso();
    const row = entityToRow(table, body);
    const allowed = allowedCols.filter(c => c in row && c !== 'id');
    if (allowed.length) {
      db.prepare(`UPDATE "${table}" SET ${allowed.map(c=>`"${c}"=?`).join(',')} WHERE id=?`).run(...allowed.map(c => row[c] ?? null), pk);
    }
    const saved = db.prepare(`SELECT * FROM "${table}" WHERE id=?`).get(pk);
    res.json({ ok: true, data: rowToEntity(table, saved) });
  } catch (e) { next(e); }
});

apiRouter.patch('/tables/:table/:id', (req, res, next) => {
  try {
    const { table, id } = req.params; ensureTable(table);
    const db = getDb();
    const pk = idParam(id);
    const existing = db.prepare(`SELECT * FROM "${table}" WHERE id=?`).get(pk);
    if (!existing) return next(bad('غير موجود', 'not_found', 404));
    const body = { ...req.body };
    const allowedCols = colsFor(table);
    if (allowedCols.includes('updatedAt')) body.updatedAt = nowIso();
    const row = entityToRow(table, body);
    const allowed = allowedCols.filter(c => c in row && c !== 'id');
    if (allowed.length) {
      db.prepare(`UPDATE "${table}" SET ${allowed.map(c=>`"${c}"=?`).join(',')} WHERE id=?`).run(...allowed.map(c => row[c] ?? null), pk);
    }
    const saved = db.prepare(`SELECT * FROM "${table}" WHERE id=?`).get(pk);
    res.json({ ok: true, data: rowToEntity(table, saved) });
  } catch (e) { next(e); }
});

apiRouter.delete('/tables/:table/:id', (req, res, next) => {
  try {
    const { table, id } = req.params; ensureTable(table);
    const info = getDb().prepare(`DELETE FROM "${table}" WHERE id=?`).run(idParam(id));
    if (!info.changes) return next(bad('غير موجود', 'not_found', 404));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

apiRouter.post('/tables/:table/bulk-delete', (req, res, next) => {
  try {
    const { table } = req.params; ensureTable(table);
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const db = getDb();
    const stmt = db.prepare(`DELETE FROM "${table}" WHERE id=?`);
    const tx = db.transaction((arr) => { for (const id of arr) stmt.run(idParam(id)); });
    tx(ids);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ------------------------------ النسخ الاحتياطي والاستعادة ------------------------------ */

/** نسخة خام تشمل جميع الأعمدة (بما فيها بصمات كلمات المرور) — للمدير فقط. */
apiRouter.get('/backup', requireAdmin, (req, res, next) => {
  try {
    const db = getDb();
    const tables = {};
    for (const name of TABLES) {
      tables[name] = db.prepare(`SELECT * FROM "${name}"`).all();
    }
    res.json({ ok: true, data: { version: 2, createdAt: nowIso(), tables } });
  } catch (e) { next(e); }
});

/** استعادة ذرية: كل شيء أو لا شيء. تدعم النسخ الجديدة والقديمة. */
apiRouter.post('/restore', requireAdmin, (req, res, next) => {
  const db = getDb();
  try {
    const payload = req.body || {};
    const tables = payload.tables && typeof payload.tables === 'object' ? payload.tables : payload;
    if (!tables || typeof tables !== 'object') throw bad('نسخة احتياطية غير صالحة');

    db.exec('PRAGMA foreign_keys = OFF');
    try {
      db.exec('BEGIN');
      for (const name of TABLES) db.exec(`DELETE FROM "${name}"`);

      for (const name of TABLES) {
        const rows = tables[name];
        if (!Array.isArray(rows) || !rows.length) continue;
        const cols = colsFor(name);
        for (const raw of rows) {
          if (!raw || typeof raw !== 'object') continue;
          const row = entityToRow(name, raw);
          let allowed = cols.filter((c) => c in row);
          if ((row.id === undefined || row.id === null || row.id === '') && cols.includes('id')) {
            allowed = allowed.filter((c) => c !== 'id');
          }
          if (!allowed.length) continue;
          const sql = `INSERT INTO "${name}" (${allowed.map((c) => `"${c}"`).join(',')}) VALUES (${allowed.map(() => '?').join(',')})`;
          db.prepare(sql).run(...allowed.map((c) => row[c] ?? null));
        }
      }
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch {}
      throw e;
    } finally {
      db.exec('PRAGMA foreign_keys = ON');
    }

    // تأكد من وجود مدير نظام صالح بعد الاستعادة دون المساس بكلمات مرور الحسابات الأخرى.
    const admin = db.prepare("SELECT id FROM users WHERE lower(username) = 'admin' AND isActive = 1").get();
    if (!admin) runSeed();

    res.json({ ok: true, data: { restored: Object.keys(tables).length } });
  } catch (e) { next(e); }
});
