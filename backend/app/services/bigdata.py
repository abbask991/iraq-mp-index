"""Advanced Big-Data analytics for a topic/entity.

From one X fetch (tweets + full author profiles + timestamps + entities) it
derives: a composite Manipulation Index, an influence-network graph (with a
force-directed layout + community coloring), hourly activity heatmap, bot-score
and account-age distributions, a volume/sentiment timeline, content fingerprints
(duplicate clusters), top amplifiers, and most-shared domains.
"""
import math
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone

from app.services import network, trends

_NORM = re.compile(r"https?://\S+|@\w+|[^\w\s]", re.U)


def _norm(t):
    return re.sub(r"\s+", " ", _NORM.sub(" ", t or "", )).strip().lower()


def _layout(nodes, edges, iters=90):
    """Tiny Fruchterman-Reingold force-directed layout → positions in [0,1]."""
    import random
    rng = random.Random(7)
    n = len(nodes)
    pos = {x: [rng.uniform(0.1, 0.9), rng.uniform(0.1, 0.9)] for x in nodes}
    if n < 2:
        return pos
    k = 0.5 / math.sqrt(n)
    ns = list(nodes)
    for it in range(iters):
        disp = {x: [0.0, 0.0] for x in nodes}
        for i in range(n):
            for j in range(i + 1, n):
                a, b = ns[i], ns[j]
                dx, dy = pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]
                d = math.sqrt(dx * dx + dy * dy) + 1e-4
                f = k * k / d
                disp[a][0] += dx / d * f; disp[a][1] += dy / d * f
                disp[b][0] -= dx / d * f; disp[b][1] -= dy / d * f
        for a, b in edges:
            if a in pos and b in pos:
                dx, dy = pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]
                d = math.sqrt(dx * dx + dy * dy) + 1e-4
                f = d * d / k
                disp[a][0] -= dx / d * f; disp[a][1] -= dy / d * f
                disp[b][0] += dx / d * f; disp[b][1] += dy / d * f
        temp = 0.06 * (1 - it / iters)
        for x in nodes:
            dl = math.sqrt(disp[x][0] ** 2 + disp[x][1] ** 2) + 1e-4
            pos[x][0] = min(0.97, max(0.03, pos[x][0] + disp[x][0] / dl * min(dl, temp)))
            pos[x][1] = min(0.97, max(0.03, pos[x][1] + disp[x][1] / dl * min(dl, temp)))
    return pos


def _communities(nodes, edges):
    """Label propagation (few passes) → community id per node."""
    comm = {x: i for i, x in enumerate(nodes)}
    adj = defaultdict(list)
    for a, b in edges:
        adj[a].append(b); adj[b].append(a)
    for _ in range(6):
        for x in nodes:
            if adj[x]:
                comm[x] = Counter(comm[y] for y in adj[x]).most_common(1)[0][0]
    # renumber compactly
    remap = {c: i for i, c in enumerate(sorted(set(comm.values())))}
    return {x: remap[c] for x, c in comm.items()}


