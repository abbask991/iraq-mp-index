"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { Bars } from "@/components/MiniCharts";

const sev = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : "#f59e0b");

export default function Complaints() {
  const [brand, setBrand] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(true);
  const run = async (dm = demo) => {
    setLoading(true); setD(null);
    const r = await apiGet(`/api/corporate/complaints?brand=${encodeURIComponent(brand)}${dm ? "&demo=1" : ""}`).catch(() => null);
    setD(r); setLoading(false);
  };
  useEffect(() => { run(true); /* eslint-disable-next-line */ }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>شكاوى العملاء</h2>
        <button className={`btn ${demo ? "" : "ghost"}`} onClick={() => setDemo(!demo)} style={demo ? { background: "#6366f1" } : {}}>🧪 وضع العرض</button>
      </div>
      <p className="muted">استخراج شكاوى العملاء من التعليقات: أبرز المشاكل مرتّبة بالحدّة، المطالب، والعبارات المتكرّرة.</p>
      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8 }}>
        <input placeholder="اسم/صفحة الشركة" value={brand} onChange={(e) => setBrand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(false)} style={{ flex: 1 }} />
        <button className="btn" onClick={() => run(false)} disabled={loading}>{loading ? "…" : "حلّل"}</button>
      </div>
      {loading && <SkelCards count={3} />}
      {d?.empty && <div className="cbox">{d.note}</div>}
      {d && !d.empty && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[["شكاوى محلّلة", d.complaints_analyzed], ["ضغط الجمهور", d.pressure_score], ["نسبة الشكاوى", d.complaint_ratio != null ? d.complaint_ratio + "%" : "—"]].map(([l, v]: any) => (
              <div key={l} style={{ flex: "1 1 130px", textAlign: "center", padding: "12px 8px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--input)" }}>
                <div style={{ fontSize: 24, fontWeight: 900 }}>{v ?? "—"}</div><div className="muted" style={{ fontSize: 11.5 }}>{l}</div>
              </div>
            ))}
          </div>
          {d.top_complaints?.length > 0 && d.top_complaints.some((c: any) => c.count != null) && (
            <div className="cbox" style={{ marginBottom: 14 }}><h4>الشكاوى حسب التكرار</h4>
              <Bars data={d.top_complaints.filter((c: any) => c.count != null).map((c: any) => ({ label: c.theme.slice(0, 8), value: c.count, color: sev(c.severity) }))} height={130} />
            </div>
          )}
          {d.top_complaints?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}><h4>أبرز الشكاوى</h4>
              {d.top_complaints.map((c: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <span style={{ fontSize: 13 }}>{c.theme}</span>
                  <span style={{ display: "flex", gap: 6 }}>{c.count != null && <span className="muted" style={{ fontSize: 12 }}>{c.count}</span>}{c.severity !== "—" && <span className="chip" style={{ fontSize: 10.5, color: sev(c.severity) }}>{c.severity}</span>}</span>
                </div>
              ))}
            </div>
          )}
          <div className="grid" style={{ marginBottom: 14 }}>
            {d.top_demands?.length > 0 && <div className="cbox"><h4 style={{ color: "#22c55e" }}>المطالب</h4>{d.top_demands.map((x: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "3px 0" }}>• {x}</div>)}</div>}
            {d.repeated_phrases?.length > 0 && <div className="cbox"><h4>عبارات متكرّرة</h4>{d.repeated_phrases.map((r: any, i: number) => <div key={i} style={{ fontSize: 12.5, padding: "3px 0" }}><span className="chip" style={{ fontSize: 10 }}>×{r.count}</span> {r.phrase}</div>)}</div>}
          </div>
          {d.recommended_action && <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #22c55e" }}>▸ <b>التوصية:</b> {d.recommended_action}</div>}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
