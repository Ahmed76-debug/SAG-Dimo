/* ============================================================
   عناصر مشتركة بين صفحات النظام
   ============================================================ */
import { icon, esc, fmt, downloadFile, toCsv } from '../core.js';

/* ---------- فترة زمنية ---------- */
export function rangeControls({ from, to, current = '30' }) {
  const presets = [
    { key: 'today', label: 'اليوم' },
    { key: '7', label: '7 أيام' },
    { key: '30', label: '30 يومًا' },
    { key: 'month', label: 'هذا الشهر' },
  ];
  return `<div class="quick-range" data-quick-range>
      ${presets.map((p) => `<button type="button" class="${current === p.key ? 'active' : ''}" data-quick="${p.key}">${p.label}</button>`).join('')}
    </div>
    <div class="date-range">
      ${icon('calendar', 'icon-sm muted')}
      <input class="input" type="date" value="${esc(from)}" data-range-from aria-label="من تاريخ" />
      <span class="tiny muted">إلى</span>
      <input class="input" type="date" value="${esc(to)}" data-range-to aria-label="إلى تاريخ" />
    </div>`;
}

export function bindRange(root, from, to, onChange) {
  const apply = (f, t, preset) => {
    if (!f || !t) return;
    if (f > t) [f, t] = [t, f];
    root.querySelectorAll('[data-quick]').forEach((b) => b.classList.toggle('active', preset ? b.dataset.quick === preset : false));
    const fi = root.querySelector('[data-range-from]');
    const ti = root.querySelector('[data-range-to]');
    if (fi) fi.value = f;
    if (ti) ti.value = t;
    onChange(f, t);
  };
  root.querySelectorAll('[data-quick]').forEach((btn) => btn.addEventListener('click', () => {
    const key = btn.dataset.quick;
    const today = fmt.today();
    if (key === 'today') apply(today, today, key);
    else if (key === '7') apply(fmt.addDays(today, -6), today, key);
    else if (key === '30') apply(fmt.addDays(today, -29), today, key);
    else if (key === 'month') apply(fmt.monthStart(today), today, key);
  }));
  const fi = root.querySelector('[data-range-from]');
  const ti = root.querySelector('[data-range-to]');
  fi?.addEventListener('change', () => apply(fi.value, ti.value, null));
  ti?.addEventListener('change', () => apply(fi.value, ti.value, null));
}

/* ---------- بطاقة مؤشر ---------- */
export function metric({ label, value, unit = '', iconName = 'chart', color = 'var(--brand)', soft = 'var(--brand-soft)', foot = '', iconEnd = '' }) {
  return `<div class="kpi" style="--k:${color};--k-soft:${soft}">
    <div class="kpi-top">
      <span class="kpi-label">${esc(label)}</span>
      <span class="kpi-icon">${icon(iconName)}</span>
    </div>
    <div class="kpi-value">${value}${unit ? ` <small>${esc(unit)}</small>` : ''}</div>
    <div class="kpi-foot">${foot}${iconEnd}</div>
  </div>`;
}

export function statMini({ label, value, iconName = 'box', tone = '' }) {
  return `<div class="stat-mini ${tone}">
    <div class="icon-wrap">${icon(iconName)}</div>
    <div><b>${value}</b><span>${esc(label)}</span></div>
  </div>`;
}

/* ---------- تصدير CSV ---------- */
export function exportCsv(filename, rows, headers) {
  downloadFile(toCsv(rows, headers), filename, 'text/csv;charset=utf-8');
}

