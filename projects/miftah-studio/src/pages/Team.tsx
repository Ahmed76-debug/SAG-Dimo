import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  Check, Crown, KeyRound, Lock, Pencil, Plus, RotateCcw, Shield, ShieldCheck, Trash2, UserCog,
  UserPlus, Users, X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar, Badge, Button, EmptyState, Field, Input, SearchInput, Switch, Textarea } from '@/components/ui/primitives';
import { ColorPicker } from '@/components/ui/forms';
import { ConfirmDialog, Modal } from '@/components/ui/overlays';
import {
  DataTable, ErrorPanel, Panel, StatCard, TableSkeleton, Td, Th, Tr,
} from '@/components/ui/page';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiQuery } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import type { PermissionDef, Role, User } from '@/lib/types';
import { cn, formatDate, formatNumber, timeAgo } from '@/lib/utils';

type Tab = 'users' | 'roles';

type UserForm = {
  username: string;
  name: string;
  email: string;
  password: string;
  roleId: string;
  avatarColor: string;
  isActive: boolean;
};

const EMPTY_USER: UserForm = {
  username: '', name: '', email: '', password: '', roleId: '', avatarColor: '#6366f1', isActive: true,
};

type RoleForm = {
  name: string;
  nameEn: string;
  description: string;
  permissions: string[];
};

const EMPTY_ROLE: RoleForm = { name: '', nameEn: '', description: '', permissions: [] };

