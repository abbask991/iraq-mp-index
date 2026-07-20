"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { getTargets, primaryKeyword, Target } from "@/lib/targets";
import { useDemo } from "@/components/ui/DemoContext";
import Gauge from "@/components/Gauge";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import CoordNetwork from "@/components/CoordNetwork";

const fmtTime = (s: string) => {
  try { return new Date(s).toLocaleString("ar-IQ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return s; }
};

export default function CoordinationView() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [term, setTerm] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { demo } = useDemo();

  const run = async (name: string) => {
    if (!name.trim()) return;
    setTerm(name); setLoading(true); setD(null);
    const r = await apiGet(`/api/coordination/${encodeURIComponent(name.trim())}?range=week${demo ? "&demo=1" : ""}`).catch(() => null);
    setD(r); setLoading(false);
  };
  useEffect(() => {
    const qp = new URLSearchParams(window.location.search).get("q");
    getTargets().then((ts) => { setTargets(ts); run(qp || primaryKeyword(ts)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // re-run when the demo switch flips
  useEffect(() => { if (term) run(term); /* eslint-disable-next-line */ }, [demo]);

  const vd = d?.verdict || {};
  const m = d?.metrics || {};

  return (
    <div>
      <h2>🕸️ كشف الشبكات المنسّقة</h2>
      <p className="muted">مَن يقف خلف الحملة؟ نكشف حلقات النسخ واللصق، شبكة الحسابات التي تتحرّك سوا، التزامن غير الطبيعي، والحسابات المشبوهة.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="شخصية / وزارة / حزب / وسم / موضوع…" value={term}
            onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(term)} />
          <button className="btn" onClick={() => run(term)} disabled={loading}>{loading ? "…" : "افحص التنسيق"}</button>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {targets.map((t) => (
            <button key={t.id} className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }}
              onClick={() => run(t.keywords?.[0] || t.name)}>{t.name}</button>
          ))}
        </div>
      </div>

      {loading && <SkelCards count={3} />}
      {d?.error && <EmptyState tone="error" title="تعذّر فحص التنسيق" subtitle={d.message} action={{ label: "إعادة", onClick: () => run(term) }} />}

      {d && !d.error && (
        <>
          {/* verdict + score */}
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: `4px solid ${vd.color || "#64748b"}` }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <Gauge value={d.coordination_score || 0} size={104} invert color={vd.color} />
                <div style={{ fontWeight: 700, marginTop: 4, fontSize: 12 }}>درجة التنسيق</div>
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <h4 style={{ margin: "0 0 4px" }}>الحكم: <span style={{ color: vd.color }}>{vd.label || "—"}</span>
                  <span className="chip" style={{ marginInlineStart: 8, color: vd.color }}>{vd.level}</span></h4>
                <p style={{ fontSize: 13, margin: "4px 0" }}>{vd.text}</p>
                {d.summary && <p style={{ fontSize: 14, lineHeight: 2, marginTop: 6 }}>{d.summary}</p>}
              </div>
            </div>
          </div>

          {/* metric strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginBottom: 14 }}>
            {[
              ["خلايا متناسقة", m.cells, "#f43f5e"],
              ["أكبر خليّة", m.largest_cell, "#fb923c"],
              ["حلقات نسخ", m.rings, "#a855f7"],
              ["روابط قوية", m.strong_links, "#ec4899"],
              ["حسابات متشابكة", m.networked_accounts, "#4f9dff"],
              ["نسبة التكرار", `${Math.round((m.duplicate_ratio || 0) * 100)}%`, "#eab308"],
              ["نسبة المشبوهة", `${Math.round((m.suspicious_ratio || 0) * 100)}%`, "#f59e0b"],
              ["إجمالي المنشورات", m.total_posts, "#34d6c6"],
            ].map(([l, v, c]: any) => (
              <div className="card" key={l} style={{ textAlign: "center", padding: "12px 8px" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: c }}>{v ?? 0}</div>
                <div className="muted" style={{ fontSize: 12 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* the network */}
          <div className="cbox" style={{ marginBottom: 14 }}>
            <h4>🕸️ شبكة الحسابات المنسّقة</h4>
            <CoordNetwork data={d.network} />
          </div>

          {/* copypasta rings */}
          {d.rings?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>📋 حلقات المحتوى المتكرّر ({d.rings.length})</h4>
              {d.rings.map((r: any, i: number) => (
                <div key={i} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span className="chip" style={{ color: "#f43f5e" }}>{r.author_count} حساب</span>
                    <span className="chip">{r.post_count} منشور</span>
                    {r.span_minutes > 0 && <span className="chip muted">خلال {r.span_minutes} دقيقة</span>}
                  </div>
                  <p style={{ fontSize: 13, margin: "4px 0", lineHeight: 1.9 }}>«{r.text}»</p>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {(r.authors || []).slice(0, 12).map((a: string) => (
                      <span key={a} style={{ fontSize: 11, color: "var(--muted)" }}>@{a}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid" style={{ marginBottom: 14 }}>
            {/* synchronized bursts */}
            {d.bursts?.length > 0 && (
              <div className="cbox">
                <h4>⏱️ دفعات نشر متزامنة</h4>
                {d.bursts.map((b: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                    <span>{fmtTime(b.at)}</span>
                    <span><b style={{ color: "#fb923c" }}>{b.count}</b> منشور · {b.accounts} حساب · ×{b.ratio}</span>
                  </div>
                ))}
              </div>
            )}

            {/* suspicious accounts */}
            {d.suspicious_accounts?.length > 0 && (
              <div className="cbox">
                <h4>🤖 حسابات مشبوهة</h4>
                {d.suspicious_accounts.map((s: any, i: number) => (
                  <div key={i} style={{ padding: "6px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>@{s.username}</span>
                      <span className="chip" style={{ color: s.suspicion >= 70 ? "#f43f5e" : "#fb923c" }}>{s.suspicion}%</span>
                    </div>
                    <div className="muted" style={{ fontSize: 11 }}>{(s.reasons || []).join(" · ")}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
