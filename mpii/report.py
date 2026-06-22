"""Aggregate reports: roll scored MPs up by governorate / bloc / committee.

Each grouping reports member count, mean/median/min/max MPII, the mean of every
dimension, and the top MP in the group, sorted by mean MPII.
"""

from __future__ import annotations

import pandas as pd

GROUPINGS = ["governorate", "bloc", "committee"]


def aggregate(results: pd.DataFrame, by: str) -> pd.DataFrame:
    """Return a group-level ranking table for column `by`."""
    if by not in results.columns:
        raise ValueError(f"cannot group by {by!r}; column not in results")

    dim_cols = [c for c in results.columns if c.startswith("dim_")]
    grouped = results.groupby(by)

    table = pd.DataFrame(
        {
            "members": grouped.size(),
            "mpii_mean": grouped["mpii"].mean().round(2),
            "mpii_std": grouped["mpii"].std(ddof=0).fillna(0).round(2),
            "mpii_median": grouped["mpii"].median().round(2),
            "mpii_min": grouped["mpii"].min().round(2),
            "mpii_max": grouped["mpii"].max().round(2),
        }
    )
    for col in dim_cols:
        table[f"{col}_mean"] = grouped[col].mean().round(2)

    # Highest-scoring MP within each group.
    top = results.sort_values("mpii", ascending=False).groupby(by, sort=False).first()
    table["top_mp"] = top["name"]

    table = table.sort_values("mpii_mean", ascending=False)
    table.insert(0, "rank", range(1, len(table) + 1))
    return table.reset_index()


def aggregate_all(results: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Aggregate by every grouping that exists in the results."""
    return {by: aggregate(results, by) for by in GROUPINGS if by in results.columns}
