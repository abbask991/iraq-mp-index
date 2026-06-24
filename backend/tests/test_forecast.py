from app.services import forecast


def test_velocity_positive_on_growth():
    assert forecast.velocity([1, 2, 3, 4, 5, 6]) > 0


def test_velocity_negative_on_decline():
    assert forecast.velocity([6, 5, 4, 3, 2, 1]) < 0


def test_acceleration_detects_speedup():
    # gaps widening → positive acceleration
    assert forecast.acceleration([1, 2, 4, 7, 11, 16]) > 0


def test_persistence_counts_trailing_above_mean():
    assert forecast.persistence([1, 1, 1, 5, 6, 7]) == 3


def test_major_trend_probability_in_unit_range():
    p = forecast.major_trend_probability([1, 2, 4, 8, 16, 32])
    assert 0.0 <= p <= 1.0
    # a sharp accelerating series should look more major than a flat one
    assert p > forecast.major_trend_probability([3, 3, 3, 3, 3, 3])


def test_forecast_bundle_keys():
    fc = forecast.forecast([1, 2, 3, 5, 8, 13], avg_followers=1000)
    for k in ("velocity", "acceleration", "momentum", "persistence",
              "predicted_peak", "major_trend_probability", "estimated_reach"):
        assert k in fc
    assert fc["estimated_reach"] > 0
