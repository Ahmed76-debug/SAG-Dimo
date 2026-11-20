/* ============================================================
   النسخ الاحتياطي — إنشاء، رفع، استعادة، حماية البيانات
   ============================================================ */
import { api, icon, esc, fmt } from '../core.js';
import { toast, modal, confirmDialog, emptyState, setLoading } from '../ui.js';
import { sectionHead } from './_shared.js';

export async function render(root, { params } = {}) {
  let alive = true;
  let data = null;
  let createRequested = false;

  root.innerHTML = `<div class="backup-hero">
    <div class="bh-icon">${icon('database')}</div>
    <div><h2>حماية بيانات متجرك</h2><p>أنشئ نسخة كاملة من قاعدة البيانات، ويمكنك استعادتها في أي وقت.</p></div>
  </div>
  <div class="skeleton mt-3" style="height:360px;border-radius:18px"></div>`;

  async function load() {
    try {
      data = await api('/backup');
      if (!alive) return;
      paint();
      if (!createRequested && params?.get('create') === '1') {
        createRequested = true;
        history.replaceState(null, '', '#/backup');
        setTimeout(() => createBackup(), 250);
      }
    } catch (e) {
      if (!alive) return;
      root.innerHTML = `<div class="card"><div class="empty">
        <div class="empty-ico">${icon('alert')}</div>
        <div class="empty-title">تعذر تحميل النسخ الاحتياطي</div>
        <div class="empty-text">${esc(e.message)}</div>
        <button class="btn btn-secondary mt-2" data-retry-backup>${icon('refresh')} إعادة المحاولة</button>
      </div></div>`;
      root.querySelector('[data-retry-backup]')?.addEventListener('click', load);
    }
  }

  function paint() {
    const backups = data.backups || [];
    const last = backups[0];
    const custom = Boolean(data.folder);
    const lastText = last ? fmt.relative(last.created_at) : 'لا توجد نسخة بعد';
    const folderLabel = custom ? (data.exists ? 'مجلد مخصص' : 'مجلد غير متاح') : 'المجلد الافتراضي';

    root.innerHTML = `
      <div class="backup-hero">
        <div class="bh-icon">${icon('database')}</div>
        <div>
          <h2>حماية بيانات متجرك</h2>
          <p>نسخة كاملة من قاعدة البيانات تشمل المبيعات والمخزون والحسابات. احفظها خارج الخادم لتأمينها من الأعطال.</p>
          <div class="bh-stat">
            <span>آخر نسخة <b>${esc(lastText)}</b></span>
            <span>عدد النسخ <b>${fmt.int(backups.length)}</b></span>
            <span>حجم البيانات <b>${fmt.bytes(data.db_size)}</b></span>
            <span>النسخ التلقائي <b style="color:${data.auto_backup ? '#6ee7b7' : '#fbbf24'}">${data.auto_backup ? 'مفعّل' : 'متوقف'}</b></span>
          </div>
        </div>
        <div class="spacer"></div>
        <div class="bh-actions">
          <button class="btn btn-primary" data-create-backup>${icon('download')} إنشاء نسخة الآن</button>
          <button class="btn" data-upload-trigger style="background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);color:#eafff6">${icon('upload')} رفع نسخة</button>
          <input type="file" accept=".db,.sqlite,.sqlite3,.backup" data-file-input hidden />
        </div>
      </div>

      <div class="grid g2 mt-3">
        <div class="card">
          ${sectionHead('مجلد الحفظ', 'حدد مكان حفظ النسخ على الخادم أو الكمبيوتر')}
          <div class="field">
            <label for="backup-folder">مسار المجلد</label>
            <input class="input" id="backup-folder" dir="ltr" style="text-align:left" value="${esc(data.folder || data.default_dir)}" placeholder="${esc(data.default_dir)}" />
            <span class="hint">على Windows مثلًا: <span class="mono">D:\\Baraka-Backups</span> — سيتم إنشاء المجلد إذا لم يكن موجودًا.</span>
          </div>
          <div class="row wrap" style="gap:7px">
            <span class="badge ${custom ? (data.exists ? 'badge-success' : 'badge-danger') : 'badge-info'}">${icon('folder', 'icon-sm')} ${folderLabel}</span>
            <span class="badge badge-muted" style="direction:ltr">${esc(data.folder || data.default_dir)}</span>
          </div>
          <div class="row between mt-3" style="border-top:1px solid var(--border);padding-top:12px;flex-wrap:wrap;gap:8px">
            <button class="btn btn-sm btn-ghost" data-use-default>${icon('refresh', 'icon-sm')} استخدام الافتراضي</button>
            <button class="btn btn-sm btn-primary" data-save-folder>${icon('save', 'icon-sm')} حفظ المجلد</button>
          </div>
        </div>

        <div class="card">
          ${sectionHead('النسخ التلقائي', 'جدولة حماية دورية دون تدخل يدوي')}
          <div class="setting-row">
            <div><b>تفعيل النسخ التلقائي</b><span>ينشئ الخادم نسخة يومية عند تشغيله إذا مرّ أكثر من 20 ساعة على آخر نسخة.</span></div>
            <label class="switch"><input type="checkbox" data-auto-backup ${data.auto_backup ? 'checked' : ''} /><span class="switch-track"></span></label>
          </div>
          <div class="setting-row">
            <div><b>عدد النسخ المحفوظة</b><span>تُحذف أقدم النسخ تلقائيًا عند تجاوز العدد المحدد.</span></div>
            <div class="row" style="gap:5px">
              <input class="input" type="number" min="3" max="365" step="1" value="${esc(data.keep)}" data-keep-backups style="width:78px;text-align:center" />
              <span class="small muted">نسخة</span>
            </div>
          </div>
          <div class="row between mt-3" style="border-top:1px solid var(--border);padding-top:12px">
            <span class="tiny muted">${icon('info', 'icon-sm')} الحد الأدنى 3 نسخ.</span>
            <button class="btn btn-sm btn-primary" data-save-backup-settings>${icon('save', 'icon-sm')} حفظ الإعدادات</button>
          </div>
        </div>
      </div>

      <div class="card flush mt-3">
        <div class="card-head" style="padding:16px 18px 12px;margin:0">
          <div><div class="card-title">${icon('folder', 'icon-sm')} النسخ المتاحة</div><div class="card-sub">${fmt.int(backups.length)} نسخة — يمكنك التحميل أو الاستعادة أو الحذف</div></div>
          <div class="spacer"></div>
          <button class="btn btn-sm btn-secondary" data-refresh-backups>${icon('refresh')} تحديث</button>
        </div>
        ${backups.length ? `<div class="backup-list">
          ${backups.map((b) => `<div class="backup-row">
            <div class="b-ico">${icon(b.name.includes('auto') ? 'clock' : b.name.includes('pre-restore') ? 'shield' : 'database')}</div>
            <div class="b-body">
              <b title="${esc(b.name)}">${esc(b.name)}</b>
              <div class="b-meta">${esc(fmt.datetime(b.created_at))} · ${fmt.bytes(b.size)} · ${b.is_default ? 'المجلد الافتراضي' : 'مجلد مخصص'}${b.name.includes('pre-restore') ? ' · نسخة أمان' : b.name.includes('auto') ? ' · تلقائية' : ''}</div>
            </div>
            <div class="b-actions">
              <a class="icon-btn" href="/api/backup/download/${encodeURIComponent(b.name)}?folder=${encodeURIComponent(b.dir)}" title="تحميل النسخة" download>${icon('download')}</a>
              <button class="icon-btn" data-restore-backup data-name="${esc(b.name)}" data-dir="${esc(b.dir)}" title="استعادة">${icon('refresh')}</button>
              <button class="icon-btn danger" data-delete-backup data-name="${esc(b.name)}" data-dir="${esc(b.dir)}" title="حذف">${icon('trash')}</button>
            </div>
          </div>`).join('')}
        </div>` : emptyState({
          title: 'لا توجد نسخ احتياطية بعد',
          text: 'أنشئ أول نسخة الآن لحماية بيانات متجرك.',
          iconName: 'database',
          action: '<button class="btn btn-primary" data-create-backup>إنشاء نسخة احتياطية</button>',
        })}
      </div>

      <div class="alert alert-info mt-3" style="align-items:flex-start">
        ${icon('shield')}
        <div>
          <b>نصيحة لحماية بياناتك</b>
          <div class="small" style="margin-top:2px;line-height:1.8">احفظ نسخة على قرص خارجي أو مجلد سحابي متزامن. عند الاستعادة يُنشئ النظام نسخة أمان تلقائية قبل استبدال البيانات، ثم يُطلب منك تسجيل الدخول مجددًا.</div>
        </div>
      </div>`;

    // أزرار الإنشاء قد تظهر في الهيرو والحالة الفارغة
    root.querySelectorAll('[data-create-backup]').forEach((b) => b.addEventListener('click', () => createBackup(b)));
    root.querySelector('[data-upload-trigger]')?.addEventListener('click', () => fileInput()?.click());
    root.querySelector('[data-file-input]')?.addEventListener('change', onFilePicked);
    root.querySelector('[data-save-folder]')?.addEventListener('click', (e) => saveFolder(e.currentTarget, root.querySelector('#backup-folder')?.value));
    root.querySelector('[data-use-default]')?.addEventListener('click', (e) => {
      const input = root.querySelector('#backup-folder');
      if (input) input.value = data.default_dir;
      saveFolder(e.currentTarget, data.default_dir);
    });
    root.querySelector('[data-save-backup-settings]')?.addEventListener('click', (e) => saveBackupSettings(e.currentTarget));
    root.querySelector('[data-refresh-backups]')?.addEventListener('click', load);
    root.querySelectorAll('[data-restore-backup]').forEach((b) => b.addEventListener('click', () => restoreBackup({ name: b.dataset.name, dir: b.dataset.dir })));
    root.querySelectorAll('[data-delete-backup]').forEach((b) => b.addEventListener('click', () => deleteBackup({ name: b.dataset.name, dir: b.dataset.dir })));
  }

  function fileInput() {
    return root.querySelector('[data-file-input]');
  }

  async function createBackup(btn) {
    if (!alive || !data) return;
    const button = btn || root.querySelector('[data-create-backup]');
    setLoading(button, true, 'جارٍ إنشاء النسخة…');
    try {
      const res = await api('/backup', { method: 'POST', body: { folder: data.folder || '' } });
      toast(res.message || 'تم إنشاء النسخة الاحتياطية');
      await load();
    } catch (e) {
      toast(e.message, 'error');
      setLoading(button, false);
    }
  }

  async function saveFolder(btn, folder) {
    const value = String(folder || '').trim();
    if (!value) { toast('أدخل مسار المجلد أولًا', 'error'); return; }
    setLoading(btn, true, 'جارٍ فحص المجلد…');
    try {
      const res = await api('/backup/folder', { method: 'POST', body: { folder: value } });
      toast(res.message || 'تم حفظ المجلد');
      await load();
    } catch (e) {
      toast(e.message, 'error');
      setLoading(btn, false);
    }
  }

  async function saveBackupSettings(btn) {
    if (!data) return;
    const auto = root.querySelector('[data-auto-backup]')?.checked ? 1 : 0;
    const keep = Math.max(3, Number(root.querySelector('[data-keep-backups]')?.value) || 30);
    setLoading(btn, true, 'جارٍ الحفظ…');
    try {
      const res = await api('/backup/settings', { method: 'PUT', body: { auto_backup: auto, keep } });
      toast(res.message || 'تم حفظ إعدادات النسخ');
      await load();
    } catch (e) {
      toast(e.message, 'error');
      setLoading(btn, false);
    }
  }

  function onFilePicked(e) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/\.(db|sqlite|sqlite3|backup)$/i.test(file.name)) {
      toast('صيغة الملف غير مدعومة (db / sqlite / backup)', 'error');
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      toast('حجم الملف أكبر من 200 ميجابايت', 'error');
      return;
    }
    openUploadModal(file);
  }

  function openUploadModal(file) {
    const m = modal({
      title: 'رفع نسخة احتياطية',
      subtitle: 'اختر طريقة التعامل مع الملف المرفوع',
      size: 'sm',
      body: `<div class="alert alert-info" style="align-items:flex-start">${icon('database')}
          <div><b style="display:block;direction:ltr;text-align:start;font-size:11px;word-break:break-all">${esc(file.name)}</b>
          <span class="small">${fmt.bytes(file.size)}</span></div>
        </div>
        <div class="small" style="line-height:1.9;color:var(--text-2)">
          يمكنك رفع النسخة إلى قائمة النسخ للاحتفاظ بها، أو رفعها واستعادة بياناتها فورًا. الاستعادة تُنشئ نسخة أمان قبل استبدال البيانات وتُنهي جلستك الحالية.
        </div>`,
      footer: `<button class="btn btn-secondary" data-close>إلغاء</button>
        <button class="btn btn-secondary" data-upload-only>${icon('upload')} رفع فقط</button>
        <button class="btn btn-danger" data-upload-restore>${icon('refresh')} رفع واستعادة</button>`,
    });
    m.root.querySelector('[data-upload-only]').addEventListener('click', (e) => uploadFile(file, false, e.currentTarget, m));
    m.root.querySelector('[data-upload-restore]').addEventListener('click', (e) => uploadFile(file, true, e.currentTarget, m));
  }

  async function uploadFile(file, restore, btn, m) {
    setLoading(btn, true, restore ? 'جارٍ الرفع والاستعادة…' : 'جارٍ رفع النسخة…');
    try {
      const res = await api(`/backup/upload${restore ? '?restore=1' : ''}`, {
        method: 'POST',
        raw: file,
        headers: { 'x-filename': file.name },
      });
      m.close();
      toast(res.message || 'تم رفع النسخة');
      if (restore) showReauth(res);
      else await load();
    } catch (e) {
      toast(e.message, 'error');
      setLoading(btn, false);
    }
  }

  async function restoreBackup(b) {
    if (!b?.name) return;
    const yes = await confirmDialog({
      title: 'استعادة نسخة احتياطية',
      message: `سيتم استبدال البيانات الحالية ببيانات النسخة «${esc(b.name)}». يُنشئ النظام نسخة أمان تلقائية قبل الاستعادة، وسيتم تسجيل خروجك بعدها. هل تريد المتابعة؟`,
      confirmText: 'استعادة البيانات',
      danger: true,
      iconName: 'refresh',
    });
    if (!yes) return;
    try {
      const res = await api('/backup/restore', { method: 'POST', body: { name: b.name, folder: b.dir } });
      toast(res.message || 'تمت الاستعادة');
      showReauth(res);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function deleteBackup(b) {
    if (!b?.name) return;
    const yes = await confirmDialog({
      title: 'حذف النسخة الاحتياطية',
      message: `هل تريد حذف «${esc(b.name)}» نهائيًا؟ لا يمكن التراجع عن الحذف.`,
      confirmText: 'حذف', danger: true, iconName: 'trash',
    });
    if (!yes) return;
    try {
      const res = await api(`/backup/${encodeURIComponent(b.name)}?folder=${encodeURIComponent(b.dir)}`, { method: 'DELETE' });
      toast(res.message || 'تم حذف النسخة');
      await load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function showReauth(res) {
    const m = modal({
      title: 'تمت استعادة النسخة بنجاح',
      subtitle: 'خطوة أخيرة لاستكمال العمل',
      size: 'sm',
      showClose: false,
      closeOnBackdrop: false,
      body: `<div class="empty" style="padding:12px 0 4px">
        <div class="empty-ico" style="background:var(--brand-soft);color:var(--brand)">${icon('check-circle')}</div>
        <div class="empty-title">بياناتك أصبحت جاهزة</div>
        <div class="empty-text">تم استبدال البيانات بنجاح${res?.safety ? `، وتم إنشاء نسخة أمان باسم <b class="mono" style="direction:ltr;display:inline-block">${esc(res.safety)}</b>` : ''}. يرجى تسجيل الدخول مجددًا للمتابعة.</div>
      </div>`,
      footer: '<button class="btn btn-primary" data-reload-app>تسجيل الدخول مجددًا</button>',
      onMount: (apiRoot) => {
        apiRoot.root.querySelector('[data-reload-app]').addEventListener('click', () => location.reload());
      },
    });
    setTimeout(() => m.root.querySelector('[data-reload-app]')?.focus(), 80);
  }

  await load();
  return () => { alive = false; };
}
