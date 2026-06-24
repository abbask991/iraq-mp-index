"""Prediction engine (#5) — multi-stage trend forecasting for a topic/entity.

Composes forecast.py (velocity/acceleration/momentum/persistence/peak/reach/
probability) and adds: a national-trend probability that folds in reach, a
human-readable trajectory label, and comparison against the entity's own
historical baseline when provided.
"""
from app.services import forecast


def _trajectory(fc):
    v, a = fc["velocity"], fc["acceleration"]
    if v <= 0:
        return "هابط" if v < 0 else "مستقر"
    return "متسارع" if a > 0 else "صاعد يتباطأ" if a < 0 else "صاعد ثابت"


def national_trend_probability(series, reach=0):
    """Fold reach into the base major-trend probability (national reach matters)."""
    base = forecast.major_trend_probability(series)
    import math
    reach_boost = min(0.25, math.log10(reach + 1) / 28) if reach else 0
    return round(min(1.0, base + reach_boost), 3)


def predict(series, *, avg_followers=0, reach=0, history=None, bucket_minutes=60):
    """Full forecast + trajectory + national-trend probability (+ history delta)."""
    series = [float(x) for x in (series or [])]
    fc = forecast.forecast(series, bucket_minutes=bucket_minutes, avg_followers=avg_followers)
    fc["trajectory"] = _trajectory(fc)
    fc["national_trend_probability"] = national_trend_probability(series, reach)
    fc["national_trend"] = (
        "مرجّح وطنياً" if fc["national_trend_probability"] >= 0.66 else
        "محتمل" if fc["national_trend_probability"] >= 0.4 else "محدود")

    if history:                                   # compare to the entity's baseline
        hist = [float(x) for x in history]
        base = sum(hist) / len(hist) if hist else 0
        cur = sum(series[-6:]) / max(1, len(series[-6:]))
        fc["vs_baseline"] = {
            "baseline_avg": round(base, 1), "current_avg": round(cur, 1),
            "ratio": round(cur / base, 2) if base else None,
            "anomalous": bool(base and cur >= base * 2.5),
        }
    fc["explain"] = ("التنبؤ متعدّد المراحل: السرعة والتسارع والزخم والاستمرارية → "
                     "ذروة متوقّعة واحتمال أن يصبح ترنداً وطنياً.")
    return fc
