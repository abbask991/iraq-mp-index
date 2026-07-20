// Client Workspace config — client types and use-case templates.
//
// A workspace adapts to the client type: which report outputs are emphasized and
// which framing leads. Templates preconfigure the REAL watchlist (the same
// /api/workspace/watchlist the manual editor writes) plus the client type — so
// picking a template is a genuine head-start, not a cosmetic label.

export type ReportKey = "daily" | "crisis" | "dossier" | "campaign" | "anger" | "corporate" | "executive" | "research";

export type ClientType = {
  key: string;
  ar: string;
  desc: string;
  reports: ReportKey[];   // report outputs most relevant to this client
};

export const CLIENT_TYPES: ClientType[] = [
  { key: "research_center", ar: "مركز أبحاث", desc: "قضايا بحثية، سرديات صاعدة، رأي عام، مذكّرات دورية", reports: ["research", "daily", "anger", "executive"] },
  { key: "government", ar: "جهة حكومية", desc: "إنذار مبكر، غضب عام، شكاوى الخدمات، ردّ الأزمات", reports: ["crisis", "anger", "daily", "executive"] },
  { key: "political_actor", ar: "فاعل سياسي", desc: "كيانات مهاجَمة، سرديات، حملات، ردّ موصى", reports: ["dossier", "campaign", "daily", "executive"] },
  { key: "corporate", ar: "شركة / مؤسسة", desc: "سمعة، شكاوى، منافسون، مخاطر أزمة", reports: ["corporate", "campaign", "executive"] },
  { key: "media", ar: "مؤسسة إعلامية", desc: "سرديات، ترندات، تغطية إعلامية", reports: ["daily", "campaign", "executive"] },
  { key: "embassy", ar: "سفارة / بعثة", desc: "مخاطر، تأثير إقليمي، إنذار مبكر", reports: ["executive", "crisis", "daily"] },
  { key: "investor", ar: "مستثمر", desc: "مخاطر، سمعة قطاعية، موجز تنفيذي", reports: ["executive", "corporate", "daily"] },
];

export const clientType = (key?: string) => CLIENT_TYPES.find((c) => c.key === key);

export type WatchlistPatch = { entities?: string[]; keywords?: string[]; brands?: string[]; fb_pages?: string[] };

export type Template = {
  key: string;
  ar: string;
  clientType: string;
  desc: string;
  patch: WatchlistPatch;
  reports: ReportKey[];
};

export const TEMPLATES: Template[] = [
  { key: "election", ar: "رصد انتخابي", clientType: "political_actor",
    desc: "المرشّحون، المفوضية، السرديات والحملات الانتخابية.",
    patch: { keywords: ["الانتخابات", "المفوضية العليا", "الدعاية الانتخابية", "نتائج الانتخابات"] },
    reports: ["campaign", "dossier", "daily"] },
  { key: "gov_performance", ar: "أداء حكومي", clientType: "government",
    desc: "الخدمات العامة والاستجابة الشعبية لها.",
    patch: { keywords: ["الكهرباء", "الخدمات", "الرواتب", "الصحة", "الماء"] },
    reports: ["daily", "anger", "executive"] },
  { key: "public_anger", ar: "تتبّع الغضب العام", clientType: "government",
    desc: "مؤشرات الغضب، الاحتجاج، والفساد.",
    patch: { keywords: ["الغلاء", "الفساد", "الاحتجاج", "البطالة"] },
    reports: ["anger", "crisis", "daily"] },
  { key: "corporate_reputation", ar: "سمعة الشركات", clientType: "corporate",
    desc: "سمعة العلامة والشكاوى وخدمة العملاء.",
    patch: { brands: ["اسم شركتك"], keywords: ["شكاوى", "خدمة العملاء"] },
    reports: ["corporate", "campaign", "executive"] },
  { key: "crisis", ar: "رصد الأزمات", clientType: "government",
    desc: "التصعيد، الاحتجاجات، وإشارات الأزمة المبكرة.",
    patch: { keywords: ["أزمة", "تصعيد", "احتجاجات", "إضراب"] },
    reports: ["crisis", "daily", "executive"] },
  { key: "disinformation", ar: "كشف التضليل", clientType: "political_actor",
    desc: "الحملات المنظّمة والشائعات والتضليل.",
    patch: { keywords: ["شائعة", "تضليل", "حملة منظمة", "أخبار كاذبة"] },
    reports: ["campaign", "dossier", "daily"] },
  { key: "policy_reaction", ar: "ردّ فعل السياسات", clientType: "government",
    desc: "استقبال القرارات والقوانين والسياسات.",
    patch: { keywords: ["قانون", "قرار حكومي", "سياسة", "تشريع"] },
    reports: ["daily", "anger", "executive"] },
  { key: "competitor", ar: "رصد المنافسين", clientType: "corporate",
    desc: "إشارات المنافسين ومقارنة السمعة.",
    patch: { brands: ["منافس 1", "منافس 2"] },
    reports: ["corporate", "executive"] },
  { key: "media_narrative", ar: "تتبّع السرديات الإعلامية", clientType: "media",
    desc: "السرديات المهيمنة والتأطير الإعلامي.",
    patch: { keywords: ["سردية", "تغطية إعلامية", "رأي عام"] },
    reports: ["daily", "campaign", "executive"] },
  { key: "research_weekly", ar: "موجز بحثي أسبوعي", clientType: "research_center",
    desc: "قضايا بحثية واتجاهات الرأي العام للنشر الدوري.",
    patch: { keywords: ["اتجاهات الرأي", "قضايا عامة", "نقاش عام"] },
    reports: ["research", "daily", "anger"] },
];

const CT_KEY = "rasd_client_type";
export const getClientType = (): string => { try { return localStorage.getItem(CT_KEY) || ""; } catch { return ""; } };
export const setClientType = (k: string) => { try { localStorage.setItem(CT_KEY, k); } catch { /* ignore */ } };
