"""Advanced Big-Data analytics (package).

Backward-compatible: `from app.services import bigdata` then `bigdata.analyze(...)`
and `bigdata.brief_facts(...)` behave exactly as before. Internals are split into:
  bot_detection · manipulation · influence · fingerprints · analytics
"""
from app.services.bigdata import (
    analytics,
    bot_detection,
    fingerprints,
    influence,
    manipulation,
)
from app.services.bigdata.analytics import analyze, brief_facts

__all__ = ["analyze", "brief_facts", "analytics", "bot_detection",
           "manipulation", "influence", "fingerprints"]
