import { h, icon, todayIso } from '../core/dom.js';
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { pageHeader, card, spinner, emptyState, notify } from '../core/ui.js';
import { L, money } from './common.js';

function field(label, control) {
  return h('label', { class: 'field' }, h('span', { class: 'field__label' }, label), control);
}
function input(opts = {}) { return h('input', { class: 'input', ...opts }); }
function select(opts = {}, children = []) { return h('select', { class: 'select', ...opts }, ...children); }
function option(v, label, sel = false) { return h('option', { value: v ?? '', selected: sel }, label); }

async function loadJSON(url, params) { return api.get(url, params); }
async function postJSON(url, body) { return api.post(url, body); }

async function bankAccountOptions(selected = '') {
  const res = await loadJSON('/api/bank_accounts', { page: 1, pageSize: 200, sort: 'kind asc, name_en asc' }).catch(() => ({ rows: [] }));
  const rows = res.rows || [];
  return [option('', L('Select…', 'اختر…')),
    ...rows.map((r) => option(r.id, `${r.kind === 'cashbox' ? '🏦' : '🏛'} ${L(r.name_en || r.code || '', r.name_ar || r.name_en || '')} — ${money(r.current_balance || 0, r.currency_code)}${r.branch_id__label ? ` (${L(r.branch_id__label, r.branch_id__label_ar || r.branch_id__label)})` : ''}`, String(selected) === String(r.id)))];
}

async function glAccountOptions(selected = '') {
  const res = await loadJSON('/api/accounts', { page: 1, pageSize: 500, sort: 'code asc' }).catch(() => ({ rows: [] }));
  const rows = (res.rows || []).filter((r) => !r.is_group);
  return [option('', L('Select account…', 'اختر حساباً…')),
    ...rows.map((r) => option(r.id, `${r.code} — ${L(r.name_en, r.name_ar || r.name_en)}`, String(selected) === String(r.id)))];
}

async function optionsFor(entity, selected = '', labelFn) {
  const res = await loadJSON(`/api/${entity}`, { page: 1, pageSize: 500 }).catch(() => ({ rows: [] }));
  const rows = res.rows || [];
  return [option('', L('Select…', 'اختر…')),
    ...rows.map((r) => option(r.id, labelFn ? labelFn(r) : (L(r.name_en || r.code || r.title_en || '', r.name_ar || r.name_en || r.code || '') || `#${r.id}`), String(selected) === String(r.id)))];
}

