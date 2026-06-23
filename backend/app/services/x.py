"""X (Twitter) service — recent search + conversation replies via X API v2."""
from urllib.parse import quote

import httpx

from app.config import X_BEARER_TOKEN

_BASE = "https://api.twitter.com/2/tweets/search/recent"
_FIELDS = ("tweet.fields=created_at,public_metrics,lang"
           "&expansions=author_id&user.fields=username,name,verified")


def _headers() -> dict:
    return {"Authorization": f"Bearer {X_BEARER_TOKEN}"}


def _users(payload: dict) -> dict:
    return {u["id"]: u for u in payload.get("includes", {}).get("users", [])}


async def _search(client: httpx.AsyncClient, query: str, want: int) -> dict:
    """Paginate recent-search until `want` tweets or no more pages."""
    items, next_token, loops = [], None, 0
    while len(items) < want and loops < 6:
        per = min(100, max(10, want - len(items)))
        url = f"{_BASE}?query={quote(query)}&max_results={per}&{_FIELDS}"
        if next_token:
            url += f"&next_token={next_token}"
        r = await client.get(url, headers=_headers(), timeout=25)
        if r.status_code != 200:
            if items:
                break
            return {"error": r.status_code}
        j = r.json()
        users = _users(j)
        for t in j.get("data", []):
            u = users.get(t["author_id"], {})
            m = t.get("public_metrics", {})
            uname = u.get("username")
            items.append({
                "term": query,
                "title": t["text"],
                "link": f"https://x.com/{uname or 'i/web'}/status/{t['id']}",
                "source": f"@{uname}" if uname else "X",
                "author": u.get("name") or uname or "",
                "date": (t.get("created_at") or "")[:10],
                "engagement": m.get("like_count", 0) + m.get("retweet_count", 0)
                + m.get("reply_count", 0) + m.get("quote_count", 0),
                "likes": m.get("like_count", 0),
                "retweets": m.get("retweet_count", 0),
            })
        next_token = j.get("meta", {}).get("next_token")
        loops += 1
        if not next_token:
            break
    return {"items": items}


async def fetch_x(keywords: list[str], per_keyword: int = 50, cap: int = 200):
    if not X_BEARER_TOKEN:
        return {"error": "X_TOKEN_MISSING"}
    hits, api_error = [], None
    async with httpx.AsyncClient() as client:
        for k in keywords[:5]:
            res = await _search(client, f'"{k}" -is:retweet', per_keyword)
            if "error" in res:
                api_error = res["error"]
                continue
            hits.extend(res["items"])
    if not hits and api_error:
        return {"error": "X_API_ERROR", "status": api_error}
    seen, uniq = set(), []
    for h in hits:
        if h["link"] not in seen:
            seen.add(h["link"])
            uniq.append(h)
    uniq.sort(key=lambda h: (h.get("date", ""), h.get("engagement", 0)), reverse=True)
    return {"items": uniq[:cap]}


async def fetch_replies(tweet_id: str, want: int = 60):
    if not X_BEARER_TOKEN:
        return {"error": "X_TOKEN_MISSING"}
    async with httpx.AsyncClient() as client:
        res = await _search(client, f"conversation_id:{tweet_id} is:reply", want)
    if "error" in res:
        return {"error": "X_API_ERROR", "status": res["error"]}
    replies = [{
        "text": it["title"], "author": it["author"], "source": it["source"],
        "date": it["date"], "engagement": it["engagement"], "link": it["link"],
    } for it in res["items"]]
    return {"replies": replies}
