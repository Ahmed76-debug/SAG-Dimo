import { useEffect, useMemo, useState } from "react";
import {
  History,
  RotateCcw,
  Trash2,
  ShieldCheck,
  ListFilter,
  RefreshCw,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import {
  PageHead,
  Card,
  CardHead,
  Button,
  Badge,
  SearchInput,
  EmptyState,
  ConfirmDialog,
} from "@/components/ui";
import type { AuditAction, AuditEntry, DB } from "@/lib/types";
import { cloudEnabled, getSupabase } from "@/lib/cloud";

const ENTITY_LABELS: Record<string, string> = {
  patients: "المرضى",
  appointments: "المواعيد",
  bookings: "طلبات الحجز",
  visits: "الزيارات",
  prescriptions: "الوصفات الطبية",
  invoices: "الفواتير",
  archive: "الأرشيف",
  users: "المستخدمون",
  reminders: "التذكيرات",
  settings: "الإعدادات",
  backup: "النسخ الاحتياطي",
  profile: "الملف الشخصي",
};

const ACTION_LABELS: Record<AuditAction, string> = {
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
  restore: "استعادة",
  truncate: "تفريغ",
};

const ACTION_TONES: Record<AuditAction, "ok" | "info" | "danger" | "warn"> = {
  create: "ok",
  update: "info",
  delete: "danger",
  restore: "warn",
  truncate: "danger",
};

const RESTORABLE = [
  "patients",
  "appointments",
  "bookings",
  "visits",
  "prescriptions",
  "invoices",
  "archive",
  "users",
  "reminders",
] as const;

type RestorableKey = (typeof RESTORABLE)[number];

function isRestorableKey(key: string): key is RestorableKey {
  return (RESTORABLE as readonly string[]).includes(key);
}

type AuditRow = AuditEntry & { cloud?: boolean };

interface CloudAuditRow {
  id: number | string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
}

function mapCloudAction(action: string): AuditAction {
  switch (action) {
    case "insert":
      return "create";
    case "delete":
      return "delete";
    case "restore":
      return "restore";
    case "truncate":
      return "truncate";
    default:
      return "update";
  }
}

function mapCloudEntity(table: string): string {
  if (table === "profiles") return "users";
  if (table === "doctor_profile") return "profile";
  return table;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export default function Audit() {
  const { db, setDb, session, hasPerm, toast } = useApp();
  const [q, setQ] = useState("");
  const [action, setAction] = useState<"all" | AuditAction>("all");
  const [entity, setEntity] = useState("all");
  const [clearOpen, setClearOpen] = useState(false);
  const [cloudEntries, setCloudEntries] = useState<AuditRow[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const sessionId = session?.id;

  useEffect(() => {
    if (!cloudEnabled || !sessionId) {
      setCloudEntries([]);
      setCloudError(null);
      setCloudLoading(false);
      return;
    }
    let cancelled = false;
    setCloudLoading(true);
    setCloudError(null);
    void (async () => {
      try {
        const supabase = await getSupabase();
        const [auditRes, profilesRes] = await Promise.all([
          supabase
            .from("audit_log")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(500),
          supabase.from("profiles").select("id,name"),
        ]);
        if (auditRes.error) throw auditRes.error;
        const names = new Map<string, string>();
        for (const profile of (profilesRes.data ?? []) as Array<{ id?: string; name?: string }>) {
          if (profile.id) names.set(profile.id, profile.name || "");
        }
        const mapped: AuditRow[] = ((auditRes.data ?? []) as CloudAuditRow[]).map((row) => {
          const cloudAction = mapCloudAction(row.action);
          const entityKey = mapCloudEntity(row.table_name);
          return {
            id: `cloud-${row.id}`,
            at: row.created_at,
            userId: row.user_id ?? undefined,
            userName: row.user_id ? names.get(row.user_id) || "مستخدم سحابي" : "النظام",
            action: cloudAction,
            entity: entityKey,
            entityId: row.record_id ?? "",
            label: `${ACTION_LABELS[cloudAction]} ${ENTITY_LABELS[entityKey] || entityKey}`,
            before: row.before,
            after: row.after,
            cloud: true,
          };
        });
        if (!cancelled) setCloudEntries(mapped);
      } catch (err) {
        if (!cancelled) {
          setCloudError(err instanceof Error ? err.message : "تعذّر تحميل سجل السحابة");
        }
      } finally {
        if (!cancelled) setCloudLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, reloadKey]);

  const localEntries = db.audit ?? [];
  const entries: AuditRow[] = cloudEnabled ? cloudEntries : localEntries;

  const entities = useMemo(() => {
    const set = new Set(entries.map((e) => e.entity));
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (action !== "all" && e.action !== action) return false;
      if (entity !== "all" && e.entity !== entity) return false;
      if (!term) return true;
      return [e.userName, e.label, e.entityId, ENTITY_LABELS[e.entity] || e.entity, ACTION_LABELS[e.action]]
        .some((x) => String(x || "").toLowerCase().includes(term));
    });
  }, [entries, q, action, entity]);

  const canRestore = hasPerm("settings.edit");

  const restore = (entry: AuditEntry) => {
    const item = entry.before as { id?: string } | undefined;
    if (!item || typeof item.id !== "string") {
      toast("لا توجد بيانات كافية لاستعادة هذا العنصر", "err");
      return;
    }
    if (!isRestorableKey(entry.entity)) {
      toast("هذا النوع من السجلات لا يدعم الاستعادة المباشرة", "info");
      return;
    }
    const key = entry.entity;
    const itemId = item.id;
    const list = db[key] as Array<{ id: string }>;
    if (list.some((x) => x.id === itemId)) {
      toast("العنصر موجود بالفعل في قاعدة البيانات", "info");
      return;
    }
    const restoreEntry: AuditEntry = {
      id: uid(),
      at: new Date().toISOString(),
      userId: session?.id,
      userName: session?.name,
      action: "restore",
      entity: entry.entity,
      entityId: entry.entityId,
      label: entry.label,
    };
    setDb((prev) => {
      const next: Record<string, unknown> = { ...prev };
      const bundle = entry.bundle as Record<string, unknown> | undefined;
      if (bundle && typeof bundle === "object") {
        for (const [bkey, rows] of Object.entries(bundle)) {
          if (!Array.isArray(rows) || !isRestorableKey(bkey)) continue;
          const target = (next[bkey] as Array<{ id: string }>) ?? [];
          const ids = new Set(
            rows.map((r) => (r as { id?: string } | null)?.id).filter(Boolean)
          );
          next[bkey] = [...rows, ...target.filter((x) => !ids.has(x.id))];
        }
      }
      const prevList = (next[key] as Array<{ id: string }>) ?? [];
      next[key] = [item, ...prevList.filter((x) => x.id !== itemId)];
      next.audit = [restoreEntry, ...(prev.audit ?? [])].slice(0, 1000);
      return next as unknown as DB;
    });
    toast(`تمت استعادة «${entry.label || entry.entityId}»`);
  };

  const clearLog = () => {
    setDb((prev) => ({ ...prev, audit: [] }));
    setClearOpen(false);
    toast("تم مسح سجل النشاط");
  };

  return (
    <>
      <PageHead
        eyebrow="الحوكمة والامتثال"
        title="سجل النشاط"
        sub="من أنشأ أو عدّل أو حذف أو استعاد البيانات، مع إمكانية استعادة المحذوف."
        actions={
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            <Badge tone="info">
              <ShieldCheck size={13} /> {entries.length} حركة
            </Badge>
            {cloudEnabled ? (
              <>
                {cloudError ? (
                  <span
                    title={cloudError}
                    style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    <Badge tone="danger">{cloudError}</Badge>
                  </span>
                ) : null}
                <Button
                  variant="soft"
                  onClick={() => setReloadKey((key) => key + 1)}
                  disabled={cloudLoading}
                >
                  <RefreshCw size={15} /> {cloudLoading ? "جارٍ التحديث…" : "تحديث"}
                </Button>
              </>
            ) : canRestore && entries.length > 0 ? (
              <Button variant="danger" onClick={() => setClearOpen(true)}>
                <Trash2 size={15} /> مسح السجل
              </Button>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHead
          title="الحركات المسجلة"
          sub={
            cloudEnabled
              ? "يُقرأ مباشرة من جدول audit_log في Supabase (آخر 500 حركة)."
              : "يُحفظ آخر 1000 حركة محليًا على هذا الجهاز."
          }
          icon={<History size={17} />}
          action={<ListFilter size={16} className="muted" />}
        />
        <div className="row gap-2" style={{ flexWrap: "wrap", marginBottom: 12 }}>
          <SearchInput value={q} onChange={setQ} placeholder="بحث بالاسم أو العنصر…" />
          <select className="input" style={{ maxWidth: 180 }} value={action} onChange={(e) => setAction(e.target.value as typeof action)}>
            <option value="all">كل العمليات</option>
            <option value="create">إضافة</option>
            <option value="update">تعديل</option>
            <option value="delete">حذف</option>
            <option value="restore">استعادة</option>
            <option value="truncate">تفريغ</option>
          </select>
          <select className="input" style={{ maxWidth: 200 }} value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="all">كل الأقسام</option>
            {entities.map((k) => (
              <option key={k} value={k}>{ENTITY_LABELS[k] || k}</option>
            ))}
          </select>
        </div>

        {cloudLoading && filtered.length === 0 ? (
          <EmptyState
            icon={<RefreshCw size={26} className="spin" />}
            title="جارٍ تحميل سجل السحابة…"
            desc="يتم جلب آخر الحركات من Supabase."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<History size={26} />}
            title="لا توجد حركات مطابقة"
            desc="ستظهر هنا كل عمليات الإضافة والتعديل والحذف والاستعادة التي يقوم بها المستخدمون."
          />
        ) : (
          <div className="table-wrap" style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المستخدم</th>
                  <th>العملية</th>
                  <th>القسم</th>
                  <th>العنصر</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const restorable =
                    !e.cloud &&
                    canRestore &&
                    e.action === "delete" &&
                    isRestorableKey(e.entity) &&
                    !!(e.before as { id?: string })?.id;
                  return (
                    <tr key={e.id}>
                      <td className="tiny muted" style={{ whiteSpace: "nowrap" }}>
                        {new Date(e.at).toLocaleString("ar-EG")}
                      </td>
                      <td>{e.userName || "—"}</td>
                      <td>
                        <Badge tone={ACTION_TONES[e.action]}>{ACTION_LABELS[e.action]}</Badge>
                      </td>
                      <td>{ENTITY_LABELS[e.entity] || e.entity}</td>
                      <td className="truncate" style={{ maxWidth: 260 }} title={e.label || e.entityId}>
                        {e.label || e.entityId}
                      </td>
                      <td>
                        {restorable ? (
                          <Button size="sm" variant="soft" onClick={() => restore(e)}>
                            <RotateCcw size={14} /> استعادة
                          </Button>
                        ) : e.cloud ? (
                          <Badge tone="line">سحابي</Badge>
                        ) : (
                          <span className="tiny muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={clearOpen}
        title="مسح سجل النشاط"
        message="سيتم حذف كل الحركات المسجلة محليًا. لا يمكن التراجع عن هذه العملية."
        confirmLabel="مسح الكل"
        danger
        onConfirm={clearLog}
        onCancel={() => setClearOpen(false)}
      />
    </>
  );
}
