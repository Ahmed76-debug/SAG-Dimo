import { h, icon, humanSize } from '../core/dom.js';
import { pageHeader, card, emptyState, notify, openModal, confirmDialog, badge } from '../core/ui.js';
import { L, dateFmt } from './common.js';

/* =============================================================
   فيديوهات شرح البرنامج — تخزين محلي (يعمل بنفس الشكل على الويب
   وعلى نسخة سطح المكتب لأن كلاهما يستخدم نفس الواجهة).
   ============================================================= */

const TV_KEY = 'edusphere.tutorial.videos.v1';

function loadVideos() {
  try {
    return JSON.parse(localStorage.getItem(TV_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveVideos(list) {
  localStorage.setItem(TV_KEY, JSON.stringify(list));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

function sizeText(bytes) {
  return humanSize(Number(bytes) || 0);
}

export default async function renderTutorials() {
  const host = h('div');
  let query = '';
  let showDeleted = false;

  function filtered() {
    const term = query.trim().toLowerCase();
    const list = loadVideos()
      .filter((v) => (showDeleted ? !!v.deletedAt : !v.deletedAt))
      .sort((a, b) => (a.videoNumber || 0) - (b.videoNumber || 0));
    if (!term) return list;
    return list.filter((v) =>
      [v.title, v.pageName, v.description, String(v.videoNumber)]
        .some((x) => String(x || '').toLowerCase().includes(term)),
    );
  }

  function openPlayer(video) {
    openModal({
      title: `${video.title} (#${video.videoNumber})`,
      subtitle: `${L('Page', 'الصفحة')}: ${video.pageName}`,
      size: 'lg',
      body: h('div', { class: 'col gap-3' },
        h('video', {
          controls: true,
          autoplay: true,
          src: video.videoData,
          style: { width: '100%', borderRadius: '14px', background: '#000' },
        }),
        video.description ? h('p', { class: 'muted' }, video.description) : null,
      ),
      footer: h('button', { class: 'btn', onclick: () => document.querySelector('.overlay:last-of-type .modal__close')?.click() }, L('Close', 'إغلاق')),
    });
  }

  function openForm(existing = null) {
    const isEdit = Boolean(existing);
    const title = h('input', { class: 'input', value: existing?.title || '', placeholder: L('e.g. Dashboard overview', 'مثال: شرح صفحة لوحة القيادة') });
    const pageName = h('input', { class: 'input', value: existing?.pageName || '', placeholder: L('e.g. Dashboard', 'مثال: لوحة القيادة') });
    const videoNumber = h('input', { class: 'input', type: 'number', min: '1', value: existing?.videoNumber || '' });
    const description = h('textarea', { class: 'input', rows: '3', placeholder: L('What does this video explain?', 'ماذا يشرح هذا الفيديو؟') }, existing?.description || '');
    const file = h('input', { type: 'file', accept: 'video/*', class: 'input' });
    let modal = null;
    const save = h('button', {
      class: 'btn btn--primary',
      onclick: async () => {
        const t = title.value.trim();
        const p = pageName.value.trim();
        const n = Number(videoNumber.value);
        if (!t || !p || !Number.isFinite(n) || n <= 0) {
          notify.error(L('Missing data', 'بيانات ناقصة'), L('Enter a video name, page and a valid number.', 'أدخل اسم الفيديو والصفحة ورقمًا صحيحًا.'));
          return;
        }
        if (!isEdit && !file.files?.[0]) {
          notify.error(L('Video required', 'ملف مطلوب'), L('Please choose a video file.', 'يرجى اختيار ملف الفيديو.'));
          return;
        }
        save.disabled = true;
        try {
          let data = existing
            ? { videoData: existing.videoData, fileName: existing.fileName, mimeType: existing.mimeType, size: existing.size }
            : {};
          const chosen = file.files?.[0];
          if (chosen) {
            data = {
              videoData: await fileToDataUrl(chosen),
              fileName: chosen.name,
              mimeType: chosen.type || 'video/mp4',
              size: chosen.size,
            };
          }
          const now = new Date().toISOString();
          const list = loadVideos();
          if (isEdit) {
            const i = list.findIndex((x) => x.id === existing.id);
            if (i >= 0) list[i] = { ...list[i], title: t, pageName: p, videoNumber: n, description: description.value.trim(), ...data, updatedAt: now };
          } else {
            list.push({
              id: `tv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              title: t,
              pageName: p,
              videoNumber: n,
              description: description.value.trim(),
              ...data,
              createdAt: now,
              updatedAt: now,
            });
          }
          saveVideos(list);
          notify.success(isEdit ? L('Video updated', 'تم تحديث الفيديو') : L('Video added', 'تمت إضافة الفيديو'));
          modal?.close();
          render();
        } catch {
          notify.error(L('Could not save video', 'تعذر حفظ الفيديو'), L('The file may be too large for local storage.', 'قد يكون الملف كبيرًا جدًا للتخزين المحلي.'));
        } finally {
          save.disabled = false;
        }
      },
    }, icon('save'), L('Save', 'حفظ'));

    modal = openModal({
      title: isEdit ? L('Edit tutorial video', 'تعديل فيديو الشرح') : L('Add tutorial video', 'إضافة فيديو شرح'),
      subtitle: L('Enter the details and upload the video file.', 'أدخل بيانات الفيديو وارفع ملف الشرح.'),
      size: 'lg',
      body: h('div', { class: 'form-grid' },
        h('label', { class: 'field span-full' }, h('span', { class: 'field__label' }, L('Video name (explained page)', 'اسم الفيديو (الصفحة المشروحة)')), title),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('Page name', 'اسم الصفحة')), pageName),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('Video number', 'رقم الفيديو')), videoNumber),
        h('label', { class: 'field span-full' }, h('span', { class: 'field__label' }, L('Short description', 'وصف مختصر')), description),
        h('label', { class: 'field span-full' },
          h('span', { class: 'field__label' }, L('Video file', 'ملف الفيديو')),
          file,
          h('span', { class: 'field__hint' }, isEdit ? L('Leave empty to keep the current file.', 'اتركه فارغًا للإبقاء على الملف الحالي.') : L('Choose a video file to upload.', 'اختر ملف فيديو لرفعه.'))),
      ),
      footer: h('div', { class: 'row gap-2' },
        h('button', { class: 'btn', onclick: () => modal?.close() }, L('Cancel', 'إلغاء')),
        save),
    });
  }

  async function remove(video) {
    const ok = await confirmDialog({
      title: L('Move to trash?', 'نقل إلى سلة المحذوفات؟'),
      message: `${L('Move', 'نقل')} "${video.title}" ${L('to the trash? You can restore it later.', 'إلى سلة المحذوفات؟ يمكنك استعادته لاحقًا.')}`,
      danger: true,
      confirmText: L('Delete', 'حذف'),
      iconName: 'trash',
    });
    if (!ok) return;
    saveVideos(loadVideos().map((x) => (x.id === video.id ? { ...x, deletedAt: new Date().toISOString() } : x)));
    notify.success(L('Moved to trash', 'تم نقله إلى سلة المحذوفات'));
    render();
  }

  function restore(video) {
    saveVideos(loadVideos().map((x) => (x.id === video.id ? { ...x, deletedAt: null, restoredAt: new Date().toISOString() } : x)));
    notify.success(L('Restored', 'تمت الاستعادة'));
    render();
  }

  async function purge(video) {
    const ok = await confirmDialog({
      title: L('Delete forever?', 'حذف نهائي؟'),
      message: L('This cannot be undone.', 'لا يمكن التراجع عن الحذف النهائي.'),
      danger: true,
      confirmText: L('Delete forever', 'حذف نهائي'),
      iconName: 'trash',
    });
    if (!ok) return;
    saveVideos(loadVideos().filter((x) => x.id !== video.id));
    notify.success(L('Deleted', 'تم الحذف النهائي'));
    render();
  }

  function render() {
    const list = filtered();
    const search = h('input', {
      class: 'input',
      placeholder: L('Search by title, page or number…', 'بحث بالاسم أو الصفحة أو الرقم…'),
      value: query,
      style: { maxWidth: '360px' },
    });
    search.addEventListener('input', () => {
      query = search.value;
      renderGrid();
    });

    const grid = h('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' },
    });

    function renderGrid() {
      const rows = filtered();
      if (!rows.length) {
        grid.replaceChildren(card({
          body: emptyState({
            iconName: 'video',
            title: showDeleted ? L('No deleted videos', 'لا توجد فيديوهات محذوفة') : L('No tutorial videos yet', 'لا توجد فيديوهات بعد'),
            message: showDeleted
              ? L('Videos you delete appear here for restore.', 'كل ما تحذفه من فيديوهات سيظهر هنا لإمكانية استعادته.')
              : L('Add a video explaining one of the app pages.', 'أضف فيديو يشرح إحدى صفحات البرنامج.'),
            action: showDeleted ? null : h('button', { class: 'btn btn--primary', onclick: () => openForm() }, icon('plus'), L('Add first video', 'إضافة أول فيديو')),
          }),
        }));
        return;
      }
      grid.replaceChildren(...rows.map((v) => h('div', { class: 'card', style: { padding: '0', overflow: 'hidden' } },
        h('button', {
          type: 'button',
          onclick: () => openPlayer(v),
          style: {
            display: 'grid', placeItems: 'center', position: 'relative', width: '100%',
            height: '140px', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--brand-050), var(--surface-3))',
          },
        },
          h('span', {
            style: {
              display: 'grid', placeItems: 'center', width: '52px', height: '52px',
              borderRadius: '16px', background: 'var(--brand)', color: '#fff', fontSize: '20px',
            },
          }, '▶'),
          badge(`#${v.videoNumber}`, 'info'),
        ),
        h('div', { style: { padding: '12px' } },
          h('h3', { style: { margin: '0 0 2px', fontSize: 'var(--fs-sm)' } }, v.title),
          h('div', { class: 'muted', style: { fontSize: 'var(--fs-xs)' } }, `${L('Page', 'الصفحة')}: ${v.pageName}`),
          v.description ? h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)', margin: '6px 0 0' } }, v.description) : null,
          h('div', { class: 'faint', style: { fontSize: 'var(--fs-2xs)', marginTop: '8px', display: 'flex', justifyContent: 'space-between' } },
            h('span', {}, sizeText(v.size)),
            h('span', {}, dateFmt(v.updatedAt || v.createdAt))),
          h('div', { class: 'row gap-2', style: { marginTop: '10px' } },
            showDeleted
              ? h('button', { class: 'btn btn--sm btn--primary', onclick: () => restore(v) }, icon('check'), L('Restore', 'استعادة'))
              : h('button', { class: 'btn btn--sm', onclick: () => openForm(v) }, icon('edit'), L('Edit', 'تعديل')),
            h('button', { class: 'btn btn--sm btn--danger', onclick: () => (showDeleted ? purge(v) : remove(v)) }, icon('trash'), showDeleted ? L('Delete forever', 'حذف نهائي') : L('Delete', 'حذف'))),
        ),
      )));
    }

    renderGrid();
    host.replaceChildren(
      h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' } },
        search,
        h('div', { class: 'row gap-2' },
          h('button', {
            class: showDeleted ? 'btn btn--primary' : 'btn',
            onclick: () => { showDeleted = !showDeleted; render(); },
          }, icon('trash'), L('Trash', 'سلة المحذوفات')),
          badge(`${list.length} ${showDeleted ? L('deleted', 'محذوف') : L('videos', 'فيديو')}`, 'info'),
          h('button', { class: 'btn btn--primary', onclick: () => openForm() }, icon('plus'), L('Add video', 'إضافة فيديو')))),
      grid,
    );
  }

  render();

  return h('div', { class: 'view' },
    pageHeader({
      title: L('Tutorial videos', 'فيديوهات شرح البرنامج'),
      subtitle: L('A library of videos explaining the app pages — view, add, edit and delete.', 'مكتبة فيديوهات تشرح صفحات البرنامج — مشاهدة وإضافة وتعديل وحذف.'),
      iconName: 'video',
      actions: [],
    }),
    card({ body: host }),
  );
}
