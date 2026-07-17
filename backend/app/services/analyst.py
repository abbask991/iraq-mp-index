"""Conversational intelligence analyst — answers free-form Arabic questions by
grounding Claude in the platform's OWN data: the national digest, the asked
entity's live profile, rising narratives, active campaigns, and live alerts.
Evidence-based and probabilistic; it must not invent numbers."""
import json

import httpx

from app.config import ANTHROPIC_API_KEY, SUMMARY_MODEL
from app.services import alert_engine, entity_resolver, intel_digest

_SUGGESTED = [
    "شنو الوضع الوطني العام اليوم؟",
    "منو أكثر شخصية تتعرّض للهجوم هالأسبوع؟",
    "شنو أخطر سردية صاعدة الآن؟",
    "هل في حملات منسّقة نشطة؟",
]


def _national(dg: dict) -> str:
    rs = dg.get("risk_summary", {})
    nr = round((rs.get("political", 0) + rs.get("crisis", 0) + rs.get("campaign", 0)) / 3) if rs else 0
    out = [f"الخطر الوطني {nr}/100 (سياسي {rs.get('political', 0)}، أزمة {rs.get('crisis', 0)}، حملات {rs.get('campaign', 0)})."]
    s = dg.get("national_sentiment", {})
    if s:
        out.append(f"المشاعر الوطنية: إيجابي {s.get('pos', 0)}، سلبي {s.get('neg', 0)}، محايد {s.get('neu', 0)}.")
    tr = dg.get("top_risk", [])[:5]
    if tr:
        out.append("الأعلى خطراً: " + "، ".join(f"{e['name']} (خطر {e.get('risk', 0)}، تغيّر سمعة {e.get('rep_delta', 0):+d})" for e in tr))
    nar = dg.get("rising_narratives", [])[:5]
    if nar:
        out.append("سرديات صاعدة: " + "، ".join(f"{n['narrative']} ({n.get('posts', 0)} منشور)" for n in nar))
    camp = dg.get("active_campaigns", [])[:5]
    if camp:
        out.append("حملات مشتبهة نشطة: " + "، ".join(f"#{c.get('hashtag')} (تنسيق {c.get('coordination_score', 0)})" for c in camp))
    return "\n".join(out)


def _entity(e: dict) -> str:
    emo = e.get("emotions") or {}
    top_emo = "، ".join(f"{k} {round(v * 100)}%" for k, v in sorted(emo.items(), key=lambda x: -x[1])[:3]) if emo else "—"
    return (f"الكيان «{e['name']}»: سمعة {e.get('reputation', '—')}/100، خطر {e.get('risk', '—')}/100، "
            f"نفوذ {e.get('influence', '—')}/100، أزمة {e.get('crisis', '—')}/100، "
            f"ثقة الجمهور {e.get('public_trust', '—')}، المسار {e.get('trajectory', '—')}، "
            f"تغيّر السمعة {e.get('rep_delta', 0):+d}. أبرز سردية: {e.get('top_narrative') or '—'}. "
            f"أبرز المشاعر: {top_emo}.")


def _match_entity(question: str, dg: dict):
    qn = entity_resolver.normalize_arabic(question)
    best = None
    for e in dg.get("entities", []):
        nm = entity_resolver.normalize_arabic(e["name"])
        if nm and nm in qn:
            if best is None or len(nm) > len(entity_resolver.normalize_arabic(best["name"])):
                best = e
    return best


async def ask(question: str, owner: str | None = None) -> dict:
    question = (question or "").strip()
    if not question:
        return {"answer": "اكتب سؤالك.", "entity": None}
    if not ANTHROPIC_API_KEY:
        return {"answer": "خدمة الذكاء الاصطناعي غير مفعّلة حالياً.", "entity": None}

    dg = await intel_digest.get_digest(owner) or {}
    ent = _match_entity(question, dg)
    try:
        alerts = (await alert_engine.feed(owner))[:8]
    except Exception:
        alerts = []

    ctx = ["[المشهد الوطني — آخر تحديث]", _national(dg)]
    if ent:
        ctx += ["", "[بيانات الكيان المسؤول عنه]", _entity(ent)]
    if alerts:
        ctx += ["", "[تنبيهات نشطة]"] + [f"- {a.get('message')}" for a in alerts]
    context = "\n".join(ctx)

    prompt = (
        "أنت كبير محلّلي الاستخبارات في منصّة Sentinel للاستخبارات السياسية والإعلامية في العراق. "
        "أجب على سؤال المستخدم بالعربية، بإيجاز ودقّة (٣-٧ جُمل)، معتمداً **فقط** على البيانات المرفقة أدناه. "
        "استشهد بالأرقام من البيانات عند الإمكان. إن كانت البيانات لا تكفي للإجابة، قل ذلك بصراحة واقترح "
        "أي تحليل/صفحة في المنصّة يجيب عليه. استخدم لغة احتمالية رصينة ولا تخترع أرقاماً غير موجودة.\n\n"
        f"=== البيانات ===\n{context}\n\n=== سؤال المستخدم ===\n{question}"
    )
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post("https://api.anthropic.com/v1/messages",
                             headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                                      "content-type": "application/json"},
                             json={"model": SUMMARY_MODEL, "max_tokens": 700,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=60)
            answer = r.json()["content"][0]["text"].strip()
    except Exception:
        answer = "تعذّر توليد الإجابة حالياً — حاول مرّة أخرى."

    return {
        "answer": answer,
        "entity": ent["name"] if ent else None,
        "grounded": bool(dg.get("entities")),
        "sources": [s for s in ([f"كيان: {ent['name']}"] if ent else []) + (["المشهد الوطني"] if dg else []) + ([f"{len(alerts)} تنبيه"] if alerts else [])],
    }
