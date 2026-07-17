"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { HBars, Bars, Spark } from "@/components/MiniCharts";
import { useDemo } from "@/components/ui/DemoContext";

const COMP_AR: Record<string, string> = {
  negative_sentiment: "السلبية العامة",
  anger_emotion: "الغضب/الإحباط",
  complaint_volume: "حجم الشكاوى",
  narrative_velocity: "سرعة السردية",
  engagement_intensity: "كثافة التفاعل",
  protest_language: "لغة الاحتجاج",
  cross_platform: "الانتشار عبر المنصّات",
};
const SCOPES = [
  ["country", "دولة"], ["entity", "كيان/جهة"], ["issue", "قضية"],
  ["company", "شركة"], ["campaign", "حملة"], ["crisis", "أزمة"],
];
const riskColor = (s: number) => s >= 76 ? "#f43f5e" : s >= 51 ? "#fb923c" : s >= 26 ? "#facc15" : "#34d6c6";
const trendAr: Record<string, string> = { accelerating: "متسارع ⤴", rising: "متصاعد ↑", stable: "مستقر →", declining: "متراجع ↓", cooling_down: "يهدأ ↓" };

export default function PublicAnger() {
  const [scopeType, setScopeType] = useState("entity");
  const [scopeName, setScopeName] = useState("وزارة الكهرباء");
  const [period, setPeriod] = useState("week");
  const { demo, setDemo } = useDemo();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const q = `scope_type=${scopeType}&scope_id=${encodeURIComponent(scopeName)}&scope_name=${encodeURIComponent(scopeName)}&period=${period}&demo=${demo ? 1 : ""}`;
    apiGet(`/api/indices/public-anger?${q}`).then(setD).catch(() => setD(null)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const comps = d?.components || {};
  const maxComp = 100;

  return (
    <div>
      <div className="cc-hero">
        <div>
          <div className="cc-live"><span className="cc-dot" /> مختبر المؤشرات الاستراتيجية</div>
          <h2 style={{ margin: "6px 0 2px" }}>مؤشر الغضب العام — PAI</h2>
          <p className="muted" style={{ margin: 0 }}>قياس الغضب الرقمي المرصود حول {d?.scope_name || scopeName} — مؤشّر احتمالي قابل للتفسير.</p>
        </div>
      </div>

      {/* controls */}
      <div className="cbox" style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={scopeType} onChange={(e) => setScopeType(e.target.value)} style={{ width: 130 }}>
          {SCOPES.map(([k, ar]) => <option key={k} value={k}>{ar}</option>)}
        </select>
        <input value={scopeName} onChange={(e) => setScopeName(e.target.value)} placeholder="اسم النطاق (كيان/قضية/شركة)" style={{ flex: 1, minWidth: 180 }} />
        <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 110 }}>
          <option value="day">24 ساعة</option><option value="week">أسبوع</option><option value="month">شهر</option>
        </select>
        <label className="muted" style={{ fontSize: 12, display: "flex", gap: 5, alignItems: "center" }}>
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} style={{ width: "auto" }} /> وضع العرض
        </label>
        <button className="btn" onClick={load}>تحديث</button>
      </div>

      {loading && <SkelCards count={4} />}
      {!loading && !d && <div className="cbox">تعذّر التحميل. <button className="btn ghost" onClick={load}>إعادة</button></div>}

      {!loading && d && (
        <>
          {d.note && <div className="banner" style={{ background: "linear-gradient(90deg,#1e3a5f,#0c1726)", borderColor: "#2563eb", color: "#bfdbfe" }}>{d.note}</div>}
          {d.needs_review && <div className="banner">⚠️ نتيجة بثقة منخفضة — تتطلّب مراجعة بشرية قبل الاعتماد عليها.</div>}

          {/* 3.1 Executive score card */}
          <div className="cc-grid" style={{ gridTemplateColumns: "260px 1fr" }}>
            <div className="cbox" style={{ textAlign: "center", borderTop: `3px solid ${riskColor(d.score)}` }}>
              <div className="muted" style={{ fontSize: 12 }}>مؤشر الغضب العام</div>
              <div style={{ fontSize: 68, fontWeight: 900, lineHeight: 1.1, color: riskColor(d.score) }}>{d.score}</div>
              <div style={{ fontWeight: 800, color: riskColor(d.score) }}>{d.risk_level_ar} · {trendAr[d.trend] || d.trend}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <span className="chip">24س: {d.change_24h > 0 ? "+" : ""}{d.change_24h ?? "—"}</span>
                <span className="chip">7أيام: {d.change_7d != null ? (d.change_7d > 0 ? "+" : "") + d.change_7d : "—"}</span>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                الثقة: <b style={{ color: "var(--text)" }}>{d.confidence_score}%</b> ({d.confidence_label_ar})
              </div>
            </div>

            {/* components */}
            <div className="cbox">
              <h4>مكوّنات المؤشر (الوزن × الدرجة)</h4>
              <HBars data={Object.keys(COMP_AR).map((k) => ({ label: COMP_AR[k], value: comps[k] || 0, max: maxComp, color: riskColor(comps[k] || 0) }))} />
            </div>
          </div>

          {/* 3.8 AI explanation */}
          <div className="cbox" style={{ marginTop: 14 }}>
            <h4>🧠 التفسير الذكي</h4>
            <p style={{ lineHeight: 1.9, margin: "0 0 10px" }}>{d.explanation?.summary}</p>
            <div className="grid">
              <div><b style={{ fontSize: 13 }}>لماذا تغيّر؟</b><p className="muted" style={{ fontSize: 13 }}>{d.explanation?.why_changed}</p></div>
              <div><b style={{ fontSize: 13 }}>ما الذي نراقبه تالياً؟</b>
                <ul className="muted" style={{ fontSize: 13, paddingInlineStart: 18, margin: "4px 0" }}>
                  {(d.explanation?.what_to_watch || []).map((x: string, i: number) => <li key={i}>{x}</li>)}
                </ul>
              </div>
              <div><b style={{ fontSize: 13 }}>إجراءات موصى بها</b>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {(d.explanation?.recommended_actions || []).map((a: string, i: number) => <span key={i} className="chip">{a}</span>)}
                </div>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 8 }}>{d.explanation?.uncertainty}</p>
          </div>

          {/* 3.2 drivers + 3.7 timeline */}
          <div className="cc-grid" style={{ marginTop: 14, gridTemplateColumns: "1.3fr 1fr" }}>
            <div className="cbox">
              <h4>دوافع الغضب</h4>
              {(d.drivers || []).map((dr: any, i: number) => (
                <div key={i} style={{ borderBottom: "1px solid var(--line)", padding: "8px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <b>{dr.driver_name}</b>
                    <span className="chip" style={{ color: dr.trend === "rising" ? "#fb923c" : "var(--muted)" }}>{dr.contribution_score}% · {dr.trend}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                    {dr.volume} إشارة · {(dr.top_platforms || []).map((p: any) => `${p.platform}(${p.count})`).join("، ")}
                  </div>
                  {(dr.sample_evidence || [])[0]?.text && <div className="muted" style={{ fontSize: 12, marginTop: 4, fontStyle: "italic" }}>“{dr.sample_evidence[0].text}”</div>}
                </div>
              ))}
            </div>
            <div className="cbox">
              <h4>المؤشر عبر الزمن</h4>
              {d.timeline?.daily?.length > 1
                ? <Bars data={(d.timeline.daily).map((x: any) => ({ label: x.t, value: x.score, color: riskColor(x.score) }))} />
                : <p className="muted" style={{ fontSize: 13 }}>لا يوجد تاريخ كافٍ بعد — يُبنى مع تكرار التشغيل.</p>}
            </div>
          </div>

          {/* 3.4 platform + 3.5 entity */}
          <div className="cc-grid" style={{ marginTop: 14 }}>
            <div className="cbox">
              <h4>الغضب حسب المنصّة</h4>
              <HBars data={(d.platform_breakdown || []).map((p: any) => ({ label: p.platform, value: p.anger_score, max: 100, color: riskColor(p.anger_score) }))} />
              <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                {(d.platform_breakdown || []).map((p: any) => `${p.platform}: ${p.volume} منشور`).join(" · ")}
              </div>
            </div>
            <div className="cbox">
              <h4>الكيانات المستهدفة بالغضب</h4>
              {(d.entity_breakdown || []).map((e: any, i: number) => (
                <div key={i} style={{ borderBottom: "1px solid var(--line)", padding: "8px 0", display: "flex", justifyContent: "space-between" }}>
                  <div><b>{e.entity_name}</b><div className="muted" style={{ fontSize: 11 }}>{(e.drivers || []).join("، ")}</div></div>
                  <span style={{ fontWeight: 800, color: riskColor(e.anger_score) }}>{e.anger_score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3.3 narratives */}
          <div className="cbox" style={{ marginTop: 14 }}>
            <h4>أبرز السرديات الغاضبة</h4>
            {(d.narratives || []).length === 0 && <p className="muted" style={{ fontSize: 13 }}>لا سرديات بارزة.</p>}
            {(d.narratives || []).map((n: any, i: number) => (
              <div key={i} style={{ borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                  <b>{n.narrative_title}</b>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span className="chip" style={{ color: riskColor(n.anger_intensity_score) }}>حدّة {n.anger_intensity_score}</span>
                    <span className="chip">حجم {n.volume}</span>
                    <span className="chip">ثقة {n.confidence_score}%</span>
                  </div>
                </div>
                <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>{n.narrative_summary}</p>
              </div>
            ))}
          </div>

          {/* 3.6 evidence */}
          <div className="cbox" style={{ marginTop: 14 }}>
            <h4>لوحة الأدلّة ({(d.evidence || []).length})</h4>
            {(d.evidence || []).slice(0, 25).map((ev: any, i: number) => (
              <div key={i} className="newsitem">
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>{ev.content_text}</div>
                <div className="meta">
                  <span className="chip">{ev.platform}</span>
                  {ev.emotion && <span className="chip" style={{ color: "#fb923c" }}>{ev.emotion}</span>}
                  <span>حدّة {ev.anger_score}</span>
                  {ev.source_name && <span>· {ev.source_name}</span>}
                  {ev.source_url && <a href={ev.source_url} target="_blank" rel="noopener">· المصدر</a>}
                </div>
              </div>
            ))}
          </div>

          <p className="muted" style={{ fontSize: 11, marginTop: 14, textAlign: "center" }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
