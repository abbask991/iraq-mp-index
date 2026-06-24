"""Bot scoring distribution + automation fingerprinting (robotic posting cadence)."""
import statistics

from app.services import network


def bot_scores(users) -> dict:
    return {aid: network.bot_score(u)[0] for aid, u in users.items()}


def account_ages(users) -> dict:
    return {aid: network._age_days(u.get("created_at", "") or "") for aid, u in users.items()}


def histogram(scores: dict) -> list:
    """5 bins: 0-20, 20-40, 40-60, 60-80, 80-100."""
    hist = [0, 0, 0, 0, 0]
    for s in scores.values():
        hist[min(4, s // 20)] += 1
    return hist


def automation_fingerprint(users, scores, acc_times):
    """Accounts whose posting cadence is suspiciously regular or hyperactive."""
    auto = []
    for a, ts in acc_times.items():
        if len(ts) < 4:
            continue
        ts = sorted(ts)
        gaps = [ts[i + 1] - ts[i] for i in range(len(ts) - 1)]
        m = statistics.mean(gaps) or 1
        cv = statistics.pstdev(gaps) / m
        if cv < 0.35 or len(ts) >= 8:
            u = users.get(a, {})
            auto.append({"username": u.get("username"), "posts": len(ts),
                         "regularity": round(max(0, 1 - cv), 2), "bot_score": scores.get(a, 0)})
    return sorted(auto, key=lambda x: (-x["regularity"], -x["posts"]))[:8]
