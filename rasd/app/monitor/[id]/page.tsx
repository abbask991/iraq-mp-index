"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/api";

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
  const [platform, setPlatform] = useState<"news" | "x" | "youtube">("news");
  const [range, setRange] = useState<"day" | "week" | "month" | "year">("week");
  const [notice, setNotice] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const cacheRef = useRef<Record<string, { hits: any[]; at: string }>>({});

  // fresh fetch from the live API  updates the cache (Supabase + in-memory)
  const run = useCallback(async (m: any, plat: "news" | "x" | "youtube", rng: string) => {
    setLoading(true);
    setNotice("");
    const kind = plat === "x" ? "x" : plat === "youtube" ? "youtube" : "news";
    const j = await apiPost(kind, { keywords: m.keywords, range: rng });
    setHits(j.hits || []);
    if (j.message) setNotice(j.message);
    const at = new Date().toISOString();
    if (!j.error) {
      cacheRef.current = { ...cacheRef.current, [`${plat}:${rng}`]: { hits: j.hits || [], at } };
      setUpdatedAt(at);
      supabase.from("monitors").update({ cache: cacheRef.current }).eq("id", m.id).then(() => {});
    } else { setUpdatedAt(""); }
    setLoading(false);
  }, []);

  // show cached result instantly if present; otherwise fetch fresh
  const show = useCallback((m: any, plat: "news" | "x" | "youtube", rng: string) => {
    const c = cacheRef.current[`${plat}:${rng}`];
    if (c) {
      setHits(c.hits); setUpdatedAt(c.at); setNotice(""); setLoading(false);
    } else {
      run(m, plat, rng);
    }
  }, [run]);

  const switchTo = (plat: "news" | "x" | "youtube") => { setPlatform(plat); if (mon) show(mon, plat, range); };
  const switchRange = (rng: "day" | "week" | "month" | "year") => { setRange(rng); if (mon) show(mon, platform, rng); };

  const [snaps, setSnaps] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("monitors").select("*").eq("id", params.id).maybeSingle();
      setMon(data);
      if (data) {
        cacheRef.current = data.cache && typeof data.cache === "object" ? data.cache : {};
        show(data, "news", "week");
      } else setLoading(false);
      supabase.from("snapshots").select("taken_at,mentions,media_index,neg_ratio")
        .eq("monitor_id", params.id).order("taken_at", { ascending: true }).limit(60)
        .then(({ data: s }) => setSnaps(s || []));
    })();
  }, [params.id, show]);

  if (!mon && !loading) return <p className="muted">الرصد غير موجود.</p>;
  const isX = platform === "x";
  const isYT = platform === "youtube";
  const isSocial = isX || isYT;
  const ACCT = isYT ? "القنوات" : isX ? "الحسابات" : "المصادر";
  const UNIT = isYT ? "الفيديوهات" : isX ? "التغريدات" : "الأخبار";

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
 <Link href="/monitor" className="muted"> كل عمليات الرصد</Link>
 <div className="mon-hero">
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
 <div>
 <h2> {mon?.name}</h2>
 <div className="kw">{(mon?.keywords || []).map((k: string) => <span key={k}>{k}</span>)}</div>
 </div>
 <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {updatedAt && !loading && (
 <span className="muted" style={{ fontSize: 11 }}>
                آخر تحديث: {updatedAt.slice(0, 10)} {updatedAt.slice(11, 16)}
 </span>
            )}
 <Link href={`/monitor/${mon?.id}/report`} className="btn ghost" style={{ textDecoration: "none" }}> تقرير PDF</Link>
 <button className="btn" onClick={() => mon && run(mon, platform, range)} disabled={loading}> تحديث</button>
 </div>
 </div>
 <div className="src-toggle" style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
 <button className={`btn ${platform === "news" ? "" : "ghost"}`} onClick={() => switchTo("news")} disabled={loading}> الأخبار</button>
 <button className={`btn ${platform === "x" ? "" : "ghost"}`} onClick={() => switchTo("x")} disabled={loading}>𝕏 منصّة X</button>
 <button className={`btn ${platform === "youtube" ? "" : "ghost"}`} onClick={() => switchTo("youtube")} disabled={loading}>▶ يوتيوب</button>
 <span style={{ marginInlineStart: "auto", display: "flex", gap: 6, alignItems: "center" }}>
 <span className="muted" style={{ fontSize: 12 }}>المدة:</span>
            {([["day", "يوم"], ["week", "أسبوع"], ["month", "شهر"], ["year", "سنة"]] as const).map(([v, l]) => (
 <button key={v} className={`btn ${range === v ? "" : "ghost"}`} style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => switchRange(v)} disabled={loading}>{l}</button>
            ))}
 </span>
 </div>
        {platform === "x" && (range === "month" || range === "year") && (
 <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
             منصّة X تبحث آخر ٧ أيام فقط — لعرض {range === "month" ? "الشهر" : "السنة"} الكاملة استخدم تبويب الأخبار.
 </div>
        )}
 </div>

      {notice && (
 <div className="cbox" style={{ marginTop: 16, borderColor: "#f59e0b55", background: "#f59e0b12" }}>
 <b>𝕏 ملاحظة:</b> <span className="muted">{notice}</span>
 </div>
      )}

      {snaps.length >= 2 && (() => {
        const maxM = Math.max(1, ...snaps.map((s) => s.mentions));
        return (
          <div className="cbox" style={{ marginTop: 16 }}>
            <h4>السجل التاريخي ({snaps.length} لقطة) — الحجم + المؤشّر الإعلامي</h4>
            <div className="trend" style={{ height: 110 }}>
              {snaps.map((s, i) => {
                const idxC = s.media_index >= 60 ? C.pos : s.media_index <= 40 ? C.neg : "#f59e0b";
                return (
                  <div className="col" key={i} title={`${(s.taken_at || "").slice(5, 16).replace("T", " ")} · ${s.mentions} ذِكر · مؤشّر ${s.media_index}`}>
                    <i style={{ height: `${(s.mentions / maxM) * 100}%`, background: idxC }} />
                    <span>{(s.taken_at || "").slice(5, 10)}</span>
                  </div>
                );
              })}
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>ارتفاع العمود = حجم الذِكر · لونه = المؤشّر الإعلامي (أخضر إيجابي · أحمر سلبي). يُحدّث تلقائياً كل ٦ ساعات.</div>
          </div>
        );
      })()}

      {loading ? <div className="spinner" /> : (
 <>
 <div className="stat-grid">
 <div className="stat"><div className="v">{hits.length}</div><div className="l">إجمالي الذكر</div></div>
 <div className="stat"><div className="v" style={{ color: idxC }}>{idx}<span style={{ fontSize: 14 }}>/100</span></div><div className="l">المؤشر الإعلامي</div></div>
 <div className="stat"><div className="v" style={{ color: neg ? C.neg : undefined }}>{neg}</div><div className="l">أخبار سلبية</div></div>
 <div className="stat"><div className="v">{topSrc.length}</div><div className="l">{isYT ? "قنوات" : isX ? "حسابات" : "مصادر"}</div></div>
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
 <h4>{isSocial ? `أكثر ${ACCT} ذِكراً` : "المصادر الأكثر تغطية"}</h4>
            {topSrc.length === 0 && <span className="muted">لا {ACCT}.</span>}
            {topSrc.map(([s, c]) => (
 <div className="srcrow" key={s}><div>{s}</div><div className="bar"><i style={{ width: `${(c / maxSrc) * 100}%` }} /></div><div className="num">{c}</div></div>
            ))}
 </div>

 <div className="section-title">{UNIT} (الأحدث أولاً) · {hits.length}</div>
          {hits.length === 0 && !notice && <p className="muted">لا نتائج مطابقة حالياً — جرّب كلمات أوسع.</p>}
          {hits.map((h, i) => (
 <div className="newsitem" key={i}>
 <a href={h.link} target="_blank" rel="noopener">{h.title}</a>
 <div className="meta">
 <span>{isSocial && h.author ? `${h.author} ` : ""}{h.source}</span><span>·</span><span>{h.date}</span>
                {isYT && h.views != null && <span className="chip" style={{ color: "var(--accent2)" }}> {(+h.views).toLocaleString()}</span>}
                {isSocial && h.engagement != null && <span className="chip" style={{ color: "var(--accent)" }}>{isYT ? "" : ""} {h.engagement}</span>}
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
