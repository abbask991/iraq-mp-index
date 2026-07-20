// Central module registry — the single source for cross-module UX:
//   • the command palette indexes every module AND every tab by its Arabic name
//   • the breadcrumb resolves  module › active tab  from the URL
//   • each module renders "related modules" cards from `related`
//
// Tab keys/labels/params mirror each module host page's own TABS array verbatim.
// `param` is "tab" everywhere except Monitoring Hub, which uses "src" to avoid
// colliding with the embedded Facebook view's own ?tab=.

export type ModuleTab = { key: string; label: string; adminOnly?: boolean };
export type ModuleDef = {
  key: string;
  route: string;            // /monitor/xxx
  ar: string;               // Arabic module name (matches nav.ts)
  en: string;
  param?: "tab" | "src";    // default "tab"
  tabs?: ModuleTab[];
  related?: string[];       // other module keys
};

export const MODULES: ModuleDef[] = [
  {
    key: "command", route: "/monitor/command", ar: "مركز القيادة", en: "Command Center",
    related: ["risk", "ai-analyst", "reports"],
  },
  {
    key: "sources", route: "/monitor/sources", ar: "مركز الرصد", en: "Monitoring Hub", param: "src",
    tabs: [
      { key: "overview", label: "الصورة الموحّدة" },
      { key: "cross-platform", label: "عبر المنصّات" },
      { key: "facebook", label: "فيسبوك" },
      { key: "x", label: "إكس / يوتيوب" },
      { key: "telegram", label: "تيليجرام" },
      { key: "news", label: "أخبار · Google · RSS" },
      { key: "health", label: "صحة المصادر" },
      { key: "evidence", label: "مستكشف الأدلّة" },
    ],
    related: ["analysis", "entities", "campaigns"],
  },
  {
    key: "analysis", route: "/monitor/analysis", ar: "مختبر التحليل", en: "Analysis Lab",
    tabs: [
      { key: "content", label: "تحليل المحتوى" },
      { key: "sov", label: "حصة الصوت" },
      { key: "opinion", label: "الرأي العام الرقمي" },
      { key: "polling", label: "استطلاعات ممنهجة" },
      { key: "advanced", label: "التحليلات المتقدمة" },
      { key: "studies", label: "الدراسات" },
      { key: "kpis", label: "المؤشرات" },
      { key: "polls", label: "استطلاعات سريعة" },
    ],
    related: ["sources", "entities", "risk"],
  },
  {
    key: "risk", route: "/monitor/risk", ar: "المخاطر والإنذار المبكر", en: "Risk & Early Warning",
    tabs: [
      { key: "alerts", label: "الإنذار المبكر" },
      { key: "trends-now", label: "ترندات الآن" },
      { key: "trend", label: "تحليل ترند" },
      { key: "forecast", label: "التنبّؤ" },
      { key: "anger", label: "مؤشر الغضب العام" },
    ],
    related: ["command", "campaigns", "narratives"],
  },
  {
    key: "campaigns", route: "/monitor/campaigns", ar: "الحملات والتضليل", en: "Campaigns & Disinformation",
    tabs: [
      { key: "radar", label: "رادار الحملات" },
      { key: "check", label: "فحص حملة" },
      { key: "coordination", label: "الشبكات المنسّقة" },
      { key: "disinfo", label: "التضليل" },
      { key: "visual", label: "كشف الصور" },
      { key: "new-accounts", label: "حسابات جديدة" },
      { key: "patient-zero", label: "تتبّع المصدر" },
    ],
    related: ["narratives", "risk", "entities"],
  },
  {
    key: "narratives", route: "/monitor/narratives", ar: "السرديات والمعركة الإعلامية", en: "Narratives & Battlefield",
    tabs: [
      { key: "war-room", label: "غرفة حرب السرديات" },
      { key: "battlefield", label: "ساحة المعركة" },
      { key: "regional", label: "التأثير الإقليمي" },
      { key: "cross-border", label: "التأثير العابر للحدود" },
    ],
    related: ["campaigns", "risk", "sources"],
  },
  {
    key: "entities", route: "/monitor/entities", ar: "الكيانات والتأثير", en: "Entities & Influence",
    tabs: [
      { key: "twin", label: "التوأم الرقمي" },
      { key: "influencers", label: "رادار المؤثّرين" },
      { key: "profiler", label: "تحليل الحسابات" },
      { key: "compare", label: "المقارنة" },
    ],
    related: ["analysis", "corporate", "sources"],
  },
  {
    key: "corporate", route: "/monitor/corporate", ar: "استخبارات الشركات والمؤسسات", en: "Corporate Intelligence",
    tabs: [
      { key: "overview", label: "اللوحة" },
      { key: "reputation", label: "السمعة" },
      { key: "reviews", label: "ريفيوات Google" },
      { key: "complaints", label: "الشكاوى" },
      { key: "products", label: "المنتجات" },
      { key: "competitors", label: "المنافسون" },
      { key: "risk-index", label: "مؤشر المخاطر" },
      { key: "fraud", label: "الاحتيال" },
      { key: "crisis", label: "الأزمات" },
      { key: "response", label: "الاستجابة" },
    ],
    related: ["entities", "reports", "risk"],
  },
  {
    key: "reports", route: "/monitor/reports", ar: "التقارير والمخرجات", en: "Reports & Deliverables",
    tabs: [
      { key: "daily", label: "التقرير اليومي" },
      { key: "full", label: "التقرير الشامل" },
      { key: "campaign", label: "تقرير الحملات" },
      { key: "anger", label: "تقرير الغضب العام" },
      { key: "crisis", label: "تقرير الأزمات" },
      { key: "board", label: "موجز المجلس" },
      { key: "export", label: "مركز التصدير" },
    ],
    related: ["command", "corporate", "ai-analyst"],
  },
  {
    key: "ai-analyst", route: "/monitor/ai-analyst", ar: "المحلّل الذكي", en: "AI Analyst",
    tabs: [
      { key: "ask", label: "اسأل أي سؤال" },
      { key: "chief", label: "ضابط الاستخبارات" },
    ],
    related: ["command", "entities", "reports"],
  },
  {
    key: "system", route: "/monitor/system", ar: "النظام والكلفة", en: "System & Cost",
    tabs: [
      { key: "sources", label: "المصادر والإعدادات" },
      { key: "cost", label: "التحكّم بالكلفة" },
      { key: "usage", label: "الاستهلاك" },
      { key: "account", label: "الحساب" },
      { key: "orgs", label: "العملاء", adminOnly: true },
      { key: "packages", label: "الباقات والصلاحيات", adminOnly: true },
    ],
    related: ["command"],
  },
];

