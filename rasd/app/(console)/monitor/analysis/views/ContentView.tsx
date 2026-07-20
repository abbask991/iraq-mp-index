"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/api";
import { getTargets, primaryKeyword } from "@/lib/targets";
import RangeSelect, { Range } from "@/components/RangeSelect";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

const C = { neg: "#f43f5e", neu: "#8a97ad", pos: "#22c55e" };
const sColor = (s: string) => (s === "سلبي" ? C.neg : s === "إيجابي" ? C.pos : C.neu);
const leanColor = (l: number) => (l >= 20 ? C.pos : l <= -20 ? C.neg : C.neu);

export default function ContentView() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [term, setTerm] = useState("");
  const [range, setRange] = useState<Range>("week");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTargets().then((ts) => {
      setMonitors(ts.map((t) => ({ name: t.name, keywords: t.keywords })));
      run(primaryKeyword(ts));   // open on the pinned primary target
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (q: string) => {
    if (!q.trim()) return;
    setTerm(q); setLoading(true); setD(null);
    const r = await apiPost("content", { keywords: [q], range }).catch(() => null);
    setD(r); setLoading(false);
  };

  const s = d?.sentiment || { pos: 0, neg: 0, neu: 0 };
  const idxC = d?.media_index >= 60 ? C.pos : d?.media_index <= 40 ? C.neg : "#f59e0b";
  const maxTheme = Math.max(1, ...(d?.themes || []).map((t: any) => t.count));
  const maxTerm = Math.max(1, ...(d?.key_terms || []).map((t: any) => t.count));

  return (
    <div>
      <h2>تحليل المحتوى الإعلامي</h2>
      <p className="muted">تحليل احترافي للتغطية: السرديات والأُطر، النبرة، الرسائل الرئيسية، انحياز المصادر، والمصطلحات المفتاحية.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="موضوع / شخص / قضية (مثال: محمد السوداني)" value={term}
            onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(term)} />
          <button className="btn" onClick={() => run(term)} disabled={loading}>{loading ? "جارٍ التحليل…" : "حلّل"}</button>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <RangeSelect value={range} onChange={setRange} disabled={loading} />
          {monitors.map((m) => (
            <button key={m.name} className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }}
              onClick={() => run((m.keywords || [m.name])[0])}>{m.name}</button>
          ))}
        </div>
      </div>

      {loading && <SkelCards count={4} />}

      {d && !loading && (!d.total ? <EmptyState title="لا محتوى كافٍ لهذا الهدف" subtitle={d.message || "جرّب نطاقاً زمنياً أوسع أو هدفاً مختلفاً."} /> : (
        <>
          {/* editorial brief */}
          {d.brief && (
            <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid var(--accent)" }}>
              <h4>الموجز التحريري</h4>
              <p style={{ fontSize: 14, lineHeight: 2 }}>{d.brief}</p>
              <div className="muted" style={{ fontSize: 11 }}>تحليل {d.total} منشور ({d.news} خبر · {d.x} تغريدة)</div>
            </div>
          )}

          <div className="stat-grid" style={{ marginBottom: 14 }}>
            <div className="stat"><div className="v" style={{ color: idxC }}>{d.media_index}</div><div className="l">المؤشّر الإعلامي</div></div>
            <div className="stat"><div className="v" style={{ color: C.pos }}>{s.pos}</div><div className="l">إيجابي</div></div>
            <div className="stat"><div className="v" style={{ color: C.neu }}>{s.neu}</div><div className="l">محايد</div></div>
            <div className="stat"><div className="v" style={{ color: C.neg }}>{s.neg}</div><div className="l">سلبي</div></div>
          </div>

          {/* stance / position analysis */}
          {d.stance && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>تحليل المواقف (مؤيد / معارض / ساخر)</h4>
              <div style={{ display: "flex", height: 18, borderRadius: 6, overflow: "hidden", margin: "8px 0" }}>
                <div style={{ width: `${d.stance.pct.support}%`, background: "#22c55e" }} title={`مؤيد ${d.stance.pct.support}%`} />
                <div style={{ width: `${d.stance.pct.neutral}%`, background: "#8a97ad" }} title={`محايد ${d.stance.pct.neutral}%`} />
                <div style={{ width: `${d.stance.pct.sarcastic}%`, background: "#a855f7" }} title={`ساخر ${d.stance.pct.sarcastic}%`} />
                <div style={{ width: `${d.stance.pct.oppose}%`, background: "#f43f5e" }} title={`معارض ${d.stance.pct.oppose}%`} />
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12 }}>
                <span><span style={{ color: "#22c55e" }}>■</span> مؤيد {d.stance.pct.support}%</span>
                <span><span style={{ color: "#f43f5e" }}>■</span> معارض {d.stance.pct.oppose}%</span>
                <span><span style={{ color: "#a855f7" }}>■</span> ساخر {d.stance.pct.sarcastic}%</span>
                <span><span style={{ color: "#8a97ad" }}>■</span> محايد {d.stance.pct.neutral}%</span>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                صافي الموقف:{" "}
                <b style={{ color: d.stance.net >= 0 ? "#22c55e" : "#f43f5e" }}>{d.stance.net > 0 ? "+" : ""}{d.stance.net}</b>
                {" — "}الغالب:{" "}
                <b>{({ support: "مؤيد", oppose: "معارض", sarcastic: "ساخر", neutral: "محايد" } as any)[d.stance.dominant]}</b>.
                {" "}{d.stance.explain}
              </div>
            </div>
          )}

          {/* narratives — the core content analysis */}
          {(d.narratives || []).length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>السرديات المهيمنة</h4>
              {d.narratives.map((n: any, i: number) => (
                <div key={i} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <b style={{ fontSize: 14 }}>{n.label} <span className="chip" style={{ color: sColor(n.sentiment), fontSize: 11 }}>{n.sentiment}</span></b>
                    <b style={{ color: "var(--accent)" }}>{n.share}%</b>
                  </div>
                  <div className="bar" style={{ height: 6, margin: "6px 0" }}><i style={{ width: `${n.share}%`, background: sColor(n.sentiment) }} /></div>
                  <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.8 }}>{n.description}</div>
                </div>
              ))}
            </div>
          )}

          <div className="cc-grid">
            {/* tone + frames */}
            <div className="cbox">
              <h4>النبرة والأُطر</h4>
              {d.tone?.label && (
                <div style={{ marginBottom: 10 }}>
                  <span className="chip" style={{ color: "var(--accent2)" }}>النبرة: {d.tone.label}</span>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.8 }}>{d.tone.description}</div>
                </div>
              )}
              {(d.frames || []).map((f: any, i: number) => (
                <div key={i} style={{ padding: "6px 0", borderTop: "1px solid var(--line)", fontSize: 13 }}>
                  <b>{f.label}</b> <span className="muted">— {f.description}</span>
                </div>
              ))}
            </div>

            {/* key messages */}
            <div className="cbox">
              <h4>الرسائل والادعاءات الرئيسية</h4>
              <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 2, fontSize: 13.5 }}>
                {(d.key_messages || []).map((m: string, i: number) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          </div>

          {/* source bias */}
          <div className="cbox" style={{ marginTop: 14 }}>
            <h4>انحياز المصادر (نبرة كل مصدر تجاه الموضوع)</h4>
            {(d.sources || []).map((src: any) => (
              <div className="srcrow" key={src.source} style={{ marginBottom: 6 }}>
                <div style={{ width: 140, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src.source}</div>
                <div style={{ flex: 1, display: "flex", height: 14, borderRadius: 4, overflow: "hidden", background: "var(--hover)" }}>
                  <div style={{ width: `${(src.neg / src.total) * 100}%`, background: C.neg }} />
                  <div style={{ width: `${(src.neu / src.total) * 100}%`, background: C.neu }} />
                  <div style={{ width: `${(src.pos / src.total) * 100}%`, background: C.pos }} />
                </div>
                <div style={{ width: 50, textAlign: "left", fontSize: 12, color: leanColor(src.lean), fontWeight: 700 }}>
                  {src.lean > 0 ? "+" : ""}{src.lean}
                </div>
              </div>
            ))}
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>أحمر سلبي · رمادي محايد · أخضر إيجابي · الرقم = صافي الميل.</div>
          </div>

          <div className="cc-grid">
            {/* themes */}
            <div className="cbox">
              <h4>المحاور/القضايا</h4>
              {(d.themes || []).map((t: any) => (
                <div className="srcrow" key={t.label} style={{ marginBottom: 6 }}>
                  <div style={{ width: 120, fontSize: 12.5 }}>{t.label}</div>
                  <div className="bar"><i style={{ width: `${(t.count / maxTheme) * 100}%` }} /></div>
                  <div className="num">{t.count}</div>
                </div>
              ))}
            </div>

            {/* key terms cloud */}
            <div className="cbox">
              <h4>المصطلحات المفتاحية</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {(d.key_terms || []).map((t: any) => (
                  <span key={t.term} style={{ fontSize: 11 + Math.round((t.count / maxTerm) * 13), color: "var(--text)", opacity: 0.6 + 0.4 * (t.count / maxTerm), fontWeight: 600 }}>{t.term}</span>
                ))}
              </div>
            </div>
          </div>

          <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>
            * تحليل بمساعدة الذكاء الاصطناعي (Claude Sonnet) — يحتاج مراجعة بشرية للقرارات الحسّاسة.
          </p>
        </>
      ))}
    </div>
  );
}
