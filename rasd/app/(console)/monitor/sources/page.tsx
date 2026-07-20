"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import Tabs, { type TabDef } from "@/components/ui/Tabs";
import OverviewView from "./views/OverviewView";
import FacebookView from "./views/FacebookView";
import XView from "./views/XView";
import CrossPlatformView from "./views/CrossPlatformView";
import ArchiveView from "./views/ArchiveView";

// Monitoring Hub — source-level coverage. The Unified Intelligence Picture is the
// Overview tab (not a separate sidebar item), per spec.
//
// NB: uses ?src= for its tabs, NOT ?tab=, because the Facebook view has its own
// ?tab= (13 internal tabs). Two different keys → no collision, and a bookmarked
// /monitor/facebook?tab=viral still lands on the right Facebook sub-tab.
const TABS: TabDef[] = [
  { key: "overview", label: "الصورة الموحّدة", icon: "target" },
  { key: "facebook", label: "فيسبوك", icon: "megaphone" },
  { key: "x", label: "إكس / يوتيوب", icon: "network" },
  { key: "cross-platform", label: "عبر المنصّات", icon: "refresh" },
  { key: "archive", label: "أرشيف X", icon: "clip" },
];
const KEYS = TABS.map((t) => t.key);
const VIEW: Record<string, any> = {
  overview: OverviewView, facebook: FacebookView, x: XView,
  "cross-platform": CrossPlatformView, archive: ArchiveView,
};

export default function MonitoringHub() {
  const search = useSearchParams();
  const urlTab = search?.get("src") || "";
  const [tab, setTab] = useState<string>(KEYS.includes(urlTab) ? urlTab : "overview");
  useEffect(() => { if (KEYS.includes(urlTab)) setTab(urlTab); }, [urlTab]);
  const Active = VIEW[tab];
  return (
    <div>
      <PageHeader title="مركز الرصد" sub="التغطية على مستوى المصدر — فيسبوك، إكس، عبر المنصّات، والصورة الموحّدة." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} param="src" />
      {Active ? <Active /> : null}
    </div>
  );
}
