-- Visual Verification / Image Intelligence (كشف الصور والتزييف). Best-effort storage:
-- the feature works without these tables (results just aren't persisted); apply to
-- keep history, enable search-by-hash, and link images to campaigns/narratives/entities.

create table if not exists visual_verifications (
  id                 text primary key,            -- vv_<hash>
  user_id            text,
  image_url          text,
  image_hash         text,                         -- average hash
  perceptual_hash    text,                         -- dhash/phash
  uploaded_at        timestamptz default now(),
  status             text,                         -- original|old_image|misleading|manipulated|ai_generated|uncertain|needs_review
  overall_risk_score int,
  confidence_score   int,
  summary            text,
  first_seen_date    text,
  first_seen_source  text,
  metadata_json      jsonb,
  forensics_json     jsonb,
  ai_detection_json  jsonb,
  context_json       jsonb,
  reverse_search_json jsonb,
  evidence_json      jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists vv_phash_idx on visual_verifications (perceptual_hash);
create index if not exists vv_created_idx on visual_verifications (created_at desc);

create table if not exists visual_matches (
  id               bigint generated always as identity primary key,
  verification_id  text,
  matched_image_url text,
  matched_page_url text,
  source           text,
  title            text,
  first_seen_date  text,
  similarity_score int,
  provider         text,
  metadata_json    jsonb,
  created_at       timestamptz default now()
);
create index if not exists vm_vid_idx on visual_matches (verification_id);

create table if not exists visual_evidence (
  id               bigint generated always as identity primary key,
  verification_id  text,
  evidence_type    text,
  source_url       text,
  description      text,
  confidence       text,
  created_at       timestamptz default now()
);
create index if not exists ve_vid_idx on visual_evidence (verification_id);

create table if not exists image_campaign_links (
  id               bigint generated always as identity primary key,
  verification_id  text,
  campaign_id      text,
  narrative_id     text,
  entity_id        text,
  relationship_type text,
  confidence       text,
  created_at       timestamptz default now()
);
create index if not exists icl_vid_idx on image_campaign_links (verification_id);

alter table visual_verifications enable row level security;
alter table visual_matches       enable row level security;
alter table visual_evidence      enable row level security;
alter table image_campaign_links enable row level security;
