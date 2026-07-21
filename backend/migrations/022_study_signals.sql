-- ════════════════════════════════════════════════════════════════════
-- 022 — STUDY SIGNALS (Opinion Intelligence Sprint 3)
-- Normalized, classified digital-opinion content collected for a study
-- (spec §14). Every row org-scoped. These are OBSERVED DIGITAL SIGNALS —
-- never mixed with direct survey responses.
-- ════════════════════════════════════════════════════════════════════

create table if not exists study_signals (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  study_id         uuid references surveys(id) on delete cascade,
  platform         text,          -- google_news | telegram | facebook | x | ...
  source_target_id uuid,
  content_type     text,          -- opinion|complaint|demand|praise|question|news|other
  content_text     text,
  content_url      text,
  author_or_page   text,
  ts               timestamptz,
  language         text default 'ar',
  opinion_class    text,          -- support|oppose|neutral|mixed|unclear
  sentiment        text,          -- positive|negative|neutral
  emotion          text,          -- anger|frustration|sarcasm|...
  engagement       integer default 0,
  credibility_score numeric,
  quality_score    numeric,
  raw_payload      jsonb default '{}'::jsonb,
  created_at       timestamptz default now()
);
create index if not exists idx_signals_study on study_signals(study_id);
create index if not exists idx_signals_org on study_signals(organization_id);
create index if not exists idx_signals_platform on study_signals(study_id, platform);
