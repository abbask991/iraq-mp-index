"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { Donut, Bars } from "@/components/MiniCharts";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");

export default function Polls() {
  const [list, setList] = useState<any>(null);
  const [q, setQ] = useState("");
  const [poll, setPoll] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { apiGet("/api/research/polls?demo=1").then(setList).finally(() => setLoading(false)); }, []);
  const run = async (question: string, real = false) => {
    setBusy(true); setPoll(null); setQ(question);
    const r = await apiGet(`/api/research/poll?question=${encodeURIComponent(question)}${real ? "" : "&demo=1"}`).catch(() => null);
    setPoll(r); setBusy(false);
  };

  const r = poll?.result || {};
  return (
    <div>
      <h2 style={{ margin: 0 }}>استطلاعات الرأي</h2>
      <p className="muted">استطلاع سلبي (Passive): يقيس موقف الجمهور من أي سؤال من نقاش السوشال — مؤيّد/معارض/محايد، حسب المنصّة وعبر الزمن.</p>

      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input placeholder="اطرح سؤالاً (مثال: هل تثق بأداء الحكومة؟)" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(q, true)} style={{ flex: 1, minWidth: 240 }} />
        <button className="btn" onClick={() => run(q || "هل تثق بأداء الحكومة الحالية؟", true)} disabled={busy}>{busy ? "…يقيس" : "استطلع"}</button>
      </div>

      {loading && <SkelCards count={3} />}
      {!poll && list?.polls?.length > 0 && (
        <>
          <h3>استطلاعات جاهزة</h3>
          <div className="grid">
            {list.polls.map((p: any) => (
              <div key={p.id} className="cbox" style={{ cursor: "pointer" }} onClick={() => run(p.question)}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{p.question}</div>
                {p.options ? (
                  <Bars data={Object.entries(p.result).map(([k, v]: any) => ({ label: k, value: v, color: "#4f9dff" }))} height={90} />
                ) : (
                  <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden" }}>
                    <span style={{ width: `${p.result.support}%`, background: "#22c55e" }} /><span style={{ width: `${p.result.neutral}%`, background: "#8a97ad" }} /><span style={{ width: `${p.result.oppose}%`, background: "#f43f5e" }} />
                  </div>
                )}
                {!p.options && <div style={{ fontSize: 12, marginTop: 6 }}><span style={{ color: "#22c55e" }}>مؤيّد {p.result.support}%</span> · <span style={{ color: "#f43f5e" }}>معارض {p.result.oppose}%</span></div>}
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{fmt(p.sample)} مشارك (تقديري) · اضغط للتفاصيل ←</div>
              </div>
            ))}
          </div>
        </>
      )}

      {busy && <SkelCards count={2} />}
      {poll && !poll.empty && (
        <>
          <button className="btn ghost" style={{ fontSize: 12, marginBottom: 10 }} onClick={() => setPoll(null)}>← رجوع</button>
          <div className="cbox" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0 }}>{poll.question}</h3>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <Donut size={130} segments={[{ value: r.support, color: "#22c55e" }, { value: r.neutral, color: "#8a97ad" }, { value: r.oppose, color: "#f43f5e" }]} label={`${r.oppose}%`} />
              <div style={{ flex: 1, minWidth: 180, fontSize: 14 }}>
                <div style={{ color: "#22c55e" }}>● مؤيّد: <b>{r.support}%</b></div>
                <div className="muted">● محايد: <b>{r.neutral}%</b></div>
                <div style={{ color: "#f43f5e" }}>● معارض: <b>{r.oppose}%</b></div>
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{fmt(poll.sample)} مشارك (تقديري) · ثقة {poll.confidence}%</div>
              </div>
            </div>
            {poll.reading && <p style={{ fontSize: 13, marginTop: 8 }}>{poll.reading}</p>}
          </div>
          {poll.by_platform?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}><h4>حسب المنصّة (نسبة المعارضة)</h4>
              <Bars data={poll.by_platform.map((x: any) => ({ label: x.platform, value: x.oppose, color: "#f43f5e" }))} height={110} />
            </div>
          )}
          {poll.trend?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}><h4>تطوّر المعارضة</h4>
              <Bars data={poll.trend.map((x: any) => ({ label: x.label.replace("أسبوع ", "أ"), value: x.oppose, color: "#fb923c" }))} height={110} />
            </div>
          )}
          <p className="muted" style={{ fontSize: 11 }}>{poll.method} · {poll.disclaimer}</p>
        </>
      )}
      {poll?.empty && <div className="cbox">{poll.note}</div>}
    </div>
  );
}
