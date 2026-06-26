"""Country registry for regional influence analysis. Each country = a few focused
Arabic sub-queries that approximate its national media timeline on X. Iraq is the
hub, but any pair is supported."""

COUNTRIES = {
    "IQ": {"ar": "العراق", "flag": "🇮🇶", "queries": [
        "العراق lang:ar",
        "(السوداني OR \"الحكومة العراقية\") lang:ar",
        "(\"الاطار التنسيقي\" OR الحشد) lang:ar",
        "(الكهرباء OR النفط OR الدينار) العراق lang:ar",
        "(بغداد OR البصرة OR الموصل OR اربيل) lang:ar",
    ]},
    "SY": {"ar": "سوريا", "flag": "🇸🇾", "queries": [
        "سوريا lang:ar",
        "(\"احمد الشرع\" OR الجولاني OR \"الحكومة السورية\") lang:ar",
        "(دمشق OR حلب OR ادلب OR حمص) lang:ar",
        "(قسد OR \"قوات سوريا الديمقراطية\" OR الاكراد) سوريا lang:ar",
        "(العقوبات OR الاعمار OR اللاجئين) سوريا lang:ar",
    ]},
    "IR": {"ar": "إيران", "flag": "🇮🇷", "queries": [
        "ايران lang:ar",
        "(خامنئي OR بزشكيان OR \"الحكومة الايرانية\") lang:ar",
        "(طهران OR اصفهان OR مشهد) lang:ar",
        "(العقوبات OR النووي OR التخصيب) ايران lang:ar",
        "(\"الحرس الثوري\" OR الباسيج) lang:ar",
    ]},
    "LB": {"ar": "لبنان", "flag": "🇱🇧", "queries": [
        "لبنان lang:ar",
        "(\"حزب الله\" OR نصرالله OR عون) lang:ar",
        "(بيروت OR الضاحية OR طرابلس) lang:ar",
        "(\"الليرة اللبنانية\" OR الازمة) لبنان lang:ar",
        "(اسرائيل OR الحدود OR الجنوب) لبنان lang:ar",
    ]},
    "GULF": {"ar": "الخليج", "flag": "🇸🇦", "queries": [
        "(الخليج OR السعودية OR الامارات OR قطر OR الكويت) lang:ar",
        "(\"بن سلمان\" OR \"بن زايد\") lang:ar",
        "(الرياض OR ابوظبي OR الدوحة OR الكويت) lang:ar",
        "(اوبك OR النفط OR الاستثمار) الخليج lang:ar",
        "\"مجلس التعاون الخليجي\" lang:ar",
    ]},
    "TR": {"ar": "تركيا", "flag": "🇹🇷", "queries": [
        "تركيا lang:ar",
        "(اردوغان OR \"الحكومة التركية\") lang:ar",
        "(انقرة OR اسطنبول) lang:ar",
        "(قسد OR \"العملية العسكرية\") تركيا lang:ar",
        "(\"الليرة التركية\" OR الاقتصاد) تركيا lang:ar",
    ]},
}

# Iraq's default regional neighbours for the influence map.
NEIGHBORS = ["SY", "IR", "LB", "GULF", "TR"]


def name(cc):
    return COUNTRIES.get(cc, {}).get("ar", cc)


def flag(cc):
    return COUNTRIES.get(cc, {}).get("flag", "🏳️")
