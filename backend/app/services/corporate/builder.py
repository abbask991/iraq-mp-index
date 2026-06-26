"""Corporate Intelligence Center — one company in, full intelligence out.

Reuses the entity-agnostic engines (reputation, crisis, emotions, forecast) and
the corporate-specific layers (customer voice, fraud) to answer for a company:
reputation, emerging crisis, what customers are saying, emotions, fraud against
customers, cross-platform reach, and an AI executive brief + decision support.
"""
import re
from collections import Counter
from datetime import datetime

import json

from app.config import ANTHROPIC_API_KEY, SUMMARY_MODEL
from app.services import ai_cache, emotions, forecast, network, news, reputation_engine, risk_engine, x
from app.services.collection import smart_classify
from app.services.corporate import customer_voice, fraud


def _series(posts):
    hours = Counter()
    for p in posts:
        try:
            dt = datetime.fromisoformat((p.get("created_at") or "").replace("Z", "+00:00"))
            hours[dt.strftime("%m-%d %H")] += 1
        except Exception:
            pass
    return [c for _, c in sorted(hours.items())]


async def _brief(facts: str) -> dict:
    if not ANTHROPIC_API_KEY:
        return {}
    prompt = (
        "أنت مدير الاستخبارات المؤسسية لشركة. بناءً على المعطيات، أنتج موجزاً تنفيذياً لمجلس الإدارة. "
        "أعد JSON فقط بالعربية:\n"
        '{"executive":"موجز 3-4 جُمل","reputation_read":"قراءة السمعة بجملة",'
        '"top_risk":"أهم خطر","customer_mood":"مزاج العملاء بجملة",'
        '"decision":"should_respond|should_statement|monitor|escalate|contact_customers",'
        '"decision_ar":"التوصية بالعربية","why":"السبب","confidence":0-100}\n'
        "لغة احتمالية، استند للمعطيات فقط.\n\n" + facts)
    cached = await ai_cache.get(SUMMARY_MODEL, prompt)
    if cached is not None:
        return cached
    try:
        import httpx
        async with httpx.AsyncClient() as c:
            r = await c.post("https://api.anthropic.com/v1/messages",
                             headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                                      "content-type": "application/json"},
                             json={"model": SUMMARY_MODEL, "max_tokens": 650,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=60)
            txt = r.json()["content"][0]["text"]
            out = json.loads(txt[txt.find("{"):txt.rfind("}") + 1])
            await ai_cache.put(SUMMARY_MODEL, prompt, out)
            return out
    except Exception:
        return {}


_DECISION_AR = {"should_respond": "الردّ العلني", "should_statement": "إصدار بيان رسمي",
                "monitor": "المتابعة والرصد", "escalate": "تصعيد داخلي عاجل",
                "contact_customers": "التواصل مع العملاء المتأثّرين"}


def _fallback_brief(company, rep, crisis, cv, fr):
    neg_heavy = cv["counts"]["complaint"] + cv["counts"]["service_issue"] + cv["counts"]["product_issue"]
    if fr["count"] > 0:
        dec = "escalate"
    elif crisis["score"] >= 55:
        dec = "should_statement"
    elif neg_heavy >= 5:
        dec = "should_respond"
    else:
        dec = "monitor"
    return {
        "executive": (f"سمعة «{company}» عند {rep['score']}/100 (تقدير {rep['grade']})، ومؤشّر تصعيد الأزمة "
                      f"{crisis['score']}/100 ({crisis['stage']}). صوت العملاء: {cv['actionable']} إشارة قابلة للمعالجة، "
                      f"و{fr['count']} بلاغ احتيال محتمل. (موجز آلي — مراجعة بشرية مطلوبة.)"),
        "reputation_read": f"السمعة {rep['grade']} — الأبرز: {'، '.join(rep['drivers'])}.",
        "top_risk": "احتيال يستهدف العملاء" if fr["count"] else "تصاعد الشكاوى" if neg_heavy >= 5 else "مستقر",
        "customer_mood": f"{cv['breakdown'][0]['label']} هي الغالبة" if cv["breakdown"] else "هادئ",
        "decision": dec, "decision_ar": _DECISION_AR[dec],
        "why": "وجود بلاغات احتيال" if fr["count"] else "زخم سلبي" if crisis["score"] >= 55 else "ضمن الطبيعي",
        "confidence": 60, "fallback": True,
    }


