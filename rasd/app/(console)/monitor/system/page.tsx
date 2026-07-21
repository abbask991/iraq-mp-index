"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { isAdminEmail } from "@/lib/nav";
import { PageHeader } from "@/components/ui";
import Tabs, { type TabDef } from "@/components/ui/Tabs";
import SettingsView from "./views/SettingsView";
import CostView from "./views/CostView";
import UsageView from "./views/UsageView";
import OrgsView from "./views/OrgsView";
import PackagesView from "./views/PackagesView";
import ClientSuccessView from "./views/ClientSuccessView";
import AccountView from "./views/AccountView";
import OrgWorkspacesView from "./views/OrgWorkspacesView";
import OrgUsersView from "./views/OrgUsersView";
import PlatformDashboardView from "./views/PlatformDashboardView";

// System & Cost Control — settings, cost, usage, clients, permissions, account.
// Clients + Plans tabs are admin-only; the tab strip hides them for non-admins
// (each view also guards itself, so this is defence-in-depth, not the only gate).
const BASE: TabDef[] = [
  { key: "sources", label: "المصادر والإعدادات", icon: "refresh" },
  { key: "workspaces", label: "مساحات العمل", icon: "map" },
  { key: "users", label: "المستخدمون والأدوار", icon: "network" },
  { key: "cost", label: "التحكّم بالكلفة", icon: "bolt" },
  { key: "usage", label: "الاستهلاك", icon: "trendUp" },
  { key: "account", label: "الحساب", icon: "target" },
];
const ADMIN: TabDef[] = [
  { key: "platform", label: "لوحة المنصّة", icon: "rocket" },
  { key: "orgs", label: "العملاء", icon: "network" },
  { key: "success", label: "نجاح العملاء", icon: "check" },
  { key: "packages", label: "الباقات والصلاحيات", icon: "clip" },
];
const VIEW: Record<string, any> = {
  sources: SettingsView, workspaces: OrgWorkspacesView, users: OrgUsersView, cost: CostView, usage: UsageView,
  account: AccountView, platform: PlatformDashboardView, orgs: OrgsView, success: ClientSuccessView, packages: PackagesView,
};

export default function SystemModule() {
  const search = useSearchParams();
  const [admin, setAdmin] = useState(false);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setAdmin(isAdminEmail(data.user?.email))); }, []);
  const tabs = admin ? [...BASE, ...ADMIN] : BASE;
  const keys = tabs.map((t) => t.key);
  const urlTab = search?.get("tab") || "";
  const [tab, setTab] = useState<string>("sources");
  useEffect(() => { if (keys.includes(urlTab)) setTab(urlTab); }, [urlTab, admin]);
  const Active = VIEW[keys.includes(tab) ? tab : "sources"];
  return (
    <div>
      <PageHeader title="النظام والكلفة" sub="الإعدادات، الكلفة، الاستهلاك، العملاء، والصلاحيات." />
      <Tabs tabs={tabs} value={keys.includes(tab) ? tab : "sources"} onChange={setTab} />
      {Active ? <Active /> : null}
    </div>
  );
}
