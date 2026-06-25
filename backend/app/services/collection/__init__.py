"""AICE — Adaptive Intelligence Collection Engine.

Phased rollout (see AICE_ALGORITHM.md):
  Phase 1  collector_runs logging + settings wiring       (runlog)
  Phase 2  cluster-before-AI                               (dedup, cluster, smart_classify)
  Phase 3  representative priority scoring                 (priority — next)
  Phase 4+ quota budget, tier allocation, cross-platform, learning
"""
from app.services.collection import runlog, smart_classify

__all__ = ["smart_classify", "runlog"]
