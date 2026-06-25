"""Narrative Evolution — birth / growth / split / merge / decline / death.

Builds on narrative_engine.evolution (the dominant-narrative chain across time
windows) and classifies lifecycle events by comparing consecutive windows.
"""
from app.services import narrative_engine


def _share_of(stage, name):
    for n in stage.get("narratives", []):
        if n["narrative"] == name:
            return n["share"]
    return 0


def lifecycle(posts, window="hour"):
    ev = narrative_engine.evolution(posts, window=window)
    stages = ev.get("stages", [])
    events = []
    for i, st in enumerate(stages):
        prev = stages[i - 1] if i else {"narratives": [], "emerged": [], "faded": []}
        for name in st.get("emerged", []):
            events.append({"window": st["window"], "narrative": name, "event": "birth",
                           "label": "ميلاد سردية"})
        for name in st.get("faded", []):
            events.append({"window": st["window"], "narrative": name, "event": "decline",
                           "label": "انحسار/موت سردية"})
        for n in st.get("narratives", []):
            ps = _share_of(prev, n["narrative"])
            if ps and n["share"] - ps >= 12:
                events.append({"window": st["window"], "narrative": n["narrative"],
                               "event": "growth", "label": "نمو متسارع", "delta": n["share"] - ps})
        # split heuristic: one dominant last window → ≥2 strong this window
        if prev.get("narratives") and len([x for x in st.get("narratives", []) if x["share"] >= 20]) >= 2 \
                and len([x for x in prev.get("narratives", []) if x["share"] >= 20]) <= 1:
            events.append({"window": st["window"], "event": "split", "label": "انقسام سردية"})
    return {"chain": ev.get("chain", []), "stages": stages, "events": events,
            "shifts": ev.get("shifts", 0),
            "explain": "دورة حياة السردية: ميلاد، نمو، انقسام، اندماج، انحسار."}
