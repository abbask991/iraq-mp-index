"""Load and validate the MPII methodology configuration."""

from __future__ import annotations

import yaml

DEFAULT_GRADES = [
    {"min": 90, "label": "A+", "note": "Outstanding"},
    {"min": 80, "label": "A", "note": "Strong"},
    {"min": 70, "label": "B", "note": "Good"},
    {"min": 60, "label": "C", "note": "Average"},
    {"min": 50, "label": "D", "note": "Weak"},
    {"min": 0, "label": "F", "note": "Poor"},
]


class Config:
    """Typed view over the YAML methodology file."""

    def __init__(self, data: dict):
        self.normalization_default = data.get("normalization_default", "percentile")
        self.tenure_normalization = bool(data.get("tenure_normalization", True))
        self.full_term_months = float(data.get("full_term_months", 48))
        self.dimensions = data.get("dimensions", {})
        self.integrity = data.get("integrity", {"weight": 0.0})
        self.grades = sorted(
            data.get("grades", DEFAULT_GRADES), key=lambda g: g["min"], reverse=True
        )
        self.validate()

    @classmethod
    def load(cls, path: str) -> "Config":
        with open(path, "r", encoding="utf-8") as fh:
            return cls(yaml.safe_load(fh))

    @property
    def integrity_weight(self) -> float:
        return float(self.integrity.get("weight", 0.0))

    def validate(self) -> None:
        if not self.dimensions:
            raise ValueError("config has no `dimensions`")

        total = sum(float(d["weight"]) for d in self.dimensions.values())
        total += self.integrity_weight
        if abs(total - 1.0) > 1e-3:
            raise ValueError(
                f"Dimension weights (incl. integrity) must sum to 1.0, got {total:.4f}"
            )

        for name, dim in self.dimensions.items():
            if not dim.get("indicators"):
                raise ValueError(f"dimension '{name}' has no indicators")

    def grade_for(self, score: float) -> str:
        for band in self.grades:
            if score >= band["min"]:
                return band["label"]
        return self.grades[-1]["label"]
