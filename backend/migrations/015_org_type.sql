-- ════════════════════════════════════════════════════════════════════
-- 015 — ORG TYPE (sector adaptation)
-- org_type lets one codebase adapt terminology, default modules and AI
-- framing to the client's sector without forking. Degrades to 'general'
-- (the neutral, current behaviour) when unset or pre-migration.
--   general | media | corporate | government | political
-- ════════════════════════════════════════════════════════════════════

alter table organizations add column if not exists org_type text default 'general';
