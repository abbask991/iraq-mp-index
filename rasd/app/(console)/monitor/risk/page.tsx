"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import Tabs, { type TabDef } from "@/components/ui/Tabs";
import PlatformContributionCard from "@/components/PlatformContributionCard";
import CrisisProbabilityMeter from "@/components/CrisisProbabilityMeter";
import NarrativeToActionSignal from "@/components/NarrativeToActionSignal";
import ReportGenerationButtons from "@/components/ReportGenerationButtons";
import AlertsView from "./views/AlertsView";
import DiscoverView from "./views/DiscoverView";
import TrendsView from "./views/TrendsView";
import PredictiveView from "./views/PredictiveView";
import AngerView from "./views/AngerView";

// Risk & Early Warning — trend detection, alerts, forecast, strategic indices.
// The Public Anger Index also surfaces as a card in the command center, but its
// full breakdown lives here.
const TABS: TabDef[] = [
  { key: "alerts", label: "الإنذار المبكر", icon: "siren" },
  { key: "trends-now", label: "ترندات الآن", icon: "fire" },
  { key: "trend", label: "تحليل ترند", icon: "trendUp" },
  { key: "forecast", label: "التنبّؤ", icon: "target" },
  { key: "anger", label: "مؤشر الغضب العام", icon: "alert" },
];
const KEYS = TABS.map((t) => t.key);
const VIEW: Record<string, any> = {
  alerts: AlertsView, "trends-now": DiscoverView, trend: TrendsView,
  forecast: PredictiveView, anger: AngerView,
};

export default function RiskModule() {
  const search = useSearchParams();
  const urlTab = search?.get("tab") || "";
  const [tab, setTab] = useState<string>(KEYS.includes(urlTab) ? urlTab : "alerts");
  useEffect(() => { if (KEYS.includes(urlTab)) setTab(urlTab); }, [urlTab]);
  const Active = VIEW[tab];
  return (
    <div>
      <PageHeader title="المخاطر والإنذار المبكر" sub="اكتشاف الترندات، التنبيهات، التنبّؤ، والمؤشرات الاستراتيجية — قبل أن تتصاعد." />
      <div style={{ marginBottom: "var(--s-4)" }}>
        <CrisisProbabilityMeter />
      </div>
      <div style={{ marginBottom: "var(--s-4)" }}>
        <NarrativeToActionSignal />
      </div>
      <div style={{ marginBottom: "var(--s-4)" }}>
        <PlatformContributionCard title="المنصّات المساهمة في الخطر"
          note="حصّة كل منصّة من الإشارات المرصودة. للتفصيل الكامل ومسار المصدر، افتح مركز الرصد." />
      </div>
      <div style={{ marginBottom: "var(--s-3)" }}>
        <ReportGenerationButtons only={["board", "crisis", "anger", "executive"]} title="ولّد موجزاً" />
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {Active ? <Active /> : null}
    </div>
  );
}
