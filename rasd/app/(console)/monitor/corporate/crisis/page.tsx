"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { useDemo } from "@/components/ui/DemoContext";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const sevC = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : /متوسط/.test(l || "") ? "#f59e0b" : "#22c55e");
const icon: Record<string, string> = { complaint_spike: "📈", fake_page: "🎭", viral_negative: "🔥", rating_drop: "⭐", sentiment_drop: "😠" };

export default function CrisisRadar() {
  const [brand, setBrand] = useState("");
  const { demo } = useDemo();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const run = async (real = false) => {
    setLoading(true); setD(null);
    const r = await apiGet(`/api/corporate/crisis?brand=${encodeURIComponent(brand)}${real ? "" : "&demo=1"}`).catch(() => null);
    setD(r); setLoading(false);
  };
  useEffect(() => { run(!demo); /* eslint-disable-next-line */ }, [demo]);
  const crises = d?.crises || [];

  return (
    <div>
      <h2 style={{ margin: 0 }}>رادار أزمات البراند</h2>
      <p className="muted">إنذار مبكر: قفزات الشكاوى · منشورات سلبية فايرل · هبوط تقييم Google · صفحات مزيفة — قبل ما تنفجر الأزمة.</p>
      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8 }}>
        <input placeholder="اسم الشركة" value={brand} onChange={(e) => setBrand(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(true)} style={{ flex: 1 }} />
        <button className="btn" onClick={() => run(true)} disabled={loading}>افحص</button>
      </div>

      {loading && <SkelCards count={3} />}
      {d && !crises.length && <div className="cbox">{d.note || "لا أزمات نشطة حالياً — الوضع مستقر."}</div>}
      {crises.length > 0 && (
        <>
          <div className="cbox" style={{ marginBottom: 12, borderInlineStart: `4px solid ${sevC(d.highest)}` }}>
            🚨 <b>{d.count}</b> أزمات نشطة · الأعلى حدّة: <b style={{ color: sevC(d.highest) }}>{d.highest}</b>
            {d.demo && <span className="muted" style={{ fontSize: 11 }}> · 🧪 عيّنة توضيحية</span>}
          </div>
          {crises.map((c: any, i: number) => (
            <div key={i} className="cbox" style={{ marginBottom: 10, borderInlineStart: `4px solid ${sevC(c.severity)}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <b style={{ fontSize: 14 }}>{icon[c.type] || "⚠️"} {c.title}</b>
                <span style={{ display: "flex", gap: 6 }}><span className="chip" style={{ fontSize: 10.5, color: sevC(c.severity) }}>{c.severity}</span><span className="muted" style={{ fontSize: 11 }}>{c.time}</span></span>
              </div>
              <div style={{ fontSize: 13, marginTop: 5 }}>{c.detail}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>📎 {fmt(c.evidence_count)} دليل</div>
              <div style={{ fontSize: 12.5, marginTop: 6, padding: "6px 10px", borderRadius: 8, background: "color-mix(in srgb,#22c55e 8%,transparent)" }}>▸ <b>الإجراء:</b> {c.recommended_action}</div>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
