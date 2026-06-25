-- Archive X author profiles into mentions so long-range bot-detection and
-- influence analysis can run from our OWN growing data (not just live 7-day X).
-- After running this, set ARCHIVE_AUTHORS=1 on the backend to start populating.
alter table mentions add column if not exists author_followers int;
alter table mentions add column if not exists author_created   text;   -- account creation date
alter table mentions add column if not exists author_bot       int;    -- 0-100 bot score at capture
create index if not exists mentions_author_idx on mentions (author);
