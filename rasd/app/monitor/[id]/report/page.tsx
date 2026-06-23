"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/api";

const C = { neg: "#f43f5e", neu: "#8a97ad", pos: "#22c55e" };
const sColor = (s: string) => (s === "سلبي" ? C.neg : s === "إيجابي" ? C.pos : C.neu);
const AR_MONTH = ["", "كانون٢", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين١", "تشرين٢", "كانون١"];

function donut(parts: { v: number; c: string }[], size = 150) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 6, r = R * 0.6;
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
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${g}<text x="${cx}" y="${cy + 6}" fill="#0b1220" font-size="24" font-weight="800" text-anchor="middle">${tot}</text></svg>`;
}

export default function MonitorReport({ params }: { params: { id: string } }) {
  const [mon, setMon] = useState<any>(null);
  const [hits, setHits] = useState<any[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState("جارٍ جمع البيانات…");
  const [downloading, setDownloading] = useState(false);

  const build = useCallback(async (m: any) => {
    setLoading(true);
    setStage("جارٍ جلب الأخبار ومنصّة X…");
    const body = { keywords: m.keywords, limit: 100 };
    const [news, x] = await Promise.all([
      apiPost("news", body).catch(() => ({ hits: [] })),
      apiPost("x", body).catch(() => ({ hits: [] })),
    ]);
    const all = [
      ...(news.hits || []).map((h: any) => ({ ...h, platform: "news" })),
      ...(x.hits || []).map((h: any) => ({ ...h, platform: "x" })),
    ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    setHits(all);

    const neg = all.filter((h) => h.sentiment === "سلبي").length;
    const pos = all.filter((h) => h.sentiment === "إيجابي").length;
    const neu = all.length - neg - pos;
    const idx = all.length ? Math.round(50 + (50 * (pos - neg)) / all.length) : 50;
    setStage("جارٍ توليد الملخّص التنفيذي بالذكاء الاصطناعي…");
    const s = await apiPost("summarize", {
      name: m.name, stats: { total: all.length, pos, neg, neu, idx },
      samples: all.slice(0, 40).map((h) => ({ title: h.title, sentiment: h.sentiment })),
    }).catch(() => ({ summary: "" }));
    setSummary(s.summary || "");
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("monitors").select("*").eq("id", params.id).maybeSingle();
      setMon(data);
      if (data) build(data); else setLoading(false);
    })();
  }, [params.id, build]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const el = document.querySelector(".paper");
      await html2pdf().set({
        margin: [8, 8, 10, 8],
        filename: `تقرير-رصد-${mon?.name || "هدف"}.pdf`,
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 980 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], before: ".break" },
      }).from(el).save();
    } finally {
      setDownloading(false);
    }
  };

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["المنصّة", "التاريخ", "المصدر", "النبرة", "النوع", "العنوان", "الرابط"]];
    hits.forEach((h) => rows.push([h.platform === "x" ? "X" : "أخبار", h.date, h.source, h.sentiment, h.type, h.title, h.link]));
    const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `تقرير-${mon?.name || "رصد"}.csv`;
    a.click();
  };

  if (!mon && !loading) return <p className="muted">الرصد غير موجود.</p>;
  if (loading) return (
 <div style={{ textAlign: "center", padding: 60 }}>
 <div className="spinner" />
 <p className="muted">{stage}</p>
 </div>
  );

  const neg = hits.filter((h) => h.sentiment === "سلبي").length;
  const pos = hits.filter((h) => h.sentiment === "إيجابي").length;
  const neu = hits.length - neg - pos;
  const idx = hits.length ? Math.round(50 + (50 * (pos - neg)) / hits.length) : 50;
  const xN = hits.filter((h) => h.platform === "x").length;

  const src: Record<string, number> = {};
  hits.forEach((h) => (src[h.source] = (src[h.source] || 0) + 1));
  const topSrc = Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxSrc = Math.max(1, ...topSrc.map(([, c]) => c));

  const typ: Record<string, number> = {};
  hits.forEach((h) => { if (h.type) typ[h.type] = (typ[h.type] || 0) + 1; });
  const topTyp = Object.entries(typ).sort((a, b) => b[1] - a[1]);

  const months: Record<string, number> = {};
  hits.forEach((h) => { const m = (h.date || "").slice(0, 7); if (m) months[m] = (months[m] || 0) + 1; });
  const trend = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
  const maxT = Math.max(1, ...trend.map(([, n]) => n));

  const top = [...hits].sort((a, b) => (b.engagement || 0) - (a.engagement || 0)).slice(0, 8);
  const today = new Date().toISOString().slice(0, 10);

  return (
 <div className="report">
 <div className="rep-actions no-print">
 <Link href={`/monitor/${params.id}`} className="muted"> رجوع للوحة</Link>
 <div style={{ display: "flex", gap: 8 }}>
 <button className="btn ghost" onClick={exportCsv}>︎ تصدير CSV</button>
 <button className="btn ghost" onClick={() => window.print()}> طباعة</button>
 <button className="btn" onClick={downloadPdf} disabled={downloading}>
            {downloading ? "جارٍ التحميل…" : "︎ تحميل PDF"}
 </button>
 </div>
 </div>

 <div className="paper">
 <div className="rep-head">
 <div>
 <div className="brand"> مركز الرصد</div>
 <h1>تقرير رصد إعلامي</h1>
 <div className="sub">الهدف: <b>{mon?.name}</b></div>
 <div className="kw">{(mon?.keywords || []).map((k: string) => <span key={k}>{k}</span>)}</div>
 </div>
 <div className="rep-meta">
 <div>تاريخ التقرير: <b>{today}</b></div>
 <div>الكلمات المرصودة: {(mon?.keywords || []).length}</div>
 <div>المصادر: أخبار ({hits.length - xN}) + X ({xN})</div>
 </div>
 </div>

 <div className="rep-kpis">
 <div className="k"><div className="v">{hits.length}</div><div className="l">إجمالي ما نُشر</div></div>
 <div className="k"><div className="v" style={{ color: idx >= 60 ? C.pos : idx <= 40 ? C.neg : "#0b1220" }}>{idx}/100</div><div className="l">المؤشر الإعلامي</div></div>
 <div className="k"><div className="v" style={{ color: C.neg }}>{neg}</div><div className="l">سلبي</div></div>
 <div className="k"><div className="v" style={{ color: C.pos }}>{pos}</div><div className="l">إيجابي</div></div>
 </div>

 <section>
 <h2>الملخّص التنفيذي</h2>
 <p className="summary">{summary || "—"}</p>
 </section>

 <div className="rep-grid">
 <section>
 <h2>توزيع النبرة</h2>
 <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
 <div dangerouslySetInnerHTML={{ __html: donut([{ v: neg, c: C.neg }, { v: neu, c: C.neu }, { v: pos, c: C.pos }]) }} />
 <div>
 <div className="lg"><span style={{ background: C.neg }} /> سلبي: <b>{neg}</b></div>
 <div className="lg"><span style={{ background: C.neu }} /> محايد: <b>{neu}</b></div>
 <div className="lg"><span style={{ background: C.pos }} /> إيجابي: <b>{pos}</b></div>
 </div>
 </div>
 </section>
 <section>
 <h2>تصنيف القضايا</h2>
            {topTyp.length === 0 && <span className="muted">—</span>}
            {topTyp.map(([t, c]) => (
 <div className="brow" key={t}><div className="bl">{t}</div><div className="bar"><i style={{ width: `${(c / hits.length) * 100}%` }} /></div><div className="bn">{c}</div></div>
            ))}
 </section>
 </div>

 <div className="rep-grid">
 <section>
 <h2>أبرز المصادر / الحسابات</h2>
            {topSrc.map(([s, c]) => (
 <div className="brow" key={s}><div className="bl">{s}</div><div className="bar"><i style={{ width: `${(c / maxSrc) * 100}%` }} /></div><div className="bn">{c}</div></div>
            ))}
 </section>
 <section>
 <h2>التغطية عبر الزمن</h2>
 <div className="trendp">
              {trend.map(([m, n]) => {
                const mm = +m.slice(5, 7);
                return <div className="col" key={m}><b>{n}</b><i style={{ height: `${(n / maxT) * 90}%` }} /><span>{AR_MONTH[mm]}</span></div>;
              })}
 </div>
 </section>
 </div>

 <section>
 <h2>أبرز ما نُشر (الأكثر تفاعلاً)</h2>
          {top.map((h, i) => (
 <div className="item" key={i}>
 <div className="it-t">{h.title}</div>
 <div className="it-m">
 <span className="pf">{h.platform === "x" ? "𝕏" : ""}</span>
 <span>{h.source}</span><span>·</span><span>{h.date}</span>
                {h.engagement ? <span>·  {h.engagement}</span> : null}
 <span className="sent" style={{ color: sColor(h.sentiment) }}>● {h.sentiment}</span>
 </div>
 </div>
          ))}
 </section>

 <section className="break">
 <h2>كل ما نُشر ({hits.length})</h2>
          {hits.map((h, i) => (
 <div className="item sm" key={i}>
 <div className="it-t"><a href={h.link} target="_blank" rel="noopener">{h.title}</a></div>
 <div className="it-m">
 <span className="pf">{h.platform === "x" ? "𝕏" : ""}</span>
 <span>{h.source}</span><span>·</span><span>{h.date}</span>
 <span className="sent" style={{ color: sColor(h.sentiment) }}>● {h.sentiment}</span>
 <span className="muted">{h.type}</span>
 </div>
 </div>
          ))}
 </section>

 <div className="rep-foot">
          مركز الرصد · تقرير آلي · تم التوليد في {today} — التصنيف والملخّص بمساعدة الذكاء الاصطناعي وقد يحتاج مراجعة بشرية.
 </div>
 </div>
 </div>
  );
}
