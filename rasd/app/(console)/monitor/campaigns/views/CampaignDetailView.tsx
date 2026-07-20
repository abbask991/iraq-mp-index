"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/api";
import { getTargets, primaryKeyword } from "@/lib/targets";
import { useDemo } from "@/components/ui/DemoContext";
import RangeSelect, { Range } from "@/components/RangeSelect";

const LV: Record<string, { c: string; bg: string }> = {
  highly: { c: "#f43f5e", bg: "#2a0f16" },
  strong: { c: "#fb923c", bg: "#2a1a0a" },
  possible: { c: "#f59e0b", bg: "#2a1f0a" },
  weak: { c: "#84cc16", bg: "#1d2412" },
  organic: { c: "#22c55e", bg: "#0f2418" },
};
const SIG_LABEL: Record<string, string> = {
  text_similarity: "التشابه النصّي",
  timing_sync: "تزامن التوقيت",
  account_suspicion: "جودة الحسابات",
  network_amplification: "التضخيم الشبكي",
  link_repetition: "تكرار الروابط",
  hashtag_pattern: "نمط الهاشتاغ",
  cross_platform: "عبر المنصّات",
  narrative_consistency: "تماسك السردية",
  influencer_trigger: "تحريك المؤثّرين",
};

export default function CampaignDetailView() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [term, setTerm] = useState("");
  const [range, setRange] = useState<Range>("week");
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { demo } = useDemo();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    getTargets().then((ts) => {
      setMonitors(ts.map((t) => ({ name: t.name, keywords: t.keywords })));
      run(q || primaryKeyword(ts));   // ?q= else the pinned primary
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // re-run when the demo switch flips so the detector shows demo vs live data
  useEffect(() => { if (term) run(term); /* eslint-disable-next-line */ }, [demo]);

  const run = async (q: string) => {
    if (!q.trim()) return;
    setTerm(q); setLoading(true); setRes(null);
    const r = await apiPost("campaign", { keywords: [q], range, ...(demo ? { demo: 1 } : {}) }).catch(() => null);
    setRes(r); setLoading(false);
  };

  const a = res?.alert_level ? LV[res.alert_level.level] || LV.organic : LV.organic;

  return (
 <div>
 <h2> كشف الحملات المنظّمة</h2>
 <p className="muted">يحلّل سلوك النشر، التشابه النصّي، التزامن، جودة الحسابات، التضخيم الشبكي، وتكرار الروابط/الهاشتاغ — ويعطي درجة تنسيق احتمالية (0-100).</p>

 <div className="card" style={{ marginBottom: 14 }}>
 <div style={{ display: "flex", gap: 8 }}>
 <input placeholder="موضوع / هاشتاغ / حملة (مثال: استقالة الحكومة)" value={term}
            onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(term)} />
 <button className="btn" onClick={() => run(term)} disabled={loading}>{loading ? "جارٍ الفحص…" : " افحص"}</button>
 </div>
 <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
 <RangeSelect value={range} onChange={setRange} disabled={loading} />
          {monitors.map((m) => (
 <button key={m.name} className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }}
              onClick={() => run((m.keywords || [m.name])[0])}>{m.name}</button>
          ))}
 </div>
 </div>

      {loading && <div className="spinner" />}

      {res && !loading && (res.error ? <p className="muted">{res.message || "تعذّر الفحص."}</p> : (
 <>
 <div className="card" style={{ marginBottom: 14, textAlign: "center", borderColor: a.c + "66", background: a.bg + "22" }}>
 <div style={{ fontSize: 46, fontWeight: 800, color: a.c }}>{res.coordination_score}<span style={{ fontSize: 18 }}>/100</span></div>
 <h3 style={{ margin: "4px 0", color: a.c }}>{res.alert_level.label}</h3>
 <p className="muted" style={{ fontSize: 13 }}>سردية: <b>{res.main_narrative}</b> · {res.total_posts} منشور · {res.unique_accounts} حساب</p>
 </div>

 <div className="stat-grid" style={{ marginBottom: 14 }}>
 <div className="stat"><div className="v" style={{ color: res.duplicate_content_ratio > 0.3 ? "#f43f5e" : undefined }}>{Math.round(res.duplicate_content_ratio * 100)}%</div><div className="l">محتوى مكرّر</div></div>
 <div className="stat"><div className="v" style={{ color: res.peak_15min_post_ratio > 0.4 ? "#fb923c" : undefined }}>{Math.round(res.peak_15min_post_ratio * 100)}%</div><div className="l">ذروة 15 دقيقة</div></div>
 <div className="stat"><div className="v" style={{ color: res.suspicious_account_ratio > 0.3 ? "#f43f5e" : undefined }}>{Math.round(res.suspicious_account_ratio * 100)}%</div><div className="l">حسابات مشبوهة</div></div>
 <div className="stat"><div className="v">{res.platforms_detected?.length}</div><div className="l">منصّات</div></div>
 </div>

 <div className="cbox" style={{ marginBottom: 14 }}>
 <h4>الإشارات التسع (مع أوزانها)</h4>
            {Object.entries(res.sub_scores || {}).map(([k, v]: any) => (
 <div className="srcrow" key={k} style={{ marginBottom: 6 }}>
 <div style={{ width: 110, fontSize: 13 }}>{SIG_LABEL[k] || k} <span className="muted" style={{ fontSize: 10 }}>{Math.round((res.weights?.[k] || 0) * 100)}%</span></div>
 <div className="bar"><i style={{ width: `${v}%`, background: v >= 60 ? "#f43f5e" : v >= 35 ? "#f59e0b" : undefined }} /></div>
 <div className="num">{v}</div>
 </div>
            ))}
 </div>

 <div className="cbox" style={{ marginBottom: 14, background: a.bg }}>
 <h4> الشرح</h4>
 <p style={{ fontSize: 13, lineHeight: 1.9 }}>{res.explanation}</p>
 <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{res.disclaimer}</p>
 </div>

          {res.top_repeated_phrases?.length > 0 && (
 <div className="cbox" style={{ marginBottom: 14 }}>
 <h4> أكثر العبارات تكراراً</h4>
              {res.top_repeated_phrases.map((p: any, i: number) => (
 <div key={i} style={{ fontSize: 13, padding: "4px 0" }}><span className="chip" style={{ color: "#f59e0b" }}>×{p.count}</span> {p.text}…</div>
              ))}
 </div>
          )}

 <div className="mon-grid">
            {res.top_hashtags?.length > 0 && (
 <div className="cbox">
 <h4>أبرز الهاشتاغات</h4>
                {res.top_hashtags.slice(0, 6).map((h: any) => (
 <div className="srcrow" key={h.hashtag}><div style={{ flex: 1 }}>#{h.hashtag}</div><div className="num">{h.count}</div></div>
                ))}
 </div>
            )}
            {res.top_amplifier_accounts?.length > 0 && (
 <div className="cbox">
 <h4>أبرز المضخّمين</h4>
                {res.top_amplifier_accounts.map((m: any) => (
 <div className="srcrow" key={m.username}>
 <div style={{ flex: 1, fontSize: 13 }}><a href={`https://x.com/${m.username}`} target="_blank" rel="noopener" style={{ color: "var(--text)" }}>@{m.username}</a></div>
 <span className="muted" style={{ fontSize: 11 }}>{m.posts} منشور</span>
 </div>
                ))}
 </div>
            )}
 </div>
 </>
      ))}
 </div>
  );
}
