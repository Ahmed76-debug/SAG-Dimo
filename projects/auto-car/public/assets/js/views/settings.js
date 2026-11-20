/* ============================================================
   Auto Car — الإعدادات العامة
   ============================================================ */
import { t, esc, icon, api, state, applyLang, can } from '../core.js';
import { toast, themeGallery, bindThemeGallery, confirmDialog } from '../ui.js';

const F = [
  { k: 'company_name', l: 'company_name' }, { k: 'company_name_en', l: 'name_en' },
  { k: 'phone', l: 'phone' }, { k: 'phone2', l: 'phone' }, { k: 'email', l: 'email' },
  { k: 'website', l: 'website' },
  { k: 'currency', l: 'currency' }, { k: 'currency_symbol', l: 'currency_symbol' },
  { k: 'tax_rate', l: 'tax_rate' }, { k: 'default_commission_percent', l: 'default_commission_percent' },
  { k: 'fiscal_year_start', l: 'fiscal_year_start' }, { k: 'installment_reminder_days', l: 'installment_reminder_days' },
  { k: 'doc_expiry_reminder_days', l: 'doc_expiry_reminder_days' },
];

/* منتقي صورة: شعار المعرض / صورة سيارة شاشة الدخول */
function imagePickerHtml(kind, labelKey, url, hintKey) {
  return `<div class="field full"><div class="img-picker" data-picker="${kind}">
    <label>${t(labelKey)}</label>
    <div class="ip-preview" data-preview>${url
      ? `<img src="${esc(url)}" alt="">`
      : `<div class="ip-empty">${icon('image', 'lg')}<span>${t('no_image')}</span></div>`}</div>
    <div class="ip-actions">
      <button class="btn btn-ghost btn-sm" data-upload-img="${kind}">${icon('upload', 'sm')} ${t('upload_image')}</button>
      ${url ? `<button class="btn btn-ghost btn-sm danger" data-remove-img="${kind}">${icon('trash', 'sm')} ${t('remove_image')}</button>` : ''}
    </div>
    <div class="ip-hint">${t(hintKey)}</div>
  </div></div>`;
}
function bindImagePicker(container, kind) {
  const wrap = container.querySelector(`[data-picker="${kind}"]`);
  if (!wrap) return;
  const up = wrap.querySelector('[data-upload-img]');
  const rm = wrap.querySelector('[data-remove-img]');
  if (up) up.onclick = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const buf = await f.arrayBuffer();
      try {
        const r = await api('/settings/image', { method: 'POST', raw: buf, headers: { 'Content-Type': f.type || 'image/png', 'x-kind': kind }, filename: f.name });
        state.settings = { ...state.settings, ...(r.settings || {}) };
        toast(t('saved'));
        render(container);
      } catch (e) { toast(e.message, 'error'); }
    };
    inp.click();
  };
  if (rm) rm.onclick = async () => {
    if (!(await confirmDialog(t('remove_image') + '؟', { danger: true, okText: t('remove_image') }))) return;
    try {
      const r = await api('/settings/image?kind=' + kind, { method: 'DELETE' });
      state.settings = { ...state.settings, ...(r.settings || {}) };
      toast(t('saved'));
      render(container);
    } catch (e) { toast(e.message, 'error'); }
  };
}

