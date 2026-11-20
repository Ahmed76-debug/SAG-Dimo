/* ============================================================
   النواة — حالة التطبيق، API، تنسيقات، ثيم
   ============================================================ */

const BRANCH_KEY = 'baraka-branch';

export const state = {
  user: null,
  csrf: null,
  settings: {},
  categories: [],
  branches: [],
  branchId: Number(localStorage.getItem(BRANCH_KEY)) || 0,
  defaultBranchId: 0,
  shift: null,
  alerts: {},
  version: '',
  route: 'dashboard',
};

export function branchName(id = state.branchId) {
  const b = (state.branches || []).find((x) => Number(x.id) === Number(id));
  return b ? b.name : '';
}

export function setBranch(id) {
  state.branchId = Number(id) || 0;
  if (state.branchId) localStorage.setItem(BRANCH_KEY, String(state.branchId));
  else localStorage.removeItem(BRANCH_KEY);
  window.dispatchEvent(new CustomEvent('baraka:branch', { detail: state.branchId }));
}

/* ---------- API ---------- */
export async function api(path, { method = 'GET', body, headers = {}, raw } = {}) {
  if (method === 'GET' && state.branchId && !path.startsWith('/auth/')) {
    path += (path.includes('?') ? '&' : '?') + 'branch=' + state.branchId;
  }
  const opts = {
    method,
    credentials: 'same-origin',
    headers: { 'x-csrf': state.csrf || '', ...headers },
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  if (raw !== undefined) {
    opts.body = raw;
    delete opts.headers['Content-Type'];
    opts.headers['x-csrf'] = state.csrf || '';
  }
  let res;
  try {
    res = await fetch('/api' + path, opts);
  } catch {
    throw new Error('تعذر الاتصال بالخادم — تحقق من الشبكة');
  }
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      window.dispatchEvent(new CustomEvent('baraka:unauthorized'));
    }
    throw new Error((data && data.error) || `خطأ غير متوقع (${res.status})`);
  }
  return data || {};
}

export function can(perm) {
  if (!state.user) return false;
  if (state.user.role === 'admin') return true;
  const p = state.user.permissions || [];
  return p.includes('*') || p.includes(perm);
}

