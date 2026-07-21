"""FeatureAccessService (spec §11) — the ONE place feature access is decided.

Resolution order per feature:
  1. platform feature status (code catalog / DB)
  2. organization type compatibility
  3. package entitlement (minimum_package vs the org's plan)
  4. organization feature override (organization_features table)
  5. legacy overrides still honoured: per-user > per-org > per-plan hidden sets
     (system_settings, written by the existing entitlements admin)

The frontend calls resolve() once and renders from it — no feature-access logic
scattered in components. Feature keys are the canonical route keys (hrefs) this
codebase already uses for entitlements, so everything stays consistent.
"""
from app.services import db

PACKAGE_RANK = {"trial": 0, "basic": 1, "pro": 2, "enterprise": 3}

# Code-default catalog (Platform-Admin will later persist/edit this in
# feature_catalog). module + minimum_package + org_types drive gating.
FEATURE_CATALOG: dict[str, dict] = {
    "/monitor/command":   {"name": "مركز القيادة", "module": "operations", "min_package": "trial"},
    "/monitor/warroom":   {"name": "غرفة الحرب", "module": "operations", "min_package": "pro"},
    "/monitor/workspace": {"name": "مساحة العمل", "module": "operations", "min_package": "trial"},
    "/monitor/ai-analyst": {"name": "المحلّل الذكي", "module": "ai", "min_package": "basic"},
    "/monitor/sources":   {"name": "مركز الرصد", "module": "monitoring", "min_package": "trial"},
    "/monitor/analysis":  {"name": "مختبر التحليل", "module": "analysis", "min_package": "basic"},
    "/monitor/risk":      {"name": "المخاطر والإنذار المبكر", "module": "risk", "min_package": "basic"},
    "/monitor/campaigns": {"name": "الحملات والتضليل", "module": "campaigns", "min_package": "pro"},
    "/monitor/narratives": {"name": "السرديات والمعركة", "module": "narratives", "min_package": "pro"},
    "/monitor/entities":  {"name": "الكيانات والتأثير", "module": "analysis", "min_package": "basic"},
    "/monitor/corporate": {"name": "استخبارات الشركات", "module": "corporate", "min_package": "pro"},
    "/monitor/reports":   {"name": "التقارير والمخرجات", "module": "reports", "min_package": "trial"},
    "/monitor/system":    {"name": "النظام والكلفة", "module": "system", "min_package": "trial"},
}


async def _settings_hidden(key: str, require_override: bool = False) -> tuple[set, bool]:
    """Read a system_settings entitlements blob → (hidden set, has_override)."""
    try:
        if db.enabled():
            rows = await db.select("system_settings", f"select=value_json&key=eq.{key}&limit=1")
            if rows:
                v = rows[0].get("value_json") or {}
                if require_override and not v.get("override"):
                    return set(), False
                return set(v.get("hidden", []) or []), True
    except Exception:
        pass
    return set(), False


async def _override_hidden(uid: str | None, org_id: str | None, plan: str | None) -> set:
    """Legacy precedence: per-user override > per-org override > per-plan."""
    if uid:
        h, has = await _settings_hidden(f"entitlements.user.{uid}", require_override=True)
        if has:
            return h
    if org_id:
        h, has = await _settings_hidden(f"entitlements.org.{org_id}", require_override=True)
        if has:
            return h
    if plan:
        h, _ = await _settings_hidden(f"entitlements.{plan}")
        return h
    return set()


async def _org_feature_overrides(org_id: str | None) -> dict:
    """organization_features → {feature_key: enabled}. Empty if table unseeded."""
    out: dict[str, bool] = {}
    try:
        if db.enabled() and org_id:
            rows = await db.select("organization_features",
                                   f"select=feature_key,enabled&organization_id=eq.{org_id}&limit=500")
            for r in rows or []:
                if r.get("feature_key"):
                    out[r["feature_key"]] = bool(r.get("enabled"))
    except Exception:
        pass
    return out


async def resolve(org_id: str | None, role: str | None, plan: str | None,
                  org_type: str | None) -> dict:
    """Everything the nav needs: the hidden set + the locked (upgrade-CTA) set."""
    return await resolve_for_user(org_id, role, plan, org_type, uid=None)


async def resolve_for_user(org_id: str | None, role: str | None, plan: str | None,
                           org_type: str | None, uid: str | None) -> dict:
    plan_rank = PACKAGE_RANK.get(plan or "trial", 0)
    hidden: set[str] = set()
    locked: list[dict] = []

    # (5) legacy override sets
    hidden |= await _override_hidden(uid, org_id, plan)

    # (2)+(3) catalog gates: org-type compatibility + minimum package
    for key, f in FEATURE_CATALOG.items():
        ot = f.get("org_types") or []
        if ot and org_type not in ot:
            hidden.add(key)
            locked.append({"feature": key, "reason": "org_type_incompatible"})
            continue
        if plan_rank < PACKAGE_RANK.get(f.get("min_package", "trial"), 0):
            hidden.add(key)
            locked.append({"feature": key, "reason": "upgrade_required",
                           "min_package": f.get("min_package")})

    # (4) explicit per-org feature overrides win last
    for key, enabled in (await _org_feature_overrides(org_id)).items():
        if enabled:
            hidden.discard(key)
            locked[:] = [l for l in locked if l["feature"] != key]
        else:
            hidden.add(key)

    return {"hidden": sorted(hidden), "locked": locked}


async def can_access_feature(org_id: str | None, role: str | None, plan: str | None,
                             org_type: str | None, uid: str | None, feature_key: str) -> dict:
    """Single-feature decision in the spec §11 return shape."""
    r = await resolve_for_user(org_id, role, plan, org_type, uid)
    hidden = set(r["hidden"])
    if feature_key not in hidden:
        return {"allowed": True, "denial_reason": None, "source_of_access": "granted",
                "upgrade_required": False}
    lock = next((l for l in r["locked"] if l["feature"] == feature_key), None)
    reason = (lock or {}).get("reason", "disabled")
    return {"allowed": False, "denial_reason": reason,
            "source_of_access": "package" if reason == "upgrade_required" else "override",
            "upgrade_required": reason == "upgrade_required"}
