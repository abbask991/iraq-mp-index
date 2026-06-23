"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import RangeSelect, { Range } from "@/components/RangeSelect";

const sColor = (s: string) => (s === "سلبي" ? "#f43f5e" : s === "إيجابي" ? "#22c55e" : "#8a97ad");

function Row({ item, label }: { item: any; label: "hashtag" | "keyword"; }) {
  const name = item[label];
  const href = `/monitor/trends?q=${encodeURIComponent(name)}`;
  const hot = item.velocity >= 1.5;
  return (
 <Link href={href} className="card" style={{ display: "block", marginBottom: 8, textDecoration: "none" }}>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
 <div>
 <b style={{ color: "var(--text)" }}>{label === "hashtag" ? "#" : " "}{name}</b>
          {hot && <span className="chip" style={{ color: "#fb923c", marginInlineStart: 8 }}> صاعد</span>}
 <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            {item.mentions} ذِكر · {item.accounts} حساب ·  {Number(item.engagement).toLocaleString()}
 <span style={{ color: sColor(item.sentiment), marginInlineStart: 6 }}>● {item.sentiment}</span>
 </div>
 </div>
 <div style={{ display: "flex", gap: 14, textAlign: "center" }}>
 <div><div style={{ fontWeight: 800, color: item.velocity >= 1.5 ? "#fb923c" : "var(--text)" }}>{item.velocity}×</div><div className="muted" style={{ fontSize: 10 }}>تسارع</div></div>
 <div><div style={{ fontWeight: 800, color: "var(--accent)" }}>{item.predicted_24h}</div><div className="muted" style={{ fontSize: 10 }}>متوقّع/24س</div></div>
 </div>
 </div>
 </Link>
  );
}

export default function Discover() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("day");

  const load = useCallback(async (rng: Range) => {
    setLoading(true);
    const r = await apiPost("discover", { range: rng }).catch(() => null);
    setData(r); setLoading(false);
  }, []);

  useEffect(() => { load("day"); }, [load]);

  return (
 <div>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
 <div>
 <h2> ترندات الآن</h2>
 <p className="muted">أبرز الهاشتاغات والمواضيع الصاعدة حالياً — تلقائياً بدون بحث. اضغط أي ترند لتحليله الكامل (الأصل + المضخّمين + الدرجة).</p>
 </div>
 <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
 <RangeSelect value={range} onChange={(v) => { setRange(v); load(v); }} disabled={loading} />
 <button className="btn" onClick={() => load(range)} disabled={loading}>{loading ? "…" : " تحديث"}</button>
 </div>
 </div>

      {loading && <div className="spinner" />}

      {data && !loading && (data.error ? <p className="muted">{data.message || "تعذّر التحميل."}</p> : (
 <>
 <div className="muted" style={{ fontSize: 12, margin: "6px 0 14px" }}>
            فُحص {data.scanned} منشور من {data.accounts} حساب خلال آخر {data.window_hours} ساعة.
 </div>

 <div className="section-title"> الهاشتاغات الصاعدة ({data.hashtags?.length || 0})</div>
          {(!data.hashtags || data.hashtags.length === 0) && <p className="muted">لا هاشتاغات بارزة حالياً.</p>}
          {data.hashtags?.map((h: any) => <Row key={h.hashtag} item={h} label="hashtag" />)}

 <div className="section-title" style={{ marginTop: 18 }}> المواضيع/الكلمات الصاعدة ({data.keywords?.length || 0})</div>
          {data.keywords?.map((k: any) => <Row key={k.keyword} item={k} label="keyword" />)}

 <p className="muted" style={{ fontSize: 11, marginTop: 16 }}>
            * يُكتشف تلقائياً من تدفّق التغريدات العراقية الحديثة. «المتوقّع/24س» إسقاط من معدّل آخر ٦ ساعات. تحليل آلي يحتاج مراجعة بشرية.
 </p>
 </>
      ))}
 </div>
  );
}
