-- =============================================================================
-- MPII Community Platform — Supabase schema (Phase 1)
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- PHASE 1 PRINCIPLE: ratings & comments are COLLECTED and DISPLAYED only.
-- They do NOT feed the ranking score yet. The objective Python engine is the
-- single source of truth for scores until the anti-abuse pipeline is trusted.
-- =============================================================================

-- ---- MPs (identity only — scores live in the Python engine) ------------------
create table if not exists public.mps (
  id          int primary key,
  name        text not null,
  governorate text,
  bloc        text,
  committee   text,
  role        text default 'member',
  photo       text,
  facebook    text,
  x           text,
  instagram   text,
  telegram    text,
  website     text
);
alter table public.mps enable row level security;
create policy "mps are public" on public.mps for select using (true);

-- ---- User profiles (extends Supabase auth.users) ----------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles public read"   on public.profiles for select using (true);
create policy "own profile upsert"      on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update"      on public.profiles for update using (auth.uid() = id);

-- ---- Structured ratings (the ONLY thing that may later feed the 10% voter dim)
-- One rating per user per MP = the dedup gate.
create table if not exists public.ratings (
  id         bigint generated always as identity primary key,
  mp_id      int  not null references public.mps(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  stars      int  not null check (stars between 1 and 5),
  created_at timestamptz default now(),
  unique (mp_id, user_id)
);
alter table public.ratings enable row level security;
create policy "ratings public read"     on public.ratings for select using (true);
create policy "insert own rating"        on public.ratings for insert with check (auth.uid() = user_id);
create policy "update own rating"        on public.ratings for update using (auth.uid() = user_id);

-- ---- Free-text comments (DISPLAY ONLY, moderated, NEVER scored) --------------
create table if not exists public.comments (
  id         bigint generated always as identity primary key,
  mp_id      int  not null references public.mps(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 2 and 1000),
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);
alter table public.comments enable row level security;
-- public sees only approved comments; authors see their own (any status)
create policy "approved comments public" on public.comments
  for select using (status = 'approved' or auth.uid() = user_id);
create policy "insert own comment"       on public.comments
  for insert with check (auth.uid() = user_id and status = 'pending');

-- ---- Aggregate view for display (count + average) ---------------------------
-- The app shows the average ONLY past a quorum (see lib/scoreGate.ts).
create or replace view public.mp_rating_stats as
  select mp_id,
         count(*)                         as n_ratings,
         round(avg(stars)::numeric, 2)    as avg_stars
  from public.ratings
  group by mp_id;

-- =============================================================================
-- Phase 2 (later, NOT enabled now): phone-OTP identity, anomaly/abuse detection,
-- and a Bayesian aggregate that feeds the 10% voter dimension once n >= quorum.
-- =============================================================================
