-- Included by game-catalog.sql in the same disposable database/session.
\ir ../../database/game-discoveries.sql
select public.register_game_discovery('10000000-0000-0000-0000-000000000001','Candidate title','Original candidate','Known summary','Interesting terrain interaction','https://example.org/discovery','official');
select public.register_game_discovery('10000000-0000-0000-0000-000000000001','Candidate title','Original candidate','Known summary','Interesting terrain interaction','https://example.org/discovery','official');
-- Repeated source/title under another ingestion UUID must not overwrite a reviewed candidate.
select public.review_game_discovery('10000000-0000-0000-0000-000000000001','hold',null);
select public.register_game_discovery('10000000-0000-0000-0000-000000000002','Candidate title','Other original','Other summary','Other reason','https://example.org/discovery','media');
select pg_temp.rejects($q$select public.register_game_discovery('10000000-0000-0000-0000-000000000001','Changed title','','','Reason','https://example.org/discovery','official')$q$,'23505');
do $$ begin
 if (select count(*) from public.game_discoveries)<>1 then raise exception 'Candidate ingestion duplicated';end if;
 if (select status from public.game_discoveries limit 1)<>'held' then raise exception 'Reingestion overwrote review';end if;
 if (select reason from public.game_discoveries limit 1)<>'Interesting terrain interaction' then raise exception 'Reingestion overwrote evidence';end if;
 if (select jsonb_array_length(public.list_game_discoveries('held',0)))<>1 then raise exception 'Candidate list failed';end if;
 if not(select relrowsecurity from pg_class where oid='public.game_discoveries'::regclass) then raise exception 'Missing RLS';end if;
 if has_table_privilege('anon','public.game_discoveries','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.game_discoveries','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Candidate leak';end if;
 if has_function_privilege('anon','public.review_game_discovery(uuid,text,uuid)','EXECUTE') or has_function_privilege('authenticated','public.review_game_discovery(uuid,text,uuid)','EXECUTE') then raise exception 'Review RPC leak';end if;
end $$;
select public.review_game_discovery('10000000-0000-0000-0000-000000000001','reopen',null);
-- A source insert failure must roll back the game AND leave the candidate unadopted.
create trigger fail_test_source before insert on public.game_sources for each row execute function pg_temp.fail_catalog_source();
select pg_temp.rejects($q$select public.review_game_discovery('10000000-0000-0000-0000-000000000001','adopt_new',null)$q$,'23514');
drop trigger fail_test_source on public.game_sources;
do $$ begin
 if exists(select 1 from public.games where id='10000000-0000-0000-0000-000000000001') then raise exception 'Failed adoption left a game';end if;
 if (select status from public.game_discoveries limit 1)<>'pending' then raise exception 'Failed adoption changed review state';end if;
end $$;
select public.review_game_discovery('10000000-0000-0000-0000-000000000001','adopt_new',null);
select public.review_game_discovery('10000000-0000-0000-0000-000000000001','adopt_new',null);
select pg_temp.rejects($q$select public.review_game_discovery('10000000-0000-0000-0000-000000000001','hold',null)$q$,'23505');
select public.register_game_discovery('10000000-0000-0000-0000-000000000003','Candidate title','','Another summary','Another point','https://example.org/second-source','media');
do $$ begin
 if not exists(select 1 from jsonb_array_elements(public.list_game_discoveries('pending',0)) d where jsonb_array_length(d->'matches')>=1) then raise exception 'Missing duplicate suggestions';end if;
end $$;
select public.review_game_discovery('10000000-0000-0000-0000-000000000003','adopt_existing','10000000-0000-0000-0000-000000000001');
do $$ begin
 if (select count(*) from public.game_sources where game_id='10000000-0000-0000-0000-000000000001')<>2 then raise exception 'Existing adoption source missing';end if;
 if (select description from public.games where id='10000000-0000-0000-0000-000000000001')<>'Known summary' then raise exception 'Existing work overwritten';end if;
 if (select status from public.games where id='10000000-0000-0000-0000-000000000001')<>'draft' then raise exception 'Adoption published work';end if;
 if exists(select 1 from public.article_games where game_id='10000000-0000-0000-0000-000000000001') then raise exception 'Adoption changed articles';end if;
end $$;
select pg_temp.rejects($q$select public.review_game_discovery('10000000-0000-0000-0000-000000000001','adopt_existing','00000000-0000-0000-0000-000000000001')$q$,'23505');
select 'Game discovery database checks passed' as result;
