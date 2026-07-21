"""Organizations = tenants (multi-tenancy foundation).

One organization per client. Users belong to an org via `memberships`. Every
signed-in request resolves to exactly one org (JWT → user → membership → org),
so data, config, watchlists and billing are all isolated per tenant.

On a user's first login they get a personal org auto-provisioned (role=owner).
If the `organizations` table isn't applied yet, we degrade to a deterministic
SYNTHETIC org keyed on the user id so nothing breaks pre-migration.
"""
import os
import re

from app.services import db

# Optional platform base domain for per-client SUBDOMAINS (e.g. set to "rasd.app"
# → embassy.rasd.app resolves to the org whose slug is "embassy"). Requires you to
# own the domain + a "*.<base>" wildcard in Vercel. Empty = feature off.
WHITELABEL_BASE_DOMAIN = os.getenv("WHITELABEL_BASE_DOMAIN", "").strip().lower()

VALID_PLANS = ("trial", "basic", "pro", "enterprise")
VALID_ORG_TYPES = ("general", "media", "corporate", "government", "political")

# Per-sector framing fed into the AI narrative layer so briefs/analysis are
# written from the concerns of that client's sector. 'general' adds nothing
# (neutral, current behaviour).
SECTOR_AI_FRAMING = {
    "media": "سياق العميل: مؤسسة إعلامية. أطّر التحليل من زاوية التغطية الإعلامية، حصّة الصوت، وإدارة السمعة التحريرية.",
    "corporate": "سياق العميل: شركة/علامة تجارية. أطّر التحليل من زاوية سمعة العلامة، مخاطر السوق، ومشاعر العملاء.",
    "government": "سياق العميل: جهة حكومية/سيادية. أطّر التحليل من زاوية الرأي العام تجاه الخدمات والسياسات، والاستقرار، والإنذار المبكر.",
    "political": "سياق العميل: كيان/حملة سياسية. أطّر التحليل من زاوية الرأي العام، المنافسة الانتخابية، والسرديات المؤثّرة على الناخب.",
}


def sector_framing(org_type: str | None) -> str:
    """A one-line sector preamble for AI prompts, or '' for general/unknown."""
    return SECTOR_AI_FRAMING.get(str(org_type or "general"), "")


def _slugify(s: str) -> str:
    s = (s or "").split("@")[0]
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "org"


def _synthetic(uid: str, email: str | None) -> dict:
    """Fallback org used when the table is missing (pre-migration) or DB is down.
    Deterministic per user so isolation still holds without persistence."""
    return {"id": f"personal-{uid}", "name": (email or "حسابي"), "slug": _slugify(email or uid),
            "plan": "trial", "branding": {}, "api_budget_usd": 0, "byok": {},
            "status": "active", "org_type": "general", "synthetic": True}


async def get_org(org_id: str) -> dict | None:
    try:
        if db.enabled() and not str(org_id).startswith("personal-"):
            rows = await db.select("organizations", f"select=*&id=eq.{org_id}&limit=1")
            if rows:
                return rows[0]
    except Exception:
        pass
    return None


async def _provision(uid: str, email: str | None) -> dict | None:
    """Create a personal org + owner membership for a brand-new user."""
    try:
        if not db.enabled():
            return None
        org = await db.insert("organizations",
                              {"name": (email or "حسابي"), "slug": _slugify(email or uid), "plan": "trial"},
                              returning=True)
        if not org or not org.get("id"):
            return None
        await db.insert("memberships",
                        {"org_id": org["id"], "user_id": uid, "email": email, "role": "owner"},
                        upsert=True, on_conflict="org_id,user_id")
        return org
    except Exception:
        return None


async def resolve_org(user: dict) -> dict:
    """The heart of tenancy: map a signed-in user to their org + role.
    Returns { org, role }. Never raises — always yields a usable org."""
    uid, email = user.get("id"), user.get("email")
    try:
        if db.enabled():
            rows = await db.select("memberships", f"select=org_id,role&user_id=eq.{uid}&limit=1")
            if rows:
                org = await get_org(rows[0]["org_id"])
                if org:
                    return {"org": org, "role": rows[0].get("role", "member")}
            # first login → give them their own tenant
            org = await _provision(uid, email)
            if org:
                return {"org": org, "role": "owner"}
    except Exception:
        pass
    return {"org": _synthetic(uid, email), "role": "owner"}


# ── admin / management ───────────────────────────────────────────────────────
async def list_orgs() -> list[dict]:
    try:
        if db.enabled():
            rows = await db.select("organizations", "select=*&order=created_at.desc&limit=500")
            return rows if isinstance(rows, list) else []
    except Exception:
        pass
    return []


