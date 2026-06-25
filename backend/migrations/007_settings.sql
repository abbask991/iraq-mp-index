-- System Settings + Audit Logs. The admin settings center reads DB-first and
-- falls back to env/defaults, so the platform runs without this table; apply it
-- to persist admin changes and keep a full audit trail.

create table if not exists system_settings (
  id          bigint generated always as identity primary key,
  key         text unique not null,          -- "category.field" (English)
  value_json  jsonb,                          -- {"v": <value>}; null = use default
  category    text,
  description text,
  updated_by  text,
  updated_at  timestamptz default now()
);
create index if not exists system_settings_cat_idx on system_settings (category);

create table if not exists system_audit_logs (
  id         bigint generated always as identity primary key,
  user_id    text,
  action     text,                            -- update | reset | test | login
  category   text,
  key        text,
  old_value  jsonb,
  new_value  jsonb,
  ip_address text,
  status     text default 'ok',
  created_at timestamptz default now()
);
create index if not exists system_audit_created_idx on system_audit_logs (created_at desc);

alter table system_settings enable row level security;
alter table system_audit_logs enable row level security;

-- keep updated_at fresh on upsert
create or replace function _touch_settings() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
drop trigger if exists trg_touch_settings on system_settings;
create trigger trg_touch_settings before update on system_settings
  for each row execute function _touch_settings();
