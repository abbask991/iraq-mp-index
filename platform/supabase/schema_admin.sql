-- =============================================================================
-- MPII Platform — ADMIN schema (run AFTER schema.sql + seed_mps.sql)
-- Adds: admin role, app settings (news sources/keywords/hashtags), and
-- admin-only write access to MPs + settings.
-- =============================================================================

-- 1) admin flag on profiles
alter table public.profiles add column if not exists is_admin boolean default false;

-- 2) MPs: add the search_name column the news pipeline uses
alter table public.mps add column if not exists search_name text;

-- helper: is the current user an admin?
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin);
$$;

-- 3) key/value settings (news_sources, news_keywords, news_hashtags, …)
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);
alter table public.app_settings enable row level security;
create policy "settings public read" on public.app_settings for select using (true);
create policy "settings admin write" on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

insert into public.app_settings(key, value) values
  ('news_sources',  '[]'::jsonb),
  ('news_keywords', '[]'::jsonb),
  ('news_hashtags', '[]'::jsonb)
on conflict (key) do nothing;

-- 4) admins can edit MPs (photos, socials, search_name, names)
create policy "mps admin write" on public.mps for all
  using (public.is_admin()) with check (public.is_admin());

-- 5) admins can moderate comments
create policy "comments admin all" on public.comments for all
  using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- To make yourself admin after signing in once:
--   update public.profiles set is_admin = true where id =
--     (select id from auth.users where email = 'YOUR_EMAIL');
-- -----------------------------------------------------------------------------
