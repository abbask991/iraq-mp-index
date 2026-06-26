"""Polling methodology — what turns raw social mentions into a CREDIBLE opinion
measure: population-weighted results, margin of error, and a representativeness
score. This is the layer survey/polling firms need; without it, "X% support" is
just biased noise.

Honest by design: social samples are NOT random (they skew young/urban/engaged),
so we (a) weight governorate results to Iraq's population shares to correct
geographic skew, (b) report the statistical margin of error for the sample size,
and (c) score how representative the sample actually is — and say so.
"""
import math

# Approximate governorate share of Iraq's population (normalized). Source-grade
# weights would come from the latest census/estimates; these are close enough to
# correct the dominant geographic skew.
POP_SHARE = {
    "baghdad": 0.205, "nineveh": 0.095, "basra": 0.070, "dhiqar": 0.052,
    "sulaymaniyah": 0.050, "babil": 0.052, "erbil": 0.048, "anbar": 0.045,
    "diyala": 0.040, "salahuddin": 0.040, "najaf": 0.038, "kirkuk": 0.038,
    "qadisiyyah": 0.035, "wasit": 0.035, "dohuk": 0.035, "karbala": 0.032,
    "maysan": 0.028, "muthanna": 0.020,
}
_TOTAL_GOV = len(POP_SHARE)


def margin_of_error(p: float, n: int, z: float = 1.96) -> float:
    """± percentage points for a proportion p (0..1) at sample size n (95% → z=1.96)."""
    if n <= 0:
        return 0.0
    return round(z * math.sqrt(max(1e-9, p * (1 - p)) / n) * 100, 1)


def weight_by_population(geo_support: dict, *, min_cell: int = 5, min_govs: int = 4) -> dict:
    """Population-weighted support % across governorates. Guards against noise:
    only governorates with ≥min_cell stance-bearing responses count, and weighting
    is only applied when ≥min_govs qualify (else returns None → caller uses raw).
    Weighting tiny cells would let one big-population governorate's noise dominate."""
    num, denom, covered = 0.0, 0.0, 0
    for gid, d in geo_support.items():
        tot = d.get("support", 0) + d.get("oppose", 0)
        if tot < min_cell:
            continue
        share = POP_SHARE.get(gid, 1.0 / _TOTAL_GOV)
        num += share * (d["support"] / tot)
        denom += share
        covered += 1
    if covered < min_govs or denom == 0:
        return {"weighted_support": None, "covered": covered}
    return {"weighted_support": round(num / denom * 100, 1), "covered": covered}


def representativeness(geo_counts: dict) -> dict:
    """How trustworthy the geographic spread is. Coverage = governorates with
    data / 18. Concentration via HHI (1 = one governorate, ~0 = even). Alignment
    = similarity of sample distribution to population distribution."""
    total = sum(geo_counts.values()) or 1
    covered = sum(1 for v in geo_counts.values() if v > 0)
    shares = {g: c / total for g, c in geo_counts.items() if c > 0}
    hhi = sum(s * s for s in shares.values())                  # 0..1
    # alignment: 1 - 0.5*sum|sample_share - pop_share|  (over union)
    diff = 0.0
    for g in set(list(shares) + list(POP_SHARE)):
        diff += abs(shares.get(g, 0) - POP_SHARE.get(g, 0))
    alignment = max(0.0, 1 - diff / 2)
    coverage = covered / _TOTAL_GOV
    score = round((0.45 * coverage + 0.30 * alignment + 0.25 * (1 - hhi)) * 100)
    label = "عالية" if score >= 70 else "متوسطة" if score >= 45 else "منخفضة"
    return {"score": score, "label": label, "governorates_covered": covered,
            "coverage_pct": round(coverage * 100), "alignment_pct": round(alignment * 100),
            "concentration_hhi": round(hhi, 2)}


def confidence(n: int, rep_score: int) -> int:
    """Overall confidence in the reading: grows with sample size + representativeness."""
    size_c = min(60, n / 25)               # 1500 mentions → ~60
    return max(10, min(95, round(size_c + rep_score * 0.4)))
