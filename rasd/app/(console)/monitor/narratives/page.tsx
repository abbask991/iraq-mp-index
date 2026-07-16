"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import Gauge from "@/components/Gauge";
import BattlefieldGraph from "@/components/BattlefieldGraph";
import IraqMap from "@/components/IraqMap";
import { SkelCards } from "@/components/Skeleton";

const RISK_C: Record<string, string> = { حرج: "#f43f5e", مرتفع: "#fb923c", متوسط: "#f59e0b", منخفض: "#22c55e" };
const SENT_C: Record<string, string> = { سلبي: "#f43f5e", إيجابي: "#22c55e", محايد: "#94a3b8" };
const riskC = (lv?: string) => RISK_C[lv || "منخفض"] || "#64748b";

function Stat({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontWeight: 800, fontSize: 18, color: color || "var(--text)" }}>{value}</div>
      <div className="muted" style={{ fontSize: 11 }}>{label}</div>
    </div>
  );
}

export default function NarrativeWarRoom() {
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [dLoading, setDLoading] = useState(false);

  useEffect(() => {
    apiGet("/api/narratives?range=day").then((r) => { setDash(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const open = async (n: any) => {
    setSel(n.id); setDetail(null); setDLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const r = await apiGet(`/api/narratives/detail?term=${encodeURIComponent(n.query || n.name)}`).catch(() => null);
    setDetail(r); setDLoading(false);
  };

  const narrs = dash?.narratives || [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>🧬 غرفة حرب السرديات</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            لا نرصد الهاشتاغات — نرصد <b>الأفكار</b>: أي سردية تنمو، من صنعها، من يضخّمها، من يستفيد، وما الذي ستصبح عليه.
          </p>
        </div>
        {dash && <span className="chip">{dash.scanned?.toLocaleString()} منشور مُحلّل · {narrs.length} سردية</span>}
      </div>

      {/* DETAIL VIEW */}
      {sel && (
        <div className="cbox" style={{ margin: "14px 0", borderInlineStart: `4px solid ${riskC(detail?.threat?.label)}` }}>
          <button className="btn ghost" style={{ float: "inline-start", fontSize: 12 }} onClick={() => { setSel(null); setDetail(null); }}>← رجوع للسرديات</button>
          {dLoading && <div style={{ padding: 20 }}><span className="spinner" /> جارٍ تحليل السردية (مباشر + ذكاء اصطناعي)…</div>}
          {detail?.error && <p className="muted">تعذّر التحليل المباشر — {detail.message}</p>}
          {detail && !detail.error && (
            <>
              <h3 style={{ marginTop: 4 }}>{detail.narrative?.name}</h3>
              {/* scores row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, alignItems: "center", margin: "10px 0" }}>
                <div style={{ textAlign: "center" }}><Gauge value={detail.dominance} size={84} /><div className="muted" style={{ fontSize: 11 }}>الهيمنة</div></div>
                <div style={{ textAlign: "center" }}><Gauge value={detail.threat?.score} size={84} invert /><div className="muted" style={{ fontSize: 11 }}>التهديد · {detail.threat?.label}</div></div>
                <Stat label="نمو" value={`${detail.metrics?.growth_rate}%`} color="#fb923c" />
                <Stat label="منشورات" value={detail.metrics?.posts} />
                <Stat label="أخبار" value={detail.metrics?.news} />
                <Stat label="تنسيق محتمل" value={`${detail.metrics?.coordination}/100`} color="#a78bfa" />
              </div>

              {/* SECTION 8: AI intelligence summary */}
              {detail.ai_summary?.executive && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <h4 style={{ marginTop: 0 }}>🧠 الملخّص الاستخباراتي <span className="chip" style={{ fontSize: 11 }}>ثقة {detail.ai_summary.confidence}%</span></h4>
                  <p style={{ fontSize: 14, lineHeight: 1.95 }}>{detail.ai_summary.executive}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8, fontSize: 12.5 }}>
                    {detail.ai_summary.who_benefits && <div><b style={{ color: "#22c55e" }}>المستفيد:</b> {detail.ai_summary.who_benefits}</div>}
                    {detail.ai_summary.who_harmed && <div><b style={{ color: "#f43f5e" }}>المتضرّر:</b> {detail.ai_summary.who_harmed}</div>}
                    {detail.ai_summary.who_created && <div><b>المصدر المُحتمل:</b> {detail.ai_summary.who_created}</div>}
                    {detail.ai_summary.who_amplifies && <div><b>التضخيم:</b> {detail.ai_summary.who_amplifies}</div>}
                  </div>
                  {detail.ai_summary.recommendation && <div style={{ marginTop: 8, color: "var(--accent)", fontSize: 13 }}><b>التوصية:</b> {detail.ai_summary.recommendation}</div>}
                  {!!detail.ai_summary.evidence?.length && <ul className="muted" style={{ fontSize: 12, marginTop: 6 }}>{detail.ai_summary.evidence.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>}
                </div>
              )}

              <div className="cc-grid">
                {/* SECTION 2: evolution chain */}
                <div className="card">
                  <h4 style={{ marginTop: 0 }}>🔗 تطوّر السردية</h4>
                  {(detail.evolution?.chain || []).length ? (
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                      {detail.evolution.chain.map((c: string, i: number) => (
                        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span className="chip">{c}</span>{i < detail.evolution.chain.length - 1 && <span className="muted">↓</span>}
                        </span>
                      ))}
                    </div>
                  ) : <span className="muted">سردية مستقرّة — لا تحوّلات بعد.</span>}
                  {!!detail.evolution?.events?.length && (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      {detail.evolution.events.slice(0, 6).map((e: any, i: number) => (
                        <div key={i} className="muted"><b style={{ color: "var(--accent)" }}>{e.label}</b> {e.narrative || ""} · {e.window}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SECTION 7: forecast */}
                <div className="card">
                  <h4 style={{ marginTop: 0 }}>🔮 التوقّع</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, fontSize: 13 }}>
                    <Stat label="احتمال النمو" value={`${detail.forecast?.growth_probability}%`} color="#fb923c" />
                    <Stat label="تغطية تلفزيونية" value={`${detail.forecast?.tv_coverage_probability}%`} />
                    <Stat label="تصعيد سياسي" value={`${detail.forecast?.political_escalation_probability}%`} color="#f43f5e" />
                    <Stat label="وصول متوقّع" value={Number(detail.forecast?.expected_reach || 0).toLocaleString()} />
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                    {detail.forecast?.estimated_peak_hours ? `ذروة خلال ~${detail.forecast.estimated_peak_hours} ساعة · ` : ""}الثقة {detail.forecast?.confidence}%
                  </div>
                </div>
              </div>

              {/* SECTION 4: battlefield sides */}
              <div className="cc-grid" style={{ marginTop: 12 }}>
                <div className="card">
                  <h4 style={{ marginTop: 0, color: "#22c55e" }}>🟢 يدعمون / يضخّمون ({detail.battlefield?.counts?.supporters})</h4>
                  {(detail.battlefield?.supporters || []).slice(0, 6).map((a: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                      <span>@{a.username}</span><span className="muted">تأثير {a.influence}{a.bot ? " · 🤖" : ""}</span>
                    </div>
                  )) }
                  {!detail.battlefield?.supporters?.length && <span className="muted">—</span>}
                </div>
                <div className="card">
                  <h4 style={{ marginTop: 0, color: "#f43f5e" }}>🔴 يعارضون ({detail.battlefield?.counts?.opponents})</h4>
                  {(detail.battlefield?.opponents || []).slice(0, 6).map((a: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                      <span>@{a.username}</span><span className="muted">تأثير {a.influence}{a.bot ? " · 🤖" : ""}</span>
                    </div>
                  )) }
                  {!detail.battlefield?.opponents?.length && <span className="muted">—</span>}
                </div>
              </div>

              {/* media + campaigns */}
              <div className="cc-grid" style={{ marginTop: 12 }}>
                <div className="card">
                  <h4 style={{ marginTop: 0 }}>📺 إعلام يضخّمها</h4>
                  {(detail.battlefield?.media || []).length ? (detail.battlefield.media).map((m: any, i: number) => (
                    <span key={i} className="chip" style={{ margin: 2 }}>{m.source} · {m.count}</span>
                  )) : <span className="muted">لا تغطية إخبارية واضحة.</span>}
                </div>
                <div className="card">
                  <h4 style={{ marginTop: 0 }}>📡 حملات منسّقة محتملة</h4>
                  {(detail.battlefield?.campaigns || []).length ? detail.battlefield.campaigns.map((c: any, i: number) => (
                    <div key={i} style={{ fontSize: 13 }}>#{c.hashtag} · تنسيق {c.coordination_score}/100 · {c.level}</div>
                  )) : <span className="muted">لا إشارات تنسيق قوية.</span>}
                </div>
              </div>

              {/* SECTION 5: network */}
              {!!detail.network?.nodes?.length && (
                <div className="card" style={{ marginTop: 12 }}>
                  <h4 style={{ marginTop: 0 }}>🕸️ شبكة السردية</h4>
                  <BattlefieldGraph data={detail.network} onSelect={() => {}} />
                </div>
              )}

              {/* SECTION 6: heatmap */}
              {!!detail.heatmap?.located && (
                <div className="card" style={{ marginTop: 12 }}>
                  <h4 style={{ marginTop: 0 }}>🗺️ الخريطة الحرارية الجغرافية</h4>
                  <IraqMap geo={detail.heatmap} />
                </div>
              )}

              {/* DNA */}
              {!!detail.dna?.similar?.length && (
                <div className="card" style={{ marginTop: 12 }}>
                  <h4 style={{ marginTop: 0 }}>🧬 الحمض النووي للسردية</h4>
                  {detail.dna.similar.map((s: any, i: number) => (
                    <div key={i} style={{ fontSize: 13 }}>تشبه «{s.label}» بنسبة <b style={{ color: "var(--accent)" }}>{s.similarity}%</b></div>
                  ))}
                </div>
              )}

              <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>{detail.disclaimer}</p>
            </>
          )}
        </div>
      )}

      {/* SECTION 1: active narratives */}
      {!sel && (
        <>
          {loading && <SkelCards count={6} />}
          {dash?.error && <p className="muted">تعذّر الاكتشاف المباشر — {dash.error}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12, marginTop: 14 }}>
            {narrs.map((n: any) => (
              <button key={n.id} className="cbox" onClick={() => open(n)}
                style={{ textAlign: "start", cursor: "pointer", border: "1px solid var(--line)", borderInlineStart: `4px solid ${riskC(n.risk_level)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 15 }}>{n.name}</h4>
                  <Gauge value={n.dominance} size={56} invert={false} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
                  <span className="chip" style={{ color: SENT_C[n.sentiment] }}>{n.sentiment}</span>
                  <span className="chip" style={{ color: riskC(n.risk_level) }}>خطر {n.risk_level}</span>
                  <span className="chip" style={{ color: "#fb923c" }}>نمو {n.growth_rate}%</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
                  <Stat label="منشورات" value={n.posts} />
                  <Stat label="منصّات" value={n.platforms} />
                  <Stat label="حصة" value={`${n.share}%`} />
                </div>
                {!!n.keywords?.length && <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{n.keywords.slice(0, 5).join(" · ")}</div>}
              </button>
            ))}
          </div>
          {!loading && !narrs.length && !dash?.error && <p className="muted">لا سرديات نشطة الآن — جرّب لاحقاً.</p>}
          {dash?.disclaimer && <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>{dash.disclaimer}</p>}
        </>
      )}
    </div>
  );
}
