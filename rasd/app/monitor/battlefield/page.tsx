"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { getTargets, primaryKeyword, Target } from "@/lib/targets";
import Gauge from "@/components/Gauge";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import BattlefieldGraph from "@/components/BattlefieldGraph";

const C = { neg: "#f43f5e", pos: "#22c55e", neu: "#8a97ad" };

export default function Battlefield() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [term, setTerm] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<any>(null);

  const run = async (name: string) => {
    if (!name.trim()) return;
    setTerm(name); setLoading(true); setD(null); setSel(null);
    const r = await apiGet(`/api/battlefield/entity/${encodeURIComponent(name.trim())}?range=week`).catch(() => null);
    setD(r); setLoading(false);
  };
  useEffect(() => {
    const qp = new URLSearchParams(window.location.search).get("q");
    getTargets().then((ts) => { setTargets(ts); run(qp || primaryKeyword(ts)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sc = d?.scores || {};
  const vd = d?.verdict || {};

  return (
    <div>
      <h2>⚔️ ساحة المعركة الإعلامية</h2>
      <p className="muted">خريطة استراتيجية حيّة: من يهاجم ومن يدعم هذا الكيان، أي سرديات تُستخدم، ومن يضخّمها — مع موازين القوى.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="شخصية / وزارة / حزب / جهة…" value={term}
            onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(term)} />
          <button className="btn" onClick={() => run(term)} disabled={loading}>{loading ? "…" : "حلّل الساحة"}</button>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {targets.map((t) => (
            <button key={t.id} className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }}
              onClick={() => run(t.keywords?.[0] || t.name)}>{t.name}</button>
          ))}
        </div>
      </div>

      {loading && <SkelCards count={3} />}
      {d?.error && <EmptyState tone="error" title="تعذّر تحليل الساحة" subtitle={d.message} action={{ label: "إعادة", onClick: () => run(term) }} />}

      {d && !d.error && (
        <>
          {/* verdict + AI summary */}
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: `4px solid ${sc.attack_pressure >= 60 ? C.neg : sc.support_strength >= 60 ? C.pos : "#f59e0b"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <h4 style={{ margin: 0 }}>الموقف: <span style={{ color: sc.attack_pressure >= 60 ? C.neg : sc.support_strength >= 60 ? C.pos : "#f59e0b" }}>{vd.state || "—"}</span></h4>
              <span className="chip" style={{ color: d.risk_level === "حرج" ? C.neg : d.risk_level === "مرتفع" ? "#fb923c" : "#f59e0b" }}>الخطر: {d.risk_level}</span>
            </div>
            {d.summary && <p style={{ fontSize: 14, lineHeight: 2, marginTop: 8 }}>{d.summary}</p>}
            <div className="muted" style={{ fontSize: 12 }}>
              {d.totals?.attackers} مهاجم · {d.totals?.supporters} داعم · {d.totals?.posts} منشور · {d.totals?.news} خبر</div>
          </div>

          {/* battlefield scores */}
          <div className="grid" style={{ marginBottom: 14 }}>
            <div className="card" style={{ textAlign: "center", paddingTop: 16 }}>
              <Gauge value={sc.attack_pressure || 0} size={104} invert color={C.neg} />
              <div style={{ fontWeight: 700, marginTop: 6 }}>ضغط الهجوم</div></div>
            <div className="card" style={{ textAlign: "center", paddingTop: 16 }}>
              <Gauge value={sc.support_strength || 0} size={104} color={C.pos} />
              <div style={{ fontWeight: 700, marginTop: 6 }}>قوة الدعم</div></div>
            <div className="card" style={{ textAlign: "center", paddingTop: 16 }}>
              <Gauge value={sc.advantage || 0} size={104} />
              <div style={{ fontWeight: 700, marginTop: 6 }}>أفضلية الميدان</div></div>
          </div>

          {/* the graph */}
          <div className="cbox" style={{ marginBottom: 14 }}>
            <h4>🗺️ خريطة المعركة</h4>
            <BattlefieldGraph data={d} onSelect={setSel} />
          </div>

          {/* side panel */}
          {sel && (
            <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid var(--accent)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <h4 style={{ margin: 0 }}>{sel.name}</h4>
                <button className="btn ghost" style={{ padding: "2px 10px", fontSize: 12 }} onClick={() => setSel(null)}>إغلاق</button>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                النوع: {sel.type} {sel.platform ? `· ${sel.platform}` : ""} · تأثير {sel.influence_score ?? "—"}
                {sel.risk_score != null && ` · خطر/بوت ${sel.risk_score}`}
                {sel.activity_level != null && ` · نشاط ${sel.activity_level}`}
                {sel.followers != null && ` · ${Number(sel.followers).toLocaleString()} متابع`}
              </div>
              {String(sel.id).startsWith("acc:") && <a href={`https://x.com/${String(sel.name).replace("@", "")}`} target="_blank" rel="noopener" className="btn" style={{ marginTop: 8, display: "inline-block", padding: "5px 12px" }}>فتح الحساب ↗</a>}
            </div>
          )}

          {/* attackers | supporters */}
          <div className="cc-grid">
            <div className="cbox">
              <h4 style={{ color: C.neg }}>🔴 أبرز المهاجمين</h4>
              {(d.top_attackers || []).length === 0 && <span className="muted">لا مهاجمون بارزون.</span>}
              {(d.top_attackers || []).map((a: any, i: number) => (
                <div key={i} style={{ padding: "7px 0", borderTop: i ? "1px solid var(--line)" : 0, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <a href={`https://x.com/${a.username}`} target="_blank" rel="noopener" style={{ color: "var(--text)" }}>@{a.username}</a>
                    <span className="muted" style={{ fontSize: 11 }}>{a.posts} منشور · بوت {a.bot}</span>
                  </div>
                  {a.evidence?.[0] && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>“{a.evidence[0]}…”</div>}
                </div>
              ))}
            </div>
            <div className="cbox">
              <h4 style={{ color: C.pos }}>🟢 أبرز الداعمين</h4>
              {(d.top_supporters || []).length === 0 && <span className="muted">الدعم محدود / مجزّأ.</span>}
              {(d.top_supporters || []).map((a: any, i: number) => (
                <div key={i} style={{ padding: "7px 0", borderTop: i ? "1px solid var(--line)" : 0, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <a href={`https://x.com/${a.username}`} target="_blank" rel="noopener" style={{ color: "var(--text)" }}>@{a.username}</a>
                    <span className="muted" style={{ fontSize: 11 }}>{a.posts} منشور · {Number(a.followers).toLocaleString()} متابع</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* narratives | recommended actions */}
          <div className="cc-grid">
            <div className="cbox">
              <h4>🧬 السرديات في الميدان</h4>
              {(d.top_narratives || []).map((n: any, i: number) => (
                <div key={i} style={{ margin: "7px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span>{n.narrative} <span className="muted">({(n.keywords || []).slice(0, 3).join("، ")})</span></span>
                    <b style={{ color: n.neg_ratio > 0.5 ? C.neg : C.neu }}>{n.share}%</b>
                  </div>
                  <div className="bar" style={{ height: 6 }}><i style={{ width: `${n.share}%`, background: n.neg_ratio > 0.5 ? C.neg : "#4f9dff" }} /></div>
                </div>
              ))}
            </div>
            <div className="cbox">
              <h4>🎯 التوصيات</h4>
              <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 2, fontSize: 13.5 }}>
                {(d.recommended_actions || []).map((r: string, i: number) => <li key={i}>{r}</li>)}
                {!(d.recommended_actions || []).length && <span className="muted">—</span>}
              </ul>
              {d.top_campaigns?.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <b className="muted">حملة مشتبهة:</b> #{d.top_campaigns[0].hashtag} — تنسيق {d.top_campaigns[0].coordination_score}/100 ({d.top_campaigns[0].level})
                </div>
              )}
            </div>
          </div>

          {/* timeline turning points */}
          {d.timeline?.turning_points?.length > 0 && (
            <div className="cbox" style={{ marginTop: 14 }}>
              <h4>⏳ نقاط التحوّل</h4>
              {(d.timeline.turning_points || []).slice(0, 6).map((m: any, i: number) => (
                <div key={i} style={{ fontSize: 13, padding: "5px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <span className="muted" style={{ fontSize: 11 }}>{m.at ? new Date(m.at).toLocaleString("ar-IQ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                  {" — "}{({ velocity_spike: "قفزة في الحجم", sentiment_shift: "تحوّل بالنبرة", peak_detected: "ذروة", first_influencer_amplification: "أول تضخيم مؤثّر", campaign_alert: "إنذار حملة" } as any)[m.type] || m.type}
                </div>
              ))}
            </div>
          )}

          <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
