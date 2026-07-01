"""Studies & Research + Opinion Polls.

Studies: structured research reports on a topic (executive summary, methodology,
findings, sentiment, trend, recommendations) built from social signals.
Polls: passive opinion polling — measure public stance on a question from social
sentiment (support/oppose/neutral, by platform, over time, confidence).

Reuses the comment analyzer / news / X where real data is available; demo mode
returns coherent samples with charts.
"""


def _conf(n: int) -> int:
    return min(95, 45 + n // 40)


# ── Studies & Research ───────────────────────────────────────────────────────
async def studies(demo: bool = False) -> dict:
    if demo:
        return {"demo": True, "studies": [
            {"id": "st1", "title": "الرأي العام حول أداء الخدمات الحكومية", "type": "رأي عام",
             "date": "2026-06", "sample": 12400, "sentiment": {"pos": 24, "neu": 18, "neg": 58},
             "headline": "58% سلبية تجاه الخدمات، تتصدّرها الكهرباء والصحة."},
            {"id": "st2", "title": "سوق الاتصالات في العراق — تفضيلات المستهلك", "type": "سوق",
             "date": "2026-06", "sample": 8600, "sentiment": {"pos": 41, "neu": 30, "neg": 29},
             "headline": "التغطية أهم عامل، والسعر ثاني أكبر سبب للتذمّر."},
            {"id": "st3", "title": "السرديات السياسية الصاعدة (الربع الثاني)", "type": "سياسي",
             "date": "2026-Q2", "sample": 21000, "sentiment": {"pos": 19, "neu": 22, "neg": 59},
             "headline": "سردية «فشل الخدمات» الأسرع نمواً، تليها «الفساد»."},
        ]}
    return {"demo": False, "studies": [],
            "note": "لا دراسات محفوظة بعد — ولّد دراسة على موضوع، أو جرّب وضع العرض."}


async def study(topic: str, demo: bool = False) -> dict:
    if demo or not topic:
        return {
            "demo": True, "topic": topic or "أداء الخدمات الحكومية",
            "title": f"دراسة: {topic or 'الرأي العام حول أداء الخدمات الحكومية'}",
            "executive_summary": ("تكشف الدراسة مزاجاً عاماً سلبياً تجاه الخدمات الحكومية (58% سلبي)، "
                                  "مدفوعاً بأزمة الكهرباء وضعف الخدمات الصحية. الغضب يتصاعد والسرديات تنتقل "
                                  "من فيسبوك إلى بقية المنصّات. (وضع العرض — عيّنة توضيحية)."),
            "methodology": {"sources": ["فيسبوك", "إكس", "أخبار"], "sample": 12400, "period": "30 يوماً",
                            "method": "تحليل مشاعر آلي واعٍ للسخرية + تجميع قبل الذكاء الاصطناعي"},
            "confidence": _conf(12400),
            "sentiment": {"pos": 24, "neu": 18, "neg": 58},
            "trend": [40, 44, 49, 53, 56, 58],
            "key_findings": [
                "58% من التفاعل سلبي — أعلى من الربع السابق بـ8 نقاط.",
                "الكهرباء أكثر قضية إثارة للغضب (34% من الشكاوى).",
                "خدمة العملاء والصحة يليان الكهرباء مباشرة.",
                "الشباب (تقديري) الأكثر سلبية، والمحافظات أعلى من العاصمة.",
            ],
            "themes": [{"name": "الكهرباء", "share": 34}, {"name": "الصحة", "share": 21},
                       {"name": "الفساد", "share": 18}, {"name": "الطرق", "share": 14}, {"name": "التعليم", "share": 13}],
            "recommendations": [
                "معالجة ملف الكهرباء أولاً — الأعلى أثراً على المزاج العام.",
                "حملة تواصل استباقية تعترف بالمشكلة وتعرض خطة زمنية.",
                "مراقبة أسبوعية للمزاج لقياس أثر أي إجراء.",
            ],
            "disclaimer": "دراسة احتمالية آلية من إشارات عامة — تتطلّب مراجعة بشرية وبحثاً ميدانياً للتأكيد.",
        }
    # real path (best-effort) would gather + analyze mentions of the topic
    return {"demo": False, "topic": topic, "empty": True,
            "note": "توليد الدراسة الحقيقية يتطلّب مصادر مفعّلة (فيسبوك/X/أخبار). جرّب وضع العرض."}


# ── Opinion Polls (passive) ──────────────────────────────────────────────────
async def polls(demo: bool = False) -> dict:
    if demo:
        return {"demo": True, "polls": [
            {"id": "p1", "question": "هل تثق بأداء الحكومة الحالية؟", "sample": 9800,
             "result": {"support": 27, "oppose": 61, "neutral": 12}},
            {"id": "p2", "question": "أي شركة اتصالات تفضّل؟", "sample": 7400, "options": True,
             "result": {"آسياسيل": 41, "زين": 34, "كورك": 25}},
            {"id": "p3", "question": "هل تحسّنت الخدمات خلال آخر سنة؟", "sample": 6100,
             "result": {"support": 22, "oppose": 66, "neutral": 12}},
        ]}
    return {"demo": False, "polls": [], "note": "لا استطلاعات بعد — أنشئ سؤالاً، أو جرّب وضع العرض."}


async def poll(question: str, demo: bool = False) -> dict:
    if demo or not question:
        q = question or "هل تثق بأداء الحكومة الحالية؟"
        return {
            "demo": True, "question": q, "sample": 9800, "confidence": _conf(9800),
            "result": {"support": 27, "oppose": 61, "neutral": 12},
            "by_platform": [{"platform": "فيسبوك", "support": 24, "oppose": 64},
                            {"platform": "إكس", "support": 31, "oppose": 57},
                            {"platform": "أخبار", "support": 29, "oppose": 55}],
            "trend": [{"label": "أسبوع 1", "oppose": 52}, {"label": "أسبوع 2", "oppose": 56},
                      {"label": "أسبوع 3", "oppose": 59}, {"label": "أسبوع 4", "oppose": 61}],
            "reading": "المعارضة تتصاعد أسبوعياً؛ فيسبوك الأكثر سلبية. مؤشر ثقة منخفض بأداء الحكومة.",
            "method": "استطلاع سلبي (Passive) — مُشتق من مشاعر النقاش العام، مو استطلاع مباشر.",
            "disclaimer": "تقدير احتمالي من إشارات عامة — لا يُعادل استطلاعاً ميدانياً بعيّنة ممثّلة.",
        }
    return {"demo": False, "question": question, "empty": True,
            "note": "الاستطلاع الحقيقي يتطلّب مصادر مفعّلة. جرّب وضع العرض."}
