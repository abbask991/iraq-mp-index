-- ════════════════════════════════════════════════════════════════════
-- 020 — SURVEY STUDIO (Phase 1, Sprint 1A data foundation)
-- Research-grade multi-tenant survey system. Every table carries
-- organization_id (+ workspace/project on surveys) for strict isolation.
-- Additive & idempotent.
-- ════════════════════════════════════════════════════════════════════

create table if not exists surveys (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  workspace_id       uuid,
  project_id         uuid,
  created_by         uuid,
  title              text not null,
  internal_name      text,
  description        text,
  research_objective text,
  survey_type        text default 'standard_survey',
  status             text default 'draft',        -- draft|ready|scheduled|active|paused|closed|completed|archived
  language           text default 'ar',
  country            text,
  timezone           text default 'Asia/Baghdad',
  sampling_method    text,
  population_description text,
  population_size    bigint,
  desired_sample_size integer,
  anonymity_mode     text default 'anonymous',    -- anonymous|identified
  access_mode        text default 'public',       -- public|private|invitation_only
  public_token       text unique,
  starts_at          timestamptz,
  ends_at            timestamptz,
  published_at       timestamptz,
  closed_at          timestamptz,
  settings_json      jsonb default '{}'::jsonb,
  methodology_json   jsonb default '{}'::jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists idx_surveys_org on surveys(organization_id);
create index if not exists idx_surveys_ws on surveys(workspace_id);
create index if not exists idx_surveys_token on surveys(public_token);

create table if not exists survey_sections (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  survey_id       uuid references surveys(id) on delete cascade,
  title           text,
  description     text,
  position        integer default 0,
  is_randomized   boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_sections_survey on survey_sections(survey_id);

create table if not exists survey_questions (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null,
  survey_id            uuid references surveys(id) on delete cascade,
  section_id           uuid references survey_sections(id) on delete set null,
  question_key         text,
  question_type        text not null,
  title                text,
  description          text,
  required             boolean default false,
  position             integer default 0,
  validation_json      jsonb default '{}'::jsonb,
  display_settings_json jsonb default '{}'::jsonb,
  scoring_json         jsonb default '{}'::jsonb,
  randomization_json   jsonb default '{}'::jsonb,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);
create index if not exists idx_questions_survey on survey_questions(survey_id);

create table if not exists survey_question_options (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  survey_id       uuid references surveys(id) on delete cascade,
  question_id     uuid references survey_questions(id) on delete cascade,
  option_key      text,
  label           text,
  value           text,
  position        integer default 0,
  score           numeric,
  metadata_json   jsonb default '{}'::jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_options_question on survey_question_options(question_id);

create table if not exists survey_logic_rules (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  survey_id           uuid references surveys(id) on delete cascade,
  source_question_id  uuid,
  condition_operator  text,
  condition_value_json jsonb default '{}'::jsonb,
  action_type         text,       -- show_question|hide_question|jump_to_question|jump_to_section|end_survey|disqualify|set_variable|assign_segment
  target_question_id  uuid,
  target_section_id   uuid,
  action_value_json   jsonb default '{}'::jsonb,
  priority            integer default 0,
  enabled             boolean default true,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index if not exists idx_logic_survey on survey_logic_rules(survey_id);

create table if not exists survey_quotas (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  survey_id       uuid references surveys(id) on delete cascade,
  name            text,
  quota_type      text,
  target_count    integer default 0,
  current_count   integer default 0,
  conditions_json jsonb default '{}'::jsonb,
  action_when_full text default 'reject',   -- reject|disqualify|redirect|allow_but_flag|close_survey
  enabled         boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_quotas_survey on survey_quotas(survey_id);

create table if not exists survey_distributions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  survey_id       uuid references surveys(id) on delete cascade,
  channel         text,        -- public_link|private_link|qr|embed|interviewer
  public_token    text,
  short_url       text,
  qr_code_url     text,
  status          text default 'active',
  starts_at       timestamptz,
  ends_at         timestamptz,
  max_responses   integer,
  settings_json   jsonb default '{}'::jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_dist_survey on survey_distributions(survey_id);

create table if not exists survey_respondents (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  survey_id          uuid references surveys(id) on delete cascade,
  respondent_token   text,
  external_reference text,
  email_hash         text,
  phone_hash         text,
  device_hash        text,
  ip_hash            text,
  country            text,
  governorate        text,
  city               text,
  latitude           double precision,
  longitude          double precision,
  source_channel     text,
  consent_given      boolean default false,
  started_at         timestamptz,
  completed_at       timestamptz,
  status             text default 'started',   -- started|partial|completed|disqualified|quota_full|abandoned|rejected|flagged
  quality_score      numeric,
  fraud_risk_score   numeric,
  metadata_json      jsonb default '{}'::jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists idx_resp_survey on survey_respondents(survey_id);
create index if not exists idx_resp_token on survey_respondents(survey_id, respondent_token);
create index if not exists idx_resp_device on survey_respondents(survey_id, device_hash);

create table if not exists survey_responses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  survey_id       uuid references surveys(id) on delete cascade,
  respondent_id   uuid references survey_respondents(id) on delete cascade,
  question_id     uuid,
  answer_text     text,
  answer_number   numeric,
  answer_boolean  boolean,
  answer_date     timestamptz,
  answer_json     jsonb,
  response_time_ms integer,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_answers_survey on survey_responses(survey_id);
create index if not exists idx_answers_resp on survey_responses(respondent_id);
create index if not exists idx_answers_q on survey_responses(question_id);

create table if not exists survey_response_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  survey_id       uuid references surveys(id) on delete cascade,
  respondent_id   uuid,
  event_type      text,
  question_id     uuid,
  event_data_json jsonb default '{}'::jsonb,
  created_at      timestamptz default now()
);
create index if not exists idx_events_survey on survey_response_events(survey_id);

create table if not exists survey_versions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  survey_id       uuid references surveys(id) on delete cascade,
  version_number  integer default 1,
  snapshot_json   jsonb default '{}'::jsonb,
  published_at    timestamptz,
  created_by      uuid,
  created_at      timestamptz default now()
);
create index if not exists idx_versions_survey on survey_versions(survey_id);
