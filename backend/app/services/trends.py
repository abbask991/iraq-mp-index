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
import math
import re
from collections import Counter
from datetime import datetime, timezone

from app.services import network

AR_STOP = set((
    "في من على عن الى إلى هذا هذه ذلك التي الذي الذين مع كل بعد قبل عند او أو ثم انه أنه ان أن "
    "لا ما يا كان كانت قد هو هي هم نحن انت أنت بين حول ضد دون منذ خلال حتى لكن غير عبر إن وان "
    "والتي وهو وهي يكون تكون العراق عراق بغداد التي اليوم الان الآن حول عبر بعد منو شنو هاي هسه "
    "عراقي عراقية اكثر اكبر اول جدا كذلك ايضا أيضا فقط حيث منها منه عنها عنه لها له بها به"
).split())
_AR_WORD = re.compile(r"[؀-ۿ]{4,}")

# foreign / non-Iraqi hashtags to drop from auto-discovery (standalone country tags)
EXCLUDE_HASHTAGS = {
    "ايران", "إيران", "السعودية", "قطر", "الكويت", "مصر", "سوريا", "سورية", "تركيا",
    "لبنان", "فلسطين", "غزة", "اسرائيل", "إسرائيل", "امريكا", "أمريكا", "روسيا", "اوكرانيا",
    "اليمن", "الامارات", "الإمارات", "البحرين", "الاردن", "الأردن", "المغرب", "الجزائر",
    "تونس", "السودان", "ليبيا", "عمان", "افغانستان",
}

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
        "spread": spread_analysis(tweets, users, times),
    }
    out["report"] = early_warning_report(out)
    return out


def spread_analysis(tweets, users, times):
    """Influencer-trigger detection: who started the hashtag and who amplified it
    (within the fetched window — X recent search = last 7 days)."""
    if not tweets:
        return {}

    def acct(i):
        u = users.get(tweets[i]["author_id"], {})
        m = u.get("public_metrics", {})
        return {"username": u.get("username"), "name": u.get("name"),
                "followers": m.get("followers_count", 0), "influence": influence_score(u),
                "hours_ago": round(times[i], 1)}

    oldest = max(range(len(tweets)), key=lambda i: times[i])           # earliest post
    first_poster = acct(oldest)

    infl_idx = [i for i in range(len(tweets))
                if influence_score(users.get(tweets[i]["author_id"], {})) >= 7]
    first_influential = acct(max(infl_idx, key=lambda i: times[i])) if infl_idx else None

    # amplifiers: aggregate per author, rank by engagement generated + influence
    agg: dict = {}
    for i, t in enumerate(tweets):
        a = t["author_id"]
        u = users.get(a, {})
        d = agg.setdefault(a, {
            "username": u.get("username"), "name": u.get("name"),
            "influence": influence_score(u),
            "followers": u.get("public_metrics", {}).get("followers_count", 0),
            "posts": 0, "engagement": 0, "first_hours_ago": 0.0,
        })
        d["posts"] += 1
        d["engagement"] += t.get("engagement", 0)
        d["first_hours_ago"] = max(d["first_hours_ago"], round(times[i], 1))
    amplifiers = sorted(agg.values(), key=lambda d: d["engagement"] + d["influence"] * 50, reverse=True)[:10]

    domains = Counter()
    for t in tweets:
        for dom in t.get("domains", []):
            if "t.co" not in dom:
                domains[dom] += 1
    top_domain = domains.most_common(1)

    return {
        "first_poster": first_poster,
        "first_influential": first_influential,
        "amplifiers": amplifiers,
        "unique_accounts": len(agg),
        "most_shared_domain": ({"domain": top_domain[0][0], "count": top_domain[0][1]} if top_domain else None),
    }


def discover(tweets, users, sentiments):
    """Auto-detect trending hashtags + keywords from a broad recent feed —
    no keyword needed. Ranks by 'heat' (volume + recent velocity + reach +
    engagement) and projects expected 24h volume from the recent rate."""
    now = datetime.now(timezone.utc)
    times = [_hours_ago(t.get("created_at"), now) for t in tweets]
    window = max(times) if times else 24.0
    RECENT = 6.0

    def _agg(key_list_fn):
        bag: dict = {}
        for i, t in enumerate(tweets):
            for k in key_list_fn(t):
                d = bag.setdefault(k, {"key": k, "count": 0, "recent": 0, "engagement": 0,
                                       "accounts": set(), "first": 0.0, "neg": 0, "pos": 0})
                d["count"] += 1
                if times[i] < RECENT:
                    d["recent"] += 1
                d["engagement"] += t.get("engagement", 0)
                d["accounts"].add(t["author_id"])
                d["first"] = max(d["first"], times[i])
                s = sentiments[i] if i < len(sentiments) else "محايد"
                if s == "سلبي":
                    d["neg"] += 1
                elif s == "إيجابي":
                    d["pos"] += 1
        return bag

    def _items(bag, label, min_count):
        out = []
        for d in bag.values():
            if d["count"] < min_count:
                continue
            base_rate = d["count"] / max(window, 1)
            recent_rate = d["recent"] / RECENT
            velocity = round(recent_rate / base_rate, 2) if base_rate > 0 else 0.0
            heat = d["count"] + velocity * 5 + len(d["accounts"]) * 0.5 + math.log10(d["engagement"] + 1) * 3
            out.append({
                label: d["key"], "mentions": d["count"], "recent_6h": d["recent"],
                "accounts": len(d["accounts"]), "engagement": d["engagement"],
                "velocity": velocity, "predicted_24h": round(recent_rate * 24 * 0.7),
                "sentiment": "سلبي" if d["neg"] > d["pos"] else "إيجابي" if d["pos"] > d["neg"] else "محايد",
                "first_hours_ago": round(d["first"], 1), "heat": round(heat, 1),
            })
        out.sort(key=lambda x: -x["heat"])
        return out

    hashtags = _items(_agg(lambda t: [h for h in t.get("hashtags", []) if h not in EXCLUDE_HASHTAGS]),
                      "hashtag", 2)[:20]
    keywords = _items(
        _agg(lambda t: {w for w in _AR_WORD.findall(t.get("text", "")) if w not in AR_STOP}),
        "keyword", 3)[:15]

    return {
        "hashtags": hashtags, "keywords": keywords,
        "scanned": len(tweets), "accounts": len(users), "window_hours": round(window, 1),
    }


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
