import { Router } from 'express';
import { requireAuth, requirePermission } from '../auth.mjs';
import { getDb, audit } from '../db.mjs';
import { createBackup } from '../backup.mjs';
import { bad, clientIp } from '../util.mjs';

export const dataToolsRouter = Router();
dataToolsRouter.use(requireAuth);

/* Core tables that must never be truncated from the studio UI. */
const PROTECTED = new Set([
  'users',
  'roles',
  'settings',
  'audit_logs',
  'api_keys',
  'backups',
]);

const LABELS = {
  roles: 'الأدوار والصلاحيات',
  users: 'المستخدمون',
  products: 'المنتجات',
  customers: 'العملاء',
  licenses: 'التراخيص',
  activations: 'التفعيلات',
  activation_requests: 'طلبات التفعيل',
  audit_logs: 'سجل النشاط',
  settings: 'الإعدادات',
  api_keys: 'مفاتيح API',
  backups: 'النسخ الاحتياطية',
};

function listTables(db) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => row.name);
}

function foreignKeys(db, table) {
  try {
    return db.prepare(`PRAGMA foreign_key_list("${table}")`).all();
  } catch {
    return [];
  }
}

function references(db, child, parent) {
  return foreignKeys(db, child).some((fk) => fk.table === parent);
}

function restrictiveReference(db, child, parent) {
  return foreignKeys(db, child).some(
    (fk) =>
      fk.table === parent &&
      ['NO ACTION', 'RESTRICT'].includes(String(fk.on_delete || 'NO ACTION').toUpperCase()),
  );
}

/**
 * Add child tables that would block a parent delete with a RESTRICT/NO ACTION
 * foreign key. Cascading / SET NULL children are handled by SQLite itself.
 */
function expandDependents(db, selected, allTables) {
  const out = new Set(selected);
  const queue = [...selected];
  while (queue.length) {
    const parent = queue.shift();
    for (const child of allTables) {
      if (out.has(child) || PROTECTED.has(child)) continue;
      if (restrictiveReference(db, child, parent)) {
        out.add(child);
        queue.push(child);
      }
    }
  }
  return [...out];
}

/** Delete children before parents so the transaction never violates a FK. */
function deleteOrder(db, tables, allTables) {
  const wanted = new Set(tables);
  const visited = new Set();
  const order = [];
  const visit = (table) => {
    if (visited.has(table)) return;
    visited.add(table);
    for (const child of allTables) {
      if (child !== table && wanted.has(child) && references(db, child, table)) visit(child);
    }
    order.push(table);
  };
  for (const table of tables) visit(table);
  return order;
}

dataToolsRouter.get('/', requirePermission('settings.manage'), (req, res) => {
  const db = getDb();
  const tables = listTables(db).map((name) => {
    let rows = 0;
    try {
      rows = Number(db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get()?.c || 0);
    } catch {
      rows = 0;
    }
    return {
      name,
      label: LABELS[name] || name,
      rows,
      protected: PROTECTED.has(name),
    };
  });
  res.json({
    ok: true,
    data: {
      tables,
      protected: [...PROTECTED],
      totalRows: tables.reduce((sum, table) => sum + table.rows, 0),
    },
  });
});

dataToolsRouter.post('/truncate', requirePermission('settings.manage'), (req, res, next) => {
  try {
    const db = getDb();
    const allTables = listTables(db);
    const known = new Set(allTables);
    const requested = Array.from(
      new Set(
        (Array.isArray(req.body?.tables) ? req.body.tables : [])
          .map((table) => String(table))
          .filter((table) => known.has(table) && !PROTECTED.has(table)),
      ),
    );

    if (!requested.length) throw bad('لم يتم تحديد جداول قابلة للتفريغ');

    const expanded = expandDependents(db, requested, allTables);
    const blocked = expanded.filter((table) => PROTECTED.has(table));
    if (blocked.length) {
      throw bad(`لا يمكن تفريغ جداول محمية: ${blocked.join(', ')}`, 'protected_table');
    }

    const order = deleteOrder(db, expanded, allTables);

    /* Safety net: always create a restorable snapshot before destructive work. */
    const backup = createBackup({
      kind: 'pre-truncate',
      note: `نسخة أمان قبل تفريغ: ${order.join(', ')}`,
      actor: req.user.username,
    });

    db.exec('PRAGMA defer_foreign_keys = ON');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const table of order) {
        db.prepare(`DELETE FROM "${table}"`).run();
        try {
          db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table);
        } catch {
          /* table is not AUTOINCREMENT */
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw error;
    }

    audit({
      actor: req.user.username,
      userId: req.user.id,
      action: 'database.truncate',
      entity: 'system',
      ip: clientIp(req),
      detail: { tables: order, backup: backup.filename },
    });

    res.json({
      ok: true,
      data: {
        cleared: order,
        requested,
        backup: { id: backup.id, filename: backup.filename, size: backup.size },
      },
    });
  } catch (error) {
    next(error);
  }
});
