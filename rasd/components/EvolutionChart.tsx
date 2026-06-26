"use client";
type Pt = { t: string; count: number; neg?: number };
type TP = { at: string; type: string; volume?: number };

const TP_LABEL: Record<string, string> = {
  velocity_spike: "قفزة في الحجم", sentiment_shift: "تحوّل بالنبرة", peak_detected: "ذروة",
  first_influencer_amplification: "أول تضخيم", campaign_alert: "إنذار حملة", official_response: "رد رسمي",
};
const TP_COLOR: Record<string, string> = {
  velocity_spike: "#fb923c", sentiment_shift: "#a78bfa", peak_detected: "#f43f5e",
  first_influencer_amplification: "#4f9dff", campaign_alert: "#f43f5e", official_response: "#22c55e",
};

// Volume-over-time curve with the turning points pinned onto it — so analysts see
// WHERE the tone shifted, the volume jumped, and the peak hit, on the actual curve.
export default function EvolutionChart({ series, turningPoints = [] }: { series: Pt[]; turningPoints?: TP[] }) {
  if (!series?.length) return null;
  const W = 680, H = 200, padX = 16, padTop = 26, padBot = 28;
  const n = series.length;
  const max = Math.max(1, ...series.map((s) => s.count));
  const x = (i: number) => padX + (n <= 1 ? 0 : (i / (n - 1)) * (W - 2 * padX));
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBot);
  const times = series.map((s) => new Date(s.t).getTime());
  const line = series.map((s, i) => `${x(i)},${y(s.count)}`).join(" ");
  const area = `${padX},${y(0)} ${line} ${x(n - 1)},${y(0)}`;
  const nearest = (at: string) => {
    const tt = new Date(at).getTime(); let bi = 0, bd = Infinity;
    times.forEach((t, i) => { const dd = Math.abs(t - tt); if (dd < bd) { bd = dd; bi = i; } });
    return bi;
  };
  const ticks = Array.from(new Set([0, Math.floor(n / 2), n - 1]));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="evg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity=".34" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#evg)" />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" />
      {turningPoints.map((tp, i) => {
        const idx = nearest(tp.at); const px = x(idx); const py = y(series[idx].count);
        const c = TP_COLOR[tp.type] || "#94a3b8";
        return (
          <g key={i}>
            <line x1={px} y1={py} x2={px} y2={H - padBot} stroke={c} strokeWidth="1" strokeDasharray="3 3" opacity=".55" />
            <circle cx={px} cy={py} r="5.5" fill={c} stroke="var(--panel)" strokeWidth="2" />
            <text x={px} y={py - 10} fontSize="10" fill={c} textAnchor="middle" fontWeight="800">{TP_LABEL[tp.type] || tp.type}</text>
          </g>
        );
      })}
      {ticks.map((i) => (
        <text key={i} x={x(i)} y={H - 9} fontSize="9.5" fill="var(--muted)" textAnchor="middle">
          {new Date(series[i].t).toLocaleString("ar", { month: "numeric", day: "numeric", hour: "2-digit" })}
        </text>
      ))}
    </svg>
  );
}
