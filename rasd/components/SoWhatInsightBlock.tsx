"use client";
import { Icon, Badge, type Tone } from "@/components/ui";

/**
 * "So What" — turns a score/alert/insight into a decision. A presentational
 * block: it renders only the fields it is given, so a module passes whatever it
 * genuinely has (never placeholder prose). `confidence` 0–100 drives the label,
 * and a low score surfaces the human-review note.
 */
export type SoWhat = {
  what_happened?: string;
  why_it_matters?: string;
  evidence_summary?: string;
  likely_next_step?: string;
  recommended_action?: string;
  confidence?: number;        // 0–100
  uncertainty?: string;
};

function confLabel(c?: number): { label: string; tone: Tone; review: boolean } | null {
  if (c == null) return null;
  if (c >= 85) return { label: "ثقة عالية جداً", tone: "ok", review: false };
  if (c >= 65) return { label: "ثقة عالية", tone: "ok", review: false };
  if (c >= 45) return { label: "ثقة متوسطة", tone: "warn", review: false };
  return { label: "ثقة منخفضة", tone: "danger", review: true };
}

const ROWS: [keyof SoWhat, string, string][] = [
  ["what_happened", "ماذا حدث", "refresh"],
  ["why_it_matters", "لماذا يهمّ", "target"],
  ["evidence_summary", "ملخّص الأدلّة", "clip"],
  ["likely_next_step", "الخطوة المرجّحة تالياً", "trendUp"],
];

export default function SoWhatInsightBlock({ data, title = "ماذا يعني ذلك؟" }: { data: SoWhat; title?: string }) {
  const rows = ROWS.filter(([k]) => !!data[k]);
  if (!rows.length && !data.recommended_action) return null;
  const conf = confLabel(data.confidence);
  return (
    <div className="sowhat">
      <div className="sowhat-h">
        <span className="sowhat-t"><Icon name="brain" size={14} /> {title}</span>
        {conf && <Badge t={conf.tone} dot>{conf.label}{data.confidence != null ? ` ${data.confidence}%` : ""}</Badge>}
      </div>
      <div className="sowhat-rows">
        {rows.map(([k, label, icon]) => (
          <div className="sowhat-row" key={k}>
            <span className="sowhat-ic"><Icon name={icon as any} size={13} /></span>
            <div><b className="sowhat-label">{label}:</b> <span className="sowhat-val">{data[k]}</span></div>
          </div>
        ))}
      </div>
      {data.recommended_action && (
        <div className="sowhat-act"><Icon name="bolt" size={14} /> <b>الإجراء الموصى به:</b> {data.recommended_action}</div>
      )}
      {conf?.review && <div className="u-fine" style={{ color: "var(--danger)", marginTop: 6 }}>ثقة منخفضة — يتطلّب مراجعة بشرية قبل القرار.</div>}
      {data.uncertainty && <div className="u-fine" style={{ marginTop: 6 }}>{data.uncertainty}</div>}
    </div>
  );
}
