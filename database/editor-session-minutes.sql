alter table public.site_settings
  add column editor_session_minutes integer not null default 10
  check (editor_session_minutes in (5, 10, 30, 60));
