// Sentinel Intelligence mark — the Integrate Dynamics starburst (8-point compass),
// purple→blue gradient, drawn as crisp vector so it scales anywhere.
export default function Logo({ size = 26 }: { size?: number }) {
  const petals = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="Sentinel" role="img" style={{ flex: "none" }}>
      <defs>
        <linearGradient id="sentinel-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#4f7cff" />
        </linearGradient>
      </defs>
      <g>
        {petals.map((a, i) => (
          <path key={a} transform={`rotate(${a} 50 50)`} d="M50 8 L55.5 47 L50 56 L44.5 47 Z"
            fill={i % 2 === 0 ? "url(#sentinel-g)" : "#c3ccdd"} opacity={i % 2 === 0 ? 1 : 0.85} />
        ))}
      </g>
      <circle cx="50" cy="50" r="6.5" fill="#4f7cff" />
      <circle cx="50" cy="50" r="3" fill="#fff" opacity=".85" />
    </svg>
  );
}
