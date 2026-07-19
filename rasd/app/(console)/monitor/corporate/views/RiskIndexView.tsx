"use client";
import { SkelCards } from "@/components/Skeleton";
import { useBrand } from "../useBrand";

const lvlColor = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : /متوسط/.test(l || "") ? "#f59e0b" : "#22c55e");
const COMP_AR: Record<string, string> = { reputation_risk: "خطر السمعة", complaint_pressure: "ضغط الشكاوى", sentiment_risk: "خطر المشاعر", fraud_exposure: "التعرّض للاحتيال", crisis_signal: "إشارة أزمة" };

/** Moved verbatim from /corporate/risk-index. Host owns brand + demo + fetch. */
export default function RiskIndexView({ brand, demo }: { brand: string; demo: boolean }) {
  const { d, loading } = useBrand("risk-index", brand, demo);
  if (loading) return <SkelCards count={3} />;
  if (d?.empty) return <div className="cbox">{d.note}</div>;
  if (!d) return null;
  return (
    <>
      {d?.empty && <div className="cbox">{d.note}</div>}
      {d && !d.empty && (
        <>
          <div className="cbox" style={{ marginBottom: 14, textAlign: "center", borderInlineStart: `4px solid ${lvlColor(d.level)}` }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: lvlColor(d.level) }}>{d.risk_index}<span style={{ fontSize: 18 }}>/100</span></div>
            <div style={{ fontSize: 14 }}>مؤشر المخاطر — <b style={{ color: lvlColor(d.level) }}>{d.level}</b></div>
          </div>
          {d.components && (
            <div className="cbox" style={{ marginBottom: 14 }}><h4>المكوّنات</h4>
              {Object.entries(d.components).map(([k, v]: any) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                  <span style={{ width: 120, fontSize: 12.5 }}>{COMP_AR[k] || k}</span>
                  <span style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--input)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${v}%`, background: lvlColor(v >= 51 ? "مرتفع" : "متوسط") }} /></span>
                  <span style={{ minWidth: 30, textAlign: "left", fontSize: 12 }}>{v}</span>
                </div>
              ))}
            </div>
          )}
          {d.top_risks?.length > 0 && <div className="cbox" style={{ marginBottom: 14 }}><h4 style={{ color: "#f43f5e" }}>أعلى المخاطر</h4>{d.top_risks.map((x: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "3px 0" }}>• {x}</div>)}</div>}
          {d.recommended_actions?.length > 0 && <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #22c55e" }}><h4>إجراءات موصى بها</h4>{d.recommended_actions.map((x: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "3px 0" }}>▸ {x}</div>)}</div>}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </>
  );
}
