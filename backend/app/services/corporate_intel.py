"""Corporate Intelligence suite — brand reputation, customer complaints, competitor
monitoring, fraud/fake-page detection, and a corporate risk index. Tailored for
banks/telecoms/brands. Reuses the Facebook engine + comment analyzer where real
data is available; demo mode returns rich curated payloads for presentations.
"""


def _level(s: int) -> str:
    return "حرج" if s >= 76 else "مرتفع" if s >= 51 else "متوسط" if s >= 26 else "منخفض"


# ── 1. Brand Reputation ──────────────────────────────────────────────────────
async def brand_reputation(name: str, demo: bool = False) -> dict:
    if demo:
        return {
            "demo": True, "brand": "آسياسيل", "reputation_score": 54, "risk_score": 58,
            "sentiment": {"positive": 31, "negative": 52, "neutral": 17},
            "reaction_comment_gap": 34, "gap_note": "تفاعلات إيجابية ظاهرياً لكن التعليقات ناقدة بقوة.",
            "trend": [62, 60, 57, 55, 54], "trend_note": "-8 نقاط خلال أسبوعين",
            "drivers_negative": ["ضعف خدمة العملاء", "غلاء الباقات", "انقطاع الخدمة في مناطق"],
            "drivers_positive": ["تغطية واسعة", "عروض المناسبات"],
            "top_mentions": [{"text": "خدمة العملاء ما ترد بالمرة", "sentiment": "سلبي", "reach": 12000},
                             {"text": "الشبكة ممتازة بالمحافظة", "sentiment": "إيجابي", "reach": 4300}],
            "recommended_action": "إطلاق حملة تحسين خدمة العملاء + ردّ استباقي على الشكاوى المتكررة.",
            "disclaimer": "مؤشرات احتمالية آلية — تتطلّب مراجعة بشرية.",
        }
    # real: treat the name as a public Facebook page and reuse the FB engine
    try:
        from app.services import facebook as fb
        d = await fb.analyze_page(name, limit=12, comments=True)
        if d.get("error"):
            return {"brand": name, "empty": True, "note": "أضِف رابط صفحة الشركة على فيسبوك أو جرّب وضع العرض."}
        gap = d.get("comment_reaction_gap") or {}
        ins = d.get("insights") or {}
        cs = d.get("comment_sentiment") or {}
        tot = (cs.get("pos", 0) + cs.get("neg", 0) + cs.get("neu", 0)) or 1
        return {
            "demo": False, "brand": d.get("page_name", name),
            "reputation_score": d.get("approval"), "risk_score": d.get("rejection"),
            "sentiment": {"positive": round(cs.get("pos", 0) / tot * 100),
                          "negative": round(cs.get("neg", 0) / tot * 100),
                          "neutral": round(cs.get("neu", 0) / tot * 100)},
            "reaction_comment_gap": gap.get("gap_score"), "gap_note": gap.get("explanation"),
            "drivers_negative": ins.get("accusations", [])[:4] or ins.get("grievances", [])[:4],
            "drivers_positive": ins.get("praise", [])[:4],
            "recommended_action": "راجع الشكاوى المتكررة وردّ استباقياً.",
            "disclaimer": "مؤشرات احتمالية آلية — تتطلّب مراجعة بشرية.",
        }
    except Exception:
        return {"brand": name, "empty": True, "note": "تعذّر التحليل — جرّب وضع العرض."}


# ── 2. Customer Complaints ───────────────────────────────────────────────────
async def complaints(name: str, demo: bool = False) -> dict:
    if demo:
        return {
            "demo": True, "brand": "آسياسيل", "complaints_analyzed": 318, "complaint_ratio": 61,
            "pressure_score": 72,
            "top_complaints": [
                {"theme": "خدمة العملاء لا ترد", "count": 84, "severity": "مرتفع"},
                {"theme": "خصم رصيد بلا سبب", "count": 61, "severity": "حرج"},
                {"theme": "بطء الإنترنت", "count": 47, "severity": "متوسط"},
                {"theme": "غلاء الباقات", "count": 39, "severity": "متوسط"},
                {"theme": "صعوبة إلغاء الاشتراك", "count": 22, "severity": "متوسط"},
            ],
            "top_demands": ["إرجاع الرصيد المخصوم", "خدمة عملاء أسرع", "باقات أرخص", "شفافية الفواتير"],
            "repeated_phrases": [{"phrase": "خصمولي رصيد بلا سبب", "count": 34},
                                 {"phrase": "خدمة العملاء ما ترد", "count": 28}],
            "sample": [{"text": "خصمولي 5 آلاف بلا سبب وما أكدر أوصلهم", "sentiment": "سلبي"},
                       {"text": "أحسن شركة بالتغطية بس الأسعار غالية", "sentiment": "محايد"}],
            "recommended_action": "معالجة «خصم الرصيد» أولاً (الأعلى حدّة) + تسريع خدمة العملاء.",
            "disclaimer": "تصنيف آلي واعٍ للسخرية — يتطلّب مراجعة بشرية.",
        }
    try:
        from app.services import facebook as fb
        from app.services.facebook import comment_analyzer as ca
        d = await fb.analyze_page(name, limit=12, comments=True)
        if d.get("error"):
            return {"brand": name, "empty": True, "note": "أضِف صفحة الشركة أو جرّب وضع العرض."}
        ci = d.get("comment_intel") or {}
        ins = d.get("insights") or {}
        return {
            "demo": False, "brand": d.get("page_name", name),
            "complaints_analyzed": (ci.get("total_comments")),
            "pressure_score": (ci.get("pressure") or {}).get("score"),
            "top_complaints": [{"theme": g, "count": None, "severity": "—"} for g in ins.get("grievances", [])[:6]],
            "top_demands": ins.get("demands", [])[:5],
            "repeated_phrases": ci.get("repeated_phrases", []),
            "sample": d.get("sample_comments", [])[:6],
            "recommended_action": "عالج أعلى الشكاوى تكراراً استباقياً.",
            "disclaimer": "تصنيف آلي — يتطلّب مراجعة بشرية.",
        }
    except Exception:
        return {"brand": name, "empty": True, "note": "تعذّر — جرّب وضع العرض."}


