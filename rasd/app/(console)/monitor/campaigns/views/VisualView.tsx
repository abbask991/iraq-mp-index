"use client";
import { useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import { useDemo } from "@/components/ui/DemoContext";

const lvlColor = (l: string) => (/حرج/.test(l || "") ? "#dc2626" : /مرتفع/.test(l || "") ? "#f43f5e" : /متوسط/.test(l || "") ? "#f59e0b" : "#22c55e");
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

export default function VisualView() {
  const [url, setUrl] = useState("");
  const [claim, setClaim] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { demo, setDemo } = useDemo();

  const runUrl = async () => {
    if (!url.trim()) return;
    setLoading(true); setD(null);
    const r = await apiSend("/api/visual-verification/from-url", "POST", { image_url: url.trim(), claim: claim.trim() || null }).catch(() => null);
    setD(r); setLoading(false);
  };
  const runDemo = async () => {
    setDemo(true); setLoading(true); setD(null);
    const r = await apiGet(`/api/visual-verification?demo=1${claim ? `&claim=${encodeURIComponent(claim)}` : ""}`).catch(() => null);
    setD(r); setLoading(false);
  };

  const sc = d?.scores || {};
  const ctx = d?.context_analysis || {};
  return (
    <div>
      <h2 style={{ margin: 0 }}>كشف الصور والتزييف</h2>
      <p className="muted">ارفع صورة أو الصق رابطها للحصول على تقرير تحقّق مبني على الأدلّة: قديمة؟ خارج السياق؟ متلاعَب بها؟ مولّدة بالذكاء الاصطناعي؟ — مع نسبة ثقة ومراجعة بشرية.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder="رابط الصورة (jpg/png/webp) أو رابط منشور يحتوي صورة" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runUrl()} style={{ flex: "2 1 280px" }} />
          <input placeholder="الادعاء المرافق للصورة (اختياري — يحسّن تحليل السياق)" value={claim} onChange={(e) => setClaim(e.target.value)} style={{ flex: "1 1 200px" }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={runUrl} disabled={loading}>{loading ? "…يحلّل" : "حلّل الصورة"}</button>
          <button className="btn ghost" onClick={runDemo} disabled={loading}>🧪 عرض نموذج</button>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>البحث العكسي يحتاج مزوّداً (TinEye/SerpAPI/Bing) — بدونه يكون التقييم محدوداً. وضع العرض يوضّح المخرجات الكاملة.</p>
      </div>

      {loading && <SkelCards count={3} />}
      {d?.error && <div className="cbox" style={{ borderInlineStart: "4px solid #f43f5e" }}>تعذّر: {d.message || d.error}</div>}

      {d && !d.error && (
        <>
          {/* summary */}
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: `4px solid ${lvlColor(d.risk_level)}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{d.status_label}</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 900, color: lvlColor(d.risk_level) }}>{d.overall_risk_score}</div><div className="muted" style={{ fontSize: 10.5 }}>خطر · {d.risk_level}</div></span>
                <span style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 900 }}>{d.confidence_score}%</div><div className="muted" style={{ fontSize: 10.5 }}>ثقة</div></span>
              </div>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.9, marginTop: 6 }}>{d.summary}</p>
            <div style={{ padding: "8px 12px", borderRadius: 10, background: "color-mix(in srgb,#22c55e 10%,transparent)", fontSize: 13 }}>▸ <b>الإجراء الموصى به:</b> {d.recommended_action}</div>
          </div>

          {/* scores grid */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[["الأصالة", sc.originality], ["خطر السياق", sc.context_risk], ["التلاعب", sc.manipulation], ["ذكاء اصطناعي", sc.ai_generation], ["البحث العكسي", sc.reverse_search_risk]].map(([l, v]: any) => (
              <div key={l} style={{ flex: "1 1 110px", textAlign: "center", padding: "10px 6px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--input)" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{v == null ? "—" : v}</div>
                <div className="muted" style={{ fontSize: 11 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* first seen + context */}
          <div className="grid" style={{ marginBottom: 14 }}>
            <div className="cbox"><h4>📅 أول ظهور معروف</h4>
              <div style={{ fontSize: 14 }}>{d.first_seen_date === "unknown" || !d.first_seen_date ? "غير معروف" : d.first_seen_date}</div>
              <div className="muted" style={{ fontSize: 12 }}>{d.first_seen_source === "unknown" || !d.first_seen_source ? "لا مصدر مؤكّد" : d.first_seen_source}</div>
            </div>
            <div className="cbox"><h4>🧭 تحليل السياق</h4>
              {ctx.claim && <div style={{ fontSize: 12.5 }}>الادعاء: «{ctx.claim}»</div>}
              <div style={{ fontSize: 13, marginTop: 4 }}>{ctx.explanation || (ctx.status === "unknown" ? "غير محدّد — أضِف الادعاء/التاريخ لتحليل أدق." : ctx.status)}</div>
            </div>
          </div>

          {/* similar / reverse matches */}
          {d.reverse_search_results?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>🔁 مطابقات البحث العكسي</h4>
              {d.reverse_search_results.map((m: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <span>{m.title || m.source} {m.first_seen_date && <span className="muted">· {m.first_seen_date}</span>}</span>
                  <span className="muted">{m.similarity_score != null ? m.similarity_score + "%" : ""} {m.matched_page_url && <a href={m.matched_page_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>↗</a>}</span>
                </div>
              ))}
            </div>
          )}

          {/* timeline (demo) */}
          {d.timeline?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>🕐 انتشار الصورة</h4>
              {d.timeline.map((h: any, i: number) => (
                <div key={i} style={{ fontSize: 12.5, padding: "4px 0", borderTop: i ? "1px dashed var(--line)" : 0 }}><b>{h.platform}</b> · {h.date} — {h.detail}</div>
              ))}
            </div>
          )}

          {/* forensics / metadata / ai */}
          <div className="grid" style={{ marginBottom: 14 }}>
            <div className="cbox"><h4>🔬 البيانات الوصفية</h4>
              <div style={{ fontSize: 12.5 }}>{d.metadata_analysis?.format} · {d.metadata_analysis?.width}×{d.metadata_analysis?.height}{d.metadata_analysis?.camera ? ` · ${d.metadata_analysis.camera}` : ""}</div>
              {(d.metadata_analysis?.signals || []).map((s: string, i: number) => <div key={i} className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>• {s}</div>)}
            </div>
            <div className="cbox"><h4>🤖 الذكاء الاصطناعي</h4>
              <div style={{ fontSize: 13 }}>{d.ai_generation_analysis?.ai_generated_probability != null ? `احتمال ${d.ai_generation_analysis.ai_generated_probability}%` : "—"}</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>{d.ai_generation_analysis?.note}</div>
            </div>
          </div>

          {/* evidence */}
          {d.evidence?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>📎 الأدلّة</h4>
              {d.evidence.map((e: any, i: number) => (
                <div key={i} style={{ fontSize: 12.5, padding: "5px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <span className="chip" style={{ fontSize: 10 }}>{e.evidence_type}</span> {e.description} {e.confidence && <span className="muted">· ثقة {e.confidence}</span>}
                  {e.source_url && <a href={e.source_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}> ↗</a>}
                </div>
              ))}
            </div>
          )}

          {/* limitations */}
          {d.limitations?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4 className="muted">⚠️ حدود التقييم</h4>
              {d.limitations.map((l: string, i: number) => <div key={i} className="muted" style={{ fontSize: 11.5, padding: "2px 0" }}>• {l}</div>)}
            </div>
          )}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
