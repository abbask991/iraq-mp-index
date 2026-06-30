"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import EvidenceExplorer from "@/components/EvidenceExplorer";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const lvlColor = (l: string) => (/حرج/.test(l) ? "#dc2626" : /مرتفع/.test(l) ? "#f43f5e" : /متوسط/.test(l) ? "#f59e0b" : "#22c55e");
const changeIcon: Record<string, string> = {
  reputation_drop: "📉", reputation_gain: "📈", risk_rise: "⚠️", risk_drop: "✅",
  new_campaign: "📢", new_trend: "🔥", sentiment_shift: "🔄",
};

export default function CommandCenter() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const load = () => { setLoading(true); apiGet("/api/command-center" + (demo ? "?demo=1" : "")).then(setD).finally(() => setLoading(false)); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [demo]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>🎯 مركز القيادة</h2>
        <button className={`btn ${demo ? "" : "ghost"}`} onClick={() => setDemo(!demo)} style={demo ? { background: "#6366f1" } : {}}>🧪 وضع العرض {demo ? "(مفعّل)" : ""}</button>
      </div>
      <p className="muted">ماذا يجب أن يعرفه صانع القرار الآن؟ — الصورة الكاملة خلال 60 ثانية.</p>

      {loading && <SkelCards count={4} />}
      {!loading && d?.empty && !demo && <EmptyState title="لا بيانات مرصودة بعد" subtitle={d?.note} action={{ label: "وضع العرض", onClick: () => setDemo(true) }} />}

      {!loading && d && (!d.empty || demo) && (
        <>
          {demo && <p className="muted" style={{ fontSize: 11.5, color: "#6366f1" }}>🧪 {d.note}</p>}

          {/* Executive brief + urgent recommendation */}
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #6366f1", background: "color-mix(in srgb,#6366f1 6%,var(--card))" }}>
            <h4 style={{ margin: "0 0 6px" }}>🧠 الموجز التنفيذي</h4>
            <p style={{ fontSize: 14.5, lineHeight: 1.9, margin: 0 }}>{d.executive_brief}</p>
            {d.urgent_recommendation && (
              <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, background: "color-mix(in srgb,#f43f5e 12%,transparent)", fontSize: 13.5 }}>
                🚨 <b>الأولوية الآن:</b> {d.urgent_recommendation}
              </div>
            )}
          </div>

          {/* national risk chips */}
          {d.national_risk && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {Object.entries({ political: "سياسي", reputation: "سمعة", crisis: "أزمة", campaign: "حملات" }).map(([k, l]: any) => (
                d.national_risk[k] != null && <span key={k} className="chip" style={{ color: lvlColor(d.national_risk[k] >= 50 ? "مرتفع" : "متوسط") }}>{l}: <b>{d.national_risk[k]}</b></span>
              ))}
              {d.most_damaged && <span className="chip" style={{ color: "#f43f5e" }}>📉 الأكثر تضرّراً: {d.most_damaged.entity} ({d.most_damaged.change})</span>}
              {d.most_improved && <span className="chip" style={{ color: "#22c55e" }}>📈 الأكثر تحسّناً: {d.most_improved.entity} (+{d.most_improved.change})</span>}
            </div>
          )}

          {/* Top risks */}
          {d.top_risks?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <h3 style={{ marginBottom: 8 }}>🔴 أخطر ما يجري اليوم</h3>
              <div className="grid">
                {d.top_risks.map((r: any, i: number) => (
                  <div key={i} className="cbox" style={{ borderInlineStart: `4px solid ${lvlColor(r.level)}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <b style={{ fontSize: 14 }}>{r.entity}</b>
                      <span className="chip" style={{ color: lvlColor(r.level), fontSize: 11 }}>{r.level} · {r.risk}</span>
                    </div>
                    <div style={{ fontSize: 12.5, marginTop: 5, lineHeight: 1.7 }}>{r.reason}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <span className="muted" style={{ fontSize: 11 }}>📎 {fmt(r.evidence_count)} دليل</span>
                      <EvidenceExplorer subject={r.entity} type="risk" score={r.risk} demo={demo} />
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12.5 }}>▸ <b>{r.recommended_action}</b></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* What changed */}
          {d.what_changed?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h3 style={{ marginTop: 0 }}>🔄 ما الذي تغيّر (24 ساعة)؟</h3>
              {d.what_changed.map((c: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: i ? "1px solid var(--line)" : 0, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 18 }}>{changeIcon[c.type] || "•"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5 }}><b>{c.entity}</b> <span className="chip" style={{ fontSize: 10.5, color: lvlColor(c.risk_level) }}>{c.change}</span></div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{c.reason} · 📎 {fmt(c.evidence_count)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid" style={{ marginBottom: 14 }}>
            {/* Active campaigns */}
            {d.active_campaigns?.length > 0 && (
              <div className="cbox">
                <h4>📢 حملات نشطة (الأعلى خطراً)</h4>
                {d.active_campaigns.map((c: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                    <span>#{c.hashtag}</span><span className="chip" style={{ fontSize: 10.5, color: lvlColor(c.level || "متوسط") }}>تنسيق {c.coordination}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Trending */}
            {d.trending?.length > 0 && (
              <div className="cbox">
                <h4>🔥 الأكثر تداولاً الآن</h4>
                {d.trending.map((t: any, i: number) => (
                  <div key={i} style={{ padding: "6px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <b>{t.topic}</b><span className="chip" style={{ fontSize: 10.5, color: lvlColor(t.risk) }}>خطر {t.risk}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>⚡ سرعة {t.velocity} · {t.sentiment} · {fmt(t.posts)} منشور</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommended actions */}
          {d.recommended_actions?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #22c55e" }}>
              <h4 style={{ marginTop: 0 }}>✅ إجراءات موصى بها</h4>
              {d.recommended_actions.map((a: string, i: number) => <div key={i} style={{ fontSize: 13.5, padding: "3px 0" }}>▸ {a}</div>)}
            </div>
          )}

          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
