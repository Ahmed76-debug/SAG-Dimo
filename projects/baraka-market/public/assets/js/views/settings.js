/* ============================================================
   الإعدادات — بيانات المتجر، الفواتير، النظام، سجل النشاط
   ============================================================ */
import { state, api, icon, esc, fmt } from '../core.js';
import { toast, setLoading, emptyState } from '../ui.js';

const TABS = [
  { key: 'store', label: 'بيانات المتجر', icon: 'shopping-bag' },
  { key: 'invoice', label: 'الفواتير والطباعة', icon: 'receipt' },
  { key: 'system', label: 'إعدادات النظام', icon: 'sliders' },
  { key: 'activity', label: 'سجل النشاط', icon: 'clock' },
];

const ACTION_META = {
  login: ['تسجيل دخول', 'key', ''],
  password: ['تغيير كلمة المرور', 'key', 'warn'],
  'product.create': ['إضافة منتج', 'box', ''],
  'product.update': ['تعديل منتج', 'edit', ''],
  'product.delete': ['حذف منتج', 'trash', 'danger'],
  'stock.adjust': ['تسوية مخزون', 'sliders', 'warn'],
  'sale.create': ['فاتورة بيع', 'receipt', ''],
  'sale.return': ['إرجاع فاتورة', 'refresh', 'warn'],
  'sale.collect': ['تحصيل فاتورة', 'cash', ''],
  'purchase.create': ['فاتورة مشتريات', 'truck', ''],
  'customer.pay': ['تحصيل من عميل', 'cash', ''],
  'supplier.pay': ['سداد لمورد', 'wallet', ''],
  'expense.create': ['تسجيل مصروف', 'wallet', 'warn'],
  'expense.delete': ['حذف مصروف', 'trash', 'danger'],
  'shift.open': ['فتح وردية', 'clock', ''],
  'shift.close': ['إغلاق وردية', 'clock', ''],
  'user.create': ['إضافة مستخدم', 'user-cog', ''],
  'user.update': ['تعديل مستخدم', 'user-cog', ''],
  'user.password': ['تغيير كلمة مرور مستخدم', 'key', 'warn'],
  'settings.update': ['تحديث الإعدادات', 'sliders', ''],
  'backup.create': ['إنشاء نسخة احتياطية', 'database', ''],
  'backup.folder': ['تغيير مجلد النسخ', 'folder', ''],
  'backup.upload': ['رفع نسخة احتياطية', 'upload', 'warn'],
  'backup.restore': ['استعادة نسخة احتياطية', 'refresh', 'danger'],
  'backup.delete': ['حذف نسخة احتياطية', 'trash', 'danger'],
  restore: ['استعادة تلقائية', 'refresh', 'danger'],
};

