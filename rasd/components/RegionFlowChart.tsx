"use client";
type Pt = { t: string; src: number; tgt: number };

// Two volume curves over a shared hourly timeline (source vs target country).
// The earlier curve to rise leads; the gap to the other's rise is the lag.
export default function RegionFlowChart({ series, srcLabel, tgtLabel, leadOnset, followOnset }:
  { series: Pt[]; srcLabel: string; tgtLabel: string; leadOnset?: string; followOnset?: string }) {
  if (!series?.length) return null;
  const SRC = "#22c55e", TGT = "#f59e0b";
  const W = 560, H = 150, padX = 14, padTop = 14, padBot = 22;
  const n = series.length;
  const max = Math.max(1, ...series.map((s) => Math.max(s.src, s.tgt)));
  const x = (i: number) => padX + (n <= 1 ? 0 : (i / (n - 1)) * (W - 2 * padX));
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBot);
  const line = (k: "src" | "tgt") => series.map((s, i) => `${x(i)},${y(s[k])}`).join(" ");
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
          <linearGradient id="rf-src" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={SRC} stopOpacity=".25" /><stop offset="1" stopColor={SRC} stopOpacity="0" /></linearGradient>
          <linearGradient id="rf-tgt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={TGT} stopOpacity=".25" /><stop offset="1" stopColor={TGT} stopOpacity="0" /></linearGradient>
        </defs>
        {lx != null && <line x1={lx} y1={padTop} x2={lx} y2={H - padBot} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" opacity=".7" />}
        {fx != null && <line x1={fx} y1={padTop} x2={fx} y2={H - padBot} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" opacity=".5" />}
        <polygon points={`${padX},${y(0)} ${line("tgt")} ${x(n - 1)},${y(0)}`} fill="url(#rf-tgt)" />
        <polygon points={`${padX},${y(0)} ${line("src")} ${x(n - 1)},${y(0)}`} fill="url(#rf-src)" />
        <polyline points={line("tgt")} fill="none" stroke={TGT} strokeWidth="2" />
        <polyline points={line("src")} fill="none" stroke={SRC} strokeWidth="2" />
        {lx != null && <text x={lx} y={10} fontSize="9" fill="#94a3b8" textAnchor="middle">بداية القائد</text>}
        {[0, n - 1].map((i) => <text key={i} x={x(i)} y={H - 7} fontSize="9" fill="var(--muted)" textAnchor="middle">{fmt(i)}</text>)}
      </svg>
      <div style={{ display: "flex", gap: 14, fontSize: 11.5, marginTop: 2 }}>
        <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: SRC, marginInlineEnd: 4 }} /> {srcLabel}</span>
        <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: TGT, marginInlineEnd: 4 }} /> {tgtLabel}</span>
      </div>
    </div>
  );
}
