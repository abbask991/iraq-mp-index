"""Regional influence builder. Each country's national timeline is fetched once
and cached (reused across every comparison). For a country PAIR we locate shared
issues, determine lead–lag direction, score influence + confidence, classify the
issue category and the influence type, and attach leaders / receivers / evidence.
`overview` runs Iraq vs every neighbour to draw the regional influence map.

Reuses the proven cross_influence flow/topics/actors. X spend bounded by AICE cap.
"""
import asyncio

from app.services import cache, x
from app.services.collection import dedup
from app.services.cross_influence import actors, flow, topics
from app.services.media_battlefield import battlefield_summary
from app.services.regional_influence import countries, geo_country, influence_type, issues, score

_CONCURRENCY = 6
_SCORE_FLOOR = 20


async def _fetch_pool(cc, rng, per_query):
    from app.services.collection import budget
    budget.set_category("regional")
    qs = countries.COUNTRIES[cc]["queries"]
    sem = asyncio.Semaphore(_CONCURRENCY)

    async def _one(q):
        async with sem:
            try:
                return await x.fetch_trend(q, want=per_query, range=rng)
            except Exception:
                return {"error": "exc"}

    results = await asyncio.gather(*(_one(q) for q in qs))
    tweets, users, seen = [], {}, set()
    for r in results:
        if not isinstance(r, dict) or "error" in r:
            continue
        for uid, u in (r.get("users") or {}).items():
            users.setdefault(uid, u)
        for t in (r.get("tweets") or []):
            fp = dedup.fingerprint(t.get("text", ""))
            if fp and fp not in seen:
                seen.add(fp)
                tweets.append(t)
    return {"tweets": tweets, "users": users}


async def country_pool(cc, rng="week", per_query=120):
    """National timeline for a country — SWR-cached and reused everywhere."""
    return await cache.swr(f"country_pool:{cc}:{rng}", 7200,
                           lambda: _fetch_pool(cc, rng, per_query))


def _jaccard(a, b):
    a, b = set(a), set(b)
    return len(a & b) / len(a | b) if (a or b) else 0.0


def _hashtags(posts):
    return [h for p in posts for h in (p.get("hashtags") or []) if h]


def _media_ratio(leader_posts, users):
    profs = [users.get(p.get("author_id")) for p in leader_posts]
    profs = [u for u in profs if u]
    if not profs:
        return 0.0
    return sum(1 for u in profs if influence_type._has(u, influence_type._MEDIA)) / len(profs)


def _first(posts, users):
    dated = [(p, flow._dt(p)) for p in posts]
    dated = [(p, d) for p, d in dated if d]
    if not dated:
        return None
    p, d = min(dated, key=lambda x: x[1])
    return {"text": (p.get("text") or "")[:200],
            "username": (users.get(p.get("author_id")) or {}).get("username"),
            "at": d.isoformat(), "engagement": int(p.get("engagement") or 0)}


