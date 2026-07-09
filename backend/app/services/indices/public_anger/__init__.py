"""Public Anger Index (PAI) — مؤشر الغضب العام.

Quantifies observed public digital anger around a scope (country / entity /
issue / company / campaign / crisis) into an explainable 0–100 signal with a
confidence score, drivers, angry narratives, platform + entity breakdowns, and
evidence. Cost-aware: uses local lexicon/emotion classification by default and
reserves paid AI for naming + explanation only.
"""
from app.services.indices.public_anger.run_index import build, WEIGHTS, RISK_BANDS  # noqa: F401
