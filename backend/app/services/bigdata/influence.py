"""Influence-network graph: force-directed layout, community detection, node
metrics, and top amplifiers."""
import math
import random
from collections import Counter, defaultdict

from app.services import trends


def layout(nodes, edges, iters=90):
    """Tiny Fruchterman-Reingold force-directed layout → positions in [0,1]."""
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


def communities(nodes, edges):
    """Label propagation (few passes) → community id per node."""
    comm = {x: i for i, x in enumerate(nodes)}
    adj = defaultdict(list)
    for a, b in edges:
        adj[a].append(b); adj[b].append(a)
    for _ in range(6):
        for x in nodes:
            if adj[x]:
                comm[x] = Counter(comm[y] for y in adj[x]).most_common(1)[0][0]
    remap = {c: i for i, c in enumerate(sorted(set(comm.values())))}
    return {x: remap[c] for x, c in comm.items()}


def influence_network(tweets, users, bot_scores):
    """Build node/edge graph of the top influential accounts (+ communities)."""
    posts_by = Counter(t["author_id"] for t in tweets)
    rank = sorted(users.keys(),
                  key=lambda a: trends.influence_score(users[a]) * 3 + posts_by.get(a, 0), reverse=True)[:28]
    uname = {a: (users[a].get("username") or a) for a in rank}
    name2id = {users[a].get("username", "").lower(): a for a in rank if users[a].get("username")}
    edges, eseen = [], set()
    for t in tweets:
        a = t["author_id"]
        if a not in uname:
            continue
        for mn in t.get("mentions", []):
            b = name2id.get(mn.lower())
            if b and b != a and (a, b) not in eseen and (b, a) not in eseen:
                eseen.add((a, b)); edges.append((a, b))
    pos = layout(rank, edges)
    comm = communities(rank, edges)
    nodes = [{
        "id": uname[a], "x": round(pos[a][0], 3), "y": round(pos[a][1], 3),
        "size": trends.influence_score(users[a]), "risk": bot_scores.get(a, 0),
        "community": comm[a], "followers": users[a].get("public_metrics", {}).get("followers_count", 0),
        "posts": posts_by.get(a, 0),
    } for a in rank]
    node_edges = [{"s": uname[a], "t": uname[b]} for a, b in edges]
    return {"nodes": nodes, "edges": node_edges, "communities": len(set(comm.values()))}


def amplifiers(tweets, users):
    agg = {}
    for t in tweets:
        a = t["author_id"]; u = users.get(a, {})
        d = agg.setdefault(a, {"username": u.get("username"), "name": u.get("name"),
                               "influence": trends.influence_score(u), "posts": 0, "engagement": 0})
        d["posts"] += 1
        d["engagement"] += t.get("engagement", 0)
    return sorted(agg.values(), key=lambda d: d["engagement"] + d["influence"] * 50, reverse=True)[:8]
