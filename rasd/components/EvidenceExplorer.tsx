"use client";
import { useState } from "react";
import { apiGet } from "@/lib/api";

const fmt = (n: number) => (n || 0).toLocaleString("en-US");
const PLAT: Record<string, string> = { facebook: "📘 فيسبوك", x: "✖️ إكس", telegram: "✈️ تيليجرام", news: "📰 الأخبار", tiktok: "🎵 تيك توك", instagram: "📷 إنستغرام" };
const sentColor = (s: string) => (/إيجاب/.test(s) ? "#22c55e" : /سلب/.test(s) ? "#f43f5e" : "#8a97ad");

/** Reusable "why did the system say this?" drill-down. Drop next to any score/insight. */
export default function EvidenceExplorer({ subject, type = "insight", score, demo = false, label = "🔍 لماذا؟" }:
  { subject: string; type?: string; score?: number; demo?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const show = async () => {
    setOpen(true);
    if (!d) {
      setLoading(true);
      const q = `/api/evidence-explorer?subject=${encodeURIComponent(subject)}&type=${type}${score != null ? `&score=${score}` : ""}${demo ? "&demo=1" : ""}`;
      const r = await apiGet(q).catch(() => null);
      setD(r); setLoading(false);
    }
  };

  return (
    <>
      <button className="btn ghost" style={{ fontSize: 11, padding: "2px 8px" }} onClick={show}>{label}</button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "5vh 12px", overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>🔬 لماذا قال النظام ذلك؟</h3>
              <button className="btn ghost" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>{type} · {subject}{score != null ? ` · النتيجة ${score}` : ""}</div>

            {loading && <p className="muted">…يجمع الأدلّة</p>}
            {!loading && d && !d.available && <p className="muted">{d.note || "لا أدلّة متاحة."}</p>}
            {!loading && d && d.available && (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <span className="chip">ثقة <b>{d.confidence}%</b></span>
                  {d.similarity_score != null && <span className="chip">تشابه <b>{d.similarity_score}%</b></span>}
                  {d.negative_comment_ratio != null && <span className="chip" style={{ color: "#f43f5e" }}>سلبية التعليقات {d.negative_comment_ratio}%</span>}
                  {d.first_seen && <span className="chip">أول ظهور: {String(d.first_seen).slice(0, 16).replace("T", " ")}</span>}
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.8 }}>{d.summary}</p>

                {d.timeline?.length > 0 && (
                  <div className="cbox" style={{ marginBottom: 10 }}>
                    <h4 style={{ marginTop: 0 }}>🧵 الانتقال عبر المنصّات</h4>
                    {d.timeline.map((h: any, i: number) => (
                      <div key={i} style={{ fontSize: 12.5, padding: "4px 0", borderTop: i ? "1px dashed var(--line)" : 0 }}>
                        <b>{PLAT[h.platform] || h.platform}</b> · {h.time} {h.lag_minutes ? <span className="muted">(+{h.lag_minutes}د)</span> : <span className="muted">(الأصل)</span>} {h.similarity != null && <span className="chip" style={{ fontSize: 10 }}>تشابه {h.similarity}%</span>}
                        <div className="muted" style={{ fontSize: 11 }}>{h.detail}</div>
                      </div>
                    ))}
                  </div>
                )}

                {d.repeated_phrases?.length > 0 && (
                  <div className="cbox" style={{ marginBottom: 10 }}>
                    <h4 style={{ marginTop: 0 }}>🔁 صياغات متكرّرة (تنسيق محتمل)</h4>
                    {d.repeated_phrases.map((r: any, i: number) => <div key={i} style={{ fontSize: 12.5, padding: "2px 0" }}><span className="chip" style={{ fontSize: 10 }}>×{r.count}</span> {r.phrase}</div>)}
                  </div>
                )}

                {d.evidence_posts?.length > 0 && (
                  <div className="cbox" style={{ marginBottom: 10 }}>
                    <h4 style={{ marginTop: 0 }}>📄 منشورات الدليل ({d.evidence_posts.length})</h4>
                    {d.evidence_posts.map((p: any, i: number) => (
                      <div key={i} style={{ fontSize: 12.5, padding: "6px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                        <div>{p.text}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{p.page} · 👍 {fmt(p.reactions)} {p.url && <a href={p.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>↗</a>}</div>
                      </div>
                    ))}
                  </div>
                )}

                {d.evidence_comments?.length > 0 && (
                  <div className="cbox" style={{ marginBottom: 10 }}>
                    <h4 style={{ marginTop: 0 }}>💬 تعليقات الدليل ({d.evidence_comments.length})</h4>
                    {d.evidence_comments.slice(0, 12).map((c: any, i: number) => (
                      <div key={i} style={{ fontSize: 12.5, padding: "3px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                        <span style={{ color: sentColor(c.sentiment), fontWeight: 700 }}>● </span>{c.text}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11.5 }}>
                  {d.sources?.length > 0 && <span className="chip">مصادر: {d.sources.join("، ")}</span>}
                  {d.related_entities?.length > 0 && <span className="chip">كيانات: {d.related_entities.join("، ")}</span>}
                  {d.hashtags?.length > 0 && <span className="chip">{d.hashtags.join(" ")}</span>}
                </div>
                <p className="muted" style={{ fontSize: 10.5, marginTop: 8 }}>{d.disclaimer}</p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
