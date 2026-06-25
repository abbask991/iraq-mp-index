"""Conversational interface — grounded answers from platform data only (reuses
the intelligence /ask grounding)."""
from app.routers import intelligence


async def answer(question: str, entity_id: str | None = None) -> dict:
    return await intelligence.ask(intelligence.AskReq(question=question, entity_id=entity_id))
