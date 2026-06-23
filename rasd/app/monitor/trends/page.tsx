"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/api";
import RangeSelect, { Range } from "@/components/RangeSelect";

const ALERT: Record<string, { c: string; bg: string }> = {
  red: { c: "#f43f5e", bg: "#2a0f16" },
  orange: { c: "#fb923c", bg: "#2a1a0a" },
  yellow: { c: "#f59e0b", bg: "#2a1f0a" },
  watch: { c: "#84cc16", bg: "#1d2412" },
  normal: { c: "#22c55e", bg: "#0f2418" },
};
const METRIC_LABEL: Record<string, string> = {
  mention_velocity: "تسارع الذِكر",
  engagement_velocity: "تسارع التفاعل",
  influencer_weight: "وزن المؤثّرين",
  sentiment_shift: "تحوّل النبرة",
  cross_platform: "الانتشار العابر",
  novelty: "الجِدّة",
  coordination: "إشارة التنسيق",
};

export default function Trends() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [term, setTerm] = useState("");
  const [range, setRange] = useState<Range>("week");
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("monitors").select("name,keywords").then(({ data }) => setMonitors(data || []));
  }, []);

  const run = async (q: string) => {
    if (!q.trim()) return;
    setTerm(q); setLoading(true); setRes(null);
    const r = await apiPost("trends", { keywords: [q], range }).catch(() => null);
    setRes(r); setLoading(false);
  };

  const a = res?.alert ? ALERT[res.alert.level] || ALERT.normal : ALERT.normal;

  return (
    <div>
      <h2>🔮 اكتشاف الترندات المبكر</h2>
      <p className="muted">لا يعتمد على عدد الذِكر فقط — يقيس التسارع، مشاركة المؤثّرين، تحوّل النبرة، الانتشار، الجِدّة، والتنسيق المحتمل.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="موضوع / هاشتاغ / اسم (مثال: الكهرباء)" value={term}
            onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(term)} />
          <button className="btn" onClick={() => run(term)} disabled={loading}>{loading ? "جارٍ التحليل…" : "🔮 اكتشف"}</button>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <RangeSelect value={range} onChange={setRange} disabled={loading} />
          {monitors.map((m) => (
            <button key={m.name} className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }}
              onClick={() => run((m.keywords || [m.name])[0])}>{m.name}</button>
          ))}
        </div>
      </div>

      {loading && <div className="spinner" />}

      {res && !loading && (res.error ? <p className="muted">{res.message || "تعذّر التحليل."}</p> : (
        <>
          <div className="card" style={{ marginBottom: 14, textAlign: "center", borderColor: a.c + "66", background: a.bg + "22" }}>
            <div style={{ fontSize: 46, fontWeight: 800, color: a.c }}>{res.trend_score}<span style={{ fontSize: 18 }}>/100</span></div>
            <h3 style={{ margin: "4px 0", color: a.c }}>{res.alert.label}</h3>
            <p className="muted" style={{ fontSize: 13 }}>سردية: <b>{res.narrative}</b> · {res.coordination_verdict}</p>
          </div>

          <div className="cbox" style={{ marginBottom: 14 }}>
            <h4>مكوّنات الدرجة</h4>
            {Object.entries(res.normalized || {}).map(([k, v]: any) => (
              <div className="srcrow" key={k} style={{ marginBottom: 6 }}>
                <div style={{ width: 110, fontSize: 13 }}>{METRIC_LABEL[k] || k}</div>
                <div className="bar"><i style={{ width: `${Math.round(v * 100)}%` }} /></div>
                <div className="num">{Math.round(v * 100)}</div>
              </div>
            ))}
          </div>

          <div className="stat-grid" style={{ marginBottom: 14 }}>
            <div className="stat"><div className="v">{res.metrics.mention_velocity}×</div><div className="l">تسارع الذِكر</div></div>
            <div className="stat"><div className="v">{res.metrics.engagement_velocity}×</div><div className="l">تسارع التفاعل</div></div>
            <div className="stat"><div className="v">{res.totals.mentions_last_1h}</div><div className="l">ذِكر آخر ساعة</div></div>
            <div className="stat"><div className="v">{res.metrics.influencer_weight}/10</div><div className="l">أعلى مؤثّر</div></div>
          </div>

          <div className="cbox" style={{ marginBottom: 14, background: a.bg }}>
            <h4>📋 تقرير الإنذار المبكر</h4>
            {[["ماذا يحدث؟", res.report.what], ["متى بدأ؟", res.report.when], ["أين ينتشر؟", res.report.where],
              ["من يضخّمه؟", res.report.who], ["النبرة", res.report.sentiment],
              ["عضوي أم منظّم؟", res.report.organic_or_coordinated], ["مستوى الخطر", res.report.risk],
              ["أولوية الاستجابة", res.report.response_priority]].map(([q, val]) => (
              <div key={q} style={{ padding: "5px 0", borderTop: "1px solid var(--line)", fontSize: 13 }}>
                <b style={{ color: "var(--muted)" }}>{q}</b> {val}
              </div>
            ))}
          </div>

          {res.spread && (res.spread.first_poster || res.spread.amplifiers?.length > 0) && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>🧬 أصل الهاشتاج وانتشاره</h4>
              {res.spread.first_poster && (
                <div style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                  <span className="chip" style={{ color: "#f59e0b" }}>أول من نشر</span>{" "}
                  <a href={`https://x.com/${res.spread.first_poster.username}`} target="_blank" rel="noopener" style={{ color: "var(--text)", fontWeight: 700 }}>
                    {res.spread.first_poster.name} <span className="muted">@{res.spread.first_poster.username}</span>
                  </a>
                  <span className="muted" style={{ fontSize: 12 }}> — قبل {res.spread.first_poster.hours_ago} ساعة · {Number(res.spread.first_poster.followers).toLocaleString()} متابع</span>
                </div>
              )}
              {res.spread.first_influential && (
                <div style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                  <span className="chip" style={{ color: "var(--accent)" }}>أول حساب مؤثّر</span>{" "}
                  <a href={`https://x.com/${res.spread.first_influential.username}`} target="_blank" rel="noopener" style={{ color: "var(--text)", fontWeight: 700 }}>
                    {res.spread.first_influential.name} <span className="muted">@{res.spread.first_influential.username}</span>
                  </a>
                  <span className="muted" style={{ fontSize: 12 }}> — قبل {res.spread.first_influential.hours_ago} ساعة · وزن {res.spread.first_influential.influence}</span>
                </div>
              )}
              {res.spread.most_shared_domain && (
                <div style={{ padding: "8px 0", borderTop: "1px solid var(--line)", fontSize: 13 }}>
                  <span className="chip" style={{ color: "var(--accent2)" }}>أكثر رابط منشور</span>{" "}
                  <b>{res.spread.most_shared_domain.domain}</b> <span className="muted">(×{res.spread.most_shared_domain.count})</span>
                </div>
              )}
              {res.spread.amplifiers?.length > 0 && (
                <div style={{ paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>من ساهم بنشره (المضخّمون) — {res.spread.unique_accounts} حساب مشارك:</div>
                  {res.spread.amplifiers.map((m: any, i: number) => (
                    <div className="srcrow" key={i} style={{ marginBottom: 4 }}>
                      <div style={{ width: 18, color: "var(--muted)", fontWeight: 700 }}>{i + 1}</div>
                      <div style={{ flex: 1, fontSize: 13 }}>
                        <a href={`https://x.com/${m.username}`} target="_blank" rel="noopener" style={{ color: "var(--text)" }}>{m.name} <span className="muted">@{m.username}</span></a>
                      </div>
                      <span className="muted" style={{ fontSize: 11 }}>{m.posts} منشور · ♥ {Number(m.engagement).toLocaleString()}</span>
                      <span className="chip" style={{ color: "var(--accent)", marginInlineStart: 6, fontSize: 11 }}>وزن {m.influence}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {res.top_influencers?.length > 0 && (
            <div className="cbox">
              <h4>أبرز المؤثّرين في الموضوع</h4>
              {res.top_influencers.map((i: any) => (
                <div className="srcrow" key={i.username}>
                  <div style={{ flex: 1 }}>
                    <a href={`https://x.com/${i.username}`} target="_blank" rel="noopener" style={{ color: "var(--text)" }}>{i.name} <span className="muted">@{i.username}</span></a>
                  </div>
                  <span className="muted" style={{ fontSize: 12 }}>{Number(i.followers).toLocaleString()} متابع</span>
                  <span className="chip" style={{ color: "var(--accent)", marginInlineStart: 8 }}>وزن {i.influence}</span>
                </div>
              ))}
            </div>
          )}

          <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>
            * نوافذ X محصورة بآخر ٧ أيام (قيد الخطة). تحليل آلي — يحتاج مراجعة بشرية قبل أي قرار.
          </p>
        </>
      ))}
    </div>
  );
}
