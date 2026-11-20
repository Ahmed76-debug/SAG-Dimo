import { h, icon } from '../core/dom.js';
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { pageHeader, card, emptyState, spinner, notify } from '../core/ui.js';
import { L, loadRefOptions, refOptionsLabel } from './common.js';

export default async function renderGradebook() {
  if (!store.can('grades.read')) return card({ body: emptyState({ iconName: 'shield', title: L('Access denied', 'الوصول مرفوض') }) });

  const sectionSel = h('select', { class: 'select' }, h('option', { value: '' }, L('Select section…', 'اختر الشعبة…')));
  const subjectSel = h('select', { class: 'select' }, h('option', { value: '' }, L('Select subject…', 'اختر المادة…')));
  const termSel = h('select', { class: 'select' }, h('option', { value: '' }, L('All terms', 'كل الفصول')));
  const host = h('div', {}, emptyState({ iconName: 'star', title: L('Select section and subject', 'اختر الشعبة والمادة'), message: L('Load the gradebook matrix to enter scores.', 'حمّل مصفوفة الدرجات لإدخال العلامات.') }));
  const saveBtn = h('button', { class: 'btn btn--primary', disabled: true }, icon('save'), L('Save grades', 'حفظ الدرجات'));

  async function init() {
    const [sections, subjects, terms] = await Promise.all([loadRefOptions('sections'), loadRefOptions('subjects'), loadRefOptions('terms')]);
    for (const r of sections) sectionSel.appendChild(h('option', { value: r.value }, refOptionsLabel(r)));
    for (const r of subjects) subjectSel.appendChild(h('option', { value: r.value }, refOptionsLabel(r)));
    for (const r of terms) termSel.appendChild(h('option', { value: r.value }, refOptionsLabel(r)));
  }
  init().catch(() => {});

  async function load() {
    const section_id = sectionSel.value, subject_id = subjectSel.value;
    if (!section_id || !subject_id) return;
    host.replaceChildren(h('div', { style: { padding: '28px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
    saveBtn.disabled = true;
    try {
      const params = { section_id, subject_id };
      if (termSel.value) params.term_id = termSel.value;
      const data = await api.get('/api/grades/matrix', params);
      renderMatrix(data);
      saveBtn.disabled = !(store.can('grades.update') || store.can('grades.create'));
    } catch (err) {
      host.replaceChildren(h('div', { class: 'alert alert--danger' }, err.message));
    }
  }

  function renderMatrix(data) {
    const assessments = data.assessments || data.columns || [];
    const students = data.students || data.rows || [];
    if (!students.length) {
      host.replaceChildren(emptyState({ iconName: 'users', title: L('No students found', 'لا يوجد طلاب') }));
      return;
    }
    const header = h('tr', {},
      h('th', {}, L('Student', 'الطالب')),
      ...assessments.map((a) => h('th', {}, a.name || L(a.name_en || '', a.name_ar || '') || a.title || `#${a.id}`)),
      h('th', {}, L('Total', 'المجموع')),
    );
    const bodyRows = students.map((s) => {
      const inputs = [];
      const cells = assessments.map((a) => {
        const existing = (s.grades || []).find((g) => String(g.assessment_id) === String(a.id)) || {};
        const inp = h('input', { class: 'input input--sm', type: 'number', step: '0.01', value: existing.score ?? existing.value ?? '', style: { width: '90px' } });
        inputs.push({ assessment_id: a.id, student_id: s.student_id || s.id, input: inp, id: existing.id });
        return h('td', {}, inp);
      });
      const total = h('td', { class: 'num strong' }, '—');
      const recalc = () => {
        const sum = inputs.reduce((acc, x) => acc + (Number(x.input.value) || 0), 0);
        total.textContent = inputs.some((x) => x.input.value !== '') ? sum.toFixed(2) : '—';
      };
      inputs.forEach((x) => x.input.addEventListener('input', recalc));
      recalc();
      const tr = h('tr', {}, h('td', {}, s.student_name || s.name || L(s.name_en || '', s.name_ar || '') || `#${s.student_id || s.id}`), ...cells, total);
      tr._inputs = inputs;
      return tr;
    });
    host.replaceChildren(h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, h('thead', {}, header), h('tbody', {}, bodyRows))));
    host._rows = bodyRows;
    host._meta = { section_id: sectionSel.value, subject_id: subjectSel.value, term_id: termSel.value || undefined };
  }

  saveBtn.addEventListener('click', async () => {
    if (!host._rows) return;
    saveBtn.disabled = true;
    try {
      const grades = [];
      for (const tr of host._rows) for (const x of tr._inputs) {
        if (x.input.value === '') continue;
        grades.push({ student_id: Number(x.student_id), assessment_id: Number(x.assessment_id), score: Number(x.input.value), ...(x.id ? { id: x.id } : {}) });
      }
      await api.post('/api/grades/matrix', { section_id: Number(host._meta.section_id), subject_id: Number(host._meta.subject_id), ...(host._meta.term_id ? { term_id: Number(host._meta.term_id) } : {}), grades });
      notify.success(L('Grades saved', 'تم حفظ الدرجات'));
    } catch (err) {
      notify.error(L('Save failed', 'فشل الحفظ'), err.message);
    } finally { saveBtn.disabled = false; }
  });

  sectionSel.addEventListener('change', load);
  subjectSel.addEventListener('change', load);
  termSel.addEventListener('change', load);

  return h('div', { class: 'view view--gradebook' },
    pageHeader({
      title: L('Gradebook', 'دفتر الدرجات'), iconName: 'star',
      subtitle: L('Enter and review assessment scores by section and subject.', 'أدخل وراجع درجات التقييمات حسب الشعبة والمادة.'),
      actions: [h('button', { class: 'btn', onclick: load }, icon('refresh'), L('Load', 'تحميل')), saveBtn],
    }),
    card({ body: h('div', { class: 'col gap-3' },
      h('div', { class: 'toolbar', style: { flexWrap: 'wrap' } },
        h('label', { class: 'field', style: { minWidth: '220px' } }, h('span', { class: 'field__label' }, L('Section', 'الشعبة')), sectionSel),
        h('label', { class: 'field', style: { minWidth: '220px' } }, h('span', { class: 'field__label' }, L('Subject', 'المادة')), subjectSel),
        h('label', { class: 'field', style: { minWidth: '180px' } }, h('span', { class: 'field__label' }, L('Term', 'الفصل')), termSel)),
      host,
    ) }),
  );
}
