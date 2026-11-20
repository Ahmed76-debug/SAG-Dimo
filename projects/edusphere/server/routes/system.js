import fs from 'node:fs';
import path from 'node:path';
import { all, get, run, insertRow, getSetting, setSetting, transaction } from '../lib/db.js';
import { sendJson, readJson, HttpError, parseQuery } from '../lib/http.js';
import { login, logout, sessionFromToken, buildSessionUser, can, changePassword, COOKIE_NAME } from '../lib/auth.js';
import { entityMetaForApi, getEntity, ALL_ENTITIES, GROUP_LABELS, GROUP_ORDER } from '../entities/index.js';
import { translationsFor, allTranslations, upsertTranslation, seedTranslations, localeList } from '../lib/i18n.js';
import { dashboard } from '../lib/reports.js';
import { nowIso } from '../lib/util.js';
import { APP, UPLOAD_DIR } from '../config.js';

export function requirePerm(ctx, code) {
  if (!can(ctx.user, code)) throw new HttpError(403, 'forbidden');
}

export function registerSystemRoutes(router) {
  /* ---------------- health ---------------- */
  router.get('/api/health', ({ res }) => {
    sendJson(res, 200, { ok: true, app: APP.name, version: APP.version, time: nowIso() });
  });

  /* ---------------- auth ---------------- */
  router.post('/api/auth/login', async ({ req, res }) => {
    const body = await readJson(req);
    const result = login(body.username, body.password, req.socket?.remoteAddress, req.headers['user-agent']);
    if (result.error) return sendJson(res, 401, { error: result.error });
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${encodeURIComponent(result.token)}; Path=/; Max-Age=${7 * 86400}; SameSite=Lax; HttpOnly`,
    );
    sendJson(res, 200, { user: result.user, token: result.token, expires: result.expires });
  });

  router.post('/api/auth/logout', async ({ req, res, ctx }) => {
    logout(ctx.token);
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`);
    sendJson(res, 200, { ok: true });
  });

  router.get('/api/auth/me', ({ res, ctx }) => {
    if (!ctx.user) throw new HttpError(401, 'unauthorized');
    sendJson(res, 200, { user: ctx.user });
  });

  router.post('/api/auth/change-password', async ({ req, res, ctx }) => {
    if (!ctx.user) throw new HttpError(401, 'unauthorized');
    const body = await readJson(req);
    if (!body.newPassword || String(body.newPassword).length < 6) throw new HttpError(400, 'weak_password');
    changePassword(ctx.user.id, body.newPassword);
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`);
    sendJson(res, 200, { ok: true });
  });

  router.patch('/api/auth/preferences', async ({ req, res, ctx }) => {
    if (!ctx.user) throw new HttpError(401, 'unauthorized');
    const body = await readJson(req);
    const patch = {};
    if (body.locale && ['ar', 'en'].includes(body.locale)) patch.locale = body.locale;
    if (body.theme && ['light', 'dark', 'system'].includes(body.theme)) patch.theme = body.theme;
    if (Object.keys(patch).length) {
      const cols = Object.keys(patch);
      run(`UPDATE users SET ${cols.map((c) => `"${c}" = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [
        ...cols.map((c) => patch[c]),
        nowIso(),
        ctx.user.id,
      ]);
    }
    sendJson(res, 200, { ok: true });
  });

  /* ---------------- bootstrap ---------------- */
  router.get('/api/bootstrap', ({ res, ctx }) => {
    if (!ctx.user) throw new HttpError(401, 'unauthorized');
    const settings = {
      school: getSetting('app', 'school', {}),
      branding: getSetting('app', 'branding', {}),
      finance: getSetting('app', 'finance', {}),
      academic: getSetting('app', 'academic', {}),
      numbering: getSetting('app', 'numbering', {}),
      locale: getSetting('app', 'locale', {}),
      backup: getSetting('app', 'backup', {}),
      notifications: getSetting('app', 'notifications', {}),
    };
    const locale = ctx.user.locale || settings.locale.default || 'ar';
    const branches = all(`SELECT id, code, name_en, name_ar, is_active FROM branches WHERE deleted_at IS NULL ORDER BY id`);
    const currencies = all(`SELECT * FROM currencies WHERE is_active = 1 ORDER BY sort_order`);
    const years = all(`SELECT * FROM academic_years ORDER BY start_date DESC`);
    const terms = all(`SELECT * FROM terms ORDER BY sort_order`);
    const unread = get(`SELECT COUNT(*) AS c FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0`, [ctx.user.id])?.c || 0;

    sendJson(res, 200, {
      app: { name: APP.name, nameAr: APP.nameAr, version: APP.version, tagline: APP.tagline, taglineAr: APP.taglineAr },
      user: ctx.user,
      settings,
      locale,
      locales: localeList(),
      currencies,
      baseCurrency: currencies.find((c) => c.is_base)?.code || settings.finance.base_currency || 'USD',
      translations: translationsFor(locale),
      entities: entityMetaForApi(),
      groups: GROUP_ORDER.filter((g) => GROUP_LABELS[g]).map((g) => ({ code: g, ...GROUP_LABELS[g] })),
      branches,
      academicYears: years,
      terms,
      unreadNotifications: unread,
      serverTime: nowIso(),
    });
  });

  /* ---------------- i18n ---------------- */
  router.get('/api/i18n/:locale', ({ res, params }) => {
    sendJson(res, 200, { locale: params.locale, translations: translationsFor(params.locale) });
  });

  router.get('/api/i18n/:locale/list', ({ res, params, query, ctx }) => {
    requirePerm(ctx, 'i18n.manage');
    const limit = Math.min(1000, Number(query.limit) || 100);
    const offset = Number(query.offset) || 0;
    const data = allTranslations(params.locale, { search: query.search || '', limit, offset });
    sendJson(res, 200, data);
  });

  router.post('/api/i18n/:locale', async ({ req, res, params, ctx }) => {
    requirePerm(ctx, 'i18n.manage');
    const body = await readJson(req);
    if (!body.key) throw new HttpError(400, 'key_required');
    const id = upsertTranslation(params.locale, body.key, body.value ?? '', true);
    sendJson(res, 200, { ok: true, id });
  });

  router.post('/api/i18n/sync', ({ res, ctx }) => {
    requirePerm(ctx, 'i18n.manage');
    const inserted = seedTranslations({ force: false });
    sendJson(res, 200, { ok: true, inserted });
  });

  /* ---------------- settings ---------------- */
  router.get('/api/settings', ({ res, ctx }) => {
    requirePerm(ctx, 'settings.manage');
    sendJson(res, 200, {
      school: getSetting('app', 'school', {}),
      branding: getSetting('app', 'branding', {}),
      finance: getSetting('app', 'finance', {}),
      academic: getSetting('app', 'academic', {}),
      numbering: getSetting('app', 'numbering', {}),
      locale: getSetting('app', 'locale', {}),
      notifications: getSetting('app', 'notifications', {}),
    });
  });

  router.put('/api/settings/:scope', async ({ req, res, params, ctx }) => {
    requirePerm(ctx, 'settings.manage');
    const body = await readJson(req);
    const current = getSetting('app', params.scope, {}) || {};
    const next = { ...current, ...body };
    setSetting('app', params.scope, next);
    sendJson(res, 200, { ok: true, settings: next });
  });

  /* ---------------- notifications ---------------- */
  router.get('/api/notifications', ({ res, query, ctx }) => {
    const where = ['(n.user_id = ? OR n.user_id IS NULL)'];
    const params = [ctx.user.id];
    if (query.unread === '1') where.push('n.is_read = 0');
    const rows = all(
      `SELECT n.* FROM notifications n WHERE ${where.join(' AND ')} ORDER BY n.is_read, n.created_at DESC LIMIT 100`,
      params,
    );
    sendJson(res, 200, { rows, unread: rows.filter((r) => !r.is_read).length });
  });

  router.post('/api/notifications/:id/read', ({ res, params, ctx }) => {
    run(`UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ? AND (user_id = ? OR user_id IS NULL)`, [nowIso(), params.id, ctx.user.id]);
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/notifications/read-all', ({ res, ctx }) => {
    run(`UPDATE notifications SET is_read = 1, read_at = ? WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0`, [nowIso(), ctx.user.id]);
    sendJson(res, 200, { ok: true });
  });

  /* ---------------- dashboard ---------------- */
  router.get('/api/dashboard', ({ res, ctx, query }) => {
    requirePerm(ctx, 'reports.view');
    const branchId = ctx.user.branchIds && ctx.user.branchIds.length === 1 ? ctx.user.branchIds[0] : query.branch || null;
    sendJson(res, 200, dashboard({ branchId }));
  });

  /* ---------------- global search ---------------- */
  router.get('/api/search', ({ res, query, ctx }) => {
    const q = String(query.q || '').trim();
    if (q.length < 2) return sendJson(res, 200, { results: [] });
    const like = `%${q}%`;
    const results = [];
    const push = (entity, rows, labelFn) => {
      if (!can(ctx.user, `${entity}.read`)) return;
      for (const row of rows) results.push({ entity, id: row.id, label: labelFn(row), sub: row.code || '' });
    };
    push('students', all(`SELECT id, code, first_name_en, last_name_en, first_name_ar, last_name_ar FROM students WHERE deleted_at IS NULL AND (code LIKE ? OR first_name_en LIKE ? OR last_name_en LIKE ? OR first_name_ar LIKE ? OR last_name_ar LIKE ?) LIMIT 5`, [like, like, like, like, like]), (r) => `${r.first_name_en} ${r.last_name_en || ''}`);
    push('staff', all(`SELECT id, code, first_name_en, last_name_en, first_name_ar, last_name_ar FROM staff WHERE deleted_at IS NULL AND (code LIKE ? OR first_name_en LIKE ? OR last_name_en LIKE ? OR first_name_ar LIKE ? OR last_name_ar LIKE ?) LIMIT 5`, [like, like, like, like, like]), (r) => `${r.first_name_en} ${r.last_name_en || ''}`);
    push('guardians', all(`SELECT id, code, first_name_en, last_name_en FROM guardians WHERE deleted_at IS NULL AND (first_name_en LIKE ? OR last_name_en LIKE ? OR mobile LIKE ?) LIMIT 4`, [like, like, like]), (r) => `${r.first_name_en} ${r.last_name_en || ''}`);
    push('invoices', all(`SELECT id, invoice_no AS code, total FROM invoices WHERE invoice_no LIKE ? LIMIT 4`, [like]), (r) => r.code);
    push('books', all(`SELECT id, code, title_en, title_ar FROM books WHERE deleted_at IS NULL AND (title_en LIKE ? OR title_ar LIKE ? OR author LIKE ?) LIMIT 4`, [like, like, like]), (r) => r.title_en);
    push('journal_entries', all(`SELECT id, entry_no AS code, description_en FROM journal_entries WHERE entry_no LIKE ? OR description_en LIKE ? LIMIT 4`, [like, like]), (r) => `${r.code} — ${r.description_en || ''}`);
    push('accounts', all(`SELECT id, code, name_en, name_ar FROM accounts WHERE code LIKE ? OR name_en LIKE ? OR name_ar LIKE ? LIMIT 4`, [like, like, like]), (r) => `${r.code} ${r.name_en}`);
    push('sections', all(`SELECT id, code, name_en, name_ar FROM sections WHERE name_en LIKE ? OR name_ar LIKE ? LIMIT 4`, [like, like]), (r) => r.name_en);
    sendJson(res, 200, { results: results.slice(0, 24) });
  });

  /* ---------------- uploads ---------------- */
  router.post('/api/upload', async ({ req, res, query, ctx }) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    const originalName = String(query.name || 'file.bin').replace(/[^\w.\- ]+/g, '_');
    const folder = String(query.category || 'general').replace(/[^\w-]/g, '');
    const dir = path.join(UPLOAD_DIR, folder);
    fs.mkdirSync(dir, { recursive: true });
    const safeName = `${Date.now()}-${originalName}`;
    const full = path.join(dir, safeName);
    fs.writeFileSync(full, buf);
    const rel = path.join(folder, safeName).replace(/\\/g, '/');
    const id = insertRow('attachments', {
      entity: query.entity || 'general',
      entity_id: query.entity_id ? Number(query.entity_id) : null,
      name: safeName,
      original_name: originalName,
      mime: req.headers['content-type'] || 'application/octet-stream',
      size: buf.length,
      storage_path: rel,
      kind: 'file',
      uploaded_by: ctx.user.id,
      created_at: nowIso(),
    });
    sendJson(res, 200, { ok: true, id, path: `/api/files/${id}`, name: originalName, size: buf.length });
  });

  router.get('/api/files/:id', ({ res, params }) => {
    const row = get(`SELECT * FROM attachments WHERE id = ?`, [params.id]);
    if (!row) throw new HttpError(404, 'not_found');
    const full = path.join(UPLOAD_DIR, row.storage_path);
    if (!fs.existsSync(full)) throw new HttpError(404, 'not_found');
    const ext = path.extname(full).toLowerCase();
    const mime = row.mime || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': fs.statSync(full).size,
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': `inline; filename="${encodeURIComponent(row.original_name || row.name)}"`,
    });
    fs.createReadStream(full).pipe(res);
    void ext;
  });

  /* ---------------- users & roles ---------------- */
  router.get('/api/users/:id/roles', ({ res, params, ctx }) => {
    requirePerm(ctx, 'users.manage');
    const roles = all(
      `SELECT ur.role_id, ur.branch_id, r.code, r.name_en, r.name_ar FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?`,
      [params.id],
    );
    const branches = all(`SELECT branch_id FROM user_branches WHERE user_id = ?`, [params.id]);
    sendJson(res, 200, { roles, branches: branches.map((b) => b.branch_id) });
  });

  router.put('/api/users/:id/roles', async ({ req, res, params, ctx }) => {
    requirePerm(ctx, 'users.manage');
    const body = await readJson(req);
    run(`DELETE FROM user_roles WHERE user_id = ?`, [params.id]);
    for (const roleId of body.roleIds || []) {
      run(`INSERT OR IGNORE INTO user_roles (user_id, role_id, branch_id) VALUES (?,?,?)`, [params.id, roleId, body.branchId || null]);
    }
    run(`DELETE FROM user_branches WHERE user_id = ?`, [params.id]);
    for (const branchId of body.branchIds || []) {
      run(`INSERT OR IGNORE INTO user_branches (user_id, branch_id) VALUES (?,?)`, [params.id, branchId]);
    }
    sendJson(res, 200, { ok: true });
  });

  router.get('/api/roles/:id/permissions', ({ res, params, ctx }) => {
    requirePerm(ctx, 'users.manage');
    const rows = all(`SELECT permission_id FROM role_permissions WHERE role_id = ?`, [params.id]);
    sendJson(res, 200, { permissionIds: rows.map((r) => r.permission_id) });
  });

  router.put('/api/roles/:id/permissions', async ({ req, res, params, ctx }) => {
    requirePerm(ctx, 'users.manage');
    const body = await readJson(req);
    run(`DELETE FROM role_permissions WHERE role_id = ?`, [params.id]);
    for (const pid of body.permissionIds || []) {
      run(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?,?)`, [params.id, pid]);
    }
    sendJson(res, 200, { ok: true });
  });

  router.get('/api/permissions', ({ res, ctx }) => {
    requirePerm(ctx, 'users.manage');
    sendJson(res, 200, { rows: all(`SELECT * FROM permissions ORDER BY module, code`) });
  });

  /* ---------------- audit ---------------- */
  router.get('/api/audit', ({ res, ctx, query }) => {
    requirePerm(ctx, 'users.manage');
    const limit = Math.min(500, Number(query.limit) || 100);
    const rows = all(`SELECT * FROM audit_log ORDER BY id DESC LIMIT ?`, [limit]);
    sendJson(res, 200, { rows });
  });

  /* ---------------- data tools: truncate tables ---------------- */
  const DT_PROTECTED = new Set([
    'users', 'roles', 'permissions', 'role_permissions', 'user_roles', 'user_branches',
    'sessions', 'settings', 'audit_log', 'archive_records', 'schema_migrations', 'migrations', '_migrations',
    'translations', 'branches', 'currencies', 'academic_years', 'terms',
  ]);
  const dtTables = () =>
    all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
      .map((r) => r.name);

  router.get('/api/data-tools', ({ res, ctx }) => {
    requirePerm(ctx, 'users.manage');
    const tables = dtTables().map((name) => ({
      name,
      label: name,
      rows: Number(get(`SELECT COUNT(*) AS c FROM "${name}"`)?.c || 0),
      protected: DT_PROTECTED.has(name),
    }));
    sendJson(res, 200, { tables });
  });

  router.post('/api/data-tools/truncate', async ({ req, res, ctx }) => {
    requirePerm(ctx, 'users.manage');
    const body = await readJson(req);
    const names = dtTables();
    const known = new Set(names);
    const requested = (Array.isArray(body.tables) ? body.tables.map(String) : [])
      .filter((t) => known.has(t) && !DT_PROTECTED.has(t));
    if (!requested.length) throw new HttpError(400, 'no_tables_selected');

    // Expand selection with child tables so foreign keys stay consistent.
    // 1) Real SQLite foreign keys (when declared).
    const children = new Map();
    const addChild = (parent, child) => {
      if (!known.has(parent) || !known.has(child)) return;
      if (!children.has(parent)) children.set(parent, new Set());
      children.get(parent).add(child);
    };
    for (const table of names) {
      for (const fk of all(`PRAGMA foreign_key_list("${table}")`)) {
        addChild(String(fk.table), table);
      }
    }
    // 2) Logical references declared in entity metadata (`type: "ref"`).
    //    The EduSphere schema intentionally declares few physical FKs, so this
    //    keeps truncation safe for the full domain model.
    for (const entity of ALL_ENTITIES) {
      for (const field of entity.fields || []) {
        if (field.type !== 'ref' || !field.ref) continue;
        const parent = getEntity(field.ref)?.table || field.ref;
        addChild(parent, entity.table);
      }
    }
    const selected = new Set(requested);
    let grew = true;
    while (grew) {
      grew = false;
      for (const table of [...selected]) {
        for (const child of children.get(table) || []) {
          if (!selected.has(child) && !DT_PROTECTED.has(child)) {
            selected.add(child);
            grew = true;
          }
        }
      }
    }
    const cleared = [...selected];

    run('PRAGMA defer_foreign_keys = ON');
    transaction(() => {
      for (const table of cleared) run(`DELETE FROM "${table}"`);
    });
    run(
      `INSERT INTO audit_log (user_id, username, action, entity, entity_id, branch_id, summary, changes, ip, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        ctx.user.id,
        ctx.user.username,
        'truncate',
        'data-tools',
        null,
        ctx.user.branch_id ?? null,
        `تفريغ الجداول: ${cleared.join(', ')}`,
        JSON.stringify({ tables: cleared }),
        ctx.ip ?? null,
        nowIso(),
      ],
    );
    sendJson(res, 200, { ok: true, cleared });
  });

  /* ---------------- session refresh helper ---------------- */
  router.get('/api/session', ({ res, ctx }) => {
    sendJson(res, 200, { user: ctx.user ? buildSessionUser(get(`SELECT * FROM users WHERE id = ?`, [ctx.user.id])) : null });
  });
}

export function attachContext(router) {
  return async (req, res, url) => {
    const match = router.match(req.method, url.pathname);
    if (!match) return false;
    const cookies = Object.fromEntries(
      (req.headers.cookie || '')
        .split(';')
        .map((p) => p.trim().split('='))
        .filter((p) => p.length === 2)
        .map(([k, v]) => [k, decodeURIComponent(v)]),
    );
    const token = cookies[COOKIE_NAME] || req.headers['x-session-token'] || null;
    const session = token ? sessionFromToken(token) : null;
    const ctx = {
      user: session?.user || null,
      token,
      ip: req.socket?.remoteAddress,
      res,
      branchIds: session?.user?.branchIds ?? null,
    };
    await match.route.handler({ req, res, url, params: match.params, query: parseQuery(url), ctx });
    return true;
  };
}

export { sessionFromToken };
