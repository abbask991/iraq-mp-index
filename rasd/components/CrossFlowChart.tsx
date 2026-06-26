"use client";
type Pt = { t: string; iq: number; sy: number };

// Two volume curves (Iraq vs Syria) over a shared hourly timeline. The earlier
// curve to rise is the influencer; the gap to the other's rise is the lag.
const IQ = "#22c55e", SY = "#f59e0b";

export default function CrossFlowChart({ series, leadOnset, followOnset }: { series: Pt[]; leadOnset?: string; followOnset?: string }) {
  if (!series?.length) return null;
  const W = 560, H = 150, padX = 14, padTop = 14, padBot = 22;
  const n = series.length;
  const max = Math.max(1, ...series.map((s) => Math.max(s.iq, s.sy)));
  const x = (i: number) => padX + (n <= 1 ? 0 : (i / (n - 1)) * (W - 2 * padX));
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBot);
  const line = (k: "iq" | "sy") => series.map((s, i) => `${x(i)},${y(s[k])}`).join(" ");
  const times = series.map((s) => new Date(s.t).getTime());
  const markX = (iso?: string) => {
    if (!iso) return null;
    const tt = new Date(iso).getTime(); let bi = 0, bd = Infinity;
    times.forEach((t, i) => { const dd = Math.abs(t - tt); if (dd < bd) { bd = dd; bi = i; } });
    return x(bi);
  };
  const lx = markX(leadOnset), fx = markX(followOnset);
  const fmt = (i: number) => new Date(series[i].t).toLocaleString("ar", { day: "numeric", hour: "2-digit" });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="cf-iq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={IQ} stopOpacity=".25" /><stop offset="1" stopColor={IQ} stopOpacity="0" /></linearGradient>
          <linearGradient id="cf-sy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={SY} stopOpacity=".25" /><stop offset="1" stopColor={SY} stopOpacity="0" /></linearGradient>
        </defs>
        {lx != null && <line x1={lx} y1={padTop} x2={lx} y2={H - padBot} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" opacity=".7" />}
        {fx != null && <line x1={fx} y1={padTop} x2={fx} y2={H - padBot} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" opacity=".5" />}
        <polygon points={`${padX},${y(0)} ${line("sy")} ${x(n - 1)},${y(0)}`} fill="url(#cf-sy)" />
        <polygon points={`${padX},${y(0)} ${line("iq")} ${x(n - 1)},${y(0)}`} fill="url(#cf-iq)" />
        <polyline points={line("sy")} fill="none" stroke={SY} strokeWidth="2" />
        <polyline points={line("iq")} fill="none" stroke={IQ} strokeWidth="2" />
        {lx != null && <text x={lx} y={10} fontSize="9" fill="#94a3b8" textAnchor="middle">بداية القائد</text>}
        {[0, n - 1].map((i) => <text key={i} x={x(i)} y={H - 7} fontSize="9" fill="var(--muted)" textAnchor="middle">{fmt(i)}</text>)}
      </svg>
      <div style={{ display: "flex", gap: 14, fontSize: 11.5, marginTop: 2 }}>
        <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: IQ, marginInlineEnd: 4 }} /> العراق</span>
        <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: SY, marginInlineEnd: 4 }} /> سوريا</span>
      </div>
    </div>
  );
}