export async function render(root, { params } = {}) {
  let alive = true;
  let tab = TABS.some((t) => t.key === params?.get('tab')) ? params.get('tab') : 'store';
  let data = null;
  let activity = null;

  root.innerHTML = `<div class="settings-layout">
    <aside class="settings-nav" id="settings-nav">
      ${TABS.map((t) => `<button class="${t.key === tab ? 'active' : ''}" data-settings-tab="${t.key}">${icon(t.icon)} ${esc(t.label)}</button>`).join('')}
      ${state.user?.role === 'admin' ? `<div class="tiny muted" style="padding:10px 11px;line-height:1.7">أنت مسؤول النظام — كل التغييرات تُسجل في سجل النشاط.</div>` : ''}
    </aside>
    <div id="settings-content">
      <div class="card">
        <div class="skeleton" style="height:24px;width:180px;border-radius:7px;margin-bottom:18px"></div>
        ${Array(5).fill('<div class="skeleton" style="height:54px;border-radius:10px;margin-bottom:12px"></div>').join('')}
      </div>
    </div>
  </div>`;

  async function loadSettings() {
    try {
      data = await api('/settings');
      if (!alive) return;
      renderTab();
    } catch (e) {
      if (!alive) return;
      root.querySelector('#settings-content').innerHTML = `<div class="card"><div class="empty">
        <div class="empty-ico">${icon('alert')}</div>
        <div class="empty-title">تعذر تحميل الإعدادات</div>
        <div class="empty-text">${esc(e.message)}</div>
        <button class="btn btn-secondary mt-2" data-retry-settings>${icon('refresh')} إعادة المحاولة</button>
      </div></div>`;
      root.querySelector('[data-retry-settings]')?.addEventListener('click', loadSettings);
    }
  }

  function renderTab() {
    const content = root.querySelector('#settings-content');
    if (!content) return;
    if (!data) return;
    root.querySelectorAll('[data-settings-tab]').forEach((b) => b.classList.toggle('active', b.dataset.settingsTab === tab));

    if (tab === 'activity') {
      if (!activity) {
        content.innerHTML = `<div class="card">
          <div class="card-head"><div><div class="card-title">سجل النشاط</div><div class="card-sub">جارٍ تحميل السجل…</div></div></div>
          ${Array(7).fill('<div class="skeleton" style="height:48px;border-radius:9px;margin-bottom:9px"></div>').join('')}
        </div>`;
        loadActivity();
      } else {
        content.innerHTML = activityHtml(activity);
        bindActivity(content);
      }
      return;
    }

    if (tab === 'store') content.innerHTML = storeHtml(data);
    else if (tab === 'invoice') content.innerHTML = invoiceHtml(data);
    else content.innerHTML = systemHtml(data);
    bindForm(content);
  }

  async function loadActivity(force = false) {
    if (activity && !force) return;
    if (force) {
      const old = activity;
      activity = null;
      root.querySelector('#settings-content').innerHTML = `<div class="card">
        <div class="card-head"><div><div class="card-title">سجل النشاط</div><div class="card-sub">جارٍ تحديث السجل…</div></div></div>
        ${Array(5).fill('<div class="skeleton" style="height:48px;border-radius:9px;margin-bottom:9px"></div>').join('')}
      </div>`;
      try { activity = await api('/activity'); } catch (e) { activity = old; toast(e.message, 'error'); }
    } else {
      try { activity = await api('/activity'); } catch (e) { toast(e.message, 'error'); activity = { rows: [] }; }
    }
    if (!alive) return;
    if (tab === 'activity') renderTab();
  }

  function bindForm(content) {
    const form = content.querySelector('#settings-form');
    if (!form) return;
    const save = async (btn) => {
      setLoading(btn, true, 'جارٍ حفظ الإعدادات…');
      try {
        const res = await api('/settings', { method: 'PUT', body: collectSettings(form) });
        state.settings = res.settings || state.settings;
        window.dispatchEvent(new CustomEvent('baraka:settings'));
        toast(res.message || 'تم حفظ الإعدادات');
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setLoading(btn, false);
      }
    };
    content.querySelectorAll('[data-save-settings]').forEach((btn) => {
      btn.addEventListener('click', () => save(btn));
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      save(content.querySelector('[data-save-settings]'));
    });
  }

  function bindActivity(content) {
    content.querySelector('[data-refresh-activity]')?.addEventListener('click', () => loadActivity(true));
    content.querySelector('[data-activity-more]')?.addEventListener('click', () => {
      toast('يتم عرض آخر 120 عملية مسجلة', 'info');
    });
  }

  function switchTab(next) {
    if (!TABS.some((t) => t.key === next) || next === tab) return;
    tab = next;
    history.replaceState(null, '', `#/settings?tab=${tab}`);
    renderTab();
  }

  root.querySelector('#settings-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-settings-tab]');
    if (btn) switchTab(btn.dataset.settingsTab);
  });

  await loadSettings();
  return () => { alive = false; };
}

