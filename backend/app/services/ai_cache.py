"""AI result cache — never pay Claude twice for the same evidence.

Keyed by (PROMPT_VERSION, model, sha1(prompt)). Bumping PROMPT_VERSION in the
env invalidates every cached answer at once. Backed by the shared Redis layer
(falls back to in-process), and mirrored to the ai_cache table for analytics.
Always send Claude compact evidence — these keys hash the prompt, so smaller,
stable prompts cache better.
"""
import hashlib
import json

from app.config import PROMPT_VERSION
from app.services import redis_client

_DEFAULT_TTL = 86400 * 7        # a week


def key(model: str, prompt: str) -> str:
    h = hashlib.sha1(prompt.encode("utf-8")).hexdigest()
    return f"ai:{PROMPT_VERSION}:{model}:{h}"


async def get(model: str, prompt: str):
    raw = await redis_client.get(key(model, prompt))
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return raw


async def put(model: str, prompt: str, value, ttl: int = _DEFAULT_TTL):
    try:
        payload = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
        await redis_client.set(key(model, prompt), payload, ex=ttl)
    except Exception:
        pass
