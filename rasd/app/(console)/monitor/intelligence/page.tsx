"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost, intelGet, intelPost } from "@/lib/api";
import Gauge from "@/components/Gauge";

const C = { neg: "#f43f5e", neu: "#8a97ad", pos: "#22c55e", warn: "#f59e0b" };
const scoreColor = (s: number, invert = false) => {
  const v = invert ? 100 - s : s;
  return v >= 66 ? C.pos : v >= 40 ? C.warn : C.neg;
};

const SCORES: { key: string; ar: string; invert?: boolean }[] = [
  { key: "reputation", ar: "السمعة" },
  { key: "political_influence", ar: "النفوذ السياسي" },
  { key: "public_trust", ar: "ثقة الجمهور" },
  { key: "media_influence", ar: "النفوذ الإعلامي" },
  { key: "narrative_dominance", ar: "هيمنة السردية" },
  { key: "political_risk", ar: "الخطر السياسي", invert: true },
  { key: "campaign_threat", ar: "تهديد الحملة", invert: true },
  { key: "crisis_escalation", ar: "تصعيد الأزمة", invert: true },
];

const EMOJIS: Record<string, string> = {
  anger: "الغضب", fear: "الخوف", trust: "الثقة", joy: "الفرح",
  sadness: "الحزن", frustration: "الإحباط", disgust: "الاشمئزاز", sarcasm: "السخرية",
};
const EMO_ORDER = ["anger", "fear", "sadness", "frustration", "disgust", "sarcasm", "trust", "joy"];
const EMO_SHORT: Record<string, string> = {
  anger: "غضب", fear: "خوف", sadness: "حزن", frustration: "إحباط",
  disgust: "اشمئزاز", sarcasm: "سخرية", trust: "ثقة", joy: "فرح",
};
const EMO_NEG = new Set(["anger", "fear", "sadness", "frustration", "disgust", "sarcasm"]);
const heatBg = (k: string, v: number) =>
  v <= 0 ? "transparent" : EMO_NEG.has(k)
    ? `rgba(244,63,94,${0.12 + v / 130})` : `rgba(34,197,94,${0.12 + v / 130})`;

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ background: "var(--input)", borderRadius: 6, height: 7, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(2, Math.min(100, value))}%`, height: "100%", background: color }} />
    </div>
  );
}

export default function Intelligence() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [term, setTerm] = useState("");
  const [stage, setStage] = useState("");
  const [twin, setTwin] = useState<any>(null);
  const [tab, setTab] = useState<"twin" | "scenario" | "ask">("twin");
  const [scenario, setScenario] = useState("official_response");
  const [sim, setSim] = useState<any>(null);
  const [q, setQ] = useState("");
  const [ans, setAns] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [digest, setDigest] = useState<any>(null);
  const [reportBusy, setReportBusy] = useState("");

  useEffect(() => { supabase.from("monitors").select("name,keywords").then(({ data }) => setMonitors(data || [])); }, []);
  useEffect(() => { intelGet("/digest").then(setDigest).catch(() => {}); }, []);
  useEffect(() => {
    const qp = new URLSearchParams(window.location.search).get("q");
    if (qp) { setTerm(qp); run(qp); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (name: string) => {
    if (!name.trim()) return;
    setTerm(name); setBusy(true); setTwin(null); setSim(null); setAns(null);
    setStage("نجمع ونخزّن المنشورات…");
    const ing = await apiPost("ingest", { keywords: [name], range: "week" }).catch(() => null);
    const eid = ing?.entity_id;
    if (!eid) { setStage("تعذّر بناء الملف."); setBusy(false); return; }
    setStage("نبني التوأم الرقمي…");
    const t = await intelGet(`/twin/${encodeURIComponent(eid)}`).catch(() => null);
    setTwin(t ? { ...t, _eid: eid } : null);
    setStage(""); setBusy(false);
  };

  const runScenario = async () => {
    if (!twin?._eid) return;
    setSim({ loading: true });
    const r = await intelPost("/scenario", { entity_id: twin._eid, scenario }).catch(() => null);
    setSim(r);
  };

  const ask = async () => {
    if (!q.trim() || !twin?._eid) return;
    setAns({ loading: true });
    const r = await intelPost("/ask", { question: q, entity_id: twin._eid }).catch(() => null);
    setAns(r);
  };

  const downloadReport = async (format: "docx" | "pptx" | "pdf") => {
    const name = twin?.identity?.name;
    if (!name) return;
    setReportBusy(format);
    try {
      let res: any = await intelPost("/report", { kind: "profile", target: name, range: "week", format });
      if (res?.job_id) {
        for (let i = 0; i < 50; i++) {
          await new Promise((s) => setTimeout(s, 4000));
          res = await intelGet(`/job/${res.job_id}`);
          if (res?.status === "done" || res?.status === "failed") break;
        }
      }
      const b64 = res?.file_base64 || res?.pdf_base64;
      if (!b64) { alert("تعذّر توليد التقرير حالياً."); return; }
      const mime = format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : format === "pptx" ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          : "application/pdf";
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      const a = document.createElement("a");
      a.href = url; a.download = `تقرير-${name}.${format}`; a.click();
      URL.revokeObjectURL(url);
    } finally { setReportBusy(""); }
  };

  const sc = twin?.scores || {};
  const pred = twin?.prediction || {};

  return (
    <div>
      <h2>التوأم الرقمي — مركز الاستخبارات</h2>
      <p className="muted">ملف استخباراتي مركزي لكل كيان: المؤشرات الاستراتيجية الثمانية، السرديات، التنبؤ،
        المشاعر، محاكاة السيناريوهات، ومساعد ذكي يجيب من بيانات المنصّة فقط.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="شخصية / جهة (مثال: محمد شياع السوداني)" value={term}
            onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(term)} />
          <button className="btn" onClick={() => run(term)} disabled={busy}>{busy ? "…" : "ابنِ الملف"}</button>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {monitors.map((m) => (
            <button key={m.name} className="btn ghost" style={{ padding: "3px 10px", fontSize: 12 }}
              onClick={() => run((m.keywords || [m.name])[0])}>{m.name}</button>
          ))}
        </div>
      </div>

      {!twin && !busy && digest?.entities?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>
            نظرة استخباراتية جاهزة · {digest.count} كيان · آخر تحديث منذ {Math.round((digest.age_seconds || 0) / 60)} دقيقة
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="card">
              <b>الأعلى خطراً الآن</b>
              {(digest.top_risk || []).map((e: any) => (
                <div key={e.id} onClick={() => run(e.name)} style={{ cursor: "pointer", margin: "7px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span>{e.name} <span className="muted">{e.crisis_stage || ""}</span></span>
                    <b style={{ color: scoreColor(e.risk, true) }}>{e.risk}</b>
                  </div>
                  <Bar value={e.risk} color={scoreColor(e.risk, true)} />
                </div>
              ))}
            </div>
            <div className="card">
              <b>أكبر التحرّكات</b>
              {(digest.movers || []).map((e: any) => (
                <div key={e.id} onClick={() => run(e.name)}
                  style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: 13, margin: "7px 0" }}>
                  <span>{e.name}</span>
                  <span className="muted">الخطر <b style={{ color: (e.risk_delta || 0) <= 0 ? C.pos : C.neg }}>
                    {e.risk_delta > 0 ? "+" : ""}{e.risk_delta}</b> · السمعة <b style={{ color: (e.rep_delta || 0) >= 0 ? C.pos : C.neg }}>
                    {e.rep_delta > 0 ? "+" : ""}{e.rep_delta}</b></span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <div className="card"><b>الترندات الآن</b>
              <div style={{ marginTop: 6 }}>
                {(digest.trending || []).map((t: any, i: number) => (
                  <span key={i} className="btn ghost" style={{ padding: "3px 8px", fontSize: 12, margin: 2, display: "inline-block" }}>{t.hashtag || t}</span>
                ))}
                {!digest.trending?.length && <span className="muted">—</span>}
              </div>
            </div>
            <div className="card"><b>حملات مشتبهة نشطة</b>
              <div style={{ marginTop: 6 }}>
                {(digest.active_campaigns || []).map((c: any, i: number) => (
                  <div key={i} style={{ fontSize: 13, margin: "4px 0" }}>{c.hashtag} <b style={{ color: C.warn }}>{c.coordination_score}</b></div>
                ))}
                {!digest.active_campaigns?.length && <span className="muted">—</span>}
              </div>
            </div>
          </div>
          {digest.rising_narratives?.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <b>السرديات الصاعدة وطنياً</b>
              {(digest.rising_narratives || []).map((n: any, i: number) => (
                <div key={i} style={{ margin: "7px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span>{n.narrative} <span className="muted">({(n.entities || []).join("، ")})</span></span>
                    <b style={{ color: n.national_trend_probability >= 0.5 ? C.warn : C.neu }}>
                      {Math.round((n.national_trend_probability || 0) * 100)}% وطني</b>
                  </div>
                  <Bar value={Math.min(100, n.posts)} color={n.neg_ratio > 0.5 ? C.neg : "#4f9dff"} />
                </div>
              ))}
            </div>
          )}
          {digest.emotion_heatmap?.length > 0 && (
            <div className="card" style={{ marginTop: 12, overflowX: "auto" }}>
              <b>خريطة المشاعر الحرارية</b>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginTop: 8 }}>
                <thead><tr>
                  <th style={{ textAlign: "start" }}></th>
                  {EMO_ORDER.map((k) => <th key={k} style={{ padding: "2px 4px", fontWeight: 600 }}>{EMO_SHORT[k]}</th>)}
                </tr></thead>
                <tbody>
                  {digest.emotion_heatmap.map((row: any, i: number) => (
                    <tr key={i}>
                      <td style={{ padding: "3px 6px", whiteSpace: "nowrap", cursor: "pointer" }} onClick={() => run(row.entity)}>{row.entity}</td>
                      {EMO_ORDER.map((k) => {
                        const v = row.emotions?.[k] || 0;
                        return <td key={k} title={`${EMO_SHORT[k]}: ${v}%`}
                          style={{ textAlign: "center", padding: "3px 0", background: heatBg(k, v), borderRadius: 4, color: v > 40 ? "#fff" : "var(--muted)" }}>{v || ""}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>أحمر = مشاعر سلبية · أخضر = إيجابية · الرقم نسبة الحضور</p>
            </div>
          )}
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>تُحدّث تلقائياً كل ٣ ساعات · اضغط أي كيان لفتح ملفه الكامل</p>
        </div>
      )}

      {busy && <p className="muted">{stage} <span className="spinner" /></p>}

      {twin && !busy && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: "1px solid var(--line)" }}>
            {([["twin", "الملف"], ["scenario", "محاكي السيناريوهات"], ["ask", "المساعد الذكي"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className="btn ghost"
                style={{ borderRadius: 0, borderBottom: tab === k ? "2px solid var(--accent)" : "2px solid transparent", color: tab === k ? "var(--text)" : "var(--muted)" }}>{l}</button>
            ))}
          </div>

          {tab === "twin" && (
            <>
              {/* profile hero */}
              <div className="mon-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
                <div>
                  <div className="cc-live"><span className="cc-dot" /> ملف استخباراتي حيّ</div>
                  <h2 style={{ margin: "6px 0 4px", fontSize: 26 }}>{twin.identity?.name}</h2>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {{ politician: "سياسي", party: "حزب", ministry: "وزارة", coalition: "تحالف",
                       body: "جهة", institution: "مؤسسة" }[twin.identity?.type as string] || "كيان"}
                    {" · "}{twin.data_points} نقطة بيانات · {twin.media_exposure?.sources} مصدر · المسار: {pred.trajectory || "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 18 }}>
                  <Gauge value={sc.reputation?.score ?? 0} label="السمعة" size={92} />
                  <Gauge value={sc.political_influence?.score ?? 0} label="النفوذ" size={92} />
                  <Gauge value={sc.political_risk?.score ?? 0} label="الخطر" size={92} invert />
                </div>
              </div>

              {/* report download toolbar */}
              <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                <b style={{ fontSize: 13 }}>تصدير تقرير احترافي:</b>
                <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 13 }}
                  onClick={() => downloadReport("docx")} disabled={!!reportBusy}>
                  {reportBusy === "docx" ? "جارٍ التوليد…" : "Word ⬇"}</button>
                <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 13 }}
                  onClick={() => downloadReport("pptx")} disabled={!!reportBusy}>
                  {reportBusy === "pptx" ? "جارٍ التوليد…" : "PowerPoint ⬇"}</button>
                <span className="muted" style={{ fontSize: 11 }}>يُولّد على الخادم (~٣٠ ثانية) ويُنزّل تلقائياً.</span>
              </div>

              {/* 8 strategic scores — animated gauges */}
              <div className="grid" style={{ marginBottom: 14 }}>
                {SCORES.map(({ key, ar, invert }) => {
                  const o = sc[key] || {}; const v = o.score ?? 0;
                  return (
                    <div className="card" key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingTop: 18 }}>
                      <Gauge value={v} size={92} invert={invert} />
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{ar}</div>
                      <div className="muted" style={{ fontSize: 11, minHeight: 14, textAlign: "center" }}>
                        {o.grade || o.level || o.stage || o.leader || ""}</div>
                    </div>
                  );
                })}
              </div>

              {/* prediction + emotion */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div className="card">
                  <b>التنبؤ بالاتجاه</b>
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    المسار: <b>{pred.trajectory || "—"}</b><br />
                    احتمال ترند وطني: <b style={{ color: scoreColor((pred.national_trend_probability || 0) * 100) }}>
                      {Math.round((pred.national_trend_probability || 0) * 100)}%</b> ({pred.national_trend})<br />
                    الزخم: {pred.momentum ?? "—"} · السرعة: {pred.velocity ?? "—"}
                  </div>
                </div>
                <div className="card">
                  <b>البصمة العاطفية</b>
                  <div style={{ marginTop: 6 }}>
                    {Object.entries(twin.emotion_profile || {}).filter(([, v]) => (v as number) > 0)
                      .sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0", fontSize: 12 }}>
                          <span style={{ width: 70 }}>{EMOJIS[k] || k}</span>
                          <div style={{ flex: 1 }}><Bar value={v as number} color={"#4f9dff"} /></div>
                          <span className="muted">{v as number}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* narratives */}
              <div className="card">
                <b>السرديات المهيمنة</b>
                {(twin.narratives || []).slice(0, 6).map((n: any, i: number) => (
                  <div key={i} style={{ margin: "8px 0", fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{n.narrative} <span className="muted">({n.keywords?.slice(0, 3).join("، ")})</span></span>
                      <b style={{ color: n.neg_ratio > 0.5 ? C.neg : C.neu }}>{n.share}%</b>
                    </div>
                    <Bar value={n.share} color={n.neg_ratio > 0.5 ? C.neg : "#4f9dff"} />
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "scenario" && (
            <div className="card">
              <b>محاكي السيناريوهات الاستراتيجية</b>
              <p className="muted" style={{ fontSize: 12 }}>قدّر رد الفعل الإعلامي المرجّح لقرارٍ ما بناءً على أنماط تاريخية.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
                <select value={scenario} onChange={(e) => setScenario(e.target.value)}
                  style={{ background: "var(--input)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
                  <option value="official_response">إصدار بيان/رد رسمي</option>
                  <option value="no_response">الصمت / عدم الرد</option>
                  <option value="delete_post">حذف منشور مثير للجدل</option>
                  <option value="counter_campaign">إطلاق حملة مضادة</option>
                  <option value="ally_statement">تدخّل حليف مؤثّر</option>
                </select>
                <button className="btn" onClick={runScenario}>حاكِ</button>
              </div>
              {sim?.loading && <span className="spinner" />}
              {sim && !sim.loading && !sim.error && (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                    {[["الخطر", "risk"], ["التصعيد", "escalation"], ["السمعة", "reputation"]].map(([l, k]) => (
                      <div key={k} className="card" style={{ flex: 1, minWidth: 120 }}>
                        <div className="muted" style={{ fontSize: 12 }}>{l}</div>
                        <div>{sim.baseline?.[k]} → <b>{sim.projected?.[k]}</b>
                          <span style={{ color: (sim.deltas?.[k] || 0) <= 0 ? C.pos : C.neg, fontSize: 12 }}>
                            {" "}({sim.deltas?.[k] > 0 ? "+" : ""}{sim.deltas?.[k] ?? 0})</span></div>
                      </div>
                    ))}
                  </div>
                  <p>{sim.rationale}</p>
                  <p className="muted" style={{ fontSize: 11 }}>الثقة: {Math.round((sim.probability || 0) * 100)}% · {sim.disclaimer}</p>
                </div>
              )}
            </div>
          )}

          {tab === "ask" && (
            <div className="card">
              <b>المساعد الذكي (مقيّد ببيانات المنصّة)</b>
              <p className="muted" style={{ fontSize: 12 }}>أمثلة: لماذا أصبحت النبرة سلبية؟ من أبرز المصادر؟ ما أبرز السرديات؟</p>
              <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
                <input placeholder="اسأل عن هذا الكيان…" value={q}
                  onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
                <button className="btn" onClick={ask}>اسأل</button>
              </div>
              {ans?.loading && <span className="spinner" />}
              {ans && !ans.loading && (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <p>{ans.answer}</p>
                  <p className="muted" style={{ fontSize: 11 }}>
                    {ans.grounded ? `مستند إلى ${ans.evidence_count ?? 0} دليل مخزّن` : ""}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
