"""Build a self-contained, custom-designed HTML dashboard from scored data.

No framework, no Streamlit — a single dark "terminal" style page with the data
embedded as JSON and all interaction in vanilla JS. Open the file directly or
serve the folder.
"""

from __future__ import annotations

import csv
import datetime
import json
import os
import random

import numpy as np
import pandas as pd

# Iraqi Arabic month names (index 1..12).
AR_MONTHS = ["", "كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران",
             "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"]

from .config import Config
from .report import GROUPINGS, aggregate
from .scoring import compute_scores

_HERE = os.path.dirname(__file__)

# Arabic display labels for the profile view.
DIM_LABELS_AR = {
    "dim_legislative": "الأداء التشريعي",
    "dim_attendance": "الحضور والمشاركة",
    "dim_oversight": "الرقابة والمساءلة",
    "dim_constituency": "خدمة الناخبين",
    "dim_voter": "تقييم الناخبين",
    "dim_integrity": "النزاهة والشفافية",
}
IND_LABELS_AR = {
    "bills_introduced": "قوانين مُقدَّمة",
    "bills_to_committee": "وصلت إلى اللجنة",
    "bills_passed_chamber": "مُرِّرت في المجلس",
    "bills_enacted": "صارت قانوناً",
    "significant_bills_enacted": "قوانين مهمة أُقرَّت",
    "parliament_attendance_pct": "حضور الجلسات %",
    "committee_attendance_pct": "حضور اللجان %",
    "voting_participation_pct": "المشاركة بالتصويت %",
    "speeches_count": "عدد المداخلات",
    "questions_submitted": "أسئلة برلمانية",
    "investigations_initiated": "تحقيقات",
    "ministers_summoned": "استجوابات وزراء",
    "audit_requests": "طلبات تدقيق",
    "issues_resolved": "قضايا مواطنين محلولة",
    "citizen_engagements": "تفاعلات مع المواطنين",
    "local_projects": "مشاريع محلية متابَعة",
    "communication_score": "درجة التواصل",
    "voter_rating": "متوسط تقييم الناخبين (0–100)",
    "voter_satisfaction_pct": "نسبة رضا الناخبين %",
    "minor_ethics_violations": "مخالفات سلوكية بسيطة",
    "conflict_of_interest": "تضارب مصالح",
    "confirmed_corruption": "فساد مؤكد",
    "court_convictions": "إدانات قضائية",
    "asset_disclosure_filed": "تقديم كشف الذمة المالية",
}


def _dim_meta(cfg: Config) -> list:
    """Per-dimension indicator structure (label + weight) for the profile and
    methodology page."""
    meta = []
    for key, dim in cfg.dimensions.items():
        meta.append({
            "key": "dim_" + key,
            "label": DIM_LABELS_AR.get("dim_" + key, dim.get("label", key)),
            "weight": float(dim["weight"]),
            "indicators": [
                {"key": ik, "label": IND_LABELS_AR.get(ik, ik)} for ik in dim["indicators"]
            ],
        })
    if cfg.integrity_weight > 0:
        meta.append({
            "key": "dim_integrity",
            "label": DIM_LABELS_AR["dim_integrity"],
            "weight": cfg.integrity_weight,
            "indicators": [
                {"key": ik, "label": IND_LABELS_AR.get(ik, ik)}
                for ik in list((cfg.integrity.get("penalties") or {})) + list((cfg.integrity.get("bonuses") or {}))
            ],
        })
    return meta


def _attach_expected(res: pd.DataFrame, members: pd.DataFrame) -> pd.DataFrame:
    """LES-style 'expected score': predict each MP's MPII from structural factors
    (bloc size = influence proxy, leadership role), then flag over/under-performers.
    Measures effort relative to opportunity, not raw standing."""
    res = res.merge(members[["member_id", "bloc", "role"]], on="member_id", how="left", suffixes=("", "_m"))
    bloc_col = "bloc_m" if "bloc_m" in res.columns else "bloc"
    bloc_size = res[bloc_col].map(res[bloc_col].value_counts()).astype(float)
    is_lead = (res["role"] != "member").astype(float)

    # OLS: mpii ~ 1 + bloc_size + is_leadership  (drop zero-variance columns)
    cols = [np.ones(len(res))]
    for feat in (bloc_size.values, is_lead.values):
        if feat.std() > 1e-9:
            cols.append(feat)
    X = np.column_stack(cols)
    y = res["mpii"].values
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    expected = X @ beta
    resid = y - expected
    sd = resid.std() or 1.0

    res["expected_mpii"] = np.round(expected, 1)
    res["vs_expected"] = np.round(resid, 1)
    res["expected_label"] = [
        "يفوق المتوقع" if d > 0.6 * sd else ("دون المتوقع" if d < -0.6 * sd else "ضمن المتوقع")
        for d in resid
    ]
    # drop the temp columns used only for the regression; role/photo/etc. are
    # re-merged cleanly downstream.
    return res.drop(columns=[c for c in ("bloc_m", "role") if c in res.columns])


