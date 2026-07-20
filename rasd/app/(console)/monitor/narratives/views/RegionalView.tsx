"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import RegionMap from "@/components/RegionMap";
import RegionFlowChart from "@/components/RegionFlowChart";

const magColor = (v: number) => (v >= 60 ? "#f43f5e" : v >= 35 ? "#fb923c" : "#eab308");
const fmtH = (iso: string) => { try { return new Date(iso).toLocaleString("ar-IQ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

export default function RegionalView() {
  const [countries, setCountries] = useState<any[]>([]);
  const [ov, setOv] = useState<any>(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [source, setSource] = useState("IQ");
  const [target, setTarget] = useState("SY");
  const [range, setRange] = useState("week");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGet("/api/regional-influence/countries").then((r) => setCountries(r?.countries || [])).catch(() => {});
    apiGet(`/api/regional-influence/overview?range=week`).then(setOv).finally(() => setOvLoading(false));
    run("IQ", "SY", "week");
    // eslint-disable-next-line
  }, []);

  const run = (s: string, t: string, rng: string) => {
    if (s === t) return;
    setLoading(true); setD(null);
    apiGet(`/api/regional-influence?source=${s}&target=${t}&range=${rng}`).then(setD).finally(() => setLoading(false));
  };
  const pickNeighbor = (cc: string) => { setSource("IQ"); setTarget(cc); run("IQ", cc, range); window.scrollTo({ top: 9999, behavior: "smooth" }); };

  const st = d?.overview || {};
  const cname = (cc: string) => countries.find((c) => c.code === cc)?.name || cc;

  return (
    <div>
      <h2>🌍 التأثير الإقليمي — كيف تتأثّر تيلاينات المنطقة وتؤثّر</h2>
      <p className="muted">يبني خطاً زمنياً إعلامياً لكل دولة، ثم يكشف بين كل زوج: من بدأ القضية أولاً، اتجاه التأثير، درجته وثقته، فئته، نوعه (عضوي/إعلامي/سياسي/منسّق)، قادته، المتأثّرين، ومتى حدث — مع الأدلّة.</p>

      {/* influence map */}
      <div className="cbox" style={{ marginBottom: 14 }}>
        <h4>🗺️ خريطة التأثير الإقليمي (العراق ↔ الجوار)</h4>
        {ovLoading ? <SkelCards count={1} /> : ov?.edges ? <RegionMap data={ov} onPick={pickNeighbor} /> : <p className="muted">لا بيانات بعد.</p>}
      </div>

      {/* pair selector */}
      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 13 }}>قارن:</span>
        <select value={source} onChange={(e) => setSource(e.target.value)} style={{ padding: "6px 10px" }}>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
        </select>
        <b style={{ color: "var(--muted)" }}>↔</b>
        <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ padding: "6px 10px" }}>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
        </select>
        {[["day", "يوم"], ["week", "أسبوع"], ["month", "شهر"]].map(([v, l]) => (
          <button key={v} className={`btn ${range === v ? "" : "ghost"}`} style={{ padding: "4px 12px", fontSize: 13 }}
            onClick={() => { setRange(v); run(source, target, v); }}>{l}</button>
        ))}
        <button className="btn" onClick={() => run(source, target, range)} disabled={loading}>{loading ? "…" : "حلّل"}</button>
      </div>

      {loading && <SkelCards count={3} />}
      {d?.error && <EmptyState tone="error" title="تعذّر التحليل" subtitle={d.message} action={{ label: "إعادة", onClick: () => run(source, target, range) }} />}

      {d && !d.error && (
        <>
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #4f9dff" }}>
            <div style={{ fontSize: 22, fontWeight: 900, textAlign: "center", color: "#4f9dff" }}>
              {d.source_flag} {d.source_country} ↔ {d.target_flag} {d.target_country}</div>
            <div style={{ fontSize: 16, fontWeight: 800, textAlign: "center", margin: "4px 0" }}>{st.direction}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 10, marginTop: 12 }}>
              {[["قضايا مشتركة", st.shared_issues, "#4f9dff"],
                [`${d.source_country} يقود`, st.src_leads, "#22c55e"],
                [`${d.target_country} يقود`, st.tgt_leads, "#f59e0b"],
                ["متزامنة", st.concurrent, "#a855f7"],
                ["قوة التأثير", st.strength, magColor(st.strength || 0)]].map(([l, v, c]: any) => (
                <div key={l} style={{ textAlign: "center", padding: "8px 4px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--input)" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: c }}>{v ?? 0}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{l}</div>
                </div>
              ))}
            </div>
            {d.summary && <p style={{ fontSize: 14, lineHeight: 2, marginTop: 12 }}>{d.summary}</p>}
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              حسابات مُحدّدة الموقع: {d.source_country} {st.src_located} · {d.target_country} {st.tgt_located}
              {st.located_ok === false && <span style={{ color: "#fb923c", marginInlineStart: 8 }}>⚠ عيّنة موقع صغيرة — الثقة مخفّضة</span>}
            </div>
          </div>

          {d.issues?.length ? d.issues.map((it: any, i: number) => (
            <div key={i} className="cbox" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <h4 style={{ margin: 0 }}>قضية: {it.issue} <span className="chip" style={{ fontSize: 11 }}>{it.category}</span></h4>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {it.type && <span className="chip" style={{ background: it.type_color, color: "#fff" }}>{it.type}</span>}
                  <span className="chip" style={{ background: magColor(it.influence_score), color: "#fff", fontWeight: 800 }}>تأثير {it.influence_score}</span>
                  <span className="chip">ثقة {it.confidence}</span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0", fontSize: 15, fontWeight: 700, flexWrap: "wrap" }}>
                {it.concurrent
                  ? <span style={{ color: "#a855f7" }}>🔄 تداول متزامن — بلا قائد واضح</span>
                  : <><span>{it.leader_country}</span><span style={{ color: "#4f9dff", fontWeight: 900 }}>──{it.lag_hours}س──▶</span><span>{it.follower_country}</span></>}
                <span className="muted" style={{ fontSize: 12 }}>· ارتباط {it.correlation} · {it.src_count}/{it.tgt_count} منشور</span>
              </div>

              {it.series && <RegionFlowChart series={it.series} srcLabel={d.source_country} tgtLabel={d.target_country} leadOnset={it.lead_onset} followOnset={it.follow_onset} />}

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

              {/* evidence */}
              {it.evidence && (it.evidence.source_post || it.evidence.target_post) && (
                <div className="card" style={{ marginTop: 10, background: "var(--input)" }}>
                  <div className="muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>📎 الأدلّة · تطابق {it.evidence.similarity}%{it.evidence.matched_hashtag ? ` · #${it.evidence.matched_hashtag}` : ""}</div>
                  {it.evidence.source_post && <div style={{ fontSize: 12.5, marginBottom: 6 }}>
                    <b style={{ color: "#4f9dff" }}>أول منشور (القائد):</b> @{it.evidence.source_post.username} · {fmtH(it.evidence.source_post.at)}<br />«{it.evidence.source_post.text}»</div>}
                  {it.evidence.target_post && <div style={{ fontSize: 12.5 }}>
                    <b style={{ color: "#f59e0b" }}>أول منشور (المتأثّر):</b> @{it.evidence.target_post.username} · {fmtH(it.evidence.target_post.at)}<br />«{it.evidence.target_post.text}»</div>}
                </div>
              )}
            </div>
          )) : <EmptyState title="لا قضايا تأثير مشتركة كافية" subtitle="جرّب نطاقاً أوسع أو زوجاً آخر." />}

          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
