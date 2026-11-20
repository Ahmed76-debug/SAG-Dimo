import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { initDb } from './db.mjs';
import { runSeed } from './seed.mjs';
import { PORT, HOST, ROOT } from './config.mjs';
import { authRouter } from './routes/auth.mjs';
import { apiRouter } from './routes/api.mjs';

initDb();
runSeed();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '250mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const code = err.code || 'server_error';
  const message = err.message || 'خطأ غير متوقع';
  if (status >= 500) console.error('[server]', err);
  res.status(status).json({ ok: false, error: { code, message, details: err.details } });
});

const distDir = path.join(ROOT, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`Muraqib web server running at http://${HOST}:${PORT}`);
});
