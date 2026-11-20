import { h, icon } from '../core/dom.js';
import { store } from '../core/store.js';
import { api } from '../core/api.js';
import { pageHeader, card, emptyState, spinner, breadcrumbs } from '../core/ui.js';
import { barChart, donutChart, lineChart } from '../core/charts.js';
import { L, tt, money, num, dateFmt, printArea, todayIso } from './common.js';
import { navigate } from '../core/router.js';

const REPORTS = [
  { key: 'trial-balance', icon: 'table', en: 'Trial Balance', ar: 'ميزان المراجعة', group: 'closing', endpoint: '/api/reports/trial-balance' },
  { key: 'income-statement', icon: 'line-chart', en: 'Income Statement (Profit & Loss)', ar: 'قائمة الدخل', group: 'closing', endpoint: '/api/reports/income-statement' },
  { key: 'balance-sheet', icon: 'clipboard', en: 'Balance Sheet (Statement of Financial Position)', ar: 'الميزانية العمومية (قائمة المركز المالي)', group: 'closing', endpoint: '/api/reports/balance-sheet' },
  { key: 'equity-changes', icon: 'trending-up', en: 'Statement of Changes in Equity', ar: 'قائمة التغيرات في حقوق الملكية', group: 'closing', endpoint: '/api/reports/equity-changes' },
  { key: 'cash-flow', icon: 'wallet', en: 'Cash Flow Statement', ar: 'قائمة التدفقات النقدية', group: 'closing', endpoint: '/api/reports/cash-flow' },
  { key: 'general-ledger', icon: 'book', en: 'General Ledger', ar: 'دفتر الأستاذ العام', group: 'closing', endpoint: '/api/reports/general-ledger' },
  { key: 'aging', icon: 'clock', en: 'Receivables Aging', ar: 'أعمار الذمم المدينة', group: 'financial', endpoint: '/api/reports/aging' },
  { key: 'student-statement', icon: 'user', en: 'Student Statement', ar: 'كشف حساب الطالب', group: 'financial', endpoint: '/api/reports/student-statement' },
  { key: 'fee-collection', icon: 'banknote', en: 'Fee Collection', ar: 'تحصيل الرسوم', group: 'financial', endpoint: '/api/reports/fee-collection' },
  { key: 'payroll', icon: 'users', en: 'Payroll Summary', ar: 'ملخص الرواتب', group: 'financial', endpoint: '/api/reports/payroll' },
  { key: 'budget-variance', icon: 'pie-chart', en: 'Budget Variance', ar: 'انحراف الموازنة', group: 'financial', endpoint: '/api/reports/budget-variance' },
  { key: 'attendance', icon: 'calendar-check', en: 'Attendance Report', ar: 'تقرير الحضور', group: 'academic', endpoint: '/api/reports/attendance' },
  { key: 'enrollment', icon: 'graduation', en: 'Enrollment Report', ar: 'تقرير القيد', group: 'academic', endpoint: '/api/reports/enrollment' },
];

export default async function renderReports(route) {
  const key = route.params.key;
  const def = REPORTS.find((r) => r.key === key);
  if (!key) return renderCentre();
  if (!def) return h('div', { class: 'view' }, card({ body: emptyState({ iconName: 'bar-chart', title: L('Report not found', 'التقرير غير موجود') }) }));
  if (!store.can('reports.view') && !store.can('reports.financial')) {
    return h('div', { class: 'view' }, card({ body: emptyState({ iconName: 'shield', title: L('Access denied', 'الوصول مرفوض') }) }));
  }
  return renderReport(def, route.query || {});
}

function renderCentre() {
  const groups = [
    { key: 'closing', en: 'Final financial statements', ar: 'القوائم المالية الختامية' },
    { key: 'financial', en: 'Financial & ERP reports', ar: 'التقارير المالية وتخطيط الموارد' },
    { key: 'academic', en: 'Academic reports', ar: 'التقارير الأكاديمية' },
  ];
  return h('div', { class: 'view' },
    pageHeader({ title: L('Reports centre', 'مركز التقارير'), subtitle: L('Statements, ledgers, and school analytics.', 'القوائم المالية والدفاتر وتحليلات المدرسة.'), iconName: 'bar-chart' }),
    h('div', { class: 'col gap-4' },
      groups.map((g) => card({
        title: L(g.en, g.ar),
        body: h('div', { class: 'modules-grid' },
          REPORTS.filter((r) => r.group === g.key).map((r) => h('a', {
            class: 'module-card',
            href: `#/reports/${r.key}`,
          },
            h('div', { class: 'module-card__icon' }, icon(r.icon)),
            h('div', { class: 'module-card__body' },
              h('div', { class: 'module-card__name' }, L(r.en, r.ar)),
              h('div', { class: 'module-card__meta' }, L('Open report', 'فتح التقرير')),
            ),
            h('span', { class: 'module-card__arrow' }, icon(L('arrow-right', 'arrow-left'))),
          )),
        ),
      })),
    ),
  );
}

