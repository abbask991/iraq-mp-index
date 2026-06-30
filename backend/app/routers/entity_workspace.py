"""Entity Workspace API (Phase 6) — unified per-entity decision page."""
from fastapi import APIRouter

from app.services import cache, entity_workspace

router = APIRouter(prefix="/api/entity-workspace", tags=["entity-workspace"])


@router.get("")
async def entity_workspace_ep(id: str, demo: int = 0):
    return await cache.swr(f"ew:{demo}:{id}", 1800,
                           lambda: entity_workspace.build(id, demo=bool(demo)))


@router.get("/demo-entities")
async def demo_entities_ep():
    return {"entities": entity_workspace.demo_entities()}
