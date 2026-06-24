from app.services import sov
from tests.conftest import tweet, user


def _entity(name, n_tweets, followers, engagement, sentiment="محايد"):
    tweets = [tweet(f"{name} خبر {i}", f"{name}_a{i}", engagement=engagement, sentiment=sentiment)
              for i in range(n_tweets)]
    users = {f"{name}_a{i}": user(f"{name}_a{i}", followers=followers) for i in range(n_tweets)}
    return {"name": name, "aliases": [name], "x_tweets": tweets, "x_users": users, "news_hits": []}


def test_sov_leader_ranks_first():
    big = _entity("الكبير", 12, 8000, 200)
    small = _entity("الصغير", 3, 500, 10)
    res = sov.compute([small, big])
    ents = res["entities"]
    assert ents[0]["name"] == "الكبير"
    assert ents[0]["rank"] == 1
    assert ents[0]["share_of_voice"] >= ents[1]["share_of_voice"]


def test_sov_shares_sum_to_about_100():
    a = _entity("أ", 5, 1000, 50)
    b = _entity("ب", 5, 1000, 50)
    res = sov.compute([a, b])
    total = sum(e["share_of_voice"] for e in res["entities"])
    assert 95 <= total <= 105


def test_sov_empty_input():
    assert sov.compute([])["entities"] == []
