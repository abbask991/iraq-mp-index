"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import EvidenceExplorer from "@/components/EvidenceExplorer";
import { PageHeader, Section, Card, CardHead, Callout, Stat, Badge, Button, Meter, Grid, Row, Icon, DemoBanner, type Tone, type IconName } from "@/components/ui";
import { RankBars, DeltaBars, DonutChart, riskColor } from "@/components/ui/charts";
import EmotionHeatmap from "@/components/EmotionHeatmap";
import Gauge from "@/components/Gauge";
import RadarChart from "@/components/RadarChart";
import IraqMap from "@/components/IraqMap";
import PlatformContributionCard from "@/components/PlatformContributionCard";
import WhatMattersNow, { buildMattersItems } from "@/components/WhatMattersNow";
import SoWhatInsightBlock from "@/components/SoWhatInsightBlock";
import RecommendedActions, { type Reco, type RecoType } from "@/components/RecommendedActions";
import ReportGenerationButtons from "@/components/ReportGenerationButtons";
import { useDemo } from "@/components/ui/DemoContext";

const PLATFORM_AR: Record<string, string> = {
  facebook: "فيسبوك", x: "إكس", telegram: "تيليجرام", tiktok: "تيك توك",
  instagram: "إنستغرام", youtube: "يوتيوب", news: "أخبار",
};

/** "-18 سمعة" / "+11 خطر" → -18 / +11. The payload ships deltas as prose. */
const deltaNum = (s: string) => { const m = String(s).match(/-?\d+/); return m ? Number(m[0]) : 0; };

/** Human age of the digest. It is rebuilt ~every 3h and cached for a day, so a
 *  failed cron can serve day-old data under a card titled "الآن". Say the age. */
function ageOf(generatedAt?: number) {
  if (!generatedAt) return null;
  const mins = Math.max(0, Math.round((Date.now() / 1000 - generatedAt) / 60));
  const stale = mins > 240; // matches the digest endpoint's own staleness rule (>4h)
  const label = mins < 1 ? "الآن" : mins < 60 ? `قبل ${mins} دقيقة`
    : mins < 1440 ? `قبل ${Math.round(mins / 60)} ساعة` : `قبل ${Math.round(mins / 1440)} يوم`;
  return { label, stale };
}

const fmt = (n: number) => (n || 0).toLocaleString("en-US");

/** Arabic severity label → semantic tone. Single source for every colour on this page. */
const toneOf = (l: string): Tone =>
  /حرج/.test(l) ? "crit" : /مرتفع/.test(l) ? "danger" : /متوسط/.test(l) ? "warn" : "ok";
/** Numeric risk (0-100) → tone. */
const toneOfScore = (n: number): Tone => (n >= 70 ? "crit" : n >= 50 ? "danger" : n >= 30 ? "warn" : "ok");

/** Public Anger trend → Arabic. Mirrors AngerView's own map so the command
 *  card and the full breakdown speak the same language. */
const ANGER_TREND: Record<string, string> = {
  accelerating: "متسارع", rising: "متصاعد", stable: "مستقر", declining: "متراجع", cooling_down: "يهدأ",
};

const CHANGE: Record<string, { icon: IconName; tone: Tone }> = {
  reputation_drop: { icon: "trendDown", tone: "danger" },
  reputation_gain: { icon: "trendUp", tone: "ok" },
  risk_rise: { icon: "alert", tone: "danger" },
  risk_drop: { icon: "check", tone: "ok" },
  new_campaign: { icon: "megaphone", tone: "warn" },
  new_trend: { icon: "fire", tone: "warn" },
  sentiment_shift: { icon: "refresh", tone: "info" },
};

const RISK_LABELS: [string, string, IconName][] = [
  ["political", "خطر سياسي", "target"],
  ["reputation", "خطر السمعة", "trendDown"],
  ["crisis", "مؤشر الأزمة", "alert"],
  ["campaign", "حملات منسّقة", "megaphone"],
];

/** Structured recommendations from real signals (risks + anger + digest actions)
 *  — never free speculation. Deduped by title, priority from severity. */
