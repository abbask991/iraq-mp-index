"""Facebook reception analysis — where the Iraqi PUBLIC actually is.

Facebook has no "dislike" button (7 reactions: Like/Love/Care = positive,
Haha/Wow = ambiguous, Sad/Angry = negative). So approval/rejection is measured
from the reaction BREAKDOWN per post + (next) comment sentiment. Scrapes PUBLIC
pages/groups via Apify (billed separately from the X provider — NOT AICE credits).
"""
import asyncio
import os
import re
import time

import httpx

_API = "https://api.apify.com/v2"
_ACTOR = "apify~facebook-posts-scraper"
_COMMENTS_ACTOR = "apify~facebook-comments-scraper"

_POS = ["reactionLikeCount", "reactionLoveCount", "reactionCareCount"]
_NEG = ["reactionAngryCount", "reactionSadCount"]
_AMB = ["reactionHahaCount", "reactionWowCount"]


def enabled() -> bool:
    return bool(os.getenv("APIFY_TOKEN"))


def normalize_target(s: str) -> str:
    """Accept a full URL, an @handle, or a bare page name → a facebook.com URL."""
    s = (s or "").strip()
    if not s:
        return ""
    if s.startswith("http"):
        return s
    s = s.lstrip("@").strip("/")
    return f"https://www.facebook.com/{s}"


async def _scrape(url: str, limit: int) -> dict:
    tok = os.getenv("APIFY_TOKEN")
    if not tok:
        return {"error": "APIFY_TOKEN_MISSING", "items": []}
    payload = {"startUrls": [{"url": url}], "resultsLimit": max(1, min(limit, 50))}
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{_API}/acts/{_ACTOR}/runs?token={tok}", json=payload, timeout=30)
        if r.status_code not in (200, 201):
            return {"error": f"run {r.status_code}", "items": []}
        data = r.json().get("data", {})
        rid, ds = data.get("id"), data.get("defaultDatasetId")
        deadline = time.time() + 110
        while time.time() < deadline:
            s = await c.get(f"{_API}/actor-runs/{rid}?token={tok}", timeout=20)
            st = s.json().get("data", {}).get("status")
            if st not in ("READY", "RUNNING"):
                break
            await asyncio.sleep(6)
        d = await c.get(f"{_API}/datasets/{ds}/items?token={tok}&clean=true&limit={limit}", timeout=45)
        items = d.json() if d.status_code == 200 and isinstance(d.json(), list) else []
    return {"error": None, "items": items}


def _metrics(it: dict) -> dict:
    pos = sum(int(it.get(k) or 0) for k in _POS)
    neg = sum(int(it.get(k) or 0) for k in _NEG)
    amb = sum(int(it.get(k) or 0) for k in _AMB)
    likes = int(it.get("likes") or 0)
    if pos == 0 and neg == 0 and amb == 0:        # breakdown unavailable → total likes as positive
        pos = likes
    denom = pos + neg
    approval = round(pos / denom * 100) if denom else None
    return {
        "text": (it.get("text") or "")[:240],
        "url": it.get("url") or it.get("facebookUrl"),
        "time": it.get("time") or it.get("timestamp"),
        "likes": likes, "comments": int(it.get("comments") or 0), "shares": int(it.get("shares") or 0),
        "pos": pos, "neg": neg, "amb": amb,
        "approval": approval, "rejection": (100 - approval) if approval is not None else None,
        "angry": int(it.get("reactionAngryCount") or 0), "sad": int(it.get("reactionSadCount") or 0),
    }


