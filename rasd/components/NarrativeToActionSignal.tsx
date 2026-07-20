"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { Icon, Badge, type Tone } from "@/components/ui";
import EvidenceChainDrawer from "@/components/EvidenceChainDrawer";

/**
 * Narrative-to-Action Signal — detects when online anger starts using real-world
 * mobilization language (protest / boycott / strike / roadblock / accountability).
 * Pure observation: it counts real phrase matches in stored text (via
 * /api/evidence/action-signals), never infers intent. Low volume says so.
 */
const CAT_AR: Record<string, string> = {
  protest: "دعوات احتجاج / تظاهر", boycott: "دعوات مقاطعة", strike: "دعوات إضراب",
  accountability: "دعوات محاسبة", roadblock: "قطع طرق",
};
const PLAT_AR: Record<string, string> = { x: "إكس", news: "أخبار", telegram: "تيليجرام", facebook: "فيسبوك", reddit: "ريديت" };
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

function levelOf(total: number): { ar: string; tone: Tone } {
  if (total >= 50) return { ar: "مرتفع", tone: "danger" };
  if (total >= 15) return { ar: "متوسط", tone: "warn" };
  if (total >= 3) return { ar: "منخفض", tone: "ok" };
  return { ar: "لا يُذكر", tone: "neutral" };
}

export default function NarrativeToActionSignal({ subject, sinceDays = 14, compact }: { subject?: string; sinceDays?: number; compact?: boolean }) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = subject ? `&q=${encodeURIComponent(subject)}` : "";
    apiGet(`/api/evidence/action-signals?since_days=${sinceDays}${q}`).then(setD).catch(() => setD(null)).finally(() => setLoading(false));
  }, [subject, sinceDays]);

  if (loading) return null;
  if (!d || d.available === false) return null;

  const signals = d.signals || [];
  const total = d.total || 0;
  const lvl = levelOf(total);
  const facets = d.platform_facets || {};
  const confidence = d.scanned >= 300 ? "متوسطة–عالية" : d.scanned >= 100 ? "متوسطة" : "منخفضة";

  if (compact) {
    return (
      <div className="cbox" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Icon name="siren" size={15} />
        <b style={{ fontSize: 13.5 }}>التحوّل إلى فعل</b>
        <Badge t={lvl.tone} dot>{lvl.ar}</Badge>
        {total > 0 && <span className="u-fine">{fmt(total)} إشارة تعبئة · {signals.slice(0, 2).map((s: any) => CAT_AR[s.category]).join("، ")}</span>}
        {total === 0 && <span className="u-fine">لا لغة تعبئة ملحوظة حالياً.</span>}
      </div>
    );
  }

  return (
    <div className="cbox">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Icon name="siren" size={15} /> مؤشّر التحوّل إلى فعل
        </span>
        <Badge t={lvl.tone} dot>مستوى {lvl.ar}</Badge>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>لغة تعبئة نحو فعل واقعي مرصودة في النصوص المخزّنة{subject ? ` حول «${subject}»` : ""} — رصد لا استنتاج.</p>

      {total === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>لا لغة تعبئة ملحوظة في هذه الفترة (فُحص {fmt(d.scanned)} نص).</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {signals.map((s: any) => (
              <span key={s.category} className="chip" style={{ fontSize: 12 }}>
                {CAT_AR[s.category] || s.category} <b style={{ marginInlineStart: 4 }}>{fmt(s.count)}</b>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <span className="u-fine">أين: {Object.entries(facets).map(([p, n]: any) => `${PLAT_AR[p] || p} ${fmt(n)}`).join(" · ")}</span>
            <span className="u-fine">· ثقة {confidence} (فُحص {fmt(d.scanned)} نص)</span>
          </div>
          {(d.samples || []).length > 0 && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
              {(d.samples || []).slice(0, 4).map((s: any, i: number) => (
                <div key={i} style={{ fontSize: 12.5, padding: "4px 0", lineHeight: 1.7 }}>
                  <span className="chip" style={{ fontSize: 10, color: "#fb923c" }}>{s.matched}</span> <span className="muted">{PLAT_AR[s.platform] || s.platform}:</span> {s.text}
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 8 }}><EvidenceChainDrawer subject={subject || signals[0]?.phrases?.[0] || "احتجاج"} context="تحوّل إلى فعل" /></div>
        </>
      )}
      <p className="u-fine" style={{ marginTop: 8 }}>رصد لغوي للنصوص فقط — وجود العبارة لا يعني بالضرورة نيّة فعل، ويتطلّب قراءة بشرية.</p>
    </div>
  );
}
