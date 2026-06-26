"use client";
import { useState } from "react";
import { apiGet } from "@/lib/api";
import Gauge from "@/components/Gauge";

const DEC_C: Record<string, string> = { escalate: "#f43f5e", should_statement: "#fb923c", should_respond: "#f59e0b", contact_customers: "#a78bfa", monitor: "#22c55e" };
const crisisC = (st?: string) => (st === "حرج" || st === "أحمر" ? "#f43f5e" : st === "برتقالي" || st === "مرتفع" ? "#fb923c" : st === "أصفر" || st === "متوسط" ? "#f59e0b" : "#22c55e");

function Stat({ l, v, c }: { l: string; v: any; c?: string }) {
  return <div style={{ textAlign: "center" }}><div style={{ fontWeight: 800, fontSize: 17, color: c }}>{v}</div><div className="muted" style={{ fontSize: 11 }}>{l}</div></div>;
}

export default function Corporate() {
  const [company, setCompany] = useState("");
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const run = async (c?: string) => {
    const q = (c ?? company).trim(); if (!q) return;
    setCompany(q); setBusy(true); setD(null);
    const r = await apiGet(`/api/corporate/intelligence?company=${encodeURIComponent(q)}`).catch(() => null);
    setD(r); setBusy(false);
  };

  const b = d?.brief || {};

  return (
    <div>
      <h2 style={{ margin: 0 }}>مركز الاستخبارات المؤسسية</h2>
      <p className="muted" style={{ marginTop: 4 }}>للبنوك · الاتصالات · الطيران · الشركات الكبرى — السمعة، الأزمات، صوت العملاء، والاحتيال في صورة واحدة.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
        <input placeholder="اسم الشركة (مثال: مصرف الرافدين)" value={company} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} style={{ flex: 1, minWidth: 220 }} />
        <button className="btn" onClick={() => run()} disabled={busy}>{busy ? "جارٍ التحليل…" : "تحليل"}</button>
        {["مصرف الرافدين", "اسياسيل", "زين العراق"].map((x) => <button key={x} className="btn ghost" style={{ fontSize: 12 }} onClick={() => run(x)}>{x}</button>)}
      </div>

      {busy && <div><span className="spinner" /> جمع وتحليل وتركيب…</div>}
      {d?.error && <p className="muted">تعذّر — {d.error}</p>}

      {d && !d.error && (
        <>
          {/* AI decision brief */}
          {b.executive && (
            <div className="cbox" style={{ borderInlineStart: `4px solid ${DEC_C[b.decision] || "#64748b"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <h4 style={{ margin: 0 }}>الموجز التنفيذي + القرار</h4>
                <span className="chip" style={{ color: DEC_C[b.decision] }}>القرار: {b.decision_ar} · ثقة {b.confidence}%</span>
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 2, marginTop: 8 }}>{b.executive}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8, fontSize: 13 }}>
                {b.top_risk && <div><b style={{ color: "#f43f5e" }}>أهم خطر:</b> {b.top_risk}</div>}
                {b.customer_mood && <div><b>مزاج العملاء:</b> {b.customer_mood}</div>}
                {b.why && <div><b>سبب القرار:</b> {b.why}</div>}
              </div>
            </div>
          )}

          {/* headline gauges */}
          <div className="cbox" style={{ marginTop: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, alignItems: "center" }}>
              <div style={{ textAlign: "center" }}><Gauge value={d.reputation?.score} size={84} /><div className="muted" style={{ fontSize: 11 }}>السمعة · {d.reputation?.grade}</div></div>
              <div style={{ textAlign: "center" }}><Gauge value={d.crisis?.score} size={84} invert /><div className="muted" style={{ fontSize: 11 }}>تصعيد الأزمة · {d.crisis?.stage}</div></div>
              <Stat l="سلبي" v={`${d.sentiment?.negative}%`} c="#f43f5e" />
              <Stat l="إيجابي" v={`${d.sentiment?.positive}%`} c="#22c55e" />
              <Stat l="إشارات قابلة للمعالجة" v={d.customer_voice?.actionable} c="#fb923c" />
              <Stat l="بلاغات احتيال" v={d.fraud?.count} c={d.fraud?.count ? "#f43f5e" : undefined} />
            </div>
          </div>

          {/* fraud alert */}
          {d.fraud?.count > 0 && (
            <div className="cbox" style={{ marginTop: 14, borderInlineStart: "4px solid #f43f5e" }}>
              <h4 style={{ marginTop: 0, color: "#f43f5e" }}>🚨 احتيال يستهدف العملاء ({d.fraud.count})</h4>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {Object.entries(d.fraud.by_type || {}).map(([k, v]: any) => <span key={k} className="chip" style={{ color: "#f43f5e" }}>{k}: {v}</span>)}
              </div>
              {(d.fraud.flagged || []).slice(0, 4).map((f: any, i: number) => (
                <div key={i} style={{ fontSize: 12.5, padding: "6px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <b style={{ color: "#f43f5e" }}>{f.signals.join(" · ")}</b> · خطر {f.risk}
                  <div className="muted">{f.text}</div>
                </div>
              ))}
            </div>
          )}

          <div className="cc-grid" style={{ marginTop: 14 }}>
            {/* customer voice */}
            <div className="cbox">
              <h4 style={{ marginTop: 0 }}>صوت العميل</h4>
              {(d.customer_voice?.breakdown || []).map((c: any, i: number) => (
                <div key={i} style={{ margin: "6px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{c.label}</span><span className="muted">{c.count} · {c.pct}%</span></div>
                  <div style={{ height: 6, background: "var(--line)", borderRadius: 3, marginTop: 2 }}><div style={{ width: `${c.pct}%`, height: "100%", background: "var(--accent)", borderRadius: 3 }} /></div>
                </div>
              ))}
              {!d.customer_voice?.breakdown?.length && <span className="muted">لا إشارات مصنّفة.</span>}
            </div>

            {/* emotions */}
            <div className="cbox">
              <h4 style={{ marginTop: 0 }}>انفعالات العملاء</h4>
              {Object.entries(d.emotions || {}).filter(([, v]: any) => v > 0).slice(0, 6).map(([k, v]: any) => (
                <div key={k} style={{ margin: "6px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{k}</span><span className="muted">{v}%</span></div>
                  <div style={{ height: 6, background: "var(--line)", borderRadius: 3, marginTop: 2 }}><div style={{ width: `${v}%`, height: "100%", background: "#a78bfa", borderRadius: 3 }} /></div>
                </div>
              ))}
            </div>
          </div>

          {d.cross_platform?.platforms?.length > 0 && (
            <div className="cbox" style={{ marginTop: 14 }}>
              <h4 style={{ marginTop: 0 }}>الانتشار عبر المنصّات</h4>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {d.cross_platform.platforms.map((p: any) => <span key={p.platform} className="chip">{p.platform}: {Number(p.reach).toLocaleString()}</span>)}
              </div>
            </div>
          )}

          <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
            {d.totals?.posts} منشور · {d.totals?.news} خبر · وصول تقديري {Number(d.totals?.reach || 0).toLocaleString()}. {d.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}
