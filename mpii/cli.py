"""Command-line interface: read data, score, write results.

Usage:
    python -m mpii score [--config config.yaml] [--data data] [--out out]
"""

from __future__ import annotations

import argparse
import os

import pandas as pd

from .config import Config
from .report import GROUPINGS, aggregate
from .scoring import compute_scores


def _load_inputs(data_dir: str):
    members = pd.read_csv(os.path.join(data_dir, "members.csv"))
    raw = pd.read_csv(os.path.join(data_dir, "raw_indicators.csv"))
    return members, raw


def cmd_score(args: argparse.Namespace) -> int:
    cfg = Config.load(args.config)
    members, raw = _load_inputs(args.data)
    results = compute_scores(cfg, members, raw)

    os.makedirs(args.out, exist_ok=True)
    csv_path = os.path.join(args.out, "scores.csv")
    json_path = os.path.join(args.out, "scores.json")
    results.reset_index().to_csv(csv_path, index=False)
    results.reset_index().to_json(json_path, orient="records", indent=2, force_ascii=False)

    dim_cols = [c for c in results.columns if c.startswith("dim_")]
    table = results[["rank_overall", "name", "governorate", "bloc", *dim_cols, "mpii", "grade"]]
    pd.set_option("display.width", 200)
    pd.set_option("display.max_columns", None)
    print(f"\nMPII ranking ({len(results)} MPs) — config: {args.config}\n")
    print(table.to_string(index=False))
    print(f"\nWrote {csv_path}\nWrote {json_path}")
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    cfg = Config.load(args.config)
    members, raw = _load_inputs(args.data)
    results = compute_scores(cfg, members, raw)

    os.makedirs(args.out, exist_ok=True)
    groupings = [args.by] if args.by else GROUPINGS
    pd.set_option("display.width", 200)
    pd.set_option("display.max_columns", None)

    for by in groupings:
        if by not in results.columns:
            print(f"(skipping '{by}': no such column in data)")
            continue
        table = aggregate(results, by)
        path = os.path.join(args.out, f"by_{by}.csv")
        table.to_csv(path, index=False)
        print(f"\n=== Ranking by {by} ===\n")
        print(table.to_string(index=False))
        print(f"\nWrote {path}")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="mpii", description="Member of Parliament Impact Index")
    sub = parser.add_subparsers(dest="command", required=True)

    p_score = sub.add_parser("score", help="compute scores and rankings")
    p_score.add_argument("--config", default="config.yaml")
    p_score.add_argument("--data", default="data", help="dir with members.csv & raw_indicators.csv")
    p_score.add_argument("--out", default="out", help="output dir for scores.csv / scores.json")
    p_score.set_defaults(func=cmd_score)

    p_report = sub.add_parser("report", help="aggregate rankings by group")
    p_report.add_argument("--config", default="config.yaml")
    p_report.add_argument("--data", default="data", help="dir with members.csv & raw_indicators.csv")
    p_report.add_argument("--out", default="out", help="output dir for by_<group>.csv files")
    p_report.add_argument(
        "--by", choices=GROUPINGS, default=None, help="single grouping (default: all)"
    )
    p_report.set_defaults(func=cmd_report)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