/* ---------------- Treasury transactions ---------------- */
export async function renderTreasury() {
  if (!store.can('journal_entries.create') && !store.can('bank_accounts.read')) {
    return h('div', { class: 'view' }, card({ body: emptyState({ iconName: 'shield', title: L('Access denied', 'الوصول مرفوض') }) }));
  }
  const host = h('div');
  async function refresh() {
    host.replaceChildren(h('div', { style: { padding: '24px', display: 'grid', placeItems: 'center' } }, spinner('lg')));
    try {
      const summary = await loadJSON('/api/treasury/summary');
      host.replaceChildren(renderBody(summary));
    } catch (e) { host.replaceChildren(h('div', { class: 'alert alert--danger' }, e.message)); }
  }

  function renderBody(summary) {
    const accounts = summary.accounts || [];
    const cashboxes = accounts.filter((a) => a.kind === 'cashbox');
    const banks = accounts.filter((a) => a.kind !== 'cashbox');
    const cur = summary.baseCurrency || store.get('baseCurrency') || 'USD';

    const stat = (label, value) => h('div', { class: 'kpi' }, h('div', { class: 'kpi__label' }, label), h('div', { class: 'kpi__value' }, value));
    const listCard = (title, rows) => card({ title, body: rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, [L('Name','الاسم'), L('Branch','الفرع'), L('Currency','العملة'), L('Current balance','الرصيد الحالي')].map((x,i)=>h('th',{class:i===3?'text-end':''},x)))),
      h('tbody', {}, rows.map((r) => h('tr', {},
        h('td', {}, h('div', { style: { fontWeight: 600 } }, L(r.name_en, r.name_ar || r.name_en)), h('div', { class: 'faint', style:{fontSize:'12px'} }, r.code || '')),
        h('td', {}, L(r.branch_name_en || '—', r.branch_name_ar || r.branch_name_en || '—')),
        h('td', {}, r.currency_code || cur),
        h('td', { class: 'text-end num' }, money(r.current_balance || 0, r.currency_code || cur)),
      ))))) : emptyState({ iconName: 'wallet', title: L('No accounts yet', 'لا توجد حسابات بعد'), hint: L('Add banks or cashboxes from the Banks & Cashboxes module.', 'أضف بنوكاً أو خزائن من شاشة البنوك والخزائن.') }) });

    // Transaction form
    const type = select({}, [option('deposit', L('Deposit / Receipt (in)', 'إيداع / قبض (وارد)')), option('withdraw', L('Withdrawal / Payment (out)', 'صرف / سحب (صادر)')), option('transfer', L('Transfer between cashbox/bank', 'تحويل بين خزينة وبنك'))]);
    const ba = select({}); const fromBa = select({}); const toBa = select({});
    const contra = select({});
    const amount = input({ type: 'number', step: '0.01', min: '0', placeholder: '0.00' });
    const date = input({ type: 'date', value: todayIso() });
    const ref = input({ type: 'text', placeholder: L('Reference', 'مرجع') });
    const desc = input({ type: 'text', placeholder: L('Description', 'الوصف') });
    const formMsg = h('div');
    const singleWrap = h('div', { class: 'col gap-3' }, field(L('Cashbox / Bank', 'الخزينة / البنك'), ba), field(L('Contra GL account', 'الحساب المقابل (دفتر الأستاذ)'), contra));
    const transferWrap = h('div', { class: 'col gap-3', style: { display: 'none' } }, field(L('From (source)', 'من (المصدر)'), fromBa), field(L('To (destination)', 'إلى (الوجهة)'), toBa));
    const syncType = () => { const t = type.value; singleWrap.style.display = t === 'transfer' ? 'none' : ''; transferWrap.style.display = t === 'transfer' ? '' : 'none'; };
    type.addEventListener('change', syncType);

    (async () => {
      const [baOpts, glOpts] = await Promise.all([bankAccountOptions(), glAccountOptions()]);
      ba.replaceChildren(...baOpts.map(o=>o.cloneNode(true))); fromBa.replaceChildren(...baOpts.map(o=>o.cloneNode(true))); toBa.replaceChildren(...baOpts.map(o=>o.cloneNode(true))); contra.replaceChildren(...glOpts);
    })();

    const submit = h('button', { class: 'btn btn--primary', onclick: async () => {
      try {
        submit.disabled = true; formMsg.replaceChildren();
        const t = type.value;
        const body = { type: t, amount: amount.value, entry_date: date.value, reference: ref.value, description: desc.value };
        if (t === 'transfer') { body.from_bank_account_id = fromBa.value; body.to_bank_account_id = toBa.value; }
        else { body.bank_account_id = ba.value; body.contra_account_id = contra.value; }
        const r = await postJSON('/api/treasury/transaction', body);
        notify('success', L('Transaction posted', 'تم تسجيل المعاملة'), `${L('Journal', 'قيد')} ${r.entry_no || r.journal_id}`);
        amount.value = ''; ref.value = ''; desc.value = '';
        await refresh();
      } catch (e) { formMsg.replaceChildren(h('div', { class: 'alert alert--danger' }, e.message)); }
      finally { submit.disabled = false; }
    } }, icon('check'), L('Post transaction', 'ترحيل المعاملة'));

    const txForm = card({ title: L('Record cash/bank transaction (auto journal)', 'تسجيل معاملة خزينة/بنك (قيد تلقائي)'), subtitle: L('Deposits, withdrawals and transfers post balanced journal entries directly.', 'الإيداعات والسحوبات والتحويلات تُنشئ قيوداً يومية متوازنة مباشرة.'),
      body: h('div', { class: 'col gap-3' },
        h('div', { class: 'form-grid' }, field(L('Transaction type', 'نوع المعاملة'), type), field(L('Date', 'التاريخ'), date), field(L('Amount', 'المبلغ'), amount), field(L('Reference', 'المرجع'), ref)),
        singleWrap, transferWrap,
        field(L('Description', 'الوصف / البيان'), desc),
        formMsg,
        h('div', { class: 'row gap-2' }, submit, h('a', { class: 'btn', href: '#/e/bank_accounts' }, icon('wallet'), L('Manage banks & cashboxes', 'إدارة البنوك والخزائن')))
      ) });

    return h('div', { class: 'col gap-4' },
      h('div', { class: 'kpi-grid' },
        stat(L('Cashboxes', 'الخزائن'), `${cashboxes.length} · ${money(cashboxes.reduce((s,x)=>s+Number(x.current_balance||0),0), cur)}`),
        stat(L('Banks', 'البنوك'), `${banks.length} · ${money(banks.reduce((s,x)=>s+Number(x.current_balance||0),0), cur)}`),
        stat(L('Total', 'الإجمالي'), money(accounts.reduce((s,x)=>s+Number(x.current_balance||0),0), cur)),
      ),
      txForm,
      h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: '16px' } }, listCard(L('Cashboxes', 'الخزائن'), cashboxes), listCard(L('Bank accounts', 'الحسابات البنكية'), banks)),
    );
  }

  refresh();
  return h('div', { class: 'view' },
    pageHeader({ title: L('Treasury transactions', 'معاملات الخزائن والبنوك'), subtitle: L('Deposit, withdraw, transfer and track balances per cashbox/bank with automatic journal entries.', 'إيداع وصرف وتحويل ومتابعة أرصدة كل خزينة/بنك مع قيود يومية تلقائية.'), iconName: 'banknote', actions: [h('button', { class: 'btn', onclick: refresh }, icon('refresh'), L('Refresh', 'تحديث'))] }),
    host,
  );
}

