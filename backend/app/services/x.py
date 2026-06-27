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


# X recent-search is capped at the last 7 days on Basic tier
RANGE_DAYS = {"day": 1, "week": 7, "month": 7, "year": 7}


def _start_time(range: str) -> str:
    from datetime import datetime, timedelta, timezone
    days = RANGE_DAYS.get(range or "", 0)
    if not days:
        return ""
    # X requires start_time strictly within the last 7 days and not in the future
    days = min(days, 7)
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


async def _search(client: httpx.AsyncClient, query: str, want: int, start_time: str = "") -> dict:
    """Paginate recent-search until `want` tweets or no more pages."""
    items, next_token, loops = [], None, 0
    while len(items) < want and loops < 6:
        per = min(100, max(10, want - len(items)))
        url = f"{_BASE}?query={quote(query)}&max_results={per}&{_FIELDS}"
        if start_time:
            url += f"&start_time={start_time}"
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


async def fetch_x(keywords: list[str], per_keyword: int = 50, cap: int = 200, range: str = ""):
    if not X_BEARER_TOKEN:
        return {"error": "X_TOKEN_MISSING"}
    start_time = _start_time(range)
    hits, api_error = [], None
    async with httpx.AsyncClient() as client:
        for k in keywords[:5]:
            res = await _search(client, f'"{k}" -is:retweet', per_keyword, start_time)
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


async def fetch_network(keyword: str, want: int = 100, range: str = ""):
    """Fetch tweets about a keyword WITH full author profiles, for bot/campaign
    analysis. Returns {tweets:[{text,author_id,created_at}], users:{id:{...}}}."""
    if not X_BEARER_TOKEN:
        return {"error": "X_TOKEN_MISSING"}
    start_time = _start_time(range)
    fields = ("tweet.fields=created_at&expansions=author_id"
              "&user.fields=created_at,public_metrics,description,verified,profile_image_url,location")
    tweets, users, next_token, loops = [], {}, None, 0
    async with httpx.AsyncClient() as client:
        while len(tweets) < want and loops < 8:
            per = min(100, max(10, want - len(tweets)))
            url = f"{_BASE}?query={quote(keyword + ' -is:retweet')}&max_results={per}&{fields}"
            if start_time:
                url += f"&start_time={start_time}"
            if next_token:
                url += f"&next_token={next_token}"
            r = await client.get(url, headers=_headers(), timeout=25)
            if r.status_code != 200:
                if tweets:
                    break
                return {"error": r.status_code}
            j = r.json()
            for u in j.get("includes", {}).get("users", []):
                users[u["id"]] = u
            for t in j.get("data", []):
                tweets.append({"text": t["text"], "author_id": t["author_id"], "created_at": t.get("created_at")})
            next_token = j.get("meta", {}).get("next_token")
            loops += 1
            if not next_token:
                break
    return {"tweets": tweets, "users": users}


async def fetch_trend(keyword: str, want: int = 150, range: str = "week"):
    """Fetch recent tweets WITH timestamps + per-tweet engagement + author
    profiles — everything the trend engine needs from one paginated call.

    Dispatches to TwitterAPI.io when its key is configured (full archive, cheaper,
    richer metrics); falls back to the official X API otherwise. Same return shape
    either way, so the rest of the pipeline is provider-agnostic."""
    from app.services.providers import twitterapi_io
    if twitterapi_io.enabled():
        from app.services.collection import budget
        if not await budget.allowed():
            # monthly spend cap reached → stop spending; SWR keeps serving cache
            return {"error": "BUDGET_CAP_REACHED", "tweets": [], "users": {}}
        res = await twitterapi_io.fetch_trend(keyword, want=want, range=range)
        if "error" not in res and res.get("tweets"):
            await budget.add(len(res["tweets"]))
            return res
        # provider failed → fall through to official if available
        if not X_BEARER_TOKEN:
            return res
    if not X_BEARER_TOKEN:
        return {"error": "X_TOKEN_MISSING"}
    start_time = _start_time(range or "week")
    fields = ("tweet.fields=created_at,public_metrics,entities&expansions=author_id"
              "&user.fields=created_at,public_metrics,verified,description,profile_image_url,location")
    tweets, users, next_token, loops = [], {}, None, 0
    async with httpx.AsyncClient() as client:
        while len(tweets) < want and loops < 10:
            per = min(100, max(10, want - len(tweets)))
            url = f"{_BASE}?query={quote(keyword + ' -is:retweet')}&max_results={per}&{fields}"
            if start_time:
                url += f"&start_time={start_time}"
            if next_token:
                url += f"&next_token={next_token}"
            r = await client.get(url, headers=_headers(), timeout=25)
            if r.status_code != 200:
                if tweets:
                    break
                return {"error": r.status_code}
            j = r.json()
            for u in j.get("includes", {}).get("users", []):
                users[u["id"]] = u
            for t in j.get("data", []):
                m = t.get("public_metrics", {})
                ent = t.get("entities", {}) or {}
                domains = []
                for u_ in (ent.get("urls", []) or []):
                    disp = (u_.get("display_url") or u_.get("expanded_url") or "")
                    dom = disp.split("/")[0].replace("www.", "").lower()
                    if dom and "twitter.com" not in dom and "x.com" not in dom:
                        domains.append(dom)
                hashtags = [h.get("tag") for h in (ent.get("hashtags", []) or []) if h.get("tag")]
                mentions = [mn.get("username") for mn in (ent.get("mentions", []) or []) if mn.get("username")]
                links = [u_.get("expanded_url") or u_.get("url") for u_ in (ent.get("urls", []) or [])]
                tweets.append({
                    "text": t["text"], "author_id": t["author_id"], "created_at": t.get("created_at"),
                    "engagement": m.get("like_count", 0) + m.get("retweet_count", 0)
                    + m.get("reply_count", 0) + m.get("quote_count", 0),
                    "domains": domains, "hashtags": hashtags, "mentions": mentions, "links": links,
                })
            next_token = j.get("meta", {}).get("next_token")
            loops += 1
            if not next_token:
                break
    return {"tweets": tweets, "users": users}


async def fetch_user_timeline(username: str, want: int = 120, range: str = "month"):
    """A specific account's recent timeline (for deep profiling). Uses the
    provider's dedicated user endpoint — the `from:` search operator is NOT
    honored by TwitterAPI.io. Same return shape as fetch_trend."""
    from app.services.providers import twitterapi_io
    if twitterapi_io.enabled():
        from app.services.collection import budget
        if not await budget.allowed():
            return {"error": "BUDGET_CAP_REACHED", "tweets": [], "users": {}}
        res = await twitterapi_io.fetch_user_tweets(username, want=want)
        if "error" not in res and res.get("tweets"):
            await budget.add(len(res["tweets"]))
        return res
    return {"error": "X_TOKEN_MISSING"}


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
