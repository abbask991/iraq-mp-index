"""Tests for Excel / CSV / Google Sheets import."""

import pandas as pd

from mpii.dataio import (gsheet_csv_url, import_data, normalize_indicators,
                         normalize_members, write_template)


def test_gsheet_url_conversion():
    edit = "https://docs.google.com/spreadsheets/d/1AbCdEf-123_xyz/edit#gid=87654321"
    assert gsheet_csv_url(edit) == (
        "https://docs.google.com/spreadsheets/d/1AbCdEf-123_xyz/export?format=csv&gid=87654321"
    )
    # no gid → defaults to 0
    base = "https://docs.google.com/spreadsheets/d/1AbCdEf-123_xyz/edit"
    assert gsheet_csv_url(base).endswith("export?format=csv&gid=0")
    # non-google input → None
    assert gsheet_csv_url("data/members.csv") is None


def test_normalize_members_fills_defaults():
    df = pd.DataFrame([{"member_id": 5, "name": "X", "governorate": "Baghdad", "bloc": "A"}])
    out = normalize_members(df)
    assert out.loc[0, "role"] == "member"
    assert out.loc[0, "status"] == "active"
    assert out.loc[0, "voting_number"] == 5
    assert list(out.columns)[:4] == ["member_id", "name", "governorate", "bloc"]


def test_normalize_members_requires_core_columns():
    try:
        normalize_members(pd.DataFrame([{"name": "X"}]))
    except ValueError:
        return
    raise AssertionError("expected ValueError for missing required columns")


def test_normalize_indicators_keeps_known_columns():
    df = pd.DataFrame([{"member_id": 1, "bills_enacted": 3, "junk_col": 9}])
    out = normalize_indicators(df)
    assert "bills_enacted" in out.columns
    assert "junk_col" not in out.columns


def test_excel_template_roundtrip(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    pd.DataFrame([
        {"member_id": 1, "name": "Ali", "governorate": "Baghdad", "bloc": "A"},
        {"member_id": 2, "name": "Sara", "governorate": "Basra", "bloc": "B"},
    ]).to_csv(data_dir / "members.csv", index=False)
    pd.DataFrame([
        {"member_id": 1, "bills_passed": 4},
        {"member_id": 2, "bills_passed": 1},
    ]).to_csv(data_dir / "raw_indicators.csv", index=False)

    tpl = write_template(out=str(tmp_path / "tpl.xlsx"), data_dir=str(data_dir))

    # importing the template back updates the CSVs without loss
    out_dir = tmp_path / "data2"
    out_dir.mkdir()
    log = import_data(data_dir=str(out_dir), excel=tpl)
    assert any("members" in line for line in log)
    members = pd.read_csv(out_dir / "members.csv")
    indicators = pd.read_csv(out_dir / "raw_indicators.csv")
    assert len(members) == 2 and len(indicators) == 2
    assert "voter_rating" in indicators.columns
