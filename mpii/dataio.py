"""Import members / indicators from Excel, CSV, or Google Sheets, and export an
Excel template. Keeps the canonical data in data/*.csv so the rest of the engine
is unchanged.
"""

from __future__ import annotations

import os
import re

import pandas as pd

_GSHEET_RE = re.compile(r"docs\.google\.com/spreadsheets/d/([A-Za-z0-9_-]+)")
_GID_RE = re.compile(r"[#&?]gid=([0-9]+)")

MEMBER_REQUIRED = ["member_id", "name", "governorate", "bloc"]
MEMBER_COLUMNS = ["member_id", "name", "governorate", "bloc", "committee", "gender",
                  "role", "status", "served_months", "voting_number", "photo"]
MEMBER_DEFAULTS = {"committee": "غير محدد", "gender": "", "role": "member",
                   "status": "active", "served_months": 48, "photo": ""}

INDICATOR_COLUMNS = [
    "bills_introduced", "bills_to_committee", "bills_passed_chamber", "bills_enacted",
    "significant_bills_enacted",
    "parliament_attendance_pct", "committee_attendance_pct", "voting_participation_pct",
    "speeches_count", "questions_submitted", "investigations_initiated",
    "ministers_summoned", "audit_requests", "issues_resolved", "citizen_engagements",
    "local_projects", "communication_score", "voter_rating", "voter_satisfaction_pct",
    "minor_ethics_violations", "conflict_of_interest", "confirmed_corruption",
    "court_convictions", "asset_disclosure_filed",
]


def gsheet_csv_url(url: str):
    """Convert any Google Sheets share/edit URL to its CSV export URL.

    The sheet must be shared as 'anyone with the link can view' for this to work.
    Returns None if `url` is not a Google Sheets link.
    """
    m = _GSHEET_RE.search(url or "")
    if not m:
        return None
    sheet_id = m.group(1)
    gid_m = _GID_RE.search(url)
    gid = gid_m.group(1) if gid_m else "0"
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"


def read_table(src, sheet=0) -> pd.DataFrame:
    """Read a table from a Google Sheets URL, an Excel file, or a CSV file/URL."""
    if isinstance(src, str) and "docs.google.com" in src:
        return pd.read_csv(gsheet_csv_url(src))
    low = str(src).lower()
    if low.endswith((".xlsx", ".xls")):
        return pd.read_excel(src, sheet_name=sheet)
    return pd.read_csv(src)


def normalize_members(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    missing = [c for c in MEMBER_REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"members sheet is missing required columns: {missing}")
    for col, default in MEMBER_DEFAULTS.items():
        if col not in df.columns:
            df[col] = default
    if "voting_number" not in df.columns:
        df["voting_number"] = df["member_id"]
    df["member_id"] = pd.to_numeric(df["member_id"], errors="coerce").astype("Int64")
    df = df.dropna(subset=["member_id"])
    return df[MEMBER_COLUMNS]


def normalize_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    if "member_id" not in df.columns:
        raise ValueError("indicators sheet must have a 'member_id' column")
    df["member_id"] = pd.to_numeric(df["member_id"], errors="coerce").astype("Int64")
    df = df.dropna(subset=["member_id"])
    keep = ["member_id"] + [c for c in INDICATOR_COLUMNS if c in df.columns]
    return df[keep]


def import_data(data_dir="data", excel=None, members_src=None, indicators_src=None) -> list:
    """Update data/*.csv from the given sources. Returns a list of log lines."""
    members = indicators = None

    if excel:
        xls = pd.ExcelFile(excel)
        if "members" in xls.sheet_names:
            members = pd.read_excel(xls, "members")
        if "indicators" in xls.sheet_names:
            indicators = pd.read_excel(xls, "indicators")
        if members is None and indicators is None:
            raise ValueError("workbook has no 'members' or 'indicators' sheet")
    if members_src:
        members = read_table(members_src)
    if indicators_src:
        indicators = read_table(indicators_src)
    if members is None and indicators is None:
        raise ValueError("nothing to import — pass --excel, --members, and/or --indicators")

    log = []
    os.makedirs(data_dir, exist_ok=True)
    if members is not None:
        members = normalize_members(members)
        members.to_csv(os.path.join(data_dir, "members.csv"), index=False)
        log.append(f"imported {len(members)} members → {data_dir}/members.csv")
    if indicators is not None:
        indicators = normalize_indicators(indicators)
        indicators.to_csv(os.path.join(data_dir, "raw_indicators.csv"), index=False)
        cols = [c for c in indicators.columns if c != "member_id"]
        log.append(f"imported indicators for {len(indicators)} MPs ({len(cols)} indicator columns) "
                   f"→ {data_dir}/raw_indicators.csv")

    # cross-check id alignment if both files now exist
    mpath = os.path.join(data_dir, "members.csv")
    ipath = os.path.join(data_dir, "raw_indicators.csv")
    if os.path.exists(mpath) and os.path.exists(ipath):
        mids = set(pd.read_csv(mpath)["member_id"])
        iids = set(pd.read_csv(ipath)["member_id"])
        if mids != iids:
            only_m, only_i = mids - iids, iids - mids
            if only_m:
                log.append(f"⚠ {len(only_m)} members have no indicator row (treated as 0)")
            if only_i:
                log.append(f"⚠ {len(only_i)} indicator rows have no matching member (ignored)")
    return log


def write_template(out="mpii_template.xlsx", data_dir="data") -> str:
    """Write an Excel workbook (members + indicators sheets) pre-filled with the
    current roster, ready to edit and re-import."""
    members = pd.read_csv(os.path.join(data_dir, "members.csv"))

    # indicators sheet: member_id + name (reference) + every indicator column
    ind_path = os.path.join(data_dir, "raw_indicators.csv")
    if os.path.exists(ind_path):
        indicators = pd.read_csv(ind_path)
    else:
        indicators = pd.DataFrame({"member_id": members["member_id"]})
    for col in INDICATOR_COLUMNS:
        if col not in indicators.columns:
            indicators[col] = 0
    indicators = indicators[["member_id", *INDICATOR_COLUMNS]]
    ref = members[["member_id", "name"]]
    indicators = ref.merge(indicators, on="member_id", how="left")

    with pd.ExcelWriter(out, engine="openpyxl") as writer:
        members.to_excel(writer, sheet_name="members", index=False)
        indicators.to_excel(writer, sheet_name="indicators", index=False)
    return out
