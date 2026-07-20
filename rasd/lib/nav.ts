// Single source of truth for the sidebar navigation + feature registry.
// The `href` of an item doubles as its FEATURE KEY for package entitlements.

export type NavItem = {
  ar: string; en: string; href?: string; matchPrefix?: string;
  soon?: boolean; action?: "logout"; plan?: boolean; danger?: boolean; adminOnly?: boolean;
};
export type NavGroup = { key: string; ar: string; en: string; defaultOpen?: boolean; items: NavItem[] };

// UI-level admin allowlist for the entitlements panel (extend as needed).
export const ADMIN_EMAILS = ["abbaskareemsaddam@gmail.com", "admin@mpii.iq"];
export const isAdminEmail = (email?: string | null) =>
  !!email && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());

export const PLANS: { key: string; ar: string }[] = [
  { key: "trial", ar: "تجريبي" }, { key: "basic", ar: "أساسي" },
  { key: "pro", ar: "احترافي" }, { key: "enterprise", ar: "مؤسّسي" },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "ops", ar: "مركز العمليات", en: "Operations Center", defaultOpen: true,
    items: [
      // The single watchlist for the whole system. It was called "الإعلام التقليدي"
      // (traditional media) and buried under Media Monitoring, while the entry
      // NAMED "watchlist" (/monitor/workspace) fed one page and nothing else.
      { ar: "قائمة المتابعة — الكيانات المرصودة", en: "Watchlist — Monitored Entities", href: "/monitor" },
      { ar: "غرفة الحرب (مباشر)", en: "Live War Room", href: "/monitor/warroom", danger: true },
      { ar: "مركز القيادة (ابدأ هنا)", en: "Command Center (start here)", href: "/monitor/command" },
      { ar: "ضابط الاستخبارات", en: "Chief Intelligence", href: "/monitor/chief" },
      { ar: "المحلّل الذكي (اسأل أي سؤال)", en: "AI Analyst", href: "/monitor/analyst" },
    ],
  },
  {
    key: "media", ar: "الرصد الإعلامي", en: "Media Monitoring",
    items: [
      { ar: "الإعلام الرقمي", en: "Digital Media", href: "/monitor/targets" },
      { ar: "الرصد عبر المنصّات", en: "Cross-Platform", href: "/monitor/cross-platform" },
      { ar: "الصورة الاستخباراتية الموحّدة", en: "Unified Intelligence Picture", href: "/monitor/fusion" },
      { ar: "استخبارات فيسبوك", en: "Facebook Intelligence", href: "/monitor/facebook" },
      { ar: "أرشيف X (يكبر يومياً)", en: "X Archive (grows daily)", href: "/monitor/archive" },
    ],
  },
  {
    key: "analysis", ar: "مختبر التحليل", en: "Analysis Lab",
    items: [
      { ar: "مختبر التحليل", en: "Analysis Lab", href: "/monitor/analysis" },
    ],
  },
  {
    key: "risk", ar: "المخاطر والإنذار المبكر", en: "Risk & Early Warning",
    items: [
      { ar: "المخاطر والإنذار المبكر", en: "Risk & Early Warning", href: "/monitor/risk" },
    ],
  },
  {
    key: "campaigns", ar: "الحملات والتضليل", en: "Campaigns & Disinformation",
    items: [
      { ar: "رادار الحملات", en: "Campaign Radar", href: "/monitor/campaigns" },
      { ar: "كشف الشبكات المنسّقة", en: "Coordinated Networks", href: "/monitor/coordination" },
      { ar: "كشف التضليل والتزييف", en: "Disinformation", href: "/monitor/disinfo" },
      { ar: "تتبّع المصدر (Patient Zero)", en: "Patient Zero", href: "/monitor/patient-zero" },
      { ar: "رادار الحسابات الجديدة", en: "New Accounts Radar", href: "/monitor/new-accounts" },
      { ar: "كشف الصور والتزييف", en: "Visual Verification", href: "/monitor/visual-verification" },
    ],
  },
  {
    key: "narratives", ar: "السرديات والمعركة الإعلامية", en: "Narratives & Battlefield",
    items: [
      { ar: "غرفة حرب السرديات", en: "Narrative War Room", href: "/monitor/narratives" },
      { ar: "ساحة المعركة الإعلامية", en: "Media Battlefield", href: "/monitor/battlefield" },
      { ar: "التأثير الإقليمي (العراق ← الجوار)", en: "Regional Influence", href: "/monitor/regional-influence" },
    ],
  },
  {
    key: "entities", ar: "الكيانات والتأثير", en: "Entities & Influence",
    items: [
      { ar: "مساحة عمل الكيان", en: "Entity Workspace", href: "/monitor/entities/%D9%88%D8%B2%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%83%D9%87%D8%B1%D8%A8%D8%A7%D8%A1/workspace", matchPrefix: "/monitor/entities" },
      { ar: "التوأم الرقمي", en: "Digital Twin", href: "/monitor/intelligence" },
      { ar: "المقارنة (كيان مقابل كيان)", en: "Compare Entities", href: "/monitor/compare" },
      { ar: "تحليل الحسابات والمؤثرين", en: "Account & Influencer Analysis", href: "/monitor/profiler" },
      { ar: "رادار المؤثّرين", en: "Influencer Radar", href: "/monitor/influencers" },
    ],
  },
  {
    key: "corporate", ar: "استخبارات الشركات والمؤسسات", en: "Corporate Intelligence",
    items: [
      { ar: "لوحة الشركة الموحّدة", en: "Company Dashboard", href: "/monitor/corporate" },
    ],
  },
  {
    key: "reports", ar: "التقارير والمخرجات", en: "Reports & Deliverables",
    items: [
      { ar: "التقارير (يومي + شامل)", en: "Reports (Daily + Dossier)", href: "/monitor/reports" },
      { ar: "تقارير الحملات", en: "Campaign Reports", soon: true },
      { ar: "تقارير الكيانات", en: "Entity Reports", soon: true },
      { ar: "تقارير الأزمات", en: "Crisis Reports", soon: true },
      { ar: "تقارير PDF / PowerPoint", en: "PDF / PowerPoint Reports", soon: true },
    ],
  },
  {
    key: "system", ar: "النظام والإعدادات", en: "System & Settings",
    items: [
      { ar: "الحساب واشتراكي", en: "Account & Subscription", href: "/monitor/account" },
      { ar: "الباقة الحالية", en: "Current Plan", plan: true },
      { ar: "الإعدادات: المصادر والتصنيفات", en: "Settings: Sources & Categories", href: "/monitor/settings" },
      { ar: "المؤسسات (العملاء)", en: "Organizations (Clients)", href: "/monitor/system/organizations", adminOnly: true },
      { ar: "إدارة الباقات والصلاحيات", en: "Packages & Entitlements", href: "/monitor/system/packages", adminOnly: true },
      { ar: "مركز التحكّم بالتكلفة", en: "Cost Control Center", href: "/monitor/system/cost-center" },
      { ar: "الاستهلاك والكلفة", en: "Usage & Cost", href: "/monitor/usage" },
      { ar: "إدارة المستخدمين", en: "User Management", soon: true },
      { ar: "حالة النظام", en: "System Status", soon: true },
      { ar: "سجل النشاط", en: "Activity Log", soon: true },
      { ar: "تسجيل الخروج", en: "Log out", action: "logout" },
    ],
  },
  {
    key: "soon", ar: "قريباً", en: "Coming Soon",
    items: [
      { ar: "الرصد الدولي", en: "International Monitoring", soon: true },
    ],
  },
];

// Toggleable features = items with a real route (href) that aren't the admin panel itself.
export function featureRegistry(): { group: string; items: { key: string; ar: string; en: string }[] }[] {
  return NAV_GROUPS.map((g) => ({
    group: g.ar,
    items: g.items.filter((it) => it.href && !it.soon && !it.adminOnly && !it.plan && it.action !== "logout")
      .map((it) => ({ key: it.href!, ar: it.ar, en: it.en })),
  })).filter((g) => g.items.length > 0);
}
