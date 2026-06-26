"""Real-time alert engine — turns the platform from passive (you check it) into
proactive (it pings you). Evaluates the precomputed digest (cheap, every 3h) for
threshold breaches — high entity risk, coordinated campaigns, national crisis,
fraud — de-duplicates, pushes to Telegram, and keeps a recent-alerts feed.

Run via /monitor/cron/alerts (point the free pinger at it). Thresholds come from
Settings → Alerts. Telegram destination = env ALERT_TELEGRAM_CHAT."""
import json
import os
import time

from app.services import notify, redis_client, settings

_FEED_KEY = "alerts:recent"
_COOLDOWN = 6 * 3600                       # don't repeat the same alert within 6h

_SEV_ICON = {"red": "🔴", "orange": "🟠", "yellow": "🟡", "watch": "🟦"}


async def _thr(key, default):
    try:
        return int(await settings.get("alerts", key, default) or default)
    except Exception:
        return default


async def evaluate() -> list[dict]:
    from app.services import intel_digest
    dg = await intel_digest.get_digest() or {}
    triggered: list[dict] = []

    min_risk = await _thr("min_risk_score", 60)
    min_camp = await _thr("min_campaign_score", 50)

    for e in dg.get("entities", []):
        r = e.get("risk", 0)
        if r >= min_risk:
            triggered.append({"type": "entity_risk", "severity": "red" if r >= 80 else "orange",
                              "key": e.get("name"),
                              "message": f"خطر مرتفع على «{e.get('name')}» — مؤشر الخطر {r}/100."})
    for c in dg.get("active_campaigns", []):
        cs = c.get("coordination_score", 0)
        if cs >= min_camp:
            triggered.append({"type": "campaign", "severity": "orange" if cs < 75 else "red",
                              "key": c.get("hashtag"),
                              "message": f"حملة منسّقة محتملة #{c.get('hashtag')} — درجة تنسيق {cs}/100."})
    rs = dg.get("risk_summary", {})
    if rs.get("crisis", 0) >= 65:
        triggered.append({"type": "crisis", "severity": "red", "key": "national",
                          "message": f"مؤشر الأزمة الوطني مرتفع — {rs['crisis']}/100."})
    for n in dg.get("rising_narratives", [])[:6]:
        if n.get("neg_ratio", 0) > 0.65 and n.get("posts", 0) >= 40:
            triggered.append({"type": "narrative", "severity": "yellow", "key": n.get("narrative"),
                              "message": f"سردية سلبية صاعدة: «{n.get('narrative')}» — {n.get('posts')} منشور."})
    return triggered


async def evaluate_and_notify() -> dict:
    triggered = await evaluate()
    enabled = True
    try:
        enabled = bool(await settings.get("alerts", "enabled", True))
    except Exception:
        pass
    if not enabled:
        return {"checked": len(triggered), "sent": 0, "disabled": True}

    chat = os.getenv("ALERT_TELEGRAM_CHAT", "")
    sent = []
    for t in triggered:
        fp = f"{t['type']}:{t['key']}:{t['severity']}"
        if await redis_client.alert_seen(fp, _COOLDOWN):     # already alerted recently
            continue
        text = f"{_SEV_ICON.get(t['severity'], '⚠️')} تنبيه Sentinel — {t['message']}"
        if chat:
            try:
                await notify.send_telegram(chat, text)
            except Exception:
                pass
        t["ts"] = int(time.time())
        sent.append(t)

    if sent:                                                 # prepend to the recent feed
        try:
            cur = json.loads(await redis_client.get(_FEED_KEY) or "[]")
        except Exception:
            cur = []
        feed = (sent + cur)[:40]
        await redis_client.set(_FEED_KEY, json.dumps(feed, ensure_ascii=False), ex=14 * 86400)

    return {"checked": len(triggered), "sent": len(sent), "pushed": bool(chat), "alerts": sent}


async def feed() -> list[dict]:
    try:
        return json.loads(await redis_client.get(_FEED_KEY) or "[]")
    except Exception:
        return []
