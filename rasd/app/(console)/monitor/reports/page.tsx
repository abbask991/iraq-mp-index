"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Tabs, { type TabDef } from "@/components/ui/Tabs";
import DailyBriefView from "./DailyBriefView";
import DossierView from "./DossierView";
import CampaignReportView from "./CampaignReportView";
import AngerReportView from "./AngerReportView";
import ExportCenterView from "./ExportCenterView";

/**
 * Reports & deliverables — one module, every report type as a tab.
 *
 * The daily brief and the entity dossier were separate routes (and double-listed
 * in the nav); the campaign, public-anger and export deliverables were "قريباً"
 * placeholders. They are all printable/exportable outputs of the same platform,
 * so they live here as tabs. Each view owns its own export controls (print,
 * Telegram, html2pdf, or the server-side Export Center), which is why the host
 * is a thin tab switch — and views mount lazily so only the active report fetches.
 */
const TABS: TabDef[] = [
  { key: "daily", label: "التقرير اليومي", icon: "clip" },
  { key: "full", label: "التقرير الشامل", icon: "brain" },
  { key: "campaign", label: "تقرير الحملات", icon: "megaphone" },
  { key: "anger", label: "تقرير الغضب العام", icon: "alert" },
  { key: "export", label: "مركز التصدير", icon: "expand" },
];
const KEYS = TABS.map((t) => t.key);

export default function Reports() {
  const search = useSearchParams();
  const urlTab = search?.get("tab") || "";
  const [tab, setTab] = useState<string>(KEYS.includes(urlTab) ? urlTab : "daily");
  useEffect(() => { if (KEYS.includes(urlTab)) setTab(urlTab); }, [urlTab]);

  return (
    <div>
      <div className="no-print"><Tabs tabs={TABS} value={tab} onChange={setTab} /></div>
      {tab === "daily" && <DailyBriefView />}
      {tab === "full" && <DossierView />}
      {tab === "campaign" && <CampaignReportView />}
      {tab === "anger" && <AngerReportView />}
      {tab === "export" && <ExportCenterView />}
    </div>
  );
}
