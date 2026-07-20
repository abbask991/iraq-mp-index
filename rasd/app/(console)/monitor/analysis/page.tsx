"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import Tabs, { type TabDef } from "@/components/ui/Tabs";
import ContentView from "./views/ContentView";
import SovView from "./views/SovView";
import OpinionView from "./views/OpinionView";
import PollingView from "./views/PollingView";
import AdvancedView from "./views/AdvancedView";
import StudiesView from "./views/StudiesView";
import KpisView from "./views/KpisView";
import PollsView from "./views/PollsView";

// Analysis Lab — deep analytical tools that were 8 separate sidebar entries.
// Each was an independent tool with its own inputs, so the module is a tab
// switcher that renders the whole tool per tab (no shared query to hoist).
// Spec ordering; "Digital Public Opinion" (observed signals) and "Polling"
// (structured surveys) are deliberately distinct tabs, not merged.
const TABS: TabDef[] = [
  { key: "content", label: "تحليل المحتوى", icon: "brain" },
  { key: "sov", label: "حصة الصوت", icon: "megaphone" },
  { key: "opinion", label: "الرأي العام الرقمي", icon: "target" },
  { key: "polling", label: "استطلاعات ممنهجة", icon: "clip" },
  { key: "advanced", label: "التحليلات المتقدمة", icon: "network" },
  { key: "studies", label: "الدراسات", icon: "flask" },
  { key: "kpis", label: "المؤشرات", icon: "trendUp" },
  { key: "polls", label: "استطلاعات سريعة", icon: "refresh" },
];
const KEYS = TABS.map((t) => t.key);
const VIEW: Record<string, any> = {
  content: ContentView, sov: SovView, opinion: OpinionView, polling: PollingView,
  advanced: AdvancedView, studies: StudiesView, kpis: KpisView, polls: PollsView,
};

export default function AnalysisLab() {
  const search = useSearchParams();
  const urlTab = search?.get("tab") || "";
  const [tab, setTab] = useState<string>(KEYS.includes(urlTab) ? urlTab : "content");
  useEffect(() => { if (KEYS.includes(urlTab)) setTab(urlTab); }, [urlTab]);
  const Active = VIEW[tab];
  return (
    <div>
      <PageHeader title="مختبر التحليل" sub="الأدوات التحليلية العميقة — المحتوى، الرأي العام، حصة الصوت، والتحليلات المتقدمة في مكان واحد." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {Active ? <Active /> : null}
    </div>
  );
}
