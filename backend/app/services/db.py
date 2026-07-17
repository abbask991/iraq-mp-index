"""Minimal Supabase REST client (service key) for continuous monitoring —
reads monitors, writes snapshots + alerts. Bypasses RLS via service role."""
import httpx

from app.config import SUPABASE_SERVICE_KEY, SUPABASE_URL


def _h():
    return {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"}


def enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)


async def get_monitors(limit: int = 40, owner: str | None = None):
    """Monitors for ONE owner, or every owner when owner is None.

    This client uses the service key and therefore bypasses RLS. Without an owner
    filter it returns every tenant's watchlist — which is how the national picture
    came to be built from other accounts' entities while the signed-in user's own
    watchlist was empty. Callers that serve a specific user MUST pass owner.
    owner=None is for genuinely cross-tenant jobs only (e.g. enumerating work).
    """
    if not enabled():
        return []
    q = f"select=id,owner,name,keywords&order=created_at.desc&limit={limit}"
    if owner:
        q += f"&owner=eq.{owner}"
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/monitors?{q}", headers=_h(), timeout=15)
        return r.json() if r.status_code == 200 else []


async def monitor_owners(limit: int = 500) -> list[str]:
    """Distinct owners that have at least one monitor — the tenants the cron must
    build a digest for."""
    if not enabled():
        return []
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/monitors?select=owner&limit={limit}",
                        headers=_h(), timeout=15)
        if r.status_code != 200:
            return []
        return sorted({row["owner"] for row in r.json() if row.get("owner")})


async def last_snapshot(monitor_id):
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/snapshots?monitor_id=eq.{monitor_id}&order=taken_at.desc&limit=1",
                        headers=_h(), timeout=15)
        d = r.json() if r.status_code == 200 else []
        return d[0] if d else None


async def insert_snapshot(row: dict):
    async with httpx.AsyncClient() as c:
        await c.post(f"{SUPABASE_URL}/rest/v1/snapshots", headers=_h(), json=row, timeout=15)


async def insert_alert(row: dict):
    async with httpx.AsyncClient() as c:
        await c.post(f"{SUPABASE_URL}/rest/v1/alerts", headers=_h(), json=row, timeout=15)


async def get_subscription(owner):
    """Notification prefs (email + telegram) for the monitor owner."""
    if not owner:
        return None
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/notify_prefs?user_id=eq.{owner}&select=email,notify_email,telegram_chat_id",
                        headers=_h(), timeout=15)
        d = r.json() if r.status_code == 200 else []
        return d[0] if d else None


# ---- generic PostgREST helpers (used by the intelligence layer) ----
async def select(table: str, query: str = "select=*", timeout: int = 15):
    """GET /rest/v1/<table>?<query>. Returns a list (empty on any failure)."""
    if not enabled():
        return []
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/{table}?{query}", headers=_h(), timeout=timeout)
        return r.json() if r.status_code == 200 else []


async def count(table: str, query: str = "", timeout: int = 15) -> int | None:
    """Exact row count via PostgREST's Content-Range header.

    select() can only report how many rows it fetched, which is the page size —
    so a capped read looks identical to a real total. Coverage figures shown to a
    client must be the true count, not a limit.

    Returns None (not 0) when unavailable, so callers can hide the figure rather
    than assert "0 signals".
    """
    if not enabled():
        return None
    try:
        async with httpx.AsyncClient() as c:
            r = await c.get(
                f"{SUPABASE_URL}/rest/v1/{table}?select=id&limit=1" + (f"&{query}" if query else ""),
                headers={**_h(), "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"},
                timeout=timeout,
            )
            # Content-Range: "0-0/12345"  → the part after the slash is the total
            cr = r.headers.get("content-range") or ""
            total = cr.split("/")[-1]
            return int(total) if total.isdigit() else None
    except Exception:
        return None


async def insert(table: str, row, *, upsert: bool = False, on_conflict: str | None = None,
                 returning: bool = False, timeout: int = 15):
    """POST a row (or list of rows). `upsert=True` + `on_conflict` merges."""
    if not enabled():
        return None
    h = dict(_h())
    prefer = []
    if upsert:
        prefer.append("resolution=merge-duplicates")
    prefer.append("return=representation" if returning else "return=minimal")
    h["Prefer"] = ",".join(prefer)
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if upsert and on_conflict:
        url += f"?on_conflict={on_conflict}"
    async with httpx.AsyncClient() as c:
        r = await c.post(url, headers=h, json=row, timeout=timeout)
        if returning and r.status_code in (200, 201):
            d = r.json()
            return d[0] if isinstance(d, list) and d else d
        return r.status_code in (200, 201, 204)


async def update(table: str, match: str, patch: dict, timeout: int = 15):
    """PATCH /rest/v1/<table>?<match> with `patch`."""
    if not enabled():
        return False
    async with httpx.AsyncClient() as c:
        r = await c.patch(f"{SUPABASE_URL}/rest/v1/{table}?{match}", headers=_h(), json=patch, timeout=timeout)
        return r.status_code in (200, 204)


async def insert_job_run(row: dict):
    await insert("job_runs", row, upsert=True, on_conflict="id")
