"use client";
import { SkelCards } from "@/components/Skeleton";
import { useBrand } from "../useBrand";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const sevC = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : /متوسط/.test(l || "") ? "#f59e0b" : "#22c55e");

/** Moved verbatim from /corporate/crisis. Host owns brand + demo + fetch. */
export default function CrisisView({ brand, demo }: { brand: string; demo: boolean }) {
  const { d, loading } = useBrand("crisis", brand, demo);
  if (loading) return <SkelCards count={3} />;
  if (d?.empty) return <div className="cbox">{d.note}</div>;
  if (!d) return null;
  const crises = d?.crises || [];
  return (
    <>
      {d && !crises.length && <div className="cbox">{d.note || "لا أزمات نشطة حالياً — الوضع مستقر."}</div>}
      {crises.length > 0 && (
        <>
          <div className="cbox" style={{ marginBottom: 12, borderInlineStart: `4px solid ${sevC(d.highest)}` }}>
            <b>{d.count}</b> أزمات نشطة · الأعلى حدّة: <b style={{ color: sevC(d.highest) }}>{d.highest}</b>
          </div>
          {crises.map((c: any, i: number) => (
            <div key={i} className="cbox" style={{ marginBottom: 10, borderInlineStart: `4px solid ${sevC(c.severity)}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <b style={{ fontSize: 14 }}> {c.title}</b>
                <span style={{ display: "flex", gap: 6 }}><span className="chip" style={{ fontSize: 10.5, color: sevC(c.severity) }}>{c.severity}</span><span className="muted" style={{ fontSize: 11 }}>{c.time}</span></span>
              </div>
              <div style={{ fontSize: 13, marginTop: 5 }}>{c.detail}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{fmt(c.evidence_count)} دليل</div>
              <div style={{ fontSize: 12.5, marginTop: 6, padding: "6px 10px", borderRadius: 8, background: "color-mix(in srgb,#22c55e 8%,transparent)" }}>▸ <b>الإجراء:</b> {c.recommended_action}</div>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </>
  );
}
