"""Audit trail (spec §23). Fire-and-forget writes to audit_logs — never raises,
so a logging failure can't break the action it records."""
from app.services import db


async def log(organization_id: str | None, action: str, *, actor_user_id: str | None = None,
              actor_email: str | None = None, target: str | None = None,
              previous=None, new=None, reason: str | None = None, ip: str | None = None) -> None:
    try:
        if db.enabled():
            await db.insert("audit_logs", {
                "organization_id": organization_id,
                "actor_user_id": actor_user_id,
                "actor_email": actor_email,
                "action": action,
                "target": target,
                "previous_value": previous,
                "new_value": new,
                "reason": reason,
                "ip": ip,
            })
    except Exception:
        pass


async def recent(organization_id: str | None = None, limit: int = 200) -> list[dict]:
    try:
        if db.enabled():
            q = f"select=*&order=ts.desc&limit={int(limit)}"
            if organization_id:
                q += f"&organization_id=eq.{organization_id}"
            rows = await db.select("audit_logs", q)
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []
