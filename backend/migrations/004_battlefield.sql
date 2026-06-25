-- Media Battlefield snapshot persistence (optional — the feature runs from the
-- Redis SWR cache today; apply this to keep historical battlefield snapshots for
-- "how is the battlefield changing over time").
create table if not exists battlefield_snapshots (
  id          bigint generated always as identity primary key,
  scope_type  text not null,                 -- entity | campaign | narrative | national
  scope_id    text not null,
  date_range  text,
  summary     text,
  risk_level  text,
  scores_json jsonb default '{}',
  graph_json  jsonb default '{}',
  created_at  timestamptz default now()
);
create index if not exists bf_snap_scope_idx on battlefield_snapshots (scope_type, scope_id, created_at desc);

create table if not exists battlefield_nodes (
  id             text primary key,
  entity_id      text,
  node_type      text,
  label          text,
  influence_score numeric,
  activity_level  int,
  risk_score      numeric,
  metadata_json   jsonb default '{}',
  created_at      timestamptz default now()
);

create table if not exists battlefield_edges (
  id             text primary key,
  source_node_id text,
  target_node_id text,
  relationship_type text,
  weight         numeric,
  confidence     text,
  sentiment      text,
  evidence_count int,
  first_seen     timestamptz,
  last_seen      timestamptz,
  evidence_json  jsonb default '{}',
  created_at     timestamptz default now()
);
create index if not exists bf_edge_src_idx on battlefield_edges (source_node_id);
create index if not exists bf_edge_tgt_idx on battlefield_edges (target_node_id);

alter table battlefield_snapshots enable row level security;
alter table battlefield_nodes enable row level security;
alter table battlefield_edges enable row level security;
