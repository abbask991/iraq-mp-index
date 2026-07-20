"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { moduleByRoute } from "@/lib/modules";

/**
 * Console breadcrumb: brand › module › active tab.
 *
 * The module comes from the path; the active tab is read from the URL param the
 * module uses (`tab`, or `src` for Monitoring Hub). Because the Tabs primitive
 * writes that param on every click, the trail stays correct as you switch tabs.
 * Falls back to `fallback` (the nav section title) for routes not in the module
 * registry — war room, watchlist, entity detail pages.
 *
 * Renders only the module/tab segments; the caller draws the brand + first chevron.
 */
export default function Breadcrumb({ fallback, lang }: { fallback: string; lang: string }) {
  const path = usePathname();
  const search = useSearchParams();
  const m = moduleByRoute(path);

  if (!m) return <span className="cb-section">{fallback}</span>;

  const modLabel = lang === "en" ? m.en : m.ar;
  const tabKey = search?.get(m.param || "tab") || "";
  const tab = m.tabs?.find((t) => t.key === tabKey);

  return (
    <>
      <Link href={m.route} className="cb-section cb-crumb-link">{modLabel}</Link>
      {tab && (
        <>
          <span className="cb-chev">›</span>
          <span className="cb-section cb-crumb-tab">{tab.label}</span>
        </>
      )}
    </>
  );
}
