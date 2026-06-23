"""AI service — sentiment/issue classification + executive summaries via Claude.

Async; batches of 25 classified in parallel. Falls back to neutral on any error
so the pipeline never blocks on the model.
"""
import asyncio
import json
import httpx

from app.config import ANTHROPIC_API_KEY, CLASSIFY_MODEL, SUMMARY_MODEL

_NEUTRAL = {"sentiment": "محايد", "type": "عام"}
_API = "https://api.anthropic.com/v1/messages"
_HEADERS = lambda: {
    "x-api-key": ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
}


def _extract_json_array(text: str):
    i, j = text.find("["), text.rfind("]")
    return json.loads(text[i:j + 1]) if i >= 0 and j > i else None


async def _classify_chunk(client: httpx.AsyncClient, titles: list[str]) -> list[dict]:
    if not ANTHROPIC_API_KEY or not titles:
        return [dict(_NEUTRAL) for _ in titles]
    listed = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(titles))
    prompt = (
        f'عناوين أخبار. صنّف كل عنوان. أعد JSON array فقط بنفس الترتيب ({len(titles)} عنصر)، '
        'كل عنصر {"sentiment":"إيجابي|محايد|سلبي","type":"أمني/حادث|فساد/قضاء|تشريعي|رقابي|دبلوماسي/زيارة|تصريح|عام"}.'
        f"\n\n{listed}"
    )
    try:
        r = await client.post(_API, headers=_HEADERS(), json={
            "model": CLASSIFY_MODEL, "max_tokens": 2000,
            "messages": [{"role": "user", "content": prompt}],
        }, timeout=40)
        arr = _extract_json_array(r.json()["content"][0]["text"])
        if arr and len(arr) == len(titles):
            return arr
    except Exception:
        pass
    return [dict(_NEUTRAL) for _ in titles]


async def classify_all(titles: list[str]) -> list[dict]:
    """Classify every title; batches of 25 run concurrently."""
    if not titles:
        return []
    chunks = [titles[i:i + 25] for i in range(0, len(titles), 25)]
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*(_classify_chunk(client, c) for c in chunks))
    out: list[dict] = []
    for r in results:
        out.extend(r)
    return out


async def summarize(name: str, stats: dict, samples: list[dict]) -> str:
    if not ANTHROPIC_API_KEY or not name:
        return ""
    lines = "\n".join(
        f'{i + 1}. [{s.get("sentiment", "?")}] {s.get("title", "")}'
        for i, s in enumerate(samples[:40])
    )
    prompt = (
        f"أنت محلّل رصد إعلامي محترف. اكتب ملخّصاً تنفيذياً موجزاً (4 إلى 6 جُمل) بالعربية الفصحى "
        f"عن التغطية الإعلامية لـ«{name}» خلال الفترة المرصودة.\n\n"
        f'الإحصاءات: إجمالي {stats.get("total", 0)} منشور — إيجابي {stats.get("pos", 0)}، '
        f'محايد {stats.get("neu", 0)}، سلبي {stats.get("neg", 0)}. المؤشر الإعلامي {stats.get("idx", "-")}/100.\n\n'
        f"عيّنة من العناوين:\n{lines}\n\n"
        "غطِّ: النبرة العامة، أبرز المواضيع المتكررة، أبرز نقطة إيجابية وسلبية، وجملة ختامية تقييمية. "
        "نصاً متّصلاً احترافياً بدون عناوين أو نقاط، ابدأ مباشرة بالمحتوى."
    )
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(_API, headers=_HEADERS(), json={
                "model": SUMMARY_MODEL, "max_tokens": 700,
                "messages": [{"role": "user", "content": prompt}],
            }, timeout=40)
            return r.json()["content"][0]["text"].strip()
    except Exception:
        return ""
