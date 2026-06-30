"use client";
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";
import Gauge from "@/components/Gauge";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import EvidenceExplorer from "@/components/EvidenceExplorer";

const appColor = (v: number) => (v >= 60 ? "#22c55e" : v >= 40 ? "#f59e0b" : "#f43f5e");
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

function Kpi({ label, value, sub, color }: { label: string; value: any; sub?: string; color?: string }) {
  return (
    <div style={{ flex: "1 1 130px", minWidth: 120, textAlign: "center", padding: "14px 8px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--input)" }}>
      <div style={{ fontSize: 30, fontWeight: 900, color: color || "var(--text)", lineHeight: 1.1 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{label}</div>
      {sub && <div className="muted" style={{ fontSize: 10.5, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// the signature insight: likes lie, comments reveal. shows the gap between the two.
function GapCard({ d }: { d: any }) {
  const ra = d.reaction_approval ?? 0;
  const ca = d.comment_approval ?? d.comment_sentiment?.approval ?? null;
  if (ca == null) return null;
  const gap = ra - ca;
  const danger = gap >= 25;
  return (
    <div className="cbox" style={{ marginBottom: 14, borderInlineStart: `4px solid ${danger ? "#f43f5e" : "#22c55e"}` }}>
      <h4 style={{ margin: "0 0 8px" }}>🎭 فجوة التأييد — اللايكات مقابل التعليقات</h4>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 200px" }}>
          {[["👍 تأييد التفاعلات (اللايكات)", ra, "#22c55e"], ["💬 تأييد التعليقات (النص الفعلي)", ca, "#3b82f6"]].map(([l, v, c]: any) => (
            <div key={l} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}><span>{l}</span><b>{v}%</b></div>
              <span style={{ display: "block", height: 10, borderRadius: 999, background: "var(--input)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${v}%`, background: c }} />
              </span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", minWidth: 130 }}>
          <div style={{ fontSize: 34, fontWeight: 900, color: danger ? "#f43f5e" : "#f59e0b" }}>{gap > 0 ? "−" : "+"}{Math.abs(gap)}<span style={{ fontSize: 18 }}>pts</span></div>
          <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
            {danger ? "تحذير: تأييد ظاهري مضلّل — اللايكات تخفي رفضاً كبيراً بالتعليقات" : "اللايكات والتعليقات متقاربة — الاستقبال صادق"}
          </div>
        </div>
      </div>
    </div>
  );
}

function Bar({ p }: { p: any }) {
  return (
    <span style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--input)", overflow: "hidden", display: "flex" }}>
      <span style={{ width: `${p.approval ?? 50}%`, background: "#22c55e" }} />
      <span style={{ width: `${p.rejection ?? 50}%`, background: "#f43f5e" }} />
    </span>
  );
}

const sentColor = (s: string) => (/إيجاب/.test(s || "") ? "#22c55e" : /سلب|رفض/.test(s || "") ? "#f43f5e" : "#f59e0b");

// the real product: what the public is actually saying, about whom, and what they want
function Insights({ ins }: { ins: any }) {
  if (!ins || ins.insufficient) return null;
  const has = (k: string) => Array.isArray(ins[k]) && ins[k].length > 0;
  if (!has("topics") && !has("entities") && !has("grievances") && !has("takeaways")) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>🔬 تحليل عميق — ماذا يقول الجمهور فعلاً <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>({ins.analyzed_comments} تعليق)</span></h3>

      {has("takeaways") && (
        <div className="cbox" style={{ marginBottom: 12, borderInlineStart: "4px solid #6366f1", background: "color-mix(in srgb, #6366f1 7%, var(--card))" }}>
          <h4 style={{ margin: "0 0 6px" }}>🎯 خلاصات قابلة للتنفيذ</h4>
          {ins.takeaways.map((t: string, i: number) => (
            <div key={i} style={{ fontSize: 13.5, lineHeight: 1.85, padding: "4px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>▸ {t}</div>
          ))}
        </div>
      )}

      {has("topics") && (
        <div className="cbox" style={{ marginBottom: 12 }}>
          <h4>📌 القضايا التي تشغل الجمهور</h4>
          {ins.topics.map((t: any, i: number) => (
            <div key={i} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <b style={{ fontSize: 14 }}>{t.name}</b>
                {t.share != null && <span className="chip" style={{ fontSize: 11 }}>{typeof t.share === "number" ? t.share + "%" : t.share}</span>}
                <span className="chip" style={{ fontSize: 11, color: sentColor(t.sentiment) }}>● {t.sentiment}</span>
              </div>
              {t.summary && <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.8 }}>{t.summary}</div>}
              {t.sample && <div className="muted" style={{ fontSize: 11.5, marginTop: 3, fontStyle: "italic" }}>«{t.sample}»</div>}
            </div>
          ))}
        </div>
      )}

      {has("entities") && (
        <div className="cbox" style={{ marginBottom: 12 }}>
          <h4>👥 الشخصيات والجهات في حديث الناس</h4>
          {ins.entities.map((e: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
              <span className="chip" style={{ fontSize: 11, color: sentColor(e.stance), minWidth: 52, textAlign: "center" }}>{e.stance}</span>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 13.5 }}>{e.name}</b> <span className="muted" style={{ fontSize: 11 }}>· {e.type}{e.mentions ? ` · ${e.mentions} ذكر` : ""}</span>
                {e.note && <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.7 }}>{e.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {(has("grievances") || has("demands")) && (
        <div className="grid" style={{ marginBottom: 12 }}>
          {has("grievances") && (
            <div className="cbox">
              <h4 style={{ color: "#f43f5e" }}>😡 أبرز الشكاوى</h4>
              {ins.grievances.map((g: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "4px 0", lineHeight: 1.7 }}>• {g}</div>)}
            </div>
          )}
          {has("demands") && (
            <div className="cbox">
              <h4 style={{ color: "#22c55e" }}>✊ أبرز المطالب</h4>
              {ins.demands.map((g: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "4px 0", lineHeight: 1.7 }}>• {g}</div>)}
            </div>
          )}
        </div>
      )}

      {(has("accusations") || has("praise")) && (
        <div className="grid" style={{ marginBottom: 12 }}>
          {has("accusations") && (
            <div className="cbox"><h4 style={{ color: "#f43f5e" }}>⚠️ أبرز الاتهامات</h4>
              {ins.accusations.map((g: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "4px 0", lineHeight: 1.7 }}>• {g}</div>)}</div>
          )}
          {has("praise") && (
            <div className="cbox"><h4 style={{ color: "#22c55e" }}>👍 أبرز المديح</h4>
              {ins.praise.map((g: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "4px 0", lineHeight: 1.7 }}>• {g}</div>)}</div>
          )}
        </div>
      )}

      {has("talking_points") && (
        <div className="cbox" style={{ marginBottom: 12 }}>
          <h4>🔁 رسائل متكررة <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>(قد تدل على تنسيق — مراجعة بشرية)</span></h4>
          {ins.talking_points.map((t: any, i: number) => (
            <div key={i} style={{ fontSize: 13, padding: "5px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
              <b>{t.point}</b> {t.repetition && <span className="chip" style={{ fontSize: 10.5 }}>تكرار {t.repetition}</span>}
              {t.note && <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t.note}</div>}
            </div>
          ))}
        </div>
      )}

      {has("notable_quotes") && (
        <div className="cbox" style={{ marginBottom: 12 }}>
          <h4>💬 اقتباسات بارزة</h4>
          {ins.notable_quotes.map((q: any, i: number) => (
            <div key={i} style={{ fontSize: 13, padding: "6px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
              <span style={{ color: sentColor(q.sentiment), fontWeight: 700 }}>● </span>«{q.text}»
              {q.why && <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{q.why}</div>}
            </div>
          ))}
        </div>
      )}

      {ins.audience && (ins.audience.supporters_care_about?.length > 0 || ins.audience.critics_care_about?.length > 0) && (
        <div className="grid" style={{ marginBottom: 12 }}>
          {ins.audience.supporters_care_about?.length > 0 && (
            <div className="cbox"><h4 style={{ color: "#22c55e" }}>🟢 ما يهمّ المؤيدين</h4>
              {ins.audience.supporters_care_about.map((x: string, i: number) => <div key={i} style={{ fontSize: 12.5, padding: "3px 0" }}>• {x}</div>)}</div>
          )}
          {ins.audience.critics_care_about?.length > 0 && (
            <div className="cbox"><h4 style={{ color: "#f43f5e" }}>🔴 ما يهمّ المنتقدين</h4>
              {ins.audience.critics_care_about.map((x: string, i: number) => <div key={i} style={{ fontSize: 12.5, padding: "3px 0" }}>• {x}</div>)}</div>
          )}
        </div>
      )}
    </div>
  );
}

// §1 Comment Intelligence (the no-AI signals always render; semantic parts via Insights)
function CommentIntel({ ci }: { ci: any }) {
  if (!ci) return null;
  const p = ci.pressure || {};
  return (
    <div className="cbox" style={{ marginBottom: 14 }}>
      <h4>🧩 ذكاء التعليقات <span className="muted" style={{ fontSize: 11, fontWeight: 400 }}>({fmt(ci.total_comments)} تعليق · {fmt(ci.clusters)} مجموعة بعد إزالة التكرار)</span></h4>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <Kpi label="ضغط الجمهور" value={p.score ?? "—"} color={p.score >= 60 ? "#f43f5e" : p.score >= 35 ? "#f59e0b" : "#22c55e"} sub="حجم + تكرار + غضب" />
        <Kpi label="نسبة التكرار" value={p.repetition_ratio != null ? Math.round(p.repetition_ratio * 100) + "%" : "—"} sub="تعليقات مكرّرة" />
        <Kpi label="إشارات غضب" value={fmt(p.anger_hits)} color="#f43f5e" sub="بمعجم لغوي (تقريبي)" />
      </div>
      {ci.repeated_phrases?.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>🔁 عبارات متكرّرة (قد تدل على تنسيق — مراجعة بشرية):</div>
          {ci.repeated_phrases.map((r: any, i: number) => (
            <div key={i} style={{ fontSize: 12.5, padding: "3px 0" }}><span className="chip" style={{ fontSize: 10.5 }}>×{r.count}</span> {r.phrase}</div>
          ))}
        </div>
      )}
      {ci.keyword_phrases?.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ci.keyword_phrases.map((k: any, i: number) => (
            <span key={i} className="chip" style={{ fontSize: 11 }}>{k.phrase} <span className="muted">{k.count}</span></span>
          ))}
        </div>
      )}
    </div>
  );
}

// §2 Comment-Reaction Gap — the signature "are the reactions misleading?" card
function GapV2({ g }: { g: any }) {
  if (!g) return null;
  if (!g.available) {
    return (
      <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #8a97ad" }}>
        <h4 style={{ margin: "0 0 4px" }}>🎭 فجوة التفاعل/التعليق</h4>
        <div style={{ fontSize: 13 }}>التفاعلات: <b style={{ color: appColor(g.reaction_mood ?? 0) }}>{g.reaction_mood ?? "—"}%</b></div>
        <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{g.note}</p>
      </div>
    );
  }
  const danger = g.misleading;
  return (
    <div className="cbox" style={{ marginBottom: 14, borderInlineStart: `4px solid ${danger ? "#f43f5e" : "#22c55e"}` }}>
      <h4 style={{ margin: "0 0 8px" }}>🎭 فجوة التفاعل/التعليق — هل التفاعلات مضلّلة؟ <span className="chip" style={{ fontSize: 10.5 }}>{g.level}</span></h4>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 220px" }}>
          {[["👍 مزاج التفاعلات", g.reaction_mood, "#22c55e"], ["💬 مزاج التعليقات", g.comment_mood, "#3b82f6"]].map(([l, v, c]: any) => (
            <div key={l} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}><span>{l}</span><b>{v}%</b></div>
              <span style={{ display: "block", height: 10, borderRadius: 999, background: "var(--input)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${v}%`, background: c }} /></span>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", minWidth: 120 }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: danger ? "#f43f5e" : "#f59e0b" }}>{g.gap_score}<span style={{ fontSize: 16 }}>pts</span></div>
          <div className="muted" style={{ fontSize: 11 }}>درجة الفجوة</div>
        </div>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.8, marginTop: 8 }}>{g.explanation}</p>
      {g.evidence_comments?.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div className="muted" style={{ fontSize: 11.5, marginBottom: 3 }}>أدلّة (تعليقات سلبية):</div>
          {g.evidence_comments.map((c: any, i: number) => <div key={i} style={{ fontSize: 12.5, padding: "2px 0", color: "#f43f5e" }}>● {c.text}</div>)}
        </div>
      )}
    </div>
  );
}

// §3 Facebook Audience Mood Index (AI — populates when credits available)
function AudienceMood({ ins }: { ins: any }) {
  const am = ins?.audience_mood;
  if (!am || Object.keys(am).length === 0) return null;
  const dims: [string, string][] = [["anger", "غضب"], ["sarcasm", "سخرية"], ["frustration", "إحباط"], ["support", "تأييد"], ["fear", "خوف"], ["sympathy", "تعاطف"], ["trust", "ثقة"]];
  const colorOf = (k: string) => (["anger", "frustration", "fear"].includes(k) ? "#f43f5e" : ["support", "trust"].includes(k) ? "#22c55e" : "#f59e0b");
  return (
    <div className="cbox" style={{ marginBottom: 14 }}>
      <h4>🌡️ مؤشّر مزاج الجمهور {ins.mood_index != null && <span style={{ color: appColor(ins.mood_index) }}>· {ins.mood_index}/100</span>}</h4>
      {dims.filter(([k]) => am[k] != null).map(([k, label]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
          <span style={{ width: 56, fontSize: 12.5 }}>{label}</span>
          <span style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--input)", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${am[k]}%`, background: colorOf(k) }} /></span>
          <span style={{ minWidth: 34, textAlign: "left", fontSize: 12 }}>{am[k]}</span>
        </div>
      ))}
    </div>
  );
}

function useFb(path: string, demo: boolean) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); apiGet(path + (path.includes("?") ? "&" : "?") + (demo ? "demo=1" : "")).then(setD).finally(() => setLoading(false)); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [demo]);
  return { d, loading, load };
}

const PLAT_EMOJI: Record<string, string> = { facebook: "📘", x: "✖️", telegram: "✈️", news: "📰", tiktok: "🎵", instagram: "📷" };

function ViralView({ demo }: { demo: boolean }) {
  const { d, loading, load } = useFb("/api/facebook/viral-posts", demo);
  if (loading) return <SkelCards count={3} />;
  const posts = d?.viral_posts || [];
  if (!posts.length) return <EmptyState title="لا منشورات" subtitle={demo ? "" : "فعّل وضع العرض أو انتظر جمع البيانات"} action={{ label: "إعادة", onClick: load }} />;
  return (
    <>
      <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>أكثر المنشورات انتشاراً مع تفسير سبب الانتشار + مزاج التعليقات + درجة الخطر.</p>
      {posts.map((p: any, i: number) => (
        <div key={i} className="cbox" style={{ marginBottom: 12, borderInlineStart: `4px solid ${p.risk?.score >= 50 ? "#f43f5e" : p.risk?.score >= 30 ? "#f59e0b" : "#22c55e"}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{p.text}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11.5, marginBottom: 6 }}>
            <span className="chip">{p.page}</span>
            <span className="chip">👍 {fmt(p.reactions)}</span><span className="chip">💬 {fmt(p.comments)}</span><span className="chip">🔁 {fmt(p.shares)}</span>
            {p.related_entity && <span className="chip" style={{ background: "color-mix(in srgb,#6366f1 18%,transparent)" }}>🏛️ {p.related_entity}</span>}
            <span className="chip" style={{ color: p.risk?.score >= 50 ? "#f43f5e" : "#f59e0b" }}>⚠️ خطر {p.risk?.score} ({p.risk?.level})</span>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12 }}>
            <span>👍 مزاج التفاعل: <b style={{ color: appColor(p.reaction_mood ?? 0) }}>{p.reaction_mood ?? "—"}</b></span>
            <span>💬 مزاج التعليق: <b style={{ color: appColor(p.comment_mood ?? 0) }}>{p.comment_mood ?? "—"}</b></span>
            {p.narrative && <span>🧵 السردية: <b>{p.narrative}</b></span>}
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(p.why_viral || []).map((w: string, j: number) => <span key={j} className="chip" style={{ fontSize: 11 }}>🔥 {w}</span>)}
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
            <EvidenceExplorer subject={p.related_entity || p.narrative || p.page} type="viral_post" score={p.risk?.score} demo={demo} />
            {p.url && <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--accent)" }}>↗ المصدر</a>}
          </div>
        </div>
      ))}
    </>
  );
}

function ClustersView({ demo }: { demo: boolean }) {
  const { d, loading, load } = useFb("/api/facebook/page-clusters", demo);
  if (loading) return <SkelCards count={2} />;
  const cl = d?.clusters || [];
  if (!cl.length) return <EmptyState title="لا عناقيد" subtitle={demo ? "" : "تحتاج صفحات أكثر"} action={{ label: "إعادة", onClick: load }} />;
  return (
    <>
      <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>تجميع الصفحات حسب السلوك (محتوى/توقيت/نبرة). لغة احتمالية — لا تُثبت تنسيقاً أو انتماءً.</p>
      {cl.map((c: any, i: number) => (
        <div key={i} className="cbox" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            <h4 style={{ margin: 0 }}>🕸️ {c.label}</h4>
            <span className="chip" style={{ fontSize: 11 }}>تشابه {c.avg_similarity}% · ثقة {c.confidence}</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {c.pages.map((p: any, j: number) => (
              <span key={j} className="chip" style={{ fontSize: 12 }}>{p.page} <span className="muted">({p.tendency})</span></span>
            ))}
          </div>
          {c.shared_topics?.length > 0 && <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>مواضيع مشتركة: {c.shared_topics.join("، ")}</div>}
          <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{c.note}</p>
        </div>
      ))}
    </>
  );
}

function JourneyView({ demo }: { demo: boolean }) {
  const { d, loading, load } = useFb("/api/facebook/journey", demo);
  if (loading) return <SkelCards count={2} />;
  if (!d?.available) return <EmptyState title="تتبّع الرحلة عبر المنصّات" subtitle={d?.note} action={{ label: "إعادة", onClick: load }} />;
  return (
    <>
      <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>هل بدأت القصة على فيسبوك أم انتقلت إليه؟ ومن ضخّمها أولاً؟</p>
      {(d.journeys || []).map((j: any, i: number) => (
        <div key={i} className="cbox" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <h4 style={{ margin: 0 }}>🧵 {j.title}</h4>
            <span className="chip" style={{ fontSize: 11, color: j.became_national ? "#f43f5e" : "var(--muted)" }}>{j.became_national ? "🇮🇶 قضية وطنية" : "محدودة"}</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11.5, marginTop: 4 }}>
            <span>المصدر الرائد: <b>{PLAT_EMOJI[j.leading_source]} {j.leading_source}</b></span>
            <span>أول مضخّم: <b>{PLAT_EMOJI[j.first_amplifier]} {j.first_amplifier}</b></span>
            <span>إجمالي الزمن: <b>{j.total_lag_human}</b></span>
          </div>
          <div style={{ marginTop: 10 }}>
            {(j.hops || []).map((h: any, k: number) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: k ? "1px dashed var(--line)" : 0 }}>
                <span style={{ fontSize: 20 }}>{PLAT_EMOJI[h.platform] || "•"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}><b>{h.platform_ar}</b> · {h.time} <span className="muted">({h.lag_human})</span></div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{h.detail}</div>
                </div>
                <div style={{ textAlign: "left", fontSize: 11 }}>
                  {h.similarity != null && <div>تشابه {h.similarity}%</div>}
                  {h.reach != null && <div className="muted">وصول {fmt(h.reach)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
    </>
  );
}

function DnaView({ demo }: { demo: boolean }) {
  const [t, setT] = useState(demo ? "BrothersIraqDemo" : "");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const run = async (override?: string) => {
    const q = (override ?? t).trim(); if (!q) return;
    setLoading(true); setD(null);
    const r = await apiGet(`/api/facebook/page-dna?target=${encodeURIComponent(q)}${demo ? "&demo=1" : ""}`).catch(() => null);
    setD(r); setLoading(false);
  };
  useEffect(() => { if (demo) run("BrothersIraqDemo"); /* eslint-disable-next-line */ }, [demo]);
  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="اسم الصفحة" value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
          <button className="btn" onClick={() => run()} disabled={loading}>{loading ? "…" : "بصمة الصفحة"}</button>
        </div>
        {demo && <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>{["BrothersIraqDemo", "SetAshwaqDemo", "RuslDemo"].map((s) => <button key={s} className="btn ghost" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => { setT(s); run(s); }}>{s}</button>)}</div>}
      </div>
      {loading && <SkelCards count={3} />}
      {d?.error && <EmptyState tone="error" title="تعذّر" subtitle={d.message || d.error} />}
      {d && !d.error && (
        <>
          <div className="cbox" style={{ marginBottom: 12 }}>
            <h4 style={{ margin: "0 0 6px" }}>🧬 بصمة: {d.page}</h4>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Kpi label="التأثير" value={d.influence} color="#6366f1" />
              <Kpi label="النبرة" value={d.sentiment_tendency} />
              <Kpi label="ذروة النشر" value={d.posting_schedule?.peak_hour != null ? d.posting_schedule.peak_hour + ":00" : "—"} sub={(d.posting_schedule?.active_days || []).join("، ")} />
              <Kpi label="التفاعل الغالب" value={d.reaction_profile?.dominant || "—"} />
            </div>
          </div>
          {d.dominant_topics?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 12 }}><h4>📌 المواضيع المهيمنة</h4>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{d.dominant_topics.map((x: string, i: number) => <span key={i} className="chip">{x}</span>)}</div></div>
          )}
          <AudienceMood ins={{ audience_mood: d.audience_mood, mood_index: d.comment_profile?.approval }} />
          {d.similar_pages?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 12 }}><h4>🔗 صفحات مشابهة سلوكياً</h4>
              {d.similar_pages.map((s: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                  <span>{s.page}</span><span className="muted">تشابه {s.similarity}%</span>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>يُظهر تقارباً سلوكياً — لا يُثبت انتماءً؛ مراجعة بشرية.</p></div>
          )}
          <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
        </>
      )}
    </>
  );
}

export default function Facebook() {
  const [tab, setTab] = useState<"dashboard" | "national" | "page" | "viral" | "clusters" | "journey" | "dna">("dashboard");
  const [demo, setDemo] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>🧠 استخبارات فيسبوك</h2>
        <button className={`btn ${demo ? "" : "ghost"}`} onClick={() => setDemo(!demo)} style={demo ? { background: "#6366f1" } : {}}>
          🧪 وضع العرض {demo ? "(مفعّل)" : ""}
        </button>
      </div>
      <p className="muted">فيسبوك مكان الجمهور العراقي الحقيقي — مو مجرّد منشورات، بل طبقة استخبارات: مين يهمّ، شنو يصير، شنو يقول الناس.</p>
      {demo && <p className="muted" style={{ fontSize: 11.5, color: "#6366f1" }}>🧪 وضع العرض مفعّل — بيانات تجريبية واقعية عبر المحرّك الحقيقي (للتطوير/العرض بدون استهلاك الخدمات الخارجية).</p>}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button className={`btn ${tab === "dashboard" ? "" : "ghost"}`} onClick={() => setTab("dashboard")}>🧠 اللوحة</button>
        <button className={`btn ${tab === "national" ? "" : "ghost"}`} onClick={() => setTab("national")}>🇮🇶 النبض الوطني</button>
        <button className={`btn ${tab === "viral" ? "" : "ghost"}`} onClick={() => setTab("viral")}>🔥 الأكثر انتشاراً</button>
        <button className={`btn ${tab === "clusters" ? "" : "ghost"}`} onClick={() => setTab("clusters")}>🕸️ العناقيد</button>
        <button className={`btn ${tab === "journey" ? "" : "ghost"}`} onClick={() => setTab("journey")}>🧵 الرحلة</button>
        <button className={`btn ${tab === "dna" ? "" : "ghost"}`} onClick={() => setTab("dna")}>🧬 بصمة الصفحة</button>
        <button className={`btn ${tab === "page" ? "" : "ghost"}`} onClick={() => setTab("page")}>🔎 صفحة محدّدة</button>
      </div>
      {tab === "dashboard" ? <DashboardView demo={demo} />
        : tab === "national" ? <NationalView Bar={Bar} demo={demo} />
        : tab === "viral" ? <ViralView demo={demo} />
        : tab === "clusters" ? <ClustersView demo={demo} />
        : tab === "journey" ? <JourneyView demo={demo} />
        : tab === "dna" ? <DnaView demo={demo} />
        : <PageView Bar={Bar} demo={demo} />}
    </div>
  );
}

function DashboardView({ demo }: { demo: boolean }) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); apiGet("/api/facebook/dashboard" + (demo ? "?demo=1" : "")).then(setD).finally(() => setLoading(false)); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [demo]);

  if (loading) return <SkelCards count={4} />;
  if (!d || d.error) return <EmptyState tone="error" title="تعذّر" subtitle={d?.message} action={{ label: "إعادة", onClick: load }} />;
  const t = d.totals || {};
  return (
    <>
      {d.stored === false && <p className="muted" style={{ fontSize: 11.5, marginBottom: 10 }}>⏳ {d.note}</p>}

      {/* KPI cards — what's happening on Facebook right now */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <Kpi label="صفحات مرصودة" value={fmt(t.pages)} color="#3b82f6" />
        <Kpi label="منشورات مجموعة" value={fmt(t.posts)} />
        <Kpi label="تعليقات محلّلة" value={fmt(t.comments)} color="#6366f1" />
        <Kpi label="إجمالي التفاعلات" value={fmt(t.reactions)} />
        {d.national_approval != null && <Kpi label="التأييد الوطني" value={`${d.national_approval}%`} color={appColor(d.national_approval)} />}
      </div>

      {/* reaction breakdown across all collected posts */}
      {d.reaction_breakdown?.mix && (
        <div className="grid" style={{ marginBottom: 14 }}>
          <div className="cbox">
            <h4>😊 توزيع التفاعلات (كل المنشورات)</h4>
            {d.reaction_breakdown.mix.filter((r: any) => r.count > 0).map((r: any) => (
              <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                <span style={{ width: 70, fontSize: 13 }}>{r.emoji} {r.label}</span>
                <span style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--input)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${r.pct}%`, background: r.polarity === "neg" ? "#f43f5e" : r.polarity === "amb" ? "#8a97ad" : "#22c55e" }} />
                </span>
                <span style={{ minWidth: 64, textAlign: "left", fontSize: 12 }}><b>{r.pct}%</b> <span className="muted">{fmt(r.count)}</span></span>
              </div>
            ))}
          </div>
          <div className="cbox" style={{ textAlign: "center" }}>
            <h4>🎭 مزاج التفاعلات</h4>
            {d.reaction_breakdown.mood_score != null
              ? <><div style={{ fontSize: 44, fontWeight: 900, color: appColor(d.reaction_breakdown.mood_score) }}>{d.reaction_breakdown.mood_score}</div>
                  <div className="muted" style={{ fontSize: 12 }}>0–100 (إيجابي مقابل سلبي)</div>
                  {d.reaction_breakdown.dominant_signal && <div style={{ marginTop: 8, fontSize: 13 }}>الغالب: <b>{d.reaction_breakdown.dominant_signal}</b></div>}</>
              : <p className="muted">—</p>}
          </div>
        </div>
      )}

      {/* most influential + most active pages */}
      {(d.most_influential_pages?.length > 0 || d.most_active_pages?.length > 0) && (
        <div className="grid" style={{ marginBottom: 14 }}>
          {d.most_influential_pages?.length > 0 && (
            <div className="cbox"><h4>🏆 الأكثر تأثيراً (بالتفاعل)</h4>
              {d.most_influential_pages.map((p: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <span>{i + 1}. {p.page}</span><span className="muted">{fmt(p.engagement)} تفاعل · {p.posts} منشور</span>
                </div>
              ))}</div>
          )}
          {d.most_active_pages?.length > 0 && (
            <div className="cbox"><h4>⚡ الأكثر نشاطاً (بالمنشورات)</h4>
              {d.most_active_pages.map((p: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <span>{i + 1}. {p.page}</span><span className="muted">{p.posts} منشور · {fmt(p.engagement)}</span>
                </div>
              ))}</div>
          )}
        </div>
      )}

      {/* most viral posts */}
      {d.viral_posts?.length > 0 && (
        <div className="cbox" style={{ marginBottom: 14 }}>
          <h4>🔥 الأكثر انتشاراً</h4>
          {d.viral_posts.slice(0, 8).map((p: any, i: number) => (
            <div key={i} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>{p.text || "—"}</div>
              <div className="muted" style={{ fontSize: 11.5, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>{p.page}</span><span>👍 {fmt(p.reactions)}</span><span>💬 {fmt(p.comments)}</span><span>🔁 {fmt(p.shares)}</span>
                {p.mood_score != null && <span style={{ color: appColor(p.mood_score) }}>مزاج {p.mood_score}</span>}
                {p.url && <a href={p.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>↗ المصدر</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* top topics + entities (reused from national insight) */}
      {(d.top_topics?.length > 0 || d.top_entities?.length > 0) && (
        <div className="grid" style={{ marginBottom: 14 }}>
          {d.top_topics?.length > 0 && (
            <div className="cbox"><h4>📌 أبرز القضايا على فيسبوك</h4>
              {d.top_topics.map((x: any, i: number) => (
                <div key={i} style={{ fontSize: 13, padding: "5px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <b>{x.name}</b> {x.share != null && <span className="chip" style={{ fontSize: 10.5 }}>{typeof x.share === "number" ? x.share + "%" : x.share}</span>}
                  {x.sentiment && <span className="chip" style={{ fontSize: 10.5, color: sentColor(x.sentiment) }}>● {x.sentiment}</span>}
                </div>
              ))}</div>
          )}
          {d.top_entities?.length > 0 && (
            <div className="cbox"><h4>👥 أبرز الشخصيات المذكورة</h4>
              {d.top_entities.map((e: any, i: number) => (
                <div key={i} style={{ fontSize: 13, padding: "5px 0", borderTop: i ? "1px solid var(--line)" : 0, display: "flex", justifyContent: "space-between" }}>
                  <span>{e.name} <span className="muted" style={{ fontSize: 11 }}>· {e.type}</span></span>
                  {e.stance && <span className="chip" style={{ fontSize: 10.5, color: sentColor(e.stance) }}>{e.stance}</span>}
                </div>
              ))}</div>
          )}
        </div>
      )}
      <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
    </>
  );
}

function NationalView({ Bar, demo }: { Bar: any; demo: boolean }) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); apiGet("/api/facebook/national" + (demo ? "?demo=1" : "")).then(setD).finally(() => setLoading(false)); };
  useEffect(() => { load(); apiGet("/api/facebook/pages").then((r) => setPages((r?.pages || []).join("\n"))); /* eslint-disable-next-line */ }, [demo]);

  const save = async () => {
    setSaving(true);
    await apiSend("/api/facebook/pages", "POST", { pages: pages.split("\n").map((x) => x.trim()).filter(Boolean) }).catch(() => {});
    setSaving(false); load();
  };

  return (
    <>
      {/* editable seed list */}
      <details className="card" style={{ marginBottom: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>⚙️ الصفحات المرصودة (اضغط للتعديل) — أضِف slug صفحات عراقية حقيقية</summary>
        <textarea value={pages} onChange={(e) => setPages(e.target.value)} rows={8}
          style={{ width: "100%", marginTop: 8, fontFamily: "monospace", fontSize: 13, resize: "vertical" }}
          placeholder="صفحة بكل سطر — مثلاً: alsumaria.tv" />
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <button className="btn" onClick={save} disabled={saving}>{saving ? "…" : "حفظ وإعادة الجلب"}</button>
          <span className="muted" style={{ fontSize: 11 }}>انسخ الـslug من رابط الصفحة بفيسبوك (facebook.com/<b>هذا_الجزء</b>).</span>
        </div>
      </details>

      {loading && <SkelCards count={3} />}
      {d?.error && <EmptyState tone="error" title="تعذّر" subtitle={d.message} action={{ label: "إعادة", onClick: load }} />}

      {d && !d.error && (
        <>
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: `4px solid ${appColor(d.approval || 0)}` }}>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <Gauge value={d.approval || 0} size={120} color={appColor(d.approval || 0)} />
                <div style={{ fontWeight: 800, marginTop: 4 }}>تأييد فيسبوك الوطني</div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 24, fontWeight: 900 }}>
                  <span style={{ color: "#22c55e" }}>{d.approval}% تأييد</span> · <span style={{ color: "#f43f5e" }}>{d.rejection}% رفض</span>
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                  {d.pages_ok} صفحة · {fmt(d.total_engagement)} تفاعل · إيجابي {fmt(d.total_positive)} / سلبي {fmt(d.total_negative)}
                </div>
                {d.summary && <p style={{ fontSize: 14, lineHeight: 1.9, marginTop: 8 }}>{d.summary}</p>}
              </div>
            </div>
          </div>

          {/* big KPI strip */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <Kpi label="صفحة مرصودة" value={fmt(d.pages_ok)} color="#3b82f6" />
            <Kpi label="إجمالي التفاعل" value={fmt(d.total_engagement)} />
            <Kpi label="👍 تأييد" value={fmt(d.total_positive)} color="#22c55e" />
            <Kpi label="😠😢 رفض" value={fmt(d.total_negative)} color="#f43f5e" />
            {d.comments_analyzed > 0 && <Kpi label="تعليق محلَّل" value={fmt(d.comments_analyzed)} sub="بمصنّف واعٍ للسخرية" color="#3b82f6" />}
          </div>

          {/* signature: likes vs comments gap (national) */}
          <GapCard d={d} />

          {/* national deep mining — the real product */}
          <Insights ins={d.insights} />

          {/* per-page table */}
          {d.pages?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>📊 الصفحات (مرتّبة بالتفاعل)</h4>
              {d.pages.map((p: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <span style={{ minWidth: 130, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.page}</span>
                  <span style={{ color: "#22c55e", fontSize: 12, minWidth: 36 }}>{p.approval ?? "—"}%</span>
                  <Bar p={p} />
                  <span className="muted" style={{ fontSize: 11, minWidth: 90, textAlign: "left" }}>{p.posts} منشور · {fmt(p.engagement)}</span>
                </div>
              ))}
            </div>
          )}

          {/* most rejected nationally */}
          {d.most_rejected?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4 style={{ color: "#f43f5e" }}>🔴 أكثر ما يثير الرفض وطنياً</h4>
              {d.most_rejected.map((p: any, i: number) => (
                <div key={i} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--line)" : 0, fontSize: 13 }}>
                  <span className="chip" style={{ color: "#f43f5e" }}>{p.rejection}% رفض</span> <span className="muted" style={{ fontSize: 11 }}>{p.page} · 😠😢 {fmt(p.neg)}</span>
                  <div style={{ marginTop: 4 }}>«{p.text}»</div>
                </div>
              ))}
            </div>
          )}

          {d.pages_failed?.length > 0 && <p className="muted" style={{ fontSize: 11.5 }}>⚠️ صفحات تعذّر جلبها (slug غير صحيح؟): {d.pages_failed.join("، ")}</p>}
          <p className="muted" style={{ fontSize: 11 }}>{d.note}</p>
        </>
      )}
    </>
  );
}

function PageView({ Bar, demo }: { Bar: any; demo: boolean }) {
  const [t, setT] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const run = async (override?: string) => {
    const q = (override ?? t).trim();
    if (!q || loading) return;
    setLoading(true); setD(null);
    const r = await apiGet(`/api/facebook/page?target=${encodeURIComponent(q)}&limit=20${demo ? "&demo=1" : ""}`).catch(() => null);
    setD(r); setLoading(false);
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="اسم الصفحة أو رابطها (مثال: aljazeera)" value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
          <button className="btn" onClick={() => run()} disabled={loading}>{loading ? "…يجلب" : "حلّل الصفحة"}</button>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Apify (فاتورة منفصلة) — أبطأ شوي (~دقيقة لأنه يسحب منشورات + تعليقات).</p>
        {demo && (
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 11 }}>صفحات تجريبية:</span>
            {["BrothersIraqDemo", "SetAshwaqDemo", "RuslDemo"].map((s) => (
              <button key={s} className="btn ghost" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => { setT(s); run(s); }}>{s}</button>
            ))}
          </div>
        )}
      </div>
      {loading && <SkelCards count={3} />}
      {d?.error && <EmptyState tone="error" title="تعذّر" subtitle={d.message} action={{ label: "إعادة", onClick: run }} />}
      {d && !d.error && (
        <>
          <div className="cbox" style={{ marginBottom: 14, borderInlineStart: `4px solid ${appColor(d.approval || 0)}` }}>
            <h4 style={{ margin: "0 0 4px" }}>{d.page_name}</h4>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <Gauge value={d.approval || 0} size={120} color={appColor(d.approval || 0)} />
                <div style={{ fontWeight: 800, marginTop: 4 }}>التأييد المدمَج</div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 24, fontWeight: 900 }}><span style={{ color: "#22c55e" }}>{d.approval}% تأييد</span> · <span style={{ color: "#f43f5e" }}>{d.rejection}% رفض</span></div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5, marginTop: 8 }}>
                  <span className="chip" style={{ color: "#22c55e" }}>👍 {fmt(d.total_positive)}</span>
                  <span className="chip" style={{ color: "#f43f5e" }}>😠😢 {fmt(d.total_negative)}</span>
                  <span className="chip">💬 {fmt(d.total_comments)}</span>
                  <span className="chip">🔁 {fmt(d.total_shares)}</span>
                </div>
                {d.comment_sentiment && <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>📊 تفاعلات {d.reaction_approval}% · تعليقات {d.comment_sentiment.approval}% → مدمَج {d.approval}%</div>}
                {d.summary && <p style={{ fontSize: 14, lineHeight: 1.9, marginTop: 8 }}>{d.summary}</p>}
              </div>
            </div>
          </div>

          {/* big KPI strip */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <Kpi label="منشور محلَّل" value={fmt(d.posts_analyzed ?? d.posts?.length)} color="#3b82f6" />
            <Kpi label="إجمالي التفاعلات" value={fmt(d.stats?.total_reactions ?? d.total_positive + d.total_negative)} />
            <Kpi label="تعليق محلَّل" value={fmt(d.comment_sentiment?.analyzed ?? d.total_comments)} sub="بمصنّف واعٍ للسخرية" />
            <Kpi label="متوسط تفاعل/منشور" value={fmt(d.stats?.avg_reactions)} />
            <Kpi label="متوسط مشاركات" value={fmt(d.stats?.avg_shares)} />
          </div>

          {/* §2 signature: are reactions misleading? */}
          <GapV2 g={d.comment_reaction_gap} />

          {/* reaction mix + stats */}
          {d.reactions?.length > 0 && (
            <div className="grid" style={{ marginBottom: 14 }}>
              <div className="cbox">
                <h4>😊 توزيع التفاعلات</h4>
                {d.reactions.filter((r: any) => r.count > 0).map((r: any) => (
                  <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                    <span style={{ width: 70, fontSize: 13 }}>{r.emoji} {r.label}</span>
                    <span style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--input)", overflow: "hidden" }}>
                      <span style={{ display: "block", height: "100%", width: `${r.pct}%`, background: r.polarity === "neg" ? "#f43f5e" : r.polarity === "amb" ? "#8a97ad" : "#22c55e" }} />
                    </span>
                    <span style={{ minWidth: 64, textAlign: "left", fontSize: 12 }}><b>{r.pct}%</b> <span className="muted">{fmt(r.count)}</span></span>
                  </div>
                ))}
              </div>
              <div className="cbox">
                <h4>📊 إحصاءات</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[["متوسط التفاعلات/منشور", d.stats?.avg_reactions], ["متوسط التعليقات", d.stats?.avg_comments],
                    ["متوسط المشاركات", d.stats?.avg_shares], ["إجمالي التفاعلات", d.stats?.total_reactions]].map(([l, v]: any) => (
                    <div key={l} style={{ textAlign: "center", padding: "8px 4px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--input)" }}>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{fmt(v)}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {d.comment_sentiment && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>💬 مشاعر التعليقات ({d.comment_sentiment.analyzed} تعليق)</h4>
              <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
                <span style={{ width: `${(d.comment_sentiment.pos / d.comment_sentiment.analyzed) * 100}%`, background: "#22c55e" }} />
                <span style={{ width: `${(d.comment_sentiment.neu / d.comment_sentiment.analyzed) * 100}%`, background: "#8a97ad" }} />
                <span style={{ width: `${(d.comment_sentiment.neg / d.comment_sentiment.analyzed) * 100}%`, background: "#f43f5e" }} />
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 12.5 }}><span style={{ color: "#22c55e" }}>إيجابي {d.comment_sentiment.pos}</span><span className="muted">محايد {d.comment_sentiment.neu}</span><span style={{ color: "#f43f5e" }}>سلبي {d.comment_sentiment.neg}</span></div>
              {d.sample_comments?.map((c: any, i: number) => (
                <div key={i} style={{ fontSize: 12.5, padding: "4px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <span style={{ color: c.sentiment === "إيجابي" ? "#22c55e" : c.sentiment === "سلبي" ? "#f43f5e" : "#8a97ad", fontWeight: 700 }}>● </span>{c.text}
                </div>
              ))}
              <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>السخرية قد تُقرأ حرفياً أحياناً — مراجعة بشرية مستحسنة.</p>
            </div>
          )}

          <CommentIntel ci={d.comment_intel} />
          <AudienceMood ins={d.insights} />
          <Insights ins={d.insights} />

          {d.posts?.length > 0 && (
            <div className="cbox" style={{ marginBottom: 14 }}>
              <h4>📋 المنشورات</h4>
              {d.posts.map((p: any, i: number) => (
                <div key={i} style={{ padding: "9px 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <div style={{ fontSize: 13, marginBottom: 5 }}>{p.text || "—"}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#22c55e", fontSize: 12, minWidth: 38 }}>{p.approval ?? "—"}%</span><Bar p={p} /><span style={{ color: "#f43f5e", fontSize: 12, minWidth: 38, textAlign: "left" }}>{p.rejection ?? "—"}%</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>👍 {fmt(p.pos)} · 😠😢 {fmt(p.neg)} · 💬 {fmt(p.comments)}</div>
                </div>
              ))}
            </div>
          )}
          <p className="muted" style={{ fontSize: 11 }}>{d.note}</p>
        </>
      )}
    </>
  );
}
