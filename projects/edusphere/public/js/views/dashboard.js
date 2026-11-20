import { h, icon } from '../core/dom.js';
import { store } from '../core/store.js';
import { api } from '../core/api.js';
import { pageHeader, card, emptyState, skeletonTable } from '../core/ui.js';
import { barChart, donutChart } from '../core/charts.js';
import { L, tt, money, num, dateFmt, dateTimeFmt } from './common.js';
import { entityLabel } from '../core/i18n.js';

export default async function renderDashboard() {
  const host = h('div', { class: 'dashboard-loading' }, skeletonTable(3));
  const wrap = h('div', { class: 'view view--dashboard' },
    pageHeader({
      title: tt('nav.dashboard', 'Dashboard', 'لوحة القيادة'),
      subtitle: L('A live overview of academics, finance, and operations.', 'نظرة مباشرة على الأكاديميات والمالية والتشغيل.'),
      iconName: 'dashboard',
    }),
    host,
  );

  (async () => {
    try {
      const data = await api.get('/api/dashboard');
      host.replaceChildren(render(data));
    } catch (err) {
      host.replaceChildren(card({ body: h('div', { class: 'alert alert--danger' }, err.message) }));
    }
  })();

  return wrap;
}

function render(d) {
  const k = d.kpis || {};
  const kpis = h('div', { class: 'kpi-grid' },
    kpiCard({ label: L('Students', 'الطلاب'), value: num(k.students || 0), iconName: 'graduation', tint: 'var(--brand-050)', color: 'var(--brand)', foot: `${num(k.sections || 0)} ${L('sections', 'شعبة')}` }),
    kpiCard({ label: L('Teachers / Staff', 'المعلمون / الموظفون'), value: `${num(k.teachers || 0)} / ${num(k.staff || 0)}`, iconName: 'users', tint: 'var(--info-050, var(--brand-050))', color: 'var(--info, var(--brand))', foot: `${num(k.branches || 0)} ${L('branches', 'فروع')}` }),
    kpiCard({ label: L('Collected', 'المحصّل'), value: money(k.collected || 0), iconName: 'banknote', tint: 'var(--accent-050, #ecfdf5)', color: 'var(--accent, #16a34a)', foot: `${L('Revenue', 'الإيرادات')}: ${money(k.revenue || 0)}` }),
    kpiCard({ label: L('Outstanding fees', 'الرسوم المستحقة'), value: money(k.outstanding || 0), iconName: 'alert-triangle', tint: 'var(--danger-050, #fef2f2)', color: 'var(--danger, #dc2626)', foot: `${L('Expenses', 'المصروفات')}: ${money(k.expenses || 0)}` }),
    kpiCard({ label: L('Net income', 'صافي الدخل'), value: money(k.netIncome || 0), iconName: 'wallet', tint: 'var(--surface-2)', color: Number(k.netIncome) >= 0 ? 'var(--accent, #16a34a)' : 'var(--danger, #dc2626)' }),
    kpiCard({ label: L('Attendance today', 'حضور اليوم'), value: `${num(k.attendanceRate || 0)}%`, iconName: 'calendar-check', tint: 'var(--brand-050)', color: 'var(--brand)', foot: k.attendanceToday ? `${num(k.attendanceToday.present || 0)} / ${num(k.attendanceToday.total || 0)}` : '' }),
  );

  const revenueTrend = (d.revenueByMonth || []).map((r) => ({ label: (r.month || '').slice(2), value: Number(r.revenue || 0), value2: Number(r.expense || 0) }));
  const financeCard = card({
    title: L('Revenue vs expenses', 'الإيرادات مقابل المصروفات'),
    subtitle: L('By month', 'حسب الشهر'),
    body: revenueTrend.length ? h('div', { class: 'chart-box' }, barChart({ data: revenueTrend, height: 260, series: ['value', 'value2'], colors: ['var(--accent, #16a34a)', 'var(--warning, #d97706)'] }))
      : emptyState({ iconName: 'bar-chart', title: L('No financial data', 'لا توجد بيانات مالية') }),
  });

  const invoiceStatus = (d.invoicesByStatus || []).map((r, i) => ({
    label: L(statusEn(r.status), statusAr(r.status)),
    value: Number(r.total || r.count || 0),
    color: ['var(--accent,#16a34a)', 'var(--warning,#d97706)', 'var(--danger,#dc2626)', 'var(--brand)'][i % 4],
  }));
  const invoiceCard = card({
    title: L('Invoices by status', 'الفواتير حسب الحالة'),
    body: invoiceStatus.length ? h('div', { class: 'row', style: { alignItems: 'center', gap: '18px', flexWrap: 'wrap' } },
      donutChart({ data: invoiceStatus, centerValue: num((d.invoicesByStatus || []).reduce((s, x) => s + (Number(x.count) || 0), 0)), centerLabel: L('Invoices', 'فاتورة') }),
      h('div', { class: 'col gap-2', style: { minWidth: '180px' } }, invoiceStatus.map((s) => h('div', { class: 'row gap-2', style: { justifyContent: 'space-between' } },
        h('span', { class: 'row gap-2' }, h('span', { style: { width: 10, height: 10, borderRadius: 999, background: s.color, display: 'inline-block' } }), s.label),
        h('strong', {}, money(s.value))))))
      : emptyState({ iconName: 'pie-chart', title: L('No invoice data', 'لا توجد بيانات فواتير') }),
  });

  const enrollment = (d.enrollmentByGrade || []).map((r) => ({ label: L(r.name_en || '', r.name_ar || r.name_en || ''), value: Number(r.count || 0) }));
  const enrollCard = card({
    title: L('Enrollment by grade', 'القيد حسب الصف'),
    body: enrollment.length ? h('div', { class: 'chart-box' }, barChart({ data: enrollment, height: 240, colors: ['var(--brand)'] }))
      : emptyState({ iconName: 'bar-chart', title: L('No enrollment data', 'لا توجد بيانات قيد') }),
  });

  const recent = d.recentActivity || [];
  const recentCard = card({
    title: L('Recent activity', 'النشاط الأخير'),
    body: recent.length ? h('div', { class: 'activity-list' }, recent.slice(0, 8).map((a) => h('div', { class: 'activity-item' },
      h('div', { class: 'activity-item__icon' }, icon(actionIcon(a.action))),
      h('div', { class: 'activity-item__body' },
        h('div', { class: 'activity-item__title' }, a.summary || `${a.action || ''} ${a.entity || ''}`.trim()),
        h('div', { class: 'activity-item__meta' }, [a.username, a.entity ? entityLabel(store.entity(a.entity)) || a.entity : '', a.created_at ? dateTimeFmt(a.created_at) : ''].filter(Boolean).join(' · '))),
    ))) : emptyState({ iconName: 'clock', title: L('No recent activity', 'لا يوجد نشاط حديث') }),
  });

  const events = d.upcomingEvents || [];
  const eventsCard = card({
    title: L('Upcoming events', 'الفعاليات القادمة'),
    body: events.length ? h('div', { class: 'col gap-2' }, events.slice(0, 6).map((e) => h('div', { class: 'row gap-3', style: { padding: '8px 0', borderBottom: '1px solid var(--border)' } },
      h('div', { class: 'quick-link__icon' }, icon('calendar')),
      h('div', { class: 'grow' },
        h('div', { class: 'strong', style: { fontSize: 'var(--fs-sm)' } }, L(e.title_en || '', e.title_ar || e.title_en || '')),
        h('div', { class: 'faint', style: { fontSize: 'var(--fs-xs)' } }, [e.start_at ? dateTimeFmt(e.start_at) : '', e.location].filter(Boolean).join(' · '))))))
      : emptyState({ iconName: 'calendar', title: L('No upcoming events', 'لا توجد فعاليات قادمة') }),
  });

  const debtors = d.topDebtors || [];
  const debtorsCard = card({
    title: L('Top outstanding balances', 'أعلى الأرصدة المستحقة'),
    body: debtors.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table table--compact' },
      h('thead', {}, h('tr', {}, h('th', {}, L('Student', 'الطالب')), h('th', {}, L('Code', 'الرمز')), h('th', { class: 'text-end' }, L('Balance', 'الرصيد')))),
      h('tbody', {}, debtors.map((s) => h('tr', {},
        h('td', {}, L(`${s.first_name_en || ''} ${s.last_name_en || ''}`.trim(), `${s.first_name_ar || ''} ${s.last_name_ar || ''}`.trim()) || s.code || `#${s.id}`),
        h('td', { class: 'mono' }, s.code || '—'),
        h('td', { class: 'text-end num' }, money(s.balance || 0)))))))
      : emptyState({ iconName: 'wallet', title: L('No outstanding balances', 'لا توجد أرصدة مستحقة') }),
  });

  const quickLinks = [
    { href: '#/e/students', icon: 'graduation', en: 'Students', ar: 'الطلاب' },
    { href: '#/e/invoices', icon: 'receipt', en: 'Invoices', ar: 'الفواتير' },
    { href: '#/e/payments', icon: 'banknote', en: 'Payments', ar: 'المدفوعات' },
    { href: '#/attendance', icon: 'calendar-check', en: 'Attendance', ar: 'الحضور' },
    { href: '#/gradebook', icon: 'star', en: 'Gradebook', ar: 'الدرجات' },
    { href: '#/reports', icon: 'bar-chart', en: 'Reports', ar: 'التقارير' },
  ];
  const quickCard = card({
    title: L('Quick access', 'وصول سريع'),
    body: h('div', { class: 'quick-grid' }, quickLinks.map((q) => h('a', { class: 'quick-link', href: q.href },
      h('span', { class: 'quick-link__icon' }, icon(q.icon)), h('span', {}, L(q.en, q.ar))))),
  });

  return h('div', { class: 'dashboard' },
    kpis,
    h('div', { class: 'dashboard-grid' },
      h('div', { class: 'dashboard-col', style: { gridColumn: 'span 2' } }, financeCard),
      invoiceCard,
      enrollCard,
      eventsCard,
      quickCard,
      recentCard,
      debtorsCard,
    ),
  );
}

function kpiCard({ label, value, iconName = 'chart', tint = 'var(--brand-050)', color = 'var(--brand)', foot = '' }) {
  return h('div', { class: 'kpi', style: { '--kpi-tint': tint, '--kpi-color': color } },
    h('div', { class: 'kpi__top' },
      h('div', {}, h('div', { class: 'kpi__label' }, label)),
      h('div', { class: 'kpi__icon' }, icon(iconName)),
    ),
    h('div', { class: 'kpi__value' }, value),
    foot ? h('div', { class: 'kpi__foot' }, foot) : null,
  );
}

function statusEn(s) { return ({ paid: 'Paid', partial: 'Partially paid', unpaid: 'Unpaid', overdue: 'Overdue' }[s] || s || '—'); }
function statusAr(s) { return ({ paid: 'مدفوعة', partial: 'مدفوعة جزئياً', unpaid: 'غير مدفوعة', overdue: 'متأخرة' }[s] || statusEn(s)); }
function actionIcon(a) { return ({ create: 'plus', update: 'edit', delete: 'trash', archive: 'archive', restore: 'rotate-ccw', login: 'log-in', logout: 'log-out' }[a] || 'activity'); }