# ── 3. Competitor Monitoring ─────────────────────────────────────────────────
async def competitors(name: str, demo: bool = False) -> dict:
    if demo:
        return {
            "demo": True, "brand": "آسياسيل",
            "competitors": [
                {"name": "آسياسيل", "share_of_voice": 41, "sentiment": 42, "reputation": 54, "self": True},
                {"name": "زين العراق", "share_of_voice": 34, "sentiment": 48, "reputation": 57},
                {"name": "كورك", "share_of_voice": 25, "sentiment": 39, "reputation": 47},
            ],
            "leader_sov": "آسياسيل", "leader_sentiment": "زين العراق",
            "insights": ["آسياسيل الأعلى حضوراً لكن زين أفضل بالمشاعر — فجوة سمعة تستحق المعالجة.",
                         "كورك الأضعف بالمشاعر — فرصة لكسب عملائه بحملة موجّهة."],
            "recommended_action": "حملة تركّز على تحسين المشاعر (خدمة العملاء) لتقليص فجوة السمعة مع زين.",
            "disclaimer": "مؤشرات احتمالية — تتطلّب مراجعة بشرية.",
        }
    return {"brand": name, "empty": True,
            "note": "مقارنة المنافسين تتطلّب تحديد أسماء المنافسين + بيانات مرصودة. جرّب وضع العرض للمعاينة."}


# ── 4. Fraud / Fake Pages ────────────────────────────────────────────────────
async def fraud_pages(name: str, demo: bool = False) -> dict:
    if demo:
        return {
            "demo": True, "brand": "آسياسيل", "suspects_found": 4,
            "suspects": [
                {"page": "AsiacellOffers.iq", "similarity": 88, "risk": "حرج",
                 "signals": ["اسم مقارب", "شعار مقلّد", "يطلب بيانات بطاقة", "حساب حديث"]},
                {"page": "asiacell-support", "similarity": 76, "risk": "مرتفع",
                 "signals": ["ينتحل خدمة العملاء", "روابط مشبوهة"]},
                {"page": "Asiacell Winners", "similarity": 71, "risk": "مرتفع",
                 "signals": ["سحوبات وهمية", "يطلب رسوم تحويل"]},
                {"page": "asia.cell.iq", "similarity": 63, "risk": "متوسط",
                 "signals": ["اسم مقارب", "محتوى منسوخ"]},
            ],
            "recommended_action": "الإبلاغ عن الصفحات الحرجة + تحذير العملاء من طلب بيانات البطاقة.",
            "disclaimer": "مؤشرات تشابه احتمالية — لا تُثبت احتيالاً؛ تتطلّب تحقّقاً بشرياً وقانونياً.",
        }
    return {"brand": name, "empty": True,
            "note": "كشف الصفحات المزيفة يتطلّب بحثاً عبر المنصّات + بصمات بصرية (يتكامل مع «كشف الصور»). جرّب وضع العرض."}


# ── 5. Corporate Risk Index ──────────────────────────────────────────────────
async def risk_index(name: str, demo: bool = False) -> dict:
    if demo:
        comps = {"reputation_risk": 46, "complaint_pressure": 72, "sentiment_risk": 58,
                 "fraud_exposure": 64, "crisis_signal": 40}
        overall = round(0.25 * comps["reputation_risk"] + 0.25 * comps["complaint_pressure"]
                        + 0.20 * comps["sentiment_risk"] + 0.15 * comps["fraud_exposure"]
                        + 0.15 * comps["crisis_signal"])
        return {
            "demo": True, "brand": "آسياسيل", "risk_index": overall, "level": _level(overall),
            "components": comps,
            "top_risks": ["ضغط شكاوى مرتفع (خصم الرصيد)", "٤ صفحات مزيفة تنتحل العلامة", "فجوة سمعة مقابل المنافس"],
            "recommended_actions": ["معالجة شكاوى الرصيد فوراً", "الإبلاغ عن الصفحات المزيفة",
                                    "حملة خدمة عملاء", "مراقبة يومية للمزاج"],
            "disclaimer": "مؤشر مركّب احتمالي — يتطلّب مراجعة بشرية.",
        }
    return {"brand": name, "empty": True, "note": "يجمّع المؤشر إشارات السمعة/الشكاوى/الاحتيال — جرّب وضع العرض."}
