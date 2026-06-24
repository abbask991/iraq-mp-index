"""Content fingerprints: copy-paste/near-duplicate clusters, synchronized
posting waves, co-occurring hashtags, most-shared domains (Jaccard / exact-norm)."""
import re
from collections import Counter, defaultdict
from datetime import datetime

from app.services import trends

_NORM = re.compile(r"https?://\S+|@\w+|[^\w\s]", re.U)


def normalize(t: str) -> str:
    return re.sub(r"\s+", " ", _NORM.sub(" ", t or "")).strip().lower()


def duplicate_clusters(tweets):
    """Returns (dup_ratio, clusters, normalized_texts)."""
    n = len(tweets) or 1
    norm = [normalize(t["text"]) for t in tweets]
    counts = Counter(x for x in norm if len(x) > 12)
    dup_posts = sum(c for c in counts.values() if c >= 2)
    clusters = [{"text": t[:120], "count": c} for t, c in counts.most_common(6) if c >= 2]
    return dup_posts / n, clusters, norm


def coordination_waves(tweets):
    """10-minute buckets with ≥3 distinct accounts. Returns (waves, acc_times)."""
    wave_acc = defaultdict(set)
    wave_cnt = Counter()
    acc_times = defaultdict(list)
    for t in tweets:
        try:
            dt = datetime.fromisoformat((t.get("created_at") or "").replace("Z", "+00:00"))
            bk = dt.replace(minute=(dt.minute // 10) * 10, second=0).strftime("%m-%d %H:%M")
            wave_acc[bk].add(t["author_id"])
            wave_cnt[bk] += 1
            acc_times[t["author_id"]].append(dt.timestamp() / 60)
        except Exception:
            pass
    waves = sorted(
        ({"time": k, "posts": wave_cnt[k], "accounts": len(v)} for k, v in wave_acc.items() if len(v) >= 3),
        key=lambda w: -w["accounts"])[:6]
    return waves, acc_times


def related_hashtags(keyword, tweets):
    kw_low = (keyword or "").lower()
    rel = Counter()
    for t in tweets:
        for h in t.get("hashtags", []):
            if h.lower() not in kw_low and h not in trends.EXCLUDE_HASHTAGS and not trends.is_spam_hashtag(h):
                rel[h] += 1
    return [{"hashtag": h, "count": c} for h, c in rel.most_common(10) if c >= 2]


def top_domains(tweets):
    domains = Counter(dm for t in tweets for dm in t.get("domains", []) if "t.co" not in dm)
    return [{"domain": dm, "count": c} for dm, c in domains.most_common(8)]
