"""Big-data analysis — fake-account (bot) scoring + organized-campaign detection
from X account data. Heuristic, transparent, and explainable (each score lists
its reasons), suitable for a monitoring-center report."""
import re
from collections import Counter
from datetime import datetime, timezone

_DIGITS = re.compile(r"\d")
_NORM = re.compile(r"https?://\S+|@\w+|[^\w\s]", re.U)


def _age_days(created: str):
    try:
        dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).days
    except Exception:
        return None


def bot_score(u: dict):
    """0-100 bot-likeness with human-readable reasons."""
    m = u.get("public_metrics", {})
    foll = m.get("followers_count", 0)
    fr = m.get("following_count", 0)
    tw = m.get("tweet_count", 0)
    age = _age_days(u.get("created_at", "") or "")
    score, reasons = 0, []
    if age is not None:
        if age < 30:
            score += 35; reasons.append("حساب جديد جداً (<شهر)")
        elif age < 90:
            score += 22; reasons.append("حساب حديث (<3 أشهر)")
    if foll < 10:
        score += 15; reasons.append("متابعون قليلون جداً")
    if foll > 0 and fr / max(foll, 1) > 10:
        score += 15; reasons.append("يتابع أضعاف متابعيه")
    elif foll == 0 and fr > 50:
        score += 20; reasons.append("بلا متابعين ويتابع الكثير")
    if age and age > 0 and tw / age > 50:
        score += 15; reasons.append("نشاط مفرط (تغريد كثيف)")
    if not (u.get("description") or "").strip():
        score += 10; reasons.append("بدون نبذة تعريفية")
    if "default_profile" in (u.get("profile_image_url") or ""):
        score += 15; reasons.append("صورة افتراضية")
    if len(_DIGITS.findall(u.get("username", ""))) >= 4:
        score += 10; reasons.append("اسم مستخدم بأرقام كثيرة")
    return min(100, score), reasons


_AGE_BANDS = [("اليوم (≤24 ساعة)", 1), ("آخر 7 أيام", 7), ("آخر 30 يوماً", 30),
              ("آخر 90 يوماً", 90), ("آخر سنة", 365)]


def new_accounts_report(tweets, users):
    """List + group recently-created accounts active in the feed, by creation
    age band, and flag same-day creation clusters (coordinated-creation signal)."""
    posts_by = Counter(t["author_id"] for t in tweets)
    accounts = []
    for aid, u in users.items():
        age = _age_days(u.get("created_at", "") or "")
        if age is None:
            continue
        m = u.get("public_metrics", {})
        accounts.append({
            "username": u.get("username"), "name": u.get("name"),
            "created": (u.get("created_at", "") or "")[:10], "age_days": age,
            "followers": m.get("followers_count", 0),
            "bot_score": bot_score(u)[0], "posts": posts_by.get(aid, 0),
        })

    total = len(accounts)
    bands = []
    used = set()
    for label, maxd in _AGE_BANDS:
        grp = [a for a in accounts if a["age_days"] <= maxd and a["username"] not in used]
        for a in grp:
            used.add(a["username"])
        grp.sort(key=lambda a: (-a["bot_score"], a["age_days"]))
        bands.append({"label": label, "max_days": maxd, "count": len(grp), "accounts": grp[:30]})

    new_count = sum(b["count"] for b in bands)   # accounts younger than 1 year

    # same-day creation clusters among accounts created in the last 120 days
    recent = [a for a in accounts if a["age_days"] <= 120]
    by_day = Counter(a["created"] for a in recent if a["created"])
    clusters = []
    for day, c in by_day.most_common():
        if c >= 3:
            members = [a for a in recent if a["created"] == day]
            members.sort(key=lambda a: -a["bot_score"])
            clusters.append({"date": day, "count": c, "accounts": members[:15]})

    return {
        "total_accounts": total,
        "new_accounts": new_count,
        "new_ratio": round(new_count / total, 2) if total else 0,
        "bands": bands,
        "creation_clusters": clusters[:8],
    }


def _norm_text(t: str) -> str:
    return re.sub(r"\s+", " ", _NORM.sub(" ", t or "")).strip().lower()


def analyze(tweets: list[dict], users: dict) -> dict:
    if not users:
        return {"accounts": 0, "verdict": "لا بيانات كافية"}

    scored = []
    for uid, u in users.items():
        s, reasons = bot_score(u)
        m = u.get("public_metrics", {})
        scored.append({
            "username": u.get("username", ""),
            "name": u.get("name", ""),
            "score": s, "reasons": reasons,
            "followers": m.get("followers_count", 0),
            "age_days": _age_days(u.get("created_at", "") or ""),
        })
    scored.sort(key=lambda x: -x["score"])

    n = len(scored)
    suspicious = [a for a in scored if a["score"] >= 60]
    new_accts = [a for a in scored if a["age_days"] is not None and a["age_days"] < 30]
    avg = round(sum(a["score"] for a in scored) / n, 1)
    pct_new = round(len(new_accts) / n * 100)
    pct_susp = round(len(suspicious) / n * 100)

    # coordinated copy-paste: identical normalized text from ≥3 accounts
    norm = [_norm_text(t["text"]) for t in tweets if len(_norm_text(t["text"])) > 15]
    clusters = [
        {"text": txt[:140], "count": c}
        for txt, c in Counter(norm).most_common(6) if c >= 3
    ]

    organized = pct_new >= 35 or pct_susp >= 40 or bool(clusters)
    if organized:
        verdict = "مؤشرات حملة منظّمة محتملة"
    elif pct_susp >= 20:
        verdict = "نشاط مشبوه جزئي"
    else:
        verdict = "نشاط طبيعي"

    return {
        "accounts": n,
        "suspicious": len(suspicious),
        "pct_suspicious": pct_susp,
        "new_accounts": len(new_accts),
        "pct_new": pct_new,
        "avg_bot_score": avg,
        "duplicate_clusters": clusters,
        "organized": organized,
        "verdict": verdict,
        "top_suspicious": suspicious[:12],
    }