async def build_corporate(company: str, rng: str = "week", limit: int = 300, sector: str = "") -> dict:
    import time as _t
    company = (company or "").strip()
    if not company:
        return {"error": "missing company"}

    tw = await x.fetch_trend(company, want=limit, range=rng)
    tweets = tw.get("tweets", []) if "error" not in tw else []
    users = tw.get("users", {}) if "error" not in tw else {}
    for t in tweets:
        u = users.get(t.get("author_id"), {})
        t["followers"] = u.get("public_metrics", {}).get("followers_count", 0)
    news_hits = await news.fetch_news([company], cap=40, range=rng)

    texts = [t.get("text", "") for t in tweets] + [h.get("title", "") for h in news_hits]
    if texts:
        cls, _ = await smart_classify.classify_posts([{"text": x_} for x_ in texts])
    else:
        cls = []
    sents = [c.get("sentiment", "محايد") for c in cls]
    pos = sents.count("إيجابي")
    neg = sents.count("سلبي")
    neu = len(sents) - pos - neg

    total = len(texts) or 1
    avg_fol = sum(t.get("followers", 0) for t in tweets) / max(1, len(tweets))
    reach = int(sum(t.get("followers", 0) for t in tweets) * 0.1) + len(news_hits) * 8000
    bot_ratio = (sum(1 for u in users.values() if network.bot_score(u)[0] > 60) / max(1, len(users))) if users else 0

    rep = reputation_engine.reputation_score(pos, neg, neu, reach=reach, bot_ratio=bot_ratio)

    series = _series(tweets)
    neg_series = series  # proxy
    vel = forecast.velocity(neg_series) if len(neg_series) >= 2 else 0
    accel = forecast.acceleration(neg_series) if len(neg_series) >= 3 else 0
    crisis = risk_engine.crisis_escalation_score(
        neg_velocity=max(0, vel) * (neg / total), neg_acceleration=max(0, accel), reach=reach,
        campaign_threat=0, persistence=min(8, len(series)))

    cv = customer_voice.aggregate(texts)
    emo = emotions.aggregate(texts)
    fr = fraud.scan_feed(
        [{"text": t.get("text", ""), "author": users.get(t.get("author_id"), {}).get("username"),
          "url": None} for t in tweets], company=company)

    # cross-platform reach (stored)
    try:
        from app.services.fusion import store
        xplat = await store.platform_totals()
    except Exception:
        xplat = {"platforms": [], "total_reach": 0}

    facts = (
        f"الشركة: {company}{(' (قطاع '+sector+')') if sector else ''}. السمعة {rep['score']}/100 ({rep['grade']}). "
        f"تصعيد الأزمة {crisis['score']}/100 ({crisis['stage']}). منشورات {len(tweets)}، أخبار {len(news_hits)}. "
        f"سلبي {round(neg/total*100)}% / إيجابي {round(pos/total*100)}%. "
        f"صوت العملاء: {'، '.join(b['label']+' '+str(b['pct'])+'%' for b in cv['breakdown'][:4]) or '—'}. "
        f"انفعالات بارزة: {'، '.join(k for k,v in sorted(emo.items(), key=lambda i:-i[1])[:3])}. "
        f"بلاغات احتيال: {fr['count']}."
    )
    brief = await _brief(facts)
    if not brief.get("executive"):
        brief = _fallback_brief(company, rep, crisis, cv, fr)
    brief["decision_ar"] = brief.get("decision_ar") or _DECISION_AR.get(brief.get("decision"), "المتابعة")

    return {
        "company": company, "sector": sector, "period": rng, "generated_at": int(_t.time()),
        "reputation": rep,
        "crisis": crisis,
        "sentiment": {"positive": round(pos / total * 100), "negative": round(neg / total * 100),
                      "neutral": round(neu / total * 100)},
        "customer_voice": cv,
        "emotions": dict(sorted(emo.items(), key=lambda i: -i[1])),
        "fraud": fr,
        "cross_platform": xplat,
        "brief": brief,
        "totals": {"posts": len(tweets), "news": len(news_hits), "accounts": len(users), "reach": reach},
        "disclaimer": "مركز الاستخبارات المؤسسية — تقديرات آلية احتمالية تتطلّب مراجعة بشرية.",
    }
