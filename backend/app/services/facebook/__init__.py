"""Facebook reception analysis — where the Iraqi PUBLIC actually is.

Facebook has no "dislike" button (7 reactions: Like/Love/Care = positive,
Haha/Wow = ambiguous, Sad/Angry = negative). So approval/rejection is measured
from the reaction BREAKDOWN per post + (next) comment sentiment. Scrapes PUBLIC
pages/groups via Apify (billed separately from the X provider — NOT AICE credits).
"""
import asyncio
import json
import os
import re
import time

import httpx

from app.services import redis_client

# Starter list — EDIT from the UI with the real Iraqi page slugs you care about.
# (Use the exact facebook.com/<slug> from the page's address bar.)
_DEFAULT_PAGES = ["alsumaria.tv", "dijlahtv", "aljazeera"]  # confirmed-valid starters; user curates the rest
_PAGES_KEY = "fb:pages"

_API = "https://api.apify.com/v2"
_ACTOR = "apify~facebook-posts-scraper"
_COMMENTS_ACTOR = "apify~facebook-comments-scraper"

# (key, emoji, arabic, polarity, scraper field)
REACTIONS = [
    ("like", "👍", "إعجاب", "pos", "reactionLikeCount"),
    ("love", "❤️", "حب", "pos", "reactionLoveCount"),
    ("care", "🤗", "يهمّني", "pos", "reactionCareCount"),
    ("haha", "😂", "هاها", "amb", "reactionHahaCount"),
    ("wow", "😮", "واو", "amb", "reactionWowCount"),
    ("sad", "😢", "حزين", "neg", "reactionSadCount"),
    ("angry", "😠", "غاضب", "neg", "reactionAngryCount"),
]
_POS = [f for k, _e, _a, p, f in REACTIONS if p == "pos"]
_NEG = [f for k, _e, _a, p, f in REACTIONS if p == "neg"]
_AMB = [f for k, _e, _a, p, f in REACTIONS if p == "amb"]


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


def _comment_texts(it: dict) -> list:
    """Comment text already included in the post payload (free — no extra scrape)."""
    out = []
    for c in (it.get("topComments") or []):
        t = (c.get("text") if isinstance(c, dict) else c) or ""
        if t.strip():
            out.append(t.strip())
    return out


