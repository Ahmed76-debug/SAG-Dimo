/* ============================================================
   Auto Car — العملات وأسعار الصرف
   ============================================================ */
import { t, esc, icon, api, money, fmtNum, fmtDate, state } from '../core.js';
import { modal, toast, confirmDialog, renderTable, emptyState } from '../ui.js';

export async function render(container) {
  container.innerHTML = `<div class="toolbar mb-2"><div class="grow"></div>
    <button class="btn btn-ghost" data-rates>${icon('trend', 'sm')} ${t('currencies')} — ${t('date')}</button>
    <button class="btn btn-primary" data-add>${icon('plus', 'sm')} ${t('add')}</button></div>
    <div data-table></div><div data-rates-box class="mt-2"></div>`;

  async function load() {
    const tbl = container.querySelector('[data-table]');
    const d = await api('/currencies');
    tbl.innerHTML = renderTable({
      columns: [
        { key: 'code', label: t('code'), render: (r) => `<b>${esc(r.code)}</b> ${r.is_base ? `<span class="badge badge-brand">${t('currency')}</span>` : ''}` },
        { key: 'name', label: t('name'), render: (r) => esc(state.lang === 'en' && r.name_en ? r.name_en : r.name) },
        { key: 'symbol', label: t('currency_symbol'), render: (r) => esc(r.symbol || '—') },
        { key: 'rate', label: t('currency'), align: 'end', render: (r) => r.is_base ? '1.00' : fmtNum(r.rate, 4) },
        { key: 'decimals', label: 'Decimals', align: 'end', render: (r) => fmtNum(r.decimals, 0) },
        { key: 'active', label: t('status'), render: (r) => r.active ? `<span class="badge badge-success">${t('active')}</span>` : `<span class="badge">${t('inactive')}</span>` },
      ],
      rows: d.items, empty: t('no_data'),
    }).replace('</table>', `<tfoot></tfoot></table>`);
    // أضف أعمدة الإجراءات يدويًا
    const table = tbl.querySelector('table');
    table.querySelectorAll('tbody tr').forEach((tr, i) => {
      const r = d.items[i];
      const td = document.createElement('td'); td.className = 'num';
      td.innerHTML = `<div class="row-actions">
        <button class="btn btn-ghost btn-icon btn-sm" data-edit="${r.id}">${icon('edit', 'sm')}</button>
        ${!r.is_base ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${r.id}">${icon('trash', 'sm')}</button>` : ''}</div>`;
      tr.appendChild(td);
    });
    table.querySelector('thead tr').insertAdjacentHTML('beforeend', `<th class="num">${t('actions')}</th>`);
    tbl.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openForm(d.items.find((x) => x.id == b.dataset.edit)));
    tbl.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      if (await confirmDialog(t('confirm_delete'))) { try { await api(`/currencies/${b.dataset.del}`, { method: 'DELETE' }); toast(t('msg_deleted')); load(); } catch (e) { toast(e.message, 'error'); } }
    });
  }

  function openForm(c) {
    const isEdit = !!c; const data = c || { decimals: 2, rate: 1 };
    const m = modal({
      title: isEdit ? `${t('edit')} — ${esc(data.code)}` : `${t('add')} ${t('currency')}`,
      body: `<div class="form-grid">
        <div class="field"><label>${t('code')} <span class="req">*</span></label><input class="input" name="code" value="${esc(data.code || '')}" ${isEdit ? 'disabled' : ''} placeholder="USD"></div>
        <div class="field"><label>${t('name')}</label><input class="input" name="name" value="${esc(data.name || '')}"></div>
        <div class="field"><label>${t('name_en')}</label><input class="input" name="name_en" value="${esc(data.name_en || '')}"></div>
        <div class="field"><label>${t('currency_symbol')}</label><input class="input" name="symbol" value="${esc(data.symbol || '')}"></div>
        <div class="field"><label>${t('currency')} (rate)</label><input class="input" type="number" step="any" name="rate" value="${data.rate ?? 1}" ${data.is_base ? 'disabled' : ''}></div>
        <div class="field"><label>Decimals</label><input class="input" type="number" name="decimals" value="${data.decimals ?? 2}"></div>
      </div>`,
      footer: `<button class="btn btn-ghost" data-x>${t('cancel')}</button><button class="btn btn-primary" data-save>${icon('save', 'sm')} ${t('save')}</button>`,
    });
    m.node.querySelector('[data-x]').onclick = m.close;
    m.node.querySelector('[data-save]').onclick = async () => {
      const g = (n) => m.node.querySelector(`[name=${n}]`).value;
      const payload = { code: g('code'), name: g('name'), name_en: g('name_en'), symbol: g('symbol'), rate: Number(g('rate')) || 1, decimals: Number(g('decimals')) || 2 };
      if (!payload.code) return toast(t('required'), 'warn');
      try { await api(isEdit ? `/currencies/${c.id}` : '/currencies', { method: isEdit ? 'PUT' : 'POST', body: payload }); toast(isEdit ? t('msg_updated') : t('msg_added')); m.close(); load(); }
      catch (e) { toast(e.message, 'error'); }
    };
  }

  container.querySelector('[data-add]').onclick = () => openForm(null);
  container.querySelector('[data-rates]').onclick = async () => {
    const box = container.querySelector('[data-rates-box]');
    const d = await api('/currencies/rates');
    box.innerHTML = `<div class="card"><div class="card-head"><h3>${icon('trend', 'sm')} ${t('currencies')} — ${t('date')}</h3></div>
      <div class="table-wrap"><table class="data"><thead><tr><th>${t('date')}</th><th>${t('code')}</th><th class="num">Rate</th><th>${t('notes')}</th></tr></thead>
      <tbody>${(d.items || []).map((r) => `<tr><td>${esc(fmtDate(r.date))}</td><td class="mono">${esc(r.code)}</td><td class="num">${fmtNum(r.rate, 4)}</td><td class="muted">${esc(r.note || '')}</td></tr>`).join('') || `<tr><td colspan="4" class="muted" style="text-align:center;padding:18px">${t('no_data')}</td></tr>`}</tbody></table></div></div>`;
  };
  load();
}
