/* ============================================================
   Auto Car — فاتورة بيع جديدة (كاش / تقسيط / عمولة)
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, state, pick, todayStr, toast, can } from '../core.js';
import { modal, toast as uiToast, statusBadge } from '../ui.js';

export async function render(container) {
  if (!can('sales.manage')) { container.innerHTML = `<div class="empty">${icon('shield', 'lg')}<h4>${t('no_permission')}</h4></div>`; return; }
  let vehicles = [];
  try { vehicles = (await api('/vehicles?status=available&limit=300')).items || []; } catch {}
  const customers = state.meta.customers || [];
  const treasuries = state.meta.treasuries || [];
  let items = [];

  const vehLabel = (v) => `${v.code} — ${[v.brand_name, v.model_name, v.year].filter(Boolean).join(' ')} (${v.ownership === 'consignment' ? t('consignment_own') : t('own')})`;

  container.innerHTML = `
    <div class="sale-grid">
      <div class="sale-main">
        <div class="card card-pad mb-2">
          <div class="form-grid">
            <div class="field"><label>${t('customer')}</label>
              <div class="row" style="gap:8px"><select class="select grow" data-customer><option value="">${t('cash_customer')}</option>${customers.map((c) => `<option value="${c.id}">${esc(pick(c))}${c.phone ? ' — ' + esc(c.phone) : ''}</option>`).join('')}</select></div>
            </div>
            <div class="field"><label>${t('date')}</label><input class="input" type="date" data-date value="${todayStr()}"></div>
            <div class="field"><label>${t('sale_type')}</label><select class="select" data-type><option value="cash">${t('cash')}</option><option value="installment">${t('installment')}</option></select></div>
            <div class="field"><label>${t('treasury')}</label><select class="select" data-treasury><option value="">— ${t('select')} —</option>${treasuries.map((tr) => `<option value="${tr.id}">${esc(pick(tr))}</option>`).join('')}</select></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>${icon('car', 'sm')} ${t('vehicles')}</h3><div class="spacer"></div>
            <div class="row" style="gap:8px"><select class="select" data-vehicle-pick style="min-width:280px"><option value="">${t('select_vehicle')}…</option>${vehicles.map((v) => `<option value="${v.id}">${esc(vehLabel(v))} — ${money(v.target_price)}</option>`).join('')}</select>
            <button class="btn btn-primary btn-sm" data-add-vehicle>${icon('plus', 'sm')} ${t('add')}</button></div>
          </div>
          <div data-items></div>
        </div>

        <div class="card card-pad mt-2" data-install-box style="display:none">
          <div class="card-head" style="padding:0 0 12px;border:none"><h3>${icon('calendar', 'sm')} ${t('installment_schedule')}</h3></div>
          <div class="form-grid">
            <div class="field"><label>${t('down_payment')}</label><input class="input" type="number" step="any" data-down value="0"></div>
            <div class="field"><label>${t('installments_count')}</label><input class="input" type="number" data-count value="12"></div>
            <div class="field"><label>${t('frequency')}</label><select class="select" data-freq><option value="monthly">${t('monthly')}</option><option value="weekly">${t('weekly')}</option><option value="quarterly">${t('quarterly')}</option></select></div>
            <div class="field"><label>${t('interest_rate')}</label><input class="input" type="number" step="any" data-interest value="0"></div>
            <div class="field"><label>${t('first_due_date')}</label><input class="input" type="date" data-first></div>
          </div>
        </div>
      </div>

      <div class="sale-side">
        <div class="card card-pad">
          <div class="card-head" style="padding:0 0 12px;border:none"><h3>${icon('receipt', 'sm')} ${t('invoice_total')}</h3></div>
          <div class="totals">
            <div class="trow"><span>${t('total')}</span><b data-sum-subtotal>0</b></div>
            <div class="trow"><span>${t('discount')}</span><input class="input sm" type="number" step="any" data-discount value="0"></div>
            <div class="trow"><span>${t('tax')} %</span><input class="input sm" type="number" step="any" data-tax value="${state.settings.tax_rate || 0}"></div>
            <div class="trow big"><span>${t('invoice_total')}</span><b data-sum-total>0</b></div>
            <div class="trow"><span>${t('paid')}</span><input class="input sm" type="number" step="any" data-paid value="0"></div>
            <div class="trow"><span>${t('remaining')}</span><b data-sum-remaining>0</b></div>
          </div>
          <div class="field mt-2"><label>${t('notes')}</label><textarea class="textarea" data-note rows="2"></textarea></div>
          <button class="btn btn-primary btn-block btn-lg mt-2" data-submit>${icon('check', 'sm')} ${t('save')} ${t('new_sale')}</button>
          <div class="small muted mt-1" style="text-align:center" data-hint></div>
        </div>
      </div>
    </div>`;

  const $ = (s) => container.querySelector(s);
  const pre = sessionStorage.getItem('ac_sell_vehicle'); if (pre) { sessionStorage.removeItem('ac_sell_vehicle'); addVehicle(Number(pre)); }

  function calc() {
    const subtotal = items.reduce((s, i) => s + i.price, 0);
    const discount = Number($('[data-discount]').value) || 0;
    const taxRate = Number($('[data-tax]').value) || 0;
    const type = $('[data-type]').value;
    const commission = items.reduce((s, i) => s + (i.commission || 0), 0);
    const ownRevenue = Math.max(0, items.filter((i) => !i.consignment).reduce((s, i) => s + i.price, 0) - discount);
    const tax = (ownRevenue + commission) * taxRate / 100;
    const total = items.reduce((s, i) => s + i.price, 0) - discount + tax;
    let paid = Number($('[data-paid]').value) || 0;
    if (type === 'installment') paid = Number($('[data-down]').value) || 0;
    const remaining = Math.max(0, total - paid);
    $('[data-sum-subtotal]').textContent = money(subtotal);
    $('[data-sum-total]').textContent = money(total);
    $('[data-sum-remaining]').textContent = money(remaining);
    return { subtotal, discount, taxRate, total, paid, remaining, tax };
  }

  function renderItems() {
    const box = $('[data-items]');
    if (!items.length) { box.innerHTML = `<div class="empty" style="padding:34px">${icon('car', 'lg')}<h4>${t('select_vehicle')}</h4></div>`; return; }
    box.innerHTML = `<div class="table-wrap"><table class="data"><thead><tr><th>${t('vehicles')}</th><th>${t('ownership')}</th><th class="num">${t('sale_price_label')}</th><th></th></tr></thead>
      <tbody>${items.map((i, idx) => `<tr><td><b>${esc(i.code)}</b><div class="small muted">${esc(i.label)}</div></td>
        <td>${statusBadge(i.consignment ? 'consignment' : 'own')}</td>
        <td class="num"><input class="input sm" type="number" step="any" data-price="${idx}" value="${i.price}" style="max-width:140px;text-align:end"></td>
        <td class="num"><button class="btn btn-ghost btn-icon btn-sm" data-rm="${idx}">${icon('x', 'sm')}</button></td></tr>`).join('')}</tbody></table></div>`;
    box.querySelectorAll('[data-price]').forEach((inp) => inp.onchange = () => {
      const i = items[Number(inp.dataset.price)]; i.price = Number(inp.value) || 0;
      if (i.consignment) i.commission = i.commission_type === 'fixed' ? i.commission_value : i.price * (i.commission_value || 0) / 100;
      renderItems(); calc();
    });
    box.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { items.splice(Number(b.dataset.rm), 1); renderItems(); calc(); });
    calc();
  }

  function addVehicle(id) {
    const v = vehicles.find((x) => x.id == id); if (!v || items.find((i) => i.vehicle_id === v.id)) return;
    const commission = v.ownership === 'consignment' ? (v.commission_type === 'fixed' ? Number(v.commission_value) : Number(v.target_price) * Number(v.commission_value || 0) / 100) : 0;
    items.push({ vehicle_id: v.id, code: v.code, label: [v.brand_name, v.model_name, v.year].filter(Boolean).join(' '), price: Number(v.target_price) || 0, consignment: v.ownership === 'consignment', commission_type: v.commission_type, commission_value: v.commission_value, commission });
    renderItems();
  }

  $('[data-add-vehicle]').onclick = () => { const id = $('[data-vehicle-pick]').value; if (!id) return uiToast(t('select_vehicle'), 'warn'); addVehicle(id); $('[data-vehicle-pick]').value = ''; };
  $('[data-type]').onchange = () => { $('[data-install-box]').style.display = $('[data-type]').value === 'installment' ? '' : 'none'; calc(); };
  ['[data-discount]', '[data-tax]', '[data-paid]', '[data-down]'].forEach((s) => $(s).oninput = calc);

  $('[data-submit]').onclick = async () => {
    if (!items.length) return uiToast(t('select_vehicle'), 'warn');
    const type = $('[data-type]').value;
    const body = {
      customer_id: $('[data-customer]').value || null,
      date: $('[data-date]').value, sale_type: type,
      treasury_id: $('[data-treasury]').value || null,
      discount: Number($('[data-discount]').value) || 0, tax_rate: Number($('[data-tax]').value) || 0,
      note: $('[data-note]').value,
      items: items.map((i) => ({ vehicle_id: i.vehicle_id, price: i.price })),
    };
    if (type === 'installment') {
      body.down_payment = Number($('[data-down]').value) || 0;
      body.installments_count = Number($('[data-count]').value) || 12;
      body.frequency = $('[data-freq]').value;
      body.interest_rate = Number($('[data-interest]').value) || 0;
      body.first_due_date = $('[data-first]').value || '';
    } else {
      body.paid = Number($('[data-paid]').value) || 0;
    }
    const btn = $('[data-submit]'); btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>`;
    try {
      const r = await api('/sales', { method: 'POST', body });
      uiToast(t('saved') + ' — ' + r.invoice_no);
      const d = await api(`/sales/${r.id}`);
      showInvoice(d.item);
      items = []; renderItems();
      vehicles = (await api('/vehicles?status=available&limit=300')).items || [];
    } catch (e) { uiToast(e.message, 'error'); }
    btn.disabled = false; btn.innerHTML = `${icon('check', 'sm')} ${t('save')} ${t('new_sale')}`;
  };

  renderItems(); calc();
}

export function showInvoice(s) {
  const lines = (s.items || []).map((it) => `<tr><td>${esc(it.vehicle_code || it.description || '')}</td><td class="muted">${esc([it.brand_name, it.model_name, it.year].filter(Boolean).join(' '))}</td><td class="num">${money(it.price, false)}</td></tr>`).join('');
  const html = `
    <div class="invoice-print">
      <div class="inv-head">
        <div><h2>${esc(state.settings.company_name || t('app_name'))}</h2><div class="muted">${esc(state.settings.address || '')} ${state.settings.phone ? '• ' + esc(state.settings.phone) : ''}</div></div>
        <div style="text-align:end"><div class="badge badge-brand">${esc(s.invoice_no)}</div><div class="muted">${esc(s.date)}</div></div>
      </div>
      <div class="inv-parties">
        <div><span class="k">${t('customer')}</span><b>${esc(s.customer_name || t('cash_customer'))}</b>${s.customer_phone ? `<div class="muted">${esc(s.customer_phone)}</div>` : ''}</div>
        <div><span class="k">${t('sale_type')}</span><b>${esc(t(s.sale_type))}</b></div>
      </div>
      <table class="data"><thead><tr><th>${t('code')}</th><th>${t('vehicle_details')}</th><th class="num">${t('sale_price_label')}</th></tr></thead><tbody>${lines}</tbody></table>
      <div class="inv-totals">
        <div class="trow"><span>${t('total')}</span><b>${money(s.subtotal)}</b></div>
        ${Number(s.discount) ? `<div class="trow"><span>${t('discount')}</span><b>${money(s.discount)}</b></div>` : ''}
        ${Number(s.tax) ? `<div class="trow"><span>${t('tax')}</span><b>${money(s.tax)}</b></div>` : ''}
        <div class="trow big"><span>${t('invoice_total')}</span><b>${money(s.total)}</b></div>
        <div class="trow"><span>${t('paid')}</span><b>${money(s.paid)}</b></div>
        <div class="trow"><span>${t('remaining')}</span><b>${money(s.remaining)}</b></div>
      </div>
      ${s.installments ? `<h4>${t('installment_schedule')}</h4><table class="data"><thead><tr><th>${t('seq')}</th><th>${t('due_date')}</th><th class="num">${t('amount')}</th><th>${t('status')}</th></tr></thead><tbody>${s.installments.map((i) => `<tr><td>${i.seq}</td><td>${esc(i.due_date)}</td><td class="num">${money(i.amount, false)}</td><td>${t(i.status)}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="inv-foot">${esc(state.settings.invoice_footer || '')}</div>
    </div>`;
  const m = modal({
    title: `${t('print_invoice')} — ${esc(s.invoice_no)}`, size: 'modal-lg', body: html,
    footer: `<button class="btn btn-ghost" data-x>${t('close')}</button><button class="btn btn-primary" data-print>${icon('print', 'sm')} ${t('print')}</button>`,
  });
  m.node.querySelector('[data-x]').onclick = m.close;
  m.node.querySelector('[data-print]').onclick = () => import('../core.js').then((c) => c.printHtml(html, s.invoice_no));
}