/* ============================ بيانات المتجر ============================ */
function storeHtml(data) {
  const s = data.settings || {};
  return `<div class="card">
    <div class="card-head">
      <div><div class="card-title">${icon('shopping-bag', 'icon-sm')} بيانات المتجر</div><div class="card-sub">تظهر هذه البيانات في الفواتير وشريط التطبيق</div></div>
      <div class="spacer"></div>
      <span class="badge badge-success">${icon('check-circle', 'icon-sm')} مباشر</span>
    </div>
    <form id="settings-form" novalidate>
      <div class="settings-form">
        ${inputField('store_name', 'اسم المتجر', s.store_name, { required: true, placeholder: 'سوق البركة' })}
        ${inputField('store_tagline', 'الوصف المختصر', s.store_tagline, { placeholder: 'سوبر ماركت • خضروات • لحوم' })}
        ${inputField('store_phone', 'رقم الهاتف', s.store_phone, { ltr: true, placeholder: '0100 123 4567' })}
        ${inputField('currency', 'العملة', s.currency, { placeholder: 'ج.م' })}
        ${inputField('store_address', 'عنوان المتجر', s.store_address, { span: 2, placeholder: 'شارع السوق التجاري — القاهرة' })}
        ${inputField('tax_number', 'الرقم الضريبي / السجل التجاري', s.tax_number, { span: 2, ltr: true, placeholder: 'اختياري' })}
      </div>
      <div class="mt-3">
        ${toggleRow('low_stock_alert', 'تنبيهات المخزون المنخفض', 'إظهار تنبيه في الشريط العلوي عند وصول أصناف إلى حد الطلب.', s.low_stock_alert)}
      </div>
      <div class="row between mt-3" style="border-top:1px solid var(--border);padding-top:14px;flex-wrap:wrap;gap:10px">
        <span class="tiny muted">${icon('info', 'icon-sm')} تُحدَّث بيانات المتجر في كل الفواتير الجديدة فور الحفظ.</span>
        <button type="button" class="btn btn-primary" data-save-settings>${icon('save')} حفظ بيانات المتجر</button>
      </div>
    </form>
  </div>`;
}

/* ============================ الفواتير ============================ */
function invoiceHtml(data) {
  const s = data.settings || {};
  return `<div class="card">
    <div class="card-head">
      <div><div class="card-title">${icon('receipt', 'icon-sm')} الفواتير والطباعة</div><div class="card-sub">خصّص ترقيم الفواتير والضريبة وإيصال الكاشير</div></div>
      <div class="spacer"></div>
      <span class="badge badge-muted">${icon('printer', 'icon-sm')} ${s.receipt_width === '58' ? '58mm' : '80mm'}</span>
    </div>
    <form id="settings-form" novalidate>
      <div class="settings-form">
        ${inputField('invoice_prefix', 'بادئة فواتير البيع', s.invoice_prefix, { ltr: true, placeholder: 'INV-' })}
        ${inputField('purchase_prefix', 'بادئة فواتير الشراء', s.purchase_prefix, { ltr: true, placeholder: 'PUR-' })}
        ${inputField('tax_rate', 'نسبة الضريبة %', s.tax_rate, { type: 'number', min: 0, max: 100, step: '0.01', placeholder: '0' })}
        ${selectField('receipt_width', 'عرض ورق الإيصال', s.receipt_width, [
          { value: '80', label: '80 مم — قياسي' }, { value: '58', label: '58 مم — صغير' },
        ])}
        ${textareaField('receipt_footer', 'تذييل الإيصال', s.receipt_footer, { span: 2, placeholder: 'شكرًا لتعاملكم معنا…' })}
        ${inputField('pos_quick_cash', 'أزرار النقد السريع', s.pos_quick_cash, { span: 2, ltr: true, placeholder: '50,100,200,500', hint: 'أرقام مفصولة بفاصلة — تظهر في شاشة الدفع بالكاشير' })}
      </div>
      <div class="mt-3">
        ${toggleRow('auto_print', 'طباعة الإيصال تلقائيًا', 'بعد إتمام أي فاتورة بيع في الكاشير، أرسل الإيصال للطابعة مباشرة.', s.auto_print)}
        ${toggleRow('tax_inclusive', 'الأسعار تشمل الضريبة', 'عند التفعيل تُحتسب الضريبة ضمن سعر البيع بدلًا من إضافتها.', s.tax_inclusive)}
      </div>
      <div class="row between mt-3" style="border-top:1px solid var(--border);padding-top:14px;flex-wrap:wrap;gap:10px">
        <span class="tiny muted">${icon('info', 'icon-sm')} إذا كانت الطباعة التلقائية مزعجة، يمكنك إبقاؤها متوقفة وطباعة الفواتير يدويًا.</span>
        <button type="button" class="btn btn-primary" data-save-settings>${icon('save')} حفظ إعدادات الفواتير</button>
      </div>
    </form>
  </div>`;
}

