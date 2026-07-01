// Single source of truth for the sidebar navigation + feature registry.
// The `href` of an item doubles as its FEATURE KEY for package entitlements.

export type NavItem = {
  ar: string; en: string; href?: string; matchPrefix?: string;
  soon?: boolean; action?: "logout"; plan?: boolean; danger?: boolean; adminOnly?: boolean;
};
export type NavGroup = { key: string; icon: string; ar: string; en: string; defaultOpen?: boolean; items: NavItem[] };

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
    key: "ops", icon: "🎯", ar: "مركز العمليات", en: "Operations Center", defaultOpen: true,
    items: [
      { ar: "غرفة الحرب (مباشر)", en: "Live War Room", href: "/monitor/warroom", danger: true },
      { ar: "مركز القيادة (ابدأ هنا)", en: "Command Center (start here)", href: "/monitor/command" },
      { ar: "لوحة القيادة التنفيذية", en: "Executive Dashboard", href: "/monitor/overview" },
      { ar: "ماذا تغيّر خلال 24 ساعة؟", en: "What Changed in 24h?", href: "/monitor/changes" },
      { ar: "التقرير اليومي", en: "Daily Brief", href: "/monitor/brief" },
      { ar: "التقرير الشامل", en: "Full Dossier", href: "/monitor/dossier" },
      { ar: "ضابط الاستخبارات", en: "Chief Intelligence", href: "/monitor/chief" },
      { ar: "المحلّل الذكي (اسأل أي سؤال)", en: "AI Analyst", href: "/monitor/analyst" },
    ],
  },
  {
    key: "media", icon: "📡", ar: "الرصد الإعلامي", en: "Media Monitoring",
    items: [
      { ar: "الإعلام التقليدي", en: "Traditional Media", href: "/monitor" },
      { ar: "الإعلام الرقمي", en: "Digital Media", href: "/monitor/targets" },
      { ar: "الرصد عبر المنصّات", en: "Cross-Platform", href: "/monitor/cross-platform" },
      { ar: "الصورة الاستخباراتية الموحّدة", en: "Unified Intelligence Picture", href: "/monitor/fusion" },
      { ar: "استخبارات فيسبوك", en: "Facebook Intelligence", href: "/monitor/facebook" },
      { ar: "أرشيف X (يكبر يومياً)", en: "X Archive (grows daily)", href: "/monitor/archive" },
      { ar: "الإعدادات: قائمة المتابعة", en: "Settings: Watchlist", href: "/monitor/settings" },
    ],
  },
  {
    key: "analysis", icon: "📊", ar: "التحليل والبحوث", en: "Analysis & Research",
    items: [
      { ar: "تحليل المحتوى", en: "Content Analysis", href: "/monitor/content" },
      { ar: "حصة الصوت (SOV)", en: "Share of Voice", href: "/monitor/sov" },
      { ar: "المؤشرات والـKPIs", en: "Indices & KPIs", href: "/monitor/index-report" },
      { ar: "التحليلات المتقدمة", en: "Advanced Analytics", href: "/monitor/network" },
      { ar: "استطلاع الرأي الاجتماعي", en: "Social Opinion Poll", href: "/monitor/polling" },
      { ar: "الدراسات والبحوث", en: "Studies & Research", soon: true },
      { ar: "استطلاعات الرأي", en: "Opinion Polls", soon: true },
    ],
  },
  {
    key: "trends", icon: "📈", ar: "الترندات والإنذار", en: "Trends & Early Warning",
    items: [
      { ar: "ترندات الآن", en: "Trending Now", href: "/monitor/discover" },
      { ar: "تحليل ترند محدّد", en: "Trend Analysis", href: "/monitor/trends" },
      { ar: "الإنذار المبكر", en: "Early Warning", href: "/monitor/alerts" },
      { ar: "التنبّؤ والإنذار المبكر", en: "Predictive Engine", href: "/monitor/predictive" },
    ],
  },
  {
    key: "campaigns", icon: "🛡️", ar: "الحملات والتضليل", en: "Campaigns & Disinformation",
    items: [
      { ar: "رادار الحملات", en: "Campaign Radar", href: "/monitor/campaigns" },
      { ar: "فحص حملة محدّدة", en: "Campaign Check", href: "/monitor/campaign" },
      { ar: "كشف الشبكات المنسّقة", en: "Coordinated Networks", href: "/monitor/coordination" },
      { ar: "كشف التضليل والتزييف", en: "Disinformation", href: "/monitor/disinfo" },
      { ar: "تتبّع المصدر (Patient Zero)", en: "Patient Zero", href: "/monitor/patient-zero" },
      { ar: "رادار الحسابات الجديدة", en: "New Accounts Radar", href: "/monitor/new-accounts" },
      { ar: "كشف الصور والتزييف", en: "Visual Verification", href: "/monitor/visual-verification" },
    ],
  },
  {
    key: "narratives", icon: "🧵", ar: "السرديات والمعركة الإعلامية", en: "Narratives & Battlefield",
    items: [
      { ar: "غرفة حرب السرديات", en: "Narrative War Room", href: "/monitor/narratives" },
      { ar: "ساحة المعركة الإعلامية", en: "Media Battlefield", href: "/monitor/battlefield" },
      { ar: "التأثير الإقليمي (العراق ← الجوار)", en: "Regional Influence", href: "/monitor/regional-influence" },
    ],
  },
  {
    key: "entities", icon: "🏛️", ar: "الكيانات والتأثير", en: "Entities & Influence",
    items: [
      { ar: "مساحة عمل الكيان", en: "Entity Workspace", href: "/monitor/entities/%D9%88%D8%B2%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%83%D9%87%D8%B1%D8%A8%D8%A7%D8%A1/workspace", matchPrefix: "/monitor/entities" },
      { ar: "التوأم الرقمي", en: "Digital Twin", href: "/monitor/intelligence" },
      { ar: "المقارنة (كيان مقابل كيان)", en: "Compare Entities", href: "/monitor/compare" },
      { ar: "تحليل الحسابات والمؤثرين", en: "Account & Influencer Analysis", href: "/monitor/profiler" },
      { ar: "رادار المؤثّرين", en: "Influencer Radar", href: "/monitor/influencers" },
      { ar: "مؤشر الرأي العام الرقمي (PPOI)", en: "Public Opinion Index (PPOI)", href: "/monitor/opinion" },
    ],
  },
  {
    key: "corporate", icon: "🏢", ar: "استخبارات الشركات والمؤسسات", en: "Corporate Intelligence",
    items: [
      { ar: "مركز الاستخبارات المؤسسية", en: "Corporate Intelligence Center", href: "/monitor/corporate" },
      { ar: "سمعة الشركة", en: "Brand Reputation", href: "/monitor/corporate/reputation" },
      { ar: "شكاوى العملاء", en: "Customer Complaints", href: "/monitor/corporate/complaints" },
      { ar: "مراقبة المنافسين", en: "Competitor Monitoring", href: "/monitor/corporate/competitors" },
      { ar: "مراقبة الاحتيال والصفحات المزيفة", en: "Fraud & Fake Pages", href: "/monitor/corporate/fraud" },
      { ar: "مؤشر المخاطر المؤسسية", en: "Corporate Risk Index", href: "/monitor/corporate/risk-index" },
    ],
  },
  {
    key: "reports", icon: "📄", ar: "التقارير والمخرجات", en: "Reports & Deliverables",
    items: [
      { ar: "التقرير اليومي", en: "Daily Brief", href: "/monitor/brief" },
      { ar: "التقرير الشامل", en: "Full Dossier", href: "/monitor/dossier" },
      { ar: "تقارير الحملات", en: "Campaign Reports", soon: true },
      { ar: "تقارير الكيانات", en: "Entity Reports", soon: true },
      { ar: "تقارير الأزمات", en: "Crisis Reports", soon: true },
      { ar: "تقارير PDF / PowerPoint", en: "PDF / PowerPoint Reports", soon: true },
    ],
  },
  {
    key: "system", icon: "⚙️", ar: "النظام والإعدادات", en: "System & Settings",
    items: [
      { ar: "الحساب واشتراكي", en: "Account & Subscription", href: "/monitor/account" },
      { ar: "الباقة الحالية", en: "Current Plan", plan: true },
      { ar: "الإعدادات: قائمة المتابعة", en: "Settings: Watchlist", href: "/monitor/settings" },
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
    key: "soon", icon: "🔜", ar: "قريباً", en: "Coming Soon",
    items: [
      { ar: "الرصد الدولي", en: "International Monitoring", soon: true },
      { ar: "الدراسات والبحوث", en: "Studies & Research", soon: true },
      { ar: "استطلاعات الرأي", en: "Opinion Polls", soon: true },
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
