-- Editorial provenance only. No article contents or publication state are changed.
begin;
create table public.article_discovery_context (
 article_id bigint primary key references public.articles(id) on delete cascade,
 channel text check(channel in ('news','discovery','favorite','manual')),
 trigger_reason text check(char_length(trigger_reason)<=2000),
 selection_reason text check(char_length(selection_reason)<=2000),
 evidence_url text check(char_length(evidence_url)<=2000 and evidence_url ~ '^https?://[^[:space:]]+$'),
 observed_at timestamptz not null default now()
);
alter table public.article_discovery_context enable row level security;
revoke all on public.article_discovery_context from public,anon,authenticated;
grant select,insert,update on public.article_discovery_context to service_role;
commit;
