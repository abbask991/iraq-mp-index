"""AICE — text normalization, fingerprinting, tokenization for dedup/clustering.

Pure CPU, no API/AI cost. Normalization reuses the Arabic normalizer so that
"الكهرباء" / "الكهرباءِ" / "#الكهرباء" collapse together.
"""
import hashlib
import re

from app.services import entity_resolver, trends

_URL = re.compile(r"https?://\S+|t\.co/\S+")
_MENTION = re.compile(r"@\w+")
_TOKEN = re.compile(r"[؀-ۿ]{3,}|[A-Za-z]{3,}")
_WS = re.compile(r"\s+")


def normalize(text: str) -> str:
    t = _URL.sub(" ", text or "")
    t = _MENTION.sub(" ", t)
    t = entity_resolver.normalize_arabic(t)          # strip diacritics, unify alef/ya/ta
    return _WS.sub(" ", t).strip()


def fingerprint(text: str) -> str:
    """Exact-duplicate key (normalized SHA1)."""
    return hashlib.sha1(normalize(text).encode("utf-8")).hexdigest()


def tokens(text: str) -> list[str]:
    """Significant tokens (stopwords removed) for near-duplicate signatures."""
    return [w for w in _TOKEN.findall(normalize(text)) if w not in trends.AR_STOP]
