-- Run only against a disposable, empty PostgreSQL database as its owner.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table public.articles (id bigint primary key, title text not null);
insert into public.articles values (1, 'Existing article');
\ir ../../database/game-catalog.sql

create function pg_temp.rejects(statement text, expected_state text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = any(string_to_array(expected_state, ',')) then return; end if;
    raise;
  end;
  raise exception 'Statement unexpectedly succeeded: %', statement;
end;
$$;

-- Explicit IDs are test fixtures only, never production seeds.
insert into public.games (id,title) values
 ('00000000-0000-0000-0000-000000000001','Same title'),
 ('00000000-0000-0000-0000-000000000002','Same title');
insert into public.game_sources (id,game_id,url,source_type) values
 ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','https://example.org/game','official'),
 ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000002','https://example.org/other','store');
insert into public.game_external_ids values ('steam','123','00000000-0000-0000-0000-000000000001');
insert into public.game_releases (game_id,platform_code,region_code,release_date,date_precision,source_id) values
 ('00000000-0000-0000-0000-000000000001','switch-2','JP','2027-02-28','day','00000000-0000-0000-0000-000000000011'),
 ('00000000-0000-0000-0000-000000000001','ps5','JP','2027-03-01','month','00000000-0000-0000-0000-000000000011'),
 ('00000000-0000-0000-0000-000000000001','windows','WW','2028-01-01','year','00000000-0000-0000-0000-000000000011'),
 ('00000000-0000-0000-0000-000000000002','windows','JP',null,'unknown','00000000-0000-0000-0000-000000000012');
insert into public.game_releases (game_id,platform_code,region_code,release_kind,source_id) values
 ('00000000-0000-0000-0000-000000000001','windows','WW','early_access','00000000-0000-0000-0000-000000000011');
insert into public.article_games (article_id,game_id) values
 (1,'00000000-0000-0000-0000-000000000001'),(1,'00000000-0000-0000-0000-000000000002');

select pg_temp.rejects($q$insert into public.games(title) values (' ')$q$, '23514');
select pg_temp.rejects($q$insert into public.game_external_ids values ('steam','123','00000000-0000-0000-0000-000000000002')$q$, '23505');
select pg_temp.rejects($q$insert into public.game_sources(game_id,url,source_type) values ('00000000-0000-0000-0000-000000000001','https://example.org/game','official')$q$, '23505');
select pg_temp.rejects($q$update public.game_sources set review_status='verified' where id='00000000-0000-0000-0000-000000000011'$q$, '23514');
select pg_temp.rejects($q$update public.game_sources set url='javascript:alert(1)'$q$, '23514');
select pg_temp.rejects($q$update public.game_releases set source_id='00000000-0000-0000-0000-000000000012' where game_id='00000000-0000-0000-0000-000000000001'$q$, '23503');
select pg_temp.rejects($q$update public.game_releases set date_precision='unknown' where platform_code='ps5'$q$, '23514');
select pg_temp.rejects($q$update public.game_releases set release_date='2027-03-02' where platform_code='ps5'$q$, '23514');
select pg_temp.rejects($q$update public.game_releases set release_date='2028-02-01' where date_precision='year'$q$, '23514');
select pg_temp.rejects($q$update public.game_releases set release_date=null where date_precision='day'$q$, '23514');
select pg_temp.rejects($q$update public.game_releases set release_date='infinity' where date_precision='day'$q$, '23514');
select pg_temp.rejects($q$update public.game_releases set release_date='2027-02-30' where date_precision='day'$q$, '22008');
select pg_temp.rejects($q$update public.game_releases set platform_code='invalid' where date_precision='day'$q$, '23503');
select pg_temp.rejects($q$update public.game_releases set region_code='Japan'$q$, '23514');
select pg_temp.rejects($q$insert into public.game_releases(game_id,platform_code,region_code,source_id) values ('00000000-0000-0000-0000-000000000001','ps5','JP','00000000-0000-0000-0000-000000000011')$q$, '23505');
select pg_temp.rejects($q$insert into public.article_games values (999,'00000000-0000-0000-0000-000000000001',now())$q$, '23503');
select pg_temp.rejects($q$delete from public.games where id='00000000-0000-0000-0000-000000000001'$q$, '23503,23001');

-- Database-managed timestamps and safe calendar selection.
update public.games set title='Updated title', updated_at='2000-01-01' where id='00000000-0000-0000-0000-000000000001';
update public.game_sources set review_status='verified', verified_at=now() where id='00000000-0000-0000-0000-000000000011';
update public.games set status='published' where id='00000000-0000-0000-0000-000000000001';
update public.game_releases set verified_at=now();

do $$
declare t text; r text;
begin
  if (select count(*) from public.games) <> 2 then raise exception 'Titles incorrectly deduplicated'; end if;
  if (select count(*) from public.article_games where article_id=1) <> 2 then raise exception 'Multi-game article failed'; end if;
  if (select title from public.articles where id=1) <> 'Existing article' then raise exception 'Existing article changed'; end if;
  if (select updated_at from public.games where id='00000000-0000-0000-0000-000000000001') <= '2000-01-01' then raise exception 'Timestamp trigger failed'; end if;
  if (select count(*) from public.game_releases r join public.games g on g.id=r.game_id join public.game_sources s on s.id=r.source_id
      where g.status='published' and s.review_status='verified' and r.verified_at is not null
      and r.date_precision='day' and r.region_code='JP' and r.status in ('announced','released')) <> 1 then
    raise exception 'Calendar included uncertain or unverified data';
  end if;
  foreach t in array array['games','game_platforms','game_sources','game_external_ids','game_releases','article_games'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'RLS missing on %',t; end if;
    foreach r in array array['anon','authenticated'] loop
      if has_table_privilege(r,'public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then raise exception 'Unexpected browser access: % %',r,t; end if;
    end loop;
    if not has_table_privilege('service_role','public.'||t,'SELECT') or not has_table_privilege('service_role','public.'||t,'INSERT') or not has_table_privilege('service_role','public.'||t,'UPDATE') or not has_table_privilege('service_role','public.'||t,'DELETE') then raise exception 'Server CRUD missing on %',t; end if;
  end loop;
end;
$$;

-- Test actual roles as well as ACL metadata.
do $$
declare r text; denied boolean;
begin
  foreach r in array array['anon','authenticated'] loop
    execute format('set local role %I', r);
    denied := false;
    begin
      perform * from public.games;
    exception when insufficient_privilege then denied := true;
    end;
    reset role;
    if not denied then raise exception 'Unreviewed works exposed to %', r; end if;
  end loop;
end $$;
begin;
set local role service_role;
update public.games set description='Server update works' where id='00000000-0000-0000-0000-000000000001';
rollback;

update public.game_releases set status='delayed', release_date=null, date_precision='unknown', release_label='延期・発売日未定'
where date_precision='day';
do $$ begin
  if exists (select 1 from public.game_releases where region_code='JP' and date_precision='day' and status in ('announced','released')) then
    raise exception 'Delayed release still on calendar';
  end if;
end $$;

-- Article deletion removes only its links, preserving the work catalog.
delete from public.articles where id=1;
do $$ begin
  if exists (select 1 from public.article_games) then raise exception 'Orphan article link'; end if;
  if (select count(*) from public.games) <> 2 then raise exception 'Article deletion removed games'; end if;
end $$;
select 'Game catalog database checks passed' as result;

-- Stage 2 editor RPCs, on the same isolated DB.
\ir ../../database/game-catalog-editor.sql
insert into public.articles values (2,'Unchanged editor article');
select public.create_editor_game('00000000-0000-0000-0000-000000000050','Literal %_* title','English Title','Description','https://example.org/manual','official');
-- Same creation request is safe to repeat.
select public.create_editor_game('00000000-0000-0000-0000-000000000050','Literal %_* title','English Title','Description','https://example.org/manual','official');
select pg_temp.rejects($q$select public.create_editor_game('00000000-0000-0000-0000-000000000050','Different title','','','https://example.org/manual','official')$q$, '23505');
select pg_temp.rejects($q$select public.create_editor_game('00000000-0000-0000-0000-000000000051','Invalid source','','','javascript:alert(1)','official')$q$, '22023');
select pg_temp.rejects($q$select public.search_editor_games('',-1)$q$, '22023');

do $$
begin
  if (select count(*) from public.games where id='00000000-0000-0000-0000-000000000050')<>1 then raise exception 'Creation duplicated'; end if;
  if (select count(*) from public.game_sources where game_id='00000000-0000-0000-0000-000000000050')<>1 then raise exception 'Source duplicated'; end if;
  if exists(select 1 from public.games where id='00000000-0000-0000-0000-000000000051') then raise exception 'Invalid creation left a work'; end if;
  if (select count(*) from public.search_editor_games('%_*',0))<>1 then raise exception 'Search treated punctuation as wildcards'; end if;
  if (select count(*) from public.search_editor_games('ENGLISH',0))<>1 then raise exception 'Original title search failed'; end if;
  if (select status from public.games where id='00000000-0000-0000-0000-000000000050')<>'draft' then raise exception 'Work automatically published'; end if;
  if exists(select 1 from public.game_sources where game_id='00000000-0000-0000-0000-000000000050' and review_status<>'pending') then raise exception 'Source automatically verified'; end if;
  if has_function_privilege('anon','public.create_editor_game(uuid,text,text,text,text,text)','EXECUTE') or
     has_function_privilege('authenticated','public.create_editor_game(uuid,text,text,text,text,text)','EXECUTE') or
     has_function_privilege('anon','public.search_editor_games(text,integer)','EXECUTE') or
     has_function_privilege('authenticated','public.search_editor_games(text,integer)','EXECUTE') then raise exception 'Editor RPC accessible to browser roles'; end if;
end $$;

-- Force the second insert to fail and confirm the work insert also rolls back.
create function pg_temp.fail_catalog_source() returns trigger language plpgsql as $$
begin raise exception 'Simulated source insert failure' using errcode='23514'; end $$;
create trigger fail_test_source before insert on public.game_sources for each row execute function pg_temp.fail_catalog_source();
select pg_temp.rejects($q$select public.create_editor_game('00000000-0000-0000-0000-000000000052','Atomic test','','','https://example.org/atomic','official')$q$, '23514');
drop trigger fail_test_source on public.game_sources;
do $$ begin
  if exists(select 1 from public.games where id='00000000-0000-0000-0000-000000000052') then raise exception 'Partial creation survived'; end if;
end $$;

begin;
set local role service_role;
select public.create_editor_game('00000000-0000-0000-0000-000000000053','Server creation','','','https://example.org/server','store');
select count(*) from public.search_editor_games('Server',0);
insert into public.article_games(article_id,game_id) values (2,'00000000-0000-0000-0000-000000000053') on conflict(article_id,game_id) do nothing;
insert into public.article_games(article_id,game_id) values (2,'00000000-0000-0000-0000-000000000053') on conflict(article_id,game_id) do nothing;
delete from public.article_games where article_id=2 and game_id='00000000-0000-0000-0000-000000000053';
commit;
do $$ begin
  if (select title from public.articles where id=2)<>'Unchanged editor article' then raise exception 'Article content changed'; end if;
  if exists(select 1 from public.article_games where article_id=2) then raise exception 'Unlink failed'; end if;
  if not exists(select 1 from public.games where id='00000000-0000-0000-0000-000000000053') then raise exception 'Unlink deleted work'; end if;
end $$;
select 'Game catalog editor checks passed' as result;
