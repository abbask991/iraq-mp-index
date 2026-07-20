// Component-level package gating. Module-level entitlements already gate the
// sidebar (lib/nav.ts + the backend entitlements). This adds a finer gate for
// advanced *components* so pricing tiers are protected inside a module too.
//
// Ranks: trial/basic = 1, pro/professional = 2, enterprise = 3. The main admin
// always passes (checked in the FeatureGate).

export const PLAN_RANK: Record<string, number> = { trial: 1, basic: 1, pro: 2, professional: 2, enterprise: 3 };

export type FeatureKey =
  | "evidence_chain" | "board_summary" | "public_anger" | "campaigns"
  | "decision_simulator" | "memory_recall" | "action_impact" | "playbooks"
  | "roi_tracker" | "corporate" | "beneficiary" | "leverage";

export const FEATURE_MIN: Record<FeatureKey, number> = {
  // Professional
  evidence_chain: 2, board_summary: 2, public_anger: 2, campaigns: 2, leverage: 2, beneficiary: 2,
  // Enterprise
  decision_simulator: 3, memory_recall: 3, action_impact: 3, playbooks: 3, roi_tracker: 3, corporate: 3,
};

export const FEATURE_META: Record<FeatureKey, { name: string; value: string }> = {
  evidence_chain: { name: "سلسلة الأدلّة", value: "افتح الدليل الكامل وراء كل مؤشّر." },
  board_summary: { name: "موجز المجلس", value: "صفحة تنفيذية جاهزة لصانع القرار." },
  public_anger: { name: "مؤشر الغضب العام", value: "قياس الغضب الرقمي بمكوّناته." },
  campaigns: { name: "كشف الحملات", value: "كشف التنسيق والتضليل بتسع إشارات." },
  leverage: { name: "نقاط الرافعة", value: "أين يكون التدخّل أكثر فعالية." },
  beneficiary: { name: "تحليل المستفيد", value: "من قد يستفيد من السردية أو الأزمة." },
  decision_simulator: { name: "محاكي القرار", value: "إسقاط أثر القرارات قبل اتخاذها." },
  memory_recall: { name: "الذاكرة المرجعية", value: "هل حدث هذا من قبل؟ وماذا نتج عنه." },
  action_impact: { name: "أثر الإجراء", value: "قياس تغيّر الوضع قبل/بعد الاستجابة." },
  playbooks: { name: "أدلّة الاستجابة", value: "خطط جاهزة لأكثر السيناريوهات شيوعاً." },
  roi_tracker: { name: "عائد القيمة", value: "القيمة المُقدَّمة للتجديد والترقية." },
  corporate: { name: "استخبارات الشركات", value: "السمعة، الشكاوى، المنافسون، الأزمات." },
};

export const PLAN_AR: Record<string, string> = { trial: "تجريبي", basic: "أساسي", pro: "احترافي", professional: "احترافي", enterprise: "مؤسّسي" };
export const minPlanAr = (f: FeatureKey) => (FEATURE_MIN[f] >= 3 ? "المؤسّسي" : "الاحترافي");

export function planAllows(plan: string | undefined | null, feature: FeatureKey): boolean {
  return (PLAN_RANK[plan || "trial"] || 1) >= (FEATURE_MIN[feature] || 1);
}
