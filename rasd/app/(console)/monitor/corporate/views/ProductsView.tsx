"use client";
import { SkelCards } from "@/components/Skeleton";
import { Bars } from "@/components/MiniCharts";
import { useBrand } from "../useBrand";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const lvlColor = (s: number) => (s >= 55 ? "#22c55e" : s >= 35 ? "#f59e0b" : "#f43f5e");

/** Moved verbatim from /corporate/products. Host owns brand + demo + fetch. */
export default function ProductsView({ brand, demo }: { brand: string; demo: boolean }) {
  const { d, loading } = useBrand("products", brand, demo);
  if (loading) return <SkelCards count={3} />;
  if (d?.empty) return <div className="cbox">{d.note}</div>;
  if (!d) return null;
  const prods = d?.products || [];
  return (
    <>
      {d?.empty && <div className="cbox">{d.note}</div>}
      {d && !d.empty && (
        <>

          {/* demand ranking chart */}
          {prods.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>ترتيب الطلب على المنتجات</h4>
              <Bars data={prods.map((p: any) => ({ label: p.name.slice(0, 10), value: p.demand_score, color: lvlColor(p.demand_score) }))} height={150} />
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>الأكثر طلباً: <b style={{ color: "#22c55e" }}>{d.most_demanded}</b> · الأقل طلباً: <b style={{ color: "#f43f5e" }}>{d.least_demanded}</b></div>
            </div>
          )}

          {/* per-product cards */}
          {prods.map((p: any, i: number) => {
            const s = p.sentiment || {};
            return (
              <div key={i} className="cbox" style={{ marginBottom: 10, borderInlineStart: `4px solid ${lvlColor(p.demand_score)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <b style={{ fontSize: 15 }}>{p.name}</b>
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="chip" style={{ fontSize: 10.5, color: lvlColor(p.demand_score) }}>طلب {p.demand_score} · {p.demand_level}</span>
                    {p.mentions != null && <span className="muted" style={{ fontSize: 11 }}>{fmt(p.mentions)} إشارة</span>}
                  </span>
                </div>
                {(s.pos != null) && (
                  <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", margin: "8px 0" }}>
                    <span style={{ width: `${s.pos}%`, background: "#22c55e" }} /><span style={{ width: `${s.neu}%`, background: "#8a97ad" }} /><span style={{ width: `${s.neg}%`, background: "#f43f5e" }} />
                  </div>
                )}
                <div className="grid">
                  {p.problems?.length > 0 && <div><div style={{ fontSize: 12, color: "#f43f5e", fontWeight: 700 }}>المشاكل</div>{p.problems.map((x: string, j: number) => <div key={j} style={{ fontSize: 12.5 }}>• {x}</div>)}</div>}
                  {p.reasons_low_demand?.length > 0 && <div><div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>أسباب ضعف الطلب</div>{p.reasons_low_demand.map((x: string, j: number) => <div key={j} style={{ fontSize: 12.5 }}>• {x}</div>)}</div>}
                </div>
                {p.recommendation && <div style={{ fontSize: 12.5, marginTop: 6 }}>▸ <b>التوصية:</b> {p.recommendation}</div>}
              </div>
            );
          })}

          {/* cross-product problems */}
          {d.top_problems?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>مشاكل عابرة للمنتجات</h4>
              <Bars data={d.top_problems.map((t: any) => ({ label: t.problem.slice(0, 10), value: t.count, color: "#f43f5e" }))} height={110} />
            </div>
          )}
          {d.insights?.length > 0 && <div className="cbox" style={{ marginBottom: 14 }}><h4>قراءات</h4>{d.insights.map((x: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "3px 0" }}>• {x}</div>)}</div>}
          {d.recommended_actions?.length > 0 && <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #22c55e" }}><h4>إجراءات موصى بها</h4>{d.recommended_actions.map((x: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "3px 0" }}>▸ {x}</div>)}</div>}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </>
  );
}
