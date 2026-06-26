"""Country query plans for the cross-border influence analysis. Each country is
fetched via a few focused parallel sub-queries (Arabic), then posts are tagged
with their country so shared issues can be located across the two timelines."""

IQ_QUERIES = [
    "العراق lang:ar",
    "(السوداني OR \"الحكومة العراقية\") lang:ar",
    "(\"الاطار التنسيقي\" OR الحشد) lang:ar",
    "(\"مجلس النواب العراقي\" OR \"البرلمان العراقي\") lang:ar",
    "(الكهرباء OR النفط OR الموازنة) العراق lang:ar",
    "(بغداد OR البصرة OR الموصل OR اربيل) lang:ar",
]

SY_QUERIES = [
    "سوريا lang:ar",
    "(\"احمد الشرع\" OR الجولاني OR \"الحكومة السورية\") lang:ar",
    "(\"هيئة تحرير الشام\" OR \"الادارة السورية\") lang:ar",
    "(دمشق OR حلب OR ادلب OR حمص) lang:ar",
    "(قسد OR \"قوات سوريا الديمقراطية\" OR الاكراد) سوريا lang:ar",
    "(العقوبات OR الاعمار OR اللاجئين) سوريا lang:ar",
]
