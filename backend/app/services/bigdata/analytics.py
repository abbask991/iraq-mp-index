"""General big-data calculations + the orchestrating `analyze()` that composes
the bot / manipulation / influence / fingerprint modules into one payload.

`analyze()` and `brief_facts()` keep the exact shape the API + dossier rely on."""
from collections import defaultdict
from datetime import datetime, timezone

from app.services.bigdata import bot_detection, fingerprints, influence, manipulation

AGE_BANDS = [("< شهر", 0, 30), ("1-3 أشهر", 30, 90), ("3-12 شهر", 90, 365),
             ("1-3 سنوات", 365, 1095), ("3+ سنوات", 1095, 10 ** 9)]


def age_cohorts(ages):
    return [{"label": lbl, "count": sum(1 for a in ages.values() if a is not None and lo <= a < hi)}
            for lbl, lo, hi in AGE_BANDS]


def activity_and_timeline(tweets):
    """Returns (hours[24], peak_hour_share, timeline[≤24])."""
    n = len(tweets) or 1
    hours = [0] * 24
    tl = defaultdict(lambda: [0, 0])
    for t in tweets:
        try:
            dt = datetime.fromisoformat((t.get("created_at") or "").replace("Z", "+00:00"))
            hours[dt.hour] += 1
            kb = dt.strftime("%m-%d %H")
            tl[kb][0] += 1
            if t.get("sentiment") == "سلبي":
                tl[kb][1] += 1
        except Exception:
            pass
    peak_hour_share = max(hours) / n
    timeline = [{"t": k, "count": v[0], "neg": v[1]} for k, v in sorted(tl.items())][-24:]
    return hours, peak_hour_share, timeline


def analyze(keyword, tweets, users):
    now = datetime.now(timezone.utc)   # noqa: F841 (kept for parity / future use)
    n_posts = len(tweets)
    n_acc = len(users)
    if n_posts < 5 or n_acc < 3:
        return {"keyword": keyword, "posts": n_posts, "accounts": n_acc, "sparse": True}

    scores = bot_detection.bot_scores(users)
    ages = bot_detection.account_ages(users)
    bot_hist = bot_detection.histogram(scores)
    cohorts = age_cohorts(ages)

    hours, peak_hour_share, timeline = activity_and_timeline(tweets)

    dup_ratio, clusters, _norm = fingerprints.duplicate_clusters(tweets)
    waves, acc_times = fingerprints.coordination_waves(tweets)
    related = fingerprints.related_hashtags(keyword, tweets)
    domains = fingerprints.top_domains(tweets)

    manip, level, drivers, _susp = manipulation.manipulation_index(
        n_acc, scores, ages, dup_ratio, peak_hour_share)

    net = influence.influence_network(tweets, users, scores)
    amps = influence.amplifiers(tweets, users)
    auto = bot_detection.automation_fingerprint(users, scores, acc_times)

    return {
        "keyword": keyword, "posts": n_posts, "accounts": n_acc,
        "manipulation_index": manip, "level": level, "drivers": drivers,
        "bot_histogram": bot_hist, "age_cohorts": cohorts,
        "activity_by_hour": hours, "timeline": timeline,
        "network": net,
        "duplicate_clusters": clusters, "amplifiers": amps, "top_domains": domains,
        "coordination_waves": waves, "related_hashtags": related,
        "automation_suspects": auto,
    }


def brief_facts(d: dict) -> str:
    """Compact facts string fed to the AI analyst."""
    dr = d.get("drivers", {})
    amp = ", ".join(f"@{a['username']}" for a in d.get("amplifiers", [])[:3])
    rel = "، ".join(h["hashtag"] for h in d.get("related_hashtags", [])[:4])
    return (
        f"مؤشّر التلاعب {d.get('manipulation_index')}/100 ({d.get('level')}). "
        f"حسابات مشبوهة {dr.get('bot_pct')}%، محتوى مكرّر {dr.get('dup_ratio')}%، "
        f"حسابات جديدة {dr.get('new_pct')}%، تركيز زمني {dr.get('burst')}%. "
        f"{d.get('posts')} منشور من {d.get('accounts')} حساب. "
        f"موجات نشر متزامن: {len(d.get('coordination_waves', []))}. "
        f"حسابات بإيقاع آلي: {len(d.get('automation_suspects', []))}. "
        f"أبرز المضخّمين: {amp or '—'}. هاشتاغات مرافقة: {rel or '—'}."
    )