/* ---------- تصدير Excel (ملف .xls متوافق مع Excel وGoogle Sheets) ---------- */
export function exportExcel(filename, sections = [], meta = {}) {
  const title = meta.title || 'تقرير';
  const tables = sections.map((section) => {
    const cols = section.columns || [];
    const head = cols.map((c) => `<th>${esc(c.label ?? c)}</th>`).join('');
    const body = (section.rows || []).map((row) => `<tr>${cols.map((c) => {
      const value = typeof c === 'object' ? row[c.key] : row[c];
      return `<td>${esc(value ?? '')}</td>`;
    }).join('')}</tr>`).join('');
    return `<h2>${esc(section.title || '')}</h2>
      <table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${Math.max(1, cols.length)}">لا توجد بيانات</td></tr>`}</tbody></table>`;
  }).join('');
  const summary = (meta.summary || []).map((s) => `<tr><td><b>${esc(s.label)}</b></td><td>${esc(s.value)}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <style>
      table{border-collapse:collapse;width:100%;margin:8px 0 20px}
      th,td{border:1px solid #cbd5e1;padding:7px 9px;text-align:right;font-family:Arial,sans-serif;font-size:12px}
      th{background:#0f766e;color:#fff;font-weight:bold}
      h1{font-family:Arial,sans-serif;font-size:20px;margin:0 0 4px;color:#0f766e}
      h2{font-family:Arial,sans-serif;font-size:15px;margin:18px 0 4px;color:#134e4a}
      meta{font-family:Arial,sans-serif;font-size:11px;color:#475569}
      .summary td{border:0;font-family:Arial,sans-serif;padding:3px 8px}
    </style></head><body>
    <h1>${esc(title)}</h1>
    <div class="meta">${esc(meta.subtitle || '')}${meta.subtitle ? ' · ' : ''}تاريخ التصدير: ${esc(meta.generated || '')}</div>
    ${summary ? `<table class="summary" style="width:auto;margin-top:10px">${summary}</table>` : ''}
    ${tables}
    <div class="meta">سوق البركة — نظام إدارة المتجر</div>
    </body></html>`;
  downloadFile('\uFEFF' + html, /\.xls$/i.test(filename) ? filename : `${filename}.xls`, 'application/vnd.ms-excel;charset=utf-8');
}

/* ---------- تصدير PDF (طباعة إلى PDF عبر المتصفح) ---------- */
export function exportPdf(title, sections = [], meta = {}) {
  const win = window.open('', '_blank');
  if (!win) throw new Error('المتصفح منع فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة ثم أعد المحاولة');
  const summary = (meta.summary || []).map((s) =>
    `<div class="sum"><span>${esc(s.label)}</span><b>${esc(s.value)}</b></div>`).join('');
  const tables = sections.map((section) => {
    const cols = section.columns || [];
    const body = (section.rows || []).map((row) => `<tr>${cols.map((c) => {
      const value = typeof c === 'object' ? row[c.key] : row[c];
      return `<td>${esc(value ?? '')}</td>`;
    }).join('')}</tr>`).join('');
    return `<section><h2>${esc(section.title || '')}</h2>
      <table><thead><tr>${cols.map((c) => `<th>${esc(c.label ?? c)}</th>`).join('')}</tr></thead>
      <tbody>${body || `<tr><td colspan="${Math.max(1, cols.length)}" class="empty">لا توجد بيانات</td></tr>`}</tbody></table></section>`;
  }).join('');
  win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
    <title>${esc(title)}</title>
    <style>
      @page{size:A4;margin:12mm}
      *{box-sizing:border-box}
      body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#0f172a;margin:0;background:#fff}
      header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f766e;padding-bottom:12px;margin-bottom:16px}
      h1{font-size:21px;margin:0;color:#0f766e}
      .brand{text-align:left;color:#64748b;font-size:11px;line-height:1.7}
      .brand b{display:block;font-size:15px;color:#0f172a}
      .meta{font-size:11px;color:#475569;margin:4px 0 14px}
      .summary{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 18px}
      .sum{border:1px solid #dbe4e2;background:#f4faf8;border-radius:9px;padding:8px 12px;min-width:120px}
      .sum span{display:block;font-size:10px;color:#64748b}
      .sum b{font-size:13px;color:#0f766e}
      h2{font-size:14px;color:#134e4a;border-right:4px solid #0f766e;padding-right:8px;margin:18px 0 7px}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}
      th,td{border:1px solid #d7e0de;padding:6px 8px;text-align:right;font-size:10.5px}
      th{background:#e8f3f0;color:#134e4a;font-weight:700}
      tr:nth-child(even) td{background:#fbfdfc}
      .empty{text-align:center;color:#94a3b8;padding:16px}
      footer{margin-top:22px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}section{break-inside:auto}tr{break-inside:avoid}}
    </style></head><body>
    <header>
      <div><h1>${esc(title)}</h1><div class="meta">${esc(meta.subtitle || '')}</div></div>
      <div class="brand"><b>سوق البركة</b>نظام إدارة المتجر<br>${esc(meta.generated || '')}</div>
    </header>
    ${summary ? `<div class="summary">${summary}</div>` : ''}
    ${tables}
    <footer><span>سوق البركة — تقرير مُصدر من نظام إدارة المتجر</span><span>${esc(meta.footer || '')}</span></footer>
    </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { try { win.print(); } catch {} }, 450);
}

/* ---------- شارة المخزون ---------- */
export function stockBadge(stock, min) {
  const s = Number(stock) || 0;
  const m = Number(min) || 0;
  if (s <= 0) return '<span class="badge badge-danger">نفد</span>';
  if (s <= m) return '<span class="badge badge-warn">منخفض</span>';
  return '<span class="badge badge-success">متوفر</span>';
}

/* ---------- طرق الدفع ---------- */
export const PAY_OPTIONS = [
  { value: 'cash', label: 'نقدي' },
  { value: 'card', label: 'بطاقة' },
  { value: 'wallet', label: 'محفظة إلكترونية' },
  { value: 'credit', label: 'آجل' },
];

/* ---------- ترويسة قسم ---------- */
export function sectionHead(title, sub = '', right = '') {
  return `<div class="card-head">
    <div><div class="card-title">${title}</div>${sub ? `<div class="card-sub">${esc(sub)}</div>` : ''}</div>
    <div class="spacer"></div>${right}
  </div>`;
}

/* ---------- تاريخ اليوم ---------- */
export function defaultRange(days = 29) {
  const to = fmt.today();
  return { from: fmt.addDays(to, -days), to };
}
