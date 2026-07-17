"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { useDemo } from "@/components/ui/DemoContext";

const risk = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : "#f59e0b");

export default function FraudPages() {
  const [brand, setBrand] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { demo, setDemo } = useDemo();
  const run = async (dm = demo) => {
    setLoading(true); setD(null);
    const r = await apiGet(`/api/corporate/fraud?brand=${encodeURIComponent(brand)}${dm ? "&demo=1" : ""}`).catch(() => null);
    setD(r); setLoading(false);
  };
  useEffect(() => { run(demo); /* eslint-disable-next-line */ }, [demo]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>مراقبة الاحتيال والصفحات المزيفة</h2>
        <button className={`btn ${demo ? "" : "ghost"}`} onClick={() => setDemo(!demo)} style={demo ? { background: "#6366f1" } : {}}>🧪 وضع العرض</button>
      </div>
      <p className="muted">كشف الصفحات التي تنتحل علامتك التجارية: تشابه الاسم/الشعار، إشارات الاحتيال، ودرجة الخطر.</p>
      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8 }}>
        <input placeholder="اسم علامتك التجارية" value={brand} onChange={(e) => setBrand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(false)} style={{ flex: 1 }} />
        <button className="btn" onClick={() => run(false)} disabled={loading}>{loading ? "…" : "افحص"}</button>
      </div>
      {loading && <SkelCards count={3} />}
      {d?.empty && <div className="cbox">{d.note}</div>}
      {d && !d.empty && (
        <>
          <div className="cbox" style={{ marginBottom: 12 }}>🚨 <b>{d.suspects_found}</b> صفحات مشبوهة تنتحل «{d.brand}».</div>
          {(d.suspects || []).map((s: any, i: number) => (
            <div key={i} className="cbox" style={{ marginBottom: 10, borderInlineStart: `4px solid ${risk(s.risk)}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <b style={{ fontSize: 14 }}>{s.page}</b>
                <span style={{ display: "flex", gap: 6 }}><span className="chip" style={{ fontSize: 10.5 }}>تشابه {s.similarity}%</span><span className="chip" style={{ fontSize: 10.5, color: risk(s.risk) }}>خطر {s.risk}</span></span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>{(s.signals || []).map((g: string, j: number) => <span key={j} className="chip" style={{ fontSize: 11, color: "#f43f5e" }}>⚠️ {g}</span>)}</div>
            </div>
          ))}
          {d.recommended_action && <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #22c55e" }}>▸ <b>التوصية:</b> {d.recommended_action}</div>}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
