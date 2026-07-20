"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useDemo } from "@/components/ui/DemoContext";
import { Icon, Badge } from "@/components/ui";
import EvidenceChainDrawer from "@/components/EvidenceChainDrawer";

/**
 * Influence Leverage Points — where a client can act most effectively to reduce
 * risk. Derived from real concentration: the platform carrying most of the
 * conversation, the top anger driver, and the most-coordinated active campaign.
 * Each point states the real signal it rests on; actions are recommendations,
 * not guarantees.
 */
const PLAT_AR: Record<string, string> = { x: "إكس", facebook: "فيسبوك", telegram: "تيليجرام", tiktok: "تيك توك", news: "أخبار", instagram: "إنستغرام", youtube: "يوتيوب" };
const fmt = (n: number) => (n || 0).toLocaleString("en-US");

export default function InfluenceLeveragePoints({ d, anger }: { d?: any; anger?: any }) {
  const { demo } = useDemo();
  const [cc, setCc] = useState<any>(d || null);
  const [ang, setAng] = useState<any>(anger || null);

  useEffect(() => {
    if (d) { setCc(d); return; }
    apiGet("/api/command-center" + (demo ? "?demo=1" : "")).then(setCc).catch(() => setCc(null));
  }, [d, demo]);
  useEffect(() => {
    if (anger != null) { setAng(anger); return; }
    if (d) return;
    const q = `scope_type=country&scope_id=${encodeURIComponent("العراق")}&scope_name=${encodeURIComponent("العراق")}&period=week${demo ? "&demo=1" : ""}`;
    apiGet(`/api/indices/public-anger?${q}`).then(setAng).catch(() => setAng(null));
  }, [anger, d, demo]);

  if (!cc) return null;
  const pa = cc.platform_activity || [];
  const totalAct = pa.reduce((a: number, p: any) => a + (p.count ?? p.pct ?? 0), 0) || 1;
  const points: any[] = [];

  if (pa[0]) {
    const share = pa[0].pct != null ? pa[0].pct : Math.round(((pa[0].count || 0) / totalAct) * 100);
    if (share >= 25) points.push({
      title: `تركّز النقاش على ${PLAT_AR[pa[0].platform] || pa[0].platform}`, type: "تركّز المنصّة",
      reason: `${share}% من النشاط المرصود يجري على ${PLAT_AR[pa[0].platform] || pa[0].platform}.`,
      action: `وجّه ردّك ومتابعتك أولاً إلى ${PLAT_AR[pa[0].platform] || pa[0].platform} — هناك الأثر الأكبر.`,
      impact: "قد يبطئ تكرار السردية وتصاعدها.", subject: pa[0].platform,
    });
  }
  const dr = (ang?.drivers || [])[0];
  if (dr?.driver_name) points.push({
    title: `عالج الدافع: ${dr.driver_name}`, type: "دافع الغضب",
    reason: `الدافع الأبرز للغضب (${dr.contribution_score}% · ${fmt(dr.volume)} إشارة).`,
    action: "توضيح مباشر ومدعوم بالأدلّة حول هذا الدافع تحديداً.",
    impact: "معالجة الجذر أفعل من معالجة الأعراض.", subject: dr.driver_name,
  });
  const camp = (cc.active_campaigns || [])[0];
  if (camp?.hashtag) points.push({
    title: `حملة منسّقة: #${camp.hashtag}`, type: "شبكة تضخيم",
    reason: `تنسيق ${camp.coordination} — التضخيم مركّز في شبكة محدّدة.`,
    action: "تقصَّ المصدر والمضخّمين قبل الرد العام لتفادي تضخيم إضافي.",
    impact: "التعامل مع الشبكة أدقّ من الرد على كل منشور.", subject: camp.hashtag,
  });

  if (!points.length) return null;

  return (
    <div className="cbox">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Icon name="target" size={15} /><h4 style={{ margin: 0 }}>نقاط الرافعة للتأثير</h4>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>أين يكون التدخّل أكثر فعالية لخفض الخطر — مبني على تركّز الإشارات الفعلي.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {points.map((p, i) => (
          <div key={i} style={{ borderInlineStart: "3px solid var(--accent)", padding: "8px 12px", borderRadius: 8, background: "color-mix(in srgb, var(--accent) 4%, transparent)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <b>{p.title}</b>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className="chip" style={{ fontSize: 10.5 }}>{p.type}</span>
                <EvidenceChainDrawer subject={p.subject} context="رافعة تأثير" compact />
              </div>
            </div>
            <div className="u-fine">{p.reason}</div>
            <div style={{ fontSize: 12.5, marginTop: 4, color: "var(--accent)" }}>▸ {p.action}</div>
            <div className="u-fine">الأثر المتوقّع: {p.impact}</div>
          </div>
        ))}
      </div>
      <p className="u-fine" style={{ marginTop: 8 }}>توصيات قائمة على التركّز المرصود — تتطلّب حكماً بشرياً، والأثر تقديري لا مضمون.</p>
    </div>
  );
}
