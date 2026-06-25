"use client";
import { useEffect, useState } from "react";
import { apiGet, intelPost } from "@/lib/api";
import Gauge from "@/components/Gauge";
import { SkelCards } from "@/components/Skeleton";

const PRI: Record<string, { c: string; t: string }> = {
  critical: { c: "#f43f5e", t: "حرجة" }, high: { c: "#fb923c", t: "عالية" },
  medium: { c: "#f59e0b", t: "متوسطة" }, low: { c: "#84cc16", t: "منخفضة" },
};
const riskColor = (lv: string) => (lv === "حرج" ? "#f43f5e" : lv === "مرتفع" ? "#fb923c" : lv === "متوسط" ? "#f59e0b" : "#22c55e");

export default function ChiefAI() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(""); const [ans, setAns] = useState<any>(null);

  useEffect(() => { apiGet("/api/chief-ai/dashboard").then((r) => { setD(r); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const ask = async (question?: string) => {
    const qq = (question ?? q).trim();
    if (!qq) return;
    setQ(qq); setAns({ loading: true });
    const r = await intelPost("/ask", { question: qq }).catch(() => null);
    setAns(r);
  };

  const fc = d?.forecast || {};
  const ago = d?.generated_at ? Math.round((Date.now() / 1000 - d.generated_at) / 60) : null;

  return (
    <div>
      <h2>🎖️ ضابط الاستخبارات الذكي</h2>
      <p className="muted">مستشارك الاستخباراتي — ماذا حدث، لماذا يهم، ما المتوقّع، وما الذي يجب فعله. الآن.</p>

      {loading && <SkelCards count={4} />}

      {d && (
        <>
          {/* 1. Executive brief */}
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: `4px solid ${riskColor(d.risk_level)}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <h4 style={{ margin: 0 }}>🧠 الموجز التنفيذي</h4>
              <span className="chip" style={{ color: riskColor(d.risk_level) }}>مستوى الخطر: {d.risk_level}</span>
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 2, marginTop: 8 }}>{d.executive_brief || "—"}</p>
            <div className="muted" style={{ fontSize: 11 }}>{ago != null ? `محدّث منذ ${ago} دقيقة` : ""} · {d.entities_monitored} كيان مرصود · يُحدّث آلياً</div>
          </div>

          {/* 9. Executive KPIs */}
          <div className="cc-kpis" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {(d.kpis || []).map((k: any) => (
              <div className="cc-kpi" key={k.name}>
                <div className="v" style={{ fontSize: 26 }}>{k.current}</div>
                <div className="l">{k.name}</div>
                {k.change != null && (
                  <div style={{ fontSize: 11, marginTop: 2, color: ((k.invert ? -k.change : k.change) >= 0) ? "#22c55e" : "#f43f5e" }}>
                    {k.change > 0 ? "▲ +" : k.change < 0 ? "▼ " : ""}{k.change}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 8. Strategic forecast */}
          <div className="cbox" style={{ margin: "14px 0" }}>
            <h4>🔮 التوقّع الاستراتيجي <span className="muted" style={{ fontSize: 11 }}>(ثقة {fc.confidence}%)</span></h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, textAlign: "center", marginTop: 6 }}>
              {[["ترند وطني", fc.national_trend_probability], ["تغطية تلفزيونية", fc.tv_coverage_probability],
                ["تصعيد سياسي", fc.escalation_probability], ["حملة منظّمة", fc.coordinated_campaign_probability]].map(([l, v]: any) => (
                <div key={l}><Gauge value={v || 0} size={76} invert /><div style={{ fontSize: 12, marginTop: 2 }}>{l}</div></div>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>ذروة متوقّعة خلال ~{fc.expected_peak_hours} ساعة · {fc.note}</div>
          </div>

          {/* 5. Recommended actions */}
          <div className="cbox" style={{ marginBottom: 14 }}>
            <h4>🎯 التوصيات (مرتّبة بالأولوية)</h4>
            {(d.recommendations || []).length === 0 && <span className="muted">لا توصيات حرجة حالياً.</span>}
            {(d.recommendations || []).map((r: any, i: number) => {
              const p = PRI[r.priority] || PRI.medium;
              return (
                <div key={i} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <b style={{ fontSize: 14 }}><span className="chip" style={{ color: p.c, marginInlineEnd: 6 }}>{p.t}</span>{r.recommendation}</b>
                    {r.confidence != null && <span className="muted" style={{ fontSize: 12 }}>ثقة {r.confidence}%</span>}
                  </div>
                  {r.reason && <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}><b>السبب:</b> {r.reason}</div>}
                  {r.evidence && <div className="muted" style={{ fontSize: 12 }}><b>الدليل:</b> {r.evidence}</div>}
                  {r.expected_outcome && <div style={{ fontSize: 12, color: "var(--accent)" }}><b>النتيجة المتوقّعة:</b> {r.expected_outcome}</div>}
                </div>
              );
            })}
          </div>

          {/* 3+4. threats | opportunities */}
          <div className="cc-grid">
            <div className="cbox">
              <h4>⚠️ أبرز التهديدات</h4>
              {(d.threats || []).map((t: any, i: number) => {
                const sv = PRI[t.severity] || PRI.medium;
                return (
                  <div key={i} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--line)" : 0, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <b>{t.title}</b><span className="chip" style={{ color: sv.c }}>{sv.t} · {t.probability}%</span>
                    </div>
                    {t.impact && <div className="muted" style={{ fontSize: 12 }}>الأثر: {t.impact}</div>}
                    {t.response && <div style={{ fontSize: 12, color: "var(--accent)" }}>الرد: {t.response}</div>}
                  </div>
                );
              })}
            </div>
            <div className="cbox">
              <h4>✅ الفرص</h4>
              {(d.opportunities || []).length === 0 && <span className="muted">—</span>}
              {(d.opportunities || []).map((o: any, i: number) => (
                <div key={i} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--line)" : 0, fontSize: 13 }}>
                  <b style={{ color: "#22c55e" }}>{o.title}</b>
                  {o.description && <div className="muted" style={{ fontSize: 12 }}>{o.description}</div>}
                  {o.action && <div style={{ fontSize: 12, color: "var(--accent)" }}>الإجراء: {o.action}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* 2. Most important events */}
          <div className="cbox" style={{ marginTop: 14 }}>
            <h4>📌 أهم أحداث اليوم</h4>
            {(d.events || []).map((e: any, i: number) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: i ? "1px solid var(--line)" : 0, fontSize: 13 }}>
                <span style={{ fontWeight: 800, color: riskColor(e.risk >= 70 ? "حرج" : e.risk >= 50 ? "مرتفع" : "متوسط"), minWidth: 28 }}>{e.importance}</span>
                <div style={{ flex: 1 }}><b>{e.title}</b><div className="muted" style={{ fontSize: 12 }}>{e.summary} · وصول تقديري {Number(e.reach_estimate).toLocaleString()}</div></div>
              </div>
            ))}
          </div>

          {/* 6+7. AI questions + chat */}
          <div className="cbox" style={{ marginTop: 14 }}>
            <h4>🤖 اسأل ضابط الاستخبارات</h4>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {(d.questions || []).map((qq: string, i: number) => (
                <button key={i} className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => ask(qq)}>{qq}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="اكتب سؤالك الاستراتيجي…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
              <button className="btn" onClick={() => ask()}>اسأل</button>
            </div>
            {ans?.loading && <span className="spinner" />}
            {ans && !ans.loading && <p style={{ fontSize: 13.5, lineHeight: 1.95, marginTop: 8 }}>{ans.answer}</p>}
          </div>

          <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