export function Team() {
  const { user: authUser, can, refresh: refreshAuth } = useAuth();
  const { success, error: toastError } = useToast();

  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [userModal, setUserModal] = useState<null | { mode: 'create' | 'edit'; user?: User }>(null);
  const [passwordTarget, setPasswordTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [roleModal, setRoleModal] = useState<null | { mode: 'create' | 'edit'; role?: Role }>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);

  const usersQuery = useApiQuery<{ items: User[] }>('/users', undefined, []);
  const rolesQuery = useApiQuery<{ items: Role[] }>('/roles', undefined, []);
  const permsQuery = useApiQuery<{ permissions: PermissionDef[] }>('/settings/permissions', undefined, []);

  const users = usersQuery.data?.items || [];
  const roles = rolesQuery.data?.items || [];
  const permissions = permsQuery.data?.permissions || [];

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.name, u.username, u.email, u.role.name].some((v) => (v || '').toLowerCase().includes(q)));
  }, [users, search]);

  const activeUsers = users.filter((u) => u.isActive).length;
  const owners = users.filter((u) => u.role.slug === 'owner' && u.isActive).length;

  const reloadAll = () => {
    usersQuery.reload();
    rolesQuery.reload();
    refreshAuth();
  };

  const removeUser = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api(`/users/${deleteTarget.id}`, { method: 'DELETE' });
      success('تم حذف المستخدم', deleteTarget.name);
      setDeleteTarget(null);
      reloadAll();
    } catch (err) {
      toastError('تعذر حذف المستخدم', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const removeRole = async () => {
    if (!deleteRoleTarget) return;
    setBusy(true);
    try {
      await api(`/roles/${deleteRoleTarget.id}`, { method: 'DELETE' });
      success('تم حذف الدور', deleteRoleTarget.name);
      setDeleteRoleTarget(null);
      rolesQuery.reload();
      usersQuery.reload();
    } catch (err) {
      toastError('تعذر حذف الدور', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<><Users size={12} /> الفريق والصلاحيات</>}
        title="الفريق"
        description="أدر حسابات الفريق وأدوارهم بدقة — كل دور يحدد ما يمكن رؤيته وتعديله داخل الاستوديو."
        actions={(
          <>
            {tab === 'users' && can('users.manage') && (
              <Button variant="primary" onClick={() => setUserModal({ mode: 'create' })}><UserPlus size={15} /> مستخدم جديد</Button>
            )}
            {tab === 'roles' && can('roles.manage') && (
              <Button variant="primary" onClick={() => setRoleModal({ mode: 'create' })}><Plus size={15} /> دور جديد</Button>
            )}
          </>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="أعضاء الفريق" value={formatNumber(users.length)} hint={`${activeUsers} حساب نشط`} icon={Users} tone="primary" delay={0} />
        <StatCard label="المالكون النشطون" value={formatNumber(owners)} hint="صلاحيات كاملة" icon={Crown} tone="warning" delay={0.05} />
        <StatCard label="الأدوار" value={formatNumber(roles.length)} hint={`${roles.filter((r) => !r.isSystem).length} دور مخصص`} icon={Shield} tone="accent" delay={0.1} />
        <StatCard label="الصلاحيات المتاحة" value={formatNumber(permissions.length)} hint="عبر كل أقسام النظام" icon={Lock} tone="success" delay={0.15} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-0.5">
          {[
            { id: 'users' as const, label: 'المستخدمون', icon: Users, count: users.length },
            { id: 'roles' as const, label: 'الأدوار', icon: Shield, count: roles.length },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'relative flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12px] font-medium transition',
                tab === item.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-soft'
              )}
            >
              <item.icon size={13} />
              {item.label}
              <span className={cn('rounded-full px-1.5 py-0.5 text-[9px]', tab === item.id ? 'bg-primary-soft text-primary' : 'bg-surface-3')}>{item.count}</span>
            </button>
          ))}
        </div>
        {tab === 'users' && (
          <SearchInput value={search} onChange={setSearch} placeholder="ابحث بالاسم أو اسم المستخدم…" className="w-full sm:w-64" />
        )}
      </div>

      {tab === 'users' ? (
        <Panel padded={false}>
          {usersQuery.loading && !usersQuery.data ? (
            <TableSkeleton rows={4} cols={5} />
          ) : usersQuery.error ? (
            <ErrorPanel message={usersQuery.error} onRetry={usersQuery.reload} />
          ) : filteredUsers.length === 0 ? (
            <EmptyState icon={<Users size={25} />} title={search ? 'لا مستخدمين مطابقين' : 'لا مستخدمين'} description={search ? 'جرّب كلمة بحث أخرى.' : undefined} />
          ) : (
            <>
              <div className="hidden md:block">
                <DataTable minWidth={820}>
                  <thead>
                    <tr>
                      <Th>المستخدم</Th>
                      <Th>الدور</Th>
                      <Th>الحالة</Th>
                      <Th>آخر دخول</Th>
                      <Th>أُضيف في</Th>
                      <Th width={44}><span className="sr-only">إجراءات</span></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <Tr key={u.id}>
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={u.name} color={u.avatarColor} />
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
                                {u.name}
                                {u.id === authUser?.id && <span className="rounded bg-primary-soft px-1 py-0.5 text-[8.5px] text-primary">أنت</span>}
                              </p>
                              <p className="numeric text-[9.5px] text-muted" dir="ltr">@{u.username}{u.email ? ` · ${u.email}` : ''}</p>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <Badge tone={u.role.slug === 'owner' ? 'warning' : u.role.slug === 'manager' ? 'primary' : 'info'}>{u.role.name}</Badge>
                          <p className="mt-0.5 text-[9px] text-muted">{u.permissions.length} صلاحية</p>
                        </Td>
                        <Td><Badge tone={u.isActive ? 'success' : 'neutral'} dot>{u.isActive ? 'نشط' : 'موقوف'}</Badge></Td>
                        <Td>
                          <p className="text-[11px] text-soft">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'لم يدخل بعد'}</p>
                          <p className="text-[9px] text-muted">{u.lastLoginAt ? formatDate(u.lastLoginAt, true) : '—'}</p>
                        </Td>
                        <Td><span className="text-[10.5px] text-muted">{formatDate(u.createdAt)}</span></Td>
                        <Td>
                          <div className="flex items-center justify-end gap-1">
                            {can('users.manage') && (
                              <>
                                <Button size="icon" variant="ghost" onClick={() => setUserModal({ mode: 'edit', user: u })} title="تعديل"><Pencil size={13} /></Button>
                                <Button size="icon" variant="ghost" onClick={() => setPasswordTarget(u)} title="إعادة تعيين كلمة المرور"><KeyRound size={13} /></Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setDeleteTarget(u)}
                                  title="حذف"
                                  disabled={u.id === authUser?.id}
                                >
                                  <Trash2 size={13} className={u.id === authUser?.id ? 'opacity-30' : undefined} />
                                </Button>
                              </>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </DataTable>
              </div>

              <div className="space-y-2 p-3 md:hidden">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
                    <Avatar name={u.name} color={u.avatarColor} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-ink">{u.name}</p>
                      <p className="numeric truncate text-[9.5px] text-muted" dir="ltr">@{u.username}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge tone={u.isActive ? 'success' : 'neutral'}>{u.role.name}</Badge>
                        {!u.isActive && <Badge>موقوف</Badge>}
                      </div>
                    </div>
                    {can('users.manage') && (
                      <Button size="icon" variant="ghost" onClick={() => setUserModal({ mode: 'edit', user: u })}><Pencil size={14} /></Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rolesQuery.loading && !rolesQuery.data ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-surface-2" />)
          ) : roles.map((role, index) => (
            <motion.article
              key={role.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.25) }}
              className="card flex flex-col p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    role.slug === 'owner' ? 'bg-warning/10 text-warning' : role.slug === 'manager' ? 'bg-primary-soft text-primary' : 'bg-info/10 text-info'
                  )}>
                    {role.slug === 'owner' ? <Crown size={18} /> : role.slug === 'manager' ? <ShieldCheck size={18} /> : <Shield size={18} />}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{role.name}</p>
                    <p className="numeric text-[9.5px] text-muted" dir="ltr">{role.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {role.isSystem && <Badge tone="neutral">نظامي</Badge>}
                </div>
              </div>

              <p className="mt-2.5 line-clamp-2 min-h-[32px] text-[10.5px] leading-relaxed text-muted">{role.description || 'دور مخصص بدون وصف.'}</p>

              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <div className="rounded-lg bg-surface-2/70 px-2 py-1.5">
                  <p className="text-[9px] text-muted">الأعضاء</p>
                  <p className="numeric mt-0.5 text-[12px] font-semibold text-soft">{role.users}</p>
                </div>
                <div className="rounded-lg bg-surface-2/70 px-2 py-1.5">
                  <p className="text-[9px] text-muted">الصلاحيات</p>
                  <p className="numeric mt-0.5 text-[12px] font-semibold text-soft">{role.permissions.length}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-line/70 pt-2.5">
                <span className="text-[9.5px] text-muted">{role.slug === 'owner' ? 'تحكم كامل غير قابل للتعديل' : `${Math.round((role.permissions.length / Math.max(1, permissions.length)) * 100)}% من الصلاحيات`}</span>
                {can('roles.manage') && role.slug !== 'owner' && (
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setRoleModal({ mode: 'edit', role })} title="تعديل"><Pencil size={13} /></Button>
                    {!role.isSystem && (
                      <Button size="icon" variant="ghost" onClick={() => setDeleteRoleTarget(role)} title="حذف"><Trash2 size={13} /></Button>
                    )}
                  </div>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      )}

      {userModal && (
        <UserModal
          key={userModal.user?.id || 'new'}
          open
          mode={userModal.mode}
          user={userModal.user}
          roles={roles}
          onClose={() => setUserModal(null)}
          onSaved={() => { setUserModal(null); reloadAll(); }}
        />
      )}

      {passwordTarget && (
        <PasswordModal
          open
          user={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onSaved={() => { setPasswordTarget(null); usersQuery.reload(); }}
        />
      )}

      {roleModal && (
        <RoleModal
          key={roleModal.role?.id || 'new'}
          open
          mode={roleModal.mode}
          role={roleModal.role}
          permissions={permissions}
          onClose={() => setRoleModal(null)}
          onSaved={() => { setRoleModal(null); rolesQuery.reload(); usersQuery.reload(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={removeUser}
        loading={busy}
        title={`حذف ${deleteTarget?.name}؟`}
        description="سيُحذف حساب المستخدم نهائياً ولن يتمكن من الدخول. لا يمكن حذف حسابك الحالي أو آخر مالك نشط."
        confirmText="حذف المستخدم"
      />

      <ConfirmDialog
        open={!!deleteRoleTarget}
        onClose={() => setDeleteRoleTarget(null)}
        onConfirm={removeRole}
        loading={busy}
        title={`حذف دور ${deleteRoleTarget?.name}؟`}
        description="لا يمكن حذف دور مرتبط بمستخدمين. انقل المستخدمين إلى دور آخر أولاً."
        confirmText="حذف الدور"
      />
    </div>
  );
}

/* -------------------------------- User modal --------------------------- */
function UserModal({ open, mode, user, roles, onClose, onSaved }: {
  open: boolean;
  mode: 'create' | 'edit';
  user?: User;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState<UserForm>(EMPTY_USER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (user) {
      setForm({
        username: user.username,
        name: user.name,
        email: user.email || '',
        password: '',
        roleId: String(user.role.id),
        avatarColor: user.avatarColor,
        isActive: user.isActive,
      });
    } else {
      setForm({ ...EMPTY_USER, roleId: roles.find((r) => r.slug === 'support')?.id ? String(roles.find((r) => r.slug === 'support')!.id) : roles[0] ? String(roles[0].id) : '' });
    }
    setError(null);
  }, [open, user, roles]);

  const patch = (values: Partial<UserForm>) => setForm((prev) => ({ ...prev, ...values }));

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!form.name.trim()) { setError('اسم المستخدم مطلوب'); return; }
    if (mode === 'create' && (!form.username.trim() || form.username.trim().length < 3)) { setError('اسم الدخول يجب أن يكون ٣ أحرف على الأقل'); return; }
    if (mode === 'create' && form.password.length < 8) { setError('كلمة المرور يجب أن تكون ٨ أحرف على الأقل'); return; }
    if (!form.roleId) { setError('اختر دوراً'); return; }
    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        await api('/users', {
          method: 'POST',
          body: {
            username: form.username.trim().toLowerCase(),
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            roleId: Number(form.roleId),
            avatarColor: form.avatarColor,
            isActive: form.isActive,
          },
        });
        success('تمت إضافة المستخدم', form.name);
      } else if (user) {
        await api(`/users/${user.id}`, {
          method: 'PUT',
          body: {
            name: form.name.trim(),
            email: form.email.trim(),
            roleId: Number(form.roleId),
            avatarColor: form.avatarColor,
            isActive: form.isActive,
          },
        });
        success('تم تحديث المستخدم', form.name);
      }
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر حفظ المستخدم';
      setError(message);
      toastError('تعذر حفظ المستخدم', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'مستخدم جديد' : 'تعديل المستخدم'}
      description={mode === 'create' ? 'أضف عضواً للفريق وحدد دوره وصلاحياته.' : 'حدّث بيانات الحساب ودوره وحالته.'}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={() => submit()} loading={saving}>{mode === 'create' ? 'إضافة المستخدم' : 'حفظ التعديلات'}</Button>
        </>
      )}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الاسم الكامل" required>
            <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="مثال: سارة العتيبي" />
          </Field>
          <Field label="اسم الدخول" required={mode === 'create'} hint="حروف إنجليزية وأرقام فقط">
            <Input
              value={form.username}
              onChange={(e) => patch({ username: e.target.value.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase() })}
              placeholder="sara.otaibi"
              dir="ltr"
              disabled={mode === 'edit'}
            />
          </Field>
          <Field label="البريد الإلكتروني">
            <Input value={form.email} onChange={(e) => patch({ email: e.target.value })} placeholder="sara@company.com" dir="ltr" />
          </Field>
          <Field label="الدور" required>
            <select
              value={form.roleId}
              onChange={(e) => patch({ roleId: e.target.value })}
              aria-label="دور المستخدم"
              className="h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-[13px] text-ink focus:border-primary focus:outline-none"
            >
              <option value="">اختر الدور…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.permissions.length} صلاحية</option>)}
            </select>
          </Field>
          {mode === 'create' && (
            <Field label="كلمة المرور" required hint="٨ أحرف على الأقل">
              <Input type="password" value={form.password} onChange={(e) => patch({ password: e.target.value })} placeholder="••••••••" dir="ltr" />
            </Field>
          )}
          <Field label="لون الصورة الرمزية">
            <ColorPicker value={form.avatarColor} onChange={(avatarColor) => patch({ avatarColor })} />
          </Field>
        </div>

        <div className="rounded-xl border border-line bg-surface-2/40 px-3 py-2.5">
          <Switch checked={form.isActive} onChange={(isActive) => patch({ isActive })} label="الحساب نشط" hint="الحساب الموقوف لا يستطيع تسجيل الدخول" />
        </div>

        {mode === 'edit' && user?.role.slug === 'owner' && (
          <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/[0.07] px-3 py-2.5 text-[10.5px] text-warning">
            <Crown size={14} className="mt-0.5 shrink-0" />
            <p>هذا الحساب مالك. يجب أن يبقى مالك واحد نشط على الأقل في الاستوديو.</p>
          </div>
        )}

        {error && <div className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-[11.5px] text-danger">{error}</div>}
      </form>
    </Modal>
  );
}

/* ------------------------------ Password modal ------------------------- */
function PasswordModal({ open, user, onClose, onSaved }: {
  open: boolean; user: User; onClose: () => void; onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setConfirm('');
    setError(null);
  }, [open, user]);

  const submit = async () => {
    if (password.length < 8) { setError('كلمة المرور يجب أن تكون ٨ أحرف على الأقل'); return; }
    if (password !== confirm) { setError('كلمتا المرور غير متطابقتين'); return; }
    setSaving(true);
    setError(null);
    try {
      await api(`/users/${user.id}/password`, { method: 'POST', body: { password } });
      success('تم إعادة تعيين كلمة المرور', user.name);
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر إعادة التعيين';
      setError(message);
      toastError('تعذر إعادة التعيين', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="إعادة تعيين كلمة المرور"
      description={`المستخدم: ${user.name} (@${user.username})`}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={submit} loading={saving}><KeyRound size={14} /> تعيين</Button>
        </>
      )}
    >
      <div className="space-y-3">
        <Field label="كلمة المرور الجديدة" required hint="٨ أحرف على الأقل">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        </Field>
        <Field label="تأكيد كلمة المرور" required>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" />
        </Field>
        {error && <div className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-[11.5px] text-danger">{error}</div>}
      </div>
    </Modal>
  );
}

/* -------------------------------- Role modal --------------------------- */
function RoleModal({ open, mode, role, permissions, onClose, onSaved }: {
  open: boolean;
  mode: 'create' | 'edit';
  role?: Role;
  permissions: PermissionDef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState<RoleForm>(EMPTY_ROLE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (role) {
      setForm({ name: role.name, nameEn: role.nameEn || role.slug, description: role.description || '', permissions: role.permissions });
    } else {
      setForm(EMPTY_ROLE);
    }
    setError(null);
  }, [open, role]);

  const groups = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const p of permissions) {
      const list = map.get(p.group) || [];
      list.push(p);
      map.set(p.group, list);
    }
    return [...map.entries()];
  }, [permissions]);

  const toggle = (key: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const toggleGroup = (defs: PermissionDef[]) => {
    const allSelected = defs.every((d) => form.permissions.includes(d.key));
    setForm((prev) => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter((p) => !defs.some((d) => d.key === p))
        : [...new Set([...prev.permissions, ...defs.map((d) => d.key)])],
    }));
  };

  const submit = async () => {
    if (!form.name.trim()) { setError('اسم الدور مطلوب'); return; }
    if (mode === 'create' && !form.nameEn.trim()) { setError('المعرّف الإنجليزي مطلوب لإنشاء الدور'); return; }
    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        await api('/roles', {
          method: 'POST',
          body: { name: form.name.trim(), nameEn: form.nameEn.trim(), description: form.description.trim(), permissions: form.permissions },
        });
        success('تم إنشاء الدور', form.name);
      } else if (role) {
        await api(`/roles/${role.id}`, {
          method: 'PUT',
          body: { name: form.name.trim(), nameEn: form.nameEn.trim(), description: form.description.trim(), permissions: form.permissions },
        });
        success('تم تحديث الدور', form.name);
      }
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر حفظ الدور';
      setError(message);
      toastError('تعذر حفظ الدور', message);
    } finally {
      setSaving(false);
    }
  };

  const preset = (kind: 'all' | 'read' | 'none') => {
    if (kind === 'all') setForm((prev) => ({ ...prev, permissions: permissions.map((p) => p.key) }));
    else if (kind === 'read') setForm((prev) => ({ ...prev, permissions: permissions.filter((p) => p.key.endsWith('.view') || p.key === 'dashboard.view').map((p) => p.key) }));
    else setForm((prev) => ({ ...prev, permissions: [] }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={mode === 'create' ? 'دور جديد' : `تعديل دور ${role?.name || ''}`}
      description="اختر الصلاحيات التي يمكن لهذا الدور الوصول إليها. التغييرات تُطبَّق على كل أعضاء الدور."
      footer={(
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-muted">{form.permissions.length} من {permissions.length} صلاحية</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>إلغاء</Button>
            <Button variant="primary" onClick={submit} loading={saving}><ShieldCheck size={14} /> {mode === 'create' ? 'إنشاء الدور' : 'حفظ التعديلات'}</Button>
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم الدور" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: مسؤول مبيعات" />
          </Field>
          <Field label="المعرّف بالإنجليزية" required={mode === 'create'} hint="يُستخدم داخلياً — أحرف إنجليزية">
            <Input
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase() })}
              placeholder="sales"
              dir="ltr"
              disabled={mode === 'edit'}
            />
          </Field>
        </div>
        <Field label="الوصف">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="ماذا يستطيع هذا الدور أن يفعل؟" />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/40 px-3 py-2">
          <p className="text-[11px] font-medium text-soft">الصلاحيات</p>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" onClick={() => preset('all')}><Check size={12} /> الكل</Button>
            <Button size="sm" variant="ghost" onClick={() => preset('read')}><Lock size={12} /> قراءة فقط</Button>
            <Button size="sm" variant="ghost" onClick={() => preset('none')}><RotateCcw size={12} /> مسح</Button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {groups.map(([group, defs]) => {
            const allSelected = defs.every((d) => form.permissions.includes(d.key));
            const someSelected = defs.some((d) => form.permissions.includes(d.key));
            return (
              <div key={group} className="rounded-xl border border-line bg-surface p-2.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(defs)}
                  className="mb-1.5 flex w-full items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-start"
                >
                  <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-soft">
                    <span className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      allSelected ? 'border-primary bg-primary text-primary-ink' : someSelected ? 'border-primary/50 bg-primary-soft' : 'border-line-strong'
                    )}>
                      {allSelected ? <Check size={10} /> : someSelected ? <span className="h-1 w-1 rounded-full bg-primary" /> : null}
                    </span>
                    {group}
                  </span>
                  <span className="text-[9px] text-muted">{defs.filter((d) => form.permissions.includes(d.key)).length}/{defs.length}</span>
                </button>
                <div className="space-y-0.5">
                  {defs.map((def) => {
                    const checked = form.permissions.includes(def.key);
                    return (
                      <button
                        key={def.key}
                        type="button"
                        onClick={() => toggle(def.key)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-start text-[10px] transition',
                          checked ? 'text-ink' : 'text-muted hover:bg-surface-2 hover:text-soft'
                        )}
                      >
                        <span className={cn(
                          'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                          checked ? 'border-primary bg-primary text-primary-ink' : 'border-line-strong'
                        )}>
                          {checked && <Check size={9} />}
                        </span>
                        <span className="truncate">{def.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {permissions.length === 0 && (
          <div className="rounded-xl border border-dashed border-line py-6 text-center text-[11px] text-muted">تعذر تحميل كتالوج الصلاحيات.</div>
        )}

        {error && <div className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-[11.5px] text-danger">{error}</div>}
      </div>
    </Modal>
  );
}
