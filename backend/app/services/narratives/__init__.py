"""Narrative War Room — discover, analyze, explain, predict and compare media
narratives (collections of posts pushing the same idea, regardless of wording).

Public API:
  build_dashboard()  -> today's active narratives, scored + ranked (section 1)
  build_detail(term) -> one narrative's 8-section deep view
"""
from app.services.narratives.builder import build_dashboard, build_detail

__all__ = ["build_dashboard", "build_detail"]
