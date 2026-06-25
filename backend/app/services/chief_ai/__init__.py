"""AI Chief Intelligence Officer — turns the platform's intelligence into an
executive advisor: brief, ranked events, threats, opportunities, structured
recommendations, strategic forecast, KPIs, and a grounded chat."""
from app.services.chief_ai.executive_summary import build_dashboard
from app.services.chief_ai import daily_brief

__all__ = ["build_dashboard", "daily_brief"]
