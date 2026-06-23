"""Early Trend Detection engine.

Computes a 0-100 Trend Score from multiple weak signals (not just volume):
mention velocity, engagement velocity, influencer weight, sentiment shift,
cross-platform spread, novelty, and coordination. Pure functions over data the
collectors already provide — no continuous storage required for the X window
because X recent-search returns timestamped posts for the last 7 days.

Module map (spec → here):
  velocity_calculator   → _velocity / _eng_velocity
  influencer_scoring    → influence_score / _influencer_weight
  sentiment_analyzer    → (sentiment passed in) / _sentiment_shift
  coordination_detector → network.analyze (reused)
  trend_scoring         → score()
  alert_engine          → alert_level()
  report_generator      → early_warning_report()
"""
from collections import Counter
from datetime import datetime, timezone

from app.services import network

WEIGHTS = {
    "mention_velocity": 0.25,
    "engagement_velocity": 0.15,
    "influencer_weight": 0.15,
    "sentiment_shift": 0.15,
    "cross_platform": 0.10,
    "novelty": 0.10,
    "coordination": 0.10,
}

NARRATIVE_MAP = {
    "فساد/قضاء": "اتهامات فساد",
    "أمني/حادث": "حادث أمني",
    "تشريعي": "تعبئة تشريعية/انتخابية",
    "رقابي": "مساءلة ومحاسبة",
    "دبلوماسي/زيارة": "نشاط دبلوماسي",
    "تصريح": "تصريحات سياسية",
    "عام": "نقاش عام",
}


def _hours_ago(created: str, now: datetime):
    try:
        dt = datetime.fromisoformat((created or "").replace("Z", "+00:00"))
        return (now - dt).total_seconds() / 3600
    except Exception:
        return 9999


def influence_score(u: dict) -> int:
    """Account influence 1-10 (spec tiers approximated from public signals)."""
    m = u.get("public_metrics", {})
    foll = m.get("followers_count", 0)
    verified = u.get("verified", False)
    if foll >= 1_000_000:
        base = 10
    elif foll >= 300_000:
        base = 9
    elif foll >= 100_000:
        base = 8
    elif foll >= 30_000:
        base = 7
    elif foll >= 5_000:
        base = 5
    elif foll >= 1_000:
        base = 3
    else:
        base = 1
    if verified:
        base = min(10, base + 1)
    return base


def _velocity(times, now, window=1.0, base_window=24.0):
    last = sum(1 for t in times if t < window)
    base = sum(1 for t in times if t < base_window)
    avg = base / base_window if base else 0
    return (last / avg) if avg > 0 else (float(last) if last else 0.0)


def _eng_velocity(pairs, now, window=1.0, base_window=24.0):
    last = sum(e for t, e in pairs if t < window)
    base = sum(e for t, e in pairs if t < base_window)
    avg = base / base_window if base else 0
    return (last / avg) if avg > 0 else (1.0 if last else 0.0)


def _norm(x, cap):
    return max(0.0, min(1.0, x / cap))


