"use client";
import { useState } from "react";

// Cinematic threat map for the war room: radar rings + rotating sweep, glowing
// orbs sized by influence, curved gradient edges with flowing dashes, and a red
// pulse halo on high-risk / campaign nodes. Backend precomputes node x/y in [0,1].
const TYPE: Record<string, { c: string; lite: string }> = {
  entity: { c: "#facc15", lite: "#fde68a" }, politician: { c: "#facc15", lite: "#fde68a" },
  ministry: { c: "#facc15", lite: "#fde68a" }, party: { c: "#facc15", lite: "#fde68a" },
  body: { c: "#facc15", lite: "#fde68a" }, coalition: { c: "#facc15", lite: "#fde68a" },
  institution: { c: "#facc15", lite: "#fde68a" },
  narrative: { c: "#fb923c", lite: "#fdba74" }, campaign: { c: "#f43f5e", lite: "#fda4af" },
  account: { c: "#4f9dff", lite: "#93c5fd" }, influencer: { c: "#38bdf8", lite: "#7dd3fc" },
  media: { c: "#a855f7", lite: "#d8b4fe" }, hashtag: { c: "#34d6c6", lite: "#99f6e4" },
};
const EDGE: Record<string, string> = {
  attacks: "#f43f5e", supports: "#22c55e", amplifies: "#4f9dff", media_covers: "#a855f7",
  narrative_targets: "#fb923c", narrative_supports: "#22c55e", coordinates_with: "#ec4899",
};

