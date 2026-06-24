"""Shared primitives for the campaign-detection package."""
import re
from datetime import datetime

_NORM_RE = re.compile(r"https?://\S+|@\w+|[^\w\s]", re.U)
TOK = re.compile(r"[؀-ۿ]{3,}")


def norm(t: str) -> str:
    return re.sub(r"\s+", " ", _NORM_RE.sub(" ", t or "")).strip().lower()


def epoch_min(created: str):
    try:
        return datetime.fromisoformat((created or "").replace("Z", "+00:00")).timestamp() / 60
    except Exception:
        return None
