-- Public article content and private thumbnail candidates are independent.
-- The public projection explicitly filters published/complete articles and masks unapproved images.
begin;
create or replace view public.published_articles
with (security_invoker=false, security_barrier=true) as
select a.id,a.title,a.game_title,a.summary,a.ilovegame_point,a.platforms,a.category,
  case when r.decision='confirmed' and r.verified_at is not null and nullif(btrim(r.rights_url),'') is not null
    and (r.expires_at is null or r.expires_at>now())
    and r.usage_scope->'thumbnail'='true'::jsonb
    and case when a.thumbnail_url like 'https://ilovegame.vercel.app/%' then r.usage_scope->'local_save'='true'::jsonb
             else r.usage_scope->'hotlink'='true'::jsonb end
    and coalesce(r.usage_scope->'website_republication','true'::jsonb) <> 'false'::jsonb
    then a.thumbnail_url else null end as thumbnail_url,
  a.source_name,a.source_url,a.source_published_at,a.importance,a.is_breaking,a.status,a.published_at,a.created_at,a.updated_at,a.source_title,a.article_body,a.processing_status,a.site_published_at,a.manually_reviewed,a.editor_regenerated_at,a.editor_regenerated_saved_at
from public.articles a left join public.article_image_rights r on r.article_id=a.id and r.thumbnail_url=a.thumbnail_url
where a.status='published' and nullif(trim(a.title),'') is not null and nullif(trim(a.summary),'') is not null
  and nullif(trim(a.article_body),'') is not null and nullif(trim(a.ilovegame_point),'') is not null
  and (a.processing_status='completed' or (a.editor_regenerated_at is not null and a.editor_regenerated_saved_at is not null and a.editor_regenerated_saved_at>=a.editor_regenerated_at));
-- Deny direct candidate reads: the filtered view is the public read interface.
revoke select on public.articles from anon, authenticated, public;
revoke select (thumbnail_url) on public.articles from anon, authenticated, public;
grant select on public.published_articles to anon, authenticated, service_role;
commit;
