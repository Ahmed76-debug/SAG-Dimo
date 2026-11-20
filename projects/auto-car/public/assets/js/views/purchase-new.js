/* ============================================================
   Auto Car — فاتورة شراء جديدة (إدخال سيارات للمخزون)
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, state, pick, todayStr, can } from '../core.js';
import { modal, toast, statusBadge } from '../ui.js';

export async function render(container) {
  if (!can('purchases.manage')) { container.innerHTML = `<div class="empty">${icon('shield', 'lg')}<h4>${t('no_permission')}</h4></div>`; return; }
  let existing = [];
  try { existing = (await api('/vehicles?limit=300')).items || []; } catch {}
  const suppliers = state.meta.suppliers || [];
  const treasuries = state.meta.treasuries || [];
  let items = [];

  container.innerHTML = `
    <div class="sale-grid">
      <div class="sale-main">
        <div class="card card-pad mb-2"><div class="form-grid">
          <div class="field"><label>${t('supplier')}</label><select class="select" data-supplier><option value="">— ${t('select')} —</option>${suppliers.map((s) => `<option value="${s.id}">${esc(pick(s))}${s.phone ? ' — ' + esc(s.phone) : ''}</option>`).join('')}</select></div>
          <div class="field"><label>${t('date')}</label><input class="input" type="date" data-date value="${todayStr()}"></div>
          <div class="field"><label>${t('payment_method')}</label><select class="select" data-method"><option value="cash">${t('cash')}</option><option value="bank">${t('transfer')}</option><option value="credit">${t('credit')}</option></select></div>
          <div class="field"><label>${t('treasury')}</label><select class="select" data-treasury><option value="">— ${t('select')} —</option>${treasuries.map((tr) => `<option value="${tr.id}">${esc(pick(tr))}</option>`).join('')}</select></div>
        </div></div>

        <div class="card">
          <div class="card-head"><h3>${icon('car', 'sm')} ${t('vehicles')}</h3><div class="spacer"></div>
            <button class="btn btn-primary btn-sm" data-add-new>${icon('plus', 'sm')} ${t('add_vehicle')}</button></div>
          <div data-items></div>
        </div>
      </div>

      <div class="sale-side">
        <div class="card card-pad">
          <div class="card-head" style="padding:0 0 12px;border:none"><h3>${icon('receipt', 'sm')} ${t('invoice_total')}</h3></div>
          <div class="totals">
            <div class="trow"><span>${t('total')}</span><b data-sub>0</b></div>
            <div class="trow"><span>${t('discount')}</span><input class="input sm" type="number" step="any" data-discount value="0"></div>
            <div class="trow big"><span>${t('invoice_total')}</span><b data-total>0</b></div>
            <div class="trow"><span>${t('paid')}</span><input class="input sm" type="number" step="any" data-paid value="0"></div>
            <div class="trow"><span>${t('remaining')}</span><b data-rem>0</b></div>
          </div>
          <div class="field mt-2"><label>${t('notes')}</label><textarea class="textarea" data-note rows="2"></textarea></div>
          <button class="btn btn-primary btn-block btn-lg mt-2" data-submit>${icon('check', 'sm')} ${t('save')} ${t('new_purchase')}</button>
        </div>
      </div>
    </div>`;

  const $ = (s) => container.querySelector(s);
  function calc() {
    const sub = items.reduce((s, i) => s + (Number(i.price) || 0), 0);
    const disc = Number($('[data-discount]').value) || 0;
    const total = Math.max(0, sub - disc);
    const method = $('[data-method]').value;
    let paid = Number($('[data-paid]').value) || 0;
    if (method === 'credit') { paid = 0; $('[data-paid]').value = 0; $('[data-paid]').disabled = true; } else $('[data-paid]').disabled = false;
    if (!paid) paid = total;
    $('[data-sub]').textContent = money(sub);
    $('[data-total]').textContent = money(total);
    $('[data-rem]').textContent = money(Math.max(0, total - paid));
  }
  function renderItems() {
    const box = $('[data-items]');
    if (!items.length) { box.innerHTML = `<div class="empty" style="padding:34px">${icon('car', 'lg')}<h4>${t('add_vehicle')}</h4></div>`; calc(); return; }
    box.innerHTML = `<div class="table-wrap"><table class="data"><thead><tr><th>${t('vehicles')}</th><th>${t('condition')}</th><th>${t('year')}</th><th class="num">${t('cost_price')}</th><th></th></tr></thead>
      <tbody>${items.map((i, idx) => `<tr><td><b>${esc(i.vehicle.code || i.vehicle.brand_name || '—')}</b><div class="small muted">${esc(i.vehicle.brand_name || '')} ${esc(i.vehicle.model_name || '')}</div></td>
        <td>${statusBadge(i.vehicle.condition || 'used')}</td><td>${esc(i.vehicle.year || '—')}</td>
        <td class="num"><input class="input sm" type="number" step="any" data-price="${idx}" value="${i.price}" style="max-width:140px;text-align:end"></td>
        <td class="num"><button class="btn btn-ghost btn-icon btn-sm" data-rm="${idx}">${icon('x', 'sm')}</button></td></tr>`).join('')}</tbody></table></div>`;
    box.querySelectorAll('[data-price]').forEach((inp) => inp.onchange = () => { items[Number(inp.dataset.price)].price = Number(inp.value) || 0; calc(); });
    box.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { items.splice(Number(b.dataset.rm), 1); renderItems(); });
    calc();
  }
  $('[data-discount]').oninput = calc; $('[data-paid]').oninput = calc; $('[data-method]').onchange = calc;

  $('[data-add-new]').onclick = () => {
    const brands = state.meta.brands || [], models = state.meta.models || [], colors = state.meta.colors || [], types = state.meta.car_types || [];
    const m = modal({
      title: t('add_vehicle'), size: 'modal-lg',
      body: `<div class="form-grid">
        <div class="field"><label>${t('brand')}</label><select class="select" name="brand_id"><option value="">—</option>${brands.map((b) => `<option value="${b.id}">${esc(pick(b))}</option>`).join('')}</select></div>
        <div class="field"><label>${t('model')}</label><select class="select" name="model_id" data-models><option value="">—</option>${models.map((o) => `<option value="${o.id}" data-brand="${o.brand_id}">${esc(pick(o))}</option>`).join('')}</select></div>
        <div class="field"><label>${t('type')}</label><select class="select" name="type_id"><option value="">—</option>${types.map((x) => `<option value="${x.id}">${esc(pick(x))}</option>`).join('')}</select></div>
        <div class="field"><label>${t('color')}</label><select class="select" name="color_id"><option value="">—</option>${colors.map((c) => `<option value="${c.id}">${esc(pick(c))}</option>`).join('')}</select></div>
        <div class="field"><label>${t('year')}</label><input class="input" type="number" name="year" value="${new Date().getFullYear()}"></div>
        <div class="field"><label>${t('condition')}</label><select class="select" name="condition"><option value="used">${t('used_car')}</option><option value="new">${t('new_car')}</option></select></div>
        <div class="field"><label>${t('vin')}</label><input class="input" name="vin"></div>
        <div class="field"><label>${t('chassis_no')}</label><input class="input" name="chassis_no"></div>
        <div class="field"><label>${t('mileage')}</label><input class="input" type="number" name="mileage" value="0"></div>
        <div class="field"><label>${t('cost_price')} <span class="req">*</span></label><input class="input" type="number" step="any" name="cost_price"></div>
        <div class="field"><label>${t('target_price')}</label><input class="input" type="number" step="any" name="target_price"></div>
      </div>`,
      footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-ok>${icon('plus', 'sm')} ${t('add')}</button>`,
    });
    const bs = m.node.querySelector('[name=brand_id]');
    bs.onchange = () => m.node.querySelectorAll('[data-models] option').forEach((o) => { o.hidden = o.dataset.brand && o.dataset.brand !== bs.value; });
    m.node.querySelector('[data-x]').onclick = m.close;
    m.node.querySelector('[data-ok]').onclick = () => {
      const g = (n) => m.node.querySelector(`[name=${n}]`).value;
      const price = Number(g('cost_price')) || 0;
      if (!price) return toast(t('cost_price') + ' ' + t('required'), 'warn');
      const brand = (state.meta.brands || []).find((b) => b.id == g('brand_id'));
      const model = (state.meta.models || []).find((x) => x.id == g('model_id'));
      items.push({ price, vehicle: { brand_id: g('brand_id') || null, model_id: g('model_id') || null, type_id: g('type_id') || null, color_id: g('color_id') || null, year: Number(g('year')) || null, condition: g('condition'), vin: g('vin'), chassis_no: g('chassis_no'), mileage: Number(g('mileage')) || 0, cost_price: price, target_price: Number(g('target_price')) || Math.round(price * 1.12), brand_name: brand ? pick(brand) : '', model_name: model ? pick(model) : '', ownership: 'own' } });
      m.close(); renderItems();
    };
  };

  $('[data-submit]').onclick = async () => {
    if (!items.length) return toast(t('add_vehicle'), 'warn');
    const body = {
      supplier_id: $('[data-supplier]').value || null, date: $('[data-date]').value,
      payment_method: $('[data-method]').value, treasury_id: $('[data-treasury]').value || null,
      discount: Number($('[data-discount]').value) || 0, paid: Number($('[data-paid]').value) || 0,
      note: $('[data-note]').value,
      items: items.map((i) => ({ price: i.price, vehicle: i.vehicle })),
    };
    const btn = $('[data-submit]'); btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>`;
    try { const r = await api('/purchases', { method: 'POST', body }); toast(t('saved') + ' — ' + r.invoice_no); items = []; renderItems(); }
    catch (e) { toast(e.message, 'error'); }
    btn.disabled = false; btn.innerHTML = `${icon('check', 'sm')} ${t('save')} ${t('new_purchase')}`;
  };
  renderItems();
}
