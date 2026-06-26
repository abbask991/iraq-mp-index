"""Cross-border issue categorisation — maps a shared topic + its sample text to
one of the standing regional issue categories via an Arabic keyword lexicon."""
from app.services.collection import dedup

CATEGORIES = {
    "أمن": ["امن", "اعتداء", "اشتباك", "قصف", "عملية", "ارهاب", "داعش", "اغتيال", "تفجير", "هجوم"],
    "حدود": ["الحدود", "حدودي", "معبر", "منفذ", "تهريب", "تسلل"],
    "ميليشيات": ["ميليشيا", "فصائل", "الحشد", "السلاح", "مسلح"],
    "اقتصاد": ["اقتصاد", "تضخم", "بطاله", "استثمار", "اسعار", "معيشه", "فقر"],
    "عملة": ["الدينار", "الليره", "الدولار", "صرف", "العمله", "نقد"],
    "لاجئون": ["لاجئين", "نازحين", "مخيمات", "الهجره", "نزوح"],
    "كهرباء": ["كهرباء", "الطاقه", "تيار", "انقطاع", "مولدات"],
    "مياه": ["مياه", "الجفاف", "دجله", "الفرات", "حصص", "السدود", "ري"],
    "انتخابات": ["انتخابات", "اقتراع", "مفوضيه", "تصويت", "مرشح", "حمله"],
    "طائفية": ["طائفي", "سني", "شيعي", "مذهبي", "فتنه", "تحريض"],
    "تدخل خارجي": ["تدخل", "اجنبي", "سياده", "عقوبات", "احتلال", "وصايه"],
    "تجارة": ["تجاره", "تبادل", "صادرات", "استيراد", "بضائع", "ترانزيت"],
    "نفط وطاقة": ["نفط", "الغاز", "اوبك", "برميل", "التصدير", "حقول"],
    "احتجاجات": ["تظاهر", "احتجاج", "اعتصام", "مظاهرات", "غضب"],
    "دبلوماسية": ["دبلوماسي", "سفاره", "زياره", "اتفاقيه", "مباحثات", "وفد", "قمه"],
}

_LEX = {cat: [dedup.normalize(w) for w in ws] for cat, ws in CATEGORIES.items()}


def classify(topic: str, sample: str = "") -> str:
    blob = dedup.normalize(f"{topic} {sample}")
    best, best_hits = "عام", 0
    for cat, words in _LEX.items():
        hits = sum(1 for w in words if w and w in blob)
        if hits > best_hits:
            best, best_hits = cat, hits
    return best


async def ai_label(items: list) -> list:
    """One batched AI pass: clean Arabic issue name (handles clitics like a leading
    و) + accurate category, for items [{raw, sample}]. Falls back to the lexicon."""
    fallback = [{"label": it["raw"], "category": classify(it["raw"], it.get("sample", ""))} for it in items]
    from app.config import ANTHROPIC_API_KEY, SUMMARY_MODEL
    if not ANTHROPIC_API_KEY or not items:
        return fallback
    import json
    import httpx
    cats = "، ".join(CATEGORIES.keys())
    lines = "\n".join(f'{i}. عبارة: "{it["raw"]}" — مثال: {(it.get("sample") or "")[:120]}' for i, it in enumerate(items))
    prompt = (
        "لكل قضية أدناه أعطِ اسماً عربياً فصيحاً موجزاً (٢-٤ كلمات) يصف القضية الحقيقية (صحّح أي بادئة "
        "مثل «و» أو أخطاء)، وصنّفها ضمن واحدة فقط من الفئات التالية أو «عام»:\n"
        f"[{cats}]\n"
        "أعد JSON array فقط بنفس الترتيب وبنفس العدد، دون أي نص خارجه:\n"
        '[{"label":"...","category":"..."}]\n\n' + lines
    )
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post("https://api.anthropic.com/v1/messages",
                             headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                                      "content-type": "application/json"},
                             json={"model": SUMMARY_MODEL, "max_tokens": 900,
                                   "messages": [{"role": "user", "content": prompt}]}, timeout=45)
            txt = r.json()["content"][0]["text"]
            arr = json.loads(txt[txt.find("["):txt.rfind("]") + 1])
            out = []
            for i, it in enumerate(items):
                e = arr[i] if i < len(arr) and isinstance(arr[i], dict) else {}
                out.append({"label": e.get("label") or fallback[i]["label"],
                            "category": e.get("category") or fallback[i]["category"]})
            return out
    except Exception:
        return fallback
