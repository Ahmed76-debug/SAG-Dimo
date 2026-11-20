/* ============================================================
   Auto Car — التقارير (مالية + إدارية)
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, fmtDate, state, pick, todayStr, monthStart, exportCustom, printHtml } from '../core.js';
import { renderTable, emptyState, barChart, statusBadge, toast } from '../ui.js';

function yearStart() { return todayStr().slice(0, 4) + '-01-01'; }

export async function render(container, item) {
  const key = item.key;
  const range = !['balance-sheet', 'report-inventory', 'report-receivables', 'report-payables'].includes(key);
  const asOf = key === 'balance-sheet';
  const needAccount = key === 'ledger';
  let from = yearStart(), to = todayStr(), asofDate = todayStr(), accountId = '';

  container.innerHTML = `
    <div class="toolbar mb-2">
      ${range ? `<input class="input" type="date" data-from style="max-width:160px" value="${from}"><span class="muted">${t('to')}</span><input class="input" type="date" data-to style="max-width:160px" value="${to}">` : ''}
      ${asOf ? `<span class="muted">${t('as_of')}</span><input class="input" type="date" data-asof style="max-width:170px" value="${asofDate}">` : ''}
      ${needAccount ? `<select class="select" data-account style="max-width:300px"><option value="">— ${t('account')} —</option></select>` : ''}
      <button class="btn btn-soft btn-sm" data-reload>${icon('refresh', 'sm')} ${t('refresh')}</button>
      <div class="grow"></div>
      <button class="btn btn-ghost" data-print>${icon('print', 'sm')} ${t('print')}</button>
      <button class="btn btn-ghost" data-export>${icon('sheet', 'sm')} ${t('export_excel')}</button>
    </div>
    <div data-report></div>`;

  if (needAccount) {
    const acc = await api('/accounts');
    container.querySelector('[data-account]').innerHTML = `<option value="">— ${t('account')} —</option>` + acc.items.map((a) => `<option value="${a.id}">${esc(a.code)} — ${esc(state.lang === 'en' && a.name_en ? a.name_en : a.name)}</option>`).join('');
  }

  const R = {}; // { html, cols, rows, title }

  async function build() {
    const body = container.querySelector('[data-report]');
    body.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const qs = range ? `?from=${from}&to=${to}` : asOf ? `?as_of=${asofDate}` : '';
    try {
      if (key === 'trial-balance') {
        const d = await api('/reports/trial-balance' + qs);
        R.title = t('trial_balance');
        R.cols = [['code', t('account_code')], ['name', t('account_name')], ['debit', t('debit')], ['credit', t('credit_col')], ['balance', t('balance')]];
        R.rows = d.rows;
        R.html = `<div class="card"><div class="card-head"><h3>${t('trial_balance')} <span class="muted small">${from} → ${to}</span></h3></div>
          <div class="table-wrap"><table class="data"><thead><tr><th>${t('account_code')}</th><th>${t('account_name')}</th><th class="num">${t('debit')}</th><th class="num">${t('credit_col')}</th><th class="num">${t('balance')}</th></tr></thead>
          <tbody>${d.rows.map((r) => `<tr><td class="mono small">${esc(r.code)}</td><td>${esc(state.lang === 'en' && r.name_en ? r.name_en : r.name)}</td><td class="num">${r.debit ? money(r.debit, false) : '—'}</td><td class="num">${r.credit ? money(r.credit, false) : '—'}</td><td class="num"><b>${money(r.signed_balance, false)}</b></td></tr>`).join('') || `<tr><td colspan="5" class="muted" style="text-align:center;padding:20px">${t('no_data')}</td></tr>`}
          <tr class="strong"><td colspan="2">${t('total')}</td><td class="num">${money(d.totals.debit, false)}</td><td class="num">${money(d.totals.credit, false)}</td><td class="num">${d.totals.debit === d.totals.credit ? `<span class="badge badge-success">${t('balanced')}</span>` : `<span class="badge badge-danger">${t('unbalanced')}</span>`}</td></tr></tbody></table></div></div>`;
      } else if (key === 'income-statement' || key === 'report-profit') {
        const d = await api('/reports/' + (key === 'report-profit' ? 'profit' : 'income-statement') + qs);
        R.title = t(key === 'report-profit' ? 'report_profit' : 'income_statement');
        R.cols = [['name', t('account_name')], ['amount', t('amount')]];
        R.rows = [...d.revenue.map((x) => ({ name: x.name, amount: x.amount })), ...d.expenses.map((x) => ({ name: x.name, amount: -x.amount }))];
        const sec = (title, rows, total, tone) => `<div class="pl-sec"><div class="pl-title">${title}</div>${rows.map((r) => `<div class="pl-row"><span>${esc(state.lang === 'en' && r.name_en ? r.name_en : r.name)}</span><b>${money(r.amount)}</b></div>`).join('') || `<div class="pl-row muted">${t('no_data')}</div>`}<div class="pl-row strong"><span>${t('total')}</span><b class="${tone}">${money(total)}</b></div></div>`;
        R.html = `<div class="grid cols-2">
          <div class="card card-pad">${sec(t('revenue'), d.revenue, d.revenue_total, 'text-success')}</div>
          <div class="card card-pad">${sec(t('expenses'), d.expenses, d.expenses_total, 'text-danger')}</div></div>
          <div class="card card-pad mt-2 net-card"><span>${t('net_income')}</span><b class="${d.net_income >= 0 ? 'text-success' : 'text-danger'}">${money(d.net_income)}</b></div>
          ${key === 'report-profit' ? `<div class="grid cols-2 mt-2">
            <div class="mini-stat"><div class="ms-label">${t('vehicle_profit') || t('profit')}</div><div class="ms-val">${money(d.vehicle_profit)}</div></div>
            <div class="mini-stat"><div class="ms-label">${t('commission_amount')}</div><div class="ms-val">${money(d.commission)}</div></div></div>` : ''}`;
      } else if (key === 'balance-sheet') {
        const d = await api('/reports/balance-sheet' + qs);
        R.title = t('balance_sheet');
        R.cols = [['group', t('account_type')], ['name', t('account_name')], ['balance', t('balance')]];
        R.rows = [...d.assets.map((x) => ({ group: t('assets'), name: x.name, balance: x.balance })), ...d.liabilities.map((x) => ({ group: t('liabilities'), name: x.name, balance: x.balance })), ...d.equity.map((x) => ({ group: t('equity'), name: x.name, balance: x.balance }))];
        const sec = (title, rows, total) => `<div class="pl-sec"><div class="pl-title">${title}</div>${rows.map((r) => `<div class="pl-row"><span>${esc(state.lang === 'en' && r.name_en ? r.name_en : r.name)}</span><b>${money(r.balance)}</b></div>`).join('') || `<div class="pl-row muted">${t('no_data')}</div>`}<div class="pl-row strong"><span>${t('total')}</span><b>${money(total)}</b></div></div>`;
        R.html = `<div class="card card-pad mb-2 ${d.balanced ? 'balanced-card' : ''}">
            <div class="row between"><b>${t('balance_sheet')} — ${t('as_of')} ${esc(d.as_of)}</b>
            ${d.balanced ? `<span class="badge badge-success">${icon('check-circle', 'sm')} ${t('balanced_ok')}</span>` : `<span class="badge badge-danger">${t('not_balanced')}</span>`}</div></div>
          <div class="grid cols-2">
            <div class="card card-pad">${sec(t('assets'), d.assets, d.assets_total)}</div>
            <div class="card card-pad">${sec(t('liabilities'), d.liabilities, d.liabilities_total)}${sec(t('equity'), d.equity, d.equity_total)}<div class="pl-row strong"><span>${t('net_income')}</span><b>${money(d.net_income)}</b></div><div class="pl-row strong"><span>${t('total')} ${t('liabilities')} + ${t('equity')}</span><b>${money(d.total_liabilities_equity)}</b></div></div>
          </div>`;
      } else if (key === 'equity') {
        const d = await api('/reports/equity' + qs);
        R.title = t('equity_statement');
        R.cols = [['name', t('account_name')], ['amount', t('amount')]];
        R.rows = d.rows;
        R.html = `<div class="card card-pad">
          <div class="grid cols-4 mb-2">
            <div class="mini-stat"><div class="ms-label">${t('capital') || t('equity')}</div><div class="ms-val">${money(d.capital)}</div></div>
            <div class="mini-stat"><div class="ms-label">${t('retained') || t('equity')}</div><div class="ms-val">${money(d.retained)}</div></div>
            <div class="mini-stat"><div class="ms-label">${t('drawings') || t('expense')}</div><div class="ms-val">${money(d.drawings)}</div></div>
            <div class="mini-stat"><div class="ms-label">${t('net_income')}</div><div class="ms-val ${d.net_income >= 0 ? 'text-success' : 'text-danger'}">${money(d.net_income)}</div></div>
          </div>
          <div class="pl-sec"><div class="pl-row"><span>${t('opening_balance')}</span><b>${money(d.opening_balance)}</b></div><div class="pl-row"><span>${t('net_income')}</span><b>${money(d.net_income)}</b></div><div class="pl-row"><span>${t('drawings') || t('expense')}</span><b class="text-danger">-${money(d.drawings, false)}</b></div><div class="pl-row strong"><span>${t('balance')}</span><b>${money(d.closing_balance)}</b></div></div>
          <div class="table-wrap mt-2"><table class="data"><thead><tr><th>${t('account_code')}</th><th>${t('account_name')}</th><th class="num">${t('amount')}</th></tr></thead><tbody>${d.rows.map((r) => `<tr><td class="mono small">${esc(r.code)}</td><td>${esc(state.lang === 'en' && r.name_en ? r.name_en : r.name)}</td><td class="num">${money(r.amount)}</td></tr>`).join('')}</tbody></table></div></div>`;
      } else if (key === 'ledger') {
        if (!accountId) { body.innerHTML = emptyState(t('account'), 'ledger'); return; }
        const d = await api('/reports/general-ledger' + qs + `&account_id=${accountId}`);
        R.title = t('general_ledger');
        R.cols = [['date', t('date')], ['entry_no', t('entry_no')], ['entry_desc', t('description')], ['debit', t('debit')], ['credit', t('credit_col')], ['running', t('running_balance')]];
        R.rows = d.rows;
        R.html = `<div class="card"><div class="card-head"><h3>${t('general_ledger')} — ${esc(d.account ? d.account.name : '')}</h3><span class="badge badge-brand">${t('opening_balance')}: ${money(d.opening)}</span></div>
          <div class="table-wrap"><table class="data"><thead><tr><th>${t('date')}</th><th>${t('entry_no')}</th><th>${t('description')}</th><th class="num">${t('debit')}</th><th class="num">${t('credit_col')}</th><th class="num">${t('running_balance')}</th></tr></thead>
          <tbody>${d.rows.map((r) => `<tr><td>${esc(fmtDate(r.date))}</td><td class="mono small">${esc(r.entry_no)}</td><td>${esc(r.entry_desc || r.description || '')}</td><td class="num">${r.debit ? money(r.debit, false) : '—'}</td><td class="num">${r.credit ? money(r.credit, false) : '—'}</td><td class="num"><b>${money(r.running, false)}</b></td></tr>`).join('') || `<tr><td colspan="6" class="muted" style="text-align:center;padding:20px">${t('no_data')}</td></tr>`}</tbody></table></div></div>`;
      } else if (key === 'report-sales') {
        const d = await api('/reports/sales' + qs);
        R.title = t('report_sales');
        R.cols = [['type', t('sale_type')], ['count', t('rows')], ['total', t('total')], ['profit', t('profit')]];
        R.rows = d.byType;
        const s = d.summary;
        R.html = `<div class="grid cols-4 mb-2">
            <div class="stat"><div class="stat-icon tone-brand">${icon('receipt', 'lg')}</div><div><div class="stat-label">${t('invoices')}</div><div class="stat-val">${fmtNum(s.invoices, 0)}</div></div></div>
            <div class="stat"><div class="stat-icon tone-success">${icon('cash', 'lg')}</div><div><div class="stat-label">${t('total')}</div><div class="stat-val">${money(s.total)}</div></div></div>
            <div class="stat"><div class="stat-icon tone-info">${icon('check', 'lg')}</div><div><div class="stat-label">${t('paid')}</div><div class="stat-val">${money(s.paid)}</div></div></div>
            <div class="stat"><div class="stat-icon tone-purple">${icon('trend', 'lg')}</div><div><div class="stat-label">${t('profit')}</div><div class="stat-val">${money(s.profit)}</div></div></div></div>
          <div class="grid cols-2">
            <div class="card card-pad"><h4>${t('by_type')}</h4>${renderTable({ columns: [{ key: 'type', label: t('sale_type'), render: (r) => statusBadge(r.type) }, { key: 'count', label: t('rows'), align: 'end' }, { key: 'total', label: t('total'), align: 'end', render: (r) => money(r.total) }, { key: 'profit', label: t('profit'), align: 'end', render: (r) => money(r.profit) }], rows: d.byType })}</div>
            <div class="card card-pad"><h4>${t('by_user')}</h4>${renderTable({ columns: [{ key: 'name', label: t('user') }, { key: 'count', label: t('rows'), align: 'end' }, { key: 'total', label: t('total'), align: 'end', render: (r) => money(r.total) }], rows: d.byUser })}</div>
          </div>
          <div class="card card-pad mt-2"><h4>${t('by_day')}</h4>${barChart(d.byDay.map((x) => ({ ...x, month: x.date })), { valueKey: 'total', labelKey: 'date' })}</div>`;
      } else if (key === 'report-purchases') {
        const d = await api('/reports/purchases' + qs);
        R.title = t('report_purchases');
        R.cols = [['name', t('supplier')], ['count', t('rows')], ['total', t('total')]];
        R.rows = d.bySupplier;
        const s = d.summary;
        R.html = `<div class="grid cols-3 mb-2">
            <div class="stat"><div class="stat-icon tone-brand">${icon('truck', 'lg')}</div><div><div class="stat-label">${t('invoices')}</div><div class="stat-val">${fmtNum(s.invoices, 0)}</div></div></div>
            <div class="stat"><div class="stat-icon tone-success">${icon('cash', 'lg')}</div><div><div class="stat-label">${t('total')}</div><div class="stat-val">${money(s.total)}</div></div></div>
            <div class="stat"><div class="stat-icon tone-warn">${icon('clock', 'lg')}</div><div><div class="stat-label">${t('remaining')}</div><div class="stat-val">${money(s.remaining)}</div></div></div></div>
          <div class="card card-pad"><h4>${t('by_type') || t('supplier')}</h4>${renderTable({ columns: [{ key: 'name', label: t('supplier') }, { key: 'count', label: t('rows'), align: 'end' }, { key: 'total', label: t('total'), align: 'end', render: (r) => money(r.total) }], rows: d.bySupplier })}</div>`;
      } else if (key === 'report-inventory') {
        const d = await api('/reports/inventory');
        R.title = t('report_inventory');
        R.cols = [['code', t('code')], ['brand_name', t('brand')], ['model_name', t('model')], ['year', t('year')], ['cost_price', t('cost_price')], ['target_price', t('target_price')], ['days_in_stock', t('days_in_stock')]];
        R.rows = d.items;
        R.html = `<div class="grid cols-4 mb-2">
            <div class="stat"><div class="stat-icon tone-brand">${icon('car', 'lg')}</div><div><div class="stat-label">${t('inventory_count')}</div><div class="stat-val">${fmtNum(d.count, 0)}</div></div></div>
            <div class="stat"><div class="stat-icon tone-info">${icon('wallet', 'lg')}</div><div><div class="stat-label">${t('inventory_cost')}</div><div class="stat-val">${money(d.total_cost)}</div></div></div>
            <div class="stat"><div class="stat-icon tone-success">${icon('tag', 'lg')}</div><div><div class="stat-label">${t('target_price')}</div><div class="stat-val">${money(d.total_target)}</div></div></div>
            <div class="stat"><div class="stat-icon tone-purple">${icon('trend', 'lg')}</div><div><div class="stat-label">${t('expected_profit')}</div><div class="stat-val">${money(d.expected_profit)}</div></div></div></div>
          <div class="card">${renderTable({ columns: [
            { key: 'code', label: t('code'), render: (r) => `<b>${esc(r.code)}</b>` },
            { key: 'brand_name', label: t('brand'), render: (r) => esc(r.brand_name || '—') },
            { key: 'model_name', label: t('model'), render: (r) => esc(r.model_name || '—') },
            { key: 'year', label: t('year') }, { key: 'color_name', label: t('color'), render: (r) => esc(r.color_name || '—') },
            { key: 'cost_price', label: t('cost_price'), align: 'end', render: (r) => money(r.cost_price) },
            { key: 'target_price', label: t('target_price'), align: 'end', render: (r) => money(r.target_price) },
            { key: 'days_in_stock', label: t('days_in_stock'), align: 'end', render: (r) => `<span class="badge ${r.days_in_stock > 90 ? 'badge-danger' : r.days_in_stock > 45 ? 'badge-warn' : 'badge'}">${fmtNum(r.days_in_stock, 0)}</span>` },
          ], rows: d.items })}</div>`;
      } else if (key === 'report-receivables' || key === 'report-payables') {
        const isRec = key === 'report-receivables';
        const d = await api('/reports/' + (isRec ? 'receivables' : 'payables'));
        R.title = t(isRec ? 'report_receivables' : 'report_payables');
        R.cols = [['name', t('name')], ['phone', t('phone')], ['balance', t('balance')]];
        R.rows = d.items;
        R.html = `<div class="stat mb-2" style="max-width:340px"><div class="stat-icon tone-${isRec ? 'success' : 'danger'}">${icon('wallet', 'lg')}</div><div><div class="stat-label">${t('total')}</div><div class="stat-val">${money(d.total)}</div></div></div>
          <div class="card">${renderTable({ columns: [
            { key: 'name', label: t('name'), render: (r) => `<b>${esc(r.name)}</b>` },
            { key: 'phone', label: t('phone'), render: (r) => esc(r.phone || '—') },
            { key: 'balance', label: t('balance'), align: 'end', render: (r) => `<b class="${isRec ? 'text-danger' : 'text-success'}">${money(r.balance)}</b>` },
          ], rows: d.items })}</div>`;
      } else if (key === 'report-installments') {
        const d = await api('/reports/installments' + qs);
        R.title = t('report_installments');
        R.cols = [['customer_name', t('customer')], ['due_date', t('due_date')], ['amount', t('amount')], ['paid_amount', t('paid_amount')], ['status', t('status')]];
        R.rows = d.overdue;
        R.html = `<div class="grid cols-3 mb-2">
            <div class="stat"><div class="stat-icon tone-brand">${icon('calendar', 'lg')}</div><div><div class="stat-label">${t('rows')}</div><div class="stat-val">${fmtNum(d.summary.count, 0)}</div></div></div>
            <div class="stat"><div class="stat-icon tone-success">${icon('cash', 'lg')}</div><div><div class="stat-label">${t('paid')}</div><div class="stat-val">${money(d.summary.paid)}</div></div></div>
            <div class="stat"><div class="stat-icon tone-danger">${icon('alert', 'lg')}</div><div><div class="stat-label">${t('remaining')}</div><div class="stat-val">${money(Number(d.summary.amount) - Number(d.summary.paid))}</div></div></div></div>
          <div class="grid cols-2 mb-2"><div class="card card-pad"><h4>${t('by_type') || t('status')}</h4>${renderTable({ columns: [{ key: 'status', label: t('status'), render: (r) => statusBadge(r.status) }, { key: 'count', label: t('rows'), align: 'end' }, { key: 'remaining', label: t('remaining'), align: 'end', render: (r) => money(r.remaining) }], rows: d.byStatus })}</div></div>
          <div class="card"><div class="card-head"><h3>${t('overdue')}</h3></div>${renderTable({ columns: [
            { key: 'customer_name', label: t('customer'), render: (r) => esc(r.customer_name || '—') }, { key: 'phone', label: t('phone'), render: (r) => esc(r.phone || '—') },
            { key: 'due_date', label: t('due_date'), render: (r) => esc(fmtDate(r.due_date)) }, { key: 'amount', label: t('amount'), align: 'end', render: (r) => money(r.amount) },
            { key: 'paid_amount', label: t('paid_amount'), align: 'end', render: (r) => money(r.paid_amount) }, { key: 'status', label: t('status'), render: (r) => statusBadge(r.status) },
          ], rows: d.overdue })}</div>`;
      }
      body.innerHTML = R.html;
    } catch (e) { body.innerHTML = emptyState(e.message, 'alert'); }
  }

  container.querySelector('[data-reload]').onclick = build;
  const f = container.querySelector('[data-from]'); if (f) f.onchange = (e) => { from = e.target.value; build(); };
  const tt = container.querySelector('[data-to]'); if (tt) tt.onchange = (e) => { to = e.target.value; build(); };
  const ao = container.querySelector('[data-asof]'); if (ao) ao.onchange = (e) => { asofDate = e.target.value; build(); };
  const ac = container.querySelector('[data-account]'); if (ac) ac.onchange = (e) => { accountId = e.target.value; build(); };
  container.querySelector('[data-print]').onclick = () => printHtml(`<h2>${esc(state.settings.company_name || '')} — ${esc(R.title || item.label)}</h2>${container.querySelector('[data-report]').innerHTML}`, R.title);
  container.querySelector('[data-export]').onclick = () => { if (!R.cols) return toast(t('no_data'), 'warn'); exportCustom(R.title || item.label, R.cols.map(([key, label]) => ({ key, label })), R.rows || [], (key || 'report') + '.xlsx'); };
  build();
}
