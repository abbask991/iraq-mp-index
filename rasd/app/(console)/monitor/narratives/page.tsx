"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import Tabs, { type TabDef } from "@/components/ui/Tabs";
import WarRoomView from "./views/WarRoomView";
import BattlefieldView from "./views/BattlefieldView";
import RegionalView from "./views/RegionalView";
import CrossBorderView from "./views/CrossBorderView";

// Narratives & Battlefield — narrative intelligence + media battlefield analysis.
const TABS: TabDef[] = [
  { key: "war-room", label: "غرفة حرب السرديات", icon: "megaphone" },
  { key: "battlefield", label: "ساحة المعركة", icon: "target" },
  { key: "regional", label: "التأثير الإقليمي", icon: "map" },
  { key: "cross-border", label: "التأثير العابر للحدود", icon: "network" },
];
const KEYS = TABS.map((t) => t.key);
const VIEW: Record<string, any> = {
  "war-room": WarRoomView, battlefield: BattlefieldView,
  regional: RegionalView, "cross-border": CrossBorderView,
};

export default function NarrativesModule() {
  const search = useSearchParams();
  const urlTab = search?.get("tab") || "";
  const [tab, setTab] = useState<string>(KEYS.includes(urlTab) ? urlTab : "war-room");
  useEffect(() => { if (KEYS.includes(urlTab)) setTab(urlTab); }, [urlTab]);
  const Active = VIEW[tab];
  return (
    <div>
      <PageHeader title="السرديات والمعركة الإعلامية" sub="استخبارات السرديات وتحليل ساحة المعركة الإعلامية — من يقود الحكاية، ومن يقاومها." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {Active ? <Active /> : null}
    </div>
  );
}
