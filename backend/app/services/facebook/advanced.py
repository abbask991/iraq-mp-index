"""Advanced Facebook intelligence — the value-add layer on top of the core page
analysis: top commenters (advocates vs detractors), content performance, page
alerts, page comparison, and posting/timing analysis.

Demo mode returns coherent samples with chart-ready data. Real mode reuses the FB
engine where the data supports it; otherwise returns an honest 'needs sources' note.
"""


def _lvl(s):
    return "حرج" if s >= 76 else "مرتفع" if s >= 51 else "متوسط" if s >= 26 else "منخفض"


# ── 1. Top commenters — advocates & detractors ───────────────────────────────
async def top_commenters(target: str = "", demo: bool = False) -> dict:
    if demo:
        return {"demo": True, "page": "الإخوة النظيفة (تجريبي)",
                "advocates": [
                    {"name": "أبو علي", "comments": 42, "positivity": 91, "influence": "مرتفع",
                     "sample": "الله يحفظكم دائماً صادقين وتفضحون الفساد"},
                    {"name": "سجى ك.", "comments": 28, "positivity": 84, "influence": "متوسط",
                     "sample": "أفضل صفحة تنقل الحقيقة"},
                    {"name": "حسن م.", "comments": 19, "positivity": 78, "influence": "متوسط",
                     "sample": "استمروا، شغل محترم"},
                ],
                "detractors": [
                    {"name": "غير معروف 1", "comments": 37, "negativity": 88, "influence": "مرتفع",
                     "sample": "كلها دعاية وحچي فاضي", "flag": "نمط تعليق متكرّر — تنسيق محتمل"},
                    {"name": "أبو كرار", "comments": 24, "negativity": 81, "influence": "متوسط",
                     "sample": "ماكو مصداقية بالطرح"},
                    {"name": "م. العراقي", "comments": 21, "negativity": 76, "influence": "منخفض",
                     "sample": "نفس الكلام كل مرة"},
                ],
                "most_active": [{"name": "أبو علي", "comments": 42}, {"name": "غير معروف 1", "comments": 37},
                                {"name": "سجى ك.", "comments": 28}, {"name": "أبو كرار", "comments": 24}],
                "note": "تحديد الهوية من فيسبوك محدود — النتائج تقريبية وتتطلّب مراجعة بشرية.",
                "disclaimer": "مؤشرات احتمالية — «تنسيق محتمل» لا يُثبت شيئاً قاطعاً."}
    return {"page": target, "empty": True,
            "note": "تحليل المعلّقين يتطلّب سحب تعليقات مع هوية المؤلّف (محدود على فيسبوك). جرّب وضع العرض."}


# ── 2. Content performance ───────────────────────────────────────────────────
async def content_performance(target: str = "", demo: bool = False) -> dict:
    if demo:
        return {"demo": True, "page": "آسياسيل (تجريبي)",
                "by_type": [
                    {"type": "فيديو", "posts": 14, "avg_engagement": 8400, "avg_approval": 62},
                    {"type": "صورة", "posts": 22, "avg_engagement": 5100, "avg_approval": 55},
                    {"type": "نص", "posts": 9, "avg_engagement": 2200, "avg_approval": 48},
                    {"type": "رابط", "posts": 6, "avg_engagement": 1400, "avg_approval": 44},
                ],
                "by_topic": [
                    {"topic": "العروض والباقات", "posts": 12, "avg_engagement": 7200, "sentiment": "إيجابي"},
                    {"topic": "خدمة العملاء", "posts": 8, "avg_engagement": 6100, "sentiment": "سلبي"},
                    {"topic": "التغطية", "posts": 7, "avg_engagement": 4300, "sentiment": "مختلط"},
                    {"topic": "المسؤولية المجتمعية", "posts": 5, "avg_engagement": 3900, "sentiment": "إيجابي"},
                ],
                "best_type": "فيديو", "best_topic": "العروض والباقات",
                "insights": ["الفيديو يجيب ~1.6× تفاعل الصورة و~4× النص.",
                             "منشورات «خدمة العملاء» تفاعلها عالٍ لكن مشاعرها سلبية — جدل لا رضا.",
                             "«العروض» أفضل مزيج تفاعل+مشاعر إيجابية."],
                "recommendation": "ركّز على فيديوهات العروض، وحوّل منشورات خدمة العملاء لردود استباقية بدل إعلانات.",
                "disclaimer": "مؤشرات احتمالية — تتطلّب مراجعة بشرية."}
    return {"page": target, "empty": True, "note": "يتطلّب سحب منشورات الصفحة. جرّب وضع العرض."}


