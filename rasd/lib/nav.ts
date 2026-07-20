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
    key: "media", ar: "مركز الرصد", en: "Monitoring Hub",
    items: [
      { ar: "مركز الرصد", en: "Monitoring Hub", href: "/monitor/sources" },
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
      { ar: "الحملات والتضليل", en: "Campaigns & Disinformation", href: "/monitor/campaigns" },
    ],
  },
  {
    key: "narratives", ar: "السرديات والمعركة الإعلامية", en: "Narratives & Battlefield",
    items: [
      { ar: "السرديات والمعركة الإعلامية", en: "Narratives & Battlefield", href: "/monitor/narratives" },
    ],
  },
  {
    key: "entities", ar: "الكيانات والتأثير", en: "Entities & Influence",
    items: [
      { ar: "الكيانات والتأثير", en: "Entities & Influence", href: "/monitor/entities" },
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
    key: "system", ar: "النظام والكلفة", en: "System & Cost",
    items: [
      { ar: "النظام والكلفة", en: "System & Cost", href: "/monitor/system" },
      { ar: "الباقة الحالية", en: "Current Plan", plan: true },
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
