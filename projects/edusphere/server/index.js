import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

import { ROOT, PUBLIC_DIR, APP, resolvePort } from './config.js';
import { exec, checkpoint } from './lib/db.js';
import { CORE_SQL, ACADEMICS_SQL, FINANCE_SQL, OPERATIONS_SQL, INDEXES_SQL } from './lib/schema.js';
import { seedI18n } from './lib/i18n.js';
import { runSeed } from './lib/seed.js';
import { ensureDefaultAdmin } from './lib/auth.js';
import { startBackupScheduler } from './lib/backup.js';
import {
  Router,
  HttpError,
  sendJson,
  sendFile,
  applySecurityHeaders,
} from './lib/http.js';
import { registerSystemRoutes, attachContext } from './routes/system.js';
import { registerBusinessRoutes } from './routes/business.js';
import { registerDataRoutes } from './routes/data.js';

const STARTED_AT = Date.now();

/* ------------------------------------------------------------------ *
 * 1. Schema & seed
 * ------------------------------------------------------------------ */
function migrateDatabase() {
  const safeAdd = (sql) => { try { exec(sql); } catch { /* exists */ } };
  safeAdd(`ALTER TABLE bank_accounts ADD COLUMN kind TEXT DEFAULT 'bank'`); // bank | cashbox
  safeAdd(`ALTER TABLE payment_methods ADD COLUMN bank_account_id INTEGER`);
  safeAdd(`ALTER TABLE payments ADD COLUMN bank_account_id INTEGER`);
  safeAdd(`ALTER TABLE expenses ADD COLUMN bank_account_id INTEGER`);
  safeAdd(`ALTER TABLE expenses ADD COLUMN method_id INTEGER`);
  safeAdd(`UPDATE bank_accounts SET kind = 'bank' WHERE kind IS NULL OR kind = ''`);
}

function bootstrapDatabase() {
  const sql = [CORE_SQL, ACADEMICS_SQL, FINANCE_SQL, OPERATIONS_SQL, INDEXES_SQL].join('\n');
  exec(sql);
  migrateDatabase();
  const translations = seedI18n();
  const seed = runSeed();
  const adminId = ensureDefaultAdmin();
  return { translations, seed, adminId };
}

/* ------------------------------------------------------------------ *
 * 2. Routers
 * ------------------------------------------------------------------ */
function buildRouter() {
  const router = new Router();
  // Order matters: specific namespaces must be registered before the
  // generic /api/:entity CRUD routes, otherwise they get captured.
  registerSystemRoutes(router);
  registerBusinessRoutes(router);
  registerDataRoutes(router);
  return router;
}

/* ------------------------------------------------------------------ *
 * 3. Static file serving for the SPA
 * ------------------------------------------------------------------ */
function resolveStatic(pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (!rel || rel === '/') rel = 'index.html';
  const full = path.resolve(PUBLIC_DIR, rel);
  if (!full.startsWith(path.resolve(PUBLIC_DIR))) return null; // traversal guard
  return full;
}

function serveStatic(req, res, pathname) {
  const full = resolveStatic(pathname);
  if (!full) return sendJson(res, 403, { error: 'forbidden' });

  let stat = null;
  try {
    stat = fs.statSync(full);
  } catch {
    /* not found */
  }

  if (stat && stat.isFile()) {
    const ext = path.extname(full).toLowerCase();
    const immutable = pathname.startsWith('/assets/') || ext === '.woff2';
    return sendFile(res, full, { cache: immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
  }

  // SPA fallback — only for navigation requests, never for asset paths.
  if (path.extname(pathname)) return sendJson(res, 404, { error: 'not_found' });
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return sendJson(res, 503, {
      error: 'frontend_missing',
      message: 'The web client has not been built yet. Create public/index.html.',
    });
  }
  return sendFile(res, indexPath, { cache: 'no-cache' });
}

/* ------------------------------------------------------------------ *
 * 4. Request pipeline
 * ------------------------------------------------------------------ */
function createServer(router) {
  const dispatchApi = attachContext(router);

  return http.createServer(async (req, res) => {
    const started = Date.now();
    applySecurityHeaders(res);

    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
      return sendJson(res, 400, { error: 'bad_request' });
    }

    // Health can be answered without touching the DB session logic.
    if (url.pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        app: APP.name,
        version: APP.version,
        uptime: Math.round((Date.now() - STARTED_AT) / 1000),
        time: new Date().toISOString(),
      });
    }

    try {
      if (url.pathname.startsWith('/api/')) {
        const handled = await dispatchApi(req, res, url);
        if (!handled) return sendJson(res, 404, { error: 'not_found', path: url.pathname });
        return undefined;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return sendJson(res, 405, { error: 'method_not_allowed' });
      }
      return serveStatic(req, res, url.pathname);
    } catch (err) {
      if (err instanceof HttpError) {
        return sendJson(res, err.status, { error: err.code, message: err.message });
      }
      console.error(`[${req.method} ${url.pathname}]`, err);
      if (!res.headersSent) {
        return sendJson(res, 500, {
          error: 'internal_error',
          message: process.env.NODE_ENV === 'production' ? undefined : String(err?.message || err),
        });
      }
      try {
        res.end();
      } catch {
        /* ignore */
      }
      return undefined;
    } finally {
      if (process.env.EDUSPHERE_LOG === '1') {
        console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
      }
    }
  });
}

/* ------------------------------------------------------------------ *
 * 5. Start
 * ------------------------------------------------------------------ */
function listen(server, port, attempts = 10) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.removeListener('listening', onListening);
      if (err.code === 'EADDRINUSE' && attempts > 0) {
        resolve(listen(server, port + 1, attempts - 1));
      } else {
        reject(err);
      }
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(server.address().port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, process.env.HOST || '0.0.0.0');
  });
}

async function main() {
  console.log('');
  console.log(`  ${APP.name} — ${APP.tagline}`);
  console.log('  ------------------------------------------------');

  const t0 = Date.now();
  const info = bootstrapDatabase();
  console.log(`  Database ready (${Date.now() - t0} ms) · ${info.translations} translations · seed: ${info.seed?.skipped ? 'existing' : 'created'}`);
  if (info.adminId) console.log('  Created default administrator → admin / admin123');

  const router = buildRouter();
  const server = createServer(router);

  const preferred = resolvePort(Number(process.env.PORT) || 0);
  const port = await listen(server, preferred);

  try {
    fs.writeFileSync(path.join(ROOT, '.port'), String(port));
  } catch {
    /* ignore */
  }

  startBackupScheduler();

  console.log('');
  console.log(`  ➜  Local:   http://localhost:${port}`);
  console.log(`  ➜  Network: http://${localIp()}:${port}`);
  console.log('');
  console.log('  Press Ctrl+C to stop.');
  console.log('');

  const shutdown = (signal) => {
    console.log(`\n  ${signal} received — shutting down…`);
    try {
      checkpoint();
    } catch {
      /* ignore */
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 4000).unref?.();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

function localIp() {
  try {
    const nets = os.networkInterfaces();
    for (const list of Object.values(nets)) {
      for (const net of list || []) {
        if (net.family === 'IPv4' && !net.internal) return net.address;
      }
    }
  } catch {
    /* ignore */
  }
  return 'localhost';
}

main().catch((err) => {
  console.error('\n  Failed to start EduSphere:\n', err);
  process.exit(1);
});
