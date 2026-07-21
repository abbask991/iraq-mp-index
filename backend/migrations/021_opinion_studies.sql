-- ════════════════════════════════════════════════════════════════════
-- 021 — SURVEY & OPINION INTELLIGENCE (Sprint 1)
-- Extends surveys into "studies" (direct_survey | digital_opinion | hybrid),
-- adds the Facebook page catalog + saved panels, and generic cross-platform
-- source selection. Everything scoped by organization_id. Additive/idempotent.
-- ════════════════════════════════════════════════════════════════════

-- ── surveys → studies: mode + research framing ──────────────────────────────
alter table surveys add column if not exists study_mode      text default 'direct_survey';  -- direct_survey|digital_opinion|hybrid
alter table surveys add column if not exists research_question text;
alter table surveys add column if not exists geographic_scope text;
alter table surveys add column if not exists date_start       date;
alter table surveys add column if not exists date_end         date;
alter table surveys add column if not exists analysis_json    jsonb default '{}'::jsonb;      -- issues/entities/keywords/narratives for digital-opinion

-- ── Facebook page catalog (spec §4) ─────────────────────────────────────────
create table if not exists facebook_page_catalog (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  page_name          text not null,
  page_fb_id         text,
  page_url           text,
  category           text,                 -- government|ministry|party|politician|news_media|local_news|governorate|community|activist|influencer|company|public_service|research_center|other
  country            text,
  governorate        text,
  city               text,
  language           text default 'ar',
  affiliation        text,                 -- MANUAL only
  affiliation_confidence text,             -- low|medium|high
  affiliation_evidence text,
  audience_type      text,
  page_size          bigint,
  avg_engagement     numeric,
  credibility_score  numeric,
  collection_status  text default 'available',   -- available|blocked|unknown
  last_scan_at       timestamptz,
  historical_days    integer default 0,
  comments_available boolean default true,
  reactions_available boolean default true,
  est_cost_usd       numeric default 0,
  notes              text,
  tags               jsonb default '[]'::jsonb,
  created_by         uuid,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists idx_fbcat_org on facebook_page_catalog(organization_id);
create index if not exists idx_fbcat_cat on facebook_page_catalog(organization_id, category);
create index if not exists idx_fbcat_gov on facebook_page_catalog(organization_id, governorate);

-- ── saved Facebook page panels (spec §6) ────────────────────────────────────
create table if not exists facebook_page_panels (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  workspace_id     uuid,
  name             text not null,
  description      text,
  methodology_note text,
  page_count       integer default 0,
  created_by       uuid,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists idx_fbpanel_org on facebook_page_panels(organization_id);

create table if not exists facebook_page_panel_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  panel_id         uuid references facebook_page_panels(id) on delete cascade,
  facebook_page_id uuid references facebook_page_catalog(id) on delete cascade,
  priority         integer default 0,
  analytical_weight numeric default 1.0,
  comments_enabled boolean default true,
  reactions_enabled boolean default false,
  historical_days  integer default 0,
  include          boolean default true,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (panel_id, facebook_page_id)
);
create index if not exists idx_fbpm_panel on facebook_page_panel_members(panel_id);

-- ── generic cross-platform source selection per study (spec §11) ────────────
create table if not exists study_sources (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  study_id          uuid references surveys(id) on delete cascade,
  source_id         uuid,
  platform          text,          -- facebook|x|telegram|tiktok|instagram|youtube|google_reviews|google_news|rss|news_websites
  enabled           boolean default true,
  priority          integer default 0,
  analytical_weight numeric default 1.0,
  collection_mode   text default 'standard',   -- light|standard|deep|crisis
  historical_days   integer default 0,
  comments_enabled  boolean default false,
  reactions_enabled boolean default false,
  media_enabled     boolean default false,
  refresh_interval_minutes integer default 60,
  record_limit      integer,
  cost_cap          numeric,
  configuration_json jsonb default '{}'::jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (study_id, platform)
);
create index if not exists idx_studysrc_study on study_sources(study_id);

create table if not exists study_source_targets (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  study_id           uuid references surveys(id) on delete cascade,
  study_source_id    uuid references study_sources(id) on delete cascade,
  target_type        text,   -- facebook_page|x_account|telegram_channel|tiktok_account|instagram_account|youtube_channel|news_website|rss_feed|google_review_location|keyword|hashtag
  target_external_id text,
  target_name        text,
  target_url         text,
  include            boolean default true,
  priority           integer default 0,
  analytical_weight  numeric default 1.0,
  metadata_json      jsonb default '{}'::jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists idx_studytgt_study on study_source_targets(study_id);
create index if not exists idx_studytgt_src on study_source_targets(study_source_id);