function buildRecos(d: any, anger: any): Reco[] {
  const out: Reco[] = [];
  const prioOf = (lvl?: string): "high" | "medium" | "low" =>
    /حرج|مرتفع/.test(lvl || "") ? "high" : /متوسط/.test(lvl || "") ? "medium" : "low";
  (d?.top_risks || []).slice(0, 4).forEach((r: any) => {
    if (!r.recommended_action) return;
    const t: RecoType = /حرج|مرتفع/.test(r.level || "") ? "escalate" : "watch_entity";
    out.push({
      id: `risk:${r.entity}`, title: r.recommended_action, type: t, priority: prioOf(r.level),
      reason: `${r.entity} · ${r.level} (${r.risk})`, confidence: Math.min(99, r.evidence_count || 0),
      href: "/monitor/risk?tab=alerts",
    });
  });
  (anger?.explanation?.recommended_actions || []).slice(0, 2).forEach((a: string, i: number) => {
    out.push({ id: `anger:${i}`, title: a, type: "prepare_statement", priority: "medium",
      reason: "من تحليل مؤشر الغضب العام", confidence: anger?.confidence_score, href: "/monitor/risk?tab=anger" });
  });
  (d?.recommended_actions || []).forEach((a: string, i: number) => {
    out.push({ id: `rec:${i}`, title: a, type: "monitor", priority: "low" });
  });
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.title) ? false : (seen.add(r.title), true))).slice(0, 8);
}

