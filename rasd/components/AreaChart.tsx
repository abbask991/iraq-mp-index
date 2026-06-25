"use client";
import { useState } from "react";

type Pt = { label: string; value: number; sub?: string };

// Gradient-filled area chart with a hover crosshair + tooltip. Pure SVG, no deps.
export default function AreaChart({
  data, height = 150, color = "#34d6c6",
}: { data: Pt[]; height?: number; color?: string }) {
  const [hi, setHi] = useState<number | null>(null);
  if (!data.length) return null;

  const W = 640, H = height, padX = 10, padY = 14;
  const n = data.length;
  const vals = data.map((d) => d.value);
  const max = Math.max(1, ...vals);
  const X = (i: number) => (n <= 1 ? W / 2 : padX + (i / (n - 1)) * (W - padX * 2));
  const Y = (v: number) => H - padY - (v / max) * (H - padY * 2);
  const pts = data.map((d, i) => [X(i), Y(d.value)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L ${X(n - 1).toFixed(1)} ${H} L ${X(0).toFixed(1)} ${H} Z`;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width * W;
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) { const d = Math.abs(X(i) - rel); if (d < bd) { bd = d; best = i; } }
    setHi(best);
  };

  const gid = `ac-${color.replace("#", "")}`;
  const hp = hi != null ? pts[hi] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}
        onMouseMove={onMove} onMouseLeave={() => setHi(null)} className="ac-reveal">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 2px 6px ${color}55)` }} />
        {hp && <line x1={hp[0]} y1={padY} x2={hp[0]} y2={H} stroke={color} strokeOpacity="0.3" strokeWidth="1" />}
        {hp && <circle cx={hp[0]} cy={hp[1]} r="4.5" fill={color} stroke="var(--panel)" strokeWidth="2" />}
      </svg>
      {hp && hi != null && (
        <div style={{
          position: "absolute", top: 0, insetInlineStart: `${(hp[0] / W) * 100}%`,
          transform: "translateX(-50%)", background: "var(--panel)", border: "1px solid var(--line)",
          borderRadius: 8, padding: "5px 9px", fontSize: 11, whiteSpace: "nowrap", pointerEvents: "none",
          boxShadow: "0 6px 16px rgba(0,0,0,.4)", color: "var(--text)",
        }}>
          <b style={{ color }}>{data[hi].value}</b> · {data[hi].sub || data[hi].label}
        </div>
      )}
    </div>
  );
}
