"use client";
// Dependency-free, RTL-aware chart marks for the console.
//
// Colour decisions here were validated with the dataviz palette checker, not by eye:
//  - Diverging pair blue #4f9dff ↔ rose #f43f5e → ΔE 24.6 under deuteranopia (PASS).
//    The intuitive green↔rose pair scores ΔE 6.4 (deutan) — a colourblind reader
//    cannot separate them — so it is not used for the diverging encoding.
//  - Ranked bars are ONE series, so every bar gets ONE colour. Colouring each bar by
//    its own severity would double-encode length as hue and burn the free channel;
//    the severity badge beside each row carries that status, with a text label.

const DIV_POS = "#4f9dff"; // gain / positive  (cool pole)
const DIV_NEG = "#f43f5e"; // drop / negative  (warm pole)
const DIV_MID = "#64748b"; // neutral midpoint — gray, never a hue

/* ---------- sentiment: diverging stacked bar centred on neutral ----------
   The canonical form for an ordered-scale share (negative ↔ neutral ↔ positive). */
export function SentimentBar({ pos, neg, neu }: { pos: number; neg: number; neu: number }) {
  const total = pos + neg + neu || 1;
  const seg = [
    { v: neg, c: DIV_NEG, l: "سلبي" },
    { v: neu, c: DIV_MID, l: "محايد" },
    { v: pos, c: DIV_POS, l: "إيجابي" },
  ];
  return (
    <div className="ch-sent">
      <div className="ch-sent-bar">
        {seg.map((s, i) => (
          <span
            key={i}
            className="ch-sent-seg"
            style={{ width: `${(s.v / total) * 100}%`, background: s.c }}
            title={`${s.l}: ${s.v.toLocaleString("en-US")} (${Math.round((s.v / total) * 100)}%)`}
          />
        ))}
      </div>
      {/* every value is readable without hovering — the tooltip only enhances */}
      <div className="ch-sent-legend">
        {seg.map((s, i) => (
          <span key={i}>
            <i style={{ background: s.c }} />
            {s.l} <b className="u-num">{Math.round((s.v / total) * 100)}%</b>
            <span className="u-fine u-num"> ({s.v.toLocaleString("en-US")})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- ranked horizontal bars — one measure across nominal entities ---------- */
export function RankBars({
  data, max, unit = "",
}: { data: { label: string; value: number; note?: string }[]; max?: number; unit?: string }) {
  const hi = max ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="ch-rank" role="img" aria-label="ترتيب حسب القيمة">
      {data.map((d, i) => (
        <div className="ch-rank-row" key={i} title={`${d.label}: ${d.value}${unit}`}>
          <span className="ch-rank-l">{d.label}</span>
          <span className="ch-rank-track">
            <span className="ch-rank-fill" style={{ width: `${(d.value / hi) * 100}%` }} />
          </span>
          <span className="ch-rank-v u-num">{d.value}{unit}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- diverging bars — polarity around a zero baseline ---------- */
export function DeltaBars({
  data, unit = "",
}: { data: { label: string; value: number; note?: string }[]; unit?: string }) {
  const span = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <div className="ch-div" role="img" aria-label="التغيّر مقابل خط الصفر">
      <div className="ch-div-legend">
        <span><i style={{ background: DIV_POS }} /> تحسّن</span>
        <span><i style={{ background: DIV_NEG }} /> تراجع</span>
      </div>
      {data.map((d, i) => {
        const pos = d.value >= 0;
        return (
          <div className="ch-div-row" key={i} title={`${d.label}: ${pos ? "+" : ""}${d.value}${unit}`}>
            <span className="ch-div-l">{d.label}</span>
            <span className="ch-div-plot">
              <span className="ch-div-axis" />
              <span
                className="ch-div-fill"
                data-pos={pos ? "1" : "0"}
                style={{
                  width: `${(Math.abs(d.value) / span) * 50}%`,
                  background: pos ? DIV_POS : DIV_NEG,
                  [pos ? "insetInlineStart" : "insetInlineEnd" as any]: "50%",
                }}
              />
            </span>
            {/* signed label + direction are the secondary encodings — never colour alone */}
            <span className="ch-div-v u-num" style={{ color: pos ? DIV_POS : DIV_NEG }}>
              {pos ? "+" : ""}{d.value}{unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}
