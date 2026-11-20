/* ============================================================
   Auto Car — استيراد وتصدير Excel/CSV
   ============================================================ */
import { t, esc, icon, api, fmtNum, fmtDateTime, state } from '../core.js';
import { toast, renderTable, emptyState } from '../ui.js';

const EXPORTS = ['vehicles', 'customers', 'suppliers', 'sales', 'purchases', 'accounts'];

export async function render(container) {
  const d = await api('/import/entities');
  const entities = d.items || [];
  container.innerHTML = `
    <div class="grid cols-2">
      <div class="card card-pad">
        <div class="card-head" style="padding:0 0 12px;border:none"><h3>${icon('upload', 'sm')} ${t('import_entity')}</h3></div>
        <div class="form-grid">
          <div class="field full"><label>${t('import_entity')}</label>
            <select class="select" data-entity>${entities.map((e) => `<option value="${e.key}">${esc(e.label)}</option>`).join('')}</select></div>
          <div class="field full"><label>${t('choose_file')}</label>
            <input class="input" type="file" accept=".xlsx,.xls,.csv" data-file></div>
        </div>
        <div class="row mt-2" style="gap:8px;flex-wrap:wrap">
          <button class="btn btn-soft" data-template>${icon('download', 'sm')} ${t('download_template')}</button>
          <button class="btn btn-primary" data-import>${icon('upload', 'sm')} ${t('import_now')}</button>
        </div>
        <p class="small muted mt-2">${t('import_hint')}</p>
        <div data-result class="mt-2"></div>
      </div>
      <div class="card card-pad">
        <div class="card-head" style="padding:0 0 12px;border:none"><h3>${icon('sheet', 'sm')} ${t('quick_export')}</h3></div>
        <div class="tile-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
          ${EXPORTS.map((e) => `<button class="mini-tile" data-export="${e}">${icon('download', 'sm')}<span>${esc(t(e === 'vehicles' ? 'vehicles' : e === 'sales' ? 'sales_invoices' : e === 'purchases' ? 'purchases_list' : e === 'accounts' ? 'chart_of_accounts' : e))}</span></button>`).join('')}
        </div>
        <div class="row mt-2" style="gap:8px">
          <button class="btn btn-ghost btn-sm" data-export-fmt="xlsx">Excel (.xlsx)</button>
          <button class="btn btn-ghost btn-sm" data-export-fmt="csv">CSV</button>
        </div>
      </div>
    </div>
    <div class="card mt-2">
      <div class="card-head"><h3>${icon('clock', 'sm')} ${t('import_logs')}</h3><div class="spacer"></div><button class="btn btn-ghost btn-sm" data-refresh-logs>${icon('refresh', 'sm')}</button></div>
      <div data-logs></div>
    </div>`;

  let exportFmt = 'xlsx';
  container.querySelector('[data-export-fmt]');
  container.querySelectorAll('[data-export-fmt]').forEach((b) => b.onclick = () => {
    exportFmt = b.dataset.exportFmt;
    container.querySelectorAll('[data-export-fmt]').forEach((x) => x.classList.toggle('btn-primary', x === b));
    container.querySelectorAll('[data-export-fmt]').forEach((x) => x.classList.toggle('btn-ghost', x !== b));
  });
  container.querySelectorAll('[data-export]').forEach((b) => b.onclick = () => window.open(`/api/export/${b.dataset.export}?format=${exportFmt}`, '_blank'));
  container.querySelector('[data-template]').onclick = () => { const e = container.querySelector('[data-entity]').value; window.open(`/api/import/template/${e}`, '_blank'); };
  container.querySelector('[data-import]').onclick = async () => {
    const entity = container.querySelector('[data-entity]').value;
    const f = container.querySelector('[data-file]').files[0];
    if (!f) return toast(t('choose_file'), 'warn');
    const btn = container.querySelector('[data-import]'); btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>`;
    try {
      const buf = await f.arrayBuffer();
      const r = await api(`/import/${entity}`, { method: 'POST', raw: buf, filename: f.name, headers: { 'Content-Type': 'application/octet-stream' } });
      const res = container.querySelector('[data-result]');
      res.innerHTML = `<div class="alert ${r.failed ? 'warn' : 'success'}">${icon(r.failed ? 'alert' : 'check-circle', 'sm')} <b>${esc(r.message)}</b>
        <div class="small mt-1">${t('success')}: ${fmtNum(r.success, 0)} • ${t('failed')}: ${fmtNum(r.failed, 0)}</div>
        ${r.errors && r.errors.length ? `<div class="small mt-1 mono" style="max-height:120px;overflow:auto">${r.errors.map((e) => `${t('rows')} ${e.row}: ${esc(e.error)}`).join('<br>')}</div>` : ''}</div>`;
      toast(r.message); loadLogs();
    } catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.innerHTML = `${icon('upload', 'sm')} ${t('import_now')}`;
  };

  async function loadLogs() {
    const box = container.querySelector('[data-logs]');
    try {
      const r = await api('/import/logs');
      box.innerHTML = renderTable({
        columns: [
          { key: 'created_at', label: t('date'), render: (x) => esc(fmtDateTime(x.created_at)) },
          { key: 'entity', label: t('entity'), render: (x) => `<span class="badge badge-brand">${esc(x.entity)}</span>` },
          { key: 'filename', label: t('filename'), render: (x) => `<span class="small muted mono">${esc(x.filename || '—')}</span>` },
          { key: 'total', label: t('rows'), align: 'end', render: (x) => fmtNum(x.total, 0) },
          { key: 'success', label: t('success'), align: 'end', render: (x) => `<span class="text-success">${fmtNum(x.success, 0)}</span>` },
          { key: 'failed', label: t('failed'), align: 'end', render: (x) => x.failed ? `<span class="text-danger">${fmtNum(x.failed, 0)}</span>` : '0' },
        ], rows: r.items, empty: t('no_data'),
      });
    } catch { box.innerHTML = emptyState(t('no_data'), 'clock'); }
  }
  container.querySelector('[data-refresh-logs]').onclick = loadLogs;
  loadLogs();
}
