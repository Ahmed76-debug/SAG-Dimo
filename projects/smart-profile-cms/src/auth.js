const crypto = require('node:crypto');
const { db } = require('./db');

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, hash) {
  const h = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
}

function createSession(userId) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const expires = now + 8 * 60 * 60 * 1000; // 8 hours
  db.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?,?,?,?)')
    .run(id, userId, expires, new Date().toISOString());
  return { token: id, expires };
}

function validateSession(token) {
  if (!token) return null;
  const s = db.prepare('SELECT sessions.id, sessions.user_id, sessions.expires_at, users.username, users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.id=?').get(token);
  if (!s) return null;
  if (Date.now() > Number(s.expires_at)) {
    db.prepare('DELETE FROM sessions WHERE id=?').run(token);
    return null;
  }
  return { userId: s.user_id, username: s.username, role: s.role };
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE id=?').run(token);
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.cookies && req.cookies.token);
  const session = validateSession(token);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  req.user = session;
  req.token = token;
  next();
}

module.exports = { hashPassword, verifyPassword, createSession, validateSession, destroySession, authMiddleware };
