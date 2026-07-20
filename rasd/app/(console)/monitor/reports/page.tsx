"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Tabs, { type TabDef } from "@/components/ui/Tabs";
import DailyBriefView from "./DailyBriefView";
import DossierView from "./DossierView";

/**
 * Reports & deliverables — one page, two report types.
 *
 * The daily brief (national situation, printable/Telegram) and the full dossier
 * (one entity, deep) were two separate routes AND were listed twice in the nav
 * (Operations + Reports). Same job — a printable deliverable — so they are tabs
 * here. Each view keeps its own export controls (the brief's PDF/Telegram, the
 * dossier's download), which is why the host is a thin tab switch rather than a
 * shared header.
 */
const TABS: TabDef[] = [
  { key: "daily", label: "التقرير اليومي", icon: "clip" },
  { key: "full", label: "التقرير الشامل", icon: "brain" },
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
      {tab === "daily" ? <DailyBriefView /> : <DossierView />}
    </div>
  );
}
