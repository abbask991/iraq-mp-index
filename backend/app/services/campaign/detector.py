"""Campaign-detection orchestrator — composes the signal modules into a single
0-100 Coordination/Threat Score with probability language and a human-review
disclaimer. Public surface is `detect(...)`, identical to the old campaign.py."""
from app.services.campaign import (
    account_quality,
    campaign_dna,
    hashtag_signals,
    link_signals,
    narrative_signals,
    network_signals,
    origin_tracker,
    scoring,
    text_similarity,
    timing,
)


def detect(topic, tweets, users, news_count, window_label="آخر 7 أيام"):
    n = len(tweets)
    if n < 5:
        return {"topic": topic, "coordination_score": 0,
                "alert_level": scoring.alert(0), "total_posts": n,
                "explanation": "عيّنة صغيرة جداً للحكم — يتطلّب مزيداً من البيانات."}

    ts, dup_ratio, top_phrases = text_similarity.text_similarity(tweets)
    tm, peak_ratio = timing.timing_sync(tweets)
    aq, susp_ratio = account_quality.account_suspicion(users)
    net = network_signals.network_amplification(tweets, users)
    lk, top_links = link_signals.link_repetition(tweets)
    ht, top_tags = hashtag_signals.hashtag_pattern(tweets, users)
    nar, narrative = narrative_signals.narrative_consistency(tweets)
    cp, platforms_present = narrative_signals.cross_platform(news_count)
    spread = origin_tracker.trace(tweets, users)
    inf = narrative_signals.influencer_trigger(users, spread)

    sub = {
        "text_similarity": ts, "timing_sync": tm, "account_suspicion": aq,
        "network_amplification": net, "link_repetition": lk, "hashtag_pattern": ht,
        "cross_platform": cp, "narrative_consistency": nar, "influencer_trigger": inf,
    }
    score = scoring.score(sub)
    platforms = ["X"] + (["أخبار"] if news_count else [])

    result = {
        "topic": topic,
        "main_hashtag": (top_tags[0]["hashtag"] if top_tags else None),
        "time_window": window_label,
        "coordination_score": score,
        "alert_level": scoring.alert(score),
        "main_narrative": narrative,
        "sub_scores": sub,
        "weights": scoring.WEIGHTS,
        "total_posts": n,
        "unique_accounts": len(users),
        "duplicate_content_ratio": round(dup_ratio, 2),
        "peak_15min_post_ratio": peak_ratio,
        "suspicious_account_ratio": susp_ratio,
        "top_repeated_phrases": top_phrases,
        "top_hashtags": top_tags,
        "top_links": top_links,
        "top_amplifier_accounts": (spread or {}).get("amplifiers", [])[:6],
        "first_detected_accounts": [a for a in [(spread or {}).get("first_poster"),
                                                (spread or {}).get("first_influential")] if a],
        "platforms_detected": platforms,
        "explanation": scoring.explanation(sub, {"dup": dup_ratio, "peak": peak_ratio, "susp": susp_ratio}),
        "disclaimer": "تحليل احتمالي آلي — لا يثبت التنسيق بشكل قاطع ويتطلّب مراجعة بشرية، خصوصاً بالقضايا السياسية والقانونية.",
    }
    # attach a DNA fingerprint so callers can match against prior campaigns
    result["dna"] = campaign_dna.fingerprint(result)
    return result
