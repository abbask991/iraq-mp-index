-- ════════════════════════════════════════════════════════════════════
-- 013 — MULTI-TENANCY FOUNDATION
-- organizations = tenants (one per client). users belong via memberships.
-- usage_events = per-tenant metering of external data-source cost (billing).
-- Everything degrades gracefully if unapplied (code uses a synthetic org).
-- ════════════════════════════════════════════════════════════════════

create table if not exists organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique,
  plan         text default 'trial',              -- trial | basic | pro | enterprise
  branding     jsonb default '{}'::jsonb,          -- { name, logo_url, primary, hide_vendor } (white-label)
  api_budget_usd numeric default 0,                -- monthly data-cost cap (0 = unlimited)
  byok         jsonb default '{}'::jsonb,          -- bring-your-own-keys: { anthropic, apify, serpapi, x }
  status       text default 'active',              -- active | suspended
  created_at   timestamptz default now()
);

create table if not exists memberships (
  org_id     uuid references organizations(id) on delete cascade,
  user_id    uuid not null,
  email      text,
  role       text default 'member',                -- owner | admin | member
  created_at timestamptz default now(),
  primary key (org_id, user_id)
);
create index if not exists idx_memberships_user on memberships(user_id);

-- per-tenant metering: every external API call records its cost here → monthly invoice
create table if not exists usage_events (
  id        bigserial primary key,
  org_id    uuid,
  provider  text,                                  -- apify | anthropic | serpapi | x
  operation text,                                  -- what was called
  units     numeric default 0,                     -- tokens / searches / actor-runs
  cost_usd  numeric default 0,                     -- estimated cost
  meta      jsonb default '{}'::jsonb,
  ts        timestamptz default now()
);
create index if not exists idx_usage_org_ts on usage_events(org_id, ts desc);
create index if not exists idx_usage_provider on usage_events(org_id, provider);
