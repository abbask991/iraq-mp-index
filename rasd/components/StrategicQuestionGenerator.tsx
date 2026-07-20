"use client";
import Link from "next/link";
import { Icon } from "@/components/ui";

/**
 * Strategic Question Generator — the questions a good analyst should ask next.
 * Deterministic guidance (optionally contextualized with the current entity),
 * each wired to where the answer lives — pre-fills the analyst box via onPick, or
 * links to the module otherwise. Not AI-invented content; a guided-thinking aid.
 */
type Q = { q: string; href?: string };

export default function StrategicQuestionGenerator({ entity, onPick }: { entity?: string; onPick?: (q: string) => void }) {
  const e = entity ? `«${entity}»` : "هذه القضية";
  const questions: Q[] = [
    { q: "ما الذي تغيّر خلال آخر ٢٤ ساعة؟", href: "/monitor/command" },
    { q: `من قد يستفيد من ${e}؟`, href: "/monitor/narratives" },
    { q: "هل الغضب عضوي أم مضخّم؟", href: "/monitor/campaigns?tab=coordination" },
    { q: "أي منصّة يجب أن نراقب تالياً؟", href: "/monitor/sources" },
    { q: "ما الأدلّة التي ما زالت ناقصة؟", href: "/monitor/sources?src=health" },
    { q: `هل يُرجّح أن تتحوّل ${e} إلى أزمة؟`, href: "/monitor/risk" },
    { q: "أي تقرير ينبغي توليده الآن؟", href: "/monitor/reports" },
    { q: `هل حدث نمط ${e} من قبل؟` },
    { q: "ما الرد الذي يخفّض الخطر أكثر؟", href: "/monitor/risk" },
  ];

  return (
    <div className="cbox">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Icon name="brain" size={15} /><h4 style={{ margin: 0 }}>أسئلة استراتيجية تستحق الطرح</h4>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>وجّه تحليلك بالأسئلة الصحيحة — اضغط سؤالاً لطرحه أو لفتح مصدر إجابته.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {questions.map((item, i) => (
          onPick ? (
            <button key={i} className="btn ghost" style={{ fontSize: 12.5, padding: "6px 12px" }} onClick={() => onPick(item.q)}>{item.q}</button>
          ) : item.href ? (
            <Link key={i} href={item.href} className="btn ghost" style={{ fontSize: 12.5, padding: "6px 12px", textDecoration: "none" }}>{item.q}</Link>
          ) : (
            <span key={i} className="chip" style={{ fontSize: 12.5 }}>{item.q}</span>
          )
        ))}
      </div>
    </div>
  );
}
