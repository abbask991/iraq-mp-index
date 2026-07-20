"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import Tabs, { type TabDef } from "@/components/ui/Tabs";
import OverviewView from "./views/OverviewView";
import FacebookView from "./views/FacebookView";
import XView from "./views/XView";
import CrossPlatformView from "./views/CrossPlatformView";
import TelegramView from "./views/TelegramView";
import NewsView from "./views/NewsView";
import SourceHealthView from "./views/SourceHealthView";
import EvidenceView from "./views/EvidenceView";

// Monitoring Hub — the one place for source-level monitoring, as tabs (not
// separate sidebar pages). Order follows the IA spec's 8 tabs.
//
// Honesty: Telegram has no collector yet (honest placeholder), and the
// "cross-platform" tab is real collection (BrightData) — the issue-journey and
// platform-role views the spec envisions need a real multi-platform pipeline
// first, so they are not faked here.
//
// NB: uses ?src= (not ?tab=) because FacebookView has its own ?tab= (13 tabs).
// The old X-archive route (?src=archive) folds into Raw Evidence — same `mentions`
// data — so the redirect still lands somewhere sensible.
const TABS: TabDef[] = [
  { key: "overview", label: "الصورة الموحّدة", icon: "target" },
  { key: "cross-platform", label: "عبر المنصّات", icon: "refresh" },
  { key: "facebook", label: "فيسبوك", icon: "megaphone" },
  { key: "x", label: "إكس / يوتيوب", icon: "network" },
  { key: "telegram", label: "تيليجرام", icon: "rocket" },
  { key: "news", label: "أخبار · Google · RSS", icon: "clip" },
  { key: "health", label: "صحة المصادر", icon: "bolt" },
  { key: "evidence", label: "مستكشف الأدلّة", icon: "brain" },
];
const KEYS = TABS.map((t) => t.key);
const VIEW: Record<string, any> = {
  overview: OverviewView, "cross-platform": CrossPlatformView, facebook: FacebookView,
  x: XView, telegram: TelegramView, news: NewsView, health: SourceHealthView, evidence: EvidenceView,
};
// legacy aliases → current tab (old bookmarks / redirects)
const ALIAS: Record<string, string> = { archive: "evidence" };

export default function MonitoringHub() {
  const search = useSearchParams();
  const raw = search?.get("src") || "";
  const urlTab = ALIAS[raw] || raw;
  const [tab, setTab] = useState<string>(KEYS.includes(urlTab) ? urlTab : "overview");
  useEffect(() => { if (KEYS.includes(urlTab)) setTab(urlTab); }, [urlTab]);
  const Active = VIEW[tab];
  return (
    <div>
      <PageHeader title="مركز الرصد" sub="مصادر مختلفة، صورة استخباراتية واحدة — التغطية والصحة والأدلّة على مستوى المصدر." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} param="src" />
      {Active ? <Active /> : null}
    </div>
  );
}
