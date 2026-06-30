"""Visual Verification / Image Intelligence (كشف الصور والتزييف).

Phase-1 MVP: upload/URL → metadata + perceptual hash → reverse-search adapter →
scores → evidence-based verification report. Probabilistic language only; every
assessment carries confidence + evidence and supports human review.
"""
from app.services.visual_verification.analyzer import analyze, get  # noqa: F401
