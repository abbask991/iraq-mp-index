-- Narrative War Room persistence (Narrative Memory). Optional — the product runs
-- from Redis SWR cache today; apply this to remember every narrative forever and
-- answer historical questions (every narrative vs an entity, fastest to trend…).

create table if not exists narratives (
  id           bigint generated always as identity primary key,
  slug         text unique,
  label        text,
  type         text,
  dominance    int,
  threat_level text,
  posts        int,
  sentiment    text,
  keywords     jsonb default '[]',
  entities     jsonb default '[]',
  first_seen   timestamptz default now(),
  created_at   timestamptz default now()
);
create index if not exists narratives_created_idx on narratives (created_at desc);
create index if not exists narratives_entities_idx on narratives using gin (entities);

create table if not exists narrative_posts (
  id           bigint generated always as identity primary key,
  narrative_id text,
  post_id      text,
  platform     text,
  author       text,
  sentiment    text,
  created_at   timestamptz default now()
);
create index if not exists narrative_posts_idx on narrative_posts (narrative_id);

create table if not exists narrative_entities (
  id           bigint generated always as identity primary key,
  narrative_id text,
  entity       text,
  role         text,                          -- benefits | harmed | supports | opposes
  confidence   int,
  created_at   timestamptz default now()
);
create index if not exists narrative_entities_idx on narrative_entities (narrative_id);

create table if not exists narrative_campaigns (
  id           bigint generated always as identity primary key,
  narrative_id text,
  hashtag      text,
  coordination_score int,
  created_at   timestamptz default now()
);

create table if not exists narrative_history (
  id           bigint generated always as identity primary key,
  narrative_id text,
  window       text,
  dominant     text,
  share        int,
  event        text,                          -- birth | growth | split | merge | decline | death
  snapshot     jsonb default '{}',
  created_at   timestamptz default now()
);
create index if not exists narrative_history_idx on narrative_history (narrative_id, created_at);

create table if not exists narrative_dna (
  narrative_id text primary key,
  label        text,
  dna          jsonb default '{}',
  updated_at   timestamptz default now()
);

create table if not exists narrative_predictions (
  id           bigint generated always as identity primary key,
  narrative_id text,
  generated_at timestamptz default now(),
  growth_probability int,
  tv_probability int,
  escalation_probability int,
  expected_reach bigint,
  confidence   int,
  meta         jsonb default '{}'
);
create index if not exists narrative_predictions_idx on narrative_predictions (narrative_id, generated_at desc);

alter table narratives enable row level security;
alter table narrative_posts enable row level security;
alter table narrative_entities enable row level security;
alter table narrative_campaigns enable row level security;
alter table narrative_history enable row level security;
alter table narrative_dna enable row level security;
alter table narrative_predictions enable row level security;
