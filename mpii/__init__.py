"""MPII — Member of Parliament Impact Index scoring engine."""

from .config import Config
from .scoring import compute_scores

__all__ = ["Config", "compute_scores"]
__version__ = "0.1.0"
