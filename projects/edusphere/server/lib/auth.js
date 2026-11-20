import { all, get, run, transaction } from './db.js';
import { hashPassword, verifyPassword, randomToken, sha256, nowIso } from './util.js';
import { SESSION_TTL_DAYS } from '../config.js';

export const COOKIE_NAME = 'edusphere_session';

export function userByUsername(username) {
  return get(`SELECT * FROM users WHERE username = ? AND deleted_at IS NULL`, [username]);
}

export function permissionsFor(userId) {
  const rows = all(
    `SELECT DISTINCT p.code FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = ?`,
    [userId],
  );
  return rows.map((r) => r.code);
}

export function rolesFor(userId) {
  return all(
    `SELECT r.id, r.code, r.name_en, r.name_ar, r.level, ur.branch_id
     FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?`,
    [userId],
  );
}

export function branchScopeFor(user) {
  if (user.is_super) return null; // null = all branches
  const rows = all(`SELECT branch_id FROM user_branches WHERE user_id = ?`, [user.id]);
  const ids = rows.map((r) => r.branch_id).filter(Boolean);
  if (!ids.length && user.branch_id) return [user.branch_id];
  if (!ids.length) return null;
  return ids;
}

export function buildSessionUser(user) {
  const perms = user.is_super ? ['*'] : permissionsFor(user.id);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name_en: user.full_name_en,
    full_name_ar: user.full_name_ar,
    avatar: user.avatar,
    locale: user.locale || 'ar',
    theme: user.theme || 'system',
    branch_id: user.branch_id,
    is_super: Boolean(user.is_super),
    must_change_password: Boolean(user.must_change_password),
    roles: rolesFor(user.id),
    permissions: perms,
    branchIds: branchScopeFor(user),
  };
}

export function can(user, permission) {
  if (!user) return false;
  if (user.is_super) return true;
  if (user.permissions?.includes('*')) return true;
  if (user.permissions?.includes(permission)) return true;
  const [entity] = String(permission).split('.');
  // entity-level wildcard support: "students.*"
  return Boolean(user.permissions?.includes(`${entity}.*`));
}

export function login(username, password, ip, userAgent) {
  const user = userByUsername(String(username || '').trim());
  if (!user) return { error: 'invalid_credentials' };
  if (!user.is_active) return { error: 'account_disabled' };
  if (user.locked_until && new Date(user.locked_until) > new Date()) return { error: 'account_locked' };

  if (!verifyPassword(password, user.password_hash)) {
    const attempts = (user.failed_attempts || 0) + 1;
    const lock = attempts >= 8 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    run(`UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?`, [attempts, lock, user.id]);
    return { error: 'invalid_credentials' };
  }

  run(`UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ?, last_login_ip = ? WHERE id = ?`, [
    nowIso(),
    ip || null,
    user.id,
  ]);

  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000).toISOString();
  run(
    `INSERT INTO sessions (user_id, token_hash, ip, user_agent, created_at, expires_at, last_seen_at)
     VALUES (?,?,?,?,?,?,?)`,
    [user.id, sha256(token), ip || null, userAgent || null, nowIso(), expires, nowIso()],
  );

  return { token, expires, user: buildSessionUser(user) };
}

export function sessionFromToken(token) {
  if (!token) return null;
  const row = get(
    `SELECT s.id AS session_id, s.expires_at, s.revoked_at, u.*
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND u.deleted_at IS NULL`,
    [sha256(token)],
  );
  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  if (!row.is_active) return null;
  run(`UPDATE sessions SET last_seen_at = ? WHERE id = ?`, [nowIso(), row.session_id]);
  return { sessionId: row.session_id, user: buildSessionUser(row) };
}

export function logout(token) {
  if (!token) return;
  run(`UPDATE sessions SET revoked_at = ? WHERE token_hash = ?`, [nowIso(), sha256(token)]);
}

export function revokeAllSessions(userId) {
  run(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, [nowIso(), userId]);
}

export function changePassword(userId, newPassword) {
  run(`UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?`, [
    hashPassword(newPassword),
    nowIso(),
    userId,
  ]);
  revokeAllSessions(userId);
}

export function createUser({ username, password, full_name_en, full_name_ar, email, roleIds = [], branchIds = [], ...rest }) {
  return transaction(() => {
    const id = run(
      `INSERT INTO users (username, password_hash, full_name_en, full_name_ar, email, locale, theme, branch_id, is_active, must_change_password, created_at)
       VALUES (?,?,?,?,?,?,?,?,1,1,?)`,
      [
        username,
        hashPassword(password),
        full_name_en || username,
        full_name_ar || full_name_en || username,
        email || null,
        rest.locale || 'ar',
        rest.theme || 'system',
        rest.branch_id || null,
        nowIso(),
      ],
    ).lastInsertRowid;
    for (const roleId of roleIds) {
      run(`INSERT OR IGNORE INTO user_roles (user_id, role_id, branch_id) VALUES (?,?,?)`, [id, roleId, rest.branch_id || null]);
    }
    for (const branchId of branchIds) {
      run(`INSERT OR IGNORE INTO user_branches (user_id, branch_id) VALUES (?,?)`, [id, branchId]);
    }
    return id;
  });
}

export function ensureDefaultAdmin() {
  // Unified administrator: admin / admin123, always super admin.
  const d = get(`SELECT id FROM users WHERE username = 'admin' AND deleted_at IS NULL`);
  if (!d) {
    const uid = createUser({
      username: 'admin',
      password: 'admin123',
      full_name_en: 'System Administrator',
      full_name_ar: 'مدير النظام',
      email: 'admin@edusphere.local',
    });
    const role = get(`SELECT id FROM roles WHERE code = 'super_admin'`);
    if (role) run(`INSERT OR IGNORE INTO user_roles (user_id, role_id, branch_id) VALUES (?,?,NULL)`, [uid, role.id]);
    run(`UPDATE users SET is_super = 1, must_change_password = 0 WHERE id = ?`, [uid]);
    return uid;
  }
  run(`UPDATE users SET is_super = 1, is_active = 1, must_change_password = 0, password_hash = ? WHERE id = ?`, [hashPassword('admin123'), d.id]);
  const role = get(`SELECT id FROM roles WHERE code = 'super_admin'`);
  if (role) run(`INSERT OR IGNORE INTO user_roles (user_id, role_id, branch_id) VALUES (?,?,NULL)`, [d.id, role.id]);
  return d.id;
}
