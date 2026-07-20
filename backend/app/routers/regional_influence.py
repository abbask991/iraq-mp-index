"""Regional influence API. Country pools + comparisons are SWR-cached; first call
computes, repeats are instant, refresh in the background."""
from fastapi import APIRouter

from app.services import cache
from app.services.regional_influence import builder, countries

router = APIRouter(prefix="/api/regional-influence", tags=["regional-influence"])


@router.get("/countries")
async def list_countries():
    return {"countries": [{"code": k, "name": v["ar"], "flag": v["flag"]} for k, v in countries.COUNTRIES.items()],
            "neighbors": countries.NEIGHBORS}


@router.get("/overview")
async def overview(range: str = "week"):
    return await cache.swr(f"reginf:overview:{range}", 5400, lambda: builder.overview(range))


async def _compare_demo(source: str, target: str) -> dict:
    """Curated demo for the regional-influence comparison (matches builder.compare
    shape — the keys RegionalView reads). Async so it drops into cache.swr."""
    c = countries.COUNTRIES
    sname = c.get(source, {}).get("ar", source); sflag = c.get(source, {}).get("flag", "🏳️")
    tname = c.get(target, {}).get("ar", target); tflag = c.get(target, {}).get("flag", "🏳️")
    return {
        "demo": True,
        "source_country": sname, "source_flag": sflag, "target_country": tname, "target_flag": tflag,
        "overview": {"src_leads": 62, "tgt_leads": 21, "strength": 68, "src_located": 340, "tgt_located": 180},
        "summary": (
            f"يقود {sname} النقاش المشترك مع {tname} في أغلب القضايا الإقليمية خلال الفترة (٦٢٪ ريادة مقابل ٢١٪)، "
            "بفارق زمني وسطي ٥ ساعات قبل أن تلتقط حسابات الطرف الآخر السردية. أقوى تدفّق كان في ملف المياه "
            "والطاقة، حيث ظهرت مطابقة نصّية عالية مع هاشتاغ مشترك — مؤشّر على تنسيق أو تأثّر مباشر."
        ),
        "issues": [
            {"issue": "أزمة المياه والحصص المائية", "category": "بيئة/موارد", "type": "تأثير مباشر",
             "type_color": "#4f9dff", "influence_score": 74, "confidence": "عالية", "concurrent": False,
             "leader_country": sname, "follower_country": tname, "lag_hours": 5, "correlation": 0.81,
             "src_count": 210, "tgt_count": 96,
             "leaders": [{"username": "iq_water_watch", "engagement": 4200}, {"username": "rafidain_voice", "engagement": 3100}],
             "receivers": [{"username": "sy_enviro"}, {"username": "levant_news_x"}],
             "evidence": {"similarity": 88, "matched_hashtag": "أزمة_المياه",
                          "source_post": {"username": "iq_water_watch", "at": "2026-07-17T09:20:00",
                                          "text": "انخفاض خطير في مناسيب دجلة والفرات يهدّد الموسم الزراعي"},
                          "target_post": {"username": "sy_enviro", "at": "2026-07-17T14:05:00",
                                          "text": "المناسيب في تراجع حادّ — الملف المائي يتجاوز الحدود"}}},
            {"issue": "ملف الطاقة والكهرباء", "category": "اقتصاد", "type": "تأثّر متبادل",
             "type_color": "#a855f7", "influence_score": 58, "confidence": "متوسطة", "concurrent": True,
             "leader_country": sname, "follower_country": tname, "lag_hours": 0, "correlation": 0.64,
             "src_count": 140, "tgt_count": 120,
             "leaders": [{"username": "energy_iq", "engagement": 2600}],
             "receivers": [{"username": "levant_energy"}, {"username": "mideast_grid"}]},
        ],
        "disclaimer": "مؤشّر احتمالي — يُستأنس به ولا يُعتمد كحقيقة قاطعة. (بيانات توضيحية)",
    }


@router.get("")
async def compare(source: str = "IQ", target: str = "SY", range: str = "week", demo: int = 0):
    if demo:
        return await cache.swr(f"reginf:demo:{source}:{target}", 86400, lambda: _compare_demo(source, target))
    return await cache.swr(f"reginf:{source}:{target}:{range}", 3600,
                           lambda: builder.compare(source, target, range))
