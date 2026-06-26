"""Cross-border influence builder (Iraq ↔ Syria).

Fetches both national timelines in parallel, locates issues shared by BOTH,
and for each shared issue determines who led and who followed (lead–lag), the
influence magnitude, the leaders (originators) and receivers (echoers), and WHEN
the spillover happened. Aggregates an overall direction + an AI read of the
cross-border dynamic. SWR-cached at the router; X spend bounded by the AICE cap.
"""
import asyncio

from app.services import x
from app.services.collection import dedup
from app.services.cross_influence import actors, flow, seeds, topics
from app.services.media_battlefield import battlefield_summary

_CONCURRENCY = 6
_MAG_FLOOR = 18
_AR = {"IQ": "العراق", "SY": "سوريا"}


async def _pool(queries, per_query, rng):
    sem = asyncio.Semaphore(_CONCURRENCY)

    async def _one(q):
        async with sem:
            try:
                return await x.fetch_trend(q, want=per_query, range=rng)
            except Exception:
                return {"error": "exc"}

    results = await asyncio.gather(*(_one(q) for q in queries))
    tweets, users, seen, capped = [], {}, set(), False
    for r in results:
        if not isinstance(r, dict) or "error" in r:
            capped = capped or (isinstance(r, dict) and r.get("error") == "BUDGET_CAP_REACHED")
            continue
        for uid, u in (r.get("users") or {}).items():
            users.setdefault(uid, u)
        for t in (r.get("tweets") or []):
            fp = dedup.fingerprint(t.get("text", ""))
            if fp and fp not in seen:
                seen.add(fp)
                tweets.append(t)
    return tweets, users, capped


async def build(rng: str = "week", per_query: int = 130):
    (iq, iqu, c1), (sy, syu, c2) = await asyncio.gather(
        _pool(seeds.IQ_QUERIES, per_query, rng),
        _pool(seeds.SY_QUERIES, per_query, rng),
    )
    if not iq or not sy:
        return {"error": "NO_DATA", "message": "تعذّر جلب أحد الخطّين — تأكد من توكن X أو سقف الميزانية.",
                "budget_capped": bool(c1 or c2)}
    users = {**syu, **iqu}

    iq_idx, sy_idx = topics.index(iq), topics.index(sy)
    cands = topics.shared(iq_idx, sy_idx, min_each=4, top=20)

    issues = []
    for c in cands:
        ip = [iq[i] for i in iq_idx[c["key"]]["idxs"]]
        sp = [sy[i] for i in sy_idx[c["key"]]["idxs"]]
        fl = flow.analyze_pair(ip, sp)
        if not fl or fl["magnitude"] < _MAG_FLOOR:
            continue
        lead_posts = ip if fl["leader"] == "IQ" else sp
        fol_posts = sp if fl["leader"] == "IQ" else ip
        sample = max(ip + sp, key=lambda p: int(p.get("engagement") or 0), default={})
        issues.append({
            "issue": c["display"], "key": c["key"],
            "leader": fl["leader"], "leader_country": _AR[fl["leader"]],
            "follower": fl["follower"], "follower_country": _AR[fl["follower"]],
            "magnitude": fl["magnitude"], "lag_hours": fl["lag_hours"],
            "correlation": fl["correlation"],
            "iq_count": c["iq_count"], "sy_count": c["sy_count"],
            "lead_onset": fl["lead_onset"], "follow_onset": fl["follow_onset"],
            "leaders": actors.rank(lead_posts, users, by_time=True, top=5),
            "receivers": actors.rank(fol_posts, users, by_time=False, top=5),
            "sample": (sample.get("text") or "")[:200],
            "series": fl["series"],
        })
        if len(issues) >= 10:
            break

    issues.sort(key=lambda x: -x["magnitude"])
    iq_leads = sum(1 for i in issues if i["leader"] == "IQ")
    sy_leads = sum(1 for i in issues if i["leader"] == "SY")
    avg_mag = round(sum(i["magnitude"] for i in issues) / len(issues)) if issues else 0
    avg_lag = round(sum(i["lag_hours"] for i in issues) / len(issues)) if issues else 0
    if iq_leads > sy_leads:
        direction = {"text": "التأثير الغالب: العراق ← سوريا", "leader": "IQ"}
    elif sy_leads > iq_leads:
        direction = {"text": "التأثير الغالب: سوريا ← العراق", "leader": "SY"}
    else:
        direction = {"text": "تأثير متبادل متوازن", "leader": None}

    summary = await _summarize(issues, iq_leads, sy_leads, avg_lag, avg_mag) if issues else ""

    return {
        "period": rng,
        "overview": {
            "shared_issues": len(issues), "iq_leads": iq_leads, "sy_leads": sy_leads,
            "avg_magnitude": avg_mag, "avg_lag_hours": avg_lag,
            "iq_scanned": len(iq), "sy_scanned": len(sy),
            "direction": direction,
        },
        "issues": issues,
        "summary": summary,
        "disclaimer": "تحليل احتمالي آلي يعتمد على تزامن النشر وتسلسله الزمني — مؤشّر تأثير لا إثبات سببية قاطع، "
                      "ويتطلّب مراجعة بشرية.",
    }


async def _summarize(issues, iq_leads, sy_leads, avg_lag, avg_mag):
    top = issues[:6]
    lines = "؛ ".join(
        f"«{i['issue']}» يقودها {i['leader_country']} ويتبعها {i['follower_country']} بعد ~{i['lag_hours']}س (تأثير {i['magnitude']})"
        for i in top)
    facts = (
        f"تحليل التأثير العابر للحدود بين الخطّين الزمنيين العراقي والسوري. "
        f"قضايا مشتركة مرصودة: {len(issues)}. العراق يقود في {iq_leads} قضية، سوريا تقود في {sy_leads}. "
        f"متوسط زمن التأثير ~{avg_lag} ساعة، متوسط درجة التأثير {avg_mag}/100. "
        f"أبرز القضايا: {lines}. "
        f"اكتب موجزاً تحليلياً: من يؤثّر على من، عبر أي قضايا، وبأي اتجاه ووتيرة، ثم توصيات للمتابعة."
    )
    out = await battlefield_summary.summarize(facts)
    return out.get("summary", "")
