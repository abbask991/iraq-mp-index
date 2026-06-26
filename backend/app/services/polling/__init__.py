"""Social Opinion Survey — polling-grade public-opinion measurement from social
media (population-weighted, margin of error, representativeness scoring)."""
from app.services.polling.survey import run_survey

__all__ = ["run_survey"]
