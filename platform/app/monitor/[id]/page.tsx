"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const C = { neg: "#f43f5e", neu: "#8a97ad", pos: "#22c55e" };
const sColor = (s: string) => (s === "سلبي" ? C.neg : s === "إيجابي" ? C.pos : C.neu);

function donut(parts: { v: number; c: string }[], size = 168) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 6, r = R * 0.62;
  const tot = parts.reduce((s, p) => s + p.v, 0) || 1;
  let a0 = -Math.PI / 2, g = "";
  for (const p of parts) {
    if (p.v <= 0) continue;
    const a1 = a0 + (p.v / tot) * 2 * Math.PI, la = a1 - a0 > Math.PI ? 1 : 0;
    const P = (a: number, rad: number) => [(cx + Math.cos(a) * rad).toFixed(1), (cy + Math.sin(a) * rad).toFixed(1)];
    const [x0, y0] = P(a0, R), [x1, y1] = P(a1, R), [xi1, yi1] = P(a1, r), [xi0, yi0] = P(a0, r);
    g += `<path d="M${x0},${y0} A${R},${R} 0 ${la} 1 ${x1},${y1} L${xi1},${yi1} A${r},${r} 0 ${la} 0 ${xi0},${yi0} Z" fill="${p.c}"/>`;
    a0 = a1;
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="100%" style="max-width:${size}px;display:block;margin:0 auto">${g}<text x="${cx}" y="${cy - 2}" fill="#e8eef9" font-size="26" font-weight="800" text-anchor="middle">${tot}</text><text x="${cx}" y="${cy + 16}" fill="#8a97ad" font-size="11" text-anchor="middle">ذِكر</text></svg>`;
}

export default function MonitorDash({ params }: { params: { id: string } }) {
  const [mon, setMon] = useState<any>(null);
  const [hits, setHits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async (m: any) => {
    setLoading(true);
    const res = await fetch("/api/monitor-fetch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: m.keywords }),
    });
    const j = await res.json();
    setHits(j.hits || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("monitors").select("*").eq("id", params.id).maybeSingle();
      setMon(data);
      if (data) run(data); else setLoading(false);
    })();
  }, [params.id, run]);

  if (!mon && !loading) return <p className="muted">الرصد غير موجود.</p>;

  const neg = hits.filter((h) => h.sentiment === "سلبي").length;
  const pos = hits.filter((h) => h.sentiment === "إيجابي").length;
  const neu = hits.length - neg - pos;
  const idx = hits.length ? Math.round(50 + (50 * (pos - neg)) / hits.length) : 50;
  const idxC = idx >= 60 ? C.pos : idx <= 40 ? C.neg : C.neu;

  const src: Record<string, number> = {};
  hits.forEach((h) => (src[h.source] = (src[h.source] || 0) + 1));
  const topSrc = Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxSrc = Math.max(1, ...topSrc.map(([, c]) => c));

  const months: Record<string, number> = {};
  hits.forEach((h) => { const m = (h.date || "").slice(0, 7); if (m) months[m] = (months[m] || 0) + 1; });
  const trend = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
  const maxT = Math.max(1, ...trend.map(([, n]) => n));

  return (
    <div>
      <Link href="/monitor" className="muted">← كل عمليات الرصد</Link>
      <div className="mon-hero">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2>📡 {mon?.name}</h2>
            <div className="kw">{(mon?.keywords || []).map((k: string) => <span key={k}>{k}</span>)}</div>
          </div>
          <button className="btn" onClick={() => mon && run(mon)} disabled={loading}>↻ تحديث</button>
        </div>
      </div>

      {loading ? <div className="spinner" /> : (
        <>
          <div className="stat-grid">
            <div className="stat"><div className="v">{hits.length}</div><div className="l">إجمالي الذكر</div></div>
            <div className="stat"><div className="v" style={{ color: idxC }}>{idx}<span style={{ fontSize: 14 }}>/100</span></div><div className="l">المؤشر الإعلامي</div></div>
            <div className="stat"><div className="v" style={{ color: neg ? C.neg : undefined }}>{neg}</div><div className="l">أخبار سلبية</div></div>
            <div className="stat"><div className="v">{topSrc.length}</div><div className="l">مصادر</div></div>
          </div>

          <div className="mon-grid" style={{ marginTop: 16 }}>
            <div className="cbox">
              <h4>توزيع النبرة</h4>
              <div dangerouslySetInnerHTML={{ __html: donut([{ v: neg, c: C.neg }, { v: neu, c: C.neu }, { v: pos, c: C.pos }]) }} />
              <div className="legend" style={{ marginTop: 12 }}>
                <div className="row"><span className="dot" style={{ background: C.neg }} /> سلبي: <b>{neg}</b></div>
                <div className="row"><span className="dot" style={{ background: C.neu }} /> محايد: <b>{neu}</b></div>
                <div className="row"><span className="dot" style={{ background: C.pos }} /> إيجابي: <b>{pos}</b></div>
              </div>
            </div>
            <div className="cbox">
              <h4>التغطية عبر الزمن</h4>
              {trend.length ? (
                <div className="trend">
                  {trend.map(([m, n]) => (
                    <div className="col" key={m}><b>{n}</b><i style={{ height: `${(n / maxT) * 100}%` }} /><span>{m.slice(2)}</span></div>
                  ))}
                </div>
              ) : <p className="muted">لا بيانات كافية.</p>}
            </div>
          </div>

          <div className="cbox" style={{ marginTop: 16 }}>
            <h4>المصادر الأكثر تغطية</h4>
            {topSrc.length === 0 && <span className="muted">لا مصادر.</span>}
            {topSrc.map(([s, c]) => (
              <div className="srcrow" key={s}><div>{s}</div><div className="bar"><i style={{ width: `${(c / maxSrc) * 100}%` }} /></div><div className="num">{c}</div></div>
            ))}
          </div>

          <div className="section-title">الأخبار (الأحدث أولاً) · {hits.length}</div>
          {hits.length === 0 && <p className="muted">لا أخبار مطابقة حالياً — جرّب كلمات أوسع.</p>}
          {hits.map((h, i) => (
            <div className="newsitem" key={i}>
              <a href={h.link} target="_blank" rel="noopener">{h.title}</a>
              <div className="meta">
                <span>{h.source}</span><span>·</span><span>{h.date}</span>
                <span className="chip" style={{ color: sColor(h.sentiment), borderColor: sColor(h.sentiment) + "55" }}>{h.sentiment}</span>
                <span className="chip" style={{ color: "var(--accent2)" }}>{h.type}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
