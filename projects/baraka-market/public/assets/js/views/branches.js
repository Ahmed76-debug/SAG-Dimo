/* ============================================================
   الفروع — إدارة فروع المتجر وأدائها
   ============================================================ */
import { state, api, icon, esc, fmt } from '../core.js';
import { toast, openForm, confirmDialog, emptyState } from '../ui.js';
import { metric } from './_shared.js';

export async function render(root) {
  let alive = true;
  let branches = [];
  let error = '';

  root.innerHTML = `
    <div class="kpis" id="branch-stats">
      ${Array(4).fill('<div class="skeleton" style="height:108px;border-radius:18px"></div>').join('')}
    </div>
    <div class="card mt-3">
      <div class="row between wrap" style="gap:12px">
        <div>
          <div class="card-title">${icon('building')} فروع المتجر</div>
          <div class="card-sub">لكل فرع مخزونه ووردياته ومبيعاته وتقاريره المستقلة</div>
        </div>
        <button class="btn btn-primary btn-sm" data-add-branch>${icon('plus')} فرع جديد</button>
      </div>
    </div>
    <div class="mt-3" id="branches-grid">
      ${Array(6).fill('<div class="skeleton" style="height:235px;border-radius:18px"></div>').join('')}
    </div>`;

  async function load() {
    try {
      const res = await api('/branches');
      if (!alive) return;
      branches = res.rows || [];
      paint();
    } catch (e) {
      if (!alive) return;
      error = e.message;
      root.querySelector('#branch-stats').innerHTML = '';
      root.querySelector('#branches-grid').innerHTML = emptyState({
        title: 'تعذر تحميل الفروع', text: e.message, iconName: 'alert',
      });
    }
  }

  function paint() {
    const active = branches.filter((b) => Number(b.active));
    const todaySales = active.reduce((s, b) => s + Number(b.stats?.sales_today || 0), 0);
    const stock = active.reduce((s, b) => s + Number(b.stats?.stock_value || 0), 0);
    root.querySelector('#branch-stats').innerHTML = [
      metric({ label: 'إجمالي الفروع', value: fmt.int(branches.length), unit: 'فرع', iconName: 'building', foot: `<span class="muted">${fmt.int(active.length)} فرع نشط</span>` }),
      metric({ label: 'مبيعات اليوم', value: fmt.money(todaySales), iconName: 'receipt', color: 'var(--info)', soft: 'var(--info-soft)', foot: '<span class="muted">عبر جميع الفروع النشطة</span>' }),
      metric({ label: 'قيمة المخزون', value: fmt.money(stock), iconName: 'layers', color: 'var(--purple)', soft: 'var(--purple-soft)', foot: '<span class="muted">بسعر التكلفة</span>' }),
      metric({ label: 'ورديات مفتوحة', value: fmt.int(active.reduce((s, b) => s + Number(b.stats?.open_shift || 0), 0)), unit: 'وردية', iconName: 'clock', color: 'var(--warn)', soft: 'var(--warn-soft)', foot: '<span class="muted">على مستوى الفروع</span>' }),
    ].join('');

    const grid = root.querySelector('#branches-grid');
    if (!branches.length) {
      grid.innerHTML = emptyState({
        title: 'لا توجد فروع', text: 'أضف أول فرع لبدء إدارة المخزون والمبيعات.', iconName: 'building',
        action: '<button class="btn btn-primary" data-add-branch>إضافة فرع</button>',
      });
      bind(grid);
      return;
    }
    grid.innerHTML = `<div class="grid g3">${branches.map((b) => {
      const s = b.stats || {};
      const isActive = Number(b.active);
      const isDefault = Number(b.is_default);
      return `<div class="card branch-card ${isActive ? '' : 'inactive'}">
        <div class="branch-head">
          <div class="branch-ico">${icon('building')}</div>
          <div style="min-width:0;flex:1">
            <div class="row wrap" style="gap:6px">
              <b>${esc(b.name)}</b>
              ${isDefault ? `<span class="badge badge-success">${icon('star', 'icon-sm')} رئيسي</span>` : ''}
              <span class="badge ${isActive ? 'badge-muted' : 'badge-warn'}">${isActive ? 'نشط' : 'معطّل'}</span>
            </div>
            <div class="small muted" style="direction:ltr;text-align:start">${esc(b.code)}</div>
          </div>
        </div>
        <div class="branch-contact">
          <span>${icon('phone', 'icon-sm')} ${esc(b.phone || '—')}</span>
          <span>${icon('map', 'icon-sm')} ${esc(b.address || '—')}</span>
        </div>
        <div class="branch-metrics">
          <div><span>مبيعات اليوم</span><b>${fmt.money(s.sales_today || 0, false)}</b></div>
          <div><span>مبيعات الشهر</span><b>${fmt.money(s.sales_month || 0, false)}</b></div>
          <div><span>قيمة المخزون</span><b>${fmt.money(s.stock_value || 0, false)}</b></div>
          <div><span>الأصناف / الموظفون</span><b>${fmt.int(s.products || 0)} / ${fmt.int(s.users || 0)}</b></div>
        </div>
        <div class="row between mt-3" style="border-top:1px solid var(--border);padding-top:10px">
          <button class="btn btn-sm btn-secondary" data-edit="${b.id}">${icon('edit', 'icon-sm')} تعديل</button>
          <div class="actions">
            ${!isDefault && isActive ? `<button class="icon-btn" data-default="${b.id}" title="تعيين كفرع رئيسي">${icon('star')}</button>` : ''}
            ${!isDefault ? `<button class="icon-btn ${isActive ? 'danger' : ''}" data-toggle="${b.id}" title="${isActive ? 'تعطيل' : 'تفعيل'}">${icon(isActive ? 'pause' : 'check-circle')}</button>` : ''}
            ${!isDefault ? `<button class="icon-btn danger" data-delete="${b.id}" title="حذف">${icon('trash')}</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('')}</div>`;
    bind(grid);
  }

  function find(id) {
    return branches.find((b) => String(b.id) === String(id));
  }

  function bind(scope) {
    scope.querySelectorAll('[data-add-branch]').forEach((b) => b.addEventListener('click', () => openBranchForm(null)));
    scope.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openBranchForm(find(b.dataset.edit))));
    scope.querySelectorAll('[data-default]').forEach((b) => b.addEventListener('click', () => setDefault(find(b.dataset.default))));
    scope.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggleBranch(find(b.dataset.toggle))));
    scope.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => removeBranch(find(b.dataset.delete))));
  }

  function openBranchForm(branch) {
    const isNew = !branch;
    openForm({
      title: isNew ? 'إضافة فرع جديد' : 'تعديل بيانات الفرع',
      subtitle: isNew ? 'أنشئ فرعًا جديدًا بمخزون وورديات مستقلة' : `تحديث فرع «${esc(branch.name)}»`,
      submitText: isNew ? 'إضافة الفرع' : 'حفظ التعديلات',
      fields: [
        { name: 'name', label: 'اسم الفرع', required: true, value: branch?.name || '', placeholder: 'مثال: فرع مدينة نصر', autofocus: true },
        { name: 'code', label: 'كود الفرع', value: branch?.code || '', ltr: true, placeholder: 'NASR', hint: 'حروف إنجليزية وأرقام — يُستخدم للتمييز' },
        { name: 'phone', label: 'رقم الهاتف', value: branch?.phone || '', ltr: true, placeholder: '01xxxxxxxxx' },
        { name: 'address', label: 'العنوان', value: branch?.address || '', placeholder: 'الشارع والمنطقة', span: 2 },
      ],
      onSubmit: async (v, m) => {
        const payload = { name: v.name, code: v.code, phone: v.phone, address: v.address };
        const res = isNew
          ? await api('/branches', { method: 'POST', body: payload })
          : await api(`/branches/${branch.id}`, { method: 'PUT', body: { ...payload, active: Number(branch.active) } });
        m.close();
        toast(res.message || 'تم حفظ الفرع');
        await load();
      },
    });
  }

  async function setDefault(branch) {
    const ok = await confirmDialog({
      title: 'تعيين الفرع الرئيسي',
      message: `سيصبح «${branch.name}» هو الفرع الافتراضي للمستخدمين الجدد والعمليات غير المحددة.`,
      confirmText: 'تعيين', iconName: 'star',
    });
    if (!ok) return;
    try {
      const res = await api(`/branches/${branch.id}/default`, { method: 'POST', body: {} });
      toast(res.message || 'تم تعيين الفرع الرئيسي');
      await load();
      const boot = await api('/bootstrap');
      state.branches = boot.branches || state.branches;
      state.defaultBranchId = Number(boot.default_branch_id) || state.defaultBranchId;
    } catch (e) { toast(e.message, 'danger'); }
  }

  async function toggleBranch(branch) {
    const activate = !Number(branch.active);
    if (!activate) {
      const ok = await confirmDialog({
        title: 'تعطيل الفرع', message: `لن يظهر «${branch.name}» في قائمة الفروع، وستبقى بياناته محفوظة.`,
        confirmText: 'تعطيل', danger: true, iconName: 'pause',
      });
      if (!ok) return;
    }
    try {
      const res = await api(`/branches/${branch.id}`, {
        method: 'PUT',
        body: { name: branch.name, code: branch.code, phone: branch.phone, address: branch.address, active: activate },
      });
      toast(res.message || 'تم تحديث الفرع');
      await load();
    } catch (e) { toast(e.message, 'danger'); }
  }

  async function removeBranch(branch) {
    const ok = await confirmDialog({
      title: 'حذف الفرع', message: `سيتم حذف «${branch.name}» نهائيًا إذا لم تكن له حركات، أو تعطيله إن كانت له سجلات.`,
      confirmText: 'حذف', danger: true, iconName: 'trash',
    });
    if (!ok) return;
    try {
      const res = await api(`/branches/${branch.id}`, { method: 'DELETE' });
      toast(res.message || 'تم حذف الفرع');
      await load();
    } catch (e) { toast(e.message, 'danger'); }
  }

  root.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add-branch]');
    if (add) openBranchForm(null);
  });
  await load();
  return () => { alive = false; };
}
