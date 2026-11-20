/* ============================================================
   المبيعات — الفواتير والمرتجعات
   ============================================================ */
import { state, api, can, icon, esc, fmt, debounce } from '../core.js';
import { emptyState, pager, methodBadge, statusBadge, toast } from '../ui.js';
import { openInvoiceModal } from './invoice.js';
import { rangeControls, bindRange, defaultRange, exportCsv, metric } from './_shared.js';

export async function render(root) {
  let alive = true;
  const range = defaultRange(29);
  const filters = { q: '', method: '', status: '', page: 1, limit: 20 };

  root.innerHTML = `
    <div class="kpis" id="sales-stats">
      ${Array(4).fill('<div class="skeleton" style="height:108px;border-radius:18px"></div>').join('')}
    </div>
    <div class="card flush mt-3">
      <div class="toolbar">
        <div class="input-icon">${icon('search')}
          <input class="input" id="sales-search" placeholder="رقم الفاتورة أو اسم العميل…" autocomplete="off" />
        </div>
        ${rangeControls({ from: range.from, to: range.to })}
        <select class="select" id="sales-method" aria-label="طريقة الدفع">
          <option value="">كل طرق الدفع</option>
          <option value="cash">نقدي</option><option value="card">بطاقة</option>
          <option value="wallet">محفظة</option><option value="credit">آجل</option>
        </select>
        <select class="select" id="sales-status" aria-label="الحالة">
          <option value="">كل الحالات</option>
          <option value="completed">مكتملة</option><option value="returned">مرتجعة</option>
        </select>
        <div class="spacer"></div>
        <button class="btn btn-secondary btn-sm" data-export>${icon('download')} تصدير</button>
        ${can('pos.use') ? `<a class="btn btn-primary btn-sm" href="#/pos">${icon('plus')} فاتورة جديدة</a>` : ''}
      </div>
      <div id="sales-results"></div>
    </div>`;

  async function load(page = filters.page) {
    filters.page = page;
    const qs = new URLSearchParams({
      page: String(page), limit: String(filters.limit), from: range.from, to: range.to,
    });
    if (filters.q) qs.set('q', filters.q);
    if (filters.method) qs.set('method', filters.method);
    if (filters.status) qs.set('status', filters.status);
    const el = root.querySelector('#sales-results');
    try {
      const res = await api('/sales?' + qs.toString());
      if (!alive) return;
      paint(res);
      paintStats(res.summary);
    } catch (e) {
      if (!alive) return;
      el.innerHTML = `<div class="empty"><div class="empty-ico">${icon('alert')}</div><div class="empty-title">تعذر تحميل المبيعات</div><div class="empty-text">${esc(e.message)}</div></div>`;
    }
  }

  function paintStats(s) {
    const el = root.querySelector('#sales-stats');
    if (!el) return;
    const total = Number(s.total) || 0;
    const count = Number(s.count) || 0;
    const profit = Number(s.profit) || 0;
    const paid = Number(s.paid) || 0;
    el.innerHTML = [
      metric({ label: 'إجمالي المبيعات', value: fmt.money(total, false), unit: state.settings.currency, iconName: 'cash', foot: `<span class="muted">${esc(fmt.date(range.from))} — ${esc(fmt.date(range.to))}</span>` }),
      metric({ label: 'عدد الفواتير', value: fmt.int(count), unit: 'فاتورة', iconName: 'receipt', color: 'var(--info)', soft: 'var(--info-soft)', foot: `<span class="muted">متوسط ${fmt.money(count ? total / count : 0)}</span>` }),
      metric({ label: 'صافي الربح', value: fmt.money(profit, false), unit: state.settings.currency, iconName: 'trend-up', color: 'var(--purple)', soft: 'var(--purple-soft)', foot: `<span class="muted">هامش ${fmt.percent(total ? (profit / total) * 100 : 0)}</span>` }),
      metric({ label: 'المبالغ المحصلة', value: fmt.money(paid, false), unit: state.settings.currency, iconName: 'wallet', color: 'var(--accent)', soft: 'var(--accent-soft)', foot: `<span class="muted">متبقي ${fmt.money(Math.max(0, total - paid))}</span>` }),
    ].join('');
  }

  function paint(res) {
    const rows = res.rows || [];
    const el = root.querySelector('#sales-results');
    if (!rows.length) {
      el.innerHTML = emptyState({
        title: 'لا توجد فواتير في هذه الفترة',
        text: 'جرّب توسيع نطاق التاريخ أو تغيير عوامل التصفية.',
        iconName: 'receipt',
        action: can('pos.use') ? '<a class="btn btn-primary" href="#/pos">فتح الكاشير</a>' : '',
      });
      return;
    }
    el.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>الفاتورة</th><th>العميل</th><th>الكاشير</th><th>الأصناف</th><th>الدفع</th><th>الإجمالي</th><th>المدفوع</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead>
      <tbody>${rows.map((s) => `<tr>
        <td><button class="btn-link" data-sale="${s.id}" style="direction:ltr;font-size:12px">${esc(s.invoice_no)}</button></td>
        <td><span class="cell-strong">${esc(s.customer_name)}</span></td>
        <td class="small muted">${esc(s.user_name)}</td>
        <td class="num muted">${fmt.int(s.items_count)}</td>
        <td>${methodBadge(s.payment_method)}</td>
        <td class="num bolder">${fmt.money(s.total)}</td>
        <td class="num ${Number(s.paid) < Number(s.total) ? 'text-warn' : 'muted'}">${fmt.money(s.paid)}</td>
        <td>${statusBadge(s.status)}</td>
        <td class="small muted nowrap">${esc(fmt.shortDate(s.created_at))} · ${esc(fmt.time(s.created_at))}</td>
        <td><div class="actions"><button class="icon-btn" data-sale="${s.id}" title="عرض الفاتورة">${icon('eye')}</button></div></td>
      </tr>`).join('')}</tbody>
    </table></div>
    ${pager({ page: res.page, pages: res.pages, total: res.total, limit: res.limit })}`;
    el.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => load(Number(b.dataset.page))));
    el.querySelectorAll('[data-sale]').forEach((b) => b.addEventListener('click', () => openInvoiceModal(b.dataset.sale, { onChanged: () => load() })));
  }

  const searchInput = root.querySelector('#sales-search');
  searchInput.addEventListener('input', debounce(() => { filters.q = searchInput.value.trim(); load(1); }, 320));
  root.querySelector('#sales-method').addEventListener('change', (e) => { filters.method = e.target.value; load(1); });
  root.querySelector('#sales-status').addEventListener('change', (e) => { filters.status = e.target.value; load(1); });
  bindRange(root, range.from, range.to, (f, t) => { range.from = f; range.to = t; load(1); });
  root.querySelector('[data-export]').addEventListener('click', async () => {
    try {
      const qs = new URLSearchParams({ limit: '100', page: '1', from: range.from, to: range.to });
      if (filters.q) qs.set('q', filters.q);
      if (filters.method) qs.set('method', filters.method);
      if (filters.status) qs.set('status', filters.status);
      const res = await api('/sales?' + qs.toString());
      exportCsv(`baraka-sales-${range.from}-${range.to}.csv`, res.rows, [
        { key: 'invoice_no', label: 'الفاتورة' }, { key: 'customer_name', label: 'العميل' }, { key: 'user_name', label: 'الكاشير' },
        { key: 'items_count', label: 'الأصناف' }, { key: 'payment_method', label: 'طريقة الدفع' }, { key: 'total', label: 'الإجمالي' },
        { key: 'paid', label: 'المدفوع' }, { key: 'profit', label: 'الربح' }, { key: 'status', label: 'الحالة' }, { key: 'created_at', label: 'التاريخ' },
      ]);
    } catch (e) { toast(e.message, 'error'); }
  });

  await load(1);
  return () => { alive = false; };
}