/* ---------------- Settlements ---------------- */
export async function renderSettlements() {
  if (!store.can('journal_entries.create')) return h('div', { class: 'view' }, card({ body: emptyState({ iconName: 'shield', title: L('Access denied', 'الوصول مرفوض') }) }));
  const host = h('div');
  const type = select({}, [
    option('bank_account', L('Cashbox / Bank', 'خزينة / بنك')),
    option('vendor', L('Supplier / Vendor', 'مورد')),
    option('customer', L('Customer', 'عميل')),
    option('student', L('Student (AR adjustment)', 'طالب (تسوية ذمم)')),
    option('account', L('GL account', 'حساب دفتر أستاذ')),
  ]);
  const target = select({});
  const direction = select({}, [option('increase', L('Increase balance', 'زيادة الرصيد')), option('decrease', L('Decrease balance', 'تخفيض الرصيد'))]);
  const contra = select({});
  const amount = input({ type: 'number', step: '0.01', min: '0' });
  const date = input({ type: 'date', value: todayIso() });
  const ref = input({ type: 'text', placeholder: L('Reference', 'مرجع') });
  const desc = input({ type: 'text', placeholder: L('Reason / description', 'السبب / البيان') });
  const msg = h('div');

  async function loadTargets() {
    const t = type.value;
    let opts;
    if (t === 'bank_account') opts = await bankAccountOptions();
    else if (t === 'vendor') opts = await optionsFor('vendors', '', (r) => `${r.code ? r.code+' - ' : ''}${L(r.name_en, r.name_ar || r.name_en)} (${money(r.balance||0)})`);
    else if (t === 'customer') opts = await optionsFor('customers', '', (r) => `${r.code ? r.code+' - ' : ''}${L(r.name_en, r.name_ar || r.name_en)} (${money(r.balance||0)})`);
    else if (t === 'student') opts = await optionsFor('students', '', (r) => `${r.code ? r.code+' - ' : ''}${L((r.first_name_en||'')+' '+(r.last_name_en||''), (r.first_name_ar||'')+' '+(r.last_name_ar||r.first_name_en||''))}`);
    else opts = await glAccountOptions();
    target.replaceChildren(...opts);
  }
  (async () => { contra.replaceChildren(...await glAccountOptions()); await loadTargets(); })();
  type.addEventListener('change', loadTargets);

  const submit = h('button', { class: 'btn btn--primary', onclick: async () => {
    try {
      submit.disabled = true; msg.replaceChildren();
      const body = { target_type: type.value, target_id: target.value, direction: direction.value, contra_account_id: contra.value, amount: amount.value, entry_date: date.value, reference: ref.value, description: desc.value };
      if (type.value === 'account') body.account_id_target = target.value;
      const r = await postJSON('/api/treasury/settlement', body);
      notify('success', L('Settlement posted', 'تم تسجيل التسوية'), `${L('Journal', 'قيد')} ${r.entry_no || r.journal_id}`);
      amount.value = ''; ref.value = ''; desc.value = '';
    } catch (e) { msg.replaceChildren(h('div', { class: 'alert alert--danger' }, e.message)); }
    finally { submit.disabled = false; }
  } }, icon('check'), L('Post settlement', 'ترحيل التسوية'));

  host.replaceChildren(card({ title: L('Balance settlement / adjustment', 'تسوية / تعديل رصيد'), subtitle: L('Adjust balances of cashboxes, banks, suppliers, customers, students or GL accounts and post a journal entry.', 'تعديل أرصدة الخزائن والبنوك والموردين والعملاء والطلاب أو حسابات الأستاذ مع إنشاء قيد يومي مؤثر.'),
    body: h('div', { class: 'col gap-3' },
      h('div', { class: 'form-grid' },
        field(L('Target type', 'نوع الجهة/الحساب'), type),
        field(L('Target', 'الجهة/الحساب'), target),
        field(L('Adjustment', 'نوع التسوية'), direction),
        field(L('Amount', 'المبلغ'), amount),
        field(L('Date', 'التاريخ'), date),
        field(L('Reference', 'المرجع'), ref),
      ),
      field(L('Contra GL account', 'الحساب المقابل (دفتر الأستاذ)'), contra),
      field(L('Reason / description', 'السبب / البيان'), desc),
      h('div', { class: 'alert alert--info' }, icon('info'), ' ', L('This creates a balanced journal entry (source: settlement). Choose the contra account carefully (e.g. expense/revenue/equity/opening adjustment) to reflect the reason.', 'سيتم إنشاء قيد يومي متوازن (المصدر: تسوية). اختر الحساب المقابل بعناية (مصروف/إيراد/حقوق ملكية/تسوية) بما يعكس سبب التعديل.')),
      msg,
      submit,
    ) }));

  return h('div', { class: 'view' }, pageHeader({ title: L('Balance settlements', 'التسويات'), subtitle: L('Adjust and reconcile balances with journal impact.', 'تسوية ومطابقة الأرصدة مع تأثير على القيود اليومية.'), iconName: 'scale' }), host);
}

