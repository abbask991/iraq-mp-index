-- ════════════════════════════════════════════════════════════════════
-- 017 — PLATFORM PHASE 1: org expansion + RBAC + workspaces/projects + audit
-- Additive & idempotent. Builds on 013 (organizations, memberships),
-- 015 (org_type), 016 (domain). Nothing here is destructive.
-- ════════════════════════════════════════════════════════════════════

-- ── organizations: enterprise fields (spec §3) ──────────────────────────────
alter table organizations add column if not exists legal_name       text;
alter table organizations add column if not exists deployment_type  text default 'shared_saas';   -- shared_saas | dedicated_cloud | on_premise
alter table organizations add column if not exists country          text;
alter table organizations add column if not exists timezone         text default 'Asia/Baghdad';
alter table organizations add column if not exists default_locale   text default 'ar';
alter table organizations add column if not exists billing_status   text default 'trial';         -- trial | active | past_due | canceled
alter table organizations add column if not exists pilot_start_date date;
alter table organizations add column if not exists pilot_end_date   date;
alter table organizations add column if not exists updated_at       timestamptz default now();
-- status already exists (013). org_type already exists (015); its accepted
-- values are widened in code to the full spec §3 list.

-- ── memberships: richer RBAC role + status (spec §4) ────────────────────────
-- role column already exists (013). Values widened in code to the org-role set.
alter table memberships add column if not exists status     text default 'active';   -- invited | active | suspended
alter table memberships add column if not exists invited_by uuid;
alter table memberships add column if not exists invited_at timestamptz;

-- ── workspaces (spec §5) ────────────────────────────────────────────────────
create table if not exists organization_workspaces (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name            text not null,
  slug            text,
  workspace_type  text,
  status          text default 'active',
  created_by      uuid,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_ws_org on organization_workspaces(organization_id);

-- ── projects (spec §5) ──────────────────────────────────────────────────────
create table if not exists workspace_projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  workspace_id    uuid references organization_workspaces(id) on delete cascade,
  name            text not null,
  description     text,
  project_type    text,
  status          text default 'active',
  start_date      date,
  end_date        date,
  created_by      uuid,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_proj_ws  on workspace_projects(workspace_id);
create index if not exists idx_proj_org on workspace_projects(organization_id);

-- ── audit logs (spec §23) ───────────────────────────────────────────────────
create table if not exists audit_logs (
  id              bigserial primary key,
  organization_id uuid,
  actor_user_id   uuid,
  actor_email     text,
  action          text,               -- e.g. org.create | workspace.create | feature.toggle
  target          text,               -- what was acted on (id / key)
  previous_value  jsonb,
  new_value       jsonb,
  reason          text,
  ip              text,
  ts              timestamptz default now()
);
create index if not exists idx_audit_org_ts on audit_logs(organization_id, ts desc);
create index if not exists idx_audit_action on audit_logs(action);
