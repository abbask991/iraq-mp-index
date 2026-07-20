"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import Tabs, { type TabDef } from "@/components/ui/Tabs";
import RadarView from "./views/RadarView";
import CampaignDetailView from "./views/CampaignDetailView";
import CoordinationView from "./views/CoordinationView";
import DisinfoView from "./views/DisinfoView";
import VisualView from "./views/VisualView";
import NewAccountsView from "./views/NewAccountsView";
import PatientZeroView from "./views/PatientZeroView";

// Campaigns & Disinformation — detection, disinfo, image verification, origin.
// "check" is the single-campaign 9-signal detail, reached from the radar list
// (list→detail), so it is a tab that reads ?q= rather than a sidebar entry.
const TABS: TabDef[] = [
  { key: "radar", label: "رادار الحملات", icon: "megaphone" },
  { key: "check", label: "فحص حملة", icon: "target" },
  { key: "coordination", label: "الشبكات المنسّقة", icon: "network" },
  { key: "disinfo", label: "التضليل", icon: "alert" },
  { key: "visual", label: "كشف الصور", icon: "flask" },
  { key: "new-accounts", label: "حسابات جديدة", icon: "siren" },
  { key: "patient-zero", label: "تتبّع المصدر", icon: "trendUp" },
];
const KEYS = TABS.map((t) => t.key);
const VIEW: Record<string, any> = {
  radar: RadarView, check: CampaignDetailView, coordination: CoordinationView,
  disinfo: DisinfoView, visual: VisualView, "new-accounts": NewAccountsView,
  "patient-zero": PatientZeroView,
};

export default function CampaignsModule() {
  const search = useSearchParams();
  const urlTab = search?.get("tab") || "";
  const [tab, setTab] = useState<string>(KEYS.includes(urlTab) ? urlTab : "radar");
  useEffect(() => { if (KEYS.includes(urlTab)) setTab(urlTab); }, [urlTab]);
  const Active = VIEW[tab];
  return (
    <div>
      <PageHeader title="الحملات والتضليل" sub="كشف الحملات المنسّقة، التضليل، تزييف الصور، وتتبّع مصدر الانتشار." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {Active ? <Active /> : null}
    </div>
  );
}
