-- Unified Intelligence Fusion — one table for normalized posts from EVERY
-- platform (X, Instagram, TikTok, Facebook, YouTube, Reddit). This is the spine
-- of cross-platform fusion: query by entity/time across all platforms at once.

create table if not exists social_posts (
  id           bigint generated always as identity primary key,
  platform     text not null,                 -- x | instagram | tiktok | facebook | youtube | reddit
  post_id      text,
  entity       text,                          -- the monitored entity/topic this was collected for
  author       text,
  author_followers int default 0,
  text         text,
  url          text,
  likes        int default 0,
  comments     int default 0,
  shares       int default 0,
  views        bigint default 0,
  reach        bigint default 0,              -- normalized estimated reach (fusion.reach)
  sentiment    text,
  created_at   timestamptz,
  collected_at timestamptz default now(),
  unique (platform, post_id)
);
create index if not exists social_posts_entity_idx on social_posts (entity, collected_at desc);
create index if not exists social_posts_platform_idx on social_posts (platform, collected_at desc);
create index if not exists social_posts_created_idx on social_posts (created_at desc);

alter table social_posts enable row level security;
