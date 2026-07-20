"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { Donut, HBars, Spark } from "@/components/MiniCharts";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");

export default function StudiesView() {
  const [list, setList] = useState<any>(null);
  const [topic, setTopic] = useState("");
  const [study, setStudy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gen, setGen] = useState(false);

  useEffect(() => { apiGet("/api/research/studies?demo=1").then(setList).finally(() => setLoading(false)); }, []);
  const open = async (t: string, real = false) => {
    setGen(true); setStudy(null); setTopic(t);
    const enc = encodeURIComponent(t);
    let r = await apiGet(`/api/research/study?topic=${enc}${real ? "" : "&demo=1"}`).catch(() => null);
    if (real && (!r || r.empty)) {   // sources not active yet → fall back to demo, never empty
      r = await apiGet(`/api/research/study?topic=${enc}&demo=1`).catch(() => null);
    }
    setStudy(r); setGen(false);
  };

  const s = study?.sentiment || {};
  return (
    <div>
      <h2 style={{ margin: 0 }}>الدراسات والبحوث</h2>
      <p className="muted">دراسات بحثية على أي موضوع: ملخّص تنفيذي، منهجية، أبرز النتائج، مشاعر، اتجاه، وتوصيات — مع جارتات.</p>

      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input placeholder="ولّد دراسة على موضوع (مثال: أداء الخدمات الحكومية)" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && open(topic, true)} style={{ flex: 1, minWidth: 240 }} />
        <button className="btn" onClick={() => open(topic || "أداء الخدمات الحكومية", true)} disabled={gen}>{gen ? "…يولّد" : "ولّد دراسة"}</button>
      </div>

      {/* studies library */}
      {loading && <SkelCards count={3} />}
      {!study && list?.studies?.length > 0 && (
        <>
          <h3>مكتبة الدراسات</h3>
          <div className="grid">
            {list.studies.map((st: any) => (
              <div key={st.id} className="cbox" style={{ cursor: "pointer" }} onClick={() => open(st.title)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="chip" style={{ fontSize: 10 }}>{st.type}</span><span className="muted" style={{ fontSize: 11 }}>{st.date}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, margin: "8px 0 6px" }}>{st.title}</div>
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.7 }}>{st.headline}</div>
                <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", margin: "8px 0" }}>
                  <span style={{ width: `${st.sentiment.pos}%`, background: "#22c55e" }} /><span style={{ width: `${st.sentiment.neu}%`, background: "#8a97ad" }} /><span style={{ width: `${st.sentiment.neg}%`, background: "#f43f5e" }} />
                </div>
                <div className="muted" style={{ fontSize: 11 }}>{fmt(st.sample)} إشارة · اضغط للتفاصيل ←</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* single study */}
      {gen && <SkelCards count={3} />}
      {study && !study.empty && (
        <>
          <button className="btn ghost" style={{ fontSize: 12, marginBottom: 10 }} onClick={() => setStudy(null)}>← رجوع للمكتبة</button>
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #6366f1" }}>
            <h3 style={{ marginTop: 0 }}>{study.title}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.9 }}>{study.executive_summary}</p>
          </div>
          <div className="grid" style={{ marginBottom: 14 }}>
            <div className="cbox" style={{ textAlign: "center" }}><h4>المشاعر العامة</h4>
              <Donut size={120} segments={[{ value: s.pos, color: "#22c55e" }, { value: s.neu, color: "#8a97ad" }, { value: s.neg, color: "#f43f5e" }]} label={`${s.neg}%-`} />
              <div style={{ fontSize: 12 }}><span style={{ color: "#22c55e" }}>+{s.pos}%</span> · <span style={{ color: "#f43f5e" }}>-{s.neg}%</span></div>
            </div>
            {study.trend?.length > 0 && <div className="cbox"><h4>اتجاه السلبية</h4><Spark data={study.trend} color="#f43f5e" height={70} /><div className="muted" style={{ fontSize: 11 }}>على مدى الفترة</div></div>}
            {study.themes?.length > 0 && <div className="cbox"><h4>المحاور</h4><HBars data={study.themes.map((t: any) => ({ label: t.name, value: t.share }))} /></div>}
          </div>
          <div className="cbox" style={{ marginBottom: 14 }}><h4>المنهجية</h4>
            <div className="muted" style={{ fontSize: 12.5 }}>المصادر: {(study.methodology?.sources || []).join("، ")} · العيّنة: {fmt(study.methodology?.sample)} · الفترة: {study.methodology?.period} · الثقة: {study.confidence}%</div>
          </div>
          {study.key_findings?.length > 0 && <div className="cbox" style={{ marginBottom: 14 }}><h4>أبرز النتائج</h4>{study.key_findings.map((x: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "3px 0" }}>• {x}</div>)}</div>}
          {study.recommendations?.length > 0 && <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #22c55e" }}><h4>التوصيات</h4>{study.recommendations.map((x: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "3px 0" }}>▸ {x}</div>)}</div>}
          <p className="muted" style={{ fontSize: 11 }}>{study.disclaimer}</p>
        </>
      )}
      {study?.empty && <div className="cbox">{study.note}</div>}
    </div>
  );
}
