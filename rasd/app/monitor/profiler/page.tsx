"use client";
import { useState } from "react";
import { apiGet } from "@/lib/api";
import Gauge from "@/components/Gauge";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

const stanceColor = (s: string) => (s === "مؤيّد" ? "#22c55e" : s === "معارض" ? "#f43f5e" : "#8a97ad");
const colColor = (v: number) => (v >= 60 ? "#f43f5e" : v >= 35 ? "#fb923c" : "#22c55e");

export default function Profiler() {
  const [h, setH] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!h.trim() || loading) return;
    setLoading(true); setD(null);
    const r = await apiGet(`/api/profiler/${encodeURIComponent(h.trim())}?range=month`).catch(() => null);
    setD(r); setLoading(false);
  };
  const p = d?.profile || {}; const c = d?.collusion || {}; const cr = d?.credibility || {};

  return (
    <div>
      <h2>🕵️ بروفايلنغ حساب — تحليل عميق</h2>
      <p className="muted">أعطِ معرّف X (أو رابط بروفايل)، والنظام يحلّل: التوجّه، مَن يدعم/يعارض (لكل كيان)، أنماطه، نبرته، مصداقيته، وإشارات التواطؤ/التنسيق.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="@username أو https://x.com/username" value={h}
            onChange={(e) => setH(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
          <button className="btn" onClick={run} disabled={loading}>{loading ? "…يحلّل" : "حلّل الحساب"}</button>
        </div>
      </div>

      {loading && <SkelCards count={3} />}
      {d?.error && <EmptyState tone="error" title="تعذّر التحليل" subtitle={d.message} action={{ label: "إعادة", onClick: run }} />}

      {d && !d.error && (
        <>
          {/* profile card */}
          <div className="cbox" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0 }}>{p.name || "—"} {p.verified && <span style={{ color: "#4f9dff" }}>✔</span>}</h3>
                <div className="muted" style={{ fontSize: 13 }}>@{p.username} {p.location ? `· ${p.location}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 13, flexWrap: "wrap" }}>
                <span><b>{p.followers?.toLocaleString()}</b><br /><span className="muted">متابع</span></span>
                <span><b>{p.following?.toLocaleString()}</b><br /><span className="muted">يتابع</span></span>
                <span><b>{p.age_days ? Math.round(p.age_days / 30) : "?"}ش</b><br /><span className="muted">عمر الحساب</span></span>
                <span><b>{p.posts_per_day}</b><br /><span className="muted">منشور/يوم</span></span>
              </div>
            </div>
            {p.bio && <p style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.8 }}>{p.bio}</p>}
          </div>

          {/* stance map */}
          <div className="cbox" style={{ marginBottom: 14 }}>
            <h4>🎯 مواقفه (دعم / معارضة / تأييد)</h4>
            {d.leaning_stances?.length ? d.leaning_stances.map((s: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{s.entity}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>تأييد {s.support} · معارضة {s.oppose} · {s.mentions} منشور</span>
                <span className="chip" style={{ background: stanceColor(s.stance), color: "#fff", fontWeight: 800, minWidth: 64, textAlign: "center" }}>{s.stance}</span>
              </div>
            )) : <span className="muted">لم يُرصد موقف واضح من الكيانات المتابَعة.</span>}
          </div>

          <div className="grid" style={{ marginBottom: 14 }}>
            {/* credibility + collusion */}
            <div className="cbox">
              <h4>🔒 المصداقية والتواطؤ</h4>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <Gauge value={c.score || 0} size={84} invert color={colColor(c.score || 0)} />
                  <div style={{ fontSize: 11, marginTop: 2 }}>مؤشر التواطؤ</div>
                </div>
                <div style={{ flex: 1, minWidth: 150, fontSize: 13, lineHeight: 1.9 }}>
                  <div className="chip" style={{ color: colColor(c.score || 0) }}>{c.label}</div>
                  <div style={{ marginTop: 6 }}>احتمال بوت/آلية: <b style={{ color: colColor(cr.bot_likeness || 0) }}>{cr.bot_likeness}%</b></div>
                  <div>تكرار المحتوى: <b>{Math.round((c.duplicate_ratio || 0) * 100)}%</b></div>
                  {cr.reasons?.length ? <div className="muted" style={{ fontSize: 11.5 }}>{cr.reasons.join(" · ")}</div> : null}
                </div>
              </div>
            </div>
            {/* emotions + amplifies */}
            <div className="cbox">
              <h4>🌡️ النبرة ومَن يضخّم</h4>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                {(d.emotions || []).map((e: any) => <span key={e.emotion} className="chip">{e.emotion} {e.value}%</span>)}
              </div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 3 }}>أكثر مَن يتفاعل معهم:</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {(d.amplifies || []).slice(0, 8).map((a: any) => <span key={a.username} className="chip muted">@{a.username} ({a.count})</span>)}
                {!d.amplifies?.length && <span className="muted">—</span>}
              </div>
            </div>
          </div>

          {/* topics */}
          {(d.top_hashtags?.length || d.top_keywords?.length) ? (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>🏷️ أبرز المواضيع</h4>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(d.top_hashtags || []).map((t: any, i: number) => <span key={"h" + i} className="chip" style={{ color: "var(--accent)" }}>#{t.hashtag || t}</span>)}
                {(d.top_keywords || []).map((t: any, i: number) => <span key={"k" + i} className="chip">{t.keyword || t}</span>)}
              </div>
            </div>
          ) : null}

          {d.summary && <div className="cbox" style={{ marginBottom: 14 }}><h4>🧠 البروفايل التحليلي</h4><p style={{ fontSize: 14, lineHeight: 2 }}>{d.summary}</p></div>}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
