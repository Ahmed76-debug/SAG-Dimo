/* ============================================================
   أدوات البيانات — تفريغ الجداول، سجل التدقيق، سلة المهملات
   ============================================================ */
import { api, icon, esc, fmt } from '../core.js';
import { toast, confirmDialog, setLoading } from '../ui.js';
import { sectionHead } from './_shared.js';

const ACTION_LABEL = {
  create: 'إنشاء', update: 'تعديل', delete: 'حذف', restore: 'استعادة',
  purge: 'حذف نهائي', truncate: 'تفريغ جداول', login: 'دخول', logout: 'خروج',
  'restore_db': 'استعادة نسخة', backup: 'نسخ احتياطي',
};
const ACTION_BADGE = {
  create: 'badge-success', update: 'badge-info', delete: 'badge-danger',
  restore: 'badge-warn', purge: 'badge-danger', truncate: 'badge-purple',
};

export async function render(root) {
  let alive = true;
  let tab = 'tables';
  let tools = { tables: [] };
  let audit = { rows: [] };
  let trash = { groups: [], total: 0 };
  let auditQ = '';

  root.innerHTML = `<div class="card"><div class="skeleton" style="height:320px;border-radius:14px"></div></div>`;

  async function loadAll() {
    try {
      const [t, a, r] = await Promise.all([
        api('/data-tools'),
        api('/audit?limit=300'),
        api('/trash'),
      ]);
      if (!alive) return;
      tools = t; audit = a; trash = r;
      paint();
    } catch (e) {
      if (!alive) return;
      root.innerHTML = `<div class="card"><div class="empty">
        <div class="empty-ico">${icon('alert')}</div>
        <div class="empty-title">تعذر تحميل أدوات البيانات</div>
        <div class="empty-text">${esc(e.message)}</div>
        <button class="btn btn-secondary mt-2" data-retry>${icon('refresh')} إعادة المحاولة</button>
      </div></div>`;
      root.querySelector('[data-retry]')?.addEventListener('click', loadAll);
    }
  }

  function paint() {
    const tabs = [
      { key: 'tables', label: 'تفريغ الجداول', icon: 'table' },
      { key: 'audit', label: 'سجل التدقيق', icon: 'clock' },
      { key: 'trash', label: 'سلة المهملات', icon: 'trash', count: trash.total },
    ];
    root.innerHTML = `
      <div class="card">
        ${sectionHead('أدوات البيانات', 'تحكّم كامل ببيانات المتجر: تفريغ جداول محددة، تتبّع من أنشأ/عدّل/حذف/استعاد، واستعادة المحذوف.')}
        <div class="segmented" data-tabs>
          ${tabs.map((t) => `<button type="button" data-tab="${t.key}" class="${tab === t.key ? 'active' : ''}">${icon(t.icon, 'icon-sm')} ${t.label}${t.count ? ` <span class="badge badge-danger">${fmt.int(t.count)}</span>` : ''}</button>`).join('')}
        </div>
      </div>
      <div data-panel class="mt-3"></div>`;

    root.querySelectorAll('[data-tab]').forEach((b) => {
      b.addEventListener('click', () => { tab = b.dataset.tab; paint(); });
    });
    const panel = root.querySelector('[data-panel]');
    if (tab === 'tables') paintTables(panel);
    else if (tab === 'audit') paintAudit(panel);
    else paintTrash(panel);
  }

  /* ---------------------------- تفريغ الجداول ---------------------------- */
  function paintTables(panel) {
    const tables = tools.tables || [];
    panel.innerHTML = `
      <div class="card">
        <div class="alert alert-warning" style="margin-bottom:14px">${icon('alert')}
          <div><b>تحذير:</b> تفريغ الجداول يحذف بياناتها نهائيًا. يتم تضمين الجداول المرتبطة تلقائيًا للحفاظ على سلامة العلاقات، ويُسجَّل الإجراء في سجل التدقيق. خذ نسخة احتياطية أولًا.</div>
        </div>
        <div class="row between wrap" style="margin-bottom:10px">
          <div class="small muted">اختر الجداول التي تريد تفريغها — الجداول المحمية (المستخدمون/الجلسات/الإعدادات) لا يمكن تفريغها.</div>
          <div class="row gap-2">
            <button class="btn btn-sm btn-secondary" data-select-all>تحديد الكل</button>
            <button class="btn btn-sm btn-secondary" data-select-none>إلغاء التحديد</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table table-compact">
            <thead><tr><th style="width:44px"></th><th>الجدول</th><th>الاسم</th><th>عدد الصفوف</th><th>الحالة</th></tr></thead>
            <tbody>
              ${tables.map((t) => `
                <tr>
                  <td><input type="checkbox" data-table="${esc(t.name)}" ${t.protected ? 'disabled' : ''} /></td>
                  <td class="mono" dir="ltr" style="text-align:left">${esc(t.name)}</td>
                  <td>${esc(t.label)}</td>
                  <td class="num">${fmt.int(t.rows)}</td>
                  <td>${t.protected ? '<span class="badge badge-muted">محمي</span>' : '<span class="badge badge-success">قابل للتفريغ</span>'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="row between wrap mt-3">
          <span class="small muted" data-selected-count>لم يتم تحديد أي جدول</span>
          <button class="btn btn-danger" data-truncate disabled>${icon('trash')} تفريغ الجداول المحددة</button>
        </div>
      </div>`;

    const boxes = () => [...panel.querySelectorAll('[data-table]:not(:disabled)')];
    const updateCount = () => {
      const n = boxes().filter((b) => b.checked).length;
      panel.querySelector('[data-selected-count]').textContent = n ? `تم تحديد ${n} جدول` : 'لم يتم تحديد أي جدول';
      panel.querySelector('[data-truncate]').disabled = n === 0;
    };
    boxes().forEach((b) => b.addEventListener('change', updateCount));
    panel.querySelector('[data-select-all]').onclick = () => { boxes().forEach((b) => (b.checked = true)); updateCount(); };
    panel.querySelector('[data-select-none]').onclick = () => { boxes().forEach((b) => (b.checked = false)); updateCount(); };
    panel.querySelector('[data-truncate]').onclick = async (e) => {
      const selected = boxes().filter((b) => b.checked).map((b) => b.dataset.table);
      if (!selected.length) return;
      const ok = await confirmDialog({
        title: 'تفريغ الجداول؟',
        message: `سيتم حذف كل صفوف الجداول التالية: ${selected.join(', ')}. قد تُضاف جداول مرتبطة تلقائيًا. لا يمكن التراجع.`,
        danger: true, confirmText: 'نعم، فرّغ الآن', iconName: 'trash',
      });
      if (!ok) return;
      const btn = e.currentTarget;
      setLoading(btn, true, 'جارٍ التفريغ…');
      try {
        const res = await api('/data-tools/truncate', { method: 'POST', body: { tables: selected } });
        toast(`تم تفريغ ${res.cleared?.length || 0} جدول`);
        await loadAll();
      } catch (err) {
        toast(err.message, 'danger');
        setLoading(btn, false);
      }
    };
  }

  /* ---------------------------- سجل التدقيق ---------------------------- */
  function paintAudit(panel) {
    const rows = audit.rows || [];
    panel.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div class="input-icon" style="flex:1;max-width:380px">${icon('search')}<input class="input" data-audit-q value="${esc(auditQ)}" placeholder="ابحث بالمستخدم أو التفاصيل أو الكيان..."></div>
          <div class="spacer"></div>
          <span class="badge badge-info">${fmt.int(rows.length)} سجل</span>
        </div>
        <div class="table-wrap">
          <table class="table table-compact">
            <thead><tr><th>التاريخ</th><th>المستخدم</th><th>الإجراء</th><th>الكيان</th><th>المعرّف</th><th>التفاصيل</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((r) => `
                <tr>
                  <td class="num small">${esc(fmt.datetime(r.created_at))}</td>
                  <td>${esc(r.user_name || '—')}</td>
                  <td><span class="badge ${ACTION_BADGE[r.action] || 'badge-muted'}">${esc(ACTION_LABEL[r.action] || r.action)}</span></td>
                  <td class="mono" dir="ltr" style="text-align:left">${esc(r.entity || '—')}</td>
                  <td class="num">${r.entity_id ?? '—'}</td>
                  <td class="small muted" style="max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.details || '')}">${esc(r.details || '—')}</td>
                </tr>`).join('') : `<tr><td colspan="6"><div class="empty"><div class="empty-title">لا توجد سجلات بعد</div><div class="empty-text">ستظهر هنا كل عمليات الإنشاء والتعديل والحذف والاستعادة مع اسم المستخدم.</div></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
    const q = panel.querySelector('[data-audit-q]');
    let timer;
    q.addEventListener('input', () => {
      auditQ = q.value;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try { audit = await api(`/audit?limit=300&q=${encodeURIComponent(auditQ)}`); if (alive) paintAudit(panel); }
        catch (e) { toast(e.message, 'danger'); }
      }, 320);
    });
  }

  /* ---------------------------- سلة المهملات ---------------------------- */
  function paintTrash(panel) {
    const groups = (trash.groups || []).filter((g) => g.rows.length);
    panel.innerHTML = `
      <div class="card">
        ${sectionHead('سلة المهملات', 'العناصر المحذوفة التي يمكن استعادتها أو حذفها نهائيًا.')}
        ${groups.length ? groups.map((g) => `
          <div style="margin-bottom:18px">
            <div class="row between" style="margin-bottom:6px">
              <b>${esc(g.label)}</b><span class="badge badge-muted">${fmt.int(g.rows.length)}</span>
            </div>
            <div class="table-wrap">
              <table class="table table-compact">
                <thead><tr><th>#</th><th>الاسم</th><th>تاريخ الإنشاء</th><th style="width:180px"></th></tr></thead>
                <tbody>
                  ${g.rows.map((r) => `
                    <tr>
                      <td class="num">${r.id}</td>
                      <td>${esc(r.name || '—')}</td>
                      <td class="small muted">${esc(r.created_at || '—')}</td>
                      <td class="actions">
                        <button class="btn btn-sm btn-secondary" data-restore="${esc(g.entity)}:${r.id}">${icon('refresh', 'icon-sm')} استعادة</button>
                        <button class="btn btn-sm" data-purge="${esc(g.entity)}:${r.id}" style="color:var(--danger)">${icon('trash', 'icon-sm')} نهائي</button>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>`).join('') : `<div class="empty"><div class="empty-ico">${icon('trash')}</div><div class="empty-title">السلة فارغة</div><div class="empty-text">عند حذف منتج أو عميل أو مورد أو مستخدم سيظهر هنا لإمكانية استعادته.</div></div>`}
      </div>`;

    panel.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', async () => {
      const [entity, id] = b.dataset.restore.split(':');
      setLoading(b, true, 'جارٍ الاستعادة…');
      try {
        await api(`/trash/${entity}/${id}/restore`, { method: 'POST' });
        toast('تمت الاستعادة');
        await loadAll();
      } catch (e) { toast(e.message, 'danger'); setLoading(b, false); }
    }));
    panel.querySelectorAll('[data-purge]').forEach((b) => b.addEventListener('click', async () => {
      const [entity, id] = b.dataset.purge.split(':');
      const ok = await confirmDialog({ title: 'حذف نهائي؟', message: 'لا يمكن التراجع عن الحذف النهائي.', danger: true, confirmText: 'حذف نهائي', iconName: 'trash' });
      if (!ok) return;
      setLoading(b, true, 'جارٍ الحذف…');
      try {
        await api(`/trash/${entity}/${id}`, { method: 'DELETE' });
        toast('تم الحذف النهائي');
        await loadAll();
      } catch (e) { toast(e.message, 'danger'); setLoading(b, false); }
    }));
  }

  await loadAll();
}