def _clean(records):
    """Replace NaN / NA with None so the embedded JSON is valid JS (unranked MPs
    have null ranks)."""
    out = []
    for rec in records:
        out.append({k: (None if pd.isna(v) else v) for k, v in rec.items()})
    return out


def _dataset(config_path: str, members: pd.DataFrame, raw: pd.DataFrame) -> dict:
    cfg = Config.load(config_path)
    res = compute_scores(cfg, members, raw).reset_index()
    res = _attach_expected(res, members)
    dims = [c for c in res.columns if c.startswith("dim_")]
    groups = {
        by: _clean(aggregate(res, by).to_dict(orient="records"))
        for by in GROUPINGS
        if by in res.columns
    }

    # Enrich each MP record with raw indicator values + profile fields so the
    # profile view can show full performance details, voting number, role, etc.
    enriched = res.merge(raw, on="member_id", how="left")
    extra = [c for c in ("voting_number", "role", "photo", "status", "served_months",
                         "facebook", "x", "instagram", "telegram", "website")
             if c in members.columns]
    if extra:
        enriched = enriched.merge(members[["member_id", *extra]], on="member_id", how="left")

    return {
        "dims": dims,
        "dim_meta": _dim_meta(cfg),
        "mps": _clean(enriched.to_dict(orient="records")),
        "groups": groups,
    }


def _monthly(members: pd.DataFrame) -> dict:
    """Current-month activity score per MP (synthetic until real monthly data
    is supplied). Deterministic so the build is reproducible."""
    now = datetime.datetime.now()
    label = f"{AR_MONTHS[now.month]} {now.year}"
    rnd = random.Random(99)
    mps = []
    for _, row in members.iterrows():
        score = round(min(100.0, max(0.0, rnd.gauss(55, 20))), 1)
        mps.append({
            "member_id": int(row["member_id"]), "name": row["name"],
            "governorate": row["governorate"], "bloc": row["bloc"], "score": score,
        })
    return {"label": label, "mps": mps}


def _history(members: pd.DataFrame, months: int = 8) -> dict:
    """Per-MP monthly activity history (synthetic) for the profile trend chart."""
    now = datetime.datetime.now()
    labels = []
    for k in range(months - 1, -1, -1):
        mm, yy = now.month - k, now.year
        while mm <= 0:
            mm += 12
            yy -= 1
        labels.append(AR_MONTHS[mm])
    rnd = random.Random(2024)
    scores = {}
    for _, row in members.iterrows():
        cur = rnd.uniform(38, 78)
        drift = rnd.uniform(-1.5, 3.0)
        seq = []
        for _ in range(months):
            cur = max(0.0, min(100.0, cur + drift + rnd.gauss(0, 4)))
            seq.append(round(cur, 1))
        scores[str(int(row["member_id"]))] = seq
    return {"labels": labels, "scores": scores}


def _mentions(data_dir: str) -> dict:
    """News mentions per MP (display-only, not scored), each auto-classified by
    type + sentiment. Keyed by member_id (str)."""
    from .news import classify

    path = os.path.join(data_dir, "mentions.csv")
    if not os.path.exists(path):
        return {}
    out: dict = {}
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rec = {k: r.get(k, "") for k in ("date", "source", "title", "link")}
            rec.update(classify(rec["title"]))
            out.setdefault(str(r["mp_id"]), []).append(rec)
    return out


def _telegram(data_dir: str) -> dict:
    """Telegram posts per MP (display-only), auto-classified. Keyed by member_id."""
    from .news import classify

    path = os.path.join(data_dir, "telegram.csv")
    if not os.path.exists(path):
        return {}
    out: dict = {}
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rec = {k: r.get(k, "") for k in ("date", "channel", "text")}
            rec["sentiment"] = classify(rec["text"])["sentiment"]
            out.setdefault(str(r["mp_id"]), []).append(rec)
    return out


def build_payload(data_dir: str) -> dict:
    members = pd.read_csv(os.path.join(data_dir, "members.csv"))
    raw = pd.read_csv(os.path.join(data_dir, "raw_indicators.csv"))
    return {
        "mentions": _mentions(data_dir),
        "telegram": _telegram(data_dir),
        "shanghai": _dataset("config.shanghai.yaml", members, raw),
        "objective": _dataset("config.objective.yaml", members, raw),
        "full": _dataset("config.yaml", members, raw),
        "monthly": _monthly(members),
        "history": _history(members),
    }


def build_html(data_dir: str) -> str:
    payload = build_payload(data_dir)
    with open(os.path.join(_HERE, "dashboard.html"), "r", encoding="utf-8") as fh:
        template = fh.read()
    return template.replace("/*__DATA__*/", json.dumps(payload))
