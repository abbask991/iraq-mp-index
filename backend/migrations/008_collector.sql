-- AICE Phase 1 — collector run history. Every collection run logs here so the
-- Collection Center dashboard and (later) adaptive/learning phases have data.
-- The platform runs without it (best-effort insert); apply to keep history.

create table if not exists collector_runs (
  id                  bigint generated always as identity primary key,
  kind                text,                       -- cron_overview | manual_refresh | entity | discovery
  started_at          timestamptz default now(),
  finished_at         timestamptz,
  duration_seconds    int,
  fetched_count       int default 0,              -- posts pulled from X
  inserted_count      int default 0,              -- posts kept/stored
  duplicate_count     int default 0,              -- removed by dedup
  cluster_count       int default 0,
  representative_count int default 0,             -- posts actually sent to AI
  ai_calls_saved      int default 0,              -- fetched - representatives
  x_quota_used        int default 0,
  errors              jsonb default '[]',
  meta                jsonb default '{}',
  created_at          timestamptz default now()
);
create index if not exists collector_runs_created_idx on collector_runs (created_at desc);
create index if not exists collector_runs_kind_idx on collector_runs (kind, created_at desc);

alter table collector_runs enable row level security;