export default function WarGraph({ data }: { data: any }) {
  const [hover, setHover] = useState<string | null>(null);
  const nodes: any[] = data?.nodes || [];
  const edges: any[] = data?.edges || [];
  const byId: Record<string, any> = {};
  nodes.forEach((n) => (byId[n.id] = n));
  const W = 720, H = 520, cx = W / 2, cy = H / 2;
  if (!nodes.length)
    return <div className="muted" style={{ padding: 30, textAlign: "center" }}>لا بيانات شبكة بعد.</div>;

  // Radar-blip layout: distribute nodes on concentric rings INSIDE the radar
  // (centered), so they sit within the circles instead of scattering to corners.
  const ringR = [0.17, 0.29, 0.40].map((f) => f * H);
  const _pos = new Map<string, [number, number]>();
  const ringed: any[][] = [[], [], []];
  let ri = 0;
  nodes.forEach((n) => {
    if (n.is_center) { _pos.set(n.id, [cx, cy]); return; }
    ringed[ri % 3].push(n); ri++;
  });
  ringed.forEach((ring, idx) => {
    const r = ringR[idx];
    ring.forEach((n, k) => {
      const ang = -Math.PI / 2 + (k / Math.max(1, ring.length)) * 2 * Math.PI + idx * 0.6;
      _pos.set(n.id, [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
    });
  });
  const px = (n: any) => (_pos.get(n.id) || [cx, cy])[0];
  const py = (n: any) => (_pos.get(n.id) || [cx, cy])[1];
  const hot = (n: any) => (n.risk_score || 0) >= 60 || n.type === "campaign";

  return (
    <div className="warg">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="warg-svg"
        preserveAspectRatio="xMidYMid meet"
        style={{ maxWidth: 760, maxHeight: 520, display: "block", margin: "0 auto" }}>
        <defs>
          <radialGradient id="warg-bg" cx="50%" cy="42%" r="70%">
            <stop offset="0%" stopColor="#13203a" /><stop offset="100%" stopColor="#0a0e17" />
          </radialGradient>
          <linearGradient id="warg-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#34d6c6" stopOpacity="0" />
            <stop offset="100%" stopColor="#34d6c6" stopOpacity="0.28" />
          </linearGradient>
          <filter id="warg-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {Object.entries(TYPE).map(([k, v]) => (
            <radialGradient key={k} id={`warg-n-${k}`} cx="38%" cy="35%" r="70%">
              <stop offset="0%" stopColor={v.lite} /><stop offset="100%" stopColor={v.c} />
            </radialGradient>
          ))}
        </defs>

        <rect x="0" y="0" width={W} height={H} rx="14" fill="url(#warg-bg)" />

        {/* radar rings + crosshair */}
        <g stroke="rgba(120,150,200,.13)" strokeWidth="1" fill="none">
          {[0.16, 0.3, 0.44].map((r) => <circle key={r} cx={cx} cy={cy} r={r * H} />)}
          <line x1={cx} y1="14" x2={cx} y2={H - 14} />
          <line x1="14" y1={cy} x2={W - 14} y2={cy} />
        </g>
        {/* rotating sweep */}
        <g className="warg-sweep-g" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <path d={`M${cx} ${cy} L${cx + 0.44 * H} ${cy} A${0.44 * H} ${0.44 * H} 0 0 0 ${cx + 0.44 * H * Math.cos(-0.9)} ${cy + 0.44 * H * Math.sin(-0.9)} Z`}
            fill="url(#warg-sweep)" />
          <line x1={cx} y1={cy} x2={cx + 0.44 * H} y2={cy} stroke="#34d6c6" strokeOpacity="0.5" strokeWidth="1.5" />
        </g>

        {/* edges — curved + flowing */}
        {edges.map((e, i) => {
          const a = byId[e.source_id], b = byId[e.target_id];
          if (!a || !b) return null;
          const x1 = px(a), y1 = py(a), x2 = px(b), y2 = py(b);
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          const dx = x2 - x1, dy = y2 - y1;
          const cxp = mx - dy * 0.18, cyp = my + dx * 0.18;  // perpendicular bow
          const c = EDGE[e.relationship_type] || "#64748b";
          const dim = hover && hover !== a.id && hover !== b.id;
          return (
            <path key={i} d={`M${x1} ${y1} Q${cxp} ${cyp} ${x2} ${y2}`} fill="none" stroke={c}
              strokeWidth={Math.max(1, Math.min(4, (e.weight || 1) / 3))} strokeOpacity={dim ? 0.06 : 0.55}
              className="warg-edge" strokeLinecap="round" />
          );
        })}

        {/* nodes */}
        {nodes.map((n) => {
          const r = n.is_center ? 19 : 6 + ((n.influence_score || 0) / 100) * 15;
          const t = TYPE[n.type] || { c: "#94a3b8", lite: "#cbd5e1" };
          const dim = hover && hover !== n.id;
          const show = n.is_center || (n.influence_score || 0) >= 38 || n.type === "narrative" || n.type === "campaign";
          return (
            <g key={n.id} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer", opacity: dim ? 0.32 : 1, transition: "opacity .2s" }}>
              {hot(n) && <circle cx={px(n)} cy={py(n)} r={r} fill="none" stroke="#f43f5e" strokeWidth="2" className="warg-pulse" />}
              <circle cx={px(n)} cy={py(n)} r={r} fill={`url(#warg-n-${TYPE[n.type] ? n.type : "entity"})`}
                stroke="rgba(255,255,255,.25)" strokeWidth="0.8" filter="url(#warg-glow)" />
              {show && (
                <text x={px(n)} y={py(n) - r - 4} fontSize={n.is_center ? 12.5 : 9.5} fill="#e8eefc"
                  textAnchor="middle" fontWeight={n.is_center ? 800 : 600}
                  style={{ paintOrder: "stroke", stroke: "#0a0e17", strokeWidth: 2.5 }}>
                  {String(n.name).length > 18 ? String(n.name).slice(0, 18) + "…" : n.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="warg-legend">
        {[["كيان", "#facc15"], ["سردية", "#fb923c"], ["حملة", "#f43f5e"], ["مؤثّر", "#38bdf8"], ["إعلام", "#a855f7"]].map(([l, c]) => (
          <span key={l}><i style={{ background: c as string }} /> {l}</span>
        ))}
        <span className="muted" style={{ marginInlineStart: "auto" }}>● النبض الأحمر = خطر مرتفع</span>
      </div>
    </div>
  );
}
