-- مركز الرصد — Intelligence schema (run in Supabase SQL editor).
-- Idempotent (IF NOT EXISTS). PostgreSQL-only; no ClickHouse/OpenSearch yet.
-- Search scaling stays in Postgres: full-text (tsvector) + trigram + GIN.

create extension if not exists pg_trgm;

-- ============================================================
-- Stored mentions (raw posts) — enables FTS / trigram / analytics.
-- Live fetching still works; this is the durable layer jobs write to.
-- ============================================================
create table if not exists mentions (
  id           bigint generated always as identity primary key,
  external_id  text,
  platform     text not null default 'x',          -- x | telegram | news
  source       text,                               -- outlet / channel / @handle
  source_id    text,
  entity_id    text,                               -- resolved canonical entity
  author       text,
  text         text not null default '',
  sentiment    text,                               -- إيجابي | محايد | سلبي
  emotion      text,                               -- anger | fear | ...
  hashtags     text[] default '{}',
  links        text[] default '{}',
  engagement   int default 0,
  owner        uuid,
  created_at   timestamptz,
  inserted_at  timestamptz not null default now(),
  fts          tsvector generated always as (to_tsvector('simple', coalesce(text, ''))) stored
);
create unique index if not exists mentions_external_uniq on mentions (platform, external_id) where external_id is not null;
create index if not exists mentions_created_idx   on mentions (created_at desc);
create index if not exists mentions_platform_idx  on mentions (platform);
create index if not exists mentions_entity_idx    on mentions (entity_id);
create index if not exists mentions_source_idx    on mentions (source_id);
create index if not exists mentions_sentiment_idx on mentions (sentiment);
create index if not exists mentions_hashtags_gin  on mentions using gin (hashtags);
create index if not exists mentions_fts_gin       on mentions using gin (fts);
create index if not exists mentions_text_trgm     on mentions using gin (text gin_trgm_ops);

