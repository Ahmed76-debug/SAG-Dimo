/* ============================================================
   Auto Car — السيارات: المخزون + التفاصيل + الصور + المصروفات
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, fmtDate, state, pick, can, todayStr } from '../core.js';
import { modal, toast, confirmDialog, renderTable, statusBadge, emptyState, dropdown } from '../ui.js';
import { exportEntity } from '../core.js';

export async function render(container) {
  let page = 1, filters = {};
  container.innerHTML = `
    <div class="toolbar mb-2">
      <div class="search-box grow" style="max-width:300px">${icon('search')}<input class="input" data-q placeholder="${t('search')}"></div>
      <select class="select" data-f="status" style="max-width:150px"><option value="">${t('status')}</option>${['available', 'reserved', 'sold', 'returned'].map((s) => `<option value="${s}">${t(s)}</option>`).join('')}</select>
      <select class="select" data-f="condition" style="max-width:140px"><option value="">${t('condition')}</option><option value="new">${t('new_car')}</option><option value="used">${t('used_car')}</option></select>
      <select class="select" data-f="ownership" style="max-width:160px"><option value="">${t('ownership')}</option><option value="own">${t('own')}</option><option value="consignment">${t('consignment_own')}</option></select>
      <select class="select" data-f="brand_id" style="max-width:160px"><option value="">${t('brand')}</option>${(state.meta.brands || []).map((b) => `<option value="${b.id}">${esc(pick(b))}</option>`).join('')}</select>
      <div class="grow"></div>
      <button class="btn btn-ghost" data-export>${icon('sheet', 'sm')} ${t('export_excel')}</button>
      ${can('vehicles.manage') ? `<button class="btn btn-primary" data-add>${icon('plus', 'sm')} ${t('add_vehicle')}</button>` : ''}
    </div>
    <div data-stats class="grid cols-4 mb-2"></div>
    <div data-table></div>`;

  async function loadStats() {
    const s = await api('/vehicles/stats');
    const box = container.querySelector('[data-stats]');
    const c = (st) => (s.by_status.find((x) => x.status === st) || {}).c || 0;
    box.innerHTML = `
      <div class="stat"><div class="stat-icon tone-brand">${icon('car', 'lg')}</div><div><div class="stat-label">${t('kpi_available')}</div><div class="stat-val">${fmtNum(c('available'), 0)}</div></div></div>
      <div class="stat"><div class="stat-icon tone-info">${icon('clock', 'lg')}</div><div><div class="stat-label">${t('reserved')}</div><div class="stat-val">${fmtNum(c('reserved'), 0)}</div></div></div>
      <div class="stat"><div class="stat-icon tone-success">${icon('check-circle', 'lg')}</div><div><div class="stat-label">${t('sold')}</div><div class="stat-val">${fmtNum(c('sold'), 0)}</div></div></div>
      <div class="stat"><div class="stat-icon tone-warn">${icon('wallet', 'lg')}</div><div><div class="stat-label">${t('kpi_inventory_value')}</div><div class="stat-val">${money(s.inventory_value)}</div></div></div>`;
  }

  async function load() {
    const tbl = container.querySelector('[data-table]');
    tbl.innerHTML = `<div class="empty"><span class="spinner"></span></div>`;
    const p = new URLSearchParams({ page, limit: 50 });
    const q = container.querySelector('[data-q]').value.trim(); if (q) p.set('q', q);
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    const d = await api('/vehicles?' + p);
    const cols = [
      { key: 'code', label: t('code'), render: (r) => `<div class="row" style="gap:10px">${r.images && r.images !== '[]' ? `<img class="thumb" src="${esc(JSON.parse(r.images)[0])}">` : `<span class="thumb-ph">${icon('car', 'sm')}</span>`}<div><b>${esc(r.code)}</b><div class="small muted">${esc(r.vin || r.chassis_no || '')}</div></div></div>` },
      { key: 'brand_name', label: t('brand'), render: (r) => `${esc(r.brand_name || '—')} ${r.model_name ? `<div class="small muted">${esc(r.model_name)}</div>` : ''}` },
      { key: 'year', label: t('year'), render: (r) => esc(r.year || '—') },
      { key: 'color', label: t('color'), render: (r) => r.color_name ? `<span class="row" style="gap:6px"><span style="width:14px;height:14px;border-radius:4px;background:${esc(r.color_hex || '#ccc')};border:1px solid var(--border)"></span>${esc(r.color_name)}</span>` : '—' },
      { key: 'condition', label: t('condition'), render: (r) => statusBadge(r.condition) },
      { key: 'ownership', label: t('ownership'), render: (r) => statusBadge(r.ownership) },
      { key: 'cost_price', label: t('cost_price'), align: 'end', render: (r) => money(r.cost_price) },
      { key: 'target_price', label: t('target_price'), align: 'end', render: (r) => `<b>${money(r.target_price)}</b>` },
      { key: 'status', label: t('status'), render: (r) => statusBadge(r.status) },
    ];
    const pages = Math.max(1, Math.ceil((d.total || 0) / 50));
    tbl.innerHTML = renderTable({ columns: cols, rows: d.items, empty: t('no_data'), onRowClick: true }) +
      `<div class="pagination"><button class="btn btn-ghost btn-sm" data-prev ${page <= 1 ? 'disabled' : ''}>${icon('chevron-right', 'sm')} ${t('prev')}</button><span class="small muted">${t('page')} ${page} ${t('of')} ${pages} — ${fmtNum(d.total, 0)} ${t('rows')}</span><button class="btn btn-ghost btn-sm" data-next ${page >= pages ? 'disabled' : ''}>${t('next')} ${icon('chevron-left', 'sm')}</button></div>`;
    tbl.querySelector('[data-prev]').onclick = () => { page--; load(); };
    tbl.querySelector('[data-next]').onclick = () => { page++; load(); };
    tbl.querySelectorAll('tbody tr').forEach((tr) => tr.onclick = () => openDetail(Number(tr.dataset.id)));
  }

  container.querySelectorAll('[data-f]').forEach((s) => s.onchange = () => { filters[s.dataset.f] = s.value; page = 1; load(); });
  container.querySelector('[data-q]').oninput = () => { clearTimeout(container._h); container._h = setTimeout(() => { page = 1; load(); }, 300); };
  container.querySelector('[data-export]').onclick = () => exportEntity('vehicles');
  const addBtn = container.querySelector('[data-add]'); if (addBtn) addBtn.onclick = () => openForm(null);

  loadStats(); load();

  /* ====================== تفاصيل السيارة ====================== */
  async function openDetail(id) {
    const d = await api(`/vehicles/${id}`);
    const v = d.item;
    const m = modal({
      title: `${v.code} — ${esc([v.brand_name, v.model_name].filter(Boolean).join(' '))}`,
      size: 'modal-lg',
      body: `<div data-detail></div>`,
      footer: `${can('vehicles.manage') ? `<button class="btn btn-ghost" data-edit>${icon('edit', 'sm')} ${t('edit')}</button>` : ''}
        ${v.status !== 'sold' && can('sales.manage') ? `<button class="btn btn-primary" data-sell>${icon('cart', 'sm')} ${t('sell_vehicle')}</button>` : ''}
        <button class="btn btn-ghost" data-close>${t('close')}</button>`,
    });
    const box = m.node.querySelector('[data-detail]');
    const detailRows = [
      [t('vin'), v.vin], [t('chassis_no'), v.chassis_no], [t('engine_no'), v.engine_no], [t('plate_no'), v.plate_no],
      [t('year'), v.year], [t('condition'), t(v.condition)], [t('mileage'), v.mileage ? fmtNum(v.mileage, 0) + ' كم' : '—'],
      [t('transmission'), v.transmission ? t(v.transmission) : '—'], [t('fuel'), v.fuel ? t(v.fuel) : '—'],
      [t('color'), v.color_name], [t('type'), v.type_name], [t('origin'), v.origin],
      [t('ownership'), t(v.ownership === 'own' ? 'own' : 'consignment_own')], [t('supplier'), v.supplier_name],
      [t('cost_price'), money(v.cost_price)], [t('extra_cost'), money(v.extra_cost)], [t('target_price'), money(v.target_price)],
      [t('sale_price'), v.sale_price ? money(v.sale_price) : '—'], [t('entry_date'), fmtDate(v.entry_date)],
      [t('license_expiry'), fmtDate(v.license_expiry)], [t('insurance_expiry'), fmtDate(v.insurance_expiry)],
      [t('location'), v.location], [t('status'), t(v.status)],
    ];
    box.innerHTML = `
      <div class="vehicle-hero">
        <div class="vehicle-gallery" data-gallery>
          ${(v.images || []).length ? v.images.map((src) => `<div class="vg-item"><img src="${esc(src)}" data-img="${esc(src)}">${can('vehicles.manage') ? `<button class="vg-del" data-del-img="${esc(src)}">${icon('x', 'sm')}</button>` : ''}</div>`).join('') : `<div class="vg-empty">${icon('image', 'lg')}<span>${t('no_data')}</span></div>`}
          ${can('vehicles.manage') ? `<button class="vg-add" data-add-img>${icon('camera', 'lg')}<span>${t('add_photo')}</span></button>` : ''}
        </div>
        <div class="vehicle-info">
          <div class="row between"><h3 style="margin:0">${esc(v.code)}</h3>${statusBadge(v.status)}</div>
          <div class="muted">${esc([v.brand_name, v.model_name, v.year].filter(Boolean).join(' • '))}</div>
          <div class="vprice">${money(v.target_price)}</div>
          <div class="detail-list two">
            ${detailRows.map(([k, val]) => `<div class="di"><span class="k">${esc(k)}</span><span class="v">${val === '' || val === null || val === undefined ? '—' : (typeof val === 'string' ? esc(val) : val)}</span></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="divider"></div>
      <div class="row between mb-1"><b>${icon('wallet', 'sm')} ${t('vehicle_expenses')}</b>${can('vehicles.manage') ? `<button class="btn btn-soft btn-sm" data-add-exp>${icon('plus', 'sm')} ${t('add_expense')}</button>` : ''}</div>
      <div data-expenses></div>`;
    const expBox = box.querySelector('[data-expenses]');
    function renderExpenses() {
      expBox.innerHTML = (v.expenses && v.expenses.length) ? `<div class="table-wrap"><table class="data"><thead><tr><th>${t('date')}</th><th>${t('expense_kind')}</th><th>${t('description')}</th><th class="num">${t('amount')}</th><th></th></tr></thead>
        <tbody>${v.expenses.map((e) => `<tr><td>${esc(fmtDate(e.date))}</td><td>${esc(e.kind || '')}</td><td class="muted">${esc(e.description || '')}</td><td class="num">${money(e.amount)}</td><td class="num">${can('vehicles.manage') ? `<button class="btn btn-ghost btn-icon btn-sm" data-del-exp="${e.id}">${icon('trash', 'sm')}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="empty" style="padding:20px">${icon('wallet', 'lg')}<h4>${t('no_data')}</h4></div>`;
      expBox.querySelectorAll('[data-del-exp]').forEach((b) => b.onclick = async () => {
        await api(`/vehicles/${id}/expenses/${b.dataset.delExp}`, { method: 'DELETE' });
        toast(t('msg_deleted')); const nd = await api(`/vehicles/${id}`); v.expenses = nd.item.expenses; renderExpenses();
      });
    }
    renderExpenses();
    box.querySelectorAll('[data-del-img]').forEach((b) => b.onclick = async () => {
      await api(`/vehicles/${id}/images?path=${encodeURIComponent(b.dataset.delImg)}`, { method: 'DELETE' });
      openDetailClose(); openDetail(id);
    });
    const addImg = box.querySelector('[data-add-img]'); if (addImg) addImg.onclick = () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        const buf = await f.arrayBuffer();
        await api(`/vehicles/${id}/images`, { method: 'POST', raw: buf, headers: { 'Content-Type': f.type || 'image/jpeg' }, filename: f.name });
        toast(t('saved')); m.close(); openDetail(id);
      };
      inp.click();
    };
    box.querySelectorAll('[data-img]').forEach((im) => im.onclick = () => window.open(im.dataset.img, '_blank'));
    const addExp = box.querySelector('[data-add-exp]'); if (addExp) addExp.onclick = () => expenseModal(id, () => { m.close(); openDetail(id); });
    function openDetailClose() { m.close(); }
    const ed = m.node.querySelector('[data-edit]'); if (ed) ed.onclick = () => { m.close(); openForm(v); };
    const sl = m.node.querySelector('[data-sell]'); if (sl) sl.onclick = () => { sessionStorage.setItem('ac_sell_vehicle', String(id)); location.hash = '#/v/sale-new'; m.close(); };
    m.node.querySelector('[data-close]').onclick = m.close;
  }

  function expenseModal(id, done) {
    const m = modal({
      title: t('add_expense'),
      body: `<div class="form-grid">
        <div class="field"><label>${t('expense_kind')}</label><input class="input" name="kind" value="تجهيز" list="exp-kinds">
          <datalist id="exp-kinds"><option value="تجهيز"><option value="صيانة"><option value="ترخيص"><option value="تأمين"><option value="نقل"><option value="سمكرة ودهان"><option value="أخرى"></datalist></div>
        <div class="field"><label>${t('amount')} <span class="req">*</span></label><input class="input" type="number" step="any" name="amount"></div>
        <div class="field"><label>${t('date')}</label><input class="input" type="date" name="date" value="${todayStr()}"></div>
        <div class="field"><label>${t('treasury')}</label><select class="select" name="treasury_id"><option value="">— ${t('select')} —</option>${(state.meta.treasuries || []).map((tr) => `<option value="${tr.id}">${esc(pick(tr))}</option>`).join('')}</select></div>
        <div class="field full"><label>${t('description')}</label><input class="input" name="description"></div>
      </div>`,
      footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-save>${icon('save', 'sm')} ${t('save')}</button>`,
    });
    m.node.querySelector('[data-x]').onclick = m.close;
    m.node.querySelector('[data-save]').onclick = async () => {
      const g = (n) => m.node.querySelector(`[name=${n}]`).value;
      if (!Number(g('amount'))) return toast(t('amount') + ' ' + t('required'), 'warn');
      try { await api(`/vehicles/${id}/expenses`, { method: 'POST', body: { kind: g('kind'), amount: Number(g('amount')), date: g('date'), treasury_id: g('treasury_id') || null, description: g('description') } }); toast(t('msg_added')); m.close(); done(); }
      catch (e) { toast(e.message, 'error'); }
    };
  }

  /* ====================== نموذج إضافة/تعديل ====================== */
  function openForm(v) {
    const isEdit = !!v; const d = v || { condition: 'used', ownership: 'own', year: new Date().getFullYear(), currency_id: (state.currencies.find((c) => c.is_base) || {}).id, entry_date: todayStr() };
    const sel = (key, list, val, labelKey = 'name') => `<select class="select" name="${key}"><option value="">— ${t('select')} —</option>${(list || []).map((o) => `<option value="${o.id}" ${String(o.id) === String(val) ? 'selected' : ''}>${esc(o[labelKey + '_en'] && state.lang === 'en' ? o[labelKey + '_en'] : o[labelKey])}</option>`).join('')}</select>`;
    const models = (state.meta.models || []).filter((mm) => !d.brand_id || mm.brand_id == d.brand_id);
    const m = modal({
      title: isEdit ? `${t('edit')} — ${esc(v.code)}` : t('add_vehicle'),
      size: 'modal-lg',
      body: `
        <div class="form-section"><h4>${icon('info', 'sm')} ${t('vehicle_details')}</h4>
        <div class="form-grid">
          <div class="field"><label>${t('code')}</label><input class="input" name="code" value="${esc(d.code || '')}" placeholder="تلقائي"></div>
          <div class="field"><label>${t('vin')}</label><input class="input" name="vin" value="${esc(d.vin || '')}"></div>
          <div class="field"><label>${t('chassis_no')}</label><input class="input" name="chassis_no" value="${esc(d.chassis_no || '')}"></div>
          <div class="field"><label>${t('engine_no')}</label><input class="input" name="engine_no" value="${esc(d.engine_no || '')}"></div>
          <div class="field"><label>${t('plate_no')}</label><input class="input" name="plate_no" value="${esc(d.plate_no || '')}"></div>
          <div class="field"><label>${t('brand')}</label>${sel('brand_id', state.meta.brands, d.brand_id)}</div>
          <div class="field"><label>${t('model')}</label><select class="select" name="model_id" data-models><option value="">— ${t('select')} —</option>${models.map((o) => `<option value="${o.id}" ${String(o.id) === String(d.model_id) ? 'selected' : ''}>${esc(pick(o))}</option>`).join('')}</select></div>
          <div class="field"><label>${t('type')}</label>${sel('type_id', state.meta.car_types, d.type_id)}</div>
          <div class="field"><label>${t('color')}</label>${sel('color_id', state.meta.colors, d.color_id)}</div>
          <div class="field"><label>${t('year')}</label><input class="input" type="number" name="year" value="${d.year || ''}"></div>
          <div class="field"><label>${t('condition')}</label><select class="select" name="condition"><option value="new" ${d.condition === 'new' ? 'selected' : ''}>${t('new_car')}</option><option value="used" ${d.condition !== 'new' ? 'selected' : ''}>${t('used_car')}</option></select></div>
          <div class="field"><label>${t('mileage')}</label><input class="input" type="number" name="mileage" value="${d.mileage || 0}"></div>
          <div class="field"><label>${t('transmission')}</label><select class="select" name="transmission"><option value="">—</option><option value="automatic" ${d.transmission === 'automatic' ? 'selected' : ''}>${t('automatic')}</option><option value="manual" ${d.transmission === 'manual' ? 'selected' : ''}>${t('manual')}</option></select></div>
          <div class="field"><label>${t('fuel')}</label><select class="select" name="fuel"><option value="">—</option>${['petrol', 'diesel', 'hybrid', 'electric'].map((f) => `<option value="${f}" ${d.fuel === f ? 'selected' : ''}>${t(f)}</option>`).join('')}</select></div>
          <div class="field"><label>${t('doors')}</label><input class="input" type="number" name="doors" value="${d.doors || ''}"></div>
          <div class="field"><label>${t('seats')}</label><input class="input" type="number" name="seats" value="${d.seats || ''}"></div>
          <div class="field"><label>${t('cylinders')}</label><input class="input" type="number" name="cylinders" value="${d.cylinders || ''}"></div>
          <div class="field"><label>${t('horsepower')}</label><input class="input" type="number" name="horsepower" value="${d.horsepower || ''}"></div>
          <div class="field"><label>${t('origin')}</label><input class="input" name="origin" value="${esc(d.origin || '')}"></div>
        </div></div>

        <div class="form-section"><h4>${icon('wallet', 'sm')} ${t('ownership')} / ${t('cost_price')}</h4>
        <div class="form-grid">
          <div class="field"><label>${t('ownership')}</label><select class="select" name="ownership" data-own><option value="own" ${d.ownership !== 'consignment' ? 'selected' : ''}>${t('own')}</option><option value="consignment" ${d.ownership === 'consignment' ? 'selected' : ''}>${t('consignment_own')}</option></select></div>
          <div class="field"><label>${t('supplier')}</label>${sel('supplier_id', state.meta.suppliers, d.supplier_id)}</div>
          <div class="field" data-own-field><label>${t('cost_price')}</label><input class="input" type="number" step="any" name="cost_price" value="${d.cost_price ?? ''}"></div>
          <div class="field" data-cons-field><label>${t('owner_name')}</label><input class="input" name="owner_name" value="${esc(d.owner_name || '')}"></div>
          <div class="field" data-cons-field><label>${t('owner_phone')}</label><input class="input" name="owner_phone" value="${esc(d.owner_phone || '')}"></div>
          <div class="field" data-cons-field><label>${t('commission_type')}</label><select class="select" name="commission_type"><option value="percent" ${d.commission_type !== 'fixed' ? 'selected' : ''}>${t('commission_percent')}</option><option value="fixed" ${d.commission_type === 'fixed' ? 'selected' : ''}>${t('commission_fixed')}</option></select></div>
          <div class="field" data-cons-field><label>${t('commission_value')}</label><input class="input" type="number" step="any" name="commission_value" value="${d.commission_value ?? ''}"></div>
          <div class="field"><label>${t('min_price')}</label><input class="input" type="number" step="any" name="min_price" value="${d.min_price ?? ''}"></div>
          <div class="field"><label>${t('target_price')}</label><input class="input" type="number" step="any" name="target_price" value="${d.target_price ?? ''}"></div>
          <div class="field"><label>${t('currency')}</label><select class="select" name="currency_id">${(state.currencies || []).map((c) => `<option value="${c.id}" ${String(c.id) === String(d.currency_id) ? 'selected' : ''}>${esc(c.code)}</option>`).join('')}</select></div>
        </div></div>

        <div class="form-section"><h4>${icon('calendar', 'sm')} ${t('date')} / ${t('location')}</h4>
        <div class="form-grid">
          <div class="field"><label>${t('entry_date')}</label><input class="input" type="date" name="entry_date" value="${esc(d.entry_date || todayStr())}"></div>
          <div class="field"><label>${t('purchase_date') || t('date')}</label><input class="input" type="date" name="purchase_date" value="${esc(d.purchase_date || '')}"></div>
          <div class="field"><label>${t('license_expiry')}</label><input class="input" type="date" name="license_expiry" value="${esc(d.license_expiry || '')}"></div>
          <div class="field"><label>${t('insurance_expiry')}</label><input class="input" type="date" name="insurance_expiry" value="${esc(d.insurance_expiry || '')}"></div>
          <div class="field"><label>${t('location')}</label><input class="input" name="location" value="${esc(d.location || '')}"></div>
          <div class="field"><label class="check" style="margin-top:6px"><input type="checkbox" name="active" ${d.active === 0 ? '' : 'checked'}> ${t('active')}</label></div>
        </div>
        ${!isEdit ? `<label class="check mt-1"><input type="checkbox" name="post_opening"> ${t('post_opening')}</label>` : ''}
        <div class="field full mt-1"><label>${t('notes')}</label><textarea class="textarea" name="notes">${esc(d.notes || '')}</textarea></div>
        </div>`,
      footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-save>${icon('save', 'sm')} ${t('save')}</button>`,
    });
    const ownSel = m.node.querySelector('[data-own]');
    function toggleOwn() {
      const cons = ownSel.value === 'consignment';
      m.node.querySelectorAll('[data-cons-field]').forEach((f) => f.style.display = cons ? '' : 'none');
      m.node.querySelectorAll('[data-own-field]').forEach((f) => f.style.display = cons ? 'none' : '');
    }
    ownSel.onchange = toggleOwn; toggleOwn();
    const brandSel = m.node.querySelector('[name=brand_id]');
    brandSel.onchange = () => {
      const list = (state.meta.models || []).filter((mm) => mm.brand_id == brandSel.value);
      m.node.querySelector('[data-models]').innerHTML = `<option value="">— ${t('select')} —</option>` + list.map((o) => `<option value="${o.id}">${esc(pick(o))}</option>`).join('');
    };
    m.node.querySelector('[data-x]').onclick = m.close;
    m.node.querySelector('[data-save]').onclick = async () => {
      const F = ['code', 'vin', 'chassis_no', 'engine_no', 'plate_no', 'brand_id', 'model_id', 'type_id', 'color_id', 'year', 'condition', 'mileage', 'transmission', 'fuel', 'doors', 'seats', 'cylinders', 'horsepower', 'origin', 'ownership', 'owner_name', 'owner_phone', 'commission_type', 'commission_value', 'min_price', 'cost_price', 'target_price', 'currency_id', 'supplier_id', 'purchase_date', 'entry_date', 'license_expiry', 'insurance_expiry', 'location', 'notes'];
      const payload = {};
      for (const f of F) { const n = m.node.querySelector(`[name=${f}]`); if (n && n.value !== '') payload[f] = n.value; }
      const act = m.node.querySelector('[name=active]'); payload.active = act.checked ? 1 : 0;
      const po = m.node.querySelector('[name=post_opening]'); if (po) payload.post_opening = po.checked ? 1 : 0;
      try {
        const r = await api(isEdit ? `/vehicles/${v.id}` : '/vehicles', { method: isEdit ? 'PUT' : 'POST', body: payload });
        toast(isEdit ? t('msg_updated') : t('msg_added')); m.close(); loadStats(); load();
      } catch (e) { toast(e.message, 'error'); }
    };
  }
}
