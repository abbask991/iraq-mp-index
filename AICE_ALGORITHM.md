# AICE — Adaptive Intelligence Collection Engine (Algorithm Spec)

Design-first. No code yet. Tailored to real constraints:
- X API **Basic**: recent-search only, **reverse-chronological** results, **7-day** window, **~10k tweets/month** quota.
- Infra already present: **Redis (Upstash)**, **RQ worker**, **SWR cache**, `entity_resolver`, `campaign`, `forecast`, `narratives`.
- Hard rule: **a single run can never blow the monthly quota.**

Core principle (corrected from the original proposal):
> You cannot make X return "high-value posts first" — it returns newest-first.
> So value is controlled in **two** places:
> 1. **WHICH queries get quota** (collection lever — real cost control).
> 2. **WHICH fetched posts reach the AI** (ranking + clustering lever — real AI-cost control).

---

## 0. STATE (persisted in Redis / DB)

```
quota.month_limit          # from settings x_api.monthly_quota (e.g. 10000)
quota.used_this_month       # Redis counter, resets monthly
quota.day_used              # Redis counter, resets daily
entities[]                  # watchlist, each with tier + aliases
source_tier(author)         # gov/TV/journalist/influencer/user -> weight
intensity                   # 0..100 national "heat" (computed each run)
seen_hashes                 # Redis set of recent post fingerprints (dedup memory)
```

---

## 1. QUOTA BUDGET (the safety ceiling — computed FIRST, every run)

```
remaining_month = max(0, month_limit - used_this_month)
days_left       = days_remaining_in_month()
daily_budget    = remaining_month / max(1, days_left)
runs_per_day    = 1440 / frequency_minutes        # from settings
base_run_budget = floor(daily_budget / runs_per_day)

# surge allowance during crises, but bounded so we never starve the rest of the day
surge_factor    = 1 + (intensity / 100) * 3        # 1x .. 4x
run_budget      = min(
                    base_run_budget * surge_factor,
                    remaining_month * 0.5,          # never spend >50% of what's left in one run
                    daily_budget * 1.5              # never borrow >1.5 days ahead
                  )
run_budget      = clamp(run_budget, 50, 10000)
```

`run_budget` = total posts this run may fetch across ALL queries. This single line is what the original spec was missing — it makes "election day = 10,000" safe instead of fatal.

---

## 2. PRIORITY QUERY PLAN (where the budget is spent)

Each monitored entity / query gets a **tier** and a **weight**:

```
TIER 1 Critical   weight 8   PM, President, Parliament, Cabinet, ministries,
                              parties, election commission, security, major TV
TIER 2 High       weight 5   MPs, governors, journalists, major influencers, big companies
TIER 3 Normal     weight 3   general keywords, cities, topics, hashtags
TIER 4 Discovery  weight 1   unknown hashtags/accounts/entities/emerging topics
```

Build the plan:
```
queries = [ {q: alias_expansion(e), weight: tier_weight(e)} for e in entities_enabled ]
queries += trending_hashtags_from_last_run()          # feed-forward
total_w = sum(weights)

# allocate the run_budget proportionally to weight, floor per critical entity
for query q:
    q.budget = max(min_floor(q.tier), round(run_budget * q.weight / total_w))

reserve 10% of run_budget for DISCOVERY (Step 6)
```

Collection order = Tier 1 → 2 → 3 → trending → discovery (multi-stage).
If quota runs out mid-plan, lower tiers are simply skipped this run (graceful degradation).

---

## 3. ADAPTIVE SIZE — `intensity` (decides surge_factor in Step 1)

Computed from the *previous* run + live signals (all 0..100, cached):
```
intensity = 0.35 * trend_velocity          # forecast.velocity on recent series
          + 0.30 * campaign_threat         # max coordination_score last run
          + 0.20 * reputation_risk         # max entity risk delta
          + 0.15 * event_flag              # 100 if election/known event date else 0
```
High intensity → bigger `surge_factor` → bigger `run_budget` (still quota-capped).

---

## 4. SMART FETCH (don't waste a single call)

For each query, before hitting X:
```
key = sha1(query + window_bucket)
if Redis has fresh(key):           skip  -> reuse cached posts
if window overlaps last fetch:     fetch only the new slice (since last max_id/time)
fetch newest-first up to q.budget  (this is X's only mode)
increment quota.used_this_month, quota.day_used by posts_returned
store raw + fingerprints
```
Recency is unavoidable here — value is recovered in Steps 5–8, not here.