def analyze(keyword, tweets, users, sentiments, news_count, platforms_present, total_platforms=2):
    """tweets: [{created_at, engagement, author_id, text}]; sentiments aligned to tweets."""
    now = datetime.now(timezone.utc)
    times = [_hours_ago(t.get("created_at"), now) for t in tweets]
    eng_pairs = [(times[i], tweets[i].get("engagement", 0)) for i in range(len(tweets))]

    mentions_1h = sum(1 for t in times if t < 1)
    mentions_24h = sum(1 for t in times if t < 24)
    total = len(tweets) + news_count

    mv = _velocity(times, now)
    ev = _eng_velocity(eng_pairs, now)

    # influencer weight: top participating account influence (normalized to 10)
    infl = [influence_score(u) for u in users.values()] or [1]
    influencer_weight = max(infl)

    # sentiment shift: negative ratio last 1h vs overall (proxy for 7d)
    s1 = [sentiments[i] for i in range(len(tweets)) if times[i] < 1]
    neg_1h = (sum(1 for s in s1 if s == "سلبي") / len(s1)) if s1 else 0
    neg_all = (sum(1 for s in sentiments if s == "سلبي") / len(sentiments)) if sentiments else 0
    sentiment_shift = neg_1h - neg_all

    cross = platforms_present / total_platforms

    # novelty proxy: burst of activity concentrated in last hour relative to history
    novelty = 0.8 if (mentions_1h >= 3 and mentions_24h <= mentions_1h * 4) else 0.4

    # coordination: reuse the bot/campaign analyzer
    net = network.analyze(tweets, users)
    coordination = min(1.0, len(net.get("duplicate_clusters", [])) * 0.3 + net.get("pct_new", 0) / 100
                       + net.get("pct_suspicious", 0) / 200)

    norm = {
        "mention_velocity": _norm(mv, 5),
        "engagement_velocity": _norm(ev, 5),
        "influencer_weight": influencer_weight / 10,
        "sentiment_shift": _norm(abs(sentiment_shift), 0.4),
        "cross_platform": cross,
        "novelty": novelty,
        "coordination": coordination,
    }
    score = round(100 * sum(norm[k] * WEIGHTS[k] for k in WEIGHTS))

    # narrative: dominant issue type among tweets (uses sentiment list's paired types if any)
    type_counter = Counter(t.get("type", "عام") for t in tweets if t.get("type"))
    dom_type = type_counter.most_common(1)[0][0] if type_counter else "عام"
    narrative = NARRATIVE_MAP.get(dom_type, "نقاش عام")

    # influencer trigger: earliest + most-engaged + top influence
    by_time = sorted(range(len(tweets)), key=lambda i: times[i], reverse=True)  # oldest last
    top_eng_i = max(range(len(tweets)), key=lambda i: tweets[i].get("engagement", 0)) if tweets else None
    top_accounts = sorted(users.values(), key=lambda u: influence_score(u), reverse=True)[:5]

    out = {
        "keyword": keyword,
        "trend_score": score,
        "alert": alert_level(score),
        "metrics": {
            "mention_velocity": round(mv, 2),
            "engagement_velocity": round(ev, 2),
            "influencer_weight": influencer_weight,
            "sentiment_shift": round(sentiment_shift, 2),
            "cross_platform_spread": round(cross, 2),
            "novelty": novelty,
            "coordination_signal": round(coordination, 2),
        },
        "normalized": {k: round(v, 2) for k, v in norm.items()},
        "totals": {
            "total_mentions": total, "x_mentions": len(tweets), "news_mentions": news_count,
            "mentions_last_1h": mentions_1h, "mentions_last_24h": mentions_24h,
            "neg_ratio_now": round(neg_1h, 2), "neg_ratio_overall": round(neg_all, 2),
        },
        "narrative": narrative,
        "coordination_verdict": net.get("verdict"),
        "top_influencers": [{
            "username": u.get("username"), "name": u.get("name"),
            "followers": u.get("public_metrics", {}).get("followers_count", 0),
            "influence": influence_score(u),
        } for u in top_accounts],
        "most_engaged_post": (tweets[top_eng_i].get("text", "")[:160]) if top_eng_i is not None else None,
    }
    out["report"] = early_warning_report(out)
    return out


def alert_level(score: int) -> dict:
    if score >= 85:
        return {"level": "red", "label": "إنذار أحمر", "priority": "عاجل"}
    if score >= 70:
        return {"level": "orange", "label": "إنذار برتقالي", "priority": "عالٍ"}
    if score >= 50:
        return {"level": "yellow", "label": "إنذار أصفر", "priority": "متابعة"}
    if score >= 30:
        return {"level": "watch", "label": "مراقبة", "priority": "منخفض"}
    return {"level": "normal", "label": "طبيعي", "priority": "—"}


def early_warning_report(o: dict) -> dict:
    m, t = o["metrics"], o["totals"]
    organic = o["metrics"]["coordination_signal"] < 0.4
    tone = ("سلبية" if t["neg_ratio_now"] > 0.5 else "إيجابية" if t["neg_ratio_now"] < 0.2 else "مختلطة")
    return {
        "what": f"موضوع «{o['keyword']}» — سردية {o['narrative']}.",
        "when": f"{t['mentions_last_1h']} منشور بآخر ساعة (من أصل {t['mentions_last_24h']} بـ24 ساعة).",
        "where": f"حاضر على {int(m['cross_platform_spread']*2)} منصّة (X + أخبار).",
        "who": ", ".join(f"@{i['username']}" for i in o["top_influencers"][:3]) or "حسابات عامة",
        "sentiment": tone,
        "organic_or_coordinated": "عضوي على الأرجح" if organic else f"مؤشرات تنسيق ({o['coordination_verdict']})",
        "risk": o["alert"]["label"],
        "response_priority": o["alert"]["priority"],
    }
