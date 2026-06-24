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
