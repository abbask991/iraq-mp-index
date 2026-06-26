"use client";

// Regional influence map — Iraq at the hub, neighbours around a ring. Arrow
// thickness = influence strength; arrowhead shows direction (who leads whom).
const strColor = (v: number) => (v >= 55 ? "#f43f5e" : v >= 35 ? "#fb923c" : "#eab308");

export default function RegionMap({ data, onPick }: { data: any; onPick: (cc: string) => void }) {
  const edges: any[] = data?.edges || [];
  if (!edges.length) return <div className="muted" style={{ padding: 24, textAlign: "center" }}>لا بيانات خريطة بعد.</div>;
  const W = 640, H = 460, cx = W / 2, cy = H / 2, R = 168;
  const n = edges.length;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 520, background: "radial-gradient(circle at 50% 50%, #10192e, var(--input))", borderRadius: 16 }}>
        <defs>
          <marker id="rm-arr" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
            <path d="M0,0 L9,4.5 L0,9 Z" fill="#cbd5e1" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          const nx = cx + R * Math.cos(a), ny = cy + R * Math.sin(a);
          const c = strColor(e.strength);
          const w = Math.max(1.5, Math.min(8, e.strength / 9));
          // direction: IQ leads → arrow points OUT to neighbour; other leads → arrow toward hub; mutual → both
          const lead = e.lead;
          const out = lead === "IQ" || lead === "MUTUAL";
          const into = lead !== "IQ"; // neighbour or mutual influences IQ
          const ux = (nx - cx) / R, uy = (ny - cy) / R;
          const hubEdge = [cx + ux * 34, cy + uy * 34];
          const nodeEdge = [nx - ux * 30, ny - uy * 30];
          return (
            <g key={e.country} style={{ cursor: "pointer" }} onClick={() => onPick(e.country)}>
              <line x1={hubEdge[0]} y1={hubEdge[1]} x2={nodeEdge[0]} y2={nodeEdge[1]}
                stroke={c} strokeWidth={w} strokeOpacity={0.8}
                markerEnd={out ? "url(#rm-arr)" : undefined} markerStart={into ? "url(#rm-arr)" : undefined} />
              <text x={(hubEdge[0] + nodeEdge[0]) / 2} y={(hubEdge[1] + nodeEdge[1]) / 2 - 5}
                fontSize="11" fill={c} textAnchor="middle" fontWeight="800">{e.strength}</text>
              <circle cx={nx} cy={ny} r="28" fill="#0f1830" stroke={c} strokeWidth="2" />
              <text x={nx} y={ny - 2} fontSize="18" textAnchor="middle">{e.flag}</text>
              <text x={nx} y={ny + 14} fontSize="9.5" fill="#cbd5e1" textAnchor="middle" fontWeight="700">{e.name}</text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="34" fill="#1e3a5f" stroke="#4f9dff" strokeWidth="2.5" />
        <text x={cx} y={cy - 3} fontSize="22" textAnchor="middle">🇮🇶</text>
        <text x={cx} y={cy + 14} fontSize="11" fill="#fff" textAnchor="middle" fontWeight="800">العراق</text>
      </svg>
      <div className="muted" style={{ fontSize: 11, marginTop: 6, textAlign: "center" }}>
        السهم = اتجاه التأثير · السماكة والرقم = قوّته · اضغط أي دولة للتفاصيل
      </div>
    </div>
  );
}
