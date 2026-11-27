-- Keep attempts independent from the article processing state. Internal only.
create table public.article_thumbnail_attempts (
  article_id bigint primary key references public.articles(id) on delete cascade,
  attempt_count integer check (attempt_count >= 0),
  last_attempt_at timestamptz,
  last_outcome text not null default 'unknown' check (last_outcome in ('unknown','retryable_failure','rights_review','exhausted','success')),
  last_failure_reason text,
  updated_at timestamptz not null default now()
);
alter table public.article_thumbnail_attempts enable row level security;
revoke all on public.article_thumbnail_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.article_thumbnail_attempts to service_role;
-- NULL means historical attempt count is unknown; never invent three attempts.
