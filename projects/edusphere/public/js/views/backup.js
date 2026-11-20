import { h, icon } from '../core/dom.js';
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { pageHeader, card, emptyState, spinner, notify, confirmDialog } from '../core/ui.js';
import { L, humanSize, dateTimeFmt } from './common.js';

export default async function renderBackup() {
  if (!store.can('backup.manage')) {
    return h('div', { class: 'view' }, card({ body: emptyState({ iconName: 'shield', title: L('Access denied', 'الوصول مرفوض') }) }));
  }

  const host = h('div');
  const settingsHost = h('div');

  async function load() {
    host.replaceChildren(h('div', { style: { padding: '28px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
    try {
      const [list, settings] = await Promise.all([api.get('/api/backup/list'), api.get('/api/backup/settings')]);
      renderList(list);
      renderSettings(settings.settings || settings);
    } catch (err) {
      host.replaceChildren(h('div', { class: 'alert alert--danger' }, err.message));
    }
  }

  function renderList(data) {
    const backups = data.backups || data.rows || data.items || [];
    const folder = data.folder || data.path || '';
    const createBtn = h('button', { class: 'btn btn--primary', onclick: async () => {
      createBtn.disabled = true;
      try { await api.post('/api/backup/create', {}); notify.success(L('Backup created', 'تم إنشاء النسخة الاحتياطية')); load(); }
      catch (err) { notify.error(L('Backup failed', 'فشل النسخ الاحتياطي'), err.message); }
      finally { createBtn.disabled = false; }
    } }, icon('database'), L('Create backup', 'إنشاء نسخة احتياطية'));

    const table = backups.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, L('File', 'الملف')), h('th', {}, L('Size', 'الحجم')), h('th', {}, L('Created', 'تاريخ الإنشاء')), h('th', {}, L('Actions', 'إجراءات')))),
      h('tbody', {}, backups.map((b) => h('tr', {},
        h('td', {}, h('div', { class: 'strong' }, b.name || b.file || b.path), b.folder ? h('div', { class: 'faint', style: { fontSize: 'var(--fs-2xs)' } }, b.folder) : null),
        h('td', {}, humanSize(b.size || b.bytes || 0)),
        h('td', {}, dateTimeFmt(b.created_at || b.date || b.mtime)),
        h('td', {}, h('div', { class: 'row gap-2' },
          h('button', { class: 'btn btn--sm', onclick: () => api.download('/api/backup/download', b.name || 'backup.edusphere', { path: b.path || b.file }) }, icon('download'), L('Download', 'تنزيل')),
          h('button', { class: 'btn btn--sm', onclick: async () => {
            const ok = await confirmDialog({ title: L('Verify backup?', 'التحقق من النسخة؟'), message: b.name || b.path, confirmText: L('Verify', 'تحقق'), iconName: 'shield-check' });
            if (!ok) return;
            try { const r = await api.post('/api/backup/verify', { path: b.path || b.file }); notify.success(L('Backup verified', 'تم التحقق من النسخة'), r.message || L('The backup file is valid.', 'ملف النسخة صالح.')); }
            catch (err) { notify.error(L('Verification failed', 'فشل التحقق'), err.message); }
          } }, icon('shield-check'), L('Verify', 'تحقق')),
          h('button', { class: 'btn btn--sm btn--danger', onclick: async () => {
            const ok = await confirmDialog({ title: L('Restore backup?', 'استعادة النسخة الاحتياطية؟'), message: L('This will replace current data with the selected backup. A safety backup is recommended. This cannot be undone.', 'سيؤدي هذا لاستبدال البيانات الحالية بالنسخة المحددة. يُنصح بإنشاء نسخة أمان أولاً. لا يمكن التراجع.'), danger: true, confirmText: L('Restore', 'استعادة'), iconName: 'rotate-ccw' });
            if (!ok) return;
            try { await api.post('/api/backup/restore', { path: b.path || b.file }); notify.success(L('Restore completed', 'اكتملت الاستعادة'), L('Reloading application…', 'جارٍ إعادة تحميل التطبيق…')); setTimeout(() => window.location.reload(), 1200); }
            catch (err) { notify.error(L('Restore failed', 'فشلت الاستعادة'), err.message); }
          } }, icon('rotate-ccw'), L('Restore', 'استعادة')),
        ))))))
      )) : emptyState({ iconName: 'database', title: L('No backups yet', 'لا توجد نسخ احتياطية بعد'), message: L('Create your first backup to protect your data.', 'أنشئ أول نسخة احتياطية لحماية بياناتك.') });

    const upload = h('input', { type: 'file', accept: '.edusphere,.gz,application/gzip', class: 'sr-only' });
    upload.addEventListener('change', async () => {
      const f = upload.files?.[0]; if (!f) return;
      try {
        const res = await fetch(`/api/backup/upload?name=${encodeURIComponent(f.name)}`, { method: 'POST', credentials: 'same-origin', body: await f.arrayBuffer(), headers: { 'Content-Type': 'application/octet-stream' } });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Upload failed');
        notify.success(L('Backup uploaded', 'تم رفع النسخة الاحتياطية')); load();
      } catch (err) { notify.error(L('Upload failed', 'فشل الرفع'), err.message); }
      upload.value = '';
    });

    host.replaceChildren(
      h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' } },
        h('div', {}, folder ? h('div', { class: 'faint', style: { fontSize: 'var(--fs-xs)' } }, `${L('Folder', 'المجلد')}: ${folder}`) : null),
        h('div', { class: 'row gap-2' },
          h('button', { class: 'btn', onclick: () => upload.click() }, icon('upload'), L('Upload backup', 'رفع نسخة')), upload,
          h('button', { class: 'btn', onclick: load }, icon('refresh'), L('Refresh', 'تحديث')),
          createBtn)),
      table,
    );
  }

  function renderSettings(s) {
    const folder = h('input', { class: 'input', value: s.folder || s.path || '', placeholder: L('Backup folder path (local, external drive, etc.)', 'مسار مجلد النسخ الاحتياطي (محلي، قرص خارجي، إلخ)') });
    const auto = h('input', { type: 'checkbox', checked: !!(s.auto || s.auto_backup) });
    const freq = h('select', { class: 'select' }, ['daily', 'weekly', 'monthly'].map((v) => h('option', { value: v, selected: (s.frequency || 'daily') === v }, L(v[0].toUpperCase()+v.slice(1), v === 'daily' ? 'يومي' : v === 'weekly' ? 'أسبوعي' : 'شهري'))));
    const keep = h('input', { class: 'input', type: 'number', min: '1', value: s.keep || s.retention || 10 });
    const includeFiles = h('input', { type: 'checkbox', checked: s.include_files !== false });
    const save = h('button', { class: 'btn btn--primary', onclick: async () => {
      save.disabled = true;
      try {
        await api.put('/api/backup/settings', { folder: folder.value, auto: auto.checked ? 1 : 0, frequency: freq.value, keep: Number(keep.value) || 10, include_files: includeFiles.checked ? 1 : 0 });
        notify.success(L('Backup settings saved', 'تم حفظ إعدادات النسخ الاحتياطي'));
      } catch (err) { notify.error(L('Save failed', 'فشل الحفظ'), err.message); }
      finally { save.disabled = false; }
    } }, icon('save'), L('Save settings', 'حفظ الإعدادات'));

    settingsHost.replaceChildren(h('div', { class: 'form-grid' },
      h('label', { class: 'field span-full' }, h('span', { class: 'field__label' }, L('Backup destination folder', 'مجلد وجهة النسخ الاحتياطي')), folder, h('span', { class: 'field__hint' }, L('Choose any path on this PC, an external drive, or a mapped/cloud-synced folder.', 'اختر أي مسار على هذا الجهاز أو قرص خارجي أو مجلد سحابي مربوط.'))),
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('Automatic backups', 'نسخ احتياطي تلقائي')), h('label', { class: 'row gap-2' }, auto, L('Enable scheduled backups', 'تفعيل النسخ المجدول'))),
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('Frequency', 'التكرار')), freq),
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('Backups to keep', 'عدد النسخ المحتفظ بها')), keep),
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('Include uploaded files', 'تضمين الملفات المرفوعة')), h('label', { class: 'row gap-2' }, includeFiles, L('Include uploads in backup archive', 'تضمين المرفوعات في أرشيف النسخة'))),
    ), h('div', { style: { marginTop: '12px' } }, save));
  }

  load();

  return h('div', { class: 'view view--backup' },
    pageHeader({ title: L('Backup & restore', 'النسخ الاحتياطي والاسترجاع'), iconName: 'database', subtitle: L('Create, verify, download, upload and restore backups to any folder or drive.', 'أنشئ وتحقق ونزّل وارفع واستعد النسخ الاحتياطية إلى أي مجلد أو قرص.') }),
    h('div', { class: 'col gap-4' },
      card({ title: L('Backup files', 'ملفات النسخ الاحتياطي'), body: host }),
      card({ title: L('Backup settings', 'إعدادات النسخ الاحتياطي'), body: settingsHost }),
    ),
  );
}