def _metrics(it: dict) -> dict:
    rx = {k: int(it.get(f) or 0) for k, _e, _a, _p, f in REACTIONS}
    pos = sum(int(it.get(k) or 0) for k in _POS)
    neg = sum(int(it.get(k) or 0) for k in _NEG)
    amb = sum(int(it.get(k) or 0) for k in _AMB)
    likes = int(it.get("likes") or 0)
    if pos == 0 and neg == 0 and amb == 0:        # breakdown unavailable → total likes as positive
        pos = likes
        rx["like"] = likes
    denom = pos + neg
    approval = round(pos / denom * 100) if denom else None
    return {
        "text": (it.get("text") or "")[:240],
        "url": it.get("url") or it.get("facebookUrl"),
        "time": it.get("time") or it.get("timestamp"),
        "likes": likes, "comments": int(it.get("comments") or 0), "shares": int(it.get("shares") or 0),
        "pos": pos, "neg": neg, "amb": amb, "reactions": rx,
        "approval": approval, "rejection": (100 - approval) if approval is not None else None,
        "angry": rx["angry"], "sad": rx["sad"], "_comments": _comment_texts(it),
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

    # full reaction mix across all posts (7 types)
    reaction_mix = {k: sum(p["reactions"].get(k, 0) for p in posts) for k, *_ in REACTIONS}
    rtot = sum(reaction_mix.values()) or 1
    reactions_pct = [{"key": k, "emoji": e, "label": a, "polarity": pol,
                      "count": reaction_mix[k], "pct": round(reaction_mix[k] / rtot * 100)}
                     for k, e, a, pol, _f in REACTIONS]

    # comment sentiment — FREE in-payload comments + a deeper scrape, classified with a
    # sarcasm/dialect-aware model (the REAL opinion, not just the reaction click).
    comment_sent, sample_comments, insights, comment_intel = None, [], None, None
    if comments:
        texts = [t for p in posts for t in p.get("_comments", [])]
        top_urls = [p["url"] for p in sorted(posts, key=lambda p: -p["comments"])[:5] if p.get("url")]
        texts += await _scrape_comments(top_urls, per_post=30)
        # §19 pipeline: dedupe → cluster → representatives (NO AI) BEFORE any model call
        from app.services.facebook import comment_analyzer as ca
        clusters = ca.cluster(texts)
        comment_intel = {
            "total_comments": len([t for t in texts if t and len(t.strip()) > 1]),
            "clusters": len(clusters),
            "repeated_phrases": ca.repeated_phrases(clusters),
            "keyword_phrases": ca.keyword_phrases(texts),
            "pressure": ca.pressure_level(texts, clusters),
        }
        reps = ca.representatives(clusters, cap=60)          # ~the opinion space, deduped
        sizes = [c["size"] for c in clusters[:60]]
        if len(reps) >= 5:
            labels = await _classify_comments(reps)
            # weight each representative's sentiment by its cluster size (how many said it)
            pos = sum(w for lab, w in zip(labels, sizes) if lab == "إيجابي")
            neg = sum(w for lab, w in zip(labels, sizes) if lab == "سلبي")
            tot = sum(sizes[:len(labels)])
            capproval = round(pos / (pos + neg) * 100) if (pos + neg) else None
            comment_sent = {"analyzed": tot, "representatives": len(labels),
                            "pos": pos, "neg": neg, "neu": tot - pos - neg, "approval": capproval}
            sample_comments = [{"text": reps[i][:160], "sentiment": labels[i], "weight": sizes[i]}
                               for i in range(min(len(reps), len(labels)))][:10]
        # deep mining runs on representatives only (cost ~scales with cluster ratio)
        if len(reps) >= 8:
            from app.services import facebook_insights
            insights = await facebook_insights.deep_insights(page_name, reps)

    n = len(posts)
    stats = {
        "avg_reactions": round(sum(p["pos"] + p["neg"] + p["amb"] for p in posts) / n) if n else 0,
        "avg_comments": round(sum(p["comments"] for p in posts) / n) if n else 0,
        "avg_shares": round(sum(p["shares"] for p in posts) / n) if n else 0,
        "total_reactions": rtot,
    }

    # combined: comments weighted higher (real opinion) than reaction clicks (reach)
    if comment_sent and comment_sent["approval"] is not None and react_approval is not None:
        approval = round(0.45 * react_approval + 0.55 * comment_sent["approval"])
    else:
        approval = (comment_sent or {}).get("approval") if comment_sent else react_approval

    summary = await _summarize(page_name, approval, len(posts), tot_pos, tot_neg, most_rejected, comment_sent)

    # Comment-Reaction Gap (§2): reactions can look positive while comments are hostile.
    cr_gap = _comment_reaction_gap(react_approval, comment_sent, comment_intel, sample_comments)

    return {
        "target": target, "page_name": page_name, "posts_analyzed": len(posts),
        "approval": approval, "rejection": (100 - approval) if approval is not None else None,
        "reaction_approval": react_approval, "comment_sentiment": comment_sent,
        "comment_intel": comment_intel, "comment_reaction_gap": cr_gap,
        "sample_comments": sample_comments, "insights": insights,
        "reactions": reactions_pct, "stats": stats,
        "total_positive": tot_pos, "total_negative": tot_neg,
        "total_comments": sum(p["comments"] for p in posts),
        "total_shares": sum(p["shares"] for p in posts),
        "most_rejected": most_rejected, "most_approved": most_approved,
        "posts": sorted(posts, key=lambda p: -(p["pos"] + p["neg"]))[:12],
        "summary": summary,
        "note": "التأييد المدمَج = تفاعلات (👍😠😢) + مشاعر التعليقات (الأدقّ). الأرقام مؤشّرات لا أحكام قاطعة.",
        "disclaimer": "تحليل احتمالي آلي لمحتوى عام على فيسبوك — مؤشرات لا أحكام قاطعة.",
    }


def _comment_reaction_gap(react_approval, comment_sent, comment_intel, sample_comments):
    """Comment-Reaction Gap (§2). Quantifies how much the reactions OVERSTATE approval
    versus what people actually write. gap_score 0–100 (reaction mood minus comment mood,
    floored at 0). Needs the comment classifier (AI) for the comment-mood half."""
    cm = (comment_sent or {}).get("approval")
    pressure = (comment_intel or {}).get("pressure", {}).get("score")
    if react_approval is None or cm is None:
        return {"available": False, "reaction_mood": react_approval, "comment_mood": cm,
                "public_pressure": pressure,
                "note": "حساب مزاج التعليقات يحتاج المصنّف (ذكاء اصطناعي) — الفجوة تظهر عند توفّر الرصيد."}
    gap = max(0, react_approval - cm)
    level = "حرج" if gap >= 50 else "مرتفع" if gap >= 30 else "متوسط" if gap >= 15 else "منخفض"
    misleading = gap >= 30
    evidence = [c for c in (sample_comments or []) if c.get("sentiment") == "سلبي"][:4]
    if misleading:
        expl = (f"التفاعلات توحي بتأييد {react_approval}% بينما التعليقات تكشف {cm}% فقط — "
                f"تأييد ظاهري مضلّل بفارق {gap} نقطة. اللايكات تخفي رفضاً حقيقياً في التعليقات.")
    elif gap <= 10:
        expl = f"التفاعلات والتعليقات متقاربة ({react_approval}% مقابل {cm}%) — الاستقبال صادق."
    else:
        expl = f"فجوة طفيفة ({gap} نقطة) بين التفاعلات {react_approval}% والتعليقات {cm}%."
    return {"available": True, "reaction_mood": react_approval, "comment_mood": cm,
            "gap_score": gap, "level": level, "misleading": misleading,
            "public_pressure": pressure, "explanation": expl, "evidence_comments": evidence}


async def _classify_comments(texts: list) -> list:
    """Sarcasm + Iraqi-dialect aware sentiment for FB comments. Returns a per-comment
    list of إيجابي/سلبي/محايد. Falls back to the generic classifier on failure."""
    from app.config import ANTHROPIC_API_KEY, CLASSIFY_MODEL
    if not ANTHROPIC_API_KEY or not texts:
        from app.services import ai
        cls = await ai.classify_all(texts)
        return [c.get("sentiment", "محايد") for c in cls]
    out: list = []
    for i in range(0, len(texts), 40):
        batch = texts[i:i + 40]
        numbered = "\n".join(f"{j}. {t[:200]}" for j, t in enumerate(batch))
        prompt = (
            "صنّف موقف كل تعليق فيسبوك (إيجابي/سلبي/محايد) تجاه موضوع المنشور. "
            "انتبه جيداً: السخرية واللهجة العراقية — التعليق الساخر ظاهره مدح وباطنه ذمّ = سلبي؛ "
            "الشتيمة والغضب والتهكّم = سلبي؛ الدعاء الإيجابي والثناء = إيجابي؛ السؤال/الخبر المجرّد = محايد. "
            "أعد JSON array فقط بنفس الترتيب والعدد، بالقيم (إيجابي|سلبي|محايد):\n" + numbered
        )
        try:
            async with httpx.AsyncClient() as c:
                r = await c.post("https://api.anthropic.com/v1/messages",
                                 headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
                                          "content-type": "application/json"},
                                 json={"model": CLASSIFY_MODEL, "max_tokens": 1500,
                                       "messages": [{"role": "user", "content": prompt}]}, timeout=50)
                txt = r.json()["content"][0]["text"]
                arr = json.loads(txt[txt.find("["):txt.rfind("]") + 1])
                vals = [str(x) for x in arr][:len(batch)]
        except Exception:
            vals = []
        vals += ["محايد"] * (len(batch) - len(vals))
        out += vals
    return out[:len(texts)]


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


