"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import Tabs, { type TabDef } from "@/components/ui/Tabs";
import ReportGenerationButtons from "@/components/ReportGenerationButtons";
import TwinView from "./views/TwinView";
import InfluencersView from "./views/InfluencersView";
import ProfilerView from "./views/ProfilerView";
import CompareView from "./views/CompareView";

// Entities & Influence — profiles and account analysis for tracked entities.
// The watchlist stays at /monitor (the home/landing), and the per-entity
// workspace is the dynamic detail route /monitor/entities/[entity_id]/workspace,
// reached by clicking an entity. This module holds the four standalone tools.
const TABS: TabDef[] = [
  { key: "twin", label: "التوأم الرقمي", icon: "brain" },
  { key: "influencers", label: "رادار المؤثّرين", icon: "network" },
  { key: "profiler", label: "تحليل الحسابات", icon: "target" },
  { key: "compare", label: "المقارنة", icon: "refresh" },
];
const KEYS = TABS.map((t) => t.key);
const VIEW: Record<string, any> = {
  twin: TwinView, influencers: InfluencersView, profiler: ProfilerView, compare: CompareView,
};

export default function EntitiesModule() {
  const search = useSearchParams();
  const urlTab = search?.get("tab") || "";
  const [tab, setTab] = useState<string>(KEYS.includes(urlTab) ? urlTab : "twin");
  useEffect(() => { if (KEYS.includes(urlTab)) setTab(urlTab); }, [urlTab]);
  const Active = VIEW[tab];
  return (
    <div>
      <PageHeader
        title="الكيانات والتأثير"
        sub="التوأم الرقمي، رادار المؤثّرين، تحليل الحسابات، والمقارنة."
        actions={<Link href="/monitor" className="u-btn"><span>قائمة المتابعة</span></Link>}
      />
      <div style={{ marginBottom: "var(--s-3)" }}>
        <ReportGenerationButtons only={["board", "dossier", "executive"]} title="ولّد موجزاً" />
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {Active ? <Active /> : null}
    </div>
  );
}
