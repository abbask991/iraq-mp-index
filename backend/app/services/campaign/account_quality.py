"""New / suspicious / low-quality account scoring for the participant set."""
from app.services import network


def account_suspicion(users):
    """Returns (score 0-100, suspicious_account_ratio)."""
    if not users:
        return 0, 0.0
    scores = [network.bot_score(u)[0] for u in users.values()]
    avg = sum(scores) / len(scores)
    susp_ratio = sum(1 for s in scores if s >= 60) / len(scores)
    return round(0.6 * avg + 0.4 * susp_ratio * 100), round(susp_ratio, 2)