# ── 3. Page alerts (early warning) ───────────────────────────────────────────
async def alerts(target: str = "", demo: bool = False) -> dict:
    if demo:
        al = [
            {"type": "negative_spike", "title": "قفزة تعليقات سلبية", "severity": "حرج",
             "detail": "+140% تعليقات غاضبة خلال 12 ساعة حول «خصم الرصيد»", "time": "قبل ساعتين",
             "action": "بيان توضيحي + متابعة الحالات علناً"},
            {"type": "viral_negative", "title": "منشور سلبي فايرل", "severity": "مرتفع",
             "detail": "منشور بـ38 ألف تفاعل، 74% تعليقات سلبية", "time": "قبل 6 ساعات",
             "action": "ردّ رسمي مهذّب + معالجة سريعة"},
            {"type": "mood_drop", "title": "هبوط مفاجئ بالمزاج", "severity": "متوسط",
             "detail": "التأييد من 58% إلى 44% خلال 3 أيام", "time": "أمس",
             "action": "تحليل السبب + حملة محتوى إيجابي"},
        ]
        return {"demo": True, "page": "آسياسيل (تجريبي)", "alerts": al, "count": len(al), "highest": "حرج",
                "disclaimer": "إنذارات احتمالية — تتطلّب مراجعة بشرية فورية."}
    return {"page": target, "alerts": [], "count": 0,
            "note": "تنبيهات فيسبوك تعمل عند تفعيل الجمع المستمر. جرّب وضع العرض."}


# ── 4. Compare pages ─────────────────────────────────────────────────────────
async def compare(pages: list | None = None, demo: bool = False) -> dict:
    if demo:
        rows = [
            {"page": "آسياسيل", "approval": 50, "reaction_approval": 99, "comment_approval": 20,
             "gap": 34, "engagement": 176000, "sentiment": 42, "self": True},
            {"page": "زين العراق", "approval": 57, "reaction_approval": 96, "comment_approval": 34,
             "gap": 22, "engagement": 141000, "sentiment": 48},
            {"page": "كورك", "approval": 47, "reaction_approval": 94, "comment_approval": 18,
             "gap": 30, "engagement": 92000, "sentiment": 39},
        ]
        return {"demo": True, "pages": rows,
                "leader_approval": "زين العراق", "leader_engagement": "آسياسيل",
                "insights": ["آسياسيل الأعلى تفاعلاً لكن فجوته أكبر (تأييد ظاهري مضلّل).",
                             "زين أفضل مزاج تعليقات — سمعة أنظف.",
                             "كورك الأضعف — فرصة لكسب عملائه."],
                "recommendation": "قلّص فجوة التأييد عبر تحسين خدمة العملاء لتقترب من زين.",
                "disclaimer": "مؤشرات احتمالية — تتطلّب مراجعة بشرية."}
    return {"pages": [], "empty": True, "note": "أضِف أسماء الصفحات للمقارنة. جرّب وضع العرض."}


# ── 5. Posting / timing analysis ─────────────────────────────────────────────
async def posting_analysis(target: str = "", demo: bool = False) -> dict:
    if demo:
        by_hour = [{"hour": h, "engagement": v} for h, v in
                   [(8, 20), (10, 35), (12, 55), (14, 48), (16, 40), (18, 62), (20, 88), (22, 70)]]
        by_day = [{"day": d, "engagement": v} for d, v in
                  [("السبت", 40), ("الأحد", 55), ("الإثنين", 62), ("الثلاثاء", 58),
                   ("الأربعاء", 66), ("الخميس", 78), ("الجمعة", 90)]]
        return {"demo": True, "page": "آسياسيل (تجريبي)",
                "by_hour": by_hour, "by_day": by_day,
                "best_hour": "20:00", "best_day": "الجمعة",
                "sentiment_timeline": [{"date": "الأسبوع 1", "approval": 58}, {"date": "الأسبوع 2", "approval": 54},
                                       {"date": "الأسبوع 3", "approval": 49}, {"date": "الأسبوع 4", "approval": 44}],
                "recommendation": "انشر مساءً (8–10 مساءً) ويومَي الخميس/الجمعة لأعلى وصول.",
                "disclaimer": "مؤشرات احتمالية — تتطلّب مراجعة بشرية."}
    return {"page": target, "empty": True, "note": "يتطلّب سحب منشورات مع طوابع زمنية. جرّب وضع العرض."}
