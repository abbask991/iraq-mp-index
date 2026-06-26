"""Cross-platform social providers — register all here. Adding/swapping a
provider later = drop a module + register it (and set SOCIAL_PROVIDER)."""
from app.services.social_providers import base, brightdata

base.register(brightdata)

__all__ = ["base", "brightdata"]
