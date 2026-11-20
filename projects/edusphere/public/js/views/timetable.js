import { h, icon } from '../core/dom.js';
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { pageHeader, card, emptyState, spinner, notify, confirmDialog, openModal } from '../core/ui.js';
import { L, loadRefOptions, refOptionsLabel } from './common.js';

const DAYS = [
  [1, 'Sunday', 'الأحد'], [2, 'Monday', 'الاثنين'], [3, 'Tuesday', 'الثلاثاء'],
  [4, 'Wednesday', 'الأربعاء'], [5, 'Thursday', 'الخميس'], [6, 'Friday', 'الجمعة'], [7, 'Saturday', 'السبت'],
];

export default async function renderTimetable() {
  if (!store.can('timetable_slots.read')) return card({ body: emptyState({ iconName: 'shield', title: L('Access denied', 'الوصول مرفوض') }) });

  const sectionSel = h('select', { class: 'select' }, h('option', { value: '' }, L('Select section…', 'اختر الشعبة…')));
  const host = h('div', {}, emptyState({ iconName: 'table', title: L('Select a section', 'اختر شعبة'), message: L('View and manage the weekly timetable.', 'اعرض وأدر الجدول الأسبوعي.') }));

  async function init() {
    const rows = await loadRefOptions('sections');
    for (const r of rows) sectionSel.appendChild(h('option', { value: r.value }, refOptionsLabel(r)));
  }
  init().catch(() => {});

  async function load() {
    const id = sectionSel.value;
    if (!id) return;
    host.replaceChildren(h('div', { style: { padding: '28px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
    try {
      const data = await api.get(`/api/timetable/${id}`);
      renderGrid(id, data);
    } catch (err) {
      host.replaceChildren(h('div', { class: 'alert alert--danger' }, err.message));
    }
  }

  function renderGrid(sectionId, data) {
    const slots = data.slots || data.rows || [];
    const byDay = new Map();
    for (const s of slots) {
      const d = Number(s.day_of_week || s.day || 0);
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(s);
    }
    for (const arr of byDay.values()) arr.sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));

    const canEdit = store.can('timetable_slots.create') || store.can('timetable_slots.update') || store.can('timetable_slots.delete');
    const grid = h('div', { class: 'timetable-grid' },
      DAYS.map(([d, en, ar]) => h('div', { class: 'timetable-day' },
        h('div', { class: 'timetable-day__head' }, L(en, ar)),
        h('div', { class: 'timetable-day__body' },
          (byDay.get(d) || []).length ? (byDay.get(d) || []).map((s) => slotCard(sectionId, s, load)) :
            h('div', { class: 'timetable-empty' }, L('No slots', 'لا توجد حصص')),
          canEdit ? h('button', { class: 'btn btn--ghost btn--sm', style: { width: '100%', marginTop: '6px' }, onclick: () => openSlotForm(sectionId, { day_of_week: d }, load) }, icon('plus'), L('Add slot', 'إضافة حصة')) : null,
        ),
      )),
    );
    host.replaceChildren(grid);
  }

  function slotCard(sectionId, s, reload) {
    const subject = L(s.subject_name_en || s.subject || '', s.subject_name_ar || s.subject_name_en || '') || '';
    const teacher = L(s.teacher_name_en || s.teacher || '', s.teacher_name_ar || s.teacher_name_en || '') || '';
    const room = s.room || s.classroom_name || '';
    const canEdit = store.can('timetable_slots.update') || store.can('timetable_slots.delete');
    const actions = canEdit ? h('div', { class: 'slot__actions' },
      store.can('timetable_slots.update') ? h('button', { class: 'icon-btn icon-btn--sm', onclick: () => openSlotForm(sectionId, s, reload) }, icon('edit')) : null,
      store.can('timetable_slots.delete') ? h('button', { class: 'icon-btn icon-btn--sm', onclick: async () => {
        const ok = await confirmDialog({ title: L('Delete slot?', 'حذف الحصة؟'), message: L('This timetable slot will be removed.', 'سيتم حذف هذه الحصة من الجدول.'), danger: true, confirmText: L('Delete', 'حذف') });
        if (!ok) return;
        try { await api.del(`/api/timetable/slot/${s.id}`); notify.success(L('Slot removed', 'تم حذف الحصة')); reload(); }
        catch (err) { notify.error(L('Error', 'خطأ'), err.message); }
      } }, icon('trash')) : null,
    ) : null;
    return h('div', { class: 'slot-card' },
      h('div', { class: 'slot__time' }, `${String(s.start_time || '').slice(0,5)} – ${String(s.end_time || '').slice(0,5)}`),
      h('div', { class: 'slot__subject' }, subject || L('Slot', 'حصة')),
      teacher ? h('div', { class: 'slot__meta' }, icon('user'), teacher) : null,
      room ? h('div', { class: 'slot__meta' }, icon('map-pin'), room) : null,
      actions,
    );
  }

  async function openSlotForm(sectionId, slot, reload) {
    const [subjects, staff, rooms] = await Promise.all([loadRefOptions('subjects'), loadRefOptions('staff'), loadRefOptions('classrooms')]);
    const day = h('select', { class: 'select' }, DAYS.map(([v, en, ar]) => h('option', { value: v, selected: String(slot.day_of_week || slot.day || 1) === String(v) }, L(en, ar))));
    const start = h('input', { class: 'input', type: 'time', value: String(slot.start_time || '08:00').slice(0,5) });
    const end = h('input', { class: 'input', type: 'time', value: String(slot.end_time || '08:45').slice(0,5) });
    const subject = h('select', { class: 'select' }, h('option', { value: '' }, L('— Subject —', '— المادة —')), subjects.map((r) => h('option', { value: r.value, selected: String(slot.subject_id || '') === String(r.value) }, refOptionsLabel(r))));
    const teacher = h('select', { class: 'select' }, h('option', { value: '' }, L('— Teacher —', '— المعلم —')), staff.map((r) => h('option', { value: r.value, selected: String(slot.teacher_id || slot.staff_id || '') === String(r.value) }, refOptionsLabel(r))));
    const room = h('select', { class: 'select' }, h('option', { value: '' }, L('— Room —', '— القاعة —')), rooms.map((r) => h('option', { value: r.value, selected: String(slot.classroom_id || slot.room_id || '') === String(r.value) }, refOptionsLabel(r))));
    const errBox = h('div', { class: 'alert alert--danger', style: { display: 'none' } });

    const form = h('div', { class: 'col gap-3' }, errBox,
      h('div', { class: 'form-grid' },
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('Day', 'اليوم')), day),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('Start', 'البداية')), start),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('End', 'النهاية')), end),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('Subject', 'المادة')), subject),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('Teacher', 'المعلم')), teacher),
        h('label', { class: 'field' }, h('span', { class: 'field__label' }, L('Room', 'القاعة')), room),
      ));

    const save = h('button', { class: 'btn btn--primary' }, icon('save'), L('Save', 'حفظ'));
    const modal = openModal({
      title: slot.id ? L('Edit slot', 'تعديل الحصة') : L('Add slot', 'إضافة حصة'),
      body: form,
      footer: [h('button', { class: 'btn', onclick: () => modal.close() }, L('Cancel', 'إلغاء')), save],
    });

    save.addEventListener('click', async () => {
      errBox.style.display = 'none';
      save.disabled = true;
      const payload = {
        section_id: Number(sectionId),
        day_of_week: Number(day.value),
        start_time: start.value,
        end_time: end.value,
        subject_id: subject.value ? Number(subject.value) : null,
        teacher_id: teacher.value ? Number(teacher.value) : null,
        classroom_id: room.value ? Number(room.value) : null,
      };
      if (slot.id) payload.id = slot.id;
      try {
        await api.post('/api/timetable/slot', payload);
        notify.success(L('Slot saved', 'تم حفظ الحصة'));
        modal.close(); reload();
      } catch (e) {
        if (e.status === 409 && e.data?.conflict) {
          errBox.textContent = L('Conflict detected with another slot. Adjust time/teacher/room.', 'يوجد تعارض مع حصة أخرى. عدّل الوقت أو المعلم أو القاعة.');
        } else errBox.textContent = e.data?.message || e.message;
        errBox.style.display = 'flex';
      } finally { save.disabled = false; }
    });
  }

  sectionSel.addEventListener('change', load);
  const addBtn = store.can('timetable_slots.create') ? h('button', { class: 'btn btn--primary', onclick: () => sectionSel.value && openSlotForm(sectionSel.value, {}, load) }, icon('plus'), L('Add slot', 'إضافة حصة')) : null;

  return h('div', { class: 'view view--timetable' },
    pageHeader({ title: L('Timetable', 'الجدول الدراسي'), iconName: 'table', subtitle: L('Weekly schedule by section with conflict detection.', 'الجدول الأسبوعي حسب الشعبة مع كشف التعارضات.'), actions: [addBtn] }),
    card({ body: h('div', { class: 'col gap-3' },
      h('div', { class: 'toolbar' }, h('label', { class: 'field', style: { minWidth: '260px' } }, h('span', { class: 'field__label' }, L('Section', 'الشعبة')), sectionSel), h('button', { class: 'btn', onclick: load }, icon('refresh'), L('Load', 'تحميل'))),
      host,
    ) }),
  );
}
