"""PPOI — Passive Public Opinion Intelligence. Measures observed digital public
opinion (not a representative survey): opinion detection, per-item weighting,
Public Opinion Index + Pressure Index, Media–Public Gap, confidence, forecast.
"""
from app.services.opinion.builder import build_opinion

__all__ = ["build_opinion"]
