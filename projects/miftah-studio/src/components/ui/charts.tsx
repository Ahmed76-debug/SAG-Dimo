import { useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ------------------------------- Sparkline ----------------------------- */
export function Sparkline({ values, color = 'var(--primary)', height = 34, className }: {
  values: number[]; color?: string; height?: number; className?: string;
}) {
  const id = useId();
  const path = useMemo(() => {
    if (!values.length) return { line: '', area: '' };
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    const pts = values.map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * 100;
      const y = 30 - ((v - min) / span) * 26 - 2;
      return `${x},${y}`;
    });
    return {
      line: `M${pts.join(' L')}`,
      area: `M0,32 L${pts.join(' L')} L100,32 Z`,
    };
  }, [values]);

  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={cn('w-full', className)} style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill={`url(#spark-${id})`} />
      <path d={path.line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------- AreaTrend ----------------------------- */
export function AreaTrend({ data, color = 'var(--primary)', formatValue = (v: number) => String(v), height = 230 }: {
  data: { label: string; fullLabel?: string; value: number }[];
  color?: string;
  formatValue?: (value: number) => string;
  height?: number;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;
  const chartHeight = 210;
  const padX = 8;
  const padTop = 16;
  const padBottom = 30;

  const max = Math.max(...data.map((d) => d.value), 1);
  const niceMax = Math.ceil(max / 4) * 4 || 4;
  const stepX = (width - padX * 2) / Math.max(1, data.length - 1);

  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padTop + (1 - d.value / niceMax) * (chartHeight - padTop - padBottom);
    return { x, y, ...d };
  });

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1]?.x ?? width},${chartHeight - padBottom} L${points[0]?.x ?? 0},${chartHeight - padBottom} Z`;

  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 ${width} ${chartHeight}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" style={{ direction: 'ltr' }}>
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="70%" stopColor={color} stopOpacity="0.05" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((g) => {
          const y = padTop + (g / 4) * (chartHeight - padTop - padBottom);
          return <line key={g} x1={padX} x2={width - padX} y1={y} y2={y} stroke="var(--border)" strokeDasharray="4 6" strokeWidth="1" />;
        })}
        <path d={area} fill={`url(#area-${id})`} />
        <motion.path
          d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: 'easeInOut' }}
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => (
          <g key={p.label + i}>
            <rect
              x={p.x - stepX / 2} y={0} width={stepX} height={chartHeight} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'crosshair' }}
            />
            {hover === i && (
              <>
                <line x1={p.x} x2={p.x} y1={padTop} y2={chartHeight - padBottom} stroke={color} strokeOpacity="0.35" strokeDasharray="3 4" />
                <circle cx={p.x} cy={p.y} r="5" fill="var(--surface)" stroke={color} strokeWidth="2.5" />
              </>
            )}
          </g>
        ))}
        {points.map((p) => (
          <text key={`label-${p.label}`} x={p.x} y={chartHeight - 8} textAnchor="middle" fill="var(--muted)" fontSize="10.5" fontFamily="inherit">
            {p.label}
          </text>
        ))}
        {points.length > 0 && hover === null && (
          <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill={color} />
        )}
      </svg>
      {hover !== null && points[hover] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-surface px-2.5 py-1.5 shadow-pop"
          style={{ left: `${(points[hover].x / width) * 100}%`, top: `${(points[hover].y / chartHeight) * 100 - 3}%` }}
        >
          <p className="text-[10px] text-muted">{points[hover].fullLabel || points[hover].label}</p>
          <p className="numeric text-[12px] font-semibold text-ink">{formatValue(points[hover].value)}</p>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Donut ------------------------------- */
export function Donut({ segments, size = 168, thickness = 17, centerLabel, centerValue }: {
  segments: { label: string; value: number; color: string }[];
  size?: number; thickness?: number; centerLabel?: string; centerValue?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
        {segments.map((seg) => {
          const length = (seg.value / total) * circumference;
          const dash = `${Math.max(0, length - 3)} ${circumference - Math.max(0, length - 3)}`;
          const el = (
            <motion.circle
              key={seg.label}
              cx={size / 2} cy={size / 2} r={r} fill="none" stroke={seg.color} strokeWidth={thickness}
              strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={-offset}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
            />
          );
          offset += length;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="numeric text-2xl font-bold text-ink">{centerValue ?? total}</span>
        {centerLabel && <span className="mt-0.5 text-[10.5px] text-muted">{centerLabel}</span>}
      </div>
    </div>
  );
}

/* --------------------------------- Bars -------------------------------- */
export function MiniBars({ data, color = 'var(--primary)', height = 74 }: {
  data: { label: string; value: number }[]; color?: string; height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height }} dir="ltr">
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="group/bar relative flex flex-1 flex-col items-center justify-end">
          <motion.div
            initial={{ height: 0 }} animate={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
            transition={{ delay: i * 0.03, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full rounded-t-[4px] transition-opacity group-hover/bar:opacity-100"
            style={{ backgroundColor: d.value ? color : 'var(--surface-3)', opacity: d.value ? 0.75 : 1 }}
          />
          <span className="pointer-events-none absolute -top-7 hidden whitespace-nowrap rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] text-soft shadow-pop group-hover/bar:block">
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- Legend -------------------------------- */
export function ChartLegend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-[11px] text-muted">{item.label}</span>
          {item.value && <span className="numeric text-[11px] font-medium text-soft">{item.value}</span>}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Gauge ring ----------------------------- */
export function Gauge({ value, max, label, color = 'var(--primary)', size = 120 }: {
  value: number; max: number; label?: string; color?: string; size?: number;
}) {
  const pct = Math.min(1, value / Math.max(1, max));
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size / 2 + 12 }}>
      <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`}>
        <path
          d={`M${stroke / 2},${size / 2} A${r},${r} 0 0 1 ${size - stroke / 2},${size / 2}`}
          fill="none" stroke="var(--surface-3)" strokeWidth={stroke} strokeLinecap="round"
        />
        <motion.path
          d={`M${stroke / 2},${size / 2} A${r},${r} 0 0 1 ${size - stroke / 2},${size / 2}`}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="numeric text-lg font-bold text-ink">{Math.round(pct * 100)}%</p>
        {label && <p className="text-[10px] text-muted">{label}</p>}
      </div>
    </div>
  );
}
