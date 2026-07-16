"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import Logo from "@/components/Logo";
import { SkelCards } from "@/components/Skeleton";
import { Bars, Donut, Stars } from "@/components/MiniCharts";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const healthC = (s: number) => (s >= 55 ? "#22c55e" : s >= 40 ? "#f59e0b" : "#f43f5e");
const sevC = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : "#f59e0b");
const demandC = (s: number) => (s >= 55 ? "#22c55e" : s >= 35 ? "#f59e0b" : "#f43f5e");

export default function BrandReport() {
  const [brand, setBrand] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const run = async (real = false) => {
    setLoading(true);
    const r = await apiGet(`/api/corporate/dashboard?brand=${encodeURIComponent(brand)}${real ? "" : "&demo=1"}`).catch(() => null);
    setD(r); setLoading(false);
  };
  useEffect(() => { run(false); /* eslint-disable-next-line */ }, []);

  const k = d?.kpis || {}; const s = d?.sentiment || {};
  const today = new Date().toLocaleDateString("ar-IQ", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="brief-wrap">
      <div className="brief-bar no-print">
        <h2 style={{ margin: 0 }}>تقرير البراند التنفيذي</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder="اسم الشركة" value={brand} onChange={(e) => setBrand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(true)} />
          <button className="btn ghost" onClick={() => run(true)}>تحديث</button>
          <button className="btn" onClick={() => window.print()}>⬇️ تحميل / طباعة PDF</button>
        </div>
      </div>

      {loading && <SkelCards count={3} />}
      {d && !loading && !d.empty && (
        <div className="brief-doc">
          <div className="brief-head">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Logo size={42} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>تقرير استخبارات العلامة</div>
                <div className="muted" style={{ fontSize: 12 }}>{d.brand} · {today}</div>
              </div>
            </div>
            <div className="brief-class">سرّي — للعميل</div>
          </div>

          {/* health banner */}
          <div className="brief-threat" style={{ ["--pc" as any]: healthC(d.brand_health) }}>
            <div><div className="muted" style={{ fontSize: 12 }}>صحة العلامة</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: healthC(d.brand_health) }}>{d.health_level}</div></div>
            <div style={{ fontSize: 38, fontWeight: 900, color: healthC(d.brand_health) }}>{d.brand_health}<span style={{ fontSize: 16, color: "var(--muted)" }}>/100</span></div>
          </div>

          <section className="brief-sec">
            <h3>① المؤشرات الرئيسية</h3>
            <div className="brief-kpis">
              {[["السمعة", k.reputation], ["تقييم Google", k.google_rating], ["ضغط الشكاوى", k.complaint_pressure],
                ["مؤشر المخاطر", k.risk_index], ["صفحات مزيفة", k.fake_pages], ["مراجعات Google", fmt(k.google_reviews)]].map(([l, v]: any) => (
                <div className="brief-kpi" key={l}><div style={{ fontSize: 22, fontWeight: 900 }}>{v ?? "—"}</div><div className="muted" style={{ fontSize: 11 }}>{l}</div></div>
              ))}
            </div>
            <div style={{ fontSize: 12.5, marginTop: 8 }}>تقييم Google: <Stars rating={k.google_rating} /> · الأكثر طلباً: <b>{k.most_demanded}</b> · الأقل: <b>{k.least_demanded}</b></div>
          </section>

          <div className="brief-2col">
            {s.positive != null && (
              <section className="brief-sec"><h3>② المشاعر</h3>
                <div style={{ textAlign: "center" }}><Donut size={120} segments={[{ value: s.positive, color: "#22c55e" }, { value: s.neutral, color: "#8a97ad" }, { value: s.negative, color: "#f43f5e" }]} label={`${s.negative}%-`} /></div>
                <div style={{ textAlign: "center", fontSize: 12.5 }}><span style={{ color: "#22c55e" }}>إيجابي {s.positive}%</span> · <span style={{ color: "#f43f5e" }}>سلبي {s.negative}%</span></div>
              </section>
            )}
            {d.products?.length > 0 && (
              <section className="brief-sec"><h3>③ طلب المنتجات</h3>
                <Bars data={d.products.map((p: any) => ({ label: p.name.slice(0, 8), value: p.demand_score, color: demandC(p.demand_score) }))} height={120} />
              </section>
            )}
          </div>

          {d.top_complaints?.length > 0 && (
            <section className="brief-sec"><h3>④ أبرز الشكاوى</h3>
              {d.top_complaints.map((c: any, i: number) => <div key={i} className="brief-row"><span className="brief-dot" style={{ background: "#f43f5e" }} /><span style={{ flex: 1 }}>{c.theme}</span>{c.count != null && <b>{c.count}</b>}</div>)}
            </section>
          )}

          {d.active_crises?.length > 0 && (
            <section className="brief-sec"><h3>⑤ الأزمات النشطة</h3>
              {d.active_crises.map((c: any, i: number) => <div key={i} className="brief-row"><span className="chip" style={{ fontSize: 10, color: sevC(c.severity) }}>{c.severity}</span><span style={{ flex: 1 }}>{c.title}</span></div>)}
            </section>
          )}

          {d.recommended_actions?.length > 0 && (
            <section className="brief-sec"><h3>⑥ التوصيات</h3>
              <ol className="brief-recs">{d.recommended_actions.map((x: string, i: number) => <li key={i}>{x}</li>)}</ol>
            </section>
          )}

          <div className="brief-foot muted">{d.disclaimer} · Sentinel Intelligence by Integrate Dynamics · {today}</div>
        </div>
      )}
    </div>
  );
}