/* ============================ النظام ============================ */
function systemHtml(data) {
  const s = data.settings || {};
  const sys = data.system || {};
  const uptime = Number(sys.uptime) || 0;
  return `<div class="grid" style="gap:16px">
    <div class="card">
      <div class="card-head">
        <div><div class="card-title">${icon('sliders', 'icon-sm')} إعدادات التشغيل</div><div class="card-sub">سلوك المخزون والتنبيهات</div></div>
      </div>
      <form id="settings-form" novalidate>
        <div class="settings-form">
          ${inputField('low_stock_days', 'أيام التنبيه لقرب انتهاء الصلاحية', s.low_stock_days, { type: 'number', min: 1, max: 365, step: 1, hint: 'تُستخدم في تقرير أصناف قرب الانتهاء' })}
          <div class="field">
            <label>حالة النظام</label>
            <div class="input" style="display:flex;align-items:center;gap:8px;background:var(--brand-soft);border-color:transparent;color:var(--brand-strong);max-width:100%">
              ${icon('check-circle', 'icon-sm')} يعمل بشكل طبيعي
            </div>
          </div>
        </div>
        <div class="mt-3">
          ${toggleRow('allow_negative_stock', 'السماح بالبيع بالسالب', 'عند التفعيل يمكن إتمام البيع حتى لو كان رصيد الصنف صفرًا أو أقل. يُفضّل تركه متوقفًا.', s.allow_negative_stock)}
        </div>
        <div class="row between mt-3" style="border-top:1px solid var(--border);padding-top:14px;flex-wrap:wrap;gap:10px">
          <span class="tiny muted">${icon('alert', 'icon-sm')} البيع بالسالب قد يسبب فروقات في جرد المخزون.</span>
          <button type="button" class="btn btn-primary" data-save-settings>${icon('save')} حفظ إعدادات النظام</button>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="card-head">
        <div><div class="card-title">${icon('database', 'icon-sm')} معلومات الخادم</div><div class="card-sub">بيانات تقنية عن بيئة التشغيل</div></div>
        <div class="spacer"></div>
        <a class="btn btn-sm btn-secondary" href="#/backup">${icon('database', 'icon-sm')} النسخ الاحتياطي</a>
      </div>
      <div class="setting-row"><div><b>إصدار النظام</b><span>Baraka Market ERP</span></div><span class="badge badge-success">${esc(data.version || '—')}</span></div>
      <div class="setting-row"><div><b>إصدار Node.js</b><span>بيئة تشغيل الخادم</span></div><span class="small mono">${esc(sys.node || '—')}</span></div>
      <div class="setting-row"><div><b>نظام التشغيل</b><span>المنصة التي يعمل عليها الخادم</span></div><span class="small mono">${esc(sys.platform || '—')}</span></div>
      <div class="setting-row"><div><b>مدة التشغيل</b><span>منذ آخر إعادة تشغيل للخادم</span></div><span class="small">${esc(formatUptime(uptime))}</span></div>
      <div class="setting-row"><div><b>مسار قاعدة البيانات</b><span>ملف SQLite المحلي — لا تشاركه مع جهات غير موثوقة</span></div><span class="small mono" style="direction:ltr;text-align:start;font-size:9.5px;word-break:break-all;max-width:320px">${esc(sys.db_path || '—')}</span></div>
    </div>

    <div class="card" style="background:linear-gradient(135deg,var(--brand-soft),var(--surface) 70%)">
      <div class="row" style="align-items:flex-start;gap:12px">
        <div class="icon-wrap" style="width:42px;height:42px;border-radius:12px;background:var(--surface);display:grid;place-items:center;color:var(--brand)">${icon('shield')}</div>
        <div>
          <div class="card-title">حماية البيانات</div>
          <div class="card-sub" style="white-space:normal;line-height:1.8">أنشئ نسخة احتياطية دورية واحفظها على مجلد خارج الخادم أو على قرص خارجي. يمكنك أيضًا رفع نسخة قديمة واستعادتها في أي وقت.</div>
          <div class="row wrap mt-2">
            <a class="btn btn-sm btn-primary" href="#/backup">${icon('database', 'icon-sm')} إدارة النسخ الاحتياطي</a>
            <a class="btn btn-sm btn-secondary" href="#/backup?create=1">${icon('download', 'icon-sm')} نسخة الآن</a>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ============================ سجل النشاط ============================ */
function activityHtml(data) {
  const rows = data.rows || [];
  if (!rows.length) {
    return `<div class="card">${emptyState({ title: 'السجل فارغ', text: 'ستظهر هنا كل العمليات التي تتم في النظام', iconName: 'clock' })}</div>`;
  }
  return `<div class="card">
    <div class="card-head">
      <div><div class="card-title">${icon('clock', 'icon-sm')} سجل النشاط</div><div class="card-sub">آخر ${fmt.int(rows.length)} عملية — مرتبة من الأحدث</div></div>
      <div class="spacer"></div>
      <button class="btn btn-sm btn-secondary" data-refresh-activity>${icon('refresh')} تحديث</button>
    </div>
    <div class="timeline">
      ${rows.map((a) => {
        const [label, actionIcon, tone] = ACTION_META[a.action] || [a.action, 'info', ''];
        return `<div class="tl-item ${tone}">
          <span class="tl-dot"></span>
          <div class="row between" style="align-items:flex-start;gap:12px;flex-wrap:wrap">
            <div>
              <div class="tl-title">${icon(actionIcon, 'icon-sm')} ${esc(label)}</div>
              <div class="tl-sub">${esc(a.details || '')}</div>
            </div>
            <div style="text-align:end">
              <div class="tiny muted">${esc(a.user_name || 'النظام')}</div>
              <div class="tiny muted">${esc(fmt.datetime(a.created_at))}${a.ip ? ` · ${esc(a.ip)}` : ''}</div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="row between mt-3" style="border-top:1px solid var(--border);padding-top:12px">
      <span class="tiny muted">يتم الاحتفاظ بآخر 120 عملية في هذه الواجهة.</span>
      <button class="btn btn-sm btn-ghost" data-activity-more>${icon('info', 'icon-sm')} حول السجل</button>
    </div>
  </div>`;
}

/* ============================ أدوات الحقول ============================ */
function inputField(name, label, value, { span = 1, type = 'text', ...opts } = {}) {
  const attrs = [
    `type="${esc(type)}"`, `id="s-${name}"`, `name="${name}"`, `class="input"`,
    `value="${esc(value ?? '')}"`,
    opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : '',
    opts.required ? 'required' : '',
    opts.min !== undefined ? `min="${opts.min}"` : '',
    opts.max !== undefined ? `max="${opts.max}"` : '',
    opts.step !== undefined ? `step="${opts.step}"` : '',
    opts.ltr ? 'dir="ltr" style="text-align:left"' : '',
  ].filter(Boolean).join(' ');
  return `<div class="field ${span === 2 ? 'span-2' : ''}">
    <label for="s-${name}">${esc(label)}${opts.required ? ' <i class="req">*</i>' : ''}</label>
    <input ${attrs} />
    ${opts.hint ? `<span class="hint">${esc(opts.hint)}</span>` : ''}
  </div>`;
}

function selectField(name, label, value, options, { span = 1, hint = '' } = {}) {
  return `<div class="field ${span === 2 ? 'span-2' : ''}">
    <label for="s-${name}">${esc(label)}</label>
    <select id="s-${name}" name="${name}" class="select">
      ${options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
    </select>
    ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
  </div>`;
}

function textareaField(name, label, value, { span = 1, placeholder = '', hint = '' } = {}) {
  return `<div class="field ${span === 2 ? 'span-2' : ''}">
    <label for="s-${name}">${esc(label)}</label>
    <textarea id="s-${name}" name="${name}" class="textarea" rows="3" placeholder="${esc(placeholder)}">${esc(value ?? '')}</textarea>
    ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
  </div>`;
}

function toggleRow(key, label, desc, value) {
  return `<div class="setting-row">
    <div><b>${esc(label)}</b><span>${esc(desc)}</span></div>
    <label class="switch">
      <input type="checkbox" data-setting="${key}" ${String(value) === '1' ? 'checked' : ''} />
      <span class="switch-track"></span>
    </label>
  </div>`;
}

function collectSettings(form) {
  const out = {};
  new FormData(form).forEach((value, key) => { out[key] = String(value); });
  form.querySelectorAll('[data-setting]').forEach((el) => { out[el.dataset.setting] = el.checked ? '1' : '0'; });
  return out;
}

function formatUptime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days) return `${fmt.int(days)} يوم · ${fmt.int(hours)} ساعة`;
  if (hours) return `${fmt.int(hours)} ساعة · ${fmt.int(mins)} دقيقة`;
  return `${fmt.int(mins)} دقيقة`;
}
