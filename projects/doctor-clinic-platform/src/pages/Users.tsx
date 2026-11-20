import React, { useMemo, useState } from "react";
import {
  Check,
  KeyRound,
  Lock,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { Avatar, Badge, Button, Card, Field, Modal, PageHead } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/types";
import type { Permission, Role, User } from "@/lib/types";
import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/permissions";
import { fmtDate, todayISO, uid } from "@/lib/utils";

const ROLES: Role[] = ["doctor", "manager", "receptionist", "nurse", "accountant"];

const ROLE_TONE: Record<Role, "primary" | "info" | "violet" | "warn" | "ok"> = {
  doctor: "primary",
  manager: "info",
  receptionist: "violet",
  nurse: "ok",
  accountant: "warn",
};

export default function Users() {
  const { db, save, toast, session, cloud } = useApp();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [editing, setEditing] = useState<User | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);

  const list = useMemo(
    () =>
      db.users.filter((u) => {
        if (roleFilter !== "all" && u.role !== roleFilter) return false;
        if (!q.trim()) return true;
        return u.name.includes(q) || u.email.includes(q) || u.phone.includes(q);
      }),
    [db.users, q, roleFilter]
  );

  const newUser = (): User => ({
    id: "",
    name: "",
    role: "receptionist",
    email: "",
    phone: "",
    active: true,
    extraPermissions: [],
    createdAt: todayISO(),
  });

  return (
    <>
      <PageHead
        title="المستخدمون والصلاحيات"
        sub="إدارة فريق العيادة وتحديد ما يمكن لكل دور الوصول إليه"
        actions={
          <>
            <Button onClick={() => setShowMatrix(true)}><Shield size={15} /> مصفوفة الصلاحيات</Button>
            <Button variant="primary" onClick={() => setEditing(newUser())}><UserPlus size={16} /> مستخدم جديد</Button>
          </>
        }
      />

      {cloud.enabled ? (
        <div className="alert alert-info mb-16">
          <ShieldCheck size={15} />
          <span>
            إضافة الأعضاء تُنشئ حساب دخول حقيقيًا بكلمة مرور مشفّرة. البريد لا يمكن تغييره بعد الإنشاء
            من الواجهة، ويمكن إيقاف الحساب فورًا من المفتاح بجانب اسمه.
          </span>
        </div>
      ) : null}

      <div className="grid grid-4 mb-16">
        {[
          { l: "إجمالي المستخدمين", v: db.users.length, c: "var(--primary)", b: "var(--primary-soft)", i: <UsersIcon size={18} /> },
          { l: "حسابات نشطة", v: db.users.filter((u) => u.active).length, c: "var(--ok)", b: "var(--ok-soft)", i: <ShieldCheck size={18} /> },
          { l: "الأطباء", v: db.users.filter((u) => u.role === "doctor").length, c: "var(--info)", b: "var(--info-soft)", i: <UserCog size={18} /> },
          { l: "أدوار مختلفة", v: new Set(db.users.map((u) => u.role)).size, c: "var(--violet)", b: "var(--violet-soft)", i: <KeyRound size={18} /> },
        ].map((s) => (
          <div className="stat" key={s.l} style={{ "--stat-tint": s.b, "--stat-color": s.c } as React.CSSProperties}>
            <div className="row gap-8">
              <div className="stat-ico" style={{ width: 33, height: 33, borderRadius: 9 }}>{s.i}</div>
              <div>
                <div className="stat-label" style={{ marginTop: 0 }}>{s.l}</div>
                <div className="stat-value num" style={{ fontSize: "1.28rem" }}>{s.v}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <div className="toolbar">
          <div className="searchbar" style={{ maxWidth: 300 }}>
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو البريد…" />
          </div>
          <select className="select" style={{ width: 160 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
            <option value="all">كل الأدوار</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <div className="spacer" />
          <span className="tiny muted">{list.length} مستخدم</span>
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>الدور</th>
                <th>التواصل</th>
                <th>الصلاحيات</th>
                <th>تاريخ الإضافة</th>
                <th>الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const perms = new Set([...(ROLE_PERMISSIONS[u.role] ?? []), ...u.extraPermissions]);
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-main">
                        <Avatar name={u.name} />
                        <div>
                          <div className="strong" style={{ fontSize: ".86rem" }}>
                            {u.name}
                            {u.id === session?.id ? <span className="tag" style={{ marginInlineStart: 6 }}>أنت</span> : null}
                          </div>
                          <div className="tiny muted">{u.specialty ?? "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge></td>
                    <td>
                      <div className="tiny" dir="ltr" style={{ textAlign: "right" }}>{u.email}</div>
                      <div className="tiny muted" dir="ltr" style={{ textAlign: "right" }}>{u.phone}</div>
                    </td>
                    <td>
                      <div className="row gap-4">
                        <Badge tone="line">{perms.size} صلاحية</Badge>
                        {u.extraPermissions.length ? <Badge tone="gold">+{u.extraPermissions.length}</Badge> : null}
                      </div>
                    </td>
                    <td className="tiny muted">{fmtDate(u.createdAt)}</td>
                    <td>
                      <button
                        className="switch"
                        onClick={() => {
                          if (cloud.enabled && u.id === session?.id && u.active) {
                            toast("لا يمكنك إيقاف حسابك الحالي. اطلب من مدير آخر ذلك.", "err");
                            return;
                          }
                          save("users", { ...u, active: !u.active });
                          toast(u.active ? "تم إيقاف الحساب" : "تم تفعيل الحساب", u.active ? "err" : "ok");
                        }}
                        style={{ gap: 6 }}
                      >
                        <span className="track" style={{ width: 34, height: 19, background: u.active ? "var(--ok)" : "var(--line-2)" }} />
                        <span className="tiny">{u.active ? "نشط" : "موقوف"}</span>
                      </button>
                    </td>
                    <td className="actions">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(u)}><Lock size={13} /> تعديل</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {editing ? <UserForm user={editing} onClose={() => setEditing(null)} /> : null}
      {showMatrix ? <MatrixModal onClose={() => setShowMatrix(false)} /> : null}
    </>
  );
}

/* -------------------------------------------------------------------- form */
function UserForm({ user, onClose }: { user: User; onClose: () => void }) {
  const { db, save, toast, session, cloud, cloudCreateUser } = useApp();
  const [form, setForm] = useState<User>(user);
  const [perms, setPerms] = useState<Permission[]>(user.extraPermissions ?? []);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof User>(k: K, v: User[K]) => setForm((f) => ({ ...f, [k]: v }));

  const toggle = (p: Permission) =>
    setPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const basePerms = new Set(ROLE_PERMISSIONS[form.role] ?? []);

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) return toast("الاسم والبريد مطلوبان", "err");
    if (!user.id && db.users.some((u) => u.email.toLowerCase() === form.email.toLowerCase()))
      return toast("هذا البريد مستخدم بالفعل", "err");

    if (cloud.enabled && !user.id) {
      if (password.length < 8) return toast("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "err");
      if (form.id === session?.id) return toast("لا يمكن تعديل حسابك من هنا", "err");
      setBusy(true);
      const res = await cloudCreateUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password,
        phone: form.phone,
        role: form.role,
        specialty: form.specialty,
        extraPermissions: perms,
        active: form.active,
      });
      setBusy(false);
      if (!res.ok) return toast(res.error ?? "تعذر إنشاء الحساب", "err");
      toast("تم إنشاء حساب الدخول وإضافته للفريق");
      onClose();
      return;
    }

    save("users", {
      ...form,
      id: form.id || uid("usr"),
      createdAt: form.createdAt || todayISO(),
      extraPermissions: perms,
    });
    toast(user.id ? "تم تحديث بيانات المستخدم" : "تمت إضافة المستخدم");
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={user.id ? "تعديل مستخدم" : "إضافة مستخدم جديد"}
      sub="حدد الدور والصلاحيات الإضافية بدقة"
      icon={<UserCog size={18} />}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>إلغاء</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? "جارٍ الإنشاء…" : user.id ? "حفظ" : "إضافة المستخدم"}
          </Button>
        </>
      }
    >
      <div className="grid grid-2 gap-12">
        <Field label="الاسم الكامل" required><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field
          label="البريد الإلكتروني"
          required
          hint={cloud.enabled ? (user.id ? "مرتبط بحساب الدخول ولا يمكن تغييره" : "سيُستخدم لتسجيل الدخول") : undefined}
        >
          <input
            className="input"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            disabled={cloud.enabled && Boolean(user.id)}
            dir="ltr"
            style={{ textAlign: "right" }}
          />
        </Field>
        {cloud.enabled && !user.id ? (
          <Field label="كلمة المرور المؤقتة" required hint="8 أحرف على الأقل — شاركها معه بشكل آمن">
            <input
              className="input"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              dir="ltr"
              style={{ textAlign: "right" }}
              placeholder="مثال: Tabib@2026"
            />
          </Field>
        ) : null}
        <Field label="رقم الهاتف"><input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} dir="ltr" style={{ textAlign: "right" }} /></Field>
        <Field label="الدور الوظيفي">
          <select className="select" value={form.role} onChange={(e) => set("role", e.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label="المسمى / التخصص"><input className="input" value={form.specialty ?? ""} onChange={(e) => set("specialty", e.target.value)} /></Field>
        <Field label="حالة الحساب">
          <select className="select" value={form.active ? "1" : "0"} onChange={(e) => set("active", e.target.value === "1")}>
            <option value="1">نشط</option>
            <option value="0">موقوف</option>
          </select>
        </Field>
      </div>

      <div className="divider" />
      <div className="row-between mb-8">
        <b className="small row gap-6"><Shield size={15} /> الصلاحيات الإضافية</b>
        <span className="tiny muted">صلاحيات الدور الأساسية مؤكدة تلقائيًا</span>
      </div>

      <div className="grid grid-2" style={{ gap: 4 }}>
        {ALL_PERMISSIONS.map((p) => {
          const inherited = basePerms.has(p.key);
          const extra = perms.includes(p.key);
          return (
            <label key={p.key} className="checkline" style={{ opacity: inherited ? 0.62 : 1 }}>
              <input type="checkbox" checked={inherited || extra} disabled={inherited} onChange={() => toggle(p.key)} />
              <span className="grow small">{p.label}</span>
              {inherited ? <Badge tone="line">أساسية</Badge> : extra ? <Badge tone="gold">مضافة</Badge> : null}
            </label>
          );
        })}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ matrix */
function MatrixModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="مصفوفة الصلاحيات"
      sub="ما يستطيع كل دور فعله داخل المنصة"
      icon={<ShieldCheck size={18} />}
      size="xl"
      footer={<Button onClick={onClose}>إغلاق</Button>}
    >
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>الصلاحية</th>
              {ROLES.map((r) => <th key={r} style={{ textAlign: "center" }}>{ROLE_LABEL[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {ALL_PERMISSIONS.map((p) => (
              <tr key={p.key}>
                <td>
                  <div className="small strong">{p.label}</div>
                  <div className="tiny muted">{p.group}</div>
                </td>
                {ROLES.map((r) => (
                  <td key={r} style={{ textAlign: "center" }}>
                    {ROLE_PERMISSIONS[r].includes(p.key) ? (
                      <Check size={15} style={{ color: "var(--ok)" }} />
                    ) : (
                      <X size={14} style={{ color: "var(--line-2)" }} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
