import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config, secret } from './config.mjs';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/* ---------- canonical JSON (stable signatures) ---------- */
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

/* ---------- passwords ---------- */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, saltB64, hashB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64url');
    const expected = Buffer.from(hashB64, 'base64url');
    const actual = crypto.scryptSync(String(password), salt, expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/* ---------- session tokens (JWT-compatible HS256) ---------- */
const b64u = (buf) => Buffer.from(buf).toString('base64url');

export function signToken(payload, ttlSeconds = 60 * 60 * 12) {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds })
  );
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token) {
  try {
    const [header, body, sig] = String(token).split('.');
    if (!header || !body || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest();
    const actual = Buffer.from(sig, 'base64url');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------- license keys ---------- */
export function generateLicenseKey(prefix = 'MFT') {
  const bytes = crypto.randomBytes(16);
  let body = '';
  for (let i = 0; i < 16; i++) body += ALPHABET[bytes[i] % ALPHABET.length];
  const groups = body.match(/.{1,4}/g);
  return `${String(prefix).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'MFT'}-${groups.join('-')}`;
}

export function normalizeKey(key) {
  return String(key || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function hashKey(key) {
  return crypto.createHash('sha256').update(normalizeKey(key)).digest('hex');
}

export function keyHint(key) {
  const clean = normalizeKey(key);
  const parts = clean.split('-');
  const tail = clean.slice(-4);
  return `${parts[0]}-••••-••••-${tail}`;
}

/* ---------- encrypted key storage ---------- */
const aesKey = crypto.createHash('sha256').update(Buffer.concat([secret, Buffer.from('miftah-license-key')])).digest();

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${enc.toString('base64url')}`;
}

export function decryptSecret(payload) {
  try {
    const [v, iv, tag, data] = String(payload).split(':');
    if (v !== 'v1') return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/* ---------- API keys ---------- */
export function generateApiKey() {
  return `mft_live_${crypto.randomBytes(24).toString('hex')}`;
}

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

/* ---------- Ed25519 document signing ---------- */
export function ensureSigningKeys() {
  const privFile = path.join(config.keysDir, 'private.pem');
  const pubFile = path.join(config.keysDir, 'public.pem');
  if (!fs.existsSync(privFile) || !fs.existsSync(pubFile)) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(privFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    fs.writeFileSync(pubFile, publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o644 });
  }
  return {
    privatePem: fs.readFileSync(privFile, 'utf8'),
    publicPem: fs.readFileSync(pubFile, 'utf8'),
    privateFile: privFile,
    publicFile: pubFile,
  };
}

export function signDocument(payload) {
  const { privatePem } = ensureSigningKeys();
  const key = crypto.createPrivateKey(privatePem);
  const data = Buffer.from(canonicalize(payload), 'utf8');
  return {
    v: 1,
    payload,
    algorithm: 'Ed25519',
    signature: crypto.sign(null, data, key).toString('base64'),
  };
}

export function publicKeyPem() {
  return ensureSigningKeys().publicPem.trim();
}

/* ---------- misc ---------- */
export function uid(prefix = 'LIC') {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${stamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function normalizeMachine(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 96);
}

export function maskMachine(machine) {
  const clean = String(machine || '');
  if (clean.length <= 8) return clean;
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}
