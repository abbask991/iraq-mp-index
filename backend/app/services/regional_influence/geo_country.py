"""Attribute an account to a country from its free-text `location`. This is what
makes the influence analysis honest: a Saudi account posting about Iraq is Gulf
discourse, not Iraqi — so direction is computed between accounts ACTUALLY located
in each country, not whoever matched a keyword. Accounts with no/unknown location
are left unattributed (excluded from directional analysis)."""
from app.services.collection import dedup

# Tokens are matched as substrings on the normalised (diacritic-stripped, lower)
# location. Keep tokens ≥4 chars to avoid spurious short-word hits.
_TOK = {
    "IQ": ["iraq", "baghdad", "basra", "basrah", "mosul", "erbil", "arbil", "najaf", "karbala",
           "kirkuk", "ramadi", "fallujah", "nasiriyah", "diwaniyah", "samawah", "kurdistan",
           "sulaymaniyah", "duhok",
           "العراق", "عراق", "عراقي", "بغداد", "البصره", "بصره", "الموصل", "موصل", "نينوى",
           "كركوك", "النجف", "كربلاء", "الانبار", "الرمادي", "الفلوجه", "الناصريه", "ذيقار",
           "الكوت", "العماره", "الديوانيه", "السماوه", "الحله", "بابل", "ديالى", "ميسان",
           "اربيل", "السليمانيه", "دهوك", "كردستان", "الكاظميه", "الكرخ", "الرصافه"],
    "SY": ["syria", "syrian", "damascus", "aleppo", "idlib", "homs", "hama", "latakia",
           "raqqa", "daraa", "hasakah", "qamishli", "deir",
           "سوريا", "سوريه", "سوري", "دمشق", "حلب", "ادلب", "حمص", "حماه", "اللاذقيه",
           "الرقه", "ديرالزور", "درعا", "الحسكه", "القامشلي"],
    "IR": ["iran", "iranian", "tehran", "isfahan", "mashhad", "tabriz", "shiraz",
           "ايران", "ايراني", "طهران", "اصفهان", "مشهد", "تبريز", "شيراز"],
    "LB": ["lebanon", "lebanese", "beirut", "tripoli lebanon", "sidon", "baalbek",
           "لبنان", "لبناني", "بيروت", "صيدا", "بعلبك", "الضاحيه", "البقاع"],
    "GULF": ["saudi", "riyadh", "jeddah", "jiddah", "makkah", "mecca", "madinah", "medina",
             "dammam", "emirates", "dubai", "abudhabi", "abu dhabi", "sharjah", "qatar",
             "doha", "kuwait", "bahrain", "manama", "oman", "muscat",
             "السعوديه", "السعوديةالعربيه", "الرياض", "جده", "مكه", "المدينه", "الدمام",
             "الامارات", "دبي", "ابوظبي", "الشارقه", "قطر", "الدوحه", "الكويت", "البحرين",
             "المنامه", "مسقط", "خليجي"],
    "TR": ["turkey", "turkiye", "ankara", "istanbul", "izmir",
           "تركيا", "تركي", "انقره", "اسطنبول", "ازمير"],
}
_NORM = {cc: [dedup.normalize(t).lower() if any("؀" <= ch <= "ۿ" for ch in t) else t.lower()
              for t in toks] for cc, toks in _TOK.items()}


def country_of(location: str):
    if not location:
        return None
    blob = dedup.normalize(location).lower()
    blob_lat = location.lower()
    for cc, toks in _NORM.items():
        for t in toks:
            if t and (t in blob or t in blob_lat):
                return cc
    return None
