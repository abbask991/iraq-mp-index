"""Composite Manipulation Index — weighted blend of suspicious-account share,
duplicate content, new-account share, and temporal burst concentration."""


def manipulation_index(n_acc, bot_scores, ages, dup_ratio, peak_hour_share):
    """Returns (index 0-100, level, drivers, suspect_ids)."""
    suspects = [a for a, s in bot_scores.items() if s >= 60]
    bot_pct = len(suspects) / n_acc if n_acc else 0
    new_pct = (sum(1 for a in ages.values() if a is not None and a < 30) / n_acc) if n_acc else 0
    manip = round(min(100, (bot_pct * 100 * 0.30 + dup_ratio * 100 * 0.30
                            + new_pct * 100 * 0.20 + peak_hour_share * 100 * 0.20)))
    level = ("مرتفع جداً" if manip >= 70 else "مرتفع" if manip >= 50
             else "متوسط" if manip >= 30 else "منخفض")
    drivers = {"bot_pct": round(bot_pct * 100), "dup_ratio": round(dup_ratio * 100),
               "new_pct": round(new_pct * 100), "burst": round(peak_hour_share * 100)}
    return manip, level, drivers, suspects
