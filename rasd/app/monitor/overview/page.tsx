"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import RangeSelect, { Range } from "@/components/RangeSelect";
import { getCoverage } from "@/lib/targets";
import { SkelCards } from "@/components/Skeleton";
import IraqMap from "@/components/IraqMap";
import EmptyState from "@/components/EmptyState";
import Gauge from "@/components/Gauge";

const C = { neg: "#f43f5e", neu: "#8a97ad", pos: "#22c55e" };
const sColor = (s: string) => (s === "سلبي" ? C.neg : s === "إيجابي" ? C.pos : C.neu);
const LV: Record<string, string> = { highly: "#f43f5e", strong: "#fb923c", possible: "#f59e0b", weak: "#84cc16", organic: "#22c55e" };

function donut(parts: { v: number; c: string }[], size = 130) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 5, r = R * 0.62;
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
  return `<svg viewBox="0 0 ${size} ${size}" width="100%" style="max-width:${size}px;display:block;margin:0 auto">${g}</svg>`;
}

export default function Overview() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("day");
  const [at, setAt] = useState("");

  const load = useCallback(async (rng: Range) => {
    setLoading(true);
    const r = await apiPost("overview", { range: rng, limit: getCoverage() }).catch(() => null);
    setD(r); setAt(new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })); setLoading(false);
  }, []);
  useEffect(() => { load("day"); }, [load]);

  const s = d?.sentiment || { pos: 0, neg: 0, neu: 0 };
  const idxColor = d?.media_index >= 60 ? C.pos : d?.media_index <= 40 ? C.neg : "#f59e0b";
  const maxIssue = Math.max(1, ...(d?.issues || []).map((i: any) => i.count));

  return (
 <div>
      {/* hero */}
 <div className="cc-hero">
 <div>
 <div className="cc-live"><span className="cc-dot" /> {loading ? "جارٍ التحديث…" : `مباشر · آخر تحديث ${at}`}</div>
 <h2 style={{ margin: "6px 0 2px" }}>لوحة القيادة</h2>
 <p className="muted" style={{ margin: 0 }}>نبض المحادثة العراقية لحظة بلحظة — ترندات، حملات، حسابات، ومزاج عام.</p>
 </div>
 <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          {d && !d.error && <Gauge value={d.media_index ?? 50} label="المؤشر الإعلامي" size={96} />}
 <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
 <RangeSelect value={range} onChange={(v) => { setRange(v); load(v); }} disabled={loading} />
 <button className="btn" onClick={() => load(range)} disabled={loading}> تحديث</button>
 </div>
 </div>
 </div>

      {loading && !d && <SkelCards count={4} />}

      {d && (d.error ? <EmptyState tone="error" title="تعذّر تحميل لوحة القيادة" subtitle={d.message} action={{ label: "إعادة المحاولة", onClick: () => load(range) }} /> : (
 <>
          {/* KPI row */}
 <div className="cc-kpis">
 <div className="cc-kpi"><div className="ic"></div><div className="v">{Number(d.scanned).toLocaleString()}</div><div className="l">منشور مُمسوح</div></div>
 <div className="cc-kpi"><div className="ic"></div><div className="v">{d.trending?.length || 0}</div><div className="l">ترند صاعد</div></div>
 <div className="cc-kpi" style={{ borderColor: d.campaigns?.length ? "#fb923c55" : undefined }}><div className="ic"></div><div className="v" style={{ color: d.campaigns?.length ? "#fb923c" : undefined }}>{d.campaigns?.length || 0}</div><div className="l">حملة مشتبهة</div></div>
 <div className="cc-kpi" style={{ borderColor: d.new_accounts?.clusters?.length ? "#f43f5e55" : undefined }}><div className="ic"></div><div className="v" style={{ color: d.new_accounts?.clusters?.length ? "#f43f5e" : undefined }}>{d.new_accounts?.new_today || 0}</div><div className="l">حساب جديد اليوم</div></div>
 </div>

 <div className="cc-grid">
            {/* mood */}
 <div className="cbox">
 <h4>مزاج المحادثة</h4>
 <div style={{ position: "relative" }}>
 <div dangerouslySetInnerHTML={{ __html: donut([{ v: s.neg, c: C.neg }, { v: s.neu, c: C.neu }, { v: s.pos, c: C.pos }]) }} />
 <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
 <div style={{ fontSize: 26, fontWeight: 800, color: idxColor }}>{d.media_index}</div>
 <div className="muted" style={{ fontSize: 10 }}>المؤشر</div>
 </div>
 </div>
 <div className="legend" style={{ marginTop: 10 }}>
 <div className="row"><span className="dot" style={{ background: C.pos }} /> إيجابي <b style={{ marginInlineStart: "auto" }}>{s.pos}</b></div>
 <div className="row"><span className="dot" style={{ background: C.neu }} /> محايد <b style={{ marginInlineStart: "auto" }}>{s.neu}</b></div>
 <div className="row"><span className="dot" style={{ background: C.neg }} /> سلبي <b style={{ marginInlineStart: "auto" }}>{s.neg}</b></div>
 </div>
 </div>

            {/* trending */}
 <div className="cbox">
 <h4> الترندات الصاعدة الآن</h4>
              {(d.trending || []).length === 0 && <span className="muted">لا ترندات بارزة.</span>}
              {(d.trending || []).map((h: any) => (
 <Link key={h.hashtag} href={`/monitor/trends?q=${encodeURIComponent(h.hashtag)}`} className="cc-trend">
 <span className="t">#{h.hashtag}</span>
                  {h.velocity >= 1.5 && <span className="chip" style={{ color: "#fb923c" }}></span>}
 <span className="muted" style={{ fontSize: 11, marginInlineStart: "auto" }}>{h.mentions} ذِكر · <span style={{ color: sColor(h.sentiment) }}>{h.sentiment}</span></span>
 </Link>
              ))}
 </div>
 </div>

 <div className="cc-grid">
            {/* issues */}
 <div className="cbox">
 <h4> أبرز القضايا</h4>
              {(d.issues || []).length === 0 && <span className="muted">—</span>}
              {(d.issues || []).map((i: any) => (
 <div className="srcrow" key={i.label} style={{ marginBottom: 6 }}>
 <div style={{ width: 120, fontSize: 13 }}>{i.label}</div>
 <div className="bar"><i style={{ width: `${(i.count / maxIssue) * 100}%` }} /></div>
 <div className="num">{i.count}</div>
 </div>
              ))}
 </div>

            {/* campaigns */}
 <div className="cbox">
 <h4> حملات مشتبهة</h4>
              {(d.campaigns || []).length === 0 && <span className="muted">لا حملات مشتبهة حالياً </span>}
              {(d.campaigns || []).map((c: any) => (
 <Link key={c.hashtag} href={`/monitor/campaign?q=${encodeURIComponent(c.hashtag)}`} className="cc-trend">
 <span className="t">#{c.hashtag}</span>
 <span className="muted" style={{ fontSize: 11 }}>{c.total_posts} منشور</span>
 <span className="chip" style={{ color: LV[c.alert_level?.level] || "#84cc16", marginInlineStart: "auto", fontWeight: 800 }}>{c.coordination_score}</span>
 </Link>
              ))}
 </div>
 </div>

          {/* new account clusters */}
          {d.new_accounts?.clusters?.length > 0 && (
 <div className="cbox" style={{ borderColor: "#f43f5e55", background: "#2a0f1622" }}>
 <h4 style={{ color: "#f43f5e" }}> تكتّلات إنشاء حسابات بنفس اليوم</h4>
 <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {d.new_accounts.clusters.map((c: any) => (
 <Link key={c.date} href="/monitor/new-accounts" className="chip" style={{ color: "#f43f5e", padding: "6px 12px" }}>
                     {c.date}  {c.count} حساب
 </Link>
                ))}
 </div>
 </div>
          )}

          {/* geographic distribution */}
          {d.geo?.located > 0 && (
 <div className="cbox" style={{ marginTop: 4 }}>
 <h4>التوزيع الجغرافي عبر المحافظات</h4>
 <IraqMap geo={d.geo} />
 </div>
          )}

 <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>
            كل الإحصاءات من مسح حيّ لـ{d.scanned} منشور / {d.accounts} حساب. اضغط أي عنصر لتحليله الكامل. تحليل آلي يحتاج مراجعة.
 </p>
 </>
      ))}
 </div>
  );
}
