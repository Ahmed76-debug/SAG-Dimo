/* ============================================================
   Auto Car — النسخ الاحتياطي والاستعادة + مجلد مخصص + جدولة
   ============================================================ */
import { t, esc, icon, api, fmtNum, fmtDateTime, state, can, downloadBlob } from '../core.js';
import { modal, toast, confirmDialog, renderTable, emptyState } from '../ui.js';

function fmtSize(n) {
  const b = Number(n) || 0;
  if (b > 1048576) return (b / 1048576).toFixed(2) + ' MB';
  if (b > 1024) return (b / 1024).toFixed(1) + ' KB';
  return b + ' B';
}

export async function render(container) {
  let dir = '';
  container.innerHTML = `
    <div data-stats class="grid cols-4 mb-2"></div>
    <div class="card card-pad mb-2">
      <div class="row between" style="flex-wrap:wrap;gap:10px">
        <div style="min-width:0"><div class="small muted">${t('backup_dir')}</div><div class="mono strong" data-dir style="word-break:break-all">—</div></div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <button class="btn btn-soft" data-browse>${icon('folder', 'sm')} ${t('choose_folder')}</button>
          <button class="btn btn-primary" data-create>${icon('database', 'sm')} ${t('create_backup')}</button>
          <button class="btn btn-ghost" data-upload>${icon('upload', 'sm')} ${t('upload_backup')}</button>
          <button class="btn btn-ghost" data-prune>${icon('trash', 'sm')} ${t('prune_backups')}</button>
        </div>
      </div>
      <div class="divider"></div>
      <div class="row" style="gap:18px;flex-wrap:wrap;align-items:end">
        <label class="check"><input type="checkbox" data-auto> ${t('auto_backup')}</label>
        <div class="field" style="margin:0"><label>${t('backup_interval')}</label><input class="input" type="number" data-interval style="max-width:120px"></div>
        <div class="field" style="margin:0"><label>${t('backup_retention')}</label><input class="input" type="number" data-retention style="max-width:120px"></div>
        <button class="btn btn-soft" data-save-cfg>${icon('save', 'sm')} ${t('save')}</button>
      </div>
    </div>
    <div data-table></div>`;

  async function load() {
    const d = await api('/backup' + (dir ? `?dir=${encodeURIComponent(dir)}` : ''));
    dir = d.dir;
    container.querySelector('[data-dir]').textContent = d.dir;
    container.querySelector('[data-auto]').checked = d.settings.auto_backup_enabled === '1' || d.settings.auto_backup_enabled === 1;
    container.querySelector('[data-interval]').value = d.settings.auto_backup_interval_hours;
    container.querySelector('[data-retention]').value = d.settings.backup_retention_days;
    const tbl = container.querySelector('[data-table]');
    if (!d.items.length) { tbl.innerHTML = emptyState(t('no_data'), 'database'); }
    else tbl.innerHTML = renderTable({
      columns: [
        { key: 'filename', label: t('filename'), render: (r) => `<div class="row" style="gap:8px">${icon('database', 'sm')}<span class="mono small" style="word-break:break-all">${esc(r.filename)}</span></div>` },
        { key: 'size', label: t('size'), align: 'end', render: (r) => fmtSize(r.size) },
        { key: 'created_at', label: t('date'), render: (r) => esc(fmtDateTime(r.created_at)) },
        { key: 'actions', label: t('actions'), align: 'end', width: '170px', render: (r) => `<div class="row-actions">
          <button class="btn btn-ghost btn-icon btn-sm" data-dl="${esc(r.filename)}" title="${t('download')}">${icon('download', 'sm')}</button>
          <button class="btn btn-soft btn-sm" data-restore="${esc(r.filename)}">${icon('restore', 'sm')} ${t('restore')}</button>
          <button class="btn btn-ghost btn-icon btn-sm" data-del="${esc(r.filename)}" title="${t('delete')}">${icon('trash', 'sm')}</button></div>` },
      ], rows: d.items,
    });
    tbl.querySelectorAll('[data-dl]').forEach((b) => b.onclick = () => window.open(`/api/backup/download/${encodeURIComponent(b.dataset.dl)}?dir=${encodeURIComponent(dir)}`, '_blank'));
    tbl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { if (await confirmDialog(t('confirm_delete'))) { try { const r = await api(`/backup/${encodeURIComponent(b.dataset.del)}?dir=${encodeURIComponent(dir)}`, { method: 'DELETE' }); toast(t('msg_deleted')); load(); } catch (e) { toast(e.message, 'error'); } } });
    tbl.querySelectorAll('[data-restore]').forEach((b) => b.onclick = () => doRestore(b.dataset.restore));
    // stats
    try {
      const st = await api('/db/stats');
      container.querySelector('[data-stats]').innerHTML = `
        <div class="stat"><div class="stat-icon tone-brand">${icon('database', 'lg')}</div><div><div class="stat-label">${t('db_size')}</div><div class="stat-val">${fmtSize(st.size)}</div></div></div>
        <div class="stat"><div class="stat-icon tone-info">${icon('car', 'lg')}</div><div><div class="stat-label">${t('vehicles')}</div><div class="stat-val">${fmtNum(st.counts.vehicles, 0)}</div></div></div>
        <div class="stat"><div class="stat-icon tone-success">${icon('receipt', 'lg')}</div><div><div class="stat-label">${t('sales_invoices')}</div><div class="stat-val">${fmtNum(st.counts.sales, 0)}</div></div></div>
        <div class="stat"><div class="stat-icon tone-purple">${icon('ledger', 'lg')}</div><div><div class="stat-label">${t('journal')}</div><div class="stat-val">${fmtNum(st.counts.journal_entries, 0)}</div></div></div>`;
    } catch {}
  }

  async function doRestore(filename) {
    if (!(await confirmDialog(t('restore_confirm'), { danger: true }))) return;
    try { await api('/backup/restore', { method: 'POST', body: { filename, dir } }); toast(t('restored')); setTimeout(() => location.reload(), 1200); }
    catch (e) { toast(e.message, 'error'); }
  }

  function browse(startPath) {
    const m = modal({
      title: t('choose_backup_dir'), size: 'modal-lg',
      body: `<div class="row between mb-2"><div class="mono small" data-cur style="word-break:break-all">…</div>
        <button class="btn btn-ghost btn-sm" data-up>${icon('arrow-left', 'sm')} ${t('go_up')}</button></div>
        <div data-list class="browse-list"></div>`,
      footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-pick>${icon('check', 'sm')} ${t('select_this_folder')}</button>`,
    });
    let cur = startPath || '';
    async function go(p) {
      try {
        const d = await api('/backup/browse' + (p ? `?path=${encodeURIComponent(p)}` : ''));
        cur = d.path;
        m.node.querySelector('[data-cur]').textContent = d.is_root ? '💾' : d.path;
        m.node.querySelector('[data-up]').style.display = d.parent ? '' : 'none';
        const list = m.node.querySelector('[data-list]');
        list.innerHTML = d.dirs.map((x) => `<button class="browse-item" data-d="${esc(x.path)}">${icon('folder', 'sm')}<span>${esc(x.name)}</span></button>`).join('') || `<div class="muted small" style="padding:14px">${t('no_data')}</div>`;
        list.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => go(b.dataset.d));
        m.node.querySelector('[data-up]').onclick = () => go(d.parent);
      } catch (e) { toast(e.message, 'error'); }
    }
    m.node.querySelector('[data-x]').onclick = m.close;
    m.node.querySelector('[data-pick]').onclick = async () => {
      if (!cur) return toast(t('choose_folder'), 'warn');
      dir = cur; m.close();
      await api('/backup/settings', { method: 'PUT', body: { backup_dir: dir } }).catch(() => {});
      load();
    };
    go(cur);
  }

  container.querySelector('[data-browse]').onclick = () => browse(dir);
  container.querySelector('[data-create]').onclick = async () => { try { const r = await api('/backup', { method: 'POST', body: { dir } }); toast(t('saved')); load(); } catch (e) { toast(e.message, 'error'); } };
  container.querySelector('[data-prune]').onclick = async () => { try { const r = await api('/backup/prune', { method: 'POST', body: { dir, days: Number(container.querySelector('[data-retention]').value) || 30 } }); toast(r.message); load(); } catch (e) { toast(e.message, 'error'); } };
  container.querySelector('[data-upload]').onclick = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.db,.sqlite,.sqlite3,.backup';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      const doRest = await confirmDialog(t('upload_backup') + ' — ' + t('restore_backup') + '؟', { danger: false, okText: t('restore') }).catch(() => false);
      try {
        const buf = await f.arrayBuffer();
        await api('/backup/upload' + (doRest ? '?restore=1' : ''), { method: 'POST', raw: buf, filename: f.name, headers: { 'Content-Type': 'application/octet-stream' } });
        toast(t('saved'));
        if (doRest) setTimeout(() => location.reload(), 1200); else load();
      } catch (e) { toast(e.message, 'error'); }
    };
    inp.click();
  };
  container.querySelector('[data-save-cfg]').onclick = async () => {
    try {
      await api('/backup/settings', { method: 'PUT', body: {
        auto_backup_enabled: container.querySelector('[data-auto]').checked ? 1 : 0,
        auto_backup_interval_hours: Number(container.querySelector('[data-interval]').value) || 24,
        backup_retention_days: Number(container.querySelector('[data-retention]').value) || 30,
        backup_dir: dir,
      } });
      toast(t('saved'));
    } catch (e) { toast(e.message, 'error'); }
  };
  load();
}
