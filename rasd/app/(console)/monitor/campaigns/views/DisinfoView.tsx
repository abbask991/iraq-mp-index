"use client";
import { useState } from "react";
import { apiSend } from "@/lib/api";
import Gauge from "@/components/Gauge";
import { SkelCards } from "@/components/Skeleton";

const riskColor = (v: number) => (v >= 65 ? "#f43f5e" : v >= 40 ? "#fb923c" : "#22c55e");

export default function DisinfoView() {
  const [text, setText] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (text.trim().length < 8 || loading) return;
    setLoading(true); setD(null);
    const r = await apiSend("/api/disinfo/assess", "POST", { text }).catch(() => null);
    setD(r); setLoading(false);
  };
  const ai = d?.ai || {}; const sp = d?.spread || {};

  return (
    <div>
      <h2>🛡️ كشف التضليل والتزييف</h2>
      <p className="muted">الصق ادّعاءً أو منشوراً، والنظام يحلّل: علامات التلاعب، احتمال التوليد بالذكاء الاصطناعي، قابلية التحقّق، ونمط الانتشار (هل تدفعه شبكة منسّقة؟) — بدرجة مخاطر وتفسير.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <textarea placeholder="الصق النص أو الادّعاء هنا…" value={text} onChange={(e) => setText(e.target.value)}
          rows={4} style={{ width: "100%", resize: "vertical", fontFamily: "inherit", fontSize: 14 }} />
        <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn" onClick={run} disabled={loading || text.trim().length < 8}>{loading ? "…يحلّل" : "حلّل المصداقية"}</button>
        </div>
      </div>

      {loading && <SkelCards count={2} />}
      {d?.error && <p className="muted">{d.message}</p>}

      {d && !d.error && (
        <>
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: `4px solid ${riskColor(d.disinfo_risk)}` }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <Gauge value={d.disinfo_risk} size={110} invert color={riskColor(d.disinfo_risk)} />
                <div style={{ fontWeight: 800, marginTop: 4, fontSize: 13 }}>درجة مخاطر التضليل</div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h3 style={{ margin: "0 0 6px", color: riskColor(d.disinfo_risk) }}>{d.band}</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                  <span className="chip">حُكم AI: {ai.verdict}</span>
                  <span className="chip">قابلية التحقّق: {ai.verifiability}</span>
                  <span className="chip" style={{ color: ai.ai_generated_likelihood >= 50 ? "#f43f5e" : undefined }}>توليد آلي: {ai.ai_generated_likelihood}%</span>
                </div>
                {ai.factual_assessment && <p style={{ fontSize: 13.5, lineHeight: 1.9, marginTop: 8 }}>{ai.factual_assessment}</p>}
              </div>
            </div>
          </div>

          <div className="grid" style={{ marginBottom: 14 }}>
            <div className="cbox">
              <h4 style={{ color: "#fb923c" }}>🚩 علامات التلاعب</h4>
              {(ai.manipulation_signals?.length || ai.red_flags?.length) ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[...(ai.manipulation_signals || []), ...(ai.red_flags || [])].map((s: string, i: number) => (
                    <span key={i} className="chip" style={{ color: "#fb923c" }}>{s}</span>
                  ))}
                </div>
              ) : <span className="muted">لا علامات تلاعب بارزة ✅</span>}
            </div>
            <div className="cbox">
              <h4>📡 نمط الانتشار</h4>
              <div style={{ fontSize: 13.5, lineHeight: 2 }}>
                <div>درجة التنسيق: <b style={{ color: sp.coordination_score >= 45 ? "#f43f5e" : "var(--text)" }}>{sp.coordination_score}/100</b></div>
                <div>نسبة الحسابات المشبوهة: <b>{Math.round((sp.suspicious_ratio || 0) * 100)}%</b></div>
                <div>منشورات محلّلة: {sp.posts_analyzed}</div>
                <div className="muted" style={{ fontSize: 12 }}>{sp.note}</div>
              </div>
            </div>
          </div>

          {ai.recommendation && <div className="cbox" style={{ marginBottom: 14 }}><h4>✅ التوصية</h4><p style={{ fontSize: 14, lineHeight: 1.9 }}>{ai.recommendation}</p></div>}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
