"use client";
// Tiny dependency-free SVG charts for dashboards.

export function Donut({ segments, size = 120, label }: { segments: { value: number; color: string; label?: string }[]; size?: number; label?: string }) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
  const r = size / 2 - 10, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--input)" strokeWidth={14} />
      {segments.map((s, i) => {
        const len = (s.value / total) * C;
        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={14}
          strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform={`rotate(-90 ${cx} ${cy})`} />;
        off += len; return el;
      })}
      {label && <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={size / 6} fontWeight={800} fill="var(--text)">{label}</text>}
    </svg>
  );
}

export function Bars({ data, color = "#4f9dff", height = 120 }: { data: { label: string; value: number; color?: string }[]; color?: string; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height, padding: "6px 0" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
          <span style={{ fontSize: 10 }}>{d.value}</span>
          <div style={{ width: "100%", height: `${(d.value / max) * 100}%`, minHeight: 2, background: d.color || color, borderRadius: "4px 4px 0 0" }} />
          <span className="muted" style={{ fontSize: 10.5 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HBars({ data, height = 8 }: { data: { label: string; value: number; max?: number; color?: string }[]; height?: number }) {
  return (
    <div>
      {data.map((d, i) => {
        const max = d.max ?? Math.max(...data.map((x) => x.value), 1);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
            <span style={{ width: 110, fontSize: 12.5 }}>{d.label}</span>
            <span style={{ flex: 1, height, borderRadius: 999, background: "var(--input)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${(d.value / max) * 100}%`, background: d.color || "#4f9dff" }} />
            </span>
            <span style={{ minWidth: 34, textAlign: "left", fontSize: 12 }}>{d.value}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Spark({ data, color = "#4f9dff", height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (!data?.length) return null;
  const max = Math.max(...data), min = Math.min(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${height - 4 - ((v - min) / rng) * (height - 8)}`).join(" ");
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const full = Math.round(rating || 0);
  return <span style={{ color: "#f59e0b", fontSize: size, letterSpacing: 1 }}>{"★".repeat(full)}<span style={{ color: "var(--line)" }}>{"★".repeat(5 - full)}</span></span>;
}
