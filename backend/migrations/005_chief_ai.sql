-- AI Chief Intelligence Officer persistence (optional — runs from Redis cache
-- today; apply to keep history of briefs / Q&A / recommendations).
create table if not exists chief_ai_briefs (
  id           bigint generated always as identity primary key,
  generated_at timestamptz default now(),
  period       text,                          -- dashboard | daily | weekly | monthly
  summary      text,
  recommendations jsonb default '[]',
  risks        jsonb default '[]',
  opportunities jsonb default '[]',
  forecast     jsonb default '{}',
  confidence   int,
  created_by   uuid
);
create index if not exists chief_briefs_idx on chief_ai_briefs (period, generated_at desc);

create table if not exists chief_ai_questions (
  id        bigint generated always as identity primary key,
  question  text,
  answer    text,
  evidence  jsonb default '{}',
  owner     uuid,
  created_at timestamptz default now()
);

create table if not exists chief_ai_recommendations (
  id           bigint generated always as identity primary key,
  recommendation text,
  priority     text,
  confidence   int,
  evidence     text,
  status       text default 'open',
  target_entity text,
  expires_at   timestamptz,
  created_at   timestamptz default now()
);

alter table chief_ai_briefs enable row level security;
alter table chief_ai_questions enable row level security;
alter table chief_ai_recommendations enable row level security;
