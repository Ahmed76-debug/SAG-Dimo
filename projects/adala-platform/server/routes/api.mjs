import { Router } from 'express';
import { getDb } from '../db.mjs';
import { requireAuth, can, requirePermission, randomSalt, hashPassword } from '../auth.mjs';
import { ensureAdminAndCore, runSeed } from '../seed.mjs';
import { nowIso, uid, parseJson, toJson, bad, notFound } from '../util.mjs';

export const apiRouter = Router();
apiRouter.use(requireAuth);

const JSON_FIELDS = {
  clients: ['tags'],
  matters: ['lawyerIds', 'tags'],
  tasks: ['tags', 'checklist'],
  events: ['attendees'],
  documents: ['tags'],
  library: ['tags', 'notes'],
  templates: ['variables'],
  users: ['permOverrides'],
  settings: ['profile'],
  portfolio: ['stats','services','expertise','experience','credentials','caseHighlights','testimonials','articles','languages','memberships'],
};
const BOOL_FIELDS = {
  clients: ['archived'], matters: ['confidential','archived'], agreements: ['archived'], payments: ['archived'],
  tasks: ['archived'], events: ['archived'], documents: ['confidential','requiresSignature','archived'], notes: ['pinned','archived'],
  library: ['isFavorite','archived'], templates: ['archived'], notifications: ['read'],
  users: ['isActive','notificationsEnabled'], settings: ['dailyDigest','soundEnabled','autoArchiveClosed','sidebarCollapsed'],
};
const TABLES = new Set(['users','clients','matterTypes','matters','agreements','payments','tasks','events','documents','files','notes','library','templates','activity','notifications','settings','portfolio','tutorialVideos']);

function rowToEntity(table, row) {
  if (!row) return row;
  const out = { ...row };
  for (const f of (JSON_FIELDS[table] || [])) if (f in out) out[f] = parseJson(out[f], Array.isArray(out[f]) ? [] : (f==='permOverrides'?undefined:{}));
  // fix defaults for arrays/objects
  if (table==='clients') out.tags = out.tags || [];
  if (table==='matters') { out.lawyerIds = out.lawyerIds || []; out.tags = out.tags || []; }
  if (table==='tasks') { out.tags = out.tags || []; out.checklist = out.checklist || []; }
  if (table==='events') out.attendees = parseJson(row.attendees, row.attendees ? undefined : undefined);
  if (table==='documents') out.tags = out.tags || [];
  if (table==='library') { out.tags = out.tags || []; out.notes = out.notes || []; }
  if (table==='templates') out.variables = out.variables || [];
  if (table==='users') out.permOverrides = parseJson(row.permOverrides, undefined);
  if (table==='settings') out.profile = parseJson(row.profile, {});
  if (table==='portfolio') for (const k of JSON_FIELDS.portfolio) out[k] = parseJson(row[k], Array.isArray(out[k]) ? out[k] : []);
  for (const f of (BOOL_FIELDS[table] || [])) if (f in out) out[f] = !!out[f];
  if (table==='users') { delete out.passwordHash; delete out.salt; delete out.password; }
  return out;
}

function entityToRow(table, body) {
  const out = { ...body };
  for (const f of (JSON_FIELDS[table] || [])) if (f in out) out[f] = toJson(out[f]);
  for (const f of (BOOL_FIELDS[table] || [])) if (f in out) out[f] = out[f] ? 1 : 0;
  return out;
}

function colsFor(table) {
  const db = getDb();
  return db.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name);
}

function ensureTable(table) {
  if (!TABLES.has(table)) throw bad('جدول غير معروف');
}

// Generic list
apiRouter.get('/tables/:table', (req, res, next) => {
  try {
    const { table } = req.params; ensureTable(table);
    const rows = getDb().prepare(`SELECT * FROM "${table}"`).all();
    res.json({ ok: true, data: rows.map(r => rowToEntity(table, r)) });
  } catch (e) { next(e); }
});

// Generic get
apiRouter.get('/tables/:table/:id', (req, res, next) => {
  try {
    const { table, id } = req.params; ensureTable(table);
    const row = getDb().prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
    if (!row) return next(notFound());
    res.json({ ok: true, data: rowToEntity(table, row) });
  } catch (e) { next(e); }
});

