"""Origin tracing — first source account and first influential amplifier."""
from datetime import datetime, timezone

from app.services import trends


def trace(tweets, users):
    """Returns {first_poster, first_influential, amplifiers} via spread analysis."""
    now = datetime.now(timezone.utc)
    spread = trends.spread_analysis(
        tweets, users, [trends._hours_ago(t["created_at"], now) for t in tweets])
    return spread or {}
