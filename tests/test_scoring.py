"""Sanity tests for the scoring engine. Run: pytest -q"""

import pandas as pd

from mpii.config import Config
from mpii.scoring import compute_scores

BASE_CFG = {
    "normalization_default": "percentile",
    "tenure_normalization": True,
    "full_term_months": 48,
    "dimensions": {
        "legislative": {
            "label": "Legislative",
            "weight": 0.5,
            "indicators": {"bills_passed": {"weight": 1.0, "rate": True}},
        },
        "attendance": {
            "label": "Attendance",
            "weight": 0.5,
            "indicators": {
                "parliament_attendance_pct": {"weight": 1.0, "normalization": "absolute"}
            },
        },
    },
    "integrity": {"weight": 0.0},
}


def _members(rows):
    return pd.DataFrame(rows)


def test_weights_must_sum_to_one():
    bad = {**BASE_CFG, "dimensions": {"a": {"weight": 0.3, "indicators": {"x": {"weight": 1}}}}}
    try:
        Config(bad)
    except ValueError:
        return
    raise AssertionError("expected weight-sum validation error")


def test_scores_bounded_and_ranked():
    cfg = Config(BASE_CFG)
    members = _members(
        [
            {"member_id": 1, "name": "Top", "governorate": "X", "bloc": "A", "served_months": 48},
            {"member_id": 2, "name": "Mid", "governorate": "X", "bloc": "A", "served_months": 48},
            {"member_id": 3, "name": "Low", "governorate": "Y", "bloc": "B", "served_months": 48},
        ]
    )
    raw = pd.DataFrame(
        [
            {"member_id": 1, "bills_passed": 10, "parliament_attendance_pct": 95},
            {"member_id": 2, "bills_passed": 5, "parliament_attendance_pct": 80},
            {"member_id": 3, "bills_passed": 0, "parliament_attendance_pct": 50},
        ]
    )
    res = compute_scores(cfg, members, raw)

    assert res["mpii"].between(0, 100).all()
    assert res.iloc[0]["name"] == "Top"
    assert res.loc[1, "rank_overall"] == 1
    assert res.loc[3, "rank_overall"] == 3
    # governorate-level ranking is independent of the global ranking
    assert res.loc[3, "rank_in_governorate"] == 1


def test_tenure_normalization_helps_partial_term():
    cfg = Config(BASE_CFG)
    members = _members(
        [
            {"member_id": 1, "name": "Full", "governorate": "X", "bloc": "A", "served_months": 48},
            {"member_id": 2, "name": "Half", "governorate": "X", "bloc": "A", "served_months": 24},
        ]
    )
    # Same raw count, but member 2 achieved it in half the time -> should rank higher.
    raw = pd.DataFrame(
        [
            {"member_id": 1, "bills_passed": 4, "parliament_attendance_pct": 90},
            {"member_id": 2, "bills_passed": 4, "parliament_attendance_pct": 90},
        ]
    )
    res = compute_scores(cfg, members, raw)
    assert res.loc[2, "dim_legislative"] >= res.loc[1, "dim_legislative"]


def test_shanghai_top_scores_100_and_rescales():
    cfg = Config(
        {
            "normalization_default": "top100",
            "rescale_final_to_top": True,
            "tenure_normalization": False,
            "dimensions": {
                "legislative": {
                    "label": "Legislative",
                    "weight": 1.0,
                    "indicators": {"bills_passed": {"weight": 1.0, "sqrt": True}},
                }
            },
            "integrity": {"weight": 0.0},
        }
    )
    members = _members(
        [
            {"member_id": 1, "name": "Lead", "governorate": "X", "bloc": "A", "served_months": 48},
            {"member_id": 2, "name": "Mid", "governorate": "X", "bloc": "A", "served_months": 48},
            {"member_id": 3, "name": "Low", "governorate": "Y", "bloc": "B", "served_months": 48},
        ]
    )
    raw = pd.DataFrame(
        [
            {"member_id": 1, "bills_passed": 16},
            {"member_id": 2, "bills_passed": 4},
            {"member_id": 3, "bills_passed": 1},
        ]
    )
    res = compute_scores(cfg, members, raw)
    assert res["mpii"].max() == 100.0           # #1 rescaled to exactly 100
    assert res.loc[1, "mpii"] == 100.0
    # sqrt transform: member 2 = sqrt(4)/sqrt(16) = 50, member 3 = 25
    assert res.loc[2, "mpii"] == 50.0
    assert res.loc[3, "mpii"] == 25.0


def test_integrity_penalty_lowers_score():
    cfg_dict = {
        **BASE_CFG,
        "dimensions": {
            "attendance": {
                "label": "Attendance",
                "weight": 0.5,
                "indicators": {
                    "parliament_attendance_pct": {"weight": 1.0, "normalization": "absolute"}
                },
            }
        },
        "integrity": {
            "weight": 0.5,
            "base": 100,
            "penalties": {"confirmed_corruption": -40},
        },
    }
    cfg = Config(cfg_dict)
    members = _members(
        [
            {"member_id": 1, "name": "Clean", "governorate": "X", "bloc": "A", "served_months": 48},
            {"member_id": 2, "name": "Tainted", "governorate": "X", "bloc": "A", "served_months": 48},
        ]
    )
    raw = pd.DataFrame(
        [
            {"member_id": 1, "parliament_attendance_pct": 90, "confirmed_corruption": 0},
            {"member_id": 2, "parliament_attendance_pct": 90, "confirmed_corruption": 1},
        ]
    )
    res = compute_scores(cfg, members, raw)
    assert res.loc[1, "mpii"] > res.loc[2, "mpii"]
