"""Time evolution of the battlefield — reconstructs origin → amplification →
turning points from the posts (reuses timeline_engine)."""
from app.services import timeline_engine


def build(tweets, news_hits=None, metrics=None):
    posts = [{"title": t.get("text", ""), "text": t.get("text", ""), "platform": "x",
              "created_at": t.get("created_at"), "sentiment": t.get("sentiment"),
              "engagement": t.get("engagement", 0)} for t in tweets]
    for h in (news_hits or []):
        posts.append({"title": h.get("title", ""), "platform": "news",
                      "created_at": h.get("date"), "sentiment": h.get("sentiment")})
    return timeline_engine.reconstruct(posts, metrics=metrics)
