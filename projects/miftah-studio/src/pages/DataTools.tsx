import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  History,
  RefreshCw,
  ShieldCheck,
  Table2,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge, Button } from '@/components/ui/primitives';
import { ConfirmDialog, Tabs } from '@/components/ui/overlays';
import {
  DataTable,
  ErrorPanel,
  Panel,
  StatCard,
  Td,
  Th,
  Tr,
} from '@/components/ui/page';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/hooks';
import { useToast } from '@/lib/toast';
import { cn, formatDate, formatNumber } from '@/lib/utils';

interface TableInfo {
  name: string;
  label: string;
  rows: number;
  protected: boolean;
}

interface DataToolsResponse {
  tables: TableInfo[];
  protected: string[];
  totalRows: number;
}

interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  entity?: string;
  entityId?: string;
  detail?: Record<string, unknown> | null;
}

interface AuditResponse {
  items: AuditEntry[];
  total: number;
  page: number;
  pages: number;
  actions: string[];
}

interface TruncateResult {
  cleared: string[];
  requested: string[];
  backup: { id: number; filename: string; size: number };
}

export function DataTools() {
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<'tables' | 'history'>('tables');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const tools = useApiQuery<DataToolsResponse>('/data-tools', undefined, []);
  const history = useApiQuery<AuditResponse>(
    '/audit',
    { action: 'database.truncate', limit: 25 },
    [],
  );

  const tables = useMemo(() => tools.data?.tables ?? [], [tools.data]);
  const selectable = useMemo(() => tables.filter((table) => !table.protected), [tables]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allSelected = selectable.length > 0 && selectable.every((table) => selectedSet.has(table.name));

  const toggle = (name: string) => {
    setSelected((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  };

  const toggleAll = () => {
    setSelected(allSelected ? [] : selectable.map((table) => table.name));
  };

  const runTruncate = async () => {
    if (!selected.length) return;
    setBusy(true);
    try {
      const result = await api<TruncateResult>('/data-tools/truncate', {
        method: 'POST',
        body: { tables: selected },
      });
      success(
        'تم تفريغ الجداول',
        `أُنشئت نسخة أمان قبل التنفيذ: ${result.backup?.filename || '—'}`,
      );
      setSelected([]);
      setConfirmOpen(false);
      tools.reload();
      history.reload();
    } catch (err) {
      toastError('تعذر تفريغ الجداول', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="أدوات البيانات"
        description="تحكم آمن في جداول قاعدة البيانات: تفريغ انتقائي، نسخة أمان تلقائية قبل كل عملية، وسجل تدقيق كامل."
        actions={
          <Button variant="secondary" size="sm" onClick={() => { tools.reload(); history.reload(); }}>
            <RefreshCw size={14} /> تحديث
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="جداول قاعدة البيانات"
          value={formatNumber(tables.length)}
          hint="SQLite المحلية"
          icon={Database}
          tone="primary"
          delay={0.02}
        />
        <StatCard
          label="إجمالي السجلات"
          value={formatNumber(tools.data?.totalRows || 0)}
          hint="عبر جميع الجداول"
          icon={Table2}
          tone="info"
          delay={0.06}
        />
        <StatCard
          label="جداول محمية"
          value={formatNumber(tables.filter((table) => table.protected).length)}
          hint="لا يمكن تفريغها"
          icon={ShieldCheck}
          tone="success"
          delay={0.1}
        />
        <StatCard
          label="محدد للتفريغ"
          value={formatNumber(selected.length)}
          hint="بانتظار التأكيد"
          icon={Trash2}
          tone={selected.length ? 'danger' : 'primary'}
          delay={0.14}
        />
      </div>

      <Tabs
        tabs={[
          { id: 'tables', label: 'تفريغ الجداول', icon: <Database size={14} /> },
          { id: 'history', label: 'سجل العمليات', icon: <History size={14} />, count: history.data?.total },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'tables' ? (
        <Panel
          title="الجداول القابلة للتفريغ"
          description="اختر الجداول التي تريد حذف كل سجلاتها. تُضاف الجداول التابعة تلقائيًا عند الحاجة لسلامة العلاقات."
          action={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={toggleAll} disabled={!selectable.length}>
                {allSelected ? 'إلغاء التحديد' : 'تحديد الكل'}
              </Button>
              <Button variant="ghost" size="sm" onClick={tools.reload} disabled={tools.loading}>
                <RefreshCw size={14} /> تحديث
              </Button>
            </div>
          }
          padded={false}
        >
          <div className="flex items-start gap-3 border-b border-warning/20 bg-warning/10 px-4 py-3 text-[12px] leading-relaxed text-[var(--warning)]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>
              التفريغ يحذف كل السجلات نهائيًا من الجداول المحددة. تُنشأ نسخة أمان تلقائية قبل التنفيذ
              ويمكن استعادتها من صفحة <span className="font-semibold">النسخ الاحتياطي</span>.
              الجداول المحمية (المستخدمون، الأدوار، الإعدادات، سجل النشاط، مفاتيح API، النسخ) لا تُمس.
            </p>
          </div>

          {tools.error ? (
            <ErrorPanel message={tools.error} onRetry={tools.reload} />
          ) : (
            <DataTable minWidth={760}>
              <thead>
                <tr>
                  <Th width={52}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={!selectable.length}
                      aria-label="تحديد كل الجداول"
                      className="h-4 w-4 rounded border-line"
                      style={{ accentColor: 'var(--danger)' }}
                    />
                  </Th>
                  <Th>الجدول</Th>
                  <Th>الوصف</Th>
                  <Th width={120}>السجلات</Th>
                  <Th width={150}>الحالة</Th>
                </tr>
              </thead>
              <tbody>
                {tools.loading && !tools.data ? (
                  <tr>
                    <Td colSpan={5}>
                      <div className="py-10 text-center text-xs text-muted">جارٍ تحميل الجداول…</div>
                    </Td>
                  </tr>
                ) : (
                  tables.map((table) => {
                    const checked = selectedSet.has(table.name);
                    return (
                      <Tr
                        key={table.name}
                        onClick={() => { if (!table.protected) toggle(table.name); }}
                        className={cn(
                          !table.protected && 'cursor-pointer',
                          checked && 'bg-danger/5',
                          table.protected && 'opacity-70',
                        )}
                      >
                        <Td>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={table.protected}
                            onChange={() => toggle(table.name)}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`تحديد ${table.label}`}
                            className="h-4 w-4 rounded border-line"
                            style={{ accentColor: 'var(--danger)' }}
                          />
                        </Td>
                        <Td>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-ink">{table.label}</span>
                            <span className="font-mono text-[10.5px] text-muted" dir="ltr">{table.name}</span>
                          </div>
                        </Td>
                        <Td>
                          <span className="text-[12px] text-muted">
                            {table.protected ? 'جدول أساسي محمي من التفريغ' : 'جدول بيانات قابل للتفريغ'}
                          </span>
                        </Td>
                        <Td>
                          <span className="numeric font-semibold text-ink">{formatNumber(table.rows)}</span>
                        </Td>
                        <Td>
                          {table.protected ? (
                            <Badge tone="warning" dot>محمي</Badge>
                          ) : (
                            <Badge tone="success" dot>قابل للتفريغ</Badge>
                          )}
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </tbody>
            </DataTable>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
            <p className="text-[11.5px] text-muted">
              {selected.length
                ? `تم تحديد ${formatNumber(selected.length)} جدولًا — سيتم إنشاء نسخة أمان تلقائية.`
                : 'لم يتم تحديد أي جدول بعد.'}
            </p>
            <Button
              variant="danger"
              size="sm"
              disabled={!selected.length || busy}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 size={14} /> تفريغ المحدد
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel
          title="آخر عمليات التفريغ"
          description="سجل تدقيق يعرض من نفّذ العملية، الجداول المتأثرة، ونسخة الأمان المرتبطة بها."
          action={
            <Button variant="ghost" size="sm" onClick={history.reload} disabled={history.loading}>
              <RefreshCw size={14} /> تحديث
            </Button>
          }
          padded={false}
        >
          {history.error ? (
            <ErrorPanel message={history.error} onRetry={history.reload} />
          ) : (
            <DataTable minWidth={820}>
              <thead>
                <tr>
                  <Th width={170}>التاريخ</Th>
                  <Th width={150}>المستخدم</Th>
                  <Th>الجداول</Th>
                  <Th width={260}>نسخة الأمان</Th>
                </tr>
              </thead>
              <tbody>
                {history.loading && !history.data ? (
                  <tr>
                    <Td colSpan={4}>
                      <div className="py-10 text-center text-xs text-muted">جارٍ تحميل السجل…</div>
                    </Td>
                  </tr>
                ) : (history.data?.items || []).length ? (
                  (history.data?.items || []).map((entry) => {
                    const detail = entry.detail || {};
                    const affected = Array.isArray(detail.tables) ? detail.tables.map(String) : [];
                    const backup = typeof detail.backup === 'string' ? detail.backup : '';
                    return (
                      <Tr key={entry.id}>
                        <Td>
                          <span className="text-[12px] text-soft">{formatDate(entry.at)}</span>
                        </Td>
                        <Td>
                          <span className="font-medium text-ink">{entry.actor}</span>
                        </Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {affected.length
                              ? affected.map((table) => (
                                  <span
                                    key={table}
                                    className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-soft"
                                    dir="ltr"
                                  >
                                    {table}
                                  </span>
                                ))
                              : <span className="text-muted">—</span>}
                          </div>
                        </Td>
                        <Td>
                          {backup ? (
                            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted" dir="ltr">
                              <HardDrive size={13} /> {backup}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </Td>
                      </Tr>
                    );
                  })
                ) : (
                  <tr>
                    <Td colSpan={4}>
                      <div className="flex flex-col items-center gap-2 py-10 text-center">
                        <CheckCircle2 size={26} className="text-success" />
                        <p className="text-sm font-semibold text-ink">لا توجد عمليات تفريغ بعد</p>
                        <p className="text-xs text-muted">ستظهر هنا كل عملية تفريغ مع نسخة الأمان الخاصة بها.</p>
                      </div>
                    </Td>
                  </tr>
                )}
              </tbody>
            </DataTable>
          )}
        </Panel>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => { if (!busy) setConfirmOpen(false); }}
        onConfirm={runTruncate}
        title="تفريغ الجداول المحددة؟"
        description={
          <div className="space-y-2">
            <p>
              سيتم حذف كل السجلات من:{' '}
              <span className="font-mono text-[11.5px] text-ink" dir="ltr">{selected.join(', ')}</span>
            </p>
            <p className="text-[var(--warning)]">
              سيتم إنشاء نسخة أمان تلقائية قبل التنفيذ، ويمكن استعادتها لاحقًا من صفحة النسخ الاحتياطي.
            </p>
          </div>
        }
        confirmText="تفريغ الآن"
        loading={busy}
      />
    </div>
  );
}
