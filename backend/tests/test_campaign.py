from app.services import campaign
from app.services.campaign import campaign_dna


def test_coordinated_scores_higher_than_organic(coordinated, organic):
    ct, cu = coordinated
    ot, ou = organic
    coord = campaign.detect("حملة", ct, cu, news_count=0)
    org = campaign.detect("نقاش", ot, ou, news_count=2)
    assert coord["coordination_score"] > org["coordination_score"]
    assert coord["coordination_score"] >= 50          # clearly flags coordination


def test_detect_has_nine_sub_scores(coordinated):
    ct, cu = coordinated
    res = campaign.detect("حملة", ct, cu, news_count=0)
    assert len(res["sub_scores"]) == 9
    assert "dna" in res


def test_small_sample_is_inconclusive():
    res = campaign.detect("x", [{"text": "a", "author_id": "1", "created_at": ""}], {}, 0)
    assert res["coordination_score"] == 0


def test_dna_similarity_identical_vs_different(coordinated, organic):
    ct, cu = coordinated
    ot, ou = organic
    a = campaign.detect("حملة", ct, cu, 0)["dna"]
    a2 = campaign.detect("حملة", ct, cu, 0)["dna"]
    b = campaign.detect("نقاش", ot, ou, 2)["dna"]
    assert campaign_dna.similarity(a, a2) > 0.9        # same campaign ≈ identical
    assert campaign_dna.similarity(a, b) < campaign_dna.similarity(a, a2)
