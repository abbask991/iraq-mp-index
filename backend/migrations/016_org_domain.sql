-- ════════════════════════════════════════════════════════════════════
-- 016 — CUSTOM DOMAIN → ORG (white-label entry point)
-- domain lets a client's own hostname (e.g. intel.client.com) resolve to
-- their org so the login page + app render THEIR brand before sign-in.
-- Stored lowercased, no protocol/port. NULL = no custom domain (default brand).
-- ════════════════════════════════════════════════════════════════════

alter table organizations add column if not exists domain text;
create unique index if not exists idx_org_domain on organizations(domain) where domain is not null;
