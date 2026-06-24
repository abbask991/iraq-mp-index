"""Repeated-domain / repeated-link detection."""
from collections import Counter


def link_repetition(tweets):
    """Returns (score 0-100, top_links)."""
    n = len(tweets)
    doms = Counter(d for t in tweets for d in t.get("domains", []) if "t.co" not in d)
    links = Counter(l for t in tweets for l in t.get("links", []) if l)
    top_dom = doms.most_common(1)
    top_link = links.most_common(1)
    dom_share = (top_dom[0][1] / n) if (top_dom and n) else 0
    link_share = (top_link[0][1] / n) if (top_link and n) else 0
    score = min(100, round(dom_share * 120 + link_share * 80))
    top_links = [{"link": l, "count": c} for l, c in links.most_common(5) if c >= 2]
    return score, top_links
