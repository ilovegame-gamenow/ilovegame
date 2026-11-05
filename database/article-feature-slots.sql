begin;
create table public.article_feature_slots (
 article_id bigint not null references public.articles(id) on delete cascade,
 slot text not null check(slot in ('breaking','discovery')),
 reason text not null check(char_length(btrim(reason)) between 1 and 2000),
 selected_at timestamptz not null default now(),
 expires_at timestamptz not null,
 primary key(article_id,slot),
 check(expires_at>selected_at)
);
alter table public.article_feature_slots enable row level security;
revoke all on public.article_feature_slots from public,anon,authenticated;
grant select,insert,update,delete on public.article_feature_slots to service_role;
create index article_feature_slots_expiry on public.article_feature_slots(expires_at);
commit;