# ---- Iraqi national pulse (aggregate across a curated, editable page list) ----
_PAGES_SB_KEY = "intel.fb_pages"   # durable copy (survives Redis cap/outage)


async def get_pages() -> list:
    # Redis first (fast)
    try:
        raw = await redis_client.get(_PAGES_KEY)
        if raw:
            v = json.loads(raw)
            if isinstance(v, list) and v:
                return v
    except Exception:
        pass
    # durable Supabase fallback — the curated list survives a Redis limit/outage
    try:
        from app.services import db
        if db.enabled():
            rows = await db.select("system_settings", f"select=value_json&key=eq.{_PAGES_SB_KEY}&limit=1")
            if rows:
                v = (rows[0].get("value_json") or {}).get("v")
                if isinstance(v, list) and v:
                    return v
    except Exception:
        pass
    return list(_DEFAULT_PAGES)


async def set_pages(pages: list) -> list:
    clean = [str(p).strip() for p in (pages or []) if str(p).strip()][:60]
    try:
        await redis_client.set(_PAGES_KEY, json.dumps(clean, ensure_ascii=False), ex=86400 * 60)
    except Exception:
        pass
    # durable: persist to Supabase so it isn't lost when Redis is capped
    try:
        from app.services import db
        if db.enabled():
            await db.insert("system_settings",
                            {"key": _PAGES_SB_KEY, "value_json": {"v": clean}, "category": "internal"},
                            upsert=True, on_conflict="key")
    except Exception:
        pass
    return clean


