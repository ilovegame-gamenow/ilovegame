-- 編集室の設定。既存の公開・収集動作は初期値20件で維持する。
create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  public_page_size integer not null default 20 check (public_page_size between 1 and 100),
  nintendo_limit integer not null default 20 check (nintendo_limit between 0 and 100),
  playstation_limit integer not null default 20 check (playstation_limit between 0 and 100),
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
revoke all on public.site_settings from public, anon, authenticated;
grant select, update on public.site_settings to service_role;
insert into public.site_settings (id) values (1);
