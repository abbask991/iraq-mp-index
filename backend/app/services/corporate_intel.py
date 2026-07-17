"""Corporate Intelligence suite — brand reputation, customer complaints, competitor
monitoring, fraud/fake-page detection, and a corporate risk index. Tailored for
banks/telecoms/brands. Reuses the Facebook engine + comment analyzer where real
data is available; demo mode returns rich curated payloads for presentations.
"""


def _level(s: int) -> str:
    return "حرج" if s >= 76 else "مرتفع" if s >= 51 else "متوسط" if s >= 26 else "منخفض"


def _health_level(s: int) -> str:
    return "ممتاز" if s >= 75 else "جيد" if s >= 55 else "متوسط" if s >= 40 else "ضعيف" if s >= 25 else "حرج"


# ── Unified Company Dashboard (the corporate "sales page") ────────────────────
async def company_dashboard(brand: str, demo: bool = False) -> dict:
    from app.services import google_reviews, product_intel
    rep = await brand_reputation(brand, demo=demo)
    if not demo and rep.get("empty"):
        return {"brand": brand, "empty": True, "note": rep.get("note")}
    rev = await google_reviews.fetch(brand, demo=demo)
    comp = await complaints(brand, demo=demo)
    risk = await risk_index(brand, demo=demo)
    fraud = await fraud_pages(brand, demo=demo)
    prod = await product_intel.survey(brand, demo=demo)
    crisis = await crisis_radar(brand, demo=demo)

    rep_s = rep.get("reputation_score") or 50
    rating = rev.get("rating") or 0
    pressure = (comp.get("pressure_score") or 50)
    risk_s = (risk.get("risk_index") or 50)
    health = round(0.30 * rep_s + 0.25 * (rating / 5 * 100) + 0.25 * (100 - pressure) + 0.20 * (100 - risk_s))

    return {
        "demo": demo, "brand": rep.get("brand", brand),
        "brand_health": health, "health_level": _health_level(health),
        "kpis": {
            "reputation": rep_s, "google_rating": rating, "google_reviews": rev.get("total_reviews"),
            "complaint_pressure": pressure, "risk_index": risk_s,
            "fake_pages": fraud.get("suspects_found", 0),
            "most_demanded": prod.get("most_demanded"), "least_demanded": prod.get("least_demanded"),
        },
        "sentiment": rep.get("sentiment", {}),
        "trend": rep.get("trend", []),
        "review_distribution": rev.get("distribution", {}),
        "top_complaints": comp.get("top_complaints", [])[:4],
        "products": [{"name": p["name"], "demand_score": p["demand_score"]} for p in prod.get("products", [])],
        "active_crises": crisis.get("crises", []),
        "recommended_actions": (risk.get("recommended_actions") or [])[:4],
        "disclaimer": "لوحة موحّدة — مؤشرات احتمالية تتطلّب مراجعة بشرية.",
    }


# ── Response Center (complaints → actionable tickets) ────────────────────────
_REPLY = {
    "خصم": "نعتذر عن هذا الإزعاج. يُرجى تزويدنا برقمك عبر الخاص وسنراجع عملية الخصم ونعيد المبلغ إن ثبت الخطأ خلال 24 ساعة.",
    "خدمة": "نأسف لتجربتك مع خدمة العملاء. تواصل معنا عبر الخاص برقمك وسيتابع فريق مختص حالتك فوراً.",
    "انترنت": "نعتذر عن ضعف الخدمة. شاركنا موقعك بالخاص لفحص التغطية ومعالجة المشكلة تقنياً.",
    "بطء": "نعتذر عن البطء. زوّدنا بموقعك ونوع الباقة بالخاص لتحسين تجربتك.",
    "سعر": "نقدّر ملاحظتك حول الأسعار؛ نعمل على عروض أفضل ونسعد بترشيح الباقة الأنسب لك عبر الخاص.",
    "_default": "شكراً لتواصلك ونعتذر عن أي إزعاج. راسلنا بالخاص بالتفاصيل وسنعالج الأمر بأسرع وقت.",
}


def _suggest_reply(text: str) -> str:
    for k, v in _REPLY.items():
        if k != "_default" and k in (text or ""):
            return v
    return _REPLY["_default"]


async def response_center(brand: str, demo: bool = False) -> dict:
    if demo:
        raw = [
            ("خصمولي 5 آلاف رصيد بلا سبب ومحد يرد عليّ", "facebook", "حرج", "سلبي", "أحمد ك.", "قبل ساعة"),
            ("خدمة العملاء ما ترد من الصبح، مقصّرين", "google", "مرتفع", "سلبي", "سارة م.", "قبل 3 ساعات"),
            ("الانترنت بطيء بمنطقتي من يومين", "x", "مرتفع", "سلبي", "مصطفى ع.", "قبل 5 ساعات"),
            ("الباقات غالية مقارنة بالمنافسين", "facebook", "متوسط", "محايد", "زينب ح.", "أمس"),
            ("شكراً على العرض الأخير كان ممتاز", "google", "منخفض", "إيجابي", "علي ر.", "أمس"),
        ]
        tickets = [{
            "id": f"T{1000 + i}", "text": t, "channel": ch, "priority": pr, "sentiment": se,
            "customer": cu, "time": tm, "status": "pending",
            "suggested_reply": _suggest_reply(t),
        } for i, (t, ch, pr, se, cu, tm) in enumerate(raw)]
        counts = {"total": len(tickets), "critical": sum(1 for x in tickets if x["priority"] == "حرج"),
                  "pending": len(tickets), "handled": 0}
        return {"demo": True, "brand": "آسياسيل", "tickets": tickets, "counts": counts,
                "disclaimer": "ردود مقترحة آلية — راجعها بشرياً قبل الإرسال."}
    try:
        from app.services import facebook as fb
        d = await fb.analyze_page(brand, limit=10, comments=True)
        if d.get("error"):
            return {"brand": brand, "empty": True, "note": "اربط صفحة الشركة على فيسبوك لبدء الرصد."}
        neg = [c for c in (d.get("sample_comments") or []) if c.get("sentiment") == "سلبي"]
        tickets = [{
            "id": f"T{1000 + i}", "text": c.get("text"), "channel": "facebook",
            "priority": "مرتفع", "sentiment": "سلبي", "customer": None, "time": None,
            "status": "pending", "suggested_reply": _suggest_reply(c.get("text", "")),
        } for i, c in enumerate(neg[:15])]
        return {"demo": False, "brand": d.get("page_name", brand), "tickets": tickets,
                "counts": {"total": len(tickets), "pending": len(tickets), "handled": 0,
                           "critical": 0},
                "disclaimer": "ردود مقترحة آلية — راجعها بشرياً قبل الإرسال."}
    except Exception:
        return {"brand": brand, "empty": True, "note": "تعذّر جلب البيانات لهذه العلامة حالياً."}


