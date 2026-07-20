"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { getTargets, primaryKeyword, Target } from "@/lib/targets";
import EvolutionChart from "@/components/EvolutionChart";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

const fmt = (s: string) => { try { return new Date(s).toLocaleString("ar-IQ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
const natColor = (s: number) => (s >= 60 ? "#f43f5e" : s >= 35 ? "#fb923c" : "#22c55e");

export default function PatientZeroView() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [term, setTerm] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async (t: string) => {
    if (!t.trim()) return;
    setTerm(t); setLoading(true); setD(null);
    const r = await apiGet(`/api/patient-zero/${encodeURIComponent(t.trim())}?range=month`).catch(() => null);
    setD(r); setLoading(false);
  };
  useEffect(() => { getTargets().then((ts) => { setTargets(ts); const qp = new URLSearchParams(window.location.search).get("q"); run(qp || primaryKeyword(ts)); }); /* eslint-disable-next-line */ }, []);

  const o = d?.origin_post; const fi = d?.first_influential;

  return (
    <div>
      <h2>🔍 تتبّع المصدر — Patient Zero</h2>
      <p className="muted">لأي موضوع أو وسم: مَن أول حساب أشعله؟ مَن أول مضخّم مؤثّر؟ كيف انتشر ومتى؟ وهل كان عضوياً أم مُدبّراً؟</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="موضوع / وسم / سردية…" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(term)} />
          <button className="btn" onClick={() => run(term)} disabled={loading}>{loading ? "…" : "تتبّع المصدر"}</button>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {targets.map((t) => <button key={t.id} className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => run(t.keywords?.[0] || t.name)}>{t.name}</button>)}
        </div>
      </div>

      {loading && <SkelCards count={3} />}
      {d?.error && <EmptyState tone="error" title="تعذّر التتبّع" subtitle={d.message} action={{ label: "إعادة", onClick: () => run(term) }} />}

      {d && !d.error && (
        <>
          {/* origin */}
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #4f9dff" }}>
            <h4>🎯 المصدر (Patient Zero)</h4>
            {o ? (
              <div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <b style={{ fontSize: 16, color: "#4f9dff" }}>@{o.username}</b>
                  <span className="muted" style={{ fontSize: 12 }}>{o.name} · {o.followers?.toLocaleString()} متابع · {fmt(o.at)}</span>
                </div>
                <p style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.9 }}>«{o.text}»</p>
              </div>
            ) : <span className="muted">—</span>}
            {fi && <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)", fontSize: 13 }}>
              <span className="muted">أول مضخّم مؤثّر: </span><b style={{ color: "#a855f7" }}>@{fi.username}</b>
              <span className="muted"> · {fi.followers?.toLocaleString()} متابع · قبل {fi.hours_ago} ساعة</span></div>}
          </div>

          {/* nature + stats */}
          <div className="grid" style={{ marginBottom: 14 }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: natColor(d.coordination_score) }}>{d.coordination_score}</div>
              <div className="muted" style={{ fontSize: 12 }}>درجة التنسيق</div>
              <div className="chip" style={{ marginTop: 6, color: natColor(d.coordination_score) }}>{d.nature}</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 900 }}>{d.unique_accounts}</div>
              <div className="muted" style={{ fontSize: 12 }}>حساب مشارك</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 900 }}>{d.total_posts}</div>
              <div className="muted" style={{ fontSize: 12 }}>منشور مرصود</div>
            </div>
          </div>

          {/* spread timeline */}
          {d.series?.length > 1 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>📈 منحنى الانتشار</h4>
              <EvolutionChart series={d.series} turningPoints={d.milestones} />
            </div>
          )}

          {/* amplification chain */}
          {d.amplifiers?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>📡 سلسلة التضخيم (أبرز المضخّمين)</h4>
              {d.amplifiers.map((a: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: i ? "1px solid var(--line)" : 0, fontSize: 13 }}>
                  <span><b>@{a.username}</b> <span className="muted">· {a.followers?.toLocaleString()} متابع · {a.posts} منشور</span></span>
                  <span className="muted">تفاعل {a.engagement?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {d.summary && <div className="cbox" style={{ marginBottom: 14 }}><h4>🧠 القراءة الاستخباراتية</h4><p style={{ fontSize: 14, lineHeight: 2 }}>{d.summary}</p></div>}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
