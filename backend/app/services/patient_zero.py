"""Patient Zero — origin tracing. For any topic/hashtag/narrative, finds the
FIRST account that posted it, the first influential amplifier, the amplification
chain (who picked it up and when), the spread timeline, and whether the spread
looks organic or coordinated. Answers "who actually started this?" with evidence.
"""
from datetime import datetime, timezone

from app.services import timeline, x
from app.services.campaign import detector as campaign
from app.services.campaign import origin_tracker


def _dt(p):
    raw = p.get("created_at") or ""
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None


async def trace(topic: str, rng: str = "month"):
    from app.services.collection import budget
    budget.set_category("patient_zero")
    # a WIDE window so we actually catch the first mention, not just recent noise
    tw = await x.fetch_trend(topic, want=320, range=rng)
    if "error" in tw:
        return {"error": tw["error"], "topic": topic,
                "message": "تعذّر الجلب — تأكد من توكن X أو سقف الميزانية."}
    tweets, users = tw["tweets"], tw["users"]
    if len(tweets) < 5:
        return {"error": "NO_DATA", "topic": topic, "message": "عيّنة صغيرة جداً لتتبّع المصدر."}

    spread = origin_tracker.trace(tweets, users)

    # the actual origin POST (earliest dated) + its text
    dated = sorted(((p, _dt(p)) for p in tweets if _dt(p)), key=lambda x_: x_[1])
    origin_post = None
    if dated:
        p, d = dated[0]
        u = users.get(p.get("author_id"), {})
        origin_post = {"username": u.get("username"), "name": u.get("name"),
                       "text": (p.get("text") or "")[:240], "at": d.isoformat(),
                       "followers": (u.get("public_metrics") or {}).get("followers_count", 0),
                       "engagement": p.get("engagement", 0)}

    milestones = timeline.detect_timeline_milestones(tweets)
    series = timeline.hourly_series(tweets)

    camp = campaign.detect(topic, tweets, users, 0)
    coord = camp.get("coordination_score", 0)
    nature = ("منسّق عالي الاحتمال" if coord >= 60 else "إشارات تنسيق" if coord >= 35
              else "يبدو عضوياً")

    # amplification chain — accounts ordered by when they first joined the spread
    chain = sorted(spread.get("amplifiers", []), key=lambda a: -a.get("first_hours_ago", 0))[:8]

    summary = await _summarize(topic, origin_post, spread, coord, nature, len(tweets))

    return {
        "topic": topic, "period": rng,
        "origin_post": origin_post,
        "first_influential": spread.get("first_influential"),
        "amplifiers": spread.get("amplifiers", [])[:8],
        "chain": chain,
        "most_shared_domain": spread.get("most_shared_domain"),
        "unique_accounts": spread.get("unique_accounts", len(users)),
        "total_posts": len(tweets),
        "coordination_score": coord, "nature": nature,
        "milestones": milestones, "series": series,
        "summary": summary,
        "disclaimer": "تتبّع احتمالي ضمن آخر فترة مرصودة على X — قد يسبق المصدرَ الحقيقي محتوى خارج النافذة؛ "
                      "يتطلّب مراجعة بشرية.",
    }


async def _summarize(topic, origin, spread, coord, nature, n):
    from app.services.media_battlefield import battlefield_summary
    fi = spread.get("first_influential") or {}
    amps = "، ".join("@" + (a.get("username") or "") for a in spread.get("amplifiers", [])[:4]) or "—"
    facts = (
        f"تتبّع مصدر الموضوع «{topic}». "
        f"أول حساب نشره: @{(origin or {}).get('username') or '—'} في {(origin or {}).get('at', '')[:16]} "
        f"({(origin or {}).get('followers', 0)} متابع). "
        f"أول مضخّم مؤثّر: @{fi.get('username') or '—'} ({fi.get('followers', 0)} متابع). "
        f"أبرز المضخّمين: {amps}. إجمالي {n} منشور، درجة تنسيق {coord}/100 ({nature}). "
        f"اكتب موجزاً: من بدأ الموضوع، كيف ومتى انتشر، من ضخّمه، وهل يبدو عضوياً أم مُدبّراً."
    )
    out = await battlefield_summary.summarize(facts)
    return out.get("summary", "")