def _analyze(src, tgt, src_pool, tgt_pool, *, light=False):
    # Merge both keyword pools, then attribute every post to a country by its
    # author's ACTUAL location — not by which keyword fetched it. This is what
    # makes direction honest: a Saudi account posting about Iraq is Gulf discourse.
    users = {**tgt_pool["users"], **src_pool["users"]}
    seen, merged = set(), []
    for t in (src_pool["tweets"] + tgt_pool["tweets"]):
        # key on (author, text) so the SAME tweet fetched twice dedups, but two
        # different accounts posting identical text (cross-border copypasta — the
        # influence signal itself) are both kept.
        key = (t.get("author_id"), dedup.fingerprint(t.get("text", "")))
        if key[1] and key not in seen:
            seen.add(key)
            merged.append(t)

    def _loc_country(t):
        return geo_country.country_of((users.get(t.get("author_id")) or {}).get("location"))

    sp_all = [t for t in merged if _loc_country(t) == src]
    tp_all = [t for t in merged if _loc_country(t) == tgt]
    located_ok = len(sp_all) >= 15 and len(tp_all) >= 15
    cross_ids = set()                       # location attribution is country-exclusive
    s_idx, t_idx = topics.index(sp_all), topics.index(tp_all)
    cands = topics.shared(s_idx, t_idx, min_each=3, top=24)

    issues_out, seen_labels = [], set()
    for c in cands:
        sp = [sp_all[i] for i in s_idx[c["key"]]["idxs"]]
        tp = [tp_all[i] for i in t_idx[c["key"]]["idxs"]]
        # name the issue with its dominant two-word phrase, and dedup by that name
        # so "اعاده" / "الاعمار" collapse into one "اعاده الاعمار" issue.
        label = topics.phrase_for(c["key"], sp + tp)
        if label in seen_labels or (len(label.split()) < 2 and not label.startswith("#")):
            continue                              # require a real phrase or hashtag, not a bare word
        fl = flow.analyze_pair(sp, tp)            # "IQ"=src leads, "SY"=tgt leads
        if not fl:
            continue
        conc = fl.get("concurrent")
        src_leads = fl["leader"] == "IQ"
        lead_posts = sp if src_leads else tp
        fol_posts = tp if src_leads else sp
        h_overlap = _jaccard(_hashtags(sp), _hashtags(tp))
        mr = _media_ratio(lead_posts, users)
        sc = score.influence(lag_hours=fl["lag_hours"], correlation=fl["correlation"],
                             shared_vol=min(fl["iq_volume"], fl["sy_volume"]),
                             hashtag_overlap=h_overlap, media_ratio=mr)
        if sc < _SCORE_FLOOR:
            continue
        conf = score.confidence(src_vol=fl["iq_volume"], tgt_vol=fl["sy_volume"],
                                correlation=fl["correlation"], lag_hours=fl["lag_hours"],
                                located_ok=located_ok)
        sample = max(sp + tp, key=lambda p: int(p.get("engagement") or 0), default={})
        cat = issues.classify(label, sample.get("text", ""))
        seen_labels.add(label)
        row = {
            "issue": label, "key": c["key"], "category": cat, "concurrent": conc,
            "direction": ("متزامن" if conc else
                          f"{countries.name(src)} ← {countries.name(tgt)}" if not src_leads
                          else f"{countries.name(src)} → {countries.name(tgt)}"),
            "leader": None if conc else (src if src_leads else tgt),
            "leader_country": "متزامن" if conc else countries.name(src if src_leads else tgt),
            "follower_country": "متبادل" if conc else countries.name(tgt if src_leads else src),
            "influence_score": sc, "confidence": conf,
            "lag_hours": fl["lag_hours"], "correlation": fl["correlation"],
            "src_count": c["iq_count"], "tgt_count": c["sy_count"],
            "lead_onset": fl["lead_onset"], "follow_onset": fl["follow_onset"],
        }
        if not light:
            itype = influence_type.classify(lead_posts, users)
            row.update({
                "type": itype["type"], "type_reason": itype["reason"], "type_color": itype.get("color"),
                "leaders": actors.rank(lead_posts, users, by_time=True, top=5, exclude=cross_ids),
                "receivers": actors.rank(fol_posts, users, by_time=False, top=5, exclude=cross_ids),
                "evidence": {
                    "source_post": _first(lead_posts, users),
                    "target_post": _first(fol_posts, users),
                    "matched_hashtag": next((h for h in _hashtags(sp) if h in set(_hashtags(tp))), None),
                    "similarity": round(h_overlap * 100),
                },
                "sample": (sample.get("text") or "")[:200],
                "series": [{"t": s["t"], "src": s["iq"], "tgt": s["sy"]} for s in fl["series"]],
            })
        issues_out.append(row)
        if len(issues_out) >= (6 if light else 10):
            break

    issues_out.sort(key=lambda x: -x["influence_score"])
    src_leads = sum(1 for i in issues_out if i["leader"] == src)
    tgt_leads = sum(1 for i in issues_out if i["leader"] == tgt)
    conc = sum(1 for i in issues_out if i.get("concurrent"))
    if src_leads > tgt_leads + 1:
        ddir, dlead = f"{countries.name(src)} ← يؤثّر على {countries.name(tgt)}", src
    elif tgt_leads > src_leads + 1:
        ddir, dlead = f"{countries.name(tgt)} ← يؤثّر على {countries.name(src)}", tgt
    elif src_leads or tgt_leads:
        ddir, dlead = "تأثير متبادل", "MUTUAL"
    else:
        ddir, dlead = "تداول إقليمي متزامن", None
    strength = round(sum(i["influence_score"] for i in issues_out) / len(issues_out)) if issues_out else 0
    return {
        "issues": issues_out,
        "stats": {"shared_issues": len(issues_out), "src_leads": src_leads, "tgt_leads": tgt_leads,
                  "concurrent": conc, "strength": strength, "direction": ddir, "lead": dlead,
                  "src_located": len(sp_all), "tgt_located": len(tp_all), "located_ok": located_ok,
                  "src_scanned": len(sp_all), "tgt_scanned": len(tp_all)},
    }


