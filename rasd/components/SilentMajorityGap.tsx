"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { Icon, Badge, type Tone } from "@/components/ui";

/**
 * Silent Majority Gap — distinguishes loud online noise from broad public depth,
 * so a small-but-loud group isn't mistaken for public opinion. Computed from real
 * evidence metrics: platform diversity, unique-author spread, volume, and the
 * posts-per-author concentration (a coordination tell). Every label states its
 * reasoning; nothing is asserted beyond what the metrics show.
 */
const PLAT_AR: Record<string, string> = { x: "إكس", news: "أخبار", telegram: "تيليجرام", facebook: "فيسبوك", reddit: "ريديت" };
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

export default function SilentMajorityGap({ subject, compact }: { subject?: string; compact?: boolean }) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = subject ? `q=${encodeURIComponent(subject)}&` : "";
    apiGet(`/api/evidence/search?${q}since_days=14&limit=120`).then(setD).catch(() => setD(null)).finally(() => setLoading(false));
  }, [subject]);

  if (loading || !d) return null;
  const items = d.items || [];
  const count = d.count || 0;
  if (count < 3) return null; // not enough to judge depth

  const facets = d.platform_facets || {};
  const platforms = Object.keys(facets).length;
  const authors = new Set(items.map((i: any) => i.author).filter(Boolean)).size || 1;
  const concentration = count / authors;               // posts per author
  const negRatio = items.filter((i: any) => /سلب|غاضب|غضب|إحباط/.test((i.sentiment || "") + (i.emotion || ""))).length / (items.length || 1);

  let label = "قضية عامة قيد النمو", tone: Tone = "info", explain = "";
  if (authors >= 5 && concentration >= 4) {
    label = "تضخيم منسّق محتمل"; tone = "danger";
    explain = `عدد قليل نسبياً من الحسابات (${fmt(authors)}) ينتج حجماً كبيراً (${(concentration).toFixed(1)} منشور/حساب) — نمط تضخيم لا عمق عضوي.`;
  } else if (platforms <= 1 && count >= 15) {
    label = "ضجيج عالٍ، عمق عام محدود"; tone = "warn";
    explain = `النشاط مرتفع لكنه محصور في منصّة واحدة (${PLAT_AR[Object.keys(facets)[0]] || Object.keys(facets)[0]}) — صخب أكثر منه قلقاً واسعاً.`;
  } else if (platforms >= 3 && count >= 15) {
    label = "قلق عام واسع"; tone = "danger";
    explain = `النشاط منتشر عبر ${platforms} منصّات بحجم معتبر — مؤشّر على اهتمام عام حقيقي لا مجرّد ضجيج.`;
  } else if (count < 10 && negRatio > 0.5) {
    label = "حجم منخفض، غضب عميق"; tone = "warn";
    explain = "الحجم صغير لكن النبرة سلبية بعمق — قد يكبر؛ يستحق المتابعة لا الذعر.";
  } else if (platforms <= 1) {
    label = "نقاش على منصّة واحدة"; tone = "info";
    explain = "الحديث محصور في منصّة واحدة — تمثيل محدود للرأي العام الأوسع.";
  } else {
    explain = `منتشر عبر ${platforms} منصّات بحجم ${fmt(count)} — قضية عامة في طور التشكّل.`;
  }

  if (compact) {
    return (
      <div className="cbox" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Icon name="brain" size={15} />
        <b style={{ fontSize: 13.5 }}>ضجيج أم عمق؟</b>
        <Badge t={tone} dot>{label}</Badge>
        <span className="u-fine">{platforms} منصّات · {fmt(authors)} حساب · {fmt(count)} إشارة</span>
      </div>
    );
  }

  return (
    <div className="cbox">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Icon name="brain" size={15} /> فجوة الأغلبية الصامتة
        </span>
        <Badge t={tone} dot>{label}</Badge>
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.9, margin: "0 0 8px" }}>{explain}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span className="chip" style={{ fontSize: 11 }}>منصّات: {platforms}</span>
        <span className="chip" style={{ fontSize: 11 }}>حسابات فريدة: {fmt(authors)}</span>
        <span className="chip" style={{ fontSize: 11 }}>منشور/حساب: {concentration.toFixed(1)}</span>
        <span className="chip" style={{ fontSize: 11 }}>سلبية: {Math.round(negRatio * 100)}%</span>
      </div>
      <p className="u-fine" style={{ marginTop: 8 }}>قياس نسبي من عيّنة الإشارات — لا يقيس الرأي غير المتصل بالإنترنت. ثقة تتناسب مع تنوّع المصادر.</p>
    </div>
  );
}
