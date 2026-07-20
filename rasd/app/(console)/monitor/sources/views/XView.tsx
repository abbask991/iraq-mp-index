"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/api";

const C = { neg: "#f43f5e", neu: "#8a97ad", pos: "#22c55e" };
const sColor = (s: string) => (s === "سلبي" ? C.neg : s === "إيجابي" ? C.pos : C.neu);

function donut(parts: { v: number; c: string }[], unit = "ذِكر", size = 168) {
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
  return `<svg viewBox="0 0 ${size} ${size}" width="100%" style="max-width:${size}px;display:block;margin:0 auto">${g}<text x="${cx}" y="${cy - 2}" fill="#e8eef9" font-size="26" font-weight="800" text-anchor="middle">${tot}</text><text x="${cx}" y="${cy + 16}" fill="#8a97ad" font-size="11" text-anchor="middle">${unit}</text></svg>`;
}

export default function XView() {
  const [targets, setTargets] = useState<string[]>([]);
  const [val, setVal] = useState("");
  const [msg, setMsg] = useState("");
  const [sel, setSel] = useState<string>("");
  const [hits, setHits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [platform, setPlatform] = useState<"x" | "youtube">("x");
  const [range, setRange] = useState<"day" | "week" | "month" | "year">("week");
  const [replies, setReplies] = useState<Record<string, any>>({});
  const [repBusy, setRepBusy] = useState<string>("");

  const loadTargets = async () => {
    const { data } = await supabase.from("user_targets").select("name").order("created_at", { ascending: true });
    setTargets((data || []).map((r: any) => r.name));
  };
  useEffect(() => { loadTargets(); }, []);

  const tweetId = (link: string) => (link.match(/status\/(\d+)/) || [])[1] || "";
  const analyzeReplies = async (h: any) => {
    const id = tweetId(h.link);
    if (!id) return;
    setRepBusy(id);
    const r = await apiPost("x-replies", { tweetId: id }).catch(() => ({ replies: [], error: "X_API_ERROR" }));
    setReplies((p) => ({ ...p, [id]: r }));
    setRepBusy("");
  };
  const isYT = platform === "youtube";
  const UNIT = isYT ? "فيديو" : "تغريدة";
  const ACCT = isYT ? "القنوات" : "الحسابات";

  const add = async () => {
    const v = val.trim();
    setVal("");
    if (!v || targets.includes(v)) return;
    setTargets([...targets, v]);
    const { error } = await supabase.from("user_targets").insert({ name: v });
    if (error) { setMsg(`خطأ: ${error.message}`); loadTargets(); }
    else { setMsg(" تم الحفظ"); setTimeout(() => setMsg(""), 2000); }
  };
  const remove = async (t: string) => {
    setTargets(targets.filter((x) => x !== t));
    if (sel === t) { setSel(""); setHits([]); }
    await supabase.from("user_targets").delete().eq("name", t);
  };

  const view = useCallback(async (name: string, plat: "x" | "youtube", rng?: string) => {
    setSel(name); setPlatform(plat); setLoading(true); setNotice(""); setHits([]);
    const j = await apiPost(plat === "youtube" ? "youtube" : "x", { keywords: [name], limit: 150, range: rng ?? range });
    setHits(j.hits || []);
    if (j.message) setNotice(j.message);
    setLoading(false);
  }, [range]);

  const neg = hits.filter((h) => h.sentiment === "سلبي").length;
  const pos = hits.filter((h) => h.sentiment === "إيجابي").length;
  const neu = hits.length - neg - pos;
  const idx = hits.length ? Math.round(50 + (50 * (pos - neg)) / hits.length) : 50;
  const idxC = idx >= 60 ? C.pos : idx <= 40 ? C.neg : C.neu;

  const accs: Record<string, number> = {};
  hits.forEach((h) => (accs[h.source] = (accs[h.source] || 0) + 1));
  const topAcc = Object.entries(accs).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxAcc = Math.max(1, ...topAcc.map(([, c]) => c));
  const totalEng = hits.reduce((s, h) => s + (h.engagement || 0), 0);
  const topTweets = [...hits].sort((a, b) => (b.engagement || 0) - (a.engagement || 0)).slice(0, 5);

  return (
 <div>
 <h2> رصد مخصّص — X ويوتيوب</h2>
 <p className="muted">أضِف اسم شخص أو مؤسسة، اختر المنصّة، واضغط «عرض» لجلب كل المحتوى عنه وتحليله (نبرة، أكثر {ACCT}، التفاعل).</p>

 <div className="src-toggle" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
 <button className={`btn ${!isYT ? "" : "ghost"}`} onClick={() => { setPlatform("x"); if (sel) view(sel, "x"); }} disabled={loading}>𝕏 منصّة X</button>
 <button className={`btn ${isYT ? "" : "ghost"}`} onClick={() => { setPlatform("youtube"); if (sel) view(sel, "youtube"); }} disabled={loading}>▶ يوتيوب</button>
 <span style={{ marginInlineStart: "auto", display: "flex", gap: 6, alignItems: "center" }}>
 <span className="muted" style={{ fontSize: 12 }}>المدة:</span>
          {([["day", "يوم"], ["week", "أسبوع"], ["month", "شهر"], ["year", "سنة"]] as const).map(([v, l]) => (
 <button key={v} className={`btn ${range === v ? "" : "ghost"}`} style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={() => { setRange(v); if (sel) view(sel, platform, v); }} disabled={loading}>{l}</button>
          ))}
 </span>
 </div>
      {!isYT && (range === "month" || range === "year") && (
 <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
           منصّة X تبحث آخر ٧ أيام فقط (قيد الخطة) — النتائج ستكون لآخر أسبوع. الأخبار تدعم {range === "month" ? "الشهر" : "السنة"} كاملة.
 </div>
      )}

 <div className="card" style={{ marginBottom: 14 }}>
 <b> إضافة هدف (شخص / مؤسسة)</b>
 <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
 <input placeholder='مثال: محمد الحلبوسي · وزارة النفط · مقتدى الصدر' value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()} />
 <button className="btn" onClick={add}>إضافة</button>
 </div>
 <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {targets.length === 0 && <span className="muted">لا أهداف بعد — أضِف أول اسم.</span>}
          {targets.map((t) => (
 <span key={t} style={{
              background: sel === t ? "#13233a" : "#0e1626",
              border: `1px solid ${sel === t ? "var(--accent)" : "var(--line)"}`,
              borderRadius: 8, padding: "5px 10px", fontSize: 13, display: "inline-flex", gap: 8, alignItems: "center",
            }}>
              {t}
 <button className="btn ghost" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => view(t, platform)}>عرض</button>
 <button onClick={() => remove(t)}
                style={{ background: "none", border: 0, color: "#f43f5e", cursor: "pointer" }}></button>
 </span>
          ))}
 </div>
        {msg && <div className="muted" style={{ marginTop: 8 }}>{msg}</div>}
 </div>

      {notice && (
 <div className="card" style={{ borderColor: "#f59e0b55", background: "#f59e0b12" }}>
 <b>𝕏 ملاحظة:</b> <span className="muted">{notice}</span>
 </div>
      )}

      {sel && (
 <div className="mon-hero" style={{ marginTop: 6 }}>
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
 <h3 style={{ margin: 0 }}>{isYT ? "▶" : "𝕏"} نتائج: {sel}</h3>
 <button className="btn" onClick={() => view(sel, platform)} disabled={loading}> تحديث</button>
 </div>
 </div>
      )}

      {loading && <div className="spinner" />}

      {sel && !loading && !notice && (
 <>
 <div className="stat-grid" style={{ marginTop: 14 }}>
 <div className="stat"><div className="v">{hits.length}</div><div className="l">{UNIT}</div></div>
 <div className="stat"><div className="v" style={{ color: idxC }}>{idx}<span style={{ fontSize: 14 }}>/100</span></div><div className="l">المؤشر</div></div>
 <div className="stat"><div className="v" style={{ color: neg ? C.neg : undefined }}>{neg}</div><div className="l">سلبية</div></div>
 <div className="stat"><div className="v">{totalEng.toLocaleString()}</div><div className="l">إجمالي التفاعل {isYT ? "" : ""}</div></div>
 </div>

 <div className="mon-grid" style={{ marginTop: 16 }}>
 <div className="cbox">
 <h4>توزيع النبرة</h4>
 <div dangerouslySetInnerHTML={{ __html: donut([{ v: neg, c: C.neg }, { v: neu, c: C.neu }, { v: pos, c: C.pos }], UNIT) }} />
 <div className="legend" style={{ marginTop: 12 }}>
 <div className="row"><span className="dot" style={{ background: C.neg }} /> سلبي: <b>{neg}</b></div>
 <div className="row"><span className="dot" style={{ background: C.neu }} /> محايد: <b>{neu}</b></div>
 <div className="row"><span className="dot" style={{ background: C.pos }} /> إيجابي: <b>{pos}</b></div>
 </div>
 </div>
 <div className="cbox">
 <h4>أكثر {ACCT} ذِكراً</h4>
              {topAcc.length === 0 && <span className="muted">لا حسابات.</span>}
              {topAcc.map(([s, c]) => (
 <div className="srcrow" key={s}><div>{s}</div><div className="bar"><i style={{ width: `${(c / maxAcc) * 100}%` }} /></div><div className="num">{c}</div></div>
              ))}
 </div>
 </div>

          {topTweets.length > 0 && (
 <div className="cbox" style={{ marginTop: 16 }}>
 <h4>أكثر {isYT ? "الفيديوهات" : "التغريدات"} تأثيراً</h4>
              {topTweets.map((h, i) => (
 <div className="newsitem" key={i}>
 <a href={h.link} target="_blank" rel="noopener">{h.title}</a>
 <div className="meta">
 <span>{h.author ? `${h.author} ` : ""}{h.source}</span><span>·</span><span>{h.date}</span>
                    {isYT && h.views != null && <span className="chip" style={{ color: "var(--accent2)" }}> {(+h.views).toLocaleString()}</span>}
 <span className="chip" style={{ color: "var(--accent)" }}>{isYT ? "" : ""} {h.engagement}</span>
 <span className="chip" style={{ color: sColor(h.sentiment), borderColor: sColor(h.sentiment) + "55" }}>{h.sentiment}</span>
 </div>
 </div>
              ))}
 </div>
          )}

 <div className="section-title">{isYT ? "كل الفيديوهات" : "كل التغريدات"} (الأحدث أولاً) · {hits.length}</div>
          {hits.length === 0 && <p className="muted">لا نتائج مطابقة حالياً.</p>}
          {hits.map((h, i) => {
            const id = tweetId(h.link);
            const rep = replies[id];
            return (
 <div className="newsitem" key={i}>
 <a href={h.link} target="_blank" rel="noopener">{h.title}</a>
 <div className="meta">
 <span>{h.author ? `${h.author} ` : ""}{h.source}</span><span>·</span><span>{h.date}</span>
                {isYT && h.views != null && <span className="chip" style={{ color: "var(--accent2)" }}> {(+h.views).toLocaleString()}</span>}
 <span className="chip" style={{ color: "var(--accent)" }}>{isYT ? "" : ""} {h.engagement}</span>
 <span className="chip" style={{ color: sColor(h.sentiment), borderColor: sColor(h.sentiment) + "55" }}>{h.sentiment}</span>
 <span className="chip" style={{ color: "var(--accent2)" }}>{h.type}</span>
                {!isYT && id && (
 <button className="btn ghost" style={{ padding: "2px 8px", fontSize: 11 }}
                    onClick={() => analyzeReplies(h)} disabled={repBusy === id}>
                    {repBusy === id ? "جارٍ تحليل التعليقات…" : rep ? " التعليقات" : " حلّل التعليقات"}
 </button>
                )}
 </div>
              {rep && (rep.error ? <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>تعذّر جلب التعليقات.</div>
                : rep.count === 0 ? <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>لا تعليقات خلال آخر ٧ أيام.</div>
                : (
 <div className="cbox" style={{ marginTop: 8, background: "#0b1422" }}>
 <div style={{ display: "flex", gap: 12, fontSize: 12, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
 <b> {rep.count} تعليق</b>
 <span style={{ color: C.pos }}>● إيجابي {rep.pos}</span>
 <span style={{ color: C.neu }}>● محايد {rep.neu}</span>
 <span style={{ color: C.neg }}>● سلبي {rep.neg}</span>
 <span className="muted">— مزاج الجمهور: {rep.pos > rep.neg ? "إيجابي غالباً" : rep.neg > rep.pos ? "سلبي غالباً" : "منقسم"}</span>
 </div>
                  {rep.replies.slice(0, 8).map((rp: any, j: number) => (
 <div key={j} style={{ padding: "5px 0", borderTop: j ? "1px solid var(--line)" : "0" }}>
 <div style={{ fontSize: 12.5 }}>{rp.text}</div>
 <div className="meta" style={{ marginTop: 2 }}>
 <span>{rp.source}</span>{rp.engagement ? <><span>·</span><span> {rp.engagement}</span></> : null}
 <span className="chip" style={{ color: sColor(rp.sentiment), borderColor: sColor(rp.sentiment) + "55" }}>{rp.sentiment}</span>
 </div>
 </div>
                  ))}
 </div>
              ))}
 </div>
          ); })}
 </>
      )}
 </div>
  );
}
