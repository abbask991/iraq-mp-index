"use client";
import { useState } from "react";
import { intelPost } from "@/lib/api";
import { Icon, Badge } from "@/components/ui";

/**
 * Decision Simulator — "what happens if we…". A reusable panel over the real
 * scenario engine (/api/intelligence/scenario → scenario_simulator), which
 * projects the likely media reaction to a strategic decision from an entity's
 * current state. Explicitly probabilistic: shows baseline → projected with
 * deltas, a probability, the rationale, and a decision-support disclaimer.
 * Entity-scoped (the engine builds the entity's twin), so it lives in entity
 * detail views where an entity_id exists.
 */
const SCENARIOS: [string, string][] = [
  ["official_response", "إصدار بيان / ردّ رسمي"],
  ["no_response", "الصمت / عدم الرد"],
  ["delete_post", "حذف منشور مثير للجدل"],
  ["counter_campaign", "إطلاق حملة مضادة"],
  ["ally_statement", "تدخّل حليف مؤثّر"],
];
// risk & escalation: lower is better (green when delta<0); reputation: higher is better
const METRICS: [string, string, 1 | -1][] = [["risk", "الخطر", -1], ["escalation", "التصعيد", -1], ["reputation", "السمعة", 1]];

export default function DecisionSimulator({ entityId, name }: { entityId: string; name?: string }) {
  const [scenario, setScenario] = useState("");
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async (s: string) => {
    setScenario(s); setLoading(true); setD(null);
    const r = await intelPost("/scenario", { entity_id: entityId, scenario: s }).catch(() => null);
    setD(r); setLoading(false);
  };

  const base = d?.baseline || {};
  const proj = d?.projected || {};
  const deltas = d?.deltas || {};

  return (
    <div className="cbox">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Icon name="target" size={15} /><h4 style={{ margin: 0 }}>محاكي القرار</h4>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>ماذا يحدث لو اتّخذ {name || "هذا الكيان"} قراراً الآن؟ — إسقاط احتمالي لردّ الفعل الإعلامي.</p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {SCENARIOS.map(([k, label]) => (
          <button key={k} className={"btn" + (scenario === k ? "" : " ghost")} style={{ fontSize: 12, padding: "5px 11px" }}
            onClick={() => run(k)} disabled={loading}>{label}</button>
        ))}
      </div>

      {loading && <div><span className="spinner" /> يُسقط السيناريو…</div>}

      {d && !loading && (d.error ? <p className="muted">تعذّر — {d.message || "لا بيانات كافية عن الكيان."}</p> : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <b>{d.label}</b>
            {d.probability != null && <Badge t={d.probability >= 0.6 ? "ok" : d.probability >= 0.45 ? "warn" : "danger"}>احتمالية {Math.round(d.probability * 100)}%</Badge>}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {METRICS.map(([k, label, good]) => {
              const b = base[k], p = proj[k], dl = deltas[k];
              if (p == null) return null;
              const better = dl != null && (good === -1 ? dl < 0 : dl > 0);
              const worse = dl != null && dl !== 0 && !better;
              const col = dl === 0 || dl == null ? "var(--muted)" : better ? "#22c55e" : "#f43f5e";
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{label}</span>
                  <span className="u-num muted">{b}</span>
                  <Icon name="expand" size={11} />
                  <span className="u-num" style={{ fontWeight: 800 }}>{p}</span>
                  {dl != null && dl !== 0 && <span className="u-num" style={{ color: col, minWidth: 40, textAlign: "left" }}>{dl > 0 ? "+" : ""}{dl}{worse ? " ⚠" : better ? " ✓" : ""}</span>}
                </div>
              );
            })}
          </div>

          {d.rationale && <p style={{ fontSize: 13, lineHeight: 1.9, marginTop: 10 }}>{d.rationale}</p>}
          <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{d.disclaimer || "إسقاط احتمالي لدعم القرار — ليس تنبّؤاً قاطعاً، ويتطلّب قراءة بشرية."}</p>
        </>
      ))}
    </div>
  );
}
