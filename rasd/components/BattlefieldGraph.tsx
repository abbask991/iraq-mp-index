"use client";
import { useState } from "react";

const NODE_C: Record<string, string> = {
  entity: "#facc15", politician: "#facc15", ministry: "#facc15", party: "#facc15",
  body: "#facc15", coalition: "#facc15", institution: "#facc15",
  account: "#4f9dff", influencer: "#38bdf8", media: "#a855f7",
  narrative: "#fb923c", campaign: "#f43f5e", hashtag: "#34d6c6",
};
const EDGE_C: Record<string, string> = {
  attacks: "#f43f5e", supports: "#22c55e", amplifies: "#4f9dff", media_covers: "#a855f7",
  narrative_targets: "#fb923c", narrative_supports: "#22c55e", coordinates_with: "#ec4899",
};

// Force-directed battlefield map. Layout (x,y) is precomputed on the backend, so
// this just renders + handles interaction (hover dims, click → side panel).
export default function BattlefieldGraph({ data, onSelect }: { data: any; onSelect: (n: any) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const nodes: any[] = data?.nodes || [];
  const edges: any[] = data?.edges || [];
  const byId: Record<string, any> = {};
  nodes.forEach((n) => (byId[n.id] = n));
  const W = 720, H = 520;
  if (!nodes.length) return <p className="muted">لا توجد بيانات كافية لبناء الخريطة.</p>;

  return (
    <div style={{ overflow: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 600, background: "radial-gradient(circle at 50% 38%, #0e1626, var(--input))", borderRadius: 14 }}>
        {edges.map((e, i) => {
          const a = byId[e.source_id], b = byId[e.target_id];
          if (!a || !b) return null;
          const c = EDGE_C[e.relationship_type] || "#64748b";
          const dim = hover && hover !== a.id && hover !== b.id;
          return <line key={i} x1={a.x * W} y1={a.y * H} x2={b.x * W} y2={b.y * H} stroke={c}
            strokeWidth={Math.max(0.7, Math.min(5, (e.weight || 1) / 3))} strokeOpacity={dim ? 0.1 : 0.5} />;
        })}
        {nodes.map((n) => {
          const r = n.is_center ? 20 : 6 + ((n.influence_score || 0) / 100) * 16;
          const c = NODE_C[n.type] || "#94a3b8";
          const dim = hover && hover !== n.id;
          const showLabel = n.is_center || (n.influence_score || 0) >= 40 || n.type === "narrative" || n.type === "media";
          return (
            <g key={n.id} onClick={() => onSelect(n)} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer", opacity: dim ? 0.35 : 1 }}>
              <circle cx={n.x * W} cy={n.y * H} r={r} fill={c} stroke={n.is_center ? "#fff" : "#0008"} strokeWidth={n.is_center ? 2 : 0.8} />
              {showLabel && <text x={n.x * W} y={n.y * H - r - 3} fontSize={n.is_center ? 12 : 9} fill="var(--text)" textAnchor="middle" fontWeight={n.is_center ? 800 : 600}>
                {String(n.name).length > 18 ? String(n.name).slice(0, 18) + "…" : n.name}</text>}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: 11 }}>
        {[["هجوم", "#f43f5e"], ["دعم", "#22c55e"], ["تضخيم", "#4f9dff"], ["تغطية إعلامية", "#a855f7"], ["سردية", "#fb923c"], ["حملة", "#f43f5e"]].map(([l, c]) => (
          <span key={l}><span style={{ color: c as string, fontWeight: 900 }}>━</span> {l}</span>
        ))}
        <span className="muted">· اضغط أي عقدة للتفاصيل</span>
      </div>
    </div>
  );
}
