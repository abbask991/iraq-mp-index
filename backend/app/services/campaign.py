"""Coordinated Campaign Detection.

Computes a 0-100 Coordination Score from 9 weighted signals. Each sub-score is
0-100. Uses probability language and always flags "requires human review" — it
never accuses an account or group with certainty.

Module map (spec → here):
  text_similarity_detector  → _text_similarity
  timing_burst_detector     → _timing_sync
  account_quality_scorer    → _account_suspicion
  network_graph_analyzer    → _network_amplification (mention-graph approximation)
  link_repetition_detector  → _link_repetition
  hashtag_pattern_detector  → _hashtag_pattern
  narrative_classifier      → _narrative_consistency
  (cross-platform)          → _cross_platform
  (influencer trigger)      → _influencer_trigger
  coordination_score_engine → detect()
  campaign_alert_engine     → _alert
  campaign_report_generator → _explanation
"""
import re
from collections import Counter
from datetime import datetime, timezone

from app.services import network, trends

WEIGHTS = {
    "text_similarity": 0.20,
    "timing_sync": 0.15,
    "account_suspicion": 0.15,
    "network_amplification": 0.15,
    "link_repetition": 0.10,
    "hashtag_pattern": 0.10,
    "cross_platform": 0.05,
    "narrative_consistency": 0.05,
    "influencer_trigger": 0.05,
}
_TOK = re.compile(r"[؀-ۿ]{3,}")


def _norm(t):
    return re.sub(r"\s+", " ", re.sub(r"https?://\S+|@\w+|[^\w\s]", " ", t or "", flags=re.U)).strip().lower()


def _epoch_min(created):
    try:
        return datetime.fromisoformat((created or "").replace("Z", "+00:00")).timestamp() / 60
    except Exception:
        return None


# ---- signals (each → 0..100) ----
def _text_similarity(tweets):
    n = len(tweets)
    norm = [_norm(t["text"]) for t in tweets]
    counts = Counter(x for x in norm if len(x) > 12)
    dup_posts = sum(c for c in counts.values() if c >= 2)
    dup_ratio = dup_posts / n if n else 0

    toks = [set(_TOK.findall(t["text"].lower())) for t in tweets]
    near = 0
    for i in range(n):
        for j in range(i + 1, n):
            a, b = toks[i], toks[j]
            if a and b:
                jac = len(a & b) / len(a | b)
                if jac >= 0.6:
                    near += 1
                    break
    near_ratio = near / n if n else 0
    top_phrases = [{"text": t[:120], "count": c} for t, c in counts.most_common(5) if c >= 2]
    score = min(100, round(dup_ratio * 100 + near_ratio * 55))
    return score, dup_ratio, top_phrases


def _timing_sync(tweets):
    mins = sorted(m for m in (_epoch_min(t["created_at"]) for t in tweets) if m is not None)
    n = len(mins)
    if n < 3:
        return 0, 0.0
    best = 0
    j = 0
    for i in range(n):
        while mins[i] - mins[j] > 15:
            j += 1
        best = max(best, i - j + 1)
    peak_ratio = best / n
    score = min(100, round(peak_ratio * 130))
    return score, round(peak_ratio, 2)


def _account_suspicion(users):
    if not users:
        return 0, 0.0
    scores = [network.bot_score(u)[0] for u in users.values()]
    avg = sum(scores) / len(scores)
    susp_ratio = sum(1 for s in scores if s >= 60) / len(scores)
    return round(0.6 * avg + 0.4 * susp_ratio * 100), round(susp_ratio, 2)


def _network_amplification(tweets, users):
    n = len(tweets)
    if not n:
        return 0
    posts_by = Counter(t["author_id"] for t in tweets)
    repeat_share = sum(c for c in posts_by.values() if c >= 3) / n          # repetitive amplifiers
    # mutual mention density: accounts mentioning each other within the set
    handles = {u.get("username", "").lower() for u in users.values() if u.get("username")}
    mention_edges = sum(1 for t in tweets for mn in t.get("mentions", []) if mn.lower() in handles)
    mention_density = min(1.0, mention_edges / n)
    return min(100, round(repeat_share * 70 + mention_density * 60))


def _link_repetition(tweets):
    n = len(tweets)
    doms = Counter(d for t in tweets for d in t.get("domains", []) if "t.co" not in d)
    links = Counter(l for t in tweets for l in t.get("links", []) if l)
    top_dom = doms.most_common(1)
    top_link = links.most_common(1)
    dom_share = (top_dom[0][1] / n) if (top_dom and n) else 0
    link_share = (top_link[0][1] / n) if (top_link and n) else 0
    score = min(100, round(dom_share * 120 + link_share * 80))
    top_links = [{"link": l, "count": c} for l, c in links.most_common(5) if c >= 2]
    return score, top_links


def _hashtag_pattern(tweets, users):
    n = len(tweets)
    all_tags = [h for t in tweets for h in t.get("hashtags", [])]
    avg_tags = len(all_tags) / n if n else 0
    combos = Counter(tuple(sorted(set(t.get("hashtags", [])))) for t in tweets if len(t.get("hashtags", [])) >= 2)
    top_combo = combos.most_common(1)
    combo_share = (top_combo[0][1] / n) if (top_combo and n) else 0
    stuffing = max(0, avg_tags - 1) * 14
    score = min(100, round(stuffing + combo_share * 70))
    top_tags = [{"hashtag": h, "count": c} for h, c in Counter(all_tags).most_common(8)]
    return score, top_tags


