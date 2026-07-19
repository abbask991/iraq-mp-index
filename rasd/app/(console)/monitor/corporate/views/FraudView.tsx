"use client";
import { SkelCards } from "@/components/Skeleton";
import { useBrand } from "../useBrand";

const risk = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : "#f59e0b");

/** Moved verbatim from /corporate/fraud. Host owns brand + demo + fetch. */
export default function FraudView({ brand, demo }: { brand: string; demo: boolean }) {
  const { d, loading } = useBrand("fraud", brand, demo);
  if (loading) return <SkelCards count={3} />;
  if (d?.empty) return <div className="cbox">{d.note}</div>;
  if (!d) return null;
  return (
    <>
      {d?.empty && <div className="cbox">{d.note}</div>}
      {d && !d.empty && (
        <>
          <div className="cbox" style={{ marginBottom: 12 }}><b>{d.suspects_found}</b> صفحات مشبوهة تنتحل «{d.brand}».</div>
          {(d.suspects || []).map((s: any, i: number) => (
            <div key={i} className="cbox" style={{ marginBottom: 10, borderInlineStart: `4px solid ${risk(s.risk)}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <b style={{ fontSize: 14 }}>{s.page}</b>
                <span style={{ display: "flex", gap: 6 }}><span className="chip" style={{ fontSize: 10.5 }}>تشابه {s.similarity}%</span><span className="chip" style={{ fontSize: 10.5, color: risk(s.risk) }}>خطر {s.risk}</span></span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>{(s.signals || []).map((g: string, j: number) => <span key={j} className="chip" style={{ fontSize: 11, color: "#f43f5e" }}>{g}</span>)}</div>
            </div>
          ))}
          {d.recommended_action && <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #22c55e" }}>▸ <b>التوصية:</b> {d.recommended_action}</div>}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </>
  );
}
