-- Watchlist metadata on monitors (type / primary / order).
-- The Settings page currently stores these as per-device localStorage prefs (no
-- DB needed). Apply this when you want them synced across devices, then switch
-- lib/targets.ts to read/write these columns instead of localStorage.
alter table monitors add column if not exists type     text    default 'person';   -- person | institution
alter table monitors add column if not exists pinned   boolean default false;       -- the primary target
alter table monitors add column if not exists priority  int     default 100;        -- sort order
