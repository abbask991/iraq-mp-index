"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useDemo } from "@/components/ui/DemoContext";
import { Icon, Badge } from "@/components/ui";

/**
 * Opportunity Radar — the platform isn't only about threats. Surfaces positive
 * openings the client can act on, from the executive brief's real
 * `top_opportunities` (the AI brief grounded in stored data) plus the most-
 * improved entity from the command center. Only shows what those sources produce.
 */
export default function OpportunityRadar({ compact }: { compact?: boolean }) {
  const { demo } = useDemo();
  const [ops, setOps] = useState<any[]>([]);
  const [improved, setImproved] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGet("/api/brief/executive" + (demo ? "?demo=1" : ""))
      .then((r) => setOps(r?.sections?.["3_top_opportunities"] || []))
      .catch(() => setOps([]))
      .finally(() => setLoading(false));
    apiGet("/api/command-center" + (demo ? "?demo=1" : "")).then((d) => setImproved(d?.most_improved)).catch(() => {});
  }, [demo]);

  if (loading) return null;
  const hasImproved = improved?.entity;
  if (!ops.length && !hasImproved) return null;

  if (compact) {
    return (
      <div className="cbox" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Icon name="trendUp" size={15} />
        <b style={{ fontSize: 13.5 }}>رادار الفرص</b>
        <Badge t="ok" dot>{ops.length + (hasImproved ? 1 : 0)} فرصة</Badge>
        {ops[0]?.title && <span className="u-fine">{ops[0].title}</span>}
      </div>
    );
  }

  return (
    <div className="cbox">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Icon name="trendUp" size={15} /><h4 style={{ margin: 0 }}>رادار الفرص</h4>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>ليست المنصّة عن التهديدات فقط — فرص يمكن التحرّك بها إيجابياً.</p>

      <div style={{ display: "grid", gap: 8 }}>
        {hasImproved && (
          <div className="cbox" style={{ borderInlineStart: "3px solid #22c55e" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <b>تحسّن في سمعة {improved.entity}</b>
              <Badge t="ok">+{improved.change}</Badge>
            </div>
            <div className="u-fine">نافذة لتعزيز السردية الإيجابية قبل أن تخفت — البناء على زخم إيجابي قائم.</div>
          </div>
        )}
        {ops.map((o: any, i: number) => (
          <div key={i} className="cbox" style={{ borderInlineStart: "3px solid #22c55e" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <b>{o.title}</b>
              {o.confidence && <Badge t="ok">ثقة {o.confidence}</Badge>}
            </div>
            {o.detail && <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{o.detail}</div>}
            {o.recommendation && <div style={{ fontSize: 12.5, marginTop: 4, color: "var(--accent)" }}>▸ {o.recommendation}</div>}
          </div>
        ))}
      </div>
      <p className="u-fine" style={{ marginTop: 8 }}>الفرص مستخرجة من الموجز التنفيذي القائم على بياناتك — تتطلّب تقييماً بشرياً قبل التنفيذ.</p>
    </div>
  );
}
