import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Project root (…/edusphere) */
export const ROOT = path.resolve(__dirname, '..');
export const SERVER_DIR = __dirname;
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const DATA_DIR = process.env.EDUSPHERE_DATA || path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const BACKUP_DIR = process.env.EDUSPHERE_BACKUP_DIR || path.join(ROOT, 'backups');
export const DB_FILE = process.env.EDUSPHERE_DB || path.join(DATA_DIR, 'edusphere.db');

export const APP = {
  name: 'EduSphere',
  nameAr: 'إديو سفير',
  tagline: 'International School Management & ERP Platform',
  taglineAr: 'منصة إدارة وتخطيط موارد المدارس الدولية',
  version: '1.0.0',
};

const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

/** Resolve the HTTP port: explicit env > .port file > default, with auto-increment on conflict. */
export function resolvePort(preferred) {
  const portFile = path.join(ROOT, '.port');
  let port = Number(preferred || process.env.PORT || process.env.EDUSPHERE_PORT || 0);
  if (!port && fs.existsSync(portFile)) port = Number(fs.readFileSync(portFile, 'utf8').trim()) || 0;
  return port || 4173;
}

export const SESSION_TTL_DAYS = Number(process.env.EDUSPHERE_SESSION_DAYS || 7);
export const MAX_UPLOAD_BYTES = Number(process.env.EDUSPHERE_MAX_UPLOAD || 25 * 1024 * 1024);

for (const dir of [DATA_DIR, UPLOAD_DIR, BACKUP_DIR]) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
}
