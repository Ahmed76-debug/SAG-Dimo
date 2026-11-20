/* ============================================================
   فيديوهات شرح الصفحات (محلي في المتصفح)
   ============================================================ */
import { icon, esc, fmt } from '../core.js';
import { modal, toast, confirmDialog } from '../ui.js';

const KEY = 'baraka_tutorial_videos_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const save = (list) => localStorage.setItem(KEY, JSON.stringify(list));
const uid = () => 'tv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
const human = (b) => { b = Number(b) || 0; if (b > 1048576) return (b / 1048576).toFixed(1) + ' MB'; if (b > 1024) return (b / 1024).toFixed(0) + ' KB'; return b + ' B'; };
const readFile = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });

export async function render(root) {
  let q = '';
  let showDeleted = false;
  root.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div class="row gap-2" style="flex:1;max-width:420px">
          <div class="input-icon" style="flex:1">${icon('search')}<input class="input" data-q placeholder="ابحث بالاسم أو الصفحة أو الرقم..."></div>
        </div>
        <div class="row gap-2">
          <button class="btn btn-sm btn-secondary" data-trash>${icon('trash')} سلة المحذوفات</button>
          <span class="badge badge-info" data-count></span>
          <button class="btn btn-primary" data-add>${icon('plus')} إضافة فيديو</button>
        </div>
      </div>
      <div style="padding:16px"><div data-grid style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px"></div></div>
    </div>`;

  const grid = () => root.querySelector('[data-grid]');
  const filtered = () => {
    const term = q.trim().toLowerCase();
    const list = load()
      .filter(v => (showDeleted ? !!v.deletedAt : !v.deletedAt))
      .sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0));
    if (!term) return list;
    return list.filter(v => [v.title, v.page, v.desc, v.num].some(x => String(x || '').toLowerCase().includes(term)));
  };

  function openPlayer(v) {
    const m = modal({
      title: `${esc(v.title)} <span class="badge badge-info">#${esc(String(v.num || ''))}</span>`,
      body: `<div><div class="small muted mb-2">الصفحة: ${esc(v.page || '-')}</div>
        <video controls autoplay src="${v.data}" style="width:100%;max-height:62vh;border-radius:12px;background:#000"></video>
        ${v.desc ? `<p class="small muted" style="margin-top:10px">${esc(v.desc)}</p>` : ''}</div>`,
      footer: '<button class="btn btn-secondary" data-close>إغلاق</button>',
      size: 'lg',
    });
    m.root.querySelector('[data-close]').onclick = () => m.close();
  }

  function openForm(v = null) {
    const edit = !!v;
    const m = modal({
      title: edit ? 'تعديل الفيديو' : 'إضافة فيديو شرح',
      subtitle: 'أدخل بيانات الفيديو وارفع ملف الشرح',
      body: `<div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field" style="grid-column:1/-1"><label>اسم الفيديو (الصفحة المشروحة)</label><input class="input" name="title" value="${esc(v?.title || '')}" placeholder="مثال: شرح لوحة التحكم"></div>
        <div class="field"><label>اسم الصفحة</label><input class="input" name="page" value="${esc(v?.page || '')}"></div>
        <div class="field"><label>رقم الفيديو</label><input class="input" name="num" type="number" min="1" value="${esc(String(v?.num ?? ''))}"></div>
        <div class="field" style="grid-column:1/-1"><label>وصف مختصر</label><textarea class="input" name="desc" rows="3">${esc(v?.desc || '')}</textarea></div>
        <div class="field" style="grid-column:1/-1"><label>ملف الفيديو</label><input class="input" name="file" type="file" accept="video/*"><div class="tiny muted" style="margin-top:4px">${edit ? 'اتركه فارغًا للإبقاء على الملف الحالي.' : 'اختر ملف فيديو للرفع.'}</div></div>
      </div>`,
      footer: '<button class="btn btn-secondary" data-cancel>إلغاء</button><button class="btn btn-primary" data-save>حفظ</button>',
      size: 'lg',
    });
    m.root.querySelector('[data-cancel]').onclick = () => m.close();
    m.root.querySelector('[data-save]').onclick = async () => {
      const g = n => m.root.querySelector(`[name="${n}"]`);
      const title = g('title').value.trim();
      const page = g('page').value.trim();
      const num = Number(g('num').value);
      const desc = g('desc').value.trim();
      const file = g('file').files && g('file').files[0];
      if (!title || !page || !Number.isFinite(num) || num <= 0) { toast('أدخل اسم الفيديو والصفحة ورقمًا صحيحًا.', 'warn'); return; }
      if (!edit && !file) { toast('يرجى اختيار ملف فيديو.', 'warn'); return; }
      const btn = m.root.querySelector('[data-save]'); btn.disabled = true;
      try {
        let media = edit ? { data: v.data, fileName: v.fileName, mime: v.mime, size: v.size } : {};
        if (file) media = { data: await readFile(file), fileName: file.name, mime: file.type || 'video/mp4', size: file.size };
        const now = new Date().toISOString();
        const list = load();
        if (edit) {
          const i = list.findIndex(x => x.id === v.id);
          if (i >= 0) list[i] = { ...list[i], title, page, num, desc, ...media, updatedAt: now };
          toast('تم تحديث الفيديو');
        } else {
          list.push({ id: uid(), title, page, num, desc, ...media, createdAt: now, updatedAt: now });
          toast('تمت إضافة الفيديو');
        }
        save(list); m.close(); draw();
      } catch (e) { toast('تعذر حفظ الفيديو (قد يكون الملف كبيرًا).', 'danger'); }
      finally { btn.disabled = false; }
    };
  }

  async function remove(v) {
    const ok = await confirmDialog({ title: 'نقل الفيديو إلى السلة؟', message: `سيتم نقل "${v.title}" إلى سلة المحذوفات ويمكن استعادته لاحقًا.`, danger: true, confirmText: 'حذف', iconName: 'trash' });
    if (!ok) return;
    save(load().map(x => x.id === v.id ? { ...x, deletedAt: new Date().toISOString() } : x));
    toast('تم نقل الفيديو إلى سلة المحذوفات'); draw();
  }

  async function restore(v) {
    save(load().map(x => x.id === v.id ? { ...x, deletedAt: null, restoredAt: new Date().toISOString() } : x));
    toast('تمت استعادة الفيديو'); draw();
  }

  async function purge(v) {
    const ok = await confirmDialog({ title: 'حذف نهائي؟', message: `سيتم حذف "${v.title}" نهائيًا ولا يمكن استعادته.`, danger: true, confirmText: 'حذف نهائي', iconName: 'trash' });
    if (!ok) return;
    save(load().filter(x => x.id !== v.id));
    toast('تم الحذف النهائي'); draw();
  }

  function draw() {
    const rows = filtered();
    root.querySelector('[data-count]').textContent = rows.length + (showDeleted ? ' محذوف' : ' فيديو');
    const trashBtn = root.querySelector('[data-trash]');
    if (trashBtn) {
      trashBtn.classList.toggle('btn-primary', showDeleted);
      trashBtn.classList.toggle('btn-secondary', !showDeleted);
    }
    if (!rows.length) {
      grid().innerHTML = `<div style="grid-column:1/-1;padding:30px;text-align:center;color:var(--muted)">
        <div style="font-size:40px;margin-bottom:8px">🎬</div><div style="font-weight:700;margin-bottom:6px">${showDeleted ? 'لا توجد فيديوهات محذوفة' : 'لا توجد فيديوهات شرح بعد'}</div>
        <div class="small" style="margin-bottom:12px">${showDeleted ? 'كل ما تحذفه من فيديوهات سيظهر هنا لإمكانية استعادته.' : 'أضف فيديو يشرح إحدى صفحات البرنامج ليعود إليه المستخدم عند الحاجة.'}</div>
        ${showDeleted ? '' : `<button class="btn btn-primary" data-add-first>${icon('plus')} إضافة أول فيديو</button>`}</div>`;
      const b = grid().querySelector('[data-add-first]'); if (b) b.onclick = () => openForm();
      return;
    }
    grid().innerHTML = rows.map(v => `
      <div class="card" style="padding:0;overflow:hidden">
        <button type="button" data-play="${esc(v.id)}" style="display:grid;place-items:center;position:relative;width:100%;height:150px;border:0;cursor:pointer;background:linear-gradient(135deg,var(--surface-2),var(--surface-3))">
          <span style="display:grid;place-items:center;width:54px;height:54px;border-radius:16px;background:var(--brand);color:#fff;font-size:22px">▶</span>
          <span class="badge badge-info" style="position:absolute;top:10px;inset-inline-end:10px">#${esc(String(v.num || ''))}</span>
        </button>
        <div style="padding:12px">
          <h3 style="margin:0 0 2px;font-size:14px">${esc(v.title)}</h3>
          <div class="small muted">الصفحة: ${esc(v.page || '-')}</div>
          ${v.desc ? `<p class="small muted" style="margin:6px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(v.desc)}</p>` : ''}
          <div class="row between small muted" style="margin-top:8px"><span>${human(v.size)}</span><span>${esc(fmt.datetime(v.updatedAt || v.createdAt))}</span></div>
          <div class="row gap-2" style="margin-top:10px">
            ${showDeleted
              ? `<button class="btn btn-sm btn-primary" data-restore="${esc(v.id)}">${icon('refresh')} استعادة</button>
                 <button class="btn btn-sm" data-purge="${esc(v.id)}" style="color:var(--danger)">${icon('trash')} حذف نهائي</button>`
              : `<button class="btn btn-sm btn-secondary" data-edit="${esc(v.id)}">${icon('edit')} تعديل</button>
                 <button class="btn btn-sm" data-del="${esc(v.id)}" style="color:var(--danger)">${icon('trash')} حذف</button>`}
          </div>
        </div>
      </div>`).join('');
    grid().querySelectorAll('[data-play]').forEach(b => b.onclick = () => { const v = load().find(x => x.id === b.dataset.play); if (v) openPlayer(v); });
    grid().querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { const v = load().find(x => x.id === b.dataset.edit); if (v) openForm(v); });
    grid().querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const v = load().find(x => x.id === b.dataset.del); if (v) remove(v); });
    grid().querySelectorAll('[data-restore]').forEach(b => b.onclick = () => { const v = load().find(x => x.id === b.dataset.restore); if (v) restore(v); });
    grid().querySelectorAll('[data-purge]').forEach(b => b.onclick = () => { const v = load().find(x => x.id === b.dataset.purge); if (v) purge(v); });
  }

  root.querySelector('[data-q]').oninput = (e) => { q = e.target.value; draw(); };
  root.querySelector('[data-add]').onclick = () => openForm();
  root.querySelector('[data-trash]').onclick = () => { showDeleted = !showDeleted; draw(); };
  draw();
}
