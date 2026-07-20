"use client";
import { SkelCards } from "@/components/Skeleton";
import { Donut, Spark } from "@/components/MiniCharts";
import EvidenceChainDrawer from "@/components/EvidenceChainDrawer";
import ReputationAttackSurface from "@/components/ReputationAttackSurface";
import { useBrand } from "../useBrand";

const col = (v: number) => (v >= 60 ? "#22c55e" : v >= 40 ? "#f59e0b" : "#f43f5e");
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

/** Brand reputation — moved verbatim from /corporate/reputation. The page's
 *  own brand input, demo toggle and fetch are gone; the host owns them. */
export default function ReputationView({ brand, demo }: { brand: string; demo: boolean }) {
  const { d, loading } = useBrand("reputation", brand, demo);
  const s = d?.sentiment || {};
  if (loading) return <SkelCards count={3} />;
  if (d?.empty) return <div className="cbox">{d.note}</div>;
  if (!d) return null;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <EvidenceChainDrawer subject={brand} context="سمعة العلامة" />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {[["السمعة", d.reputation_score], ["الخطر", d.risk_score], ["فجوة التفاعل/التعليق", d.reaction_comment_gap]].map(([l, v]: any) => (
          <div key={l} style={{ flex: "1 1 130px", textAlign: "center", padding: "12px 8px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--input)" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: col(l === "الخطر" ? 100 - (v || 0) : v || 0) }}>{v ?? "—"}</div>
            <div className="muted" style={{ fontSize: 11.5 }}>{l}</div>
          </div>
        ))}
      </div>
      {(d.drivers_negative || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <ReputationAttackSurface entity={brand} drivers={d.drivers_negative} topPlatform="فيسبوك" />
        </div>
      )}
      <div className="grid" style={{ marginBottom: 14 }}>
        {(s.positive != null) && (
          <div className="cbox" style={{ textAlign: "center" }}>
            <h4 style={{ marginTop: 0 }}>مشاعر الجمهور</h4>
            <Donut size={120} segments={[{ value: s.positive, color: "#22c55e" }, { value: s.neutral, color: "#8a97ad" }, { value: s.negative, color: "#f43f5e" }]} label={`${s.negative}%-`} />
            <div style={{ fontSize: 12 }}><span style={{ color: "#22c55e" }}>إيجابي {s.positive}%</span> · <span style={{ color: "#f43f5e" }}>سلبي {s.negative}%</span></div>
            {d.gap_note && <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{d.gap_note}</p>}
          </div>
        )}
        {d.trend?.length > 0 && (
          <div className="cbox">
            <h4 style={{ marginTop: 0 }}>اتجاه السمعة</h4>
            <Spark data={d.trend} color={col(d.reputation_score || 0)} height={70} />
            {d.trend_note && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{d.trend_note}</div>}
          </div>
        )}
      </div>
      <div className="grid" style={{ marginBottom: 14 }}>
        {d.drivers_negative?.length > 0 && <div className="cbox"><h4 style={{ color: "#f43f5e" }}>محرّكات السلبية</h4>{d.drivers_negative.map((x: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "3px 0" }}>• {x}</div>)}</div>}
        {d.drivers_positive?.length > 0 && <div className="cbox"><h4 style={{ color: "#22c55e" }}>محرّكات الإيجابية</h4>{d.drivers_positive.map((x: string, i: number) => <div key={i} style={{ fontSize: 13, padding: "3px 0" }}>• {x}</div>)}</div>}
      </div>
      {d.top_mentions?.length > 0 && (
        <div className="cbox" style={{ marginBottom: 14 }}><h4>أبرز الإشارات</h4>
          {d.top_mentions.map((m: any, i: number) => <div key={i} style={{ fontSize: 12.5, padding: "4px 0", borderTop: i ? "1px solid var(--line)" : 0 }}><span style={{ color: /سلب/.test(m.sentiment) ? "#f43f5e" : "#22c55e" }}>●</span> {m.text} <span className="muted">· {fmt(m.reach)} وصول</span></div>)}
        </div>
      )}
      {d.recommended_action && <div className="cbox" style={{ marginBottom: 14, borderInlineStart: "4px solid #22c55e" }}>▸ <b>التوصية:</b> {d.recommended_action}</div>}
      <p className="muted" style={{ fontSize: 11 }}>{d.disclaimer}</p>
    </>
  );
}
