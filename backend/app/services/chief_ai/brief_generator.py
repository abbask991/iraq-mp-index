"""Executive brief generation (thin wrapper over the analyst AI)."""
from app.services.chief_ai import executive_summary, recommendation_engine


async def generate(facts: str) -> str:
    out = await recommendation_engine.generate(facts)
    return out.get("executive_brief", "")


async def from_digest(dg: dict) -> str:
    return await generate(executive_summary._facts(dg))