/* ---------- أدوات ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

export function icon(name, cls = '') {
  return `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function delegate(root, event, selector, handler) {
  root.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}

/* ---------- تنسيق الأرقام والتواريخ ---------- */
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const fmt = {
  num: (v) => nf2.format(Number(v) || 0),
  int: (v) => nf0.format(Number(v) || 0),
  qty: (v) => nf2.format(Number(v) || 0),
  money(v, withCurrency = true) {
    const n = Number(v) || 0;
    const s = nf2.format(Math.abs(n) < 0.005 ? 0 : n);
    return withCurrency ? `${s} ${state.settings.currency || 'ج.م'}` : s;
  },
  percent(v, digits = 1) {
    return `${(Number(v) || 0).toFixed(digits)}%`;
  },
  date(value, withDay = false) {
    if (!value) return '—';
    const d = parseDate(value);
    if (!d) return String(value);
    const base = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    return withDay ? `${DAYS[d.getDay()]} ${base}` : base;
  },
  shortDate(value) {
    if (!value) return '—';
    const d = parseDate(value);
    if (!d) return String(value);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  },
  time(value) {
    if (!value) return '';
    const d = parseDate(value);
    if (!d) return '';
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const period = h < 12 ? 'ص' : 'م';
    h = h % 12 || 12;
    return `${h}:${m} ${period}`;
  },
  datetime(value) {
    if (!value) return '—';
    return `${fmt.date(value)} — ${fmt.time(value)}`;
  },
  relative(value) {
    if (!value) return '—';
    const d = parseDate(value);
    if (!d) return '—';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'الآن';
    if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
    if (diff < 86400 * 7) return `قبل ${Math.floor(diff / 86400)} يوم`;
    return fmt.date(value);
  },
  bytes(n) {
    const b = Number(n) || 0;
    if (b < 1024) return `${b} بايت`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} ك.ب`;
    if (b < 1073741824) return `${(b / 1048576).toFixed(1)} م.ب`;
    return `${(b / 1073741824).toFixed(2)} ج.ب`;
  },
  today() { return isoDate(new Date()); },
  dayName(value) { const d = parseDate(value); return d ? DAYS[d.getDay()] : ''; },
  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return isoDate(d);
  },
  monthStart(dateStr) { return (dateStr || fmt.today()).slice(0, 8) + '01'; },
  digits: (v) => String(v ?? ''),
};

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value).replace(' ', 'T');
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function isoDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export { parseDate };

/* ---------- الثيم ---------- */
const THEME_KEY = 'baraka-theme';
const THEME_MODES = [
  { id:'light',        name:'فاتح (افتراضي)', mode:'light', colors:{ bg:'#f3f7f6', surface:'#ffffff', brand:'#0b2e23', accent:'#14b8a6' } },
  { id:'light-warm',   name:'فاتح دافئ',      mode:'light', colors:{ bg:'#fbf6ee', surface:'#fffdf8', brand:'#7c2d12', accent:'#f59e0b' } },
  { id:'light-sea',    name:'فاتح بحري',      mode:'light', colors:{ bg:'#eff6ff', surface:'#ffffff', brand:'#0b3a57', accent:'#0ea5e9' } },
  { id:'dark',         name:'داكن (افتراضي)', mode:'dark',  colors:{ bg:'#070f0c', surface:'#102220', brand:'#14b8a6', accent:'#2dd4bf' } },
  { id:'dark-blue',    name:'داكن أزرق',      mode:'dark',  colors:{ bg:'#07111f', surface:'#111a2e', brand:'#3b82f6', accent:'#22d3ee' } },
  { id:'dark-forest',  name:'داكن غابات',     mode:'dark',  colors:{ bg:'#06110c', surface:'#112016', brand:'#22c55e', accent:'#84cc16' } },
];
const THEME_COLORS = { light:'#0b2e23', 'light-warm':'#7c2d12', 'light-sea':'#0b3a57', dark:'#070f0c', 'dark-blue':'#07111f', 'dark-forest':'#06110c' };
const PALETTE_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.48 2 2 6.48 2 12c0 5.08 3.78 9.27 8.67 9.93.61.08 1.13-.43 1.02-1.04-.11-.56-.42-1.36-1.15-2.13-.63-.66-.99-1.55-.88-2.52.18-1.54 1.55-2.74 3.1-2.74H15c3.31 0 6-2.69 6-6 0-4.97-4.03-9-9-9z"/></svg>';
export const theme = {
  mode: (THEME_MODES.find(t=>t.id===localStorage.getItem(THEME_KEY))||THEME_MODES[0]).id,
  systemDark: window.matchMedia('(prefers-color-scheme: dark)'),
  apply() {
    const effective = this.mode === 'system' ? (this.systemDark.matches ? 'dark' : 'light') : this.mode;
    document.documentElement.dataset.theme = effective;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLORS[effective] || '#0b2e23';
    document.querySelectorAll('[data-theme-icon]').forEach((el) => { el.innerHTML = PALETTE_SVG; });
    document.querySelectorAll('[data-theme-label]').forEach((el) => { el.textContent = 'معرض الثيمات'; });
    window.dispatchEvent(new CustomEvent('baraka:theme', { detail: effective }));
    return effective;
  },
  set(mode) { this.mode = mode; localStorage.setItem(THEME_KEY, mode); this.apply(); },
  toggle() { this.openPicker(); },
  effective() { return document.documentElement.dataset.theme || 'light'; },
  openPicker() {
    const cur = this.effective();
    const lights = THEME_MODES.filter(t=>t.mode==='light');
    const darks = THEME_MODES.filter(t=>t.mode==='dark');
    const card = (t) => {
      const c = t.colors || {}; const active = t.id===cur ? ' active' : '';
      return '<button type="button" class="bk-theme-card'+active+'" data-bk-theme="'+t.id+'" title="'+t.name+'">'+
        '<span class="bk-tc-preview" style="--p-bg:'+c.bg+';--p-surface:'+c.surface+';--p-brand:'+c.brand+';--p-accent:'+c.accent+'">'+
          '<span class="bk-tc-side"></span><span class="bk-tc-main"><span class="bk-tc-head"></span><span class="bk-tc-line w70"></span><span class="bk-tc-line w45"></span><span class="bk-tc-chips"><i style="background:var(--p-brand)"></i><i style="background:var(--p-accent)"></i><i style="background:var(--p-surface);border:1px solid rgba(128,128,128,.25)"></i></span></span>'+
          '<span class="bk-tc-check">✓</span></span>'+
        '<span class="bk-tc-name">'+t.name+'<span class="bk-tc-mode">'+(t.mode==='dark'?'داكن':'فاتح')+'</span></span></button>';
    };
    let ov = document.getElementById('bk-theme-modal');
    if(!ov){ ov=document.createElement('div'); ov.id='bk-theme-modal'; ov.className='bk-theme-overlay'; document.body.appendChild(ov); }
    ov.innerHTML = '<div class="bk-theme-modal"><div class="bk-theme-modal-head"><h3>معرض الثيمات</h3><button type="button" class="btn secondary" data-close>إغلاق</button></div>'+
      '<div class="bk-theme-gallery"><section><div class="bk-tg-head"><span class="bk-tg-dot light"></span><h4>الثيمات الفاتحة</h4><span class="bk-tg-count">'+lights.length+'</span></div><div class="bk-theme-grid">'+lights.map(card).join('')+'</div></section>'+
      '<section><div class="bk-tg-head"><span class="bk-tg-dot dark"></span><h4>الثيمات الداكنة</h4><span class="bk-tg-count">'+darks.length+'</span></div><div class="bk-theme-grid">'+darks.map(card).join('')+'</div></section></div></div>';
    ov.style.display='grid';
    const close=()=>{ ov.style.display='none'; };
    ov.querySelector('[data-close]').onclick=close;
    ov.onclick=(e)=>{ if(e.target===ov) close(); };
    ov.querySelectorAll('[data-bk-theme]').forEach(b=>b.onclick=()=>{ this.set(b.dataset.bkTheme); ov.querySelectorAll('[data-bk-theme]').forEach(x=>x.classList.toggle('active', x===b)); });
  }
};
theme.systemDark.addEventListener('change', () => { if (theme.mode === 'system') theme.apply(); });

/* ---------- حالات المخزون ---------- */
export function stockState(stock, min) {
  const s = Number(stock) || 0;
  const m = Number(min) || 0;
  if (s <= 0) return { key: 'out', label: 'نفد', cls: 'badge-danger', color: 'var(--danger)' };
  if (s <= m) return { key: 'low', label: 'منخفض', cls: 'badge-warn', color: 'var(--warn)' };
  return { key: 'ok', label: 'متوفر', cls: 'badge-success', color: 'var(--brand)' };
}

export const paymentLabels = {
  cash: 'نقدي', card: 'بطاقة', wallet: 'محفظة', credit: 'آجل', mixed: 'مختلط',
};
export const statusLabels = {
  completed: 'مكتملة', returned: 'مرتجعة', held: 'معلقة', open: 'مفتوحة', closed: 'مغلقة',
};
export const moveLabels = {
  sale: 'بيع', purchase: 'شراء', adjust: 'تسوية', return: 'مرتجع', waste: 'تالف', open: 'افتتاحي',
};
export const roleLabels = {
  admin: 'مدير النظام', manager: 'مدير فرع', cashier: 'كاشير', accountant: 'محاسب', stock: 'مسؤول مخازن',
};

/* ---------- تنزيل ملف ---------- */
export function downloadFile(content, filename, type = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function toCsv(rows, headers) {
  const escCsv = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [];
  if (headers) lines.push(headers.map((h) => escCsv(h.label ?? h)).join(','));
  for (const row of rows) {
    if (headers) lines.push(headers.map((h) => escCsv(typeof h === 'object' ? row[h.key] : row[h])).join(','));
    else lines.push(row.map(escCsv).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

export function refreshSettings() {
  return api('/settings').then((r) => { state.settings = r.settings || state.settings; return r; }).catch(() => {});
}

/* أسماء مختصرة */
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '؟';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[1][0];
}
