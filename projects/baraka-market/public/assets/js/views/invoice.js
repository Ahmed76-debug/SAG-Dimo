/* ============================================================
   مكوّن الفاتورة المشترك — عرض / طباعة / إرجاع / تحصيل
   ============================================================ */
import { state, api, can, icon, esc, fmt } from '../core.js';
import { modal, toast, printReceipt, statusBadge, methodBadge, openForm } from '../ui.js';

export async function openInvoiceModal(saleId, { onChanged } = {}) {
  let sale = null;
  try {
    const res = await api(`/sales/${saleId}`);
    sale = res.sale;
  } catch (e) {
    toast(e.message, 'error');
    return;
  }
  const settings = { ...state.settings, ...(sale.settings || {}) };
  const canReturn = can('sales.return') && sale.status === 'completed';
  const remaining = Math.max(0, Number(sale.total) - Number(sale.paid));
  const canCollect = can('treasury.manage') && sale.payment_method === 'credit' && remaining > 0.01;

  const m = modal({
    title: `فاتورة ${esc(sale.invoice_no)}`,
    subtitle: `${fmt.datetime(sale.created_at)} · ${esc(sale.user_name)}`,
    size: 'wide',
    body: `
      <div class="row wrap" style="gap:8px;margin-bottom:16px">
        ${statusBadge(sale.status)} ${methodBadge(sale.payment_method)}
        <span class="badge badge-muted">${icon('receipt', 'icon-sm')} ${sale.items.length} صنف</span>
        ${sale.customer_name ? `<span class="badge badge-info">${icon('users', 'icon-sm')} ${esc(sale.customer_name)}</span>` : ''}
        ${sale.customer_phone ? `<span class="badge badge-muted" dir="ltr">${esc(sale.customer_phone)}</span>` : ''}
      </div>
      <div class="table-wrap" style="border:1px solid var(--border);border-radius:12px">
        <table class="table" style="min-width:480px">
          <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
          <tbody>
            ${sale.items.map((it) => `<tr>
              <td><div class="cell-strong">${esc(it.name)}</div><div class="tiny muted">${esc(it.unit || '')}</div></td>
              <td class="num">${fmt.qty(it.qty)}</td>
              <td class="num">${fmt.money(it.unit_price)}</td>
              <td class="num bolder">${fmt.money(it.total)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="row" style="align-items:flex-start;gap:20px;margin-top:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          ${sale.returns.length ? `<div class="small bold mb-1">المرتجعات</div>
            <div class="timeline">${sale.returns.map((r) => `<div class="tl-item danger"><span class="tl-dot"></span>
              <div class="tl-title">مرتجع ${fmt.money(r.amount)} ${r.restock ? '— أعيد للمخزون' : ''}</div>
              <div class="tl-sub">${esc(r.reason || '')} · ${esc(fmt.datetime(r.created_at))} · ${esc(r.user_name)}</div>
            </div>`).join('')}</div>` : ''}
          ${sale.note ? `<div class="alert alert-info">${icon('info')}<span>${esc(sale.note)}</span></div>` : ''}
        </div>
        <div style="width:min(320px,100%)">
          <div class="sum-row"><span>الإجمالي قبل الخصم</span><b>${fmt.money(sale.subtotal)}</b></div>
          ${Number(sale.discount) ? `<div class="sum-row" style="color:var(--danger)"><span>الخصم</span><b>- ${fmt.money(sale.discount)}</b></div>` : ''}
          ${Number(sale.tax) ? `<div class="sum-row"><span>الضريبة</span><b>${fmt.money(sale.tax)}</b></div>` : ''}
          <div class="sum-total" style="margin-bottom:6px"><span>الإجمالي</span><b style="font-size:24px">${fmt.money(sale.total)}</b></div>
          <div class="sum-row"><span>المدفوع</span><b>${fmt.money(sale.paid)}</b></div>
          ${Number(sale.change_due) ? `<div class="sum-row"><span>الباقي للعميل</span><b>${fmt.money(sale.change_due)}</b></div>` : ''}
          ${remaining > 0.01 ? `<div class="sum-row" style="color:var(--warn)"><span>المتبقي آجل</span><b>${fmt.money(remaining)}</b></div>` : ''}
          <div class="sum-row"><span>الربح</span><b style="color:var(--brand)">${fmt.money(sale.profit)}</b></div>
        </div>
      </div>`,
    footer: `<span class="danger-hint">${sale.returns.length ? 'تم إرجاع هذه الفاتورة' : ''}</span>
      <button class="btn btn-secondary" data-print>${icon('printer')} طباعة</button>
      ${canCollect ? `<button class="btn btn-warn" data-collect>${icon('cash')} تحصيل ${fmt.money(remaining, false)}</button>` : ''}
      ${canReturn ? `<button class="btn btn-outline-danger" data-return>${icon('refresh')} إرجاع</button>` : ''}
      <button class="btn btn-primary" data-close>إغلاق</button>`,
    onMount(mm) {
      mm.root.querySelector('[data-print]').addEventListener('click', () => printReceipt(sale, settings));
      mm.root.querySelector('[data-close]').addEventListener('click', () => mm.close());
      mm.root.querySelector('[data-collect]')?.addEventListener('click', () => openCollect(sale, settings, mm, onChanged));
      mm.root.querySelector('[data-return]')?.addEventListener('click', () => doReturn(sale, mm, onChanged));
    },
  });
  return m;
}

function openCollect(sale, settings, parent, onChanged) {
  const remaining = Math.max(0, sale.total - sale.paid);
  openForm({
    title: 'تحصيل مبلغ آجل',
    subtitle: `فاتورة ${sale.invoice_no} — ${sale.customer_name || ''}`,
    size: 'sm',
    submitText: 'تسجيل التحصيل',
    fields: [
      { name: 'amount', label: 'المبلغ المحصل', type: 'number', step: '0.01', min: 0.01, value: remaining, required: true, span: 2, hint: `المتبقي على الفاتورة: ${fmt.money(remaining)}` },
      { name: 'method', label: 'طريقة الدفع', type: 'select', value: 'cash', options: [{ value: 'cash', label: 'نقدي' }, { value: 'card', label: 'بطاقة' }, { value: 'wallet', label: 'محفظة إلكترونية' }], span: 2 },
    ],
    onSubmit: async (v, mm) => {
      const res = await api(`/sales/${sale.id}/collect`, { method: 'POST', body: { amount: Number(v.amount), method: v.method } });
      mm.close();
      toast(res.message);
      parent?.close();
      if (onChanged) onChanged();
    },
  });
}

async function doReturn(sale, parent, onChanged) {
  const restock = await new Promise((resolve) => {
    const m = modal({
      title: 'إرجاع الفاتورة بالكامل',
      subtitle: `سيتم إرجاع ${sale.items.length} صنف وإعادة المبالغ`,
      size: 'sm',
      body: `<div class="alert alert-warn">${icon('alert')}<div>سيتم تسجيل الفاتورة كمرتجعة وإعادة <b>${fmt.money(sale.total)}</b> للعميل، وإرجاع الكميات إلى المخزون. لا يمكن التراجع عن هذه العملية.</div></div>
        <div class="field mt-2"><label>سبب الإرجاع (اختياري)</label><textarea class="textarea" id="return-reason" rows="2" placeholder="مثال: منتج تالف أو طلب العميل"></textarea></div>
        <label class="switch mt-2"><input type="hidden" name="r" value="0"><input type="checkbox" id="return-restock" value="1" checked><span class="switch-track"></span><span class="switch-label">إعادة الكميات إلى المخزون</span></label>`,
      footer: `<button class="btn btn-secondary" data-close>إلغاء</button>
        <button class="btn btn-danger" data-confirm>${icon('refresh')} تأكيد الإرجاع</button>`,
      onMount: (m2) => {
        m2.root.querySelector('[data-close]').addEventListener('click', () => { m2.close(); resolve(false); });
        m2.root.querySelector('[data-confirm]').addEventListener('click', () => {
          resolve({ restock: m2.root.querySelector('#return-restock').checked, reason: m2.root.querySelector('#return-reason').value });
          m2.close();
        });
      },
      onClose: () => resolve(false),
    });
  });
  if (!restock) return;
  try {
    const res = await api(`/sales/${sale.id}/return`, { method: 'POST', body: { restock: restock.restock, reason: restock.reason } });
    toast(res.message);
    parent?.close();
    if (onChanged) onChanged();
  } catch (e) {
    toast(e.message, 'error');
  }
}