export async function render(container) {
  const d = await api('/settings');
  const s = d.settings || {};
  const editable = can('settings.manage');
  const val = (k) => esc(s[k] ?? '');
  container.innerHTML = `
    <div class="settings-grid">
      <div class="card card-pad">
        <div class="card-head" style="padding:0 0 12px;border:none"><h3>${icon('building', 'sm')} ${t('company_name')}</h3></div>
        <div class="form-grid">
          ${F.map((f) => `<div class="field"><label>${t(f.l)}</label><input class="input" name="${f.k}" value="${val(f.k)}" ${editable ? '' : 'disabled'}></div>`).join('')}
          <div class="field full"><label>${t('address')}</label><input class="input" name="address" value="${val('address')}" ${editable ? '' : 'disabled'}></div>
          <div class="field full"><label>${t('invoice_footer')}</label><textarea class="textarea" name="invoice_footer" ${editable ? '' : 'disabled'}>${val('invoice_footer')}</textarea></div>
        </div>
      </div>
      <div>
        <div class="card card-pad mb-2">
          <div class="card-head" style="padding:0 0 12px;border:none"><h3>${icon('car', 'sm')} ${t('login_branding')}</h3></div>
          <div class="form-grid">
            ${imagePickerHtml('logo', 'login_logo', s.logo, 'login_logo_hint')}
            ${imagePickerHtml('car', 'login_car_image', s.login_car, 'login_car_hint')}
          </div>
        </div>
        <div class="card card-pad mb-2">
          <div class="card-head" style="padding:0 0 12px;border:none"><h3>${icon('globe', 'sm')} ${t('language')}</h3></div>
          <div class="row" style="gap:10px;flex-wrap:wrap">
            <button class="btn ${state.lang === 'ar' ? 'btn-primary' : 'btn-ghost'}" data-lang="ar">العربية</button>
            <button class="btn ${state.lang === 'en' ? 'btn-primary' : 'btn-ghost'}" data-lang="en">English</button>
          </div>
        </div>
        <div class="card card-pad mb-2">
          <div class="card-head" style="padding:0 0 12px;border:none"><h3>${icon('palette', 'sm')} ${t('theme_gallery')}</h3></div>
          ${themeGallery()}
        </div>
        <div class="card card-pad">
          <div class="card-head" style="padding:0 0 12px;border:none"><h3>${icon('database', 'sm')} ${t('auto_backup')}</h3></div>
          <div class="form-grid">
            <div class="field full"><label class="check"><input type="checkbox" name="auto_backup_enabled" ${s.auto_backup_enabled === '1' || s.auto_backup_enabled === 1 ? 'checked' : ''} ${editable ? '' : 'disabled'}> ${t('auto_backup')}</label></div>
            <div class="field"><label>${t('backup_interval')}</label><input class="input" type="number" name="auto_backup_interval_hours" value="${val('auto_backup_interval_hours')}" ${editable ? '' : 'disabled'}></div>
            <div class="field"><label>${t('backup_retention')}</label><input class="input" type="number" name="backup_retention_days" value="${val('backup_retention_days')}" ${editable ? '' : 'disabled'}></div>
          </div>
        </div>
        ${editable ? `<button class="btn btn-primary btn-block btn-lg mt-2" data-save>${icon('save', 'sm')} ${t('save')}</button>` : ''}
      </div>
    </div>`;

  container.querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => { applyLang(b.dataset.lang); window.dispatchEvent(new CustomEvent('ac:lang')); });
  bindThemeGallery(container);
  if (editable) { bindImagePicker(container, 'logo'); bindImagePicker(container, 'car'); }
  const save = container.querySelector('[data-save]');
  if (save) save.onclick = async () => {
    const body = {};
    F.forEach((f) => { const el = container.querySelector(`[name=${f.k}]`); if (el && el.value !== '') body[f.k] = el.value; });
    const addr = container.querySelector('[name=address]'); body.address = addr.value;
    body.invoice_footer = container.querySelector('[name=invoice_footer]').value;
    body.auto_backup_enabled = container.querySelector('[name=auto_backup_enabled]').checked ? '1' : '0';
    body.auto_backup_interval_hours = container.querySelector('[name=auto_backup_interval_hours]').value;
    body.backup_retention_days = container.querySelector('[name=backup_retention_days]').value;
    try { const r = await api('/settings', { method: 'PUT', body }); Object.assign(state.settings, r.settings || body); toast(t('saved')); }
    catch (e) { toast(e.message, 'error'); }
  };
}