async def analyze_page(target: str, limit: int = 20, comments: bool = True) -> dict:
    if not enabled():
        return {"error": "APIFY_TOKEN_MISSING", "message": "أضِف APIFY_TOKEN لتفعيل رصد فيسبوك."}
    url = normalize_target(target)
    res = await _scrape(url, limit)
    if res["error"]:
        return {"error": res["error"], "target": target, "message": "تعذّر الجلب من Apify."}
    items = [it for it in res["items"] if isinstance(it, dict) and not it.get("error") and it.get("text") is not None]
    if not items:
        bad = next((it for it in res["items"] if isinstance(it, dict) and it.get("error")), {})
        return {"error": "NO_DATA", "target": target,
                "message": ("الصفحة خاصة أو الرابط غير صحيح — جرّب رابط الصفحة الكامل."
                            if bad.get("error") in ("no_items", "private") else "لا منشورات عامة.")}

    posts = [_metrics(it) for it in items]
    posts = [p for p in posts if (p["pos"] + p["neg"] + p["amb"] + p["comments"]) > 0]
    page_name = items[0].get("pageName") or items[0].get("user", {}).get("name") or target

    tot_pos = sum(p["pos"] for p in posts)
    tot_neg = sum(p["neg"] for p in posts)
    react_approval = round(tot_pos / (tot_pos + tot_neg) * 100) if (tot_pos + tot_neg) else None
    scored = [p for p in posts if p["approval"] is not None]
    most_rejected = max(scored, key=lambda p: (p["rejection"] or 0, p["neg"]), default=None)
    most_approved = max(scored, key=lambda p: (p["approval"] or 0, p["pos"]), default=None)

    # comment sentiment — the REAL opinion (read the text, not just the reaction click)
    comment_sent, sample_comments = None, []
    if comments:
        top_urls = [p["url"] for p in sorted(posts, key=lambda p: -p["comments"])[:5] if p.get("url")]
        texts = await _scrape_comments(top_urls, per_post=25)
        if len(texts) >= 5:
            from app.services import ai
            cls = await ai.classify_all(texts[:160])
            pos = sum(1 for c in cls if c.get("sentiment") == "إيجابي")
            neg = sum(1 for c in cls if c.get("sentiment") == "سلبي")
            capproval = round(pos / (pos + neg) * 100) if (pos + neg) else None
            comment_sent = {"analyzed": len(cls), "pos": pos, "neg": neg, "neu": len(cls) - pos - neg,
                            "approval": capproval}
            sample_comments = [{"text": texts[i][:160], "sentiment": cls[i].get("sentiment")}
                               for i in range(min(len(texts), len(cls)))][:8]

    # combined: comments weighted higher (real opinion) than reaction clicks (reach)
    if comment_sent and comment_sent["approval"] is not None and react_approval is not None:
        approval = round(0.45 * react_approval + 0.55 * comment_sent["approval"])
    else:
        approval = (comment_sent or {}).get("approval") if comment_sent else react_approval

    summary = await _summarize(page_name, approval, len(posts), tot_pos, tot_neg, most_rejected, comment_sent)

    return {
        "target": target, "page_name": page_name, "posts_analyzed": len(posts),
        "approval": approval, "rejection": (100 - approval) if approval is not None else None,
        "reaction_approval": react_approval, "comment_sentiment": comment_sent,
        "sample_comments": sample_comments,
        "total_positive": tot_pos, "total_negative": tot_neg,
        "total_comments": sum(p["comments"] for p in posts),
        "total_shares": sum(p["shares"] for p in posts),
        "most_rejected": most_rejected, "most_approved": most_approved,
        "posts": sorted(posts, key=lambda p: -(p["pos"] + p["neg"]))[:12],
        "summary": summary,
        "note": "التأييد المدمَج = تفاعلات (👍😠😢) + مشاعر التعليقات (الأدقّ). الأرقام مؤشّرات لا أحكام قاطعة.",
        "disclaimer": "تحليل احتمالي آلي لمحتوى عام على فيسبوك — مؤشرات لا أحكام قاطعة.",
    }


async def _scrape_comments(post_urls: list, per_post: int = 25) -> list:
    """Comment TEXT for a set of posts via the comments scraper — for sentiment."""
    tok = os.getenv("APIFY_TOKEN")
    if not tok or not post_urls:
        return []
    payload = {"startUrls": [{"url": u} for u in post_urls], "resultsLimit": per_post * len(post_urls)}
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post(f"{_API}/acts/{_COMMENTS_ACTOR}/runs?token={tok}", json=payload, timeout=30)
            if r.status_code not in (200, 201):
                return []
            data = r.json().get("data", {})
            rid, ds = data.get("id"), data.get("defaultDatasetId")
            deadline = time.time() + 110
            while time.time() < deadline:
                s = await c.get(f"{_API}/actor-runs/{rid}?token={tok}", timeout=20)
                if s.json().get("data", {}).get("status") not in ("READY", "RUNNING"):
                    break
                await asyncio.sleep(6)
            d = await c.get(f"{_API}/datasets/{ds}/items?token={tok}&clean=true&limit=200", timeout=45)
            items = d.json() if d.status_code == 200 and isinstance(d.json(), list) else []
        return [it.get("text") for it in items if isinstance(it, dict) and (it.get("text") or "").strip()]
    except Exception:
        return []


async def _summarize(page, approval, n, pos, neg, worst, comment_sent=None):
    from app.services.media_battlefield import battlefield_summary
    w = (f"أكثر منشور رفضاً: «{worst['text'][:80]}» ({worst['rejection']}% رفض، {worst['neg']} تفاعل غاضب/حزين)."
         if worst else "")
    cs = (f"مشاعر التعليقات: من {comment_sent['analyzed']} تعليق، {comment_sent['pos']} إيجابي و{comment_sent['neg']} سلبي "
          f"(تأييد التعليقات {comment_sent['approval']}%)." if comment_sent else "")
    facts = (
        f"تحليل تفاعل جمهور فيسبوك مع صفحة «{page}». حُلّل {n} منشور. "
        f"نسبة التأييد المدمجة {approval}% (تفاعلات إيجابية {pos} مقابل سلبية {neg}). {cs} {w} "
        f"اكتب موجزاً: كيف يستقبل الجمهور هذه الصفحة، وأي المحتوى يثير الرفض أو التأييد، وما الدلالة."
    )
    out = await battlefield_summary.summarize(facts)
    return out.get("summary", "")
