"""Product Intelligence — a demand/problems survey across a brand's products.

Answers: which product is most consumed/demanded? what are each product's problems?
why is a product NOT in demand? Reuses the comment analyzer over gathered mentions
for real data; demo mode returns a coherent survey with charts.
"""


def _level(s: int) -> str:
    return "مرتفع جداً" if s >= 75 else "مرتفع" if s >= 55 else "متوسط" if s >= 35 else "منخفض"


async def survey(brand: str, products: list | None = None, demo: bool = False) -> dict:
    if demo:
        return _demo()
    # real: analyze the brand's public page comments, attribute to products by name match
    try:
        from app.services import facebook as fb
        from app.services.facebook import comment_analyzer as ca
        d = await fb.analyze_page(brand, limit=12, comments=True)
        if d.get("error"):
            return {"brand": brand, "empty": True, "note": "اربط صفحة البراند وحدّد أسماء المنتجات لبدء المسح."}
        comments = [c.get("text") for c in (d.get("sample_comments") or []) if c.get("text")]
        names = products or []
        rows = []
        for p in names:
            hits = [c for c in comments if p in c]
            labs = ca.lexicon_classify(hits) if hits else []
            pos, neg = labs.count("إيجابي"), labs.count("سلبي")
            demand = min(100, len(hits) * 8 + pos * 3)
            rows.append({"name": p, "demand_score": demand, "demand_level": _level(demand),
                         "mentions": len(hits),
                         "sentiment": {"pos": pos, "neg": neg, "neu": len(labs) - pos - neg},
                         "problems": [], "reasons_low_demand": [], "recommendation": ""})
        rows.sort(key=lambda r: -r["demand_score"])
        return {"brand": brand, "products": rows,
                "most_demanded": rows[0]["name"] if rows else None,
                "least_demanded": rows[-1]["name"] if rows else None,
                "note": "بيانات محدودة — أضِف مصادر أوسع (فيسبوك/ريفيوات) لدقة أعلى.",
                "disclaimer": "مؤشرات احتمالية — تتطلّب مراجعة بشرية."}
    except Exception:
        return {"brand": brand, "empty": True, "note": "تعذّر مسح منتجات هذه العلامة حالياً."}


def _demo() -> dict:
    products = [
        {"name": "شيبس (عائلي)", "demand_score": 84, "demand_level": "مرتفع جداً", "mentions": 4200,
         "sentiment": {"pos": 66, "neg": 20, "neu": 14},
         "problems": ["العبوة تنفتح بصعوبة", "الحجم صغير مقابل السعر"], "reasons_low_demand": [],
         "recommendation": "حافظ على التوفّر + أطلق عبوة عائلية أكبر."},
        {"name": "بسكويت الشوكولاتة", "demand_score": 71, "demand_level": "مرتفع", "mentions": 3100,
         "sentiment": {"pos": 58, "neg": 27, "neu": 15},
         "problems": ["يذوب بالحر أثناء النقل"], "reasons_low_demand": [],
         "recommendation": "تحسين التغليف الحراري للتوزيع الصيفي."},
        {"name": "كيك مغلّف", "demand_score": 49, "demand_level": "متوسط", "mentions": 1600,
         "sentiment": {"pos": 44, "neg": 40, "neu": 16},
         "problems": ["تاريخ صلاحية قصير", "جفاف المنتج"], "reasons_low_demand": ["منافسة أطزج", "سعر أعلى قليلاً"],
         "recommendation": "إطالة الطزاجة + عروض ربط مع الشاي."},
        {"name": "عصير الفواكه", "demand_score": 33, "demand_level": "منخفض", "mentions": 900,
         "sentiment": {"pos": 26, "neg": 60, "neu": 14},
         "problems": ["طعم صناعي", "نسبة سكر عالية", "سعر مرتفع"],
         "reasons_low_demand": ["منافسون أرخص", "شكاوى الطعم المتكررة", "توجّه صحي للمستهلك"],
         "recommendation": "إعادة صياغة النكهة (تقليل السكر) + تسعير تنافسي + نسخة دايت."},
        {"name": "مشروب طاقة", "demand_score": 21, "demand_level": "منخفض", "mentions": 520,
         "sentiment": {"pos": 19, "neg": 66, "neu": 15},
         "problems": ["مخاوف صحية", "طعم لاذع", "ضعف التوزيع"],
         "reasons_low_demand": ["وعي صحي", "ضعف الحضور بالرفوف", "منافسة علامات عالمية"],
         "recommendation": "مراجعة الجدوى — إمّا إعادة تموضع صحي أو تقليص الإنتاج."},
    ]
    top_problems = [
        {"problem": "السعر مرتفع مقابل المنافسين", "count": 3},
        {"problem": "طعم/جودة غير مرضية", "count": 3},
        {"problem": "ضعف التوزيع والتوفّر", "count": 2},
        {"problem": "مخاوف صحية (سكر/طاقة)", "count": 2},
        {"problem": "مشاكل التغليف", "count": 2},
    ]
    return {
        "demo": True, "brand": "براند نموذجي — أغذية ومشروبات",
        "products": products,
        "most_demanded": "شيبس (عائلي)", "least_demanded": "مشروب طاقة",
        "top_problems": top_problems,
        "insights": [
            "الطلب مركّز على المقرمشات؛ المشروبات هي الأضعف بسبب الطعم والسعر والتوجّه الصحي.",
            "«العصير» و«الطاقة» يسحبان السمعة للأسفل — أعلى نسبة تعليقات سلبية.",
            "مشكلة عابرة للمنتجات: السعر مقابل المنافسين + ضعف التوزيع.",
        ],
        "recommended_actions": [
            "أعد صياغة العصير (سكر أقل) وسعّره تنافسياً — أعلى فرصة تحسين.",
            "راجع جدوى مشروب الطاقة (إعادة تموضع أو تقليص).",
            "حسّن التغليف الحراري للبسكويت صيفاً.",
            "أطلق عبوة عائلية للشيبس لتعظيم المنتج الأقوى.",
        ],
        "disclaimer": "استطلاع آلي احتمالي من إشارات الجمهور — يتطلّب مراجعة بشرية وبحثاً ميدانياً للتأكيد.",
    }