async def national(per_page: int = 8) -> dict:
    """Aggregate Facebook reception across the seed pages → a national pulse.
    Posts only (no per-comment scrape) to bound Apify cost. SWR-cached at router."""
    if not enabled():
        return {"error": "APIFY_TOKEN_MISSING", "message": "أضِف APIFY_TOKEN لتفعيل رصد فيسبوك."}
    pages = await get_pages()
    sem = asyncio.Semaphore(4)

    async def _one(p):
        async with sem:
            return p, await _scrape(normalize_target(p), per_page)

    results = await asyncio.gather(*(_one(p) for p in pages))
    page_rows, all_posts, failed = [], [], []
    tot_cpos = tot_cneg = 0
    nat_comments = []   # pooled across pages → one national deep-insight pass
    store_posts, store_comments = [], []   # persist from the SAME raw items (no extra Apify cost)
    for name, res in results:
        items = [it for it in res.get("items", []) if isinstance(it, dict) and not it.get("error") and it.get("text") is not None]
        if not items:
            failed.append(name)
            continue
        # normalize + annotate the raw items for durable storage (history → trends/DNA/journey)
        try:
            from app.services.facebook import normalizer, reaction_analyzer as _rx
            for it in items:
                row = normalizer.normalize_post(it, name)
                if row:
                    _rx.annotate_post(row)
                    store_posts.append(row)
                    store_comments += normalizer.normalize_comments(it, row["post_id"], row.get("page_name"))
        except Exception:
            pass
        posts = [_metrics(it) for it in items]
        posts = [p for p in posts if (p["pos"] + p["neg"]) > 0]
        if not posts:
            failed.append(name)
            continue
        pos = sum(p["pos"] for p in posts)
        neg = sum(p["neg"] for p in posts)
        eng = sum(p["pos"] + p["neg"] + p["amb"] + p["comments"] + p["shares"] for p in posts)
        react_app = round(pos / (pos + neg) * 100) if (pos + neg) else None

        # blend the FREE in-payload comments (the REAL opinion). No extra Apify cost —
        # topComments come bundled with the post scrape; only the cheap classifier runs.
        cpos = cneg = 0
        comment_app = None
        ctexts = [t for p in posts for t in p.get("_comments", [])]
        # light deep-scrape of the top-3 most-commented posts → a real sample, not just
        # the ~3 free topComments. national() runs ~daily (cached), so this cost is bounded.
        top_urls = [p["url"] for p in sorted(posts, key=lambda p: -p["comments"])[:3] if p.get("url")]
        if top_urls:
            ctexts += await _scrape_comments(top_urls, per_post=20)
        seen, uniq = set(), []
        for t in ctexts:
            kk = t[:80]
            if kk not in seen:
                seen.add(kk)
                uniq.append(t)
        if len(uniq) >= 5:
            labels = await _classify_comments(uniq[:120])
            cpos = labels.count("إيجابي")
            cneg = labels.count("سلبي")
            comment_app = round(cpos / (cpos + cneg) * 100) if (cpos + cneg) else None
            tot_cpos += cpos
            tot_cneg += cneg
            nat_comments += uniq[:120]

        if comment_app is not None and react_app is not None:
            blended = round(0.45 * react_app + 0.55 * comment_app)  # comments weighted higher
        else:
            blended = comment_app if comment_app is not None else react_app

        pname = items[0].get("pageName") or name
        page_rows.append({"page": pname, "target": name, "posts": len(posts), "engagement": eng,
                          "pos": pos, "neg": neg,
                          "reaction_approval": react_app, "comment_approval": comment_app,
                          "comments_analyzed": cpos + cneg,
                          "approval": blended,
                          "rejection": (100 - blended) if blended is not None else None})
        for p in posts:
            p["_page"] = pname
        all_posts += posts

    tot_pos = sum(r["pos"] for r in page_rows)
    tot_neg = sum(r["neg"] for r in page_rows)
    react_app_nat = round(tot_pos / (tot_pos + tot_neg) * 100) if (tot_pos + tot_neg) else None
    comment_app_nat = round(tot_cpos / (tot_cpos + tot_cneg) * 100) if (tot_cpos + tot_cneg) else None
    if comment_app_nat is not None and react_app_nat is not None:
        approval = round(0.45 * react_app_nat + 0.55 * comment_app_nat)
    else:
        approval = comment_app_nat if comment_app_nat is not None else react_app_nat
    most_rejected = sorted([p for p in all_posts if p["approval"] is not None],
                           key=lambda p: (-(p["rejection"] or 0), -p["neg"]))[:6]
    page_rows.sort(key=lambda r: -r["engagement"])

    page_rows.sort(key=lambda r: -r["engagement"])

    # reaction intelligence + viral posts — computed from the SAME scrape, NO AI / NO DB
    # (so the dashboard is rich even before migration 011 / Anthropic credits).
    from app.services.facebook import reaction_analyzer as _rx
    fb_breakdown = _rx.breakdown(all_posts) if all_posts else None

    def _eng(p):
        return p["pos"] + p["neg"] + p["amb"] + p["comments"] + p["shares"]
    viral_cards = [{
        "page": p.get("_page"), "text": p["text"], "url": p.get("url"), "time": p.get("time"),
        "reactions": p["pos"] + p["neg"] + p["amb"], "comments": p["comments"], "shares": p["shares"],
        "engagement": _eng(p), "mood_score": _rx.mood_score(p["reactions"]),
        "approval": p.get("approval"), "rejection": p.get("rejection"),
    } for p in sorted(all_posts, key=lambda p: -_eng(p))[:10]]
    page_rollup = [{"page": r["page"], "posts": r["posts"], "engagement": r["engagement"],
                    "approval": r.get("approval")} for r in page_rows]

    summary = await _nat_summary(approval, len(page_rows), tot_pos, tot_neg, most_rejected) if page_rows else ""
    # national deep mining — what is the Iraqi public talking about across all pages
    insights = None
    if len(nat_comments) >= 8:
        from app.services import facebook_insights
        insights = await facebook_insights.deep_insights("الجمهور العراقي عبر صفحات متعددة", nat_comments,
                                                         context="نبض وطني")
    snap = {
        "approval": approval, "rejection": (100 - approval) if approval is not None else None,
        "reaction_approval": react_app_nat, "comment_approval": comment_app_nat,
        "comments_analyzed": tot_cpos + tot_cneg,
        "pages_ok": len(page_rows), "pages_failed": failed,
        "total_positive": tot_pos, "total_negative": tot_neg,
        "total_engagement": sum(r["engagement"] for r in page_rows),
        "pages": page_rows, "insights": insights,
        "most_rejected": [{"page": p.get("_page"), "text": p["text"], "rejection": p["rejection"],
                           "neg": p["neg"], "comments": p["comments"]} for p in most_rejected],
        "summary": summary,
        "note": "نبض فيسبوك الوطني — تأييد مدمَج (تفاعلات + مشاعر التعليقات). الصفحات الفاشلة = رابط/slug غير صحيح.",
        "disclaimer": "تحليل احتمالي آلي لمحتوى عام — مؤشرات لا أحكام قاطعة.",
    }
    # publish a light snapshot for the national picture — Redis (fast) + Supabase (durable)
    light = {"approval": approval, "rejection": snap["rejection"], "pages_ok": len(page_rows),
             "reaction_approval": react_app_nat, "comment_approval": comment_app_nat,
             "comments_analyzed": tot_cpos + tot_cneg,
             "total_positive": tot_pos, "total_negative": tot_neg,
             "total_engagement": snap["total_engagement"],
             "insights": insights,        # full mined topics/entities → read by the dashboard
             "reaction_breakdown": fb_breakdown,   # 7-reaction mix + mood (no AI)
             "viral_posts": viral_cards,           # top posts by engagement (no AI)
             "page_rollup": page_rollup,           # ranking by engagement / activity (no AI)
             "most_rejected": snap["most_rejected"],
             "top_rejected": (snap["most_rejected"][0] if snap["most_rejected"] else None),
             "updated_at": _now_ts()}
    try:
        await redis_client.set("intel:fb_snapshot", json.dumps(light, ensure_ascii=False), ex=86400 * 3)
    except Exception:
        pass
    try:
        from app.services import db
        if db.enabled():
            await db.insert("system_settings",
                            {"key": "intel.fb_snapshot", "value_json": {"v": light}, "category": "internal"},
                            upsert=True, on_conflict="key")
    except Exception:
        pass
    # durable post/comment storage (best-effort) → accumulates history for the
    # Facebook Intelligence dashboard, page ranking, DNA, and cross-platform journey
    try:
        from app.services.facebook import storage
        await storage.save_posts(store_posts)
        await storage.save_comments(store_comments)
    except Exception:
        pass
    return snap


def _now_ts():
    import time as _t
    return _t.time()


async def get_snapshot():
    """Light national FB pulse — Redis first, Supabase fallback (durable)."""
    try:
        raw = await redis_client.get("intel:fb_snapshot")
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    try:
        from app.services import db
        if db.enabled():
            rows = await db.select("system_settings", "select=value_json&key=eq.intel.fb_snapshot&limit=1")
            if rows:
                return (rows[0].get("value_json") or {}).get("v")
    except Exception:
        pass
    return None


async def _nat_summary(approval, npages, pos, neg, worst):
    from app.services.media_battlefield import battlefield_summary
    w = "؛ ".join(f"«{p['text'][:60]}» ({p['rejection']}% رفض)" for p in worst[:3]) or "—"
    facts = (
        f"نبض فيسبوك الوطني العراقي عبر {npages} صفحة. نسبة التأييد العامة {approval}% "
        f"(تفاعلات إيجابية {pos} مقابل سلبية {neg}). أبرز المنشورات إثارةً للرفض: {w}. "
        f"اكتب موجزاً عن المزاج العام للجمهور العراقي على فيسبوك وأبرز ما يثير الغضب."
    )
    out = await battlefield_summary.summarize(facts)
    return out.get("summary", "")
