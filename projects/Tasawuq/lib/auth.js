/* ============================================================
   تسوق - Auth & Permissions
   ============================================================ */
const { q, one, hash, uid, nowISO } = require("./db");

function createToken(userId, ip, ua) {
  const token = uid() + uid();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    q("INSERT INTO sessions (token, user_id, ip, user_agent, expires_at) VALUES (?,?,?,?,?)", [token, userId, ip||'', ua||'', expires]);
  } catch(e) {}
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = one("SELECT * FROM sessions WHERE token=?", [token]);
  if (!s) return null;
  if (s.expires_at && new Date(s.expires_at) < new Date()) return null;
  const u = one("SELECT id,name,email,phone,avatar,role,status,permissions FROM users WHERE id=?", [s.user_id]);
  if (!u) return null;
  if (u.status === 'blocked') return null;
  try { u.permissions = JSON.parse(u.permissions || '{}'); } catch { u.permissions = {}; }
  return { session: s, user: u };
}

function requireAuth(getSessionFn) {
  return (req, res, next) => {
    const token = (req.headers.authorization||'').replace('Bearer ','').trim() || req.cookies?.token;
    const sess = getSessionFn ? getSessionFn(token) : getSession(token);
    if (!sess) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
    req.user = sess.user;
    req.session = sess.session;
    next();
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح لك' });
    next();
  };
}

function logActivity(userId, action, ip, ua, details) {
  try {
    q("INSERT INTO activity_log (user_id,action,ip,user_agent,details) VALUES (?,?,?,?,?)", [userId, action, ip, ua, JSON.stringify(details||{})]);
  } catch(e) {}
}

module.exports = { createToken, getSession, requireAuth, requireRole, logActivity, hash };
