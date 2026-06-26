"""Coordinated-network signals — the explicit "who moves together" layer on top
of the campaign coordination SCORE.

Finds copypasta rings (near-duplicate text pushed by many distinct accounts),
builds the account co-occurrence network (accounts that repeatedly amplify the
same content land in the same cell), detects synchronized posting bursts, and
ranks suspicious (bot-like) accounts. Node x/y positions are laid out here so the
frontend stays a dumb renderer. Pure CPU — no AI/API cost.
"""
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone

from app.services import network as netsig
from app.services.collection import cluster


def _uname(users, author_id):
    u = users.get(author_id) or {}
    return u.get("username") or (f"id:{str(author_id)[:6]}" if author_id else "—")


def _dt(s):
    try:
        return datetime.fromisoformat((s or "").replace("Z", "+00:00"))
    except Exception:
        return None


def content_rings(tweets, users, *, min_authors=3, min_size=3):
    """A "ring" = near-duplicate content posted by ≥min_authors distinct accounts.
    Templated variations (slight edits to dodge dup filters) collapse together via
    the token signature, which is exactly the coordinated-content pattern."""
    rings = []
    for c in cluster.build_clusters(tweets):
        if c["size"] < min_size:
            continue
        members = c["members"]
        distinct = [a for a in dict.fromkeys(tweets[i].get("author_id") for i in members) if a]
        if len(distinct) < min_authors:
            continue
        times = [t for t in (_dt(tweets[i].get("created_at")) for i in members) if t]
        span = round((max(times) - min(times)).total_seconds() / 60) if len(times) >= 2 else 0
        rep = tweets[c["rep"]]
        rings.append({
            "text": (rep.get("text") or "")[:200],
            "author_ids": distinct,
            "authors": [_uname(users, a) for a in distinct][:30],
            "author_count": len(distinct),
            "post_count": c["size"],
            "span_minutes": span,
            "hashtags": list({h for i in members for h in (tweets[i].get("hashtags") or [])})[:6],
            "links": list({l for i in members for l in (tweets[i].get("links") or []) if l})[:4],
        })
    rings.sort(key=lambda r: (-r["author_count"], -r["post_count"]))
    return rings


def _components(node_ids, edges):
    """Union-find connected components → distinct coordinated "cells"."""
    parent = {n: n for n in node_ids}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for e in edges:
        if e["source"] in parent and e["target"] in parent:
            parent[find(e["source"])] = find(e["target"])
    comps = defaultdict(list)
    for n in node_ids:
        comps[find(n)].append(n)
    return sorted(comps.values(), key=len, reverse=True)


def _layout(comps):
    """Grid of cells; nodes of each cell arranged on a circle → readable clusters."""
    pos = {}
    ncomp = max(1, len(comps))
    cols = max(1, math.ceil(math.sqrt(ncomp)))
    rows = max(1, math.ceil(ncomp / cols))
    for ci, comp in enumerate(comps):
        cx = ((ci % cols) + 0.5) / cols
        cy = ((ci // cols) + 0.5) / rows
        k = len(comp)
        rad = 0 if k <= 1 else min(0.16, 0.045 + 0.012 * k)
        for i, n in enumerate(comp):
            ang = 2 * math.pi * i / max(1, k)
            pos[n] = (min(0.97, max(0.03, cx + rad * math.cos(ang))),
                      min(0.94, max(0.06, cy + rad * math.sin(ang))))
    return pos


def account_network(rings, users, *, max_nodes=40):
    """Accounts linked by shared rings. Edge weight = number of rings two accounts
    co-pushed; weight≥2 ("strong") means they coordinated repeatedly, not by
    coincidence. Returns nodes (with layout + bot suspicion), edges, cell stats."""
    uname_map = {(u.get("username") or ""): u for u in users.values()}
    pair_w = Counter()
    acct_rings = Counter()
    for r in rings:
        a = r["authors"]
        for u in a:
            acct_rings[u] += 1
        for i in range(len(a)):
            for j in range(i + 1, len(a)):
                pair_w[tuple(sorted((a[i], a[j])))] += 1

    edges = [{"source": p[0], "target": p[1], "weight": w, "strong": w >= 2}
             for p, w in pair_w.items()]
    deg = Counter()
    for e in edges:
        deg[e["source"]] += e["weight"]
        deg[e["target"]] += e["weight"]

    nodes = []
    for acct in deg:
        u = uname_map.get(acct, {})
        bs, reasons = netsig.bot_score(u) if u else (0, [])
        nodes.append({"id": acct, "username": acct, "degree": deg[acct],
                      "rings": acct_rings.get(acct, 0), "suspicion": bs,
                      "reasons": reasons[:3]})
    nodes.sort(key=lambda n: -n["degree"])
    nodes = nodes[:max_nodes]
    keep = {n["id"] for n in nodes}
    edges = [e for e in edges if e["source"] in keep and e["target"] in keep]

    comps = _components([n["id"] for n in nodes], edges)
    pos = _layout(comps)
    cell_of = {nid: ci for ci, comp in enumerate(comps) for nid in comp}
    for n in nodes:
        n["x"], n["y"] = pos.get(n["id"], (0.5, 0.5))
        n["cell"] = cell_of.get(n["id"], 0)

    real_cells = [c for c in comps if len(c) >= 2]
    return {
        "nodes": nodes, "edges": edges,
        "cells": len(real_cells),
        "largest_cell": max((len(c) for c in comps), default=0),
        "strong_edges": sum(1 for e in edges if e["strong"]),
    }


def time_bursts(tweets, *, bucket_min=15, top=6):
    """Synchronized posting: buckets where volume spikes far above the median."""
    buckets = defaultdict(list)
    for t in tweets:
        dt = _dt(t.get("created_at"))
        if not dt:
            continue
        key = dt.replace(minute=(dt.minute // bucket_min) * bucket_min, second=0, microsecond=0)
        buckets[key].append(t)
    if len(buckets) < 3:
        return []
    counts = sorted(len(v) for v in buckets.values())
    med = counts[len(counts) // 2] or 1
    bursts = []
    for k in sorted(buckets):
        v = buckets[k]
        if len(v) >= max(4, med * 3):
            bursts.append({"at": k.isoformat(), "count": len(v),
                           "accounts": len({t.get("author_id") for t in v}),
                           "ratio": round(len(v) / med, 1)})
    bursts.sort(key=lambda b: -b["count"])
    return bursts[:top]


def suspicious_accounts(users, *, threshold=55, top=12):
    """Bot-like participants ranked by suspicion, with human-readable reasons."""
    out = []
    for u in users.values():
        bs, reasons = netsig.bot_score(u)
        if bs >= threshold:
            out.append({"username": u.get("username"), "suspicion": bs,
                        "reasons": reasons[:3],
                        "followers": (u.get("public_metrics") or {}).get("followers_count", 0),
                        "created_at": (u.get("created_at") or "")[:10]})
    out.sort(key=lambda x: -x["suspicion"])
    return out[:top]