async def compare(source="IQ", target="SY", rng="week"):
    if source not in countries.COUNTRIES or target not in countries.COUNTRIES or source == target:
        return {"error": "BAD_PAIR", "message": "اختر زوج دولتين صحيحاً."}
    sp, tp = await asyncio.gather(country_pool(source, rng), country_pool(target, rng))
    if not sp["tweets"] or not tp["tweets"]:
        return {"error": "NO_DATA", "message": "تعذّر جلب أحد الخطّين — تأكد من توكن X أو سقف الميزانية."}
    res = _analyze(source, target, sp, tp, light=False)
    st = res["stats"]
    # AI pass: clean issue names (fix clitics) + accurate categories, then re-dedup
    if res["issues"]:
        labeled = await issues.ai_label([{"raw": it["issue"], "sample": it.get("sample", "")} for it in res["issues"]])
        seen, deduped = set(), []
        for it, lab in zip(res["issues"], labeled):
            it["issue"], it["category"] = lab["label"], lab["category"]
            if it["issue"] in seen:
                continue
            seen.add(it["issue"])
            deduped.append(it)
        res["issues"] = deduped
        st["shared_issues"] = len(deduped)
    summary = await _summarize(source, target, res["issues"], st) if res["issues"] else ""
    return {
        "source": source, "target": target,
        "source_country": countries.name(source), "target_country": countries.name(target),
        "source_flag": countries.flag(source), "target_flag": countries.flag(target),
        "period": rng, "overview": st, "issues": res["issues"], "summary": summary,
        "disclaimer": "تحليل احتمالي آلي يعتمد على تزامن النشر وتسلسله الزمني والتشابه المعجمي — "
                      "مؤشّر تأثير لا إثبات سببية قاطع، ويتطلّب مراجعة بشرية.",
    }


async def overview(rng="week"):
    """Iraq vs every neighbour → edges for the regional influence map."""
    iq = await country_pool("IQ", rng)
    if not iq["tweets"]:
        return {"error": "NO_DATA", "message": "تعذّر بناء الخط العراقي."}
    pools = await asyncio.gather(*(country_pool(cc, rng) for cc in countries.NEIGHBORS))
    edges = []
    for cc, pool in zip(countries.NEIGHBORS, pools):
        if not pool["tweets"]:
            continue
        st = _analyze("IQ", cc, iq, pool, light=True)["stats"]
        edges.append({
            "country": cc, "name": countries.name(cc), "flag": countries.flag(cc),
            "direction": st["direction"], "lead": st["lead"], "strength": st["strength"],
            "shared_issues": st["shared_issues"], "iq_leads": st["src_leads"],
            "other_leads": st["tgt_leads"], "concurrent": st["concurrent"],
        })
    edges.sort(key=lambda e: -e["strength"])
    return {"hub": "IQ", "hub_name": "العراق", "period": rng, "edges": edges,
            "disclaimer": "تحليل احتمالي آلي — اتجاهات التأثير مؤشّرات تتطلّب مراجعة بشرية."}


async def _summarize(src, tgt, iss, st):
    top = iss[:6]
    lines = "؛ ".join(
        f"«{i['issue']}» ({i['category']}) {i['direction']} — تأثير {i['influence_score']}/ثقة {i['confidence']}"
        + ("" if i.get("concurrent") else f"، فارق ~{i['lag_hours']}س") for i in top)
    facts = (
        f"تحليل التأثير العابر للحدود بين {countries.name(src)} و{countries.name(tgt)}. "
        f"قضايا مشتركة: {st['shared_issues']}؛ {countries.name(src)} يقود {st['src_leads']}، "
        f"{countries.name(tgt)} يقود {st['tgt_leads']}، متزامنة {st['concurrent']}. "
        f"الاتجاه الغالب: {st['direction']}، متوسط قوة التأثير {st['strength']}/100. "
        f"أبرز القضايا: {lines}. "
        f"اكتب موجزاً تحليلياً: ماذا حدث، من أثّر على من، أي قضية عبرت الحدود، متى تحرّكت، "
        f"من ضخّمها، قوة التأثير ودرجة الثقة، وما الذي يجب مراقبته لاحقاً."
    )
    out = await battlefield_summary.summarize(facts)
    return out.get("summary", "")
