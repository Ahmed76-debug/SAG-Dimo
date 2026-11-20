import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Database,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Lock,
  CheckSquare,
  Square,
  ArchiveRestore,
  Download,
} from "lucide-react";
import { useApp } from "@/state/AppProvider";
import { PageHeader, PageBody } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/common/Badges";
import { Button, Badge, Tabs } from "@/components/ui/primitives";
import { useToast, ConfirmDialog } from "@/components/ui/overlays";
import { db, logActivity, deleteFile } from "@/lib/db";
import { sqlStats, sqliteReady, downloadSqliteFile, flushSqlSync } from "@/lib/sqlMirror"; // server-managed SQLite compat

const PROTECTED = new Set([
  "users",
  "settings",
  "activity",
  "tutorialVideos",
  "matterTypes",
  "templates",
]);

const DEPENDENTS: Record<string, string[]> = {
  clients: ["matters", "agreements", "payments", "tasks", "events", "documents", "notes"],
  matters: ["agreements", "payments", "tasks", "events", "documents", "notes"],
  agreements: ["payments"],
  events: ["documents"],
};

const LABELS: Record<string, string> = {
  users: "المستخدمون",
  clients: "الموكلون",
  matterTypes: "أنواع القضايا",
  matters: "القضايا والملفات",
  agreements: "الاتفاقيات",
  payments: "المدفوعات",
  tasks: "المهام",
  events: "المواعيد والجلسات",
  documents: "الوثائق",
  files: "الملفات المرفوعة",
  notes: "الملاحظات",
  library: "المكتبة القانونية",
  templates: "قوالب المستندات",
  activity: "سجل النشاط (تدقيق)",
  notifications: "الإشعارات",
  settings: "الإعدادات",
  portfolio: "الموقع التعريفي",
  tutorialVideos: "فيديوهات الشرح",
};

function label(name: string) {
  return LABELS[name] ?? name;
}

interface TableInfo {
  name: string;
  count: number;
  protected: boolean;
}

interface TrashRow {
  table: string;
  id: string;
  title: string;
  sub: string;
  date: string;
  amount?: number;
  currency?: string;
  fileId?: string;
}

type TabKey = "truncate" | "trash";

