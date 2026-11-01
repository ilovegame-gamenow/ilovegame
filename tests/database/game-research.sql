\ir ../../database/game-research.sql
select public.prepare_game_research('20000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('appid',12345,'candidate_id','20000000-0000-0000-0000-000000000011','title','Steam research fixture','url','https://store.steampowered.com/app/12345/','description','Cooperative puzzles with changing terrain and voice communication between two players.')));
-- Preparing the same id must preserve its immutable source snapshot.
select public.prepare_game_research('20000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('appid',12345,'candidate_id','20000000-0000-0000-0000-000000000011','title','Changed fixture','url','https://store.steampowered.com/app/12345/','description','Cooperative puzzles with changing terrain and voice communication between two players.')));
select public.claim_game_research('20000000-0000-0000-0000-000000000001');
select pg_temp.rejects($q$select public.claim_game_research('20000000-0000-0000-0000-000000000001')$q$,'23505');
select pg_temp.rejects($q$select public.complete_game_research('20000000-0000-0000-0000-000000000001','{"items":[{"appid":12345,"selected":true,"description":"Summary","reason":"Reason","evidence":"Invented evidence"}]}')$q$,'22023');
-- Successful completion and retries create only one AI candidate, never a published work.
select public.complete_game_research('20000000-0000-0000-0000-000000000001','{"items":[{"appid":12345,"selected":true,"description":"協力型パズル。","reason":"地形が変わる仕掛けが特徴。","evidence":"Cooperative puzzles"}],"usage":{"input_tokens":100,"output_tokens":50},"model":"gpt-5-mini"}');
select public.complete_game_research('20000000-0000-0000-0000-000000000001','{}');
do $$ begin
 if (select count(*) from public.game_discoveries where source_url='https://store.steampowered.com/app/12345/')<>1 then raise exception 'Research duplicated candidates';end if;
 if (select discovered_by from public.game_discoveries where id='20000000-0000-0000-0000-000000000011')<>'ai' then raise exception 'AI provenance missing';end if;
 if (select title from public.game_discoveries where id='20000000-0000-0000-0000-000000000011')<>'Steam research fixture' then raise exception 'Snapshot overwritten';end if;
 if exists(select 1 from public.games where id='20000000-0000-0000-0000-000000000011') then raise exception 'Research auto-adopted a work';end if;
 if not (12345=any(public.known_steam_research_ids(array[12345::bigint]))) then raise exception 'Known source not excluded';end if;
 if has_table_privilege('anon','public.game_research_runs','SELECT,INSERT,UPDATE') or has_table_privilege('authenticated','public.game_research_runs','SELECT,INSERT,UPDATE') then raise exception 'Research snapshots exposed';end if;
 if has_function_privilege('anon','public.claim_game_research(uuid)','EXECUTE') or has_function_privilege('authenticated','public.complete_game_research(uuid,jsonb)','EXECUTE') then raise exception 'Research operations exposed';end if;
end $$;
-- A manual candidate must not be overwritten or relabeled as AI on a race.
select public.register_game_discovery('20000000-0000-0000-0000-000000000099','Existing manual Steam game','','Manual summary','Manual reason','https://store.steampowered.com/app/99999/','store');
select public.prepare_game_research('20000000-0000-0000-0000-000000000002',jsonb_build_array(jsonb_build_object('appid',99999,'candidate_id','20000000-0000-0000-0000-000000000012','title','Existing manual Steam game','url','https://store.steampowered.com/app/99999/','description','Cooperative puzzles with changing terrain and voice communication between two players.')));
select public.claim_game_research('20000000-0000-0000-0000-000000000002');
select public.complete_game_research('20000000-0000-0000-0000-000000000002','{"items":[{"appid":99999,"selected":true,"description":"AI summary","reason":"AI reason","evidence":"Cooperative puzzles"}]}');
do $$ begin
 if (select discovered_by from public.game_discoveries where id='20000000-0000-0000-0000-000000000099')<>'manual' then raise exception 'Manual provenance overwritten';end if;
end $$;
select public.prepare_game_research('20000000-0000-0000-0000-000000000003',jsonb_build_array(jsonb_build_object('appid',56789,'candidate_id','20000000-0000-0000-0000-000000000013','title','Failing fixture','url','https://store.steampowered.com/app/56789/','description','Cooperative puzzles with changing terrain and voice communication between two players.')));
select public.claim_game_research('20000000-0000-0000-0000-000000000003');
create trigger fail_test_candidate before insert on public.game_discoveries for each row execute function pg_temp.fail_catalog_source();
select pg_temp.rejects($q$select public.complete_game_research('20000000-0000-0000-0000-000000000003','{"items":[{"appid":56789,"selected":true,"description":"Summary","reason":"Reason","evidence":"Cooperative puzzles"}]}')$q$,'23514');
drop trigger fail_test_candidate on public.game_discoveries;
do $$ begin
 if (select status from public.game_research_runs where id='20000000-0000-0000-0000-000000000003')<>'running' then raise exception 'Failed completion partially committed';end if;
 if exists(select 1 from public.game_discoveries where id='20000000-0000-0000-0000-000000000013') then raise exception 'Failed completion left a candidate';end if;
end $$;
select public.fail_game_research('20000000-0000-0000-0000-000000000003');
select public.prepare_game_research('20000000-0000-0000-0000-000000000004',jsonb_build_array(jsonb_build_object('appid',56789,'candidate_id','20000000-0000-0000-0000-000000000014','title','Daily limit fixture','url','https://store.steampowered.com/app/56789/','description','Cooperative puzzles with changing terrain and voice communication between two players.')));
select pg_temp.rejects($q$select public.claim_game_research('20000000-0000-0000-0000-000000000004')$q$,'23505');
select 'Research database checks passed' as result;
