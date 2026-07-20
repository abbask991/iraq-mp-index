"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useDemo } from "@/components/ui/DemoContext";
import { BrandLine, BrandTitle, BrandLogo } from "@/components/Brand";
import { PageHeader, Button, Icon } from "@/components/ui";

/**
 * Public Anger Report — a printable deliverable over the Public Anger Index
 * (/api/indices/public-anger, the same endpoint Risk › مؤشر الغضب العام and the
 * command card read). Defaults to national scope; the scope/period controls let
 * an analyst produce a report for any entity, issue, company, campaign or crisis.
 */
const COMP_AR: Record<string, string> = {
  negative_sentiment: "السلبية العامة", anger_emotion: "الغضب/الإحباط", complaint_volume: "حجم الشكاوى",
  narrative_velocity: "سرعة السردية", engagement_intensity: "كثافة التفاعل", protest_language: "لغة الاحتجاج",
  cross_platform: "الانتشار عبر المنصّات",
};
const SCOPES: [string, string][] = [
  ["country", "دولة"], ["entity", "كيان/جهة"], ["issue", "قضية"],
  ["company", "شركة"], ["campaign", "حملة"], ["crisis", "أزمة"],
];
const riskColor = (s: number) => (s >= 76 ? "#f43f5e" : s >= 51 ? "#fb923c" : s >= 26 ? "#facc15" : "#22c55e");
const trendAr: Record<string, string> = {
  accelerating: "متسارع ⤴", rising: "متصاعد ↑", stable: "مستقر →", declining: "متراجع ↓", cooling_down: "يهدأ ↓",
};

export default function AngerReportView() {
  const [scopeType, setScopeType] = useState("country");
  const [scopeName, setScopeName] = useState("العراق");
  const [period, setPeriod] = useState("week");
  const { demo } = useDemo();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const today = new Date().toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const load = () => {
    setLoading(true);
    // Only send demo when on — the backend rejects an empty `demo=` as a bad bool (422).
    const q = `scope_type=${scopeType}&scope_id=${encodeURIComponent(scopeName)}&scope_name=${encodeURIComponent(scopeName)}&period=${period}${demo ? "&demo=1" : ""}`;
    apiGet(`/api/indices/public-anger?${q}`).then(setD).catch(() => setD(null)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const comps = d?.components || {};

  return (
    <div className="brief-wrap">
      <div className="no-print">
        <PageHeader
          title="تقرير مؤشر الغضب العام"
          sub="تقرير قابل للطباعة عن مستوى الغضب الرقمي المرصود لأي نطاق."
          actions={d && !loading
            ? <Button variant="primary" onClick={() => window.print()}><Icon name="clip" size={14} /> PDF</Button>
            : null}
        />
        <div className="card" style={{ margin: "0 0 12px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={scopeType} onChange={(e) => setScopeType(e.target.value)} style={{ width: 130 }}>
            {SCOPES.map(([k, ar]) => <option key={k} value={k}>{ar}</option>)}
          </select>
          <input value={scopeName} onChange={(e) => setScopeName(e.target.value)} placeholder="اسم النطاق (دولة/كيان/قضية)" style={{ flex: 1, minWidth: 180 }} />
          <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 110 }}>
            <option value="day">24 ساعة</option><option value="week">أسبوع</option><option value="month">شهر</option>
          </select>
          <button className="btn" onClick={load} disabled={loading}>{loading ? "جارٍ الإعداد…" : "أنشئ التقرير"}</button>
        </div>
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" /><p className="muted">يقيس الغضب الرقمي عبر مكوّناته…</p></div>}

      {d && !loading && (
        <div className="brief-doc">
          <div className="brief-head">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <BrandLogo size={42} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 0.5 }}><BrandTitle /></div>
                <div className="muted" style={{ fontSize: 12 }}>تقرير مؤشر الغضب العام — {d.scope_name || scopeName} · {today}</div>
              </div>
            </div>
            <div className="brief-class">سرّي — للاستخدام الداخلي</div>
          </div>

          {d.needs_review && (
            <div className="cbox" style={{ borderInlineStart: "4px solid #f59e0b", marginBottom: 12, fontSize: 13 }}>
              نتيجة بثقة منخفضة — تتطلّب مراجعة بشرية قبل الاعتماد عليها.
            </div>
          )}

          <div className="brief-threat" style={{ ["--pc" as any]: riskColor(d.score) }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>مستوى الغضب · {trendAr[d.trend] || d.trend}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: riskColor(d.score) }}>{d.risk_level_ar}</div>
            </div>
            <div style={{ fontSize: 40, fontWeight: 900, color: riskColor(d.score) }}>{d.score}<span style={{ fontSize: 16, color: "var(--muted)" }}>/100</span></div>
          </div>

          <section className="brief-sec">
            <h3>① التفسير</h3>
            <p style={{ fontSize: 14.5, lineHeight: 2 }}>{d.explanation?.summary}</p>
            {d.explanation?.why_changed && <p className="muted" style={{ fontSize: 13 }}><b>لماذا تغيّر:</b> {d.explanation.why_changed}</p>}
          </section>

          <section className="brief-sec">
            <h3>② مكوّنات المؤشر</h3>
            <table className="brief-tbl">
              <thead><tr><th>المكوّن</th><th>الدرجة (٠–١٠٠)</th></tr></thead>
              <tbody>
                {Object.keys(COMP_AR).map((k) => (
                  <tr key={k}><td>{COMP_AR[k]}</td><td><b style={{ color: riskColor(comps[k] || 0) }}>{comps[k] || 0}</b></td></tr>
                ))}
              </tbody>
            </table>
          </section>

          {(d.drivers || []).length > 0 && (
            <section className="brief-sec">
              <h3>③ دوافع الغضب</h3>
              {d.drivers.map((dr: any, i: number) => (
                <div key={i} className="brief-row">
                  <span className="brief-dot" style={{ background: riskColor(dr.contribution_score || 0), marginTop: 6 }} />
                  <span style={{ flex: 1 }}><b>{dr.driver_name}</b> <span className="muted">— {dr.contribution_score}% · {dr.volume} إشارة</span></span>
                </div>
              ))}
            </section>
          )}

          {(d.narratives || []).length > 0 && (
            <section className="brief-sec">
              <h3>④ أبرز السرديات الغاضبة</h3>
              {d.narratives.map((n: any, i: number) => (
                <div key={i} className="brief-row">
                  <span style={{ flex: 1 }}>{n.narrative_title} <span className="muted">— {n.narrative_summary}</span></span>
                  <span className="chip" style={{ color: riskColor(n.anger_intensity_score) }}>حدّة {n.anger_intensity_score}</span>
                </div>
              ))}
            </section>
          )}

          {(d.explanation?.recommended_actions || []).length > 0 && (
            <section className="brief-sec">
              <h3>⑤ إجراءات موصى بها</h3>
              <ol className="brief-recs">{d.explanation.recommended_actions.map((a: string, i: number) => <li key={i}>{a}</li>)}</ol>
            </section>
          )}

          <div className="brief-foot muted">
            {d.disclaimer}{d.confidence_score != null ? ` · الثقة ${d.confidence_score}%` : ""} · <BrandLine /> · {today}
          </div>
        </div>
      )}
    </div>
  );
}
