-- ════════════════════════════════════════════════════════════════════
-- 014 — PUBLIC ANGER INDEX (PAI) — مؤشر الغضب العام
-- First proprietary indicator of the Strategic Indices Lab.
-- All tables degrade gracefully: the module runs in demo/live mode without
-- persistence; these tables enable history, baselines and evidence storage.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public_anger_index_runs (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid,
  scope_type                text,        -- country | entity | issue | company | campaign | crisis
  scope_id                  text,
  scope_name                text,
  score                     numeric,
  risk_level                text,        -- Low | Moderate | High | Critical
  trend                     text,        -- rising | stable | declining | accelerating | cooling_down
  confidence_score          numeric,
  negative_sentiment_score  numeric,
  anger_emotion_score       numeric,
  complaint_volume_score    numeric,
  narrative_velocity_score  numeric,
  engagement_intensity_score numeric,
  protest_language_score    numeric,
  cross_platform_score      numeric,
  summary                   text,
  explanation               jsonb default '{}'::jsonb,
  started_at                timestamptz,
  completed_at              timestamptz,
  created_at                timestamptz default now()
);
create index if not exists idx_pai_scope on public_anger_index_runs(scope_type, scope_id, created_at desc);
create index if not exists idx_pai_org on public_anger_index_runs(org_id, created_at desc);

create table if not exists public_anger_drivers (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid references public_anger_index_runs(id) on delete cascade,
  driver_name       text,
  driver_type       text,
  contribution_score numeric,
  trend             text,
  volume            numeric,
  confidence_score  numeric,
  top_platforms_json jsonb default '[]'::jsonb,
  evidence_json     jsonb default '[]'::jsonb,
  created_at        timestamptz default now()
);
create index if not exists idx_pai_drivers_run on public_anger_drivers(run_id);

create table if not exists public_anger_narratives (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid references public_anger_index_runs(id) on delete cascade,
  narrative_id        text,
  narrative_title     text,
  narrative_summary   text,
  anger_intensity_score numeric,
  volume              numeric,
  velocity            numeric,
  confidence_score    numeric,
  top_entities_json   jsonb default '[]'::jsonb,
  top_platforms_json  jsonb default '[]'::jsonb,
  evidence_json       jsonb default '[]'::jsonb,
  created_at          timestamptz default now()
);
create index if not exists idx_pai_narr_run on public_anger_narratives(run_id);

create table if not exists public_anger_evidence (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid references public_anger_index_runs(id) on delete cascade,
  evidence_type text,       -- post | comment | article | hashtag | phrase | link
  platform      text,
  source_name   text,
  source_url    text,
  content_text  text,
  entity_id     text,
  narrative_id  text,
  anger_score   numeric,
  sentiment     text,
  emotion       text,
  engagement_json jsonb default '{}'::jsonb,
  timestamp     timestamptz,
  created_at    timestamptz default now()
);
create index if not exists idx_pai_evidence_run on public_anger_evidence(run_id);
