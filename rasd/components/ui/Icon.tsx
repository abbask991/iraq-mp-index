// 24×24 stroke icons — replaces the 543 emojis scattered across the product.
// Same inline-SVG pattern already proven on the landing page (app/(site)/page.tsx).

const P: Record<string, string> = {
  target:      "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  brain:       "M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a3 3 0 0 0 3 3h1V3H9Zm6 0a3 3 0 0 1 3 3v1a3 3 0 0 1 0 6v1a3 3 0 0 1-3 3h-1V3h1Z",
  alert:       "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  siren:       "M12 2a5 5 0 0 0-5 5v5h10V7a5 5 0 0 0-5-5ZM4 17h16M6 21h12",
  trendUp:     "M22 7l-8.5 8.5-5-5L2 17M16 7h6v6",
  trendDown:   "M22 17l-8.5-8.5-5 5L2 7M16 17h6v-6",
  fire:        "M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 .5-2S7 10 7 13a5 5 0 0 0 10 0c0-5-5-11-5-11Z",
  megaphone:   "M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Zm14-5v12a5 5 0 0 0 0-12Z",
  refresh:     "M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6",
  check:       "M20 6 9 17l-5-5",
  clip:        "M21 12.5 12.5 21a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.5 3.5 0 0 1 5 5l-8.5 8.5a1.5 1.5 0 0 1-2.2-2.2l7.8-7.8",
  bolt:        "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  arrowLeft:   "M19 12H5m7-7-7 7 7 7",
  flask:       "M9 2v6L3.5 18A2 2 0 0 0 5.2 21h13.6a2 2 0 0 0 1.7-3L15 8V2M9 2h6M7.5 14h9",
  chevronL:    "M15 18l-6-6 6-6",
};

export type IconName = keyof typeof P;

export default function Icon({
  name, size = 16, className = "", strokeWidth = 2, style,
}: { name: IconName; size?: number; className?: string; strokeWidth?: number; style?: React.CSSProperties }) {
  return (
    <svg
      className={`u-icon ${className}`} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}
    >
      <path d={P[name]} />
    </svg>
  );
}