def analyze(keyword, tweets, users):
    now = datetime.now(timezone.utc)
    n_posts = len(tweets)
    n_acc = len(users)
    if n_posts < 5 or n_acc < 3:
        return {"keyword": keyword, "posts": n_posts, "accounts": n_acc, "sparse": True}

    # ---- distributions ----
    bot_scores = {aid: network.bot_score(u)[0] for aid, u in users.items()}
    ages = {aid: network._age_days(u.get("created_at", "") or "") for aid, u in users.items()}
    bot_hist = [0, 0, 0, 0, 0]  # 0-20,20-40,40-60,60-80,80-100
    for s in bot_scores.values():
        bot_hist[min(4, s // 20)] += 1
    AGE_BANDS = [("< شهر", 0, 30), ("1-3 أشهر", 30, 90), ("3-12 شهر", 90, 365),
                 ("1-3 سنوات", 365, 1095), ("3+ سنوات", 1095, 10 ** 9)]
    cohorts = [{"label": lbl, "count": sum(1 for a in ages.values() if a is not None and lo <= a < hi)}
               for lbl, lo, hi in AGE_BANDS]

    # ---- activity heatmap (by hour, UTC) + timeline ----
    hours = [0] * 24
    tl = defaultdict(lambda: [0, 0])  # day-hour bucket → [count, neg]
    for t in tweets:
        try:
            dt = datetime.fromisoformat((t.get("created_at") or "").replace("Z", "+00:00"))
            hours[dt.hour] += 1
            kb = dt.strftime("%m-%d %H")
            tl[kb][0] += 1
            if t.get("sentiment") == "سلبي":
                tl[kb][1] += 1
        except Exception:
            pass
    peak_hour_share = max(hours) / n_posts if n_posts else 0
    timeline = [{"t": k, "count": v[0], "neg": v[1]} for k, v in sorted(tl.items())][-24:]

    # ---- content fingerprints ----
    norm = [_norm(t["text"]) for t in tweets]
    dup_counts = Counter(x for x in norm if len(x) > 12)
    dup_posts = sum(c for c in dup_counts.values() if c >= 2)
    dup_ratio = dup_posts / n_posts
    clusters = [{"text": t[:120], "count": c} for t, c in dup_counts.most_common(6) if c >= 2]

    # ---- composite manipulation index ----
    susp = [a for a, s in bot_scores.items() if s >= 60]
    bot_pct = len(susp) / n_acc
    new_pct = sum(1 for a in ages.values() if a is not None and a < 30) / n_acc
    manip = round(min(100, (bot_pct * 100 * 0.30 + dup_ratio * 100 * 0.30
                            + new_pct * 100 * 0.20 + peak_hour_share * 100 * 0.20)))
    level = ("مرتفع جداً" if manip >= 70 else "مرتفع" if manip >= 50
             else "متوسط" if manip >= 30 else "منخفض")

    # ---- influence network ----
    posts_by = Counter(t["author_id"] for t in tweets)
    rank = sorted(users.keys(),
                  key=lambda a: trends.influence_score(users[a]) * 3 + posts_by.get(a, 0), reverse=True)[:28]
    uname = {a: (users[a].get("username") or a) for a in rank}
    name2id = {users[a].get("username", "").lower(): a for a in rank if users[a].get("username")}
    edges = []
    eseen = set()
    for t in tweets:
        a = t["author_id"]
        if a not in uname:
            continue
        for mn in t.get("mentions", []):
            b = name2id.get(mn.lower())
            if b and b != a and (a, b) not in eseen and (b, a) not in eseen:
                eseen.add((a, b)); edges.append((a, b))
    pos = _layout(rank, edges)
    comm = _communities(rank, edges)
    nodes = [{
        "id": uname[a], "x": round(pos[a][0], 3), "y": round(pos[a][1], 3),
        "size": trends.influence_score(users[a]), "risk": bot_scores[a],
        "community": comm[a], "followers": users[a].get("public_metrics", {}).get("followers_count", 0),
        "posts": posts_by.get(a, 0),
    } for a in rank]
    node_edges = [{"s": uname[a], "t": uname[b]} for a, b in edges]

    # ---- amplifiers + domains ----
    agg = {}
    for t in tweets:
        a = t["author_id"]; u = users.get(a, {})
        d = agg.setdefault(a, {"username": u.get("username"), "name": u.get("name"),
                               "influence": trends.influence_score(u), "posts": 0, "engagement": 0})
        d["posts"] += 1; d["engagement"] += t.get("engagement", 0)
    amplifiers = sorted(agg.values(), key=lambda d: d["engagement"] + d["influence"] * 50, reverse=True)[:8]
    domains = Counter(dm for t in tweets for dm in t.get("domains", []) if "t.co" not in dm)
    top_domains = [{"domain": dm, "count": c} for dm, c in domains.most_common(8)]

    return {
        "keyword": keyword, "posts": n_posts, "accounts": n_acc,
        "manipulation_index": manip, "level": level,
        "drivers": {"bot_pct": round(bot_pct * 100), "dup_ratio": round(dup_ratio * 100),
                    "new_pct": round(new_pct * 100), "burst": round(peak_hour_share * 100)},
        "bot_histogram": bot_hist, "age_cohorts": cohorts,
        "activity_by_hour": hours, "timeline": timeline,
        "network": {"nodes": nodes, "edges": node_edges, "communities": len(set(comm.values()))},
        "duplicate_clusters": clusters, "amplifiers": amplifiers, "top_domains": top_domains,
    }
