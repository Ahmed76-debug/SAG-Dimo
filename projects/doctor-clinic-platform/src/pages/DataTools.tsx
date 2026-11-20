import { useEffect, useMemo, useRef, useState } from "react";
import {
  Database,
  DatabaseBackup,
  Download,
  FileJson,
  FolderOpen,
  Lock,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import {
  PageHead,
  Card,
  CardHead,
  Button,
  Badge,
  ConfirmDialog,
} from "@/components/ui";
import type { AuditEntry, DB } from "@/lib/types";
import { downloadSqliteFile, flushSqlSync, sqlStats, sqliteReady } from "@/lib/sqlMirror";
import { cloudEnabled } from "@/lib/cloud";
import { api, apiErrorMessage } from "@/lib/api";
import {
  backupFileName,
  parseBackupText,
  pickBackupFile,
  pickBackupFromFolder,
  saveBackupFile,
} from "@/lib/backup";

type CollectionKey =
  | "patients"
  | "appointments"
  | "bookings"
  | "visits"
  | "prescriptions"
  | "invoices"
  | "archive"
  | "reminders";

const COLLECTIONS: { key: CollectionKey; label: string }[] = [
  { key: "patients", label: "المرضى" },
  { key: "appointments", label: "المواعيد" },
  { key: "bookings", label: "طلبات الحجز" },
  { key: "visits", label: "الزيارات" },
  { key: "prescriptions", label: "الوصفات الطبية" },
  { key: "invoices", label: "الفواتير" },
  { key: "archive", label: "الأرشيف الطبي" },
  { key: "reminders", label: "التذكيرات" },
];

const PROTECTED: { key: keyof DB; label: string }[] = [
  { key: "users", label: "المستخدمون" },
  { key: "settings", label: "الإعدادات" },
  { key: "profile", label: "الملف التعريفي للطبيب" },
  { key: "audit", label: "سجل النشاط" },
];

/** الجداول التابعة التي يجب تفريغها أولًا للحفاظ على سلامة العلاقات. */
const DEPENDENTS: Partial<Record<CollectionKey, CollectionKey[]>> = {
  patients: ["appointments", "visits", "prescriptions", "invoices", "archive"],
  appointments: ["invoices"],
  visits: ["prescriptions"],
};

const LABELS: Record<string, string> = Object.fromEntries(
  [...COLLECTIONS, ...PROTECTED].map((c) => [c.key, c.label])
);

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function expandSelection(keys: Iterable<CollectionKey>): CollectionKey[] {
  const out = new Set<CollectionKey>(keys);
  let grew = true;
  while (grew) {
    grew = false;
    for (const key of [...out]) {
      for (const child of DEPENDENTS[key] ?? []) {
        if (!out.has(child)) {
          out.add(child);
          grew = true;
        }
      }
    }
  }
  return [...out];
}

type ServerBackupPreview = {
  kind: "server";
  fileName: string;
  payload: { tables: Record<string, unknown[]> };
  counts: Record<string, number>;
  createdAt?: string;
};

type LegacyBackupPreview = {
  kind: "legacy";
  fileName: string;
  db: DB;
  counts: Record<string, number>;
  createdAt?: string;
};

type RestorePreview = ServerBackupPreview | LegacyBackupPreview;

/** يقرأ نسخة الخادم الخام (tables) قبل الرجوع إلى صيغة النسخ القديمة. */
function parseServerBackup(text: string): { ok: true; preview: ServerBackupPreview } | { ok: false; error: string } {
  let root: unknown;
  try {
    root = JSON.parse(text.replace(/^\uFEFF/, "").trim());
  } catch {
    return { ok: false, error: "الملف ليس ملف JSON صالحًا." };
  }
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    return { ok: false, error: "بنية النسخة الاحتياطية غير صحيحة." };
  }
  const record = root as Record<string, unknown>;
  if (record.app !== undefined && record.app !== "tabib-clinic") {
    return { ok: false, error: "هذا الملف لا يخص منصة طبيب." };
  }
  const tables = record.tables;
  if (!tables || typeof tables !== "object" || Array.isArray(tables)) {
    return { ok: false, error: "النسخة الاحتياطية لا تحتوي على جداول صالحة." };
  }
  const tableRecord = tables as Record<string, unknown>;
  if (!Array.isArray(tableRecord.users) || !Array.isArray(tableRecord.patients)) {
    return { ok: false, error: "النسخة الاحتياطية لا تحتوي على بيانات العيادة." };
  }
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(tableRecord)) {
    counts[key] = Array.isArray(value) ? value.length : 0;
  }
  return {
    ok: true,
    preview: {
      kind: "server",
      fileName: "",
      payload: { tables: tableRecord as Record<string, unknown[]> },
      counts,
      createdAt: typeof record.createdAt === "string" ? record.createdAt : undefined,
    },
  };
}

