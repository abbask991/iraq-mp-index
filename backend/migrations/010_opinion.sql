-- PPOI opinion snapshots — every public-opinion build stores a snapshot so Opinion
-- Drift can track change over time (sudden shift / slow erosion / recovery).

create table if not exists opinion_snapshots (
  id          bigint generated always as identity primary key,
  target      text not null,
  poi         int,                            -- public opinion index 0-100
  pressure    int,                            -- public pressure index 0-100
  support_pct int,
  oppose_pct  int,
  confidence  int,
  created_at  timestamptz default now()
);
create index if not exists opinion_snapshots_idx on opinion_snapshots (target, created_at desc);

alter table opinion_snapshots enable row level security;
