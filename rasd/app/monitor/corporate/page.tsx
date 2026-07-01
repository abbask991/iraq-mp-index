"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { Bars, Donut, HBars, Spark, Stars } from "@/components/MiniCharts";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const healthC = (s: number) => (s >= 55 ? "#22c55e" : s >= 40 ? "#f59e0b" : "#f43f5e");
const sevC = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : /متوسط/.test(l || "") ? "#f59e0b" : "#22c55e");
const demandC = (s: number) => (s >= 55 ? "#22c55e" : s >= 35 ? "#f59e0b" : "#f43f5e");

export default function CompanyDashboard() {
  const [brand, setBrand] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const run = async (real = false, b?: string) => {
    const q = (b ?? brand).trim();
    setLoading(true); setD(null);
    const r = await apiGet(`/api/corporate/dashboard?brand=${encodeURIComponent(q)}${real ? "" : "&demo=1"}`).catch(() => null);
    setD(r); setLoading(false);
  };
  useEffect(() => { run(false); /* auto-load */ /* eslint-disable-next-line */ }, []);

  const k = d?.kpis || {};
  const s = d?.sentiment || {};
  const distData = ["5", "4", "3", "2", "1"].map((x) => ({ label: `${x}★`, value: (d?.review_distribution || {})[x] || 0, color: Number(x) >= 4 ? "#22c55e" : Number(x) === 3 ? "#f59e0b" : "#f43f5e" }));

  return (
    <div>
      <h2 style={{ margin: 0 }}>لوحة الشركة الموحّدة</h2>
      <p className="muted" style={{ marginTop: 4 }}>كل شيء عن الشركة بشاشة واحدة: الصحة، السمعة، ريفيوات Google، الشكاوى، المخاطر، المنتجات، والأزمات النشطة.</p>
      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input placeholder="اسم الشركة (مثال: آسياسيل)" value={brand} onChange={(e) => setBrand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(true)} style={{ flex: 1, minWidth: 220 }} />
        <button className="btn" onClick={() => run(true)} disabled={loading}>تحليل</button>
        {["آسياسيل", "زين العراق", "مصرف الرافدين"].map((x) => <button key={x} className="btn ghost" style={{ fontSize: 12 }} onClick={() => { setBrand(x); run(true, x); }}>{x}</button>)}
      </div>

      {loading && <SkelCards count={4} />}
      {d?.empty && <div className="cbox">{d.note}</div>}
      {d && !d.empty && (
        <>
          {d.demo && <p className="muted" style={{ fontSize: 11.5, color: "#6366f1" }}>🧪 عيّنة توضيحية ({d.brand}) — تُستبدل بالبيانات الحقيقية عند تفعيل المصادر.</p>}

          {/* active crises banner */}
          {d.active_crises?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #dc2626", background: "color-mix(in srgb,#dc2626 8%,var(--card))" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <b>🚨 {d.active_crises.length} أزمات نشطة تتطلّب انتباهاً</b>
                <Link href="/monitor/corporate/crisis" className="chip" style={{ fontSize: 11 }}>رادار الأزمات ←</Link>
              </div>
              {d.active_crises.slice(0, 2).map((c: any, i: number) => (
                <div key={i} style={{ fontSize: 12.5, marginTop: 6 }}><span className="chip" style={{ fontSize: 10, color: sevC(c.severity) }}>{c.severity}</span> {c.title} <span className="muted">· {c.time}</span></div>
              ))}
            </div>
          )}

          {/* health + KPIs */}
          <div className="grid" style={{ marginBottom: 14 }}>
            <div className="cbox" style={{ textAlign: "center", borderInlineStart: `4px solid ${healthC(d.brand_health)}` }}>
              <h4 style={{ marginTop: 0 }}>صحة العلامة</h4>
              <div style={{ fontSize: 46, fontWeight: 900, color: healthC(d.brand_health) }}>{d.brand_health}</div>
              <div style={{ fontSize: 13 }}>{d.health_level} · /100</div>
            </div>
            <div className="cbox">
              <h4 style={{ marginTop: 0 }}>مؤشرات رئيسية</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12.5 }}>
                <div>السمعة: <b>{k.reputation}</b></div>
                <div>تقييم Google: <b>{k.google_rating}</b> <Stars rating={k.google_rating} size={12} /></div>
                <div>ضغط الشكاوى: <b style={{ color: sevC(k.complaint_pressure >= 60 ? "مرتفع" : "متوسط") }}>{k.complaint_pressure}</b></div>
                <div>مؤشر المخاطر: <b style={{ color: sevC(k.risk_index >= 51 ? "مرتفع" : "متوسط") }}>{k.risk_index}</b></div>
                <div>صفحات مزيفة: <b style={{ color: k.fake_pages ? "#f43f5e" : "#22c55e" }}>{k.fake_pages}</b></div>
                <div>مراجعات Google: <b>{fmt(k.google_reviews)}</b></div>
              </div>
              <div style={{ fontSize: 12, marginTop: 8 }}>الأكثر طلباً: <b style={{ color: "#22c55e" }}>{k.most_demanded}</b> · الأقل: <b style={{ color: "#f43f5e" }}>{k.least_demanded}</b></div>
            </div>
          </div>

          {/* charts row */}
          <div className="grid" style={{ marginBottom: 14 }}>
            {(s.positive != null) && (
              <div className="cbox" style={{ textAlign: "center" }}><h4 style={{ marginTop: 0 }}>المشاعر</h4>
                <Donut size={110} segments={[{ value: s.positive, color: "#22c55e" }, { value: s.neutral, color: "#8a97ad" }, { value: s.negative, color: "#f43f5e" }]} label={`${s.negative}%-`} />
                <div style={{ fontSize: 11.5 }}><span style={{ color: "#22c55e" }}>+{s.positive}%</span> · <span style={{ color: "#f43f5e" }}>-{s.negative}%</span></div>
              </div>
            )}
            {distData.some((x) => x.value > 0) && <div className="cbox"><h4 style={{ marginTop: 0 }}>توزيع تقييمات Google</h4><HBars data={distData} /></div>}
            {d.trend?.length > 0 && <div className="cbox"><h4 style={{ marginTop: 0 }}>اتجاه السمعة</h4><Spark data={d.trend} color={healthC(d.brand_health)} height={70} /></div>}
          </div>

          {/* products demand + complaints */}
          <div className="grid" style={{ marginBottom: 14 }}>
            {d.products?.length > 0 && (
              <div className="cbox"><h4 style={{ marginTop: 0 }}>طلب المنتجات</h4>
                <Bars data={d.products.map((p: any) => ({ label: p.name.slice(0, 8), value: p.demand_score, color: demandC(p.demand_score) }))} height={130} />
                <Link href="/monitor/corporate/products" className="muted" style={{ fontSize: 11 }}>استطلاع المنتجات ←</Link>
              </div>
            )}
            {d.top_complaints?.length > 0 && (
              <div className="cbox"><h4 style={{ marginTop: 0 }}>أبرز الشكاوى</h4>
                {d.top_complaints.map((c: any, i: number) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0", borderTop: i ? "1px solid var(--line)" : 0 }}><span>{c.theme}</span>{c.count != null && <span className="muted">{c.count}</span>}</div>)}
                <Link href="/monitor/corporate/complaints" className="muted" style={{ fontSize: 11 }}>كل الشكاوى ←</Link>
              </div>
            )}
          </div>

          {/* quick links to detail modules */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {[["سمعة الشركة", "/monitor/corporate/reputation"], ["ريفيوات Google", "/monitor/corporate/reviews"], ["المنافسين", "/monitor/corporate/competitors"], ["الصفحات المزيفة", "/monitor/corporate/fraud"], ["مؤشر المخاطر", "/monitor/corporate/risk-index"], ["رادار الأزمات", "/monitor/corporate/crisis"]].map(([l, h]: any) => (
              <Link key={h} href={h} className="btn ghost" style={{ fontSize: 12 }}>{l} ←</Link>
            ))}
          </div>

          {d.recommended_actions?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #22c55e" }}><h4 style={{ marginTop: 0 }}>إجراءات موصى بها</h4>{d.recommended_actions.map((x: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "3px 0" }}>▸ {x}</div>)}</div>
          )}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
