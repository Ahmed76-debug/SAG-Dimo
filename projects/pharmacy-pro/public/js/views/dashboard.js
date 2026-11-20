/* PharmaPro – Dashboard view */
(function () {
  'use strict';
  const ui = App.ui;
  const fmt = App.fmt;

  function barList(items, { valueKey = 'value', labelKey = 'label', formatter = fmt.money, color } = {}) {
    if (!items || !items.length) return ui.empty({ icon: 'chart', title: 'لا توجد بيانات', text: 'لم تُسجّل حركات في هذه الفترة.' });
    const max = Math.max(...items.map((i) => Number(i[valueKey]) || 0), 1);
    return `<div class="bar-list">${items.map((it, idx) => `
      <div class="bar-row">
        <span class="name">${App.esc(it[labelKey])}</span>
        <span class="val">${formatter(it[valueKey])}</span>
        <span class="track"><span class="fill" style="width:${Math.max(3, (Number(it[valueKey]) / max) * 100)}%;${color ? `background:${color};` : ''}"></span></span>
      </div>`).join('')}</div>`;
  }

  function recentRows(sales) {
    return sales.map((s) => `
      <tr class="pointer" onclick="App.openSaleModal && App.openSaleModal(${s.id})" style="cursor:pointer">
        <td><div class="cell-title ltr">${App.esc(s.invoice_no)}</div><div class="cell-sub">${fmt.date(s.date)} · ${fmt.time(s.date)}</div></td>
        <td>${App.esc(s.customer_name || 'عميل نقدي')}</td>
        <td>${App.payMethodLabel ? App.payMethodLabel(s.payment_method) : fmt.statusText(s.payment_method)}</td>
        <td class="num bold">${fmt.money(s.total)}</td>
        <td>${App.badge(s.status)}</td>
      </tr>`).join('');
  }

  async function render(container) {
    const name = (App.state.user.full_name || '').split(' ').slice(0, 2).join(' ');
    const state = { days: 14 };

    container.innerHTML = `
      ${ui.pageHead({
        title: 'مرحباً، ' + name + ' 👋',
        subtitle: fmt.weekday() + ' · هذه نظرة سريعة على أداء الصيدلية.',
        actions: `
          <button class="btn" data-refresh>${App.icon('refresh')} تحديث</button>
          ${App.can('pos.use') ? `<button class="btn primary" onclick="App.go('pos')">${App.icon('cart')} فاتورة بيع</button>` : ''}
          ${App.can('purchases.manage') ? `<button class="btn" onclick="App.go('purchases', { new: 1 })">${App.icon('truck')} فاتورة شراء</button>` : ''}
        `
      })}
      <div id="dash-body"><div class="loading-block"><span class="spinner lg"></span><span>جارٍ تحميل البيانات...</span></div></div>`;

    container.querySelector('[data-refresh]').onclick = () => load(true);

    function paint(d) {
      const dayLabels = d.series.map((s) => {
        const parts = String(s.date).split('-');
        return `${parts[2]}/${parts[1]}`;
      });
      const series = d.series.map((s, i) => ({ label: dayLabels[i], value: s.total, invoices: s.invoices }));
      const catItems = (d.category_sales || []).map((c) => ({ label: c.name, value: c.total }));
      const payTotal = (d.payment_mix || []).reduce((sum, p) => sum + Number(p.total), 0) || 1;
      const expiring = d.expiring || [];

      container.querySelector('#dash-body').innerHTML = `
        <div class="stat-grid">
          ${ui.stat({
            label: 'مبيعات اليوم', valueHtml: `${fmt.number(d.today.total)} <span class="cur">${App.currency()}</span>`,
            icon: 'banknote', tone: 'var(--primary)', tint: 'var(--primary-soft)',
            foot: `${App.icon('receipt', 13)} ${fmt.number(d.today.invoices, 0)} فاتورة · متوسط ${fmt.money(d.today.avg_invoice)}`
          })}
          ${ui.stat({
            label: 'ربح اليوم (تقديري)', valueHtml: `${fmt.number(d.today.profit)} <span class="cur">${App.currency()}</span>`,
            icon: 'trendingUp', tone: 'var(--success)', tint: 'var(--success-soft)',
            foot: `صافي المبيعات بعد الخصم والضريبة والتكلفة`
          })}
          ${ui.stat({
            label: 'مبيعات الشهر', valueHtml: `${fmt.number(d.month.total)} <span class="cur">${App.currency()}</span>`,
            icon: 'chart', tone: 'var(--accent)', tint: 'var(--accent-soft)',
            foot: `${fmt.number(d.month.invoices, 0)} فاتورة · ربح ${fmt.money(d.month.profit)}`
          })}
          ${ui.stat({
            label: 'قيمة المخزون (تكلفة)', valueHtml: `${fmt.number(d.inventory.cost_value)} <span class="cur">${App.currency()}</span>`,
            icon: 'layers', tone: 'var(--purple)', tint: 'var(--purple-soft)',
            foot: `${fmt.number(d.inventory.products, 0)} صنف · ${fmt.number(d.inventory.units, 0)} وحدة · بيع ${fmt.money(d.inventory.retail_value)}`
          })}
        </div>

        ${d.shift ? `
          <div class="shift-banner" style="background:var(--success-soft);color:var(--success)">
            ${App.icon('clock', 16)} وردية مفتوحة منذ ${fmt.datetime(d.shift.opened_at)}
            <span class="badge success" style="margin-inline-start:6px">${App.icon('circleCheck', 12)} نشطة</span>
            <button class="btn sm" onclick="App.go('shifts')">إدارة الوردية ${App.icon('arrowLeft', 13)}</button>
          </div>` : `
          <div class="shift-banner">
            ${App.icon('alert', 16)} لا توجد وردية مفتوحة. افتح وردية قبل بدء البيع.
            ${App.can('shifts.use') ? `<button class="btn sm primary" onclick="App.openShiftDialog && App.openShiftDialog()">${App.icon('plus', 13)} فتح وردية</button>` : ''}
          </div>`}

        <div class="two-col">
          <div>
            ${ui.section({
              title: 'حركة المبيعات',
              subtitle: 'إجمالي المبيعات اليومية خلال الفترة المحددة',
              actions: `<div class="btn-group" data-range>
                ${[7, 14, 30, 90].map((n) => `<button class="btn ${state.days === n ? 'primary' : ''}" data-days="${n}">${n} يوم</button>`).join('')}
              </div>`,
              body: `
                <div class="chart-wrap" style="color:var(--text)">${App.charts.area(series, { height: 230 })}</div>
                <div class="kpi-strip" style="margin:14px 0 0">
                  <div class="item"><div class="label">فواتير الفترة</div><div class="value">${fmt.number(series.reduce((s, x) => s + x.invoices, 0), 0)}</div></div>
                  <div class="item"><div class="label">إجمالي المبيعات</div><div class="value">${fmt.compact(series.reduce((s, x) => s + x.value, 0))}</div></div>
                  <div class="item"><div class="label">ضريبة اليوم</div><div class="value">${fmt.compact(d.today.tax)}</div></div>
                  <div class="item"><div class="label">خصم اليوم</div><div class="value">${fmt.compact(d.today.discount)}</div></div>
                </div>`
            })}
            ${ui.section({
              title: 'أحدث الفواتير',
              subtitle: 'آخر 8 عمليات بيع',
              actions: App.can('sales.view') ? `<button class="btn sm ghost" onclick="App.go('sales')">عرض الكل ${App.icon('chevronLeft', 13)}</button>` : '',
              flush: true,
              body: ui.table({
                className: 'compact',
                columns: [
                  { label: 'الفاتورة', render: (s) => `<div class="cell-title ltr">${App.esc(s.invoice_no)}</div><div class="cell-sub">${fmt.date(s.date)} · ${fmt.time(s.date)}</div>` },
                  { label: 'العميل', render: (s) => App.esc(s.customer_name || 'عميل نقدي') },
                  { label: 'طريقة الدفع', render: (s) => `<span class="small muted">${App.esc(fmt.statusText(s.payment_method))}</span>` },
                  { label: 'الإجمالي', tdClass: 'num', render: (s) => `<b>${fmt.money(s.total)}</b>` },
                  { label: 'الحالة', render: (s) => App.badge(s.status) }
                ],
                rows: d.recent_sales
              })
            })}
          </div>
          <div>
            ${ui.section({
              title: 'إجراءات سريعة',
              body: `<div class="quick-actions">
                <button class="quick-action" onclick="App.go('pos')"><span class="qa-icon">${App.icon('cart')}</span>فاتورة بيع</button>
                <button class="quick-action" onclick="App.go('products', { new: 1 })"><span class="qa-icon" style="background:var(--purple-soft);color:var(--purple)">${App.icon('pill')}</span>صنف جديد</button>
                <button class="quick-action" onclick="App.go('purchases', { new: 1 })"><span class="qa-icon" style="background:var(--accent-soft);color:var(--accent)">${App.icon('truck')}</span>فاتورة شراء</button>
                <button class="quick-action" onclick="App.go('customers', { new: 1 })"><span class="qa-icon" style="background:var(--success-soft);color:var(--success)">${App.icon('userPlus')}</span>عميل جديد</button>
              </div>`
            })}
            ${ui.section({
              title: 'المخزون والالتزامات',
              body: `<div class="kpi-strip" style="margin:0;grid-template-columns:1fr 1fr">
                <div class="item"><div class="label">أصناف تحت الحد</div><div class="value" style="color:var(--warning)">${fmt.number(d.inventory.low_stock, 0)}</div></div>
                <div class="item"><div class="label">دفعات قاربت الانتهاء</div><div class="value" style="color:var(--warning)">${fmt.number(d.inventory.expiring, 0)}</div></div>
                <div class="item"><div class="label">دفعات منتهية</div><div class="value" style="color:var(--danger)">${fmt.number(d.inventory.expired, 0)}</div></div>
                <div class="item"><div class="label">عملاء مسجلون</div><div class="value">${fmt.number(d.customers, 0)}</div></div>
              </div>
              <div class="info-row mt-2"><span class="k">مستحقات العملاء (آجل)</span><span class="v text-warning">${fmt.money(d.credit_total)}</span></div>
              <div class="info-row"><span class="k">مستحقات الموردين</span><span class="v text-danger">${fmt.money(d.due_suppliers)}</span></div>
              <div class="info-row"><span class="k">روشتات قيد الصرف</span><span class="v">${fmt.number(d.pending_rx, 0)}</span></div>`
            })}
            ${ui.section({
              title: 'توزيع المبيعات على التصنيفات',
              subtitle: 'حسب قيمة البيع في الفترة',
              body: catItems.length ? App.charts.donut(catItems.slice(0, 6), { size: 148, thickness: 19 }) : ui.empty({ icon: 'chart', title: 'لا توجد مبيعات' })
            })}
          </div>
        </div>

        <div class="three-col">
          ${ui.section({
            title: 'الأصناف الأكثر مبيعاً',
            subtitle: 'حسب قيمة الإيراد',
            actions: App.can('reports.view') ? `<button class="btn sm ghost" onclick="App.go('reports', { tab: 'products' })">التقرير</button>` : '',
            body: barList((d.top_products || []).map((p) => ({ label: p.name, value: p.revenue })))
          })}
          ${ui.section({
            title: 'طرق الدفع',
            subtitle: 'خلال الفترة المحددة',
            body: `<div class="bar-list">${(d.payment_mix || []).map((p) => `
              <div class="bar-row">
                <span class="name">${App.esc(fmt.statusText(p.name))} <span class="muted xsmall">(${fmt.number(p.count, 0)})</span></span>
                <span class="val">${fmt.money(p.total)}</span>
                <span class="track"><span class="fill" style="width:${Math.max(3, (Number(p.total) / payTotal) * 100)}%;background:${p.name === 'cash' ? 'linear-gradient(90deg,#0d9488,#2dd4bf)' : p.name === 'card' ? 'linear-gradient(90deg,#0ea5e9,#38bdf8)' : p.name === 'wallet' ? 'linear-gradient(90deg,#8b5cf6,#a78bfa)' : 'linear-gradient(90deg,#f59e0b,#fbbf24)'}"></span></span>
              </div>`).join('') || ui.empty({ icon: 'wallet', title: 'لا توجد حركات' })}</div>`
          })}
          ${ui.section({
            title: 'أصناف تحتاج طلب',
            subtitle: 'الرصيد عند أو أقل من حد الطلب',
            actions: `<button class="btn sm ghost" onclick="App.go('products', { low: 1 })">الكل</button>`,
            flush: true,
            body: d.low_stock.length ? d.low_stock.map((p) => `
              <div class="alert-item" style="cursor:pointer" onclick="App.go('products', { low: 1 })">
                <div class="ai-icon">${App.icon('alert', 16)}</div>
                <div class="ai-main"><div class="ai-title">${App.esc(p.name)}</div>
                  <div class="ai-sub">المتاح ${fmt.qty(p.stock)} ${App.esc(p.unit || '')} · حد الطلب ${fmt.qty(p.min_stock)}</div></div>
                <span class="badge warning">${fmt.qty(p.stock)}</span>
              </div>`).join('') : ui.empty({ icon: 'circleCheck', title: 'المخزون بحالة جيدة', text: 'لا توجد أصناف تحت حد الطلب.' })
          })}
        </div>

        <div class="equal-grid">
          ${ui.section({
            title: 'دفعات قاربت على الانتهاء',
            subtitle: `خلال ${App.state.settings.expiry_alert_days || 90} يوم القادمة`,
            actions: `<button class="btn sm ghost" onclick="App.go('inventory', { tab: 'expiry' })">عرض الكل</button>`,
            flush: true,
            body: expiring.length ? expiring.map((b) => `
              <div class="alert-item">
                <div class="ai-icon ${b.days_left < 0 ? 'danger' : ''}">${App.icon('clock', 16)}</div>
                <div class="ai-main"><div class="ai-title">${App.esc(b.name)}</div>
                  <div class="ai-sub">${b.days_left < 0 ? `منتهية منذ ${Math.abs(b.days_left)} يوم` : `تنتهي بعد ${b.days_left} يوم`} · دفعة ${App.esc(b.batch_no || '—')}</div></div>
                <div class="text-end"><div class="ai-value">${fmt.qty(b.qty)}</div><div class="xsmall muted">${fmt.date(b.expiry_date)}</div></div>
              </div>`).join('') : ui.empty({ icon: 'circleCheck', title: 'لا توجد دفعات قريبة الانتهاء' })
          })}
          ${ui.section({
            title: 'ملخص اليوم',
            subtitle: 'مؤشرات سريعة',
            body: `<div class="info-row"><span class="k">متوسط قيمة الفاتورة</span><span class="v">${fmt.money(d.today.avg_invoice)}</span></div>
              <div class="info-row"><span class="k">ضريبة محصلة اليوم</span><span class="v">${fmt.money(d.today.tax)}</span></div>
              <div class="info-row"><span class="k">خصومات اليوم</span><span class="v text-warning">${fmt.money(d.today.discount)}</span></div>
              <div class="info-row"><span class="k">إجمالي مبيعات الشهر</span><span class="v">${fmt.money(d.month.total)}</span></div>
              <div class="info-row"><span class="k">ربح الشهر التقديري</span><span class="v text-success">${fmt.money(d.month.profit)}</span></div>
              <div class="flex gap-2 mt-3">
                <button class="btn sm" onclick="App.go('reports')">${App.icon('chart')} التقارير</button>
                <button class="btn sm" onclick="App.go('accounting')">${App.icon('wallet')} المحاسبة</button>
              </div>`
          })}
        </div>`;

      container.querySelectorAll('[data-days]').forEach((btn) => {
        btn.onclick = () => { state.days = Number(btn.dataset.days); load(); };
      });
    }

    async function load(showToast) {
      try {
        const d = await App.api('/dashboard?days=' + state.days);
        paint(d);
        App.state.notifications = {
          ...(App.state.notifications || {}),
          shift: d.shift,
          low_stock: d.low_stock,
          expiring: d.expiring,
          pending_rx: d.pending_rx
        };
        if (showToast) ui.toast('تم تحديث لوحة التحكم');
      } catch (err) {
        container.querySelector('#dash-body').innerHTML = `<div class="card card-pad">${ui.empty({ icon: 'alert', title: 'تعذر تحميل البيانات', text: App.esc(err.message), action: `<button class="btn primary mt-3" data-retry>${App.icon('refresh')} إعادة المحاولة</button>` })}</div>`;
        const retry = container.querySelector('[data-retry]');
        if (retry) retry.onclick = load;
      }
    }

    load();
    return () => { /* nothing to clean */ };
  }

  App.register('dashboard', {
    title: 'لوحة التحكم',
    subtitle: 'نظرة شاملة على أداء الصيدلية',
    perm: 'dashboard.view',
    render
  });
})();
