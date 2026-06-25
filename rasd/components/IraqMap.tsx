"use client";
import { useState } from "react";

// Dot map of Iraq's 18 governorates — circle size + color by activity. Coords
// are normalized positions (≈ real geography) so it reads as a recognizable map
// without boundary SVG data.
export default function IraqMap({ geo }: { geo: any }) {
  const govs: any[] = geo?.governorates || [];
  const [hi, setHi] = useState<string | null>(null);
  if (!govs.length) return null;
  const max = Math.max(1, ...govs.map((g) => g.count));
  const W = 360, H = 420, P = 28;
  const X = (x: number) => P + x * (W - P * 2);
  const Y = (y: number) => P + y * (H - P * 2);

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 360, background: "var(--input)", borderRadius: 14 }}>
        {govs.map((g) => {
          const r = 5 + (g.count / max) * 20;
          const t = g.count ? 0.22 + 0.78 * (g.count / max) : 0.1;
          const active = hi === g.id;
          return (
            <g key={g.id} onMouseEnter={() => setHi(g.id)} onMouseLeave={() => setHi(null)} style={{ cursor: "default" }}>
              <circle cx={X(g.x)} cy={Y(g.y)} r={r} fill={`rgba(79,157,255,${t})`}
                stroke={active ? "#34d6c6" : "rgba(79,157,255,.6)"} strokeWidth={active ? 2 : 1} />
              {(g.count > 0 || active) && (
                <text x={X(g.x)} y={Y(g.y) + 3} fontSize="9" fill="#fff" textAnchor="middle" fontWeight="700">{g.count || ""}</text>
              )}
              <text x={X(g.x)} y={Y(g.y) - r - 3} fontSize="8.5" fill="var(--muted)" textAnchor="middle">{g.name}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          الأكثر نشاطاً ({geo.located} حساب محدّد الموقع من {geo.total_accounts}):
        </div>
        {govs.filter((g) => g.count > 0).slice(0, 8).map((g) => (
          <div className="srcrow" key={g.id} style={{ marginBottom: 6 }}>
            <div style={{ width: 90, fontSize: 13 }}>{g.name}</div>
            <div className="bar"><i style={{ width: `${(g.count / max) * 100}%` }} /></div>
            <div className="num">{g.count}</div>
          </div>
        ))}
        {!govs.some((g) => g.count > 0) && <span className="muted">لا مواقع محدّدة في هذه العيّنة.</span>}
      </div>
    </div>
  );
}
