"""Narrative Discovery Engine — discover today's active narratives WITHOUT
predefined hashtags.

Pipeline: collect posts → classify (topic + sentiment) → cluster into narratives
(narrative_engine, by issue-framing not exact words) → score each narrative
(dominance + threat + growth) → rank. The national landscape; per-narrative deep
analysis lives in builder.build_detail().
"""
import re
from collections import Counter
from datetime import datetime

from app.services import ai, forecast, narrative_engine, x
from app.services.narratives import dominance

# Iraq-focused discovery seed (mirrors monitor.DISCOVER_SEED) — a wide net so the
# clustering, not the query, decides the narratives.
NATIONAL_SEED = (
    '(العراق OR بغداد OR البصرة OR النجف OR كربلاء OR الموصل OR كركوك OR "ذي قار" OR الانبار '
    'OR السوداني OR "مجلس النواب" OR "الاطار التنسيقي" OR الحشد OR الكهرباء OR الرواتب '
    'OR الموازنة OR "الحكومة العراقية" OR العراقي) lang:ar'
)

_HASH = re.compile(r"#[\w؀-ۿ_]+")


def _slug(name, keywords):
    base = (keywords[0] if keywords else name or "narrative")
    return re.sub(r"\s+", "-", str(base).strip())[:40] or "narrative"


def _series(posts):
    hours = Counter()
    for p in posts:
        try:
            dt = datetime.fromisoformat((p.get("created_at") or "").replace("Z", "+00:00"))
            hours[dt.strftime("%m-%d %H")] += 1
        except Exception:
            pass
    return [c for _, c in sorted(hours.items())]


async def discover_national(rng="day", limit=600):
    tw = await x.fetch_trend(NATIONAL_SEED, want=limit, range=rng)
    if "error" in tw:
        return {"error": tw["error"], "narratives": [], "scanned": 0}
    tweets, users = tw["tweets"], tw["users"]
    if not tweets:
        return {"narratives": [], "scanned": 0}

    cls = await ai.classify_all([t["text"] for t in tweets])
    for t, c in zip(tweets, cls):
        t["sentiment"] = c.get("sentiment", "محايد")
        t["type"] = c.get("type", "عام")

    narrs = narrative_engine.narratives(
        [{"title": t["text"], "type": t.get("type", "عام"), "sentiment": t.get("sentiment"),
          "created_at": t.get("created_at")} for t in tweets])

    total = len(tweets) or 1
    out = []
    for n in narrs:
        subset = [t for t in tweets if (t.get("type") or "عام") == n["type"]]
        if not subset:
            continue
        series = _series(subset)
        vel = min(100, max(0.0, forecast.velocity(series)) * 18) if len(series) >= 2 else 0
        pers = min(100, forecast.persistence(series) * 100) if len(series) >= 2 else 0
        eng = subset and (sum(t.get("engagement", 0) for t in subset) / len(subset)) or 0
        eng_n = min(100, eng / 12)
        infl = min(100, sum(1 for t in subset if (t.get("followers", 0) or 0) > 30000) / len(subset) * 200)
        hashtags = Counter(h for t in subset for h in _HASH.findall(t.get("text", "")))
        neg = sum(1 for t in subset if t.get("sentiment") == "سلبي")
        neg_ratio = neg / len(subset)
        sentiment = "سلبي" if neg_ratio > 0.55 else "إيجابي" if neg_ratio < 0.3 else "محايد"

        dom = dominance.dominance(
            mention_share=n["share"], velocity=vel, cross_platform=40 if hashtags else 25,
            influencer=infl, media=0, engagement=eng_n, persistence=pers)
        thr = dominance.threat(
            sentiment_neg=neg_ratio * 100, coordination=0, attack_pressure=neg_ratio * 80,
            reach=min(100, infl), velocity=vel, media=0, political=min(100, n["share"] * 1.5))

        out.append({
            "id": _slug(n["narrative"], n["keywords"]),
            "name": n["narrative"], "type": n["type"],
            "query": " ".join(n["keywords"][:3]) or n["narrative"],
            "dominance": dom, "threat": thr, "sentiment": sentiment,
            "growth_rate": round(vel), "posts": n["posts"], "share": n["share"],
            "platforms": 1 + (1 if hashtags else 0), "campaigns": 0,
            "keywords": n["keywords"],
            "top_hashtags": [h for h, _ in hashtags.most_common(5)],
            "risk_level": thr["label"],
        })

    out.sort(key=lambda x: -x["dominance"])
    return {"narratives": out, "scanned": len(tweets), "accounts": len(users), "range": rng}
