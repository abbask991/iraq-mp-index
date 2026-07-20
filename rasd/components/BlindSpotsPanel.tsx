"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useDemo } from "@/components/ui/DemoContext";
import { Icon, Badge, type Tone } from "@/components/ui";

/**
 * Blind Spots & Coverage Gaps — what the platform does NOT know yet. Transparency
 * builds trust: every gap here is real (a platform with no collector, comments not
 * stored, a stale run, failed jobs, thin volume), read from the live health +
 * coverage feeds — never a generic disclaimer.
 */
type Spot = { spot: string; impact: string; confImpact: number; fix: string; tone: Tone };
const MAJOR: Record<string, string> = { telegram: "تيليجرام", tiktok: "تيك توك", instagram: "إنستغرام" };

export default function BlindSpotsPanel({ compact }: { compact?: boolean }) {
  const { demo } = useDemo();
  const [health, setHealth] = useState<any>(null);
  const [cc, setCc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet("/api/settings/health").catch(() => null),
      apiGet("/api/command-center" + (demo ? "?demo=1" : "")).catch(() => null),
    ]).then(([h, d]) => { setHealth(h); setCc(d); }).finally(() => setLoading(false));
  }, [demo]);

  if (loading) return null;
  const cov = cc?.coverage || {};
  const present = new Set((cc?.platform_activity || []).map((p: any) => p.platform));
  const spots: Spot[] = [];

  Object.entries(MAJOR).forEach(([k, ar]) => {
    if (!present.has(k)) spots.push({ spot: `${ar} غير مجموعة في هذه الدورة`, impact: `قد يكون مزاج جمهور ${ar} غير ممثَّل.`, confImpact: k === "telegram" ? -14 : -8, fix: `فعِّل جمع ${ar} للقضايا ذات الأولوية.`, tone: k === "telegram" ? "danger" : "warn" });
  });
  if (cov.comments == null) spots.push({ spot: "تعليقات فيسبوك غير مخزّنة", impact: "عمق الغضب في التعليقات غير محتسب.", confImpact: -10, fix: "تطبيق ترحيل 011 لتخزين المنشورات/التعليقات.", tone: "warn" });
  const age = health?.metrics?.last_collection_age_hours;
  if (age != null && age > 24) spots.push({ spot: `آخر جمع قبل ${Math.round(age / 24)} يوم`, impact: "الإشارات الحديثة قد تكون غائبة.", confImpact: -18, fix: "افحص الإيقاف الطارئ ومفاتيح المزوّدين.", tone: "danger" });
  if ((health?.metrics?.failed_jobs || 0) > 0) spots.push({ spot: `${health.metrics.failed_jobs} مهمة جمع فاشلة`, impact: "تغطية غير مكتملة لبعض الأهداف.", confImpact: -6, fix: "راجع سجلّ الجمع في صحة المصادر.", tone: "warn" });
  (health?.blockers || []).filter((b: any) => b.key === "apify").forEach((b: any) => spots.push({ spot: b.label, impact: "رصد فيسبوك محدود.", confImpact: -10, fix: b.fix, tone: "warn" }));
  if (cov.signals != null && cov.signals < 1000) spots.push({ spot: "حجم بيانات منخفض", impact: "الاستنتاجات أقل ثقة على عيّنة صغيرة.", confImpact: -8, fix: "وسّع الكلمات المفتاحية أو الفترة الزمنية.", tone: "warn" });

  if (!spots.length) return null;
  const totalImpact = spots.reduce((a, s) => a + s.confImpact, 0);

  if (compact) {
    return (
      <div className="cbox" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderInlineStart: "3px solid #f59e0b" }}>
        <Icon name="alert" size={15} />
        <b style={{ fontSize: 13.5 }}>نقاط عمياء</b>
        <Badge t="warn">{spots.length}</Badge>
        <span className="u-fine">أثر على الثقة ~{totalImpact} · أبرزها: {spots[0].spot}</span>
      </div>
    );
  }

  return (
    <div className="cbox">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name="alert" size={15} /> النقاط العمياء وفجوات التغطية</span>
        <Badge t="warn">أثر ~{totalImpact} على الثقة</Badge>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>ما لا يعرفه النظام بعد — الشفافية جزء من الثقة.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {spots.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 10 }}>
            <Badge t={s.tone} dot>{s.confImpact}</Badge>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.spot}</div>
              <div className="u-fine">{s.impact} — الحل: {s.fix}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