def _narrative_consistency(tweets):
    types = Counter(t.get("type", "عام") for t in tweets if t.get("type"))
    if not types:
        return 0, "نقاش عام"
    top, c = types.most_common(1)[0]
    share = c / sum(types.values())
    score = min(100, round(share * 100))
    return score, trends.NARRATIVE_MAP.get(top, "نقاش عام")


def _cross_platform(news_count, total_platforms=2):
    present = 1 + (1 if news_count else 0)
    return round(present / total_platforms * 100), present


def _influencer_trigger(users, spread):
    infl = [trends.influence_score(u) for u in users.values()] or [1]
    has_early_influential = 1 if (spread or {}).get("first_influential") else 0
    return min(100, round(max(infl) * 8 + has_early_influential * 20))


def _alert(score):
    if score >= 85:
        return {"level": "highly", "label": "حملة منظّمة عالية الاحتمال", "en": "Highly Coordinated"}
    if score >= 70:
        return {"level": "strong", "label": "إشارة تنسيق قوية", "en": "Strong"}
    if score >= 50:
        return {"level": "possible", "label": "حملة منظّمة محتملة", "en": "Possible"}
    if score >= 30:
        return {"level": "weak", "label": "إشارة تنسيق ضعيفة", "en": "Weak"}
    return {"level": "organic", "label": "عضوي / طبيعي", "en": "Organic"}


def _explanation(sub, facts):
    top = sorted(sub.items(), key=lambda kv: -kv[1])[:3]
    label = {
        "text_similarity": "تشابه نصّي عالٍ (تكرار/نسخ-لصق)",
        "timing_sync": "تزامن في توقيت النشر",
        "account_suspicion": "نسبة حسابات مشبوهة مرتفعة",
        "network_amplification": "تضخيم متبادل بين حسابات",
        "link_repetition": "تكرار رابط/دومين واحد",
        "hashtag_pattern": "نمط هاشتاغات مفتعل",
        "cross_platform": "انتشار عبر منصّات",
        "narrative_consistency": "تماسك سردية واحدة",
        "influencer_trigger": "تحريك من حسابات مؤثّرة",
    }
    drivers = "، ".join(label[k] for k, v in top if v >= 35) or "إشارات ضعيفة"
    return (
        f"احتمال تنسيق مبني على: {drivers}. "
        f"نسبة المحتوى المكرّر ~{int(facts['dup']*100)}٪، وذروة النشر بـ15 دقيقة ~{int(facts['peak']*100)}٪، "
        f"وحسابات مشبوهة ~{int(facts['susp']*100)}٪. "
        "هذه مؤشرات احتمالية وليست اتهاماً قاطعاً — تتطلّب مراجعة بشرية قبل أي توصيف نهائي."
    )


def detect(topic, tweets, users, news_count, window_label="آخر 7 أيام"):
    n = len(tweets)
    if n < 5:
        return {"topic": topic, "coordination_score": 0,
                "alert_level": _alert(0), "total_posts": n,
                "explanation": "عيّنة صغيرة جداً للحكم — يتطلّب مزيداً من البيانات."}

    ts, dup_ratio, top_phrases = _text_similarity(tweets)
    tm, peak_ratio = _timing_sync(tweets)
    aq, susp_ratio = _account_suspicion(users)
    net = _network_amplification(tweets, users)
    lk, top_links = _link_repetition(tweets)
    ht, top_tags = _hashtag_pattern(tweets, users)
    nar, narrative = _narrative_consistency(tweets)
    cp, platforms_present = _cross_platform(news_count)
    spread = trends.spread_analysis(tweets, users, [trends._hours_ago(t["created_at"], datetime.now(timezone.utc)) for t in tweets])
    inf = _influencer_trigger(users, spread)

    sub = {
        "text_similarity": ts, "timing_sync": tm, "account_suspicion": aq,
        "network_amplification": net, "link_repetition": lk, "hashtag_pattern": ht,
        "cross_platform": cp, "narrative_consistency": nar, "influencer_trigger": inf,
    }
    score = round(sum(sub[k] * WEIGHTS[k] for k in WEIGHTS))
    platforms = ["X"] + (["أخبار"] if news_count else [])

    return {
        "topic": topic,
        "main_hashtag": (top_tags[0]["hashtag"] if top_tags else None),
        "time_window": window_label,
        "coordination_score": score,
        "alert_level": _alert(score),
        "main_narrative": narrative,
        "sub_scores": sub,
        "weights": WEIGHTS,
        "total_posts": n,
        "unique_accounts": len(users),
        "duplicate_content_ratio": round(dup_ratio, 2),
        "peak_15min_post_ratio": peak_ratio,
        "suspicious_account_ratio": susp_ratio,
        "top_repeated_phrases": top_phrases,
        "top_hashtags": top_tags,
        "top_links": top_links,
        "top_amplifier_accounts": (spread or {}).get("amplifiers", [])[:6],
        "first_detected_accounts": [a for a in [(spread or {}).get("first_poster"), (spread or {}).get("first_influential")] if a],
        "platforms_detected": platforms,
        "explanation": _explanation(sub, {"dup": dup_ratio, "peak": peak_ratio, "susp": susp_ratio}),
        "disclaimer": "تحليل احتمالي آلي — لا يثبت التنسيق بشكل قاطع ويتطلّب مراجعة بشرية، خصوصاً بالقضايا السياسية والقانونية.",
    }