function filterField(label, control) {
  return h('label', { class: 'field', style: { minWidth: '160px' } }, h('span', { class: 'field__label' }, label), control);
}

const CURRENCY_REPORTS = new Set(['trial-balance', 'income-statement', 'balance-sheet', 'equity-changes', 'cash-flow', 'general-ledger']);

async function renderReport(def, query) {
  const host = h('div', {}, h('div', { style: { padding: '28px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
  const params = { ...query };
  const from = h('input', { class: 'input', type: 'date', value: params.from || '' });
  const to = h('input', { class: 'input', type: 'date', value: params.to || todayIso() });
  const asOf = h('input', { class: 'input', type: 'date', value: params.as_of || todayIso() });
  const student = h('input', { class: 'input', type: 'number', value: params.student || '', placeholder: L('Student ID', 'رقم الطالب') });
  const account = h('input', { class: 'input', type: 'number', value: params.account_id || '', placeholder: L('Account ID', 'رقم الحساب') });

  const currencies = store.get('currencies') || [];
  const baseCurrency = store.get('baseCurrency') || 'USD';
  const defaultCurrency = params.currency || baseCurrency;
  const currencySel = h('select', { class: 'select' },
    currencies.map((c) => h('option', { value: c.code, selected: c.code === defaultCurrency }, `${c.code} — ${L(c.name_en || c.code, c.name_ar || c.name_en || c.code)}`)),
  );
  if (!currencies.length) currencySel.appendChild(h('option', { value: baseCurrency, selected: true }, baseCurrency));

  const run = async () => {
    const p = {};
    if (def.key === 'balance-sheet' || def.key === 'aging') { if (asOf.value) p.as_of = asOf.value; }
    else { if (from.value) p.from = from.value; if (to.value) p.to = to.value; }
    if (def.key === 'student-statement' && student.value) p.student = student.value;
    if (def.key === 'general-ledger' && account.value) p.account_id = account.value;
    const reportCurrency = currencySel.value || baseCurrency;
    if (CURRENCY_REPORTS.has(def.key)) p.currency = reportCurrency;
    host.replaceChildren(h('div', { style: { padding: '28px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
    try {
      const data = await api.get(def.endpoint, p);
      const cur = data.currency || reportCurrency || baseCurrency;
      const notice = CURRENCY_REPORTS.has(def.key) && cur !== baseCurrency
        ? h('div', { class: 'alert alert--info', style: { marginBottom: '12px' } }, icon('info'), ` ${L('Amounts converted to', 'المبالغ محوّلة إلى')} ${cur} ${L('using exchange rates effective on each transaction date (base:', 'باستخدام أسعار الصرف السارية في تاريخ كل عملية (العملة الأساسية:')} ${data.baseCurrency || baseCurrency}).`)
        : (CURRENCY_REPORTS.has(def.key) ? h('div', { class: 'faint', style: { marginBottom: '8px', fontSize: 'var(--fs-xs)' } }, `${L('Currency', 'العملة')}: ${cur}`) : null);
      host.replaceChildren(h('div', {}, notice, renderReportBody(def, data, cur)));
    } catch (err) {
      host.replaceChildren(h('div', { class: 'alert alert--danger' }, err.message));
    }
  };

  const filters = h('div', { class: 'toolbar', style: { flexWrap: 'wrap', marginBottom: '12px' } },
    (def.key === 'balance-sheet' || def.key === 'aging') ? filterField(L('As of', 'حتى تاريخ'), asOf)
      : h('div', { class: 'row gap-2', style: { flexWrap: 'wrap' } }, filterField(L('From', 'من'), from), filterField(L('To', 'إلى'), to)),
    def.key === 'student-statement' ? filterField(L('Student ID', 'رقم الطالب'), student) : null,
    def.key === 'general-ledger' ? filterField(L('Account ID', 'رقم الحساب'), account) : null,
    CURRENCY_REPORTS.has(def.key) ? filterField(L('Report currency', 'عملة التقرير'), currencySel) : null,
    h('div', { style: { alignSelf: 'end' } }, h('button', { class: 'btn btn--primary', onclick: run }, icon('search'), L('Run', 'تشغيل'))),
    h('div', { class: 'grow' }),
    h('button', { class: 'btn btn--ghost', onclick: () => printArea(host, `${L(def.en, def.ar)} (${currencySel.value || baseCurrency})`) }, icon('printer'), L('Print', 'طباعة')),
  );

  run();

  return h('div', { class: 'view' },
    pageHeader({
      title: L(def.en, def.ar),
      iconName: def.icon,
      breadcrumbs: breadcrumbs([{ label: L('Reports', 'التقارير'), href: '#/reports' }, { label: L(def.en, def.ar) }]),
      actions: [h('a', { class: 'btn', href: '#/reports' }, icon(L('arrow-left', 'arrow-right')), L('Back', 'رجوع'))],
    }),
    card({ body: h('div', {}, filters, h('div', { class: 'report-body' }, host)) }),
  );
}

function renderReportBody(def, data, cur) {
  const m = (v) => money(v, cur);
  switch (def.key) {
    case 'trial-balance': return renderTrialBalance(data, m);
    case 'income-statement': return renderIncomeStatement(data, m);
    case 'balance-sheet': return renderStatementSections(data, [normSection(data.assets, L('Assets', 'الأصول')), normSection(data.liabilities, L('Liabilities', 'الالتزامات')), normSection(data.equity, L('Equity', 'حقوق الملكية'))].filter(Boolean), data.net ?? data.netAssets ?? undefined, m);
    case 'equity-changes': return renderEquity(data, m);
    case 'cash-flow': return renderStatementSections(data, [normSection(data.operating, L('Operating activities', 'الأنشطة التشغيلية')), normSection(data.investing, L('Investing activities', 'الأنشطة الاستثمارية')), normSection(data.financing, L('Financing activities', 'الأنشطة التمويلية'))].filter(Boolean), data.netChange ?? data.net_change ?? data.net ?? data.closing, m);
    case 'general-ledger': return renderLedger(data, m);
    case 'aging': return renderAging(data, m);
    case 'student-statement': return renderStudentStatement(data, m);
    case 'fee-collection': return renderFeeCollection(data, m);
    case 'payroll': return renderPayroll(data, m);
    case 'budget-variance': return renderBudgetVariance(data, m);
    case 'attendance': return renderAttendanceReport(data);
    case 'enrollment': return renderEnrollment(data);
    default: return h('pre', { class: 'mono', style: { whiteSpace: 'pre-wrap', fontSize: '12px' } }, JSON.stringify(data, null, 2));
  }
}

function normSection(sec, fallbackTitle = '') {
  if (!sec) return null;
  if (Array.isArray(sec)) return { title: fallbackTitle, rows: sec, total: sec.reduce((s, r) => s + Number(r.amount ?? r.total ?? r.balance ?? 0), 0) };
  return { ...sec, title: sec.title || sec.title_en || sec.label_en || sec.name_en || fallbackTitle, rows: sec.rows || sec.items || sec.accounts || [] };
}

function renderIncomeStatement(data, m = money) {
  const revenue = normSection(data.revenue, L('Revenue', 'الإيرادات'));
  const expenses = normSection(data.expenses, L('Expenses', 'المصروفات'));
  if (revenue && data.totalRevenue != null) revenue.total = data.totalRevenue;
  if (expenses && data.totalExpenses != null) expenses.total = data.totalExpenses;
  return renderStatementSections(data, [revenue, expenses].filter(Boolean), data.netIncome ?? data.net_income ?? data.netProfit ?? data.net, m);
}

function simpleTable(headers, rows) {
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, headers.map((x) => h('th', { class: x.align === 'end' ? 'text-end' : '' }, x.label)))),
      h('tbody', {}, rows.length ? rows.map((r) => h('tr', {}, headers.map((x) => h('td', { class: x.align === 'end' ? 'text-end num' : '' }, x.render ? x.render(r) : r[x.key] ?? '—'))))
        : h('tr', {}, h('td', { colspan: headers.length }, emptyState({ title: L('No data', 'لا توجد بيانات') }))))));
}

function renderTrialBalance(data, m = money) {
  const rows = data.rows || data.accounts || [];
  const totals = data.totals || {};
  const debit = totals.debit ?? data.totalDebit ?? data.total_debit ?? rows.reduce((s, r) => s + Number(r.debit || 0), 0);
  const credit = totals.credit ?? data.totalCredit ?? data.total_credit ?? rows.reduce((s, r) => s + Number(r.credit || 0), 0);
  const closingDebit = totals.closingDebit ?? debit;
  const closingCredit = totals.closingCredit ?? credit;
  const balanced = data.balanced ?? (Math.abs(Number(closingDebit) - Number(closingCredit)) < 0.01);
  return h('div', { class: 'col gap-3' },
    simpleTable(
      [
        { key: 'code', label: L('Code', 'الرمز') },
        { key: 'name', label: L('Account', 'الحساب'), render: (r) => L(r.name_en || r.name || '', r.name_ar || r.name_en || '') || r.name },
        { key: 'debit', label: L('Debit', 'مدين'), align: 'end', render: (r) => m(r.debit || 0) },
        { key: 'credit', label: L('Credit', 'دائن'), align: 'end', render: (r) => m(r.credit || 0) },
        { key: 'closing', label: L('Closing balance', 'الرصيد الختامي'), align: 'end', render: (r) => m(r.closing ?? ((r.debit || 0) - (r.credit || 0))) },
      ],
      rows),
    h('div', { class: 'report-total' },
      h('span', {}, L('Totals', 'الإجماليات'), balanced ? h('span', { class: 'badge badge--success', style: { marginInlineStart: '8px' } }, L('Balanced', 'متزن')) : h('span', { class: 'badge badge--danger', style: { marginInlineStart: '8px' } }, L('Unbalanced', 'غير متزن'))),
      h('span', {}, `${L('Debit', 'مدين')}: ${m(debit)} · ${L('Credit', 'دائن')}: ${m(credit)} · ${L('Closing', 'ختامي')}: ${m(closingDebit)} / ${m(closingCredit)}`)),
  );
}

function renderStatementSections(data, sections, net, m = money) {
  return h('div', { class: 'col gap-4' },
    sections.map((sec) => {
      if (!sec) return null;
      const rows = sec.rows || sec.items || sec.accounts || [];
      const title = L(sec.title_en || sec.label_en || sec.name_en || sec.title || '', sec.title_ar || sec.label_ar || sec.name_ar || sec.title || '');
      return h('div', { class: 'report-section' },
        h('h3', {}, title || L('Section', 'قسم')),
        simpleTable(
          [{ key: 'name', label: L('Item', 'البند'), render: (r) => L(r.name_en || r.label_en || r.name || '', r.name_ar || r.label_ar || r.name_en || '') || r.code || '—' },
            { key: 'amount', label: L('Amount', 'المبلغ'), align: 'end', render: (r) => m(r.amount ?? r.total ?? r.balance ?? 0) }],
          rows),
        h('div', { class: 'report-total' }, h('span', {}, L('Total', 'الإجمالي')), h('span', {}, m(sec.total ?? sec.amount ?? 0))),
      );
    }).filter(Boolean),
    net !== undefined ? h('div', { class: 'report-total', style: { fontSize: '16px' } }, h('span', {}, L('Net result', 'الصافي')), h('span', {}, m(net))) : null,
  );
}

function renderEquity(data, m = money) {
  const opening = data.opening || [];
  const movements = data.movements || data.rows || data.items || [];
  const cols = [
    { key: 'item', label: L('Item', 'البند'), render: (r) => L(r.name_en || r.label || '', r.name_ar || r.name_en || '') || r.code || '—' },
    { key: 'amount', label: L('Amount', 'المبلغ'), align: 'end', render: (r) => m(r.amount ?? r.value ?? 0) },
  ];
  const section = (title, rows, total) => h('div', { class: 'report-section' },
    h('h3', {}, title),
    simpleTable(cols, rows),
    total != null ? h('div', { class: 'report-total' }, h('span', {}, L('Total', 'الإجمالي')), h('span', {}, m(total))) : null,
  );
  if (data.opening || data.closingTotal != null) {
    return h('div', { class: 'col gap-4' },
      section(L('Opening equity', 'حقوق الملكية الافتتاحية'), opening, data.openingTotal),
      section(L('Movements', 'الحركات'), movements, data.movementTotal),
      h('div', { class: 'report-total' }, h('span', {}, L('Net profit / (loss)', 'صافي الربح / (الخسارة)')), h('span', {}, m(data.netProfit ?? 0))),
      h('div', { class: 'report-total', style: { fontSize: '16px' } }, h('span', {}, L('Closing equity', 'حقوق الملكية الختامية')), h('span', {}, m(data.closingTotal ?? 0))),
    );
  }
  return h('div', {}, simpleTable(cols, movements));
}
function renderLedger(data, m = money) {
  const rows = data.rows || data.entries || data.lines || [];
  return h('div', { class: 'col gap-3' },
    data.account ? h('div', { class: 'alert alert--info' }, h('strong', {}, L(data.account.name_en || '', data.account.name_ar || '')), ` · ${L('Opening', 'افتتاحي')}: ${m(data.opening ?? 0)} · ${L('Closing', 'ختامي')}: ${m(data.closing ?? 0)}`) : null,
    simpleTable(
      [{ key: 'date', label: L('Date', 'التاريخ'), render: (r) => dateFmt(r.date || r.entry_date) },
        { key: 'ref', label: L('Reference', 'المرجع'), render: (r) => r.reference || r.entry_no || r.ref || '—' },
        { key: 'desc', label: L('Description', 'الوصف'), render: (r) => L(r.description_en || r.description || '', r.description_ar || r.description_en || '') },
        { key: 'debit', label: L('Debit', 'مدين'), align: 'end', render: (r) => m(r.debit || 0) },
        { key: 'credit', label: L('Credit', 'دائن'), align: 'end', render: (r) => m(r.credit || 0) },
        { key: 'balance', label: L('Balance', 'الرصيد'), align: 'end', render: (r) => m(r.balance ?? r.running ?? 0) }],
      rows));
}
function renderAging(data, m = money) {
  const rows = data.rows || data.items || [];
  return simpleTable(
    [{ key: 'name', label: L('Student / Customer', 'الطالب / العميل'), render: (r) => r.name || L(r.name_en || '', r.name_ar || '') || `#${r.id}` },
      { key: 'current', label: L('Current', 'حالي'), align: 'end', render: (r) => m(r.current || 0) },
      { key: 'd30', label: '1-30', align: 'end', render: (r) => m(r.days_30 || r.d30 || 0) },
      { key: 'd60', label: '31-60', align: 'end', render: (r) => m(r.days_60 || r.d60 || 0) },
      { key: 'd90', label: '61-90', align: 'end', render: (r) => m(r.days_90 || r.d90 || 0) },
      { key: 'd90p', label: '90+', align: 'end', render: (r) => m(r.days_90_plus || r.d90p || 0) },
      { key: 'total', label: L('Total', 'الإجمالي'), align: 'end', render: (r) => m(r.total || r.balance || 0) }],
    rows);
}
function renderStudentStatement(data, m = money) {
  const rows = data.rows || data.transactions || data.lines || [];
  return h('div', { class: 'col gap-3' },
    data.student ? h('div', { class: 'alert alert--info' }, h('strong', {}, L(data.student.name_en || data.student.name || '', data.student.name_ar || '')), ` · ${L('Balance', 'الرصيد')}: ${m(data.balance ?? data.closing ?? 0)}`) : null,
    simpleTable(
      [{ key: 'date', label: L('Date', 'التاريخ'), render: (r) => dateFmt(r.date) },
        { key: 'ref', label: L('Reference', 'المرجع'), render: (r) => r.reference || r.invoice_no || r.receipt_no || '—' },
        { key: 'desc', label: L('Description', 'الوصف'), render: (r) => L(r.description_en || r.description || '', r.description_ar || r.description_en || '') },
        { key: 'debit', label: L('Debit', 'مدين'), align: 'end', render: (r) => m(r.debit || r.charge || 0) },
        { key: 'credit', label: L('Credit', 'دائن'), align: 'end', render: (r) => m(r.credit || r.payment || 0) },
        { key: 'balance', label: L('Balance', 'الرصيد'), align: 'end', render: (r) => m(r.balance || 0) }], rows));
}
function renderFeeCollection(data, m = money) {
  const rows = data.rows || data.items || [];
  return h('div', { class: 'col gap-3' },
    data.summary ? h('div', { class: 'kpi-grid' },
      (data.summary.cards || Object.entries(data.summary).filter(([k]) => k !== 'cards').map(([k, v]) => ({ label: k, value: v }))).map((c) =>
        h('div', { class: 'kpi' }, h('div', { class: 'kpi__label' }, c.label), h('div', { class: 'kpi__value' }, typeof c.value === 'number' ? m(c.value) : c.value)))) : null,
    simpleTable(
      [{ key: 'label', label: L('Item', 'البند'), render: (r) => L(r.label_en || r.name_en || r.label || '', r.label_ar || r.name_ar || '') },
        { key: 'invoiced', label: L('Invoiced', 'مفوتر'), align: 'end', render: (r) => m(r.invoiced || r.total || 0) },
        { key: 'collected', label: L('Collected', 'محصّل'), align: 'end', render: (r) => m(r.collected || r.paid || 0) },
        { key: 'outstanding', label: L('Outstanding', 'متبقي'), align: 'end', render: (r) => m(r.outstanding || r.balance || 0) }], rows));
}
function renderPayroll(data, m = money) {
  const rows = data.rows || data.items || [];
  return simpleTable(
    [{ key: 'name', label: L('Employee / Run', 'الموظف / المسير'), render: (r) => L(r.name_en || r.name || r.run_no || '', r.name_ar || r.name_en || '') },
      { key: 'gross', label: L('Gross', 'إجمالي'), align: 'end', render: (r) => m(r.gross || r.basic_salary || 0) },
      { key: 'deductions', label: L('Deductions', 'خصومات'), align: 'end', render: (r) => m(r.deductions || 0) },
      { key: 'net', label: L('Net', 'صافي'), align: 'end', render: (r) => m(r.net || r.net_salary || 0) }], rows);
}
function renderBudgetVariance(data, m = money) {
  const rows = data.rows || data.items || [];
  return simpleTable(
    [{ key: 'name', label: L('Budget / Account', 'الموازنة / الحساب'), render: (r) => L(r.name_en || r.name || '', r.name_ar || r.name_en || '') },
      { key: 'budget', label: L('Budget', 'المقدر'), align: 'end', render: (r) => m(r.budget || r.planned || 0) },
      { key: 'actual', label: L('Actual', 'الفعلي'), align: 'end', render: (r) => m(r.actual || 0) },
      { key: 'variance', label: L('Variance', 'الانحراف'), align: 'end', render: (r) => m(r.variance ?? ((r.actual || 0) - (r.budget || r.planned || 0))) }], rows);
}
function renderAttendanceReport(data) {
  const rows = data.rows || data.items || [];
  return simpleTable(
    [{ key: 'label', label: L('Group / Date', 'المجموعة / التاريخ'), render: (r) => r.label || L(r.name_en || '', r.name_ar || '') || dateFmt(r.date) },
      { key: 'present', label: L('Present', 'حاضر'), align: 'end', render: (r) => num(r.present || 0) },
      { key: 'absent', label: L('Absent', 'غائب'), align: 'end', render: (r) => num(r.absent || 0) },
      { key: 'late', label: L('Late', 'متأخر'), align: 'end', render: (r) => num(r.late || 0) },
      { key: 'rate', label: L('Rate', 'النسبة'), align: 'end', render: (r) => `${num(r.rate || r.percentage || 0)}%` }], rows);
}
function renderEnrollment(data) {
  const rows = data.rows || data.items || [];
  return simpleTable(
    [{ key: 'label', label: L('Grade / Section / Year', 'الصف / الشعبة / السنة'), render: (r) => L(r.label_en || r.name_en || r.label || '', r.label_ar || r.name_ar || '') },
      { key: 'total', label: L('Students', 'الطلاب'), align: 'end', render: (r) => num(r.total || r.count || r.students || 0) },
      { key: 'capacity', label: L('Capacity', 'السعة'), align: 'end', render: (r) => num(r.capacity || 0) }], rows);
}
