"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { useDemo } from "@/components/ui/DemoContext";
import { Icon } from "@/components/ui";

/**
 * PlatformContributionCard — the lightweight, contextual platform-contribution
 * summary the "breakdown display rule" calls for. The FULL breakdown lives only
 * in the Monitoring Hub; every other module shows this compact card and links
 * back with filters, instead of repeating a full breakdown table.
 *
 * Honesty: it shows only the fields the pipeline really produces — platform
 * share and the leading platform, from the same platform_activity the command
 * center already computes from the mentions table. The aspirational fields
 * (first-seen / amplification / media-pickup) are NOT shown, because a real
 * cross-platform journey engine doesn't exist yet. If no platform data is
 * available, the card renders nothing rather than inventing shares.
 *
 * Pass `platforms` to reuse a payload the page already fetched; omit it to let
 * the card self-fetch the national platform activity.
 */
type Plat = { platform: string; count?: number; pct?: number };

const PLAT_AR: Record<string, string> = {
  x: "إكس", facebook: "فيسبوك", telegram: "تيليجرام", tiktok: "تيك توك",
  instagram: "إنستغرام", youtube: "يوتيوب", news: "أخبار", reddit: "ريديت",
};
const PLAT_C: Record<string, string> = {
  x: "#4f9dff", facebook: "#1877f2", telegram: "#34d6c6", tiktok: "#f43f5e",
  instagram: "#ec4899", youtube: "#ef4444", news: "#a855f7", reddit: "#fb923c",
};

export default function PlatformContributionCard({
  platforms, entity, period, note, title = "مساهمة المنصّات",
}: { platforms?: Plat[]; entity?: string; period?: string; note?: string; title?: string }) {
  const { demo } = useDemo();
  const [fetched, setFetched] = useState<Plat[] | null>(null);

  useEffect(() => {
    if (platforms && platforms.length) return;      // page supplied data
    apiGet("/api/command-center" + (demo ? "?demo=1" : ""))
      .then((d) => setFetched(d?.platform_activity || []))
      .catch(() => setFetched([]));
  }, [platforms, demo]);

  const src = (platforms && platforms.length ? platforms : fetched) || [];
  if (!src.length) return null;

  const total = src.reduce((a, p) => a + (p.count ?? p.pct ?? 0), 0) || 1;
  const rows = src
    .map((p) => ({ platform: p.platform, share: p.pct != null ? p.pct : Math.round(((p.count || 0) / total) * 100) }))
    .filter((r) => r.share > 0)
    .sort((a, b) => b.share - a.share);
  if (!rows.length) return null;
  const top = rows[0];

  const q = new URLSearchParams({ src: "overview" });
  if (entity) q.set("q", entity);
  if (period) q.set("period", period);
  const href = `/monitor/sources?${q.toString()}`;

  return (
    <div className="pcc">
      <div className="pcc-head">
        <span className="pcc-title"><Icon name="network" size={13} /> {title}</span>
        <Link href={href} className="u-btn" data-variant="ghost"><Icon name="expand" size={12} /> عرض التحليل الكامل</Link>
      </div>
      <div className="pcc-lead">المنصّة الأبرز: <b>{PLAT_AR[top.platform] || top.platform}</b> · {top.share}%{rows.length > 1 ? ` · ${rows.length} منصّات نشطة` : ""}</div>
      <div className="pcc-bar">
        {rows.map((r) => (
          <div key={r.platform} title={`${PLAT_AR[r.platform] || r.platform}: ${r.share}%`}
            style={{ width: `${r.share}%`, background: PLAT_C[r.platform] || "#64748b" }} />
        ))}
      </div>
      <div className="pcc-legend">
        {rows.map((r) => (
          <span key={r.platform} className="pcc-leg">
            <i style={{ background: PLAT_C[r.platform] || "#64748b" }} />{PLAT_AR[r.platform] || r.platform} {r.share}%
          </span>
        ))}
      </div>
      <div className="pcc-note">{note || "المساهمة على مستوى المنصّة من الإشارات المرصودة. التفصيل الكامل في مركز الرصد."}</div>
    </div>
  );
}