async def org_id_for_user(uid: str, email: str | None = None) -> str:
    """The canonical org id a user resolves to — SAME logic as resolve_org, so a
    background job keys a digest under the exact id the signed-in reader will read.
    Provisions a personal org on first sight; falls back to the synthetic id."""
    try:
        if db.enabled():
            rows = await db.select("memberships", f"select=org_id&user_id=eq.{uid}&limit=1")
            if rows:
                return rows[0]["org_id"]
            org = await _provision(uid, email)
            if org:
                return org["id"]
    except Exception:
        pass
    return _synthetic(uid, email)["id"]


# hostnames that are the platform's OWN entry points, never a client's domain
DEFAULT_HOSTS = {"rasd-monitor.vercel.app", "localhost", "127.0.0.1", ""}


def normalize_host(host: str | None) -> str:
    """Lowercase, strip protocol/port/path so it matches a stored org.domain."""
    h = str(host or "").strip().lower()
    if "//" in h:
        h = h.split("//", 1)[1]
    h = h.split("/", 1)[0].split(":", 1)[0]
    return h


async def resolve_by_host(host: str | None) -> dict | None:
    """Public: map a request hostname to its org's PUBLIC white-label info
    (name, branding, org_type) — used to brand the login page before sign-in.
    Returns None for the platform's own hosts or an unmapped domain."""
    h = normalize_host(host)
    if h in DEFAULT_HOSTS or h.endswith(".vercel.app"):
        return None
    try:
        if not db.enabled():
            return None
        # 1) exact custom-domain match (client owns intel.client.com)
        rows = await db.select("organizations",
                               f"select=name,branding,org_type&domain=eq.{h}&limit=1")
        # 2) else a subdomain of the platform base domain → match the org's slug
        #    (embassy.rasd.app → org where slug='embassy'); one wildcard serves all
        if not rows and WHITELABEL_BASE_DOMAIN and h.endswith("." + WHITELABEL_BASE_DOMAIN):
            sub = h[: -(len(WHITELABEL_BASE_DOMAIN) + 1)]
            if sub and sub not in ("www", "app", "api"):
                rows = await db.select("organizations",
                                       f"select=name,branding,org_type&slug=eq.{sub}&limit=1")
        if rows:
            r = rows[0]
            return {"name": r.get("name"), "branding": r.get("branding") or {},
                    "org_type": r.get("org_type") or "general"}
    except Exception:
        pass
    return None


async def org_type(org_id: str) -> str:
    """The sector of an org — drives AI framing. 'general' when unset, synthetic,
    or pre-migration (column absent)."""
    try:
        org = await get_org(org_id)
        t = (org or {}).get("org_type")
        if t in VALID_ORG_TYPES:
            return t
    except Exception:
        pass
    return "general"


async def member_user_ids(org_id: str) -> list[str]:
    """The user ids belonging to an org — the boundary for aggregating a tenant's
    data. A member's monitors/mentions roll up to their org so same-org users
    share one intelligence picture. Includes the org id itself as a fallback key
    (personal/synthetic orgs where the user id doubles as the tenant key)."""
    ids: list[str] = []
    try:
        if db.enabled() and org_id and not str(org_id).startswith("personal-"):
            rows = await db.select("memberships", f"select=user_id&org_id=eq.{org_id}&limit=500")
            ids = [r["user_id"] for r in rows if r.get("user_id")]
    except Exception:
        pass
    # personal-<uid> synthetic org → the uid is embedded in the id
    if str(org_id or "").startswith("personal-"):
        ids.append(str(org_id)[len("personal-"):])
    return ids


async def create_org(name: str, plan: str = "trial") -> dict | None:
    plan = plan if plan in VALID_PLANS else "trial"
    try:
        if db.enabled():
            return await db.insert("organizations",
                                   {"name": name, "slug": _slugify(name), "plan": plan}, returning=True)
    except Exception:
        pass
    return None


async def add_member(org_id: str, user_id: str, email: str | None, role: str = "member") -> bool:
    role = role if role in ("owner", "admin", "member") else "member"
    try:
        if db.enabled():
            return bool(await db.insert("memberships",
                        {"org_id": org_id, "user_id": user_id, "email": email, "role": role},
                        upsert=True, on_conflict="org_id,user_id"))
    except Exception:
        pass
    return False


async def update_org(org_id: str, patch: dict) -> bool:
    allowed = {k: v for k, v in patch.items()
               if k in ("name", "plan", "branding", "api_budget_usd", "byok", "status", "org_type", "domain")}
    if "org_type" in allowed and allowed["org_type"] not in VALID_ORG_TYPES:
        allowed["org_type"] = "general"
    if "domain" in allowed:
        # store normalized; empty string clears the mapping (→ NULL)
        allowed["domain"] = normalize_host(allowed["domain"]) or None
    if not allowed or str(org_id).startswith("personal-"):
        return False
    try:
        if db.enabled():
            return await db.update("organizations", f"id=eq.{org_id}", allowed)
    except Exception:
        pass
    return False
