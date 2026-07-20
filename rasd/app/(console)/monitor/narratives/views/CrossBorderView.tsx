"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import CrossFlowChart from "@/components/CrossFlowChart";

const magColor = (v: number) => (v >= 60 ? "#f43f5e" : v >= 35 ? "#fb923c" : "#eab308");
const flag = (c: string) => (c === "العراق" ? "🇮🇶" : "🇸🇾");
const fmtH = (iso: string) => { try { return new Date(iso).toLocaleString("ar-IQ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

export default function CrossBorderView() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("week");

  const load = (rng: string) => { setLoading(true); setD(null); apiGet(`/api/cross-influence?range=${rng}`).then(setD).finally(() => setLoading(false)); };
  useEffect(() => { load(range); /* eslint-disable-next-line */ }, []);

  const ov = d?.overview || {};

  return (
    <div>
      <h2>🔗 التأثير العابر للحدود — العراق ↔ سوريا</h2>
      <p className="muted">يكشف القضايا المشتركة بين الخطّين الزمنيين: مَن يؤثّر على مَن، بأي درجة، عبر أي قضايا، مَن قادة التأثير ومَن المتأثّرون، ومتى يحدث التأثير.</p>

      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 13 }}>النطاق:</span>
        {[["day", "يوم"], ["week", "أسبوع"], ["month", "شهر"]].map(([v, l]) => (
          <button key={v} className={`btn ${range === v ? "" : "ghost"}`} style={{ padding: "4px 12px", fontSize: 13 }}
            onClick={() => { setRange(v); load(v); }}>{l}</button>
        ))}
      </div>

      {loading && <SkelCards count={3} />}
      {d?.error && <EmptyState tone="error" title="تعذّر التحليل" subtitle={d.message} action={{ label: "إعادة", onClick: () => load(range) }} />}

      {d && !d.error && (
        <>
          {/* direction banner */}
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: `4px solid ${ov.direction?.leader ? "#4f9dff" : "#f59e0b"}` }}>
            <div style={{ fontSize: 22, fontWeight: 900, textAlign: "center", color: "#4f9dff" }}>{ov.direction?.text}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, marginTop: 12 }}>
              {[["قضايا مشتركة", ov.shared_issues, "#4f9dff"],
                ["العراق يقود", ov.iq_leads, "#22c55e"],
                ["سوريا تقود", ov.sy_leads, "#f59e0b"],
                ["متزامنة", ov.concurrent, "#a855f7"],
                ["متوسط التأثير", ov.avg_magnitude, magColor(ov.avg_magnitude || 0)],
                ["متوسط الزمن (س)", ov.avg_lag_hours, "#a855f7"]].map(([l, v, c]: any) => (
                <div key={l} style={{ textAlign: "center", padding: "8px 4px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--input)" }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: c }}>{v ?? 0}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{l}</div>
                </div>
              ))}
            </div>
            {d.summary && <p style={{ fontSize: 14, lineHeight: 2, marginTop: 12 }}>{d.summary}</p>}
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              فُحص {ov.iq_scanned} منشور عراقي · {ov.sy_scanned} منشور سوري</div>
          </div>

          {/* issues */}
          {d.issues?.length ? d.issues.map((it: any, i: number) => (
            <div key={i} className="cbox" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <h4 style={{ margin: 0 }}>قضية: {it.issue}</h4>
                <span className="chip" style={{ background: magColor(it.magnitude), color: "#fff", fontWeight: 800 }}>درجة التأثير {it.magnitude}</span>
              </div>

              {/* direction line */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0", fontSize: 15, fontWeight: 700, flexWrap: "wrap" }}>
                {it.concurrent ? (
                  <span style={{ color: "#a855f7" }}>🔄 تداول متزامن (عراق ⇄ سوريا) — بلا قائد واضح</span>
                ) : (
                  <>
                    <span>{flag(it.leader_country)} {it.leader_country}</span>
                    <span style={{ color: "#4f9dff", fontWeight: 900 }}>──تأثير {it.lag_hours}س──▶</span>
                    <span>{flag(it.follower_country)} {it.follower_country}</span>
                  </>
                )}
                <span className="muted" style={{ fontSize: 12 }}>· ارتباط {it.correlation} · {it.iq_count}/{it.sy_count} منشور</span>
              </div>

              <CrossFlowChart series={it.series} leadOnset={it.lead_onset} followOnset={it.follow_onset} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>👑 قادة التأثير ({it.leader_country})</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {(it.leaders || []).map((a: any) => <span key={a.username} className="chip">@{a.username}<b style={{ marginInlineStart: 4, color: "var(--accent)" }}>{a.engagement}</b></span>)}
                    {!it.leaders?.length && <span className="muted">—</span>}
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>📡 المتأثّرون ({it.follower_country})</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {(it.receivers || []).map((a: any) => <span key={a.username} className="chip">@{a.username}</span>)}
                    {!it.receivers?.length && <span className="muted">—</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, marginTop: 10 }}>
                <span className="muted">⏱️ بدأ القائد: <b style={{ color: "var(--text)" }}>{fmtH(it.lead_onset)}</b></span>
                <span className="muted">↳ تبعه المتأثّر: <b style={{ color: "var(--text)" }}>{fmtH(it.follow_onset)}</b></span>
              </div>
              {it.sample && <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8, fontStyle: "italic" }}>«{it.sample}»</p>}
            </div>
          )) : <EmptyState title="لا قضايا تأثير مشتركة كافية" subtitle="لم تُرصد قضايا مشتركة بحجم كافٍ في هذا النطاق — جرّب نطاقاً أوسع." />}

          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
