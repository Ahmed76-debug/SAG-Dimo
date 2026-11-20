import React from "react";

/* --------------------------------------------------------------- Sparkline */
export function Sparkline({
  data,
  color = "var(--primary)",
  height = 46,
  fill = true,
}: {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}) {
  if (!data.length) return null;
  const w = 100;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w;
    const y = height - ((v - min) / span) * (height - 8) - 4;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L${w},${height} L0,${height} Z`;
  const gid = `spark-${Math.round(data.reduce((a, b) => a + b, 0))}-${data.length}`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill ? <path d={area} fill={`url(#${gid})`} /> : null}
      <path d={line} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* -------------------------------------------------------------- Bar chart */
export function BarChart({
  data,
  height = 150,
  showValues = true,
  highlightLast,
}: {
  data: { label: string; value: number; alt?: boolean }[];
  height?: number;
  showValues?: boolean;
  highlightLast?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="chart-bars" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(4, (d.value / max) * (height - 40));
        const isLast = highlightLast && i === data.length - 1;
        return (
          <div className="bar-col" key={`${d.label}-${i}`} title={`${d.label}: ${d.value}`}>
            {showValues ? <span className="bar-val num">{d.value}</span> : null}
            <div
              className={`bar ${d.alt ? "alt" : ""}`}
              style={{ height: h, background: isLast ? "linear-gradient(180deg,#12a79a,#0a5f5a)" : undefined }}
            />
            <span className="bar-lbl">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- Donut */
export function Donut({
  segments,
  size = 132,
  thickness = 15,
  center,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  center?: React.ReactNode;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      {center ? <div className="donut-center">{center}</div> : null}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; value?: React.ReactNode; color: string }[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <div className="legend-item" key={it.label}>
          <span className="legend-swatch" style={{ background: it.color }} />
          <span className="grow">{it.label}</span>
          {it.value !== undefined ? <b className="num">{it.value}</b> : null}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- Mini meters */
export function Meter({
  label,
  value,
  max,
  color,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}) {
  const pct = Math.min(100, (value / (max || 1)) * 100);
  return (
    <div>
      <div className="row-between" style={{ marginBottom: 5 }}>
        <span className="small" style={{ color: "var(--ink-2)" }}>{label}</span>
        <span className="small bold num">
          {value}
          {suffix ?? ""}
        </span>
      </div>
      <div className="progress">
        <span style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