const BY_ROUTE: Record<string, ModuleDef> = Object.fromEntries(MODULES.map((m) => [m.route, m]));
const BY_KEY: Record<string, ModuleDef> = Object.fromEntries(MODULES.map((m) => [m.key, m]));

export const moduleByRoute = (path?: string | null): ModuleDef | undefined =>
  path ? BY_ROUTE[path] : undefined;
export const moduleByKey = (key?: string): ModuleDef | undefined => (key ? BY_KEY[key] : undefined);

const label = (m: ModuleDef, lang: string) => (lang === "en" ? m.en : m.ar);

/** Modules this one links out to, in declared order (missing keys dropped). */
export function relatedFor(key?: string): ModuleDef[] {
  const m = moduleByKey(key);
  if (!m?.related) return [];
  return m.related.map((k) => BY_KEY[k]).filter(Boolean);
}

/** href to a tab, honouring the module's param (`tab` | `src`). */
export function tabHref(m: ModuleDef, tabKey: string): string {
  return `${m.route}?${m.param || "tab"}=${tabKey}`;
}

/**
 * Command-palette index: every module plus every one of its tabs, each labelled
 * and grouped under its module. `isAdmin` gates admin-only tabs out for others.
 */
export function paletteEntries(lang: string, isAdmin: boolean): { label: string; href: string; group: string }[] {
  const out: { label: string; href: string; group: string }[] = [];
  for (const m of MODULES) {
    out.push({ label: label(m, lang), href: m.route, group: label(m, lang) });
    for (const t of m.tabs || []) {
      if (t.adminOnly && !isAdmin) continue;
      out.push({ label: t.label, href: tabHref(m, t.key), group: label(m, lang) });
    }
  }
  return out;
}
