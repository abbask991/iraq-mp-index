"""Shared fixtures + synthetic data builders for the test suite."""
from datetime import datetime, timedelta, timezone

import pytest

BASE = datetime(2026, 6, 1, 12, 0, tzinfo=timezone.utc)


def tweet(text, author, minutes=0, engagement=10, hashtags=None, mentions=None,
          domains=None, links=None, sentiment="محايد", typ="عام"):
    return {
        "text": text, "author_id": author,
        "created_at": (BASE + timedelta(minutes=minutes)).isoformat().replace("+00:00", "Z"),
        "engagement": engagement, "hashtags": hashtags or [], "mentions": mentions or [],
        "domains": domains or [], "links": links or [], "sentiment": sentiment, "type": typ,
    }


def user(uid, followers=500, following=300, tweets=400, age_days=800, default_img=False):
    created = (datetime.now(timezone.utc) - timedelta(days=age_days)).isoformat().replace("+00:00", "Z")
    return {
        "username": uid, "name": uid, "created_at": created,
        "description": "" if default_img else "ناشط",
        "profile_image_url": "default_profile" if default_img else "https://x/p.jpg",
        "public_metrics": {"followers_count": followers, "following_count": following,
                           "tweet_count": tweets},
    }


@pytest.fixture
def coordinated():
    """8 accounts, identical text, same minute, brand-new low-follower accounts."""
    txt = "انشروا هذا الوسم الآن #حملة_منظمة ضد الفساد رابط مشبوه"
    tweets = [tweet(txt, f"b{i}", minutes=i % 2, hashtags=["حملة_منظمة"],
                    domains=["spam.example"], links=["http://spam.example/x"],
                    sentiment="سلبي", typ="فساد/قضاء") for i in range(8)]
    users = {f"b{i}": user(f"b{i}", followers=3, following=900, tweets=50, age_days=10,
                            default_img=True) for i in range(8)}
    return tweets, users


@pytest.fixture
def organic():
    """8 accounts, varied text/time, established accounts."""
    texts = ["رأيي حول الموازنة مختلف تماماً", "زيارة رسمية اليوم إلى بغداد",
             "تحليل اقتصادي عن النفط والكهرباء", "تصريح جديد حول الانتخابات",
             "مقال عن التعليم في العراق", "أخبار الطقس والخدمات",
             "نقاش رياضي عن الدوري", "ملاحظات عن الصحة العامة"]
    tweets = [tweet(t, f"u{i}", minutes=i * 90, engagement=50 + i,
                    sentiment=("إيجابي" if i % 2 else "محايد")) for i, t in enumerate(texts)]
    users = {f"u{i}": user(f"u{i}", followers=2000 + i * 100, following=300,
                           tweets=1200, age_days=1500) for i in range(8)}
    return tweets, users
