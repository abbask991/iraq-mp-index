"""Daily intelligence brief — the morning command briefing.

Assembles a structured, presentation-ready document (+ a concise Telegram/text
version) from the precomputed digest and the live alert feed. Generates ONE fresh
executive summary via the reliable battlefield summarizer; otherwise reuses the
digest, so there is no new X cost. `send_brief` pushes to Telegram and keeps the
last briefs in Redis for the history view.
"""
import json
import os
import time

from app.services import alert_engine, intel_digest, notify, redis_client
from app.services.media_battlefield import battlefield_summary

_RECENT_KEY = "briefs:recent"


def _threat(risk: int) -> dict:
    if risk >= 70:
        return {"level": "حالة حرجة", "code": "ALERT 1", "color": "#f43f5e"}
    if risk >= 50:
        return {"level": "تحذير مرتفع", "code": "ALERT 2", "color": "#fb923c"}
    if risk >= 30:
        return {"level": "مراقبة", "code": "ALERT 3", "color": "#f59e0b"}
    return {"level": "هادئ — تحت السيطرة", "code": "ALERT 4", "color": "#22c55e"}


async def build_brief(now_ts: float | None = None) -> dict:
    dg = await intel_digest.get_digest() or {}
    try:
        alerts = await alert_engine.feed()
    except Exception:
        alerts = []
    rs = dg.get("risk_summary", {})
    national_risk = round((rs.get("political", 0) + rs.get("crisis", 0) + rs.get("campaign", 0)) / 3) if rs else 0
    threat = _threat(national_risk)
    reds = [a for a in alerts if a.get("severity") == "red"]
    top_threats = dg.get("top_risk", [])[:5]
    movers = dg.get("movers", [])[:5]
    narrs = dg.get("rising_narratives", [])[:5]
    camps = dg.get("active_campaigns", [])[:5]
    sent = dg.get("national_sentiment", {})

    # fresh executive summary via the reliable summarizer — always strong narrative
    facts = (
        f"حالة التأهّب الوطني: {threat['level']} (الخطر {national_risk}/100). "
        f"مؤشرات الخطر: سياسي {rs.get('political', 0)}، أزمة {rs.get('crisis', 0)}، حملات {rs.get('campaign', 0)}. "
        f"المشاعر الوطنية: إيجابي {sent.get('pos', 0)}، سلبي {sent.get('neg', 0)}، محايد {sent.get('neu', 0)}. "
        f"أبرز التهديدات: {'، '.join(e['name'] + ' (خطر ' + str(e.get('risk', 0)) + ')' for e in top_threats[:3]) or '—'}. "
        f"أكبر التحرّكات: {'، '.join(e['name'] + ' ' + ('+' if e.get('rep_delta', 0) >= 0 else '') + str(e.get('rep_delta', 0)) for e in movers[:3]) or 'مستقرة'}. "
        f"سرديات صاعدة: {'، '.join(n['narrative'] for n in narrs[:3]) or '—'}. "
        f"حملات منسّقة نشطة: {len(camps)} ({'، '.join('#' + (c.get('hashtag') or '') for c in camps[:3]) or '—'}). "
        f"تنبيهات حرجة: {len(reds)} من أصل {len(alerts)}. "
        f"اكتب موجزاً تنفيذياً لقائد القرار عن آخر 24 ساعة، ثم توصيات عملية مرتّبة بالأولوية."
    )
    summ = await battlefield_summary.summarize(facts)

    return {
        "generated_at": now_ts or time.time(),
        "threat": {**threat, "risk": national_risk},
        "executive": summ.get("summary", "") or (dg.get("executive") or {}).get("brief", ""),
        "recommendations": summ.get("recommended_actions", []),
        "kpis": {"national_risk": national_risk, "political": rs.get("political", 0),
                 "crisis": rs.get("crisis", 0), "campaign": rs.get("campaign", 0),
                 "sentiment": sent, "alerts": len(alerts), "critical": len(reds),
                 "entities": dg.get("count", 0), "campaigns": len(camps)},
        "top_threats": [{"name": e["name"], "risk": e.get("risk", 0), "rep_delta": e.get("rep_delta", 0),
                         "trajectory": e.get("trajectory")} for e in top_threats],
        "movers": [{"name": e["name"], "rep_delta": e.get("rep_delta", 0), "risk_delta": e.get("risk_delta", 0)} for e in movers],
        "narratives": [{"narrative": n["narrative"], "posts": n.get("posts", 0), "neg_ratio": n.get("neg_ratio", 0),
                        "entities": (n.get("entities") or [])[:3]} for n in narrs],
        "campaigns": [{"hashtag": c.get("hashtag"), "coordination_score": c.get("coordination_score", 0)} for c in camps],
        "alerts": [{"severity": a.get("severity"), "message": a.get("message"), "type": a.get("type")} for a in alerts[:10]],
        "data_generated_at": dg.get("generated_at"),
        "disclaimer": "تحليل احتمالي آلي — يتطلّب مراجعة بشرية قبل أي قرار.",
    }


def telegram_text(brief: dict) -> str:
    th, k = brief["threat"], brief["kpis"]
    L = ["🛡️ <b>Sentinel — التقرير الاستخباراتي اليومي</b>",
         f"الحالة: <b>{th['level']}</b> · الخطر {th['risk']}/100 · تنبيهات حرجة {k['critical']}"]
    if brief["executive"]:
        L += ["", brief["executive"][:650]]
    if brief["top_threats"]:
        L += ["", "🎯 <b>أبرز التهديدات:</b>"] + [f"• {e['name']} — خطر {e['risk']}" for e in brief["top_threats"][:4]]
    if brief["campaigns"]:
        L += ["", "🕸️ <b>حملات منسّقة:</b> " + "، ".join("#" + (c["hashtag"] or "") for c in brief["campaigns"][:4])]
    if brief["recommendations"]:
        L += ["", "✅ <b>توصيات:</b>"] + [f"• {r}" for r in brief["recommendations"][:3]]
    L += ["", "افتح اللوحة الكاملة: https://rasd-monitor.vercel.app/monitor/brief"]
    return "\n".join(L)


async def send_brief(brief: dict | None = None) -> dict:
    brief = brief or await build_brief()
    chat = os.getenv("ALERT_TELEGRAM_CHAT", "")
    pushed = await notify.send_telegram(chat, telegram_text(brief)) if chat else False
    try:
        if redis_client.enabled():
            existing = json.loads(await redis_client.get(_RECENT_KEY) or "[]")
            existing.insert(0, {"generated_at": brief["generated_at"], "threat": brief["threat"],
                                "executive": (brief["executive"] or "")[:300], "kpis": brief["kpis"]})
            await redis_client.set(_RECENT_KEY, json.dumps(existing[:14], ensure_ascii=False), ex=86400 * 30)
    except Exception:
        pass
    return {"pushed": bool(pushed), "chat_configured": bool(chat), "generated_at": brief["generated_at"]}


async def recent() -> list:
    try:
        return json.loads(await redis_client.get(_RECENT_KEY) or "[]")
    except Exception:
        return []
