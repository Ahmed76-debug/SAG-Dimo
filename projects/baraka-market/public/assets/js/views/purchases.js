/* ============================================================
   المشتريات — فواتير التوريد
   ============================================================ */
import { state, api, can, icon, esc, fmt, debounce } from '../core.js';
import { toast, modal, emptyState, pager, methodBadge, statusBadge } from '../ui.js';
import { rangeControls, bindRange, defaultRange, exportCsv, metric, PAY_OPTIONS } from './_shared.js';

export async function render(root, { params } = {}) {
  let alive = true;
  const range = defaultRange(29);
  const filters = { q: '', page: 1, limit: 20 };

  root.innerHTML = `
    <div class="kpis" id="pur-stats">
      ${Array(3).fill('<div class="skeleton" style="height:108px;border-radius:18px"></div>').join('')}
    </div>
    <div class="card flush mt-3">
      <div class="toolbar">
        <div class="input-icon">${icon('search')}
          <input class="input" id="pur-search" placeholder="رقم الفاتورة أو اسم المورد…" autocomplete="off" />
        </div>
        ${rangeControls({ from: range.from, to: range.to })}
        <div class="spacer"></div>
        <button class="btn btn-secondary btn-sm" data-export>${icon('download')} تصدير</button>
        ${can('purchases.manage') ? `<button class="btn btn-primary btn-sm" data-new>${icon('plus')} فاتورة توريد</button>` : ''}
      </div>
      <div id="pur-results"></div>
    </div>`;

  async function load(page = filters.page) {
    filters.page = page;
    const qs = new URLSearchParams({ page: String(page), limit: String(filters.limit), from: range.from, to: range.to });
    if (filters.q) qs.set('q', filters.q);
    try {
      const res = await api('/purchases?' + qs.toString());
      if (!alive) return;
      paint(res);
      paintStats(res.summary);
    } catch (e) {
      if (!alive) return;
      root.querySelector('#pur-results').innerHTML = `<div class="empty"><div class="empty-ico">${icon('alert')}</div><div class="empty-title">تعذر تحميل المشتريات</div><div class="empty-text">${esc(e.message)}</div></div>`;
    }
  }

  function paintStats(s) {
    const el = root.querySelector('#pur-stats');
    if (!el) return;
    const total = Number(s.total) || 0;
    const paid = Number(s.paid) || 0;
    el.innerHTML = [
      metric({ label: 'إجمالي المشتريات', value: fmt.money(total, false), unit: state.settings.currency, iconName: 'truck', foot: `<span class="muted">${esc(fmt.date(range.from))} — ${esc(fmt.date(range.to))}</span>` }),
      metric({ label: 'عدد فواتير التوريد', value: fmt.int(s.count), unit: 'فاتورة', iconName: 'receipt', color: 'var(--info)', soft: 'var(--info-soft)', foot: `<span class="muted">متوسط ${fmt.money(s.count ? total / s.count : 0)}</span>` }),
      metric({ label: 'المتبقي للموردين', value: fmt.money(Math.max(0, total - paid), false), unit: state.settings.currency, iconName: 'wallet', color: 'var(--warn)', soft: 'var(--warn-soft)', foot: `<span class="muted">مدفوع ${fmt.money(paid)}</span>` }),
    ].join('');
  }

  function paint(res) {
    const rows = res.rows || [];
    const el = root.querySelector('#pur-results');
    if (!rows.length) {
      el.innerHTML = emptyState({
        title: 'لا توجد فواتير توريد',
        text: 'سجّل فاتورة شراء جديدة ليتم تحديث المخزون والتكلفة تلقائيًا.',
        iconName: 'truck',
        action: can('purchases.manage') ? '<button class="btn btn-primary" data-new>تسجيل فاتورة</button>' : '',
      });
      el.querySelector('[data-new]')?.addEventListener('click', () => openPurchaseForm(() => load(1)));
      return;
    }
    el.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>الفاتورة</th><th>المورد</th><th>الأصناف</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الدفع</th><th>المستخدم</th><th>التاريخ</th><th></th></tr></thead>
      <tbody>${rows.map((p) => {
        const due = Math.max(0, (Number(p.total) || 0) - (Number(p.paid) || 0));
        return `<tr>
          <td><button class="btn-link" data-view="${p.id}" style="direction:ltr;font-size:12px">${esc(p.invoice_no)}</button></td>
          <td class="cell-strong">${esc(p.supplier_name)}</td>
          <td class="num muted">${fmt.int(p.items_count)}</td>
          <td class="num bolder">${fmt.money(p.total)}</td>
          <td class="num muted">${fmt.money(p.paid)}</td>
          <td class="num ${due > 0 ? 'text-warn bolder' : 'muted'}">${due > 0 ? fmt.money(due) : '—'}</td>
          <td>${methodBadge(p.payment_method)}</td>
          <td class="small muted">${esc(p.user_name)}</td>
          <td class="small muted nowrap">${esc(fmt.shortDate(p.created_at))} · ${esc(fmt.time(p.created_at))}</td>
          <td><div class="actions"><button class="icon-btn" data-view="${p.id}" title="عرض">${icon('eye')}</button></div></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
    ${pager({ page: res.page, pages: res.pages, total: res.total, limit: res.limit })}`;

    el.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => load(Number(b.dataset.page))));
    el.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => openPurchase(b.dataset.view)));
  }

  const searchInput = root.querySelector('#pur-search');
  searchInput.addEventListener('input', debounce(() => { filters.q = searchInput.value.trim(); load(1); }, 320));
  bindRange(root, range.from, range.to, (f, t) => { range.from = f; range.to = t; load(1); });
  root.querySelector('[data-new]')?.addEventListener('click', () => openPurchaseForm(() => load(1)));
  root.querySelector('[data-export]').addEventListener('click', async () => {
    try {
      const qs = new URLSearchParams({ limit: '100', page: '1', from: range.from, to: range.to });
      if (filters.q) qs.set('q', filters.q);
      const res = await api('/purchases?' + qs.toString());
      exportCsv(`baraka-purchases-${range.from}-${range.to}.csv`, res.rows, [
        { key: 'invoice_no', label: 'الفاتورة' }, { key: 'supplier_name', label: 'المورد' }, { key: 'items_count', label: 'الأصناف' },
        { key: 'total', label: 'الإجمالي' }, { key: 'paid', label: 'المدفوع' }, { key: 'payment_method', label: 'طريقة الدفع' },
        { key: 'user_name', label: 'المستخدم' }, { key: 'created_at', label: 'التاريخ' },
      ]);
    } catch (e) { toast(e.message, 'error'); }
  });

  await load(1);
  if (params?.get('new') && can('purchases.manage')) setTimeout(() => openPurchaseForm(() => load(1)), 250);
  return () => { alive = false; };
}

