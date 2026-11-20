/**
 * Dependency-free SVG charts.
 */
import { fmtNumber } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, v);
  return el;
}

function niceMax(value) {
  if (value <= 0) return 10;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const norm = value / base;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * base;
}

function shortNumber(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function baseSvg(width, height) {
  return svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
  });
}

/* ------------------------------------------------------------------ *
 * Bar chart (supports 1–2 series)
 * ------------------------------------------------------------------ */
export function barChart({ data = [], height = 240, series = null, colors = ['var(--brand)', 'var(--accent)'], showValues = false } = {}) {
  const width = 640;
  const pad = { top: 16, right: 12, bottom: 34, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const svg = baseSvg(width, height);

  if (!data.length) return emptyChart(height);

  const keys = series || (data[0] && 'value2' in data[0] ? ['value', 'value2'] : ['value']);
  const max = niceMax(Math.max(...data.flatMap((d) => keys.map((k) => Number(d[k]) || 0)), 1));
  const gridCount = 4;

  for (let i = 0; i <= gridCount; i += 1) {
    const y = pad.top + (innerH / gridCount) * i;
    const value = max - (max / gridCount) * i;
    svg.appendChild(
      svgEl('line', {
        x1: pad.left,
        x2: width - pad.right,
        y1: y,
        y2: y,
        stroke: 'var(--border)',
        'stroke-width': 1,
        'stroke-dasharray': i === gridCount ? '0' : '3 4',
      }),
    );
    const label = svgEl('text', {
      x: pad.left - 8,
      y: y + 3.5,
      'text-anchor': 'end',
      fill: 'var(--faint)',
      'font-size': 9.5,
      'font-family': 'inherit',
    });
    label.textContent = shortNumber(value);
    svg.appendChild(label);
  }

  const groupW = innerW / data.length;
  const barW = Math.max(4, Math.min(26, (groupW * 0.62) / keys.length));
  const gap = 3;

  data.forEach((d, i) => {
    const groupCenter = pad.left + groupW * i + groupW / 2;
    const totalW = keys.length * barW + (keys.length - 1) * gap;
    keys.forEach((key, si) => {
      const value = Number(d[key]) || 0;
      const bh = Math.max(0, (value / max) * innerH);
      const x = groupCenter - totalW / 2 + si * (barW + gap);
      const y = pad.top + innerH - bh;
      const rect = svgEl('rect', {
        x,
        y,
        width: barW,
        height: Math.max(bh, value ? 2 : 0),
        rx: Math.min(4, barW / 2),
        fill: colors[si % colors.length],
        opacity: 0.92,
      });
      const title = svgEl('title');
      title.textContent = `${d.label}: ${fmtNumber(value)}`;
      rect.appendChild(title);
      svg.appendChild(rect);
      if (showValues && value) {
        const t = svgEl('text', {
          x: x + barW / 2,
          y: y - 4,
          'text-anchor': 'middle',
          fill: 'var(--muted)',
          'font-size': 8.5,
          'font-family': 'inherit',
        });
        t.textContent = shortNumber(value);
        svg.appendChild(t);
      }
    });

    const label = svgEl('text', {
      x: groupCenter,
      y: height - 12,
      'text-anchor': 'middle',
      fill: 'var(--faint)',
      'font-size': 9.5,
      'font-family': 'inherit',
    });
    const text = String(d.label ?? '');
    label.textContent = text.length > 11 ? `${text.slice(0, 10)}…` : text;
    const title = svgEl('title');
    title.textContent = text;
    label.appendChild(title);
    svg.appendChild(label);
  });

  return svg;
}

/* ------------------------------------------------------------------ *
 * Line / area chart
 * ------------------------------------------------------------------ */
export function lineChart({ data = [], height = 240, color = 'var(--brand)', color2 = 'var(--accent)', series = null } = {}) {
  const width = 640;
  const pad = { top: 18, right: 16, bottom: 30, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const svg = baseSvg(width, height);
  if (!data.length) return emptyChart(height);

  const keys = series || (data[0] && 'value2' in data[0] ? ['value', 'value2'] : ['value']);
  const max = niceMax(Math.max(...data.flatMap((d) => keys.map((k) => Number(d[k]) || 0)), 1));
  const gridCount = 4;

  for (let i = 0; i <= gridCount; i += 1) {
    const y = pad.top + (innerH / gridCount) * i;
    svg.appendChild(
      svgEl('line', {
        x1: pad.left,
        x2: width - pad.right,
        y1: y,
        y2: y,
        stroke: 'var(--border)',
        'stroke-width': 1,
        'stroke-dasharray': i === gridCount ? '0' : '3 4',
      }),
    );
    const label = svgEl('text', {
      x: pad.left - 8,
      y: y + 3.5,
      'text-anchor': 'end',
      fill: 'var(--faint)',
      'font-size': 9.5,
      'font-family': 'inherit',
    });
    label.textContent = shortNumber(max - (max / gridCount) * i);
    svg.appendChild(label);
  }

  const xAt = (i) => pad.left + (data.length === 1 ? innerW / 2 : (innerW / (data.length - 1)) * i);
  const yAt = (v) => pad.top + innerH - ((Number(v) || 0) / max) * innerH;

  keys.forEach((key, si) => {
    const stroke = si === 0 ? color : color2;
    const points = data.map((d, i) => `${xAt(i)},${yAt(d[key])}`).join(' ');
    const area = svgEl('polygon', {
      points: `${pad.left},${pad.top + innerH} ${points} ${xAt(data.length - 1)},${pad.top + innerH}`,
      fill: stroke,
      opacity: 0.08,
    });
    svg.appendChild(area);
    const line = svgEl('polyline', {
      points,
      fill: 'none',
      stroke,
      'stroke-width': 2.4,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
    svg.appendChild(line);

    data.forEach((d, i) => {
      const circle = svgEl('circle', {
        cx: xAt(i),
        cy: yAt(d[key]),
        r: 3,
        fill: 'var(--surface)',
        stroke,
        'stroke-width': 2,
      });
      const title = svgEl('title');
      title.textContent = `${d.label}: ${fmtNumber(d[key])}`;
      circle.appendChild(title);
      svg.appendChild(circle);
    });
  });

  const step = Math.ceil(data.length / 7);
  data.forEach((d, i) => {
    if (i % step !== 0 && i !== data.length - 1) return;
    const label = svgEl('text', {
      x: xAt(i),
      y: height - 10,
      'text-anchor': 'middle',
      fill: 'var(--faint)',
      'font-size': 9.5,
      'font-family': 'inherit',
    });
    label.textContent = String(d.label ?? '');
    svg.appendChild(label);
  });

  return svg;
}

/* ------------------------------------------------------------------ *
 * Donut chart
 * ------------------------------------------------------------------ */
export function donutChart({ data = [], size = 168, thickness = 22, centerLabel = '', centerValue = '' } = {}) {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const svg = baseSvg(size, size);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  svg.appendChild(
    svgEl('circle', {
      cx: c,
      cy: c,
      r,
      fill: 'none',
      stroke: 'var(--surface-3)',
      'stroke-width': thickness,
    }),
  );

  if (total > 0) {
    let offset = 0;
    data.forEach((d) => {
      const value = Number(d.value) || 0;
      const frac = value / total;
      const arc = svgEl('circle', {
        cx: c,
        cy: c,
        r,
        fill: 'none',
        stroke: d.color || 'var(--brand)',
        'stroke-width': thickness,
        'stroke-dasharray': `${Math.max(0, frac * circ - 1.5)} ${circ}`,
        'stroke-dashoffset': -offset,
        'stroke-linecap': 'round',
        transform: `rotate(-90 ${c} ${c})`,
        style: 'transition: stroke-dasharray .6s ease',
      });
      const title = svgEl('title');
      title.textContent = `${d.label}: ${fmtNumber(value)}`;
      arc.appendChild(title);
      svg.appendChild(arc);
      offset += frac * circ;
    });
  }

  if (centerValue !== '' || centerLabel) {
    const value = svgEl('text', {
      x: c,
      y: c + (centerLabel ? 1 : 6),
      'text-anchor': 'middle',
      fill: 'var(--text)',
      'font-size': size * 0.16,
      'font-weight': 700,
      'font-family': 'inherit',
    });
    value.textContent = centerValue;
    svg.appendChild(value);
    if (centerLabel) {
      const label = svgEl('text', {
        x: c,
        y: c + size * 0.14,
        'text-anchor': 'middle',
        fill: 'var(--faint)',
        'font-size': size * 0.065,
        'font-family': 'inherit',
      });
      label.textContent = centerLabel;
      svg.appendChild(label);
    }
  }

  return svg;
}

/* ------------------------------------------------------------------ *
 * Sparkline
 * ------------------------------------------------------------------ */
export function sparkline(values = [], { width = 120, height = 34, color = 'var(--brand)' } = {}) {
  const svg = baseSvg(width, height);
  const nums = values.map((v) => Number(v) || 0);
  if (nums.length < 2) return svg;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const points = nums
    .map((v, i) => `${(i / (nums.length - 1)) * width},${height - 3 - ((v - min) / span) * (height - 6)}`)
    .join(' ');
  svg.appendChild(
    svgEl('polyline', {
      points,
      fill: 'none',
      stroke: color,
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  return svg;
}

/* ------------------------------------------------------------------ *
 * Horizontal ranking bars
 * ------------------------------------------------------------------ */
export function rankingBars({ data = [], valueKey = 'value', labelKey = 'label', color = 'var(--brand)', format = fmtNumber } = {}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return {
    el: (() => {
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.gap = '11px';
      for (const d of data) {
        const pct = ((Number(d[valueKey]) || 0) / max) * 100;
        const row = document.createElement('div');
        row.innerHTML = `
          <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;margin-bottom:4px">
            <span style="color:var(--text-2);font-weight:550">${escape(d[labelKey])}</span>
            <span style="color:var(--text);font-weight:700;font-variant-numeric:tabular-nums">${format(d[valueKey])}</span>
          </div>
          <div class="progress progress--sm"><div class="progress__bar" style="width:${pct}%;background:${d.color || color}"></div></div>`;
        wrap.appendChild(row);
      }
      return wrap;
    })(),
  };
}

function escape(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function emptyChart(height) {
  const wrap = document.createElement('div');
  wrap.className = 'chart-empty';
  wrap.style.minHeight = `${height}px`;
  wrap.textContent = '—';
  return wrap;
}