/* ---------------- Opening balances ---------------- */
export async function renderOpeningBalances() {
  if (!store.can('journal_entries.create')) return h('div', { class: 'view' }, card({ body: emptyState({ iconName: 'shield', title: L('Access denied', 'الوصول مرفوض') }) }));
  const host = h('div');
  const type = select({}, [
    option('bank_account', L('Cashbox / Bank', 'خزينة / بنك')),
    option('account', L('GL account', 'حساب دفتر أستاذ')),
    option('vendor', L('Supplier / Vendor', 'مورد')),
    option('customer', L('Customer', 'عميل')),
    option('student', L('Student (receivable)', 'طالب (ذمم)')),
  ]);
  const target = select({});
  const nature = select({}, [option('debit', L('Debit balance (asset/expense)', 'رصيد مدين (أصل/مصروف)')), option('credit', L('Credit balance (liability/equity/revenue)', 'رصيد دائن (التزام/حقوق ملكية/إيراد)'))]);
  const contra = select({});
  const amount = input({ type: 'number', step: '0.01', min: '0' });
  const date = input({ type: 'date', value: todayIso() });
  const ref = input({ type: 'text', value: 'OPENING', placeholder: L('Reference', 'مرجع') });
  const desc = input({ type: 'text', placeholder: L('Description', 'الوصف') });
  const msg = h('div');

  async function loadTargets() {
    const t = type.value;
    let opts;
    if (t === 'bank_account') opts = await bankAccountOptions();
    else if (t === 'vendor') opts = await optionsFor('vendors', '', (r) => `${r.code ? r.code+' - ' : ''}${L(r.name_en, r.name_ar || r.name_en)}`);
    else if (t === 'customer') opts = await optionsFor('customers', '', (r) => `${r.code ? r.code+' - ' : ''}${L(r.name_en, r.name_ar || r.name_en)}`);
    else if (t === 'student') opts = await optionsFor('students', '', (r) => `${r.code ? r.code+' - ' : ''}${L((r.first_name_en||'')+' '+(r.last_name_en||''), (r.first_name_ar||'')+' '+(r.last_name_ar||r.first_name_en||''))}`);
    else opts = await glAccountOptions();
    target.replaceChildren(...opts);
  }
  (async () => { contra.replaceChildren(...await glAccountOptions()); await loadTargets(); })();
  type.addEventListener('change', loadTargets);

  const submit = h('button', { class: 'btn btn--primary', onclick: async () => {
    try {
      submit.disabled = true; msg.replaceChildren();
      const body = { target_type: type.value, target_id: target.value, nature: nature.value, contra_account_id: contra.value, amount: amount.value, entry_date: date.value, reference: ref.value, description: desc.value || (L('Opening balance','رصيد افتتاحي')) };
      if (type.value === 'account') body.account_id = target.value;
      const r = await postJSON('/api/treasury/opening-balance', body);
      notify('success', L('Opening balance posted', 'تم تسجيل الرصيد الافتتاحي'), `${L('Journal', 'قيد')} ${r.entry_no || r.journal_id}`);
      amount.value = '';
    } catch (e) { msg.replaceChildren(h('div', { class: 'alert alert--danger' }, e.message)); }
    finally { submit.disabled = false; }
  } }, icon('check'), L('Post opening balance', 'ترحيل الرصيد الافتتاحي'));

  host.replaceChildren(card({ title: L('Opening balances', 'الأرصدة الافتتاحية'), subtitle: L('Enter opening balances for cashboxes, banks, GL accounts, suppliers, customers and students with automatic opening journal entries.', 'إدخال الأرصدة الافتتاحية للخزائن والبنوك وحسابات الأستاذ والموردين والعملاء والطلاب مع قيود افتتاحية تلقائية.'),
    body: h('div', { class: 'col gap-3' },
      h('div', { class: 'form-grid' },
        field(L('Target type', 'نوع الجهة/الحساب'), type),
        field(L('Target', 'الجهة/الحساب'), target),
        field(L('Balance nature', 'طبيعة الرصيد'), nature),
        field(L('Amount', 'المبلغ'), amount),
        field(L('As of date', 'تاريخ الرصيد'), date),
        field(L('Reference', 'المرجع'), ref),
      ),
      field(L('Contra equity/opening account', 'الحساب المقابل (حقوق ملكية/افتتاحي)'), contra),
      field(L('Description', 'الوصف'), desc),
      h('div', { class: 'alert alert--info' }, icon('info'), ' ', L('Posts a balanced opening journal entry. For bank/cashbox targets, the linked GL account is used and its opening/current balance is synchronized.', 'يُنشئ قيداً افتتاحياً متوازناً. بالنسبة للخزائن/البنوك يُستخدم حساب دفتر الأستاذ المرتبط وتتم مزامنة الرصيد.')),
      msg,
      submit,
    ) }));

  return h('div', { class: 'view' }, pageHeader({ title: L('Opening balances', 'الأرصدة الافتتاحية'), subtitle: L('Set opening balances with journal impact.', 'إدخال الأرصدة الافتتاحية مع تأثير على القيود.'), iconName: 'flag' }), host);
}
