"""Minimal Supabase REST client (service key) for continuous monitoring —
reads monitors, writes snapshots + alerts. Bypasses RLS via service role."""
import httpx

from app.config import SUPABASE_SERVICE_KEY, SUPABASE_URL


def _h():
    return {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"}


def enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)


async def get_monitors(limit: int = 40):
    if not enabled():
        return []
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/monitors?select=id,owner,name,keywords&order=created_at.desc&limit={limit}",
                        headers=_h(), timeout=15)
        return r.json() if r.status_code == 200 else []


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
