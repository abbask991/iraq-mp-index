"use client";
import { useState } from "react";
import { apiGet } from "@/lib/api";
import Gauge from "@/components/Gauge";
import IraqMap from "@/components/IraqMap";

const idxColor = (i: number) => (i <= 29 ? "#f43f5e" : i <= 44 ? "#fb923c" : i <= 55 ? "#f59e0b" : i <= 70 ? "#84cc16" : "#22c55e");
const gapColor = (g: number) => (g <= 20 ? "#22c55e" : g <= 40 ? "#f59e0b" : g <= 70 ? "#fb923c" : "#f43f5e");
const confColor = (l?: string) => (l === "عالية جداً" || l === "عالية" ? "#22c55e" : l === "متوسطة" ? "#f59e0b" : "#f43f5e");

export default function Opinion() {
  const [target, setTarget] = useState("");
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const run = async (t?: string) => {
    const q = (t ?? target).trim(); if (!q) return;
    setTarget(q); setBusy(true); setD(null);
    const r = await apiGet(`/api/opinion?target=${encodeURIComponent(q)}`).catch(() => null);
    setD(r); setBusy(false);
  };

  const g = d?.media_public_gap || {}; const f = d?.forecast || {}; const s = d?.ai_summary || {};

  return (
    <div>
      <h2 style={{ margin: 0 }}>الرأي العام الرقمي (PPOI)</h2>
      <p className="muted" style={{ marginTop: 4 }}>قياس الرأي العام المرصود من التعبير الرقمي — لا استطلاع تمثيلي. مؤشر الرأي، الضغط العام، وفجوة الإعلام-الجمهور.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <input placeholder="الهدف (كيان أو قضية، مثال: وزارة الكهرباء)" value={target} onChange={(e) => setTarget(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} style={{ flex: 1, minWidth: 220 }} />
        <button className="btn" onClick={() => run()} disabled={busy}>{busy ? "جارٍ القياس…" : "قياس الرأي"}</button>
        {["وزارة الكهرباء", "الرواتب", "الحكومة"].map((x) => <button key={x} className="btn ghost" style={{ fontSize: 12 }} onClick={() => run(x)}>{x}</button>)}
      </div>

      {busy && <div><span className="spinner" /> رصد التعبير · كشف الآراء · ترجيح · حساب المؤشرات…</div>}
      {d?.error && <p className="muted">تعذّر — {d.error}</p>}

      {d && !d.error && (
        <>
          {/* index gauges */}
          <div className="cbox">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <Gauge value={d.public_opinion_index} size={92} color={idxColor(d.public_opinion_index)} />
                <div className="muted" style={{ fontSize: 11 }}>مؤشر الرأي · {d.public_opinion_label}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <Gauge value={d.public_pressure_index} size={92} invert />
                <div className="muted" style={{ fontSize: 11 }}>الضغط العام</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: confColor(d.confidence_label) }}>{d.confidence_score}</div>
                <div className="muted" style={{ fontSize: 11 }}>الثقة · {d.confidence_label}{d.directional ? " (توجيهي)" : ""}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 900 }}>{d.dominant_emotion}</div>
                <div className="muted" style={{ fontSize: 11 }}>الانفعال الغالب</div>
              </div>
            </div>
            {/* support vs oppose */}
            <div style={{ display: "flex", height: 22, borderRadius: 11, overflow: "hidden", marginTop: 14, border: "1px solid var(--line)" }}>
              <div style={{ width: `${d.support_percent}%`, background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#04121a" }}>مؤيّد {d.support_percent}%</div>
              <div style={{ width: `${d.neutral_percent}%`, background: "var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--muted)" }}>{d.neutral_percent}%</div>
              <div style={{ width: `${d.oppose_percent}%`, background: "#f43f5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>معارض {d.oppose_percent}%</div>
            </div>
          </div>

          {/* AI summary */}
          {s.executive && (
            <div className="cbox" style={{ marginTop: 14 }}>
              <h4 style={{ marginTop: 0 }}>الخلاصة {s.fallback ? "" : "(ذكاء)"}</h4>
              <p style={{ fontSize: 14.5, lineHeight: 2 }}>{s.executive}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8, fontSize: 13 }}>
                {s.main_reasons && <div><b>الأسباب:</b> {s.main_reasons}</div>}
                {s.whats_changing && <div><b>ما يتغيّر:</b> {s.whats_changing}</div>}
                {s.what_may_happen && <div><b>ما قد يحدث:</b> {s.what_may_happen}</div>}
              </div>
              {d.recommended_action && <div style={{ marginTop: 8, color: "var(--accent)", fontSize: 13 }}><b>الإجراء الموصى:</b> {d.recommended_action}</div>}
            </div>
          )}

          {/* MEDIA-PUBLIC GAP — killer feature */}
          <div className="cbox" style={{ marginTop: 14, borderInlineStart: `4px solid ${gapColor(g.gap_score)}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <h4 style={{ margin: 0 }}>فجوة الإعلام — الجمهور</h4>
              <span className="chip" style={{ color: gapColor(g.gap_score) }}>{g.label} · {g.gap_score}/100</span>
            </div>
            <div style={{ display: "flex", gap: 16, margin: "10px 0", flexWrap: "wrap" }}>
              <div><span className="muted" style={{ fontSize: 12 }}>مزاج الإعلام</span><div style={{ fontSize: 22, fontWeight: 800, color: g.media_sentiment >= 0 ? "#22c55e" : "#f43f5e" }}>{g.media_sentiment > 0 ? "+" : ""}{g.media_sentiment}</div></div>
              <div><span className="muted" style={{ fontSize: 12 }}>رأي الجمهور</span><div style={{ fontSize: 22, fontWeight: 800, color: g.public_opinion >= 0 ? "#22c55e" : "#f43f5e" }}>{g.public_opinion > 0 ? "+" : ""}{g.public_opinion}</div></div>
            </div>
            <p className="muted" style={{ fontSize: 12.5 }}>{g.explanation}</p>
          </div>

          <div className="cc-grid" style={{ marginTop: 14 }}>
            <div className="cbox">
              <h4 style={{ marginTop: 0, color: "#f43f5e" }}>أبرز الشكاوى</h4>
              {(d.top_complaints || []).map((c: string, i: number) => <div key={i} className="muted" style={{ fontSize: 12.5, padding: "4px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>{c}</div>)}
              {!d.top_complaints?.length && <span className="muted">—</span>}
            </div>
            <div className="cbox">
              <h4 style={{ marginTop: 0, color: "#22c55e" }}>أبرز التأييد</h4>
              {(d.top_support_arguments || []).map((c: string, i: number) => <div key={i} className="muted" style={{ fontSize: 12.5, padding: "4px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>{c}</div>)}
              {!d.top_support_arguments?.length && <span className="muted">—</span>}
            </div>
          </div>

          {/* emotions + narratives */}
          <div className="cc-grid" style={{ marginTop: 14 }}>
            <div className="cbox">
              <h4 style={{ marginTop: 0 }}>الانفعالات</h4>
              {Object.entries(d.emotions || {}).filter(([, v]: any) => v > 0).slice(0, 6).map(([k, v]: any) => (
                <div key={k} style={{ margin: "5px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{k}</span><span className="muted">{v}%</span></div>
                  <div style={{ height: 6, background: "var(--line)", borderRadius: 3 }}><div style={{ width: `${v}%`, height: "100%", background: "#a78bfa", borderRadius: 3 }} /></div>
                </div>
              ))}
            </div>
            <div className="cbox">
              <h4 style={{ marginTop: 0 }}>التوقّع</h4>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{f.expected_direction}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>احتمال {Math.round((f.probability || 0) * 100)}% · ثقة {Math.round((f.confidence || 0) * 100)}%</div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{f.reason}</p>
              {!!d.top_narratives?.length && <div style={{ marginTop: 8 }}>{d.top_narratives.map((n: any, i: number) => <span key={i} className="chip" style={{ margin: 2 }}>{n.narrative} {n.share}%</span>)}</div>}
            </div>
          </div>

          {!!d.geo_breakdown?.located && (
            <div className="cbox" style={{ marginTop: 14 }}>
              <h4 style={{ marginTop: 0 }}>الخريطة الجغرافية (تقديرية)</h4>
              <IraqMap geo={d.geo_breakdown} />
            </div>
          )}

          <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
            {d.sample?.opinions} رأي من {d.sample?.posts_scanned} منشور + {d.sample?.news} خبر · {d.sample?.bots_downweighted} آلي مُخفّض. {d.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}