export default function CommandCenter() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { demo, setDemo } = useDemo();
  const [health, setHealth] = useState<any>(null);
  const load = () => { setLoading(true); apiGet("/api/command-center" + (demo ? "?demo=1" : "")).then(setD).finally(() => setLoading(false)); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [demo]);

  // What-changed period. 24h uses the payload we already have (no extra call);
  // 7d / custom fetch /api/what-changed on demand. Folds in the old standalone
  // /monitor/changes page, whose only extra was this period switch.
  const [chPeriod, setChPeriod] = useState("last_24h");
  const [chData, setChData] = useState<any[] | null>(null);
  useEffect(() => {
    if (chPeriod === "last_24h") { setChData(null); return; }
    apiGet(`/api/what-changed?period=${chPeriod}${demo ? "&demo=1" : ""}`)
      .then((r) => setChData(r?.changes || [])).catch(() => setChData([]));
  }, [chPeriod, demo]);
  const changes = chPeriod === "last_24h" ? (d?.what_changed || []) : (chData || []);
  // "Why is my dashboard empty?" was answerable only from a settings panel that
  // showed all-green while collection had been stopped for three weeks. Put the
  // answer where the emptiness is noticed.
  useEffect(() => { apiGet("/api/settings/health").then(setHealth).catch(() => {}); }, []);
  const blockers = (health?.blockers || []).filter((b: any) => b.severity === "crit");

  // Public Anger Index — national scope. The full, scope-selectable breakdown
  // lives in Risk › مؤشر الغضب العام; here it surfaces as a single posture card
  // so a decision-maker sees the national anger level without leaving command.
  const [anger, setAnger] = useState<any>(null);
  useEffect(() => {
    // Only send demo when on — the backend rejects an empty `demo=` as a bad bool (422).
    const q = `scope_type=country&scope_id=${encodeURIComponent("العراق")}&scope_name=${encodeURIComponent("العراق")}&period=week${demo ? "&demo=1" : ""}`;
    apiGet(`/api/indices/public-anger?${q}`).then(setAnger).catch(() => setAnger(null));
  }, [demo]);

  return (
    <div>
      <PageHeader
        title="مركز القيادة"
        sub="ماذا يجب أن يعرفه صانع القرار الآن؟ — الصورة الكاملة خلال ٦٠ ثانية."
        actions={
          <>
            {(() => {
              const a = ageOf(d?.generated_at);
              if (!a) return null;
              return (
                <span className="u-age" data-stale={a.stale ? "1" : undefined}
                  title={a.stale ? "البيانات لم تُحدَّث منذ أكثر من ٤ ساعات" : undefined}>
                  <Icon name={a.stale ? "alert" : "refresh"} size={12} />
                  آخر تحديث: {a.label}{a.stale ? " — قديمة" : ""}
                </span>
              );
            })()}
            {/* The war room is the live wall-display mode of this page — same data,
                fullscreen, auto-refreshing. Entered from here, not a nav item. */}
            <Link href="/monitor/warroom" className="u-btn" data-variant="primary" title="عرض حائطي مباشر يتحدّث تلقائياً">
              <Icon name="expand" size={13} /> غرفة الحرب (مباشر)
            </Link>
          </>
        }
      />

      {/* Nothing is arriving and here is exactly why — shown above the data, not
          buried three menus away. Hidden in demo: these are live-collection facts. */}
      {!demo && blockers.length > 0 && (
        <div className="u-blockers">
          <div className="u-blockers-h">
            <Icon name="siren" size={15} />
            <b>الرصد متوقف — لا تصل بيانات جديدة</b>
          </div>
          {blockers.map((b: any) => (
            <div className="u-blocker" key={b.key}>
              <span className="u-badge-dot" style={{ background: "var(--danger)", marginTop: 7 }} />
              <div>
                <div style={{ fontWeight: "var(--w-med)" }}>{b.label}</div>
                <div className="u-fine">الحل: {b.fix}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && <SkelCards count={4} />}
      {!loading && d?.empty && !demo && (
        <EmptyState title="لا بيانات مرصودة بعد" subtitle={d?.note} action={{ label: "عرض بيانات توضيحية", onClick: () => setDemo(true) }} />
      )}

      {!loading && d && (!d.empty || demo) && (
        <>
          {/* Client value layer — the decision-ready top: what matters now +
              one-click reports, before any raw dashboard. */}
          {(() => {
            const items = buildMattersItems(d, anger);
            if (!items.length) return null;
            const top = (d.platform_activity || [])[0];
            const note = top ? `أبرز منصّة في النقاش الآن: ${PLATFORM_AR[top.platform] || top.platform}. التفصيل في مركز الرصد.` : undefined;
            return (
              <div className="u-section">
                <WhatMattersNow items={items} platformNote={note} />
                <div style={{ marginTop: "var(--s-3)" }}>
                  <ReportGenerationButtons only={["daily", "crisis", "anger", "campaign", "executive"]} />
                </div>
              </div>
            );
          })()}

          {/* Coverage — "based on what?". Every score below is an unbacked claim
              without it. Figures that are unavailable are omitted, never zeroed. */}
          {(d.coverage?.signals != null || d.coverage?.platforms) && (
            <div className="u-section">
              <div className="u-stats">
                {d.coverage.signals != null && (
                  <Stat label="إشارات مرصودة" icon="clip" value={fmt(d.coverage.signals)} meta="إجمالي المخزّن" />
                )}
                {d.coverage.platforms > 0 && (
                  <Stat label="منصّات ممسوحة" icon="megaphone" value={d.coverage.platforms}
                    meta={(d.platform_activity || []).map((p: any) => PLATFORM_AR[p.platform] || p.platform).join(" · ") || undefined} />
                )}
                {d.coverage.sources > 0 && (
                  <Stat label="مصادر" icon="brain" value={fmt(d.coverage.sources)} meta={`ضمن آخر ${fmt(d.coverage.sample || 0)} إشارة`} />
                )}
                {d.coverage.engagement > 0 && (
                  <Stat label="تفاعلات" icon="bolt" value={fmt(d.coverage.engagement)} meta={`ضمن آخر ${fmt(d.coverage.sample || 0)} إشارة`} />
                )}
                {d.coverage.comments != null && (
                  <Stat label="تعليقات محلَّلة" icon="brain" value={fmt(d.coverage.comments)} />
                )}
              </div>
              {d.coverage.latest && (
                <div className="u-fine" style={{ marginTop: "var(--s-2)" }}>
                  آخر إشارة مرصودة: {new Date(d.coverage.latest).toLocaleString("ar-IQ", { dateStyle: "medium", timeStyle: "short" })}
                </div>
              )}
              {d.coverage.comments == null && !demo && (
                <div className="u-fine" style={{ marginTop: "var(--s-2)" }}>
                  التعليقات غير محتسبة — يتطلّب تطبيق ترحيل ‎011‎ لتفعيل تخزين منشورات/تعليقات فيسبوك.
                </div>
              )}
            </div>
          )}

          {/* Platform contribution — compact, links to the full Monitoring Hub
              breakdown. Only shown when real platform activity exists. */}
          {d.platform_activity?.length > 0 && (
            <div className="u-section">
              <PlatformContributionCard platforms={d.platform_activity}
                note="أين يجري النقاش الآن عبر المصادر — التفصيل الكامل ومسار المصادر في مركز الرصد." />
            </div>
          )}

          {/* Executive brief — the one thing a decision-maker reads first */}
          <div className="u-section">
            <Callout
              label="الموجز التنفيذي"
              icon="brain"
              footer={
                d.urgent_recommendation ? (
                  // An alarm box is only an alarm if it is sometimes silent. When
                  // nothing is urgent this used to shout "no response recommended"
                  // in red — which teaches the eye to skip the box that matters.
                  d.is_urgent ? (
                    <div className="u-priority">
                      <span style={{ color: "var(--danger)", marginTop: 2 }}><Icon name="siren" size={16} /></span>
                      <span><b>الأولوية الآن:</b> {d.urgent_recommendation}</span>
                    </div>
                  ) : (
                    <div className="u-calm">
                      <span style={{ color: "var(--ok)", marginTop: 2 }}><Icon name="check" size={16} /></span>
                      <span>لا توجد أولوية عاجلة — {d.urgent_recommendation}</span>
                    </div>
                  )
                ) : null
              }
            >
              {d.executive_brief}
            </Callout>
          </div>

          {/* National risk — the posture headline, gauges, radar, mood */}
          {d.national_risk && (
            <Section title="الصورة الوطنية" icon="target">
              <Grid cols="2">
                {/* The one number a decision-maker asks for first: how bad is it
                    overall? Labelled as a composite so it is never mistaken for a
                    measured index. */}
                {(() => {
                  const present = RISK_LABELS.filter(([k]) => d.national_risk[k] != null);
                  if (!present.length) return null;
                  // The DRIVING risk, not the mean. Averaging dilutes: with indices
                  // 39/3/0/5 the mean is 12 — green, "all clear" — while reputation
                  // risk sits at 39. A posture headline must not understate the worst
                  // live risk, so take the max and name what is driving it.
                  const driver = present.reduce((a, b) => (d.national_risk[b[0]] > d.national_risk[a[0]] ? b : a));
                  const peak = d.national_risk[driver[0]];
                  const t = toneOfScore(peak);
                  return (
                    <Card t={t}>
                      <CardHead
                        title="الحالة العامة الآن"
                        right={d.executive?.risk_level ? <Badge t={toneOf(d.executive.risk_level)} dot>{d.executive.risk_level}</Badge> : <Badge t={t} dot>{peak >= 70 ? "حرج" : peak >= 50 ? "مرتفع" : peak >= 30 ? "متوسط" : "منخفض"}</Badge>}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-5)", flexWrap: "wrap", justifyContent: "center" }}>
                        <Gauge value={peak} sub={driver[1]} color={riskColor(peak)} size={132} stroke={11} />
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div className="u-fine" style={{ marginBottom: 4 }}>المؤشر المحرّك</div>
                          <div style={{ fontSize: "var(--t-md)", fontWeight: "var(--w-bold)", lineHeight: "var(--lh-tight)" }}>{driver[1]}</div>
                          {d.executive?.top_event && (
                            <>
                              <div className="u-fine" style={{ margin: "var(--s-3) 0 4px" }}>أبرز حدث</div>
                              <div style={{ fontSize: "var(--t-sm)", lineHeight: "var(--lh-base)" }}>{d.executive.top_event}</div>
                            </>
                          )}
                          <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap", marginTop: "var(--s-3)" }}>
                            {d.most_damaged && (
                              <Badge t="danger"><Icon name="trendDown" size={12} /> {d.most_damaged.entity} ({d.most_damaged.change})</Badge>
                            )}
                            {d.most_improved && (
                              <Badge t="ok"><Icon name="trendUp" size={12} /> {d.most_improved.entity} (+{d.most_improved.change})</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="u-card-foot">
                        <span className="u-fine">أعلى المؤشرات الأربعة — المؤشر المحرّك للحالة، مو متوسّطاً</span>
                      </div>
                    </Card>
                  );
                })()}
                <Card>
                  <CardHead title="مؤشرات الخطر" right={<span className="u-fine">٠ – ١٠٠</span>} />
                  <div className="ch-gauges">
                    {RISK_LABELS.map(([k, label]) =>
                      d.national_risk[k] != null ? (
                        <Gauge
                          key={k}
                          value={d.national_risk[k]}
                          label={label}
                          sub="من ١٠٠"
                          color={riskColor(d.national_risk[k])}
                          size={112}
                        />
                      ) : null
                    )}
                  </div>
                </Card>
                <Card>
                  <CardHead title="مصفوفة الموقف" right={<span className="u-fine">شكل ملف الخطر</span>} />
                  <RadarChart
                    axes={RISK_LABELS.filter(([k]) => d.national_risk[k] != null)
                      .map(([k, label]) => ({ label, value: d.national_risk[k] }))}
                  />
                </Card>
                {/* Fourth card. Deliberately driven by top_risks, not sentiment:
                    national_sentiment comes from the overview extract and is empty
                    on live data, which left this slot as a hole in the 2x2. Risk
                    ranking is present whenever the page has anything to show. */}
                {d.top_risks?.length > 0 && (
                  <Card>
                    <CardHead title="مَن يقود الخطر" right={<span className="u-fine">٠ – ١٠٠</span>} />
                    <RankBars data={d.top_risks.map((r: any) => ({ label: r.entity, value: Number(r.risk) || 0 }))} max={100} />
                  </Card>
                )}
              </Grid>
            </Section>
          )}

          {/* Public Anger Index — national posture card. Full breakdown in Risk. */}
          {anger?.score != null && (
            <Section title="مؤشر الغضب العام" icon="alert">
              <Card t={toneOfScore(anger.score)}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--s-5)", flexWrap: "wrap" }}>
                  <Gauge value={anger.score} sub={anger.risk_level_ar} color={riskColor(anger.score)} size={124} stroke={11} />
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap", marginBottom: "var(--s-3)" }}>
                      {anger.trend && <Badge t={toneOfScore(anger.score)} dot>{ANGER_TREND[anger.trend] || anger.trend}</Badge>}
                      {anger.change_24h != null && <Badge t={anger.change_24h > 0 ? "danger" : "ok"}>٢٤س: {anger.change_24h > 0 ? "+" : ""}{anger.change_24h}</Badge>}
                      {anger.change_7d != null && <Badge>٧ أيام: {anger.change_7d > 0 ? "+" : ""}{anger.change_7d}</Badge>}
                    </div>
                    {anger.explanation?.summary && (
                      <p className="u-muted" style={{ margin: "0 0 var(--s-3)", lineHeight: "var(--lh-base)" }}>{anger.explanation.summary}</p>
                    )}
                    <div className="u-fine">النطاق: العراق (وطني) · أسبوع{anger.confidence_score != null ? ` · الثقة ${anger.confidence_score}%` : ""}</div>
                  </div>
                </div>
                <div className="u-card-foot">
                  <span className="u-fine">أعلى الدوافع: {(anger.drivers || []).slice(0, 3).map((dr: any) => dr.driver_name).join(" · ") || "—"}</span>
                  <Link href="/monitor/risk?tab=anger" className="u-btn"><Icon name="target" size={13} /> التحليل الكامل</Link>
                </div>
              </Card>
              {/* So What — the decision framing, from the anger explanation. */}
              {(anger.explanation?.why_changed || (anger.explanation?.recommended_actions || []).length > 0) && (
                <div style={{ marginTop: "var(--s-3)" }}>
                  <SoWhatInsightBlock data={{
                    why_it_matters: anger.explanation?.why_changed,
                    likely_next_step: (anger.explanation?.what_to_watch || [])[0],
                    recommended_action: (anger.explanation?.recommended_actions || [])[0],
                    confidence: anger.confidence_score,
                    uncertainty: anger.explanation?.uncertainty,
                  }} />
                </div>
              )}
            </Section>
          )}

          {/* Top risks */}
          {d.top_risks?.length > 0 && (
            <Section title="أخطر ما يجري اليوم" icon="alert" count={d.top_risks.length}>
              <Grid cols="auto">
                {d.top_risks.map((r: any, i: number) => {
                  const t = toneOf(r.level);
                  return (
                    <Card key={i} t={t}>
                      <CardHead
                        title={r.entity}
                        right={<Badge t={t} dot>{r.level} · {r.risk}</Badge>}
                      />
                      <Meter value={Number(r.risk) || 0} t={t} />
                      <p className="u-muted" style={{ margin: "var(--s-3) 0 0" }}>{r.reason}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", marginTop: "var(--s-3)" }}>
                        <span style={{ color: "var(--accent)", marginTop: 1 }}><Icon name="bolt" size={14} /></span>
                        <span style={{ fontSize: "var(--t-sm)", fontWeight: "var(--w-bold)" }}>{r.recommended_action}</span>
                      </div>
                      <div className="u-card-foot">
                        <span className="u-fine u-num" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                          title={r.evidence_capped ? "بلغ سقف الاستعلام — العدد الفعلي أكبر" : undefined}>
                          {/* the backend caps the read at 300, so a saturated value is a
                              floor, not a count. Render it as such. */}
                          <Icon name="clip" size={12} /> {fmt(r.evidence_count)}{r.evidence_capped ? "+" : ""} دليل
                        </span>
                        <EvidenceExplorer subject={r.entity} type="risk" score={r.risk} demo={demo} />
                      </div>
                    </Card>
                  );
                })}
              </Grid>
            </Section>
          )}

          {/* Recommended actions — structured, from real risks/anger/digest. */}
          {(() => {
            const recos = buildRecos(d, anger);
            if (!recos.length) return null;
            return <div className="u-section"><RecommendedActions actions={recos} /></div>;
          })()}

          {/* What changed — with a period switch (folds in the old /changes page) */}
          <Section title="ما الذي تغيّر" icon="refresh" count={changes.length}>
            <div style={{ display: "flex", gap: "var(--s-2)", marginBottom: "var(--s-3)" }}>
              {[["last_24h", "٢٤ ساعة"], ["last_7d", "٧ أيام"], ["custom", "مخصّص"]].map(([k, l]) => (
                <Button key={k} aria-pressed={chPeriod === k} onClick={() => setChPeriod(k)}>{l}</Button>
              ))}
            </div>
            {changes.length === 0 ? (
              <Card><p className="u-muted" style={{ margin: 0 }}>لا تغيّرات ملحوظة في هذه المدة.</p></Card>
            ) : (<>
              {/* polarity around zero — the one thing the row list can't show */}
              <Card style={{ marginBottom: "var(--s-3)" }}>
                <CardHead title="حجم التغيّر واتجاهه" />
                {/* only rows whose change is an actual delta — "حملة جديدة" is prose,
                    not a number, and would plot as a meaningless zero-width bar */}
                <DeltaBars data={changes.filter((c: any) => /-?\d/.test(String(c.change))).map((c: any) => ({ label: c.entity, value: deltaNum(c.change) }))} />
              </Card>
              <Card>
                {changes.map((c: any, i: number) => {
                  const cfg = CHANGE[c.type] || { icon: "refresh" as IconName, tone: "neutral" as Tone };
                  return (
                    <Row
                      key={i}
                      icon={cfg.icon}
                      iconTone={cfg.tone}
                      title={<><b>{c.entity}</b><Badge t={toneOf(c.risk_level)}>{c.change}</Badge></>}
                      meta={<>{c.reason} · <span className="u-num">{fmt(c.evidence_count)} دليل</span></>}
                    />
                  );
                })}
              </Card>
            </>)}
          </Section>

          <Grid cols="2" style={{ marginBottom: "var(--s-6)" }}>
            {d.active_campaigns?.length > 0 && (
              <Card>
                <CardHead title={<><Icon name="megaphone" size={16} /> حملات نشطة (الأعلى خطراً)</>} />
                {d.active_campaigns.map((c: any, i: number) => (
                  <div key={i} style={{ padding: "var(--s-3) 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--s-2)", marginBottom: "var(--s-2)" }}>
                      <span className="u-num" style={{ fontWeight: "var(--w-med)" }}>#{c.hashtag}</span>
                      <Badge t={toneOf(c.level || "متوسط")}>تنسيق {c.coordination}</Badge>
                    </div>
                    {/* one measure → one hue; the badge above carries the status */}
                    <Meter value={Number(c.coordination) || 0} />
                  </div>
                ))}
              </Card>
            )}
            {d.trending?.length > 0 && (
              <Card>
                <CardHead title={<><Icon name="fire" size={16} /> الأكثر تداولاً الآن</>} right={<span className="u-fine">السرعة ٠ – ١٠٠</span>} />
                {d.trending.map((t: any, i: number) => (
                  <div key={i} style={{ padding: "var(--s-3) 0", borderTop: i ? "1px solid var(--line)" : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--s-2)", marginBottom: "var(--s-2)" }}>
                      <b>{t.topic}</b>
                      <Badge t={toneOf(String(t.risk))}>خطر {t.risk}</Badge>
                    </div>
                    {/* velocity is not risk — colouring it with risk tones would be a
                        status colour on a non-status measure. One measure → one hue. */}
                    <Meter value={Number(t.velocity) || 0} />
                    <div className="u-fine u-num" style={{ marginTop: "var(--s-2)" }}>
                      سرعة {t.velocity} · {t.sentiment} · {fmt(t.posts)} منشور
                    </div>
                  </div>
                ))}
              </Card>
            )}
            {/* mood + reach sit with the conversation, not with the risk posture */}
            {d.national_sentiment?.neg != null && (
              <Card>
                <CardHead
                  title={<><Icon name="brain" size={16} /> مزاج الرأي العام</>}
                  right={<span className="u-fine u-num">{fmt((d.national_sentiment.pos || 0) + (d.national_sentiment.neg || 0) + (d.national_sentiment.neu || 0))} إشارة</span>}
                />
                {/* diverging poles + gray neutral — the validated blue↔rose pair */}
                <DonutChart
                  segments={[
                    { label: "سلبي", value: d.national_sentiment.neg || 0, color: "#f43f5e" },
                    { label: "محايد", value: d.national_sentiment.neu || 0, color: "#64748b" },
                    { label: "إيجابي", value: d.national_sentiment.pos || 0, color: "#4f9dff" },
                  ]}
                  centerLabel={`${Math.round(((d.national_sentiment.neg || 0) / ((d.national_sentiment.pos || 0) + (d.national_sentiment.neg || 0) + (d.national_sentiment.neu || 0) || 1)) * 100)}%`}
                  centerSub="سلبي"
                />
              </Card>
            )}
            {d.platform_activity?.length > 0 && (
              <Card>
                <CardHead title={<><Icon name="megaphone" size={16} /> أين يجري النقاش</>} right={<span className="u-fine">حصّة المنصّة</span>} />
                {/* categorical identity → the validated slot order, never cycled */}
                <DonutChart
                  segments={d.platform_activity.map((p: any) => ({ label: PLATFORM_AR[p.platform] || p.platform, value: p.count ?? p.pct }))}
                  centerLabel={String(d.platform_activity.length)}
                  centerSub="منصّات"
                />
              </Card>
            )}
          </Grid>

          {/* Emotion grid — moved below the trending row */}
          {d.emotion_heatmap?.length > 0 && (
            <Section title="خريطة المشاعر" icon="brain" count={d.emotion_heatmap.length}>
              <Card>
                <EmotionHeatmap data={d.emotion_heatmap} />
              </Card>
            </Section>
          )}

          {/* Geography — the one thing the old /overview showed that this page did
              not. Moved here so overview can be removed as a pure duplicate. */}
          {d.geo?.located > 0 && (
            <Section title="التوزيع الجغرافي عبر المحافظات" icon="map">
              <Card><IraqMap geo={d.geo} /></Card>
            </Section>
          )}

          {d.recommended_actions?.length > 0 && (
            <Section title="إجراءات موصى بها" icon="check" count={d.recommended_actions.length}>
              <Card t="ok">
                {d.recommended_actions.map((a: string, i: number) => (
                  <Row key={i} icon="check" iconTone="ok" title={a} />
                ))}
              </Card>
            </Section>
          )}

          <p className="u-fine">{d.disclaimer}</p>
        </>
      )}
    </div>
  );
}
