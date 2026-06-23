"use client";

export type Range = "day" | "week" | "month" | "year";
const RANGES: [Range, string][] = [["day", "يوم"], ["week", "أسبوع"], ["month", "شهر"], ["year", "سنة"]];

export default function RangeSelect({ value, onChange, disabled }: {
  value: Range; onChange: (v: Range) => void; disabled?: boolean;
}) {
  return (
    <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span className="muted" style={{ fontSize: 12 }}>المدة:</span>
      {RANGES.map(([v, l]) => (
        <button key={v} className={`btn ${value === v ? "" : "ghost"}`} style={{ padding: "4px 10px", fontSize: 12 }}
          onClick={() => onChange(v)} disabled={disabled}>{l}</button>
      ))}
    </span>
  );
}
