from app.services import emotions, entity_resolver, network, timeline
from app.services.bigdata import fingerprints


# ---- entity alias resolution ----
def test_normalize_arabic_folds_variants():
    assert entity_resolver.normalize_arabic("السُّودانيّ") == entity_resolver.normalize_arabic("السوداني")
    assert entity_resolver.normalize_arabic("إإآ") == "اا" + "ا"


def test_resolve_known_aliases():
    for alias in ["السوداني", "محمد شياع السوداني", "رئيس الوزراء", "PM Sudani", "Al-Sudani"]:
        r = entity_resolver.resolve_entity_alias(alias)
        assert r and r["id"] == "sudani"


def test_resolve_unknown_returns_none():
    assert entity_resolver.resolve_entity_alias("شخص مجهول تماماً") is None


def test_extract_entities_in_sentence():
    ents = entity_resolver.extract_entities("لقاء بين السوداني و المالكي اليوم")
    ids = {e["id"] for e in ents}
    assert {"sudani", "maliki"} <= ids


# ---- bot score ----
def test_bot_score_high_for_fresh_spammy():
    from datetime import datetime, timedelta, timezone
    created = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat().replace("+00:00", "Z")
    u = {"username": "x1234567", "created_at": created, "description": "",
         "profile_image_url": "default_profile",
         "public_metrics": {"followers_count": 2, "following_count": 900, "tweet_count": 400}}
    assert network.bot_score(u)[0] >= 60


def test_bot_score_low_for_established():
    from datetime import datetime, timedelta, timezone
    created = (datetime.now(timezone.utc) - timedelta(days=2000)).isoformat().replace("+00:00", "Z")
    u = {"username": "official_account", "created_at": created, "description": "حساب رسمي",
         "profile_image_url": "https://x/p.jpg",
         "public_metrics": {"followers_count": 50000, "following_count": 300, "tweet_count": 5000}}
    assert network.bot_score(u)[0] < 40


# ---- duplicate detection ----
def test_duplicate_clusters(coordinated, organic):
    ct, _ = coordinated
    ot, _ = organic
    dup_ratio_c, clusters_c, _ = fingerprints.duplicate_clusters(ct)
    dup_ratio_o, _, _ = fingerprints.duplicate_clusters(ot)
    assert dup_ratio_c > 0.5 and clusters_c
    assert dup_ratio_o == 0.0


# ---- timeline milestones ----
def test_timeline_milestones():
    from tests.conftest import tweet
    # volume rising across hours then peaking (minutes spread over ~5 hours)
    volumes = [1, 2, 3, 8, 2]
    posts = []
    for hour, count in enumerate(volumes):
        for j in range(count):
            posts.append(tweet(f"خبر ساعة {hour} رقم {j}", f"u{hour}_{j}", minutes=hour * 60 + j))
    events = timeline.detect_timeline_milestones(posts)
    types = {e["type"] for e in events}
    assert "first_seen" in types
    assert "peak_detected" in types
    # the peak event should point at the highest-volume hour
    peak = next(e for e in events if e["type"] == "peak_detected")
    assert peak["volume"] == 8
    # events are chronologically ordered
    ats = [e["at"] for e in events]
    assert ats == sorted(ats)


# ---- emotions (rule path, no network) ----
def test_emotion_aggregate_detects_anger():
    dist = emotions.aggregate(["خيانة وعار، نندد بهذا", "فضيحة مرفوضة", "يسقط الفساد"])
    assert dist["anger"] > 0
