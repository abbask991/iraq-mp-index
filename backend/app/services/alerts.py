"""Alerting policy layer on top of notify.py delivery.

Adds the things a production intelligence platform needs so it doesn't spam:
  - 5 severity levels:  info < watch < yellow < orange < red
  - deduplication       (identical alert within a cooldown is suppressed)
  - cooldown            (per-severity quiet window)
  - escalation          (repeated firings bump severity one step + mark escalated)
  - history             (every decision recorded in alert_history)

notify.py stays a dumb delivery channel; this module decides whether to deliver.
"""
import hashlib

from app.services import db, notify, redis_client

# severity ladder (low → high) with per-level cooldown seconds
LEVELS = ["info", "watch", "yellow", "orange", "red"]
_COOLDOWN = {"info": 21600, "watch": 10800, "yellow": 7200, "orange": 3600, "red": 1800}
_ESCALATE_AFTER = 3          # N firings in the window → escalate one level
_ESCALATE_WINDOW = 10800     # 3h


def _rank(sev):
    return LEVELS.index(sev) if sev in LEVELS else 0


def normalize_severity(sev: str) -> str:
    """Map legacy high/medium/low onto the 5-level ladder."""
    return {"high": "red", "medium": "orange", "low": "yellow"}.get(sev, sev if sev in LEVELS else "watch")


def fingerprint(owner, monitor_id, atype) -> str:
    raw = f"{owner}|{monitor_id}|{atype}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:20]


async def raise_alert(sub, *, owner, monitor_id, atype, severity, message):
    """Decide + (maybe) deliver an alert. Returns a decision dict."""
    severity = normalize_severity(severity)
    fp = fingerprint(owner, monitor_id, atype)

    # escalation: count firings of this fingerprint family in the window
    count, _ = await redis_client.rate_limit(f"esc:{fp}", limit=10 ** 9, window=_ESCALATE_WINDOW)
    escalated = False
    if count >= _ESCALATE_AFTER and _rank(severity) < _rank("red"):
        severity = LEVELS[_rank(severity) + 1]
        escalated = True

    cooldown = _COOLDOWN.get(severity, 7200)
    # dedup: same fingerprint+severity inside cooldown → suppress
    if await redis_client.alert_seen(f"{fp}:{severity}", cooldown):
        await _record(owner, monitor_id, fp, atype, severity, message, escalated, delivered=False)
        return {"delivered": False, "suppressed": True, "severity": severity, "escalated": escalated}

    sent = await notify.deliver_alert(sub, message, severity) if sub else []
    await _record(owner, monitor_id, fp, atype, severity, message, escalated, delivered=bool(sent))
    return {"delivered": bool(sent), "channels": sent, "severity": severity, "escalated": escalated}


async def _record(owner, monitor_id, fp, atype, severity, message, escalated, delivered):
    try:
        await db.insert("alert_history", {
            "owner": owner, "monitor_id": str(monitor_id) if monitor_id else None,
            "fingerprint": fp, "type": atype, "severity": severity,
            "message": message, "escalated": escalated,
        })
    except Exception:
        pass


async def history(owner, limit=50):
    return await db.select(
        "alert_history",
        f"select=type,severity,message,escalated,created_at&owner=eq.{owner}"
        f"&order=created_at.desc&limit={limit}")
