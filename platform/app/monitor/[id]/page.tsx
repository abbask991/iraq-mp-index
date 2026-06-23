"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const sColor = (s: string) => s === "سلبي" ? "#f43f5e" : s === "إيجابي" ? "#22c55e" : "#8a97ad";

export default function MonitorDash({ params }: { params: { id: string } }) {
  const [mon, setMon] = useState<any>(null);
  const [hits, setHits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("monitors").select("*").eq("id", params.id).maybeSingle();
      setMon(data);
      if (data) {
        const res = await fetch("/api/monitor-fetch", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: data.keywords }),
        });
        const j = await res.json();
        setHits(j.hits || []);
      }
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) return <p className="muted">جارٍ الرصد… (يجلب أحدث الأخبار العراقية ويصنّفها)</p>;
  if (!mon) return <p className="muted">الرصد غير موجود.</p>;

  const neg = hits.filter((h) => h.sentiment === "سلبي").length;
  const pos = hits.filter((h) => h.sentiment === "إيجابي").length;
  const neu = hits.length - neg - pos;
  const idx = hits.length ? Math.round(50 + (50 * (pos - neg)) / hits.length) : 50;
  const src: Record<string, number> = {};
  hits.forEach((h) => (src[h.source] = (src[h.source] || 0) + 1));
  const topSrc = Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div>
      <Link href="/monitor" className="muted">← كل عمليات الرصد</Link>
      <h2 style={{ marginBottom: 2 }}>📡 {mon.name}</h2>
      <p className="muted">{(mon.keywords || []).join(" · ")} · {hits.length} ذِكر</p>

      <div className="stat-grid">
        <div className="stat"><div className="v" style={{ color: "#f43f5e" }}>{neg}</div><div className="l">سلبي</div></div>
        <div className="stat"><div className="v">{neu}</div><div className="l">محايد</div></div>
        <div className="stat"><div className="v" style={{ color: "#22c55e" }}>{pos}</div><div className="l">إيجابي</div></div>
        <div className="stat"><div className="v">{idx}/100</div><div className="l">المؤشر الإعلامي</div></div>
      </div>

      {hits.length > 0 && (
        <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", margin: "10px 0", background: "#0c1320" }}>
          <i style={{ width: `${(neg / hits.length) * 100}%`, background: "#f43f5e" }} />
          <i style={{ width: `${(neu / hits.length) * 100}%`, background: "#8a97ad" }} />
          <i style={{ width: `${(pos / hits.length) * 100}%`, background: "#22c55e" }} />
        </div>
      )}

      <div className="section-title">المصادر</div>
      <div className="card">
        {topSrc.length === 0 && <span className="muted">لا مصادر.</span>}
        {topSrc.map(([s, c]) => (
          <div key={s} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
            <span>{s}</span><b>{c}</b>
          </div>
        ))}
      </div>

      <div className="section-title">الأخبار (الأحدث أولاً)</div>
      {hits.length === 0 && <p className="muted">لا أخبار مطابقة حالياً.</p>}
      {hits.map((h, i) => (
        <div key={i} className="card" style={{ marginBottom: 8 }}>
          <a href={h.link} target="_blank" rel="noopener">{h.title}</a>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {h.source} · {h.date} ·{" "}
            <span style={{ color: sColor(h.sentiment) }}>{h.sentiment}</span> · {h.type}
          </div>
        </div>
      ))}
    </div>
  );
}
