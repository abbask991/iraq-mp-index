"""Daily / weekly / monthly executive briefs — built on the dashboard payload,
shaped for a leave-behind document (and PDF/Word via reports.py)."""
from app.services.chief_ai import executive_summary


async def daily() -> dict:
    d = await executive_summary.build_dashboard()
    return {
        "period": "daily", "generated_at": d.get("generated_at"),
        "executive_summary": d.get("executive_brief"),
        "top_risks": d.get("threats", []),
        "top_opportunities": d.get("opportunities", []),
        "recommendations": d.get("recommendations", []),
        "trend_forecast": d.get("forecast", {}),
        "kpis": d.get("kpis", []),
        "events": d.get("events", []),
        "disclaimer": d.get("disclaimer"),
    }


async def weekly() -> dict:
    d = await executive_summary.build_dashboard()
    return {
        "period": "weekly", "generated_at": d.get("generated_at"),
        "executive_summary": d.get("executive_brief"),
        "biggest_campaigns": d.get("events", [])[:5],
        "most_attacked": d.get("threats", []),
        "recommendations": d.get("recommendations", []),
        "forecast": d.get("forecast", {}),
        "kpis": d.get("kpis", []),
        "disclaimer": d.get("disclaimer"),
    }


async def monthly() -> dict:
    d = await executive_summary.build_dashboard()
    return {
        "period": "monthly", "generated_at": d.get("generated_at"),
        "executive_summary": d.get("executive_brief"),
        "risk_evolution": d.get("kpis", []),
        "events": d.get("events", []),
        "recommendations": d.get("recommendations", []),
        "forecast": d.get("forecast", {}),
        "note": "التقرير الشهري يصبح أدق مع تراكم بيانات الأرشيف عبر الزمن.",
        "disclaimer": d.get("disclaimer"),
    }