export default function DataTools() {
  const { user, can } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>("truncate");
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [trashRows, setTrashRows] = useState<TrashRow[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashSelected, setTrashSelected] = useState<Set<string>>(new Set());
  const [trashConfirm, setTrashConfirm] = useState<{
    rows: TrashRow[];
    mode: "restore" | "purge";
  } | null>(null);
  const [sqlInfo, setSqlInfo] = useState<{
    tables: { name: string; rows: number; columns: number }[];
    totalRows: number;
  }>({ tables: [], totalRows: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const infos = await Promise.all(
        db.tables.map(async (t) => ({
          name: t.name,
          count: await t.count(),
          protected: PROTECTED.has(t.name),
        })),
      );
      infos.sort((a, b) => {
        if (a.protected !== b.protected) return a.protected ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
      setTables(infos);
      setSqlInfo(sqlStats());
      setSelected((prev) => {
        const next = new Set<string>();
        for (const name of prev) {
          const row = infos.find((i) => i.name === name);
          if (row && !row.protected) next.add(name);
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    try {
      const [matters, clients, tasks, events, documents, agreements, payments, library] =
        await Promise.all([
          db.matters.toArray(),
          db.clients.toArray(),
          db.tasks.toArray(),
          db.events.toArray(),
          db.documents.toArray(),
          db.agreements.toArray(),
          db.payments.toArray(),
          db.library.toArray(),
        ]);
      const out: TrashRow[] = [];
      for (const m of matters) {
        if (!m.archived) continue;
        out.push({
          table: "matters",
          id: m.id,
          title: m.title,
          sub: `${m.number} · ${m.status}`,
          date: m.archivedAt ?? m.updatedAt ?? m.createdAt,
          amount: m.agreedFee,
          currency: m.currency,
        });
      }
      for (const c of clients) {
        if (!c.archived) continue;
        out.push({
          table: "clients",
          id: c.id,
          title: c.name,
          sub: c.legalName || c.email || "موكّل",
          date: c.archivedAt ?? c.updatedAt ?? c.createdAt,
        });
      }
      for (const t of tasks) {
        if (!t.archived) continue;
        out.push({
          table: "tasks",
          id: t.id,
          title: t.title,
          sub: t.status,
          date: t.updatedAt ?? t.createdAt,
        });
      }
      for (const e of events) {
        if (!e.archived) continue;
        out.push({
          table: "events",
          id: e.id,
          title: e.title,
          sub: e.status,
          date: e.archivedAt ?? e.updatedAt ?? e.createdAt,
        });
      }
      for (const d of documents) {
        if (!d.archived) continue;
        out.push({
          table: "documents",
          id: d.id,
          title: d.title,
          sub: `النسخة ${d.version}${d.fileName ? ` · ${d.fileName}` : ""}`,
          date: d.archivedAt ?? d.updatedAt ?? d.createdAt,
          fileId: d.fileId,
        });
      }
      for (const a of agreements) {
        if (!a.archived) continue;
        out.push({
          table: "agreements",
          id: a.id,
          title: a.title,
          sub: a.status,
          date: a.updatedAt ?? a.createdAt,
          amount: a.amount,
          currency: a.currency,
        });
      }
      for (const p of payments) {
        if (!p.archived) continue;
        out.push({
          table: "payments",
          id: p.id,
          title: `دفعة — ${p.kind}`,
          sub: p.notes || p.receiptNo || "—",
          date: p.date,
          amount: p.amount,
          currency: p.currency,
        });
      }
      for (const l of library) {
        if (!l.archived) continue;
        out.push({
          table: "library",
          id: l.id,
          title: l.title,
          sub: l.author || l.category,
          date: l.addedAt,
        });
      }
      out.sort((a, b) => b.date.localeCompare(a.date));
      setTrashRows(out);
      setTrashSelected((prev) => {
        const next = new Set<string>();
        for (const key of prev) {
          if (out.some((r) => `${r.table}:${r.id}` === key)) next.add(key);
        }
        return next;
      });
    } finally {
      setTrashLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === "trash") void loadTrash();
  }, [tab, loadTrash]);

  const selectable = useMemo(() => tables.filter((t) => !t.protected), [tables]);
  const expanded = useMemo(() => {
    const set = new Set(selected);
    for (const name of selected) {
      for (const child of DEPENDENTS[name] ?? []) {
        if (!PROTECTED.has(child)) set.add(child);
      }
    }
    return set;
  }, [selected]);
  const selectedRows = useMemo(
    () => tables.filter((t) => expanded.has(t.name)),
    [tables, expanded],
  );
  const dependentNames = useMemo(
    () => selectedRows.filter((t) => !selected.has(t.name)).map((t) => t.name),
    [selectedRows, selected],
  );
  const totalRows = useMemo(
    () => selectedRows.reduce((sum, t) => sum + t.count, 0),
    [selectedRows],
  );

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === selectable.length) return new Set();
      return new Set(selectable.map((t) => t.name));
    });
  };

  const truncate = async () => {
    if (!selectedRows.length) return;
    setWorking(true);
    const names = selectedRows.map((t) => t.name);
    try {
      const targets = db.tables.filter((t) => names.includes(t.name));
      await db.transaction("rw", targets, async () => {
        for (const t of targets) await t.clear();
      });
      await logActivity({
        userId: user?.id,
        userName: user?.name ?? "مدير النظام",
        action: "truncate",
        entity: "data-tools",
        entityId: names.join(","),
        meta: JSON.stringify({ tables: names }),
      });
      toast.success("تم تفريغ الجداول المحددة", `تم حذف ${names.length} جدولاً.`);
      setSelected(new Set());
      setConfirmOpen(false);
      await flushSqlSync();
      await Promise.all([load(), loadTrash()]);
    } catch (err) {
      toast.error("تعذّر تفريغ الجداول", err instanceof Error ? err.message : undefined);
    } finally {
      setWorking(false);
    }
  };

  const trashKey = (r: TrashRow) => `${r.table}:${r.id}`;
  const toggleTrash = (row: TrashRow) => {
    const key = trashKey(row);
    setTrashSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const trashAllSelected =
    trashRows.length > 0 && trashRows.every((r) => trashSelected.has(trashKey(r)));
  const toggleAllTrash = () => {
    setTrashSelected((prev) =>
      prev.size === trashRows.length ? new Set() : new Set(trashRows.map(trashKey)),
    );
  };
  const selectedTrashRows = useMemo(
    () => trashRows.filter((r) => trashSelected.has(trashKey(r))),
    [trashRows, trashSelected],
  );

  const applyTrash = async () => {
    if (!trashConfirm || !trashConfirm.rows.length) return;
    setWorking(true);
    const rows = trashConfirm.rows;
    const mode = trashConfirm.mode;
    try {
      for (const r of rows) {
        const table = (db as unknown as Record<
          string,
          {
            update: (id: string, p: unknown) => Promise<unknown>;
            delete: (id: string) => Promise<unknown>;
          }
        >)[r.table];
        if (!table) continue;
        if (mode === "restore") {
          await table.update(r.id, { archived: false, archivedAt: undefined });
        } else {
          if (r.table === "documents" && r.fileId) await deleteFile(r.fileId);
          await table.delete(r.id);
        }
      }
      await logActivity({
        userId: user?.id,
        userName: user?.name ?? "مدير النظام",
        action: mode === "restore" ? "استرجاع من سلة المحذوفات" : "حذف نهائي من سلة المحذوفات",
        entity: "data-tools",
        entityId: rows.map((r) => `${r.table}:${r.id}`).join(","),
        meta: JSON.stringify({ mode, rows: rows.map((r) => ({ table: r.table, id: r.id })) }),
      });
      toast.success(
        mode === "restore"
          ? `تمت استعادة ${rows.length} سجل بنجاح`
          : `تم حذف ${rows.length} سجل نهائيًا`,
      );
      setTrashSelected(new Set());
      setTrashConfirm(null);
      await Promise.all([load(), loadTrash()]);
    } catch (err) {
      toast.error(
        mode === "restore" ? "تعذّرت استعادة السجلات" : "تعذّر حذف السجلات",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setWorking(false);
    }
  };

  if (!can("settings.edit")) {
    return (
      <>
        <PageHeader
          title="أدوات البيانات"
          subtitle="هذه الصفحة متاحة لمدير النظام فقط."
          icon={<Database className="size-6 text-accent" />}
        />
        <PageBody>
          <div className="card flex items-center gap-3 p-5 text-[13.5px] text-ink-soft">
            <ShieldAlert className="size-5 text-danger" />
            لا تملك صلاحية الوصول إلى أدوات البيانات.
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="أدوات البيانات"
        subtitle="تفريغ الجداول المحددة واستعادة المحذوفات مع حماية الحسابات والإعدادات وسجل التدقيق."
        icon={<Database className="size-6 text-accent" />}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => (tab === "truncate" ? void load() : void loadTrash())}
              disabled={loading || trashLoading || working}
            >
              <RefreshCw className={loading || trashLoading ? "size-4 animate-spin" : "size-4"} />
              تحديث
            </Button>
            {tab === "truncate" ? (
              <Button
                variant="danger"
                onClick={() => setConfirmOpen(true)}
                disabled={!selectedRows.length || working}
              >
                <Trash2 className="size-4" />
                تفريغ المحدد ({selectedRows.length})
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setTrashConfirm({ rows: selectedTrashRows, mode: "restore" })
                  }
                  disabled={!selectedTrashRows.length || working}
                >
                  <ArchiveRestore className="size-4" />
                  استعادة المحدد ({selectedTrashRows.length})
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setTrashConfirm({ rows: selectedTrashRows, mode: "purge" })}
                  disabled={!selectedTrashRows.length || working}
                >
                  <Trash2 className="size-4" />
                  حذف نهائي ({selectedTrashRows.length})
                </Button>
              </>
            )}
          </>
        }
      />

      <PageBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Database className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink">قاعدة SQLite المحلية</p>
              <p className="text-[11.5px] text-muted">
                {sqlInfo.tables.length} جدول ·{" "}
                {sqlInfo.totalRows.toLocaleString("ar-EG")} صف ·{" "}
                {sqlInfo.tables.reduce((sum, table) => sum + table.columns, 0)} عمود
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={sqliteReady() ? "ok" : "muted"}>
              {sqliteReady() ? "متصل" : "غير مهيأ"}
            </Badge>
            <Button
              variant="ghost"
              onClick={() => downloadSqliteFile("adala.sqlite")}
              disabled={!sqliteReady()}
            >
              <Download className="size-4" />
              تنزيل SQLite
            </Button>
          </div>
        </div>

        <Tabs
          value={tab}
          onChange={(v) => setTab(v as TabKey)}
          tabs={[
            { value: "truncate", label: "تفريغ الجداول", icon: Trash2 },
            { value: "trash", label: "سلة المحذوفات", icon: ArchiveRestore, count: trashRows.length },
          ]}
        />

        {tab === "truncate" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger-soft/40 px-4 py-3 text-[12.5px] text-ink-soft">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 shrink-0 text-danger" />
                الحذف نهائي ولا يمكن التراجع عنه. الجداول المحمية تظهر بقفل ولا يمكن تحديدها.
              </div>
              <span className="font-semibold text-danger">
                {selectedRows.length} جدول / {totalRows.toLocaleString("ar-EG")} صف
              </span>
            </div>

            <SectionCard
              title="الجداول"
              subtitle="حدد الجداول التي تريد تفريغها. سيتم تسجيل العملية في سجل النشاط."
              action={
                <Button variant="ghost" onClick={toggleAll} disabled={!selectable.length || working}>
                  {selected.size === selectable.length && selectable.length > 0 ? (
                    <CheckSquare className="size-4" />
                  ) : (
                    <Square className="size-4" />
                  )}
                  {selected.size === selectable.length && selectable.length > 0
                    ? "إلغاء تحديد الكل"
                    : "تحديد الكل"}
                </Button>
              }
            >
              {loading ? (
                <div className="py-10 text-center text-[13px] text-muted">جارٍ قراءة الجداول…</div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {tables.map((t) => {
                    const isSelected = selected.has(t.name);
                    return (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => !t.protected && toggle(t.name)}
                        disabled={t.protected || working}
                        className={[
                          "flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-start transition",
                          t.protected
                            ? "cursor-not-allowed border-line bg-surface-2/40 opacity-70"
                            : isSelected
                              ? "border-danger/50 bg-danger-soft/50"
                              : "border-line bg-surface hover:border-accent/40 hover:bg-surface-2",
                        ].join(" ")}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          {t.protected ? (
                            <Lock className="size-4 shrink-0 text-muted" />
                          ) : isSelected ? (
                            <CheckSquare className="size-4 shrink-0 text-danger" />
                          ) : (
                            <Square className="size-4 shrink-0 text-muted" />
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold text-ink">
                              {label(t.name)}
                            </span>
                            <span className="block truncate text-[11px] text-muted" dir="ltr">
                              {t.name}
                            </span>
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge tone={t.protected ? "muted" : t.count ? "accent" : "muted"}>
                            {t.count.toLocaleString("ar-EG")}
                          </Badge>
                          {t.protected && <span className="text-[10px] text-muted">محمي</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {dependentNames.length > 0 && (
                <p className="mt-3 rounded-xl border border-warn/30 bg-warn-soft/40 px-3 py-2 text-[11.5px] text-ink-soft">
                  سيتم أيضاً تفريغ الجداول التابعة:{" "}
                  <span className="font-semibold text-ink">
                    {dependentNames.map(label).join("، ")}
                  </span>
                </p>
              )}
            </SectionCard>
          </>
        ) : (
          <SectionCard
            title="سلة المحذوفات"
            subtitle="السجلات المؤرشفة في القضايا والموكلين والمهام والمواعيد والوثائق والاتفاقيات والمدفوعات والمكتبة. يمكنك استعادتها أو حذفها نهائياً."
            action={
              <Button
                variant="ghost"
                onClick={toggleAllTrash}
                disabled={!trashRows.length || working}
              >
                {trashAllSelected ? (
                  <CheckSquare className="size-4" />
                ) : (
                  <Square className="size-4" />
                )}
                {trashAllSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
              </Button>
            }
          >
            {trashLoading ? (
              <div className="py-10 text-center text-[13px] text-muted">جارٍ قراءة سلة المحذوفات…</div>
            ) : trashRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-[13px] text-muted">
                <ArchiveRestore className="size-8 text-muted/60" />
                لا توجد سجلات محذوفة حالياً.
              </div>
            ) : (
              <div className="space-y-2">
                {trashRows.map((r) => {
                  const key = trashKey(r);
                  const checked = trashSelected.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleTrash(r)}
                      disabled={working}
                      className={[
                        "flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-start transition",
                        checked
                          ? "border-accent/50 bg-accent-soft/40"
                          : "border-line bg-surface hover:border-accent/40 hover:bg-surface-2",
                      ].join(" ")}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        {checked ? (
                          <CheckSquare className="size-4 shrink-0 text-accent" />
                        ) : (
                          <Square className="size-4 shrink-0 text-muted" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-ink">
                            {r.title}
                          </span>
                          <span className="block truncate text-[11px] text-muted">
                            {r.sub} · {label(r.table)}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {r.amount !== undefined && (
                          <span className="text-[11.5px] font-semibold text-ink-soft" dir="ltr">
                            {r.amount.toLocaleString("ar-EG")} {r.currency ?? ""}
                          </span>
                        )}
                        <span className="text-[10.5px] text-muted" dir="ltr">
                          {r.date ? new Date(r.date).toLocaleDateString("ar-EG") : "—"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>
        )}
      </PageBody>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => !working && setConfirmOpen(false)}
        onConfirm={() => void truncate()}
        title="تأكيد تفريغ الجداول"
        message={`سيتم حذف جميع الصفوف من ${selectedRows.length} جدولاً (${totalRows.toLocaleString(
          "ar-EG",
        )} صف). لا يمكن التراجع عن هذه العملية.`}
        confirmLabel="تفريغ نهائي"
        loading={working}
      />

      <ConfirmDialog
        open={Boolean(trashConfirm)}
        onClose={() => !working && setTrashConfirm(null)}
        onConfirm={() => void applyTrash()}
        title={trashConfirm?.mode === "purge" ? "تأكيد الحذف النهائي" : "تأكيد استعادة السجلات"}
        message={
          trashConfirm?.mode === "purge"
            ? `سيتم حذف ${trashConfirm?.rows.length ?? 0} سجل نهائياً. لا يمكن التراجع عن هذه العملية.`
            : `سيتم استعادة ${trashConfirm?.rows.length ?? 0} سجل إلى القوائم النشطة.`
        }
        confirmLabel={trashConfirm?.mode === "purge" ? "حذف نهائي" : "استعادة"}
        tone={trashConfirm?.mode === "purge" ? "danger" : "primary"}
        loading={working}
      />
    </>
  );
}
