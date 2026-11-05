-- Run after installing database/game-following.sql. No fixture survives this transaction.
begin;
do $$
declare gid uuid:=gen_random_uuid();second_id uuid:=gen_random_uuid();saved public.games;started timestamptz;before_articles bigint;before_releases bigint;
begin
 select count(*) into before_articles from public.articles;
 select count(*) into before_releases from public.game_releases;
 saved:=public.create_followed_game(gid,'Following fixture '||gid,'','','https://example.org/following/'||gid,'official');
 if not(select is_favorite and is_managed from public.game_following where game_id=gid) then raise exception 'Manual registration did not favorite';end if;
 perform public.set_game_following(gid,'favorite_off');
 perform public.create_followed_game(gid,'Following fixture '||gid,'','','https://example.org/following/'||gid,'official');
 if(select is_favorite from public.game_following where game_id=gid) then raise exception 'Retry reenabled favorite';end if;
 perform public.set_game_following(gid,'favorite_on');started:=clock_timestamp();
 if not public.record_game_following_check(gid,started,'no_change','Verified test','[]') then raise exception 'Check not recorded';end if;
 perform public.set_game_following(gid,'remove');
 if(select is_favorite or is_managed from public.game_following where game_id=gid) then raise exception 'Removal retained favorite';end if;
 if public.record_game_following_check(gid,started,'news_found','stale','[]') then raise exception 'Late write overwrote opt out';end if;
 if public.search_managed_games('Following fixture '||gid,0,'managed')<>'[]'::jsonb then raise exception 'Removed game visible';end if;
 if jsonb_array_length(public.search_managed_games('Following fixture '||gid,0,'removed'))<>1 then raise exception 'Removed game missing';end if;
 perform public.set_game_following(gid,'restore');
 if(select is_favorite from public.game_following where game_id=gid) then raise exception 'Restore silently started tracking';end if;
 saved:=public.register_followed_title(second_id,'Title-only fixture '||second_id);
 if saved.status<>'draft' then raise exception 'Title-only publication';end if;
 saved:=public.register_followed_title(gen_random_uuid(),'Title-only fixture '||second_id);
 if saved.id<>second_id then raise exception 'Title-only duplicate';end if;
 if (select count(*) from public.articles)<>before_articles or (select count(*) from public.game_releases)<>before_releases then raise exception 'Public content changed';end if;
 if has_table_privilege('anon','public.game_following','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.game_following','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Following table exposed';end if;
 if not(select relrowsecurity from pg_class where oid='public.game_following'::regclass) then raise exception 'RLS missing';end if;
 if has_function_privilege('anon','public.set_game_following(uuid,text)','EXECUTE') or has_function_privilege('authenticated','public.register_followed_title(uuid,text)','EXECUTE') then raise exception 'RPC exposed';end if;
end $$;
rollback;