-- ============================================================
-- Entities + aliases + relationships (knowledge graph)
-- ============================================================
create table if not exists entities (
  id         text primary key,                     -- canonical id, e.g. 'sudani'
  canonical  text,
  type       text default 'entity',                -- politician | party | ministry | ...
  meta       jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists entities_canon_trgm on entities using gin (canonical gin_trgm_ops);

create table if not exists entity_aliases (
  id         bigint generated always as identity primary key,
  entity_id  text references entities(id) on delete cascade,
  alias      text not null,
  canonical  text,
  type       text,
  created_at timestamptz default now(),
  unique (entity_id, alias)
);
create index if not exists entity_aliases_alias_trgm on entity_aliases using gin (alias gin_trgm_ops);

create table if not exists entity_relationships (
  id            bigint generated always as identity primary key,
  edge_key      text unique,                        -- source|target|relation
  source_id     text not null,
  target_id     text not null,
  relation_type text not null,                      -- co_mention | amplifies | uses_hashtag | ...
  weight        numeric default 1,
  evidence      jsonb default '{}',
  created_at    timestamptz default now()
);
create index if not exists rel_source_idx on entity_relationships (source_id);
create index if not exists rel_target_idx on entity_relationships (target_id);
create index if not exists rel_type_idx   on entity_relationships (relation_type);

-- ============================================================
-- Campaigns + campaign DNA
-- ============================================================
create table if not exists campaigns (
  id          text primary key,
  owner       uuid,
  topic       text,
  score       int,
  alert_level text,
  status      text default 'open',
  summary     jsonb default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists campaigns_owner_idx on campaigns (owner);
create index if not exists campaigns_created_idx on campaigns (created_at desc);

create table if not exists campaign_dna (
  campaign_id text primary key references campaigns(id) on delete cascade,
  owner       uuid,
  topic       text,
  score       int,
  dna         jsonb not null,
  created_at  timestamptz default now()
);

-- ============================================================
-- Timeline events
-- ============================================================
create table if not exists timeline_events (
  id          bigint generated always as identity primary key,
  target_type text not null,                        -- entity | campaign | hashtag | narrative
  target_id   text not null,
  event_type  text not null,
  at          timestamptz,
  meta        jsonb default '{}',
  created_at  timestamptz default now()
);
create index if not exists timeline_target_idx on timeline_events (target_type, target_id, at);

-- ============================================================
-- Precomputed analytics tables (written by jobs / cron)
-- ============================================================
create table if not exists topic_metrics_hourly (
  topic      text not null,
  hour       timestamptz not null,
  mentions   int default 0,
  pos        int default 0,
  neg        int default 0,
  neu        int default 0,
  velocity   numeric default 0,
  primary key (topic, hour)
);
create index if not exists tmh_hour_idx on topic_metrics_hourly (hour desc);

create table if not exists entity_metrics_daily (
  entity_id   text not null,
  day         date not null,
  mentions    int default 0,
  pos         int default 0,
  neg         int default 0,
  neu         int default 0,
  media_index int,
  sov         numeric,
  primary key (entity_id, day)
);
create index if not exists emd_day_idx on entity_metrics_daily (day desc);

create table if not exists campaign_metrics (
  campaign_id text not null,
  hour        timestamptz not null,
  posts       int default 0,
  accounts    int default 0,
  score       int,
  primary key (campaign_id, hour)
);

create table if not exists source_metrics (
  source_id  text not null,
  day        date not null,
  mentions   int default 0,
  pos        int default 0,
  neg        int default 0,
  neu        int default 0,
  primary key (source_id, day)
);

create table if not exists platform_metrics (
  platform   text not null,
  hour       timestamptz not null,
  mentions   int default 0,
  pos        int default 0,
  neg        int default 0,
  neu        int default 0,
  primary key (platform, hour)
);

create table if not exists emotion_metrics (
  target_type  text not null,                       -- entity | topic
  target_id    text not null,
  day          date not null,
  anger int default 0, fear int default 0, trust int default 0, joy int default 0,
  sadness int default 0, frustration int default 0, disgust int default 0, sarcasm int default 0,
  primary key (target_type, target_id, day)
);

create table if not exists source_weights (
  source_id  text primary key,
  name       text,
  credibility numeric default 0.5,                  -- 0..1 editorial trust
  reach       int default 0,
  bias        text,
  updated_at timestamptz default now()
);

-- ============================================================
-- AI cache + job runs
-- ============================================================
create table if not exists ai_cache (
  key        text primary key,                      -- promptVersion:model:sha1(prompt)
  model      text,
  value      jsonb,
  created_at timestamptz default now()
);

create table if not exists job_runs (
  id         text primary key,
  status     text,                                  -- queued | running | done | failed
  kind       text,
  target     text,
  ts         bigint,
  meta       jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists job_runs_created_idx on job_runs (created_at desc);

-- ============================================================
-- Alert history (dedup + severity + cooldown + escalation)
-- ============================================================
create table if not exists alert_history (
  id          bigint generated always as identity primary key,
  owner       uuid,
  monitor_id  text,
  fingerprint text,
  type        text,
  severity    text,                                 -- info | watch | yellow | orange | red
  message     text,
  escalated   boolean default false,
  created_at  timestamptz default now()
);
create index if not exists alert_history_owner_idx on alert_history (owner, created_at desc);
create index if not exists alert_history_fp_idx    on alert_history (fingerprint, created_at desc);

-- ============================================================
-- Materialized views for dashboards (refresh from cron)
-- ============================================================
create materialized view if not exists mv_entity_daily as
  select entity_id,
         date_trunc('day', created_at) as day,
         count(*)                                        as mentions,
         count(*) filter (where sentiment = 'إيجابي')    as pos,
         count(*) filter (where sentiment = 'سلبي')      as neg,
         count(*) filter (where sentiment = 'محايد')     as neu
  from mentions
  where entity_id is not null and created_at is not null
  group by entity_id, date_trunc('day', created_at);
create unique index if not exists mv_entity_daily_pk on mv_entity_daily (entity_id, day);

create materialized view if not exists mv_topic_hourly as
  select unnest(hashtags) as topic,
         date_trunc('hour', created_at) as hour,
         count(*) as mentions
  from mentions
  where created_at is not null
  group by unnest(hashtags), date_trunc('hour', created_at);
create unique index if not exists mv_topic_hourly_pk on mv_topic_hourly (topic, hour);

-- Refresh (run periodically):
--   refresh materialized view concurrently mv_entity_daily;
--   refresh materialized view concurrently mv_topic_hourly;
