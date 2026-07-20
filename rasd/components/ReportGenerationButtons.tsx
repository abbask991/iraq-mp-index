"use client";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui";

/**
 * Report-generation actions — the client's decision-ready outputs, one click
 * away from any module. Each maps to a REAL report surface that already exists
 * (the six Reports tabs + the Export Center for executive/research documents),
 * so nothing here is a dead button.
 */
type Key = "daily" | "crisis" | "dossier" | "campaign" | "anger" | "corporate" | "executive" | "research" | "board";

const REPORTS: Record<Key, { ar: string; href: string; icon: IconName }> = {
  board: { ar: "موجز المجلس", href: "/monitor/reports?tab=board", icon: "target" },
  daily: { ar: "التقرير اليومي", href: "/monitor/reports?tab=daily", icon: "clip" },
  crisis: { ar: "تقرير الأزمات", href: "/monitor/reports?tab=crisis", icon: "siren" },
  dossier: { ar: "ملف كيان شامل", href: "/monitor/reports?tab=full", icon: "brain" },
  campaign: { ar: "تقرير الحملات", href: "/monitor/reports?tab=campaign", icon: "megaphone" },
  anger: { ar: "تقرير الغضب العام", href: "/monitor/reports?tab=anger", icon: "thermometer" },
  corporate: { ar: "تقرير سمعة الشركة", href: "/monitor/corporate", icon: "trendDown" },
  executive: { ar: "الموجز التنفيذي", href: "/monitor/reports?tab=export", icon: "target" },
  research: { ar: "مذكّرة بحثية", href: "/monitor/reports?tab=export", icon: "clip" },
};
const DEFAULT: Key[] = ["daily", "crisis", "dossier", "campaign", "anger", "executive"];

export default function ReportGenerationButtons({ only, title = "ولّد تقريراً" }: { only?: Key[]; title?: string }) {
  const keys = (only && only.length ? only : DEFAULT).filter((k) => REPORTS[k]);
  if (!keys.length) return null;
  return (
    <div className="rgb">
      {title && <span className="rgb-title"><Icon name="clip" size={13} /> {title}</span>}
      <div className="rgb-row">
        {keys.map((k) => {
          const r = REPORTS[k];
          return (
            <Link key={k} href={r.href} className="rgb-btn">
              <Icon name={r.icon} size={13} /> {r.ar}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
