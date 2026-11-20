import { h, icon } from '../core/dom.js';
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { pageHeader, card, emptyState, spinner, notify } from '../core/ui.js';
import { L, tt, todayIso, loadRefOptions, refOptionsLabel } from './common.js';

export default async function renderAttendance() {
  if (!store.can('attendance_records.read')) return card({ body: emptyState({ iconName: 'shield', title: L('Access denied', 'الوصول مرفوض') }) });

  const sectionSel = h('select', { class: 'select' }, h('option', { value: '' }, L('Select section…', 'اختر الشعبة…')));
  const dateInput = h('input', { class: 'input', type: 'date', value: todayIso() });
  const host = h('div', {}, emptyState({ iconName: 'calendar-check', title: L('Select a section and date', 'اختر الشعبة والتاريخ'), message: L('Load the class register to mark attendance.', 'حمّل سجل الصف لتسجيل الحضور.') }));
  const saveBtn = h('button', { class: 'btn btn--primary', disabled: true }, icon('save'), L('Save register', 'حفظ السجل'));

  let current = null; // {section_id,date,records}

  async function initSections() {
    const rows = await loadRefOptions('sections');
    for (const r of rows) sectionSel.appendChild(h('option', { value: r.value }, refOptionsLabel(r)));
  }
  initSections().catch(() => {});

  async function load() {
    const section_id = sectionSel.value;
    const date = dateInput.value;
    if (!section_id || !date) return;
    host.replaceChildren(h('div', { style: { padding: '28px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
    saveBtn.disabled = true;
    try {
      const data = await api.get('/api/attendance/register', { section_id, date });
      current = data;
      renderRegister(data);
      saveBtn.disabled = !store.can('attendance_records.update') && !store.can('attendance_records.create');
    } catch (err) {
      host.replaceChildren(h('div', { class: 'alert alert--danger' }, err.message));
    }
  }

  function statusSelect(value) {
    const opts = [
      ['present', L('Present', 'حاضر')],
      ['absent', L('Absent', 'غائب')],
      ['late', L('Late', 'متأخر')],
      ['excused', L('Excused', 'بعذر')],
    ];
    return h('select', { class: 'select select--sm' }, opts.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
  }

  function renderRegister(data) {
    const records = data.records || data.students || [];
    if (!records.length) {
      host.replaceChildren(emptyState({ iconName: 'users', title: L('No students found', 'لا يوجد طلاب'), message: L('This section has no enrolled students for the selected date.', 'هذه الشعبة لا تحتوي على طلاب مسجلين للتاريخ المحدد.') }));
      return;
    }
    const rows = records.map((r) => {
      const sel = statusSelect(r.status || 'present');
      const note = h('input', { class: 'input input--sm', value: r.note || r.notes || '', placeholder: L('Note', 'ملاحظة') });
      const tr = h('tr', {},
        h('td', {}, r.student_name || r.name || L(r.name_en || '', r.name_ar || '') || `#${r.student_id}`),
        h('td', {}, r.admission_no || r.code || '—'),
        h('td', {}, sel),
        h('td', {}, note),
      );
      tr._record = () => ({ student_id: r.student_id || r.id, status: sel.value, note: note.value, id: r.id });
      return tr;
    });
    const table = h('div', { class: 'table-wrap' },
      h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, L('Student', 'الطالب')), h('th', {}, L('Code', 'الرمز')), h('th', {}, L('Status', 'الحالة')), h('th', {}, L('Note', 'ملاحظة')))),
        h('tbody', {}, rows)));
    host.replaceChildren(table);
    host._rows = rows;
  }

  saveBtn.addEventListener('click', async () => {
    if (!host._rows) return;
    saveBtn.disabled = true;
    try {
      const payload = {
        section_id: Number(sectionSel.value),
        date: dateInput.value,
        records: host._rows.map((tr) => tr._record()),
      };
      await api.post('/api/attendance/register', payload);
      notify.success(L('Attendance saved', 'تم حفظ الحضور'), L('Register updated successfully.', 'تم تحديث السجل بنجاح.'));
    } catch (err) {
      notify.error(L('Save failed', 'فشل الحفظ'), err.message);
    } finally { saveBtn.disabled = false; }
  });

  sectionSel.addEventListener('change', load);
  dateInput.addEventListener('change', load);

  return h('div', { class: 'view view--attendance' },
    pageHeader({
      title: L('Attendance', 'الحضور والغياب'), iconName: 'calendar-check',
      subtitle: L('Mark daily attendance by class section.', 'سجّل الحضور اليومي حسب الشعبة.'),
      actions: [h('button', { class: 'btn', onclick: load }, icon('refresh'), L('Load', 'تحميل')), saveBtn],
    }),
    card({ body: h('div', { class: 'col gap-3' },
      h('div', { class: 'toolbar', style: { flexWrap: 'wrap' } },
        h('label', { class: 'field', style: { minWidth: '240px' } }, h('span', { class: 'field__label' }, L('Section', 'الشعبة')), sectionSel),
        h('label', { class: 'field', style: { minWidth: '180px' } }, h('span', { class: 'field__label' }, L('Date', 'التاريخ')), dateInput)),
      host,
    ) }),
  );
}