// Generic create/put
apiRouter.post('/tables/:table', (req, res, next) => {
  try {
    const { table } = req.params; ensureTable(table);
    const db = getDb();
    const body = { ...req.body };
    if (!body.id) body.id = uid(table.slice(0,3) + '_');
    if (!body.createdAt && colsFor(table).includes('createdAt')) body.createdAt = nowIso();
    if (colsFor(table).includes('updatedAt')) body.updatedAt = body.updatedAt || nowIso();
    const row = entityToRow(table, body);
    const allowed = colsFor(table).filter(c => c in row);
    const sql = `INSERT INTO "${table}" (${allowed.map(c=>`"${c}"`).join(',')}) VALUES (${allowed.map(()=>'?').join(',')})`;
    db.prepare(sql).run(...allowed.map(c => row[c] ?? null));
    const saved = db.prepare(`SELECT * FROM "${table}" WHERE id=?`).get(body.id);
    res.status(201).json({ ok: true, data: rowToEntity(table, saved) });
  } catch (e) { next(e); }
});

apiRouter.put('/tables/:table/:id', (req, res, next) => {
  try {
    const { table, id } = req.params; ensureTable(table);
    const db = getDb();
    const existing = db.prepare(`SELECT * FROM "${table}" WHERE id=?`).get(id);
    if (!existing) return next(notFound());
    const body = { ...req.body, id };
    if (colsFor(table).includes('updatedAt')) body.updatedAt = nowIso();
    const row = entityToRow(table, body);
    const allowed = colsFor(table).filter(c => c in row && c !== 'id');
    if (allowed.length) {
      const sql = `UPDATE "${table}" SET ${allowed.map(c=>`"${c}"=?`).join(',')} WHERE id=?`;
      db.prepare(sql).run(...allowed.map(c => row[c] ?? null), id);
    }
    const saved = db.prepare(`SELECT * FROM "${table}" WHERE id=?`).get(id);
    res.json({ ok: true, data: rowToEntity(table, saved) });
  } catch (e) { next(e); }
});

apiRouter.patch('/tables/:table/:id', (req, res, next) => {
  try {
    const { table, id } = req.params; ensureTable(table);
    const db = getDb();
    const existing = db.prepare(`SELECT * FROM "${table}" WHERE id=?`).get(id);
    if (!existing) return next(notFound());
    const body = { ...req.body };
    if (colsFor(table).includes('updatedAt')) body.updatedAt = nowIso();
    const row = entityToRow(table, body);
    const allowed = colsFor(table).filter(c => c in row && c !== 'id');
    if (allowed.length) {
      const sql = `UPDATE "${table}" SET ${allowed.map(c=>`"${c}"=?`).join(',')} WHERE id=?`;
      db.prepare(sql).run(...allowed.map(c => row[c] ?? null), id);
    }
    const saved = db.prepare(`SELECT * FROM "${table}" WHERE id=?`).get(id);
    res.json({ ok: true, data: rowToEntity(table, saved) });
  } catch (e) { next(e); }
});

