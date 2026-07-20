"use client";
import Link from "next/link";
import { Badge, Icon, type Tone, type IconName } from "@/components/ui";

/**
 * "What Matters Now" — the top intelligence items a decision-maker should act on
 * right now, synthesized from the command-center payload the page already holds.
 * Nothing here is invented: every item traces to a real risk, campaign, trend,
 * change or anger reading, carries its real evidence count, and links back to the
 * module that holds the full picture. Confidence is derived from evidence volume,
 * and low-confidence items say so.
 */
export type MattersItem = {
  title: string;
  type: "risk" | "opportunity" | "narrative" | "campaign" | "anger" | "reputation" | "warning";
  tone: Tone;
  severity?: string;
  explanation?: string;
  entity?: string;
  evidence?: number;
  action?: string;
  href: string;
};

const TYPE_META: Record<MattersItem["type"], { icon: IconName; label: string }> = {
  risk: { icon: "alert", label: "خطر" },
  opportunity: { icon: "trendUp", label: "فرصة" },
  narrative: { icon: "fire", label: "سردية" },
  campaign: { icon: "megaphone", label: "حملة" },
  anger: { icon: "thermometer", label: "غضب عام" },
  reputation: { icon: "trendDown", label: "سمعة" },
  warning: { icon: "siren", label: "إنذار" },
};

/** Evidence volume → confidence label. Low confidence is stated, not hidden. */
export function confidenceOf(evidence?: number): { label: string; tone: Tone; review: boolean } {
  const e = evidence || 0;
  if (e >= 150) return { label: "ثقة عالية جداً", tone: "ok", review: false };
  if (e >= 50) return { label: "ثقة عالية", tone: "ok", review: false };
  if (e >= 12) return { label: "ثقة متوسطة", tone: "warn", review: false };
  return { label: "ثقة منخفضة", tone: "danger", review: true };
}

const toneOfLevel = (l?: string): Tone =>
  /حرج/.test(l || "") ? "crit" : /مرتفع/.test(l || "") ? "danger" : /متوسط/.test(l || "") ? "warn" : "ok";
const toneOfScore = (n: number): Tone => (n >= 70 ? "crit" : n >= 50 ? "danger" : n >= 30 ? "warn" : "ok");
const SEV_RANK: Record<Tone, number> = { crit: 4, danger: 3, warn: 2, ok: 1, info: 1, neutral: 0 };

/** Build the ranked top-N items from the real command-center payload (+ anger). */
export function buildMattersItems(d: any, anger?: any, limit = 5): MattersItem[] {
  const out: MattersItem[] = [];
  for (const r of d?.top_risks || []) {
    out.push({
      title: r.entity, type: "risk", tone: toneOfLevel(r.level), severity: `${r.level} · ${r.risk}`,
      explanation: r.reason, entity: r.entity, evidence: r.evidence_count, action: r.recommended_action,
      href: "/monitor/risk?tab=alerts",
    });
  }
  if (anger?.score != null && anger.score >= 30) {
    out.push({
      title: "مؤشر الغضب العام", type: "anger", tone: toneOfScore(anger.score),
      severity: `${anger.risk_level_ar || ""} · ${anger.score}`,
      explanation: anger.explanation?.summary, evidence: anger.confidence_score,
      action: (anger.explanation?.recommended_actions || [])[0], href: "/monitor/risk?tab=anger",
    });
  }
  for (const c of d?.active_campaigns || []) {
    out.push({
      title: `#${c.hashtag}`, type: "campaign", tone: toneOfLevel(c.level || "متوسط"),
      severity: `تنسيق ${c.coordination}`, explanation: "حملة نشطة عالية التنسيق — راقب المصدر والمضخّمين.",
      action: "افحص التنسيق والمصدر", href: `/monitor/campaigns?tab=coordination&q=${encodeURIComponent(c.hashtag || "")}`,
    });
  }
  for (const t of (d?.trending || []).slice(0, 3)) {
    out.push({
      title: t.topic, type: "narrative", tone: toneOfScore(Number(t.risk) || 0),
      severity: `سرعة ${t.velocity}`, explanation: `${t.sentiment} · ${(t.posts || 0).toLocaleString("en-US")} منشور`,
      href: "/monitor/risk?tab=trends-now",
    });
  }
  out.sort((a, b) => (SEV_RANK[b.tone] - SEV_RANK[a.tone]) || ((b.evidence || 0) - (a.evidence || 0)));
  return out.slice(0, limit);
}

export default function WhatMattersNow({ items, platformNote }: { items: MattersItem[]; platformNote?: string }) {
  if (!items.length) return null;
  return (
    <div className="wmn">
      <div className="wmn-head">
        <span className="wmn-title"><Icon name="target" size={15} /> ما الذي يهمّك الآن</span>
        <span className="u-fine">أهم {items.length} — مرتّبة حسب الأولوية</span>
      </div>
      <div className="wmn-list">
        {items.map((it, i) => {
          const m = TYPE_META[it.type];
          const conf = confidenceOf(it.evidence);
          return (
            <Link key={i} href={it.href} className="wmn-item">
              <span className={"wmn-rank wmn-" + it.tone}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="wmn-item-h">
                  <Badge t={it.tone} dot>{m.label}</Badge>
                  <b className="wmn-item-t">{it.title}</b>
                  {it.severity && <span className="u-fine">{it.severity}</span>}
                </div>
                {it.explanation && <div className="wmn-exp">{it.explanation}</div>}
                <div className="wmn-meta">
                  {it.action && <span className="wmn-act"><Icon name="bolt" size={12} /> {it.action}</span>}
                  <span className="wmn-conf" style={{ marginInlineStart: "auto" }}>
                    <Badge t={conf.tone}>{conf.label}</Badge>
                    {it.evidence != null && it.type !== "anger" && <span className="u-fine u-num"> · {(it.evidence || 0).toLocaleString("en-US")} دليل</span>}
                  </span>
                </div>
                {conf.review && <div className="u-fine" style={{ color: "var(--danger)" }}>يتطلّب مراجعة بشرية قبل الاعتماد.</div>}
              </div>
              <span className="wmn-go"><Icon name="expand" size={13} /></span>
            </Link>
          );
        })}
      </div>
      {platformNote && <div className="wmn-note"><Icon name="network" size={12} /> {platformNote}</div>}
    </div>
  );
}
