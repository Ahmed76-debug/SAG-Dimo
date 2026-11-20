/* PharmaPro – Reports, accounting & shifts */
(function () {
  'use strict';
  const ui = App.ui;
  const fmt = App.fmt;

  function rangeToolbar(state, extra = '') {
    return `<div class="toolbar">
      <div class="flex items-center gap-2">
        <label class="small muted">من</label>
        <input class="input sm" type="date" data-from value="${state.from}" style="width:142px">
        <label class="small muted">إلى</label>
        <input class="input sm" type="date" data-to value="${state.to}" style="width:142px">
      </div>
      <div class="chip-row">
        <button class="chip" data-quick="today">اليوم</button>
        <button class="chip" data-quick="7">7 أيام</button>
        <button class="chip" data-quick="30">30 يوم</button>
        <button class="chip" data-quick="month">هذا الشهر</button>
        <button class="chip" data-quick="year">هذه السنة</button>
      </div>
      ${extra}
    </div>`;
  }
  function bindRange(root, state, reload) {
    root.querySelectorAll('[data-quick]').forEach((b) => b.onclick = () => {
      const q = b.dataset.quick;
      const today = fmt.today();
      if (q === 'today') { state.from = today; state.to = today; }
      else if (q === 'month') { state.from = today.slice(0, 7) + '-01'; state.to = today; }
      else if (q === 'year') { state.from = today.slice(0, 4) + '-01-01'; state.to = today; }
      else { state.from = fmt.addDays(today, -(Number(q) - 1)); state.to = today; }
      root.querySelector('[data-from]').value = state.from;
      root.querySelector('[data-to]').value = state.to;
      reload();
    });
    const f = root.querySelector('[data-from]'); const t = root.querySelector('[data-to]');
    if (f) f.onchange = () => { state.from = f.value; reload(); };
    if (t) t.onchange = () => { state.to = t.value; reload(); };
  }
  function sum(arr, key) { return (arr || []).reduce((s, x) => s + Number(x[key] || 0), 0); }
  function money(n) { return fmt.money(n); }

  /* ================================================================== */
  /*                            REPORTS                                 */
  /* ================================================================== */
  const REPORT_TABS = [
    { id: 'sales', label: 'المبيعات', icon: 'receipt' },
    { id: 'products', label: 'الأصناف', icon: 'pill' },
    { id: 'profit', label: 'الأرباح', icon: 'trendingUp' },
    { id: 'tax', label: 'الضريبة', icon: 'percent' },
    { id: 'suppliers', label: 'الموردون', icon: 'truck' },
    { id: 'customers', label: 'العملاء', icon: 'users' },
    { id: 'shifts', label: 'الورديات', icon: 'clock' }
  ];

  async function renderReports(container, params) {
    const state = {
      tab: params.tab || 'sales', from: fmt.addDays(fmt.today(), -29), to: fmt.today(),
      group: 'day', sort: 'revenue'
    };
    let current = { print: null, export: null };

    container.innerHTML = `
      ${ui.pageHead({
        title: 'التقارير التحليلية',
        subtitle: 'مبيعات، أرباح، ضرائب، أداء الموردين والعملاء',
        actions: `<button class="btn" data-export-excel>${App.icon('download')} Excel</button>
          <button class="btn" data-export-pdf>${App.icon('file')} PDF</button>
          <button class="btn" data-print>${App.icon('printer')} طباعة</button>`
      })}
      <div class="card">
        <div id="rep-tabs">${ui.tabs(REPORT_TABS, state.tab)}</div>
        <div id="rep-body"></div>
      </div>`;

    const bodyEl = container.querySelector('#rep-body');
    container.querySelector('[data-print]').onclick = () => current.print && current.print();
    const ex = container.querySelector('[data-export-excel]');
    const pdf = container.querySelector('[data-export-pdf]');
    if (ex) ex.onclick = () => current.exportExcel && current.exportExcel();
    if (pdf) pdf.onclick = () => current.exportPdf && current.exportPdf();
    ui.bindTabs(container.querySelector('#rep-tabs'), (tab) => { state.tab = tab; load(); });

    function setActions(printFn, excelFn, pdfFn) { current = { print: printFn, exportExcel: excelFn, exportPdf: pdfFn || printFn }; }

    async function loadSales() {
      const r = await App.api(`/reports/sales?from=${state.from}&to=${state.to}&group=${state.group}`);
      const s = r.summary;
      const series = r.series.map((x) => ({ label: state.group === 'month' ? fmt.month(x.period) : String(x.period).slice(5), value: x.total }));
      bodyEl.innerHTML = `
        ${rangeToolbar(state, `<div class="btn-group">
          <button class="btn ${state.group === 'day' ? 'primary' : ''}" data-group="day">يومي</button>
          <button class="btn ${state.group === 'month' ? 'primary' : ''}" data-group="month">شهري</button>
        </div>`)}
        <div class="card-body">
          <div class="stat-grid">
            ${ui.stat({ label: 'إجمالي المبيعات', valueHtml: `${fmt.number(s.total)} <span class="cur">${App.currency()}</span>`, icon: 'banknote', tone: 'var(--primary)', tint: 'var(--primary-soft)', foot: `${fmt.number(s.invoices, 0)} فاتورة` })}
            ${ui.stat({ label: 'صافي بعد المرتجعات', valueHtml: `${fmt.number(s.net)} <span class="cur">${App.currency()}</span>`, icon: 'chart', tone: 'var(--accent)', tint: 'var(--accent-soft)', foot: `مرتجعات ${fmt.money(s.returns_total)}` })}
            ${ui.stat({ label: 'الربح الإجمالي', valueHtml: `${fmt.number(s.profit)} <span class="cur">${App.currency()}</span>`, icon: 'trendingUp', tone: 'var(--success)', tint: 'var(--success-soft)', foot: 'بعد تكلفة المبيعات والمرتجعات' })}
            ${ui.stat({ label: 'متوسط الفاتورة', valueHtml: `${fmt.number(s.invoices ? s.total / s.invoices : 0)} <span class="cur">${App.currency()}</span>`, icon: 'receipt', tone: 'var(--purple)', tint: 'var(--purple-soft)', foot: `خصومات ${fmt.money(s.discount)} · ضريبة ${fmt.money(s.tax)}` })}
          </div>
          ${ui.section({ title: 'تطور المبيعات', subtitle: `${state.from} → ${state.to}`, body: `<div style="color:var(--text)">${App.charts.area(series, { height: 240 })}</div>` })}
          <div class="two-col">
            <div>${ui.section({
              title: 'أفضل الأصناف', flush: true,
              body: ui.table({
                className: 'compact',
                columns: [
                  { label: 'الصنف', render: (p) => App.esc(p.name) },
                  { label: 'الكمية', tdClass: 'num', render: (p) => fmt.qty(p.qty) },
                  { label: 'الإيراد', tdClass: 'num', render: (p) => money(p.revenue) },
                  { label: 'التكلفة', tdClass: 'num', render: (p) => money(p.cost) },
                  { label: 'الربح', tdClass: 'num', render: (p) => `<b class="text-success">${money(p.revenue - p.cost)}</b>` }
                ],
                rows: r.top_products
              })
            })}</div>
            <div class="flex flex-col gap-4">
              ${ui.section({ title: 'حسب طريقة الدفع', body: r.by_payment.length ? App.charts.donut(r.by_payment.map((p) => ({ label: fmt.statusText(p.name), value: p.total })), { size: 144 }) : ui.empty({ icon: 'wallet', title: 'لا توجد بيانات' }) })}
              ${ui.section({
                title: 'أداء الموظفين', flush: true,
                body: ui.table({
                  className: 'compact',
                  columns: [
                    { label: 'الموظف', render: (u) => App.esc(u.name || '—') },
                    { label: 'فواتير', tdClass: 'num', render: (u) => fmt.number(u.count, 0) },
                    { label: 'المبيعات', tdClass: 'num', render: (u) => money(u.total) }
                  ],
                  rows: r.by_user
                })
              })}
            </div>
          </div>
        </div>`;
      bindRange(bodyEl, state, load);
      bodyEl.querySelectorAll('[data-group]').forEach((b) => b.onclick = () => { state.group = b.dataset.group; load(); });
      setActions(
        () => App.printA4('تقرير المبيعات', `
          <h1>تقرير المبيعات</h1>
          <div class="small">الفترة: ${state.from} → ${state.to}</div>
          <div class="totals"><div class="row"><span>عدد الفواتير</span><b>${fmt.number(s.invoices, 0)}</b></div>
          <div class="row"><span>الإجمالي</span><b>${money(s.total)}</b></div>
          <div class="row"><span>المرتجعات</span><b>${money(s.returns_total)}</b></div>
          <div class="row"><span>الضريبة</span><b>${money(s.tax)}</b></div>
          <div class="row grand"><span>صافي المبيعات</span><b>${money(s.net)}</b></div></div>
          <table><thead><tr><th>الفترة</th><th>فواتير</th><th>إجمالي</th><th>ضريبة</th><th>خصم</th></tr></thead>
          <tbody>${r.series.map((x) => `<tr><td>${x.period}</td><td class="num">${x.invoices}</td><td class="num">${money(x.total)}</td><td class="num">${money(x.tax)}</td><td class="num">${money(x.discount)}</td></tr>`).join('')}</tbody></table>
          <table><thead><tr><th>الصنف</th><th>الكمية</th><th>الإيراد</th><th>الربح</th></tr></thead>
          <tbody>${r.top_products.map((p) => `<tr><td>${App.esc(p.name)}</td><td class="num">${fmt.qty(p.qty)}</td><td class="num">${money(p.revenue)}</td><td class="num">${money(p.revenue - p.cost)}</td></tr>`).join('')}</tbody></table>`),
        () => App.exportExcel('sales-report-' + state.to, ['الفترة', 'الفواتير', 'الإجمالي', 'الضريبة', 'الخصم'], r.series.map((x) => [x.period, x.invoices, x.total, x.tax, x.discount]))
      );
    }

    async function loadProducts() {
      const r = await App.api(`/reports/products?from=${state.from}&to=${state.to}&sort=${state.sort}&limit=200`);
      bodyEl.innerHTML = `
        ${rangeToolbar(state, `<select class="select" data-sort style="width:170px">
          <option value="revenue" ${state.sort === 'revenue' ? 'selected' : ''}>الأعلى إيراداً</option>
          <option value="qty" ${state.sort === 'qty' ? 'selected' : ''}>الأكثر كمية</option>
          <option value="profit" ${state.sort === 'profit' ? 'selected' : ''}>الأعلى ربحاً</option>
          <option value="name" ${state.sort === 'name' ? 'selected' : ''}>الاسم</option>
        </select>`)}
        <div class="card-body">
          ${ui.table({
            columns: [
              { label: 'الصنف', render: (p) => `<div class="cell-title">${App.esc(p.name)}</div>` },
              { label: 'الكمية المباعة', tdClass: 'num', render: (p) => fmt.qty(p.qty) },
              { label: 'الإيراد', tdClass: 'num', render: (p) => money(p.revenue) },
              { label: 'التكلفة', tdClass: 'num', render: (p) => money(p.cost) },
              { label: 'الربح', tdClass: 'num', render: (p) => `<b class="${p.profit >= 0 ? 'text-success' : 'text-danger'}">${money(p.profit)}</b>` },
              { label: 'هامش الربح', tdClass: 'num', render: (p) => p.revenue ? `${fmt.number((p.profit / p.revenue) * 100)}%` : '—' }
            ],
            rows: r.items,
            empty: ui.empty({ icon: 'chart', title: 'لا توجد مبيعات في الفترة' })
          })}
        </div>`;
      bindRange(bodyEl, state, load);
      bodyEl.querySelector('[data-sort]').onchange = (e) => { state.sort = e.target.value; load(); };
      setActions(
        () => App.printA4('تقرير الأصناف', `<h1>تقرير مبيعات الأصناف</h1>
          <div class="small">الفترة: ${state.from} → ${state.to}</div>
          <table><thead><tr><th>الصنف</th><th>الكمية</th><th>الإيراد</th><th>التكلفة</th><th>الربح</th></tr></thead>
          <tbody>${r.items.map((p) => `<tr><td>${App.esc(p.name)}</td><td class="num">${fmt.qty(p.qty)}</td><td class="num">${money(p.revenue)}</td><td class="num">${money(p.cost)}</td><td class="num">${money(p.profit)}</td></tr>`).join('')}</tbody></table>`),
        () => App.exportExcel('products-report-' + state.to, ['الصنف', 'الكمية', 'الإيراد', 'التكلفة', 'الربح'], r.items.map((p) => [p.name, p.qty, p.revenue, p.cost, p.profit]))
      );
    }

    async function loadProfit() {
      const r = await App.api(`/reports/profit?from=${state.from}&to=${state.to}`);
      const series = r.rows.map((x) => ({ label: String(x.day).slice(5), value: x.profit }));
      bodyEl.innerHTML = `
        ${rangeToolbar(state)}
        <div class="card-body">
          <div class="stat-grid">
            ${ui.stat({ label: 'الإيراد (بدون ضريبة)', valueHtml: `${fmt.number(r.totals.revenue)} <span class="cur">${App.currency()}</span>`, icon: 'banknote', tone: 'var(--primary)', tint: 'var(--primary-soft)' })}
            ${ui.stat({ label: 'تكلفة البضاعة المباعة', valueHtml: `${fmt.number(r.totals.cost)} <span class="cur">${App.currency()}</span>`, icon: 'box', tone: 'var(--warning)', tint: 'var(--warning-soft)' })}
            ${ui.stat({ label: 'إجمالي الربح', valueHtml: `${fmt.number(r.totals.profit)} <span class="cur">${App.currency()}</span>`, icon: 'trendingUp', tone: 'var(--success)', tint: 'var(--success-soft)', foot: r.totals.revenue ? `هامش ${fmt.number((r.totals.profit / r.totals.revenue) * 100)}%` : '' })}
          </div>
          ${ui.section({ title: 'الربح اليومي', body: `<div style="color:var(--text)">${App.charts.area(series, { height: 240, color: '#10b981' })}</div>` })}
          ${ui.table({
            columns: [
              { label: 'اليوم', render: (x) => fmt.date(x.day) },
              { label: 'الإيراد', tdClass: 'num', render: (x) => money(x.revenue) },
              { label: 'التكلفة', tdClass: 'num', render: (x) => money(x.cost) },
              { label: 'الربح', tdClass: 'num', render: (x) => `<b class="text-success">${money(x.profit)}</b>` }
            ],
            rows: r.rows,
            empty: ui.empty({ icon: 'trendingUp', title: 'لا توجد بيانات ربح' })
          })}
        </div>`;
      bindRange(bodyEl, state, load);
      setActions(
        () => App.printA4('تقرير الأرباح', `<h1>تقرير الأرباح</h1>
          <div class="small">الفترة: ${state.from} → ${state.to}</div>
          <table><thead><tr><th>اليوم</th><th>الإيراد</th><th>التكلفة</th><th>الربح</th></tr></thead>
          <tbody>${r.rows.map((x) => `<tr><td>${x.day}</td><td class="num">${money(x.revenue)}</td><td class="num">${money(x.cost)}</td><td class="num">${money(x.profit)}</td></tr>`).join('')}</tbody></table>
          <div class="totals"><div class="row grand"><span>إجمالي الربح</span><b>${money(r.totals.profit)}</b></div></div>`),
        () => App.exportExcel('profit-report-' + state.to, ['اليوم', 'الإيراد', 'التكلفة', 'الربح'], r.rows.map((x) => [x.day, x.revenue, x.cost, x.profit]))
      );
    }

    async function loadTax() {
      const r = await App.api(`/reports/tax?from=${state.from}&to=${state.to}`);
      bodyEl.innerHTML = `
        ${rangeToolbar(state)}
        <div class="card-body">
          <div class="stat-grid">
            ${ui.stat({ label: 'ضريبة المخرجات (مبيعات)', valueHtml: `${fmt.number(r.output_tax)} <span class="cur">${App.currency()}</span>`, icon: 'percent', tone: 'var(--primary)', tint: 'var(--primary-soft)', foot: `مبيعات خاضعة ${fmt.money(r.taxable_sales)}` })}
            ${ui.stat({ label: 'ضريبة المدخلات (مشتريات)', valueHtml: `${fmt.number(r.input_tax)} <span class="cur">${App.currency()}</span>`, icon: 'truck', tone: 'var(--accent)', tint: 'var(--accent-soft)' })}
            ${ui.stat({ label: 'صافي الضريبة المستحقة', valueHtml: `${fmt.number(r.net_payable)} <span class="cur">${App.currency()}</span>`, icon: 'wallet', tone: 'var(--warning)', tint: 'var(--warning-soft)' })}
          </div>
          ${ui.section({
            title: 'الإقرار الضريبي الشهري', flush: true,
            body: ui.table({
              columns: [
                { label: 'الشهر', render: (x) => fmt.month(x.period) },
                { label: 'الوعاء الضريبي', tdClass: 'num', render: (x) => money(x.net) },
                { label: 'الضريبة', tdClass: 'num', render: (x) => `<b>${money(x.tax)}</b>` }
              ],
              rows: r.rows,
              empty: ui.empty({ icon: 'percent', title: 'لا توجد بيانات ضريبية' })
            })
          })}
        </div>`;
      bindRange(bodyEl, state, load);
      setActions(
        () => App.printA4('الإقرار الضريبي', `<h1>ملخص ضريبة القيمة المضافة</h1>
          <div class="small">الفترة: ${state.from} → ${state.to}</div>
          <div class="totals"><div class="row"><span>ضريبة المخرجات</span><b>${money(r.output_tax)}</b></div>
          <div class="row"><span>ضريبة المدخلات</span><b>${money(r.input_tax)}</b></div>
          <div class="row grand"><span>الصافي المستحق</span><b>${money(r.net_payable)}</b></div></div>
          <table><thead><tr><th>الشهر</th><th>الوعاء</th><th>الضريبة</th></tr></thead>
          <tbody>${r.rows.map((x) => `<tr><td>${x.period}</td><td class="num">${money(x.net)}</td><td class="num">${money(x.tax)}</td></tr>`).join('')}</tbody></table>`),
        () => App.exportExcel('tax-report-' + state.to, ['الشهر', 'الوعاء', 'الضريبة'], r.rows.map((x) => [x.period, x.net, x.tax]))
      );
    }

    async function loadSuppliers() {
      const r = await App.api('/reports/suppliers');
      bodyEl.innerHTML = `<div class="card-body">
        ${ui.table({
          columns: [
            { label: 'المورد', render: (s) => `<div class="cell-title">${App.esc(s.name)}</div><div class="cell-sub">${App.esc(s.contact_name || '')}</div>` },
            { label: 'فواتير التوريد', tdClass: 'num', render: (s) => fmt.number(s.purchases_count, 0) },
            { label: 'إجمالي المشتريات', tdClass: 'num', render: (s) => money(s.purchases_total) },
            { label: 'الرصيد المستحق', tdClass: 'num', render: (s) => Number(s.balance) > 0.009 ? `<b class="text-warning">${money(s.balance)}</b>` : '<span class="badge success">مسدد</span>' }
          ],
          rows: r.items,
          empty: ui.empty({ icon: 'truck', title: 'لا يوجد موردون' })
        })}
      </div>`;
      setActions(
        () => App.printA4('تقرير الموردين', `<h1>تقرير الموردين والأرصدة</h1>
          <table><thead><tr><th>المورد</th><th>الفواتير</th><th>المشتريات</th><th>المستحق</th></tr></thead>
          <tbody>${r.items.map((s) => `<tr><td>${App.esc(s.name)}</td><td class="num">${s.purchases_count}</td><td class="num">${money(s.purchases_total)}</td><td class="num">${money(s.balance)}</td></tr>`).join('')}</tbody></table>`),
        () => App.exportExcel('suppliers-report', ['المورد', 'الفواتير', 'المشتريات', 'المستحق'], r.items.map((s) => [s.name, s.purchases_count, s.purchases_total, s.balance]))
      );
    }

    async function loadCustomers() {
      const r = await App.api('/reports/customers');
      bodyEl.innerHTML = `<div class="card-body">
        ${ui.table({
          columns: [
            { label: 'العميل', render: (c) => `<div class="cell-title">${App.esc(c.name)}</div><div class="cell-sub ltr">${App.esc(c.phone || '')}</div>` },
            { label: 'الفواتير', tdClass: 'num', render: (c) => fmt.number(c.invoices, 0) },
            { label: 'إجمالي المشتريات', tdClass: 'num', render: (c) => money(c.total_spent) },
            { label: 'الرصيد المستحق', tdClass: 'num', render: (c) => Number(c.balance) > 0.009 ? `<b class="text-warning">${money(c.balance)}</b>` : '—' },
            { label: 'نقاط الولاء', tdClass: 'num', render: (c) => fmt.number(c.loyalty_points, 0) },
            { label: 'آخر زيارة', render: (c) => c.last_visit ? fmt.date(c.last_visit) : '—' }
          ],
          rows: r.items,
          empty: ui.empty({ icon: 'users', title: 'لا يوجد عملاء' })
        })}
      </div>`;
      setActions(
        () => App.printA4('تقرير العملاء', `<h1>تقرير العملاء والمبيعات</h1>
          <table><thead><tr><th>العميل</th><th>الفواتير</th><th>المشتريات</th><th>الرصيد</th></tr></thead>
          <tbody>${r.items.map((c) => `<tr><td>${App.esc(c.name)}</td><td class="num">${c.invoices}</td><td class="num">${money(c.total_spent)}</td><td class="num">${money(c.balance)}</td></tr>`).join('')}</tbody></table>`),
        () => App.exportExcel('customers-report', ['العميل', 'الهاتف', 'الفواتير', 'المشتريات', 'الرصيد'], r.items.map((c) => [c.name, c.phone, c.invoices, c.total_spent, c.balance]))
      );
    }

    async function loadShifts() {
      const r = await App.api(`/reports/shifts?from=${state.from}&to=${state.to}`);
      bodyEl.innerHTML = `
        ${rangeToolbar(state)}
        <div class="card-body">
          ${ui.table({
            columns: [
              { label: 'الوردية', render: (s) => `<div class="cell-title">#${s.id} · ${App.esc(s.user_name)}</div><div class="cell-sub">${fmt.datetime(s.opened_at)}</div>` },
              { label: 'الإغلاق', render: (s) => s.closed_at ? fmt.datetime(s.closed_at) : '<span class="badge success">مفتوحة</span>' },
              { label: 'فواتير', tdClass: 'num', render: (s) => fmt.number(s.invoices, 0) },
              { label: 'المبيعات', tdClass: 'num', render: (s) => money(s.sales_total) },
              { label: 'افتتاحي', tdClass: 'num', render: (s) => money(s.opening_cash) },
              { label: 'إغلاق', tdClass: 'num', render: (s) => s.closed_at ? money(s.closing_cash) : '—' },
              { label: 'الفرق', tdClass: 'num', render: (s) => s.closed_at ? `<span class="${Number(s.difference) < 0 ? 'text-danger' : 'text-success'}">${money(s.difference)}</span>` : '—' },
              { label: 'الحالة', render: (s) => App.badge(s.status) }
            ],
            rows: r.rows,
            empty: ui.empty({ icon: 'clock', title: 'لا توجد ورديات في الفترة' })
          })}
        </div>`;
      bindRange(bodyEl, state, load);
      setActions(
        () => App.printA4('تقرير الورديات', `<h1>تقرير الورديات</h1>
          <div class="small">الفترة: ${state.from} → ${state.to}</div>
          <table><thead><tr><th>الموظف</th><th>الفتح</th><th>الإغلاق</th><th>المبيعات</th><th>الفرق</th></tr></thead>
          <tbody>${r.rows.map((s) => `<tr><td>${App.esc(s.user_name)}</td><td>${fmt.datetime(s.opened_at)}</td><td>${s.closed_at ? fmt.datetime(s.closed_at) : '—'}</td><td class="num">${money(s.sales_total)}</td><td class="num">${s.closed_at ? money(s.difference) : '—'}</td></tr>`).join('')}</tbody></table>`),
        () => App.exportExcel('shifts-report-' + state.to, ['الموظف', 'الفتح', 'الإغلاق', 'المبيعات', 'الفرق'], r.rows.map((s) => [s.user_name, s.opened_at, s.closed_at || '', s.sales_total, s.difference || 0]))
      );
    }

    async function load() {
      bodyEl.innerHTML = `<div class="loading-block"><span class="spinner"></span> جارٍ إعداد التقرير...</div>`;
      try {
        if (state.tab === 'products') await loadProducts();
        else if (state.tab === 'profit') await loadProfit();
        else if (state.tab === 'tax') await loadTax();
        else if (state.tab === 'suppliers') await loadSuppliers();
        else if (state.tab === 'customers') await loadCustomers();
        else if (state.tab === 'shifts') await loadShifts();
        else await loadSales();
      } catch (err) {
        bodyEl.innerHTML = `<div class="card-pad">${ui.empty({ icon: 'alert', title: 'تعذر إعداد التقرير', text: App.esc(err.message) })}</div>`;
      }
    }
    load();
  }

  /* ================================================================== */
  /*                          ACCOUNTING                                */
  /* ================================================================== */
  const ACC_TABS = [
    { id: 'journal', label: 'دفتر اليومية', icon: 'book' },
    { id: 'trial', label: 'ميزان المراجعة', icon: 'scale' },
    { id: 'pnl', label: 'الأرباح والخسائر', icon: 'trendingUp' },
    { id: 'balance', label: 'الميزانية العمومية', icon: 'wallet' },
    { id: 'ledger', label: 'دفتر الأستاذ', icon: 'layers' },
    { id: 'expenses', label: 'المصروفات', icon: 'banknote' },
    { id: 'accounts', label: 'دليل الحسابات', icon: 'list' }
  ];
  const ACCOUNT_TYPES = { asset: 'أصول', liability: 'التزامات', equity: 'حقوق ملكية', revenue: 'إيرادات', expense: 'مصروفات' };

  async function renderAccounting(container, params) {
    const state = { tab: params.tab || 'journal', from: fmt.addDays(fmt.today(), -29), to: fmt.today(), search: '', page: 1 };
    let current = { print: null, export: null };
    container.innerHTML = `
      ${ui.pageHead({
        title: 'المحاسبة والميزانية',
        subtitle: 'قيود اليومية، ميزان المراجعة، القوائم المالية والمصروفات',
        actions: `${App.can('accounting.manage') ? `<button class="btn" data-manual>${App.icon('plus')} قيد يدوي</button>` : ''}
          <button class="btn" data-print>${App.icon('printer')} طباعة</button>`
      })}
      <div class="card">
        <div id="acc-tabs">${ui.tabs(ACC_TABS, state.tab)}</div>
        <div id="acc-body"></div>
      </div>`;
    const bodyEl = container.querySelector('#acc-body');
    ui.bindTabs(container.querySelector('#acc-tabs'), (tab) => { state.tab = tab; state.page = 1; load(); });
    const manualBtn = container.querySelector('[data-manual]');
    if (manualBtn) manualBtn.onclick = async () => { const accounts = await fetchAccounts(); openManualJournal(accounts, load); };
    container.querySelector('[data-print]').onclick = () => current.print && current.print();
    function setActions(printFn) { current = { print: printFn }; }

    let accountsCache = null;
    async function fetchAccounts(force) {
      if (accountsCache && !force) return accountsCache;
      const r = await App.api('/accounts');
      accountsCache = r.items || [];
      return accountsCache;
    }

    async function loadJournal() {
      const qs = new URLSearchParams({ page: state.page, perPage: 25, from: state.from, to: state.to });
      if (state.search) qs.set('search', state.search);
      const r = await App.api('/journal?' + qs.toString());
      bodyEl.innerHTML = `
        <div class="toolbar">
          <div class="search-box" style="flex:1;max-width:340px">${App.icon('search')}
            <input class="input" data-search placeholder="رقم القيد أو البيان..." value="${App.esc(state.search)}">
          </div>
          <input class="input sm" type="date" data-from value="${state.from}" style="width:145px">
          <input class="input sm" type="date" data-to value="${state.to}" style="width:145px">
          <button class="btn icon" data-reload>${App.icon('refresh')}</button>
        </div>
        <div class="card-body">
          ${ui.table({
            columns: [
              { label: 'القيد', render: (e) => `<div class="cell-title ltr">${App.esc(e.entry_no)}</div><div class="cell-sub">${fmt.datetime(e.date)}</div>` },
              { label: 'البيان', render: (e) => `<div>${App.esc(e.description)}</div><div class="cell-sub">${App.esc(e.ref_type || 'يدوي')}${e.user_name ? ' · ' + App.esc(e.user_name) : ''}</div>` },
              { label: 'مدين', tdClass: 'num', render: (e) => `<b>${money(e.debit)}</b>` },
              { label: 'دائن', tdClass: 'num', render: (e) => `<b>${money(e.credit)}</b>` },
              { label: 'سطور', tdClass: 'num', render: (e) => fmt.number(e.lines_count, 0) },
              { label: '', tdClass: 'actions', render: (e) => `<button class="btn icon sm" data-view="${e.id}">${App.icon('eye', 14)}</button>
                ${App.can('accounting.manage') && (!e.ref_type || e.ref_type === 'manual') ? `<button class="btn icon sm" data-del="${e.id}" style="color:var(--danger)">${App.icon('trash', 14)}</button>` : ''}` }
            ],
            rows: r.items,
            empty: ui.empty({ icon: 'book', title: 'لا توجد قيود في الفترة' })
          }) + ui.pager(r)}
        </div>`;
      ui.bindPager(bodyEl, (p) => { state.page = p; load(); });
      bodyEl.querySelector('[data-search]').oninput = (e) => {
        clearTimeout(state._t);
        state._t = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; load(); }, 280);
      };
      const f = bodyEl.querySelector('[data-from]'); const t = bodyEl.querySelector('[data-to]');
      f.onchange = () => { state.from = f.value; state.page = 1; load(); };
      t.onchange = () => { state.to = t.value; state.page = 1; load(); };
      bodyEl.querySelector('[data-reload]').onclick = load;
      bodyEl.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => openJournalDetail(Number(b.dataset.view)));
      bodyEl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
        const yes = await ui.confirm({ title: 'حذف قيد', message: 'سيتم حذف القيد اليدوي نهائياً. هل تريد المتابعة؟', confirmText: 'حذف', danger: true });
        if (!yes) return;
        try { await App.api('/journal/' + b.dataset.del, { method: 'DELETE' }); ui.toast('تم حذف القيد'); load(); } catch (err) { ui.toast(err.message, 'error'); }
      });
      setActions(() => App.printA4('دفتر اليومية', `<h1>دفتر اليومية</h1><div class="small">${state.from} → ${state.to}</div>
        <table><thead><tr><th>القيد</th><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th></tr></thead>
        <tbody>${r.items.map((e) => `<tr><td>${App.esc(e.entry_no)}</td><td>${fmt.date(e.date)}</td><td>${App.esc(e.description)}</td><td class="num">${money(e.debit)}</td><td class="num">${money(e.credit)}</td></tr>`).join('')}</tbody></table>`));
    }

    async function openJournalDetail(id) {
      let e;
      try { e = await App.api('/journal/' + id); } catch (err) { return ui.toast(err.message, 'error'); }
      ui.modal({
        title: 'قيد ' + e.entry_no,
        subtitle: `${fmt.datetime(e.date)} · ${App.esc(e.description)}`,
        size: 'md',
        body: ui.table({
          columns: [
            { label: 'الحساب', render: (l) => `<div class="cell-title">${App.esc(l.account_name)}</div><div class="cell-sub ltr">${App.esc(l.code)}</div>` },
            { label: 'البيان', render: (l) => `<span class="small muted">${App.esc(l.description || '—')}</span>` },
            { label: 'مدين', tdClass: 'num', render: (l) => l.debit ? `<b>${money(l.debit)}</b>` : '—' },
            { label: 'دائن', tdClass: 'num', render: (l) => l.credit ? `<b>${money(l.credit)}</b>` : '—' }
          ],
          rows: e.lines
        }) + `<div class="info-row mt-3"><span class="k">إجمالي المدين</span><span class="v">${money(sum(e.lines, 'debit'))}</span></div>
          <div class="info-row"><span class="k">إجمالي الدائن</span><span class="v">${money(sum(e.lines, 'credit'))}</span></div>`,
        footer: `<button class="btn primary" data-close>إغلاق</button>`
      });
    }

    async function loadTrial() {
      const r = await App.api(`/accounting/trial-balance?from=${state.from}&to=${state.to}`);
      const rows = r.rows.filter((a) => Number(a.debit) || Number(a.credit));
      bodyEl.innerHTML = `
        ${rangeToolbar(state)}
        <div class="card-body">
          <div class="flex items-center justify-between mb-3">
            <div class="small muted">الفترة ${r.from} → ${r.to}</div>
            <span class="badge ${Math.abs(r.totals.debit - r.totals.credit) < 0.01 ? 'success' : 'danger'}">
              ${Math.abs(r.totals.debit - r.totals.credit) < 0.01 ? 'متوازن ✓' : 'غير متوازن'}
            </span>
          </div>
          ${ui.table({
            columns: [
              { label: 'الكود', render: (a) => `<span class="ltr">${App.esc(a.code)}</span>` },
              { label: 'الحساب', render: (a) => `<span class="bold">${App.esc(a.name)}</span>` },
              { label: 'النوع', render: (a) => `<span class="badge">${ACCOUNT_TYPES[a.type] || a.type}</span>` },
              { label: 'مدين', tdClass: 'num', render: (a) => money(a.debit) },
              { label: 'دائن', tdClass: 'num', render: (a) => money(a.credit) },
              { label: 'الرصيد', tdClass: 'num', render: (a) => `<b>${money(a.debit - a.credit)}</b>` }
            ],
            rows,
            empty: ui.empty({ icon: 'scale', title: 'لا توجد حركات' })
          })}
          <div class="info-row mt-2"><span class="k bold">إجمالي المدين</span><span class="v bold">${money(r.totals.debit)}</span></div>
          <div class="info-row"><span class="k bold">إجمالي الدائن</span><span class="v bold">${money(r.totals.credit)}</span></div>
        </div>`;
      bindRange(bodyEl, state, load);
      setActions(() => App.printA4('ميزان المراجعة', `<h1>ميزان المراجعة</h1><div class="small">${r.from} → ${r.to}</div>
        <table><thead><tr><th>الكود</th><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead>
        <tbody>${rows.map((a) => `<tr><td>${a.code}</td><td>${App.esc(a.name)}</td><td class="num">${money(a.debit)}</td><td class="num">${money(a.credit)}</td></tr>`).join('')}</tbody></table>
        <div class="totals"><div class="row grand"><span>الإجمالي</span><b>${money(r.totals.debit)}</b></div></div>`));
    }

    async function loadPnl() {
      const r = await App.api(`/accounting/pnl?from=${state.from}&to=${state.to}`);
      bodyEl.innerHTML = `
        ${rangeToolbar(state)}
        <div class="card-body">
          <div class="stat-grid">
            ${ui.stat({ label: 'إجمالي الإيرادات', valueHtml: `${fmt.number(r.revenue_total)} <span class="cur">${App.currency()}</span>`, icon: 'trendingUp', tone: 'var(--success)', tint: 'var(--success-soft)' })}
            ${ui.stat({ label: 'إجمالي المصروفات', valueHtml: `${fmt.number(r.expense_total)} <span class="cur">${App.currency()}</span>`, icon: 'trendingDown', tone: 'var(--danger)', tint: 'var(--danger-soft)' })}
            ${ui.stat({ label: 'صافي الربح', valueHtml: `${fmt.number(r.net_profit)} <span class="cur">${App.currency()}</span>`, icon: 'wallet', tone: 'var(--primary)', tint: 'var(--primary-soft)', foot: `هامش ${fmt.number(r.margin)}%` })}
          </div>
          <div class="equal-grid">
            ${ui.section({
              title: 'الإيرادات', flush: true,
              body: ui.table({ className: 'compact', columns: [
                { label: 'الحساب', render: (a) => App.esc(a.name) },
                { label: 'القيمة', tdClass: 'num', render: (a) => money(a.net) }
              ], rows: r.revenue, empty: ui.empty({ icon: 'trendingUp', title: 'لا توجد إيرادات' }) })
            })}
            ${ui.section({
              title: 'المصروفات', flush: true,
              body: ui.table({ className: 'compact', columns: [
                { label: 'الحساب', render: (a) => App.esc(a.name) },
                { label: 'القيمة', tdClass: 'num', render: (a) => money(a.net) }
              ], rows: r.expenses, empty: ui.empty({ icon: 'trendingDown', title: 'لا توجد مصروفات' }) })
            })}
          </div>
          <div class="card card-pad mt-4" style="background:var(--primary-soft)">
            <div class="flex items-center justify-between"><span class="bold">صافي الربح / الخسارة</span>
            <span class="bold ${r.net_profit >= 0 ? 'text-success' : 'text-danger'}" style="font-size:22px">${money(r.net_profit)}</span></div>
          </div>
        </div>`;
      bindRange(bodyEl, state, load);
      setActions(() => App.printA4('قائمة الأرباح والخسائر', `<h1>قائمة الأرباح والخسائر</h1><div class="small">${r.from} → ${r.to}</div>
        <table><thead><tr><th>البند</th><th>القيمة</th></tr></thead><tbody>
        <tr><td colspan="2"><b>الإيرادات</b></td></tr>${r.revenue.map((a) => `<tr><td>${App.esc(a.name)}</td><td class="num">${money(a.net)}</td></tr>`).join('')}
        <tr><td><b>إجمالي الإيرادات</b></td><td class="num"><b>${money(r.revenue_total)}</b></td></tr>
        <tr><td colspan="2"><b>المصروفات</b></td></tr>${r.expenses.map((a) => `<tr><td>${App.esc(a.name)}</td><td class="num">${money(a.net)}</td></tr>`).join('')}
        <tr><td><b>إجمالي المصروفات</b></td><td class="num"><b>${money(r.expense_total)}</b></td></tr>
        </tbody></table><div class="totals"><div class="row grand"><span>صافي الربح</span><b>${money(r.net_profit)}</b></div></div>`));
    }

    async function loadBalance() {
      const r = await App.api('/accounting/balance-sheet?asOf=' + state.to);
      const section = (title, rows, total, tone) => ui.section({
        title, flush: true,
        body: ui.table({ className: 'compact', columns: [
          { label: 'الحساب', render: (a) => `<div class="cell-title">${App.esc(a.name)}</div><div class="cell-sub ltr">${App.esc(a.code)}</div>` },
          { label: 'الرصيد', tdClass: 'num', render: (a) => `<b style="color:${tone}">${money(a.balance)}</b>` }
        ], rows: rows.length ? rows : [{ name: 'لا توجد أرصدة', code: '', balance: 0 }] }) +
          `<div class="info-row" style="padding:10px 14px"><span class="k bold">${title}</span><span class="v bold">${money(total)}</span></div>`
      });
      bodyEl.innerHTML = `
        <div class="toolbar">
          <label class="small muted">كما في تاريخ</label>
          <input class="input sm" type="date" data-date value="${state.to}" style="width:150px">
          <span class="flex-1"></span>
          <span class="badge ${r.balanced ? 'success' : 'danger'}">${r.balanced ? 'الميزانية متوازنة ✓' : 'الميزانية غير متوازنة'}</span>
        </div>
        <div class="card-body">
          <div class="stat-grid">
            ${ui.stat({ label: 'إجمالي الأصول', valueHtml: `${fmt.number(r.assets_total)} <span class="cur">${App.currency()}</span>`, icon: 'wallet', tone: 'var(--primary)', tint: 'var(--primary-soft)' })}
            ${ui.stat({ label: 'إجمالي الالتزامات', valueHtml: `${fmt.number(r.liabilities_total)} <span class="cur">${App.currency()}</span>`, icon: 'scale', tone: 'var(--warning)', tint: 'var(--warning-soft)' })}
            ${ui.stat({ label: 'حقوق الملكية', valueHtml: `${fmt.number(r.equity_total)} <span class="cur">${App.currency()}</span>`, icon: 'shield', tone: 'var(--success)', tint: 'var(--success-soft)', foot: `يشمل أرباح ${fmt.money(r.net_profit)}` })}
          </div>
          <div class="three-col">
            <div>${section('الأصول', r.assets, r.assets_total, 'var(--primary)')}</div>
            <div>${section('الالتزامات', r.liabilities, r.liabilities_total, 'var(--warning)')}</div>
            <div>${section('حقوق الملكية', r.equity.concat([{ code: '3900', name: 'أرباح الفترة', balance: r.net_profit }]), r.equity_total, 'var(--success)')}</div>
          </div>
        </div>`;
      const dateEl = bodyEl.querySelector('[data-date]');
      dateEl.onchange = () => { state.to = dateEl.value; load(); };
      setActions(() => App.printA4('الميزانية العمومية', `<h1>الميزانية العمومية</h1><div class="small">كما في ${r.as_of}</div>
        <h2>الأصول</h2><table><tbody>${r.assets.map((a) => `<tr><td>${App.esc(a.name)}</td><td class="num">${money(a.balance)}</td></tr>`).join('')}
        <tr><td><b>الإجمالي</b></td><td class="num"><b>${money(r.assets_total)}</b></td></tr></tbody></table>
        <h2>الالتزامات وحقوق الملكية</h2><table><tbody>${r.liabilities.concat(r.equity).map((a) => `<tr><td>${App.esc(a.name)}</td><td class="num">${money(a.balance)}</td></tr>`).join('')}
        <tr><td>أرباح الفترة</td><td class="num">${money(r.net_profit)}</td></tr>
        <tr><td><b>الإجمالي</b></td><td class="num"><b>${money(r.liabilities_total + r.equity_total)}</b></td></tr></tbody></table>`));
    }

    async function loadLedger() {
      const accounts = await fetchAccounts(true);
      const leaves = accounts.filter((a) => !/00$/.test(a.code));
      const selected = state.account || (leaves.find((a) => a.code === '1010') || leaves[0] || accounts[0] || {}).id;
      state.account = selected;
      if (!selected) {
        bodyEl.innerHTML = `<div class="card-pad">${ui.empty({ icon: 'list', title: 'لا توجد حسابات' })}</div>`;
        return;
      }
      const r = await App.api(`/accounting/ledger?account_id=${selected}&from=${state.from}&to=${state.to}`);
      let running = Number(r.opening);
      const rows = r.lines.map((l) => {
        running = Math.round((running + Number(l.debit) - Number(l.credit)) * 100) / 100;
        return { ...l, balance: running };
      });
      bodyEl.innerHTML = `
        <div class="toolbar">
          <select class="select" data-account style="width:260px">${accounts.map((a) => `<option value="${a.id}" ${Number(a.id) === Number(selected) ? 'selected' : ''}>${App.esc(a.code)} · ${App.esc(a.name)}</option>`).join('')}</select>
          <input class="input sm" type="date" data-from value="${state.from}" style="width:145px">
          <input class="input sm" type="date" data-to value="${state.to}" style="width:145px">
          <span class="flex-1"></span>
          <span class="small muted">الرصيد الافتتاحي: <b>${money(r.opening)}</b></span>
        </div>
        <div class="card-body">
          ${ui.table({
            columns: [
              { label: 'القيد', render: (l) => `<span class="ltr small">${App.esc(l.entry_no)}</span>` },
              { label: 'التاريخ', render: (l) => fmt.datetime(l.date) },
              { label: 'البيان', render: (l) => `<div>${App.esc(l.entry_description || '')}</div><div class="cell-sub">${App.esc(l.description || '')}</div>` },
              { label: 'مدين', tdClass: 'num', render: (l) => l.debit ? money(l.debit) : '—' },
              { label: 'دائن', tdClass: 'num', render: (l) => l.credit ? money(l.credit) : '—' },
              { label: 'الرصيد', tdClass: 'num', render: (l) => `<b>${money(l.balance)}</b>` }
            ],
            rows,
            empty: ui.empty({ icon: 'layers', title: 'لا توجد حركات على هذا الحساب' })
          })}
        </div>`;
      bodyEl.querySelector('[data-account]').onchange = (e) => { state.account = Number(e.target.value); load(); };
      const f = bodyEl.querySelector('[data-from]'); const t = bodyEl.querySelector('[data-to]');
      f.onchange = () => { state.from = f.value; load(); };
      t.onchange = () => { state.to = t.value; load(); };
      setActions(() => App.printA4('دفتر الأستاذ – ' + r.account.name, `<h1>دفتر الأستاذ: ${App.esc(r.account.name)}</h1>
        <div class="small">${r.from} → ${r.to} · الرصيد الافتتاحي ${money(r.opening)}</div>
        <table><thead><tr><th>القيد</th><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
        <tbody>${rows.map((l) => `<tr><td>${App.esc(l.entry_no)}</td><td>${fmt.date(l.date)}</td><td>${App.esc(l.entry_description)}</td><td class="num">${l.debit ? money(l.debit) : ''}</td><td class="num">${l.credit ? money(l.credit) : ''}</td><td class="num">${money(l.balance)}</td></tr>`).join('')}</tbody></table>`));
    }

    async function loadExpenses() {
      const qs = new URLSearchParams({ page: state.page, perPage: 25, from: state.from, to: state.to });
      const r = await App.api('/expenses?' + qs.toString());
      bodyEl.innerHTML = `
        <div class="toolbar">
          <input class="input sm" type="date" data-from value="${state.from}" style="width:145px">
          <input class="input sm" type="date" data-to value="${state.to}" style="width:145px">
          <span class="flex-1"></span>
          <span class="small muted">إجمالي الفترة: <b>${money(r.total_amount)}</b></span>
          ${App.can('accounting.manage') ? `<button class="btn primary sm" data-add>${App.icon('plus', 14)} مصروف جديد</button>` : ''}
        </div>
        <div class="card-body">
          ${ui.table({
            columns: [
              { label: 'التاريخ', render: (e) => fmt.date(e.date) },
              { label: 'حساب المصروف', render: (e) => `<div class="cell-title">${App.esc(e.account_name)}</div><div class="cell-sub ltr">${App.esc(e.code || '')}</div>` },
              { label: 'البيان', render: (e) => App.esc(e.description || '—') },
              { label: 'طريقة الدفع', render: (e) => App.esc(fmt.statusText(e.payment_method)) },
              { label: 'المبلغ', tdClass: 'num', render: (e) => `<b class="text-danger">${money(e.amount)}</b>` },
              { label: 'المستخدم', render: (e) => `<span class="small muted">${App.esc(e.user_name || '')}</span>` },
              { label: '', tdClass: 'actions', render: (e) => App.can('accounting.manage') ? `<button class="btn icon sm" data-del="${e.id}" style="color:var(--danger)">${App.icon('trash', 14)}</button>` : '' }
            ],
            rows: r.items,
            empty: ui.empty({ icon: 'banknote', title: 'لا توجد مصروفات في الفترة' })
          }) + ui.pager(r)}
        </div>`;
      ui.bindPager(bodyEl, (p) => { state.page = p; load(); });
      const f = bodyEl.querySelector('[data-from]'); const t = bodyEl.querySelector('[data-to]');
      f.onchange = () => { state.from = f.value; state.page = 1; load(); };
      t.onchange = () => { state.to = t.value; state.page = 1; load(); };
      const add = bodyEl.querySelector('[data-add]');
      if (add) add.onclick = async () => openExpenseModal(await fetchAccounts(true), load);
      bodyEl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
        const yes = await ui.confirm({ title: 'حذف مصروف', message: 'سيتم حذف المصروف وعكس قيده المحاسبي.', confirmText: 'حذف', danger: true });
        if (!yes) return;
        try { await App.api('/expenses/' + b.dataset.del, { method: 'DELETE' }); ui.toast('تم حذف المصروف'); load(); } catch (err) { ui.toast(err.message, 'error'); }
      });
      setActions(() => App.printA4('تقرير المصروفات', `<h1>تقرير المصروفات</h1><div class="small">${state.from} → ${state.to}</div>
        <table><thead><tr><th>التاريخ</th><th>الحساب</th><th>البيان</th><th>المبلغ</th></tr></thead>
        <tbody>${r.items.map((e) => `<tr><td>${e.date}</td><td>${App.esc(e.account_name)}</td><td>${App.esc(e.description || '')}</td><td class="num">${money(e.amount)}</td></tr>`).join('')}</tbody></table>
        <div class="totals"><div class="row grand"><span>الإجمالي</span><b>${money(r.total_amount)}</b></div></div>`));
    }

    async function loadAccounts() {
      const accounts = await fetchAccounts(true);
      const types = ['asset', 'liability', 'equity', 'revenue', 'expense'];
      bodyEl.innerHTML = `<div class="card-body">
        ${App.can('accounting.manage') ? `<div class="flex justify-end mb-3"><button class="btn primary sm" data-add>${App.icon('plus', 14)} حساب جديد</button></div>` : ''}
        <div class="two-col" style="align-items:start">
          <div>${ui.table({
            columns: [
              { label: 'الكود', render: (a) => `<span class="ltr">${App.esc(a.code)}</span>` },
              { label: 'الحساب', render: (a) => `<div class="cell-title">${App.esc(a.name)}</div>${a.is_system ? '<div class="cell-sub">حساب نظامي</div>' : ''}` },
              { label: 'النوع', render: (a) => `<span class="badge">${ACCOUNT_TYPES[a.type] || a.type}</span>` },
              { label: 'الرصيد', tdClass: 'num', render: (a) => `<b>${money(a.balance)}</b>` }
            ],
            rows: accounts.sort((a, b) => String(a.code).localeCompare(String(b.code))),
            empty: ui.empty({ icon: 'list', title: 'لا توجد حسابات' })
          })}</div>
          <div>${ui.section({ title: 'ملخص حسب النوع', body: types.map((t) => {
            const rows = accounts.filter((a) => a.type === t);
            return `<div class="info-row"><span class="k">${ACCOUNT_TYPES[t]}</span><span class="v">${money(rows.reduce((s, a) => s + Number(a.balance), 0))}</span></div>`;
          }).join('') })}</div>
        </div>
      </div>`;
      const add = bodyEl.querySelector('[data-add]');
      if (add) add.onclick = () => openAccountModal(accounts, load);
      setActions(() => App.printA4('دليل الحسابات', `<h1>دليل الحسابات</h1>
        <table><thead><tr><th>الكود</th><th>الحساب</th><th>النوع</th><th>الرصيد</th></tr></thead>
        <tbody>${accounts.map((a) => `<tr><td>${a.code}</td><td>${App.esc(a.name)}</td><td>${ACCOUNT_TYPES[a.type] || a.type}</td><td class="num">${money(a.balance)}</td></tr>`).join('')}</tbody></table>`));
    }

    async function load() {
      bodyEl.innerHTML = `<div class="loading-block"><span class="spinner"></span> جارٍ التحميل...</div>`;
      const printBtn = container.querySelector('[data-print]');
      printBtn.style.display = state.tab === 'accounts' ? '' : (state.tab === 'journal' || state.tab ? '' : 'none');
      try {
        if (state.tab === 'trial') await loadTrial();
        else if (state.tab === 'pnl') await loadPnl();
        else if (state.tab === 'balance') await loadBalance();
        else if (state.tab === 'ledger') await loadLedger();
        else if (state.tab === 'expenses') await loadExpenses();
        else if (state.tab === 'accounts') await loadAccounts();
        else await loadJournal();
      } catch (err) {
        bodyEl.innerHTML = `<div class="card-pad">${ui.empty({ icon: 'alert', title: 'تعذر تحميل البيانات', text: App.esc(err.message) })}</div>`;
      }
    }

    load();

    function openExpenseModal(accounts, onDone) {
      const expAccounts = accounts.filter((a) => a.type === 'expense' && !/00$/.test(a.code));
      const m = ui.modal({
        title: 'تسجيل مصروف', size: 'sm',
        body: `<div class="form-grid">
          ${ui.field({ label: 'حساب المصروف', name: 'account_id', type: 'select', required: true, options: expAccounts.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` })) })}
          ${ui.field({ label: 'المبلغ', name: 'amount', type: 'number', min: 0.01, step: '0.01', required: true })}
          ${ui.field({ label: 'التاريخ', name: 'date', type: 'date', value: fmt.today() })}
          ${ui.field({ label: 'طريقة الدفع', name: 'payment_method', type: 'select', value: 'cash', options: [
            { value: 'cash', label: 'نقدي' }, { value: 'card', label: 'بطاقة / بنك' }, { value: 'credit', label: 'آجل' }
          ] })}
          ${ui.field({ label: 'البيان', name: 'description', type: 'textarea', col: 'span-2', rows: 2, placeholder: 'إيجار / كهرباء / مرتبات...' })}
        </div>`,
        footer: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${App.icon('save')} حفظ المصروف</button>`,
        onMount: (h) => {
          h.el.querySelector('[data-save]').onclick = async () => {
            const v = App.formValues(h.el.querySelector('.modal-body'));
            if (!v.amount || Number(v.amount) <= 0) return ui.toast('أدخل مبلغاً صحيحاً', 'warning');
            try {
              await App.api('/expenses', { method: 'POST', body: { ...v, account_id: Number(v.account_id), amount: Number(v.amount) } });
              ui.toast('تم تسجيل المصروف وقيده المحاسبي');
              m.close(); onDone();
            } catch (err) { ui.toast(err.message, 'error'); }
          };
        }
      });
    }

    function openAccountModal(accounts, onDone) {
      const m = ui.modal({
        title: 'إضافة حساب محاسبي', size: 'sm',
        body: `<div class="form-grid">
          ${ui.field({ label: 'كود الحساب', name: 'code', required: true, placeholder: 'مثال: 5060' })}
          ${ui.field({ label: 'اسم الحساب', name: 'name', required: true })}
          ${ui.field({ label: 'النوع', name: 'type', type: 'select', options: Object.keys(ACCOUNT_TYPES).map((t) => ({ value: t, label: ACCOUNT_TYPES[t] })) })}
        </div>`,
        footer: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${App.icon('save')} حفظ</button>`,
        onMount: (h) => {
          h.el.querySelector('[data-save]').onclick = async () => {
            const v = App.formValues(h.el.querySelector('.modal-body'));
            try {
              await App.api('/accounts', { method: 'POST', body: v });
              ui.toast('تم إضافة الحساب');
              m.close(); onDone();
            } catch (err) { ui.toast(err.message, 'error'); }
          };
        }
      });
    }

    function openManualJournal(accounts, onDone) {
      const leaves = accounts.filter((a) => !/00$/.test(a.code));
      const rows = [{ account_id: leaves[0] ? leaves[0].id : (accounts[0] || {}).id || '', debit: 0, credit: 0, description: '' }, { account_id: leaves[1] ? leaves[1].id : (accounts[1] || {}).id || '', debit: 0, credit: 0, description: '' }];
      const m = ui.modal({
        title: 'قيد يومية يدوي', subtitle: 'يجب أن يتساوى إجمالي المدين والدائن', size: 'lg',
        body: `<div class="form-grid mb-4">
          ${ui.field({ label: 'التاريخ', name: 'date', type: 'date', value: fmt.today() })}
          ${ui.field({ label: 'وصف القيد', name: 'description', value: 'قيد يومية يدوي', col: 'span-2' })}
        </div>
        <div id="jl-lines"></div>
        <div class="flex items-center gap-3 mt-3">
          <button class="btn sm" data-add-line>${App.icon('plus', 14)} إضافة سطر</button>
          <span class="flex-1"></span>
          <span class="small">مدين: <b data-td>0.00</b></span>
          <span class="small">دائن: <b data-tc>0.00</b></span>
        </div>`,
        footer: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${App.icon('save')} حفظ القيد</button>`,
        onMount: (h) => {
          const linesEl = h.body.querySelector('#jl-lines');
          const tdEl = h.body.querySelector('[data-td]');
          const tcEl = h.body.querySelector('[data-tc]');
          const paint = () => {
            linesEl.innerHTML = `<div class="table-wrap"><table class="table compact"><thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th><th>البيان</th><th></th></tr></thead><tbody>
              ${rows.map((r, i) => `<tr>
                <td><select class="select sm" data-i="${i}" data-f="account_id">${accounts.map((a) => `<option value="${a.id}" ${Number(a.id) === Number(r.account_id) ? 'selected' : ''}>${App.esc(a.code)} · ${App.esc(a.name)}</option>`).join('')}</select></td>
                <td><input class="input sm num" data-i="${i}" data-f="debit" type="number" min="0" step="0.01" value="${r.debit || 0}" style="width:100px"></td>
                <td><input class="input sm num" data-i="${i}" data-f="credit" type="number" min="0" step="0.01" value="${r.credit || 0}" style="width:100px"></td>
                <td><input class="input sm" data-i="${i}" data-f="description" value="${App.esc(r.description || '')}" placeholder="بيان السطر"></td>
                <td><button class="btn icon sm" data-rm="${i}" style="color:var(--danger)">${App.icon('trash', 14)}</button></td>
              </tr>`).join('')}</tbody></table></div>`;
            linesEl.querySelectorAll('[data-f]').forEach((inp) => {
              inp.onchange = () => {
                const r = rows[Number(inp.dataset.i)];
                r[inp.dataset.f] = inp.dataset.f === 'account_id' ? Number(inp.value) : inp.dataset.f === 'description' ? inp.value.trim() : Number(inp.value) || 0;
                paint();
              };
            });
            linesEl.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { rows.splice(Number(b.dataset.rm), 1); paint(); });
            tdEl.textContent = money(sum(rows, 'debit'));
            tcEl.textContent = money(sum(rows, 'credit'));
          };
          h.body.querySelector('[data-add-line]').onclick = () => { rows.push({ account_id: accounts[0] ? accounts[0].id : '', debit: 0, credit: 0, description: '' }); paint(); };
          h.el.querySelector('[data-save]').onclick = async () => {
            const v = App.formValues(h.body);
            const lines = rows.filter((r) => Number(r.debit) || Number(r.credit));
            if (lines.length < 2) return ui.toast('القيد يحتاج سطرين على الأقل', 'warning');
            const d = sum(lines, 'debit'), c = sum(lines, 'credit');
            if (Math.abs(d - c) > 0.009) return ui.toast('القيد غير متوازن', 'error');
            try {
              await App.api('/journal', { method: 'POST', body: { date: v.date, description: v.description, lines } });
              ui.toast('تم حفظ القيد');
              m.close(); onDone();
            } catch (err) { ui.toast(err.message, 'error'); }
          };
          paint();
        }
      });
    }
  }

  /* ================================================================== */
  /*                            SHIFTS                                  */
  /* ================================================================== */
  async function renderShifts(container) {
    const state = { from: fmt.addDays(fmt.today(), -29), to: fmt.today(), status: '', page: 1 };
    container.innerHTML = `
      ${ui.pageHead({
        title: 'الورديات والصندوق',
        subtitle: 'فتح وإغلاق الورديات، الحركة النقدية وتسوية الدرج',
        actions: `<button class="btn primary" data-open>${App.icon('plus')} فتح وردية</button>`
      })}
      <div id="shift-current"><div class="loading-block"><span class="spinner"></span> جارٍ التحميل...</div></div>
      <div class="card mt-4">
        <div class="toolbar">
          <input class="input sm" type="date" data-from value="${state.from}" style="width:145px">
          <input class="input sm" type="date" data-to value="${state.to}" style="width:145px">
          <select class="select" data-status style="width:150px">
            <option value="">كل الحالات</option>
            <option value="open">مفتوحة</option>
            <option value="closed">مغلقة</option>
          </select>
          <span class="flex-1"></span>
          <button class="btn icon" data-reload>${App.icon('refresh')}</button>
        </div>
        <div id="sh-table"><div class="loading-block"><span class="spinner"></span> جارٍ التحميل...</div></div>
      </div>`;
    const currentEl = container.querySelector('#shift-current');
    const tableEl = container.querySelector('#sh-table');

    async function loadCurrent() {
      try {
        const r = await App.api('/shifts/current');
        if (!r.shift) {
          currentEl.innerHTML = `<div class="card card-pad" style="border:1px dashed var(--border)">
            <div class="flex items-center gap-4 flex-wrap">
              <div class="stat-icon" style="background:var(--warning-soft);color:var(--warning);width:48px;height:48px">${App.icon('clock', 24)}</div>
              <div class="flex-1"><div class="bold">لا توجد وردية مفتوحة</div><div class="small muted">افتح وردية جديدة لتسجيل المبيعات والحركة النقدية.</div></div>
              <button class="btn primary" data-open-current>${App.icon('plus')} فتح وردية</button>
            </div></div>`;
          currentEl.querySelector('[data-open-current]').onclick = () => App.openShiftDialog(loadAll);
          return;
        }
        const s = r.shift; const t = r.report.totals;
        currentEl.innerHTML = `<div class="card">
          <div class="card-title"><div><h3>الوردية الحالية #${s.id}</h3><p>مفتوحة منذ ${fmt.datetime(s.opened_at)} · ${App.esc(r.report.shift.user_name)}</p></div>
            <div class="actions"><span class="badge success">${App.icon('clock', 12)} مفتوحة</span></div></div>
          <div class="card-body">
            <div class="stat-grid five">
              ${ui.stat({ label: 'نقدية افتتاحية', valueHtml: fmt.money(s.opening_cash), icon: 'wallet', tone: 'var(--accent)', tint: 'var(--accent-soft)' })}
              ${ui.stat({ label: 'مبيعات الوردية', valueHtml: fmt.money(t.total), icon: 'banknote', tone: 'var(--primary)', tint: 'var(--primary-soft)', foot: `${fmt.number(t.invoices, 0)} فاتورة` })}
              ${ui.stat({ label: 'مبيعات نقدية', valueHtml: fmt.money(t.cash_sales), icon: 'banknote', tone: 'var(--success)', tint: 'var(--success-soft)' })}
              ${ui.stat({ label: 'المرتجعات', valueHtml: fmt.money(t.returns), icon: 'rotate', tone: 'var(--warning)', tint: 'var(--warning-soft)' })}
              ${ui.stat({ label: 'النقدية المتوقعة', valueHtml: fmt.money(r.report.expected_cash), icon: 'scale', tone: 'var(--purple)', tint: 'var(--purple-soft)' })}
            </div>
            <div class="flex gap-2 flex-wrap">
              <button class="btn" data-view="${s.id}">${App.icon('eye')} تقرير الوردية</button>
              <button class="btn" data-cash>${App.icon('banknote')} حركة نقدية</button>
              <button class="btn danger" data-close-shift>${App.icon('lock')} إغلاق الوردية</button>
            </div>
          </div>
        </div>`;
        currentEl.querySelector('[data-view]').onclick = () => openShiftReport(s.id);
        currentEl.querySelector('[data-cash]').onclick = () => openCashMovement(s.id, loadAll);
        currentEl.querySelector('[data-close-shift]').onclick = () => openCloseShift(s.id, loadAll);
      } catch (err) {
        currentEl.innerHTML = `<div class="card card-pad">${ui.empty({ icon: 'alert', title: 'تعذر تحميل الوردية', text: App.esc(err.message) })}</div>`;
      }
    }

    async function loadList() {
      const qs = new URLSearchParams({ page: state.page, perPage: 20, from: state.from, to: state.to });
      if (state.status) qs.set('status', state.status);
      try {
        const r = await App.api('/shifts?' + qs.toString());
        tableEl.innerHTML = ui.table({
          columns: [
            { label: 'الوردية', render: (s) => `<div class="cell-title">#${s.id} · ${App.esc(s.user_name)}</div><div class="cell-sub">${fmt.datetime(s.opened_at)}</div>` },
            { label: 'الإغلاق', render: (s) => s.closed_at ? `<span class="small">${fmt.datetime(s.closed_at)}</span>` : '<span class="badge success">مفتوحة</span>' },
            { label: 'فواتير', tdClass: 'num', render: (s) => fmt.number(s.invoices, 0) },
            { label: 'المبيعات', tdClass: 'num', render: (s) => `<b>${money(s.sales_total)}</b>` },
            { label: 'افتتاحي', tdClass: 'num', render: (s) => money(s.opening_cash) },
            { label: 'المتوقع', tdClass: 'num', render: (s) => s.expected_cash !== null ? money(s.expected_cash) : '—' },
            { label: 'الفرق', tdClass: 'num', render: (s) => s.closed_at ? `<span class="bold ${Number(s.difference) < 0 ? 'text-danger' : Number(s.difference) > 0 ? 'text-success' : ''}">${money(s.difference)}</span>` : '—' },
            { label: 'الحالة', render: (s) => App.badge(s.status) },
            { label: '', tdClass: 'actions', render: (s) => `<button class="btn icon sm" data-view="${s.id}">${App.icon('eye', 14)}</button>
              ${s.status === 'open' && App.can('shifts.use') ? `<button class="btn icon sm" data-close="${s.id}" style="color:var(--danger)">${App.icon('lock', 14)}</button>` : ''}` }
          ],
          rows: r.items,
          empty: ui.empty({ icon: 'clock', title: 'لا توجد ورديات', text: 'افتح وردية جديدة لبدء العمل.' })
        }) + ui.pager(r);
        ui.bindPager(tableEl, (p) => { state.page = p; loadList(); });
        tableEl.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => openShiftReport(Number(b.dataset.view)));
        tableEl.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => openCloseShift(Number(b.dataset.close), loadAll));
      } catch (err) {
        tableEl.innerHTML = `<div class="card-pad">${ui.empty({ icon: 'alert', title: 'تعذر تحميل الورديات', text: App.esc(err.message) })}</div>`;
      }
    }

    async function openShiftReport(id) {
      let r;
      try { r = await App.api('/shifts/' + id); } catch (err) { return ui.toast(err.message, 'error'); }
      const t = r.totals;
      const m = ui.modal({
        title: 'تقرير الوردية #' + r.shift.id,
        subtitle: `${App.esc(r.shift.user_name)} · ${fmt.datetime(r.shift.opened_at)}`,
        size: 'lg',
        body: `
          <div class="stat-grid">
            ${ui.stat({ label: 'المبيعات', valueHtml: fmt.money(t.total), icon: 'banknote', tone: 'var(--primary)', tint: 'var(--primary-soft)', foot: `${t.invoices} فاتورة` })}
            ${ui.stat({ label: 'نقدي / بطاقة', valueHtml: `${fmt.number(t.cash_sales)} / ${fmt.number(t.card_sales)}`, icon: 'wallet', tone: 'var(--accent)', tint: 'var(--accent-soft)' })}
            ${ui.stat({ label: 'المرتجعات', valueHtml: fmt.money(t.returns), icon: 'rotate', tone: 'var(--warning)', tint: 'var(--warning-soft)' })}
            ${ui.stat({ label: 'الربح الإجمالي', valueHtml: fmt.money(t.gross_profit), icon: 'trendingUp', tone: 'var(--success)', tint: 'var(--success-soft)' })}
          </div>
          <div class="info-row"><span class="k">نقدية افتتاحية</span><span class="v">${money(r.shift.opening_cash)}</span></div>
          <div class="info-row"><span class="k">حركة نقدية إضافية</span><span class="v">${money(t.cash_net)}</span></div>
          <div class="info-row"><span class="k">النقدية المتوقعة</span><span class="v bold">${money(r.expected_cash)}</span></div>
          ${r.shift.closed_at ? `<div class="info-row"><span class="k">النقدية الفعلية عند الإغلاق</span><span class="v">${money(r.shift.closing_cash)}</span></div>
            <div class="info-row"><span class="k">الفرق</span><span class="v bold ${Number(r.shift.difference) < 0 ? 'text-danger' : 'text-success'}">${money(r.shift.difference)}</span></div>` : ''}
          ${ui.section({ title: 'فواتير الوردية', flush: true, className: 'mt-4', body: ui.table({
            className: 'compact',
            columns: [
              { label: 'الفاتورة', render: (s) => `<span class="ltr">${App.esc(s.invoice_no)}</span>` },
              { label: 'العميل', render: (s) => App.esc(s.customer_name || 'عميل نقدي') },
              { label: 'الدفع', render: (s) => App.esc(fmt.statusText(s.payment_method)) },
              { label: 'الإجمالي', tdClass: 'num', render: (s) => money(s.total) },
              { label: 'الحالة', render: (s) => App.badge(s.status) }
            ],
            rows: r.sales
          }) })}
          ${r.movements.length ? ui.section({ title: 'الحركات النقدية', flush: true, className: 'mt-4', body: ui.table({
            className: 'compact',
            columns: [
              { label: 'النوع', render: (x) => `<span class="badge ${x.type === 'in' ? 'success' : 'warning'}">${x.type === 'in' ? 'إيداع' : 'سحب'}</span>` },
              { label: 'المبلغ', tdClass: 'num', render: (x) => money(x.amount) },
              { label: 'السبب', render: (x) => App.esc(x.reason || '—') }
            ],
            rows: r.movements
          }) }) : ''}`,
        footer: `<button class="btn" data-print>${App.icon('printer')} طباعة</button><button class="btn primary" data-close>إغلاق</button>`,
        onMount: (h) => {
          h.el.querySelector('[data-print]').onclick = () => App.printA4('تقرير الوردية #' + r.shift.id, `
            <h1>تقرير إغلاق الوردية #${r.shift.id}</h1>
            <div class="small">${App.esc(r.shift.user_name)} · ${fmt.datetime(r.shift.opened_at)}</div>
            <div class="totals"><div class="row"><span>نقدية افتتاحية</span><b>${money(r.shift.opening_cash)}</b></div>
            <div class="row"><span>مبيعات نقدية</span><b>${money(t.cash_sales)}</b></div>
            <div class="row"><span>مبيعات بطاقة/محفظة</span><b>${money(t.card_sales + t.wallet_sales)}</b></div>
            <div class="row"><span>المرتجعات</span><b>${money(t.returns)}</b></div>
            <div class="row"><span>حركة نقدية</span><b>${money(t.cash_net)}</b></div>
            <div class="row grand"><span>النقدية المتوقعة</span><b>${money(r.expected_cash)}</b></div>
            ${r.shift.closed_at ? `<div class="row"><span>النقدية الفعلية</span><b>${money(r.shift.closing_cash)}</b></div><div class="row"><span>الفرق</span><b>${money(r.shift.difference)}</b></div>` : ''}</div>
            <table><thead><tr><th>الفاتورة</th><th>العميل</th><th>الدفع</th><th>الإجمالي</th></tr></thead>
            <tbody>${r.sales.map((s) => `<tr><td>${s.invoice_no}</td><td>${App.esc(s.customer_name || '')}</td><td>${fmt.statusText(s.payment_method)}</td><td class="num">${money(s.total)}</td></tr>`).join('')}</tbody></table>`);
        }
      });
    }

    async function openCashMovement(id, onDone) {
      const m = ui.modal({
        title: 'حركة نقدية', size: 'sm',
        body: `<div class="form-grid">
          ${ui.field({ label: 'نوع الحركة', name: 'type', type: 'select', options: [{ value: 'in', label: 'إيداع في الدرج' }, { value: 'out', label: 'سحب من الدرج' }] })}
          ${ui.field({ label: 'المبلغ', name: 'amount', type: 'number', min: 0.01, step: '0.01', required: true })}
          ${ui.field({ label: 'السبب', name: 'reason', col: 'span-2', placeholder: 'فكة / إيداع / سحب نقدي...' })}
        </div>`,
        footer: `<button class="btn" data-close>إلغاء</button><button class="btn primary" data-save>${App.icon('save')} تسجيل</button>`,
        onMount: (h) => {
          h.el.querySelector('[data-save]').onclick = async () => {
            const v = App.formValues(h.el.querySelector('.modal-body'));
            try {
              await App.api(`/shifts/${id}/cash`, { method: 'POST', body: { ...v, amount: Number(v.amount) } });
              ui.toast('تم تسجيل الحركة النقدية');
              m.close(); onDone();
            } catch (err) { ui.toast(err.message, 'error'); }
          };
        }
      });
    }

    async function openCloseShift(id, onDone) {
      let r;
      try { r = await App.api('/shifts/' + id); } catch (err) { return ui.toast(err.message, 'error'); }
      if (r.shift.status === 'closed') return ui.toast('الوردية مغلقة بالفعل', 'warning');
      const m = ui.modal({
        title: 'إغلاق الوردية #' + id,
        subtitle: `${App.esc(r.shift.user_name)} · النقدية المتوقعة ${fmt.money(r.expected_cash)}`,
        size: 'sm',
        body: `<div class="shift-banner" style="background:var(--primary-soft);color:var(--primary)">${App.icon('info', 15)} أدخل النقدية الفعلية الموجودة في الدرج وسيتم احتساب الفرق.</div>
          <div class="field"><label class="label">النقدية الفعلية (${App.currency()})</label>
            <input class="input num" type="number" min="0" step="0.01" value="${Number(r.expected_cash).toFixed(2)}" data-cash>
            <span class="hint">المتوقع: ${fmt.money(r.expected_cash)} · مبيعات ${fmt.money(r.totals.total)}</span>
          </div>
          <div class="field"><label class="label">ملاحظات الإغلاق</label>
            <textarea class="textarea" rows="2" data-notes placeholder="ملاحظات عن الدرج أو الفروقات..."></textarea></div>`,
        footer: `<button class="btn" data-close>إلغاء</button><button class="btn danger" data-save>${App.icon('lock')} إغلاق الوردية</button>`,
        onMount: (h) => {
          h.el.querySelector('[data-save]').onclick = async () => {
            try {
              const res = await App.api(`/shifts/${id}/close`, {
                method: 'POST',
                body: { closing_cash: Number(h.el.querySelector('[data-cash]').value) || 0, notes: h.el.querySelector('[data-notes]').value }
              });
              const diff = Number(res.shift.difference);
              ui.toast(diff === 0 ? 'تم إغلاق الوردية بدون فروقات' : `تم الإغلاق · الفرق ${fmt.money(diff)}`, diff === 0 ? 'success' : 'warning');
              m.close(); onDone();
            } catch (err) { ui.toast(err.message, 'error'); }
          };
        }
      });
    }

    async function loadAll() { await Promise.all([loadCurrent(), loadList()]); App.reloadNotifications(); }

    const f = container.querySelector('[data-from]'); const t = container.querySelector('[data-to]');
    f.onchange = () => { state.from = f.value; loadList(); };
    t.onchange = () => { state.to = t.value; loadList(); };
    container.querySelector('[data-status]').onchange = (e) => { state.status = e.target.value; state.page = 1; loadList(); };
    container.querySelector('[data-reload]').onclick = loadAll;
    container.querySelector('[data-open]').onclick = () => {
      if (App.openShiftDialog) App.openShiftDialog(loadAll);
    };
    loadAll();
  }

  App.register('reports', { title: 'التقارير', subtitle: 'تحليلات المبيعات والأرباح والضرائب', perm: 'reports.view', render: renderReports });
  App.register('accounting', { title: 'المحاسبة', subtitle: 'القيود والقوائم المالية', perm: 'accounting.view', render: renderAccounting });
  App.register('shifts', { title: 'الورديات', subtitle: 'الصندوق والورديات', perm: 'shifts.use', render: renderShifts });
})();
