"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { Bars } from "@/components/MiniCharts";

const col = (v: number) => (v >= 60 ? "#22c55e" : v >= 40 ? "#f59e0b" : "#f43f5e");

export default function Competitors() {
  const [brand, setBrand] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(true);
  const run = async (dm = demo) => {
    setLoading(true); setD(null);
    const r = await apiGet(`/api/corporate/competitors?brand=${encodeURIComponent(brand)}${dm ? "&demo=1" : ""}`).catch(() => null);
    setD(r); setLoading(false);
  };
  useEffect(() => { run(true); /* eslint-disable-next-line */ }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>مراقبة المنافسين</h2>
        <button className={`btn ${demo ? "" : "ghost"}`} onClick={() => setDemo(!demo)} style={demo ? { background: "#6366f1" } : {}}>🧪 وضع العرض</button>
      </div>
      <p className="muted">مقارنة حصة الصوت والمشاعر والسمعة مقابل المنافسين، مع فرص وتوصيات.</p>
      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8 }}>
        <input placeholder="اسم شركتك" value={brand} onChange={(e) => setBrand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(false)} style={{ flex: 1 }} />
        <button className="btn" onClick={() => run(false)} disabled={loading}>{loading ? "…" : "قارن"}</button>
      </div>
      {loading && <SkelCards count={3} />}
      {d?.empty && <div className="cbox">{d.note}</div>}
      {d && !d.empty && (
        <>
          <div className="cbox" style={{ marginBottom: 14 }}>
            <h4>الترتيب التنافسي</h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ color: "var(--muted)", fontSize: 11.5 }}><th style={{ textAlign: "start", padding: "4px" }}>الشركة</th><th>حصة الصوت</th><th>المشاعر</th><th>السمعة</th></tr></thead>
              <tbody>
                {(d.competitors || []).map((c: any, i: number) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--line)", background: c.self ? "color-mix(in srgb,#6366f1 8%,transparent)" : undefined }}>
                    <td style={{ padding: "6px 4px" }}>{c.name} {c.self && <span className="chip" style={{ fontSize: 9 }}>أنت</span>}</td>
                    <td style={{ textAlign: "center" }}>{c.share_of_voice}%</td>
                    <td style={{ textAlign: "center", color: col(c.sentiment) }}>{c.sentiment}</td>
                    <td style={{ textAlign: "center", color: col(c.reputation) }}>{c.reputation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>الأعلى حضوراً: <b>{d.leader_sov}</b> · الأفضل مشاعر: <b>{d.leader_sentiment}</b></div>
          </div>
          {d.competitors?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}><h4>حصة الصوت</h4>
              <Bars data={d.competitors.map((c: any) => ({ label: c.name.slice(0, 8), value: c.share_of_voice, color: c.self ? "#6366f1" : "#4f9dff" }))} height={130} />
            </div>
          )}
          {d.insights?.length > 0 && <div className="cbox" style={{ marginBottom: 14 }}><h4>قراءات</h4>{d.insights.map((x: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "3px 0" }}>• {x}</div>)}</div>}
          {d.recommended_action && <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #22c55e" }}>▸ <b>التوصية:</b> {d.recommended_action}</div>}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
