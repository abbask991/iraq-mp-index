"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import Tabs, { type TabDef } from "@/components/ui/Tabs";
import AnalystView from "./views/AnalystView";
import ChiefView from "./views/ChiefView";

// AI Analyst — the unified intelligence assistant. The free-form analyst
// (/api/analyst/ask) and the chief officer dashboard (chief-ai) are DIFFERENT
// backends, so they are kept as two tabs — an "ask anything" surface and a
// prioritized officer briefing — rather than a forced single endpoint.
const TABS: TabDef[] = [
  { key: "ask", label: "اسأل أي سؤال", icon: "brain" },
  { key: "chief", label: "ضابط الاستخبارات", icon: "target" },
];
const KEYS = TABS.map((t) => t.key);

export default function AiAnalystModule() {
  const search = useSearchParams();
  const urlTab = search?.get("tab") || "";
  const [tab, setTab] = useState<string>(KEYS.includes(urlTab) ? urlTab : "ask");
  useEffect(() => { if (KEYS.includes(urlTab)) setTab(urlTab); }, [urlTab]);
  return (
    <div>
      <PageHeader title="المحلّل الذكي" sub="مساعد الاستخبارات الموحّد — اسأل عن الكيانات، الحملات، السرديات، ما تغيّر، والأدلّة." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "chief" ? <ChiefView /> : <AnalystView />}
    </div>
  );
}
