"use client";
import { useEffect, useState } from "react";

function autoColor(v: number, invert = false) {
  const x = invert ? 100 - v : v;
  return x >= 66 ? "#22c55e" : x >= 40 ? "#f59e0b" : "#f43f5e";
}

// Animated circular gauge — fills on mount via stroke-dashoffset transition.
export default function Gauge({
  value, label, sub, color, size = 104, stroke = 9, invert = false,
}: {
  value: number; label?: string; sub?: string; color?: string;
  size?: number; stroke?: number; invert?: boolean;
}) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(value), 80); return () => clearTimeout(t); }, [value]);

  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, v));
  const off = C * (1 - pct / 100);
  const c = color || autoColor(value, invert);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--input)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)", filter: `drop-shadow(0 0 6px ${c}55)` }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: size * 0.26, fontWeight: 850, color: c, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {Math.round(value)}</div>
          {sub && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
      {label && <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>{label}</div>}
    </div>
  );
}
