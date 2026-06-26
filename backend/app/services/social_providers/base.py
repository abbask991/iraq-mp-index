"""Cross-platform social data — provider-agnostic interface.

Designed to be SWAPPABLE: every provider (Bright Data today, anything later)
implements the same small contract and registers itself. Switching/adding a
provider is a one-file change + an env var (SOCIAL_PROVIDER). The rest of the
platform only ever sees the normalized post/profile shape below.

A provider module must expose:
    NAME: str
    SUPPORTED: list[str]                       # platforms it can collect
    def enabled() -> bool
    async def collect(platform, target, limit=20, mode="auto") -> {
        "posts": [normalized_post, ...], "profile": {...}|None, "error": str|None }
"""
import os

PLATFORMS = ["instagram", "tiktok", "facebook", "facebook_groups", "facebook_ads",
             "youtube", "reddit", "telegram", "x", "news"]
PLATFORM_AR = {"instagram": "إنستغرام", "tiktok": "تيك توك", "facebook": "فيسبوك",
               "facebook_groups": "مجموعات فيسبوك", "facebook_ads": "إعلانات فيسبوك",
               "youtube": "يوتيوب", "reddit": "ريديت", "telegram": "تلغرام",
               "x": "إكس", "news": "أخبار (Google News)"}

_PROVIDERS: dict = {}


def register(mod):
    _PROVIDERS[mod.NAME] = mod


def active_name() -> str:
    return os.getenv("SOCIAL_PROVIDER", "brightdata")


def get(name: str | None = None):
    return _PROVIDERS.get(name or active_name())


def providers() -> dict:
    return dict(_PROVIDERS)


def post(platform, *, id=None, url=None, text="", created_at=None, author=None,
         likes=0, comments=0, shares=0, views=0, media_type=None, hashtags=None):
    """The single normalized post shape every provider maps into."""
    return {
        "platform": platform, "id": id, "url": url, "text": text or "",
        "created_at": created_at, "author": author or {},
        "engagement": {"likes": likes or 0, "comments": comments or 0,
                       "shares": shares or 0, "views": views or 0},
        "media_type": media_type, "hashtags": hashtags or [],
    }


def profile(platform, *, username=None, name=None, url=None, followers=0,
            verified=False, bio="", posts_count=0, image=None):
    return {
        "platform": platform, "username": username, "name": name, "url": url,
        "followers": followers or 0, "verified": bool(verified), "bio": bio or "",
        "posts_count": posts_count or 0, "image": image,
    }
