from app.services import (
    influence_engine,
    narrative_engine,
    prediction_engine,
    reputation_engine,
    risk_engine,
    scenario_simulator,
    scores as scores_mod,
    stylometry,
)


# ---- reputation / trust ----
def test_reputation_positive_beats_negative():
    good = reputation_engine.reputation_score(80, 10, 10, reach=50000, source_credibility=0.8)
    bad = reputation_engine.reputation_score(10, 80, 10, reach=50000, source_credibility=0.8)
    assert good["score"] > bad["score"]
    assert "components" in good and good["grade"]


def test_reputation_delta():
    r = reputation_engine.reputation_score(50, 30, 20, prev=40)
    assert r["delta"] == r["score"] - 40


def test_public_trust_penalizes_anger():
    calm = reputation_engine.public_trust_score(50, 20, 30, trust_emotion_share=0.4, anger_share=0.0)
    angry = reputation_engine.public_trust_score(50, 20, 30, trust_emotion_share=0.0, anger_share=0.6)
    assert calm["score"] > angry["score"]


# ---- influence ----
def test_political_influence_scales_with_reach():
    lo = influence_engine.political_influence_score(mentions=100, reach=1000, amplifier_count=2, network_edges=3)
    hi = influence_engine.political_influence_score(mentions=100, reach=5_000_000, amplifier_count=8, network_edges=20)
    assert hi["score"] > lo["score"]


def test_media_influence_breadth():
    res = influence_engine.media_influence_score(
        [{"source": "a", "total": 5}, {"source": "b", "total": 4}, {"source": "c", "total": 3}])
    assert res["breadth"] == 3 and 0 <= res["score"] <= 100


# ---- risk / crisis ----
def test_political_risk_rises_with_negativity_and_campaign():
    low = risk_engine.political_risk_score(neg_ratio=0.1, campaign_score=10, manipulation_index=5)
    high = risk_engine.political_risk_score(neg_ratio=0.8, neg_velocity=5, campaign_score=80, manipulation_index=70)
    assert high["score"] > low["score"]
    assert high["level"] in ("مرتفع", "حرج")


def test_crisis_response_cools_escalation():
    no_resp = risk_engine.crisis_escalation_score(neg_velocity=6, neg_acceleration=3, reach=500000, campaign_threat=70)
    resp = risk_engine.crisis_escalation_score(neg_velocity=6, neg_acceleration=3, reach=500000,
                                               campaign_threat=70, official_response=True)
    assert resp["score"] < no_resp["score"]
    assert "stage" in no_resp


# ---- narratives ----
def test_narrative_dominance_and_evolution():
    posts = []
    for h, typ in enumerate(["أمني/حادث", "أمني/حادث", "فساد/قضاء", "فساد/قضاء", "فساد/قضاء"]):
        posts.append({"title": f"حادثة الكهرباء والفساد رقم {h}", "type": typ,
                      "created_at": f"2026-06-0{h+1}T10:00:00Z", "sentiment": "سلبي"})
    narrs = narrative_engine.narratives(posts)
    dom = narrative_engine.dominance_score(narrs)
    assert 0 <= dom["score"] <= 100 and dom["leader"]
    evo = narrative_engine.evolution(posts, window="day")
    assert "chain" in evo and isinstance(evo["chain"], list)


# ---- prediction ----
def test_prediction_trajectory_and_national_prob():
    p = prediction_engine.predict([1, 2, 4, 8, 16, 30], reach=2_000_000)
    assert p["trajectory"] in ("متسارع", "صاعد ثابت", "صاعد يتباطأ")
    assert 0.0 <= p["national_trend_probability"] <= 1.0


# ---- stylometry ----
def test_stylometry_same_author_high_for_identical():
    a = stylometry.fingerprint("في هذا اليوم نشرنا الخبر المهم جداً عن الموضوع!! 😀😀")
    b = stylometry.fingerprint("في هذا اليوم نشرنا الخبر المهم جداً عن الموضوع!! 😀😀")
    assert stylometry.same_author_probability(a, b) > 0.9


def test_stylometry_clusters_same_hand(coordinated):
    ct, _ = coordinated
    res = stylometry.cluster_authors(ct, threshold=0.8)
    # the 8 identical coordinated posts should collapse into one same-author group
    assert res["suspected_same_author_groups"]
    assert res["suspected_same_author_groups"][0]["size"] >= 3


# ---- scores aggregator ----
def test_all_scores_returns_eight():
    ev = {"pos": 30, "neg": 50, "neu": 20, "reach": 100000, "mentions": 100,
          "neg_ratio": 0.5, "campaign_score": 60, "manipulation_index": 40,
          "narratives": [{"share": 70}, {"share": 30}], "sources": [{"source": "a", "total": 5}]}
    s = scores_mod.all_scores(ev)
    assert set(scores_mod.SCORE_KEYS) <= set(s)
    head = scores_mod.headline(s)
    assert len(head) == 8


# ---- scenario simulator ----
def test_scenario_official_response_lowers_risk():
    base = {"neg_ratio": 0.6, "volume": 200, "reach": 100000, "risk": 70, "escalation": 65, "reputation": 40}
    out = scenario_simulator.simulate(base, "official_response")
    assert out["projected"]["risk"] < base["risk"]
    assert out["deltas"]["risk"] < 0


def test_scenario_streisand_on_high_reach_delete():
    base = {"neg_ratio": 0.5, "volume": 200, "reach": 5_000_000, "risk": 50, "escalation": 40, "reputation": 50}
    out = scenario_simulator.simulate(base, "delete_post")
    assert out["projected"]["volume"] > base["volume"]   # backfire


def test_scenario_unknown():
    assert "error" in scenario_simulator.simulate({}, "nope")
