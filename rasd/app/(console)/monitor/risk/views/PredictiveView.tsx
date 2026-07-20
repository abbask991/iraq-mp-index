"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import Gauge from "@/components/Gauge";
import { SkelCards } from "@/components/Skeleton";

const lvlColor = (v: number) => (v >= 65 ? "#f43f5e" : v >= 45 ? "#fb923c" : v >= 25 ? "#f59e0b" : "#22c55e");

export default function PredictiveView() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiGet("/api/predictive").then(setD).finally(() => setLoading(false)); }, []);
  const no = d?.national_outlook || {};

  return (
    <div>
      <h2>🔮 محرّك التنبّؤ والإنذار المبكر</h2>
      <p className="muted">يتنبّأ بما هو الأرجح خلال ٢٤–٧٢ ساعة: مَن مرشّح للتصعيد، أي سردية مرشّحة للانتشار، واحتمال حدث أزمة وطني — باحتمالات وتوقيت.</p>

      {loading && <SkelCards count={3} />}
      {d && (
        <>
          <div className="cbox" style={{ marginBottom: 14, textAlign: "center", borderInlineStart: `4px solid ${lvlColor(no.crisis_probability_72h || 0)}` }}>
            <div className="muted" style={{ fontSize: 12 }}>احتمال حدث أزمة وطني خلال ٧٢ ساعة</div>
            <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
              <Gauge value={no.crisis_probability_72h || 0} size={120} invert color={lvlColor(no.crisis_probability_72h || 0)} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: lvlColor(no.crisis_probability_72h || 0) }}>{no.level}</div>
            {d.summary && <p style={{ fontSize: 14, lineHeight: 2, marginTop: 10, textAlign: "start" }}>{d.summary}</p>}
          </div>

          <div className="grid" style={{ marginBottom: 14 }}>
            <div className="cbox">
              <h4 style={{ color: "#f43f5e" }}>⚠️ كيانات مرشّحة للتصعيد</h4>
              {d.entity_forecasts?.length ? d.entity_forecasts.map((e: any, i: number) => (
                <div key={i} style={{ padding: "9px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <b>{e.name}</b>
                    <span className="chip" style={{ background: lvlColor(e.probability), color: "#fff", fontWeight: 800 }}>{e.probability}%</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                    🕐 {e.eta} · ثقة {e.confidence}% · {(e.reasons || []).join(" · ")}
                  </div>
                </div>
              )) : <span className="muted">لا إشارات تصعيد واضحة حالياً ✅</span>}
            </div>

            <div className="cbox">
              <h4 style={{ color: "#fb923c" }}>📈 سرديات مرشّحة للانتشار</h4>
              {d.narrative_forecasts?.length ? d.narrative_forecasts.map((n: any, i: number) => (
                <div key={i} style={{ padding: "9px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13.5 }}>{n.narrative}</span>
                    <span className="chip" style={{ background: lvlColor(n.probability), color: "#fff", fontWeight: 800 }}>{n.probability}%</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>🕐 {n.eta} · نبرة {n.tone} · {n.posts} منشور</div>
                </div>
              )) : <span className="muted">لا سرديات صاعدة بقوة حالياً ✅</span>}
            </div>
          </div>
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
