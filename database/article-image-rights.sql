-- Editorial-only thumbnail rights. No changes to articles or publication rules.
create table public.article_image_rights (
  article_id bigint primary key references public.articles(id) on delete cascade,
  thumbnail_url text not null check(length(thumbnail_url) between 1 and 8192),
  source_url text,
  original_image_url text,
  rights_url text,
  rights_holder text,
  credit text,
  decision text not null default 'pending' check(decision in ('pending','confirmed','blocked')),
  usage_scope jsonb not null default '{}'::jsonb check(jsonb_typeof(usage_scope)='object'),
  verified_at timestamptz,
  expires_at timestamptz,
  reviewed_by text,
  notes text,
  updated_at timestamptz not null default now(),
  check(decision='pending' or (nullif(btrim(rights_url),'') is not null and verified_at is not null))
);
alter table public.article_image_rights enable row level security;
revoke all on public.article_image_rights from public, anon, authenticated;
grant select, insert, update, delete on public.article_image_rights to service_role;

create view public.editor_article_image_rights with (security_invoker=true) as
select a.id,a.title,a.summary,a.thumbnail_url,a.source_name,a.platforms,a.created_at,
       a.published_at,a.status,a.importance,a.processing_status,a.manually_reviewed,
       a.site_published_at,a.source_url,a.article_body,a.ilovegame_point,a.source_published_at,a.category,
       case when r.article_id is null or (r.expires_at is not null and r.expires_at<=now())
            then 'pending' else r.decision end as image_rights_status,
       case when r.article_id is null then '現在の画像に対する確認記録なし'
            when r.expires_at is not null and r.expires_at<=now() then '利用条件の確認期限切れ'
            else r.notes end as image_rights_note,
       r.source_url as image_rights_source_url,r.original_image_url as image_rights_original_url,
       r.rights_url as image_rights_evidence_url,r.rights_holder as image_rights_holder,
       r.credit as image_rights_credit,r.usage_scope as image_rights_scope,
       r.verified_at as image_rights_verified_at,r.expires_at as image_rights_expires_at
from public.articles a left join public.article_image_rights r
  on r.article_id=a.id and r.thumbnail_url=a.thumbnail_url;
revoke all on public.editor_article_image_rights from public, anon, authenticated;
grant select on public.editor_article_image_rights to service_role;
