"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Icon, { type IconName } from "./Icon";

export type TabDef = { key: string; label: string; icon?: IconName; group?: string };

/**
 * URL-driven tab strip (`?tab=`).
 *
 * Driven by the URL rather than useState so a tab is a shareable link, the back
 * button works, and the redirects planned for the 63→25 consolidation can land
 * on a specific tab. Requires a <Suspense> boundary above it (useSearchParams
 * opts the route out of static rendering) — one is in the monitor layout.
 *
 * Groups render as labelled runs inside one scrollable row: 13 flat buttons
 * wrapped onto three ragged rows and read as a pile, not a structure.
 */
export default function Tabs({ tabs, value, onChange, param = "tab" }: {
  tabs: TabDef[];
  value: string;
  onChange?: (key: string) => void;
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const select = (key: string) => {
    const q = new URLSearchParams(search?.toString() || "");
    q.set(param, key);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    onChange?.(key);
  };

  // preserve declaration order; a run is a contiguous block sharing a group
  const runs: { group?: string; items: TabDef[] }[] = [];
  for (const t of tabs) {
    const last = runs[runs.length - 1];
    if (last && last.group === t.group) last.items.push(t);
    else runs.push({ group: t.group, items: [t] });
  }

  return (
    <div className="u-tabs" role="tablist">
      {runs.map((run, i) => (
        <div className="u-tabs-run" key={i}>
          {run.group && <span className="u-tabs-group">{run.group}</span>}
          <div className="u-tabs-items">
            {run.items.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={value === t.key}
                className="u-tab"
                onClick={() => select(t.key)}
              >
                {t.icon && <Icon name={t.icon} size={13} />}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