apiRouter.delete('/tables/:table/:id', (req, res, next) => {
  try {
    const { table, id } = req.params; ensureTable(table);
    const info = getDb().prepare(`DELETE FROM "${table}" WHERE id=?`).run(id);
    if (!info.changes) return next(notFound());
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Bulk ops
apiRouter.post('/tables/:table/bulk-delete', (req, res, next) => {
  try {
    const { table } = req.params; ensureTable(table);
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const db = getDb();
    const stmt = db.prepare(`DELETE FROM "${table}" WHERE id=?`);
    const tx = db.transaction((arr) => { for (const id of arr) stmt.run(id); });
    tx(ids);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ------------------------------ النسخ الاحتياطي والاستعادة ------------------------------ */

function userTables() {
  return getDb()
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name);
}

/** ملخص سريع لقاعدة البيانات لعرضه في الإعدادات */
apiRouter.get('/stats', (req, res, next) => {
  try {
    const db = getDb();
    const tables = userTables();
    const counts = {};
    for (const name of tables) {
      counts[name] = db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get().c;
    }
    res.json({ ok: true, data: { tables: counts } });
  } catch (e) { next(e); }
});

/**
 * نسخة احتياطية خام تشمل جميع الأعمدة (بما فيها بصمات كلمات المرور والملفات).
 * لا تُرجع هذه البيانات للواجهة إلا لمستخدم يملك صلاحية إعدادات النظام.
 */
apiRouter.get('/backup', requirePermission('settings.edit'), (req, res, next) => {
  try {
    const db = getDb();
    const tables = {};
    for (const name of userTables()) {
      tables[name] = db.prepare(`SELECT * FROM "${name}"`).all();
    }
    res.json({
      ok: true,
      data: { version: 2, createdAt: nowIso(), tables },
    });
  } catch (e) { next(e); }
});

/**
 * استعادة نسخة احتياطية بشكل ذري (كل شيء أو لا شيء).
 * تدعم النسخ الجديدة (أعمدة خام) والنسخ القديمة (بيانات واجهة) عبر entityToRow.
 */
apiRouter.post('/restore', requirePermission('settings.edit'), (req, res, next) => {
  const db = getDb();
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object' || !payload.tables || typeof payload.tables !== 'object') {
      throw bad('نسخة احتياطية غير صالحة');
    }
    const names = userTables();
    const incoming = Object.keys(payload.tables).filter((n) => names.includes(n));

    db.exec('PRAGMA foreign_keys = OFF');
    try {
      db.exec('BEGIN');
      for (const name of names) db.exec(`DELETE FROM "${name}"`);

      for (const name of incoming) {
        const cols = colsFor(name);
        const rows = Array.isArray(payload.tables[name]) ? payload.tables[name] : [];
        const stmtCache = new Map();
        for (const raw of rows) {
          if (!raw || typeof raw !== 'object') continue;
          const body = { ...raw };
          if (!body.id) body.id = uid(name.slice(0, 3) + '_');

          // نسخ قديمة لا تحتوي على بصمة كلمة المرور: نمنح كلمة مرور افتراضية صالحة.
          if (name === 'users' && !body.passwordHash) {
            const salt = randomSalt();
            const uname = String(body.username || '').toLowerCase();
            body.salt = salt;
            body.passwordHash = hashPassword(uname === 'admin' ? 'admin123' : '1234', salt);
          }

          const row = entityToRow(name, body);
          const allowed = cols.filter((c) => c in row);
          if (!allowed.length) continue;
          const sql = `INSERT INTO "${name}" (${allowed.map((c) => `"${c}"`).join(',')}) VALUES (${allowed.map(() => '?').join(',')})`;
          let stmt = stmtCache.get(sql);
          if (!stmt) { stmt = db.prepare(sql); stmtCache.set(sql, stmt); }
          stmt.run(...allowed.map((c) => row[c] ?? null));
        }
      }
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch {}
      throw e;
    } finally {
      db.exec('PRAGMA foreign_keys = ON');
    }

    // لو كانت النسخة قديمة/جزئية ولم تحتوِ مستخدمًا صالحًا، أعد إنشاء المدير الافتراضي.
    try {
      const total = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
      const noHash = db.prepare("SELECT COUNT(*) AS c FROM users WHERE passwordHash IS NULL OR passwordHash=''").get().c;
      if (!total || noHash) ensureAdminAndCore();
    } catch {}

    res.json({ ok: true, data: { restored: incoming.length } });
  } catch (e) { next(e); }
});

/** إعادة تعيين كاملة إلى البيانات التجريبية (تتطلب تأكيدًا في الواجهة) */
apiRouter.post('/reset-demo', requirePermission('settings.edit'), (req, res, next) => {
  const db = getDb();
  try {
    const names = userTables();
    db.exec('PRAGMA foreign_keys = OFF');
    try {
      db.exec('BEGIN');
      for (const name of names) db.exec(`DELETE FROM "${name}"`);
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch {}
      throw e;
    } finally {
      db.exec('PRAGMA foreign_keys = ON');
    }
    runSeed();
    res.json({ ok: true });
  } catch (e) { next(e); }
});