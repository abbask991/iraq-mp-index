"use client";
import { useEffect, useState } from "react";
import { apiGet, intelGet, intelPost } from "@/lib/api";
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
  const [bookBusy, setBookBusy] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    apiGet("/api/chief-ai/dashboard").then((r) => { setD(r); setLoading(false); }).catch(() => setLoading(false));
    apiGet("/monitor/alerts-feed").then((r) => setAlerts(r?.alerts || [])).catch(() => {});
  }, []);

  const downloadBook = async () => {
    setBookBusy(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      let res: any = await fetch(`${base}/api/chief-ai/generate-daily-book?fmt=docx`, { method: "POST" }).then((r) => r.json());
      if (res?.job_id) {
        for (let i = 0; i < 50; i++) {
          await new Promise((s) => setTimeout(s, 4000));
          res = await intelGet(`/job/${res.job_id}`);
          if (res?.status === "done" || res?.status === "failed") break;
        }
      }
      const b64 = res?.file_base64 || res?.pdf_base64;
      if (!b64) { alert("تعذّر توليد الكتاب حالياً."); return; }
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      const a = document.createElement("a"); a.href = url; a.download = "الكتاب-الاستخباراتي-اليومي.docx"; a.click();
      URL.revokeObjectURL(url);
    } finally { setBookBusy(false); }
  };

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>ضابط الاستخبارات الذكي</h2>
          <p className="muted" style={{ marginTop: 4 }}>مستشارك الاستخباراتي — ماذا حدث، لماذا يهم، ما المتوقّع، وما الذي يجب فعله. الآن.</p>
        </div>
        <button className="btn" onClick={downloadBook} disabled={bookBusy}>
          {bookBusy ? "جارٍ التوليد…" : "تنزيل الكتاب اليومي (Word)"}</button>
      </div>

      {loading && <SkelCards count={4} />}

      {alerts.length > 0 && (
        <div className="cbox" style={{ margin: "12px 0", borderInlineStart: "4px solid #f43f5e" }}>
          <h4 style={{ marginTop: 0 }}>تنبيهات لحظية ({alerts.length})</h4>
          {alerts.slice(0, 5).map((a: any, i: number) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", borderTop: i ? "1px solid var(--line)" : 0, fontSize: 13 }}>
              <span>{a.severity === "red" ? "🔴" : a.severity === "orange" ? "🟠" : "🟡"}</span>
              <span style={{ flex: 1 }}>{a.message}</span>
              {a.ts && <span className="muted" style={{ fontSize: 11 }}>{new Date(a.ts * 1000).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>}
            </div>
          ))}
        </div>
      )}

      {d && (
        <>
          {/* 1. Executive brief */}
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: `4px solid ${riskColor(d.risk_level)}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <h4 style={{ margin: 0 }}>الموجز التنفيذي</h4>
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

          {/* cross-platform reach (fusion) */}
          {d.cross_platform?.platforms?.length > 0 && (
            <div className="cbox" style={{ margin: "14px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <h4 style={{ margin: 0 }}>الانتشار عبر المنصّات</h4>
                <span className="chip">وصول إجمالي {Number(d.cross_platform.total_reach).toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                {d.cross_platform.platforms.map((p: any) => (
                  <span key={p.platform} className="chip">{p.platform}: {Number(p.reach).toLocaleString()} · {p.posts} منشور</span>
                ))}
              </div>
            </div>
          )}

          {/* 8. Strategic forecast — multi-horizon */}
          <div className="cbox" style={{ margin: "14px 0" }}>
            <h4>التوقّع الاستراتيجي عبر المدى</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 6 }}>
              {(fc.horizons || []).map((h: any) => (
                <div className="card" key={h.horizon} style={{ textAlign: "center", paddingTop: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>{h.horizon}</div>
                  <Gauge value={h.national_trend || 0} size={72} invert />
                  <div style={{ fontSize: 11, marginTop: 2 }}>احتمال ترند وطني</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>أزمة {h.media_crisis}% · حملة {h.coordinated_campaign}% · سردية {h.narrative_growth}%</div>
                  <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>الثقة {h.confidence}%</div>
                </div>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>ذروة متوقّعة خلال ~{fc.expected_peak_hours} ساعة · {fc.note}</div>
          </div>

          {/* 5. Recommended actions */}
          <div className="cbox" style={{ marginBottom: 14 }}>
            <h4>التوصيات (مرتّبة بالأولوية)</h4>
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
                  {(r.expected_outcome || r.estimated_impact) && <div style={{ fontSize: 12, color: "var(--accent)" }}><b>الأثر المتوقّع:</b> {r.estimated_impact || r.expected_outcome}</div>}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    {r.deadline && <span className="chip" style={{ color: "#fb923c" }}>⏱ {r.deadline}</span>}
                    {r.owner && <span className="chip">👤 {r.owner}</span>}
                    {r.status && <span className="chip" style={{ color: "var(--accent)" }}>{r.status}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3+4. threats | opportunities */}
          <div className="cc-grid">
            <div className="cbox">
              <h4>أبرز التهديدات</h4>
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
              <h4>الفرص</h4>
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
            <h4>أهم أحداث اليوم</h4>
            {(d.events || []).map((e: any, i: number) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: i ? "1px solid var(--line)" : 0, fontSize: 13 }}>
                <span style={{ fontWeight: 800, color: riskColor(e.risk >= 70 ? "حرج" : e.risk >= 50 ? "مرتفع" : "متوسط"), minWidth: 28 }}>{e.importance}</span>
                <div style={{ flex: 1 }}><b>{e.title}</b><div className="muted" style={{ fontSize: 12 }}>{e.summary} · وصول تقديري {Number(e.reach_estimate).toLocaleString()}</div></div>
              </div>
            ))}
          </div>

          {/* 6+7. AI questions + chat */}
          <div className="cbox" style={{ marginTop: 14 }}>
            <h4>اسأل ضابط الاستخبارات</h4>
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
