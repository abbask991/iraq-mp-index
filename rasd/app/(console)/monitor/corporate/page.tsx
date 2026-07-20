"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { Bars, Donut, HBars, Spark, Stars } from "@/components/MiniCharts";
import { useSearchParams } from "next/navigation";
import { useDemo } from "@/components/ui/DemoContext";
import Tabs, { type TabDef } from "@/components/ui/Tabs";
import ReportGenerationButtons from "@/components/ReportGenerationButtons";
import BrandReportDoc from "./BrandReportDoc";
import ReputationView from "./views/ReputationView";
import ComplaintsView from "./views/ComplaintsView";
import FraudView from "./views/FraudView";
import CompetitorsView from "./views/CompetitorsView";
import RiskIndexView from "./views/RiskIndexView";
import CrisisView from "./views/CrisisView";
import ProductsView from "./views/ProductsView";
import ResponseView from "./views/ResponseView";
import ReviewsView from "./views/ReviewsView";

// One brand, many lenses. Was 11 separate routes each with its own brand input;
// now tabs over a single brand typed once. Each view lazy-fetches its own endpoint.
const CORP_TABS: TabDef[] = [
  { key: "overview", label: "اللوحة", icon: "target" },
  { key: "reputation", label: "السمعة", icon: "trendUp" },
  { key: "reviews", label: "ريفيوات Google", icon: "brain" },
  { key: "complaints", label: "الشكاوى", icon: "megaphone" },
  { key: "products", label: "المنتجات", icon: "clip" },
  { key: "competitors", label: "المنافسون", icon: "network" },
  { key: "risk-index", label: "مؤشر المخاطر", icon: "alert" },
  { key: "fraud", label: "الاحتيال", icon: "siren" },
  { key: "crisis", label: "الأزمات", icon: "fire" },
  { key: "response", label: "الاستجابة", icon: "refresh" },
];
const CORP_KEYS = CORP_TABS.map((t) => t.key);
const VIEW: Record<string, any> = {
  reputation: ReputationView, reviews: ReviewsView, complaints: ComplaintsView,
  products: ProductsView, competitors: CompetitorsView, "risk-index": RiskIndexView,
  fraud: FraudView, crisis: CrisisView, response: ResponseView,
};

const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const healthC = (s: number) => (s >= 55 ? "#22c55e" : s >= 40 ? "#f59e0b" : "#f43f5e");
const sevC = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : /متوسط/.test(l || "") ? "#f59e0b" : "#22c55e");
const demandC = (s: number) => (s >= 55 ? "#22c55e" : s >= 35 ? "#f59e0b" : "#f43f5e");

export default function CompanyDashboard() {
  const [brand, setBrand] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(false);
  const { demo } = useDemo();
  const search = useSearchParams();
  const urlTab = search?.get("tab") || "";
  const [tab, setTab] = useState<string>(CORP_KEYS.includes(urlTab) ? urlTab : "overview");
  useEffect(() => { if (CORP_KEYS.includes(urlTab)) setTab(urlTab); }, [urlTab]);
  const ActiveView = VIEW[tab];
  // `q` is the COMMITTED brand the views fetch on — not the input draft, so views
  // don't refetch on every keystroke. Committed on Enter / analyse / shortcut.
  const [q, setQ] = useState("");
  const submit = (b?: string) => { const v = (b ?? brand).trim(); setQ(v); if (tab === "overview") run(true, v); };
  // NB: this page's param is `real`; sibling corporate pages take `dm` (demo).
  // Same-looking call, opposite meaning — which is why all 11 ended up
  // auto-loading demo on mount and nobody noticed.
  const run = async (real = false, b?: string) => {
    const q = (b ?? brand).trim();
    setLoading(true); setD(null);
    const r = await apiGet(`/api/corporate/dashboard?brand=${encodeURIComponent(q)}${real ? "" : "&demo=1"}`).catch(() => null);
    setD(r); setLoading(false);
  };
  useEffect(() => { run(!demo); /* eslint-disable-next-line */ }, [demo]);

  const k = d?.kpis || {};
  const s = d?.sentiment || {};
  const distData = ["5", "4", "3", "2", "1"].map((x) => ({ label: `${x}★`, value: (d?.review_distribution || {})[x] || 0, color: Number(x) >= 4 ? "#22c55e" : Number(x) === 3 ? "#f59e0b" : "#f43f5e" }));

  return (
    <div>
      <h2 style={{ margin: 0 }}>لوحة الشركة الموحّدة</h2>
      <p className="muted" style={{ marginTop: 4 }}>كل شيء عن الشركة بشاشة واحدة: الصحة، السمعة، ريفيوات Google، الشكاوى، المخاطر، المنتجات، والأزمات النشطة.</p>
      <div className="card no-print" style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input placeholder="اسم الشركة (مثال: آسياسيل)" value={brand} onChange={(e) => setBrand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} style={{ flex: 1, minWidth: 220 }} />
        <button className="btn" onClick={() => submit()} disabled={loading}>تحليل</button>
        {["آسياسيل", "زين العراق", "مصرف الرافدين"].map((x) => <button key={x} className="btn ghost" style={{ fontSize: 12 }} onClick={() => { setBrand(x); submit(x); }}>{x}</button>)}
        {tab === "overview" && d && !d.empty && (
          <button className="btn ghost" style={{ marginInlineStart: "auto" }} onClick={() => setReport((v) => !v)}>
            {report ? "عرض اللوحة" : "التقرير التنفيذي"}
          </button>
        )}
        {tab === "overview" && report && d && !d.empty && <button className="btn" onClick={() => window.print()}>طباعة / PDF</button>}
      </div>

      <div className="no-print" style={{ marginBottom: "var(--s-3)" }}>
        <ReportGenerationButtons only={["board", "corporate", "executive"]} title="ولّد موجزاً" />
      </div>
      <div className="no-print"><Tabs tabs={CORP_TABS} value={tab} onChange={(t) => { setReport(false); setTab(t); }} /></div>

      {/* One brand, many lenses. Each non-overview tab is a lazy-fetched view. */}
      {ActiveView ? <ActiveView brand={q} demo={demo} /> : (<>

      {/* ── overview tab: the unified dashboard ── */}
      {report && d && !d.empty && !loading && <BrandReportDoc d={d} />}

      {loading && <SkelCards count={4} />}
      {d?.empty && <div className="cbox">{d.note}</div>}
      {!report && d && !d.empty && (
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
      </>)}
    </div>
  );
}
