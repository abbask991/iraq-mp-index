-- ════════════════════════════════════════════════════════════════════
-- 019 — PLATFORM PHASE 3: source weights + usage tracking
-- Complements 018 (source_catalog, organization_sources, package_sources).
-- Additive & idempotent.
-- ════════════════════════════════════════════════════════════════════

-- ── analytical source weights per client type (spec §8) ─────────────────────
-- These are ANALYTICAL weights (how much a source counts in scoring), NOT
-- access permissions. Access is organization_sources; weight is here.
create table if not exists organization_source_weights (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  source_key      text,
  use_case        text,               -- e.g. anger | risk | reputation | narrative
  weight          numeric default 1.0,
  rationale       text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (organization_id, source_key, use_case)
);
create index if not exists idx_osw_org on organization_source_weights(organization_id);

-- ── centralized usage counters per org + billing period (spec §19) ──────────
-- One row per (org, period, metric); period is 'YYYY-MM'. Incremented as
-- expensive operations run; read by UsageLimitService to enforce package caps.
create table if not exists organization_usage (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  period          text,               -- YYYY-MM
  metric          text,               -- records | comments | source_api_calls | ai_calls | ai_tokens | reports | exports | ...
  value           numeric default 0,
  updated_at      timestamptz default now(),
  unique (organization_id, period, metric)
);
create index if not exists idx_ousage_org_period on organization_usage(organization_id, period);
