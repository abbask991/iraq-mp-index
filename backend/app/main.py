"""مركز الرصد — FastAPI backend.

Microservice-ready home for the monitoring + (future) heavy data/AI pipelines.
For now it serves the same endpoints the frontend already uses.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import battlefield, chief_ai, corporate, fusion, influencers, intelligence, monitor, narratives, settings, social, users, polling, opinion, evidence, coordination, brief

app = FastAPI(title="مركز الرصد API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(monitor.router)
app.include_router(intelligence.router)
app.include_router(battlefield.router)
app.include_router(chief_ai.router)
app.include_router(narratives.router)
app.include_router(settings.router)
app.include_router(influencers.router)
app.include_router(users.router)
app.include_router(social.router)
app.include_router(fusion.router)
app.include_router(corporate.router)
app.include_router(polling.router)
app.include_router(opinion.router)
app.include_router(evidence.router)
app.include_router(coordination.router)
app.include_router(brief.router)


@app.on_event("startup")
async def _warm_on_startup():
    """Warm the heavy caches shortly after boot so the first users hit warm pages,
    not cold builds. Fire-and-forget; delayed so the server is ready first."""
    import asyncio

    async def _go():
        await asyncio.sleep(20)
        try:
            from app.services import warm
            await warm.warm_all()
        except Exception:
            pass
    asyncio.create_task(_go())

    # internal scheduler — auto warm/alerts/digest + daily brief (no external pinger)
    from app.services import scheduler
    asyncio.create_task(scheduler.run())


@app.get("/")
def root():
    return {"service": "rasd-api", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}
