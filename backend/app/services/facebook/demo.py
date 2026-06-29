"""Demo fixtures — realistic synthetic Iraqi Facebook data.

Lets us develop and present the whole intelligence layer WITHOUT Apify/Anthropic:
the data is synthetic but it flows through the REAL pipeline (normalizer, reaction
analyzer, comment clustering, gap, viral, dashboard). Sentiment/insights fall back
to the offline lexicon engine. Toggle with `?demo=1` on the endpoints.

Each post tuple: (text, [like,love,care,haha,wow,sad,angry], comments, shares, [comments...])
"""

# page_slug -> (display_name, category, followers, [posts...])
_PAGES = {
    "BrothersIraqDemo": ("الإخوة العراقية (تجريبي)", "personality", 1850000, [
        ("هيئة النزاهة تعلن السجن 10 سنوات لمدير عام بتهمة الفساد المالي واسترداد 12 مليار دينار",
         [42000, 3100, 900, 6800, 1200, 200, 380], 5400, 1900,
         ["عاشت ايدكم اخيرا محاسبة", "هاي مو ربع الحرامية الكبار وين رؤوس الفساد",
          "برافو عليكم هههه يعني الصغار بس", "كلهم سراق والقانون بس عالضعيف",
          "الله يحفظكم استمروا بالكشف", "12 مليار من 50 مليار منهوبة مهزلة",
          "وين الحيتان الكبار نطالب بمحاسبتهم", "احسنتم شغل نظيف ومحترم"]),
        ("القاضي يصدر مذكرة قبض بحق نائب سابق متهم بهدر المال العام",
         [38000, 2200, 600, 9100, 800, 150, 520], 7200, 2400,
         ["اكيد راح يهرب برة العراق مثل غيره", "محاسبة شكلية للاستهلاك الاعلامي",
          "زين سوو شي اخيرا", "نائب واحد من 329 حرامي", "ههههه راح يطلع بكفالة باچر",
          "الله ياخذ حقنا منهم", "نطالب بكشف امواله المهربة", "شجاعة من القضاء تستاهلون"]),
        ("افتتاح مدرسة جديدة في قضاء بعد تأخير 3 سنوات",
         [15000, 4200, 700, 1100, 600, 90, 110], 800, 600,
         ["شكرا للجهود الطيبة", "اخيرا التعليم ينتعش", "مدرسة وحدة بعد 3 سنين انجاز عظيم هههه",
          "وين باقي المدارس المتهالكة", "الله يوفقكم", "زينة بس مو كافية"]),
    ]),
    "SetAshwaqDemo": ("ست اشواق (تجريبي)", "personality", 980000, [
        ("بينما تهدأ الأوضاع في المدينة لا أحد يتحدث عن أزمة الكهرباء المستمرة منذ أشهر",
         [28000, 1800, 400, 2200, 900, 300, 4100], 3300, 1500,
         ["صدج الكهرباء صارت حلم", "كل صيف نفس المعاناة وماكو حل", "وين الوزارة نطالب بحل",
          "غاضبين من الفساد بقطاع الكهرباء", "الله يعيننا 4 ساعات كهرباء", "فشل ذريع للحكومة",
          "صوتك يوصل شكرا الج", "مولدات اهلية تنهب جيوبنا"]),
        ("ارتفاع جنوني بأسعار السلة الغذائية والمواطن يدفع الثمن",
         [31000, 900, 300, 1400, 700, 600, 5200], 4100, 2100,
         ["الاسعار نار ماكو رقابة", "الفقير ميكدر يعيش", "وين حماية المستهلك نطالب بمحاسبة",
          "غلاء فاحش وفساد بالاسواق", "الله المستعان", "شكرا على نقل معاناتنا",
          "حرامية التجار يحتكرون", "راتبي مايكفي اسبوع"]),
    ]),
    "RuslDemo": ("رسل المالكي (تجريبي)", "media", 620000, [
        ("في برنامج اليوم نناقش ملف المنافذ الحدودية والتهريب وضياع إيرادات الدولة",
         [9000, 800, 200, 2600, 400, 80, 900], 1200, 700,
         ["برنامج جريء يكشف الحقائق", "المنافذ وكر فساد ومافيات", "احسنتي طرح مهم",
          "هههه راح يتغير شي؟ ابدا", "نطالب باصلاح المنافذ", "كلام حلو بس ماكو تنفيذ",
          "الله يحميك صحفية شجاعة", "التهريب يمول الفاسدين"]),
        ("ضيف الحلقة يكشف أرقاماً صادمة عن حجم الأموال المهربة خارج العراق",
         [11000, 600, 150, 3400, 900, 70, 700], 1800, 1100,
         ["ارقام تصدم القلب", "وين تروح هالاموال", "محاسبة وين المحاسبة نطالب",
          "ياسلام احسنتو هههه نفس الكلام كل سنة", "صحافة محترمة", "الفساد ابتلع البلد"]),
    ]),
}


def _item(slug: str, name: str, idx: int, post) -> dict:
    text, rx, comments, shares, cmts = post
    like, love, care, haha, wow, sad, angry = rx
    return {
        "text": text, "pageName": name, "pageId": "demo_" + slug,
        "url": f"https://www.facebook.com/{slug}/posts/demo{idx}",
        "facebookUrl": f"https://www.facebook.com/{slug}/posts/demo{idx}",
        "time": f"2026-06-2{idx % 9}T1{idx % 9}:30:00+00:00",
        "type": "status",
        "reactionLikeCount": like, "reactionLoveCount": love, "reactionCareCount": care,
        "reactionHahaCount": haha, "reactionWowCount": wow, "reactionSadCount": sad,
        "reactionAngryCount": angry, "likes": like + love + care,
        "comments": comments, "shares": shares,
        "topComments": [{"text": c, "name": "مستخدم"} for c in cmts],
    }


def pages() -> list:
    return list(_PAGES.keys())


def items(slug: str, limit: int = 12) -> list:
    """Apify-shaped items for a demo page (slug match is case-insensitive, fuzzy)."""
    key = slug
    if key not in _PAGES:
        low = slug.lower().lstrip("@").strip("/")
        key = next((k for k in _PAGES if k.lower() == low or low in k.lower()), None)
    if not key:
        # unknown slug in demo mode → first page so the UI always has data
        key = next(iter(_PAGES))
    name = _PAGES[key][0]
    posts = _PAGES[key][3]
    return [_item(key, name, i, p) for i, p in enumerate(posts)][:limit]
