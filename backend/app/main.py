"""مركز الرصد — FastAPI backend.

Microservice-ready home for the monitoring + (future) heavy data/AI pipelines.
For now it serves the same endpoints the frontend already uses.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import battlefield, intelligence, monitor

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


@app.get("/")
def root():
    return {"service": "rasd-api", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}
