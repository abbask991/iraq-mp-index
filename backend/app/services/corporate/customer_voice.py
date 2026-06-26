"""Customer Voice classification — the corporate-specific intelligence layer.

Classifies each mention of a company into what the customer is actually doing:
complaint · question · suggestion · praise · service_issue · product_issue ·
fraud_report. Rule-first Arabic/Iraqi lexicon (fast, free) so analysts get an
instant breakdown; an AI pass can refine later. Distinct from sentiment (tone)
and stance (support/oppose) — this is INTENT.
"""
from app.services import entity_resolver

CATEGORIES = ["complaint", "service_issue", "product_issue", "fraud_report",
              "question", "suggestion", "praise"]
LABEL_AR = {"complaint": "شكوى", "service_issue": "مشكلة خدمة", "product_issue": "مشكلة منتج",
            "fraud_report": "بلاغ احتيال", "question": "استفسار", "suggestion": "اقتراح",
            "praise": "إشادة"}

_LEX = {
    "complaint": ["شكوى", "اشتكي", "سيء", "زفت", "فاشل", "ما يردون", "مو راضي", "خربان", "مشكله",
                  "ما اشتغل", "تعب", "زهقت", "ما يستحق", "اسوأ", "خساره", "ما انصحكم"],
    "service_issue": ["صف طويل", "انتظار", "تاخير", "تأخير", "الموظف", "الفرع", "الصراف", "atm",
                      "ماكنه", "ماكينة", "معامله", "معاملة", "دوام", "موظفين", "خدمه العملاء", "ما يردون التلفون"],
    "product_issue": ["التطبيق", "الاب", "اپ", "القرض", "البطاقه", "البطاقة", "الحساب", "حواله", "حوالة",
                      "رسوم", "فائده", "فائدة", "قسط", "ماستر", "فيزا", "تحديث", "يعلق", "ما يفتح"],
    "fraud_report": ["نصب", "احتيال", "رابط مزيف", "موقع وهمي", "انتحال", "فيشينغ", "صفحه وهميه",
                     "صفحة وهمية", "الرقم السري", "otp", "كود التحقق", "رمز التحقق", "حساب مزيف",
                     "حذاري", "احذروا", "صفحه مزوره", "ينتحل", "محتال", "نصاب"],
    "question": ["كيف", "شلون", "ليش", "متى", "وين", "هل", "استفسار", "ممكن اعرف", "اريد اعرف", "؟"],
    "suggestion": ["اقترح", "ياريت", "ليتكم", "تمنى", "اتمنى", "ممكن تضيفون", "لو تسوون", "نصيحه", "يجب ان"],
    "praise": ["شكرا", "ممتاز", "رائع", "احسنتم", "خدمه رائعه", "تعامل راقي", "افضل بنك", "احسن",
               "بطل", "يعطيكم العافيه", "محترفين", "سريع", "تعامل حلو"],
}
_LEX_N = {k: [n for w in ws if (n := entity_resolver.normalize_arabic(w))] for k, ws in _LEX.items()}
# priority order when multiple match (fraud + complaints dominate)
_PRIORITY = ["fraud_report", "complaint", "service_issue", "product_issue", "suggestion", "question", "praise"]


def classify(text: str) -> dict:
    norm = entity_resolver.normalize_arabic(text or "")
    if not norm:
        return {"category": None, "confidence": 0.0}
    scores = {k: sum(norm.count(w) for w in ws) for k, ws in _LEX_N.items()}
    total = sum(scores.values())
    if total == 0:
        return {"category": None, "confidence": 0.0}
    top = max(_PRIORITY, key=lambda k: (scores[k], -_PRIORITY.index(k)))
    if scores[top] == 0:
        return {"category": None, "confidence": 0.0}
    return {"category": top, "confidence": round(scores[top] / total, 2)}


def aggregate(texts: list[str]) -> dict:
    counts = {k: 0 for k in CATEGORIES}
    classified = 0
    for t in texts:
        c = classify(t)["category"]
        if c:
            counts[c] += 1
            classified += 1
    total = classified or 1
    breakdown = [{"category": k, "label": LABEL_AR[k], "count": counts[k],
                  "pct": round(counts[k] / total * 100)} for k in CATEGORIES if counts[k]]
    breakdown.sort(key=lambda x: -x["count"])
    actionable = counts["complaint"] + counts["service_issue"] + counts["product_issue"] + counts["fraud_report"]
    return {"breakdown": breakdown, "counts": counts, "classified": classified,
            "actionable": actionable, "fraud_reports": counts["fraud_report"],
            "explain": "تصنيف نيّة العميل (شكوى/استفسار/إشادة/احتيال…) — تقدير لغوي يتطلّب مراجعة."}
