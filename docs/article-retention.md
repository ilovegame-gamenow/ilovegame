# 記事の自動整理

毎日03:15 JSTにDB内で実行。新規機能導入時点から既存記事の猶予を計算する。公開歴あり、処理未完了、保存済み下書きは除外。1回100件まで。設定OFFで停止し、既存タスクは変更しない。自動削除されたURLは非公開の記録に保持し再登録を防ぐ。削除は復元不能。

DB migration: `article_retention_guarded_cleanup`（適用済み）。

```sql
create extension if not exists pg_cron;
alter table public.site_settings
 add column auto_cleanup_enabled integer not null default 0 check(auto_cleanup_enabled in (0,1)),
 add column pending_retention_days integer not null default 7 check(pending_retention_days between 1 and 365),
 add column rejected_retention_days integer not null default 7 check(rejected_retention_days between 1 and 365);
alter table public.articles add column retention_since timestamptz not null default now(),
 add column retention_ever_published boolean not null default false;
update public.articles set retention_ever_published=true where status='published' or published_at is not null or site_published_at is not null;
create schema article_retention;
revoke all on schema article_retention from public, anon, authenticated;
grant usage on schema article_retention to service_role;
create table article_retention.deleted_sources(source_url text primary key, article_id bigint not null, deleted_at timestamptz not null default now());
alter table article_retention.deleted_sources enable row level security;
grant select on article_retention.deleted_sources to service_role;
create function article_retention.track_state() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if exists(select 1 from article_retention.deleted_sources where source_url=new.source_url) then return null; end if;
  new.retention_since=now();
  new.retention_ever_published=(new.status='published' or new.published_at is not null or new.site_published_at is not null);
 else
  if new.status is distinct from old.status or new.processing_status is distinct from old.processing_status then new.retention_since=now(); else new.retention_since=old.retention_since; end if;
  new.retention_ever_published=old.retention_ever_published or old.status='published' or new.status='published' or old.published_at is not null or new.published_at is not null or old.site_published_at is not null or new.site_published_at is not null;
 end if;
 return new;
end $$;
revoke all on function article_retention.track_state() from public,anon,authenticated;
grant execute on function article_retention.track_state() to service_role;
create trigger article_retention_state before insert or update on public.articles for each row execute function article_retention.track_state();
create function article_retention.run_cleanup(p_preview boolean default true) returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.site_settings%rowtype; a public.articles%rowtype; moved integer=0; removed integer=0; actual integer;
begin
 select * into cfg from public.site_settings where id=1 for share;
 if not found or (cfg.auto_cleanup_enabled<>1 and not p_preview) then return jsonb_build_object('enabled',false,'moved',0,'deleted',0); end if;
 if not pg_try_advisory_xact_lock(717021,20261123) then return jsonb_build_object('busy',true); end if;
 for a in select ar.* from public.articles ar where ar.status in ('pending','rejected') and ar.processing_status='completed'
 and not ar.retention_ever_published and ar.published_at is null and ar.site_published_at is null
 and (ar.status='rejected' or (ar.manually_reviewed=false and ar.importance is not null))
 and greatest(ar.retention_since,ar.updated_at) <= now()-make_interval(days=>case when ar.status='pending' then cfg.pending_retention_days else cfg.rejected_retention_days end)
 and not exists(select 1 from public.article_drafts d where d.article_id=ar.id)
 order by ar.retention_since,ar.id limit 100 for update of ar skip locked
 loop
  if exists(select 1 from public.article_drafts d where d.article_id=a.id) then continue; end if;
  if a.status='pending' then
   if p_preview then moved=moved+1; else
    update public.articles set status='rejected',updated_at=now() where id=a.id;
    get diagnostics actual=row_count; moved=moved+actual;
   end if;
  else
   if p_preview then removed=removed+1; else
    insert into article_retention.deleted_sources(source_url,article_id) values(a.source_url,a.id) on conflict(source_url) do nothing;
    delete from public.articles where id=a.id;
    get diagnostics actual=row_count; removed=removed+actual;
   end if;
  end if;
 end loop;
 return jsonb_build_object('enabled',cfg.auto_cleanup_enabled=1,'preview',p_preview,'moved',moved,'deleted',removed);
end $$;
revoke all on function article_retention.run_cleanup(boolean) from public,anon,authenticated,service_role;
select cron.schedule('ilovegame-article-retention','15 18 * * *','select article_retention.run_cleanup(false);');
```
