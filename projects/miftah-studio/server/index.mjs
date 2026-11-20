import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config, pkg } from './config.mjs';
import { openDatabase, getDb, getSettings, closeDatabase } from './db.mjs';
import { seedIfNeeded, ensureDefaultAdmin } from './seed.mjs';
import { HttpError } from './util.mjs';
import { createBackup } from './backup.mjs';

import { authRouter } from './routes/auth.mjs';
import { dashboardRouter } from './routes/dashboard.mjs';
import { productsRouter } from './routes/products.mjs';
import { customersRouter } from './routes/customers.mjs';
import { licensesRouter } from './routes/licenses.mjs';
import { activationsRouter } from './routes/activations.mjs';
import { requestsRouter } from './routes/requests.mjs';
import { usersRouter } from './routes/users.mjs';
import { rolesRouter } from './routes/roles.mjs';
import { backupsRouter } from './routes/backups.mjs';
import { systemRouter } from './routes/system.mjs';
import { settingsRouter } from './routes/settings.mjs';
import { auditRouter } from './routes/audit.mjs';
import { dataToolsRouter } from './routes/datatools.mjs';
import { publicRouter } from './routes/public-api.mjs';

openDatabase();
const seeded = seedIfNeeded();
try { ensureDefaultAdmin(); } catch (e) { console.error('ensureDefaultAdmin failed', e); }

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '48mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

app.use('/api/v1', publicRouter);
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/products', productsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/licenses', licensesRouter);
app.use('/api/activations', activationsRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/backups', backupsRouter);
app.use('/api/system', systemRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/data-tools', dataToolsRouter);

app.get('/api', (req, res) => {
  res.json({
    ok: true,
    data: {
      name: 'Miftah Studio API',
      version: pkg.version,
      endpoints: ['/api/v1/health', '/api/auth/login', '/api/dashboard', '/api/licenses'],
    },
  });
});

if (fs.existsSync(config.distDir)) {
  app.use(express.static(config.distDir, { maxAge: '7d', index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(config.distDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.type('text/plain').send('Miftah Studio API يعمل الآن على المنفذ ' + config.port + '\nشغّل الواجهة عبر: npm run dev');
  });
}

app.use((req, res) => {
  res.status(404).json({ ok: false, error: { code: 'not_found', message: 'المسار غير موجود' } });
});

app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = error instanceof HttpError ? error.status : 500;
  if (status >= 500) console.error('[miftah]', error);
  const message = error instanceof HttpError ? error.message : 'حدث خطأ غير متوقع في الخادم';
  if (res.headersSent) return;
  res.status(status).json({
    ok: false,
    error: {
      code: error.code || (status >= 500 ? 'server_error' : 'error'),
      message,
      details: error.details || undefined,
    },
  });
});

const server = app.listen(config.port, config.host, () => {
  const url = `http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${config.port}`;
  console.log('');
  console.log('  ┌────────────────────────────────────────────────────────────┐');
  console.log('  │   مفتاح · Miftah Studio — استوديو التراخيص الاحترافي        │');
  console.log('  └────────────────────────────────────────────────────────────┘');
  console.log(`   API          : ${url}`);
  console.log(`   البيانات      : ${config.dataDir}`);
  console.log(`   المفاتيح      : ${config.keysDir}`);
  console.log(`   النسخ         : ${config.backupsDir}`);
  if (seeded.seeded) console.log('   تم تهيئة بيانات عرض تجريبية ✓');
  console.log('');
  console.log('   الدخول التجريبي: admin / admin123');
  console.log('');
});

/* ---- automatic backups ---- */
async function maybeAutoBackup() {
  try {
    const settings = getSettings();
    const hours = Number(settings['backup.autoHours'] || 0);
    if (!hours || hours <= 0) return;
    const last = getDb().prepare("SELECT created_at FROM backups WHERE kind='auto' ORDER BY created_at DESC LIMIT 1").get();
    const elapsed = last ? Date.now() - new Date(last.created_at).getTime() : Infinity;
    if (elapsed < hours * 3600000) return;
    const record = createBackup({ kind: 'auto', note: 'نسخة احتياطية تلقائية', actor: 'system' });
    console.log(`[miftah] نسخة احتياطية تلقائية: ${record.filename}`);
  } catch (error) {
    console.error('[miftah] فشل النسخ التلقائي:', error.message);
  }
}
setTimeout(maybeAutoBackup, 45000).unref();
const backupTimer = setInterval(maybeAutoBackup, 30 * 60 * 1000);
backupTimer.unref();

function shutdown(signal) {
  console.log(`\n[miftah] إيقاف (${signal})...`);
  server.close(() => {
    try { closeDatabase(); } catch { /* ignore */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
