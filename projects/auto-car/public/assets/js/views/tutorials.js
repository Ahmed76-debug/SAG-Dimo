/* ============================================================
   Auto Car — فيديوهات شرح الصفحات (محلي في المتصفح)
   ============================================================ */
import { t, esc, icon, fmtDateTime } from '../core.js';
import { modal, toast, confirmDialog, emptyState } from '../ui.js';

const KEY = 'ac_tutorial_videos_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const save = (list) => localStorage.setItem(KEY, JSON.stringify(list));
const uid = () => 'tv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
const human = (b) => { b = Number(b) || 0; if (b > 1048576) return (b / 1048576).toFixed(1) + ' MB'; if (b > 1024) return (b / 1024).toFixed(0) + ' KB'; return b + ' B'; };
const readFile = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });

export async function render(container) {
  let q = '';
  let showDeleted = false;
  container.innerHTML = `
    <div class="toolbar mb-2">
      <div class="search-box grow" style="max-width:360px">${icon('search')}<input class="input" data-q placeholder="${t('tutorials_search')}"></div>
      <div class="grow"></div>
      <button class="btn btn-ghost" data-trash>${icon('trash', 'sm')} ${t('deleted_items') || 'سلة المحذوفات'}</button>
      <span class="badge badge-info" data-count></span>
      <button class="btn btn-primary" data-add>${icon('plus', 'sm')} ${t('tutorials_add')}</button>
    </div>
    <div data-grid class="grid cols-3" style="gap:14px"></div>`;

  const grid = () => container.querySelector('[data-grid]');
  const filtered = () => {
    const term = q.trim().toLowerCase();
    const list = load().filter(v => showDeleted ? !!v.deletedAt : !v.deletedAt).sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0));
    if (!term) return list;
    return list.filter(v => [v.title, v.page, v.desc, v.num].some(x => String(x || '').toLowerCase().includes(term)));
  };

  function openPlayer(v) {
    const m = modal({
      title: `${esc(v.title)} <span class="badge badge-info" style="margin-inline-start:6px">#${esc(String(v.num || ''))}</span>`,
      body: `<div>
        <div class="small muted mb-1">${t('tutorials_page')}: ${esc(v.page || '-')}</div>
        <video controls autoplay src="${v.data}" style="width:100%;max-height:62vh;border-radius:12px;background:#000"></video>
        ${v.desc ? `<p class="small muted" style="margin-top:10px">${esc(v.desc)}</p>` : ''}
      </div>`,
      footer: `<button class="btn btn-ghost" data-close>${t('close')}</button>`,
      size: 'lg',
    });
    m.querySelector('[data-close]').onclick = () => m.close();
  }

  function openForm(v = null) {
    const edit = !!v;
    const m = modal({
      title: edit ? t('tutorials_edit') : t('tutorials_add'),
      body: `<div class="form-grid">
        <div class="field span-2"><label>${t('tutorials_title')}</label><input class="input" name="title" value="${esc(v?.title || '')}" placeholder="${t('tutorials_title_ph')}"></div>
        <div class="field"><label>${t('tutorials_page')}</label><input class="input" name="page" value="${esc(v?.page || '')}" placeholder="${t('tutorials_page_ph')}"></div>
        <div class="field"><label>${t('tutorials_number')}</label><input class="input" name="num" type="number" min="1" value="${esc(String(v?.num ?? ''))}"></div>
        <div class="field span-2"><label>${t('tutorials_desc')}</label><textarea class="textarea" name="desc" rows="3" placeholder="${t('tutorials_desc_ph')}">${esc(v?.desc || '')}</textarea></div>
        <div class="field span-2"><label>${t('tutorials_file')}</label><input class="input" name="file" type="file" accept="video/*"><div class="small muted" style="margin-top:4px">${edit ? t('tutorials_keep') : t('tutorials_file_hint')}</div></div>
      </div>`,
      footer: `<button class="btn btn-ghost" data-cancel>${t('cancel')}</button><button class="btn btn-primary" data-save>${icon('check', 'sm')} ${t('save')}</button>`,
      size: 'lg',
    });
    m.querySelector('[data-cancel]').onclick = () => m.close();
    m.querySelector('[data-save]').onclick = async () => {
      const f = (n) => m.querySelector(`[name="${n}"]`);
      const title = f('title').value.trim();
      const page = f('page').value.trim();
      const num = Number(f('num').value);
      const desc = f('desc').value.trim();
      const file = f('file').files && f('file').files[0];
      if (!title || !page || !Number.isFinite(num) || num <= 0) { toast(t('tutorials_required'), 'warn'); return; }
      if (!edit && !file) { toast(t('tutorials_file_required'), 'warn'); return; }
      const btn = m.querySelector('[data-save]'); btn.disabled = true;
      try {
        let media = edit ? { data: v.data, fileName: v.fileName, mime: v.mime, size: v.size } : {};
        if (file) media = { data: await readFile(file), fileName: file.name, mime: file.type || 'video/mp4', size: file.size };
        const now = new Date().toISOString();
        const list = load();
        if (edit) {
          const i = list.findIndex(x => x.id === v.id);
          if (i >= 0) list[i] = { ...list[i], title, page, num, desc, ...media, updatedAt: now };
          toast(t('msg_updated'));
        } else {
          list.push({ id: uid(), title, page, num, desc, ...media, createdAt: now, updatedAt: now });
          toast(t('msg_added'));
        }
        save(list); m.close(); draw();
      } catch (e) { toast(t('tutorials_save_error'), 'error'); }
      finally { btn.disabled = false; }
    };
  }

  async function remove(v) {
    if (!(await confirmDialog(`${t('confirm_delete')}: ${v.title}`))) return;
    save(load().map(x => x.id === v.id ? { ...x, deletedAt: new Date().toISOString() } : x));
    toast(t('msg_deleted')); draw();
  }

  function restore(v) {
    save(load().map(x => x.id === v.id ? { ...x, deletedAt: null, restoredAt: new Date().toISOString() } : x));
    toast(t('msg_restored') || 'تمت الاستعادة'); draw();
  }

  async function purge(v) {
    if (!(await confirmDialog(`${t('confirm_delete')}: ${v.title}`))) return;
    save(load().filter(x => x.id !== v.id));
    toast(t('msg_deleted')); draw();
  }

  function draw() {
    const rows = filtered();
    container.querySelector('[data-count]').textContent = `${rows.length} ${showDeleted ? (t('deleted_items') || 'محذوف') : t('tutorials_videos')}`;
    container.querySelector('[data-trash]').classList.toggle('btn-primary', showDeleted);
    if (!rows.length) {
      grid().innerHTML = `<div style="grid-column:1/-1">${emptyState(showDeleted ? 'لا توجد فيديوهات محذوفة' : t('tutorials_empty'), 'play')}</div>
        ${showDeleted ? '' : `<div style="grid-column:1/-1;text-align:center"><button class="btn btn-primary" data-add-first>${icon('plus','sm')} ${t('tutorials_add_first')}</button></div>`}`;
      const b = grid().querySelector('[data-add-first]'); if (b) b.onclick = () => openForm();
      return;
    }
    grid().innerHTML = rows.map(v => `
      <div class="card" style="overflow:hidden;padding:0">
        <button type="button" data-play="${esc(v.id)}" style="display:grid;place-items:center;position:relative;width:100%;height:150px;border:0;cursor:pointer;background:linear-gradient(135deg,var(--surface-2,#eef2f7),var(--surface-3,#e2e8f0));color:var(--text,#111)">
          <span style="display:grid;place-items:center;width:54px;height:54px;border-radius:16px;background:var(--primary,#2563eb);color:#fff;font-size:22px">▶</span>
          <span class="badge badge-info" style="position:absolute;top:10px;inset-inline-end:10px">#${esc(String(v.num||''))}</span>
        </button>
        <div style="padding:12px">
          <h3 style="margin:0 0 2px;font-size:14px">${esc(v.title)}</h3>
          <div class="small muted">${t('tutorials_page')}: ${esc(v.page || '-')}</div>
          ${v.desc ? `<p class="small muted" style="margin:6px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(v.desc)}</p>` : ''}
          <div class="row between small muted" style="margin-top:8px"><span>${human(v.size)}</span><span>${esc(fmtDateTime(v.updatedAt || v.createdAt))}</span></div>
          <div class="row" style="gap:8px;margin-top:10px">
            ${showDeleted
              ? `<button class="btn btn-primary btn-sm" data-restore="${esc(v.id)}">${icon('check','sm')} ${t('restore') || 'استعادة'}</button>
                 <button class="btn btn-ghost btn-sm danger" data-purge="${esc(v.id)}">${icon('trash','sm')} ${t('delete')}</button>`
              : `<button class="btn btn-ghost btn-sm" data-edit="${esc(v.id)}">${icon('edit','sm')} ${t('edit')}</button>
                 <button class="btn btn-ghost btn-sm danger" data-del="${esc(v.id)}">${icon('trash','sm')} ${t('delete')}</button>`}
          </div>
        </div>
      </div>`).join('');
    grid().querySelectorAll('[data-play]').forEach(b => b.onclick = () => { const v = load().find(x => x.id === b.dataset.play); if (v) openPlayer(v); });
    grid().querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { const v = load().find(x => x.id === b.dataset.edit); if (v) openForm(v); });
    grid().querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const v = load().find(x => x.id === b.dataset.del); if (v) remove(v); });
    grid().querySelectorAll('[data-restore]').forEach(b => b.onclick = () => { const v = load().find(x => x.id === b.dataset.restore); if (v) restore(v); });
    grid().querySelectorAll('[data-purge]').forEach(b => b.onclick = () => { const v = load().find(x => x.id === b.dataset.purge); if (v) purge(v); });
  }

  container.querySelector('[data-q]').oninput = (e) => { q = e.target.value; draw(); };
  container.querySelector('[data-add]').onclick = () => openForm();
  container.querySelector('[data-trash]').onclick = () => { showDeleted = !showDeleted; draw(); };
  draw();
}
