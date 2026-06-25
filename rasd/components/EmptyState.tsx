// Polished empty / error state — so a page never looks broken in a demo.
export default function EmptyState({
  title, subtitle, tone = "empty", action,
}: {
  title: string; subtitle?: string; tone?: "empty" | "error" | "building";
  action?: { label: string; onClick: () => void };
}) {
  const color = tone === "error" ? "#f43f5e" : tone === "building" ? "#f59e0b" : "var(--accent)";
  const icon = tone === "error"
    ? "M12 9v4m0 4h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3l-8-14a2 2 0 00-3.4 0z"
    : tone === "building"
      ? "M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z"
      : "M3 7h18M3 12h18M3 17h12";
  return (
    <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ width: 56, height: 56, margin: "0 auto 14px", borderRadius: 16, display: "grid",
        placeItems: "center", color, background: `${color}1a`, border: `1px solid ${color}44` }}>
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"
          strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
      </div>
      <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
      {subtitle && <div className="muted" style={{ fontSize: 13, marginTop: 6, maxWidth: 440, marginInline: "auto", lineHeight: 1.7 }}>{subtitle}</div>}
      {action && <button className="btn" style={{ marginTop: 14 }} onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}
