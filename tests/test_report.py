"""Tests for the aggregate-report layer."""

import pandas as pd

from mpii.config import Config
from mpii.report import aggregate, aggregate_all
from mpii.scoring import compute_scores

CFG = Config(
    {
        "normalization_default": "percentile",
        "tenure_normalization": False,
        "dimensions": {
            "attendance": {
                "label": "Attendance",
                "weight": 1.0,
                "indicators": {
                    "parliament_attendance_pct": {"weight": 1.0, "normalization": "absolute"}
                },
            }
        },
        "integrity": {"weight": 0.0},
    }
)

MEMBERS = pd.DataFrame(
    [
        {"member_id": 1, "name": "A1", "governorate": "X", "bloc": "Red", "committee": "Finance"},
        {"member_id": 2, "name": "A2", "governorate": "X", "bloc": "Red", "committee": "Finance"},
        {"member_id": 3, "name": "B1", "governorate": "Y", "bloc": "Blue", "committee": "Health"},
    ]
)
RAW = pd.DataFrame(
    [
        {"member_id": 1, "parliament_attendance_pct": 90},
        {"member_id": 2, "parliament_attendance_pct": 70},
        {"member_id": 3, "parliament_attendance_pct": 95},
    ]
)


def test_aggregate_by_governorate():
    results = compute_scores(CFG, MEMBERS, RAW)
    table = aggregate(results, "governorate")

    assert set(table["governorate"]) == {"X", "Y"}
    # X has two members averaging (90+70)/2 = 80; Y has one at 95 -> Y ranks first.
    y_row = table[table["governorate"] == "Y"].iloc[0]
    x_row = table[table["governorate"] == "X"].iloc[0]
    assert y_row["rank"] == 1
    assert x_row["members"] == 2
    assert x_row["mpii_mean"] == 80.0
    # top MP within X is the higher scorer.
    assert x_row["top_mp"] == "A1"


def test_aggregate_all_groupings():
    results = compute_scores(CFG, MEMBERS, RAW)
    tables = aggregate_all(results)
    assert set(tables) == {"governorate", "bloc", "committee"}
    assert len(tables["committee"]) == 2  # Finance, Health
