"""Runtime config from environment (12-factor)."""
import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
X_BEARER_TOKEN = os.getenv("X_BEARER_TOKEN", "")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")

# comma-separated list of allowed frontend origins for CORS
CORS_ORIGINS = [o.strip() for o in os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,https://rasd-monitor.vercel.app",
).split(",") if o.strip()]

# Haiku for high-volume classification (cheap/fast); Sonnet for the high-value
# interpretive outputs (executive summaries + analyst briefs).
CLASSIFY_MODEL = os.getenv("CLASSIFY_MODEL", "claude-haiku-4-5-20251001")
SUMMARY_MODEL = os.getenv("SUMMARY_MODEL", "claude-sonnet-4-6")

# continuous monitoring (snapshots + alerts)
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
CRON_SECRET = os.getenv("CRON_SECRET", "")

# Optional Redis (Upstash / Render Redis). Everything degrades to an in-process
# fallback when unset — Redis only adds cross-process sharing, rate limiting,
# dedup and the job queue. Never required for the app to run.
REDIS_URL = os.getenv("REDIS_URL", "")

# Prompt version — bump to invalidate every cached AI result at once.
PROMPT_VERSION = os.getenv("PROMPT_VERSION", "v1")
