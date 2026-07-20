"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useDemo } from "@/components/ui/DemoContext";
import { Icon, Badge } from "@/components/ui";

/**
 * Beneficiary Analysis — "who might benefit from this narrative/crisis?" framed as
 * careful analytical INFERENCE, never attribution or accusation. It rests on real
 * deltas: an entity whose reputation improved while another was attacked in the
 * same window is a *possible* indirect beneficiary — nothing more. Every item
 * carries a caution note and a human-review flag.
 */
export default function BeneficiaryAnalysisPanel({ d, compact }: { d?: any; compact?: boolean }) {
  const { demo } = useDemo();
  const [cc, setCc] = useState<any>(d || null);
  useEffect(() => {
    if (d) { setCc(d); return; }
    apiGet("/api/command-center" + (demo ? "?demo=1" : "")).then(setCc).catch(() => setCc(null));
  }, [d, demo]);

  if (!cc) return null;
  const damaged = cc.most_damaged;
  const improved = cc.most_improved;
  if (!improved?.entity) return null; // no observable beneficiary signal → say nothing

  const gain = Number(improved.change) || 0;
  const score = Math.min(85, 45 + gain * 2); // bounded; never certainty
  const benefitType = damaged?.entity ? "أفضلية سردية / سمعة نسبية" : "مكسب ظهور إعلامي";
  const explanation = damaged?.entity
    ? `تحسّنت سمعة «${improved.entity}» (+${gain}) في الفترة نفسها التي تراجعت فيها سمعة «${damaged.entity}» (${damaged.change}) — قد يمثّل هذا أفضلية نسبية غير مباشرة.`
    : `ارتفع ظهور «${improved.entity}» بمقدار +${gain} خلال الفترة — مكسب ظهور محتمل.`;

  if (compact) {
    return (
      <div className="cbox" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Icon name="trendUp" size={15} />
        <b style={{ fontSize: 13.5 }}>مستفيد محتمل</b>
        <Badge t="info" dot>{improved.entity}</Badge>
        <span className="u-fine">استنتاج تحليلي — يتطلّب مراجعة بشرية.</span>
      </div>
    );
  }

  return (
    <div className="cbox">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Icon name="target" size={15} /><h4 style={{ margin: 0 }}>من قد يستفيد؟</h4>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>تحليل احتمالي للمستفيد غير المباشر — ليس اتهاماً ولا إسناداً.</p>
      <div style={{ borderInlineStart: "3px solid #4f9dff", padding: "8px 12px", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <b>مستفيد محتمل: {improved.entity}</b>
          <div style={{ display: "flex", gap: 6 }}>
            <span className="chip" style={{ fontSize: 10.5 }}>{benefitType}</span>
            <Badge t="info">درجة {score}</Badge>
          </div>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.8, margin: "6px 0 0" }}>{explanation}</p>
        <div className="u-fine" style={{ marginTop: 4, color: "var(--warn, #f59e0b)" }}>تنبيه: استنتاج تحليلي من تغيّرات السمعة المرصودة — قد يكون تزامناً لا سببية. يتطلّب مراجعة بشرية قبل أي خلاصة.</div>
      </div>
    </div>
  );
}
