"use client";
import { Icon, Badge } from "@/components/ui";
import EvidenceChainDrawer from "@/components/EvidenceChainDrawer";

/**
 * Reputation Attack Surface — the topics/weaknesses through which an entity or
 * brand is most exposed to attack. Built from the REAL negative drivers the
 * reputation/entity pipeline already extracts (drivers_negative / reputation_risk
 * drivers); no invented vulnerabilities. Each area links to its evidence chain.
 */
export default function ReputationAttackSurface({ entity, drivers, topPlatform }:
  { entity: string; drivers?: string[]; topPlatform?: string }) {
  const areas = (drivers || []).filter(Boolean).slice(0, 8);
  if (!areas.length) return null;

  return (
    <div className="cbox">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Icon name="target" size={15} /><h4 style={{ margin: 0 }}>سطح الهجوم على السمعة</h4>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
        المواضيع التي يكون {entity || "الكيان"} أكثر عرضة للهجوم من خلالها{topPlatform ? ` — الأبرز على ${topPlatform}` : ""}. مرتّبة حسب الحدّة.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {areas.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 10 }}>
            <Badge t={i === 0 ? "danger" : i < 3 ? "warn" : "neutral"} dot>{i === 0 ? "حادّ" : i < 3 ? "مرتفع" : "متوسط"}</Badge>
            <span style={{ flex: 1, fontSize: 13 }}>{a}</span>
            <EvidenceChainDrawer subject={`${entity} ${a}`.slice(0, 60)} context="سطح هجوم" compact />
          </div>
        ))}
      </div>
      <p className="u-fine" style={{ marginTop: 8 }}>مستخرَج من محرّكات السلبية المرصودة — دفاع مقترح: عالِج أعلى منطقتين استباقياً قبل أن تتحوّلا لسردية.</p>
    </div>
  );
}
