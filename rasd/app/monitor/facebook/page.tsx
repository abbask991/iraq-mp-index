"use client";
import { useState } from "react";
import { apiGet } from "@/lib/api";
import Gauge from "@/components/Gauge";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

const appColor = (v: number) => (v >= 60 ? "#22c55e" : v >= 40 ? "#f59e0b" : "#f43f5e");
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

export default function Facebook() {
  const [t, setT] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!t.trim() || loading) return;
    setLoading(true); setD(null);
    const r = await apiGet(`/api/facebook/page?target=${encodeURIComponent(t.trim())}&limit=20`).catch(() => null);
    setD(r); setLoading(false);
  };

  const Bar = ({ p }: { p: any }) => (
    <span style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--input)", overflow: "hidden", display: "flex" }}>
      <span style={{ width: `${p.approval ?? 50}%`, background: "#22c55e" }} />
      <span style={{ width: `${p.rejection ?? 50}%`, background: "#f43f5e" }} />
    </span>
  );

  return (
    <div>
      <h2>👍 رصد فيسبوك — التأييد والرفض</h2>
      <p className="muted">فيسبوك مكان الجمهور العراقي الحقيقي. نقيس استقبال أي صفحة من تفصيل التفاعلات: 👍❤️🤗 تأييد · 😠😢 رفض. (فيسبوك ما عنده زر «دِس لايك» — نقيسه من الغضب والحزن والتعليقات.)</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="اسم الصفحة أو رابطها (مثال: aljazeera أو facebook.com/...)" value={t}
            onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
          <button className="btn" onClick={run} disabled={loading}>{loading ? "…يجلب" : "حلّل الصفحة"}</button>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>ملاحظة: فيسبوك يُجلب عبر Apify (فاتورة منفصلة عن X) — وأبطأ شوي (~دقيقة).</p>
      </div>

      {loading && <SkelCards count={3} />}
      {d?.error && <EmptyState tone="error" title="تعذّر التحليل" subtitle={d.message} action={{ label: "إعادة", onClick: run }} />}

      {d && !d.error && (
        <>
          {/* headline approval/rejection */}
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: `4px solid ${appColor(d.approval || 0)}` }}>
            <h4 style={{ margin: "0 0 4px" }}>{d.page_name}</h4>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <Gauge value={d.approval || 0} size={120} color={appColor(d.approval || 0)} />
                <div style={{ fontWeight: 800, marginTop: 4 }}>نسبة التأييد</div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 26, fontWeight: 900 }}>
                  <span style={{ color: "#22c55e" }}>{d.approval}% تأييد</span> · <span style={{ color: "#f43f5e" }}>{d.rejection}% رفض</span>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12.5, marginTop: 8 }}>
                  <span className="chip" style={{ color: "#22c55e" }}>👍 {fmt(d.total_positive)} إيجابي</span>
                  <span className="chip" style={{ color: "#f43f5e" }}>😠😢 {fmt(d.total_negative)} سلبي</span>
                  <span className="chip">💬 {fmt(d.total_comments)} تعليق</span>
                  <span className="chip">🔁 {fmt(d.total_shares)} مشاركة</span>
                  <span className="chip muted">{d.posts_analyzed} منشور</span>
                </div>
                {d.comment_sentiment && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                    📊 المدمَج {d.approval}% (تفاعلات {d.reaction_approval}% · تعليقات {d.comment_sentiment.approval}%) —
                    التعليقات تكشف الرأي الفعلي أعمق من اللايكات.
                  </div>
                )}
                {d.summary && <p style={{ fontSize: 14, lineHeight: 1.9, marginTop: 10 }}>{d.summary}</p>}
              </div>
            </div>
          </div>

          {/* comment sentiment */}
          {d.comment_sentiment && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>💬 مشاعر التعليقات (الرأي الفعلي · {d.comment_sentiment.analyzed} تعليق)</h4>
              <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
                <span style={{ width: `${(d.comment_sentiment.pos / d.comment_sentiment.analyzed) * 100}%`, background: "#22c55e" }} />
                <span style={{ width: `${(d.comment_sentiment.neu / d.comment_sentiment.analyzed) * 100}%`, background: "#8a97ad" }} />
                <span style={{ width: `${(d.comment_sentiment.neg / d.comment_sentiment.analyzed) * 100}%`, background: "#f43f5e" }} />
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 12.5, flexWrap: "wrap" }}>
                <span style={{ color: "#22c55e" }}>إيجابي {d.comment_sentiment.pos}</span>
                <span className="muted">محايد {d.comment_sentiment.neu}</span>
                <span style={{ color: "#f43f5e" }}>سلبي {d.comment_sentiment.neg}</span>
              </div>
              {d.sample_comments?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {d.sample_comments.map((c: any, i: number) => (
                    <div key={i} style={{ fontSize: 12.5, padding: "4px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                      <span style={{ color: c.sentiment === "إيجابي" ? "#22c55e" : c.sentiment === "سلبي" ? "#f43f5e" : "#8a97ad", fontWeight: 700 }}>● </span>
                      {c.text}
                    </div>
                  ))}
                </div>
              )}
              <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>ملاحظة: السخرية بالعربي/الإنجليزي قد تُقرأ حرفياً أحياناً — مراجعة بشرية مستحسنة.</p>
            </div>
          )}

          {/* most rejected / approved */}
          <div className="grid" style={{ marginBottom: 14 }}>
            {d.most_rejected && (
              <div className="cbox" style={{ borderInlineStart: "4px solid #f43f5e" }}>
                <h4 style={{ color: "#f43f5e" }}>🔴 الأكثر رفضاً ({d.most_rejected.rejection}%)</h4>
                <p style={{ fontSize: 13, lineHeight: 1.9 }}>«{d.most_rejected.text}»</p>
                <div className="muted" style={{ fontSize: 12 }}>😠😢 {fmt(d.most_rejected.neg)} · 💬 {fmt(d.most_rejected.comments)}</div>
              </div>
            )}
            {d.most_approved && (
              <div className="cbox" style={{ borderInlineStart: "4px solid #22c55e" }}>
                <h4 style={{ color: "#22c55e" }}>🟢 الأكثر تأييداً ({d.most_approved.approval}%)</h4>
                <p style={{ fontSize: 13, lineHeight: 1.9 }}>«{d.most_approved.text}»</p>
                <div className="muted" style={{ fontSize: 12 }}>👍 {fmt(d.most_approved.pos)} · 💬 {fmt(d.most_approved.comments)}</div>
              </div>
            )}
          </div>

          {/* per-post breakdown */}
          {d.posts?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>📋 المنشورات (تأييد/رفض لكل منشور)</h4>
              {d.posts.map((p: any, i: number) => (
                <div key={i} style={{ padding: "9px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <div style={{ fontSize: 13, marginBottom: 5 }}>{p.text || "—"}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#22c55e", fontSize: 12, minWidth: 38 }}>{p.approval ?? "—"}%</span>
                    <Bar p={p} />
                    <span style={{ color: "#f43f5e", fontSize: 12, minWidth: 38, textAlign: "left" }}>{p.rejection ?? "—"}%</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>👍 {fmt(p.pos)} · 😠😢 {fmt(p.neg)} · 💬 {fmt(p.comments)} · 🔁 {fmt(p.shares)}</div>
                </div>
              ))}
            </div>
          )}

          <p className="muted" style={{ fontSize: 11 }}>{d.note} · {d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
