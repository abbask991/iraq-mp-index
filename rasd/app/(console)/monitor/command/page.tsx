"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { SkelCards } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import EvidenceExplorer from "@/components/EvidenceExplorer";
import { PageHeader, Section, Card, CardHead, Callout, Stat, Badge, Button, Meter, Grid, Row, Icon, type Tone, type IconName } from "@/components/ui";
import { RankBars, DeltaBars, DonutChart, riskColor } from "@/components/ui/charts";
import EmotionHeatmap from "@/components/EmotionHeatmap";
import Gauge from "@/components/Gauge";
import RadarChart from "@/components/RadarChart";

const PLATFORM_AR: Record<string, string> = {
  facebook: "فيسبوك", x: "إكس", telegram: "تيليجرام", tiktok: "تيك توك",
  instagram: "إنستغرام", youtube: "يوتيوب", news: "أخبار",
};

/** "-18 سمعة" / "+11 خطر" → -18 / +11. The payload ships deltas as prose. */
const deltaNum = (s: string) => { const m = String(s).match(/-?\d+/); return m ? Number(m[0]) : 0; };

const fmt = (n: number) => (n || 0).toLocaleString("en-US");

/** Arabic severity label → semantic tone. Single source for every colour on this page. */
const toneOf = (l: string): Tone =>
  /حرج/.test(l) ? "crit" : /مرتفع/.test(l) ? "danger" : /متوسط/.test(l) ? "warn" : "ok";
/** Numeric risk (0-100) → tone. */
const toneOfScore = (n: number): Tone => (n >= 70 ? "crit" : n >= 50 ? "danger" : n >= 30 ? "warn" : "ok");

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

export default function CommandCenter() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const load = () => { setLoading(true); apiGet("/api/command-center" + (demo ? "?demo=1" : "")).then(setD).finally(() => setLoading(false)); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [demo]);

  return (
    <div>
      <PageHeader
        title="مركز القيادة"
        sub="ماذا يجب أن يعرفه صانع القرار الآن؟ — الصورة الكاملة خلال ٦٠ ثانية."
        actions={
          <Button aria-pressed={demo} onClick={() => setDemo(!demo)}>
            <Icon name="flask" size={14} />
            وضع العرض{demo ? " · مفعّل" : ""}
          </Button>
        }
      />

      {loading && <SkelCards count={4} />}
      {!loading && d?.empty && !demo && (
        <EmptyState title="لا بيانات مرصودة بعد" subtitle={d?.note} action={{ label: "وضع العرض", onClick: () => setDemo(true) }} />
      )}

      {!loading && d && (!d.empty || demo) && (
        <>
          {demo && (
            <div className="u-fine" style={{ marginBottom: "var(--s-4)", color: "var(--info)", display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
              <Icon name="flask" size={13} />
              {d.note}
            </div>
          )}

          {/* Executive brief — the one thing a decision-maker reads first */}
          <div className="u-section">
            <Callout
              label="الموجز التنفيذي"
              icon="brain"
              footer={
                d.urgent_recommendation ? (
                  <div className="u-priority">
                    <span style={{ color: "var(--danger)", marginTop: 2 }}><Icon name="siren" size={16} /></span>
                    <span><b>الأولوية الآن:</b> {d.urgent_recommendation}</span>
                  </div>
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
                        <span className="u-fine u-num" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <Icon name="clip" size={12} /> {fmt(r.evidence_count)} دليل
                        </span>
                        <EvidenceExplorer subject={r.entity} type="risk" score={r.risk} demo={demo} />
                      </div>
                    </Card>
                  );
                })}
              </Grid>
            </Section>
          )}

          {/* What changed */}
          {d.what_changed?.length > 0 && (
            <Section title="ما الذي تغيّر خلال ٢٤ ساعة" icon="refresh" count={d.what_changed.length}>
              {/* polarity around zero — the one thing the row list can't show */}
              <Card style={{ marginBottom: "var(--s-3)" }}>
                <CardHead title="حجم التغيّر واتجاهه" />
                {/* only rows whose change is an actual delta — "حملة جديدة" is prose,
                    not a number, and would plot as a meaningless zero-width bar */}
                <DeltaBars data={d.what_changed.filter((c: any) => /-?\d/.test(String(c.change))).map((c: any) => ({ label: c.entity, value: deltaNum(c.change) }))} />
              </Card>
              <Card>
                {d.what_changed.map((c: any, i: number) => {
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
            </Section>
          )}

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