function restoreSummary(preview: RestorePreview): string {
  const labels: Record<string, string> = {
    patients: "المرضى",
    appointments: "المواعيد",
    bookings: "طلبات الحجز",
    visits: "الزيارات",
    prescriptions: "الوصفات",
    invoices: "الفواتير",
    archive: "الأرشيف",
    users: "المستخدمون",
    reminders: "التذكيرات",
    audit: "سجل النشاط",
    settings: "الإعدادات",
    profile: "الملف التعريفي",
  };
  return Object.entries(preview.counts)
    .filter(([key]) => key in labels)
    .map(([key, count]) => `${labels[key]}: ${count.toLocaleString("ar-EG")}`)
    .join(" · ");
}

export default function DataTools() {
  const { db, setDb, session, hasPerm, toast, restoreBackup } = useApp();
  const [selected, setSelected] = useState<Set<CollectionKey>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const canUse = hasPerm("settings.edit");
  const effective = useMemo(() => expandSelection(selected), [selected]);
  const extra = effective.filter((k) => !selected.has(k));
  const [sqlInfo, setSqlInfo] = useState(() => sqlStats());
  useEffect(() => {
    let cancelled = false;
    void flushSqlSync(db).then(() => {
      if (!cancelled) setSqlInfo(sqlStats());
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  const toggle = (key: CollectionKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(COLLECTIONS.map((c) => c.key)));
  const clearSelection = () => setSelected(new Set());

  const acceptRestoreText = (text: string, fileName: string) => {
    const server = parseServerBackup(text);
    if (server.ok) {
      setRestorePreview({ ...server.preview, fileName });
      setRestoreConfirmOpen(true);
      return;
    }
    const legacy = parseBackupText(text);
    if (legacy.ok) {
      setRestorePreview({
        kind: "legacy",
        fileName,
        db: legacy.backup.db,
        counts: legacy.backup.counts as unknown as Record<string, number>,
        createdAt: legacy.backup.createdAt ?? undefined,
      });
      setRestoreConfirmOpen(true);
      return;
    }
    toast(legacy.error || server.error, "err");
  };

  const loadRestoreFile = async (file: File) => {
    if (file.size > 30 * 1024 * 1024) {
      toast("حجم النسخة الاحتياطية أكبر من 30 ميجابايت.", "err");
      return;
    }
    try {
      acceptRestoreText(await file.text(), file.name);
    } catch {
      toast("تعذر قراءة ملف النسخة الاحتياطية.", "err");
    }
  };

  const doBackup = async () => {
    if (!canUse || backupBusy) return;
    setBackupBusy(true);
    try {
      const data = await api<{ createdAt?: string; tables?: Record<string, unknown[]> }>("/backup");
      if (!data?.tables) throw new Error("تعذر إنشاء النسخة الاحتياطية من الخادم.");
      const content = JSON.stringify(
        {
          app: "tabib-clinic",
          version: 2,
          createdAt: data.createdAt ?? new Date().toISOString(),
          tables: data.tables,
        },
        null,
        2
      );
      const result = await saveBackupFile(content, backupFileName());
      if (result.status === "saved") {
        toast(`تم حفظ النسخة الاحتياطية في ${result.location || result.fileName}`);
      } else if (result.status === "downloaded") {
        toast(`تم تنزيل النسخة الاحتياطية: ${result.fileName}`);
      } else if (result.status === "error") {
        toast(result.error, "err");
      } else {
        toast("تم إلغاء إنشاء النسخة الاحتياطية.");
      }
    } catch (error) {
      toast(apiErrorMessage(error), "err");
    } finally {
      setBackupBusy(false);
    }
  };

  const chooseRestoreFile = async () => {
    const picked = await pickBackupFile();
    if (picked.status === "opened") {
      await loadRestoreFile(picked.file);
      return;
    }
    if (picked.status === "unsupported") {
      fileInputRef.current?.click();
      return;
    }
    if (picked.status === "error") toast(picked.error, "err");
  };

  const chooseRestoreFolder = async () => {
    const picked = await pickBackupFromFolder();
    if (picked.status === "opened") {
      await loadRestoreFile(picked.file);
      return;
    }
    if (picked.status === "empty") {
      toast(`لا توجد ملفات JSON في المجلد «${picked.folderName}».`, "err");
      return;
    }
    if (picked.status === "unsupported") {
      folderInputRef.current?.click();
      return;
    }
    if (picked.status === "error") toast(picked.error, "err");
  };

  const doRestore = async () => {
    if (!restorePreview || backupBusy) return;
    setRestoreConfirmOpen(false);
    setBackupBusy(true);
    try {
      if (restorePreview.kind === "server") {
        await api("/restore", { method: "POST", body: restorePreview.payload });
      } else {
        const result = await restoreBackup(restorePreview.db);
        if (!result.ok) throw new Error(result.error || "تعذرت استعادة النسخة الاحتياطية.");
      }
      setRestorePreview(null);
      toast("تمت استعادة النسخة الاحتياطية بنجاح. سيتم تحديث الصفحة.");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      toast(apiErrorMessage(error), "err");
    } finally {
      setBackupBusy(false);
    }
  };

  const doTruncate = () => {
    if (!canUse || effective.length === 0) return;
    const keys = effective;
    const entry: AuditEntry = {
      id: uid(),
      at: new Date().toISOString(),
      userId: session?.id,
      userName: session?.name,
      action: "truncate",
      entity: "data-tools",
      entityId: "truncate",
      label: `تفريغ: ${keys.map((k) => LABELS[k] || k).join("، ")}`,
    };
    setDb((prev) => {
      const next: Record<string, unknown> = { ...prev };
      for (const key of keys) next[key] = [];
      next.audit = [entry, ...(prev.audit ?? [])].slice(0, 1000);
      return next as unknown as DB;
    });
    setConfirmOpen(false);
    setSelected(new Set());
    toast(`تم تفريغ ${keys.length} جدولًا بنجاح`);
  };

  return (
    <>
      <PageHead
        eyebrow="الإدارة المتقدمة"
        title="أدوات البيانات والنسخ الاحتياطي"
        sub="نسخ واستعادة كاملة لقاعدة العيادة، مع تفريغ الجداول المحددة وحماية الحسابات والإعدادات وسجل النشاط."
        actions={
          <Badge tone="warn">
            <ShieldAlert size={13} /> للمدير فقط
          </Badge>
        }
      />

      {!canUse ? (
        <Card>
          <div className="empty">
            <div className="empty-ico"><Lock size={26} /></div>
            <h4>لا تملك صلاحية الوصول</h4>
            <p>هذه الصفحة متاحة لمدير النظام فقط.</p>
          </div>
        </Card>
      ) : (
        <>
          {cloudEnabled ? (
            <Card>
              <CardHead
                title="قاعدة SQL السحابية (Supabase)"
                sub="في الوضع السحابي تُحفظ بيانات العيادة في PostgreSQL عبر Supabase، مع تفعيل RLS وسجل تدقيق تلقائي."
                icon={<Database size={17} />}
                action={<Badge tone="info">سحابي</Badge>}
              />
              <div
                className="row"
                style={{ justifyContent: "space-between", alignItems: "center", padding: "14px 18px", gap: 12 }}
              >
                <div className="tiny muted">PostgreSQL · Supabase · RLS · audit triggers</div>
                <Badge tone="ok">متصل</Badge>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHead
                title="قاعدة SQLite المحلية"
                sub="تُحفظ بيانات العيادة في قاعدة SQLite حقيقية داخل الجهاز، مع جداول وأعمدة مطابقة للنموذج."
                icon={<Database size={17} />}
                action={
                  <Badge tone={sqliteReady() ? "ok" : "line"}>
                    {sqliteReady() ? "متصل" : "غير مهيأ"}
                  </Badge>
                }
              />
              <div
                className="row"
                style={{ justifyContent: "space-between", alignItems: "center", padding: "14px 18px", gap: 12 }}
              >
                <div className="tiny muted">
                  {sqlInfo.tables.length} جدول · {sqlInfo.totalRows.toLocaleString("ar-EG")} صف ·{" "}
                  {sqlInfo.tables.reduce((sum, table) => sum + table.columns, 0)} عمود
                </div>
                <Button
                  size="sm"
                  onClick={() => downloadSqliteFile("tabib.sqlite")}
                  disabled={!sqliteReady()}
                >
                  <Download size={15} /> تنزيل SQLite
                </Button>
              </div>
            </Card>
          )}

          <Card>
            <CardHead
              title="النسخ الاحتياطي والاستعادة"
              sub="نسخة كاملة من قاعدة العيادة تشمل المرضى والمواعيد والفواتير والمستخدمين وكلمات المرور. الاستعادة تستبدل البيانات الحالية بالكامل وبشكل ذري."
              icon={<DatabaseBackup size={17} />}
              action={<Badge tone="ok">JSON</Badge>}
            />
            <div style={{ padding: "14px 18px", display: "grid", gap: 12 }}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Button variant="primary" size="sm" onClick={() => void doBackup()} disabled={backupBusy}>
                  <FolderOpen size={15} /> نسخ احتياطي إلى مجلد
                </Button>
                <Button size="sm" onClick={() => void chooseRestoreFolder()} disabled={backupBusy}>
                  <Upload size={15} /> استعادة من مجلد
                </Button>
                <Button size="sm" onClick={() => void chooseRestoreFile()} disabled={backupBusy}>
                  <FileJson size={15} /> استعادة من ملف
                </Button>
              </div>
              <p className="tiny muted" style={{ margin: 0, lineHeight: 1.8 }}>
                يُحفظ الملف بصيغة JSON داخل المجلد الذي تختاره، ويحتوي على جميع الجداول والحسابات. عند الاستعادة
                تُستبدل البيانات الحالية بالكامل، لذا احتفظ بنسخة قبل المتابعة.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void loadRestoreFile(file);
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              hidden
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? []).filter((file) =>
                  /\.json$/i.test(file.name)
                );
                event.currentTarget.value = "";
                if (!files.length) {
                  toast("لم يتم العثور على ملفات JSON في المجلد المحدد.", "err");
                  return;
                }
                files.sort((a, b) => b.lastModified - a.lastModified);
                void loadRestoreFile(files[0]);
              }}
            />
          </Card>

          <Card>
            <CardHead
              title="الجداول القابلة للتفريغ"
              sub="حدد الجداول التي تريد إفراغها. سيتم تفريغ الجداول التابعة تلقائيًا عند الحاجة."
              icon={<Database size={17} />}
              action={
                <div className="row gap-2">
                  <Button size="sm" onClick={selectAll}>تحديد الكل</Button>
                  <Button size="sm" onClick={clearSelection} disabled={selected.size === 0}>إلغاء التحديد</Button>
                </div>
              }
            />
            <div className="table-wrap" style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }} />
                    <th>الجدول</th>
                    <th>عدد السجلات</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {COLLECTIONS.map((c) => {
                    const rows = (db[c.key] as unknown[] | undefined)?.length ?? 0;
                    const checked = selected.has(c.key);
                    const auto = !checked && effective.includes(c.key);
                    return (
                      <tr key={c.key}>
                        <td>
                          <input
                            type="checkbox"
                            checked={checked || auto}
                            disabled={auto}
                            onChange={() => toggle(c.key)}
                            aria-label={c.label}
                          />
                        </td>
                        <td>{c.label}</td>
                        <td className="tiny muted">{rows.toLocaleString("ar-EG")}</td>
                        <td>
                          {auto ? (
                            <Badge tone="warn">مشمول تلقائيًا</Badge>
                          ) : checked ? (
                            <Badge tone="danger">سيتم تفريغه</Badge>
                          ) : (
                            <Badge tone="line">آمن</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {PROTECTED.map((c) => {
                    const value = db[c.key] as unknown;
                    const rows = Array.isArray(value) ? value.length : 1;
                    return (
                      <tr key={String(c.key)} style={{ opacity: 0.72 }}>
                        <td>
                          <input type="checkbox" disabled aria-label={c.label} />
                        </td>
                        <td>
                          <span className="row gap-2" style={{ alignItems: "center" }}>
                            <Lock size={13} /> {c.label}
                          </span>
                        </td>
                        <td className="tiny muted">{rows.toLocaleString("ar-EG")}</td>
                        <td><Badge tone="info">محمي</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
            <div className="tiny muted">
              {selected.size === 0
                ? "لم يتم تحديد أي جدول."
                : `المحدد: ${selected.size} — الإجمالي بعد الجداول التابعة: ${effective.length}`}
              {extra.length > 0 ? ` (يشمل تلقائيًا: ${extra.map((k) => LABELS[k] || k).join("، ")})` : ""}
            </div>
            <Button
              variant="danger"
              disabled={selected.size === 0}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 size={15} /> تفريغ الجداول المحددة
            </Button>
          </div>

          <ConfirmDialog
            open={confirmOpen}
            title="تأكيد تفريغ الجداول"
            message={
              <>
                سيتم حذف كل السجلات من: <b>{effective.map((k) => LABELS[k] || k).join("، ")}</b>.
                <br />
                لا يمكن التراجع عن هذه العملية إلا من نسخة احتياطية. الحسابات والإعدادات وسجل النشاط محمية.
              </>
            }
            confirmLabel="تفريغ نهائي"
            danger
            onConfirm={doTruncate}
            onCancel={() => setConfirmOpen(false)}
          />

          <ConfirmDialog
            open={restoreConfirmOpen}
            title="تأكيد استعادة النسخة الاحتياطية"
            message={
              restorePreview ? (
                <>
                  سيتم استبدال جميع بيانات العيادة الحالية ببيانات النسخة:
                  <br />
                  <b>{restorePreview.fileName}</b>
                  <br />
                  {restorePreview.createdAt ? (
                    <>
                      تاريخ النسخة: {new Date(restorePreview.createdAt).toLocaleString("ar-EG")}
                      <br />
                    </>
                  ) : null}
                  <span className="tiny muted">{restoreSummary(restorePreview)}</span>
                  <br />
                  لا يمكن التراجع عن هذه العملية. تأكد من وجود نسخة احتياطية حديثة قبل المتابعة.
                </>
              ) : null
            }
            confirmLabel="استعادة واستبدال البيانات"
            danger
            onConfirm={() => void doRestore()}
            onCancel={() => {
              setRestoreConfirmOpen(false);
              setRestorePreview(null);
            }}
          />
        </>
      )}
    </>
  );
}
