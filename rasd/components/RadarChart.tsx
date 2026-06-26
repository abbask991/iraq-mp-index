"use client";

// Spider/radar chart for multi-dimensional risk — the classic "situation matrix"
// shape. Values 0-100. Filled translucent polygon + glowing vertices.
export default function RadarChart({ axes, color = "#f43f5e" }: { axes: { label: string; value: number }[]; color?: string }) {
  const n = axes.length;
  if (n < 3) return null;
  const W = 320, H = 280, cx = W / 2, cy = H / 2 + 4, R = 96;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const rings = [0.25, 0.5, 0.75, 1];
  const poly = axes.map((ax, i) => pt(i, R * Math.min(100, Math.max(0, ax.value)) / 100).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 340, display: "block", margin: "0 auto" }}>
      <defs>
        <radialGradient id="radar-fill" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0.12" />
        </radialGradient>
      </defs>
      {/* grid rings */}
      {rings.map((rr) => (
        <polygon key={rr} points={axes.map((_, i) => pt(i, R * rr).join(",")).join(" ")}
          fill="none" stroke="rgba(130,150,190,.18)" strokeWidth="1" />
      ))}
      {/* axes */}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(130,150,190,.2)" strokeWidth="1" />;
      })}
      {/* value polygon */}
      <polygon points={poly} fill="url(#radar-fill)" stroke={color} strokeWidth="2" strokeLinejoin="round"
        className="radar-poly" />
      {/* vertices */}
      {axes.map((ax, i) => {
        const [x, y] = pt(i, R * Math.min(100, Math.max(0, ax.value)) / 100);
        return <circle key={i} cx={x} cy={y} r="3.5" fill={color} stroke="#0a0e17" strokeWidth="1.5" />;
      })}
      {/* labels */}
      {axes.map((ax, i) => {
        const [x, y] = pt(i, R + 22);
        return (
          <text key={i} x={x} y={y + 4} fontSize="11" fill="var(--muted)" textAnchor="middle" fontWeight="700">
            {ax.label} <tspan fill={color} fontWeight="900">{ax.value}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
