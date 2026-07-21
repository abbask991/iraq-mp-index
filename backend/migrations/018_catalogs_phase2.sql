-- ════════════════════════════════════════════════════════════════════
-- 018 — PLATFORM PHASE 2: normalized catalogs (packages / features / sources)
-- These tables PERSIST the catalog that Platform-Admin (Phase 4) will edit.
-- Until rows are added, FeatureAccessService falls back to the code defaults,
-- so the platform runs unchanged. Additive & idempotent.
-- ════════════════════════════════════════════════════════════════════

-- ── packages (spec §10) ─────────────────────────────────────────────────────
create table if not exists packages (
  id            uuid primary key default gen_random_uuid(),
  code          text unique,                 -- trial | basic | pro | enterprise
  name          text not null,
  status        text default 'active',
  monthly_price numeric default 0,
  annual_price  numeric default 0,
  currency      text default 'USD',
  max_users        integer,
  max_workspaces   integer,
  max_projects     integer,
  max_entities     integer,
  max_sources      integer,
  max_daily_records   integer,
  max_monthly_records integer,
  max_ai_calls     integer,
  max_storage_gb   integer,
  white_label_allowed       boolean default false,
  custom_domain_allowed     boolean default false,
  api_access_allowed        boolean default false,
  dedicated_instance_allowed boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── feature catalog (spec §9) ───────────────────────────────────────────────
create table if not exists feature_catalog (
  id            uuid primary key default gen_random_uuid(),
  feature_key   text unique,                 -- canonical key (route/href in this codebase)
  display_name  text,
  module        text,
  description   text,
  status        text default 'active',       -- active | beta | deprecated | disabled
  minimum_package text default 'trial',
  allowed_organization_types_json jsonb default '[]'::jsonb,
  dependencies_json jsonb default '[]'::jsonb,
  configuration_schema_json jsonb default '{}'::jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── source catalog (spec §6) ────────────────────────────────────────────────
create table if not exists source_catalog (
  id            uuid primary key default gen_random_uuid(),
  source_key    text unique,                 -- facebook | x | telegram | google_news | ...
  display_name  text,
  category      text,
  connector_type text,
  status        text default 'active',
  supports_posts     boolean default true,
  supports_comments  boolean default false,
  supports_reactions boolean default false,
  supports_media     boolean default false,
  supports_historical boolean default false,
  supports_realtime  boolean default false,
  default_cost_model jsonb default '{}'::jsonb,
  configuration_schema_json jsonb default '{}'::jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── package ⇄ feature (spec §10) ─────────────────────────────────────────────
create table if not exists package_features (
  id          uuid primary key default gen_random_uuid(),
  package_id  uuid references packages(id) on delete cascade,
  feature_id  uuid references feature_catalog(id) on delete cascade,
  enabled     boolean default true,
  limit_json  jsonb default '{}'::jsonb,
  created_at  timestamptz default now(),
  unique (package_id, feature_id)
);

-- ── package ⇄ source (spec §10) ──────────────────────────────────────────────
create table if not exists package_sources (
  id          uuid primary key default gen_random_uuid(),
  package_id  uuid references packages(id) on delete cascade,
  source_id   uuid references source_catalog(id) on delete cascade,
  enabled     boolean default true,
  limit_json  jsonb default '{}'::jsonb,
  created_at  timestamptz default now(),
  unique (package_id, source_id)
);

-- ── organization ⇄ feature override (spec §11) ──────────────────────────────
create table if not exists organization_features (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  feature_id      uuid references feature_catalog(id) on delete cascade,
  feature_key     text,                       -- denormalized for fast lookup
  enabled         boolean default true,
  access_mode     text default 'inherited_from_package',
  configuration_json jsonb default '{}'::jsonb,
  override_reason text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (organization_id, feature_key)
);
create index if not exists idx_orgfeat_org on organization_features(organization_id);

-- ── organization ⇄ source assignment (spec §7) ──────────────────────────────
create table if not exists organization_sources (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  source_id       uuid references source_catalog(id) on delete cascade,
  source_key      text,
  enabled         boolean default true,
  access_level    text default 'standard',
  collection_mode text default 'scheduled',   -- scheduled | near_realtime | realtime | manual | crisis_mode
  refresh_interval_minutes integer default 60,
  daily_record_limit    integer,
  monthly_record_limit  integer,
  daily_cost_cap        numeric,
  monthly_cost_cap      numeric,
  historical_days       integer default 0,
  comments_enabled  boolean default false,
  media_enabled     boolean default false,
  realtime_enabled  boolean default false,
  configuration_json jsonb default '{}'::jsonb,
  approved_by     uuid,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (organization_id, source_key)
);
create index if not exists idx_orgsrc_org on organization_sources(organization_id);
