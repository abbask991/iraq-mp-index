"use client";
import { useState } from "react";

// Coordinated-account network. Backend precomputes x/y (cell-clustered circular
// layout), so this just renders + handles hover. Node colour = bot suspicion,
// size = degree (how tightly it's woven in); pink "strong" edges = accounts that
// co-pushed the SAME content in ≥2 rings (repeated coordination, not chance).
function suspColor(s: number) {
  return s >= 70 ? "#f43f5e" : s >= 50 ? "#fb923c" : s >= 30 ? "#eab308" : "#4f9dff";
}

export default function CoordNetwork({ data }: { data: any }) {
  const [hover, setHover] = useState<string | null>(null);
  const nodes: any[] = data?.nodes || [];
  const edges: any[] = data?.edges || [];
  const byId: Record<string, any> = {};
  nodes.forEach((n) => (byId[n.id] = n));
  const W = 720, H = 500;
  if (!nodes.length)
    return <p className="muted">لا توجد حسابات متشابكة كافية لبناء الشبكة — النشاط يبدو عضوياً.</p>;

  return (
    <div style={{ overflow: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ minWidth: 600, background: "radial-gradient(circle at 50% 40%, #1a0e1a, var(--input))", borderRadius: 14 }}>
        {edges.map((e, i) => {
          const a = byId[e.source], b = byId[e.target];
          if (!a || !b) return null;
          const dim = hover && hover !== a.id && hover !== b.id;
          return <line key={i} x1={a.x * W} y1={a.y * H} x2={b.x * W} y2={b.y * H}
            stroke={e.strong ? "#ec4899" : "#64748b"}
            strokeWidth={e.strong ? Math.min(5, 1.5 + e.weight) : 1}
            strokeOpacity={dim ? 0.08 : e.strong ? 0.75 : 0.4} />;
        })}
        {nodes.map((n) => {
          const r = 6 + Math.min(18, (n.degree || 1) * 2.2);
          const c = suspColor(n.suspicion || 0);
          const dim = hover && hover !== n.id;
          const show = (n.degree || 0) >= 3 || hover === n.id;
          return (
            <g key={n.id} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer", opacity: dim ? 0.3 : 1 }}>
              <circle cx={n.x * W} cy={n.y * H} r={r} fill={c} fillOpacity={0.85}
                stroke="#0009" strokeWidth={0.8} />
              {(n.suspicion || 0) >= 70 && <circle cx={n.x * W} cy={n.y * H} r={r + 3}
                fill="none" stroke={c} strokeWidth={1} strokeOpacity={0.5} />}
              {show && <text x={n.x * W} y={n.y * H - r - 3} fontSize={9.5} fill="var(--text)"
                textAnchor="middle" fontWeight={700}>@{String(n.username).slice(0, 16)}</text>}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: 11, alignItems: "center" }}>
        <span><span style={{ color: "#ec4899", fontWeight: 900 }}>━</span> رابط قوي (تنسيق متكرّر)</span>
        <span><span style={{ color: "#64748b", fontWeight: 900 }}>━</span> رابط مفرد</span>
        <span><span style={{ color: "#f43f5e", fontWeight: 900 }}>●</span> اشتباه عالٍ</span>
        <span><span style={{ color: "#eab308", fontWeight: 900 }}>●</span> متوسط</span>
        <span><span style={{ color: "#4f9dff", fontWeight: 900 }}>●</span> منخفض</span>
        <span className="muted">· الحجم = كثافة التشابك</span>
      </div>
    </div>
  );
}