/* ============================ عرض فاتورة ============================ */
async function openPurchase(id) {
  let purchase;
  try { purchase = (await api(`/purchases/${id}`)).purchase; } catch (e) { toast(e.message, 'error'); return; }
  const due = Math.max(0, (Number(purchase.total) || 0) - (Number(purchase.paid) || 0));
  modal({
    title: `فاتورة توريد ${esc(purchase.invoice_no)}`,
    subtitle: `${esc(purchase.supplier_name)} · ${esc(fmt.datetime(purchase.created_at))}`,
    size: 'wide',
    body: `
      <div class="row wrap" style="gap:8px;margin-bottom:14px">
        ${methodBadge(purchase.payment_method)} ${statusBadge(purchase.status)}
        <span class="badge badge-muted">${icon('box', 'icon-sm')} ${purchase.items.length} صنف</span>
        <span class="badge badge-info">${icon('user-cog', 'icon-sm')} ${esc(purchase.user_name)}</span>
      </div>
      <div class="table-wrap" style="border:1px solid var(--border);border-radius:12px"><table class="table" style="min-width:520px">
        <thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الشراء</th><th>الإجمالي</th></tr></thead>
        <tbody>${purchase.items.map((it) => `<tr>
          <td class="cell-strong">${esc(it.name)}</td>
          <td class="num">${fmt.qty(it.qty)}</td>
          <td class="num">${fmt.money(it.unit_cost)}</td>
          <td class="num bolder">${fmt.money(it.total)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div class="row" style="justify-content:flex-end;margin-top:16px">
        <div style="width:min(320px,100%)">
          <div class="sum-row"><span>الإجمالي قبل الخصم</span><b>${fmt.money(purchase.subtotal)}</b></div>
          ${Number(purchase.discount) ? `<div class="sum-row" style="color:var(--danger)"><span>الخصم</span><b>- ${fmt.money(purchase.discount)}</b></div>` : ''}
          <div class="sum-total"><span>إجمالي الفاتورة</span><b>${fmt.money(purchase.total)}</b></div>
          <div class="sum-row"><span>المدفوع</span><b>${fmt.money(purchase.paid)}</b></div>
          ${due > 0 ? `<div class="sum-row" style="color:var(--warn)"><span>المتبقي على المورد</span><b>${fmt.money(due)}</b></div>` : ''}
        </div>
      </div>
      ${purchase.note ? `<div class="alert alert-info mt-2">${icon('info')}<span>${esc(purchase.note)}</span></div>` : ''}`,
    footer: '<button class="btn btn-secondary" data-close>إغلاق</button>',
  });
}

/* ============================ إنشاء فاتورة ============================ */
async function openPurchaseForm(onSaved) {
  let products, suppliers;
  try {
    const [p, s] = await Promise.all([api('/products/all'), api('/suppliers')]);
    products = p.rows || [];
    suppliers = s.rows || [];
  } catch (e) { toast(e.message, 'error'); return; }
  if (!suppliers.length) {
    toast('أضف موردًا أولًا من صفحة العملاء والموردين', 'warn');
    location.hash = '#/contacts?tab=suppliers';
    return;
  }
  if (!products.length) { toast('أضف منتجات أولًا قبل تسجيل المشتريات', 'warn'); return; }

  let lines = [];
  const cur = state.settings.currency || 'ج.م';

  const m = modal({
    title: 'فاتورة توريد جديدة',
    subtitle: 'سيتم تحديث المخزون وتكلفة الأصناف تلقائيًا',
    size: 'wide',
    body: `
      <div class="form-grid" style="margin-bottom:14px">
        <div class="field"><label>المورد <i class="req" style="color:var(--danger)">*</i></label>
          <select class="select" id="pur-supplier" required>
            <option value="">اختر المورد…</option>
            ${suppliers.map((s) => `<option value="${s.id}">${esc(s.name)}${Number(s.balance) > 0 ? ` — مستحق ${fmt.num(s.balance)}` : ''}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>طريقة السداد</label>
          <select class="select" id="pur-method">
            ${PAY_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="input-icon" style="margin-bottom:10px">
        ${icon('scan')}
        <input class="input" id="pur-barcode" placeholder="امسح باركود الصنف لإضافته مباشرة…" autocomplete="off" />
        <span class="kbd-hint">Enter</span>
      </div>
      <div class="card" style="padding:12px;background:var(--surface-2);border:1px dashed var(--border-strong);box-shadow:none">
        <div class="row wrap" style="gap:8px;align-items:flex-end">
          <div class="field" style="flex:2;min-width:180px"><label>الصنف</label>
            <select class="select" id="pur-product">
              ${products.map((p) => `<option value="${p.id}" data-cost="${p.cost}" data-name="${esc(p.name)}">${esc(p.name)} — المتاح ${fmt.num(p.stock)} ${esc(p.unit)}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="width:110px"><label>الكمية</label><input class="input" id="pur-qty" type="number" min="0.01" step="0.01" value="1" /></div>
          <div class="field" style="width:120px"><label>سعر الشراء</label><input class="input" id="pur-cost" type="number" min="0" step="0.01" value="${fmt.num(products[0].cost)}" /></div>
          <button class="btn btn-primary" id="pur-add" style="height:40px">${icon('plus')} إضافة</button>
        </div>
      </div>
      <div id="pur-lines" class="mt-2"></div>
      <div class="row" style="align-items:flex-start;gap:20px;margin-top:14px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:220px"><label>ملاحظة على الفاتورة</label>
          <textarea class="textarea" id="pur-note" rows="2" placeholder="رقم فاتورة المورد، شروط السداد…"></textarea>
        </div>
        <div style="width:min(330px,100%)">
          <div class="sum-row"><span>الإجمالي الفرعي</span><b id="pur-sub">0</b></div>
          <div class="field" style="flex-direction:row;align-items:center;justify-content:space-between;margin:6px 0">
            <label style="margin:0">خصم</label>
            <input class="input" id="pur-discount" type="number" min="0" step="0.01" value="0" style="width:120px;height:34px;text-align:center" />
          </div>
          <div class="sum-row"><span>المطلوب دفعه</span><b id="pur-paid-display">0</b></div>
          <div class="sum-row"><span>المدفوع الآن</span>
            <input class="input" id="pur-paid" type="number" min="0" step="0.01" value="0" style="width:120px;height:34px;text-align:center" />
          </div>
          <div class="sum-total"><span>الإجمالي</span><b id="pur-total">0 <small>${esc(cur)}</small></b></div>
        </div>
      </div>`,
    footer: `<span class="danger-hint" id="pur-hint"></span>
      <button class="btn btn-secondary" data-close>إلغاء</button>
      <button class="btn btn-primary" data-save>${icon('save')} حفظ الفاتورة</button>`,
    onMount: (mm) => {
      const productSel = mm.root.querySelector('#pur-product');
      const barcodeInput = mm.root.querySelector('#pur-barcode');
      const qtyInput = mm.root.querySelector('#pur-qty');
      const costInput = mm.root.querySelector('#pur-cost');
      const discountInput = mm.root.querySelector('#pur-discount');
      const paidInput = mm.root.querySelector('#pur-paid');
      const methodSel = mm.root.querySelector('#pur-method');
      const linesEl = mm.root.querySelector('#pur-lines');

      productSel.addEventListener('change', () => {
        const opt = productSel.selectedOptions[0];
        costInput.value = Number(opt?.dataset.cost || 0);
      });
      qtyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); mm.root.querySelector('#pur-add').click(); } });

      const addScanned = (code) => {
        const term = String(code || '').trim();
        if (!term) return;
        const p = products.find((x) => String(x.barcode || '') === term || String(x.sku || '').toLowerCase() === term.toLowerCase());
        if (!p) { toast('الباركود غير مسجل في المنتجات', 'warn'); barcodeInput.select(); return; }
        const existing = lines.find((l) => String(l.product_id) === String(p.id) && Number(l.cost) === Number(p.cost));
        if (existing) existing.qty = Math.round((existing.qty + 1) * 100) / 100;
        else lines.push({ product_id: p.id, name: p.name, qty: 1, cost: Number(p.cost) || 0 });
        barcodeInput.value = '';
        refresh();
        toast(`${p.name} — أضيف للفاتورة`);
        barcodeInput.focus();
      };
      barcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addScanned(barcodeInput.value); }
      });

      const subtotal = () => lines.reduce((a, l) => a + l.qty * l.cost, 0);
      const total = () => Math.max(0, subtotal() - (Number(discountInput.value) || 0));

      const recalc = (setPaid = false) => {
        const sub = subtotal();
        const tot = total();
        mm.root.querySelector('#pur-sub').textContent = fmt.money(sub);
        mm.root.querySelector('#pur-paid-display').textContent = fmt.money(tot);
        mm.root.querySelector('#pur-total').innerHTML = `${fmt.money(tot, false)} <small>${esc(cur)}</small>`;
        if (setPaid || paidInput.dataset.auto !== '0') paidInput.value = fmt.num(tot);
        const paid = Number(paidInput.value) || 0;
        const hint = mm.root.querySelector('#pur-hint');
        if (paid < tot && methodSel.value !== 'credit') hint.textContent = `سيُسجل ${fmt.money(tot - paid)} كمستحق على المورد`;
        else if (methodSel.value === 'credit') hint.textContent = `سيُضاف ${fmt.money(tot)} إلى مستحقات المورد`;
        else hint.textContent = '';
      };

      const renderLines = () => {
        if (!lines.length) {
          linesEl.innerHTML = '<div class="empty" style="padding:26px 16px"><div class="empty-icon muted">' + icon('box') + '</div><div class="empty-text">أضف الأصناف المستلمة من المورد</div></div>';
          return;
        }
        linesEl.innerHTML = `<div class="table-wrap" style="border:1px solid var(--border);border-radius:12px"><table class="table table-compact" style="min-width:520px">
          <thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الشراء</th><th>الإجمالي</th><th></th></tr></thead>
          <tbody>${lines.map((l, i) => `<tr>
            <td class="cell-strong">${esc(l.name)}</td>
            <td><input class="input input-sm" type="number" min="0.01" step="0.01" value="${l.qty}" data-qty="${i}" style="width:80px" /></td>
            <td><input class="input input-sm" type="number" min="0" step="0.01" value="${l.cost}" data-cost="${i}" style="width:90px" /></td>
            <td class="num bolder">${fmt.money(l.qty * l.cost)}</td>
            <td><button class="icon-btn danger" data-remove="${i}" title="حذف">${icon('trash')}</button></td>
          </tr>`).join('')}</tbody></table></div>`;
        linesEl.querySelectorAll('[data-qty]').forEach((inp) => inp.addEventListener('input', () => {
          const i = Number(inp.dataset.qty); lines[i].qty = Math.max(0, Number(inp.value) || 0); refresh();
        }));
        linesEl.querySelectorAll('[data-cost]').forEach((inp) => inp.addEventListener('input', () => {
          const i = Number(inp.dataset.cost); lines[i].cost = Math.max(0, Number(inp.value) || 0); refresh();
        }));
        linesEl.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
          lines.splice(Number(b.dataset.remove), 1); renderLines(); recalc();
        }));
      };
      const refresh = () => { renderLines(); recalc(); };

      mm.root.querySelector('#pur-add').addEventListener('click', () => {
        const p = products.find((x) => String(x.id) === productSel.value);
        if (!p) return;
        const qty = Number(qtyInput.value) || 0;
        const cost = Number(costInput.value) || 0;
        if (qty <= 0) { toast('أدخل كمية صحيحة', 'warn'); return; }
        const existing = lines.find((l) => String(l.product_id) === String(p.id) && l.cost === cost);
        if (existing) existing.qty = Math.round((existing.qty + qty) * 100) / 100;
        else lines.push({ product_id: p.id, name: p.name, qty, cost });
        qtyInput.value = 1;
        refresh();
        qtyInput.focus();
      });

      discountInput.addEventListener('input', () => recalc());
      paidInput.addEventListener('input', () => { paidInput.dataset.auto = '0'; recalc(); });
      methodSel.addEventListener('change', () => {
        if (methodSel.value === 'credit') { paidInput.value = 0; paidInput.disabled = true; }
        else { paidInput.disabled = false; paidInput.dataset.auto = '1'; }
        recalc(true);
      });

      mm.root.querySelector('[data-save]').addEventListener('click', async () => {
        if (!mm.root.querySelector('#pur-supplier').value) { toast('اختر المورد', 'warn'); mm.root.querySelector('#pur-supplier').focus(); return; }
        if (!lines.length) { toast('أضف صنفًا واحدًا على الأقل', 'warn'); return; }
        const btn = mm.root.querySelector('[data-save]');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> جارٍ الحفظ…';
        try {
          const res = await api('/purchases', {
            method: 'POST',
            body: {
              supplier_id: Number(mm.root.querySelector('#pur-supplier').value),
              items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty, cost: l.cost })),
              discount: Number(discountInput.value) || 0,
              paid: methodSel.value === 'credit' ? 0 : Number(paidInput.value) || 0,
              payment_method: methodSel.value,
              note: mm.root.querySelector('#pur-note').value,
              branch_id: state.branchId || state.defaultBranchId,
            },
          });
          toast(res.message);
          mm.close();
          if (onSaved) onSaved();
          else location.reload();
        } catch (e) {
          toast(e.message, 'error');
          btn.disabled = false;
          btn.innerHTML = icon('save') + ' حفظ الفاتورة';
        }
      });
      renderLines(); recalc();
    },
  });
  return m;
}
