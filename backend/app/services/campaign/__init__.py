"""Coordinated Campaign Detection (package).

Backward-compatible: `from app.services import campaign` then `campaign.detect(...)`
works exactly as before. Internals are now split into focused modules:
  detector · scoring · timing · text_similarity · account_quality ·
  network_signals · hashtag_signals · link_signals · narrative_signals ·
  origin_tracker · campaign_dna
"""
from app.services.campaign import campaign_dna, scoring
from app.services.campaign.detector import detect

# legacy aliases (old code referenced these names on the module)
WEIGHTS = scoring.WEIGHTS
_alert = scoring.alert

__all__ = ["detect", "WEIGHTS", "campaign_dna", "scoring"]
