"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { moduleByRoute, relatedFor } from "@/lib/modules";
import { Icon } from "@/components/ui";

/**
 * "Related modules" cards, rendered once by the console layout under whatever
 * module is active (derived from the path). Turns the flat 11-module list into a
 * navigable graph — from Risk you reach Command, Campaigns, Narratives without
 * going back to the sidebar. Hidden on non-module routes and when printing.
 */
export default function RelatedModules({ lang }: { lang: string }) {
  const path = usePathname();
  const current = moduleByRoute(path);
  const related = relatedFor(current?.key);
  if (!current || !related.length) return null;

  return (
    <div className="related-mods no-print">
      <div className="related-mods-h">{lang === "en" ? "Related modules" : "وحدات ذات صلة"}</div>
      <div className="related-mods-grid">
        {related.map((m) => (
          <Link key={m.key} href={m.route} className="related-card">
            <span className="related-card-t">{lang === "en" ? m.en : m.ar}</span>
            <Icon name="expand" size={14} />
          </Link>
        ))}
      </div>
    </div>
  );
}
