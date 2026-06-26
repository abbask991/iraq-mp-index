"""Corporate Intelligence Suite — reputation, crisis, customer voice, fraud, and
an AI executive brief for a company (banks, telecom, airlines, enterprises).
Reuses the entity-agnostic intelligence engines + corporate-specific classifiers.
"""
from app.services.corporate import customer_voice, fraud
from app.services.corporate.builder import build_corporate

__all__ = ["build_corporate", "customer_voice", "fraud"]
