"use client";

// Emotion heatmap — entities (rows) × 8 emotions (columns), cell intensity = share.
// The classic "mood board" of a war room: where anger/fear/trust concentrate.
const EMO: { k: string; ar: string; c: string }[] = [
  { k: "anger", ar: "غضب", c: "#f43f5e" }, { k: "fear", ar: "خوف", c: "#fb923c" },
  { k: "frustration", ar: "إحباط", c: "#f59e0b" }, { k: "sadness", ar: "حزن", c: "#6366f1" },
  { k: "disgust", ar: "اشمئزاز", c: "#a855f7" }, { k: "sarcasm", ar: "سخرية", c: "#ec4899" },
  { k: "trust", ar: "ثقة", c: "#22c55e" }, { k: "joy", ar: "فرح", c: "#34d6c6" },
];

export default function EmotionHeatmap({ data }: { data: { entity: string; emotions: Record<string, number> }[] }) {
  const rows = (data || []).filter((r) => r.emotions).slice(0, 8);
  if (!rows.length) return <div className="muted" style={{ fontSize: 13, padding: 8 }}>تُجمَّع بيانات المشاعر حالياً…</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="emo-tbl">
        <thead>
          <tr>
            <th />
            {EMO.map((e) => <th key={e.k} style={{ color: e.c }}>{e.ar}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="emo-ent">{r.entity}</td>
              {EMO.map((e) => {
                const v = Math.max(0, Math.min(1, r.emotions[e.k] || 0));
                return (
                  <td key={e.k}>
                    <span className="emo-cell" title={`${e.ar}: ${Math.round(v * 100)}%`}
                      style={{ background: e.c, opacity: v < 0.04 ? 0.06 : 0.18 + v * 0.82 }}>
                      {v >= 0.18 ? Math.round(v * 100) : ""}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
