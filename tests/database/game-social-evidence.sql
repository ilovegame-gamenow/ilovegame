\ir ../../database/game-social-evidence.sql
begin;
create function pg_temp.social_input() returns jsonb language sql as $$
select jsonb_build_object('game_id','00000000-0000-0000-0000-000000000001','post_url','https://bsky.app/profile/amongusstory.bsky.social/post/test1',
'platform','bluesky','actor','amongusstory.bsky.social','verified_by','https://www.innersloth.com/among-us-story-on-guard-demo-available-now/',
'observed_at','2026-11-01T12:00:00Z','published_at','2026-10-30T12:00:00Z','likes',0,'reposts',4,'replies',null,'quotes',1)
$$;
set local role anon;
select pg_temp.rejects('select * from public.game_social_observations','42501');
select pg_temp.rejects($q$select public.save_game_social_evidence('{}')$q$,'42501');
reset role;
set local role service_role;
select public.save_game_social_evidence(pg_temp.social_input());
select public.save_game_social_evidence(pg_temp.social_input());
reset role;
do $$ begin
 if (select count(*) from public.game_social_observations)<>1 then raise exception 'Retry duplicated observation';end if;
 if not exists(select 1 from public.game_social_observations where likes=0 and replies is null)then raise exception 'Missing and zero conflated';end if;
 if not exists(select 1 from public.game_sources where url like '%/post/test1' and review_status='pending')then raise exception 'Source was automatically verified';end if;
end $$;
select pg_temp.rejects($q$select public.save_game_social_evidence(pg_temp.social_input() || '{"likes":12}'::jsonb)$q$,'23505');
select pg_temp.rejects($q$select public.save_game_social_evidence(pg_temp.social_input() || '{"game_id":"00000000-0000-0000-0000-999999999999"}'::jsonb)$q$,'23503');
select pg_temp.rejects($q$select public.save_game_social_evidence(pg_temp.social_input() || '{"post_url":"https://evil.invalid/post"}'::jsonb)$q$,'22023');
select pg_temp.rejects($q$select public.save_game_social_evidence(pg_temp.social_input() || '{"observed_at":"2026-11-01T12:01:00Z","likes":-1}'::jsonb)$q$,'23514');
select public.save_game_social_evidence(pg_temp.social_input() || '{"observed_at":"2026-11-01T12:01:00Z","likes":12}'::jsonb);
do $$ begin
 if (select count(*) from public.game_social_observations)<>2 then raise exception 'New observation missing';end if;
 if (select count(*) from public.game_sources where url like '%/post/test1')<>1 then raise exception 'Source duplicated';end if;
end $$;
rollback;
