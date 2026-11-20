import { db, type User } from '@/lib/db'
import { api, setToken } from '@/lib/api'
import type { UserRole } from '@/types'

export interface SessionUser {
  id: number
  username: string
  fullNameAr: string
  fullNameEn: string
  role: UserRole
  companyId?: number
  email?: string
}

async function sha256(text: string): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(text)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    let h = 2166136261
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return `fallback${(h >>> 0).toString(16)}`
  }
}

export async function hashPassword(password: string) {
  return sha256(`muraqib::${password}`)
}

export async function login(username: string, password: string): Promise<SessionUser> {
  const result = await api<{ token: string; user: SessionUser }>('/api/auth/login', {
    method: 'POST',
    body: { username: username.trim(), password },
  })
  setToken(result.token)
  return result.user
}

export async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' })
  } catch {
    // The local session must be cleared even if the server is unreachable.
  }
  setToken(null)
}

export async function createUser(input: {
  username: string; password: string; fullNameAr: string; fullNameEn: string
  role: UserRole; companyId?: number; email?: string; phone?: string; isActive?: boolean
}) {
  const exists = await db.users.where({ username: input.username.trim() }).first()
  if (exists) throw new Error('USERNAME_EXISTS')
  const now = new Date().toISOString()
  return db.users.add({
    username: input.username.trim(),
    passwordHash: await hashPassword(input.password),
    fullNameAr: input.fullNameAr,
    fullNameEn: input.fullNameEn,
    role: input.role,
    companyId: input.companyId,
    email: input.email,
    phone: input.phone,
    isActive: input.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  } as User)
}

export async function updateUser(id: number, input: Partial<User> & { password?: string }) {
  const patch: Partial<User> = { ...input, updatedAt: new Date().toISOString() }
  delete (patch as any).password
  if (input.password) patch.passwordHash = await hashPassword(input.password)
  return db.users.update(id, patch)
}

export async function logAudit(
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'login' | 'export' | 'backup' | 'restore' | 'generate' | 'truncate',
  entity: string,
  entityId: number | undefined,
  detailsAr: string,
  detailsEn: string,
  userName?: string,
) {
  try {
    await db.auditLogs.add({
      action, entity, entityId, detailsAr, detailsEn, userName,
      createdAt: new Date().toISOString(),
    })
  } catch {
    // Audit logging must never block the business operation.
  }
}

export function can(role: UserRole | undefined, permission: string): boolean {
  if (!role) return false
  const map: Record<UserRole, string[]> = {
    admin: ['*'],
    reviewer: ['companies', 'accounts', 'tb', 'review', 'reports', 'analysis', 'archive', 'reminders', 'budget', 'export'],
    accountant: ['companies', 'accounts', 'tb', 'adjustments', 'reports', 'analysis', 'archive', 'reminders', 'budget', 'export'],
    client_finance_manager: ['portal'],
    external: ['portal'],
    viewer: ['reports', 'analysis', 'archive', 'export'],
  }
  const perms = map[role] || []
  return perms.includes('*') || perms.includes(permission)
}

export function isPortalRole(role: UserRole | undefined) {
  return role === 'external' || role === 'client_finance_manager'
}