# ── Brand Crisis Radar + Alerts ──────────────────────────────────────────────
async def crisis_radar(brand: str, demo: bool = False) -> dict:
    if demo:
        crises = [
            {"type": "complaint_spike", "title": "قفزة شكاوى حول «خصم الرصيد»", "severity": "حرج",
             "detail": "+180% شكاوى خلال 24 ساعة مقارنة بالمعدّل", "evidence_count": 214,
             "recommended_action": "بيان توضيحي فوري + إيقاف الخصم المتنازع عليه", "time": "قبل 3 ساعات"},
            {"type": "fake_page", "title": "صفحة مزيفة تطلب بيانات البطاقة", "severity": "حرج",
             "detail": "AsiacellOffers.iq تنتحل العلامة وتجمع بيانات دفع", "evidence_count": 1,
             "recommended_action": "الإبلاغ الفوري + تحذير العملاء", "time": "قبل 5 ساعات"},
            {"type": "viral_negative", "title": "منشور سلبي فايرل عن خدمة العملاء", "severity": "مرتفع",
             "detail": "منشور بـ40 ألف تفاعل، 78% تعليقات غاضبة", "evidence_count": 40000,
             "recommended_action": "ردّ رسمي مهذّب + معالجة الحالة علناً", "time": "قبل 8 ساعات"},
            {"type": "rating_drop", "title": "هبوط تقييم Google", "severity": "متوسط",
             "detail": "من 3.6 إلى 3.4 خلال أسبوع", "evidence_count": 62,
             "recommended_action": "حملة تحفيز مراجعات إيجابية من العملاء الراضين", "time": "أمس"},
        ]
        return {"demo": True, "brand": "آسياسيل", "crises": crises, "count": len(crises),
                "highest": "حرج", "disclaimer": "مؤشرات إنذار احتمالية — تتطلّب مراجعة بشرية فورية."}
    # real: derive from the FB snapshot + reputation signals (best-effort)
    return {"demo": False, "brand": brand, "crises": [], "count": 0,
            "note": "رادار الأزمات يبدأ بالعمل بعد ربط مصادر الرصد لهذه العلامة."}


# ── 1. Brand Reputation ──────────────────────────────────────────────────────
async def brand_reputation(name: str, demo: bool = False) -> dict:
    if demo:
        return {
            "demo": True, "brand": "آسياسيل", "reputation_score": 54, "risk_score": 58,
            "sentiment": {"positive": 31, "negative": 52, "neutral": 17},
            "reaction_comment_gap": 34, "gap_note": "تفاعلات إيجابية ظاهرياً لكن التعليقات ناقدة بقوة.",
            "drivers_negative": ["ضعف خدمة العملاء", "غلاء الباقات", "انقطاع الخدمة في مناطق"],
            "drivers_positive": ["تغطية واسعة", "عروض المناسبات"],
            # REMOVED under the demo-is-a-contract rule. The real path below reuses
            # the Facebook engine, which computes no history and surfaces no ranked
            # mentions:
            #   trend / trend_note → need stored post history (migration 011)
            #   top_mentions       → analyze_page does not return it today
            # They drew a reputation curve and quoted mentions that the pipeline
            # cannot produce, so real data could never match this demo. Put each
            # back only once its real source exists.
            "recommended_action": "إطلاق حملة تحسين خدمة العملاء + ردّ استباقي على الشكاوى المتكررة.",
            "disclaimer": "مؤشرات احتمالية آلية — تتطلّب مراجعة بشرية.",
        }
    # real: treat the name as a public Facebook page and reuse the FB engine
    try:
        from app.services import facebook as fb
        d = await fb.analyze_page(name, limit=12, comments=True)
        if d.get("error"):
            return {"brand": name, "empty": True, "note": "اربط صفحة الشركة على فيسبوك لبدء تحليل السمعة."}
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
        return {"brand": name, "empty": True, "note": "تعذّر تحليل هذه العلامة حالياً."}


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
            return {"brand": name, "empty": True, "note": "اربط صفحة الشركة على فيسبوك لبدء الرصد."}
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
        return {"brand": name, "empty": True, "note": "تعذّر جلب البيانات لهذه العلامة حالياً."}


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
            "note": "حدّد أسماء المنافسين لبدء المقارنة."}


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
            "note": "كشف الصفحات المزيفة يبدأ بعد ربط مصادر الرصد لهذه العلامة."}


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
    return {"brand": name, "empty": True, "note": "يُحتسب المؤشر من إشارات السمعة والشكاوى والاحتيال بعد توفّرها."}
