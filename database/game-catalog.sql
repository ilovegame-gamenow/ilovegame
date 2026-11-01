-- Phase 2 foundation. Apply once after review; never run automatically at startup.
-- Additive only: existing articles, drafts, views and policies are unchanged.
begin;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  original_title text,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- A title is deliberately NOT unique: namesakes, localizations and remakes exist.

create table public.game_platforms (
  code text primary key check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (btrim(name) <> '')
);

create table public.game_sources (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete restrict,
  url text not null check (url ~ '^https?://[^[:space:]]+$'),
  source_type text not null check (source_type in ('official', 'store', 'media', 'community')),
  review_status text not null default 'pending' check (review_status in ('pending', 'verified', 'rejected')),
  observed_at timestamptz not null default now(),
  verified_at timestamptz,
  notes text not null default '',
  unique (game_id, url),
  unique (game_id, id),
  check ((review_status = 'verified') = (verified_at is not null))
);

create table public.game_external_ids (
  provider text not null check (provider ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  external_id text not null check (btrim(external_id) <> ''),
  game_id uuid not null references public.games(id) on delete restrict,
  primary key (provider, external_id)
);
create index game_external_ids_game_idx on public.game_external_ids (game_id);
-- Multiple store editions can refer to one work. Same provider/id cannot identify two works.

create table public.game_releases (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete restrict,
  platform_code text not null references public.game_platforms(code) on delete restrict,
  region_code text not null check (region_code ~ '^([A-Z]{2}|WW)$'),
  release_kind text not null default 'full' check (release_kind in ('full', 'early_access')),
  status text not null default 'announced' check (status in ('announced', 'released', 'delayed', 'cancelled')),
  release_date date,
  date_precision text not null default 'unknown' check (date_precision in ('day', 'month', 'year', 'unknown')),
  release_label text not null default '',
  source_id uuid not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, platform_code, region_code, release_kind),
  foreign key (game_id, source_id) references public.game_sources(game_id, id) on delete restrict,
  check (
    (date_precision = 'unknown' and release_date is null) or
    (date_precision <> 'unknown' and release_date is not null and isfinite(release_date)
      and release_date between date '1900-01-01' and date '9999-12-31'
      and (date_precision = 'day' or
        (date_precision = 'month' and extract(day from release_date) = 1) or
        (date_precision = 'year' and extract(month from release_date) = 1 and extract(day from release_date) = 1)))
  )
);
create index game_releases_platform_idx on public.game_releases (platform_code);
create index game_releases_source_idx on public.game_releases (game_id, source_id);
create index game_releases_calendar_idx on public.game_releases (region_code, release_date, id)
  where date_precision = 'day' and verified_at is not null and status in ('announced', 'released');

create table public.article_games (
  article_id bigint not null references public.articles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (article_id, game_id)
);
create index article_games_game_idx on public.article_games (game_id, article_id);

create function public.touch_game_catalog_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.touch_game_catalog_updated_at() from public, anon, authenticated;
create trigger games_updated_at before update on public.games
  for each row execute function public.touch_game_catalog_updated_at();
create trigger game_releases_updated_at before update on public.game_releases
  for each row execute function public.touch_game_catalog_updated_at();

-- First slice is server-only. No browser access or public SELECT policy yet.
alter table public.games enable row level security;
alter table public.game_platforms enable row level security;
alter table public.game_sources enable row level security;
alter table public.game_external_ids enable row level security;
alter table public.game_releases enable row level security;
alter table public.article_games enable row level security;
revoke all on public.games, public.game_platforms, public.game_sources,
  public.game_external_ids, public.game_releases, public.article_games from public, anon, authenticated;
grant select, insert, update, delete on public.games, public.game_platforms, public.game_sources,
  public.game_external_ids, public.game_releases, public.article_games to service_role;

insert into public.game_platforms (code, name) values
  ('switch', 'Nintendo Switch'), ('switch-2', 'Nintendo Switch 2'),
  ('ps4', 'PlayStation 4'), ('ps5', 'PlayStation 5'),
  ('xbox-one', 'Xbox One'), ('xbox-series', 'Xbox Series X|S'),
  ('windows', 'Windows'), ('macos', 'macOS'), ('linux', 'Linux'),
  ('ios', 'iOS'), ('android', 'Android');

commit;