---

## 5. DEDUP (exact + near) — before any AI

```
exact:   drop posts whose normalized-text hash ∈ seen_hashes
near:    drop posts with >0.9 token-Jaccard to an already-kept post (same window)
add survivors' fingerprints to seen_hashes (TTL = retention window)
```
Pure CPU, zero API/AI cost. Typically removes 30–60% on busy topics.

---

## 6. DISCOVERY MODE (10% reserve — anti-tunnel-vision)

Spend the reserved 10% on:
```
- co-occurring hashtags not in watchlist
- accounts with sudden velocity not in watchlist
- new narratives from narratives.discover_national
promote anything that crosses a threshold -> becomes a Tier-3 query next run
```

---

## 7. CLUSTER-BEFORE-AI (the biggest AI-cost win)

Never send N raw posts to Claude. Cluster, then send representatives:
```
cluster survivors by shared (keywords ∩ entities ∩ hashtags ∩ near-text)
  -> ~ N/12 clusters  (3000 posts -> ~240 clusters)
for each cluster pick 1 representative = argmax(post_priority_score)   # Step 8
send only representatives + cluster sizes to AI
attach AI verdict back to every member of the cluster
```
Token use scales with **cluster count**, not post count → ~10× cheaper.

---

## 8. POST PRIORITY SCORE (ranking, NOT collection)

Used to (a) pick cluster representatives, (b) order what the analyst sees.
All components normalized 0..100:
```
priority = 0.25 * freshness            # exp decay by age
         + 0.20 * source_importance    # tier weight of author (Step 2 table)
         + 0.15 * engagement           # log10(likes+rt+reply+quote)
         + 0.10 * entity_importance    # tier of matched entity
         + 0.10 * narrative_novelty    # 100 if new cluster, less if seen
         + 0.10 * trend_velocity       # cluster growth slope
         + 0.05 * campaign_signal      # coordination score of cluster
         + 0.05 * cross_platform       # also seen in news/telegram?
```
Note: this runs **after** fetch, so it costs nothing in API quota — it only decides
what survives to the (paid) AI stage and what ranks high in the UI.

---

## 9. CROSS-PLATFORM CONFIRMATION (only when it matters)

When a cluster's `trend_velocity > threshold`:
```
fire parallel lightweight lookups: news RSS, Google News, GDELT, Telegram
if found elsewhere -> cross_platform = 100, mark "national"
else -> "platform-specific (X only)"
```
These are non-X sources → don't touch the X quota.

---

## 10. RUN HEALTH (every run logs to collector_runs)

```
{ started, finished, duration_ms, queries_run, posts_fetched, posts_after_dedup,
  clusters, ai_calls, quota_used, quota_remaining, errors[] }
```
Feeds the **Collection Center** dashboard + next run's `intensity`.

---

## 11. DEFERRED (explicitly NOT in v1)

- **Self-learning source ranking** (which channel breaks news first): needs months of
  `collector_runs` history. Build after data accumulates. The schema above starts collecting that history now.

---

## EXECUTION SHAPE

```
RQ scheduled job (every frequency_minutes):
  1. compute quota budget        (Step 1)
  2. compute intensity            (Step 3)
  3. build prioritized plan       (Step 2) + discovery reserve (Step 6)
  4. smart fetch per query        (Step 4)         -> raw posts
  5. dedup                        (Step 5)
  6. cluster                      (Step 7)
  7. score + pick representatives (Step 8)
  8. AI on representatives only
  9. cross-platform confirm hot clusters (Step 9)
 10. persist + log health         (Step 10)
```

Everything runs in the **RQ worker** (background) — never blocks the frontend.

---

## WHY THIS IS "APPROPRIATE" (vs the original)

| Original AICE | This version |
|---|---|
| "fetch most-valuable first" (impossible on X Basic) | value via query-budget + post-fetch ranking |
| election day = 10,000 (would nuke quota) | quota-capped surge, ≤50% of remaining/run |
| source score 9.8/9.5 (false precision) | 5 honest tiers |
| self-learning collector now | schema logs history now, learning later |
| Celery | your existing RQ |
| big-bang rewrite | additive stages; cluster-before-AI alone is the top win |
```
```
