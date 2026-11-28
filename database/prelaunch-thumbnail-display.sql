-- Temporary pre-launch thumbnail display. Restore public-thumbnail-rights.sql before formal launch.
begin;
create or replace view public.published_articles
with (security_invoker=false, security_barrier=true) as
select a.id,a.title,a.game_title,a.summary,a.ilovegame_point,a.platforms,a.category,
  case when r.decision='blocked'
    or (r.expires_at is not null and r.expires_at<=now())
    or r.usage_scope->'thumbnail'='false'::jsonb
    or r.usage_scope->'website_republication'='false'::jsonb
    or (a.thumbnail_url like 'https://ilovegame.vercel.app/%' and r.usage_scope->'local_save'='false'::jsonb)
    or (a.thumbnail_url not like 'https://ilovegame.vercel.app/%' and r.usage_scope->'hotlink'='false'::jsonb)
    then null else a.thumbnail_url end as thumbnail_url,
  a.source_name,a.source_url,a.source_published_at,a.importance,a.is_breaking,a.status,a.published_at,a.created_at,a.updated_at,a.source_title,a.article_body,a.processing_status,a.site_published_at,a.manually_reviewed,a.editor_regenerated_at,a.editor_regenerated_saved_at
from public.articles a left join public.article_image_rights r on r.article_id=a.id and r.thumbnail_url=a.thumbnail_url
where a.status='published' and nullif(trim(a.title),'') is not null and nullif(trim(a.summary),'') is not null
  and nullif(trim(a.article_body),'') is not null and nullif(trim(a.ilovegame_point),'') is not null
  and (a.processing_status='completed' or (a.editor_regenerated_at is not null and a.editor_regenerated_saved_at is not null and a.editor_regenerated_saved_at>=a.editor_regenerated_at));
commit;
