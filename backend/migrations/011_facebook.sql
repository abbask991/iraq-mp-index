-- Facebook intelligence layer — persistent storage so the platform can rank
-- pages, detect viral posts, fingerprint page behavior (DNA), cluster pages,
-- and (later) trace cross-platform journeys. Everything is best-effort: the
-- live snapshots keep working without these tables; apply this to accumulate
-- history (trends / DNA / admin-behavior / journey all REQUIRE accumulated rows).

-- ── posts ──────────────────────────────────────────────────────────────────
create table if not exists facebook_posts (
  id                bigint generated always as identity primary key,
  platform          text default 'facebook',
  page_id           text,
  page_name         text,
  post_id           text unique,                 -- stable id from Apify (postId/url hash)
  post_url          text,
  post_text         text,
  post_type         text,                        -- status | photo | video | link | reel
  created_at        timestamptz,                 -- when the POST was published
  reactions_like    int default 0,
  reactions_love    int default 0,
  reactions_care    int default 0,
  reactions_haha    int default 0,
  reactions_wow     int default 0,
  reactions_sad     int default 0,
  reactions_angry   int default 0,
  reactions_total   int default 0,
  comments_count    int default 0,
  shares_count      int default 0,
  -- derived intelligence (filled by analyzers; nullable until computed)
  reaction_mood     int,                         -- Reaction Mood Score 0..100
  sentiment         text,                        -- إيجابي | سلبي | محايد | مختلط
  dominant_emotion  text,                         -- anger | sadness | ridicule | love | shock ...
  topic             text,
  narrative         text,
  related_entity    text,
  risk_level        text,                        -- منخفض | متوسط | مرتفع | حرج
  media_url         text,
  comments_json     jsonb,                       -- inline topComments snapshot (free)
  raw_json          jsonb,
  collected_at      timestamptz default now()    -- when WE scraped it (for trends/velocity)
);
create index if not exists fb_posts_page_idx     on facebook_posts (page_name, created_at desc);
create index if not exists fb_posts_collected_idx on facebook_posts (collected_at desc);
create index if not exists fb_posts_engagement_idx on facebook_posts ((reactions_total + comments_count + shares_count) desc);

-- ── comments (stored separately when available) ──────────────────────────────
create table if not exists facebook_comments (
  id              bigint generated always as identity primary key,
  post_id         text,                          -- FK → facebook_posts.post_id
  page_name       text,
  comment_id      text unique,
  author_name     text,
  author_id       text,                          -- often unavailable from Apify
  text            text,
  created_at      timestamptz,
  reaction_count  int default 0,
  sentiment       text,                          -- إيجابي | سلبي | محايد
  emotion         text,                          -- anger | sarcasm | sympathy ...
  opinion_type    text,                          -- complaint | praise | question | demand | accusation | suggestion
  raw_json        jsonb,
  collected_at    timestamptz default now()
);
create index if not exists fb_comments_post_idx on facebook_comments (post_id);
create index if not exists fb_comments_page_idx on facebook_comments (page_name, created_at desc);

-- ── page registry (curated list + cached DNA / ranking) ──────────────────────
create table if not exists facebook_pages (
  page_name        text primary key,            -- the slug/handle we monitor
  display_name     text,
  page_id          text,
  category         text,                         -- news | personality | party | religious | candidate
  political_lean   text,                         -- "likely aligned with ..." (never asserted as fact)
  country          text default 'IQ',
  followers        int,
  influence_score  int,                          -- Facebook Page Influence Score 0..100
  dna              jsonb,                        -- fingerprint (topics, posting profile, reaction profile ...)
  cluster_id       text,                         -- assigned by community_detector
  first_seen       timestamptz default now(),
  last_collected   timestamptz,
  meta             jsonb default '{}'
);

alter table facebook_posts    enable row level security;
alter table facebook_comments enable row level security;
alter table facebook_pages    enable row level security;
