import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  root: path.resolve(here, '..'),
  dataDir: path.resolve(process.env.MIFTAH_DATA_DIR || path.join(here, '..', 'data')),
  keysDir: path.resolve(process.env.MIFTAH_KEYS_DIR || path.join(here, '..', 'keys')),
  backupsDir: path.resolve(process.env.MIFTAH_BACKUP_DIR || path.join(here, '..', 'backups')),
  distDir: path.resolve(here, '..', 'dist'),
  port: Number(process.env.PORT || 4781),
  host: process.env.HOST || '127.0.0.1',
  isProd: process.env.NODE_ENV === 'production',
};

for (const dir of [config.dataDir, config.keysDir, config.backupsDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadOrCreateSecret() {
  const file = path.join(config.dataDir, '.secret');
  if (fs.existsSync(file)) {
    const value = fs.readFileSync(file, 'utf8').trim();
    if (value.length >= 32) return Buffer.from(value, 'base64url');
  }
  const secret = crypto.randomBytes(48);
  fs.writeFileSync(file, secret.toString('base64url'), { mode: 0o600 });
  return secret;
}

export const secret = loadOrCreateSecret();
export const dbFile = path.join(config.dataDir, 'miftah.db');
export const pkg = JSON.parse(fs.readFileSync(path.join(config.root, 'package.json'), 'utf8'));
