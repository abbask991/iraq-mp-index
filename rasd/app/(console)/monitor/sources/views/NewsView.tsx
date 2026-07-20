"use client";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { getTargets, primaryKeyword } from "@/lib/targets";
import RangeSelect, { Range } from "@/components/RangeSelect";
import { Badge } from "@/components/ui";

/**
 * News / Google / RSS tab — formal media coverage for a topic. News sources are
 * strongest for media validation and framing, so this focuses on articles,
 * source spread, sentiment framing and a pickup timeline. Backed by the real
 * /monitor/news pipeline (Google News RSS + GDELT + direct RSS + gov feeds).
 */
const sColor = (s: string) => (s === "سلبي" ? "#f43f5e" : s === "إيجابي" ? "#22c55e" : "#8a97ad");
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

export default function NewsView() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [term, setTerm] = useState("");
  const [range, setRange] = useState<Range>("week");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async (q: string) => {
    if (!q.trim()) return;
    setTerm(q); setLoading(true); setD(null);
    const r = await apiPost("news", { keywords: [q], range }).catch(() => null);
    setD(r); setLoading(false);
  };
  useEffect(() => {
    const qp = new URLSearchParams(window.location.search).get("q");
    getTargets().then((ts) => { setMonitors(ts.map((t) => ({ name: t.name, keywords: t.keywords }))); run(qp || primaryKeyword(ts)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hits = d?.hits || [];
  const senti = hits.reduce((a: any, h: any) => { const s = h.sentiment || "محايد"; a[s] = (a[s] || 0) + 1; return a; }, {});

  return (
    <div>
      <h2 style={{ margin: 0 }}>الأخبار · Google · RSS</h2>
      <p className="muted" style={{ marginTop: 4 }}>التغطية الإعلامية الرسمية — المقالات، المصادر، التأطير، والنبرة. الأقوى للتحقّق الإعلامي وإضفاء الشرعية على القضية.</p>

      <div className="card" style={{ margin: "12px 0" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="موضوع / كيان (مثال: وزارة الكهرباء)" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(term)} />
          <button className="btn" onClick={() => run(term)} disabled={loading}>{loading ? "جارٍ الجلب…" : "ابحث في الأخبار"}</button>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <RangeSelect value={range} onChange={setRange} disabled={loading} />
          {monitors.map((m) => <button key={m.name} className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => run((m.keywords || [m.name])[0])}>{m.name}</button>)}
        </div>
      </div>

      {loading && <div><span className="spinner" /> يجمع من Google News + RSS + مصادر رسمية…</div>}

      {d && !loading && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "4px 0 14px" }}>
            <span className="muted" style={{ fontSize: 13 }}>{fmt(d.count)} مقال · {fmt(d.sources)} مصدر</span>
            {Object.entries(senti).map(([s, n]: any) => <span key={s} className="chip" style={{ fontSize: 11, color: sColor(s) }}>● {s} {fmt(n)}</span>)}
            {(d.source_types || []).map((t: string) => <span key={t} className="chip" style={{ fontSize: 11 }}>{t}</span>)}
          </div>

          {!hits.length && <p className="muted">لا مقالات في هذه الفترة.</p>}

          <div style={{ display: "grid", gap: 8 }}>
            {hits.slice(0, 60).map((h: any, i: number) => (
              <div key={i} className="cbox" style={{ borderInlineStart: `3px solid ${sColor(h.sentiment)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <a href={h.link} target="_blank" rel="noopener" style={{ color: "var(--text)", fontWeight: 600, fontSize: 14, flex: 1, minWidth: 220 }}>{h.title}</a>
                  <span className="muted u-num" style={{ fontSize: 11 }}>{h.date ? new Date(h.date).toLocaleDateString("ar-IQ", { dateStyle: "medium" }) : ""}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 5 }}>
                  <Badge t="neutral">{h.src_type || "خبر"}</Badge>
                  {h.sentiment && <span className="chip" style={{ fontSize: 10.5, color: sColor(h.sentiment) }}>{h.sentiment}</span>}
                  {h.type && h.type !== "عام" && <span className="chip" style={{ fontSize: 10.5 }}>{h.type}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
